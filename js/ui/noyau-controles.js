// Refonte 4 (7.40.0) · boutons « Sources » et « Annuler le plan » de la fenêtre du Noyau, et ouverture de la vue Sources depuis la palette.
// Monté par fenetre.js (une seule ligne, import dynamique). Ce module vit dans js/ui/ : il ne donne aucun droit nouveau au Noyau.
//  - « Sources » : ouvre afficherSources() (bandeau de fraîcheur des sources de données, lecture seule, aucun appel réseau).
//  - « Annuler le plan » : visible tant que js/noyau/annulation.js a un plan en cours (planEnCours()) ; le clic appelle annulerPlan(). Plus d'enveloppe de la
//    barrière (Refonte 6) : boucle.js passe son propre signal à executerPlan, les étapes restantes sont « non exécutées » dans le bilan.
//  - « Modules » : panneau des gestes de Lucien (js/ui/noyau-gestes.js, chargé à la demande).
//  - Palette / Outils : l'événement document « noyau:vue » { vue: "sources" } ouvre la vue ; si personne ne l'écoute (Noyau pas chargé), le détail le dit.
import { planEnCours, annulerPlan } from "../noyau/annulation.js";

export function monterControles({ racine, api, h }) {
  if (!racine || racine.querySelector(".nx-vues")) return null;
  const etat = h("span", { class: "nx-vues-etat", role: "status", "aria-live": "polite" });
  const bSources = h("button", { class: "nx-btn nx-vues-btn", type: "button", "aria-label": "Sources de données : état et fraîcheur", title: "État et fraîcheur des sources de données", onclick: () => ouvrirSources() }, "Sources");
  const bAnnuler = h("button", { class: "nx-btn nx-vues-btn nx-vues-annuler", type: "button", hidden: true, "aria-label": "Annuler le plan en cours", title: "Les étapes restantes ne partiront pas", onclick: () => annuler() }, "Annuler le plan");
  const bGestes = h("button", { class: "nx-btn nx-vues-btn", type: "button", "aria-label": "Modules, espaces de travail et workflows", title: "Gérer tes modules, rouvrir un espace, lancer un workflow", onclick: () => document.dispatchEvent(new CustomEvent("noyau:vue", { detail: { vue: "gestes", pris: false } })) }, "Modules");
  const barre = h("div", { class: "nx-vues", role: "group", "aria-label": "Vues et plan" }, bSources, bGestes, bAnnuler, etat);
  const ref = racine.querySelector(".nx-etat");
  if (ref) ref.after(barre); else racine.prepend(barre);

  const dire = (t) => { etat.textContent = t; };
  async function ouvrirSources() {
    try { if (racine.dataset.vue !== "chat" && api.changerVue) api.changerVue("chat"); await api.afficherSources(); dire(""); }
    catch (e) { dire("Sources indisponibles : " + ((e && e.message) || e)); }
  }

  // ---------- Plan en cours (Refonte 6 : annulation propre, sans enveloppe de la barrière) ----------
  // boucle.js (et les workflows lancés depuis le panneau « Modules ») ouvrent un signal par plan dans js/noyau/annulation.js ; on le lit, on ne l'enveloppe plus.
  // Il n'y a pas d'événement de fin de plan : on regarde planEnCours() tous les 300 ms (seulement fenêtre visible), et on ne touche au DOM que si l'état change.
  let vu = null, annule = false;
  const montrer = (on) => { bAnnuler.hidden = !on; };
  function annuler() { const id = planEnCours(); if (!id) return; if (annulerPlan(id)) { annule = true; bAnnuler.disabled = true; dire("Annulation du plan… les étapes restantes ne partiront pas."); } }
  function regarder() {
    const id = planEnCours();
    if (id === vu) return;
    if (id) { if (vu === null) { annule = false; bAnnuler.disabled = false; dire(""); } montrer(true); }
    else { montrer(false); if (annule) dire("Plan annulé : les étapes restantes ne sont pas parties."); annule = false; }
    vu = id;
  }
  const minuterie = setInterval(() => { if (racine.isConnected === false) { clearInterval(minuterie); return; } if (typeof document !== "undefined" && document.hidden) return; regarder(); }, 300);
  if (minuterie && typeof minuterie.unref === "function") minuterie.unref();

  // ---------- Palette / Outils ----------
  document.addEventListener("noyau:vue", (e) => {
    const d = e.detail; if (!d || d.vue !== "sources") return;
    d.pris = true;
    document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: "noyau" }));
    const w = racine.closest && racine.closest(".win"); if (w) w.classList.remove("hid");
    ouvrirSources();
  });
  // Panneau des gestes de Lucien (modules, espaces, workflows) : chargé à la demande ; un échec de chargement ne gêne rien d'autre.
  import("./noyau-gestes.js").then((m) => m.monterGestes({ racine, api, h })).catch(() => {});
  return { barre, bSources, bGestes, bAnnuler };
}
