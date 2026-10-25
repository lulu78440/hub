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

## 26/10 00:20 · 7.31.0 · p3-lasso (built)
Lasso + sélection multiple + menu de groupe (bureau.js). Testé PC : lasso, déplacement de groupe, menu, alignement, Échap, Ctrl+A, Maj+clic, clic simple (ouvre et désélectionne), aucune erreur. Mobile : bureau réservé au PC. Suite : p3-direct, p3-ia, p3-mobile, puis lv-bus.

## 26/10 00:50 · 7.32.0 · p3-direct (built)
Écran en direct (direct.js). Testé PC avec faux écran : coupé par défaut, démarrage, vidéo reçue, pastille visible au plan 1, arrêt par la pastille, redémarrage, fermeture de la fenêtre coupe le partage, aucune erreur. Non testable ici : le vrai sélecteur d'écran de Brave (à essayer par Lucien).

## 26/10 01:20 · 7.33.0 · p3-ia (built)
Commandes pour l'orbe (commandes.js + docs/refonte-auto2/commandes-orbe.md). Testé : liste, commande ou paramètre inconnu refusés, libres exécutées, confirmation (refus, autorisation, Échap, demande simultanée), écran en direct via confirmation, événement `hub:commande`, journal, aucune erreur. À brancher par le Labo.
