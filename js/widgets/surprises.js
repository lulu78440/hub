// Phase 4 · Surprises (inventées avec Opus, dévoilées à la livraison). Chacune se coupe dans Diag → Surprises.
// 1. Briefing holographique : à la première ouverture du jour, le noyau te résume la journée (météo, tâches, rendez-vous, lune, sauvegarde).
// 2. Constellation des exploits : chaque tâche cochée allume une étoile durable autour du noyau (survol = la tâche et sa date).
// 3. Mode Focus : un minuteur de concentration (25 ou 50 min) dessiné en anneau autour de l'orbe ; tout le reste s'estompe.
// 4. Hyperespace : tape ↑ ↑ ↓ ↓ ← → ← → B A (ou « hyper » au clavier) et le hub passe en vitesse lumière.
// 5. Phase de la lune, calculée sur l'appareil, dans le briefing et la météo.
// Rien ne sort de l'appareil ; tout respecte « mouvement réduit ».
import { store } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { sound } from "../device/sound.js";
import { notify } from "../device/notify.js";
import { toast } from "../ui/toast.js";
import { extendMenu } from "../ui/menus.js";
import { daysFrom, dayKey } from "./when.js";
import { state, pulse } from "../state.js";

const ON = (k) => prefs.on("surprise-" + k);
const pad = (n) => String(n).padStart(2, "0");

/** Phase de la lune (0 = nouvelle, 0.5 = pleine), à partir d'une nouvelle lune connue (6 janvier 2000 18:14 UTC). */
export function moon(d = new Date()) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const p = (((d.getTime() - ref) / 864e5) % syn + syn) % syn / syn;
  const names = [[0.03, "Nouvelle lune", "🌑"], [0.22, "Premier croissant", "🌒"], [0.28, "Premier quartier", "🌓"], [0.47, "Lune gibbeuse croissante", "🌔"], [0.53, "Pleine lune", "🌕"], [0.72, "Lune gibbeuse décroissante", "🌖"], [0.78, "Dernier quartier", "🌗"], [0.97, "Dernier croissant", "🌘"], [1.01, "Nouvelle lune", "🌑"]];
  const [, name, icon] = names.find(([lim]) => p < lim);
  return { phase: p, name, icon };
}

export function initSurprises({ force, plans, wins }) {
  const anchor = document.getElementById("anchor");
  const core = () => { const r = anchor.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: Math.max(50, Math.min(r.width, r.height) * 0.3) }; };

  // ---------- 1. Briefing holographique ----------
  const brief = document.createElement("div"); brief.className = "brief"; brief.hidden = true; brief.setAttribute("role", "status");
  document.body.append(brief);
  async function briefing(force = false) {
    if (!force && (!ON("briefing") || prefs.get("briefing-jour", "") === dayKey() || new Date().getHours() < 5)) return;
    prefs.set("briefing-jour", dayKey());
    const now = new Date(), h = now.getHours();
    const hello = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
    const tasks = (await store.all("tasks")).filter((t) => !t.done);
    const today = tasks.filter((t) => t.due && daysFrom(t.due) <= 0), urgent = tasks.filter((t) => t.prio);
    const m = now.getHours() * 60 + now.getMinutes();
    const evs = (await store.all("events")).filter((e) => e.date === dayKey() && e.start).sort((a, b) => a.start.localeCompare(b.start));
    const next = evs.find((e) => +e.start.slice(0, 2) * 60 + +e.start.slice(3) > m);
    let wx = null; try { wx = JSON.parse(prefs.get("meteo-cache", "null")); } catch (e) { wx = null; }
    const lines = [`${hello} Lucien · ${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(now)}`];
    if (wx && wx.data && wx.data.current) lines.push(`${Math.round(wx.data.current.temperature_2m)}° à ${wx.name || "ta position"} · max ${Math.round(wx.data.daily.temperature_2m_max[0])}°`);
    lines.push(tasks.length ? `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} à faire` + (today.length ? `, dont ${today.length} pour aujourd'hui` : "") + (urgent.length ? ` · ${urgent.length} urgente${urgent.length > 1 ? "s" : ""}` : "") : "Aucune tâche en attente : journée libre");
    lines.push(next ? `Prochain rendez-vous : ${next.start} · ${next.title}` : evs.length ? "Plus de rendez-vous aujourd'hui" : "Aucun rendez-vous aujourd'hui");
    const mo = moon(now); lines.push(`${mo.icon} ${mo.name}`);
    const last = Date.parse(prefs.get("dernier-export", "")) || 0;
    if (!last || Date.now() - last > 7 * 864e5) lines.push("Pense à exporter tes données (Diag)");
    brief.innerHTML = '<span class="bh">BRIEFING · ' + pad(h) + ":" + pad(now.getMinutes()) + "</span>";
    lines.forEach((l, i) => { const p = document.createElement("p"); p.style.animationDelay = (i * 0.35) + "s"; p.textContent = l; if (i === 0) p.className = "b1"; brief.append(p); });
    brief.hidden = false; pulse(1.2); sound.play("doux");
    clearTimeout(briefing.t); briefing.t = setTimeout(() => { brief.hidden = true; }, 14000 + lines.length * 400);
  }
  brief.addEventListener("click", () => { brief.hidden = true; });

  // ---------- 2. Constellation des exploits ----------
  let stars = [];
  async function loadStars() {
    const done = (await store.all("tasks")).filter((t) => t.done && t.doneAt).sort((a, b) => a.doneAt - b.doneAt).slice(-120);
    let saved = {}; try { saved = JSON.parse(prefs.get("constellation", "{}")) || {}; } catch (e) { saved = {}; }
    // Étoiles déjà nées gardées (même si la tâche a été effacée), nouvelles ajoutées
    done.forEach((t) => { if (!saved[t.id]) { const a = Math.random() * 6.283, r = 1.25 + Math.random() * 0.55; saved[t.id] = { a, r, y: (Math.random() - 0.5) * 0.9, at: t.doneAt, n: t.text.slice(0, 60), born: Date.now() }; } });
    const ids = Object.keys(saved).sort((a, b) => saved[a].at - saved[b].at).slice(-150);
    saved = Object.fromEntries(ids.map((id) => [id, saved[id]]));
    prefs.set("constellation", JSON.stringify(saved));
    stars = ids.map((id) => saved[id]);
  }
  store.on("tasks", loadStars); loadStars();
  let hoverStar = null, t0 = 0;
  force.addLayer((g, dt, F) => {
    t0 += dt;
    if (!ON("constellation") || !stars.length || plans.zoom < 0.8) return;
    const c = core();
    hoverStar = null;
    stars.forEach((s, i) => {
      const a = s.a + t0 * 0.03, x = c.x + Math.cos(a) * c.R * s.r * 1.9, y = c.y + s.y * c.R + Math.sin(a) * c.R * s.r * 0.55;
      const fresh = Math.max(0, 1 - (Date.now() - s.born) / 4000), tw = 0.6 + 0.4 * Math.sin(t0 * 2 + i * 1.7);
      const near = F.fin && Math.hypot(F.fmx - x, F.fmy - y) < 10; if (near) hoverStar = { s, x, y };
      const rad = (near ? 3.6 : 1.8) + fresh * 6;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad * 3); gr.addColorStop(0, `rgba(255,236,190,${(0.9 * tw).toFixed(2)})`); gr.addColorStop(1, "rgba(255,179,71,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 3, 0, 6.283); g.fill();
      if (i > 0 && i % 3 !== 0) { const p = stars[i - 1], pa = p.a + t0 * 0.03, px = c.x + Math.cos(pa) * c.R * p.r * 1.9, py = c.y + p.y * c.R + Math.sin(pa) * c.R * p.r * 0.55; g.strokeStyle = "rgba(255,179,71,.12)"; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); }
    });
    if (hoverStar) {
      const d = new Date(hoverStar.s.at), txt = "★ " + hoverStar.s.n + " · " + pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
      g.font = "500 12px 'IBM Plex Mono', monospace"; const w = g.measureText(txt).width + 14;
      g.fillStyle = "rgba(3,13,24,.92)"; g.fillRect(hoverStar.x + 10, hoverStar.y - 22, w, 20);
      g.fillStyle = "#ffd9a8"; g.fillText(txt, hoverStar.x + 17, hoverStar.y - 8);
    }
  });

  // ---------- 3. Mode Focus ----------
  let focus = null;   // { end, total, win }
  function startFocus(min, winEl) {
    if (!ON("focus")) { toast("Mode Focus coupé dans Diag → Surprises"); return; }
    focus = { end: Date.now() + min * 60e3, total: min * 60e3, win: winEl || null };
    document.body.classList.add("focus"); if (winEl) winEl.classList.add("focused");
    toast(`Focus ${min} min : concentre-toi, le hub veille`); pulse(1);
  }
  function stopFocus(done) {
    if (!focus) return;
    document.body.classList.remove("focus"); if (focus.win) focus.win.classList.remove("focused");
    focus = null;
    if (done) { sound.play("rappel"); toast("Focus terminé : bravo, fais une pause", { ms: 6000 }); if (document.hidden) notify.show("Hub · Focus terminé", "Bravo : fais une pause", "hub-focus"); pulse(1.5); }
  }
  force.addLayer((g) => {
    if (!focus) return;
    const left = focus.end - Date.now(); if (left <= 0) { stopFocus(true); return; }
    const c = core(), p = 1 - left / focus.total, R = c.R * 1.25;
    g.lineWidth = 4; g.strokeStyle = "rgba(255,179,71,.18)"; g.beginPath(); g.arc(c.x, c.y, R, 0, 6.283); g.stroke();
    g.strokeStyle = "rgba(255,200,120,.95)"; g.beginPath(); g.arc(c.x, c.y, R, -Math.PI / 2, -Math.PI / 2 + p * 6.283); g.stroke();
    const mm = Math.floor(left / 60e3), ss = Math.floor(left / 1e3) % 60;
    g.font = "700 22px Orbitron, sans-serif"; g.textAlign = "center"; g.fillStyle = "rgba(255,230,190,.95)"; g.fillText(pad(mm) + ":" + pad(ss), c.x, c.y + R + 34); g.textAlign = "start";
  });
  setInterval(() => { if (focus && focus.end <= Date.now()) stopFocus(true); }, 1000);   // aussi quand le dessin est coupé (onglet caché)

  // ---------- 4. Hyperespace ----------
  let warp = 0;
  const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let seq = [], typed = "";
  addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable='true']")) return;
    seq = seq.concat(e.key.length === 1 ? e.key.toLowerCase() : e.key).slice(-CODE.length);
    typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : " ")).slice(-5);
    if (seq.join() === CODE.join() || typed === "hyper") { seq = []; typed = ""; hyper(); }
  });
  function hyper() {
    if (!ON("hyper") || state.lite || state.reduce) { if (state.reduce) toast("Hyperespace désactivé : « mouvement réduit » est demandé par Windows"); return; }
    warp = 3.2; state.energyTarget = 1.6; state.accent = 0x9b72ff; sound.play("rappel", true); toast("Saut en hyperespace…");
    setTimeout(() => { state.energyTarget = 0; state.accent = null; }, 3000);
  }
  const streaks = Array.from({ length: 160 }, () => ({ a: Math.random() * 6.283, d: Math.random(), s: 0.4 + Math.random() }));
  force.addLayer((g, dt) => {
    if (warp <= 0) return; warp -= dt;
    const c = core(), W = g.canvas.width, H = g.canvas.height, k = Math.min(1, warp / 0.6) * Math.min(1, (3.2 - warp) / 0.4), maxR = Math.hypot(W, H) * 0.6;
    g.lineCap = "round";
    streaks.forEach((s) => {
      s.d += dt * s.s * 1.6; if (s.d > 1) s.d -= 1;
      const r1 = s.d * s.d * maxR, r2 = r1 + (20 + s.d * 160) * k;
      g.strokeStyle = `rgba(${s.s > 1.1 ? "200,180,255" : "190,248,255"},${(0.75 * k * s.d + 0.05).toFixed(2)})`; g.lineWidth = 1 + s.d * 2.2;
      g.beginPath(); g.moveTo(c.x + Math.cos(s.a) * r1, c.y + Math.sin(s.a) * r1); g.lineTo(c.x + Math.cos(s.a) * r2, c.y + Math.sin(s.a) * r2); g.stroke();
    });
    g.fillStyle = `rgba(220,240,255,${(0.12 * k).toFixed(3)})`; g.fillRect(0, 0, W, H);
  });

  // ---------- Menus et réglages ----------
  extendMenu("fond", () => (focus ? [{ t: "Arrêter le Focus", fn: () => stopFocus(false) }] : [{ t: "Focus 25 min", fn: () => startFocus(25) }, { t: "Focus 50 min", fn: () => startFocus(50) }])
    .concat([{ t: "Revoir le briefing du jour", fn: () => briefing(true) }]));
  extendMenu("fenetre", (el) => focus ? [] : [{ t: "Focus 25 min sur cette fenêtre", fn: () => startFocus(25, el) }]);
  const list = [["briefing", "Briefing holographique du matin"], ["constellation", "Constellation des tâches accomplies"], ["focus", "Mode Focus autour de l'orbe"], ["hyper", "Hyperespace (code secret)"]];
  const box = document.getElementById("surprises");
  if (box) {
    list.forEach(([k, label]) => {
      const lab = document.createElement("label"); lab.className = "chkl";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = ON(k);
      cb.addEventListener("change", () => { prefs.setOn("surprise-" + k, cb.checked); if (k === "constellation") pulse(0.6); });
      lab.append(cb, document.createTextNode(" " + label)); box.append(lab);
    });
  }
  setTimeout(() => briefing(false), 2500);
  return { briefing, startFocus, stopFocus, hyper, moon };
}
