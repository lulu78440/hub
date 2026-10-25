// Tuiles personnalisables (PC) : style de chaque fenêtre (Normal = l'apparence d'origine, Hologramme 3D, Fin, Verre, Minimal),
// effets Constellation / Halo / Énergie, taille du texte. Réglages par fenêtre, gardés sur l'appareil (clé hub-tuiles-pc-v1,
// donc aussi dans l'export). Tout est en CSS (css/hud.css) ; ce fichier pose les classes, les calques et le panneau « Personnaliser… ».
// Mobile : rien (la disposition empilée reste maîtresse).
import { state, pulse } from "../state.js";
import { prefs } from "../store/prefs.js";
import { extendMenu } from "./menus.js";

const KEY = "tuiles-pc-v1";
const STYLES = [["normal", "Normal"], ["holo", "Hologramme 3D"], ["fin", "Fin"], ["verre", "Verre"], ["minimal", "Minimal"]];
const FX = [["cst", "Constellation"], ["halo", "Halo"], ["energy", "Énergie"]];
const SIZES = [[0.9, "90 %"], [1, "100 %"], [1.15, "115 %"], [1.3, "130 %"]];
const DEF = { style: "normal", cst: false, halo: false, energy: false, fs: 1 };
const NS = "http://www.w3.org/2000/svg";
const HOLO_LAYERS = ["back", "scan", "glass", "c1", "c2", "c3", "c4", "beam", "emit"];

/** `rescale(el, k)` : agrandit ou réduit la fenêtre quand la taille du texte change (fournie par windows.js). */
export function initTuiles({ els, rescale }) {
  if (state.lite) return { open() {}, get() { return DEF; } };
  let cfg = {};
  try { const d = JSON.parse(prefs.get(KEY, "{}")); if (d && typeof d === "object") cfg = d; } catch (e) { cfg = {}; }
  const get = (id) => ({ ...DEF, ...(cfg[id] || {}) });
  const save = () => prefs.set(KEY, JSON.stringify(cfg));
  const idOf = (el) => el.dataset.id;
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  // ---------- Calques ----------
  function ensureHolo(el) {
    const panel = el.querySelector(".panel"); if (panel.querySelector(".hl")) return;
    HOLO_LAYERS.forEach((k) => { const d = document.createElement("span"); d.className = "hl hl-" + k; d.setAttribute("aria-hidden", "true"); panel.append(d); });
  }
  function ensureRing(el) {
    const panel = el.querySelector(".panel"); if (panel.querySelector(".fx-ring")) return;
    const d = document.createElement("span"); d.className = "fx-ring"; d.setAttribute("aria-hidden", "true"); panel.append(d);
  }
  /** Points et fils qui scintillent autour du cadre (recalculés quand la fenêtre change de taille). */
  function drawConst(el) {
    let svg = el.querySelector(".fx-const");
    if (!svg) { svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "fx-const"); svg.setAttribute("aria-hidden", "true"); el.append(svg); }
    const w = el.offsetWidth, h = el.offsetHeight, M = 36, P = 2 * (w + h), N = Math.max(10, Math.min(22, Math.round(P / 90)));
    if (svg.dataset.k === w + "x" + h) return;
    svg.dataset.k = w + "x" + h;
    svg.setAttribute("width", w + 2 * M); svg.setAttribute("height", h + 2 * M); svg.style.left = -M + "px"; svg.style.top = -M + "px";
    const r = rng(hash(idOf(el))), pts = [];
    for (let k = 0; k < N; k++) {
      let d = ((k + r() * 0.8) / N) * P, x, y, nx, ny;
      if (d < w) { x = d; y = 0; nx = 0; ny = -1; } else if ((d -= w) < h) { x = w; y = d; nx = 1; ny = 0; }
      else if ((d -= h) < w) { x = w - d; y = h; nx = 0; ny = 1; } else { d -= w; x = 0; y = h - d; nx = -1; ny = 0; }
      const off = 5 + r() * 24; pts.push([x + nx * off + M, y + ny * off + M]);
    }
    let html = "";
    pts.forEach((p, i) => { const q = pts[(i + 1) % N], s = pts[(i + 3) % N]; html += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`; if (i % 3 === 0) html += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${s[0].toFixed(1)}" y2="${s[1].toFixed(1)}"/>`; });
    pts.forEach((p) => { html += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(1.1 + r() * 1.3).toFixed(1)}" style="animation-delay:${(-r() * 3).toFixed(2)}s"/>`; });
    svg.innerHTML = html;
  }
  const ro = new ResizeObserver((es) => es.forEach((e) => { const el = e.target; if (el.classList.contains("fx-cst")) drawConst(el); }));

  function apply(el) {
    const c = get(idOf(el)), cl = el.classList;
    STYLES.forEach(([k]) => { if (k !== "normal") cl.toggle("t-" + k, c.style === k); });
    cl.toggle("fx-halo", !!c.halo); cl.toggle("fx-energy", !!c.energy); cl.toggle("fx-cst", !!c.cst);
    if (c.style === "holo") ensureHolo(el);
    if (c.energy) ensureRing(el);
    if (c.cst) drawConst(el);
    if (c.fs !== 1) { el.dataset.fs = "1"; el.style.setProperty("--fs", c.fs); } else { delete el.dataset.fs; el.style.removeProperty("--fs"); }
  }
  els.forEach((el) => { ro.observe(el); apply(el); });

  function set(el, patch) {
    const id = idOf(el), before = get(id), next = { ...before, ...patch };
    if (JSON.stringify(next) === JSON.stringify(DEF)) delete cfg[id]; else cfg[id] = next;
    save(); apply(el);
    if (next.fs !== before.fs) rescale(el, next.fs / before.fs);
    pulse(0.4);
  }

  // ---------- Panneau « Personnaliser… » ----------
  const box = document.createElement("div"); box.className = "perso"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Personnaliser la fenêtre");
  document.body.append(box);
  let cur = null;
  const btn = (label, on, fn, cls = "opt") => { const b = document.createElement("button"); b.type = "button"; b.className = cls + (on ? " on" : ""); b.textContent = label; b.setAttribute("aria-pressed", String(!!on)); b.addEventListener("click", fn); return b; };
  const row = (label, kids) => { const r = document.createElement("div"); r.className = "prow"; const l = document.createElement("div"); l.className = "plbl"; l.textContent = label; const g = document.createElement("div"); g.className = "pgrp"; g.append(...kids); r.append(l, g); return r; };
  function render() {
    const el = cur; if (!el) return;
    const c = get(idOf(el)); box.innerHTML = "";
    const h = document.createElement("div"); h.className = "ptit"; h.textContent = "Personnaliser · " + el.querySelector("h2").textContent;
    box.append(h,
      row("Style", STYLES.map(([k, l]) => btn(k === "normal" ? "Normal (actuel)" : l, c.style === k, () => { set(el, { style: k }); render(); }))),
      row("Effets", FX.map(([k, l]) => btn(l, c[k], () => { set(el, { [k]: !c[k] }); render(); }))),
      row("Taille du texte", SIZES.map(([v, l]) => btn(l, c.fs === v, () => { set(el, { fs: v }); render(); }))));
    const f = document.createElement("div"); f.className = "pfoot";
    f.append(btn("Rétablir", false, () => { set(el, { ...DEF }); render(); }, "opt lnk"), btn("Fermer", false, close, "opt lnk"));
    box.append(f);
  }
  function place() {
    const r = cur.getBoundingClientRect(), b = box.getBoundingClientRect();
    let x = r.right + 12; if (x + b.width > innerWidth - 8) x = r.left - b.width - 12; if (x < 8) x = Math.max(8, Math.min(r.left + 16, innerWidth - b.width - 8));
    box.style.left = x + "px"; box.style.top = Math.max(8, Math.min(r.top, innerHeight - b.height - 8)) + "px";
  }
  function open(el) { cur = el; box.hidden = false; render(); place(); const f = box.querySelector("button"); if (f) f.focus({ preventScroll: true }); }
  function close() { box.hidden = true; cur = null; }
  addEventListener("pointerdown", (e) => { if (!box.hidden && !box.contains(e.target) && !(e.target.closest && e.target.closest("#ctx"))) close(); }, true);
  addEventListener("keydown", (e) => { if (!box.hidden && e.key === "Escape") { e.stopPropagation(); close(); } }, true);

  extendMenu("fenetre", (el) => [{ t: "Personnaliser…", fn: () => open(el) }]);
  return { open, get };
}
