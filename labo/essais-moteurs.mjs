// Laboratoire · essais du moteur Claude et du routage automatique : `node labo/essais-moteurs.mjs`
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { versMessagesClaude, complexite } from "../js/noyau/moteurs.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const appels = []; let gemini429 = false, claudeCredit = false;
const rep = (texte) => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" , _t: texte });
const fetchFictif = async (u, o) => {
  u = String(u); const corps = o && o.body ? JSON.parse(o.body) : {};
  if (u.includes("anthropic")) {
    appels.push({ moteur: "claude", corps, h: o.headers });
    if (claudeCredit) return { ok: false, status: 400, json: async () => ({ error: { message: "Your credit balance is too low" } }) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "tool_use", id: "x", name: "repondre", input: { texte: "Réponse de Claude.", ton: "calme", confiance: "moyenne", sources: [] } }], usage: { input_tokens: 900, output_tokens: 100 } }) };
  }
  if (u.includes("generativelanguage")) {
    appels.push({ moteur: "gemini", corps });
    if (gemini429) return { ok: false, status: 429, json: async () => ({ error: { message: "quota" } }) };
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "repondre", args: { texte: "Réponse de Gemini.", ton: "calme", confiance: "moyenne", sources: [] } } }] } }], usageMetadata: { totalTokenCount: 50 } }) };
  }
  if (u.includes("groq.com")) {
    appels.push({ moteur: "libre", corps, h: o.headers });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "repondre", arguments: JSON.stringify({ texte: "Réponse du relais.", ton: "calme", confiance: "moyenne", sources: [] }) } }] } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }) };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
};
const h = creerHubSimule({ vide: true, cle: "AIza-test", cleClaude: "sk-ant-test", fetch: fetchFictif });
const n = await creerNoyau({ delaiConfirmation: 50 });
ok(/Auto/.test(n.statut().moteur), "deux clés présentes : mode Auto par défaut (" + n.statut().moteur + ")");
ok(complexite("Quelle heure ?") === 0 && complexite("Compare Python et Rust, analyse les avantages et inconvénients, puis explique pourquoi tu recommandes l'un des deux pour un projet de longue durée avec plusieurs contributeurs ?") >= 2, "complexité : simple = 0, exigeante ≥ 2");
let r = await n.poser("Salut, ça va ?"); ok(/Gemini/.test(r.texte) && appels.at(-1).moteur === "gemini", "demande simple → Gemini (gratuit)");
r = await n.poser("Compare Python et Rust, analyse les avantages et inconvénients, puis explique pourquoi tu recommandes l'un des deux pour un projet de longue durée avec plusieurs contributeurs ?");
ok(/Claude/.test(r.texte) && appels.at(-1).moteur === "claude", "demande exigeante → Claude");
const c = appels.at(-1); ok(c.h["x-api-key"] === "sk-ant-test" && c.h["anthropic-version"] && c.h["anthropic-dangerous-direct-browser-access"] === "true", "en-têtes de l'API Claude");
ok(c.corps.tool_choice && (c.corps.tool_choice.type === "tool" || c.corps.tool_choice.type === "any") && c.corps.tools.some((t) => t.name === "repondre" && t.input_schema), "outils au format Claude (input_schema)");
const g = appels.filter((a) => a.moteur === "gemini").at(-1);
ok(c.corps.system === g.corps.systemInstruction.parts[0].text.replace(/Tes dernières réponses[\s\S]*$/, "") || c.corps.system.split("# Extraits")[0] === g.corps.systemInstruction.parts[0].text.split("# Extraits")[0], "même instruction système (cerveau et règles) pour les deux moteurs");
ok(n.statut().claude.jetons === 1000 && n.statut().claude.requetes === 1, "jetons et requêtes Claude comptés à part : " + n.statut().claude.jetons);
ok(n.budget.utilisees() >= 1 && n.budget.utilisees() <= 2, "le compteur Gemini reste le sien : " + n.budget.utilisees());
gemini429 = true; const avant = appels.length; r = await n.poser("Dis bonjour simplement.");
ok(/Claude/.test(r.texte), "Gemini en quota → Claude prend le relais, sans erreur");
gemini429 = false; claudeCredit = true;
r = await n.poser("Compare le thé et le café, analyse les avantages et inconvénients, puis explique pourquoi tu préfères l'un des deux, avec des exemples concrets sur une semaine entière ?");
ok(/Gemini/.test(r.texte), "crédit Claude épuisé → Gemini prend le relais");
claudeCredit = false;
n.jetonsClaude.definirPlafond(1000); r = await n.poser("Compare Python et Rust, analyse les avantages et inconvénients, puis explique pourquoi tu recommandes l'un des deux pour un long projet ?");
ok(/Gemini/.test(r.texte), "plafond de jetons Claude atteint → Gemini seul");
const m = versMessagesClaude([{ role: "user", texte: "q" }, { role: "assistant", texte: "", appels: [{ nom: "lire_taches", params: {} }, { nom: "lire_notes", params: {} }], brut: { role: "model", parts: [] } }, { role: "outil", resultats: [{ nom: "lire_taches", contenu: "A" }] }]);
ok(m[1].content.length === 1 && m[1].content[0].type === "tool_use" && m[2].content[0].tool_use_id === m[1].content[0].id, "conversion : un tool_use sans résultat est retiré, les identifiants se correspondent");
h.hote.reglage.ecrire("noyau-routage", "gemini"); claudeCredit = false; n.jetonsClaude.definirPlafond(60000); const nb = appels.length;
r = await n.poser("Compare Python et Rust, analyse les avantages et inconvénients, puis explique pourquoi tu recommandes l'un des deux ?");
ok(/Gemini/.test(r.texte) && appels.length === nb + 1, "routage « toujours Gemini »");
const sans = creerHubSimule({ vide: true, cle: "AIza-test", fetch: fetchFictif }); const n2 = await creerNoyau(); const avant2 = appels.length; r = await n2.poser("Compare Python et Rust, analyse les avantages et inconvénients, puis explique pourquoi ?");
ok(/Gemini/.test(r.texte) && /Gemini/.test(n2.statut().moteur), "sans clé Claude : comportement inchangé, Gemini seul");
// ----- relais gratuit -----
const hL = creerHubSimule({ vide: true, cle: "AIza-test", cleLibre: "gsk-test", fetch: fetchFictif });
const nL = await creerNoyau(); ok(/relais|Groq/i.test(nL.statut().moteur) && /Auto/.test(nL.statut().moteur), "clé de relais seule : mode Auto avec relais (" + nL.statut().moteur + ")");
gemini429 = false; r = await nL.poser("Salut !"); ok(/Gemini/.test(r.texte), "le relais n'est jamais utilisé avant Gemini");
gemini429 = true; r = await nL.poser("Dis bonjour."); ok(/relais/i.test(r.texte) && appels.at(-1).moteur === "libre", "Gemini en quota et pas de Claude → le relais gratuit répond");
const L = appels.at(-1); ok(L.h.authorization === "Bearer gsk-test" && L.corps.tools[0].type === "function" && L.corps.messages[0].role === "system", "format OpenAI : en-tête Bearer, outils function, message système");
const mo = (await import("../js/noyau/moteurs.js")).versMessagesOpenAI([{ role: "user", texte: "q" }, { role: "assistant", texte: "", appels: [{ nom: "lire_taches", params: {} }, { nom: "lire_notes", params: {} }] }, { role: "outil", resultats: [{ nom: "lire_taches", contenu: "A" }] }], "S");
ok(mo[2].tool_calls.length === 1 && mo[3].role === "tool" && mo[3].tool_call_id === mo[2].tool_calls[0].id, "conversion OpenAI : appel sans résultat retiré, identifiants liés");
gemini429 = false;
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
