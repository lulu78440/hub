/* Démarrage du Hub : détection PC / mobile, 3D, boucle d'animation unique. */
import { state, pulse } from "./state.js";
import { initDiag } from "./ui/diag.js";
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

  // Emplacement du noyau à l'écran : au centre, sous le bandeau. Les plans (1.4) fourniront leur propre rectangle.
  let RW = 0, RH = 0;
  const anchorRect = () => lite
    ? { left: 0, top: 70, width: RW, height: Math.max(RH * 0.44, 280) }
    : { left: RW * 0.2, top: RH * 0.13, width: RW * 0.6, height: RH * 0.62 };
  function resize() {
    RW = innerWidth; RH = innerHeight;
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
    const c = core.frame(anchorRect(), RW, RH); if (c) fx.setCenter(c);
    state.energy += (state.energyTarget - state.energy) * Math.min(dt * 3, 1);
    core.update({ t, dt, k, energy: state.energy, accent: state.accent, cine: state.cine, mx: state.mx, my: state.my });
    fx.update(t, state.energy, state.cine);
    fx.render();
  }
  const run = () => { if (!raf) { clock.getDelta(); loop(); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : run()));
  run();
  document.body.classList.add("ready");
  window.__hub = { state, pulse };   // pour les essais en console
}
start();
