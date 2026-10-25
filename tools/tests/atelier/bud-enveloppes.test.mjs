// Essais du moteur bud-enveloppes (budget entièrement factice).
import { calculerMois, allouer, reprendreMoisPrecedent, moisSuivant, moisPrecedent, nomMois, euros, bilanTexte } from "../../../js/widgets/moteurs/bud-enveloppes.js";
import { vrai, egal, leve, fin } from "./_outil.mjs";

egal([moisSuivant("2026-12"), moisPrecedent("2026-01"), nomMois("2026-08")], ["2027-01", "2025-12", "août 2026"], "mois voisins et noms");
egal(euros(123456), "1 234,56 €", "format euros");
egal(euros(-5), "−0,05 €", "format euros négatif");

const etat = {
  enveloppes: [{ id: "courses", nom: "Courses", categories: ["Alimentation"] }, { id: "loisirs", nom: "Loisirs" }],
  allocations: { "2026-09": { courses: 30000, loisirs: 10000 }, "2026-10": { courses: 30000, loisirs: 10000 } },
};
const ops = [
  { date: "2026-09-01", montant: 200000, categorie: "Revenus" },
  { date: "2026-09-05", montant: -25000, categorie: "Courses" },
  { date: "2026-09-10", montant: -15000, categorie: "loisirs" },
  { date: "2026-10-01", montant: 200000, categorie: "revenus" },
  { date: "2026-10-03", montant: -40000, categorie: "Alimentation" },
  { date: "2026-10-04", montant: 2000, categorie: "Courses" },          // remboursement
  { date: "2026-10-06", montant: -2000, categorie: "Loisirs" },
  { date: "2026-10-07", montant: -999, categorie: null },
  { date: "2026-10-08", montant: -500, categorie: "Cadeaux" },
];
const avant = JSON.stringify([etat, ops]);
const s = calculerMois(etat, ops, "2026-09");
egal(s.enveloppes.map((l) => [l.id, l.reste, l.depasse]), [["courses", 5000, false], ["loisirs", -5000, true]], "septembre : reste et dépassement");
egal(s.aRepartir, 160000, "septembre : à répartir");

const o = calculerMois(etat, ops, "2026-10");
egal(o.enveloppes.map((l) => [l.report, l.alloue, l.activite, l.reste]), [[5000, 30000, -38000, -3000], [0, 10000, -2000, 8000]], "octobre : reste positif reporté, dépassement non reporté, catégorie liée, remboursement");
egal(o.aRepartir, 315000, "octobre : dépassement de septembre retiré de l'argent à répartir");
egal(o.revenus, 200000, "revenus du mois (casse ignorée)");
egal([o.nonClassees.length, o.horsEnveloppe.length], [1, 1], "opérations sans catégorie et hors enveloppe listées");
egal(o.alertes.length, 3, "alertes : dépassement, sans catégorie, hors enveloppe");

const n = calculerMois(etat, ops, "2026-11");
egal(n.enveloppes.map((l) => l.reste), [0, 8000], "novembre sans opération : reports seulement");
egal(n.aRepartir, 312000, "novembre : dépassement d'octobre retiré");
egal(calculerMois(etat, ops, "2026-08").aRepartir, 0, "mois avant toute donnée : rien");
egal(JSON.stringify([etat, ops]), avant, "état et opérations d'origine non modifiés");

const e2 = allouer(etat, "2026-11", "loisirs", 5000);
egal(e2.allocations["2026-11"], { loisirs: 5000 }, "allouer");
egal(etat.allocations["2026-11"], undefined, "allouer ne modifie pas l'état d'origine");
egal(allouer(e2, "2026-11", "loisirs", 0).allocations["2026-11"], {}, "allocation à 0 retirée");
egal(reprendreMoisPrecedent(e2, "2026-11").allocations["2026-11"], { courses: 30000, loisirs: 5000 }, "reprendre le mois précédent sans écraser la saisie");
leve(() => calculerMois(etat, ops, "octobre"), "mois mal écrit refusé");
egal(calculerMois({}, [], "2026-10").enveloppes, [], "état vide toléré");

const b = bilanTexte(o);
vrai(b.startsWith("Bilan d'octobre 2026 : 2\u202f000,00\u00a0€ de revenus"), "bilan du mois en texte (élision)");
vrai(bilanTexte(n).startsWith("Bilan de novembre"), "bilan : « de » devant consonne");
vrai(b.includes("Courses (380,00 €)") && b.includes("dépassée de 30,00"), "bilan : plus grosses enveloppes et dépassement");
fin("bud-enveloppes");
