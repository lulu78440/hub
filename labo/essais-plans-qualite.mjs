// Laboratoire · qualité des plans (lot 4) : `node labo/essais-plans-qualite.mjs`
// Un échec est jugé et journalisé séparément ; seule une étape qui DÉPEND d'une étape ratée ne part pas (et elle est journalisée aussi).
// Identifiant de plan sur chaque ligne du journal, bilan, reprise, étape de secours, annulation. Moteur et réseau simulés.
import { executerPlan, verifierPlan, dependances, resoudreRefs } from "../js/noyau/execution.js";
import { creerBarriere } from "../js/noyau/barriere.js";
import { creerFileHotes } from "../js/noyau/fiabilite.js";
import { brancher } from "../js/noyau/hote.js";
import { journalActions } from "../js/noyau/journal.js";
import { creerCatalogue } from "../js/noyau/outils.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };

const kv = new Map(); let reseau = 0, panne = 0;
const dbn = (nom) => ({ series: { docs: [{ series_name: nom, period: ["2000", "2005", "2010", "2015"], value: [100, 110, 120, 130], indexed_at: "2026-10-20T10:00:00Z" }] } });
brancher({ nom: "test", maintenant: () => new Date(), enLigne: () => true, nouvelId: (p = "") => p + Math.random().toString(36).slice(2, 10),
  fetch: async (u) => { reseau++; if (panne > 0) { panne--; throw new Error("Failed to fetch"); } return { ok: true, status: 200, text: async () => JSON.stringify(dbn(/RENNES/.test(u) ? "Rennes" : "Versailles")) }; },
  reglage: { lire: (k, d) => d, ecrire: () => {} },
  stockage: { tout: async () => [], lire: async (c, id) => (c === "kv" ? kv.get(id) : null), ecrire: async (c, o) => { if (c === "kv") kv.set(o.id, JSON.parse(JSON.stringify(o))); } },
  ui: { afficherComposant: () => ({}) } });
const toutLeJournal = async () => (await journalActions.lire({ limite: 200 })).reverse();

// ----- outils d'essai
const sortie = () => [];
const T = (nom, niveau, exec, extra = {}) => ({ nom, niveau, params: { type: "object", properties: {} }, drapeaux: { lecture_seule: niveau === "LIBRE", reversible: true, monde_ouvert: false, idempotent: true }, sortie, resume: () => nom, exec, ...extra });
let confirmations = 0, rep = true;
const ex = { a: 0, b: 0, c: 0, ecrire: 0, secours: 0 };
const catalogue = [
  T("etape_ok", "LIBRE", async () => { ex.a++; return { jeu: "jeu:abcdef12" }; }),
  T("etape_ko", "LIBRE", async () => { ex.b++; throw new Error("la source est en panne"); }),
  T("etape_prend", "LIBRE", async (p) => { ex.c++; return { recu: p.jeu, jeu: "jeu:fedcba21" }; }),
  T("etape_secours", "LIBRE", async () => { ex.secours++; return { jeu: "jeu:secours01" }; }),
  T("etape_ecrit", "CONFIRMATION", async () => { ex.ecrire++; return { fait: true }; }, { drapeaux: { lecture_seule: false, reversible: true, monde_ouvert: false, idempotent: false } })
];
const barriere = creerBarriere({ catalogue, confirmer: async () => { confirmations++; return rep; }, delai: 200, pauseReprise: 1 });

// ===== 1. Une étape en échec ne cache pas les autres
let lignes = await executerPlan([{ nom: "etape_ko", params: {} }, { nom: "etape_prend", params: { jeu: "$1.jeu" } }, { nom: "etape_ok", params: {} }, { nom: "etape_prend", params: { jeu: "$3.jeu" } }], { barriere, id: "plan-test01" });
ok(lignes.length === 4 && !lignes[0].ok && !lignes[1].ok && lignes[2].ok && lignes[3].ok, "échec en étape 1 : l'étape qui en dépend ne part pas, les étapes indépendantes sont exécutées quand même");
ok(ex.b === 1 && ex.c === 1 && /Référence refusée/.test(lignes[1].erreur) && lignes[1].cause === "dependance", "l'étape dépendante dit pourquoi (cause « dependance ») et n'a pas appelé l'outil (seule l'étape 4 l'a fait)");
ok(JSON.stringify(lignes.map((l) => l.depend_de)) === "[[],[1],[],[3]]", "dépendances relevées pour chaque étape");
let j = (await toutLeJournal()).filter((l) => l.plan === "plan-test01");
ok(j.length === 5, "journal : 4 lignes d'étape + 1 ligne de plan, toutes avec l'identifiant du plan (" + j.length + ")");
ok(j.filter((l) => l.statut === "ERREUR").length === 3 && j.filter((l) => l.outil === "etape_prend" && l.cause === "dependance").length === 1, "l'étape non exécutée est journalisée à part, avec sa cause");
const lp = j.find((l) => l.outil === "(plan)");
ok(lp && lp.statut === "ERREUR" && lp.etapes === 4 && lp.reussies === 2 && lp.en_echec === 1 && lp.non_executees === 1 && /1 en échec/.test(lp.params) && /1 non exécutée/.test(lp.params), "ligne de plan : bilan chiffré (2 réussies, 1 en échec, 1 non exécutée)");
ok(lignes.id === "plan-test01" && lignes.bilan.reussies === 2 && lignes.bilan.en_echec === 1 && lignes.bilan.non_executees === 1 && lignes.bilan.refusees === 0, "le résultat porte son identifiant et son bilan");

// ===== 2. Plan réussi, identifiant automatique
lignes = await executerPlan([{ nom: "etape_ok", params: {} }, { nom: "etape_prend", params: { jeu: "$1.jeu" } }], { barriere });
ok(lignes.every((l) => l.ok) && /^plan-[a-z0-9]{1,10}$/.test(lignes.id) && lignes.bilan.reussies === 2, "plan réussi : identifiant « plan-… » attribué");
j = (await toutLeJournal()).filter((l) => l.plan === lignes.id);
ok(j.length === 3 && j.find((l) => l.outil === "(plan)").statut === "EXÉCUTÉ", "3 lignes journalisées sous cet identifiant, plan « EXÉCUTÉ »");
ok(lignes[1].donnees.recu === "jeu:abcdef12", "la référence passe d'une étape à l'autre");

// ===== 3. Refus de Lucien : jugé séparément, les dépendantes ne partent pas
rep = false; confirmations = 0; ex.ecrire = 0; ex.a = 0;
lignes = await executerPlan([{ nom: "etape_ecrit", params: {} }, { nom: "etape_prend", params: { jeu: "$1.fait" } }, { nom: "etape_ok", params: {} }], { barriere, id: "plan-refus1" });
ok(confirmations === 1 && ex.ecrire === 0 && lignes[0].refus === "refuse_par_lucien" && !lignes[1].ok && lignes[2].ok && ex.a === 1, "étape refusée par Lucien : elle ne s'exécute pas, l'étape indépendante oui");
ok(lignes.bilan.refusees === 1 && lignes.bilan.non_executees === 1 && lignes.bilan.reussies === 1, "bilan : 1 refusée, 1 non exécutée, 1 réussie");
j = (await toutLeJournal()).filter((l) => l.plan === "plan-refus1");
ok(j.some((l) => l.statut === "REFUSÉ_PAR_LUCIEN" && l.outil === "etape_ecrit"), "le refus est journalisé sous l'identifiant du plan");
rep = true; confirmations = 0; ex.ecrire = 0;
lignes = await executerPlan([{ nom: "etape_ecrit", params: {} }, { nom: "etape_ok", params: {} }, { nom: "etape_ecrit", params: {} }], { barriere });
ok(confirmations === 2 && ex.ecrire === 2, "un plan ne donne aucun droit nouveau : chaque étape CONFIRMATION redemande son accord (2 demandes pour 2 étapes)");
lignes = await executerPlan([{ nom: "supprimer_tout", params: {} }, { nom: "etape_ok", params: {} }], { barriere });
ok(!lignes[0].ok && lignes[1].ok && lignes[0].refus === "inconnu", "un outil interdit ou inconnu est bloqué, l'étape suivante est quand même jugée");

// ===== 4. Étape de secours (plans écrits par le code, jamais par le modèle)
ex.secours = 0; ex.b = 0;
lignes = await executerPlan([{ nom: "etape_ko", params: {}, secours: { nom: "etape_secours", params: {} } }, { nom: "etape_prend", params: { jeu: "$1.jeu" } }], { barriere, id: "plan-sec01" });
ok(lignes[0].ok && lignes[0].secours === "etape_secours" && /en panne/.test(lignes[0].echec_initial) && ex.secours === 1 && lignes[1].donnees.recu === "jeu:secours01", "source en panne : l'étape de secours prend le relais, et la suite reprend SON résultat");
j = (await toutLeJournal()).filter((l) => l.plan === "plan-sec01");
ok(j.some((l) => l.outil === "etape_ko" && l.statut === "ERREUR") && j.some((l) => l.outil === "etape_secours" && l.statut === "EXÉCUTÉ"), "l'échec ET le secours sont journalisés séparément");
rep = false; ex.secours = 0;
lignes = await executerPlan([{ nom: "etape_ecrit", params: {}, secours: { nom: "etape_secours", params: {} } }], { barriere });
ok(ex.secours === 0 && lignes[0].refus, "le refus de Lucien n'est JAMAIS contourné par une étape de secours"); rep = true;
lignes = await executerPlan([{ nom: "etape_ko", params: {}, secours: { nom: "inconnu_x", params: {} } }], { barriere });
ok(!lignes[0].ok, "un secours qui n'existe pas ne rend pas l'étape réussie");

// ===== 5. Annulation en cours de route
const ctl = new AbortController(); ex.a = 0; ex.c = 0;
lignes = await executerPlan([{ nom: "etape_ok", params: {} }, { nom: "etape_prend", params: { jeu: "$1.jeu" } }, { nom: "etape_ok", params: {} }], { barriere, signal: ctl.signal, id: "plan-annul", apres: (l, i) => { if (i === 0) ctl.abort(); } });
ok(lignes[0].ok && lignes[1].annule && lignes[2].annule && ex.a === 1 && ex.c === 0, "annulation après l'étape 1 : les suivantes ne partent pas");
j = (await toutLeJournal()).filter((l) => l.plan === "plan-annul");
ok(j.filter((l) => l.cause === "annule").length === 2 && lignes.bilan.non_executees === 2, "les étapes annulées sont journalisées une par une");

// ===== 6. Limite de 6 étapes, plan vide, références
const sept = Array.from({ length: 7 }, () => ({ nom: "etape_ok", params: {} }));
lignes = await executerPlan(sept, { barriere });
ok(lignes.length === 7 && lignes[6].saute && lignes.bilan.etapes === 6 && lignes.bilan.reussies === 6, "7e étape ignorée, bilan sur 6 étapes");
ok(dependances({ a: "$1.jeu", b: ["$3.jeu", "texte"], c: { d: "$2.x" } }).join() === "1,2,3" && dependances({ a: "$0.jeu", b: "$10.jeu", c: "jeu:abcdef12" }).length === 0, "dépendances : seules les formes permises sont relevées");
let v = verifierPlan([{ nom: "a", params: {} }, { nom: "b", params: { jeu: "$1.jeu" } }]); ok(v.ok && v.etapes[1].depend_de[0] === 1, "plan cohérent reconnu");
v = verifierPlan([{ nom: "a", params: { jeu: "$2.jeu" } }, { nom: "b", params: { jeu: "$1.jeu" } }]); ok(!v.ok && v.problemes.length === 1 && /circulaire/.test(v.problemes[0]), "référence circulaire repérée avant toute exécution");
v = verifierPlan([{ nom: "a", params: { jeu: "$1.jeu" } }]); ok(!v.ok, "référence à soi-même refusée");
ok(!verifierPlan([]).ok && !verifierPlan(null).ok, "plan vide refusé");
lignes = await executerPlan([{ nom: "etape_prend", params: { jeu: "$2.jeu" } }, { nom: "etape_ok", params: {} }], { barriere });
ok(!lignes[0].ok && /pas avant/.test(lignes[0].erreur) && lignes[1].ok, "exécution : référence vers l'avenir refusée, l'étape suivante est jugée");
try { resoudreRefs({ a: "$1.jeu" }, 1, []); ok(false, "résoudre sans étape"); } catch (e) { ok(/pas avant/.test(e.message), "résoudre une référence sans étape précédente : refus"); }

// ===== 7. Bout en bout avec le VRAI catalogue : reprise réseau dans un plan de lectures
const cat = creerCatalogue({ raccourcis: () => ({}) });
let tb = 10_000_000; const pb = async (ms) => { tb += ms; };
const b3 = creerBarriere({ catalogue: cat, confirmer: async () => true, delai: 200, pause: pb, pauseReprise: 1, file: creerFileHotes({ maintenant: () => tb, pause: pb }) });
panne = 1; reseau = 0;
lignes = await executerPlan([
  { nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/VERSAILLES" } },
  { nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/RENNES" } },
  { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "comparer", avec: "$2.jeu" } },
  { nom: "afficher_module", params: { jeu: "$3.jeu", vue: "courbe", titre: "Versailles et Rennes" } }], { barriere: b3, id: "plan-reel01" });
ok(lignes.every((l) => l.ok) && lignes[0].essais === 2 && lignes.bilan.reprises === 1 && reseau === 3, "plan de 4 étapes : la 1re lecture échoue par réseau, elle est reprise UNE fois, le plan réussit (3 requêtes, 1 reprise)");
j = (await toutLeJournal()).filter((l) => l.plan === "plan-reel01");
ok(j.length === 5 && j.find((l) => l.outil === "lire_serie").essais === 2 && /1 reprise/.test(j.find((l) => l.outil === "(plan)").params), "journal : reprise visible sur la ligne de l'étape et dans le bilan du plan");
panne = 5; reseau = 0;
lignes = await executerPlan([{ nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/VERSAILLES" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "indice100" } }], { barriere: b3 });
ok(!lignes[0].ok && lignes[0].essais === 2 && lignes[0].cause === "reseau" && !lignes[1].ok && lignes[1].cause === "dependance" && reseau === 2 && lignes.bilan.en_echec === 1, "source en panne durable : 2 essais seulement (2 requêtes), la suite ne part pas, l'arrêt est propre");

console.log(ko ? `\n${ko} ÉCHEC(S)` : "\nTout est au vert."); process.exit(ko ? 1 : 0);
