// Laboratoire · annulation propre d'un plan (orchestrateur, lot 5) : `node labo/essais-annulation.mjs`
// Le signal d'annulation passe de boucle.js à executerPlan : les étapes annulées sont « non exécutées » dans le bilan, jamais « en échec ».
// Refonte 6 (7.43.0) : le bouton « Annuler le plan » de js/ui/noyau-controles.js lit planEnCours() et appelle annulerPlan() ; il n'enveloppe plus la barrière. Hub, réseau et moteur simulés.
import { installer } from "./faux-dom.js";
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { executerPlan } from "../js/noyau/execution.js";
import { annulerPlan, planEnCours, ouvrirSignal, fermerSignal } from "../js/noyau/annulation.js";
import { journalActions } from "../js/noyau/journal.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const doc = installer(); const ecoutes = {};
doc.addEventListener = (t, f) => { (ecoutes[t] ||= []).push(f); }; doc.dispatchEvent = (e) => { (ecoutes[e.type] || []).forEach((f) => f(e)); return true; };
globalThis.CustomEvent = class { constructor(type, o = {}) { this.type = type; this.detail = o.detail; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const dbn = (nom) => ({ series: { docs: [{ series_name: nom, period: ["2000", "2005"], value: [1, 2], indexed_at: "2026-10-20T10:00:00Z" }] } });

// ===== 1. Le signal est passé à executerPlan (chemin propre) : étape en vol coupée, suivantes non lancées
let appelsReseau = 0, coupes = 0;
const hub = creerHubSimule({ vide: true, fetch: (u, o) => { appelsReseau++; return new Promise((res, rej) => { if (o && o.signal) o.signal.addEventListener("abort", () => { coupes++; rej(Object.assign(new Error("abort"), { name: "AbortError" })); }); }); } });
const n = await creerNoyau({ moteur: { nom: "simulé", generer: async () => ({ texte: "", appels: [], usage: { total: 0 } }) } });
const appels = [1, 2, 3].map((k) => ({ nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/V" + k } }));
const sig = ouvrirSignal("plan-annul-propre");
ok(planEnCours() === "plan-annul-propre", "le plan en cours est connu");
const p = executerPlan(appels, { barriere: n.barriere, signal: sig, id: "plan-annul-propre" });
await attendre(50); ok(annulerPlan() === true && annulerPlan() === false, "annulerPlan() abat le signal une seule fois");
let lignes = await p; fermerSignal("plan-annul-propre");
ok(planEnCours() === null, "signal fermé après le plan (rien ne reste en mémoire)");
ok(coupes === 1 && appelsReseau === 1, "l'appel en cours est coupé, aucune autre requête n'est partie");
ok(lignes[0].annule === true && lignes[1].annule && lignes[2].annule && lignes.every((l) => l.cause === "annule"), "les 3 étapes sont marquées annulées (même celle qui était en vol)");
ok(lignes.bilan.non_executees === 3 && lignes.bilan.en_echec === 0 && lignes.bilan.reussies === 0, "bilan : 3 non exécutées, 0 en échec");
let j = (await journalActions.lire({ limite: 100 })).filter((l) => l.plan === "plan-annul-propre");
ok(j.filter((l) => l.cause === "annule").length === 3 && j.some((l) => l.outil === "(plan)" && /3 non exécutée/.test(l.params) && !/en échec/.test(l.params)), "journal : 3 lignes « annule » et un bilan « 3 non exécutée(s) », sans « en échec »");

// ===== 2. Un autre cas : annulation APRÈS une étape réussie ; l'étape réussie reste réussie
const catalogueOk = n.barriere;
const ctl = new AbortController();
// (étape 1 simulée par un outil du catalogue : heure, LIBRE, instantané)
lignes = await executerPlan([{ nom: "heure", params: {} }, { nom: "heure", params: {} }, { nom: "heure", params: {} }], { barriere: catalogueOk, signal: ctl.signal, id: "plan-apres-1", apres: (l, i) => { if (i === 0) ctl.abort(); } });
ok(lignes[0].ok && lignes[1].annule && lignes[2].annule && lignes.bilan.reussies === 1 && lignes.bilan.non_executees === 2 && lignes.bilan.en_echec === 0, "annulation après l'étape 1 : 1 réussie, 2 non exécutées, 0 en échec");

// ===== 3. Le bouton « Annuler le plan » de la Refonte 6 : planEnCours() / annulerPlan(), aucune enveloppe de la barrière
const { monterControles } = await import("../js/ui/noyau-controles.js");
function h(tag, attrs = {}, ...enf) { const e = doc.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); } for (const x of enf.flat()) if (x != null && x !== false) e.append(typeof x === "string" ? doc.createTextNode(x) : x); return e; }
const racine = h("div", { class: "nx" }); racine.dataset = { vue: "chat" }; racine.closest = () => null; racine.querySelector = (s) => (s === ".nx-etat" ? null : racine.parClasse(s.slice(1))[0] || null); racine.prepend = (e) => { e.parentNode = racine; racine.enfants = [e, ...(racine.enfants || [])]; };
appelsReseau = 0; coupes = 0;
const c = monterControles({ racine, api: { afficherSources: async () => {}, changerVue() {} }, noyau: n, h });
ok(c && !n.barriere.__vuesPlan, "le module de la Refonte n'enveloppe plus la barrière (pas de marqueur __vuesPlan)");
const sigB = ouvrirSignal("plan-bouton");
const p2 = executerPlan(appels, { barriere: n.barriere, origine: "modele", id: "plan-bouton", signal: sigB });
await attendre(400); c.bAnnuler.click();
lignes = await p2; fermerSignal("plan-bouton");
ok(coupes === 1 && appelsReseau === 1, "bouton : l'appel en cours est coupé, rien d'autre ne part");
ok(lignes.every((l) => !l.ok && l.annule === true && l.cause === "annule"), "bouton : les 3 étapes sont marquées annulées par executerPlan (signal de annulation.js)");
ok(lignes.bilan.non_executees === 3 && lignes.bilan.en_echec === 0, "bouton : bilan 3 non exécutées, 0 en échec (avant : toutes « en échec »)");
j = (await journalActions.lire({ limite: 200 })).filter((l) => l.plan === "plan-bouton");
ok(j.filter((l) => l.cause === "annule").length === 3, "bouton : une ligne de journal par étape, sans doublon (" + j.filter((l) => l.cause === "annule").length + ")");
await attendre(800);

// ===== 4. Dans le vrai cycle de pensée : boucle.js ouvre le signal et le passe à executerPlan
const hub2 = creerHubSimule({ vide: true, fetch: (u, o) => { appelsReseau++; if (appelsReseau === 1) setTimeout(() => annulerPlan(), 10); return new Promise((res, rej) => { if (o && o.signal) o.signal.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" }))); }); } });
let tour = 0; appelsReseau = 0;
const script = [{ appels: [...appels, { nom: "afficher_module", params: { jeu: "$3.jeu", vue: "courbe" } }] }, { appels: [{ nom: "repondre", params: { texte: "Plan annulé, rien n'est affiché.", ton: "calme", confiance: "moyenne", sources: [] } }] }];
const n2 = await creerNoyau({ moteur: { nom: "moteur simulé", generer: async () => { const s = script[tour++]; return { texte: "", appels: s.appels, brut: null, usage: { total: 10 }, ms: 1 }; } } });
ok(!n2.barriere.__vuesPlan, "cycle de pensée : la barrière n'est pas enveloppée, boucle.js passe son propre signal");
const rep = await n2.poser("Lis trois séries et trace la troisième");
const tr = n2.cycle.inspecteur()[0];
ok(tr.outils.length === 4 && tr.outils.every((o) => !o.ok), "le cycle a reçu 4 étapes toutes non réussies (annulées)");
const jj = (await hub2.hote.stockage.lire("kv", "noyau-journal")).lignes;
const lp = jj.filter((l) => l.outil === "(plan)").pop();
ok(lp && lp.non_executees === 4 && lp.en_echec === 0 && lp.statut === "ERREUR", "journal du plan : 4 non exécutées, 0 en échec");
ok(planEnCours() === null, "le signal du cycle est refermé à la fin du plan");
ok(/annulé|rien/i.test(rep.texte), "l'échange continue : la réponse finale est rendue");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
