// Inclinaison du téléphone : pilote la caméra de la scène (mobile). Seul endroit qui touche aux capteurs (isolé pour Capacitor en V2).
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/** Retourne « actif », « en attente » (autorisation à donner d'un toucher) ou « indisponible ». Respecte « mouvement réduit ». */
export function initTilt(state, onStatus = () => {}) {
  if (!state.lite) return onStatus("PC : sans objet");
  if (state.reduce) return onStatus("Désactivée (mouvement réduit)");
  if (!("DeviceOrientationEvent" in window)) return onStatus("Indisponible");
  let got = false;
  const handler = (e) => {
    if (e.gamma == null || e.beta == null) return;
    if (!got) { got = true; state.tilt = true; onStatus("Active"); }
    // gamma : gauche/droite, beta : avant/arrière (téléphone tenu environ à 55° en main)
    state.mx = clamp(e.gamma / 30, -1, 1);
    state.my = clamp((e.beta - 55) / 30, -1, 1);
  };
  const D = window.DeviceOrientationEvent, needsAsk = typeof D.requestPermission === "function";
  // On écoute tout de suite : Android (Chrome, Brave) envoie les mesures sans autorisation.
  addEventListener("deviceorientation", handler);
  setTimeout(() => { if (!got) onStatus(needsAsk ? "En attente d'un toucher" : "Aucun capteur détecté"); }, 2500);
  // iOS : l'autorisation se demande après un geste de l'utilisateur
  if (needsAsk) addEventListener("pointerdown", async () => {
    try { if ((await D.requestPermission()) === "granted") addEventListener("deviceorientation", handler); else onStatus("Refusée"); } catch (e) { onStatus("Refusée"); }
  }, { once: true });
}
