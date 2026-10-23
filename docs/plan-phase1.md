# Plan de construction · Phase 1

23 octobre 2026 · rédigé avec Opus 5.5, à exécuter avec Sonnet 5.5

Ce document est la feuille de route de la discussion « Phase 1 · construction ». Il complète le cahier des charges avec tout ce qui a été décidé pendant les maquettes. En cas de doute, ce document et la maquette de référence l'emportent sur les anciennes formulations.

## Références visuelles

| Vue | Référence | Où la trouver |
| --- | --- | --- |
| PC | Maquette v8 (dernière), v4 ★ comme base validée | `maquettes/noyau-v8.html` dans le dépôt et dans le Projet |
| Mobile | Maquette v3, figée : on n'y touche pas sans ordre de Lucien | `maquettes/noyau-v3.html` |

La maquette est un seul fichier de démonstration avec des données d'exemple. Le vrai hub reprend son rendu et son comportement, mais avec un code découpé proprement et de vraies données au fil des phases.

## Ce que contient la phase 1

La phase 1 livre la coquille : tout ce qui se voit et se ressent, sans les widgets de contenu.

1. **Squelette du site et appli installable** : page principale, manifeste, icônes, service worker avec cache hors ligne versionné.
2. **Scène 3D** (PC complet, mobile allégé) : noyau holographique, anneaux, cadran, constellation, faisceau, sol en grille, colonnes de données, poussière, halo lumineux, grain, vignette, aberration chromatique. Réglages d'intensité identiques à la maquette.
3. **Bandeau du haut** : logo hexagonal, horloge et date, sélecteur Hub / Plan 2 / Plan 3, bouton plein écran. Météo affichée plus tard (phase 2), place réservée.
4. **Recherche** : Brave Search par défaut, `!g` Google, `!d` DuckDuckGo, `!y` YouTube, ouverture dans un nouvel onglet.
5. **Trois plans** sur PC : zoom à la molette avec calage sur le plan le plus proche, touches 1 2 3, plan 2 en mode cinéma (bandes noires, bascule, flou de profondeur, bokeh, reflet), plan 3 vide prêt à recevoir le bureau du PC.
6. **Effets de souris** (PC) : filaments vers la constellation, charge électrique, longue traînée lente, entité d'énergie endormie avec son « ? », posée ou reprise sur le logo, appui long sur l'orbe pour couper ou relancer l'énergie, curseur HUD automatique en plein écran.
7. **Mode mobile** : disposition empilée de la v3, 3D allégée, inclinaison du téléphone pour la caméra (dans la vraie appli, avec autorisation).
8. **Page d'accueil Brave** et test « nouvel onglet ».
9. **Sauvegarde** : version stable taguée sur GitHub, archive .zip rangée sur le PC et dans Google Drive.

## Ce qui attend les phases suivantes

| Élément de la maquette | Phase |
| --- | --- |
| Fenêtres déplaçables, redimensionnables, figeables, masquables ; disposition mémorisée PC et mobile | 2 |
| Menu du clic droit propre à chaque fenêtre et élément | 2 (base), enrichi à chaque phase |
| Agenda intégré en bande, météo discrète, tâches, notes, favoris, rappels | 2 |
| Panneau Mon PC (batterie, réseau, liens vers les réglages Windows) et bureau du PC en plan 3 (dossiers autorisés dans Brave, fichiers récents) | 2 |
| Images libres (glisser, coller, redimensionner, effet hologramme), 12 au maximum | 2 |
| Fenêtre Progression reliée au suivi | 2 (lecture d'un fichier de suivi dans le dépôt) |
| Vidéo, vidéos à suivre, musique, grand écran, actualité défilante, veille de sites, page en direct, synchro PC et Android | 3 |
| Surprises | 4 |
| Mails importants | 5 |
| IA de l'orbe, puis entité réveillée avec une IA gratuite qui tourne dans Brave | 6 |
| Mods graphiques (Abyss, Putréfaction, Mécanique, Esprits des planètes) : maquettes en parallèle, construction | V2 |
| Appli Windows : fonctions ◇, écran du PC en direct avec navigation | V2 PC |

## Architecture du code

Pas d'outil de construction : HTML, CSS et JavaScript standards, modules ES natifs, tout copié dans le dépôt pour marcher hors ligne et durer.

```
hub/
  index.html               page unique, charge css/ et js/main.js
  manifest.webmanifest     nom, icônes, couleurs, affichage plein écran
  sw.js                    service worker : cache hors ligne versionné
  icons/                   icônes de l'appli (192, 512, maskable)
  fonts/                   Orbitron, Rajdhani, IBM Plex Mono en woff2 local
  vendor/three/            Three.js et ses passes de post-traitement, version figée
  css/
    base.css               jetons de couleur et de typo, remise à zéro
    hud.css                bandeau, plans, effets d'écran
    mobile.css             disposition v3, chargée pour le mode mobile
  js/
    main.js                démarrage, détection PC / mobile, boucle d'animation
    scene/core3d.js        noyau, anneaux, sol, colonnes, constellation
    scene/postfx.js        halo, grain, vignette, aberration
    ui/clock.js  ui/search.js  ui/plans.js
    fx/force.js            filaments, traînée, charge électrique
    fx/entity.js           l'entité et sa pose sur le logo
    fx/cursor.js           curseur HUD
    device/                accès à l'appareil isolés (pour Capacitor en V2)
    store/storage.js       IndexedDB et export / import (utilisé dès la phase 2)
  themes/
    hologramme/            l'habillage actuel : jetons, scène 3D, effets ; les mods viendront à côté
  maquettes/  docs/        inchangés
```

Règles de construction :

- **Aucun secret dans le code**, dépôt public.
- **Une seule boucle d'animation** pour la 3D et les effets, arrêtée quand l'onglet est caché.
- **Budgets de performance** : PC au moins 50 images par seconde, Android au moins 30, sans chauffe. Si ça chauffe, on allège avant d'ajouter.
- **Mouvement réduit** respecté (réglage du système).
- **Chaque accès à l'appareil** passe par `js/device/`.
- **Habillage séparé des fonctions** : tout ce qui fait l'apparence (jetons de couleur et de typo, matières des panneaux, scène 3D, effets de souris, sons) vit dans un thème, par exemple `themes/hologramme/`, chargé par le hub. Les fonctions (plans, fenêtres, recherche, données) ne dépendent d'aucun visuel précis. C'est ce qui permettra de brancher les mods (Abyss, Putréfaction, Mécanique, Esprits des planètes) en V2 sans réécriture.
- **Mobile** : on reproduit la v3 telle quelle.

## Ordre de travail et validations

Chaque sous-étape se termine par un test de Lucien sur `lulu78440.github.io/hub`, sur PC et Android, avant la suivante.

| Sous-étape | Contenu | Étape du Suivi validée |
| --- | --- | --- |
| 1.1 | Squelette, appli installable, hors ligne | — |
| 1.2 | Scène 3D PC | Scène 3D fluide sur le PC |
| 1.3 | Bandeau, horloge, recherche | Barre de recherche fonctionnelle |
| 1.4 | Plans, mode cinéma, effets de souris, entité, curseur | — |
| 1.5 | Mode mobile allégé | Version allégée fluide sur Android |
| 1.6 | Page d'accueil Brave, installation Android, test hors ligne | Page d'accueil, installation Android, hors ligne |
| 1.7 | Version stable taguée, archive .zip | Archive du code rangée |

## Méthode

- **Modèle** : Sonnet 5.5 pour écrire le code. Retour à Opus seulement si un bug résiste après deux essais, avec un message « STOP : change pour Opus ».
- **Code** : Claude écrit, teste et pousse sur `main` ; une étiquette de version à la fin de la phase.
- **Sauvegardes** : chaque sous-étape validée est poussée sur GitHub ; à la fin de la phase, archive .zip pour le PC et Google Drive.
- **Suivi** : le journal de bord (`maquettes/journal-de-bord.md`) est mis à jour à chaque sous-étape ; Lucien coche les étapes du Suivi du Hub.
