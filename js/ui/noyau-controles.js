// Refonte 4 (7.40.0) · boutons « Sources » et « Annuler le plan » de la fenêtre du Noyau, et ouverture de la vue Sources depuis la palette.
// Monté par fenetre.js (une seule ligne, import dynamique). Ce module vit dans js/ui/ : il ne donne aucun droit nouveau au Noyau.
//  - « Sources » : ouvre afficherSources() (bandeau de fraîcheur des sources de données, lecture seule, aucun appel réseau).
//  - « Annuler le plan » : visible seulement pendant l'exécution d'un plan. Il déclenche l'annulation par signal que execution.js sait déjà
//    traiter : le signal est fourni à la barrière pour les appels d'un plan qui n'en ont pas ; une fois annulé, les étapes restantes ne partent pas
//    (journalisées une à une, cause « annule ») et l'appel en cours est coupé. Une demande d'accord déjà affichée reste à Lucien.
//  - Palette / Outils : l'événement document « noyau:vue » { vue: "sources" } ouvre la vue ; si personne ne l'écoute (Noyau pas chargé), le détail le dit.
import { journalActions } from "../noyau/journal.js";

const GRACE_MS = 700;            // entre deux étapes d'un plan, le bouton reste (pas de clignotement)

export function monterControles({ racine, api, noyau, h }) {
  if (!racine || racine.querySelector(".nx-vues")) return null;
  const etat = h("span", { class: "nx-vues-etat", role: "status", "aria-live": "polite" });
  const bSources = h("button", { class: "nx-btn nx-vues-btn", type: "button", "aria-label": "Sources de données : état et fraîcheur", title: "État et fraîcheur des sources de données", onclick: () => ouvrirSources() }, "Sources");
  const bAnnuler = h("button", { class: "nx-btn nx-vues-btn nx-vues-annuler", type: "button", hidden: true, "aria-label": "Annuler le plan en cours", title: "Les étapes restantes ne partiront pas", onclick: () => annuler() }, "Annuler le plan");
  const barre = h("div", { class: "nx-vues", role: "group", "aria-label": "Vues et plan" }, bSources, bAnnuler, etat);
  const ref = racine.querySelector(".nx-etat");
  if (ref) ref.after(barre); else racine.prepend(barre);

  const dire = (t) => { etat.textContent = t; };
  async function ouvrirSources() {
    try { if (racine.dataset.vue !== "chat" && api.changerVue) api.changerVue("chat"); await api.afficherSources(); dire(""); }
    catch (e) { dire("Sources indisponibles : " + ((e && e.message) || e)); }
  }

  // ---------- Plan en cours ----------
  let ctl = null, enCours = 0, minuterie = null;
  const montrer = (on) => { bAnnuler.hidden = !on; };
  const fin = () => { if (enCours > 0) return; if (ctl && ctl.signal.aborted) dire("Plan annulé : les étapes restantes ne partent pas."); ctl = null; montrer(false); };
  function annuler() { if (!ctl || ctl.signal.aborted) return; ctl.abort(); bAnnuler.disabled = true; dire("Annulation du plan…"); }

  const b = noyau && noyau.barriere;
  if (b && typeof b.executer === "function" && !b.__vuesPlan) {
    const orig = b.executer.bind(b);
    b.__vuesPlan = true;
    b.executer = async (appel, opts = {}) => {
      if (!opts || !opts.plan || opts.signal) return orig(appel, opts);          // hors plan, ou signal déjà fourni : rien ne change
      if (!ctl || ctl.plan !== opts.plan) { ctl = new AbortController(); ctl.plan = opts.plan; bAnnuler.disabled = false; dire(""); }
      clearTimeout(minuterie);
      if (ctl.signal.aborted) {                                                  // étape restante d'un plan annulé : elle ne part pas, mais elle est journalisée
        const nom = appel && appel.outil, erreur = "Plan annulé : étape non exécutée.";
        try { const o = b.outil ? b.outil(nom) : null; await journalActions.ecrire({ outil: nom || "(sans nom)", niveau: (o && o.niveau) || "—", params: erreur, statut: "ERREUR", origine: opts.origine || "modele", erreur, sortie: [], plan: opts.plan, cause: "annule" }); } catch (e) { /* journal indisponible */ }
        minuterie = setTimeout(fin, GRACE_MS);
        return { ok: false, erreur, cause: "annule" };
      }
      enCours++; montrer(true);
      try { return await orig(appel, { ...opts, signal: ctl.signal }); }
      finally { enCours--; clearTimeout(minuterie); minuterie = setTimeout(fin, GRACE_MS); }
    };
  }

  // ---------- Palette / Outils ----------
  document.addEventListener("noyau:vue", (e) => {
    const d = e.detail; if (!d || d.vue !== "sources") return;
    d.pris = true;
    document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: "noyau" }));
    const w = racine.closest && racine.closest(".win"); if (w) w.classList.remove("hid");
    ouvrirSources();
  });
  return { barre, bSources, bAnnuler };
}
