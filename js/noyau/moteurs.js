// Noyau · moteurs (contrat, sections 1 et 7) : Gemini (actif), local WebLLM (secours PC), Claude (écrit mais COUPÉ), script (essais).
// Tous partagent la même interface :
//   moteur.generer({ systeme, messages, outils, forcer }) -> { texte, appels: [{ nom, params }], brut, usage, ms }
// avec des messages neutres : { role: "user", texte } | { role: "assistant", texte, appels, brut } | { role: "outil", resultats: [{ nom, contenu }] }.
// Règles de coût : la clé passe dans l'en-tête x-goog-api-key (jamais dans l'adresse), Flash-Lite par défaut, une SEULE nouvelle
// tentative après « quota atteint », jamais de bascule silencieuse vers un autre modèle, budget quotidien compté ici.
import { hote } from "./hote.js";

export const GAPI = "https://generativelanguage.googleapis.com/v1beta";
export const MODELE_DEFAUT = "gemini-flash-lite-latest";
export const PLAFOND_DEFAUT = 40;

export class ErreurNoyau extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ---------- Budget de requêtes par jour ----------
export function creerBudget({ cleReglage = "noyau-budget", cleMax = "noyau-plafond", plafondParDefaut = PLAFOND_DEFAUT } = {}) {
  const jour = () => { const d = hote.maintenant(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const lire = () => { try { const b = JSON.parse(hote.reglage.lire(cleReglage, "null")); return b && b.jour === jour() ? b : { jour: jour(), n: 0 }; } catch (e) { return { jour: jour(), n: 0 }; } };
  const plafond = () => { const v = parseInt(hote.reglage.lire(cleMax, ""), 10); return v > 0 ? v : plafondParDefaut; };
  return {
    plafond, utilisees: () => lire().n, restant: () => Math.max(plafond() - lire().n, 0),
    definirPlafond: (n) => hote.reglage.ecrire(cleMax, String(Math.max(1, Math.min(n | 0, 1500)))),
    /** Réserve une requête ; refuse au-delà du plafond. */
    reserver() {
      const b = lire();
      if (b.n >= plafond()) throw new ErreurNoyau("budget", `Budget du jour atteint (${b.n} requêtes sur ${plafond()}). Le Noyau continue en mode réduit jusqu'à demain, ou relève le plafond dans les réglages.`);
      b.n++; hote.reglage.ecrire(cleReglage, JSON.stringify(b)); return b.n;
    }
  };
}

// ---------- Conversion du catalogue neutre ----------
const GARDER = ["type", "description", "enum", "items", "properties", "required"];
function schemaPropre(s) {
  if (!s || typeof s !== "object") return s;
  const o = {};
  for (const k of GARDER) if (s[k] !== undefined) o[k] = k === "properties" ? Object.fromEntries(Object.entries(s[k]).map(([n, d]) => [n, schemaPropre(d)])) : k === "items" ? schemaPropre(s[k]) : s[k];
  if (Array.isArray(o.required) && !o.required.length) delete o.required;
  return o;
}
export function versGemini(outils) {
  return [{ functionDeclarations: outils.map((o) => {
    const d = { name: o.nom, description: o.description };
    if (o.params && o.params.properties && Object.keys(o.params.properties).length) d.parameters = schemaPropre(o.params);
    return d;
  }) }];
}
export function versClaude(outils) {
  return outils.map((o) => ({ name: o.nom, description: o.description, input_schema: schemaPropre(o.params && o.params.type ? o.params : { type: "object", properties: {} }) }));
}

function versContenusGemini(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", parts: [{ text: m.texte }] });
    else if (m.role === "assistant") {
      if (m.brut) out.push(m.brut);                              // contenu d'origine, signatures de réflexion comprises
      else out.push({ role: "model", parts: [...(m.texte ? [{ text: m.texte }] : []), ...(m.appels || []).map((a) => ({ functionCall: { name: a.nom, args: a.params || {} } }))] });
    } else if (m.role === "outil") out.push({ role: "user", parts: m.resultats.map((r) => ({ functionResponse: { name: r.nom, response: { resultat: r.contenu } } })) });
  }
  return out;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Gemini ----------
export function moteurGemini({ cle, modele = MODELE_DEFAUT, budget, attenteQuota = 8000, delaiMax = 45000 }) {
  async function appeler(corps, essai = 0) {
    if (!hote.enLigne()) throw new ErreurNoyau("hors_ligne", "Hors ligne : Gemini n'est pas joignable.");
    if (!cle) throw new ErreurNoyau("cle", "Aucune clé Gemini : colle-la dans les réglages du Noyau.");
    if (budget) budget.reserver();
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const minuteur = ctl ? setTimeout(() => ctl.abort(), delaiMax) : 0;
    let r;
    try {
      r = await hote.fetch(`${GAPI}/models/${encodeURIComponent(modele)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": cle, "Content-Type": "application/json" }, body: JSON.stringify(corps), signal: ctl ? ctl.signal : undefined });
    } catch (e) {
      throw new ErreurNoyau(e && e.name === "AbortError" ? "delai" : "reseau", e && e.name === "AbortError" ? "Gemini n'a pas répondu à temps." : "Connexion à Gemini impossible.");
    } finally { clearTimeout(minuteur); }
    if (r.ok) return r.json();
    let msg = ""; try { msg = ((await r.json()).error || {}).message || ""; } catch (e) { msg = ""; }
    if (r.status === 429) {
      if (essai === 0) { await attendre(attenteQuota); return appeler(corps, 1); }          // une seule nouvelle tentative
      throw new ErreurNoyau("quota", "Quota gratuit atteint : réessaie dans une minute (ou demain).");
    }
    if (r.status === 400 && /api key/i.test(msg)) throw new ErreurNoyau("cle", "Clé refusée par Google : vérifie-la dans AI Studio.");
    if (r.status === 403 || r.status === 401) throw new ErreurNoyau("cle", "Clé sans accès à l'API Gemini.");
    throw new ErreurNoyau("reseau", "Gemini répond " + r.status + (msg ? " : " + msg.slice(0, 120) : ""));
  }
  return {
    nom: "Gemini · " + modele, modele, type: "gemini",
    async generer({ systeme, messages, outils = [], forcer = null, temperature = 0.6 }) {
      const t0 = Date.now();
      const corps = {
        systemInstruction: { parts: [{ text: systeme }] },
        contents: versContenusGemini(messages),
        generationConfig: { temperature, maxOutputTokens: 1800 }
      };
      if (outils.length) {
        corps.tools = versGemini(outils);
        corps.toolConfig = { functionCallingConfig: forcer && forcer.length ? { mode: "ANY", allowedFunctionNames: forcer } : { mode: "ANY" } };
      }
      const j = await appeler(corps);
      const c = j.candidates && j.candidates[0];
      if (!c || !c.content) {
        const raison = (j.promptFeedback && j.promptFeedback.blockReason) || (c && c.finishReason) || "vide";
        throw new ErreurNoyau("refus_securite", "Gemini n'a pas donné de réponse (" + raison + ").");
      }
      const parts = c.content.parts || [];
      const appels = parts.filter((p) => p.functionCall).map((p) => ({ nom: p.functionCall.name, params: p.functionCall.args || {} }));
      const texte = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
      const u = j.usageMetadata || {};
      return { texte, appels, brut: c.content, usage: { entree: u.promptTokenCount || 0, sortie: u.candidatesTokenCount || 0, total: u.totalTokenCount || 0 }, ms: Date.now() - t0 };
    }
  };
}

// ---------- Claude : écrit, COUPÉ (l'API est facturée à part ; contrat, principe 4) ----------
export function moteurClaude() {
  return {
    nom: "Claude (coupé)", type: "claude", coupe: true, versClaude,
    async generer() { throw new ErreurNoyau("coupe", "Le moteur Claude est coupé : l'API Claude est facturée à part."); }
  };
}

// ---------- Local WebLLM (secours PC) : texte seulement, chargé seulement si Lucien l'active ----------
// Non testé dans l'espace de travail de Claude (pas de WebGPU) : à essayer sur le PC de Lucien (étape 5).
export function moteurLocal({ id = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", surProgres = () => {} } = {}) {
  let mlc = null;
  return {
    nom: "IA locale · " + id, type: "local", texteSeulement: true,
    async preparer() {
      if (mlc) return;
      if (typeof navigator === "undefined" || !navigator.gpu) throw new ErreurNoyau("local", "WebGPU indisponible : l'IA locale ne marche que sur le PC (Brave récent).");
      const lib = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2/+esm");
      mlc = await lib.CreateMLCEngine(id, { initProgressCallback: (r) => surProgres(r.text) });
    },
    async generer({ systeme, messages }) {
      const t0 = Date.now(); await this.preparer();
      const msgs = [{ role: "system", content: systeme }, ...messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.texte || "" }))];
      const r = await mlc.chat.completions.create({ messages: msgs, temperature: 0.6, max_tokens: 500 });
      return { texte: (r.choices[0] && r.choices[0].message.content) || "", appels: [], brut: null, usage: { entree: 0, sortie: 0, total: 0 }, ms: Date.now() - t0 };
    }
  };
}

// ---------- Moteur à script : essais et banc d'essai (aucune requête, aucun quota) ----------
/** `scenario(entree)` reçoit { systeme, messages, outils, forcer, numero } et renvoie { texte?, appels? } ou une erreur à lever. */
export function moteurScript(scenario, { nom = "Moteur à script (essais)" } = {}) {
  let n = 0;
  return {
    nom, type: "script", appelsFaits: () => n,
    async generer(entree) {
      n++; const t0 = Date.now();
      const r = await scenario({ ...entree, numero: n });
      return { texte: r.texte || "", appels: r.appels || [], brut: null, usage: { entree: 0, sortie: 0, total: 0 }, ms: Date.now() - t0 + (r.ms || 0) };
    }
  };
}
