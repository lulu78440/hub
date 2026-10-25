// Laboratoire · contrôle des fiches de rattrapage à valider : `node labo/essais-manuel-rattrapage.mjs`
import { readdirSync, readFileSync } from "node:fs";
import { parserFiche, validerFiche } from "../js/noyau/manuel.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const dossier = new URL("../docs/labo-auto/manuel-a-valider/", import.meta.url), ids = new Set();
const noms = readdirSync(dossier).filter((n) => n.endsWith(".md"));
for (const nom of noms) {
  const { fiche, erreur } = parserFiche(readFileSync(new URL(nom, dossier), "utf8")); const pb = erreur ? [erreur] : validerFiche(fiche);
  if (!erreur && fiche.id + ".md" !== nom) pb.push("nom de fichier ≠ id"); if (!erreur && ids.has(fiche.id)) pb.push("id en double"); if (!erreur) ids.add(fiche.id);
  if (!erreur && fiche.statut_emplacement !== "provisoire") pb.push("avant la fin de la refonte, l'emplacement doit rester provisoire");
  ok(pb.length === 0, nom + (pb.length ? " : " + pb.join(" ; ") : ""));
}
ok(noms.length >= 12, noms.length + " fiches de rattrapage");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
