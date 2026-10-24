// Trois plans (zoom de la caméra sur tout le « monde ») : 1 = hub, 2 = second plan en mode cinéma, 3 = bureau du PC.
// Molette sur le fond : zoom avec calage sur le plan le plus proche. Touches 1 2 3, G, - et +. Double-clic sur le fond : plan suivant.
import { state } from "../state.js";
import { onBackground } from "./dom.js";
import { toast } from "./toast.js";

const PLANS = [1, 0.5, 0.27], ZMIN = 0.27;     // plan 2 à 50 % : environ 4 fois la surface visible du plan 1
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const $ = (id) => document.getElementById(id);
const nearestPlan = (z) => PLANS.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));

export function createPlans({ world, anchor, desk }) {
  let zoom = 1, zoomTarget = 1, snapT = 0, lastT = "";
  const zmark = $("zmark"), zlbl = $("zlbl");

  /** Place l'emplacement du noyau et le centre du zoom (PC : entre les colonnes de fenêtres, calculé par ui/windows.js). */
  function layout(RW, RH, rect) {
    if (state.lite) return;   // mobile : l'emplacement du noyau est géré par css/mobile.css (bloc dans la pile)
    const r = rect || { left: RW * 0.2, top: RH * 0.13, width: RW * 0.6, height: RH * 0.62 };
    Object.assign(anchor.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    world.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  }

  function setZoom(z) {
    zoomTarget = clamp(z, ZMIN, 1);
    const p = nearestPlan(zoomTarget);
    PLANS.forEach((v, i) => $("plan" + (i + 1)).setAttribute("aria-pressed", String(v === p)));
  }
  const goPlan = (n) => setZoom(PLANS[n - 1]);
  const planIndex = () => PLANS.indexOf(nearestPlan(zoomTarget));

  addEventListener("wheel", (e) => {
    if (state.lite || !onBackground(e.target)) return;
    e.preventDefault(); setZoom(zoomTarget * Math.exp(-e.deltaY * 0.0015));
    clearTimeout(snapT); snapT = setTimeout(() => setZoom(nearestPlan(zoomTarget)), 260);
  }, { passive: false });
  addEventListener("dblclick", (e) => {
    if (state.lite || !onBackground(e.target)) return;
    const i = planIndex(); goPlan(i === 2 ? 1 : i + 2);
  });
  [1, 2, 3].forEach((n) => $("plan" + n).addEventListener("click", () => goPlan(n)));
  $("back-hub").addEventListener("click", () => goPlan(1));
  $("live-btn").addEventListener("click", () => toast("Écran en direct : prévu plus tard, avec l'appli Windows."));
  addEventListener("keydown", (e) => {
    if (state.lite || e.ctrlKey || e.metaKey || e.altKey || e.target.isContentEditable || (e.target.closest && e.target.closest("input, textarea"))) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") goPlan(+e.key);
    else if (e.key === "g" || e.key === "G") goPlan(zoomTarget < 0.85 ? 1 : 2);
    else if (e.key === "-") setZoom(nearestPlan(zoomTarget) === 1 ? PLANS[1] : PLANS[2]);
    else if (e.key === "+" || e.key === "=") setZoom(nearestPlan(zoomTarget) === PLANS[2] ? PLANS[1] : 1);
  });

  /** À appeler à chaque image de la boucle unique. */
  function update(dt) {
    if (state.lite) { state.cine = 0; return; }
    zoom += (zoomTarget - zoom) * (state.reduce ? 1 : 1 - Math.exp(-dt * 6));
    if (Math.abs(zoom - zoomTarget) < 0.0004) zoom = zoomTarget;
    // Plan 2 : profondeur de cinéma (bandes noires, bascule de la caméra, flou). Plan 3 : le cinéma s'efface.
    const d = clamp((0.5 - zoom) / 0.2, 0, 1);
    const cine = clamp((0.92 - zoom) / 0.3, 0, 1) * (1 - d);
    state.cine = cine;
    // Grand angle au plan 2 : perspective plus serrée, inclinaison plus marquée, caméra un peu remontée
    const tf = `perspective(${(1500 - 420 * cine).toFixed(0)}px) translateY(${(-72 * cine).toFixed(1)}px) rotateX(${(cine * 11).toFixed(2)}deg) scale(${zoom.toFixed(4)})`;
    if (tf !== lastT) {
      lastT = tf; world.style.transform = tf;
      const b = document.body;
      b.style.setProperty("--cine", cine.toFixed(3));
      b.classList.toggle("cine", cine > 0.45);
      b.classList.toggle("zoomed", zoom < 0.99);
      b.classList.toggle("global", zoom < 0.85);   // vue globale : fenêtres figées en vedette, les autres en retrait
      zmark.style.top = ((1 - (zoom - ZMIN) / (1 - ZMIN)) * 167).toFixed(1) + "px";
      zlbl.textContent = "PLAN " + (PLANS.indexOf(nearestPlan(zoom)) + 1) + " · " + Math.round(zoom * 100) + " %";
      // Le bureau du PC arrive de derrière la caméra quand on recule au-delà du plan 2
      desk.style.opacity = d.toFixed(3);
      desk.style.transform = `scale(${(1.18 - 0.18 * d).toFixed(4)})`;
      desk.classList.toggle("on", d > 0.03);
    }
  }
  return { layout, update, goPlan, get zoom() { return zoom; }, get plan() { return planIndex() + 1; } };
}
