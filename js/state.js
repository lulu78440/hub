// État partagé entre la scène, l'interface et les effets (une seule source de vérité).
export const state = {
  lite: false,          // mode mobile allégé
  reduce: false,        // mouvement réduit demandé par le système
  paused: false,
  energy: 0,            // intensité courante de la scène (0..1+), lissée dans la boucle
  energyTarget: 0,      // intensité visée
  accent: null,
  mood: null,           // teinte du noyau selon la météo intérieure (7.1), si aucun accent temporaire         // couleur d'accent temporaire (ex. 0x9b72ff) ou null = cyan
  qlevel: 0,            // niveau de qualité du rendu : 0 Complet, 1 Allégé, 2 Minimal (ui/qualite.js)
  cine: 0,              // 0..1 : mode cinéma du plan 2 (utilisé en 1.4)
  tilt: false,          // inclinaison du téléphone disponible (mobile)
  mx: 0, my: 0          // souris (PC) ou inclinaison (mobile), normalisées -1..1
};
export const pulse = (v) => { state.energy = Math.max(state.energy, v); };
