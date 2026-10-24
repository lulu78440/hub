// Champ de force (PC) : filaments reliés à la souris, charge électrique, longue traînée, bokeh et reflet du plan 2,
// appui long sur l'orbe pour couper ou relancer l'énergie. Dessin 2D sur un canvas plein écran, dans la boucle unique.
import { state, pulse } from "../state.js";
import { prefs } from "../store/prefs.js";
import { toast } from "../ui/toast.js";
import { onBackground } from "../ui/dom.js";
import { createEntity } from "./entity.js";

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const TRAIL_LIFE = 2.4, PRESS_MS = 900;

export function createForce({ canvas, anchor, logo }) {
  const fg = canvas.getContext("2d");
  const F = { fg, FW: 0, FH: 0, fmx: -1, fmy: -1, fin: false, ft: 0, energyOn: prefs.on("energie"), logo };
  const motes = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.00012, vy: (Math.random() - 0.5) * 0.00012 }));
  const trail = [];
  let dirty = false, press = null;

  function size() { F.FW = canvas.width = innerWidth; F.FH = canvas.height = innerHeight; }
  size(); addEventListener("resize", size);
  const clear = () => { fg.clearRect(0, 0, F.FW, F.FH); dirty = false; };

  addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; F.fmx = e.clientX; F.fmy = e.clientY; F.fin = true; });
  addEventListener("mouseout", (e) => { if (!e.relatedTarget) F.fin = false; });

  // Éclair irrégulier entre deux points
  F.jag = (x1, y1, x2, y2, n, amp) => {
    const pts = [[x1, y1]], nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) { const t = i / n, o = (Math.random() - 0.5) * amp; pts.push([x1 + (x2 - x1) * t + nx / L * o, y1 + (y2 - y1) * t + ny / L * o]); }
    pts.push([x2, y2]); return pts;
  };
  F.strokePts = (pts) => { fg.beginPath(); fg.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) fg.lineTo(pts[i][0], pts[i][1]); fg.stroke(); };

  // Filaments vers les points de constellation proches d'une origine (souris ou entité)
  F.filaments = (ox, oy, R, cap, attract) => {
    const near = [];
    for (const m of motes) {
      if (near.length >= cap) break;
      const px = m.x * F.FW, py = m.y * F.FH, dx = ox - px, dy = oy - py, d = Math.hypot(dx, dy);
      if (d < R) { if (attract) { m.x += dx / F.FW * 0.003; m.y += dy / F.FH * 0.003; } near.push([px, py, 1 - d / R]); }
    }
    fg.lineWidth = 1;
    near.forEach(([x, y, a], i) => {
      const w = Math.sin(F.ft * 0.9 + i * 1.3) * 12;
      fg.strokeStyle = `rgba(63,230,255,${(a * 0.55).toFixed(3)})`;
      fg.beginPath(); fg.moveTo(ox, oy); fg.quadraticCurveTo((ox + x) / 2 + w, (oy + y) / 2 - w, x, y); fg.stroke();
      fg.fillStyle = `rgba(191,248,255,${(a * 0.9).toFixed(3)})`; fg.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
    });
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
      const [x1, y1, a1] = near[i], [x2, y2, a2] = near[j];
      if (Math.abs(x1 - x2) + Math.abs(y1 - y2) < 110) { fg.strokeStyle = `rgba(155,114,255,${(Math.min(a1, a2) * 0.3).toFixed(3)})`; fg.beginPath(); fg.moveTo(x1, y1); fg.lineTo(x2, y2); fg.stroke(); }
    }
  };

  // Charge électrique autour de la souris
  function mouseAura() {
    const g = fg.createRadialGradient(F.fmx, F.fmy, 0, F.fmx, F.fmy, 36);
    g.addColorStop(0, "rgba(63,230,255,.26)"); g.addColorStop(1, "rgba(63,230,255,0)");
    fg.fillStyle = g; fg.beginPath(); fg.arc(F.fmx, F.fmy, 36, 0, 6.283); fg.fill();
    fg.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      if (Math.random() < 0.3) continue;
      const a = Math.random() * 6.283, r1 = 7 + Math.random() * 6, r2 = 20 + Math.random() * 18;
      fg.strokeStyle = `rgba(170,245,255,${(0.3 + Math.random() * 0.5).toFixed(2)})`;
      F.strokePts(F.jag(F.fmx + Math.cos(a) * r1, F.fmy + Math.sin(a) * r1, F.fmx + Math.cos(a + 0.45) * r2, F.fmy + Math.sin(a + 0.45) * r2, 4, 7));
    }
  }

  // Longue traînée lente qui reste et se dissipe
  function drawTrail(dt) {
    for (const p of trail) p.y -= dt * 5;   // elle flotte doucement vers le haut
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1], p1 = trail[i], life = 1 - (F.ft - p1.t) / TRAIL_LIFE;
      if (life <= 0) continue;
      const a = life * life, jx = Math.sin(F.ft * 3 + i * 0.7) * 3 * (1 - life), jy = Math.cos(F.ft * 2.5 + i * 0.9) * 3 * (1 - life);
      fg.strokeStyle = `rgba(63,230,255,${(a * 0.10).toFixed(3)})`; fg.lineWidth = 12 * life + 2;
      fg.beginPath(); fg.moveTo(p0.x, p0.y); fg.lineTo(p1.x + jx, p1.y + jy); fg.stroke();
      fg.strokeStyle = `rgba(190,248,255,${(a * 0.6).toFixed(3)})`; fg.lineWidth = 1.4;
      fg.beginPath(); fg.moveTo(p0.x, p0.y); fg.lineTo(p1.x + jx, p1.y + jy); fg.stroke();
      if (i % 5 === 0 && Math.random() < 0.45 * life) {
        fg.fillStyle = `rgba(${Math.random() < 0.3 ? "155,114,255" : "160,240,255"},${(a * 0.85).toFixed(2)})`;
        fg.fillRect(p1.x + (Math.random() - 0.5) * 16, p1.y + (Math.random() - 0.5) * 16, 2, 2);
      }
    }
  }

  // Appui long sur l'orbe : coupe ou relance l'énergie qui suit la souris
  function orbHit(x, y) {
    const r = anchor.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(40, Math.min(r.width, r.height) * 0.3);
    return Math.hypot(x - cx, y - cy) < R ? { cx, cy, R } : null;
  }
  addEventListener("pointerdown", (e) => {
    if (state.lite || e.button !== 0 || !onBackground(e.target)) return;
    const h = orbHit(e.clientX, e.clientY);
    if (h) press = { ...h, t0: performance.now(), x: e.clientX, y: e.clientY };
  });
  addEventListener("pointermove", (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 14) press = null; });
  addEventListener("pointerup", () => { press = null; });
  addEventListener("pointercancel", () => { press = null; });
  function drawPress() {
    const p = Math.min(1, (performance.now() - press.t0) / PRESS_MS);
    fg.lineWidth = 3; fg.strokeStyle = `rgba(160,240,255,${(0.4 + p * 0.5).toFixed(2)})`;
    fg.beginPath(); fg.arc(press.cx, press.cy, press.R * 0.8, -Math.PI / 2, -Math.PI / 2 + p * 6.283); fg.stroke();
    fg.lineWidth = 8; fg.strokeStyle = `rgba(63,230,255,${(0.12 * p).toFixed(3)})`;
    fg.beginPath(); fg.arc(press.cx, press.cy, press.R * 0.8, 0, 6.283); fg.stroke();
    if (p >= 1) {
      F.energyOn = !F.energyOn; press = null;
      if (!F.energyOn) trail.length = 0;
      prefs.setOn("energie", F.energyOn);
      pulse(1); toast(F.energyOn ? "Énergie de la souris relancée" : "Énergie de la souris coupée · appui long sur l'orbe pour la relancer");
    }
  }

  // Plan 2 : bokeh au premier plan et reflet anamorphique
  const bokeh = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), r: 30 + Math.random() * 90, s: (Math.random() - 0.5) * 0.012, c: Math.random() < 0.7 ? "63,230,255" : "155,114,255" }));
  function drawCine(dt) {
    const cine = state.cine;
    for (const b of bokeh) {
      b.x += b.s * dt; if (b.x < -0.15) b.x = 1.15; if (b.x > 1.15) b.x = -0.15;
      const x = b.x * F.FW, y = b.y * F.FH, g = fg.createRadialGradient(x, y, b.r * 0.55, x, y, b.r);
      g.addColorStop(0, `rgba(${b.c},${(0.04 * cine).toFixed(3)})`); g.addColorStop(0.88, `rgba(${b.c},${(0.09 * cine).toFixed(3)})`); g.addColorStop(1, `rgba(${b.c},0)`);
      fg.fillStyle = g; fg.beginPath(); fg.arc(x, y, b.r, 0, 6.283); fg.fill();
    }
    const r = anchor.getBoundingClientRect(), cy = r.top + r.height / 2, cx = clamp((r.left + r.width / 2) / F.FW, 0.05, 0.95);
    const g = fg.createLinearGradient(0, 0, F.FW, 0);
    g.addColorStop(0, "rgba(63,230,255,0)"); g.addColorStop(cx, `rgba(170,245,255,${(0.4 * cine).toFixed(3)})`); g.addColorStop(1, "rgba(63,230,255,0)");
    fg.fillStyle = g; fg.fillRect(0, cy - 1, F.FW, 2);
    fg.globalAlpha = 0.25; fg.fillRect(0, cy - 7, F.FW, 14); fg.globalAlpha = 1;
  }

  // Champ de force autour de la fenêtre qu'on déplace : arcs reliés à la souris, étincelles qui courent sur le bord
  let dragEl = null;
  function perim(r, s) {
    const P = 2 * (r.width + r.height); let d = (((s % 1) + 1) % 1) * P;
    if (d < r.width) return [r.left + d, r.top]; d -= r.width;
    if (d < r.height) return [r.right, r.top + d]; d -= r.height;
    if (d < r.width) return [r.right - d, r.bottom]; d -= r.width;
    return [r.left, r.bottom - d];
  }
  function forceWrap(r) {
    const { fmx, fmy, ft } = F;
    for (let k = 0; k < 9; k++) {
      const [x, y] = perim(r, k / 9 + ft * 0.06);
      const cx = (fmx + x) / 2 + Math.sin(ft * 3 + k * 1.7) * 50, cy = (fmy + y) / 2 + Math.cos(ft * 2.6 + k) * 50;
      fg.strokeStyle = "rgba(63,230,255,0.07)"; fg.lineWidth = 5; fg.beginPath(); fg.moveTo(fmx, fmy); fg.quadraticCurveTo(cx, cy, x, y); fg.stroke();
      fg.strokeStyle = "rgba(160,240,255,0.5)"; fg.lineWidth = 1; fg.beginPath(); fg.moveTo(fmx, fmy); fg.quadraticCurveTo(cx, cy, x, y); fg.stroke();
    }
    for (let i = 0; i < 48; i++) {
      const [x, y] = perim(r, i / 48 + ft * (i % 2 ? 0.11 : -0.07)), j = Math.sin(ft * 9 + i * 2.3) * 4, a = 0.35 + 0.35 * Math.sin(ft * 6 + i);
      fg.fillStyle = i % 5 === 0 ? `rgba(155,114,255,${a.toFixed(2)})` : `rgba(120,240,255,${a.toFixed(2)})`;
      fg.beginPath(); fg.arc(x + j, y - j, 1.6, 0, 6.283); fg.fill();
    }
    fg.strokeStyle = "rgba(63,230,255,0.16)"; fg.lineWidth = 6; fg.strokeRect(r.left - 3, r.top - 3, r.width + 6, r.height + 6);
    fg.strokeStyle = "rgba(160,240,255,0.35)"; fg.lineWidth = 1; fg.strokeRect(r.left - 3, r.top - 3, r.width + 6, r.height + 6);
  }

  const entity = createEntity(F);
  const layers = [];          // dessins ajoutés par d'autres modules (surprises de la phase 4)

  /** Une image du champ de force. Rien n'est dessiné sur mobile, en pause ou avec « mouvement réduit ». */
  function draw(dt) {
    if (state.lite || state.paused || state.reduce) { if (dirty) clear(); return; }
    F.ft += dt; dirty = true;
    fg.clearRect(0, 0, F.FW, F.FH);
    fg.globalCompositeOperation = "lighter"; fg.lineCap = "round";
    for (const m of motes) {
      m.x += m.vx * dt * 60; m.y += m.vy * dt * 60;
      if (m.x < 0) m.x += 1; if (m.x > 1) m.x -= 1; if (m.y < 0) m.y += 1; if (m.y > 1) m.y -= 1;
      fg.fillStyle = "rgba(120,235,255,0.3)"; fg.fillRect(m.x * F.FW - 0.6, m.y * F.FH - 0.6, 1.2, 1.2);
    }
    if (state.cine > 0.02) drawCine(dt);
    if (F.fin && F.energyOn) { const last = trail[trail.length - 1]; if (!last || Math.hypot(F.fmx - last.x, F.fmy - last.y) > 3) trail.push({ x: F.fmx, y: F.fmy, t: F.ft }); }
    while (trail.length && F.ft - trail[0].t > TRAIL_LIFE) trail.shift();
    drawTrail(dt);
    if (F.fin && F.energyOn) { F.filaments(F.fmx, F.fmy, 210, 22, true); mouseAura(); }
    if (press) drawPress();
    entity.draw(dt);
    if (F.fin && dragEl) forceWrap(dragEl.getBoundingClientRect());
    layers.forEach((fn) => { try { fn(fg, dt, F); } catch (e) { console.error(e); } });
    fg.globalCompositeOperation = "source-over";
  }
  return { draw, entity, clear, setDrag(el) { dragEl = el; }, addLayer(fn) { layers.push(fn); }, get F() { return F; } };
}
