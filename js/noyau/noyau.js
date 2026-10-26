// Noyau · point d'entrée (contrat, section 3). Assemble le cerveau, les mémoires, la barrière, les moteurs et le cycle de pensée.
// `creerNoyau()` ne dépend que de l'hôte branché (hub réel ou hub simulé du laboratoire) ; `initNoyau()` est l'appel unique de js/main.js.
import { pont } from "./pont.js";
import { creerSens } from "./sens.js";
import { creerPiper } from "./piper.js";
import { creerVeille } from "./veille.js";
import { creerRaccourcis } from "./raccourcis.js";
import { creerPerso } from "./perso.js";
import { definirMoteurVoix } from "./voix.js";
import { hote, brancherHub } from "./hote.js";
import { creerCatalogue } from "./outils.js";
import { creerBarriere } from "./barriere.js";
import { creerBudget, creerBudgetJetons, moteurGemini, moteurLocal, moteurClaude, moteurAuto, ErreurNoyau, MODELE_DEFAUT, MODELE_CLAUDE_DEFAUT, moteurLibre, FOURNISSEURS_LIBRES, PLAFOND_LIBRE_DEFAUT, PLAFOND_CLAUDE_DEFAUT, moteurService, SERVICES_SECOURS, IDS_SECOURS, lireOrdreSecours } from "./moteurs.js";
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

export const VERSION_NOYAU = "noyau-1.12";

export async function creerNoyau({ moteur: moteurImpose = null, delaiConfirmation, sens: sensImpose = null } = {}) {
  journalActions.oublier(); journalMemoire.oublier();
  const memoire = creerMemoire(), cerveau = creerCerveau(), etat = creerEtat(), budget = creerBudget();
  await Promise.all([memoire.charger(), cerveau.charger()]);
  const actualite = creerActualite({ memoire }), perception = creerPerception({ actualite, etat });
  let racRef = null;
  const catalogue = creerCatalogue({ memoire, interdits: async () => memoire.motsPrives(), raccourcis: () => racRef, exposer: (api) => { if (hote.ui) hote.ui.orchestrateur = {
    ...api,
    // Lot 9 : gestes de Lucien (restaurer une version, retirer avec sauvegarde, exporter, importer, actualiser, espaces, workflows) pour les boutons de la Refonte.
    // Ils ne sont dans AUCUN outil : le modèle n'a pas de chemin vers eux.
    gestes: async () => { const c = await api.composants(); const { creerGestesLucien } = await import("./modules/gestes-lucien.js"); return creerGestesLucien({ stockage: hote.stockage, modules: c.modules, donnees: c.donnees, jeux: c.jeux, maintenant: () => hote.maintenant(), catalogue: barriere }); },
    // Lot 8 : workflows enregistrés et modèles de plan. Lancer = geste de Lucien : fenêtre de validation obligatoire, puis chaque étape garde son niveau.
    workflows: async () => { const W = await import("./workflows.js"), { MODELES_PLANS } = await import("./plans-modeles.js"), wf = W.creerWorkflows({ stockage: hote.stockage, maintenant: () => hote.maintenant() });
      return { lister: async () => ({ enregistres: await wf.lister(), modeles: MODELES_PLANS.map((m) => ({ id: m.id, nom: m.nom, pourquoi: m.pourquoi, parametres: m.parametres })) }),
        rejouer: async (id, valeurs, opts = {}) => { const def = MODELES_PLANS.find((m) => m.id === id) || await wf.lire(id); const r = await W.rejouer(def, valeurs, { barriere, ...opts }); if (r.lance && !MODELES_PLANS.some((m) => m.id === id)) await wf.noterLancement(id).catch(() => {}); return r; } }; } }; } });
  let confirmerUI = null, surcharge = moteurImpose, geminiCache = null, local = null, verrou = () => false;
  const budgetClaude = creerBudget({ cleReglage: "noyau-budget-claude", cleMax: "noyau-plafond-claude", plafondParDefaut: PLAFOND_CLAUDE_DEFAUT }), jetonsClaude = creerBudgetJetons();
  const budgetLibre = creerBudget({ cleReglage: "noyau-budget-libre", cleMax: "noyau-plafond-libre", plafondParDefaut: PLAFOND_LIBRE_DEFAUT });
  // IA de secours (Groq, OpenRouter, Mistral) : un plafond quotidien chacune, sous la limite gratuite du service.
  const budgetsSecours = Object.fromEntries(IDS_SECOURS.map((id) => [id, creerBudget({ cleReglage: "noyau-budget-" + id, cleMax: "noyau-plafond-" + id, plafondParDefaut: SERVICES_SECOURS[id].plafond })]));
  const cleService = (id) => (hote.secret.cleService ? hote.secret.cleService(id) : null);
  /** Mistral peut entraîner ses modèles avec les requêtes gratuites : coupé tant que Lucien ne l'a pas activé lui-même. */
  const serviceAutorise = (id) => !SERVICES_SECOURS[id].entrainement || hote.reglage.lire("noyau-secours-" + id, "off") === "on";
  const serviceUtilisable = (id) => !!cleService(id) && serviceAutorise(id);
  /** Ce qui reste de requêtes, tous moteurs utilisables confondus : le cycle et le sommeil ne s'arrêtent que si plus aucun moteur n'est disponible. */
  const budgetTotal = { restant: () => budget.restant() + (cleLibre() ? budgetLibre.restant() : 0) + (cleClaude() && jetonsClaude.restant() > 500 ? budgetClaude.restant() : 0) + IDS_SECOURS.reduce((t, id) => t + (serviceUtilisable(id) ? budgetsSecours[id].restant() : 0), 0), plafond: () => budget.plafond(), utilisees: () => budget.utilisees() };
  const barriere = creerBarriere({ catalogue, confirmer: (d) => (confirmerUI ? confirmerUI(d) : false), delai: delaiConfirmation, verrouille: () => verrou(), surAttente: (a) => { try { if (hote.ui && hote.ui.toast) hote.ui.toast(`File d'attente pour ${a.hote} : environ ${Math.ceil(a.ms / 1000)} s (limite par minute)`); } catch (e) { /* l'annonce ne doit rien casser */ } } });
  racRef = creerRaccourcis({ barriere });

  let claudeCache = null, autoCache = null, dernierMoteur = "";
  const cleLibre = () => (hote.secret.cleLibre ? hote.secret.cleLibre() : null);
  const cleClaude = () => (hote.secret.cleClaude ? hote.secret.cleClaude() : null);
  function geminiMoteur() {
    const cle = hote.secret.cle();
    if (!cle) return { nom: "Gemini (sans clé)", coupe: true, async generer() { throw new ErreurNoyau("cle", "Aucune clé Gemini : colle-la dans le panneau de l'orbe (clic sur l'orbe, engrenage)."); } };
    if (!hote.secret.protege()) return { nom: "Gemini (coffre inactif)", coupe: true, async generer() { throw new ErreurNoyau("cle", "Active le verrouillage du hub (Diag → Verrouillage) : la clé Gemini ne s'utilise que chiffrée par le coffre."); } };
    const modele = hote.reglage.lire("noyau-modele", MODELE_DEFAUT);
    if (!geminiCache || geminiCache.cle !== cle || geminiCache.modele !== modele) geminiCache = { cle, modele, m: moteurGemini({ cle, modele, budget }) };
    return geminiCache.m;
  }
  let libreCache = null;
  function libreMoteur() {
    const cle = cleLibre(); const fo = hote.reglage.lire("noyau-libre-fournisseur", "groq");
    if (!cle || !hote.secret.protege()) return { nom: "Relais libre (sans clé)", coupe: true, async generer() { throw new ErreurNoyau("cle", "Aucune clé de relais gratuit."); } };
    const modele = hote.reglage.lire("noyau-libre-modele", "");
    if (!libreCache || libreCache.cle !== cle || libreCache.fo !== fo || libreCache.modele !== modele) libreCache = { cle, fo, modele, m: moteurLibre({ fournisseur: fo, cle, modele, budget: budgetLibre }) };
    return libreCache.m;
  }
  const delaiSecours = () => { const v = parseInt(hote.reglage.lire("noyau-delai-secours", ""), 10); return v > 0 ? v : 20000; };
  const secoursCache = {};
  function secoursMoteur(id) {
    const s = SERVICES_SECOURS[id], cle = cleService(id);
    const coupe = (nom, msg) => ({ nom, type: "secours", service: s.nom, entrainement: s.entrainement, coupe: true, async generer() { throw new ErreurNoyau("cle", msg); } });
    if (!cle) return coupe(s.nom + " (sans clé)", "Aucune clé " + s.nom + " : colle-la dans Noyau → Réglages → IA de secours.");
    if (!hote.secret.protege()) return coupe(s.nom + " (coffre inactif)", "Active le verrouillage du hub : la clé " + s.nom + " ne s'utilise que chiffrée par le coffre.");
    if (!serviceAutorise(id)) return coupe(s.nom + " (désactivé : peut servir à l'entraînement)", s.nom + " est désactivé tant que tu ne l'as pas activé.");
    const modele = hote.reglage.lire("noyau-modele-" + id, "") || s.modele, delai = delaiSecours();
    const c = secoursCache[id];
    if (!c || c.cle !== cle || c.modele !== modele || c.delai !== delai) secoursCache[id] = { cle, modele, delai, m: moteurService({ id, cle, modele, budget: budgetsSecours[id], delaiMax: delai, racine: hote.racine ? hote.racine() : null }) };
    return secoursCache[id].m;
  }
  /** IA locale dans la chaîne : seulement si un modèle est DÉJÀ téléchargé (jamais de téléchargement sans l'accord de Lucien). */
  function localSecours() {
    const m = local || (local = moteurLocal());
    if (!m.disponible) m.disponible = async () => { if (typeof navigator === "undefined" || !navigator.gpu) return false; const { etatModeles } = await import("./modeles.js"); return (await etatModeles()).some((x) => x.id === "qwen-1.5b" && x.telecharge); };
    return m;
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
    const m = hote.reglage.lire("noyau-moteur", cleClaude() || cleLibre() || IDS_SECOURS.some(serviceUtilisable) ? "auto" : "gemini");
    if (m === "local") return local || (local = moteurLocal());
    if (m === "claude") return claudeMoteur();
    if (m === "auto") return autoCache || (autoCache = moteurAuto({ gemini: geminiMoteur, claude: claudeMoteur, libre: libreMoteur, jetons: jetonsClaude, preference: () => hote.reglage.lire("noyau-routage", "auto"), seuil: parseInt(hote.reglage.lire("noyau-seuil-claude", "2"), 10) || 2, surChoix: (n) => { dernierMoteur = n; },
      maillons: { ...Object.fromEntries(IDS_SECOURS.map((id) => [id, () => secoursMoteur(id)])), local: localSecours },
      ordre: () => hote.reglage.lire("noyau-ordre-secours", ""), delaiMaillon: delaiSecours(),
      surSecours: (texte) => { try { hote.ui.toast("IA de secours · " + texte); } catch (e) { /* pas d'interface */ } } }));
    return geminiMoteur();
  }

  const piper = creerPiper();
  const sens = sensImpose || creerSens({ memoire }); memoire.definirSens(sens);
  const usages = creerUsages({ barriere, memoire });
  const cycle = creerCycle({ moteur, barriere, catalogue, memoire, perception, cerveau, etat, budget: budgetTotal, usages });
  const savoir = creerSavoir({ memoire, barriere, juge: async (sys, txt) => { if (budgetTotal.restant() <= 0) throw new Error("budget du jour épuisé"); return demanderTexte(sys, txt); }, strict: () => hote.reglage.lire("noyau-test-strict", "on") !== "off" });
  const veille = creerVeille({
    savoir, memoire, lire: (k) => hote.reglage.lire("noyau-" + k, ""), ecrire: (k, v) => hote.reglage.ecrire("noyau-" + k, v), maintenant: () => hote.maintenant(), enLigne: () => hote.enLigne(),
    batterie: async () => { if (typeof navigator === "undefined" || !navigator.getBattery) return null; const b = await navigator.getBattery(); return { niveau: b.level, charge: b.charging }; },
    verrou: typeof navigator !== "undefined" && navigator.wakeLock ? { prendre: () => navigator.wakeLock.request("screen"), lacher: (v) => v.release() } : null,
    emettre: (e) => cycle.emettre(e),
    get: async (u) => { const x = await hote.fetch(u, { headers: { Accept: "application/json" }, cache: "no-store" }); if (!x.ok) throw new Error("HTTP " + x.status); return x.json(); }
  });
  const initiative = creerInitiative({ memoire, actualite, etat, barriere, savoir });
  const sommeil = creerSommeil({ memoire, cerveau, etat, budget: budgetTotal, moteur, emettre: cycle.emettre, phase: cycle.phase });
  await cycle.charger();

  const signalerAValider = () => cycle.emettre({ type: "a_valider", n: memoire.aValider().length });
  const demanderTexte = async (systeme, texte) => { const r = await moteur().generer({ systeme, messages: [{ role: "user", texte }], outils: [], temperature: 0.2 }); return String(r.texte || "").trim() || "(pas de réponse)"; };
  const sentinelle = creerSentinelle({ demander: demanderTexte });
  const noyau = {
    sentinelle, demanderTexte, usages, savoir, sens, piper, veille,
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
    /** Voix naturelle : accord de Lucien, téléchargement, branchement sur la lecture à voix haute. */
    async activerVoixNaturelle(on) { noyau.reglage("voix-piper", on ? "on" : "off"); if (!on) { definirMoteurVoix(null); piper.desactiver(); return piper.statut(); } const st = await piper.preparer(); if (piper.pret()) definirMoteurVoix(piper); return st; },
    definirCleLibre: (k) => { hote.secret.definirCleLibre(k); libreCache = null; autoCache = null; },
    definirCleClaude: (k) => { hote.secret.definirCleClaude(k); claudeCache = null; autoCache = null; },
    /** IA de secours : clé d'un service (groq | openrouter | mistral), gardée par le coffre sous hub-secret-ia-<id>. */
    definirCleService: (id, k) => { if (!IDS_SECOURS.includes(id)) throw new Error("Service inconnu."); hote.secret.definirCleService(id, k); delete secoursCache[id]; autoCache = null; },
    /** Ordre de secours (liste d'identifiants) ; « sans-ia » reste toujours à la fin. */
    definirOrdreSecours: (liste) => { const o = lireOrdreSecours(liste); hote.reglage.ecrire("noyau-ordre-secours", o.join(",")); autoCache = null; return o; },
    activerService: (id, on) => { if (!IDS_SECOURS.includes(id)) throw new Error("Service inconnu."); hote.reglage.ecrire("noyau-secours-" + id, on ? "on" : "off"); autoCache = null; },
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
    version: VERSION_NOYAU, memoire, cerveau, etat, budget, budgetClaude, budgetLibre, budgetsSecours, jetonsClaude, barriere, catalogue, cycle, initiative, sommeil, actualite, perception,
    /** Pose une question. origine : lucien, voix, initiative, autonome. */
    async poser(texte, origine = "lucien") { const rc = await racRef.tenter(String(texte).slice(0, 2000), origine); if (rc) { return rc; } const r = await cycle.penser({ texte: String(texte).slice(0, 2000), origine }); signalerAValider(); return r; },
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
      return { version: VERSION_NOYAU, moteur: moteur().nom, budget: { utilisees: budget.utilisees(), plafond: budget.plafond(), restant: budgetTotal.restant() }, libre: { cle: !!cleLibre(), fournisseur: hote.reglage.lire("noyau-libre-fournisseur", "groq"), requetes: budgetLibre.utilisees(), plafondRequetes: budgetLibre.plafond() }, secours: { ordre: lireOrdreSecours(hote.reglage.lire("noyau-ordre-secours", "")), services: IDS_SECOURS.map((id) => { const x = SERVICES_SECOURS[id]; return { id, nom: x.nom, cle: !!cleService(id), autorise: serviceAutorise(id), entrainement: x.entrainement, page: x.page, limite: x.limite, modele: hote.reglage.lire("noyau-modele-" + id, "") || x.modele, requetes: budgetsSecours[id].utilisees(), plafond: budgetsSecours[id].plafond() }; }) }, claude: { cle: !!cleClaude(), requetes: budgetClaude.utilisees(), plafondRequetes: budgetClaude.plafond(), jetons: jetonsClaude.utilises(), plafondJetons: jetonsClaude.plafond(), dernier: dernierMoteur }, memoire: memoire.stats(), cerveau: cerveau.resume(), humeur: etat.humeur(), sommeilFait: sommeil.faitAujourdhui(), hote: hote.nom };
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
  pont.poser = (texte, origine) => noyau.poser(texte, origine);
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
  const { monterVueVocale } = await import("./vue-vocale.js");
  const vocale = monterVueVocale(noyau);
  hote.ui.ajouterMenuFond(() => [{ t: "Parler à l'orbe (vue vocale)", fn: () => vocale.ouvrir() }]);
  document.addEventListener("noyau:ouvrir", () => ui.ouvrir());                          // appui long sur l'orbe
  document.addEventListener("noyau:ouvrir-securite", () => secu && secu.ouvrir());
  // Sentinelle : capteurs, analyse locale toutes les 5 min (sans requête), recommandation de l'orbe toutes les 30 min
  noyau.sentinelle.surveiller();
  setTimeout(async () => { if (noyau.reglage("voix-piper") === "on") { await noyau.piper.preparer(); if (noyau.piper.pret()) definirMoteurVoix(noyau.piper); } }, 8000);
  setTimeout(() => noyau.sens.demarrer(), 15000); document.addEventListener("noyau:memoire", () => noyau.sens.nouveau());        // recherche par le sens : seulement si Lucien l'a acceptée
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
  try { creerPerso().appliquer(); } catch (e) { /* hub sans personnalisation */ }       // couleurs et styles choisis par Lucien
  // Veille d'étude (opt-in) : une étude toutes les 8 min, écran maintenu allumé ; rapport du matin à la première occasion
  setTimeout(() => { if (noyau.veille.actif()) noyau.veille.reprendre(); }, 6000);
  setInterval(() => { if (noyau.veille.actif()) noyau.veille.cycle().then(() => noyau.cycle.emettre({ type: "a_valider", n: noyau.memoire.aValider().length })).catch(() => {}); }, 60 * 1000);
  const importerNuit = () => noyau.veille.importerGithub().then((r) => { if (r && r.importees) noyau.cycle.emettre({ type: "a_valider", n: noyau.memoire.aValider().length }); }).catch(() => {});
  setTimeout(importerNuit, 12000); setInterval(importerNuit, 60 * 60e3);
  const rapporter = () => { if (document.hidden || noyau.veille.actif()) return; const r = noyau.veille.rapport(); if (r) { cycle.emettre({ type: "initiative", raison: "veille", texte: r.texte }); noyau.veille.marquerVu(r); } };
  setTimeout(rapporter, 9000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) return; if (noyau.veille.actif()) noyau.veille.reprendre(); else rapporter(); });
  window.__noyau = noyau;         // pour les essais en console
  return noyau;
}
