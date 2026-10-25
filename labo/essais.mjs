// Laboratoire · banc d'essai en ligne de commande : `node labo/essais.mjs [famille] [--detail]`.
// Rejoue labo/scenarios.json sur un hub simulé (aucune requête réseau, aucun quota). Code de sortie 1 si un scénario mécanique échoue.
import { readFileSync } from "node:fs";
import { lancerBanc } from "./banc.js";
const args = process.argv.slice(2), detail = args.includes("--detail"), famille = args.find((a) => !a.startsWith("--"));
const { scenarios } = JSON.parse(readFileSync(new URL("./scenarios.json", import.meta.url), "utf8"));
const out = await lancerBanc(scenarios, { famille }, (r) => {
  const sym = r.ok === true ? "✓" : r.ok === false ? "✗" : "–";
  console.log(`${sym} ${r.id.padEnd(26)} ${r.titre}${r.saute ? "  [" + r.saute + "]" : ""}`);
  if (r.ok === false) r.ecarts.forEach((e) => console.log("    ↳ " + e));
});
console.log(`\n${out.ok} réussi(s), ${out.ko} raté(s), ${out.sautes} sauté(s) (moteur réel requis) sur ${out.total}.`);
process.exit(out.ko ? 1 : 0);
