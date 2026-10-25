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
      if (m.brut && m.brut.parts) out.push(m.brut);                              // contenu d'origine, signatures de réflexion comprises
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
    if (!cle) throw new ErreurNoyau("cle", "Aucune clé Gemini : colle-la dans le panneau de l'orbe (clic sur l'orbe, engrenage).");
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

// ---------- Claude (API Anthropic, facturée à part) ----------
// Même instruction système, mêmes outils, même format de réponse que Gemini : la mémoire et les réactions du Noyau ne changent pas.
// Il a son propre plafond (requêtes ET jetons par jour). La clé est celle de Lucien, gardée chiffrée par le coffre.
export const CLAUDE_API = "https://api.anthropic.com/v1/messages";
export const MODELE_CLAUDE_DEFAUT = "claude-haiku-5-5";
export const PLAFOND_CLAUDE_DEFAUT = 20, JETONS_CLAUDE_DEFAUT = 60000;

/** Jetons Claude du jour (entrée + sortie), avec plafond. */
export function creerBudgetJetons({ cleReglage = "noyau-jetons-claude", cleMax = "noyau-plafond-jetons-claude", plafondParDefaut = JETONS_CLAUDE_DEFAUT } = {}) {
  const jour = () => { const d = hote.maintenant(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const lire = () => { try { const b = JSON.parse(hote.reglage.lire(cleReglage, "null")); return b && b.jour === jour() ? b : { jour: jour(), n: 0 }; } catch (e) { return { jour: jour(), n: 0 }; } };
  const plafond = () => { const v = parseInt(hote.reglage.lire(cleMax, ""), 10); return v > 0 ? v : plafondParDefaut; };
  return { plafond, utilises: () => lire().n, restant: () => Math.max(plafond() - lire().n, 0), definirPlafond: (n) => hote.reglage.ecrire(cleMax, String(Math.max(1000, Math.min(n | 0, 2000000)))), ajouter(n) { const b = lire(); b.n += Math.max(0, n | 0); hote.reglage.ecrire(cleReglage, JSON.stringify(b)); } };
}

export function versMessagesClaude(messages) {
  const out = []; let ids = [], seq = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") out.push({ role: "user", content: [{ type: "text", text: String(m.texte || "") }] });
    else if (m.role === "assistant") {
      const suiv = messages[i + 1], repondus = suiv && suiv.role === "outil" ? suiv.resultats.length : 0;      // un tool_use sans résultat serait refusé
      const appels = (m.appels || []).slice(0, repondus); ids = appels.map(() => "toolu_" + (++seq));
      const contenu = [...(m.texte ? [{ type: "text", text: m.texte }] : []), ...appels.map((a, k) => ({ type: "tool_use", id: ids[k], name: a.nom, input: a.params || {} }))];
      if (contenu.length) out.push({ role: "assistant", content: contenu });
    } else if (m.role === "outil") out.push({ role: "user", content: m.resultats.map((r, k) => ({ type: "tool_result", tool_use_id: ids[k] || "toolu_0", content: String(r.contenu) })) });
  }
  return out;
}

export function moteurClaude({ cle = null, modele = MODELE_CLAUDE_DEFAUT, budget = null, budgetJetons = null, delaiMax = 45000 } = {}) {
  if (!cle) return { nom: "Claude (sans clé)", type: "claude", coupe: true, versClaude, async generer() { throw new ErreurNoyau("cle", "Aucune clé Claude : colle-la dans Noyau → Réglages."); } };
  async function appeler(corps) {
    if (!hote.enLigne()) throw new ErreurNoyau("hors_ligne", "Hors ligne : Claude n'est pas joignable.");
    if (budget) budget.reserver();
    if (budgetJetons && budgetJetons.restant() <= 0) throw new ErreurNoyau("budget", "Plafond de jetons Claude du jour atteint.");
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null, minuteur = ctl ? setTimeout(() => ctl.abort(), delaiMax) : 0;
    let r;
    try { r = await hote.fetch(CLAUDE_API, { method: "POST", headers: { "x-api-key": cle, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json" }, body: JSON.stringify(corps), signal: ctl ? ctl.signal : undefined }); }
    catch (e) { throw new ErreurNoyau(e && e.name === "AbortError" ? "delai" : "reseau", e && e.name === "AbortError" ? "Claude n'a pas répondu à temps." : "Connexion à Claude impossible."); }
    finally { clearTimeout(minuteur); }
    if (r.ok) return r.json();
    let msg = ""; try { msg = ((await r.json()).error || {}).message || ""; } catch (e) { msg = ""; }
    if (r.status === 401 || r.status === 403) throw new ErreurNoyau("cle", "Clé Claude refusée : vérifie-la dans la console Anthropic.");
    if (r.status === 400 && /credit/i.test(msg)) throw new ErreurNoyau("credit", "Crédit Claude épuisé : recharge dans la console Anthropic.");
    if (r.status === 429) throw new ErreurNoyau("quota", "Limite de débit Claude atteinte : réessaie dans une minute.");
    throw new ErreurNoyau("reseau", "Claude répond " + r.status + (msg ? " : " + msg.slice(0, 120) : ""));
  }
  return {
    nom: "Claude · " + modele, modele, type: "claude", versClaude,
    async generer({ systeme, messages, outils = [], forcer = null, temperature = 0.6 }) {
      const t0 = Date.now();
      const corps = { model: modele, max_tokens: 1800, temperature, system: systeme, messages: versMessagesClaude(messages) };
      if (outils.length) { corps.tools = versClaude(outils); corps.tool_choice = forcer && forcer.length === 1 ? { type: "tool", name: forcer[0] } : { type: "any" }; }
      const j = await appeler(corps);
      const bloc = Array.isArray(j.content) ? j.content : [];
      if (!bloc.length) throw new ErreurNoyau("refus_securite", "Claude n'a pas donné de réponse (" + (j.stop_reason || "vide") + ").");
      const u = j.usage || {}, total = (u.input_tokens || 0) + (u.output_tokens || 0);
      if (budgetJetons) budgetJetons.ajouter(total);
      return { texte: bloc.filter((x) => x.type === "text").map((x) => x.text).join(""), appels: bloc.filter((x) => x.type === "tool_use").map((x) => ({ nom: x.name, params: x.input || {} })), brut: null, usage: { entree: u.input_tokens || 0, sortie: u.output_tokens || 0, total }, ms: Date.now() - t0 };
    }
  };
}


// ---------- Fournisseurs gratuits compatibles OpenAI (relais de durabilité) ----------
// Les offres gratuites changent : le modèle reste modifiable dans Réglages. Aucune clé n'est dans le code.
export const FOURNISSEURS_LIBRES = {
  groq: { nom: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", modele: "llama-3.3-70b-versatile", lien: "console.groq.com" },
  mistral: { nom: "Mistral", url: "https://api.mistral.ai/v1/chat/completions", modele: "mistral-small-latest", lien: "console.mistral.ai" },
  openrouter: { nom: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", modele: "meta-llama/llama-3.3-70b-instruct:free", lien: "openrouter.ai/keys" },
  cerebras: { nom: "Cerebras", url: "https://api.cerebras.ai/v1/chat/completions", modele: "llama-3.3-70b", lien: "cloud.cerebras.ai" }
};
export const PLAFOND_LIBRE_DEFAUT = 30;
export function versOpenAI(outils) {
  return outils.map((o) => ({ type: "function", function: { name: o.nom, description: o.description, parameters: schemaPropre(o.params && o.params.type ? o.params : { type: "object", properties: {} }) } }));
}
export function versMessagesOpenAI(messages, systeme) {
  const out = [{ role: "system", content: String(systeme || "") }]; let ids = [], seq = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") out.push({ role: "user", content: String(m.texte || "") });
    else if (m.role === "assistant") {
      const suiv = messages[i + 1], repondus = suiv && suiv.role === "outil" ? suiv.resultats.length : 0;
      const appels = (m.appels || []).slice(0, repondus); ids = appels.map(() => "call_" + (++seq));
      if (!m.texte && !appels.length) continue;
      const o = { role: "assistant", content: m.texte || null }; if (appels.length) o.tool_calls = appels.map((a, k) => ({ id: ids[k], type: "function", function: { name: a.nom, arguments: JSON.stringify(a.params || {}) } }));
      out.push(o);
    } else if (m.role === "outil") m.resultats.forEach((r, k) => out.push({ role: "tool", tool_call_id: ids[k] || "call_0", content: String(r.contenu) }));
  }
  return out;
}
export function moteurLibre({ fournisseur = "groq", cle = null, modele = "", budget = null, delaiMax = 45000 } = {}) {
  const f = FOURNISSEURS_LIBRES[fournisseur] || FOURNISSEURS_LIBRES.groq, mod = modele || f.modele;
  if (!cle) return { nom: f.nom + " (sans clé)", type: "libre", coupe: true, async generer() { throw new ErreurNoyau("cle", "Aucune clé " + f.nom + "."); } };
  return {
    nom: f.nom + " · " + mod, modele: mod, type: "libre", versOpenAI,
    async generer({ systeme, messages, outils = [], forcer = null, temperature = 0.6 }) {
      const t0 = Date.now();
      if (!hote.enLigne()) throw new ErreurNoyau("hors_ligne", "Hors ligne : " + f.nom + " n'est pas joignable.");
      if (budget) budget.reserver();
      const corps = { model: mod, max_tokens: 1800, temperature, messages: versMessagesOpenAI(messages, systeme) };
      if (outils.length) { corps.tools = versOpenAI(outils); corps.tool_choice = forcer && forcer.length === 1 ? { type: "function", function: { name: forcer[0] } } : "required"; }
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null, minuteur = ctl ? setTimeout(() => ctl.abort(), delaiMax) : 0; let r;
      try { r = await hote.fetch(f.url, { method: "POST", headers: { authorization: "Bearer " + cle, "content-type": "application/json" }, body: JSON.stringify(corps), signal: ctl ? ctl.signal : undefined }); }
      catch (e) { throw new ErreurNoyau(e && e.name === "AbortError" ? "delai" : "reseau", f.nom + " n'a pas répondu."); }
      finally { clearTimeout(minuteur); }
      if (!r.ok) {
        let msg = ""; try { msg = ((await r.json()).error || {}).message || ""; } catch (e) { msg = ""; }
        if (r.status === 401 || r.status === 403) throw new ErreurNoyau("cle", "Clé " + f.nom + " refusée.");
        if (r.status === 429 || r.status === 402) throw new ErreurNoyau("quota", "Limite " + f.nom + " atteinte.");
        throw new ErreurNoyau("reseau", f.nom + " répond " + r.status + (msg ? " : " + String(msg).slice(0, 120) : ""));
      }
      const j = await r.json(), ch = (j.choices || [])[0], mess = ch && ch.message; if (!mess) throw new ErreurNoyau("refus_securite", f.nom + " n'a pas donné de réponse.");
      const u = j.usage || {};
      return { texte: mess.content || "", appels: (mess.tool_calls || []).map((c) => { let p = {}; try { p = JSON.parse(c.function.arguments || "{}"); } catch (e) { p = {}; } return { nom: c.function.name, params: p }; }), brut: null, usage: { entree: u.prompt_tokens || 0, sortie: u.completion_tokens || 0, total: u.total_tokens || 0 }, ms: Date.now() - t0 };
    }
  };
}

// ---------- Routage automatique : les moteurs sont actifs ensemble ----------
const RAISONNEMENT = /\b(compare|compar|analyse|analyser|explique pourquoi|argument|strategie|decision|decider|arbitr|critique|relis|plan en|etapes|avantages|inconvenients|synthese|redige|code|algorithme|demonstr|pourquoi)\b/;
/** Complexité estimée d'une demande, sans requête : 0 (simple) à 4 (exigeante). */
export function complexite(texte) {
  const t = String(texte || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); let c = 0;
  if (t.length > 280) c++; if (t.length > 700) c++;
  if (RAISONNEMENT.test(t)) c++;
  if ((t.match(/\?/g) || []).length >= 2) c++;
  if (/\b(et aussi|ensuite|puis|d'abord)\b/.test(t)) c++;
  return Math.min(c, 4);
}
/**
 * Choisit pour chaque tour : Gemini (gratuit) pour le courant, Claude pour l'exigeant tant qu'il lui reste des jetons ;
 * si le moteur choisi échoue (quota, réseau, crédit), l'autre prend le relais. Le choix reste le même pendant tout un tour.
 */
export function moteurAuto({ gemini, claude, libre = null, jetons, preference = () => "auto", seuil = 2, surChoix = () => {} }) {
  let tour = null;                                        // { choix } pour le tour en cours
  const L = () => (typeof libre === "function" ? libre() : libre), G = () => (typeof gemini === "function" ? gemini() : gemini), C = () => (typeof claude === "function" ? claude() : claude);
  const dispo = (m) => m && !m.coupe;
  const claudeOk = () => dispo(C()) && (!jetons || jetons.restant() > 500);
  const ordre = (messages) => {
    const dernier = [...messages].reverse().find((m) => m.role === "user"), debut = messages.length <= 1 || messages[messages.length - 1].role === "user";
    if (tour && !debut) return tour.ordre;
    const pref = preference(), gem = G(), cla = C(), g = dispo(gem), c = claudeOk(); let o;
    if (pref === "claude" && c) o = [cla, gem]; else if (pref === "gemini" && g) o = [gem, cla];
    else {
      const x = complexite(dernier ? dernier.texte : ""), serre = jetons && jetons.restant() < jetons.plafond() * 0.2;
      o = c && (x >= seuil + (serre ? 1 : 0) || !g) ? [cla, gem] : [gem, cla];
    }
    const lib = L(); if (dispo(lib)) o.push(lib);
    tour = { ordre: o.filter(Boolean) }; return tour.ordre;
  };
  return {
    get nom() { const l = L(); return "Auto · Gemini + Claude" + (dispo(l) ? " + " + l.nom.split(" ·")[0] : ""); }, type: "auto", auto: true,
    async generer(entree) {
      const liste = ordre(entree.messages); let derniere = null;
      for (const m of liste.filter((x) => x && !x.coupe)) {
        try { const r = await m.generer(entree); r.moteur = m.type === "claude" ? "Claude" : m.type === "libre" ? m.nom.split(" ·")[0] : "Gemini"; if (tour) tour.ordre = [m, ...tour.ordre.filter((x) => x !== m)]; surChoix(r.moteur); return r; }
        catch (e) { derniere = e; if (!(e instanceof ErreurNoyau) || !["quota", "reseau", "delai", "credit", "budget", "cle"].includes(e.code)) throw e; }
      }
      throw derniere || new ErreurNoyau("cle", "Aucun moteur disponible (ni clé Gemini, ni clé Claude).");
    }
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
