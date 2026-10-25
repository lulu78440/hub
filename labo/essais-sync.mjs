// Laboratoire · fusion des journaux entre deux appareils : `node labo/essais-sync.mjs`
import { fusionnerLignes } from "../js/store/fusion.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const L = (id, quand) => ({ id, quand });
const pc = { id: "noyau-journal", lignes: [L("a", "2026-10-25T10:00"), L("b", "2026-10-25T10:05"), L("c", "2026-10-25T11:00")] };
const tel = { id: "noyau-journal", lignes: [L("a", "2026-10-25T10:00"), L("b", "2026-10-25T10:05"), L("d", "2026-10-25T10:30")] };
const m1 = fusionnerLignes(pc, tel), m2 = fusionnerLignes(tel, pc);
ok(m1 && m1.lignes.map((x) => x.id).join("") === "abdc", "union dans l'ordre du temps : " + (m1 && m1.lignes.map((x) => x.id).join("")));
ok(m2 && m2.lignes.map((x) => x.id).join("") === "abdc", "même résultat dans l'autre sens (commutatif)");
ok(fusionnerLignes(m1, tel) === null && fusionnerLignes(m1, m2) === null, "refusionner ne change rien (idempotent)");
ok(fusionnerLignes({ id: "x", texte: "a" }, { id: "x", texte: "b" }) === null, "un document sans lignes n'est pas concerné");
const grand = { lignes: Array.from({ length: 6 }, (_, i) => L("g" + i, "2026-10-25T0" + i)) }; ok(fusionnerLignes({ lignes: [] }, grand, 4).lignes.length === 4, "plafond respecté");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
