// Écran du PC en direct (plan 3, étape p3-direct) : partage d'écran du navigateur (getDisplayMedia), lecture seule.
// Garde-fous : coupé par défaut, l'écran est choisi par Lucien à chaque démarrage (jamais mémorisé), le flux n'est ni enregistré ni envoyé
// ni analysé (il ne va que dans un élément <video> de la fenêtre « Écran »), et une pastille « Couper » reste affichée sur tous les plans
// tant que le partage est actif. Fermer la fenêtre « Écran » coupe le partage. Le pilotage (clics, clavier) attend l'appli Windows.
import { toast } from "./toast.js";

export function createDirect() {
  let stream = null;
  const videos = new Set();
  const chip = document.createElement("button");
  chip.type = "button"; chip.className = "live-stop"; chip.hidden = true;
  chip.setAttribute("aria-label", "Couper l'écran en direct");
  chip.innerHTML = '<span class="dot" aria-hidden="true"></span><span>ÉCRAN EN DIRECT · LECTURE SEULE</span><b>Couper</b>';
  document.body.append(chip);
  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const emit = () => document.dispatchEvent(new CustomEvent("hub:direct-state", { detail: { active: !!stream } }));
  function paint() {
    document.body.classList.toggle("direct-on", !!stream); chip.hidden = !stream;
    const b = document.getElementById("live-btn");
    if (b) { b.classList.toggle("live-off", !stream); b.classList.toggle("live-on", !!stream); b.setAttribute("aria-disabled", "false"); b.textContent = stream ? "● Couper l'écran en direct" : "● Écran en direct"; b.title = stream ? "Coupe le partage d'écran" : "Affiche l'écran de ton PC dans une fenêtre (lecture seule, tu choisis l'écran)"; }
    videos.forEach((v) => { if (v.srcObject !== stream) v.srcObject = stream; });
    emit();
  }
  function stop(silent) {
    if (!stream) return false;
    const s = stream; stream = null; s.getTracks().forEach((t) => { t.onended = null; try { t.stop(); } catch (e) { /* déjà arrêtée */ } });
    paint(); if (!silent) toast("Écran en direct coupé"); return true;
  }
  async function start() {
    if (stream) return { ok: true, deja: true };
    if (!supported()) { toast("Écran en direct : ce navigateur ne sait pas partager l'écran."); return { ok: false, raison: "non pris en charge" }; }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false, selfBrowserSurface: "exclude" });
      stream = s; const t = s.getVideoTracks()[0]; if (t) t.onended = () => stop();   // arrêt depuis la barre du navigateur
      paint(); toast("Écran en direct : lecture seule, rien n'est enregistré"); return { ok: true };
    } catch (e) {
      const refus = e && (e.name === "NotAllowedError" || e.name === "AbortError");
      if (!refus) toast("Écran en direct impossible : " + ((e && e.message) || "erreur"));
      return { ok: false, raison: refus ? "refusé ou annulé" : "erreur" };
    }
  }
  chip.addEventListener("click", () => stop());
  document.addEventListener("hub:direct", (e) => { const a = e.detail; if (a === "stop") stop(); else if (a === "start") start(); else (stream ? stop() : start()); });
  addEventListener("pagehide", () => stop(true));
  return {
    start, stop, supported, toggle: () => (stream ? (stop(), Promise.resolve({ ok: true })) : start()),
    get active() { return !!stream; },
    attach(v) { videos.add(v); v.srcObject = stream; }, detach(v) { videos.delete(v); v.srcObject = null; }
  };
}
