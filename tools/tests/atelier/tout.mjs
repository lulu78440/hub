// Lance tous les essais des moteurs de l'Atelier : node tools/tests/atelier/tout.mjs
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ici = dirname(fileURLToPath(import.meta.url));
let echec = 0;
for (const f of readdirSync(ici).filter((f) => f.endsWith(".test.mjs")).sort()) {
  const r = spawnSync(process.execPath, [join(ici, f)], { encoding: "utf8" });
  process.stdout.write(r.stdout + r.stderr);
  if (r.status !== 0) echec++;
}
if (echec) { console.log(`${echec} fichier(s) d'essais en échec.`); process.exitCode = 1; } else console.log("Tous les moteurs de l'Atelier : Tout est bon");
