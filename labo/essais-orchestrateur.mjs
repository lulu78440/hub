// Laboratoire · essais du registre d'outils et des plans (orchestrateur, lot 3) : `node labo/essais-orchestrateur.mjs`
// Hôte simulé, réseau simulé, aucune IA, aucune requête réelle.
import { validerParams, controlerOutil, controlerCatalogue, validerSortie, hotesDuCatalogue, fiche } from "../js/noyau/registre.js";
import { creerJeux, resumeJeu, RE_REF } from "../js/noyau/jeux.js";
import { transformer, RefusTransformation } from "../js/noyau/transformer.js";
import { creerModules, optionsParDefaut } from "../js/noyau/modules.js";
import { executerPlan, resoudreRefs, MAX_ETAPES } from "../js/noyau/execution.js";
import { brancher } from "../js/noyau/hote.js";
import { creerCatalogue, OUTILS_VALIDES } from "../js/noyau/outils.js";
import { creerBarriere, encadrer } from "../js/noyau/barriere.js";
import { HOTES_DONNEES } from "../js/noyau/donnees.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const leve = async (f, motif, m) => { try { await f(); ko++; console.log("✗ " + m + " (aucun refus)"); } catch (e) { ok(motif.test(e.message), m + " → " + String(e.message).slice(0, 90)); } };

// ===== 1. Validateur du registre
const sch = { type: "object", additionalProperties: false, properties: { n: { type: "integer", minimum: 1, maximum: 10 }, x: { type: "number" }, t: { type: "string", pattern: "^jeu:[a-z0-9]{6,16}$", maxLength: 20 }, l: { type: "array", maxItems: 2, items: { type: "string", maxLength: 3 } }, o: { type: "object", properties: { a: { type: "string" } }, required: ["a"] } }, required: ["t"] };
ok(validerParams({ t: "jeu:abcdef12" }, sch) === null, "paramètres conformes acceptés");
ok(/manquant/.test(validerParams({}, sch)), "paramètre manquant");
ok(/format/.test(validerParams({ t: "50 millions" }, sch)), "motif (pattern) : un chiffre ou un texte libre à la place d'une référence est refusé");
ok(/au plus/.test(validerParams({ t: "jeu:abcdef12", n: 11 }, sch)) && /au moins/.test(validerParams({ t: "jeu:abcdef12", n: 0 }, sch)), "bornes minimum et maximum");
ok(/entier/.test(validerParams({ t: "jeu:abcdef12", n: 1.5 }, sch)) && /nombre/.test(validerParams({ t: "jeu:abcdef12", x: "3" }, sch)) && /nombre/.test(validerParams({ t: "jeu:abcdef12", x: NaN }, sch)), "entier, nombre, NaN refusé");
ok(/trop d'éléments/.test(validerParams({ t: "jeu:abcdef12", l: ["a", "b", "c"] }, sch)) && /trop long/.test(validerParams({ t: "jeu:abcdef12", l: ["abcd"] }, sch)), "liste : taille et éléments vérifiés");
ok(/manquant : o\.a/.test(validerParams({ t: "jeu:abcdef12", o: {} }, sch)), "objet imbriqué : champ requis vérifié");
ok(/inconnu/.test(validerParams({ t: "jeu:abcdef12", pirate: 1 }, sch)), "paramètre inconnu refusé quand le schéma est strict");
ok(validerParams({ a: 1 }, { type: "object", properties: {} }) === null, "schéma non strict (outils existants) : paramètre en plus toléré comme avant");
ok(validerParams(null, sch) !== null && validerParams([], sch) !== null, "paramètres absents ou mal formés : refus sans exception");

// ===== 2. Cohérence des drapeaux
const base = { nom: "mon_outil", niveau: "LIBRE", params: { type: "object", properties: {} }, exec: async () => ({}) };
ok(controlerOutil(base).length === 0, "outil simple cohérent");
ok(controlerOutil({ ...base, drapeaux: { lecture_seule: false } }).some((x) => /accès libre/.test(x)), "un outil qui écrit ne peut pas être LIBRE");
ok(controlerOutil({ ...base, niveau: "CONFIRMATION", drapeaux: { lecture_seule: false, reversible: false } }).some((x) => /irréversible/.test(x)), "une action irréversible est interdite au Noyau");
ok(controlerOutil({ ...base, drapeaux: { lecture_seule: true, reversible: false } }).length >= 1, "drapeaux contradictoires refusés");
ok(controlerOutil({ ...base, hotes: ["pas un domaine"] }).some((x) => /hôte invalide/.test(x)) && controlerOutil({ ...base, hotes: ["a.fr"], drapeaux: { monde_ouvert: false } }).length === 1, "hôtes vérifiés ; un outil qui contacte un site est « monde ouvert »");
ok(controlerOutil({ ...base, limites: { delai_ms: 5 } }).length === 1 && controlerOutil({ ...base, limites: { delai_ms: 5000, max_par_minute: 30, taille_max: 2000 } }).length === 0, "limites vérifiées");
ok(controlerOutil({ ...base, niveau: "LIBRE" }, { mon_outil: "CONFIRMATION" }).some((x) => /différent du niveau validé/.test(x)), "un drapeau ne peut jamais assouplir le niveau validé");
ok(!controlerCatalogue([base, base]).ok, "nom en double signalé");

// ===== 3. Hôte simulé et catalogue
const kv = new Map(), col = { tasks: [], events: [] }, affiches = [], confirmations = []; let reponseConf = true;
const dbn = { series: { docs: [{ series_name: "Population de Versailles", period: ["2000", "2005", "2010", "2015"], value: [85000, 86000, 85500, 85800], indexed_at: "2026-10-20T10:00:00Z" }] } };
const dbn2 = { series: { docs: [{ series_name: "Population de Rennes", period: ["2000", "2005", "2010", "2015"], value: [206000, 212000, 206000, 215000], indexed_at: "2026-10-20T10:00:00Z" }] } };
const appelsReseau = [];
brancher({ nom: "test", maintenant: () => new Date(), enLigne: () => true, nouvelId: (p = "") => p + Math.random().toString(36).slice(2, 10),
  fetch: async (u) => { appelsReseau.push(String(u)); const corps = /Rennes|RENNES/.test(u) ? dbn2 : dbn; return { ok: true, status: 200, text: async () => JSON.stringify(corps) }; },
  reglage: { lire: (k, d) => d, ecrire: () => {} },
  stockage: { tout: async (c) => (c === "kv" ? [...kv.values()].map((x) => JSON.parse(JSON.stringify(x))) : col[c] || []), lire: async (c, id) => (c === "kv" ? kv.get(id) : null), ecrire: async (c, o) => { if (c === "kv") kv.set(o.id, JSON.parse(JSON.stringify(o))); } },
  ui: { afficherComposant: (vue, jeu, o) => { affiches.push({ vue, o, lignes: jeu.lignes.length, source: jeu.source.nom }); return { classList: { contains: () => false } }; } } });
const cat = creerCatalogue({ raccourcis: () => ({}) });
const T = (n) => cat.find((o) => o.nom === n);
const six = ["chercher_donnees", "lire_serie", "transformer_donnees", "afficher_module", "lire_modules", "enregistrer_module"];
ok(six.every((n) => T(n)), "les 6 outils sont dans le catalogue");
ok(controlerCatalogue(cat, OUTILS_VALIDES).ok, "tout le catalogue (45 outils) passe le contrôle de cohérence du registre");
ok(JSON.stringify(hotesDuCatalogue(cat)) === JSON.stringify(HOTES_DONNEES), "hôtes déclarés par les outils = liste fixe de donnees.js : " + hotesDuCatalogue(cat).join(", "));
ok(six.map((n) => fiche(T(n))).every((f) => f.parametres.length >= 0) && fiche(T("enregistrer_module")).lecture_seule === false && fiche(T("lire_serie")).monde_ouvert === true, "fiches lisibles (palette, labo)");
const niv = Object.fromEntries(six.map((n) => [n, T(n).niveau]));
ok(JSON.stringify(niv) === JSON.stringify({ chercher_donnees: "LIBRE", lire_serie: "LIBRE", transformer_donnees: "LIBRE", afficher_module: "LIBRE", lire_modules: "LIBRE", enregistrer_module: "CONFIRMATION" }), "niveaux : 5 LIBRE, enregistrer_module en CONFIRMATION");
const barriere = creerBarriere({ catalogue: cat, confirmer: async (dem) => { confirmations.push(dem); return reponseConf; }, delai: 200 });
const x = (nom, params) => barriere.executer({ outil: nom, params }, { origine: "modele" });

// ===== 4. « Le modèle passe des références, jamais des chiffres »
let r = await x("transformer_donnees", { jeu: "50000000", operation: "variation" });
ok(!r.ok && /format non valide/.test(r.erreur), "un chiffre à la place d'une référence est refusé : " + r.erreur);
r = await x("transformer_donnees", { jeu: "jeu:inconnu99", operation: "variation" });
ok(!r.ok && /Jeu inconnu/.test(r.erreur), "une référence inventée est refusée : " + r.erreur);
r = await x("afficher_module", { jeu: "jeu:inconnu99", vue: "courbe" });
ok(!r.ok && /Jeu inconnu/.test(r.erreur) && affiches.length === 0, "afficher_module refuse un jeu inconnu : rien n'est affiché");
r = await x("transformer_donnees", { jeu: "jeu:abcdef12", operation: "derniers", n: [1, 2, 3] });
ok(!r.ok, "une liste de nombres glissée dans un paramètre est refusée");
r = await x("lire_serie", { source: "dbnomics", identifiant: "INSEE/POP/V", valeurs: [1, 2, 3] });
ok(r.ok, "(lire_serie ignore un paramètre en trop non déclaré) mais n'a jamais de valeur à lui passer");
r = await x("lire_serie", { source: "dbnomics", identifiant: "INSEE/POP/V" });
ok(r.ok && RE_REF.test(r.donnees.jeu) && r.donnees.resume.colonnes[0].dernier.valeur === 85800, "lire_serie rend une référence et un résumé calculé par le hub : " + r.donnees.jeu);
const refA = r.donnees.jeu;
ok(!JSON.stringify(r.donnees).includes("85500") && JSON.stringify(r.donnees).includes("86000"), "les valeurs intermédiaires de la série ne sont pas dans la réponse donnée au modèle (seulement premier, dernier et extrêmes)");
const enc = encadrer("lire_serie", r.donnees); ok(/DONNÉES de l'outil lire_serie/.test(enc), "résultat encadré comme donnée");

// ===== 5. Transformations
const jeux = creerJeux(); const lu = (o) => jeux.deposer(o).jeu;
const A = lu({ titre: "A", unite: "habitants", colonnes: [{ id: "date", libelle: "Date", type: "date" }, { id: "valeur", libelle: "Population", type: "nombre" }], lignes: [["2000", 100], ["2001", 110], ["2002", null], ["2003", 121], ["2004", 0]], source: { nom: "Test", maj: "2026-10-01", periode: "2000 → 2004", licence: "LO" } });
const dernier = (b) => b.lignes[b.lignes.length - 1];
let b = transformer(A, { operation: "variation" }); ok(Math.abs(b.lignes[1][1] - 10) < 1e-9 && b.lignes[2][1] === null && b.lignes[3][1] === null && b.unite === "%", "variation % : 100→110 = 10 ; ligne après un manque = absente (jamais 0)");
b = transformer(A, { operation: "variation", mode: "depuis_debut" }); ok(b.lignes[0][1] === null && Math.abs(b.lignes[3][1] - 21) < 1e-9, "variation depuis le début : +21 %");
b = transformer(A, { operation: "indice100" }); ok(b.lignes[0][1] === 100 && Math.abs(b.lignes[1][1] - 110) < 1e-9 && b.unite === "indice base 100", "indice base 100");
b = transformer(A, { operation: "moyenne_mobile", n: 2 }); ok(b.lignes[1][1] === 105 && b.lignes[2][1] === null && b.lignes[0][1] === null, "moyenne mobile : fenêtre incomplète ou avec un manque = absente");
b = transformer(A, { operation: "derniers", n: 2 }); ok(b.lignes.length === 2 && b.lignes[0][0] === "2003", "derniers n");
b = transformer(A, { operation: "periode", debut: "2001", fin: "2002" }); ok(b.lignes.length === 2 && /2001/.test(b.source.periode), "période (années entières comprises)");
b = transformer(A, { operation: "colonnes", colonnes: ["valeur"] }); ok(b.colonnes.length === 2, "colonnes");
ok(/calculé par le hub/.test(transformer(A, { operation: "indice100" }).source.nom) && transformer(A, { operation: "indice100" }).source.maj === "2026-10-01" && transformer(A, { operation: "indice100" }).source.licence === "LO", "le résultat dit qu'il est calculé par le hub et garde date et licence de la source");
await leve(() => transformer(A, { operation: "supprimer" }), /opération inconnue/, "opération hors liste blanche refusée");
await leve(() => transformer(A, { operation: "periode" }), /début et\/ou une fin/, "période sans borne refusée");
await leve(() => transformer(A, { operation: "periode", debut: "2002", fin: "2000" }), /après la fin/, "période inversée refusée");
await leve(() => transformer(A, { operation: "periode", debut: "2000-02-30" }), /invalide/, "date impossible refusée");
await leve(() => transformer(A, { operation: "moyenne_mobile", n: 1 }), /fenêtre/, "fenêtre trop petite refusée");
await leve(() => transformer(A, { operation: "colonnes", colonnes: ["inexistante"] }), /absente/, "colonne inexistante refusée");
const Z = lu({ unite: "u", colonnes: [{ id: "date", libelle: "D", type: "date" }, { id: "v", libelle: "V", type: "nombre" }], lignes: [["2000", 0], ["2001", 5]], source: { nom: "Z", maj: "2026-10-01", periode: "2000" } });
await leve(() => transformer(Z, { operation: "indice100" }), /impossible/, "base 100 avec une première valeur nulle : refusée (pas de division par zéro)");
const SansDate = lu({ unite: "u", colonnes: [{ id: "v", libelle: "V", type: "nombre" }], lignes: [[1]], source: { nom: "S", maj: "2026-10-01", periode: "x" } });
await leve(() => transformer(SansDate, { operation: "variation" }), /pas de colonne de dates/, "jeu sans dates : opération impossible, dite clairement");
const B = lu({ titre: "B", unite: "habitants", colonnes: [{ id: "date", libelle: "Date", type: "date" }, { id: "valeur", libelle: "Pop", type: "nombre" }], lignes: [["2000", 50], ["2001", 60], ["2009", 1]], source: { nom: "Autre source", maj: "2026-10-05", periode: "x", licence: "CC" } });
b = transformer(A, { operation: "comparer" }, B); ok(b.lignes.length === 4 && b.colonnes.map((c) => c.id).join() === "date,serie,valeur" && b.source.maj === "2026-10-05" && /LO ; CC/.test(b.source.licence), "comparer : forme date / série / valeur sur les dates communes, deux sources et deux licences conservées");
await leve(() => transformer(A, { operation: "comparer" }, { ...B, unite: "euros" }), /unités différentes/, "comparer deux unités différentes : refusé, propose la base 100");
await leve(() => transformer(A, { operation: "comparer" }, null), /second jeu/, "comparer sans second jeu refusé");
const opts = optionsParDefaut("courbe", jeux.deposer(b).jeu); ok(opts.x === "date" && opts.y === "valeur" && opts.series === "serie", "courbe d'une comparaison : le hub choisit date, valeur et série");
await leve(async () => optionsParDefaut("courbe", jeux.deposer(transformer(A, { operation: "colonnes", colonnes: ["valeur"] })).jeu, { y: "date" }), /mauvais type/, "colonne de mauvais type refusée");

// ===== 6. Jeux en mémoire
const J = creerJeux(); for (let i = 0; i < 35; i++) J.deposer({ unite: "u", colonnes: [{ id: "v", libelle: "V", type: "nombre" }], lignes: [[i]], source: { nom: "S", maj: "2026-10-01", periode: "p" } });
ok(J.refs().length === 30, "30 jeux au plus en mémoire (les plus anciens partent)");
await leve(async () => J.deposer({ unite: "u", colonnes: [{ id: "v", libelle: "V", type: "nombre" }], lignes: [[1]] }), /source manquante/, "un jeu sans source n'entre pas en mémoire");
await leve(async () => J.lire("jeu:!!"), /invalide/, "référence mal formée refusée");

// ===== 7. Plans de 6 étapes par la barrière
ok(MAX_ETAPES === 6, "plans de 6 étapes");
ok(resoudreRefs({ jeu: "$1.jeu", n: 3, t: ["$2.jeu"] }, 3, [{ ok: true, donnees: { jeu: "jeu:aaaaaa11" } }, { ok: true, donnees: { jeu: "jeu:bbbbbb22" } }]).t[0] === "jeu:bbbbbb22", "« $N.jeu » remplacé par le résultat de l'étape N");
for (const [p, motif] of [["$1.jeu", /pas avant/], ["$3.jeu", /pas avant/], ["$9", /mal écrite/], ["$1.constructor.x", /mal écrite/], ["$1.inexistant", /ne renvoie pas/]]) {
  let m = ""; try { resoudreRefs({ jeu: p }, 1 + (p === "$1.jeu" ? 0 : 1), [{ ok: true, donnees: { jeu: "jeu:aaaaaa11" } }]); } catch (e) { m = e.message; } ok(motif.test(m), `référence « ${p} » refusée : ${m.slice(0, 60)}`);
}
let m2 = ""; try { resoudreRefs({ jeu: "$1.jeu" }, 2, [{ ok: false, erreur: "x" }]); } catch (e) { m2 = e.message; } ok(/n'a pas réussi/.test(m2), "référence vers une étape en échec refusée");
let tour = ""; const nb0 = appelsReseau.length;
const plan = [
  { nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/VERSAILLES" } },
  { nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/RENNES" } },
  { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "indice100" } },
  { nom: "transformer_donnees", params: { jeu: "$2.jeu", operation: "indice100" } },
  { nom: "transformer_donnees", params: { jeu: "$3.jeu", operation: "comparer", avec: "$4.jeu" } },
  { nom: "afficher_module", params: { jeu: "$5.jeu", vue: "courbe", titre: "Versailles et Rennes depuis 2000 (base 100)" } }
];
const suivi = []; let res = await executerPlan(plan, { barriere, origine: "modele", apres: (l, i) => suivi.push(i + 1) });
ok(res.length === 6 && res.every((l) => l.ok), "plan de 6 étapes (2 lectures, 3 transformations, 1 affichage) exécuté en un seul tour : " + res.map((l) => l.ok ? "✓" : "✗ " + l.erreur).join(" "));
ok(appelsReseau.length - nb0 === 2 && suivi.join() === "1,2,3,4,5,6", "2 appels réseau seulement ; suivi étape par étape");
ok(affiches.length === 1 && affiches[0].vue === "courbe" && affiches[0].o.series === "serie" && affiches[0].o.titre.startsWith("Versailles") && affiches[0].lignes === 8, "la courbe à deux séries est affichée avec le titre demandé (8 lignes = 4 dates × 2)");
const nombresDuPlan = (v) => (typeof v === "number" ? [v] : Array.isArray(v) ? v.flatMap(nombresDuPlan) : v && typeof v === "object" ? Object.values(v).flatMap(nombresDuPlan) : []);
ok(res.every((l) => nombresDuPlan(l.params || {}).length === 0), "aucun paramètre du plan ne contient de nombre : que des références et des mots");
const plan7 = [...plan, { nom: "heure", params: {} }]; const nbAff = affiches.length;
res = await executerPlan(plan7, { barriere, origine: "modele" }); ok(res.length === 7 && res[6].saute && /limité à 6/.test(res[6].erreur) && affiches.length === nbAff + 1, "une 7e étape est ignorée et dite ignorée");
res = await executerPlan([{ nom: "lire_serie", params: { source: "dbnomics", identifiant: "x" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "indice100" } }], { barriere });
ok(!res[0].ok && !res[1].ok && /Référence refusée/.test(res[1].erreur), "étape qui dépend d'une étape en échec : pas exécutée, erreur claire");
res = await executerPlan([{ nom: "supprimer_tout", params: {} }, { nom: "heure", params: {} }], { barriere });
ok(!res[0].ok && res[1].ok, "un outil inconnu est bloqué sans empêcher de juger l'étape suivante (journal par étape, comme avant)");

// ===== 8. Enregistrer un module : accord de Lucien obligatoire
const ref5 = (await x("lire_serie", { source: "dbnomics", identifiant: "INSEE/POP/V" })).donnees.jeu;
reponseConf = false; confirmations.length = 0;
r = await x("enregistrer_module", { id: "pop-versailles", titre: "Population de Versailles", vue: "courbe", jeu: ref5 });
ok(!r.ok && r.refus && ![...kv.keys()].some((k) => /^noyau-module/.test(k)) && confirmations.length === 1, "Lucien refuse : rien n'est enregistré");
ok(/Population de Versailles/.test(confirmations[0].resume) && /source : /.test(confirmations[0].resume) && /période : 2000/.test(confirmations[0].resume) && confirmations[0].niveau === "CONFIRMATION", "la demande d'accord montre le titre, la source, la période et la date des données : " + confirmations[0].resume.slice(0, 160));
reponseConf = true;
r = await x("enregistrer_module", { id: "pop-versailles", titre: "Population de Versailles", vue: "courbe", jeu: ref5 });
ok(r.ok && r.donnees.enregistre && kv.get("noyau-module-pop-versailles").versions.length === 1 && !kv.has("noyau-modules"), "Lucien accepte : module enregistré avec la copie de son jeu");
r = await x("lire_modules", {}); ok(r.ok && r.donnees.modules.length === 1 && r.donnees.modules[0].source && !JSON.stringify(r.donnees).includes("85800") && !JSON.stringify(r.donnees).includes("86000"), "lire_modules : liste sans aucune valeur chiffrée");
const nb1 = affiches.length; r = await x("afficher_module", { module: "pop-versailles", vue: "tableau" }); ok(r.ok && affiches.length === nb1 + 1 && affiches[nb1].vue === "tableau", "un module enregistré se réaffiche par son identifiant");
r = await x("afficher_module", { module: "n-existe-pas", vue: "courbe" }); ok(!r.ok && /Module inconnu/.test(r.erreur), "module inconnu refusé");
r = await x("afficher_module", { jeu: ref5, module: "pop-versailles", vue: "courbe" }); ok(!r.ok && /un seul/.test(r.erreur), "jeu ET module en même temps : refusé");
r = await x("enregistrer_module", { id: "Pas Valable", titre: "x", vue: "courbe", jeu: ref5 }); ok(!r.ok && /format non valide/.test(r.erreur), "identifiant de module invalide refusé");
r = await x("enregistrer_module", { id: "pop-versailles", titre: "Titre modifié", vue: "barres", jeu: ref5 }); ok(r.ok && r.donnees.remplace && kv.get("noyau-module-pop-versailles").versions.length === 2 && kv.get("noyau-module-pop-versailles").versions[1].titre === "Titre modifié" && [...kv.keys()].filter((k) => /^noyau-module-/.test(k)).length === 1, "même identifiant : nouvelle version, l'ancienne gardée, pas de doublon");
for (let i = 0; i < 55; i++) { r = await x("enregistrer_module", { id: "m-" + i, titre: "M", vue: "tableau", jeu: ref5 }); if (!r.ok) break; }
ok([...kv.keys()].filter((k) => /^noyau-module-/.test(k)).length === 50 && /50 modules au plus/.test(r.erreur), "50 modules au plus : le 21e est refusé, et il n'existe aucun outil pour en supprimer");
ok(!cat.some((o) => /supprimer|effacer|exporter|retirer/.test(o.nom) && /module/.test(o.nom + o.description)), "aucun outil de suppression ni d'export de module (gestes de Lucien seulement)");
const alteree = JSON.parse(JSON.stringify(kv.get("noyau-module-pop-versailles"))); alteree.versions[alteree.versions.length - 1].jeux.j1.lignes = [["2000", "pas un nombre"]];       // stockage altéré à la main, relu à l'ouverture suivante
const relu = creerModules({ stockage: { lire: async () => alteree, ecrire: async () => {} } });
await leve(() => relu.lire(alteree.module_id), /nombre attendu/, "un module altéré dans le stockage est refusé à la lecture (jeu re-vérifié), pas affiché");
const M = creerModules({ stockage: { lire: async () => null, ecrire: async () => {} } });
await leve(() => M.enregistrer({ id: "x1", titre: "t", vue: "courbe", jeu: { unite: "u", colonnes: [{ id: "v", libelle: "V", type: "nombre" }], lignes: [[1]] } }), /source manquante/, "un module sans source ne peut pas être enregistré");
await leve(() => M.enregistrer({ id: "x1", titre: "t", vue: "radar", jeu: A }), /Vue inconnue/, "vue hors liste refusée");

// ===== 9. Sortie non conforme, écran verrouillé, affichage sans fenêtre
ok(validerSortie({ jeu: "a" }, { type: "object", properties: { jeu: { type: "string" } }, required: ["jeu"] }) === null && /non conforme/.test(validerSortie({}, { type: "object", properties: { jeu: { type: "string" } }, required: ["jeu"] })), "sortie_schema : un résultat sans « jeu » est refusé");
const bidon = { nom: "lire_serie", niveau: "LIBRE", params: { type: "object", properties: {} }, sortie_schema: { type: "object", properties: { jeu: { type: "string" } }, required: ["jeu"] }, exec: async () => ({ autre: 1 }), resume: () => "x" };
const b2 = creerBarriere({ catalogue: [bidon] }); const rr = await b2.executer({ outil: "lire_serie", params: {} }); ok(!rr.ok && /non conforme/.test(rr.erreur), "la barrière refuse un résultat qui ne respecte pas son sortie_schema");
const sauve = (await import("../js/noyau/hote.js")).hote.ui.afficherComposant; (await import("../js/noyau/hote.js")).hote.ui.afficherComposant = undefined;
r = await x("afficher_module", { jeu: ref5, vue: "tableau" }); ok(!r.ok && /fenêtre du Noyau n'est pas ouverte/.test(r.erreur), "pas de fenêtre du Noyau : dit que rien n'a été affiché");
(await import("../js/noyau/hote.js")).hote.ui.afficherComposant = () => ({ classList: { contains: (c) => c === "nxc-refus" }, getAttribute: () => "Affichage refusé : source manquante" });
r = await x("afficher_module", { jeu: ref5, vue: "tableau" }); ok(!r.ok && /Affichage refusé/.test(r.erreur), "refus du composant remonté au modèle, jamais un graphique sans source");
(await import("../js/noyau/hote.js")).hote.ui.afficherComposant = sauve;

console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
