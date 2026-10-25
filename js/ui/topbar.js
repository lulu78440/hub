// Bandeau du haut : bouton plein écran (les plans sont gérés par ui/plans.js).
// Le compteur d'images par seconde est caché par défaut : Maj + F l'affiche ou le cache (ou ?fps dans l'adresse).
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
export function initTopbar() {
  const fs = document.getElementById("fs");
  fs.addEventListener("click", async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (e) { /* refusé par le navigateur : F11 reste possible */ }
  });
  document.addEventListener("fullscreenchange", () => { fs.textContent = document.fullscreenElement ? "Quitter" : "Plein écran"; });
  const showFps = (on) => document.body.classList.toggle("show-fps", on);
  showFps(prefs.on("compteur-fps", false) || new URLSearchParams(location.search).has("fps"));
  addEventListener("keydown", (e) => {
    if (e.key !== "F" || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.target.isContentEditable || (e.target.closest && e.target.closest("input, textarea"))) return;
    const on = !document.body.classList.contains("show-fps"); showFps(on); prefs.setOn("compteur-fps", on);
  });
  // Salle du plan 2 : Maj + S coupe ou remet les reflets (réglage « Salle allégée » si l'ordinateur peine)
  document.body.classList.toggle("salle-light", prefs.on("salle-allegee", false));
  addEventListener("keydown", (e) => {
    if (e.key !== "S" || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.target.isContentEditable || (e.target.closest && e.target.closest("input, textarea"))) return;
    const on = !document.body.classList.contains("salle-light"); document.body.classList.toggle("salle-light", on); prefs.setOn("salle-allegee", on);
    toast(on ? "Salle allégée : sans reflets" : "Salle complète : avec reflets");
  });
}
