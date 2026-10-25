// Génère docs/manuel/index.json depuis les fiches : `node labo/manuel-index.mjs` (échoue si une fiche est invalide).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parserFiche, validerFiche, entreeIndex } from "../js/noyau/manuel.js";
const dossier = new URL("../docs/manuel/fiches/", import.meta.url);
let ko = 0; const index = [];
for (const nom of readdirSync(dossier).filter((n) => n.endsWith(".md")).sort()) {
  const { fiche, erreur } = parserFiche(readFileSync(new URL(nom, dossier), "utf8"));
  const pb = erreur ? [erreur] : validerFiche(fiche);
  if (!erreur && fiche.id + ".md" !== nom) pb.push("le nom du fichier doit être <id>.md");
  if (pb.length) { ko++; console.log(`✗ ${nom} : ${pb.join(" ; ")}`); continue; }
  index.push(entreeIndex(fiche, "docs/manuel/fiches/" + nom));
}
if (ko) process.exit(1);
writeFileSync(new URL("../docs/manuel/index.json", import.meta.url), JSON.stringify(index, null, 1) + "\n");
console.log(`${index.length} fiche(s) indexée(s).`);
