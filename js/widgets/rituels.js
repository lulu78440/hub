// Phase 7.1 · Rituels (idées de la Boîte à idées de Lucien : « Anneaux d'habitudes » et « Météo intérieure »).
// - Anneaux d'habitudes : sport, lecture, eau… chacun a un objectif du jour ; l'anneau se remplit à chaque « + ».
//   Sur le PC, les anneaux tournent aussi autour du noyau (plan 1). Séries de jours tenus.
// - Météo intérieure : l'humeur du jour d'un clic ; le noyau prend sa couleur ; grille des 8 dernières semaines.
// Données (collection kv, donc synchronisées et chiffrées comme le reste) :
//   « rituels-config » = { habits: [{ id, name, goal, unit }] } ; « rit-AAAA-MM-JJ » = { counts: { idHabitude: n }, mood: 1..5 }.
import { store } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { dayKey, addDays, fromKey } from "./when.js";
import { state, pulse } from "../state.js";

const CFG = "rituels-config";
const COLORS = ["#ffb347", "#9b72ff", "#3fe6ff", "#4fe3a8", "#ff6b9a", "#ffe066"];
export const MOODS = [
  { v: 1, ic: "⛈", nom: "Orage", col: 0x4d6bff, css: "#4d6bff" },
  { v: 2, ic: "🌧", nom: "Pluie", col: 0x9b72ff, css: "#9b72ff" },
  { v: 3, ic: "⛅", nom: "Nuageux", col: null, css: "#3fe6ff" },
  { v: 4, ic: "🌤", nom: "Éclaircie", col: 0x4fe3a8, css: "#4fe3a8" },
  { v: 5, ic: "☀", nom: "Soleil", col: 0xffc861, css: "#ffc861" }
];
const DEFAULT = [{ id: "sport", name: "Sport", goal: 1, unit: "séance" }, { id: "lecture", name: "Lecture", goal: 1, unit: "chapitre" }, { id: "eau", name: "Eau", goal: 8, unit: "verres" }];
const rid = (k) => "rit-" + k;
const addK = (k, n) => dayKey(addDays(fromKey(k), n));
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "h";

export function initRituels({ force, plans } = {}) {
  const win = document.querySelector('.win[data-id="rituels"]'); if (!win) return {};
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag"), pf = win.querySelector(".pf");
  pb.className = "pb pb-rit";
  let habits = DEFAULT.slice(), days = {}, editing = false;
  const today = () => days[dayKey()] || { id: rid(dayKey()), counts: {} };
  const count = (d, h) => (d && d.counts && d.counts[h.id]) || 0;
  const colorOf = (i) => COLORS[i % COLORS.length];

  async function load() {
    const all = await store.all("kv");
    const cfg = all.find((x) => x.id === CFG);
    habits = cfg && Array.isArray(cfg.habits) && cfg.habits.length ? cfg.habits : DEFAULT.slice();
    days = {}; all.forEach((x) => { if (x.id.startsWith("rit-")) days[x.id.slice(4)] = x; });
    applyMood(); if (!editing) render();
  }
  async function saveDay(d) { d.id = rid(dayKey()); days[dayKey()] = d; await store.put("kv", d); }

  /** Jours d'affilée où l'objectif a été atteint (aujourd'hui compte s'il est atteint, sinon on part d'hier). */
  function streak(h) {
    let n = 0, k = dayKey();
    if (count(days[k], h) < h.goal) k = addK(k, -1);
    while (count(days[k], h) >= h.goal && n < 999) { n++; k = addK(k, -1); }
    return n;
  }
  function applyMood() {
    const m = MOODS.find((x) => x.v === today().mood);
    state.mood = m && prefs.on("rituels-teinte") ? m.col : null;
  }

  function ringsSVG(size) {
    const d = today(), c = size / 2, sw = Math.max(5, size / 16), gap = sw + 3;
    let s = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`;
    habits.forEach((h, i) => {
      const r = c - sw / 2 - 2 - i * gap; if (r < 8) return;
      const p = Math.min(1, count(d, h) / h.goal), L = 2 * Math.PI * r, col = colorOf(i);
      s += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-opacity=".15" stroke-width="${sw}"/>`;
      if (p > 0) s += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(L * p).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 ${c} ${c})" style="filter:drop-shadow(0 0 4px ${col})"/>`;
    });
    return s + "</svg>";
  }
  function moodGrid() {
    // 8 semaines, colonnes = semaines (lundi en haut), la dernière contient aujourd'hui
    const t = fromKey(dayKey()), dow = (t.getDay() + 6) % 7, start = addK(dayKey(), -(7 * 7 + dow));
    let s = '<div class="rgrid" role="img" aria-label="Humeur des 8 dernières semaines">';
    for (let w = 0; w < 8; w++) for (let r = 0; r < 7; r++) {
      const k = addK(start, w * 7 + r), m = days[k] && MOODS.find((x) => x.v === days[k].mood), future = k > dayKey();
      s += `<i style="grid-column:${w + 1};grid-row:${r + 1};${m ? "background:" + m.css : ""}${future ? ";opacity:0" : ""}" title="${fromKey(k).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}${m ? " · " + m.nom : ""}"></i>`;
    }
    return s + "</div>";
  }

  function render() {
    const d = today();
    pb.innerHTML = "";
    const top = document.createElement("div"); top.className = "rtop";
    const rings = document.createElement("div"); rings.className = "rrings"; rings.innerHTML = ringsSVG(state.lite ? 112 : 104);
    const list = document.createElement("div"); list.className = "rlist";
    habits.forEach((h, i) => {
      const n = count(d, h), ok = n >= h.goal, st = streak(h);
      const row = document.createElement("div"); row.className = "rrow" + (ok ? " ok" : "");
      row.style.setProperty("--c", colorOf(i));
      row.innerHTML = '<span class="rdot"></span><span class="rname"></span><span class="rval"></span><button type="button" class="btn rm" aria-label="Moins">−</button><button type="button" class="btn rp" aria-label="Plus">+</button>';
      row.querySelector(".rname").textContent = h.name + (st > 1 ? "  · " + st + " j" : "");
      row.querySelector(".rval").textContent = n + "/" + h.goal + (h.unit ? " " + h.unit : "");
      row.querySelector(".rname").title = st ? `Série : ${st} jour${st > 1 ? "s" : ""} d'affilée` : "Objectif du jour : " + h.goal + " " + (h.unit || "");
      row.querySelector(".rm").addEventListener("click", () => bump(h, -1));
      row.querySelector(".rp").addEventListener("click", () => bump(h, +1));
      list.append(row);
    });
    top.append(rings, list);
    const mood = document.createElement("div"); mood.className = "rmood";
    const lab = document.createElement("span"); lab.className = "rlab"; lab.textContent = "Météo intérieure"; mood.append(lab);
    MOODS.forEach((m) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn rmb"; b.textContent = m.ic; b.title = m.nom; b.setAttribute("aria-label", "Humeur : " + m.nom);
      b.setAttribute("aria-pressed", String(d.mood === m.v)); b.style.setProperty("--c", m.css);
      b.addEventListener("click", () => setMood(d.mood === m.v ? null : m.v)); mood.append(b);
    });
    const grid = document.createElement("div"); grid.className = "rgw"; grid.innerHTML = moodGrid();
    pb.append(top, mood, grid);
    const done = habits.filter((h) => count(d, h) >= h.goal).length;
    tag.textContent = done + "/" + habits.length + " AUJOURD'HUI";
    if (pf) { pf.firstElementChild.textContent = "Clic droit : modifier les habitudes"; const m = MOODS.find((x) => x.v === d.mood); pf.lastElementChild.textContent = m ? m.ic + " " + m.nom : "humeur ?"; }
  }

  async function bump(h, dlt) {
    const d = { ...today(), counts: { ...today().counts } };
    const before = count(d, h), n = Math.max(0, before + dlt); if (n === before) return;
    d.counts[h.id] = n; await saveDay(d);
    if (dlt > 0 && n === h.goal) { pulse(1.2); toast(`${h.name} : objectif du jour atteint ✦`); flash = { id: h.id, t: 0 }; }
    render();
  }
  async function setMood(v) {
    const d = { ...today(), counts: { ...today().counts } };
    if (v) d.mood = v; else delete d.mood;
    await saveDay(d); applyMood(); pulse(0.8); render();
  }
  function edit() {
    editing = true; pb.innerHTML = "";
    const f = document.createElement("form"); f.className = "rform"; f.autocomplete = "off";
    f.innerHTML = '<b>Mes habitudes</b><p class="sys">Une par ligne : nom, objectif du jour, unité. Ex. « Eau 8 verres », « Méditation 10 min », « Sport 1 ». 6 au maximum.</p>';
    const ta = document.createElement("textarea"); ta.className = "inl"; ta.rows = 6;
    ta.value = habits.map((h) => `${h.name} ${h.goal}${h.unit ? " " + h.unit : ""}`).join("\n");
    ta.addEventListener("keydown", (e) => e.stopPropagation());
    const row = document.createElement("div"); row.className = "erow";
    const no = document.createElement("button"); no.type = "button"; no.className = "btn"; no.textContent = "Annuler"; no.addEventListener("click", () => { editing = false; render(); });
    const ok = document.createElement("button"); ok.type = "submit"; ok.className = "btn ok"; ok.textContent = "Enregistrer";
    row.append(no, ok); f.append(ta, row); pb.append(f); ta.focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const used = new Set(), list = ta.value.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6).map((l) => {
        const m = l.match(/^(.*?)\s+(\d{1,3})(?:\s+(.*))?$/), name = (m ? m[1] : l).trim().slice(0, 30), goal = m ? Math.max(1, +m[2]) : 1, unit = m && m[3] ? m[3].trim().slice(0, 16) : "";
        const old = habits.find((h) => h.name.toLowerCase() === name.toLowerCase());
        let id = old ? old.id : slug(name); while (used.has(id)) id += "2"; used.add(id);
        return { id, name, goal, unit };
      });
      if (!list.length) { toast("Garde au moins une habitude"); return; }
      habits = list; editing = false;
      await store.put("kv", { id: CFG, habits }); toast("Habitudes enregistrées"); render();
    });
  }

  registerMenu("rituels", () => [{ h: "Rituels" }, { t: "Modifier les habitudes", fn: edit },
    { t: (prefs.on("rituels-anneaux") ? "Masquer" : "Afficher") + " les anneaux autour du noyau", fn: () => prefs.setOn("rituels-anneaux", !prefs.on("rituels-anneaux")) },
    { t: (prefs.on("rituels-teinte") ? "Ne plus teinter" : "Teinter") + " le noyau selon l'humeur", fn: () => { prefs.setOn("rituels-teinte", !prefs.on("rituels-teinte")); applyMood(); } }]);

  // Anneaux autour du noyau (PC, plan 1)
  let flash = null, t0 = 0;
  const anchor = document.getElementById("anchor");
  if (force && force.addLayer) force.addLayer((g, dt) => {
    t0 += dt; if (flash) flash.t += dt;
    if (!prefs.on("rituels-anneaux") || (plans && plans.zoom < 0.8)) return;
    const r0 = anchor.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2, R = Math.max(50, Math.min(r0.width, r0.height) * 0.3);
    const d = today();
    habits.forEach((h, i) => {
      const r = R * 1.18 + i * 7, p = Math.min(1, count(d, h) / h.goal), col = colorOf(i), a0 = -Math.PI / 2 + t0 * 0.05 * (i % 2 ? -1 : 1);
      g.lineWidth = 2.2; g.strokeStyle = col + "22"; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke();
      if (p > 0) {
        const f = flash && flash.id === h.id && flash.t < 1.5 ? 1 - flash.t / 1.5 : 0;
        g.lineWidth = 2.6 + f * 4; g.strokeStyle = col + (p >= 1 ? "dd" : "99"); g.shadowColor = col; g.shadowBlur = 8 + f * 18;
        g.beginPath(); g.arc(cx, cy, r, a0, a0 + p * 6.283); g.stroke(); g.shadowBlur = 0;
      }
    });
  });

  store.on("kv", load); load();
  // Minuit : nouvelle journée (anneaux vides, humeur à choisir)
  let lastDay = dayKey(); setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); applyMood(); if (!editing) render(); } }, 60e3);
  return { bump: (id, n = 1) => { const h = habits.find((x) => x.id === id); if (h) bump(h, n); }, setMood };
}
