// Essais du moteur at-simulateur (options et critères factices).
import { normaliser, comparer, sensibilite } from "../../../js/widgets/moteurs/at-simulateur.js";
import { vrai, egal, leve, fin } from "./_outil.mjs";

egal(normaliser([{ poids: 3 }, { poids: 2 }, { poids: 5 }]), [0.3, 0.2, 0.5], "poids normalisés");
egal(normaliser([{ poids: 0 }, { poids: -1 }]), [0.5, 0.5], "tous nuls : poids égaux");
egal(normaliser([{ poids: 1 }, { poids: "x" }]), [1, 0], "poids invalide compté 0");

const C = [{ id: "prix", nom: "Prix", poids: 3, sens: "bas" }, { id: "conf", nom: "Confort", poids: 2 }, { id: "auto", nom: "Autonomie", poids: 5 }];
const O = [
  { id: "a", nom: "Vélo A", notes: { prix: 6, conf: 7, auto: 8 } },
  { id: "b", nom: "Vélo B", notes: { prix: 3, conf: 9, auto: 6 } },
  { id: "c", nom: "Vélo C", notes: { prix: 8, conf: 5, auto: 9 } },
];
const r = comparer(O, C);
egal(r.classement.map((x) => [x.rang, x.id, x.score]), [[1, "b", 6.9], [2, "a", 6.6], [3, "c", 6.1]], "classement et scores sur 10 (prix : plus bas = mieux)");
egal(r.classement[0].detail, { prix: 2.1, conf: 1.8, auto: 3 }, "détail des contributions");
egal([r.poids, r.ecartPremier, r.egalite, r.problemes], [{ prix: 0.3, conf: 0.2, auto: 0.5 }, 0.3, false, []], "poids, écart, sans problème");
vrai(r.texte.startsWith("En tête : Vélo B (6,9/10)") && r.texte.includes("3. Vélo C — 6,1/10"), "texte lisible");
const memeEchelle = comparer(O, C.map((c) => ({ ...c, poids: c.poids * 10 })));
egal(memeEchelle.classement.map((x) => x.score), r.classement.map((x) => x.score), "l'échelle des poids ne change rien");

const eg = comparer([{ id: "x", notes: { q: 5 } }, { id: "y", notes: { q: 5 } }, { id: "z", notes: { q: 2 } }], [{ id: "q", poids: 1 }]);
egal([eg.classement.map((x) => x.rang), eg.egalite], [[1, 1, 3], true], "égalité : même rang, rang suivant sauté");
vrai(eg.texte.startsWith("Égalité en tête : x, y"), "égalité annoncée");
const pb = comparer([{ id: "x", nom: "X", notes: { q: 12 } }, { id: "y", nom: "Y", notes: {} }], [{ id: "q", nom: "Qualité", poids: 1 }]);
egal(pb.classement.map((x) => x.score), [10, 0], "note hors bornes ramenée, note absente à 0");
egal(pb.problemes.length, 2, "les deux anomalies sont signalées");
leve(() => comparer([], C), "aucune option refusée");
leve(() => comparer(O, []), "aucun critère refusé");

const s = sensibilite(O, C);
egal(s.premier, "Vélo B", "premier actuel");
egal(s.plusFragile, { id: "auto", nom: "Autonomie", sens: "hausse", points: 6.5, nouveauPremier: "Vélo A" }, "critère le plus fragile : +6,5 points d'autonomie");
egal(s.criteres.find((c) => c.id === "prix").baisse, { points: 7.8, nouveauPremier: "Vélo A" }, "baisse du poids du prix");
egal(s.criteres.find((c) => c.id === "prix").hausse, null, "hausse du prix : B reste premier");
vrai(s.texte.includes("6,5 points") && s.texte.includes("augmenter « Autonomie »"), "texte de sensibilité");
const solide = sensibilite([{ id: "x", nom: "X", notes: { a: 9, b: 9 } }, { id: "y", nom: "Y", notes: { a: 1, b: 2 } }], [{ id: "a", poids: 1 }, { id: "b", poids: 1 }]);
vrai(solide.plusFragile === null && solide.texte.includes("choix solide"), "option dominante : choix solide");
egal(sensibilite(O, [{ id: "auto", poids: 1 }]).plusFragile, null, "un seul critère : aucune sensibilité");
fin("at-simulateur");
