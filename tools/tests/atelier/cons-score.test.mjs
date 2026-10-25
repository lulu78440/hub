// Essais du moteur cons-score (données factices).
import { normaliser, lireMotsCles, scorer, trier, expliquer } from "../../../js/widgets/moteurs/cons-score.js";
import { vrai, egal, fin } from "./_outil.mjs";

egal(normaliser("Jeux Vidéo : l'Œuvre « Élue » !"), "jeux video l oeuvre elue", "normalisation accents et ponctuation");
const p = lireMotsCles("IA, steam*2, -bourse\njeu vidéo, ia, ");
egal(p.map((k) => [k.n, k.poids, k.exclu]), [["ia", 1, false], ["steam", 2, false], ["bourse", 1, true], ["jeu video", 1, false]], "lecture des mots-clés (doublon retiré)");
egal(lireMotsCles("x*99")[0].poids, 5, "poids plafonné à 5");

const A = [
  { titre: "Steam baisse ses prix", lien: "https://a.test/1", date: "2026-10-20T10:00:00Z", cat: "JEUX VIDÉO", source: "a.test" },
  { titre: "La bourse chute", lien: "https://a.test/2", date: "2026-10-25T10:00:00Z", cat: "FRANCE", source: "b.test" },
  { titre: "Nouveaux jeux vidéo de l'IA", lien: "https://a.test/3", date: "2026-10-22T10:00:00Z", cat: "TECH & IA", source: "c.test" },
  { titre: "Sans date", lien: "https://a.test/4", cat: "MONDE", source: "d.test" },
  { titre: "Le jeudi de l'iPhone", lien: "https://a.test/5", date: "2026-10-24T10:00:00Z", cat: "TECH", source: "e.test" },
];
const s0 = scorer(A[0], p);
egal(s0.score, 5, "steam dans le titre (2 × 2) + jeu vidéo dans la catégorie (1)");
vrai(s0.pourquoi.includes("steam (titre)"), "pourquoi lisible");
const s2 = scorer(A[2], p);
egal(s2.trouves.map((t) => t.mot), ["IA", "jeu vidéo"], "expression et pluriel (jeux vidéo)");
egal(scorer(A[4], p).score, 0, "« jeu » ne trouve pas « jeudi », « ia » ne trouve pas « iPhone »");
vrai(scorer(A[1], p).score < 0 && scorer(A[1], p).pourquoi.startsWith("écarté"), "mot écarté fait descendre");
egal(expliquer([]), "Aucun de tes mots-clés.", "pourquoi vide");

const avant = JSON.stringify(A);
const chrono = trier(A, p);
egal(chrono.map((a) => a.lien.slice(-1)), ["2", "5", "3", "1", "4"], "chrono : plus récent d'abord, sans date à la fin");
const pert = trier(A, p, "pertinence");
egal(pert.map((a) => a.lien.slice(-1)), ["1", "3", "5", "4", "2"], "pertinence : score puis date");
egal(trier(A, p, "pertinence", { masquerNegatifs: true }).length, 4, "masquer les négatifs");
egal(trier(A, p, "chrono", { masquerNegatifs: true }).length, 5, "le mode chrono ne masque jamais rien");
egal(JSON.stringify(A), avant, "articles d'origine non modifiés");
egal(trier([{ titre: "a", date: "2026-01-02" }, { titre: "b", date: "2026-01-03" }], "", "pertinence").map((a) => a.titre), ["b", "a"], "à score égal, la date départage");
egal(trier(null, "").length, 0, "entrée vide tolérée");
vrai(trier([null, 3, {}], "ia").length === 1, "entrées abîmées ignorées");
fin("cons-score");
