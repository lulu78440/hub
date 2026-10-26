// Laboratoire · fraîcheur des sources, jeu de panneaux à plage et variables partagées, graphe de plan (lot 4) : `node labo/essais-panneaux.mjs`
// DOM simulé, aucune bibliothèque, aucun réseau. Toute écriture HTML en texte ferait échouer l'essai.
import { installer, compteurHTML } from "./faux-dom.js";
installer();
const F = await import("../js/noyau/modules/fraicheur.js");
const C = await import("../js/noyau/modules/composants.js");
const P = await import("../js/noyau/panneaux.js");
const G = await import("../js/noyau/modules/plan-graphe.js");
const V = await import("../js/noyau/modules/vues-orch.js");
const { creerJeux } = await import("../js/noyau/jeux.js");
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const leve = (f, re, m) => { try { f(); ko++; console.log("✗ " + m + " (accepté à tort)"); } catch (e) { ok(re.test(e.message), m + " → " + e.message.slice(0, 90)); } };
const NOW = new Date("2026-10-26T12:00:00Z");

// ----- jeux d'essai
const brut = (dates, vals, { maj = "2026-10-20", nom = "Source d'essai", exemple = false, cols = null } = {}) => ({ titre: "Essai", unite: "habitants",
  colonnes: [{ id: "date", libelle: "Date", type: "date" }, ...(cols || [{ id: "versailles", libelle: "Versailles" }, { id: "rennes", libelle: "Rennes" }]).map((c) => ({ ...c, type: "nombre" }))],
  lignes: dates.map((d, i) => [d, ...vals(i)]), source: { nom, maj, periode: `${dates[0]} → ${dates[dates.length - 1]}`, licence: "Licence Ouverte", requete: "2026-10-26" }, exemple });
const jeu = (...a) => C.verifierJeu(brut(...a));
const annees = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
const mois = (a, m0, n) => Array.from({ length: n }, (_, i) => { const t = new Date(Date.UTC(a, m0 - 1 + i, 1)); return t.toISOString().slice(0, 7); });

// ===== 1. Fraîcheur d'un jeu
ok(F.ageTexte(10_000) === "à l'instant" && F.ageTexte(5 * 60000) === "il y a 5 min" && F.ageTexte(3 * 3600000) === "il y a 3 heures" && F.ageTexte(86400000) === "il y a 1 jour" && F.ageTexte(6 * 86400000) === "il y a 6 jours" && F.ageTexte(120 * 86400000) === "il y a 4 mois" && F.ageTexte(800 * 86400000) === "il y a 2 ans", "âges en français, au pluriel quand il faut");
ok(F.ageTexte(NaN) === "date inconnue" && F.ageTexte(-5 * 86400000) === "date dans le futur", "date illisible ou future : dite telle quelle");
ok(F.dateMs("2024-02-30") === null && F.dateMs("2024-13") === null && F.dateMs("n'importe quoi") === null && F.dateMs("2024") === Date.UTC(2024, 0, 1) && F.finDePeriode("2024") === Date.UTC(2025, 0, 1) && F.finDePeriode("2024-12") === Date.UTC(2025, 0, 1), "dates : inexistantes refusées, fin de période exacte");
ok(F.cadenceSerie(annees(2000, 2010)).nom === "annuelle" && F.cadenceSerie(mois(2020, 1, 12)).nom === "mensuelle" && F.cadenceSerie(["2020-01", "2020-04", "2020-07", "2020-10"]).nom === "trimestrielle" && F.cadenceSerie(["2020", "2021"]) === null, "rythme d'une série : annuel, mensuel, trimestriel ; moins de 3 dates = inconnu");
let f = F.evaluerFraicheur(jeu(annees(2000, 2025), (i) => [i, i]), { maintenant: NOW });
ok(f.niveau === "a_jour" && f.cadence === "annuelle" && f.derniere_donnee === "2025" && /Mis à jour il y a 7 jours/.test(f.resume), "série annuelle arrêtée en 2025, vue en octobre 2026 : À JOUR (" + f.resume + ")");
f = F.evaluerFraicheur(jeu(annees(2000, 2022), (i) => [i, i], { maj: "2025-07-01" }), { maintenant: NOW });
ok(f.niveau === "ancien" && /rythme/.test(f.retard_texte), "série annuelle arrêtée en 2022 : ANCIENNE (" + f.retard_texte + ")");
f = F.evaluerFraicheur(jeu(annees(2000, 2024), (i) => [i, i], { maj: "2025-07-01" }), { maintenant: NOW });
ok(f.niveau === "en_retard", "série annuelle arrêtée en 2024 : EN RETARD");
f = F.evaluerFraicheur(jeu(mois(2024, 1, 33), (i) => [i, i], { maj: "2026-10-20" }), { maintenant: NOW });
ok(f.niveau === "a_jour" && f.cadence === "mensuelle", "série mensuelle jusqu'en septembre 2026 : à jour");
f = F.evaluerFraicheur(jeu(mois(2023, 1, 24), (i) => [i, i], { maj: "2026-10-20" }), { maintenant: NOW });
ok(f.niveau === "ancien", "série mensuelle qui s'arrête fin 2024 alors que la source dit « mise à jour il y a 6 jours » : ANCIENNE (on juge aussi la dernière donnée, pas seulement la date de la source)");
f = F.evaluerFraicheur(jeu(["2026-10-01"], () => [1, 2], { maj: "2026-10-24" }), { maintenant: NOW }); ok(f.niveau === "a_jour" && f.cadence === null, "un seul point, mis à jour il y a 2 jours : à jour (règle 7 jours)");
f = F.evaluerFraicheur(jeu(["2026-10-01"], () => [1, 2], { maj: "2026-08-01" }), { maintenant: NOW }); ok(f.niveau === "en_retard", "un seul point, 3 mois : en retard");
f = F.evaluerFraicheur(jeu(["2026-10-01"], () => [1, 2], { maj: "2025-01-01" }), { maintenant: NOW }); ok(f.niveau === "ancien", "un seul point, 21 mois : ancien");
f = F.evaluerFraicheur(jeu(mois(2026, 1, 9), (i) => [i, i], { nom: "DBnomics · A/B/C · mise à jour de la source inconnue (date de la requête)", maj: "2026-10-26" }), { maintenant: NOW });
ok(f.maj_inconnue && /inconnue/.test(f.resume) && !/Mis à jour il y a/.test(f.resume) && f.niveau === "a_jour", "mise à jour inconnue : dit « inconnue » (jamais présentée comme fraîche), jugé sur la dernière donnée seule");
f = F.evaluerFraicheur(jeu(["2026-10-01"], () => [1, 2], { nom: "X · mise à jour de la source inconnue", maj: "2026-10-26" }), { maintenant: NOW }); ok(f.niveau === "inconnu" && f.libelle === "Fraîcheur inconnue", "ni rythme ni mise à jour : « fraîcheur inconnue » plutôt qu'un faux « à jour »");
ok(((m) => { try { jeu(["2026-10-01"], () => [1, 2], { maj: "2027-03-01" }); return false; } catch (e) { return /futur/.test(e.message); } })(), "le schéma des jeux refuse déjà une mise à jour datée du futur");
f = F.evaluerFraicheur({ colonnes: [{ id: "d", type: "date" }, { id: "v", type: "nombre" }], lignes: [["2026-10-01", 1]], source: { nom: "X", maj: "2027-03-01" } }, { maintenant: NOW }); ok(f.maj_futur && /futur/.test(f.resume) && f.niveau === "inconnu", "mise à jour datée du futur : signalée, pas prise pour fraîche");
f = F.evaluerFraicheur(jeu(annees(2000, 2025), (i) => [i, i], { exemple: true }), { maintenant: NOW }); ok(f.niveau === "exemple" && /factices/.test(f.resume), "jeu d'exemple : dit factice");
f = F.evaluerFraicheur(jeu(annees(2000, 2025), (i) => [null, null]), { maintenant: NOW }); ok(f.derniere_donnee === null, "des lignes sans aucune valeur ne comptent pas comme « dernière donnée »");
f = F.evaluerFraicheur(jeu(annees(2000, 2025), (i) => [i, i]), { maintenant: NOW, chargeMs: NOW.getTime() - 180000 }); ok(/chargé il y a 3 min dans cette page/.test(f.charge_texte), "âge du chargement en mémoire de la page");
ok(F.pireNiveau(["a_jour", "ancien", "en_retard"]) === "ancien" && F.pireNiveau(["a_jour", "inconnu"]) === "inconnu" && F.pireNiveau(["exemple"]) === "exemple" && F.pireNiveau([]) === "inconnu", "le moins frais d'une liste");
ok(Object.values(F.NIVEAUX).every((n) => n.libelle.length > 3 && n.glyphe.length >= 1) && new Set(Object.values(F.NIVEAUX).map((n) => n.glyphe)).size === 5, "chaque niveau a un mot ET une forme propre (la couleur ne porte jamais seule le sens)");

// ===== 2. État d'une source
const E = (x = {}) => ({ id: "dbnomics", nom: "DBnomics", hote: "api.db.nomics.world", coupee: false, dernier_ok: null, derniere_erreur: null, erreur: null, derniere_maj: null, ...x });
let sv = F.evaluerSource(E(), { maintenant: NOW }); ok(sv.niveau === "inactive" && /aucune requête/.test(sv.lignes.join()), "source jamais appelée : « pas encore appelée »");
sv = F.evaluerSource(E({ dernier_ok: "2026-10-26T11:55:00Z", derniere_maj: "2026-10-20" }), { maintenant: NOW }); ok(sv.niveau === "ok" && /il y a 5 min/.test(sv.lignes[0]) && /2026-10-20/.test(sv.lignes[1]), "source qui répond : âge de la dernière réponse et de la dernière donnée");
sv = F.evaluerSource(E({ dernier_ok: "2026-10-26T10:00:00Z", derniere_erreur: "2026-10-26T11:00:00Z", erreur: "injoignable" }), { maintenant: NOW }); ok(sv.niveau === "erreur" && /injoignable/.test(sv.lignes.join()), "dernière tentative en échec après un succès : EN ÉCHEC avec la raison");
sv = F.evaluerSource(E({ dernier_ok: "2026-10-26T11:00:00Z", derniere_erreur: "2026-10-26T10:00:00Z", erreur: null }), { maintenant: NOW }); ok(sv.niveau === "ok", "échec ancien suivi d'un succès : répond");
sv = F.evaluerSource(E({ coupee: true, dernier_ok: "2026-10-26T11:00:00Z" }), { maintenant: NOW }); ok(sv.niveau === "coupee", "source coupée par Lucien : le dit");

// ===== 3. Composants : fraîcheur visible sur chaque panneau, et le pied de sources
C.sortie; F.horloge.maintenant = () => NOW;
const j1 = jeu(annees(2000, 2025), (i) => [100 + i, 200 + i]);
let b = C.badgeFraicheur(j1, { maintenant: NOW });
ok(b.parClasse("nxf-mot")[0].textContent === "À jour" && b.un("svg") && b.parTag("circle").length === 1 && b.getAttribute("data-niveau") === "a_jour" && /Mis à jour/.test(b.getAttribute("title")), "badge : mot « À jour », forme (disque plein) et détail en infobulle");
ok(C.badgeFraicheur(jeu(annees(2000, 2024), (i) => [i, i], { maj: "2025-07-01" }), { maintenant: NOW }).parTag("path").length === 1, "« en retard » a une autre forme (demi-disque)");
ok(C.badgeFraicheur(jeu(annees(2000, 2022), (i) => [i, i], { maj: "2025-07-01" }), { maintenant: NOW }).parTag("path").length === 0, "« ancien » a une autre forme (cercle vide)");
ok(C.badgeFraicheur(j1, { maintenant: NOW, court: true }).parClasse("nxf-age").length === 0 && C.badgeFraicheur(j1, { maintenant: NOW }).parClasse("nxf-age").length === 1, "version courte sans l'âge, version longue avec");
const pied = C.piedSources(j1);
ok(pied.parClasse("nxc-fraicheur").length === 1 && /À jour/.test(pied.parClasse("nxc-fraicheur")[0].textContent) && /Dernière donnée : 2025 \(série annuelle\)/.test(pied.textContent), "le pied de sources de tout composant porte la fraîcheur et la dernière donnée");
ok(/Mise à jour : /.test(pied.textContent) && /Licence/.test(pied.textContent), "le pied garde ses lignes d'avant (source, mise à jour, unité, période, licence)");
const fig = C.rendre("courbe", j1, { titre: "Essai", x: "date", y: "versailles" }); ok(fig.parClasse("nxc-fraicheur").length === 1, "une courbe affiche sa fraîcheur sans rien demander de plus");
ok(C.rendre("tableau", j1, {}).parClasse("nxc-fraicheur").length === 1, "le tableau aussi");

// ===== 4. Bandeau des sources
const etats = [E({ dernier_ok: "2026-10-26T11:55:00Z", derniere_maj: "2026-10-20" }), E({ id: "banque_mondiale", nom: "Banque mondiale", hote: "api.worldbank.org", derniere_erreur: "2026-10-26T11:00:00Z", erreur: "Banque mondiale est injoignable", erreur_code: "reseau" }), E({ id: "publie", nom: "Séries publiées", hote: "raw.githubusercontent.com", coupee: true })];
let bd = V.bandeauSources(etats, { maintenant: NOW, jeuxEnMemoire: [j1] });
const li = bd.parClasse("nxo-source");
ok(li.length === 3 && li.map((x) => x.getAttribute("data-niveau")).join() === "ok,erreur,coupee", "une ligne par source, avec son état");
ok(li[0].parClasse("nxf-mot")[0].textContent === "Répond" && li[1].parClasse("nxf-mot")[0].textContent === "En échec" && li[2].parClasse("nxf-mot")[0].textContent === "Coupée par Lucien", "mots lisibles : Répond · En échec · Coupée par Lucien");
ok(li.every((x) => x.un("svg")) && li[0].parTag("circle").length === 1 && li[1].parTag("path").length === 1 && li[2].parTag("path").length === 1, "chaque état a sa forme SVG (disque, croix, pause)");
ok(/il y a 5 min/.test(li[0].textContent) && /injoignable/.test(li[1].textContent) && /api\.worldbank\.org/.test(li[1].textContent) && /Jeux en mémoire/.test(bd.textContent), "âge de la dernière réponse, raison de l'échec, hôte contacté, résumé des jeux en mémoire");
leve(() => V.bandeauSources(null), /liste/, "bandeau sans liste : refus clair");
const piege = E({ nom: "<img src=x onerror=alert(1)>", erreur: "<script>alert(1)</script>", derniere_erreur: "2026-10-26T11:00:00Z" });
bd = V.bandeauSources([piege], { maintenant: NOW }); ok(/<img src=x/.test(bd.textContent) && bd.parTag("img").length === 0 && bd.parTag("script").length === 0, "nom ou erreur piégés : affichés comme du TEXTE, jamais interprétés");

// ===== 5. Jeu de panneaux : spécification
const jeux = creerJeux(); const d1 = jeux.deposer(brut(annees(2000, 2025), (i) => [100 + i, 200 + 2 * i])), d2 = jeux.deposer(brut(annees(2000, 2025), (i) => [50 + i, 80 + i], { nom: "Autre source" }));
const lire = (r) => jeux.lire(r);
const spec = { titre: "Versailles et Rennes", plage: { debut: "", fin: "" }, variables: [{ id: "col", genre: "colonne", libelle: "Commune", options: [{ valeur: "versailles", libelle: "Versailles" }, { valeur: "rennes", libelle: "Rennes" }] }, { id: "ech", genre: "echelle", libelle: "Échelle" }, { id: "lis", genre: "lissage", libelle: "Lissage" }],
  panneaux: [{ id: "a", titre: "Courbe", jeu: d1.ref, vue: "courbe" }, { id: "b", titre: "Tableau", jeu: d2.ref, vue: "tableau" }] };
const s0 = P.verifierTableau(spec, lire);
ok(s0.panneaux.length === 2 && s0.variables.length === 3 && s0.variables[1].defaut === "brut" && s0.variables[2].defaut === "1" && s0.variables[0].defaut === "versailles", "spécification valide : choix par défaut = premier choix");
const refusSpec = (m, re, msg) => leve(() => P.verifierTableau(m, lire), re, msg);
refusSpec(null, /spécification/, "pas d'objet"); refusSpec({ ...spec, titre: "" }, /titre manquant/, "titre manquant"); refusSpec({ ...spec, pirate: 1 }, /champ inconnu/, "champ inconnu");
refusSpec({ ...spec, panneaux: [] }, /au moins un panneau/, "aucun panneau"); refusSpec({ ...spec, panneaux: Array.from({ length: 9 }, (_, i) => ({ id: "p" + i, jeu: d1.ref, vue: "courbe" })) }, /8 panneaux au plus/, "trop de panneaux");
refusSpec({ ...spec, panneaux: [{ id: "a", jeu: "12345", vue: "courbe" }] }, /référence « jeu:… »/, "un nombre à la place d'une référence : refusé");
refusSpec({ ...spec, panneaux: [{ id: "a", jeu: [1, 2, 3], vue: "courbe" }] }, /référence/, "une liste de valeurs à la place d'une référence : refusée");
refusSpec({ ...spec, panneaux: [{ id: "a", jeu: "jeu:inconnu99", vue: "courbe" }] }, /Jeu inconnu/, "jeu qui n'existe pas : refusé (le modèle ne peut pas inventer un jeu)");
refusSpec({ ...spec, panneaux: [{ id: "a", jeu: d1.ref, vue: "camembert" }] }, /vue inconnue/, "vue hors liste blanche");
refusSpec({ ...spec, panneaux: [{ id: "a", jeu: d1.ref, vue: "courbe" }, { id: "a", jeu: d1.ref, vue: "tableau" }] }, /en double/, "identifiant de panneau en double");
refusSpec({ ...spec, variables: [{ id: "x", genre: "expression", options: [] }] }, /genre inconnu/, "genre de variable hors liste blanche (pas d'expression)");
refusSpec({ ...spec, variables: [{ id: "x", genre: "echelle" }, { id: "y", genre: "echelle" }] }, /une seule variable par genre/, "deux variables du même genre");
refusSpec({ ...spec, variables: [{ id: "col", genre: "colonne", options: ["a"], defaut: "z" }] }, /hors des choix/, "valeur par défaut hors des choix");
refusSpec({ ...spec, variables: [{ id: "Bad Id", genre: "echelle" }] }, /identifiant invalide/, "identifiant de variable invalide");
refusSpec({ ...spec, panneaux: [{ id: "a", jeu: d1.ref, vue: "courbe", options: { x: "y".repeat(700) } }] }, /options trop grosses/, "options trop grosses");
refusSpec({ ...spec, plage: { debut: "2020-13", fin: "" } }, /n'est pas une date/, "plage : date inexistante"); refusSpec({ ...spec, plage: { debut: "2020", fin: "2010" } }, /début est après la fin/, "plage : début après la fin");
refusSpec({ ...spec, titre: "bon‮titre" }, /caractères de contrôle/, "inversion de texte dans le titre refusée");

// ===== 6. État partagé et dérivation
const etat = P.creerEtat(s0); const vus = []; const off = etat.abonner((e) => vus.push(e));
etat.definirPlage({ debut: "2010", fin: "2020" }); etat.definirVariable("col", "rennes"); etat.definirVariable("lis", "3");
ok(vus.length === 3 && vus[2].plage.debut === "2010" && vus[2].valeurs.col === "rennes" && vus[2].valeurs.lis === "3", "chaque changement valide prévient les abonnés (3 changements, 3 messages)");
leve(() => etat.definirVariable("col", "marseille"), /choix inconnu/, "valeur hors des choix refusée"); leve(() => etat.definirVariable("zzz", "1"), /variable inconnue/, "variable inconnue refusée"); leve(() => etat.definirPlage({ debut: "2030", fin: "2020" }), /après la fin/, "plage incohérente refusée");
ok(vus.length === 3 && etat.lire().plage.debut === "2010", "un refus ne change rien et ne prévient personne");
off(); etat.reinitialiser(); ok(vus.length === 3 && etat.lire().valeurs.col === "versailles" && etat.lire().plage.debut === "", "désabonnement respecté ; réinitialisation");
let st = { plage: { debut: "2010", fin: "2020" }, valeurs: { col: "rennes", ech: "brut", lis: "1" } };
let dv = P.deriver(s0.panneaux[0], s0, st, lire);
ok(!dv.erreur && dv.jeu.lignes.length === 11 && dv.jeu.lignes[0][0] === "2010" && dv.jeu.colonnes.length === 2 && dv.jeu.colonnes[1].id === "rennes" && dv.jeu.lignes[0][1] === 200 + 2 * 10, "plage 2010→2020 + colonne « Rennes » : 11 lignes, valeurs prises dans le jeu d'origine (calcul du hub)");
ok(/calculé par le hub/.test(dv.jeu.source.nom) && dv.jeu.source.maj === "2026-10-20" && dv.jeu.source.licence === "Licence Ouverte", "le jeu dérivé garde sa source, sa date de mise à jour et sa licence, et dit qu'il est calculé");
st = { plage: { debut: "", fin: "" }, valeurs: { col: "versailles", ech: "indice100", lis: "1" } }; dv = P.deriver(s0.panneaux[0], s0, st, lire); ok(dv.jeu.lignes[0][1] === 100 && Math.abs(dv.jeu.lignes[25][1] - 125) < 1e-9, "échelle « indice base 100 » : 100 au départ, 125 à la fin (125/100)");
st = { plage: { debut: "", fin: "" }, valeurs: { col: "versailles", ech: "variation", lis: "1" } }; dv = P.deriver(s0.panneaux[0], s0, st, lire); ok(!dv.erreur && /variation/.test(dv.jeu.titre + dv.jeu.source.nom), "échelle « variation en % » calculée");
st = { plage: { debut: "", fin: "" }, valeurs: { col: "versailles", ech: "brut", lis: "6" } }; dv = P.deriver(s0.panneaux[0], s0, st, lire); ok(!dv.erreur && dv.jeu.lignes.length > 0, "lissage sur 6 : calculé");
st = { plage: { debut: "2040", fin: "2050" }, valeurs: { col: "versailles", ech: "brut", lis: "1" } }; dv = P.deriver(s0.panneaux[0], s0, st, lire); ok(/Aucune donnée/.test(dv.erreur), "plage sans donnée : le panneau le DIT, il ne montre rien d'autre");
st = { plage: { debut: "", fin: "" }, valeurs: { col: "marseille", ech: "brut", lis: "1" } }; dv = P.deriver(s0.panneaux[0], s0, st, lire); ok(/ne peut pas suivre ce réglage/.test(dv.erreur) && /marseille/.test(dv.erreur), "colonne absente de ce jeu : message clair dans le panneau");
dv = P.deriver({ ...s0.panneaux[0], jeu: "jeu:inconnu99" }, s0, st, lire); ok(/Jeu inconnu/.test(dv.erreur), "jeu retiré de la mémoire : message clair");
dv = P.deriver({ ...s0.panneaux[0], plage: false }, s0, { plage: { debut: "2010", fin: "2012" }, valeurs: { col: "versailles", ech: "brut", lis: "1" } }, lire); ok(dv.jeu.lignes.length === 26, "un panneau peut refuser de suivre la plage (« plage: false »)");
const pp = P.plagesProposees([lire(d1.ref)]); ok(pp[0].id === "tout" && pp.length === 4 && pp[1].fin === "2025-01" && pp[1].debut === "2015-01" && pp[3].libelle === "Dernier an", "plages proposées : comptées depuis la DERNIÈRE observation (2025), pas depuis aujourd'hui");
ok(P.plagesProposees([]).length === 1, "sans données : seule « toute la période »");

// ===== 7. Affichage du jeu de panneaux
const dep = (r) => NOW.getTime() - 120000;
let tab = V.tableauDePanneaux(spec, { lire, depose: dep, maintenant: () => NOW });
const panneaux = tab.parClasse("nxp-panneau");
ok(panneaux.length === 2 && tab.parClasse("nxp-controles").length === 1 && tab.parTag("select").length === 4, "2 panneaux, une barre de réglages partagés : plage + 3 variables (4 listes)");
ok(panneaux.every((p) => p.parClasse("nxf-mot").length >= 1 && p.parClasse("nxc-fraicheur").length === 1), "chaque panneau montre sa fraîcheur (badge + ligne du pied)");
ok(/À jour/.test(panneaux[0].parClasse("nxp-badge")[0].textContent) && /Le moins frais/.test(tab.parClasse("nxp-resume")[0].textContent), "badge dans l'en-tête du panneau et « le moins frais » en haut du tableau");
ok(tab.parClasse("nxp-corps")[0].parTag("svg").length >= 1 && tab.parClasse("nxp-corps")[1].parTag("table").length === 1, "courbe SVG dans le premier panneau, tableau dans le second");
const sels = tab.parTag("select"), selPlage = sels[0], selCol = sels[1];
selPlage.choisir("5a");
ok(tab.composant.etat.lire().plage.debut === "2020-01" && tab.composant.etat.lire().plage.fin === "2025-01" && /Plage appliquée : 2020-01 → 2025-01/.test(tab.parClasse("nxp-msg")[0].textContent), "choix « 5 derniers ans » : les DEUX panneaux suivent, et la plage appliquée est dite en toutes lettres");
const lignesTab = tab.parClasse("nxp-corps")[1].parTag("tbody")[0]; ok(lignesTab.children.length < 26 && lignesTab.children.length >= 5, "le tableau du 2e panneau a été restreint à la plage (" + lignesTab.children.length + " lignes sur 26)");
selCol.choisir("rennes");
ok(tab.composant.etat.lire().valeurs.col === "rennes" && /Rennes/.test(tab.parClasse("nxp-corps")[0].textContent), "choix de la commune : le panneau 1 passe sur Rennes");
ok(/ne peut pas suivre ce réglage/.test(tab.parClasse("nxp-corps")[1].textContent) || tab.parClasse("nxp-corps")[1].parTag("table").length === 1, "le panneau 2 (autre jeu) suit ou le dit clairement");
selPlage.choisir("libre"); const champs = tab.parTag("input"); champs[0].value = "2030"; champs[1].value = "2020";
tab.parTag("button").find((x) => x.textContent === "Appliquer").click();
ok(/début est après la fin/.test(tab.parClasse("nxp-msg")[0].textContent) && tab.composant.etat.lire().plage.debut === "2020-01", "dates libres incohérentes : message, état inchangé");
champs[0].value = "2012"; champs[1].value = "2014"; tab.parTag("button").find((x) => x.textContent === "Appliquer").click();
ok(tab.composant.etat.lire().plage.debut === "2012" && /2012 → 2014/.test(tab.parClasse("nxp-msg")[0].textContent), "dates libres valides appliquées");
tab.parTag("button").find((x) => x.textContent === "Réinitialiser").click();
ok(tab.composant.etat.lire().plage.debut === "" && tab.composant.etat.lire().valeurs.col === "versailles" && selCol.value === "versailles", "réinitialiser : plage, variables et listes reviennent au départ");
tab = V.tableauDePanneaux({ ...spec, panneaux: [{ id: "a", jeu: "12345", vue: "courbe" }] }, { lire });
ok(tab.getAttribute("role") === "alert" && /référence « jeu:… »/.test(tab.textContent), "spécification fausse : un encadré clair, pas d'exception");
const periL = jeux.deposer(brut(annees(2000, 2022), (i) => [i, i], { maj: "2025-07-01", nom: "Source en retard" })).ref;
tab = V.tableauDePanneaux({ titre: "Mixte", panneaux: [{ id: "a", jeu: d1.ref, vue: "courbe" }, { id: "b", jeu: periL, vue: "courbe" }] }, { lire, maintenant: () => NOW });
ok(/Ancien/.test(tab.parClasse("nxp-resume")[0].textContent), "le « moins frais » du tableau est l'ancien (" + tab.parClasse("nxp-resume")[0].textContent + ")");

// ===== 8. Graphe d'un plan
const plan = [{ nom: "lire_serie", params: {} }, { nom: "lire_serie", params: {} }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", avec: "$2.jeu" } }, { nom: "afficher_module", params: { jeu: "$3.jeu" } }];
const vp = G.verifierPlan(plan); const g = G.disposerPlan(vp.etapes);
ok(g.noeuds.length === 4 && g.noeuds[0].couche === 0 && g.noeuds[1].couche === 0 && g.noeuds[2].couche === 1 && g.noeuds[3].couche === 2 && g.liens.length === 3, "disposition : deux lectures en colonne 1, comparaison en 2, affichage en 3 ; 3 flèches");
ok(g.noeuds[0].y !== g.noeuds[1].y && g.noeuds[0].x === g.noeuds[1].x && g.largeur > 0 && g.hauteur > 0 && g.noeuds.every((n) => n.x >= 0 && n.y >= 0 && n.x + G.NOEUD.l <= g.largeur && n.y + G.NOEUD.h <= g.hauteur), "aucun nœud ne se superpose ni ne sort du cadre");
ok(g.liens.every((l) => /^M[\d. ]+C[\d. ]+$/.test(l.d)), "chaque flèche est un chemin SVG simple");
const g2 = G.disposerPlan([{ n: 1, nom: "a", depend_de: [] }, { n: 2, nom: "b", depend_de: [3, 9, 1] }]); ok(g2.liens.length === 1 && g2.noeuds[1].couche === 1, "dépendance vers l'avenir ou vers une étape inconnue : ignorée, jamais tracée");
ok(G.disposerPlan([]).noeuds.length === 0 && G.disposerPlan(null).largeur === 0, "plan vide : rien à tracer");
const lignesPlan = [{ ok: true, essais: 2 }, { ok: false, cause: "reseau", erreur: "Site injoignable", essais: 2 }, { ok: false, cause: "dependance", erreur: "Référence refusée" }, { ok: false, refus: "refuse_par_lucien", erreur: "Lucien a refusé" }];
lignesPlan.bilan = { etapes: 4, reussies: 1, en_echec: 1, refusees: 1, non_executees: 1, reprises: 2 };
ok(G.statutEtape(lignesPlan[0]) === "reussie" && G.statutEtape(lignesPlan[1]) === "echec" && G.statutEtape(lignesPlan[2]) === "non_executee" && G.statutEtape(lignesPlan[3]) === "refusee" && G.statutEtape({ ok: false, annule: true }) === "annulee" && G.statutEtape({ ok: false, saute: true }) === "ignoree" && G.statutEtape(null) === "prevue", "statuts : réussie, échec, non exécutée, refusée, annulée, ignorée, prévue");
const fg = V.grapheDePlan(plan, lignesPlan, { titre: "Plan d'essai" });
const noeuds = fg.parClasse("nxg-noeud");
ok(noeuds.length === 4 && noeuds.map((n) => n.getAttribute("data-statut")).join() === "reussie,echec,non_executee,refusee", "un nœud par étape, avec son statut réel");
ok(fg.parTag("path").filter((p) => p.getAttribute("marker-end")).length === 3 && fg.parTag("marker").length === 1, "3 flèches avec pointe de flèche");
ok(noeuds[0].parTag("text").map((t) => t.textContent).join("|").includes("✓") && noeuds[1].parTag("text").map((t) => t.textContent).join("|").includes("✕") && /2 essais/.test(noeuds[0].textContent), "statut dit par un SIGNE et des mots (✓ ✕), pas par la couleur seule ; reprises visibles");
ok(/Site injoignable/.test(noeuds[1].parTag("title")[0].textContent) && noeuds.every((n) => n.parTag("title").length === 1), "infobulle de chaque nœud : la raison");
ok(fg.parClasse("nxg-liste")[0].children.length === 4 && /Bilan : 1 réussie\(s\) sur 4 · 1 en échec · 1 refusée\(s\) · 1 non exécutée\(s\) · 2 reprise\(s\)/.test(fg.textContent), "liste de secours en texte + bilan chiffré");
ok(fg.tous((e) => e._ev && Object.keys(e._ev).length > 0).length === 0, "lecture seule : aucun gestionnaire d'événement sur le graphe");
const fp = V.grapheDePlan(plan); ok(fp.parClasse("nxg-noeud").every((n) => n.getAttribute("data-statut") === "prevue"), "sans exécution, le plan est montré « prévu »");
const mauvais = V.grapheDePlan([{ nom: "a", params: { jeu: "$2.jeu" } }, { nom: "b", params: {} }]); ok(mauvais.parClasse("nxc-refus").length === 1 && /circulaire/.test(mauvais.textContent), "plan incohérent : signalé dans le graphe");
const piegeG = V.grapheDePlan([{ nom: "<script>alert(1)</script>", params: {} }]); ok(piegeG.parTag("script").length === 0 && /<script>/.test(piegeG.textContent), "nom d'étape piégé : posé comme texte");

// ===== 9. Règles générales
ok(compteurHTML.n === 0, "aucune écriture HTML en texte (innerHTML, outerHTML, insertAdjacentHTML) : 0 tentative");
const { readFileSync } = await import("node:fs");
for (const fch of ["js/noyau/modules/vues-orch.js", "js/noyau/modules/fraicheur.js", "js/noyau/modules/plan-graphe.js", "js/noyau/panneaux.js", "js/noyau/fiabilite.js"]) {
  const src = readFileSync(new URL("../" + fch, import.meta.url), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(!/\beval\s*\(|new Function|innerHTML|outerHTML|insertAdjacentHTML|document\.write|<script|\bimport\s*\(\s*["']https?:|\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/.test(src), `${fch} : ni eval, ni HTML en texte, ni réseau, ni stockage`);
}

console.log(ko ? `\n${ko} ÉCHEC(S)` : "\nTout est au vert."); process.exit(ko ? 1 : 0);
