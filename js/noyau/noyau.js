// Noyau · point d'entrée (contrat, section 3). Assemble le cerveau, les mémoires, la barrière, les moteurs et le cycle de pensée.
// `creerNoyau()` ne dépend que de l'hôte branché (hub réel ou hub simulé du laboratoire) ; `initNoyau()` est l'appel unique de js/main.js.
import { hote, brancherHub } from "./hote.js";
import { creerCatalogue } from "./outils.js";
import { creerBarriere } from "./barriere.js";
import { creerBudget, moteurGemini, moteurLocal, moteurClaude, ErreurNoyau, MODELE_DEFAUT } from "./moteurs.js";
import { creerMemoire } from "./memoire.js";
import { creerCerveau } from "./cerveau.js";
import { creerEtat } from "./etat.js";
import { creerActualite } from "./actualite.js";
import { creerPerception } from "./perception.js";
import { creerCycle } from "./boucle.js";
import { creerInitiative } from "./initiative.js";
import { creerSommeil } from "./sommeil.js";
import { journalActions, journalMemoire } from "./journal.js";
import * as imp from "./import38.js";

export const VERSION_NOYAU = "noyau-0.9";

export async function creerNoyau({ moteur: moteurImpose = null, delaiConfirmation } = {}) {
  journalActions.oublier(); journalMemoire.oublier();
  const memoire = creerMemoire(), cerveau = creerCerveau(), etat = creerEtat(), budget = creerBudget();
  await Promise.all([memoire.charger(), cerveau.charger()]);
  const actualite = creerActualite({ memoire }), perception = creerPerception({ actualite, etat });
  const catalogue = creerCatalogue({ memoire, interdits: async () => memoire.motsPrives() });
  let confirmerUI = null, surcharge = moteurImpose, geminiCache = null, local = null, verrou = () => false;
  const barriere = creerBarriere({ catalogue, confirmer: (d) => (confirmerUI ? confirmerUI(d) : false), delai: delaiConfirmation, verrouille: () => verrou() });

  function moteur() {
    if (surcharge) return surcharge;
    const m = hote.reglage.lire("noyau-moteur", "gemini");
    if (m === "claude") return moteurClaude();
    if (m === "local") return local || (local = moteurLocal());
    const cle = hote.secret.cle();
    if (!cle) return { nom: "Gemini (sans clé)", async generer() { throw new ErreurNoyau("cle", "Aucune clé Gemini : colle-la dans les réglages du Noyau."); } };
    if (!hote.secret.protege()) return { nom: "Gemini (coffre inactif)", async generer() { throw new ErreurNoyau("cle", "Active le verrouillage du hub (Diag → Verrouillage) : la clé Gemini ne s'utilise que chiffrée par le coffre."); } };
    const modele = hote.reglage.lire("noyau-modele", MODELE_DEFAUT);
    if (!geminiCache || geminiCache.cle !== cle || geminiCache.modele !== modele) geminiCache = { cle, modele, m: moteurGemini({ cle, modele, budget }) };
    return geminiCache.m;
  }

  const cycle = creerCycle({ moteur, barriere, catalogue, memoire, perception, cerveau, etat, budget });
  const initiative = creerInitiative({ memoire, actualite, etat, barriere });
  const sommeil = creerSommeil({ memoire, cerveau, etat, budget, moteur, emettre: cycle.emettre, phase: cycle.phase });
  await cycle.charger();

  const signalerAValider = () => cycle.emettre({ type: "a_valider", n: memoire.aValider().length });
  const noyau = {
    version: VERSION_NOYAU, memoire, cerveau, etat, budget, barriere, catalogue, cycle, initiative, sommeil, actualite, perception,
    /** Pose une question. origine : lucien, voix, initiative, autonome. */
    async poser(texte, origine = "lucien") { const r = await cycle.penser({ texte: String(texte).slice(0, 2000), origine }); signalerAValider(); return r; },
    avis: (a) => cycle.avis(a),
    surMessage: (fn) => cycle.surMessage(fn),
    /** La fenêtre du hub branche ici sa confirmation ; sans elle, toute action à confirmer est refusée. */
    confirmerAvec(fn) { confirmerUI = fn; }, verrouillePar(fn) { verrou = fn; },
    definirMoteur(m) { surcharge = m; },
    moteurActuel: () => moteur().nom,
    inspecteur: () => cycle.inspecteur(),
    journal: (opt) => journalActions.lire(opt), journalMemoire: (opt) => journalMemoire.lire(opt),
    aValider: () => memoire.aValider(),
    async trier(id, action, texte) { const r = await memoire.trier(id, action, texte); signalerAValider(); return r; },
    reglage: (cle, valeur) => (valeur === undefined ? hote.reglage.lire("noyau-" + cle, "") : hote.reglage.ecrire("noyau-" + cle, valeur)),
    statut() {
      return { version: VERSION_NOYAU, moteur: moteur().nom, budget: { utilisees: budget.utilisees(), plafond: budget.plafond(), restant: budget.restant() }, memoire: memoire.stats(), cerveau: cerveau.resume(), humeur: etat.humeur(), sommeilFait: sommeil.faitAujourdhui(), hote: hote.nom };
    },
    // Import de la mémoire v3.8 et du cerveau (fichiers choisis par Lucien)
    apercu38: (texte) => imp.apercu(imp.lireSauvegarde(texte)),
    async importer38(texte, surEtape) { const r = await imp.importer(memoire, imp.lireSauvegarde(texte), { surEtape }); return r; },
    elementsHub38: (texte) => imp.elementsHub(imp.lireSauvegarde(texte)),
    importerHub38: async (texte, cles) => { const d = imp.lireSauvegarde(texte); return imp.importerHub(imp.elementsHub(d), cles); },
    importerCerveau: (texte) => cerveau.importer(texte),
    // Initiative et sommeil
    accueil: async () => { const a = await initiative.accueil(); if (a) cycle.emettre({ type: "initiative", texte: a.texte, raison: a.raison }); return a; },
    remarque: async () => { const a = await initiative.remarque(); if (a) cycle.emettre({ type: "initiative", texte: a.texte, raison: a.raison }); return a; },
    dormir: async (opt) => { const r = await sommeil.dormir(opt); signalerAValider(); return r; },
    curiosite: async () => { const r = await initiative.curiosite(); signalerAValider(); return r; }
  };
  return noyau;
}

/** Appel unique de js/main.js : branche le hub, crée le Noyau, monte la fenêtre et lance la veille (accueil, remarques, sommeil). */
export async function initNoyau() {
  await brancherHub();
  const noyau = await creerNoyau();
  const { monterFenetre } = await import("./fenetre.js");
  const ui = monterFenetre(hote.ui.conteneur(), noyau, { orbe: true });
  hote.ui.ajouterMenuFond(() => [{ t: "Ouvrir le Noyau", fn: () => ui.ouvrir() }]);
  // Veille : accueil du jour, remarques opportunes (toutes les 5 min, au plus une par 2 h), sommeil au premier moment calme
  let dernierGeste = Date.now();
  ["pointerdown", "keydown", "wheel"].forEach((e) => addEventListener(e, () => { dernierGeste = Date.now(); }, { passive: true }));
  setTimeout(() => noyau.accueil().catch(() => {}), 4000);
  setInterval(async () => {
    try {
      if (document.hidden) return;
      await noyau.remarque();
      if (noyau.sommeil.moment({ inactifMs: Date.now() - dernierGeste })) await noyau.dormir();
      await noyau.curiosite();
    } catch (e) { console.error("noyau", e); }
  }, 5 * 60e3);
  setTimeout(async () => { try { if (noyau.sommeil.moment({ ouvertureMatin: true })) await noyau.dormir(); } catch (e) { /* silencieux */ } }, 30000);
  window.__noyau = noyau;         // pour les essais en console
  return noyau;
}
