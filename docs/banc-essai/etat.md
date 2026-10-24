# Banc d'essai · état

Mission du 24/10/2026, 16 h 14 → 18 h 15 (Paris). Branche `banc-essai` créée depuis `main` (8aa1802).
Environnement : serveur local (`python3 -m http.server`), Chromium headless (Playwright), données factices uniquement.
Reprise programmée : une seule en attente (voir fin de fichier).

## Cycle en cours

Cycle 4 · Cas limites et charge (cycles 1 à 3 terminés : 19/19 après corrections)

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
| 4 | Cas limites et charge | à faire | |
| 5 | Performance et confort | à faire | |
| 6 | Suite automatique `tools/tests/` | en cours | écrite au fil des cycles : `python3 tools/tests/run.py` |

## Prochaine action

Cycle 4 : 1 000 notes/tâches, 2 000 favoris, stockage plein, coupure réseau en pleine synchro, horloge et fuseau, textes longs. Intégrer les constats de la relecture statique (second agent) dès son retour.

## Reprise programmée

Prochaine reprise : 17 h 15 (Paris).
