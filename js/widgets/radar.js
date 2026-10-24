// Phase 7.2 · Radar des dates (idée de la Boîte à idées) : anniversaires, fêtes, jours fériés, rendez-vous et échéances de tâches
// qui approchent, sur un radar. Chaque date a sa place fixe sur le cercle (comme sa position dans l'année) ;
// plus elle approche, plus elle se rapproche du centre. Anneaux : 7, 30 et 90 jours. Un balayage fait briller les points.
// Les anniversaires se saisissent à la main (« Maman 12/03 » ou « Maman 12/03/1960 » pour afficher l'âge) et sont rangés
// dans la collection kv (« radar-dates »), donc synchronisés et chiffrés comme le reste. Fêtes et jours fériés sont calculés (France).
import { store, newId } from "../store/storage.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { dayKey, fromKey, addDays, daysFrom } from "./when.js";
import { state, pulse } from "../state.js";

const KV = "radar-dates", HORIZON = 90;
const TYPES = { anniv: { c: "#ff6b9a", ic: "🎂" }, ferie: { c: "#ffe066", ic: "★" }, fete: { c: "#9b72ff", ic: "✦" }, rdv: { c: "#3fe6ff", ic: "◆" }, tache: { c: "#ffb347", ic: "▲" } };
const pad = (n) => String(n).padStart(2, "0");
const key = (d) => dayKey(d);

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher). */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
const nthSunday = (y, mo, n) => { const d = new Date(y, mo, 1); d.setDate(1 + ((7 - d.getDay()) % 7) + (n - 1) * 7); return d; };
const lastSunday = (y, mo) => { const d = new Date(y, mo + 1, 0); d.setDate(d.getDate() - d.getDay()); return d; };
/** Jours fériés et fêtes de l'année y (France). Exporté pour les essais. */
export function feteList(y) {
  const E = easter(y), L = [];
  const f = (m, d, n, t) => L.push({ date: key(new Date(y, m - 1, d)), name: n, type: t });
  f(1, 1, "Jour de l'an", "ferie"); f(5, 1, "Fête du Travail", "ferie"); f(5, 8, "Victoire 1945", "ferie"); f(7, 14, "Fête nationale", "ferie");
  f(8, 15, "Assomption", "ferie"); f(11, 1, "Toussaint", "ferie"); f(11, 11, "Armistice", "ferie"); f(12, 25, "Noël", "ferie");
  L.push({ date: key(E), name: "Pâques", type: "ferie" }, { date: key(addDays(E, 1)), name: "Lundi de Pâques", type: "ferie" }, { date: key(addDays(E, 39)), name: "Ascension", type: "ferie" }, { date: key(addDays(E, 50)), name: "Lundi de Pentecôte", type: "ferie" });
  f(2, 14, "Saint-Valentin", "fete"); f(10, 31, "Halloween", "fete"); f(12, 31, "Saint-Sylvestre", "fete");
  const pent = key(addDays(E, 49)); let mm = lastSunday(y, 4); if (key(mm) === pent) mm = nthSunday(y, 5, 1);
  L.push({ date: key(mm), name: "Fête des mères", type: "fete" }, { date: key(nthSunday(y, 5, 3)), name: "Fête des pères", type: "fete" },
    { date: key(lastSunday(y, 2)), name: "Passage à l'heure d'été", type: "fete" }, { date: key(lastSunday(y, 9)), name: "Passage à l'heure d'hiver", type: "fete" });
  return L;
}
/** « Maman 12/03/1960 » → { name, md: "03-12", year: 1960 } ou null. Exporté pour les essais. */
export function parseBirthday(text) {
  const m = text.trim().match(/^(.+?)\s+(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/); if (!m) return null;
  const d = +m[2], mo = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let year = m[4] ? +m[4] : null; if (year !== null && year < 100) year += year > 30 ? 1900 : 2000;
  return { name: m[1].trim().slice(0, 40), md: pad(mo) + "-" + pad(d), year };
}

export function initRadar({ force, plans } = {}) {
  const win = document.querySelector('.win[data-id="radar"]'); if (!win) return {};
  const pb = win.querySelector(".pb"), tag = win.querySelector(".tag"), pf = win.querySelector(".pf");
  pb.className = "pb pb-radar";
  pb.innerHTML = '<canvas class="rcanvas" width="300" height="300" role="img" aria-label="Radar des dates à venir"></canvas><ul class="rlist2"></ul><form class="addrow" autocomplete="off"><input class="inl" type="text" maxlength="80" placeholder="Anniversaire : Maman 12/03 (+ /1960 pour l\'âge)" aria-label="Ajouter un anniversaire"></form>';
  const cv = pb.querySelector("canvas"), ul = pb.querySelector(".rlist2"), form = pb.querySelector("form"), inp = form.querySelector("input"), g = cv.getContext("2d");
  inp.addEventListener("keydown", (e) => e.stopPropagation());
  let perso = [], events = [], tasks = [], items = [], t0 = 0;

  async function load() {
    const kv = await store.get("kv", KV); perso = kv && Array.isArray(kv.items) ? kv.items : [];
    events = await store.all("events"); tasks = await store.all("tasks"); build(); render();
  }
  function build() {
    const today = dayKey(), y = new Date().getFullYear(), out = [];
    [y, y + 1].forEach((yy) => feteList(yy).forEach((f) => out.push(f)));
    perso.forEach((p) => [y, y + 1].forEach((yy) => {
      const date = `${yy}-${p.md}`, age = p.year ? yy - p.year : null;
      out.push({ date, name: p.name + (age ? " · " + age + " ans" : ""), type: "anniv", pid: p.id });
    }));
    events.forEach((e) => out.push({ date: e.date, name: e.title, type: "rdv" }));
    tasks.filter((t) => !t.done && t.due).forEach((t) => out.push({ date: t.due, name: t.text, type: "tache" }));
    items = out.filter((x) => { const n = daysFrom(x.date); return n >= 0 && n <= HORIZON; }).map((x) => ({ ...x, n: daysFrom(x.date) })).sort((a, b) => a.n - b.n || a.name.localeCompare(b.name));
    return today;
  }
  const label = (n) => (n === 0 ? "auj." : n === 1 ? "dem." : "J-" + n);

  function render() {
    ul.innerHTML = "";
    const next = items.slice(0, state.lite ? 6 : 5);
    if (!next.length) { const li = document.createElement("li"); li.className = "none"; li.textContent = "Rien dans les 90 prochains jours."; ul.append(li); }
    next.forEach((x) => {
      const li = document.createElement("li"); li.style.setProperty("--c", TYPES[x.type].c);
      li.innerHTML = '<span class="ri"></span><span class="rn"></span><em></em>';
      li.querySelector(".ri").textContent = TYPES[x.type].ic; li.querySelector(".rn").textContent = x.name; li.querySelector("em").textContent = label(x.n);
      li.title = fromKey(x.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (x.pid) { const b = document.createElement("button"); b.type = "button"; b.className = "mini danger"; b.textContent = "✕"; b.setAttribute("aria-label", "Retirer " + x.name); b.addEventListener("click", () => removeBirthday(x.pid)); li.append(b); }
      ul.append(li);
    });
    const soon = items.filter((x) => x.n <= 7).length;
    tag.textContent = soon ? soon + " CETTE SEMAINE" : "RADAR";
    if (pf) { pf.firstElementChild.textContent = "Anniversaires, fêtes, rendez-vous, échéances"; pf.lastElementChild.textContent = items.length + " à venir"; }
    if (state.lite || state.reduce) draw(0);
  }

  const angle = (date) => { const d = fromKey(date), j = (d - new Date(d.getFullYear(), 0, 0)) / 864e5; return (j / 365) * 6.283 - 1.5708; };
  function draw(t) {
    const W = cv.width, c = W / 2, R = c - 14;
    g.clearRect(0, 0, W, W);
    const rr = (n) => R * Math.sqrt(n / HORIZON);                     // échelle en racine : le proche est plus lisible
    g.lineWidth = 1;
    [7, 30, 90].forEach((n, i) => { g.strokeStyle = `rgba(63,230,255,${0.32 - i * 0.07})`; g.beginPath(); g.arc(c, c, rr(n), 0, 6.283); g.stroke(); g.fillStyle = "rgba(127,155,176,.8)"; g.font = "10px 'IBM Plex Mono', monospace"; g.fillText(n + " j", c + 3, c - rr(n) + 11); });
    g.strokeStyle = "rgba(63,230,255,.12)"; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283 - 1.5708; g.beginPath(); g.moveTo(c + Math.cos(a) * 12, c + Math.sin(a) * 12); g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R); g.stroke(); }
    const mois = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"]; g.fillStyle = "rgba(127,155,176,.55)"; g.textAlign = "center";
    mois.forEach((m, k) => { const a = (k + 0.5) / 12 * 6.283 - 1.5708; g.fillText(m, c + Math.cos(a) * (R + 1), c + Math.sin(a) * (R + 1) + 3); }); g.textAlign = "start";
    const sw = (t * 0.6) % 6.283 - 1.5708;
    if (t) { const gr = g.createConicGradient ? g.createConicGradient(sw - 0.9, c, c) : null; if (gr) { gr.addColorStop(0, "rgba(63,230,255,0)"); gr.addColorStop(0.14, "rgba(63,230,255,.22)"); gr.addColorStop(0.15, "rgba(63,230,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, 6.283); g.fill(); } g.strokeStyle = "rgba(120,240,255,.6)"; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(sw) * R, c + Math.sin(sw) * R); g.stroke(); }
    g.fillStyle = "#3fe6ff"; g.beginPath(); g.arc(c, c, 3, 0, 6.283); g.fill();
    items.forEach((x, i) => {
      const a = angle(x.date), r = Math.max(rr(x.n), 10), px = c + Math.cos(a) * r, py = c + Math.sin(a) * r, col = TYPES[x.type].c;
      let d = ((sw - a) % 6.283 + 6.283) % 6.283; const glow = t ? Math.max(0, 1 - d / 1.4) : 0.4;
      g.fillStyle = col; g.globalAlpha = 0.55 + 0.45 * glow; g.shadowColor = col; g.shadowBlur = 4 + glow * 12;
      g.beginPath(); g.arc(px, py, x.n <= 7 ? 4.2 : 3, 0, 6.283); g.fill(); g.shadowBlur = 0; g.globalAlpha = 1;
      if (x.n <= 14 && i < 12) { g.fillStyle = "rgba(215,236,247,.85)"; g.font = "10px 'IBM Plex Sans', sans-serif"; const s = x.name.length > 16 ? x.name.slice(0, 15) + "…" : x.name; g.textAlign = px > c ? "left" : "right"; g.fillText(s, px + (px > c ? 7 : -7), py + 3); g.textAlign = "start"; }
    });
  }
  // PC : le radar tourne dans la boucle d'animation unique (couche du champ de force) ; mobile : image fixe
  if (force && force.addLayer) force.addLayer((_, dt) => { t0 += dt; if (!state.lite && win.offsetParent !== null && (!plans || plans.zoom < 0.9)) draw(t0); });
  function dpr() { const r = window.devicePixelRatio || 1, s = Math.round(300 * Math.min(r, 2)); cv.width = cv.height = s; cv.style.aspectRatio = "1"; }

  async function save() { await store.put("kv", { id: KV, items: perso }); }
  async function addBirthday(text) {
    const b = parseBirthday(text); if (!b) { toast("Écris par exemple : Maman 12/03 ou Maman 12/03/1960"); return false; }
    perso.push({ id: newId("b"), name: b.name, md: b.md, year: b.year }); await save(); build(); render(); pulse(0.8);
    toast(`Anniversaire de ${b.name} ajouté`); return true;
  }
  async function removeBirthday(id) { const p = perso.find((x) => x.id === id); perso = perso.filter((x) => x.id !== id); await save(); build(); render(); toast("Retiré : " + (p ? p.name : "")); }
  form.addEventListener("submit", async (e) => { e.preventDefault(); const v = inp.value.trim(); if (v && await addBirthday(v)) inp.value = ""; });
  registerMenu("radar", () => [{ h: "Radar des dates" }, { t: "Ajouter un anniversaire", fn: () => inp.focus() }]);

  dpr(); store.on("kv", load); store.on("events", load); store.on("tasks", load); load();
  setInterval(() => { build(); render(); }, 60 * 60e3);
  return { add: addBirthday, get items() { return items; } };
}
