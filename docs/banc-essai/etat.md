# Banc d'essai · état

Mission du 24/10/2026, 16 h 14 → 18 h 15 (Paris). Branche `banc-essai` créée depuis `main` (8aa1802).
Environnement : serveur local (`python3 -m http.server`), Chromium headless (Playwright), données factices uniquement.
Reprise programmée : une seule en attente (voir fin de fichier).

## Cycle en cours

Cycle 2 · Fonctionnalités (cycle 1 terminé : 7/7)

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
| 2 | Recette fonctionnelle PC + mobile, hors ligne, SW, deux onglets, console | à faire | |
| 3 | Sécurité | à faire | |
| 4 | Cas limites et charge | à faire | |
| 5 | Performance et confort | à faire | |
| 6 | Suite automatique `tools/tests/` | en cours | écrite au fil des cycles : `python3 tools/tests/run.py` |

## Prochaine action

Cycle 2 : écrire `tools/tests/t2_fonctions.py` (fenêtres, plans, menus, notes, tâches, agenda, favoris, PC + mobile, hors ligne, deux onglets, console).

## Reprise programmée

Prochaine reprise : 17 h 15 (Paris).
