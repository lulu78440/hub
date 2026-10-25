// Qualité du rendu (refonte, ergo-perf-repos) : trois niveaux — Complet, Allégé, Minimal — choisis à la main (Outils) ou automatiquement
// quand les images par seconde chutent. Auto : on ne fait que descendre (jamais de yo-yo) ; mesure sur 2 s, trois mesures basses de suite,
// images séparées de plus d.une seconde ignorées (onglet caché), pas avant 6 s après le chargement. Le niveau réduit la résolution de la scène (ratio de pixels) et coupe reflets et flou (classes q-allege,
// q-minimal sur <body>, voir hud.css). Au repos (aucune action depuis 15 s, rien qui s'anime), la scène 3D est redessinée une image sur
// deux : même rendu, moitié moins de calcul. Une fonction qui anime peut demander le plein débit avec hold(). Mobile : sans effet.
import { state } from "../state.js";
import { prefs } from "../store/prefs.js";

export const NIVEAUX = ["complet", "allege", "minimal"];
export const LIBELLE = { auto: "Automatique", complet: "Complet", allege: "Allégé", minimal: "Minimal" };
const DPR_MAX = [1.75, 1.25, 1];

export function createQuality({ onChange } = {}) {
  let mode = prefs.get("qualite", "auto"); if (mode !== "auto" && !NIVEAUX.includes(mode)) mode = "auto";
  let level = mode === "auto" ? 0 : NIVEAUX.indexOf(mode);
  let lastInput = performance.now(); const boot = lastInput;
  let prev = 0, acc = 0, n = 0, low = 0, holds = 0;
  const body = document.body;
  const paint = () => { state.qlevel = state.lite ? 0 : level; body.classList.toggle("q-allege", level === 1); body.classList.toggle("q-minimal", level === 2); };
  paint();
  const touch = () => { lastInput = performance.now(); };
  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => addEventListener(ev, touch, { passive: true, capture: true }));
  const change = () => { paint(); if (onChange) onChange(level); };
  return {
    get mode() { return mode; },
    get level() { return level; },
    get name() { return NIVEAUX[level]; },
    /** Choisit le mode : "auto", "complet", "allege" ou "minimal" (gardé sur l'appareil). */
    set(m) {
      if (m !== "auto" && !NIVEAUX.includes(m)) return;
      mode = m; level = m === "auto" ? 0 : NIVEAUX.indexOf(m); low = 0; prefs.set("qualite", m); change();
    },
    /** Ratio de pixels maximal de la scène pour le niveau courant (mobile : 1, inchangé). */
    dpr() { const d = devicePixelRatio || 1; return state.lite ? 1 : Math.min(d, DPR_MAX[level]); },
    /** À appeler à chaque image avec l'horloge de requestAnimationFrame. */
    feed(now) {
      const gap = now - prev; prev = now;
      if (mode !== "auto" || state.lite || state.paused || document.hidden || gap > 1000 || gap <= 0 || now - boot < 6000) { acc = 0; n = 0; return; }
      acc += gap; n++;
      if (acc < 2000) return;
      const fps = n / (acc / 1000); acc = 0; n = 0;
      if (fps < 40) { if (++low >= 3 && level < 2) { level++; low = 0; change(); } } else low = 0;
    },
    /** Une fonction qui anime la scène demande le plein débit ; appeler le retour pour le rendre. */
    hold() { holds++; let done = false; return () => { if (!done) { done = true; holds = Math.max(0, holds - 1); } }; },
    idle() { return !holds && performance.now() - lastInput > 15000 && state.energy < 0.05; },
    /** 1 = chaque image ; 2 = une image sur deux (repos ou niveau Minimal). */
    sceneEvery() { return state.lite ? 1 : (level >= 2 || this.idle() ? 2 : 1); }
  };
}
