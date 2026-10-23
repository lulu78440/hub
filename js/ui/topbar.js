// Bandeau du haut : bouton plein écran (les plans sont gérés par ui/plans.js).
export function initTopbar() {
  const fs = document.getElementById("fs");
  fs.addEventListener("click", async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (e) { /* refusé par le navigateur : F11 reste possible */ }
  });
  document.addEventListener("fullscreenchange", () => { fs.textContent = document.fullscreenElement ? "Quitter" : "Plein écran"; });
}
