# Journal de bord du Hub

Ce journal suit l'avancée du projet entre deux étapes du « Suivi du Hub ». Les versions de maquette sont des versions de test : rien n'est encore du code final.

## Où on en est

- **Suivi du Hub** : 6 étapes validées sur 36 (17 %). Phase 0 terminée. Phase 6 · Assistant IA ajoutée (4 étapes).
- **Prochaine étape du Suivi** : « Ambiance validée sur une première maquette » (phase 1), à cocher par toi.
- **Maquette en cours** : v8, figée comme référence de construction. Version de référence : v4 ★.
- **Modèle** : conception terminée avec Opus. Plan de construction rédigé (`docs/plan-phase1.md`). Suite : discussion « Phase 1 · construction » avec Sonnet.

## Historique

| Date | Version | Ce qui a été fait |
| --- | --- | --- |
| 23/10 | v1 | Première maquette : noyau holographique, horloge, recherche, panneaux d'exemple. Jugée « bof » sur PC. |
| 23/10 | v2 | Direction cinématographique : cadres épais, vidéo, actualité défilante, page en direct, densité. |
| 23/10 | v3 | Fenêtres déplaçables, redimensionnables, figeables ; vue globale. Vue mobile figée à partir d'ici. |
| 23/10 | v4 ★ | Vue PC : météo discrète, agenda intégré, panneau Mon PC, bureau du PC en plan 3. Jugée « géniale ». |
| 23/10 | v5 | Vue PC : filaments liés à la souris, effet de force en déplaçant, curseur HUD en plein écran, clic droit, vidéos à suivre sous le lecteur, fenêtre Progression + mods, images libres. |
| 23/10 | v6 | Entité d'énergie en sommeil qui suit la souris (« ? »), traînée longue et lente, clic droit propre à chaque fenêtre, double-clic pour changer de plan, « Plan 3 ». |
| 23/10 | v7 | Plan 2 en mode cinéma, grand écran vidéo et musique, appui long sur l'orbe pour l'énergie de la souris, entité posée sur le logo. |
| 23/10 | v8 | Bouton « Écran en direct » inactif sur le plan 3. Maquette figée, plan de construction de la phase 1 rédigé. |

## Décisions prises

- **Vue mobile** : on n'y touche plus jusqu'à nouvel ordre (état de la v3).
- **Trois plans sur PC** : 1 = hub, 2 = notes et applis, 3 = bureau du PC.
- **Sauvegarde** : chaque version est rangée sur GitHub (`maquettes/`), dans le Projet et dans l'historique de la maquette. Rien n'est écrasé.
- **IA à 0 €, sans carte bancaire** : l'entité utilisera un petit modèle d'IA qui tourne directement dans Brave, sur le PC (gratuit, privé, moins puissant, gros téléchargement unique, pas sur téléphone). Pas d'API payante.
- **Ordre de la phase 6** : d'abord une IA reliée à l'orbe principale, ensuite l'entité.
- **Mods graphiques** : refontes visuelles fortes sans changer les fonctions, prévues en V2. Aperçus actuels : Hologramme (actif), Biomécanique, Putréfaction, Mécanique, Esprits des planètes.

## À trancher plus tard

- **IA de l'orbe** : avec la règle 0 €, une API payante est exclue. Options à étudier en phase 6 : le même type de modèle local (plus gros), ou une offre gratuite sans carte bancaire si elle existe à ce moment-là.
- **Onglet « Nos projets »** à gauche, avec Mon PC : Suivi, journal, cahier des charges et maquettes lus depuis GitHub, liens vers le Projet Claude.

- **Appli Windows** pour les fonctions marquées ◇ (processeur, volume direct, lancement de programmes, Corbeille) et pour l'écran du PC en direct avec navigation. Une page web peut seulement afficher une vue en direct (avec l'accord de Brave), sans pouvoir cliquer dedans.
- **Cahier des charges** : les ajouts des maquettes sont repris dans `docs/plan-phase1.md` (tableau des phases), qui fait foi en cas de doute.
- **Liaison automatique** entre la fenêtre Progression et le Suivi du Hub : pour l'instant c'est un relevé, mis à jour à chaque nouvelle version.
