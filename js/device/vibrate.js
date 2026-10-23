// Petite vibration du téléphone (retour au toucher). Sans effet si l'appareil ne vibre pas.
export function buzz(ms = 15) {
  try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { /* refusé : aucun effet */ }
}
