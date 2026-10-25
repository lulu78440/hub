// Banc de test · cas limites des moteurs de l'Atelier (branche atelier-auto).
// Usage : node tools/tests/atelier_banc/cas-limites.mjs [dossier des moteurs]
//   (par défaut js/widgets/moteurs du dépôt courant). Données INVENTÉES uniquement : aucun relevé, nom, IBAN ou numéro réel.
// Chaque cas porte une étiquette ; un échec est imprimé avec ce qui était attendu. Code de sortie 1 s'il y a un échec.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const dossier = resolve(process.argv[2] || "js/widgets/moteurs");
const mod = async (n) => import(pathToFileURL(resolve(dossier, n + ".js")).href);
const csv = await mod("bud-csv"), env = await mod("bud-enveloppes"), gar = await mod("at-garantie"),
  colis = await mod("at-colis"), score = await mod("cons-score"), radar = await mod("at-radar-donnees");

let ok = 0, ko = 0; const echecs = [];
const eq = (etiquette, obtenu, attendu) => {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a === b) ok++; else { ko++; echecs.push(`✗ ${etiquette}\n    obtenu  : ${a}\n    attendu : ${b}`); }
};
const essai = (etiquette, fn, attendu) => { let r; try { r = fn(); } catch (e) { r = "ERREUR: " + e.message; } eq(etiquette, r, attendu); };
const resume = (r) => r.operations.map((o) => [o.date, o.montant]);

// ——— 1. Relevés CSV au format de banques françaises (données inventées) ———
const BANQUES = {
  "Crédit Agricole (débit/crédit, libellé sur plusieurs lignes, en-tête de banque)": [
    'Compte de Dépôt carte n° 0000000000;\n\nSolde au 31/10/2026 1 234,56 €\n\nDate;Libellé;Débit euros;Crédit euros;\n' +
    '02/10/2026;"PAIEMENT PAR CARTE \nX0000 BOULANGERIE FICTIVE 01/10\n";12,30;;\n03/10/2026;"VIREMENT EN VOTRE FAVEUR \nEMPLOYEUR INVENTE\n";;1 850,00;\n',
    [["2026-10-02", -1230], ["2026-10-03", 185000]]],
  "Société Générale (lignes avant le tableau, « Montant de l'opération »)": [
    '="000000000000";Compte fictif\n\nDate de l\'opération;Libellé;Détail de l\'écriture;Montant de l\'opération;Devise\n' +
    '05/10/2026;CARTE X0000 05/10 EPICERIE TEST;CARTE X0000 05/10 EPICERIE TEST PARIS;-45,90;EUR\n06/10/2026;VIR RECU 0000;DE: PERSONNE FICTIVE;100,00;EUR\n',
    [["2026-10-05", -4590], ["2026-10-06", 10000]]],
  "BNP Paribas (catégories de la banque, « Montant opération »)": [
    'Date opération;Catégorie;Sous Catégorie;Libellé opération;Montant opération\n07/10/2026;Alimentation;Supermarché;FACTURE CARTE DU 06/10/26 MAGASIN FICTIF;-23,45\n',
    [["2026-10-07", -2345]]],
  "La Banque Postale (« Montant(EUROS) »)": [
    'Numéro Compte   ;0000000X000\nType ;CCP\nCompte tenu en  ;euros\nDate;Libellé;Montant(EUROS)\n08/10/2026;ACHAT CB TEST 07.10.26;-9,99\n',
    [["2026-10-08", -999]]],
  "Crédit Mutuel / CIC (date de valeur et solde)": [
    'Date;Date de valeur;Débit;Crédit;Libellé;Solde\n09/10/2026;09/10/2026;-60,00;;PRLV SEPA FOURNISSEUR FICTIF;1 000,00\n10/10/2026;10/10/2026;;15,00;REMBOURSEMENT TEST;1 015,00\n',
    [["2026-10-09", -6000], ["2026-10-10", 1500]]],
  "Caisse d'Épargne (dates sur 2 chiffres, colonnes débit/crédit)": [
    "Code de la banque : 00000;Code de l'agence : 00000\nDate;Numéro d'opération;Libellé;Débit;Crédit;Détail\n11/10/26;0000001;CB CAFE FICTIF;-3,20;;CB CAFE FICTIF FACT 101026\n",
    [["2026-10-11", -320]]],
  "Fortuneo (« Date opération », « libellé » en minuscules)": [
    "Date opération;Date valeur;libellé;Débit;Crédit;\n12/10/2026;12/10/2026;CARTE 11/10 LIBRAIRIE TEST;-18,00;;\n",
    [["2026-10-12", -1800]]],
  "Boursorama / BoursoBank (en-têtes en anglais : dateOp, label, amount)": [
    "dateOp;dateVal;label;category;categoryParent;supplierFound;amount;comment;accountNum;accountLabel;accountbalance\n" +
    '2026-10-13;2026-10-13;"CARTE 12/10/26 ENSEIGNE FICTIVE";"Alimentation";"Vie quotidienne";"enseigne fictive";-27,40;;00000000000;"COMPTE FICTIF";100,00\n',
    [["2026-10-13", -2740]]],
  "Exportation Excel en Windows-1252 (accents) avec séparateur « ; »": [
    new Uint8Array([...Buffer.from("Date;Libell", "latin1"), 0xe9, ...Buffer.from(";Montant\n14/10/2026;PR", "latin1"), 0xc9, ...Buffer.from("L", "latin1"), 0xc8, ...Buffer.from("VEMENT TEST;-5,00\n", "latin1")]),
    [["2026-10-14", -500]]],
  "UTF-8 avec BOM, fins de ligne Windows (CRLF), ligne de total ignorée": [
    "﻿Date;Libellé;Montant\r\n15/10/2026;ACHAT TEST;-1 234,56\r\n;Total;-1 234,56\r\n",
    [["2026-10-15", -123456]]],
  "Séparateur virgule, montants entre guillemets": [
    'Date,Libellé,Montant\n16/10/2026,"ACHAT, AVEC VIRGULE","-7,50"\n',
    [["2026-10-16", -750]]],
};
for (const [nom, [entree, attendu]] of Object.entries(BANQUES)) essai("CSV " + nom, () => resume(csv.importerReleve(entree)), attendu);

essai("CSV LCL (aucune ligne d'en-tête) : message clair, pas de plantage", () => {
  try { csv.importerReleve("17/10/2026;-25,00;Carte;;CB MAGASIN FICTIF;\n18/10/2026;-5,00;Carte;;CB TEST;\n"); return "accepté"; }
  catch (e) { return /colonnes/.test(e.message) ? "refus clair" : "refus obscur : " + e.message; }
}, "refus clair");
essai("CSV fichier vide", () => { try { csv.importerReleve(""); return "accepté"; } catch (e) { return "refus"; } }, "refus");
essai("CSV ré-import du même relevé : aucune nouvelle opération", () => {
  const t = "Date;Libellé;Montant\n01/10/2026;CAFE;-2,00\n01/10/2026;CAFE;-2,00\n";
  const a = csv.importerReleve(t).operations, b = csv.importerReleve(t).operations;
  return [a.length, csv.nouvelles(a, b).length];
}, [2, 0]);
essai("CSV relevé suivant qui chevauche : seules les nouvelles", () => {
  const a = csv.importerReleve("Date;Libellé;Montant\n01/10/2026;A;-1,00\n02/10/2026;B;-2,00\n").operations;
  const b = csv.importerReleve("Date;Libellé;Montant\n02/10/2026;B;-2,00\n03/10/2026;C;-3,00\n").operations;
  return csv.nouvelles(a, b).map((o) => o.libelle);
}, ["C"]);
essai("CSV libellé piégé gardé tel quel (texte, pas exécuté ici)", () => csv.importerReleve('Date;Libellé;Montant\n01/10/2026;"<img src=x onerror=alert(1)>";-1,00\n').operations[0].libelle, "<img src=x onerror=alert(1)>");
essai("CSV 31/09 et 29/02/2026 refusés comme dates", () => csv.importerReleve("Date;Libellé;Montant\n31/09/2026;A;-1,00\n29/02/2026;B;-1,00\n").ignorees.length, 2);

// ——— 2. Montants ———
const MONTANTS = { "-1 234,56 €": -123456, "1 234,56": 123456, "1 234,56 EUR": 123456, "(12,30)": -1230, "12,30-": -1230, "+5": 500,
  "0,00": 0, "-0,00": 0, "1.234,56": 123456, "1.234": 123400, "12,3": 1230, "12,345": null, "1,234.56": null, "abc": null, "": null,
  "--5": null, "€ 12,00": 1200, "12,00 €": 1200, "99 999 999,99": 9999999999 };
for (const [v, attendu] of Object.entries(MONTANTS)) essai(`montant « ${v} »`, () => { const r = csv.lireMontant(v); return r === 0 ? 0 : r; }, attendu);
essai("montant « -0,00 » n'est pas un zéro négatif", () => Object.is(csv.lireMontant("-0,00"), -0), false);

// ——— 3. Dates ———
const DATES = { "05/03/2026": "2026-03-05", "5/3/26": "2026-03-05", "05.03.2026": "2026-03-05", "2026-03-05": "2026-03-05",
  "29/02/2028": "2028-02-29", "29/02/2026": null, "31/04/2026": null, "00/01/2026": null, "2026-03-05abc": null, "2026-03-05T10:00:00": "2026-03-05", "2026-03-05 10:00": "2026-03-05", "01/01/69": "2069-01-01", "01/01/70": "1970-01-01" };
for (const [v, attendu] of Object.entries(DATES)) essai(`date « ${v} »`, () => csv.lireDate(v), attendu);

// ——— 4. Enveloppes ———
const E0 = { enveloppes: [{ id: "courses", nom: "Courses" }, { id: "loisirs", nom: "Loisirs" }], allocations: { "2026-09": { courses: 30000, loisirs: 10000 }, "2026-10": { courses: 30000 } } };
const OPS = [{ date: "2026-09-01", montant: 200000, categorie: "Revenus" }, { date: "2026-09-10", montant: -35000, categorie: "Courses" },
  { date: "2026-09-12", montant: -2000, categorie: "loisirs" }, { date: "2026-10-01", montant: 200000, categorie: "Revenus" }];
essai("enveloppes : dépassement de septembre retiré de l'argent à répartir d'octobre, pas reporté", () => {
  const r = env.calculerMois(E0, OPS, "2026-10"), c = r.enveloppes.find((l) => l.id === "courses"), l = r.enveloppes.find((x) => x.id === "loisirs");
  return { reportCourses: c.report, reportLoisirs: l.report, aRepartir: r.aRepartir };
}, { reportCourses: 0, reportLoisirs: 8000, aRepartir: 200000 - 40000 + 200000 - 30000 - 5000 });
essai("enveloppes : l'état reçu n'est jamais modifié", () => { const s = JSON.stringify(E0); env.calculerMois(E0, OPS, "2026-10"); env.allouer(E0, "2026-10", "loisirs", 5000); env.reprendreMoisPrecedent(E0, "2026-10"); return JSON.stringify(E0) === s; }, true);
essai("enveloppes : passage d'année (décembre → janvier)", () => env.moisSuivant("2026-12"), "2027-01");
essai("enveloppes : mois mal écrit refusé", () => { try { env.calculerMois(E0, OPS, "2026-13"); return "accepté"; } catch (e) { return "refus"; } }, "refus");
essai("enveloppes : allocation illisible comptée 0", () => env.calculerMois({ ...E0, allocations: { "2026-10": { courses: "abc" } } }, [], "2026-10").totaux.alloue, 0);
essai("enveloppes : opération datée après le mois demandé ignorée", () => env.calculerMois(E0, [...OPS, { date: "2026-11-02", montant: -999999, categorie: "Courses" }], "2026-10").enveloppes[0].activite, 0);
essai("euros : format français", () => [env.euros(123456), env.euros(-5), env.euros(0)], ["1\u202f234,56\u00a0€", "−0,05\u00a0€", "0,00\u00a0€"]);

// ——— 5. Garantie et retour (droit français, valeurs par défaut) ———
const J = "2026-10-25";
essai("garantie : 24 mois par défaut", () => gar.echeances({ id: "a", nom: "Objet", dateAchat: "2026-01-31", mode: "magasin" }, J).finGarantie, "2028-01-31");
essai("garantie : 31 janvier + 1 mois = 28 février", () => gar.ajouterMois("2027-01-31", 1), "2027-02-28");
essai("garantie : 29 février + 12 mois = 28 février", () => gar.ajouterMois("2028-02-29", 12), "2029-02-28");
essai("retour à distance : 14 jours après la réception", () => gar.echeances({ id: "b", nom: "Colis", dateAchat: "2026-10-10", dateReception: "2026-10-15" }, J).finRetour, "2026-10-29");
essai("retour en magasin : aucun délai légal par défaut", () => gar.echeances({ id: "c", nom: "Objet", dateAchat: "2026-10-20", mode: "magasin" }, J).finRetour, null);
essai("garantie : date d'achat invalide → statut invalide", () => gar.echeances({ id: "d", dateAchat: "2026-02-30" }, J).statut, "invalide");
essai("garantie : réception avant l'achat signalée", () => gar.echeances({ id: "e", dateAchat: "2026-10-10", dateReception: "2026-10-01" }, J).problemes.length > 0, true);
essai("garantie : dernier jour de retour = statut retour, 0 j", () => { const e = gar.echeances({ id: "f", nom: "X", dateAchat: "2026-10-11" }, J); return [e.statut, e.joursRetour]; }, ["retour", 0]);
essai("garantie : extension négative ignorée", () => gar.echeances({ id: "g", dateAchat: "2026-01-01", extensionMois: -6 }, J).finGarantie, "2028-01-01");
// Écarts au droit (sens prudent : échéance affichée plus tôt que la vraie) — documentés, non bloquants.
const ecartsDroit = [];
{ const e = gar.echeances({ id: "h", nom: "Colis", dateAchat: "2026-10-01", dateReception: "2026-10-10" }, J);
  if (e.finGarantie !== "2028-10-10") ecartsDroit.push(`garantie comptée depuis l'achat (${e.finGarantie}) et non depuis la livraison (2028-10-10), art. L217-3`); }
{ const e = gar.echeances({ id: "i", nom: "Colis", dateAchat: "2026-10-03", dateReception: "2026-10-03" }, "2026-10-01");
  if (e.finRetour === "2026-10-17") ecartsDroit.push("délai de rétractation finissant un samedi (17/10/2026) non prolongé au lundi 19/10, art. L221-19"); }

// ——— 6. Colis ———
const S10_OK = (() => { const p = [8, 6, 4, 2, 3, 5, 9, 7], d = "12345678"; let s = [...d].reduce((t, x, i) => t + +x * p[i], 0), c = 11 - (s % 11); if (c === 10) c = 0; else if (c === 11) c = 5; return `LA${d}${c}FR`; })();
essai("colis : S10 français à clé juste = sûr", () => colis.analyser(S10_OK).candidats[0].confiance, "sure");
essai("colis : S10 à clé fausse = possible + message", () => { const n = S10_OK.slice(0, 10) + ((+S10_OK[10] + 1) % 10) + "FR"; const a = colis.analyser(n); return [a.candidats[0].confiance, /clé/.test(a.message)]; }, ["possible", true]);
essai("colis : espaces, tirets et minuscules acceptés", () => colis.analyser(S10_OK.toLowerCase().replace(/(\d{4})/, "$1 - ")).numero, S10_OK);
essai("colis : texte piégé → aucun lien produit", () => colis.analyser('"><script>alert(1)</script>').candidats.length, 0);
essai("colis : lien de suivi toujours en https et encodé", () => colis.analyser(S10_OK).candidats.every((c) => !c.lien || (c.lien.startsWith("https://") && c.lien.endsWith(encodeURIComponent(S10_OK)))), true);
essai("colis : extraction dans un message, numéros « possibles » écartés", () => colis.extraire(`Votre colis ${S10_OK} part aujourd'hui. Commande 123456789012.`).length, 1);
essai("colis : un IBAN inventé n'est pas pris pour un colis", () => colis.extraire("IBAN FR76 0000 0000 0000 0000 0000 000").length, 0);
essai("colis : numéro vide", () => colis.analyser("").message, "Numéro vide.");

// ——— 7. Score de veille ———
essai("score : « jeu » ne trouve pas « jeudi »", () => score.scorer({ titre: "Rendez-vous jeudi" }, "jeu").score, 0);
essai("score : pluriel et accents", () => score.scorer({ titre: "Les JEUX VIDÉOS de la semaine" }, "jeu vidéo").score > 0, true);
essai("score : mot à écarter fait descendre", () => score.scorer({ titre: "La bourse et l'IA" }, "ia, -bourse").score < 0, true);
essai("score : caractères spéciaux de regex sans plantage", () => score.scorer({ titre: "C++ et C#" }, "c++, (test], .*").score > 0, true);
essai("score : poids borné à 5", () => score.lireMotsCles("ia*99")[0].poids, 5);
essai("score : tri chrono sans date en dernier, articles non modifiés", () => { const A = [{ titre: "a" }, { titre: "b", date: "2026-10-01T00:00:00Z" }]; const s = JSON.stringify(A); const t = score.trier(A, "x").map((x) => x.titre); return [t, JSON.stringify(A) === s]; }, [["b", "a"], true]);

// ——— 8. Contrôle d'un export (radar des données) ———
const NOW = Date.parse("2026-10-25T12:00:00Z");
essai("radar : export chiffré reconnu (et non « pas un export »)", () => radar.controler({ format: "hub-donnees-chiffre", formatVersion: 1, exportedAt: "2026-10-25T00:00:00Z", coffre: { pass: {}, rescue: {} }, data: "BLOC-CHIFFRE-FACTICE" }, { maintenant: NOW }).texte.match(/chiffr/i) !== null, true);
essai("radar : favori javascript: = erreur", () => radar.controler({ format: "hub-donnees", exportedAt: "2026-10-25T00:00:00Z", data: { favs: [{ id: "f1", title: "x", url: "javascript:alert(1)" }] } }, { maintenant: NOW }).erreurs, 1);
essai("radar : identifiant en double = erreur", () => radar.controler({ format: "hub-donnees", exportedAt: "2026-10-25T00:00:00Z", data: { notes: [{ id: "n", text: "a" }, { id: "n", text: "b" }] } }, { maintenant: NOW }).erreurs, 1);
essai("radar : JSON abîmé", () => radar.controler("{pas du json", { maintenant: NOW }).ok, false);
essai("radar : l'export reçu n'est pas modifié", () => { const x = { format: "hub-donnees", exportedAt: "2026-10-01T00:00:00Z", data: { tasks: [{ id: "t", text: "a", due: "2026-02-30" }] } }; const s = JSON.stringify(x); radar.controler(x, { maintenant: NOW }); return JSON.stringify(x) === s; }, true);

// ——— Bilan ———
for (const e of echecs) console.log(e);
if (ecartsDroit.length) console.log("\nÉcarts au droit (sens prudent, non bloquants) :\n- " + ecartsDroit.join("\n- "));
console.log(`\nCas limites de l'Atelier : ${ok} juste(s), ${ko} écart(s).`);
process.exit(ko ? 1 : 0);
