// Fenêtres libres du PC (repris de la maquette v8) : déplacer par la barre de titre, redimensionner par le coin,
// figer avec la punaise, agrandir par double-clic sur la barre, inclinaison vers le noyau, disposition mémorisée.
// Les fenêtres vivent dans le « monde » zoomable : celles posées hors de l'écran apparaissent au plan 2.
// Sur mobile, rien de tout ça : la disposition empilée de la v3 reste maîtresse (css/mobile.css).
import { state, pulse } from "../state.js";
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
import { initTuiles } from "./tuiles.js";
import { inReserve, setReserve as setRes, onReserve } from "./reserve.js";

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const MIN = { w: 220, h: 120 };
const STORE = "disposition-pc-v1";          // clé hub-disposition-pc-v1 dans le stockage de l'appareil
const PINNED_BY_DEFAULT = ["video"];
const LAYOUT_V = 3;                          // v3 (refonte) : plan 1 = Favoris, Musique, Vidéo, Notes ; plan 2 = Mon PC, Progression, Page en direct, Noyau
const FOCUS = { max: 1.45, w: 0.62, h: 0.86, hold: 550, move: 6, z: 9000 };   // « Ramener vers moi » (p2-focus)
const ACCENTS = { cyan: 0x3fe6ff, violet: 0x9b72ff, amber: 0xffb347 };
const PIN_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>';

/** Disposition d'origine (v3, refonte) : plan 1 = Favoris et Musique à gauche, Vidéo et Notes à droite ; plan 2 (mur de la salle) = Mon PC,
 *  Progression, Page en direct, Noyau. Les fonctions en réserve gardent une place hors champ. */
function defaults(W, H) {
  const T = 124, B = H - 52, g = 14, side = 16, mid = 18;     // T : place du bandeau et de l'agenda ; B : place du bandeau d'actualité
  const Lw = clamp(W * 0.23, 280, 380), Rw = clamp(W * 0.27, 320, 440);
  const Rx = W - side - Rw, Lx = side;
  const L = {};
  const lh = B - T - g, fh = Math.round(lh * 0.58);
  L.favs = { x: Lx, y: T, w: Lw, h: fh };
  L.music = { x: Lx, y: T + fh + g, w: Lw, h: lh - fh };
  const vh = (Rw - 36) * 9 / 16 + 76;
  L.video = { x: Rx, y: T, w: Rw, h: vh };
  L.notes = { x: Rx, y: T + vh + g, w: Rw, h: Math.max(B - (T + vh + g), MIN.h) };
  L.pc = { x: -(Lw + 50), y: T, w: Lw, h: 430 };
  L.progress = { x: -(Lw + 50), y: T + 450, w: Lw, h: 330 };
  L.web = { x: W + 50, y: T, w: Rw + 40, h: 520 };
  L.noyau = { x: W + 50, y: T + 540, w: Math.max(Rw, 440), h: 560 };
  L.tasks = { x: -(Lw + 50), y: T + 800, w: Lw, h: 300 };
  L.watch = { x: -(Lw + 50), y: T + 1120, w: Lw, h: 200 };
  L.rituels = { x: -(Lw + 50), y: T + 1340, w: Lw, h: 330 };
  L.mails = { x: W + 50, y: T + 1120, w: Rw, h: 280 };
  L.radar = { x: W + 50, y: T + 1420, w: Rw, h: 440 };
  L.securite = { x: W + 50, y: T + 1880, w: Math.max(Rw, 440), h: 600 };
  L.savoir = { x: W + 50, y: T + 2500, w: Math.max(Rw, 460), h: 760 };
  const x0 = Lx + Lw + mid, x1 = Rx - mid, mw = x1 - x0;
  const sw = Math.min(600, mw), sy = B - 96;     // la recherche descend en bas du centre ; l'orbe prend le reste
  return { L, search: { x: x0 + (mw - sw) / 2, y: sy, w: sw }, anchor: { left: x0, top: T, width: mw, height: Math.max(sy - T - 6, 140) } };
}

export function createWindows({ world, plans, force }) {
  const els = [...world.querySelectorAll(".win:not(.mob-only)")];
  const S = {};
  let fzoom = 1, W = innerWidth, H = innerHeight, core = { x: W / 2, y: H / 2 }, zTop = 3, dragEl = null;
  const elById = (id) => els.find((el) => el.dataset.id === id);

  // Punaise, badge « figée », poignée : ajoutés ici pour ne pas alourdir index.html
  els.forEach((el) => {
    const ph = el.querySelector(".ph"), title = el.querySelector("h2").textContent;
    const pin = document.createElement("button");
    pin.type = "button"; pin.className = "pin"; pin.innerHTML = PIN_SVG;
    const h2 = el.querySelector("h2"); h2.title = "Clic : réduire ou rouvrir · glisser : déplacer"; h2.setAttribute("aria-expanded", "true");
    pin.setAttribute("aria-pressed", "false"); pin.setAttribute("aria-label", "Figer la fenêtre " + title); pin.title = "Figer / libérer";
    ph.append(pin);
    el.insertAdjacentHTML("beforeend", '<span class="badge" aria-hidden="true">◆ FIGÉE</span><span class="grip" aria-hidden="true"></span>');
  });

  // ---------- Allègement : étiquettes qui répètent le titre, pieds fixes sans action ni chiffre ----------
  const TAG_REDONDANT = new Set(["IA", "CARTE 3D", "SUIVI DU HUB", "LECTURE SEULE"]);
  const norm = (t) => t.trim().toUpperCase();
  const FOOT_FIXE = new Set(["LECTEUR YOUTUBE INTÉGRÉ", "STOCKÉES SUR L'APPAREIL", "RADIOS, YOUTUBE, MP3", "TOUT LE PC : TOUCHE 3 OU BOUTON PLAN 3", "RELEVÉ DU SUIVI DU HUB", "APERÇU ACTUALISÉ", "APERÇU", "STOCKÉS SUR L'APPAREIL", "VÉRIFICATION TOUTES LES 10 MIN", "LECTURE SEULE", "—"]);
  function tidy(el) {
    if (state.lite) return;
    const tag = el.querySelector(".ph .tag"), t = tag ? norm(tag.textContent) : "";
    if (tag) tag.classList.toggle("off", !t || t === norm(el.querySelector("h2").textContent) || /^PHASE \d/.test(t) || TAG_REDONDANT.has(t));
    const pf = el.querySelector(".pf"); if (!pf) return;
    let seen = 0;
    [...pf.children].forEach((c) => { const off = c.tagName === "SPAN" && FOOT_FIXE.has(norm(c.textContent)) && !c.querySelector("button, a"); c.classList.toggle("off", off); if (!off) seen++; });
    pf.classList.toggle("off", seen === 0);
  }
  let tidyQ = new Set(), tidyRaf = 0;
  const tidyLater = (el) => { tidyQ.add(el); if (!tidyRaf) tidyRaf = requestAnimationFrame(() => { tidyRaf = 0; const q = tidyQ; tidyQ = new Set(); q.forEach(tidy); }); };
  els.forEach((el) => { tidy(el); new MutationObserver(() => tidyLater(el)).observe(el, { subtree: true, childList: true, characterData: true }); });

  function load() {
    try {
      const d = JSON.parse(prefs.get(STORE, "null")); if (!d || typeof d !== "object") return null;
      if (d._v !== LAYOUT_V) return null;      // v3 : nouvelle disposition d'origine (les places mémorisées avant la refonte ne s'appliquent plus)
      return d;
    } catch (e) { return null; }
  }
  function save() {
    const out = { _v: LAYOUT_V };
    els.forEach((el) => { const s = S[el.dataset.id]; out[el.dataset.id] = { x: s.tx / W, y: s.ty / H, w: s.w / W, h: s.h / H, pin: s.pin, hid: !!s.hid && !s.res, red: !!s.red, wa: s.wa, wy: Math.round(s.wy || 0) }; });
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
      const s = prev || { cx: 0, cy: 0, ry: 0, rz: 0, vx: 0, hover: false, drag: false, pin: PINNED_BY_DEFAULT.includes(id), hid: false, max: null, last: "", fx: 0, fy: 0, fk: 1, fxT: 0, fyT: 0, fkT: 1, foc: false, red: false, bvx: 0, bvy: 0, settle: 0, wa: null, wy: 0, waAuto: 0, isWall: false, lastOp: "", res: false };
      if (sv) { s.tx = sv.x * W; s.ty = sv.y * H; s.w = Math.max(sv.w * W, MIN.w); s.h = Math.max(sv.h * H, MIN.h); s.pin = !!sv.pin; s.hid = !!sv.hid; s.red = !!sv.red; s.wa = typeof sv.wa === "number" ? sv.wa : null; s.wy = +sv.wy || 0; }
      else { s.tx = d.x; s.ty = d.y; s.w = d.w; s.h = d.h; if (reset) { s.pin = PINNED_BY_DEFAULT.includes(id); s.hid = false; s.max = null; s.red = false; s.wa = null; s.wy = 0; } }
      if (!prev) { s.cx = s.tx; s.cy = s.ty; }       // ensuite, chaque changement de place glisse en douceur
      S[id] = s;
      s.res = inReserve(id); if (s.res) s.hid = true;
      el.classList.toggle("hid", s.hid); el.classList.toggle("reduced", s.red);
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

  function togglePin(el) {
    const s = S[el.dataset.id]; s.pin = !s.pin; applyPin(el, s);
    toast(s.pin ? "Fenêtre figée : elle ne bouge plus" : "Fenêtre libérée"); pulse(0.8); save();
  }
  const title = (el) => el.querySelector("h2").textContent;
  /** Réduire une fenêtre à son seul nom (clic sur le nom) ou la rouvrir. Elle continue de vivre (radio, rappels). */
  function setReduced(el, red) {
    const s = S[el.dataset.id]; if (!s || !!s.red === !!red) return;
    s.red = !!red; el.classList.toggle("reduced", s.red);
    el.querySelector("h2").setAttribute("aria-expanded", String(!s.red));
    if (!s.red) bringFront(el);
    pulse(0.5); save();
  }
  const toggleReduced = (el) => setReduced(el, !S[el.dataset.id].red);
  function bringFront(el) { el.style.zIndex = ++zTop; }
  /** Masquer ou réafficher une fenêtre (elle garde sa place et sa taille). */
  function setHidden(el, hid) {
    const s = S[el.dataset.id]; s.hid = hid; el.classList.toggle("hid", hid);
    if (hid) { s.hover = false; state.energyTarget = 0; state.accent = null; toast("« " + title(el) + " » masquée · clic droit sur le fond pour la réafficher"); }
    else { bringFront(el); pulse(0.8); }
    save();
  }
  const hiddenEls = () => els.filter((el) => S[el.dataset.id] && S[el.dataset.id].hid && !S[el.dataset.id].res);
  const reservedEls = () => els.filter((el) => S[el.dataset.id] && S[el.dataset.id].res);
  /** Ranger une fonction en réserve ou la remettre dans le hub. */
  function setReserve(el, on) {
    const id = el.dataset.id, s = S[id]; if (!s) return;
    setRes(id, on); s.res = on;
    if (on) { s.hover = false; s.hid = true; el.classList.add("hid"); }
    else { s.hid = false; el.classList.remove("hid"); if (planOf(el) !== 1) toPlan1(el); bringFront(el); pulse(0.8); toast("« " + title(el) + " » remise dans le hub"); }
    wallSig = ""; save();
  }

  /** 1 si la fenêtre est dans l'écran du hub, 2 si elle attend hors champ. */
  function planOf(el) {
    const s = S[el.dataset.id]; if (!s) return 1;
    const cx = s.tx + s.w / 2, cy = s.ty + s.h / 2;
    return cx > 0 && cx < W && cy > 0 && cy < H ? 1 : 2;
  }

  // ---------- Plan 2 : salle immersive (mur courbe grandeur nature) ----------
  // Chaque fenêtre posée hors de l'écran du hub se range sur un mur courbe autour du point de vue (angle wa, hauteur wy).
  // La caméra tourne la tête (plans.yaw). Taille réelle, quel que soit le recul du monde : voir le calcul dans update().
  const WALL_GAP = 70, WALL_CENTER = 560, P0 = 1080;
  let wallSig = "";
  function wallLayout() {
    const wall = els.filter((el) => { const s = S[el.dataset.id]; return s && !s.hid && planOf(el) === 2; });
    els.forEach((el) => { S[el.dataset.id].isWall = false; });
    wall.forEach((el) => { S[el.dataset.id].isWall = true; });
    const sig = wall.map((el) => el.dataset.id + (S[el.dataset.id].wa == null ? "a" : "m") + Math.round(S[el.dataset.id].w)).join(",");
    if (sig === wallSig) return; wallSig = sig;
    const autos = wall.filter((el) => S[el.dataset.id].wa == null).sort((a, b) => S[a.dataset.id].tx - S[b.dataset.id].tx);
    // Un couloir libre au centre (le plan 1 et l'orbe, reculés au fond de la salle) ; les fenêtres se rangent de part et d'autre
    const half = Math.ceil(autos.length / 2), left = autos.slice(0, half), right = autos.slice(half);
    let u = -WALL_CENTER / 2;
    for (let i = left.length - 1; i >= 0; i--) { const s = S[left[i].dataset.id]; s.waAuto = Math.atan((u - s.w / 2) / P0); u -= s.w + WALL_GAP; }
    u = WALL_CENTER / 2;
    right.forEach((el) => { const s = S[el.dataset.id]; s.waAuto = Math.atan((u + s.w / 2) / P0); u += s.w + WALL_GAP; });
    let lo = 0, hi = 0;
    wall.forEach((el) => { const s = S[el.dataset.id], a = s.wa ?? s.waAuto; lo = Math.min(lo, a); hi = Math.max(hi, a); });
    plans.setYawRange(lo, hi);
  }

  // ---------- Ramener vers moi (p2-focus) ----------
  // La fenêtre avance au centre et grandit ; un seul voile (assombri et flou) recule le reste. Calculé dans le repère du « monde » :
  // on retrouve par approches successives le point du monde qui tombe au centre de l'écran, même quand la caméra est au plan 2.
  // Place aimantée (grille de 8 px) affichée en pointillé pendant le glisser
  const ghost = document.createElement("div"); ghost.className = "snap-ghost"; ghost.setAttribute("aria-hidden", "true"); world.append(ghost);
  const SNAP = 8, snap = (v) => Math.round(v / SNAP) * SNAP;
  const veil = document.createElement("div"); veil.className = "focus-veil"; veil.setAttribute("aria-hidden", "true"); world.prepend(veil);
  let focusEl = null, prevPlan = 1;
  function worldMap() {
    const cs = getComputedStyle(world), o = (cs.transformOrigin || "0 0").split(" ").map(parseFloat);
    const m = cs.transform && cs.transform !== "none" ? new DOMMatrix(cs.transform) : new DOMMatrix();
    const full = new DOMMatrix().translate(o[0] || 0, o[1] || 0).multiply(m).translate(-(o[0] || 0), -(o[1] || 0));
    return (x, y) => { const p = full.transformPoint(new DOMPoint(x, y, 0, 1)); return { x: p.x / (p.w || 1), y: p.y / (p.w || 1) }; };
  }
  function aim(el) {
    const s = S[el.dataset.id], f = worldMap(), vw = innerWidth, vh = innerHeight, tx = vw / 2, ty = vh / 2 + 24;
    const bx = s.cx + s.w / 2, by = s.cy + s.h / 2, p = { x: bx, y: by };
    const scaleAt = () => { const a = f(p.x, p.y), b = f(p.x + 1, p.y); return Math.max(0.05, Math.hypot(b.x - a.x, b.y - a.y)); };
    for (let i = 0; i < 6; i++) { const q = f(p.x, p.y), ls = scaleAt(); p.x += (tx - q.x) / ls; p.y += (ty - q.y) / ls; }
    const kS = Math.min(FOCUS.max, vw * FOCUS.w / s.w, vh * FOCUS.h / s.h);
    s.fxT = p.x - bx; s.fyT = p.y - by; s.fkT = kS / scaleAt();
  }
  function focus(el) {
    if (state.lite || !el || focusEl === el) return;
    const s = S[el.dataset.id]; if (!s || s.hid) return;
    if (focusEl) unfocus(true);
    if (s.red) setReduced(el, false);
    focusEl = el; prevPlan = plans.plan; s.foc = true;
    el.classList.add("focus"); el.style.zIndex = FOCUS.z; world.classList.add("has-focus");
    if (prevPlan !== 1) plans.goPlan(1);          // la caméra revient au plan 1 pour une fenêtre nette et droite
    fzoom = plans.zoom; aim(el); pulse(0.8);
  }
  /** Renvoie la fenêtre à sa place (animation inverse). keepPlan : ne pas ramener la caméra au plan d'avant (changement de plan voulu). */
  function unfocus(keepPlan) {
    const el = focusEl; if (!el) return; focusEl = null;
    const s = S[el.dataset.id]; s.foc = false; s.fxT = 0; s.fyT = 0; s.fkT = 1;
    world.classList.remove("has-focus");
    if (!keepPlan && prevPlan !== 1) plans.goPlan(prevPlan);
  }
  veil.addEventListener("click", () => unfocus());
  addEventListener("contextmenu", (e) => { if (focusEl && e.target === veil) { e.preventDefault(); e.stopPropagation(); unfocus(); } }, true);
  addEventListener("keydown", (e) => {
    if (!focusEl) return;
    if (e.key === "Escape" && !(e.target.closest && e.target.closest("input, textarea, .diag, .ctx"))) unfocus();
    else if ((e.key === "1" || e.key === "2" || e.key === "3") && !(e.target.closest && e.target.closest("input, textarea")) && !e.ctrlKey && !e.metaKey && !e.altKey) unfocus(true);
  });

  // ---------- Molette : changer une fenêtre de niveau (vers moi · plan 1 · plan 2) ----------
  // Clic maintenu sur une fenêtre + molette vers le haut : elle vient vers toi ; vers le bas : elle repart. Alt + flèche haut / bas au survol.
  let holdEl = null, stepAt = 0, gaugeT = 0;
  const gauge = document.createElement("div"); gauge.className = "lvl-gauge"; gauge.hidden = true; gauge.setAttribute("aria-hidden", "true");
  gauge.innerHTML = '<span data-l="2">VERS MOI</span><span data-l="1">PLAN 1</span><span data-l="0">PLAN 2</span>'; document.body.append(gauge);
  const levelOf = (el) => (focusEl === el ? 2 : planOf(el) === 1 ? 1 : 0);
  function showGauge(el, l) {
    const r = el.getBoundingClientRect(); gauge.hidden = false;
    gauge.querySelectorAll("span").forEach((sp) => sp.classList.toggle("on", +sp.dataset.l === l));
    const gw = gauge.offsetWidth || 110; gauge.style.left = Math.max(8, Math.min(r.right + 10 > innerWidth - gw - 8 ? r.left - gw - 10 : r.right + 10, innerWidth - gw - 8)) + "px";
    gauge.style.top = Math.max(8, Math.min(r.top + 10, innerHeight - 110)) + "px";
    clearTimeout(gaugeT); gaugeT = setTimeout(() => { gauge.hidden = true; }, 1300);
  }
  const rect1 = (el) => { const s = S[el.dataset.id]; return { x: s.tx, y: s.ty, w: s.w, h: s.h }; };
  const hit = (a, b, g) => a.x < b.x + b.w + g && b.x < a.x + a.w + g && a.y < b.y + b.h + g && b.y < a.y + a.h + g;
  /** Plan 1 : la place libre la plus proche de la colonne du côté d'où elle vient (hors de la zone de l'orbe). */
  function toPlan1(el) {
    const s = S[el.dataset.id], left = (s.wa ?? s.waAuto) < 0;
    s.w = Math.min(s.w, W * 0.4); s.h = Math.min(s.h, H - 124 - 52); applySize(el, s);
    const others = els.filter((o) => o !== el && S[o.dataset.id] && !S[o.dataset.id].hid && planOf(o) === 1).map(rect1);
    const orb = { x: core.x - 230, y: core.y - 190, w: 460, h: 380 };
    let best = null, bestD = 1e9;
    for (let y = 124; y <= H - 52 - s.h; y += 20) for (let x = 16; x <= W - 16 - s.w; x += 20) {
      const r = { x, y, w: s.w, h: s.h };
      if (others.some((o) => hit(r, o, 14))) continue;
      const d = Math.hypot(x + s.w / 2 - (left ? W * 0.18 : W * 0.82), y + s.h / 2 - H * 0.5) + (hit(r, orb, 0) ? 600 : 0);
      if (d < bestD) { bestD = d; best = r; }
    }
    s.tx = best ? best.x : clamp(W / 2 - s.w / 2, 16, W - s.w - 16); s.ty = best ? best.y : 140; s.wa = null; s.wy = 0;
    wallSig = ""; el.style.zIndex = ++zTop; save();
  }
  /** Plan 2 : la place libre du mur la plus proche de ton regard. */
  function toPlan2(el) {
    const s = S[el.dataset.id], P = P0;
    const wall = els.filter((o) => o !== el && S[o.dataset.id] && S[o.dataset.id].isWall).map((o) => { const q = S[o.dataset.id]; return { u: P * Math.tan(q.wa ?? q.waAuto), w: q.w }; });
    let th = plans.yaw;
    for (let k = 0; k < 24; k++) {
      const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.12, u = P * Math.tan(plans.yaw + off);
      if (!wall.some((o) => Math.abs(o.u - u) < (o.w + s.w) / 2 + WALL_GAP)) { th = plans.yaw + off; break; }
    }
    s.tx = W + 50; s.ty = Math.max(124, s.ty); s.wa = th; s.wy = 0; s.max = null; wallSig = ""; save();
  }
  function setLevel(el, l) {
    const s = S[el.dataset.id]; if (!s || s.hid || state.lite) return;
    const cur = levelOf(el); if (l === cur) return;
    if (s.pin) { toast("Fenêtre figée : libère-la d'abord (punaise)"); return; }
    if (cur === 2) unfocus(l === 0);
    if (l === 2) { if (cur === 0) toPlan1(el); focus(el); }
    else if (l === 1) { if (cur === 0) toPlan1(el); }
    else toPlan2(el);
    pulse(0.5); showGauge(el, l);
  }
  const step = (el, dir) => { const t = performance.now(); if (t - stepAt < 330) return; stepAt = t; setLevel(el, clamp(levelOf(el) + dir, 0, 2)); };
  addEventListener("wheel", (e) => { if (!holdEl || state.lite) return; e.preventDefault(); e.stopPropagation(); step(holdEl, e.deltaY < 0 ? 1 : -1); }, { passive: false, capture: true });
  ["pointerup", "pointercancel", "blur"].forEach((t) => addEventListener(t, () => { holdEl = null; }, true));
  addEventListener("keydown", (e) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown") || state.lite || (e.target.closest && e.target.closest("input, textarea"))) return;
    const el = focusEl || els.find((o) => S[o.dataset.id] && S[o.dataset.id].hover); if (!el) return;
    e.preventDefault(); step(el, e.key === "ArrowUp" ? 1 : -1);
  });

  els.forEach((el) => {
    const id = el.dataset.id, ph = el.querySelector(".ph"), grip = el.querySelector(".grip"), pinBtn = el.querySelector(".pin");
    let sx = 0, sy = 0, ox = 0, oy = 0, ow = 0, oh = 0, mode = null, lastX = 0, lastY = 0, downTitle = false, moved = 0, wallDrag = false;
    el.addEventListener("pointerenter", () => { if (state.lite) return; S[id].hover = true; state.energyTarget = 0.6; state.accent = ACCENTS[el.dataset.accent] || ACCENTS.cyan; });
    el.addEventListener("pointerleave", () => { if (state.lite) return; S[id].hover = false; if (!mode) { state.energyTarget = 0; state.accent = null; } });
    pinBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    pinBtn.addEventListener("dblclick", (e) => e.stopPropagation());
    pinBtn.addEventListener("click", () => togglePin(el));
    function showGhost(s) {
      ghost.style.transform = `translate3d(${snap(s.tx)}px, ${snap(s.ty)}px, 0)`; ghost.style.width = s.w + "px"; ghost.style.height = s.h + "px"; ghost.classList.add("on");
    }
    function start(e, m) {
      if (state.lite || e.button !== 0) return;
      const s = S[id];
      el.style.zIndex = ++zTop;
      if (s.pin) { if (!e.target.closest("h2")) { s.rz = 2.5; toast("Fenêtre figée : clique sur la punaise pour la libérer"); } else { downTitle = true; moved = 0; sx = e.clientX; sy = e.clientY; mode = "title"; e.currentTarget.setPointerCapture(e.pointerId); } return; }
      downTitle = m === "move" && !!e.target.closest("h2"); moved = 0;
      mode = m; sx = e.clientX; sy = e.clientY; ox = s.tx; oy = s.ty; ow = s.w; oh = s.h; lastX = e.clientX; lastY = e.clientY;
      wallDrag = m === "move" && s.isWall && state.cine > 0.9;
      s.drag = m === "move"; s.settle = 0; el.classList.add("dragging"); dragEl = el; force.setDrag(el);
      e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
    }
    function move(e) {
      if (!mode) return;
      const s = S[id], z = plans.zoom, dx = (e.clientX - sx) / z, dy = (e.clientY - sy) / z;
      moved = Math.max(moved, Math.hypot(e.clientX - sx, e.clientY - sy));
      if (mode === "title") return;                      // fenêtre figée : seul le clic sur le nom compte
      if (s.max && Math.abs(dx) + Math.abs(dy) > 4) s.max = null;   // déplacée ou retaillée à la main : elle n'est plus « agrandie »
      if (mode === "move") {
        if (wallDrag) {                                  // sur le mur de la salle : la fenêtre glisse en angle et en hauteur
          if (!downTitle || moved > 6) {
            const P = plans.persp, th = (s.wa ?? s.waAuto) - plans.yaw, nu = P * Math.tan(th) + (e.clientX - lastX);
            s.wa = Math.atan(nu / P) + plans.yaw; s.wy = clamp((s.wy || 0) + (e.clientY - lastY), -H * 0.45, H * 0.45);
            s.vx = e.clientX - lastX; lastX = e.clientX; lastY = e.clientY;
          } else { lastX = e.clientX; lastY = e.clientY; }
        } else if (!downTitle || moved > 6) { s.tx = ox + dx; s.ty = oy + dy; s.vx = e.clientX - lastX; lastX = e.clientX; showGhost(s); }   // sous 6 px sur le nom : c'est un clic, pas un déplacement
      }
      else { s.w = Math.max(MIN.w, ow + dx); s.h = Math.max(MIN.h, oh + dy); applySize(el, s); }
    }
    function end(e) {
      if (!mode) return;
      const s = S[id], click = downTitle && moved <= 6 && e && e.type === "pointerup";
      if (mode === "move" && wallDrag) { wallSig = ""; }
      else if (mode === "move" && !click) { s.tx = snap(s.tx); s.ty = snap(s.ty); s.settle = state.reduce ? 0 : 0.45; s.bvx = s.bvy = 0; }   // pose avec un léger rebond
      else if (mode === "move") { s.tx = ox; s.ty = oy; }
      const wasDrag = mode !== "title";
      mode = null; s.drag = false; s.vx = 0; el.classList.remove("dragging"); ghost.classList.remove("on"); if (wasDrag) { dragEl = null; force.setDrag(null); force.setDragRect(null); }
      if (click) toggleReduced(el); else save();
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
    // Clic sur une fenêtre : elle passe devant. Clic maintenu sur son contenu : la molette la change de niveau (voir plus bas).
    el.addEventListener("pointerdown", (e) => {
      if (state.lite || e.button !== 0 || S[id].hid) return;
      if (!e.target.closest(".ph")) bringFront(el);
      if (e.target.closest(".ph, .grip, .pin, button, a, input, textarea, select, label, canvas, iframe, [contenteditable='true']")) return;
      holdEl = el;
    });
  });

  /** Une image : les fenêtres glissent vers leur cible, s'inclinent vers le noyau, penchent quand on les traîne. */
  function update(dt) {
    if (state.lite) return;
    if (state.cine > 0.01) wallLayout(); else if (wallSig) { wallSig = ""; els.forEach((el) => { S[el.dataset.id].isWall = false; }); }
    const kPos = state.reduce ? 1 : 1 - Math.exp(-dt * 16), kRot = state.reduce ? 1 : 1 - Math.exp(-dt * 8);
    els.forEach((el) => {
      const s = S[el.dataset.id];
      const pl = planOf(el); el.classList.toggle("p1", pl === 1); el.classList.toggle("p2", pl === 2);
      if (s.drag) { s.cx = s.tx; s.cy = s.ty; }                                  // glisser : la fenêtre colle à la souris, sans retard
      else if (s.settle > 0) {                                                    // lâcher : petit ressort (rebond de 0,4 s)
        s.settle -= dt;
        s.bvx += ((s.tx - s.cx) * 380 - s.bvx * 22) * dt; s.bvy += ((s.ty - s.cy) * 380 - s.bvy * 22) * dt;
        s.cx += s.bvx * dt; s.cy += s.bvy * dt;
        if (s.settle <= 0) { s.settle = 0; s.bvx = s.bvy = 0; }
      } else {
        s.cx += (s.tx - s.cx) * kPos; s.cy += (s.ty - s.cy) * kPos;
        if (Math.abs(s.tx - s.cx) < 0.05) s.cx = s.tx;
        if (Math.abs(s.ty - s.cy) < 0.05) s.cy = s.ty;
      }
      if (s.foc && Math.abs(plans.zoom - fzoom) > 0.002) { fzoom = plans.zoom; aim(el); }   // la caméra bouge : on revise la cible
      const kF = state.reduce ? 1 : 1 - Math.exp(-dt * 9);
      s.fx += (s.fxT - s.fx) * kF; s.fy += (s.fyT - s.fy) * kF; s.fk += (s.fkT - s.fk) * kF;
      if (!s.foc && Math.abs(s.fx) + Math.abs(s.fy) < 0.6 && Math.abs(s.fk - 1) < 0.004) {
        s.fx = s.fy = 0; s.fk = 1;
        if (el.classList.contains("focus")) { el.classList.remove("focus"); el.style.zIndex = ++zTop; }
      }
      const mid = s.cx + s.w / 2;
      const ryT = (s.hover || s.drag || s.foc) ? 0 : -9 * clamp((mid - core.x) / (W * 0.33), -1, 1);
      const rzT = s.drag && !state.reduce ? clamp(s.vx * 0.06, -2, 2) : 0;
      s.ry += (ryT - s.ry) * kRot; s.rz += (rzT - s.rz) * kRot; s.vx *= 0.85;
      if (Math.abs(s.rz) < 0.005) s.rz = 0;
      const k = state.cine, fl = (s.drag ? 1.025 : 1) * s.fk;
      let tf, op = "";
      if (k > 0.01 && s.isWall && !s.foc) {
        // Mur courbe : fenêtre à l'angle th autour du point de vue, à sa vraie taille (la mise à l'échelle du monde et la perspective sont compensées)
        const P = plans.persp, z = plans.zoom, th = (s.wa ?? s.waAuto) - plans.yaw, c = Math.cos(th), sn = Math.sin(th);
        const xw = core.x + P * sn / z - s.w / 2, yw = core.y + (s.wy || 0) * c / z - s.h / 2, fx0 = s.cx + s.fx, fy0 = s.cy + s.fy;
        const lx = fx0 + (xw - fx0) * k, ly = fy0 + (yw - fy0) * k, lz = k * (P - P * c), lr = s.ry + (-th * 57.2958 - s.ry) * k, ls = fl + (fl * c / z - fl) * k;
        tf = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, ${lz.toFixed(1)}px) perspective(${k > 0.02 ? 100000 : 1200}px) rotateY(${lr.toFixed(2)}deg) rotateZ(${s.rz.toFixed(2)}deg) scale(${ls.toFixed(4)})`;
        const fade = clamp((1.4 - Math.abs(th)) / 0.25, 0, 1); op = fade >= 1 ? "" : fade.toFixed(2);
      } else tf = `translate3d(${(s.cx + s.fx).toFixed(1)}px, ${(s.cy + s.fy).toFixed(1)}px, 0) perspective(1200px) rotateY(${s.ry.toFixed(2)}deg) rotateZ(${s.rz.toFixed(2)}deg) scale(${fl.toFixed(4)})`;
      if (op !== s.lastOp) { s.lastOp = op; el.style.opacity = op; el.style.pointerEvents = op !== "" && +op < 0.05 ? "none" : ""; }
      if (tf !== s.last) { s.last = tf; el.style.transform = tf; }
      if (s.drag) {                                                               // le champ de force reçoit la place calculée (pas de relecture de la mise en page)
        const k = 1.025, ex = plans.zoom === 1 && state.cine < 0.01 && !s.foc;
        force.setDragRect(ex ? { left: s.cx - s.w * (k - 1) / 2, top: s.cy - s.h * (k - 1) / 2, width: s.w * k, height: s.h * k, right: s.cx + s.w * (k + 1) / 2, bottom: s.cy + s.h * (k + 1) / 2 } : null);
      }
    });
  }

  /** Taille du texte changée (Personnaliser…) : la fenêtre grandit ou rétrécit dans la même proportion. */
  function rescale(el, k) {
    const s = S[el.dataset.id]; if (!s || !k || k === 1 || s.max) return;
    s.w = clamp(s.w * k, MIN.w, W - 32); s.h = clamp(s.h * k, MIN.h, H - 90); applySize(el, s); save();
  }
  const tuiles = initTuiles({ els, rescale });
  function reset() { const D = layout(W, H, true); save(); return D; }
  return { layout, update, reset, planOf, focus, unfocus, get focused() { return focusEl; }, toggleMax, togglePin, reservedEls, setReserve, personnaliser: (el) => tuiles.open(el), setReduced, toggleReduced, setHidden, bringFront, hiddenEls, title, get dragEl() { return dragEl; }, elById, S, get core() { return core; }, get size() { return { W, H }; }, nextZ: () => ++zTop };
}
