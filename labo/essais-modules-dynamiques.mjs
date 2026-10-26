// Laboratoire · modules dynamiques et versions (orchestrateur, lots 5 et 9) : `node labo/essais-modules-dynamiques.mjs`
// Spécification de module v1 (refus, calculs vérifiés à la main), stockage `kv/noyau-module-<id>` (versions, 50 modules, ancien format), gestes de Lucien.
import { readFileSync } from "node:fs";
import { verifierSpec, appliquerSpec, figerSpec, avecVue, avecPeriode, differenceSpec, RefusSpec } from "../js/noyau/modules/spec.js";
import { verifierJeu } from "../js/noyau/modules/composants.js";
import { optionsParDefaut, creerModules } from "../js/noyau/modules.js";
import { creerStockageModules, MAX_MODULES, MAX_VERSIONS } from "../js/noyau/modules/stockage.js";
import { creerGestesLucien } from "../js/noyau/modules/gestes-lucien.js";
import { creerJeux } from "../js/noyau/jeux.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const leve = async (f, re, m) => { try { await f(); ko++; console.log("✗ " + m + " (aucune erreur)"); } catch (e) { if (re.test(e.message)) console.log("✓ " + m); else { ko++; console.log("✗ " + m + " : " + e.message); } } };

const jeu = (extra = {}) => verifierJeu({ titre: "Population", unite: "habitants", colonnes: [{ id: "date", libelle: "Date", type: "date" }, { id: "valeur", libelle: "Population", type: "nombre" }],
  lignes: [["2000-01", 10], ["2000-07", 20], ["2001-01", 30], ["2001-07", null], ["2002-01", 50]], source: { nom: "Test · FR/POP", maj: "2026-10-01", periode: "2000-01 → 2002-01", licence: "LO", url: "https://example.org/x", requete: "2026-10-20", verifie: true }, ...extra });
const J = jeu();
const base = { v: 1, titre: "Population de la France", jeux: ["jeu:abcdef12"], transformations: [], vues: [{ type: "courbe" }] };
const refus = (spec, re, m) => leve(async () => verifierSpec(spec), re, m);

// ===== 1. Validateur strict
ok(verifierSpec(base).titre === "Population de la France", "une spécification minimale est acceptée");
await refus({ ...base, extra: 1 }, /champ inconnu « extra »/, "champ inconnu refusé");
await refus({ ...base, v: 2 }, /version 1 seulement/, "version inconnue refusée");
await refus({ ...base, titre: "Voir https://evil.example" }, /ni balise ni adresse/, "adresse dans le titre refusée");
await refus({ ...base, titre: "<b>x</b>" }, /ni balise ni adresse/, "balise dans le titre refusée");
await refus({ ...base, titre: "x".repeat(81) }, /trop long/, "titre trop long refusé");
await refus({ ...base, jeux: ["85000"] }, /jeu invalide/, "un nombre à la place d'une référence est refusé (aucun chiffre ne vient du modèle)");
await refus({ ...base, jeux: [] }, /de 1 à 3/, "au moins un jeu");
await refus({ ...base, jeux: ["jeu:abcdef12", "jeu:abcdef12"] }, /deux fois/, "jeu cité deux fois refusé");
await refus({ ...base, vues: [{ type: "camembert" }] }, /type inconnu/, "type de vue hors liste refusé");
await refus({ ...base, vues: [{ type: "courbe", pied_de_sources: false }] }, /champ inconnu « pied_de_sources »/, "impossible de retirer le pied de sources (champ inconnu)");
await refus({ ...base, vues: [{ type: "courbe", x: "date; drop" }] }, /identifiant de colonne invalide/, "identifiant de colonne piégé refusé");
await refus({ ...base, vues: [] }, /de 1 à 3/, "au moins une vue");
await refus({ ...base, transformations: [{ op: "eval", code: "1" }] }, /opération inconnue/, "opération hors liste blanche refusée");
await refus({ ...base, transformations: [{ op: "filtrer", champ: "date" }] }, /demande min, max/, "filtrer sans condition refusé");
await refus({ ...base, transformations: [{ op: "limiter", n: 100000 }] }, /entier de 1 à 500/, "limiter hors bornes refusé");
await refus({ ...base, transformations: [{ op: "agreger", par: "annee", fonction: "mediane", colonne: "valeur" }] }, /fonction/, "fonction d'agrégation hors liste refusée");
await refus({ ...base, transformations: [{ op: "comparer", avec: 1 }] }, /n'existe pas dans « jeux »/, "comparer avec un jeu absent refusé");
await refus({ ...base, transformations: Array(7).fill({ op: "limiter", n: 3 }) }, /6 transformations au plus/, "6 transformations au plus");
await refus({ ...base, filtres: [{ champ: "geo", type: "liste" }] }, /champ inconnu « filtres »/, "« filtres » pas encore permis (écart noté au plan)");

// ===== 2. Calculs faits par le hub, vérifiés à la main
const lire = () => J, opt = optionsParDefaut;
const appl = (tr, vues = [{ type: "tableau" }]) => appliquerSpec({ ...base, transformations: tr, vues }, lire, opt);
let r = appl([{ op: "agreger", par: "annee", fonction: "somme", colonne: "valeur" }]);
ok(r.jeu.lignes.length === 3 && r.jeu.lignes[0][1] === 30 && r.jeu.lignes[1][1] === 30 && r.jeu.lignes[2][1] === 50, "agréger par année (somme) : 2000 = 10+20 = 30 ; 2001 = 30 (le manque n'est pas compté comme 0) ; 2002 = 50");
r = appl([{ op: "agreger", par: "annee", fonction: "moyenne", colonne: "valeur" }]); ok(r.jeu.lignes[0][1] === 15 && r.jeu.lignes[1][1] === 30, "moyenne par année : 15 et 30 (le manque ne tire pas la moyenne vers 0)");
r = appl([{ op: "agreger", par: "annee", fonction: "max", colonne: "valeur" }]); ok(r.jeu.lignes[0][1] === 20, "maximum par année");
ok(/calculé par le hub/.test(r.jeu.source.nom) && r.jeu.source.maj === "2026-10-01" && r.jeu.source.licence === "LO", "le résultat garde la source, la date des données et la licence, et dit qu'il est calculé par le hub");
r = appl([{ op: "filtrer", champ: "date", min: "2001", max: "2001" }]); ok(r.jeu.lignes.length === 2, "filtrer une plage de dates (2001 entière)");
r = appl([{ op: "filtrer", champ: "valeur", min: 25 }]); ok(r.jeu.lignes.length === 2 && r.jeu.lignes.every((l) => l[1] >= 25), "filtrer un nombre minimum (les valeurs absentes sont écartées, pas comptées 0)");
await leve(async () => appl([{ op: "filtrer", champ: "valeur", min: 1000 }]), /aucune ligne ne reste/, "filtre qui ne laisse rien : refus clair, rien n'est affiché");
await leve(async () => appl([{ op: "filtrer", champ: "date", min: 5 }]), /dates/, "filtrer une date avec un nombre refusé");
r = appl([{ op: "trier", champ: "valeur", ordre: "decroissant" }]); ok(r.jeu.lignes[0][1] === 50 && r.jeu.lignes[3][1] === 10 && r.jeu.lignes[4][1] === null, "trier décroissant : le plus grand d'abord, la valeur absente à la fin");
r = appl([{ op: "limiter", n: 2, depuis: "debut" }]); ok(r.jeu.lignes.length === 2 && r.jeu.lignes[0][0] === "2000-01", "limiter aux 2 premières lignes");
r = appl([{ op: "limiter", n: 2 }]); ok(r.jeu.lignes.length === 2 && r.jeu.lignes[1][0] === "2002-01", "limiter aux 2 dernières lignes");
r = appl([{ op: "variation", mode: "depuis_debut" }]); ok(r.jeu.lignes[1][1] === 100 && r.jeu.lignes[4][1] === 400, "variation depuis le début : +100 % et +400 %");
r = appl([{ op: "periode", debut: "2001", fin: "2002" }, { op: "garder_colonnes", colonnes: ["valeur"] }]); ok(r.jeu.lignes.length === 3 && r.jeu.colonnes.length === 2, "deux transformations enchaînées (période puis colonnes)");
await leve(async () => appl([{ op: "garder_colonnes", colonnes: ["inconnue"] }]), /absente/, "colonne inexistante : refus clair (jamais une colonne inventée)");
r = appliquerSpec({ ...base, jeux: ["jeu:abcdef12", "jeu:fedcba21"], transformations: [{ op: "comparer", avec: 1 }], vues: [{ type: "courbe" }] }, (ref) => (ref === "jeu:abcdef12" ? J : jeu({ titre: "Autre", lignes: [["2000-01", 1], ["2001-01", 2], ["2009-01", 9]] })), opt);
ok(r.jeu.lignes.length === 4 && r.vues[0].options.series === "serie", "comparer deux jeux : dates communes, courbe à deux séries");
r = appl([], [{ type: "courbe" }, { type: "tableau" }, { type: "chiffre_cle" }]); ok(r.vues.length === 3 && r.vues[0].options.x === "date" && r.vues[2].options.valeur === "valeur", "3 vues du même jeu, colonnes choisies par le hub");
await leve(async () => appliquerSpec(base, () => { throw new Error("Jeu inconnu : « jeu:abcdef12 »."); }, opt), /Jeu inconnu/, "référence inconnue : refus, jamais un jeu par défaut");

// ===== 3. Modifier une spécification
const s2 = avecVue({ ...base, vues: [{ type: "courbe", x: "date" }] }, "barres"); ok(s2.vues[0].type === "barres" && s2.vues[0].x === undefined, "« change en barres » : nouvelle spécification, colonnes remises au choix du hub");
const s3 = avecPeriode(base, "2010", "2024"); ok(s3.transformations[0].op === "periode" && s3.transformations[0].debut === "2010", "« garde 2010-2024 » : transformation de période ajoutée");
const s4 = avecPeriode(s3, "2015", null); ok(s4.transformations.filter((o) => o.op === "periode").length === 1 && s4.transformations[0].debut === "2015", "une nouvelle période remplace l'ancienne");
const d = differenceSpec(base, s3); ok(d.length === 1 && /ajouté : periode/.test(d[0]), "la différence est lisible : " + d.join(" ; "));
ok(differenceSpec(base, avecVue(base, "barres")).some((x) => /vues : courbe → barres/.test(x)), "différence de vue lisible");
ok(differenceSpec(base, base).length === 0, "deux spécifications identiques : aucune différence");
const f = figerSpec({ ...base, jeux: ["jeu:abcdef12", "jeu:fedcba21"] }); ok(f.spec.jeux.join() === "j1,j2" && f.refs.j2 === "jeu:fedcba21", "figer : les références deviennent des emplacements j1, j2");

// ===== 4. Stockage : versions, copies, limites
const kv = new Map(); let ecritures = 0;
const stockage = { tout: async (c) => (c === "kv" ? [...kv.values()].map((x) => structuredClone(x)) : []), lire: async (c, id) => (c === "kv" && kv.has(id) ? structuredClone(kv.get(id)) : undefined), ecrire: async (c, o) => { ecritures++; kv.set(o.id, structuredClone(o)); }, retirerMany: async (c, ids) => ids.forEach((i) => kv.delete(i)) };
let t = new Date("2026-10-26T10:00:00Z"); const maintenant = () => t;
const M = creerModules({ stockage, maintenant });
let e = await M.enregistrer({ id: "pop-france", titre: "Population", vue: "courbe", jeu: J });
ok(e.version === 1 && !e.remplace && kv.has("noyau-module-pop-france") && !kv.has("noyau-modules"), "1er enregistrement : document `noyau-module-pop-france`, version 1");
const doc1 = kv.get("noyau-module-pop-france"); ok(doc1.versions[0].spec.jeux[0] === "j1" && doc1.versions[0].jeux.j1.source.nom === "Test · FR/POP" && !JSON.stringify(doc1.versions[0].spec).includes("jeu:"), "la spécification ne contient que des emplacements ; la copie vérifiée du jeu est à côté, avec sa source");
for (let i = 2; i <= 4; i++) { t = new Date(t.getTime() + 86400000); e = await M.enregistrer({ id: "pop-france", titre: "Population v" + i, vue: i % 2 ? "barres" : "courbe", jeu: J }); }
const doc4 = kv.get("noyau-module-pop-france"); ok(doc4.versions.length === 4 && e.version === 4 && e.remplace, "4 versions gardées, la dernière est la courante");
ok(doc4.versions[0].jeux === null && doc4.versions[1].jeux === null && doc4.versions[2].jeux && doc4.versions[3].jeux, "les données ne sont gardées que pour la courante et la précédente (la synchronisation reste petite)");
const vs = await M.versions("pop-france"); ok(vs.length === 4 && vs[3].courante && !vs[0].donnees_gardees && vs[2].donnees_gardees, "versions() : liste sans données");
await leve(() => M.lire("pop-france", { version: 1 }), /ne sont plus gardées/, "ouvrir une version trop ancienne : dit que ses données ne sont plus gardées");
const l3 = await M.lire("pop-france", { version: 3 }); ok(l3.titre === "Population v3" && l3.jeu.lignes.length === 5, "ouvrir la version précédente");
for (let i = 5; i <= 14; i++) await M.enregistrer({ id: "pop-france", titre: "v" + i, vue: "courbe", jeu: J });
ok(kv.get("noyau-module-pop-france").versions.length === MAX_VERSIONS && kv.get("noyau-module-pop-france").versions[0].n === 5, MAX_VERSIONS + " versions au plus : les plus anciennes partent d'elles-mêmes (la numérotation continue)");
const taille = JSON.stringify(kv.get("noyau-module-pop-france")).length; ok(taille < 40000, "document synchronisé borné (" + taille + " octets pour 10 versions)");
const liste = await M.lister(); ok(liste.length === 1 && liste[0].version === 14 && liste[0].versions === 10 && !JSON.stringify(liste).includes("\"lignes\""), "lister : un résumé par module, sans aucune valeur chiffrée");
// 50 modules
for (let i = 0; i < 49; i++) await M.enregistrer({ id: "m-" + i, titre: "M", vue: "tableau", jeu: J });
ok((await M.lister()).length === MAX_MODULES, MAX_MODULES + " modules atteints");
await leve(() => M.enregistrer({ id: "de-trop", titre: "M", vue: "tableau", jeu: J }), /50 modules au plus/, "le 51e est refusé (Lucien doit en retirer un lui-même)");
ok((await M.enregistrer({ id: "m-3", titre: "M3", vue: "tableau", jeu: J })).remplace, "remplacer un module existant reste possible à 50");
// données trop grosses
const gros = verifierJeu({ unite: "u", colonnes: [{ id: "date", libelle: "D", type: "date" }, { id: "valeur", libelle: "V", type: "nombre" }], lignes: Array.from({ length: 20000 }, (_, i) => [`${1000 + (i % 9000)}`, i * 1.123456789]), source: { nom: "S", maj: "2026-10-01", periode: "x" } });
await leve(() => M.enregistrer({ id: "gros", titre: "G", vue: "tableau", jeu: gros }), /trop volumineux/, "une copie de plus de 250 Ko est refusée");
await leve(() => M.enregistrer({ id: "Mauvais Id", titre: "x", vue: "courbe", jeu: J }), /Identifiant/, "identifiant invalide refusé");
// Spec complète : 2 jeux + comparaison
const J2 = jeu({ titre: "Autre", lignes: [["2000-01", 1], ["2001-01", 2], ["2002-01", 3], ["2000-07", 4], ["2001-07", 5]] });
const refs = { "jeu:abcdef12": J, "jeu:fedcba21": J2 };
e = await M.enregistrerSpec({ id: "comparaison", spec: { v: 1, titre: "Comparaison", jeux: ["jeu:abcdef12", "jeu:fedcba21"], transformations: [{ op: "comparer", avec: 1 }], vues: [{ type: "courbe" }, { type: "tableau" }] }, jeu: (x) => refs[x] }).catch((x) => ({ erreur: x.message }));
ok(e.id === "comparaison" || /50 modules/.test(e.erreur || ""), "spécification à deux jeux, deux vues : " + (e.erreur || "enregistrée"));
await M.enregistrerSpec({ id: "m-3", spec: { v: 1, titre: "Comparaison", jeux: ["jeu:abcdef12", "jeu:fedcba21"], transformations: [{ op: "comparer", avec: 1 }], vues: [{ type: "courbe" }, { type: "tableau" }] }, jeu: (x) => refs[x] });
const comp = await M.lire("m-3"); ok(comp.vues.length === 2 && comp.jeu.colonnes.some((c) => c.id === "serie") && comp.vue === "courbe", "relue : 2 vues, jeu comparé recalculé à partir des copies");
// Altération
const sain = structuredClone(kv.get("noyau-module-m-3")); const alt = structuredClone(sain); alt.versions[alt.versions.length - 1].jeux.j1.lignes = [["2000", "pas un nombre"]]; kv.set("noyau-module-m-3", alt);
await leve(() => M.lire("m-3"), /nombre attendu/, "stockage altéré : refusé à la lecture, pas affiché");
const alt2 = structuredClone(sain); alt2.versions[alt2.versions.length - 1].spec.vues = [{ type: "camembert" }]; kv.set("noyau-module-m-3", alt2);
await leve(() => M.lire("m-3"), /type inconnu/, "spécification altérée : refusée à la lecture");

// ===== 5. Ancien format (lot 3) : lu sans être modifié
kv.clear(); const ancienne = { id: "noyau-modules", lignes: [{ id: "vieux", titre: "Ancien module", vue: "courbe", options: { x: "date", y: "valeur" }, jeu: { titre: J.titre, unite: J.unite, colonnes: J.colonnes.map((c) => ({ id: c.id, libelle: c.libelle, type: c.type })), lignes: J.lignes, source: J.source, exemple: false }, cree_le: "2026-10-20", modifie_le: null }] };
kv.set("noyau-modules", structuredClone(ancienne)); ecritures = 0;
const M2 = creerModules({ stockage, maintenant });
ok((await M2.lister()).length === 1 && (await M2.lister())[0].ancien_format === true, "ancien module du lot 3 listé");
const lv = await M2.lire("vieux"); ok(lv.jeu.lignes.length === 5 && lv.vues[0].type === "courbe" && ecritures === 0, "ancien module relu et affichable ; aucune écriture");
e = await M2.enregistrer({ id: "vieux", titre: "Ancien module (suite)", vue: "barres", jeu: J });
ok(e.version === 2 && JSON.stringify(kv.get("noyau-modules")) === JSON.stringify(ancienne), "réenregistré : devient la version 2 du nouveau format, l'ancien document n'est PAS modifié");
ok((await M2.lister()).length === 1 && (await M2.versions("vieux")).length === 2, "pas de doublon : un seul module, 2 versions (l'ancien contenu est la version 1)");
ok((await M2.lire("vieux", { version: 1 })).titre === "Ancien module", "l'ancienne version reste consultable");

// ===== 6. Gestes de Lucien
kv.clear(); const M3 = creerModules({ stockage, maintenant }); const jeux = creerJeux();
for (const v of [1, 2, 3]) await M3.enregistrer({ id: "pop", titre: "Pop v" + v, vue: "courbe", jeu: J });
const G = creerGestesLucien({ stockage, modules: M3, maintenant });
let rr = await G.restaurerVersion("pop", 2); ok(rr.version === 4 && (await M3.lire("pop")).titre === "Pop v2", "restaurer la version 2 = une NOUVELLE version 4 (rien n'est perdu)");
await leve(() => G.restaurerVersion("pop", 1), /ne sont plus gardées/, "restaurer une version sans données : refus clair");
const exp = await G.exporterModule("pop"); ok(exp.format === "hub-noyau-module" && exp.module.versions.length === 4, "export : le module complet en JSON (geste de Lucien)");
rr = await G.retirerModule("pop"); ok(!kv.has("noyau-module-pop") && kv.has("noyau-corbeille-pop"), "retirer : sauvegarde AVANT dans `noyau-corbeille-pop`, puis le module disparaît");
ok((await M3.lister()).length === 0, "le module n'est plus listé");
await G.restaurerCorbeille("pop"); ok((await M3.lire("pop")).titre === "Pop v2", "restaurer depuis la corbeille");
const copieExp = JSON.parse(JSON.stringify(exp));
await leve(() => G.importerModule(copieExp), /existe déjà/, "importer un module qui existe : refus sans confirmation");
rr = await G.importerModule(copieExp, { remplacer: true }); ok(rr.remplace && kv.has("noyau-corbeille-pop"), "importer avec confirmation : remplace, l'ancien est mis à la corbeille");
const pirate = JSON.parse(JSON.stringify(exp)); pirate.module.versions[3].jeux.j1.lignes[0][1] = "x"; await leve(() => G.importerModule(pirate, { remplacer: true }), /nombre attendu/, "import d'un fichier altéré : refusé (jeu re-vérifié)");
const pirate2 = JSON.parse(JSON.stringify(exp)); pirate2.module.versions[3].spec.vues[0].type = "script"; await leve(() => G.importerModule(pirate2, { remplacer: true }), /type inconnu/, "import d'une spécification piégée : refusée");
await leve(() => G.importerModule({ format: "autre" }), /pas un module/, "import d'un autre fichier : refusé");
// actualiser
const donnees = { lire: async ({ source, identifiant }) => ({ jeu: jeu({ lignes: [["2000-01", 11], ["2001-01", 31], ["2002-01", 51], ["2003-01", 61], ["2003-07", 71]], source: { nom: "Test · FR/POP", maj: "2026-10-25", periode: "2000-01 → 2003-07", verifie: true, requete: "2026-10-26" } }) }) };
const prov = { racine: { source: "dbnomics", identifiant: "INSEE/POP/V", debut: "", fin: "" }, etapes: [{ operation: "periode", debut: "2001" }], reconstructible: true };
await M3.enregistrer({ id: "act", titre: "Actualisable", vue: "courbe", jeu: J, provenance: prov });
const Ga = creerGestesLucien({ stockage, modules: M3, donnees, jeux, maintenant });
rr = await Ga.actualiserModule("act"); const la = await M3.lire("act"); ok(rr.version === 2 && la.jeu.lignes.length === 4 && la.jeu.lignes[0][0] === "2001-01" && la.jeu.source.maj === "2026-10-25", "actualiser : relit la série, refait la période, nouvelle version avec la date de la nouvelle donnée");
await M3.enregistrer({ id: "sans-prov", titre: "x", vue: "courbe", jeu: J });
await leve(() => Ga.actualiserModule("sans-prov"), /ne peut pas être actualisé/, "sans provenance rejouable : refus clair");

// ===== 7. Le Noyau n'a aucun chemin vers suppression, export ni gestes
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
for (const f of ["../js/noyau/outils.js", "../js/noyau/barriere.js", "../js/noyau/boucle.js", "../js/noyau/modules.js", "../js/noyau/modules/stockage.js", "../js/noyau/sessions.js", "../js/noyau/espaces.js", "../js/noyau/cache-jeux.js"]) {
  const s = src(f).replace(/\/\/.*$/gm, "");
  ok(!/gestes-lucien/.test(s) && !/retirerMany|delMany/.test(s), `${f.split("/").pop()} : n'importe pas les gestes de Lucien et ne retire rien du stockage`);
}
const { creerCatalogue } = await import("../js/noyau/outils.js");
const cat = creerCatalogue({});
ok(cat.length === 45 && !cat.some((o) => /supprimer|effacer|retirer|exporter|importer|restaurer|actualiser/.test(o.nom)), "toujours 45 outils, aucun de suppression, d'export, de restauration ni d'actualisation");
ok(cat.find((o) => o.nom === "enregistrer_module").niveau === "CONFIRMATION" && cat.find((o) => o.nom === "lire_modules").niveau === "LIBRE" && cat.find((o) => o.nom === "afficher_module").niveau === "LIBRE", "niveaux inchangés : enregistrer_module CONFIRMATION, lire_modules et afficher_module LIBRE");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
