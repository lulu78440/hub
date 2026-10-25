# Banc d'essai · état

Mission du 24/10/2026, 16 h 14 → 18 h 15 (Paris). Branche `banc-essai` créée depuis `main` (8aa1802).
Environnement : serveur local (`python3 -m http.server`), Chromium headless (Playwright), données factices uniquement.
Mission close le 25/10/2026 à 15 h 11 ; relais : poste « Banc de test » (Charte des postes).

## Bilan

- **Fait** : cycles 1 à 6, relecture statique, série « 1 000 cas précis » (1 895 cas), fusion d'essai avec main 2077509 (0 conflit, tout vert), B28 corrigé. 24 corrections sur la branche, 4 décrites.
- **En cours** : rien (aucun test lancé, aucune reprise programmée).
- **À faire (poste Banc de test / Lucien)** : décisions B2, B9, B14, B15, B16 ; fusion de `banc-essai` (version au-dessus de main) après un dernier passage de `python3 tools/tests/run.py` ; recette sur Brave (PC) et Android ; mémoire sur 30 min ; Mon PC avec de vrais dossiers ; vraies connexions (jeton Gists, Gmail, Outlook, Gemini).

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
| 6 | Suite automatique `tools/tests/` (32 tests, mode d'emploi `tools/tests/README.md`) | réussi | complète : 32/32 en 12 min (un test de coupure rendu déterministe) |
| 4 | Onglet fermé pendant un changement de phrase (5 à 800 ms) | réussi | données toujours lisibles avec l'ancienne ou la nouvelle phrase |
| 2 | Médias (vidéo collée, lien piégé) et page en direct | réussi | |
| 4 | Import d'un export abîmé (types inattendus) | corrigé | B17 |
| 7 | Échéances @… (382 cas) | corrigé | B18 |
| 7 | Heures (181 cas) | corrigé | B19 |
| 7 | Recherche et voix (47 cas) | corrigé | B20 |
| 7 | YouTube, coordonnées, anniversaires (74 cas) | corrigé | B21, B22 |
| 7 | Fêtes 2015-2045 (304), rappel du dimanche (300), dates et lune (79) | réussi | |
| 7 | XSS × 7 endroits (173), liens × 4 endroits (52) | réussi | |
| 7 | Coffre : chiffrement, falsification, phrases, clé de secours (142) | corrigé | B24 |
| 7 | Lecture des fichiers (53), import champ par champ (28) | corrigé | B25, B26, B27 |
| 7 | Synchro, 40 situations × 2 (80) | corrigé | B23 |
| 6 | Suite complète (46 tests, 1 928 cas) | réussi | ~17 min ; tests d'export chiffré adaptés au rendu logiciel lent après la feuille du coffre |
| 7 | Synchros simultanées (deux onglets) | corrigé | B28 |
| 6 | Fusion d'essai avec main 2077509 : suite (46 tests, 1 929 cas) + essais du Noyau | réussi | 0 conflit ; 3D coupée dans les tests de fonctions |

## Mission autonome du 25/10, 19 h 31 → 20 h 00 (poste Banc de test)

| Heure | Tâche | Statut | Note |
| --- | --- | --- | --- |
| 19 h 35 | 1 cons-banc | fait | 29 problèmes : critique 1 (B7), importants 13 (B3-B6, B8, B9, B14, B18, B23-B25, B28, B29), mineurs 15. B29 ajouté (clés Claude et relais remises en clair sur main). Fusion d'essai avec main du 25/10 16 h 40 : 0 conflit, 1 896 cas justes. |

Décisions prudentes prises seul : main n'est jamais fusionnée dans banc-essai (essais dans des copies jetables) ; B29 seulement décrit (code présent sur main uniquement) ; reprise programmée à 19 h 50 (19 h 30 déjà passée au démarrage).

## Prochaine action

Poste « Banc de test » : relire ce fichier et `rapport.md`, rejouer `python3 tools/tests/run.py` (mode d'emploi `tools/tests/README.md`), puis la liste « À faire » ci-dessus.

## Reprise programmée

Aucune (annulée en fin de mission).
