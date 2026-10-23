// Son futuriste des rappels, synthétisé dans le navigateur (aucun fichier) : carillon cristallin à trois notes,
// balayage lumineux et écho. Désactivable (réglage « son »). Les navigateurs n'autorisent le son qu'après
// un premier geste sur la page (clic, touche) : on « déverrouille » l'audio à ce moment-là.
import { prefs } from "../store/prefs.js";

let ctx = null;
function audio() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { ctx = new A(); } catch (e) { return null; } }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
const unlock = () => { audio(); };
addEventListener("pointerdown", unlock, { once: true, capture: true });
addEventListener("keydown", unlock, { once: true, capture: true });

export const sound = {
  get on() { return prefs.on("son"); },
  set(v) { prefs.setOn("son", v); },
  /** Vrai si le navigateur laisse jouer le son maintenant. */
  get ready() { return !!ctx && ctx.state === "running"; },
  /** Joue le carillon (kind : "rappel" ou "doux"). Ne fait rien si le son est coupé. */
  play(kind = "rappel", force = false) {
    if (!force && !this.on) return false;
    const a = audio(); if (!a || a.state !== "running") return false;
    const t0 = a.currentTime + 0.02, out = a.createGain(); out.gain.value = kind === "doux" ? 0.18 : 0.32;
    // Écho léger
    const dl = a.createDelay(1); dl.delayTime.value = 0.19; const fb = a.createGain(); fb.gain.value = 0.32;
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
    out.connect(lp); lp.connect(a.destination); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(a.destination);
    const notes = kind === "doux" ? [880, 1318.5] : [784, 1174.7, 1568];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.14;
      [["sine", 1, 0.9], ["triangle", 2.003, 0.18]].forEach(([type, mul, lvl]) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(f * mul * 0.985, t); o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.06);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 1);
      });
    });
    // Balayage « holographique »
    const s = a.createOscillator(), sg = a.createGain(), bp = a.createBiquadFilter();
    s.type = "sawtooth"; bp.type = "bandpass"; bp.Q.value = 9;
    s.frequency.setValueAtTime(220, t0); s.frequency.exponentialRampToValueAtTime(2400, t0 + 0.55);
    bp.frequency.setValueAtTime(500, t0); bp.frequency.exponentialRampToValueAtTime(4200, t0 + 0.55);
    sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.05, t0 + 0.1); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    s.connect(bp); bp.connect(sg); sg.connect(out); s.start(t0); s.stop(t0 + 0.65);
    return true;
  }
};
