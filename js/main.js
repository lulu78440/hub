/* Démarrage du Hub : détection PC / mobile, 3D, boucle d'animation unique. */
import { state, pulse } from "./state.js";
import { initDiag } from "./ui/diag.js";
import { initClock } from "./ui/clock.js";
import { initSearch } from "./ui/search.js";
import { initTopbar } from "./ui/topbar.js";
import { createPlans } from "./ui/plans.js";
import { createWindows } from "./ui/windows.js";
import { toast } from "./ui/toast.js";
import { createForce } from "./fx/force.js";
import { initCursor } from "./fx/cursor.js";
import { initTilt } from "./device/orientation.js";
import { loadThree } from "./scene/loader.js";
import { createCore } from "./scene/core3d.js";
import { createPostFX } from "./scene/postfx.js";

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// Même règle que les maquettes : mobile si écran étroit ou tactile principal.
state.lite = matchMedia("(max-width: 900px), (pointer: coarse)").matches;
state.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
document.body.classList.toggle("lite", state.lite);
initDiag(state);
initClock();
initTopbar();
initSearch({ focusOnStart: !state.lite });
initTilt(state, (txt) => { const el = $("d-tilt"); if (el) el.textContent = txt; });

// Panneau de diagnostic masqué par défaut
const diag = $("diag");
const toggleDiag = (on) => { diag.hidden = on === undefined ? !diag.hidden : !on; $("b-diag").setAttribute("aria-pressed", String(!diag.hidden)); };
$("b-diag").addEventListener("click", () => toggleDiag());
addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea/i.test(e.target.tagName)) toggleDiag(); else if (e.key === "Escape") toggleDiag(false); });

function showError(msg) { const d = document.createElement("div"); d.className = "err"; d.textContent = msg; document.body.append(d); }

async function start() {
  let THREE;
  try { THREE = await loadThree(); }
  catch (e) { showError("La bibliothèque 3D n'a pas pu se charger. Recharge la page."); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: $("scene"), antialias: true, powerPreference: "high-performance" }); }
  catch (e) { showError("La 3D (WebGL) est désactivée. Active l'accélération matérielle dans les réglages de Brave."); return; }

  const lite = state.lite;
  const core = createCore(THREE, { lite });
  const fx = createPostFX(THREE, renderer, core.scene, core.camera, { lite });

  // Emplacement du noyau à l'écran : un bloc « ancre » au centre du monde zoomable (les plans le font reculer).
  const anchorEl = $("anchor");
  const plans = createPlans({ world: $("world"), anchor: anchorEl, desk: $("desk") });
  const force = createForce({ canvas: $("force"), anchor: anchorEl, logo: $("logo") });
  const wins = createWindows({ world: $("world"), plans, force });
  initCursor();
  let RW = 0, RH = 0;
  const searchEl = $("search");
  // PC : les fenêtres décident de la place du noyau et de la recherche (entre les deux colonnes, comme la v8).
  function place(D) {
    plans.layout(RW, RH, D.anchor);
    Object.assign(searchEl.style, { left: D.search.x + "px", top: D.search.y + "px", width: D.search.w + "px", transform: "none" });
  }
  $("b-layout").addEventListener("click", () => { if (state.lite) return; place(wins.reset()); plans.goPlan(1); toast("Disposition d'origine restaurée"); });
  function resize() {
    RW = innerWidth; RH = innerHeight;
    if (state.lite) plans.layout(RW, RH); else place(wins.layout(RW, RH));
    fx.resize(RW, RH, lite ? 1 : Math.min(devicePixelRatio || 1, 1.75));
    core.resize(RW, RH);
  }
  resize(); addEventListener("resize", resize);

  addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; state.mx = e.clientX / RW * 2 - 1; state.my = e.clientY / RH * 2 - 1; });

  // Une seule boucle d'animation, arrêtée quand l'onglet est caché.
  const clock = new THREE.Clock();
  const fpsEl = $("fps");
  let t = 0, frames = 0, fpsT = 0, raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    frames++; fpsT += dt;
    if (fpsT >= 0.5) { fpsEl.textContent = Math.round(frames / fpsT) + " img/s"; frames = 0; fpsT = 0; }
    if (state.paused) return;
    const k = state.reduce ? 0.15 : 1; t += dt * k;
    plans.update(dt);
    wins.update(dt);
    const c = core.frame(anchorEl.getBoundingClientRect(), RW, RH); if (c) fx.setCenter(c);
    state.energy += (state.energyTarget - state.energy) * Math.min(dt * 3, 1);
    core.update({ t, dt, k, energy: state.energy, accent: state.accent, cine: state.cine, mx: state.mx, my: state.my, tilt: state.tilt });
    fx.update(t, state.energy, state.cine);
    fx.render();
    force.draw(dt);
  }
  const run = () => { if (!raf) { clock.getDelta(); loop(); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : run()));
  run();
  document.body.classList.add("ready");
  window.__hub = { state, pulse, plans, force, wins };   // pour les essais en console
}
start();
