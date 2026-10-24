# Banc d'essai · état

Mission du 24/10/2026, 16 h 14 → 18 h 15 (Paris). Branche `banc-essai` créée depuis `main` (8aa1802).
Environnement : serveur local (`python3 -m http.server`), Chromium headless (Playwright), données factices uniquement.
Reprise programmée : une seule en attente (voir fin de fichier).

## Cycle en cours

Cycle 1 · Sauvegardes

## Tests

| Cycle | Test | Statut | Note |
| --- | --- | --- | --- |
| 1 | Export puis import sur appareil vierge | à faire | |
| 1 | Export chiffré, réimport avec la phrase | à faire | |
| 1 | Export chiffré, réimport avec la clé de secours | à faire | |
| 1 | Refus d'un fichier corrompu / d'une autre version | à faire | |
| 1 | Coffre du Hub : ajout sans effacer, doublons ignorés, refus d'un export du hub | à faire | |
| 1 | Rappel du dimanche (horloge simulée) | à faire | |
| 1 | Synchro simulée deux appareils (fusion, suppressions, conflits) | à faire | |
| 2 | Recette fonctionnelle PC + mobile, hors ligne, SW, deux onglets, console | à faire | |
| 3 | Sécurité | à faire | |
| 4 | Cas limites et charge | à faire | |
| 5 | Performance et confort | à faire | |
| 6 | Suite automatique `tools/tests/` | à faire | |

## Prochaine action

Lire `js/widgets/backup.js`, `js/ui/data.js`, `js/store/storage.js`, puis test « export / import sur appareil vierge ».

## Reprise programmée

Prochaine reprise : 17 h 15 (Paris).
