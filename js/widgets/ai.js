// Phase 6 · Assistant IA du noyau. Deux moteurs au choix :
// 1) LOCAL : un petit modèle qui tourne DANS Brave, sur la carte graphique du PC (WebGPU, bibliothèque libre WebLLM).
//    0 €, sans compte, rien ne quitte le PC. Gros téléchargement unique, PC seulement, réponses simples.
// 2) GEMINI (ajout du cahier du 24/10, « Noyau IA ») : l'assistant préparé dans Google AI Studio.
//    Clé API gratuite, sans carte bancaire, collée par Lucien et gardée CHIFFRÉE sur l'appareil par le coffre
//    (le verrouillage doit être actif) ; jamais dans le code ni dans le dépôt, jamais exportée ni synchronisée.
//    Les questions (et, si tu le veux, le résumé de ta journée) partent chez Google. Marche aussi sur le téléphone.
// Le noyau d'abord : clic sur l'orbe → « Parler au noyau ». Puis l'entité : réveillée quand l'IA est prête ;
// clic droit sur une fenêtre → « Demander à l'entité » (résume ce qu'elle voit).
import { store } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { vault } from "../store/vault.js";
import { extendMenu } from "../ui/menus.js";
import { onBackground } from "../ui/dom.js";
import { daysFrom, dayKey } from "./when.js";
import { state, pulse } from "../state.js";

const LIB = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2/+esm";
const GAPI = "https://generativelanguage.googleapis.com/v1beta";
const KEY = "hub-secret-ia";
const MODELS = [
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", nom: "Qwen 2.5 · 1,5 milliard (conseillé, ~1 Go)" },
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", nom: "Qwen 2.5 · 0,5 milliard (léger, ~0,4 Go)" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", nom: "Llama 3.2 · 1 milliard (~0,9 Go)" }
];
const SYSTEM = "Tu es le noyau holographique du hub personnel de Lucien. Tu réponds en français, en phrases courtes et claires, avec chaleur et une touche futuriste discrète. Tu ne peux rien modifier dans le hub : tu conseilles seulement. Si tu ne sais pas, dis-le.";

// ---------- Gemini ----------
async function gfetch(path, key, opts = {}) {
  const r = await fetch(GAPI + path, { ...opts, headers: { "x-goog-api-key": key, ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
  if (r.ok) return r;
  let msg = ""; try { msg = ((await r.json()).error || {}).message || ""; } catch (e) { msg = ""; }
  if (r.status === 400 && /api key/i.test(msg)) throw new Error("Clé refusée par Google : vérifie-la dans AI Studio");
  if (r.status === 403) throw new Error("Clé sans accès à l'API Gemini (ou API non activée sur ce projet)");
  if (r.status === 429) throw new Error("Quota gratuit atteint : réessaie dans une minute (ou demain)");
  throw new Error("Gemini répond " + r.status + (msg ? " : " + msg.slice(0, 120) : ""));
}
/** Modèles de texte disponibles pour cette clé (les « flash » d'abord : ce sont ceux de l'offre gratuite). */
async function geminiModels(key) {
  const d = await (await gfetch("/models?pageSize=200", key)).json();
  const ok = (d.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/.test(m.name) && !/image|tts|audio|live|embed|vision|robotics|computer/i.test(m.name));
  const id = (m) => m.name.replace(/^models\//, "");
  return ok.map((m) => ({ id: id(m), nom: m.displayName || id(m) })).sort((a, b) => (/flash/.test(b.id) - /flash/.test(a.id)) || (/latest/.test(b.id) - /latest/.test(a.id)));
}
function geminiEngine(key, model) {
  return {
    nom: "Gemini · " + model,
    async stream(messages, onText) {
      const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const contents = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const r = await gfetch(`/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, key, { method: "POST", body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } }) });
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", txt = "";
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          try { const j = JSON.parse(line.slice(5)); const c = j.candidates && j.candidates[0]; const parts = (c && c.content && c.content.parts) || []; txt += parts.map((p) => (p.thought ? "" : p.text || "")).join(""); onText(txt); } catch (e) { /* morceau incomplet */ }
        }
      }
      return txt;
    }
  };
}

export function initAI({ force }) {
  const lite = state.lite;
  let engine = null, loading = false, history = [];
  const panel = document.createElement("div"); panel.className = "aip"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Parler au noyau");
  panel.innerHTML = '<div class="aih"><b>NOYAU · IA</b><span class="ais"></span><button type="button" class="btn aicfg" aria-label="Choisir le moteur" title="Choisir le moteur">⚙</button><button type="button" class="btn aix" aria-label="Fermer">✕</button></div><div class="ailog" aria-live="polite"></div><form class="addrow aiq" autocomplete="off"><input class="inl" type="text" maxlength="1200" placeholder="Pose ta question… (Entrée)" aria-label="Question"></form>';
  document.body.append(panel);
  const log = panel.querySelector(".ailog"), stat = panel.querySelector(".ais"), form = panel.querySelector(".aiq"), inp = form.querySelector("input");
  const say = (who, text) => { const p = document.createElement("p"); p.className = who; p.textContent = text; log.append(p); log.scrollTop = log.scrollHeight; return p; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const stop = (e) => e.stopPropagation();

  async function context() {
    const tasks = (await store.all("tasks")).filter((t) => !t.done).slice(0, 15);
    const evs = (await store.all("events")).filter((e) => e.date >= dayKey() && daysFrom(e.date) <= 7).sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || ""))).slice(0, 12);
    const notes = (await store.all("notes")).sort((a, b) => b.updated - a.updated).slice(0, 5);
    let wx = null; try { wx = JSON.parse(prefs.get("meteo-cache", "null")); } catch (e) { wx = null; }
    const now = new Date();
    return [
      `Nous sommes le ${now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, il est ${now.toTimeString().slice(0, 5)}.`,
      wx && wx.data && wx.data.current ? `Météo à ${wx.name || "sa position"} : ${Math.round(wx.data.current.temperature_2m)} °C.` : "",
      tasks.length ? "Tâches à faire : " + tasks.map((t) => t.text + (t.due ? ` (pour le ${t.due})` : "") + (t.prio ? " [urgent]" : "")).join(" ; ") + "." : "Aucune tâche à faire.",
      evs.length ? "Rendez-vous des 7 prochains jours : " + evs.map((e) => `${e.date}${e.start ? " " + e.start : ""} ${e.title}`).join(" ; ") + "." : "Aucun rendez-vous cette semaine.",
      notes.length ? "Notes récentes : " + notes.map((n) => n.text.slice(0, 80).replace(/\n/g, " ")).join(" | ") + "." : ""
    ].filter(Boolean).join("\n");
  }
  async function systemText() {
    const gem = engine && engine.gemini;
    const base = gem ? (prefs.get("ia-instructions", "") || SYSTEM) : SYSTEM;
    if (gem && !prefs.on("ia-journee")) return base + "\n\n" + `Nous sommes le ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}.`;
    return base + "\n\nCe que tu sais de la journée de Lucien :\n" + await context();
  }
  function ready(e) {
    engine = e; stat.textContent = e.nom; history = [];
    log.innerHTML = ""; say("ai", "Je suis réveillé. Demande-moi ta journée, une idée, un résumé…");
    force.entity.setAwake && force.entity.setAwake(true); pulse(1.5);
  }

  // ---------- Choix du moteur ----------
  function chooseModel() {
    log.innerHTML = ""; stat.textContent = "";
    const box = el("div", "aimodels");
    say("sys", "Choisis le moteur du noyau :");
    const g = el("button", "btn", "Gemini · ton assistant Google AI Studio (en ligne, clé gratuite)"); g.type = "button"; g.addEventListener("click", geminiSetup); box.append(g);
    if (!lite) {
      if (navigator.gpu) MODELS.forEach((m) => { const b = el("button", "btn", "Local · " + m.nom); b.type = "button"; b.addEventListener("click", () => load(m.id)); box.append(b); });
      else box.append(el("p", "sys", "IA locale : WebGPU n'est pas disponible dans ce navigateur. Mets Brave à jour ; sinon active « brave://flags/#enable-unsafe-webgpu », puis relance Brave."));
    }
    log.append(box);
    if (!lite) say("sys", "Local : tourne sur ton PC, rien n'est envoyé, téléchargement unique de 0,4 à 1 Go. Gemini : plus intelligent, marche aussi sur le téléphone, mais tes questions partent chez Google.");
  }
  async function load(id) {
    if (loading) return; loading = true;
    log.innerHTML = ""; const p = say("sys", "Préparation…"); const bar = el("div", "aibar"); bar.innerHTML = "<u></u>"; log.append(bar);
    try {
      const webllm = await import(/* @vite-ignore */ LIB);
      const mlc = await webllm.CreateMLCEngine(id, { initProgressCallback: (r) => { p.textContent = r.text.replace(/Fetching param cache/i, "Téléchargement").replace(/Loading model from cache/i, "Chargement depuis le cache"); bar.firstChild.style.width = Math.round((r.progress || 0) * 100) + "%"; } });
      prefs.set("ia-modele", id); prefs.set("ia-moteur", "local");
      ready({ nom: MODELS.find((m) => m.id === id).nom.split(" (")[0], async stream(messages, onText) {
        const chunks = await mlc.chat.completions.create({ messages, stream: true, temperature: 0.6, max_tokens: 400 });
        let txt = ""; for await (const c of chunks) { txt += (c.choices[0] && c.choices[0].delta && c.choices[0].delta.content) || ""; onText(txt); }
        return txt;
      } });
    } catch (e) { p.textContent = "Échec du chargement : " + (e && e.message ? e.message : e); bar.remove(); }
    finally { loading = false; }
  }
  function geminiSetup() {
    log.innerHTML = "";
    if (!vault.active) {
      say("sys", "Pour Gemini, active d'abord le verrouillage de l'espace perso (Diag → Verrouillage) : ta clé sera gardée chiffrée sur l'appareil, jamais en clair.");
      const b = el("button", "btn", "← Retour"); b.type = "button"; b.addEventListener("click", chooseModel); log.append(b); return;
    }
    const f = el("form", "aiform"); f.autocomplete = "off";
    f.innerHTML = `<ol class="sys"><li>Ouvre <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio · Clés API ↗</a> avec ton compte Google (gratuit, sans carte bancaire, 18 ans et plus).</li>
      <li>« Créer une clé API », copie-la et colle-la ci-dessous. Ne la mets jamais dans GitHub.</li>
      <li>Si tu as préparé ton assistant dans AI Studio, copie ses « Instructions système » dans la case Instructions.</li></ol>
      <p class="sys">Bon à savoir : en Europe, Google applique à l'usage gratuit les règles de l'offre payante (tes questions ne servent pas à entraîner ses modèles). Elles transitent quand même par Google.</p>`;
    const k = el("input", "inl"); k.type = "password"; k.placeholder = vault.lsGet(KEY) ? "Clé enregistrée (laisse vide pour la garder)" : "Clé API (AIza…)"; k.autocomplete = "off";
    const ins = el("textarea", "inl"); ins.rows = 4; ins.placeholder = "Instructions de l'assistant (vide = celles du noyau)"; ins.value = prefs.get("ia-instructions", "");
    const lab = el("label", "chkl"), cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = prefs.on("ia-journee"); lab.append(cb, document.createTextNode(" Partager le résumé de ma journée (tâches, agenda, météo, notes récentes)"));
    const sel = el("select", "inl"); sel.hidden = true;
    const msg = el("p", "sys"), row = el("div", "erow");
    const back = el("button", "btn", "Retour"); back.type = "button"; back.addEventListener("click", chooseModel);
    const ok = el("button", "btn ok", "Vérifier et enregistrer"); ok.type = "submit";
    row.append(back, ok); f.append(k, ins, lab, sel, msg, row); log.append(f);
    [k, ins].forEach((x) => x.addEventListener("keydown", stop));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const key = k.value.trim() || vault.lsGet(KEY) || "";
      if (!key) { msg.textContent = "Colle d'abord ta clé."; k.focus(); return; }
      ok.disabled = true; msg.textContent = "Vérification auprès de Google…";
      try {
        if (sel.hidden) {
          const list = await geminiModels(key);
          if (!list.length) throw new Error("Aucun modèle Gemini disponible pour cette clé");
          list.forEach((m) => { const o = el("option", "", m.nom + " (" + m.id + ")"); o.value = m.id; sel.append(o); });
          const saved = prefs.get("ia-gemini-modele", ""); sel.value = list.some((m) => m.id === saved) ? saved : (list.find((m) => m.id === "gemini-flash-latest") || list[0]).id;
          sel.hidden = false; msg.textContent = "Clé valable. Choisis le modèle (les « Flash » sont dans l'offre gratuite), puis valide."; ok.textContent = "Enregistrer"; ok.disabled = false; return;
        }
        vault.lsSet(KEY, key); prefs.set("ia-instructions", ins.value.trim()); prefs.setOn("ia-journee", cb.checked);
        prefs.set("ia-gemini-modele", sel.value); prefs.set("ia-moteur", "gemini");
        const eng = geminiEngine(key, sel.value); eng.gemini = true; ready(eng);
      } catch (err) { msg.textContent = err.message; ok.disabled = false; }
    });
    setTimeout(() => k.focus(), 50);
  }

  async function ask(q, extra = "") {
    if (!engine) { open(); return; }
    say("me", q); const out = say("ai", "…"); state.energyTarget = 0.8; state.accent = 0x9b72ff;
    try {
      const messages = [{ role: "system", content: await systemText() + (extra ? "\n\n" + extra : "") }, ...history.slice(-8), { role: "user", content: q }];
      const txt = await engine.stream(messages, (t) => { out.textContent = t; log.scrollTop = log.scrollHeight; });
      if (!txt) out.textContent = "(pas de réponse)";
      history.push({ role: "user", content: q }, { role: "assistant", content: txt });
    } catch (e) { out.className = "sys"; out.textContent = "Erreur : " + e.message; }
    finally { state.energyTarget = 0; state.accent = null; }
  }
  function open() {
    panel.hidden = false;
    if (!engine && !loading) {
      const m = prefs.get("ia-moteur", prefs.get("ia-modele", "") ? "local" : "");
      const key = vault.lsGet(KEY);
      if (m === "gemini" && key && vault.active) { const eng = geminiEngine(key, prefs.get("ia-gemini-modele", "gemini-flash-latest")); eng.gemini = true; ready(eng); }
      else if (m === "local" && !lite && navigator.gpu && prefs.get("ia-modele", "")) load(prefs.get("ia-modele", ""));
      else chooseModel();
    }
    setTimeout(() => inp.focus(), 50);
  }
  const close = () => { panel.hidden = true; };
  panel.querySelector(".aix").addEventListener("click", close);
  panel.querySelector(".aicfg").addEventListener("click", () => { if (!loading) { engine = null; chooseModel(); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); const q = inp.value.trim(); if (!q) return; inp.value = ""; ask(q); });
  inp.addEventListener("keydown", (e) => { stop(e); if (e.key === "Escape") close(); });

  // Clic court sur l'orbe (l'appui long reste pour l'énergie de la souris)
  const anchor = document.getElementById("anchor");
  let down = null, clickT = 0;
  addEventListener("pointerdown", (e) => { if (e.button === 0 && onBackground(e.target)) down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  addEventListener("pointerup", (e) => {
    if (!down) return; const d = down; down = null;
    if (performance.now() - d.t > 450 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    const r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(40, Math.min(r.width, r.height) * 0.3);
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < R && prefs.on("ia")) { clearTimeout(clickT); clickT = setTimeout(open, 300); }   // attend : un double-clic change de plan
  });
  addEventListener("dblclick", () => clearTimeout(clickT));
  extendMenu("fond", () => prefs.on("ia") ? [{ t: "Parler au noyau (IA)", fn: open }] : []);
  const box = document.getElementById("surprises");
  if (box) {
    const lab = el("label", "chkl"), cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = prefs.on("ia");
    cb.addEventListener("change", () => { prefs.setOn("ia", cb.checked); if (!cb.checked) close(); });
    lab.append(cb, document.createTextNode(" IA du noyau (clic sur l'orbe)")); box.append(lab);
  }
  extendMenu("fenetre", (w) => !prefs.on("ia") ? [] : [{ t: "Demander à l'entité", fn: () => { open(); const title = w.querySelector("h2").textContent, txt = (w.querySelector(".pb") || w).innerText.slice(0, 1500); if (engine) ask(`Que vois-tu dans la fenêtre « ${title} » ? Résume l'essentiel en 3 points.`, `Contenu de la fenêtre « ${title} » :\n${txt}`); } }]);
  return { open, ask, get ready() { return !!engine; } };
}
