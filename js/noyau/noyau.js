// Noyau · point d'entrée (contrat, section 3). Assemble le cerveau, les mémoires, la barrière, les moteurs et le cycle de pensée.
// `creerNoyau()` ne dépend que de l'hôte branché (hub réel ou hub simulé du laboratoire) ; `initNoyau()` est l'appel unique de js/main.js.
import { hote, brancherHub } from "./hote.js";
import { creerCatalogue } from "./outils.js";
import { creerBarriere } from "./barriere.js";
import { creerBudget, creerBudgetJetons, moteurGemini, moteurLocal, moteurClaude, moteurAuto, ErreurNoyau, MODELE_DEFAUT, MODELE_CLAUDE_DEFAUT, PLAFOND_CLAUDE_DEFAUT } from "./moteurs.js";
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
import { creerSentinelle } from "./sentinelle.js";
import { creerSavoir } from "./savoir.js";
import { creerUsages } from "./usages.js";
import { creerSauvegarde } from "./sauvegarde.js";
import { resumerLocalement } from "./recherche.js";

export const VERSION_NOYAU = "noyau-1.4";

export async function creerNoyau({ moteur: moteurImpose = null, delaiConfirmation } = {}) {
  journalActions.oublier(); journalMemoire.oublier();
  const memoire = creerMemoire(), cerveau = creerCerveau(), etat = creerEtat(), budget = creerBudget();
  await Promise.all([memoire.charger(), cerveau.charger()]);
  const actualite = creerActualite({ memoire }), perception = creerPerception({ actualite, etat });
  const catalogue = creerCatalogue({ memoire, interdits: async () => memoire.motsPrives() });
  let confirmerUI = null, surcharge = moteurImpose, geminiCache = null, local = null, verrou = () => false;
  const budgetClaude = creerBudget({ cleReglage: "noyau-budget-claude", cleMax: "noyau-plafond-claude", plafondParDefaut: PLAFOND_CLAUDE_DEFAUT }), jetonsClaude = creerBudgetJetons();
  /** Ce qui reste de requêtes, tous moteurs utilisables confondus : le cycle et le sommeil ne s'arrêtent que si plus aucun moteur n'est disponible. */
  const budgetTotal = { restant: () => budget.restant() + (cleClaude() && jetonsClaude.restant() > 500 ? budgetClaude.restant() : 0), plafond: () => budget.plafond(), utilisees: () => budget.utilisees() };
  const barriere = creerBarriere({ catalogue, confirmer: (d) => (confirmerUI ? confirmerUI(d) : false), delai: delaiConfirmation, verrouille: () => verrou() });

  let claudeCache = null, autoCache = null, dernierMoteur = "";
  const cleClaude = () => (hote.secret.cleClaude ? hote.secret.cleClaude() : null);
  function geminiMoteur() {
    const cle = hote.secret.cle();
    if (!cle) return { nom: "Gemini (sans clé)", coupe: true, async generer() { throw new ErreurNoyau("cle", "Aucune clé Gemini : colle-la dans le panneau de l'orbe (clic sur l'orbe, engrenage)."); } };
    if (!hote.secret.protege()) return { nom: "Gemini (coffre inactif)", coupe: true, async generer() { throw new ErreurNoyau("cle", "Active le verrouillage du hub (Diag → Verrouillage) : la clé Gemini ne s'utilise que chiffrée par le coffre."); } };
    const modele = hote.reglage.lire("noyau-modele", MODELE_DEFAUT);
    if (!geminiCache || geminiCache.cle !== cle || geminiCache.modele !== modele) geminiCache = { cle, modele, m: moteurGemini({ cle, modele, budget }) };
    return geminiCache.m;
  }
  function claudeMoteur() {
    const cle = cleClaude();
    if (!cle) return { nom: "Claude (sans clé)", coupe: true, async generer() { throw new ErreurNoyau("cle", "Aucune clé Claude : colle-la dans Noyau → Réglages."); } };
    if (!hote.secret.protege()) return { nom: "Claude (coffre inactif)", coupe: true, async generer() { throw new ErreurNoyau("cle", "Active le verrouillage du hub : la clé Claude ne s'utilise que chiffrée par le coffre."); } };
    const modele = hote.reglage.lire("noyau-modele-claude", MODELE_CLAUDE_DEFAUT);
    if (!claudeCache || claudeCache.cle !== cle || claudeCache.modele !== modele) claudeCache = { cle, modele, m: moteurClaude({ cle, modele, budget: budgetClaude, budgetJetons: jetonsClaude }) };
    return claudeCache.m;
  }
  function moteur() {
    if (surcharge) return surcharge;
    const m = hote.reglage.lire("noyau-moteur", cleClaude() ? "auto" : "gemini");
    if (m === "local") return local || (local = moteurLocal());
    if (m === "claude") return claudeMoteur();
    if (m === "auto") return autoCache || (autoCache = moteurAuto({ gemini: geminiMoteur, claude: claudeMoteur, jetons: jetonsClaude, preference: () => hote.reglage.lire("noyau-routage", "auto"), seuil: parseInt(hote.reglage.lire("noyau-seuil-claude", "2"), 10) || 2, surChoix: (n) => { dernierMoteur = n; } }));
    return geminiMoteur();
  }

  const usages = creerUsages({ barriere, memoire });
  const cycle = creerCycle({ moteur, barriere, catalogue, memoire, perception, cerveau, etat, budget: budgetTotal, usages });
  const savoir = creerSavoir({ memoire, barriere });
  const initiative = creerInitiative({ memoire, actualite, etat, barriere, savoir });
  const sommeil = creerSommeil({ memoire, cerveau, etat, budget: budgetTotal, moteur, emettre: cycle.emettre, phase: cycle.phase });
  await cycle.charger();

  const signalerAValider = () => cycle.emettre({ type: "a_valider", n: memoire.aValider().length });
  const demanderTexte = async (systeme, texte) => { const r = await moteur().generer({ systeme, messages: [{ role: "user", texte }], outils: [], temperature: 0.2 }); return String(r.texte || "").trim() || "(pas de réponse)"; };
  const sentinelle = creerSentinelle({ demander: demanderTexte });
  const noyau = {
    sentinelle, demanderTexte, usages, savoir,
    /** Recommandation système de l'orbe : locale, sans requête ; montrée dans l'échange du Noyau. */
    async recommander() { const r = await sentinelle.recommandation(); cycle.emettre({ type: "initiative", texte: r.texte, raison: "systeme", niveau: r.niveau, action: r.id === "export" || r.id === "tip-export" ? "export" : null }); if (r.niveau === "critique" || r.niveau === "alerte") hote.ui.toast("Sécurité : " + r.texte.slice(0, 90)); return r; },
    sauvegarde: creerSauvegarde(),
    /** Le soir (18 h 30 – 21 h 30), une fois par jour : propose la revue de fin de journée. Locale, sans requête. */
    suggererRevue() {
      const d = hote.maintenant(), m = d.getHours() * 60 + d.getMinutes(), j = d.toDateString();
      if (m < 18 * 60 + 30 || m > 21 * 60 + 30 || hote.reglage.lire("noyau-revue-jour", "") === j || noyau.reglage("remarques") === "off") return false;
      hote.reglage.ecrire("noyau-revue-jour", j); cycle.emettre({ type: "initiative", raison: "soir", action: "revue", texte: "La journée touche à sa fin. Veux-tu que je fasse le point : ce qui est fait, ce qui reste, ce que j'ai retenu et ton agenda de demain ?" }); return true;
    },
    /** Bouton « Exporter maintenant » : dossier choisi s'il est autorisé, sinon l'export classique du hub. */
    definirCleClaude: (k) => { hote.secret.definirCleClaude(k); claudeCache = null; autoCache = null; },
    async exporter() { try { const e = await noyau.sauvegarde.etat(); if (e.dossier) { const r = await noyau.sauvegarde.maintenant({ demander: true }); hote.ui.toast("Sauvegarde écrite : " + r.nom); return r; } } catch (x) { hote.ui.toast("Sauvegarde dans le dossier impossible : " + (x.message || x)); } return hote.ui.exporter && hote.ui.exporter(); },
    /** Résume ce qu'affiche une fenêtre (jamais les mails). Une requête Gemini si possible, sinon résumé local. */
    async resumerFenetre(id) {
      if (/^mails?$/i.test(String(id))) { const t = "Je ne résume pas les mails d'ici : leur contenu doit rester chez toi. Utilise la lecture des mails avec confirmation."; cycle.emettre({ type: "initiative", texte: t, raison: "resume" }); return { ok: false, texte: t }; }
      const r = await barriere.executer({ outil: "lire_fenetre", params: { fenetre: id } }, { origine: "lucien" });
      const texte = r.ok && r.donnees && r.donnees.texte ? r.donnees.texte : "";
      if (!texte) { const t = "Cette fenêtre n'affiche rien que je puisse résumer."; cycle.emettre({ type: "initiative", texte: t, raison: "resume" }); return { ok: false, texte: t }; }
      let res; try { if (!moteur().texteSeulement && budgetTotal.restant() > 0) res = await demanderTexte("Tu résumes pour Lucien le contenu d'une fenêtre de son hub, en français, en 3 phrases courtes au plus. N'invente rien, ne cite que ce qui est écrit.", texte); } catch (e) { res = null; }
      if (!res) res = resumerLocalement(texte, "", 3);
      const t = `Fenêtre « ${id} » : ${res}`; cycle.emettre({ type: "initiative", texte: t, raison: "resume" }); return { ok: true, texte: t };
    },
    version: VERSION_NOYAU, memoire, cerveau, etat, budget, budgetClaude, jetonsClaude, barriere, catalogue, cycle, initiative, sommeil, actualite, perception,
    /** Pose une question. origine : lucien, voix, initiative, autonome. */
    async poser(texte, origine = "lucien") { const r = await cycle.penser({ texte: String(texte).slice(0, 2000), origine }); signalerAValider(); return r; },
    avis: (a) => cycle.avis(a),
    surMessage: (fn) => cycle.surMessage(fn),
    /** La fenêtre du hub branche ici sa confirmation ; sans elle, toute action à confirmer est refusée. */
    confirmerAvec(fn) { confirmerUI = fn; }, verrouillePar(fn) { verrou = fn; },
    definirMoteur(m) { surcharge = m; },
    /** Laboratoire seulement : ajoute une consigne d'essai à l'instruction système (comparateur A/B). */
    definirVariante: (t) => cycle.definirVariante(t), oublierConversation: () => cycle.oublierConversation(),
    moteurActuel: () => moteur().nom,
    inspecteur: () => cycle.inspecteur(),
    journal: (opt) => journalActions.lire(opt), journalMemoire: (opt) => journalMemoire.lire(opt),
    aValider: () => memoire.aValider(),
    async trier(id, action, texte) { const r = await memoire.trier(id, action, texte); signalerAValider(); return r; },
    reglage: (cle, valeur) => (valeur === undefined ? hote.reglage.lire("noyau-" + cle, "") : hote.reglage.ecrire("noyau-" + cle, valeur)),
    statut() {
      return { version: VERSION_NOYAU, moteur: moteur().nom, budget: { utilisees: budget.utilisees(), plafond: budget.plafond(), restant: budgetTotal.restant() }, claude: { cle: !!cleClaude(), requetes: budgetClaude.utilisees(), plafondRequetes: budgetClaude.plafond(), jetons: jetonsClaude.utilises(), plafondJetons: jetonsClaude.plafond(), dernier: dernierMoteur }, memoire: memoire.stats(), cerveau: cerveau.resume(), humeur: etat.humeur(), sommeilFait: sommeil.faitAujourdhui(), hote: hote.nom };
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
    curiosite: async () => { const r = await initiative.curiosite(); signalerAValider(); if (r && r.fait && r.programme) cycle.emettre({ type: "initiative", raison: "curiosite", texte: r.trouve ? `J'ai étudié « ${r.sujet} » (${r.domaine}) : ${r.trouve} fiche(s) t'attendent dans « À valider ». Rien n'est appris sans ton accord.` : `J'ai cherché « ${r.sujet} » (${r.domaine}) sans rien trouver de net.` }); return r; }
  };
  return noyau;
}

/** Appel unique de js/main.js : branche le hub, crée le Noyau, monte la fenêtre et lance la veille (accueil, remarques, sommeil). */
export async function initNoyau() {
  await brancherHub();
  const noyau = await creerNoyau();
  noyau.verrouillePar(() => document.body.classList.contains("locked"));       // écran verrouillé : aucune confirmation ne passe
  const { monterFenetre } = await import("./fenetre.js");
  const ui = monterFenetre(hote.ui.conteneur(), noyau, { orbe: true });
  const { monterSecurite } = await import("./securite.js");
  const zoneSecu = document.querySelector('.win[data-id="securite"] .pb');
  const secu = zoneSecu ? monterSecurite(zoneSecu, noyau.sentinelle) : null;
  const { monterSavoir } = await import("./fenetre-savoir.js");
  const zoneSav = document.querySelector('.win[data-id="savoir"] .pb');
  const sav = zoneSav ? monterSavoir(zoneSav, noyau) : null;
  hote.ui.ajouterMenuFond(() => [{ t: "Ouvrir le Noyau", fn: () => ui.ouvrir() }, ...(secu ? [{ t: "Ouvrir la sécurité", fn: () => secu.ouvrir() }] : []), ...(sav ? [{ t: "Ouvrir la carte du savoir", fn: () => sav.ouvrir() }] : [])]);
  hote.ui.ajouterMenuFenetre && hote.ui.ajouterMenuFenetre((el) => /^(mails?|noyau|securite|savoir)$/.test(el.dataset.id) ? [] : [{ t: "Résumer avec le Noyau", fn: () => { ui.ouvrir(); noyau.resumerFenetre(el.dataset.id).catch(() => {}); } }]);
  hote.ui.ajouterMenuFond(() => [{ t: "Capture rapide (note)", fn: () => { ui.ouvrir(); document.dispatchEvent(new CustomEvent("noyau:saisir", { detail: { texte: "Note : " } })); } }]);
  document.addEventListener("noyau:ouvrir-savoir", () => sav && sav.ouvrir());
  document.addEventListener("noyau:ouvrir", () => ui.ouvrir());                          // appui long sur l'orbe
  document.addEventListener("noyau:ouvrir-securite", () => secu && secu.ouvrir());
  // Sentinelle : capteurs, analyse locale toutes les 5 min (sans requête), recommandation de l'orbe toutes les 30 min
  noyau.sentinelle.surveiller();
  const sauvegardeAuto = async () => { if (document.hidden || document.body.classList.contains("locked")) return; const r = await noyau.sauvegarde.auto().catch(() => ({ fait: false })); if (r.fait) hote.ui.toast("Sauvegarde automatique écrite : " + r.nom); else if (r.reautoriser && hote.reglage.lire("noyau-sauv-rappel", "") !== new Date().toDateString()) { hote.reglage.ecrire("noyau-sauv-rappel", new Date().toDateString()); document.dispatchEvent(new CustomEvent("noyau:initiative", { detail: { texte: "Le navigateur demande de réautoriser le dossier de sauvegarde. Ouvre Réglages → Sauvegarde, puis « Sauvegarder maintenant ».", raison: "systeme", niveau: "alerte" } })); } };
  setTimeout(sauvegardeAuto, 20000); setInterval(sauvegardeAuto, 30 * 60e3);
  const calme = () => !document.hidden && !document.body.classList.contains("locked") && !document.body.classList.contains("focus") && (() => { const h = new Date().getHours(); return h >= 7 && h < 23; })();
  setTimeout(() => noyau.sentinelle.veille().catch(() => {}), 8000);
  setInterval(() => { if (!document.hidden) noyau.sentinelle.veille().then((c) => { if (c.some((x) => x.niveau === "critique")) hote.ui.orbe({ phase: "attend", humeur: "vigilant" }); }).catch(() => {}); }, 5 * 60e3);
  setTimeout(() => { if (calme() && noyau.reglage("recos") !== "off") noyau.recommander().catch(() => {}); }, 90 * 1000);
  setInterval(() => { if (calme() && noyau.reglage("recos") !== "off") noyau.recommander().catch(() => {}); }, 30 * 60e3);
  // Veille : accueil du jour, remarques opportunes (toutes les 5 min, au plus une par 2 h), sommeil au premier moment calme
  let dernierGeste = Date.now();
  ["pointerdown", "keydown", "wheel"].forEach((e) => addEventListener(e, () => { dernierGeste = Date.now(); }, { passive: true }));
  setTimeout(() => noyau.accueil().catch(() => {}), 4000);
  setInterval(async () => {
    try {
      if (document.hidden) return;
      await noyau.remarque();
      if (calme()) noyau.suggererRevue();
      if (noyau.sommeil.moment({ inactifMs: Date.now() - dernierGeste })) await noyau.dormir();
      await noyau.curiosite();
    } catch (e) { console.error("noyau", e); }
  }, 5 * 60e3);
  setTimeout(async () => { try { if (noyau.sommeil.moment({ ouvertureMatin: true })) await noyau.dormir(); } catch (e) { /* silencieux */ } }, 30000);
  window.__noyau = noyau;         // pour les essais en console
  return noyau;
}
