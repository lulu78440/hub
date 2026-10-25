// Essais du moteur bud-csv. Relevés ENTIÈREMENT FACTICES (banque, compte et commerces inventés).
import { decoder, lireCSV, lireMontant, lireDate, importerReleve, nouvelles, categoriser, verifierRegle, suggererRegle } from "../../../js/widgets/moteurs/bud-csv.js";
import { vrai, egal, leve, fin } from "./_outil.mjs";

// Montants
const M = { "12,30": 1230, "-12,30": -1230, "1 234,56": 123456, "1 234,56 €": 123456, "1.234,56": 123456, "(8,00)": -800, "5": 500, "+5,5": 550, "12,30-": -1230, "1.234": 123400, "0,07": 7, "abc": null, "": null, "12,345": null };
for (const [k, v] of Object.entries(M)) egal(lireMontant(k), v, `montant « ${k} »`);
// Dates
egal(lireDate("05/03/2026"), "2026-03-05", "date JJ/MM/AAAA");
egal(lireDate("5/3/26"), "2026-03-05", "date courte");
egal(lireDate("31.12.2025"), "2025-12-31", "date à points");
egal(lireDate("2026-03-05T00:00"), "2026-03-05", "date ISO");
egal([lireDate("30/02/2026"), lireDate("13/13/2026"), lireDate("demain")], [null, null, null], "dates invalides refusées");
// CSV
egal(lireCSV('a;"b;c";"d ""e"""\n1;2;3'), [["a", "b;c", 'd "e"'], ["1", "2", "3"]], "guillemets et séparateur dans une cellule");
egal(lireCSV('x;"ligne\nsur deux";z'), [["x", "ligne\nsur deux", "z"]], "retour à la ligne entre guillemets");

// Format A : en-tête de banque, Débit / Crédit séparés, BOM UTF-8, fins de ligne Windows
const A = "﻿Banque Fictive;;;;\r\nCompte n° 00000000000;;;;\r\n;;;;\r\nDate;Date valeur;Libellé;Débit euros;Crédit euros\r\n" +
  "02/10/2026;02/10/2026;CB CARREFOUR MARKET 01/10 CARTE 4971XXXX;45,20;\r\n" +
  "03/10/2026;03/10/2026;VIR SEPA RECU SALAIRE SOCIETE EXEMPLE;;2 100,00\r\n" +
  "05/10/2026;05/10/2026;PRLV SEPA NETFLUX ABONNEMENT;-13,49;\r\n" +
  "05/10/2026;05/10/2026;CB BOULANGERIE DU COIN;1,20;\r\n05/10/2026;05/10/2026;CB BOULANGERIE DU COIN;1,20;\r\n" +
  ";;Solde au 05/10/2026;;2 039,11\r\n";
const rA = importerReleve(A);
egal(rA.operations.map((o) => o.montant), [-4520, 210000, -1349, -120, -120], "débit/crédit : signes et montants");
egal(rA.operations[0].date, "2026-10-02", "date de l'opération (pas la date de valeur)");
egal(rA.operations[0].ligne, 5, "numéro de ligne réel dans le fichier");
egal(rA.ignorees, [{ ligne: 10, raison: "ligne de solde ou de total" }], "ligne de solde ignorée et signalée");
vrai(rA.operations[3].id !== rA.operations[4].id, "deux achats identiques le même jour restent distincts");
egal(importerReleve(A).operations.map((o) => o.id), rA.operations.map((o) => o.id), "identifiants stables d'un import à l'autre");
egal(nouvelles(rA.operations.slice(0, 2), rA.operations).length, 3, "réimport : seulement les nouvelles opérations");

// Format B : colonne Montant unique, encodage Windows-1252 (export Excel), séparateur détecté
const B = "Date opération;Libellé;Montant\n07/10/2026;Pharmacie Étoile;-9,90\n08/10/2026;Remboursement Sécu fictif;6,93\n";
const octets1252 = Uint8Array.from([...B].map((c) => ({ "é": 0xe9, "É": 0xc9 })[c] ?? c.charCodeAt(0)));
const rB = importerReleve(octets1252);
egal(rB.operations.map((o) => [o.libelle, o.montant]), [["Pharmacie Étoile", -990], ["Remboursement Sécu fictif", 693]], "Windows-1252 et montant unique");
egal(decoder(new TextEncoder().encode("﻿Date")), "Date", "BOM retiré des octets UTF-8");
egal(importerReleve("Date,Libelle,Montant\n2026-10-09,Test,\"-3,50\"").operations[0].montant, -350, "séparateur virgule détecté");
leve(() => importerReleve("Nom;Prénom\nA;B"), "fichier sans colonnes bancaires refusé");

// Règles
const regles = [
  { id: "r1", conditions: [{ champ: "libelle", op: "contient", valeur: "carrefour" }], categorie: "Courses" },
  { id: "r2", conditions: [{ champ: "libelle", op: "commence", valeur: "vir sepa recu" }, { op: "sens", valeur: "revenu" }], categorie: "Revenus" },
  { id: "r3", conditions: [{ champ: "libelle", op: "contient", valeur: "boulangerie" }, { champ: "montant", op: "inferieur", valeur: 5 }], categorie: "Courses" },
  { id: "r4", conditions: [{ champ: "montant", op: "entre", valeur: [13, 14] }, { op: "sens", valeur: "depense" }], categorie: "Abonnements" },
  { id: "abimee", conditions: [], categorie: "X" },
];
const ops = rA.operations.map((o, i) => (i === 4 ? { ...o, categorieManuelle: "Cadeaux" } : o));
const c = categoriser(ops, regles);
egal(c.operations.map((o) => o.categorie), ["Courses", "Revenus", "Abonnements", "Courses", "Cadeaux"], "catégories appliquées, choix manuel respecté");
egal(c.nonClassees.length, 0, "tout est classé");
egal(categoriser(rB.operations, regles).nonClassees.length, 2, "opérations sans règle signalées");
egal(verifierRegle(regles[4]), ["aucune condition"], "règle abîmée repérée (et ignorée)");
egal(verifierRegle({ categorie: "A", conditions: [{ champ: "montant", op: "inferieur", valeur: "x" }] }), ["condition n° 1 invalide"], "condition invalide repérée");
vrai(ops[0].categorie === undefined, "opérations d'origine non modifiées");

// Suggestion sans IA
const s = suggererRegle("CB CARREFOUR MARKET 01/10 CARTE 4971XXXX", "Courses");
egal(s.conditions[0], { champ: "libelle", op: "contient", valeur: "carrefour market" }, "suggestion : mots utiles seulement");
vrai(s.suggeree === true && verifierRegle(s).length === 0, "suggestion marquée « à confirmer » et valide");
egal(suggererRegle("PRLV SEPA 12345", "X"), null, "rien d'utile : pas de suggestion");
fin("bud-csv");
