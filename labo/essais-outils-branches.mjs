// Laboratoire · essais des 5 outils branchés (25/10) : `node labo/essais-outils-branches.mjs` (hôte simulé, aucune requête réelle)
import { readFileSync } from "node:fs";
import { brancher } from "../js/noyau/hote.js";
import { creerCatalogue } from "../js/noyau/outils.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const kv = new Map(), col = { tasks: [], events: [] };
const racine = new URL("../", import.meta.url);
brancher({ nom: "test", maintenant: () => new Date("2026-10-25T22:00:00"), nouvelId: (p = "") => p + Math.random().toString(36).slice(2, 8),
  fetch: async (u) => { const t = (() => { try { return readFileSync(new URL(String(u).replace(/^http:\/\/local\//, ""), racine), "utf8"); } catch { return null; } })(); return { ok: t != null, text: async () => t, json: async () => JSON.parse(t) }; },
  stockage: { tout: async (c) => col[c] || [], lire: async (c, id) => c === "kv" ? kv.get(id) : null, ecrire: async (c, o) => { if (c === "kv") kv.set(o.id, o); } } });
const cat = creerCatalogue({ raccourcis: () => ({}) }); const T = (n) => cat.find((o) => o.nom === n);
let r = await T("consulter_manuel").exec({ question: "mode focus concentration" });
ok(/DONNÉES du manuel/.test(r.manuel) && /Focus/i.test(r.manuel), "consulter_manuel rend une fiche encadrée comme donnée");
r = await T("consulter_manuel").exec({ question: "zzzqxy inconnu" });
ok(/AUCUNE FICHE/.test(r.manuel), "question sans fiche : le modèle doit dire qu'il ne sait pas");
r = await T("proposer_decision").exec({ decision: "Courses le samedi", raison: "plus calme" });
ok(r.enregistree && kv.get("noyau-decisions").lignes.length === 1, "proposer_decision enregistre (après validation, faite par la barrière)");
r = await T("chercher_decisions").exec({ question: "courses" });
ok(r.decisions.length === 1 && r.decisions[0].decision === "Courses le samedi", "chercher_decisions retrouve la décision");
await T("proposer_decision").exec({ decision: "Courses le mardi", raison: null });
r = await T("lire_contradictions").exec({}); ok(Array.isArray(r.signaux) && r.signaux.length <= 3, "lire_contradictions : au plus 3 signaux, lecture seule");
const avant = JSON.stringify(kv.get("noyau-decisions")); await T("lire_contradictions").exec({}); ok(JSON.stringify(kv.get("noyau-decisions")) === avant, "lire_contradictions ne modifie rien");
const rt = { id: "matin", nom: "Matin", declencheur_json: '{"type":"heure","heure":"08:00"}', etapes: [{ outil: "lire_agenda" }, { outil: "lire_taches" }] };
r = await T("creer_routine").exec(rt); ok(r.lancee === false && kv.get("noyau-routines").lignes.length === 1, "creer_routine enregistre sans rien lancer");
r = await T("creer_routine").exec({ ...rt, nom: "Matin v2" }); ok(r.remplacee && kv.get("noyau-routines").lignes.length === 1, "même id : modifiée, pas dupliquée");
for (const mauvais of [{ ...rt, id: "x1", etapes: [{ outil: "outil_inconnu" }] }, { ...rt, id: "x2", etapes: [{ outil: "creer_routine" }] }, { ...rt, id: "x3", declencheur_json: "pas du json" }]) {
  let e = null; try { await T("creer_routine").exec(mauvais); } catch (x) { e = x.message; } ok(e, "routine refusée : " + e);
}
ok(kv.get("noyau-routines").lignes.length === 1, "aucune routine invalide n'est enregistrée");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
