// Bandeau du haut : sélecteur de plans (actif à partir de 1.4) et bouton plein écran.
export function initTopbar() {
  const fs = document.getElementById("fs");
  fs.addEventListener("click", async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (e) { /* refusé par le navigateur : F11 reste possible */ }
  });
  document.addEventListener("fullscreenchange", () => { fs.textContent = document.fullscreenElement ? "Quitter" : "Plein écran"; });
  // Plans : seul « Hub » existe tant que la sous-étape 1.4 n'est pas livrée.
  document.querySelectorAll(".plans .btn[aria-disabled='true']").forEach((b) => b.addEventListener("click", (e) => e.preventDefault()));
}
