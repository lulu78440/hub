// Curseur HUD : s'active tout seul en plein écran (PC), remplace le pointeur par un réticule.
import { state } from "../state.js";

export function initCursor() {
  let forced = false;
  const ret = document.getElementById("reticle");
  const isFs = () => !!document.fullscreenElement || (Math.abs(innerHeight - screen.height) < 3 && Math.abs(innerWidth - screen.width) < 3);
  const update = () => document.body.classList.toggle("hudcur", !state.lite && (forced || isFs()));
  addEventListener("resize", update); document.addEventListener("fullscreenchange", update); update();
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    ret.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    const t = e.target, hot = t && t.closest && t.closest("button, a, input, label, .wxm, .ctx"), grab = t && t.closest && t.closest(".ph, .pic");
    ret.classList.toggle("hot", !!hot); ret.classList.toggle("grab", !!grab && !hot);
  });
  addEventListener("pointerdown", () => ret.classList.add("down"));
  addEventListener("pointerup", () => ret.classList.remove("down"));
  return {
    get on() { return document.body.classList.contains("hudcur"); },
    get forced() { return forced; },
    toggle() { forced = !forced; update(); return forced; }
  };
}
