// Phase 6 · Assistant IA, à 0 € et sans compte : un petit modèle de langage qui tourne DANS Brave, sur la carte graphique du PC (WebGPU),
// grâce à la bibliothèque libre WebLLM. Rien ne quitte le PC pendant les conversations.
// - Le noyau d'abord : clic sur l'orbe → « Parler au noyau ». Il connaît ta journée (tâches, rendez-vous, météo, notes récentes).
// - Puis l'entité : réveillée quand l'IA est prête (yeux ouverts) ; clic droit sur une fenêtre → « Demander à l'entité » (résume ce qu'elle voit).
// Limites honnêtes : gros téléchargement unique (0,4 à 1 Go, gardé ensuite par Brave), PC avec WebGPU seulement (pas le téléphone),
// réponses plus simples qu'un grand assistant en ligne. La bibliothèque est chargée depuis jsDelivr au premier usage.
import { store } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { toast } from "../ui/toast.js";
import { extendMenu, registerMenu } from "../ui/menus.js";
import { onBackground } from "../ui/dom.js";
import { daysFrom, dayKey } from "./when.js";
import { state, pulse } from "../state.js";

const LIB = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2/+esm";
const MODELS = [
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", nom: "Qwen 2.5 · 1,5 milliard (conseillé, ~1 Go)" },
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", nom: "Qwen 2.5 · 0,5 milliard (léger, ~0,4 Go)" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", nom: "Llama 3.2 · 1 milliard (~0,9 Go)" }
];

export function initAI({ force }) {
  if (state.lite) return {};
  let engine = null, loading = false, history = [];
  const panel = document.createElement("div"); panel.className = "aip"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Parler au noyau");
  panel.innerHTML = '<div class="aih"><b>NOYAU · IA LOCALE</b><span class="ais"></span><button type="button" class="btn aix" aria-label="Fermer">✕</button></div><div class="ailog" aria-live="polite"></div><form class="addrow aiq" autocomplete="off"><input class="inl" type="text" maxlength="600" placeholder="Pose ta question… (Entrée)" aria-label="Question"></form>';
  document.body.append(panel);
  const log = panel.querySelector(".ailog"), stat = panel.querySelector(".ais"), form = panel.querySelector(".aiq"), inp = form.querySelector("input");
  const say = (who, text) => { const p = document.createElement("p"); p.className = who; p.textContent = text; log.append(p); log.scrollTop = log.scrollHeight; return p; };

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
  const SYSTEM = "Tu es le noyau holographique du hub personnel de Lucien. Tu réponds en français, en phrases courtes et claires, avec chaleur et une touche futuriste discrète. Tu ne peux rien modifier dans le hub : tu conseilles seulement. Si tu ne sais pas, dis-le.";

  function chooseModel() {
    log.innerHTML = "";
    if (!navigator.gpu) { say("sys", "WebGPU n'est pas disponible dans ce navigateur. Mets Brave à jour ; sinon active « brave://flags/#enable-unsafe-webgpu », puis relance Brave."); stat.textContent = "indisponible"; return; }
    say("sys", "L'IA du noyau tourne entièrement sur ton PC. Premier lancement : un téléchargement unique, gardé ensuite par Brave. Choisis un modèle :");
    const box = document.createElement("div"); box.className = "aimodels";
    MODELS.forEach((m) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = m.nom; b.addEventListener("click", () => load(m.id)); box.append(b); });
    log.append(box);
  }
  async function load(id) {
    if (loading) return; loading = true;
    log.innerHTML = ""; const p = say("sys", "Préparation…"); const bar = document.createElement("div"); bar.className = "aibar"; bar.innerHTML = "<u></u>"; log.append(bar);
    try {
      const webllm = await import(/* @vite-ignore */ LIB);
      engine = await webllm.CreateMLCEngine(id, { initProgressCallback: (r) => { p.textContent = r.text.replace(/Fetching param cache/i, "Téléchargement").replace(/Loading model from cache/i, "Chargement depuis le cache"); bar.firstChild.style.width = Math.round((r.progress || 0) * 100) + "%"; } });
      prefs.set("ia-modele", id); stat.textContent = MODELS.find((m) => m.id === id).nom.split(" (")[0];
      log.innerHTML = ""; say("ai", "Je suis réveillé. Demande-moi ta journée, une idée, un résumé…");
      force.entity.setAwake && force.entity.setAwake(true); pulse(1.5);
    } catch (e) { p.textContent = "Échec du chargement : " + (e && e.message ? e.message : e); bar.remove(); }
    finally { loading = false; }
  }
  async function ask(q, extra = "") {
    if (!engine) { open(); return; }
    say("me", q); const out = say("ai", "…"); state.energyTarget = 0.8; state.accent = 0x9b72ff;
    try {
      const messages = [{ role: "system", content: SYSTEM + "\n\nCe que tu sais de la journée de Lucien :\n" + await context() + (extra ? "\n\n" + extra : "") }, ...history.slice(-6), { role: "user", content: q }];
      const chunks = await engine.chat.completions.create({ messages, stream: true, temperature: 0.6, max_tokens: 400 });
      let txt = ""; for await (const c of chunks) { txt += (c.choices[0] && c.choices[0].delta && c.choices[0].delta.content) || ""; out.textContent = txt; log.scrollTop = log.scrollHeight; }
      history.push({ role: "user", content: q }, { role: "assistant", content: txt });
    } catch (e) { out.textContent = "Erreur : " + e.message; }
    finally { state.energyTarget = 0; state.accent = null; }
  }
  function open() {
    panel.hidden = false;
    if (!engine && !loading) { const saved = prefs.get("ia-modele", ""); if (saved && navigator.gpu) load(saved); else chooseModel(); }
    setTimeout(() => inp.focus(), 50);
  }
  const close = () => { panel.hidden = true; };
  panel.querySelector(".aix").addEventListener("click", close);
  form.addEventListener("submit", (e) => { e.preventDefault(); const q = inp.value.trim(); if (!q) return; inp.value = ""; ask(q); });
  inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });

  // Clic court sur l'orbe (l'appui long reste pour l'énergie de la souris)
  const anchor = document.getElementById("anchor");
  let down = null;
  addEventListener("pointerdown", (e) => { if (e.button === 0 && onBackground(e.target)) down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  addEventListener("pointerup", (e) => {
    if (!down) return; const d = down; down = null;
    if (performance.now() - d.t > 450 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    const r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(40, Math.min(r.width, r.height) * 0.3);
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < R && prefs.on("ia")) { clearTimeout(clickT); clickT = setTimeout(open, 300); }   // attend : un double-clic change de plan
  });
  let clickT = 0;
  addEventListener("dblclick", () => clearTimeout(clickT));
  extendMenu("fond", () => prefs.on("ia") ? [{ t: "Parler au noyau (IA locale)", fn: open }] : []);
  const box = document.getElementById("surprises");
  if (box) {
    const lab = document.createElement("label"); lab.className = "chkl";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = prefs.on("ia");
    cb.addEventListener("change", () => { prefs.setOn("ia", cb.checked); if (!cb.checked) close(); });
    lab.append(cb, document.createTextNode(" IA locale du noyau (clic sur l'orbe)")); box.append(lab);
  }
  extendMenu("fenetre", (el) => !prefs.on("ia") ? [] : [{ t: "Demander à l'entité", fn: () => { open(); const title = el.querySelector("h2").textContent, txt = (el.querySelector(".pb") || el).innerText.slice(0, 1500); if (engine) ask(`Que vois-tu dans la fenêtre « ${title} » ? Résume l'essentiel en 3 points.`, `Contenu de la fenêtre « ${title} » :\n${txt}`); } }]);
  return { open, ask, get ready() { return !!engine; } };
}
