// Fenêtres libres du PC (repris de la maquette v8) : déplacer par la barre de titre, redimensionner par le coin,
// figer avec la punaise, agrandir par double-clic sur la barre, inclinaison vers le noyau, disposition mémorisée.
// Les fenêtres vivent dans le « monde » zoomable : celles posées hors de l'écran apparaissent au plan 2.
// Sur mobile, rien de tout ça : la disposition empilée de la v3 reste maîtresse (css/mobile.css).
import { state, pulse } from "../state.js";
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const MIN = { w: 220, h: 120 };
const STORE = "disposition-pc-v1";          // clé hub-disposition-pc-v1 dans le stockage de l'appareil
const PINNED_BY_DEFAULT = ["video"];
const ACCENTS = { cyan: 0x3fe6ff, violet: 0x9b72ff, amber: 0xffb347 };
const PIN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>';

/** Disposition d'origine (v8) : colonnes gauche et droite, noyau et recherche au centre, d'autres fenêtres hors champ. */
function defaults(W, H) {
  const T = 124, B = H - 52, g = 14, side = 16, mid = 18;     // T : place du bandeau et de l'agenda (2.4) ; B : place du bandeau d'actualité (phase 3)
  const Lw = clamp(W * 0.23, 280, 380), Rw = clamp(W * 0.27, 320, 440);
  const Rx = W - side - Rw, Lx = side;
  const wh = clamp((B - T) * 0.3, 150, 200);
  const L = {};
  L.pc = { x: Lx, y: T, w: Lw, h: B - T - g - wh };
  L.watch = { x: Lx, y: B - wh, w: Lw, h: wh };
  const vh = (Rw - 36) * 9 / 16 + 76;
  L.video = { x: Rx, y: T, w: Rw, h: vh };
  L.tasks = { x: Rx, y: B - 150, w: Rw, h: 150 };
  L.web = { x: Rx, y: T + vh + g, w: Rw, h: Math.max(B - 150 - g - (T + vh + g), MIN.h) };
  const x0 = Lx + Lw + mid, x1 = Rx - mid, mw = x1 - x0;
  const th = clamp((mw - 36 - 32) / 5 * 9 / 16, 50, 110);
  const sh = th + 30 + 20 + 36 + 26;
  L.progress = { x: x0, y: B - sh, w: mw, h: sh };
  L.music = { x: -(Lw + 50), y: T, w: Lw, h: 250 };
  L.favs = { x: -(Lw + 50), y: T + 270, w: Lw, h: 220 };
  L.notes = { x: W + 50, y: T, w: Rw, h: 300 };
  const sw = Math.min(600, mw), sy = L.progress.y - 100;
  return { L, search: { x: x0 + (mw - sw) / 2, y: sy, w: sw }, anchor: { left: x0, top: T, width: mw, height: Math.max(sy - T - 6, 140) } };
}

export function createWindows({ world, plans, force }) {
  const els = [...world.querySelectorAll(".win:not(.mob-only)")];
  const S = {};
  let W = innerWidth, H = innerHeight, core = { x: W / 2, y: H / 2 }, zTop = 3, dragEl = null;
  const elById = (id) => els.find((el) => el.dataset.id === id);

  // Punaise, badge « figée », poignée : ajoutés ici pour ne pas alourdir index.html
  els.forEach((el) => {
    const ph = el.querySelector(".ph"), title = el.querySelector("h2").textContent;
    const pin = document.createElement("button");
    pin.type = "button"; pin.className = "pin"; pin.innerHTML = PIN_SVG;
    pin.setAttribute("aria-pressed", "false"); pin.setAttribute("aria-label", "Figer la fenêtre " + title); pin.title = "Figer / libérer";
    ph.append(pin);
    el.insertAdjacentHTML("beforeend", '<span class="badge" aria-hidden="true">◆ FIGÉE</span><span class="grip" aria-hidden="true"></span>');
  });

  function load() {
    try { const d = JSON.parse(prefs.get(STORE, "null")); return d && typeof d === "object" ? d : null; } catch (e) { return null; }
  }
  function save() {
    const out = {};
    els.forEach((el) => { const s = S[el.dataset.id]; out[el.dataset.id] = { x: s.tx / W, y: s.ty / H, w: s.w / W, h: s.h / H, pin: s.pin, hid: !!s.hid }; });
    prefs.set(STORE, JSON.stringify(out));
  }
  const applySize = (el, s) => { el.style.width = s.w + "px"; el.style.height = s.h + "px"; };
  function applyPin(el, s) { el.classList.toggle("pinned", s.pin); el.querySelector(".pin").setAttribute("aria-pressed", String(s.pin)); }

  /** Place les fenêtres (mémorisées ou d'origine) et renvoie l'emplacement du noyau et de la recherche. */
  function layout(RW, RH, reset) {
    W = RW; H = RH;
    const D = defaults(W, H), saved = reset ? null : load();
    els.forEach((el) => {
      const id = el.dataset.id, d = D.L[id] || { x: W / 2 - 150, y: H / 2 - 100, w: 300, h: 200 }, sv = saved && saved[id], prev = S[id];
      const s = prev || { cx: 0, cy: 0, ry: 0, rz: 0, vx: 0, hover: false, drag: false, pin: PINNED_BY_DEFAULT.includes(id), hid: false, max: null, last: "" };
      if (sv) { s.tx = sv.x * W; s.ty = sv.y * H; s.w = Math.max(sv.w * W, MIN.w); s.h = Math.max(sv.h * H, MIN.h); s.pin = !!sv.pin; s.hid = !!sv.hid; }
      else { s.tx = d.x; s.ty = d.y; s.w = d.w; s.h = d.h; if (reset) { s.pin = PINNED_BY_DEFAULT.includes(id); s.hid = false; s.max = null; } }
      if (!prev) { s.cx = s.tx; s.cy = s.ty; }       // ensuite, chaque changement de place glisse en douceur
      S[id] = s;
      el.classList.toggle("hid", s.hid);
      applySize(el, s); applyPin(el, s);
    });
    core = { x: D.anchor.left + D.anchor.width / 2, y: D.anchor.top + D.anchor.height / 2 };
    return D;
  }

  function toggleMax(el) {
    const s = S[el.dataset.id];
    if (s.pin) { toast("Fenêtre figée : libère-la d'abord (punaise)"); return; }
    if (s.max) { Object.assign(s, s.max); s.max = null; }
    else { s.max = { tx: s.tx, ty: s.ty, w: s.w, h: s.h }; s.tx = 16; s.ty = 124; s.w = W - 32; s.h = H - 124 - 52; }
    applySize(el, s); el.style.zIndex = ++zTop; pulse(0.6); save();
  }

  /** 1 si la fenêtre est dans l'écran du hub, 2 si elle attend hors champ. */
  function planOf(el) {
    const s = S[el.dataset.id]; if (!s) return 1;
    const cx = s.tx + s.w / 2, cy = s.ty + s.h / 2;
    return cx > 0 && cx < W && cy > 0 && cy < H ? 1 : 2;
  }

  els.forEach((el) => {
    const id = el.dataset.id, ph = el.querySelector(".ph"), grip = el.querySelector(".grip"), pinBtn = el.querySelector(".pin");
    let sx = 0, sy = 0, ox = 0, oy = 0, ow = 0, oh = 0, mode = null, lastX = 0;
    el.addEventListener("pointerenter", () => { if (state.lite) return; S[id].hover = true; state.energyTarget = 0.6; state.accent = ACCENTS[el.dataset.accent] || ACCENTS.cyan; });
    el.addEventListener("pointerleave", () => { if (state.lite) return; S[id].hover = false; if (!mode) { state.energyTarget = 0; state.accent = null; } });
    pinBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    pinBtn.addEventListener("dblclick", (e) => e.stopPropagation());
    pinBtn.addEventListener("click", () => {
      const s = S[id]; s.pin = !s.pin; applyPin(el, s);
      toast(s.pin ? "Fenêtre figée : elle ne bouge plus" : "Fenêtre libérée"); pulse(0.8); save();
    });
    function start(e, m) {
      if (state.lite || e.button !== 0) return;
      const s = S[id];
      el.style.zIndex = ++zTop;
      if (s.pin) { s.rz = 2.5; toast("Fenêtre figée : clique sur la punaise pour la libérer"); return; }
      mode = m; sx = e.clientX; sy = e.clientY; ox = s.tx; oy = s.ty; ow = s.w; oh = s.h; lastX = e.clientX;
      s.drag = m === "move"; el.classList.add("dragging"); dragEl = el; force.setDrag(el);
      e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
    }
    function move(e) {
      if (!mode) return;
      const s = S[id], z = plans.zoom, dx = (e.clientX - sx) / z, dy = (e.clientY - sy) / z;
      if (s.max && Math.abs(dx) + Math.abs(dy) > 4) s.max = null;   // déplacée ou retaillée à la main : elle n'est plus « agrandie »
      if (mode === "move") { s.tx = ox + dx; s.ty = oy + dy; s.vx = e.clientX - lastX; lastX = e.clientX; }
      else { s.w = Math.max(MIN.w, ow + dx); s.h = Math.max(MIN.h, oh + dy); applySize(el, s); }
    }
    function end() {
      if (!mode) return;
      const s = S[id];
      if (mode === "move") { s.tx = Math.round(s.tx / 8) * 8; s.ty = Math.round(s.ty / 8) * 8; }
      mode = null; s.drag = false; s.vx = 0; el.classList.remove("dragging"); dragEl = null; force.setDrag(null); save();
      if (!s.hover) { state.energyTarget = 0; state.accent = null; }
    }
    ph.addEventListener("pointerdown", (e) => start(e, "move"));
    grip.addEventListener("pointerdown", (e) => start(e, "size"));
    [ph, grip].forEach((h) => { h.addEventListener("pointermove", move); h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end); h.addEventListener("lostpointercapture", end); });
    // Double-clic : depuis le plan 2 ou 3, aller au plan de la fenêtre ; au plan 1, sur la barre de titre, agrandir ou restaurer.
    el.addEventListener("dblclick", (e) => {
      if (state.lite) return;
      if (plans.plan !== 1) { const n = planOf(el); plans.goPlan(n); toast("Plan " + n); return; }
      if (e.target.closest(".ph")) toggleMax(el);
    });
  });

  /** Une image : les fenêtres glissent vers leur cible, s'inclinent vers le noyau, penchent quand on les traîne. */
  function update(dt) {
    if (state.lite) return;
    const kPos = state.reduce ? 1 : 1 - Math.exp(-dt * 16), kRot = state.reduce ? 1 : 1 - Math.exp(-dt * 8);
    els.forEach((el) => {
      const s = S[el.dataset.id];
      const pl = planOf(el); el.classList.toggle("p1", pl === 1); el.classList.toggle("p2", pl === 2);
      s.cx += (s.tx - s.cx) * kPos; s.cy += (s.ty - s.cy) * kPos;
      if (Math.abs(s.tx - s.cx) < 0.05) s.cx = s.tx;
      if (Math.abs(s.ty - s.cy) < 0.05) s.cy = s.ty;
      const mid = s.cx + s.w / 2;
      const ryT = (s.hover || s.drag) ? 0 : -9 * clamp((mid - core.x) / (W * 0.33), -1, 1);
      const rzT = s.drag && !state.reduce ? clamp(s.vx * 0.12, -3, 3) : 0;
      s.ry += (ryT - s.ry) * kRot; s.rz += (rzT - s.rz) * kRot; s.vx *= 0.85;
      if (Math.abs(s.rz) < 0.005) s.rz = 0;
      const tf = `translate3d(${s.cx.toFixed(1)}px, ${s.cy.toFixed(1)}px, 0) perspective(1200px) rotateY(${s.ry.toFixed(2)}deg) rotateZ(${s.rz.toFixed(2)}deg) scale(${s.drag ? 1.025 : 1})`;
      if (tf !== s.last) { s.last = tf; el.style.transform = tf; }
    });
  }

  function reset() { const D = layout(W, H, true); save(); return D; }
  return { layout, update, reset, planOf, toggleMax, get dragEl() { return dragEl; }, elById, S };
}
