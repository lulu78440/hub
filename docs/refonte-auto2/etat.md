# Résumé pour Lucien (bloc A · Plan 2 « la salle »)
- **Fait** (branche `refonte-auto2`, rien sur main) : maquette `p2-profondeur-mix2.html` ; qualité Complet / Allégé / Minimal avec scène au repos (7.28.0) ; salle : travelling d'entrée, brume, flou par fenêtre, survol (7.29.0). Suivi : les 3 étapes en « built ».
- **À tester d'abord** : `apercu-refonte.html` (PC) : touche 2, entrée en travelling (longue la 1re fois de la session), fenêtres de côté douces, survol qui rend une fenêtre nette ; Outils › Qualité du rendu (Automatique, Complet, Allégé, Minimal).
- **À regarder** : `maquettes/p2-profondeur-mix2.html` (mur central, arc de rangement, fond voilé).
- **Décidé à ta place** (`decisions.md`) : « repos » = scène redessinée une image sur deux (pas d'arrêt) ; automatique seulement vers le bas ; brume légère hors de l'orbe ; flou ≤ 2,4 px sur les côtés.
- **Attend ton essai** : fluidité réelle sur ton PC (mon navigateur de test tourne à ≈ 20 images/s, donc il bascule vite en Minimal en mode Automatique) ; durées du travelling.
- **Fusion** : `refonte-auto2` contient `refonte-auto` ; `apercu-refonte.html` ne doit pas être fusionné dans main.

# État de la mission bloc A (branche `refonte-auto2`)

| Étape | État |
| --- | --- |
| 1. ergo-plan2-maquette | fait · `maquettes/p2-profondeur-mix2.html` |
| 2. ergo-perf-repos | fait · 7.28.0 · `js/ui/qualite.js`, tuiles « Qualité du rendu » dans Outils (Automatique, Complet, Allégé, Minimal) ; recette PC + mobile simulé : aucune erreur nouvelle |
| 3. ergo-plan2-salle | fait · 7.29.0 · travelling 2,4 s / 0,8 s, brume, flou par fenêtre, survol, niveaux reliés ; recette PC + mobile simulé : aucune erreur nouvelle |

## 25/10 22:50 · 7.30.0 · p3-fenetres (built)
Pile de focus + réduction animée vers l'icône (bureau-apps.js). Testé : PC (ouvrir, focus, réduire, rouvrir par icône, Échap, fermer), mouvement réduit (instantané), rechargement (état gardé), aucune erreur console nouvelle. Mobile : le bureau est réservé au PC, donc sans effet. Suite : p3-lasso.
