# À décider par Lucien (préparé pendant la mission autonome)

## Décisions prises par Lucien · 25/10 à 21 h 05 (« je valide tout »)
- **Outils** : `consulter_manuel`, `chercher_decisions`, `lire_contradictions` (LIBRE), `proposer_decision` et `creer_routine` (CONFIRMATION) sont **validés** avec leur niveau ; la liste des 34 outils existants est **confirmée**. Fait : ajoutés à `OUTILS_VALIDES` (`js/noyau/outils.js`) et listés dans `OUTILS_A_BRANCHER` (validés, pas encore actifs : le branchement demande `sw.js`, à la fusion).
- **Bibliothèques d'IA figées** (constats B14 et L1 du Banc) : WebLLM `@0.2.85`, Transformers.js `@3.0.2`, versions exactes partout ; le worker ne reçoit que le texte et n'ouvre pas les bases du hub. Voir `decisions.md` (24 et 25).
- **Fiches du manuel, ordre de la suite, essais réels** (points 2 à 4 ci-dessous) : validés dans leur principe ; restent à faire avec toi (déplacer les fiches, essais sur ton PC).

## 1. ~~Valider les outils proposés~~ · fait le 25/10 (voir ci-dessus)

## 2. Fiches du manuel à valider
14 fiches dans `docs/labo-auto/manuel-a-valider/` (toutes à emplacement « provisoire » tant que la refonte n'est pas validée). Valider = les déplacer dans `docs/manuel/fiches/`, passer `statut_emplacement` à `confirme` quand l'emplacement est sûr, puis `node labo/manuel-index.mjs`.

## 3. Ordre proposé pour la suite (étape b, à trancher ensemble)
| Ordre | Lot | Pourquoi | Dépend de |
| --- | --- | --- | --- |
| 1 | Brancher le socle + les modèles + le badge | Tout le reste s'appuie dessus | Refonte (fenêtre Outils « Gérer les modèles », cache hors ligne `sw.js`) |
| 2 | lab-voix : Whisper local | Seul blocage d'usage actuel (dictée bloquée dans Brave) | Socle branché, essai réel sur PC |
| 3 | Manuel branché + outil `consulter_manuel` | Le Noyau connaît les fonctions | Ta validation de l'outil |
| 4 | lab-khoj-sources puis lab-khoj-sens | Réponses qui citent leurs sources, recherche par le sens | Essai réel du sens |
| 5 | Décisions, contradictions | Mémoire des décisions et signaux | Stockage et affichage (Refonte) |
| 6 | lab-n8n-routines, modèles, proactif, trieur de mails et fichiers | Plus gros chantiers | Bloc Mails de l'Atelier |

## 4. Essais réels toujours à faire avec toi (rien n'a été fait en ton absence)
1) première exécution GitHub « Veille d'étude » ; 2) synchro du Noyau PC + téléphone ; 3) recherche par le sens (≈ 120 Mo) ; 4) voix Piper (≈ 60 Mo) ; 5) une nuit de veille branché ; + les bibliothèques réelles du socle (WebLLM 0.2.85 en WebGPU, Transformers.js 3.0.2 en WASM) jamais essayées dans l'atelier ; à cette occasion, copier leur fichier dans `vendor/` avec une empreinte (impossible depuis l'atelier).

## 5. Non fait volontairement
Fenêtre de chat (dépend de la refonte), lab-perso-fixes (attend la liste des points de réglage), lab-voix et lab-perf (demandent un essai réel et la fenêtre Outils), essais réels.
