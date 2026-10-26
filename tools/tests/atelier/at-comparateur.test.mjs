// Essais du moteur at-comparateur (offres factices).
import { euros, cout, comparer } from "../../../js/widgets/moteurs/at-comparateur.js";
import { vrai, egal, fin } from "./_outil.mjs";

egal([euros(123456), euros(5), euros(-250)], ["1 234,56 €", "0,05 €", "−2,50 €"], "affichage en euros");
const b = cout({ id: "b", nom: "Boutique B", prix: 3499, reductionPct: 20, livraison: 390, livraisonOfferteDes: 2500 });
egal([b.brut, b.reductionTotale, b.articles, b.livraison, b.total], [3499, 700, 2799, 0, 2799], "réduction 20 % puis livraison offerte au-dessus du seuil");
egal(cout({ prix: 1000, quantite: 3, reduction: 500, livraison: 400, frais: 99 }).total, 2999, "quantité, réduction fixe, livraison et frais");
egal(cout({ prix: 1000, reductionPct: 10, reduction: 200 }).articles, 700, "pourcentage puis réduction fixe");
egal(cout({ prix: 2000, livraison: 500, livraisonOfferteDes: 2500 }).livraison, 500, "seuil non atteint : livraison payée");
egal(cout({ prix: 3000, reductionPct: 20, livraison: 500, livraisonOfferteDes: 2500 }).livraison, 500, "seuil comparé aux articles après réduction (24 € < 25 €)");
const trop = cout({ prix: 500, reduction: 900, livraison: 300 });
vrai(trop.total === 300 && trop.problemes.length === 1, "réduction plafonnée au prix, livraison toujours due");
vrai(cout({ prix: 500, reductionPct: 150 }).problemes[0].includes("hors de 0-100"), "pourcentage aberrant ignoré et signalé");
vrai(cout({ prix: 500, quantite: 0 }).unites === 1 && cout({ prix: 500, quantite: 0 }).problemes.length === 1, "quantité invalide ramenée à 1");
vrai(cout({ id: "z" }).invalide && cout({ prix: -1 }).invalide, "prix manquant ou négatif : offre invalide");

const O = [
  { id: "a", nom: "Boutique A", prix: 2999, livraison: 499 },
  { id: "b", nom: "Boutique B", prix: 3499, reductionPct: 20, livraison: 390, livraisonOfferteDes: 2500 },
  { id: "c", nom: "Boutique C", prix: 2799, livraison: 690, frais: 150 },
  { id: "d", nom: "Sans prix" },
];
const r = comparer(O);
egal(r.classement.map((c) => [c.rang, c.id, c.total, c.ecart, c.ecartPct]), [[1, "b", 2799, 0, 0], [2, "a", 3498, 699, 25], [3, "c", 3639, 840, 30]], "classement, écart en euros et en %");
egal([r.meilleur, r.economie, r.memeQuantite, r.invalides.map((x) => x.id)], ["b", 840, true, ["d"]], "meilleure offre, économie, offre invalide écartée");
vrai(r.texte.startsWith("Meilleure offre : Boutique B, 8,40 € de moins que Boutique C.") && r.texte.includes("+6,99 € (+25 %)"), "texte lisible");

const P = [
  { id: "x", nom: "Pack de 6", prix: 540, contenance: 6 },
  { id: "y", nom: "À l'unité", prix: 99, quantite: 6 },
  { id: "z", nom: "Pack de 24", prix: 1990, contenance: 24, livraison: 300 },
];
const q = comparer(P);
egal(q.classement.map((c) => [c.id, c.parUnite, c.ecart, c.ecartPct]), [["x", 90, 0, 0], ["z", 95.42, 130, 6], ["y", 99, 54, 10]], "quantités différentes : classement au prix unitaire");
vrai(!q.memeQuantite && q.texte.includes("à quantité égale") && q.texte.includes("(0,90 € l'unité)"), "texte au prix unitaire");
egal(comparer(P, { par: "total" }).classement.map((c) => c.id), ["x", "y", "z"], "classement au total si demandé");
const eg = comparer([{ id: "u", nom: "U", prix: 1000 }, { id: "v", nom: "V", prix: 900, livraison: 100 }]);
vrai(eg.classement.every((c) => c.rang === 1) && eg.texte.startsWith("Offres au même coût : U, V."), "égalité de coût");
egal(comparer([{ id: "w" }]).texte, "Aucune offre valable à comparer.", "aucune offre valable");
egal(comparer([{ id: "s", nom: "Seule", prix: 100 }]).texte.split("\n")[0], "Une seule offre : Seule.", "une seule offre");
fin("at-comparateur");
