# Banc d'essai · état

Mission du 24/10/2026, 16 h 14 → 18 h 15 (Paris). Branche `banc-essai` créée depuis `main` (8aa1802).
Environnement : serveur local (`python3 -m http.server`), Chromium headless (Playwright), données factices uniquement.
Reprise programmée : une seule en attente (voir fin de fichier).

## Cycle en cours

Tour 2 · approfondissement (cycles 1 à 6 terminés)

## Tests

| Cycle | Test | Statut | Note |
| --- | --- | --- | --- |
| 1 | Export puis import sur appareil vierge | réussi | comptes, textes accentués/emojis et réglages identiques ; aucun secret dans le fichier |
| 1 | Export chiffré, réimport avec la phrase | réussi | rien en clair dans le fichier ; mauvaise phrase refusée ; appareil reprend le verrouillage |
| 1 | Export chiffré, réimport avec la clé de secours | réussi | clé tapée en minuscules acceptée ; ancienne clé invalidée |
| 1 | Refus d'un fichier corrompu / d'une autre version | corrigé | message trompeur pour un export chiffré trafiqué (B1) |
| 1 | Coffre du Hub : ajout sans effacer, doublons ignorés, refus d'un export du hub | réussi | javascript: et http: refusés |
| 1 | Rappel du dimanche (horloge simulée) | réussi | 7 cas d'horloge + « Plus tard » 3 h |
| 1 | Synchro simulée deux appareils (fusion, suppressions, conflits) | réussi | GitHub simulé ; Gist secret, illisible ; voir B2 (import + synchro) |
| 2 | Recette PC : plans 1-2-3, notes, tâches (! @demain 18h), favori, menu du fond, météo simulée, actu + veille + alerte de panne, rappel | réussi | 0 erreur console |
| 2 | Recette mobile simulé (390×844, tactile) | réussi | pas de défilement horizontal |
| 2 | Hors ligne + mise à jour du service worker | réussi | nouvelle version annoncée, ancien cache retiré, données gardées |
| 2 | Deux onglets (ajout, suppression vus dans l'autre) | réussi | |
| 3 | Aucun secret ni donnée personnelle dans le dépôt | réussi | seule « maman@gmail.com » (exemple d'interface) |
| 3 | Textes piégés : notes, tâches, agenda, favoris, groupes | réussi | rien ne s'exécute, aucune balise insérée |
| 3 | Liens javascript:/data: : flux RSS, export trafiqué (favoris, page en direct, radios) | corrigé | B3, B4, B5 |
| 3 | Verrouillage : illisible au repos, mauvaise phrase, vieil onglet, verrouillage auto 5 min | réussi | |
| 3 | Jetons mails, clé Gemini, jeton et phrase de synchro : ni exportés ni synchronisés | réussi | |
| 3 | Liens externes noopener ; page en direct isolée | corrigé | B5 |
| 4 | 1 000 notes, 1 000 tâches, 2 000 favoris (chargement, ajout, recherche, export, import) | réussi | chargement < 15 s en headless logiciel |
| 4 | Stockage plein | corrigé | B6 |
| 4 | Réseau coupé en pleine synchro (avant lecture, entre lecture et écriture) | réussi | rien de perdu, reprise au tour suivant |
| 4 | Onglet fermé en plein import (50 à 1 200 ms) | réussi | toujours ancien OU nouvel état |
| 4 | Fuseaux (Kiritimati, Los Angeles, Calcutta), horloge reculée/avancée, passage à l'heure d'hiver, textes de 100 000 caractères | réussi | |
| 5 | Chargement à froid PC / mobile, images/s (rendu logiciel, valeur plancher) | réussi | < 1,5 s ; 2 et 9 img/s sans carte graphique : non représentatif |
| 5 | Mémoire dans la durée (version 3 min, gestes) | réussi | tas JS stable ~10 Mo ; 30 min complètes non rejouées (temps) |
| 5 | Mouvement réduit | réussi | aucune animation sans fin |
| 5 | Navigation au clavier | corrigé | B13 |
| 5 | Contrastes | réussi | mesure partielle (fonds en dégradé non mesurables) |
| 3 | Relecture statique (second agent) | corrigé | B7 à B12 corrigés ; B14 à B16 décrits |
| 6 | Suite automatique `tools/tests/` (28 tests, mode d'emploi `tools/tests/README.md`) | réussi | `--rapide` : 28/28 en 7 min après toutes les corrections |

## Prochaine action

Tour 2 : onglet fermé pendant un changement de phrase (rotation de clé) ; import + synchro (B2) ; puis résumé final du rapport à 18 h 15.

## Reprise programmée

Prochaine reprise : 17 h 15 (Paris).
