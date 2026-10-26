// Points de commande pour l'orbe (plan 3, étape p3-ia). Liste fermée de commandes aux noms stables, avec paramètres bornés et un niveau
// de permission. Le Noyau (via le Labo) les appelle avec executer(nom, params) ; il ne peut ni ajouter de commande ni faire exécuter du code.
//   libre         : s'exécute tout de suite (réversible, sans effet hors du hub)
//   confirmation  : une fenêtre demande l'accord de Lucien à chaque fois (jamais contournable par un paramètre)
// Chaque appel est journalisé (100 derniers). Rien n'est écrit dans js/noyau/ : le Labo branche seulement ces noms.
// Voir docs/refonte-auto2/commandes-orbe.md pour la liste et le contrat.
import { toast } from "./toast.js";

const APPS = ["fichiers", "pc", "internet", "mails", "direct"];
const APPS_FEN = ["fichiers", "pc", "internet", "direct"];

export function createCommandes({ appli, bureau, plans, direct }) {
  const journal = [];
  const log = (nom, params, res) => { journal.push({ t: new Date().toISOString(), nom, params, ok: res.ok, message: res.message || res.raison || "" }); if (journal.length > 100) journal.shift(); };
  const cles = () => bureau.catalogue().map((c) => c.k).filter((k) => k !== "url");

  // ---------- Demande de confirmation (fenêtre du hub, une seule à la fois, refus au bout de 60 s) ----------
  let attente = null;
  function confirmer(titre, detail) {
    if (attente) return Promise.resolve(null);   // une seule demande à la fois
    return new Promise((resolve) => {
      const d = document.createElement("div"); d.className = "bur-pop cmd-confirm"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Demande du Noyau");
      d.innerHTML = '<div class="bp-h"><h3>Le Noyau demande</h3></div><p class="cc-t"></p><p class="cc-d"></p><div class="bp-act"><button type="button" class="btn cc-no">Refuser</button><button type="button" class="btn cc-yes">Autoriser</button></div>';
      d.querySelector(".cc-t").textContent = titre; d.querySelector(".cc-d").textContent = detail || "";
      const fin = (v) => { clearTimeout(tm); removeEventListener("keydown", key, true); d.remove(); attente = null; resolve(v); };
      const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); fin(false); } };
      const tm = setTimeout(() => fin(false), 60000);
      d.querySelector(".cc-no").addEventListener("click", () => fin(false)); d.querySelector(".cc-yes").addEventListener("click", () => fin(true));
      addEventListener("keydown", key, true); document.body.append(d); attente = d; d.querySelector(".cc-no").focus();
    });
  }

  // ---------- Définitions ----------
  const ok = (message, plus) => ({ ok: true, message, ...(plus || {}) });
  const non = (raison) => ({ ok: false, raison });
  const DEF = [
    { nom: "ouvrir_appli", perm: "libre", desc: "Ouvre une appli du bureau (ou la fenêtre Mails).", params: { app: { enum: APPS } },
      run: ({ app }) => { if (app !== "mails") plans.goPlan(3); appli.open(app); return ok("Appli ouverte : " + app); } },
    { nom: "fermer_appli", perm: "libre", desc: "Ferme une fenêtre d'appli du bureau (fermer « direct » coupe le partage d'écran).", params: { app: { enum: APPS_FEN } },
      run: ({ app }) => { if (!appli.isOpen(app)) { if (app === "direct" && direct.stop(true)) return ok("Partage d'écran coupé (la fenêtre n'était pas ouverte)"); return ok("Déjà fermée : " + app); } appli.close(app); return ok("Appli fermée : " + app); } },
    { nom: "aller_plan", perm: "libre", desc: "Change de plan (1 hub, 2 salle, 3 bureau).", params: { plan: { enum: [1, 2, 3] } },
      run: ({ plan }) => { plans.goPlan(plan); return ok("Plan " + plan); } },
    { nom: "poser_icone", perm: "libre", desc: "Pose une icône du catalogue sur le bureau (une seule par entrée).", params: { cle: { enum: cles } },
      run: ({ cle }) => (bureau.list().some((i) => i.k === cle) ? ok("Déjà sur le bureau : " + cle) : (bureau.add(cle) ? ok("Icône posée : " + cle) : non("pose impossible"))) },
    { nom: "ranger_icones", perm: "libre", desc: "Range les icônes du bureau en grille.", params: {}, run: () => { bureau.arrange(); return ok("Icônes rangées"); } },
    { nom: "retirer_icone", perm: "confirmation", desc: "Retire une icône du bureau (rien n'est supprimé sur le PC).", params: { cle: { enum: cles } },
      confirm: ({ cle }) => ["Retirer l'icône « " + cle + " » du bureau ?", "Rien n'est supprimé sur le PC."],
      run: ({ cle }) => { const i = bureau.list().find((x) => x.k === cle); if (!i) return non("icône absente"); bureau.remove(i.id); return ok("Icône retirée : " + cle); } },
    { nom: "ecran_direct_demarrer", perm: "confirmation", desc: "Démarre l'écran du PC en direct (lecture seule) : Lucien accepte ici, puis choisit lui-même l'écran. Le Noyau ne voit jamais l'image.", params: {},
      confirm: () => ["Afficher l'écran de ton PC dans une fenêtre du hub ?", "Lecture seule. Tu choisis l'écran ensuite ; rien n'est enregistré, envoyé ni analysé."],
      run: async () => { const r = await direct.start(); return r.ok ? ok(r.deja ? "Déjà actif" : "Écran en direct démarré") : non(r.raison); } },
    { nom: "ecran_direct_couper", perm: "libre", desc: "Coupe l'écran en direct.", params: {}, run: () => (direct.stop() ? ok("Écran en direct coupé") : ok("Déjà coupé")) },
    { nom: "etat_bureau", perm: "libre", desc: "Lit l'état du bureau : plan, applis ouvertes, icônes, écran en direct actif ou non (jamais son contenu).", params: {},
      run: () => ok("État", { etat: { plan: plans.plan, applis_ouvertes: appli.list(), icones: bureau.list().map((i) => ({ cle: i.k, nom: i.name })), ecran_direct: direct.active } }) },
    { nom: "catalogue_ouvrir", perm: "libre", dispo: false, raison: "catalogue de jeux pas encore disponible (poste Atelier)", desc: "Réservé : ouvre le catalogue de jeux.", params: {}, run: () => non("indisponible") },
    { nom: "jeu_lancer", perm: "confirmation", dispo: false, raison: "catalogue de jeux pas encore disponible (poste Atelier)", desc: "Réservé : lance un jeu du catalogue (confirmation obligatoire).", params: { jeu: { texte: 60 } }, run: () => non("indisponible") }
  ];

  function valider(def, params) {
    const p = params && typeof params === "object" && !Array.isArray(params) ? params : {}, out = {};
    for (const k of Object.keys(p)) if (!def.params[k]) return { err: "paramètre inconnu : " + k };
    for (const [k, r] of Object.entries(def.params)) {
      const v = p[k];
      if (r.enum) { const e = typeof r.enum === "function" ? r.enum() : r.enum; if (!e.includes(v)) return { err: "paramètre « " + k + " » invalide (attendu : " + e.join(", ") + ")" }; }
      else if (r.texte) { if (typeof v !== "string" || !v.trim() || v.length > r.texte) return { err: "paramètre « " + k + " » invalide" }; }
      out[k] = v;
    }
    return { v: out };
  }

  async function executer(nom, params) {
    const def = DEF.find((d) => d.nom === nom);
    let res;
    if (!def) res = non("commande inconnue");
    else if (def.dispo === false) res = non(def.raison);
    else {
      const c = valider(def, params);
      if (c.err) res = non(c.err);
      else {
        let permis = true;
        if (def.perm === "confirmation") { const [t, d] = def.confirm(c.v); permis = await confirmer(t, d); }
        if (permis === null) res = non("une demande de confirmation est déjà en cours");
        else if (!permis) res = { ok: false, refuse: true, raison: "refusé par Lucien" };
        else { try { res = await def.run(c.v); } catch (e) { res = non("erreur : " + ((e && e.message) || e)); } }
      }
    }
    log(nom, params, res); return { nom, ...res };
  }
  document.addEventListener("hub:commande", (e) => { const d = e.detail || {}; executer(d.nom, d.params).then((r) => { if (typeof d.repondre === "function") d.repondre(r); }); });
  return {
    executer, journal: () => journal.slice(),
    liste: () => DEF.map((d) => ({ nom: d.nom, permission: d.perm, disponible: d.dispo !== false, description: d.desc, parametres: Object.fromEntries(Object.entries(d.params).map(([k, r]) => [k, r.enum ? (typeof r.enum === "function" ? r.enum() : r.enum) : "texte ≤ " + r.texte])) }))
  };
}
