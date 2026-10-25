// Phase 4 · Surprises (inventées avec Opus, dévoilées à la livraison). Chacune se coupe dans Diag → Surprises.
// 1. Briefing holographique : à la première ouverture du jour, le noyau te résume la journée (météo, tâches, rendez-vous, lune, sauvegarde).
// 2. Constellation des exploits : chaque tâche cochée allume une étoile durable autour du noyau (survol = la tâche et sa date).
// 3. Mode Focus : un minuteur de concentration (25 ou 50 min) dessiné en anneau autour de l'orbe ; tout le reste s'estompe.
// 4. Hyperespace : maintiens la barre Espace sur le fond (ou ↑ ↑ ↓ ↓ ← → ← → B A, ou « hyper ») et le hub passe en vitesse lumière.
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
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

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
  // Déclencheur principal (demande de Lucien, 25/10) : maintenir la barre Espace 0,6 s sur le fond. Le noyau se charge pendant l'appui.
  const HOLD_MS = 600;
  let spaceT = null, spaceFired = false;
  const canHyper = () => ON("hyper") && !state.lite && !state.reduce && warp <= 0;
  const isSpace = (e) => e.code === "Space" || e.key === " ";
  addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (isSpace(e) && !(e.target.closest && e.target.closest("button, a, [role='button'], [tabindex]"))) {
      e.preventDefault();
      if (e.repeat || spaceT || spaceFired) return;
      if (state.reduce && ON("hyper")) { hyper(); spaceFired = true; return; }   // affiche le message « mouvement réduit »
      if (!canHyper()) return;
      state.energyTarget = 0.9; pulse(0.5);
      spaceT = setTimeout(() => { spaceT = null; spaceFired = true; hyper(); }, HOLD_MS);
      return;
    }
    seq = seq.concat(e.key.length === 1 ? e.key.toLowerCase() : e.key).slice(-CODE.length);
    typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : " ")).slice(-5);
    if (seq.join() === CODE.join() || typed === "hyper") { seq = []; typed = ""; hyper(); }
  });
  const releaseSpace = () => { if (spaceT) { clearTimeout(spaceT); spaceT = null; state.energyTarget = 0; } spaceFired = false; };
  addEventListener("keyup", (e) => { if (isSpace(e)) releaseSpace(); });
  addEventListener("blur", releaseSpace);
  function hyper() {
    if (!ON("hyper") || state.lite || state.reduce) { if (state.reduce) toast("Hyperespace désactivé : « mouvement réduit » est demandé par Windows"); return; }
    warp = WARP; state.energyTarget = 1.6; state.accent = 0x9b72ff; sound.play("rappel", true); toast("Saut en hyperespace…");
    sparks.length = 0; waves = [0, 0.45, 1.05, 1.75]; burst = 260;
    document.body.classList.add("hyperon", "hypertr");
    clearTimeout(hyper.t); hyper.t = setTimeout(() => { if (warp > 0) { warp = 0; sparks.length = 0; } endHyper(); }, WARP * 1000 + 400);   // garde-fou si le dessin s'arrête (onglet caché)
    setTimeout(() => { state.energyTarget = 0; state.accent = null; }, 3000);
  }
  // Effets (demande de Lucien, 25/10) : tout l'écran vibre, l'interface se floute, l'orbe déverse de l'énergie
  // (ondes de choc, éclairs, gerbes de particules), en plus des traits de vitesse lumière. Durée 3,2 s, PC seulement.
  const WARP = 3.2;
  const css = document.createElement("style");
  css.textContent = `html { background: var(--void, #02070d); }
body.hypertr .win .panel, body.hypertr header.top, body.hypertr .agband, body.hypertr .search, body.hypertr .ticker, body.hypertr .labels, body.hypertr .mthumbs { transition: filter .35s ease, opacity .35s ease; }
body.hyperon .win .panel, body.hyperon header.top, body.hyperon .agband, body.hyperon .search, body.hyperon .ticker, body.hyperon .labels { filter: blur(5px) brightness(1.25) saturate(1.3); opacity: .7; }`;
  document.head.append(css);
  const streaks = Array.from({ length: 160 }, () => ({ a: Math.random() * 6.283, d: Math.random(), s: 0.4 + Math.random() }));
  const sparks = []; let waves = [], burst = 0, bolts = [], boltT = 0;
  const COLS = ["190,248,255", "120,230,255", "200,180,255", "255,255,255"];
  function spawn(c, n) {
    for (let i = 0; i < n && sparks.length < 650; i++) {
      const a = Math.random() * 6.283, v = 260 + Math.random() * 1100, r0 = c.R * (0.3 + Math.random() * 0.5);
      sparks.push({ x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7 + Math.random() * 1.1, age: 0, col: COLS[(Math.random() * COLS.length) | 0], w: 0.8 + Math.random() * 2.4 });
    }
  }
  function makeBolt(c, maxR) {
    const a = Math.random() * 6.283, len = maxR * (0.25 + Math.random() * 0.5), pts = [[c.x + Math.cos(a) * c.R * 0.4, c.y + Math.sin(a) * c.R * 0.4]];
    const steps = 9 + ((Math.random() * 6) | 0);
    for (let i = 1; i <= steps; i++) { const r = c.R * 0.4 + (len * i) / steps, j = (Math.random() - 0.5) * 0.35; pts.push([c.x + Math.cos(a + j) * r, c.y + Math.sin(a + j) * r]); }
    return pts;
  }
  const endHyper = () => { document.body.classList.remove("hyperon"); document.body.style.translate = ""; setTimeout(() => document.body.classList.remove("hypertr"), 500); };
  force.addLayer((g, dt) => {
    if (warp <= 0) return; warp -= dt;
    if (warp <= 0) { endHyper(); sparks.length = 0; return; }
    const c = core(), W = g.canvas.width, H = g.canvas.height, e = WARP - warp, k = Math.min(1, warp / 0.6) * Math.min(1, e / 0.4), maxR = Math.hypot(W, H) * 0.6;
    if (warp < 0.45) document.body.classList.remove("hyperon");   // l'interface revient nette pendant la retombée
    // Vibration de tout l'écran (forte au départ, puis grondement)
    const amp = (e < 0.35 ? 14 : 6) * k;
    document.body.style.translate = `${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px ${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px`;
    g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    // Cœur qui irradie
    const glowR = c.R * (2.2 + 0.6 * Math.sin(e * 22)) * (0.6 + k);
    let gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowR);
    gr.addColorStop(0, `rgba(235,250,255,${(0.55 * k).toFixed(2)})`); gr.addColorStop(0.35, `rgba(120,220,255,${(0.28 * k).toFixed(2)})`); gr.addColorStop(1, "rgba(155,114,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, glowR, 0, 6.283); g.fill();
    // Ondes de choc
    waves.forEach((t0, i) => {
      const age = e - t0; if (age < 0 || age > 1.3) return;
      const r = c.R * 0.6 + age * maxR * 0.95, al = (1 - age / 1.3) * 0.75;
      g.lineWidth = 10 * (1 - age / 1.3) + 1.5; g.strokeStyle = `rgba(${i % 2 ? "190,170,255" : "150,240,255"},${al.toFixed(2)})`;
      g.beginPath(); g.arc(c.x, c.y, r, 0, 6.283); g.stroke();
      g.lineWidth = 2; g.strokeStyle = `rgba(255,255,255,${(al * 0.8).toFixed(2)})`; g.beginPath(); g.arc(c.x, c.y, r - 4, 0, 6.283); g.stroke();
    });
    // Gerbes de particules d'énergie
    if (burst) { spawn(c, burst); burst = 0; }
    if (warp > 0.6) spawn(c, Math.round(dt * 220));
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; }
      const px = s.x, py = s.y; s.vx *= 1 + dt * 0.6; s.vy *= 1 + dt * 0.6; s.x += s.vx * dt; s.y += s.vy * dt;
      const al = (1 - s.age / s.life) * k;
      g.strokeStyle = `rgba(${s.col},${al.toFixed(2)})`; g.lineWidth = s.w;
      g.beginPath(); g.moveTo(px - s.vx * dt * 2, py - s.vy * dt * 2); g.lineTo(s.x, s.y); g.stroke();
    }
    // Éclairs qui jaillissent de l'orbe
    boltT -= dt; if (boltT <= 0) { boltT = 0.07; bolts = Array.from({ length: e < 0.5 ? 7 : 4 }, () => makeBolt(c, maxR)); }
    bolts.forEach((pts) => {
      [[7, `rgba(140,200,255,${(0.22 * k).toFixed(2)})`], [2, `rgba(240,250,255,${(0.9 * k).toFixed(2)})`]].forEach(([w, col]) => {
        g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => g.lineTo(x, y)); g.stroke();
      });
    });
    // Traits de vitesse lumière
    streaks.forEach((s) => {
      s.d += dt * s.s * 1.6; if (s.d > 1) s.d -= 1;
      const r1 = s.d * s.d * maxR, r2 = r1 + (20 + s.d * 160) * k;
      g.strokeStyle = `rgba(${s.s > 1.1 ? "200,180,255" : "190,248,255"},${(0.75 * k * s.d + 0.05).toFixed(2)})`; g.lineWidth = 1 + s.d * 2.2;
      g.beginPath(); g.moveTo(c.x + Math.cos(s.a) * r1, c.y + Math.sin(s.a) * r1); g.lineTo(c.x + Math.cos(s.a) * r2, c.y + Math.sin(s.a) * r2); g.stroke();
    });
    g.restore();
    // Éclair blanc au départ, voile lumineux ensuite
    g.fillStyle = `rgba(220,240,255,${(e < 0.18 ? 0.45 * (1 - e / 0.18) + 0.12 * k : 0.12 * k).toFixed(3)})`; g.fillRect(0, 0, W, H);
  });

  // ---------- 5b. Pleine lune dans le ciel 3D (demande de Lucien, 25/10) ----------
  // Visible seulement les nuits de pleine lune (phase 0,47 → 0,53, environ 3 nuits par mois), derrière l'orbe.
  let moon3d = null;
  document.addEventListener("hub:scene", ({ detail: { THREE, scene, lite } }) => {
    const c = document.createElement("canvas"); c.width = c.height = lite ? 256 : 512;
    const g = c.getContext("2d"), S = c.width, R = S / 2 - 2, rnd = mulberry(7);
    g.save(); g.beginPath(); g.arc(S / 2, S / 2, R, 0, 6.283); g.clip();
    let gr = g.createRadialGradient(S * 0.46, S * 0.44, R * 0.1, S / 2, S / 2, R);
    gr.addColorStop(0, "#f4f6f8"); gr.addColorStop(0.7, "#d9dee4"); gr.addColorStop(1, "#9aa3ad");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // Mers lunaires (taches sombres)
    g.filter = `blur(${S / 70}px)`;
    [[0.36, 0.34, 0.16, 0.12], [0.55, 0.3, 0.12, 0.1], [0.6, 0.47, 0.14, 0.11], [0.42, 0.5, 0.1, 0.13], [0.3, 0.6, 0.12, 0.08], [0.68, 0.36, 0.06, 0.08]].forEach(([x, y, rx, ry]) => {
      g.fillStyle = "rgba(25,32,45,.85)"; g.beginPath(); g.ellipse(x * S, y * S, rx * S, ry * S, rnd() * 3, 0, 6.283); g.fill();
    });
    g.filter = "none";
    // Cratères
    for (let i = 0; i < (lite ? 40 : 90); i++) {
      const x = rnd() * S, y = rnd() * S, r = (0.004 + rnd() * rnd() * 0.03) * S;
      g.fillStyle = "rgba(30,38,50,.5)"; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = Math.max(1, r * 0.25); g.beginPath(); g.arc(x - r * 0.15, y - r * 0.15, r, 2.4, 5.5); g.stroke();
    }
    // Tycho et ses rayons
    g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = S / 300;
    for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, l = (0.15 + rnd() * 0.3) * S; g.beginPath(); g.moveTo(S * 0.47, S * 0.8); g.lineTo(S * 0.47 + Math.cos(a) * l, S * 0.8 + Math.sin(a) * l); g.stroke(); }
    g.fillStyle = "#fff"; g.beginPath(); g.arc(S * 0.47, S * 0.8, S * 0.012, 0, 6.283); g.fill();
    // Assombrissement du bord
    gr = g.createRadialGradient(S / 2, S / 2, R * 0.6, S / 2, S / 2, R); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(5,10,20,.75)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S); g.restore();
    const tex = new THREE.CanvasTexture(c);
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x3a424c, fog: false, depthWrite: false, transparent: true }));
    // Halo bleuté autour
    const hc = document.createElement("canvas"); hc.width = hc.height = 128; const hg = hc.getContext("2d");
    const hr = hg.createRadialGradient(64, 64, 20, 64, 64, 64); hr.addColorStop(0, "rgba(190,215,255,.55)"); hr.addColorStop(0.45, "rgba(150,190,255,.14)"); hr.addColorStop(1, "rgba(150,190,255,0)");
    hg.fillStyle = hr; hg.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.28 }));
    const grp = new THREE.Group(); grp.add(glow, disc); grp.renderOrder = -10; disc.renderOrder = glow.renderOrder = -10;
    scene.add(grp);
    moon3d = { grp, disc, glow, place(v) {
      const P = v === "derriere" ? [0, 0.6, -45, 13] : [-7, 8.5, -45, 7.5];   // x, y, z, diamètre
      grp.position.set(P[0], P[1], P[2]); disc.scale.set(P[3], P[3], 1); glow.scale.set(P[3] * 2.6, P[3] * 2.6, 1);
    } };
    moon3d.place(prefs.get("lune-place", "coin"));
    showMoon();
  });
  function showMoon(forceOn) {
    if (!moon3d) return;
    const p = moon().phase;
    moon3d.grp.visible = forceOn ?? (ON("lune") && p >= 0.47 && p < 0.53);
  }
  setInterval(() => showMoon(), 30 * 60e3);

  // ---------- Menus et réglages ----------
  extendMenu("fond", () => (focus ? [{ t: "Arrêter le Focus", fn: () => stopFocus(false) }] : [{ t: "Focus 25 min", fn: () => startFocus(25) }, { t: "Focus 50 min", fn: () => startFocus(50) }])
    .concat([{ t: "Revoir le briefing du jour", fn: () => briefing(true) }]));
  extendMenu("fenetre", (el) => focus ? [] : [{ t: "Focus 25 min sur cette fenêtre", fn: () => startFocus(25, el) }]);
  const list = [["briefing", "Briefing holographique du matin"], ["constellation", "Constellation des tâches accomplies"], ["focus", "Mode Focus autour de l'orbe"], ["hyper", "Hyperespace (maintenir la barre Espace)"]];
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
  return { briefing, startFocus, stopFocus, hyper, moon, moonPreview: (v) => { if (moon3d) { moon3d.place(v); showMoon(true); } } };
}
