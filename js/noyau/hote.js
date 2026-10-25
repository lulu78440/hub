// Noyau · adaptateur unique avec le hub (annexe A du contrat).
// C'est le SEUL fichier de js/noyau/ qui connaît le hub : stockage, coffre, réglages, actualité, fenêtres, orbe.
// Tous les autres modules lisent `hote` et ne font aucun import vers le hub. Le laboratoire (labo.html) branche à la place
// un hub simulé (labo/hub-simule.js) avec brancher(), sans toucher aux vraies données.
//
// Forme attendue d'un hôte (en français, pour être lisible par Lucien) :
//   nom, maintenant(), enLigne(), fetch(url, opts), nouvelId(prefixe)
//   stockage : tout(coll), lire(coll, id), ecrire(coll, obj), ecrireMany(coll, objs), retirerMany(coll, ids) *, surChangement(coll, fn)
//   reglage  : lire(cle, defaut), ecrire(cle, valeur)
//   secret   : cle() -> clé Gemini ou null, protege() -> vrai si le coffre est actif
//   hub      : actus() -> flux.json ou null, meteo() -> cache météo ou null, agir(nom, params) -> { ok, ... }
//   ui       : toast(msg), orbe({ phase, humeur }), ajouterMenuFond(fn), conteneur() -> élément où monter la fenêtre
//   * retirerMany ne sert qu'à annuler un import raté : le Noyau n'a aucun outil de suppression.

export const hote = { pret: false, nom: "(non branché)" };

/** Branche un hôte (hub réel ou hub simulé du laboratoire). */
export function brancher(impl) {
  Object.keys(hote).forEach((k) => delete hote[k]);
  Object.assign(hote, impl, { pret: true });
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
    secret: { cle: () => vault.lsGet("hub-secret-ia") || null, protege: () => vault.active },
    hub: {
      actus: () => fluxMod.flux.data,
      meteo: () => { try { return JSON.parse(prefs.get("meteo-cache", "null")); } catch (e) { return null; } },
      contexteLive: () => ({
        focus: document.body.classList.contains("focus"),
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
    ui: {
      toast: (m) => toastMod.toast(m),
      orbe: ({ phase, humeur } = {}) => {
        state.accent = (phase && phase !== "repos") ? (COULEURS[humeur] || COULEURS.calme) : null;
        if (phase === "reflechit" || phase === "cherche" || phase === "parle") pulse(0.7);
        state.energyTarget = phase === "reflechit" || phase === "cherche" ? 0.6 : 0;
      },
      ajouterMenuFond: (fn) => menus.extendMenu("fond", fn),
      conteneur: () => document.querySelector('.win[data-id="noyau"] .pb')
    }
  });
}
