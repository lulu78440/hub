// Laboratoire · workflows multi-outils (orchestrateur, lot 8) : `node labo/essais-workflows.mjs`
// Une suite d'étapes nommée, rejouable, qui reste soumise aux confirmations étape par étape. Hub, réseau et moteur simulés.
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { verifierWorkflow, instancier, budget, rejouer, RefusWorkflow, MAX_WORKFLOWS } from "../js/noyau/workflows.js";
import { MODELES_PLANS } from "../js/noyau/plans-modeles.js";
import { journalActions } from "../js/noyau/journal.js";
import { hote } from "../js/noyau/hote.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const leve = async (f, re, m) => { try { await f(); ko++; console.log("✗ " + m + " (aucune erreur)"); } catch (e) { if (re.test(e.message)) console.log("✓ " + m); else { ko++; console.log("✗ " + m + " : " + e.message); } } };

let reseau = []; const dbn = (nom) => ({ series: { docs: [{ series_name: nom, period: ["2000", "2005", "2010", "2015"], value: [100, 110, 120, 130], indexed_at: "2026-10-20T10:00:00Z" }] } });
const wb = (u) => ({ ok: true, status: 200, json: async () => ({}), text: async () => JSON.stringify([{ page: 1, pages: 1 }, [{ date: "2015", value: 3 }, { date: "2010", value: 2 }, { date: "2005", value: 1 }].map((x) => ({ ...x, country: { value: "France" }, indicator: { value: "Pop" } }))]) });
const hub = creerHubSimule({ vide: true, fetch: async (u) => { reseau.push(String(u)); if (/worldbank/.test(u)) return wb(u); return { ok: true, status: 200, json: async () => ({}), text: async () => JSON.stringify(dbn(/RENNES/.test(u) ? "Rennes" : "Versailles")) }; } });
const affiches = []; hub.hote.ui.afficherComposant = (vue, jeu, o) => { affiches.push({ vue, o, lignes: jeu.lignes.length }); return { classList: { contains: () => false } }; };
let requetesModele = 0;
const n = await creerNoyau({ moteur: { nom: "simulé", generer: async () => { requetesModele++; return { texte: "", appels: [], usage: { total: 0 } }; } } });
let accords = [], reponse = true; n.confirmerAvec(async (d) => { accords.push(d); return reponse; });
const b = n.barriere;

// ===== 1. Validateur
const W = { id: "pop-compare", nom: "Comparer deux villes", parametres: [{ id: "a", libelle: "Ville A" }, { id: "b", libelle: "Ville B" }],
  etapes: [{ nom: "lire_serie", params: { source: "dbnomics", identifiant: "@a" } }, { nom: "lire_serie", params: { source: "dbnomics", identifiant: "@b" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "comparer", avec: "$2.jeu" } }, { nom: "afficher_module", params: { jeu: "$3.jeu", vue: "courbe" } }] };
ok(verifierWorkflow(W, { catalogue: b }).etapes.length === 4, "un workflow valide est accepté");
const refus = (w, re, m) => leve(async () => verifierWorkflow(w, { catalogue: b }), re, m);
await refus({ ...W, etapes: [{ nom: "supprimer_tout", params: {} }] }, /n'est pas un outil validé/, "outil inconnu refusé");
await refus({ ...W, etapes: [{ nom: "lire_page", params: { url: "https://x.test" } }] }, /ne peut pas entrer/, "outil exclu (lire_page) refusé, comme pour les routines");
await refus({ ...W, etapes: [{ nom: "lire_taches", params: {}, secours: { nom: "lire_agenda" } }] }, /pas d'étape de secours/, "pas de secours posé par un workflow");
await refus({ ...W, etapes: W.etapes.slice(0, 2).concat([{ nom: "transformer_donnees", params: { jeu: "$4.jeu", operation: "periode", debut: "2000" } }]) }, /n'est pas avant elle/, "référence vers l'avenir refusée");
await refus({ ...W, etapes: [{ nom: "lire_serie", params: { source: "dbnomics", identifiant: "@zz" } }] }, /non déclaré/, "paramètre non déclaré refusé");
await refus({ ...W, parametres: [...W.parametres, { id: "c", libelle: "Inutile" }] }, /jamais utilisé/, "paramètre déclaré mais inutilisé refusé");
await refus({ ...W, etapes: [{ nom: "lire_serie", params: { source: "dbnomics", identifiant: "$x" } }] }, /mal écrite/, "référence mal écrite refusée");
await refus({ ...W, etapes: Array(7).fill({ nom: "heure", params: {} }), parametres: [] }, /de 1 à 6 étapes/, "6 étapes au plus");
await refus({ ...W, nom: "<script>" }, /sans balise/, "nom avec balise refusé");
await refus({ ...W, code: "x" }, /champ inconnu/, "champ inconnu refusé");
await refus({ ...W, etapes: [{ nom: "lire_serie", params: { source: "dbnomics", identifiant: { a: { b: { c: { d: { e: "x" } } } } } } }] , parametres: [] }, /imbriqués/, "paramètres trop imbriqués refusés");
await refus({ ...W, etapes: [{ nom: "lire_serie", params: { source: "dbnomics", identifiant: "@a" }, eval: "1" }] , parametres: [{ id: "a", libelle: "A" }] }, /non permis/, "champ d'étape inconnu refusé");
ok(!JSON.stringify(MODELES_PLANS).includes("eval"), "aucun modèle ne contient d'expression");

// ===== 2. Instanciation
let ap = instancier(W, { a: "INSEE/POP/VERSAILLES", b: "INSEE/POP/RENNES" });
ok(ap[0].params.identifiant === "INSEE/POP/VERSAILLES" && ap[1].params.identifiant === "INSEE/POP/RENNES" && ap[2].params.jeu === "$1.jeu", "les paramètres « @nom » sont remplis, les « $N.champ » restent des références");
await leve(async () => instancier(W, { a: "x" }), /il manque la valeur/, "valeur manquante refusée");
await leve(async () => instancier(W, { a: "x", b: "$1.jeu" }), /commencer par \$ ou @/, "une valeur qui ressemble à une référence est refusée (pas de détournement)");
await leve(async () => instancier(W, { a: "x", b: "@a" }), /commencer par \$ ou @/, "une valeur qui ressemble à un paramètre est refusée");
await leve(async () => instancier(W, { a: "x", b: "y", c: "z" }), /paramètre inconnu/, "valeur pour un paramètre inconnu refusée");
await leve(async () => instancier(W, { a: "x".repeat(201), b: "y" }), /1 à 200/, "valeur trop longue refusée");
const Wn = { id: "n-der", nom: "N derniers", parametres: [{ id: "n", libelle: "Nombre", type: "nombre" }, { id: "c", libelle: "Choix", type: "choix", choix: ["courbe", "barres"] }], etapes: [{ nom: "lire_serie", params: { source: "banque_mondiale", identifiant: "FR/SP.POP.TOTL" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "derniers", n: "@n" } }, { nom: "afficher_module", params: { jeu: "$2.jeu", vue: "@c" } }] };
ap = instancier(Wn, { n: "2", c: "barres" }); ok(ap[1].params.n === 2 && typeof ap[1].params.n === "number" && ap[2].params.vue === "barres", "type nombre converti ; choix respecté");
await leve(async () => instancier(Wn, { n: "abc", c: "barres" }), /nombre est attendu/, "nombre invalide refusé");
await leve(async () => instancier(Wn, { n: 3, c: "radar" }), /choix permis/, "choix hors liste refusé");

// ===== 3. Budget annoncé
const bu = budget(instancier(MODELES_PLANS[4], { source: "dbnomics", identifiant: "FR/X", module: "pop", titre: "Pop" }), b);
ok(bu.etapes === 3 && bu.confirmations === 1 && bu.appels_reseau === 1 && bu.requetes_modele === 0, "budget : 3 étapes, 1 accord demandé, 1 appel réseau, 0 requête au modèle");

// ===== 4. Rejouer : fenêtre de validation obligatoire, puis niveaux étape par étape
let annonce = null;
let r = await rejouer(W, { a: "INSEE/POP/VERSAILLES", b: "INSEE/POP/RENNES" }, { barriere: b });
ok(!r.lance && /aucune fenêtre de validation/.test(r.raison) && reseau.length === 0, "sans fenêtre de validation : rien ne part");
r = await rejouer(W, { a: "INSEE/POP/VERSAILLES", b: "INSEE/POP/RENNES" }, { barriere: b, annoncer: async () => false });
ok(!r.lance && r.raison === "refusé par Lucien" && reseau.length === 0, "Lucien refuse à l'annonce : rien ne part");
r = await rejouer(W, { a: "INSEE/POP/VERSAILLES", b: "INSEE/POP/RENNES" }, { barriere: b, annoncer: async (x) => { annonce = x; return true; } });
ok(annonce.nom === "Comparer deux villes" && annonce.etapes.length === 4 && annonce.budget.appels_reseau === 2, "l'annonce montre le nom, les 4 étapes avec leur niveau et le budget");
ok(r.lance && r.bilan.reussies === 4 && reseau.length === 2 && affiches.length === 1 && affiches[0].lignes === 8, "rejoué : 4 étapes réussies, 2 requêtes, la courbe à deux séries est affichée");
ok(/^plan-/.test(r.id_plan) && (await journalActions.lire({ limite: 100 })).some((l) => l.plan === r.id_plan && l.outil === "(plan)" && l.origine === "lucien"), "le plan est journalisé (origine « lucien »)");
// rejouable : même workflow, autres valeurs
reseau = []; r = await rejouer(W, { a: "INSEE/POP/RENNES", b: "INSEE/POP/VERSAILLES" }, { barriere: b, annoncer: async () => true });
ok(r.lance && r.bilan.reussies === 4 && reseau.length === 2, "rejoué avec d'autres valeurs : ça marche encore");

// CONFIRMATION : chaque lancement redemande l'accord, étape par étape
const WE = MODELES_PLANS.find((m) => m.id === "serie-a-enregistrer"); const vals = { source: "dbnomics", identifiant: "INSEE/POP/VERSAILLES", module: "pop-versailles", titre: "Population de Versailles" };
accords = []; reponse = false;
r = await rejouer(WE, vals, { barriere: b, annoncer: async () => true });
ok(accords.length === 1 && accords[0].outil === "enregistrer_module" && accords[0].niveau === "CONFIRMATION", "l'étape d'enregistrement redemande l'accord de Lucien malgré l'annonce du workflow");
ok(r.bilan.reussies === 2 && r.bilan.refusees === 1 && !(await hub.hote.stockage.lire("kv", "noyau-module-pop-versailles")), "Lucien refuse l'étape : les 2 premières ont réussi, rien n'est enregistré");
accords = []; reponse = true; r = await rejouer(WE, vals, { barriere: b, annoncer: async () => true });
ok(accords.length === 1 && r.bilan.reussies === 3 && (await hub.hote.stockage.lire("kv", "noyau-module-pop-versailles")).versions.length === 1, "Lucien accepte : module enregistré (version 1)");
accords = []; r = await rejouer(WE, vals, { barriere: b, annoncer: async () => true });
ok(accords.length === 1 && (await hub.hote.stockage.lire("kv", "noyau-module-pop-versailles")).versions.length === 2, "rejoué : l'accord est redemandé à CHAQUE lancement, et c'est une nouvelle version");
// annulation
reseau = []; const ctl = new AbortController(); let k = 0;
r = await rejouer(W, { a: "INSEE/POP/VERSAILLES", b: "INSEE/POP/RENNES" }, { barriere: b, annoncer: async () => true, signal: ctl.signal, apres: () => { if (++k === 1) ctl.abort(); } });
ok(r.bilan.reussies === 1 && r.bilan.non_executees === 3 && r.bilan.en_echec === 0 && reseau.length === 1, "annulation par signal après l'étape 1 : 3 non exécutées, 0 en échec");
// une source en panne : les étapes dépendantes ne partent pas
const horsLigne = hub.hote.enLigne; hub.reseau(false);
r = await rejouer(W, { a: "INSEE/POP/VERSAILLES", b: "INSEE/POP/RENNES" }, { barriere: b, annoncer: async () => true });
ok(r.bilan.en_echec === 2 && r.bilan.non_executees === 2 && r.bilan.reussies === 0, "hors ligne : 2 lectures en échec, comparaison et affichage non exécutées (arrêt propre)"); hub.reseau(true);
await leve(() => rejouer(W, { a: "x" }, { barriere: b, annoncer: async () => true }), /il manque la valeur/, "valeur manquante : refus avant tout appel");

// ===== 5. Les modèles de plan fonctionnent tous, sans IA
const exemples = { "serie-en-courbe": { source: "banque_mondiale", identifiant: "FR/SP.POP.TOTL" }, "serie-depuis": { source: "banque_mondiale", identifiant: "FR/SP.POP.TOTL", debut: "2005" }, "comparer-deux-series": { source: "banque_mondiale", serie_a: "FR/SP.POP.TOTL", serie_b: "FR/SP.POP.TOTL" }, "variation-en-barres": { source: "banque_mondiale", identifiant: "FR/FP.CPI.TOTL.ZG" }, "serie-a-enregistrer": { source: "banque_mondiale", identifiant: "FR/SP.POP.TOTL", module: "mod-test", titre: "Test" } };
for (const m of MODELES_PLANS) { affiches.length = 0; accords = []; reponse = true; const x = await rejouer(m, exemples[m.id], { barriere: b, annoncer: async () => true }); ok(x.lance && x.bilan.reussies === m.etapes.length - (m.id === "comparer-deux-series" ? 0 : 0) && affiches.length >= 1, `modèle « ${m.id} » : ${m.etapes.length} étapes réussies, vue affichée, sans IA`); }
ok(requetesModele === 0, "aucune requête au modèle d'IA pour tout cela");

// ===== 6. Workflows enregistrés : gestes de Lucien, 20 au plus, lancement compté
const ui = hote.ui.orchestrateur; const G = await ui.gestes(); const WF = await ui.workflows();
ok((await WF.lister()).modeles.length === 5 && (await WF.lister()).enregistres.length === 0, "palette : 5 modèles proposés, aucun workflow enregistré");
await G.enregistrerWorkflow(W); const lst = (await WF.lister()).enregistres; ok(lst.length === 1 && lst[0].id === "pop-compare" && lst[0].lancements === 0 && lst[0].parametres.join() === "a,b", "workflow enregistré par Lucien et listé");
await leve(() => G.enregistrerWorkflow({ ...W, id: "mauvais", etapes: [{ nom: "lire_page", params: {} }], parametres: [] }), /ne peut pas entrer/, "un workflow piégé n'est pas enregistré");
reseau = []; r = await WF.rejouer("pop-compare", { a: "INSEE/POP/VERSAILLES", b: "INSEE/POP/RENNES" }, { annoncer: async () => true });
ok(r.lance && r.bilan.reussies === 4 && (await WF.lister()).enregistres[0].lancements === 1 && (await WF.lister()).enregistres[0].dernier_lancement, "rejoué depuis l'enregistrement : lancement compté");
const brutKv = await hub.hote.stockage.lire("kv", "noyau-workflow-pop-compare"); brutKv.etapes[0].nom = "supprimer_tout"; await hub.hote.stockage.ecrire("kv", brutKv);
await leve(() => WF.rejouer("pop-compare", { a: "x", b: "y" }, { annoncer: async () => true }), /n'est pas un outil validé/, "un workflow altéré dans le stockage est refusé au lancement");
for (let i = 0; i < MAX_WORKFLOWS + 3; i++) await G.enregistrerWorkflow({ ...W, id: "wf-" + i }).catch(() => {});
ok((await WF.lister()).enregistres.length === MAX_WORKFLOWS, `${MAX_WORKFLOWS} workflows au plus`);
await G.retirerWorkflow("wf-0"); ok(!!(await hub.hote.stockage.lire("kv", "noyau-corbeille-workflow-wf-0")), "retirer : sauvegarde AVANT (geste de Lucien)");
// le modèle n'a aucun outil pour écrire ou lancer un workflow
const outils = b.presenter().map((o) => o.nom); ok(!outils.some((x) => /workflow|plan_modele|rejouer/.test(x)), "aucun outil « workflow » dans le catalogue du modèle");
const rr = await b.executer({ outil: "rejouer_workflow", params: { id: "pop-compare" } }); ok(!rr.ok && rr.refus && rr.refus.raison === "inconnu", "un outil « rejouer_workflow » demandé par le modèle est bloqué (inconnu)");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
