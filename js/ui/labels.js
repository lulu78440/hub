// Légendes flottantes autour du noyau (v8) : Météo, Tâches, Agenda… avec de vraies données.
// Les widgets donnent leur valeur avec setLabel(clé, texte) ; une valeur vide masque la légende.
import { inReserve, onReserve } from "./reserve.js";
const DEFS = [["meteo", "Météo", "var(--cyan)"], ["tasks", "Tâches", "var(--amber)"], ["agenda", "Agenda", "var(--violet)"]];
const vals = {};
let els = null, root = null;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function ensure() {
  if (els) return;
  root = document.getElementById("labels");
  els = DEFS.map(([key, name, col]) => {
    const el = document.createElement("div"); el.className = "lab"; el.style.setProperty("--c", col); el.hidden = true;
    const i = document.createElement("i"), sp = document.createElement("span"), b = document.createElement("b");
    sp.append(document.createTextNode(name + " "), b); el.append(i, sp); root.append(el);
    return { key, el, b };
  });
}
export function setLabel(key, text) {
  ensure(); vals[key] = text || "";
  const L = els.find((x) => x.key === key); if (!L) return;
  L.b.textContent = vals[key]; L.el.hidden = !vals[key] || (key === "tasks" && inReserve("tasks"));
}
onReserve(() => { if (els) els.forEach((L) => { L.el.hidden = !vals[L.key] || (L.key === "tasks" && inReserve("tasks")); }); });
/** À chaque image : pts = positions projetées (core.project), zoom = zoom du plan (les légendes s'effacent en reculant). */
export function updateLabels(pts, zoom = 1) {
  ensure();
  root.style.opacity = clamp((zoom - 0.6) / 0.3, 0, 1).toFixed(2);
  els.forEach((L, i) => {
    const p = pts[i]; if (!p || L.el.hidden) return;
    L.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-4px, -50%)`;
    L.el.style.opacity = clamp((p.depth + 2.2) / 3.2, 0.08, 1).toFixed(2);
  });
}
