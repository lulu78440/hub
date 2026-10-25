// Noyau · adaptateur unique avec le hub (annexe A du contrat).
// C'est le SEUL fichier de js/noyau/ qui connaît le hub : stockage, coffre, réglages, actualité, fenêtres, orbe.
// Tous les autres modules lisent `hote` et ne font aucun import vers le hub. Le laboratoire (labo.html) branche à la place
// un hub simulé (labo/hub-simule.js) avec brancher(), sans toucher aux vraies données.
//
// Forme attendue d'un hôte (en français, pour être lisible par Lucien) :
//   nom, maintenant(), enLigne(), fetch(url, opts), nouvelId(prefixe)
//   stockage : tout(coll), lire(coll, id), ecrire(coll, obj), ecrireMany(coll, objs), retirerMany(coll, ids) *, surChangement(coll, fn)
//   reglage  : lire(cle, defaut), ecrire(cle, valeur)
//   secret   : cle() -> clé Gemini ou null, cleClaude() -> clé Claude ou null, definirCleClaude(k), protege() -> vrai si le coffre est actif
//   hub      : actus() -> flux.json ou null, meteo() -> cache météo ou null, agir(nom, params) -> { ok, ... }
//   sauvegarde (facultatif) : dispo(), dossier() -> {nom}|null, choisir(), droit() -> 'granted'|'prompt'|..., ecrire() -> {nom, octets}, retirer()
//   ui       : toast(msg), orbe({ phase, humeur }), ajouterMenuFond(fn), conteneur() -> élément où monter la fenêtre
//   * retirerMany ne sert qu'à annuler un import raté : le Noyau n'a aucun outil de suppression.

export const hote = { pret: false, nom: "(non branché)" };

/** Branche un hôte (hub réel ou hub simulé du laboratoire). */
const reseauLog = [];
export function brancher(impl) {
  Object.keys(hote).forEach((k) => delete hote[k]);
  const f = impl.fetch;
  // Chaque connexion vers un autre site est notée (nom du site et heure seulement) : la fenêtre Sécurité les montre.
  const note = (u) => { try { const x = new URL(String(u), typeof location !== "undefined" ? location.href : "http://local/"); if (typeof location === "undefined" || x.host !== location.host) { reseauLog.push({ hote: x.hostname, quand: new Date().toISOString() }); if (reseauLog.length > 400) reseauLog.shift(); } } catch (e) { /* adresse illisible */ } };
  Object.assign(hote, impl, { pret: true, reseauJournal: () => reseauLog.slice(), fetch: f ? (u, o) => { note(u); return f(u, o); } : f });
  return hote;
}

/** Hôte réel : le hub. Les imports sont dynamiques pour que le laboratoire n'en charge aucun. */
export async function brancherHub() {
  const [{ store, newId }, { prefs }, { vault }, fluxMod, stateMod, menus, toastMod] = await Promise.all([
    import("../store/storage.js"), import("../store/prefs.js"), import("../store/vault.js"),
    import("../widgets/flux.js"), import("../state.js"), import("../ui/menus.js"), import("../ui/toast.js")
  ]);
  const { state, pulse } = stateMod;
  const COULEURS = { calme: 0x37e0ff, curieux: 0x4fd1ff, enthousiaste: 0xffb347, vigilant: 0xff8a3d, amuse: 0x9b72ff, preoccupe: 0xff5d73 };
  return brancher({
    nom: "hub",
    maintenant: () => new Date(),
    enLigne: () => navigator.onLine !== false,
    fetch: (u, o) => fetch(u, o),
    nouvelId: (p = "") => newId(p),
    stockage: {
      tout: (c) => store.all(c),
      lire: (c, id) => store.get(c, id),
      ecrire: (c, o) => store.put(c, o),
      ecrireMany: (c, os) => store.putMany(c, os),
      retirerMany: (c, ids) => store.delMany(c, ids),
      surChangement: (c, fn) => store.on(c, fn)
    },
    reglage: { lire: (k, d) => prefs.get(k, d), ecrire: (k, v) => prefs.set(k, v) },
    secret: {
      cle: () => vault.lsGet("hub-secret-ia") || null, protege: () => vault.active,
      cleClaude: () => vault.lsGet("hub-secret-claude") || null,
      definirCleClaude: (k) => { if (!vault.active) throw new Error("Active d'abord le verrouillage du hub (Diag → Verrouillage) : la clé ne se garde que chiffrée."); if (k) vault.lsSet("hub-secret-claude", k); else vault.lsRemove("hub-secret-claude"); }
    },
    hub: {
      actus: () => fluxMod.flux.data,
      meteo: () => { try { return JSON.parse(prefs.get("meteo-cache", "null")); } catch (e) { return null; } },
      contexteLive: () => ({
        focus: document.body.classList.contains("focus"),
        verrouille: document.body.classList.contains("locked"),
        media: [...document.querySelectorAll("audio,video")].some((m) => !m.paused && !m.ended),
        fenetre: ((document.querySelector(".win:hover h2") || {}).textContent || "").trim() || null
      }),
      agir: async (nom, params = {}) => {
        if (nom === "afficher") {
          const id = String(params.fenetre || "");
          if (!document.querySelector('.win[data-id="' + CSS.escape(id) + '"]')) return { ok: false, erreur: "Fenêtre inconnue : " + id };
          document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: id }));
          return { ok: true, resume: "Fenêtre « " + id + " » ramenée." };
        }
        if (nom === "lire_fenetre") {
          const w = document.querySelector('.win[data-id="' + CSS.escape(String(params.fenetre || "")) + '"]');
          if (!w) return { ok: false, erreur: "Fenêtre inconnue : " + params.fenetre };
          return { ok: true, fenetre: params.fenetre, texte: ((w.querySelector(".pb") || w).innerText || "").replace(/\s+/g, " ").trim().slice(0, 1500) };
        }
        if (nom === "lancer_focus") {
          const s = window.__hub && window.__hub.surprises;
          if (!s || !s.startFocus) return { ok: false, erreur: "Le mode Focus n'est pas disponible." };
          s.startFocus(params.minutes); return { ok: true, resume: "Focus " + params.minutes + " min lancé." };
        }
        return { ok: false, erreur: "Action « " + nom + " » non branchée dans cette version du hub." };
      }
    },
    // Sauvegarde automatique chiffrée dans un dossier du PC (File System Access API). Le dossier est choisi par Lucien ; le Noyau n'y écrit que des fichiers hub-sauvegarde-*.json.
    sauvegarde: (() => {
      const IDB = () => new Promise((ok, ko) => { const r = indexedDB.open("noyau-sauvegarde", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
      const lire = async () => { const db = await IDB(); return new Promise((ok) => { const q = db.transaction("k").objectStore("k").get("dossier"); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); };
      const poser = async (v) => { const db = await IDB(); return new Promise((ok, ko) => { const t = db.transaction("k", "readwrite"); v ? t.objectStore("k").put(v, "dossier") : t.objectStore("k").delete("dossier"); t.oncomplete = ok; t.onerror = () => ko(t.error); }); };
      const pad = (n) => String(n).padStart(2, "0");
      return {
        dispo: () => typeof window.showDirectoryPicker === "function",
        dossier: async () => { try { const h = await lire(); return h ? { nom: h.name } : null; } catch (e) { return null; } },
        choisir: async () => { const h = await window.showDirectoryPicker({ mode: "readwrite", id: "hub-sauvegarde" }); await poser(h); return { nom: h.name }; },
        droit: async () => { try { const h = await lire(); return h ? await h.queryPermission({ mode: "readwrite" }) : "aucun"; } catch (e) { return "aucun"; } },
        retirer: async () => { await poser(null); },
        ecrire: async ({ demander = false } = {}) => {
          const h = await lire(); if (!h) throw new Error("Aucun dossier choisi.");
          let d = await h.queryPermission({ mode: "readwrite" }); if (d !== "granted" && demander) d = await h.requestPermission({ mode: "readwrite" });
          if (d !== "granted") throw new Error("Le navigateur demande de réautoriser le dossier : ouvre le Noyau → Réglages → Sauvegarde, puis « Sauvegarder maintenant ».");
          const { exportAll } = await import("../store/storage.js"), { VERSION } = await import("../version.js"), n = new Date();
          const data = await exportAll(VERSION), scelle = vault.active, fichier = scelle ? await vault.sealExport(data) : data;
          const nom = `hub-sauvegarde-${scelle ? "chiffree-" : ""}${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}.json`, texte = JSON.stringify(fichier);
          const f = await h.getFileHandle(nom, { create: true }), w = await f.createWritable(); await w.write(texte); await w.close();
          try { const anciens = []; for await (const [k] of h.entries()) if (/^hub-sauvegarde-.*\.json$/.test(k) && k !== nom) anciens.push(k); anciens.sort().slice(0, Math.max(anciens.length - 6, 0)).forEach((k) => h.removeEntry(k).catch(() => {})); } catch (e) { /* ménage facultatif */ }
          prefs.set("dernier-export", n.toISOString()); prefs.set("derniere-sauvegarde-auto", n.toISOString());
          return { nom, octets: texte.length, chiffre: scelle };
        }
      };
    })(),
    racine: () => new URL("./", location.href).href,
    systeme: async () => {
      let swVersion = null;
      try { const reg = navigator.serviceWorker && navigator.serviceWorker.controller; if (reg) swVersion = await new Promise((ok) => { const mc = new MessageChannel(); mc.port1.onmessage = (e) => ok(e.data && e.data.version); reg.postMessage({ type: "VERSION" }, [mc.port2]); setTimeout(() => ok(null), 1500); }); } catch (e) { swVersion = null; }
      let persistant, quotaPct = null;
      try { persistant = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); const q = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; if (q && q.quota) quotaPct = Math.round((q.usage / q.quota) * 100); } catch (e) { persistant = undefined; }
      const { VERSION } = await import("../version.js");
      return { verrou: vault.active, deverrouille: vault.unlocked, cleIA: !!vault.lsGet("hub-secret-ia") || !!vault.lsGet("hub-secret-claude"), dernierExport: prefs.get("dernier-export", ""), version: VERSION, swVersion, stockagePersistant: persistant, quotaPct };
    },
    ui: {
      toast: (m) => toastMod.toast(m),
      orbe: ({ phase, humeur } = {}) => {
        state.accent = (phase && phase !== "repos") ? (COULEURS[humeur] || COULEURS.calme) : null;
        if (phase === "reflechit" || phase === "cherche" || phase === "parle") pulse(0.7);
        state.energyTarget = phase === "reflechit" || phase === "cherche" ? 0.6 : 0;
      },
      ajouterMenuFond: (fn) => menus.extendMenu("fond", fn),
      ajouterMenuFenetre: (fn) => menus.extendMenu("fenetre", fn),
      exporter: () => window.__hub && window.__hub.data && window.__hub.data.exportFile(),
      conteneur: () => document.querySelector('.win[data-id="noyau"] .pb')
    }
  });
}
