// État partagé entre la scène, l'interface et les effets (une seule source de vérité).
export const state = {
  lite: false,          // mode mobile allégé
  reduce: false,        // mouvement réduit demandé par le système
  paused: false,
  energy: 0,            // intensité courante de la scène (0..1+), lissée dans la boucle
  energyTarget: 0,      // intensité visée
  accent: null,         // couleur d'accent temporaire (ex. 0x9b72ff) ou null = cyan
  cine: 0,              // 0..1 : mode cinéma du plan 2 (utilisé en 1.4)
  mx: 0, my: 0          // souris normalisée -1..1 (PC)
};
export const pulse = (v) => { state.energy = Math.max(state.energy, v); };
