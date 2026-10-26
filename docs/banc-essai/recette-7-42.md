# Recette 7.42 — poste Banc de test

Date : 26/10. Code vérifié : main en **7.42.0** (067fab8), depuis 7.40.1 : correctifs R1 et R2 (Refonte 5), fenêtres **Budget** et **Achats** (Atelier, 7.41.0), lots 4b, 5, 8 et 9 du **Noyau** (annulation propre, modules dynamiques, persistance, sessions, workflows, 7.42.0).
Branche : `banc-recette3`. Rien n'est fusionné. Aucun fichier de `js/`, `css/` ni `index.html` modifié (vérifié par `git diff main -- js css index.html`, vide). Données factices, réseau extérieur bloqué par le banc, aucune clé, aucun vrai service.
Chromium sans carte graphique : la 3D est coupée dans ces essais (comme dans tout le banc). Brave et Android ne sont pas disponibles ici.

## Résumé

1. Suite Python complète : **64 réussis, 1 échec sur 65** (2 040 cas, 768 s). L'échec est `test_refonte5_r2_echap_apres_clic_sur_la_barre_de_titre` : défaut du **test** (attente de 1,5 s trop courte pour le fondu d'ouverture de la fenêtre), pas du hub. Avec 6 s d'attente, le correctif R2 fonctionne (3 essais sur 3 pas de souci, focus dans la fenêtre, Échap la réduit). Rejoué seul : échec 6 fois sur 6 avec 1,5 s, donc ce n'est pas un échec de charge.
2. `node labo/essais*.mjs` : **44 fichiers, tous au vert** (`essais.mjs` : 44 réussis, 0 raté, 15 sautés faute de moteur réel, inchangé). `node tools/tests/atelier/tout.mjs` : « Tous les moteurs de l'Atelier : Tout est bon ».
3. Parcours Playwright (PC 1440×900, téléphone 390×844, hors ligne, Noyau, `?pc` `?mobile` `?auto`, données chiffrées) : **57 points, 55 OK, 2 à corriger (une seule cause), 0 non vérifiable parmi les points déroulés** ; non vérifiables listés plus bas.
4. **Anomalie importante BUD-1** : dans Budget, un **deuxième import de relevé touchant un mois déjà enregistré efface en mémoire durable les opérations du premier** (visibles jusqu'au rechargement, perdues après). Reproduit PC et téléphone. Détail plus bas.
5. Aucune erreur console, aucune violation CSP (écoute de `securitypolicyviolation`) sur tous les parcours, hors ligne compris.
6. Hors ligne : les 18 nouveaux fichiers (Budget, Achats, 4 moteurs, outils communs, Noyau lots 5/8/9) sont dans le cache `hub-7.42.0` ; rechargement réseau coupé : le hub démarre, Budget importe un CSV, Achats enregistre, les modules du Noyau se chargent depuis le cache. Analyse statique : les 138 fichiers atteignables depuis `main.js` sont tous dans le `PRECACHE`.
7. Noyau : **45 outils, niveaux identiques à la liste validée**, `enregistrer_module` en CONFIRMATION (refusé = aucun module écrit), `afficher_module` et `lire_modules` en LIBRE ; 16 noms de gestes (retirer, supprimer, exporter, importer, restaurer, actualiser, rejouer ou lancer un workflow, vider…) refusés comme outils inconnus ; seule écriture d'outil sur les modules : `o.modules.enregistrer`. Les gestes de Lucien existent côté interface (`hote.ui.orchestrateur.gestes()`), hors catalogue.
8. Données chiffrées (verrouillage actif) : aucun libellé Budget ni Achats lisible dans IndexedDB (tous les magasins), ni dans `localStorage`, ni dans l'export du hub ; tout revient après déverrouillage.
9. À décider par Lucien : faire corriger BUD-1 avant d'utiliser Budget avec un vrai relevé (deux fichiers du même mois) ; corriger l'attente du test R2.
10. Prochaine étape : correction de BUD-1 par la Commande ou l'Atelier, puis tes essais Brave et Android (liste en bas).

## Tableau point par point

Statuts : OK, à corriger (KO), non vérifiable (NV).

### Suites automatiques
| # | Point | Statut | Détail |
| --- | --- | --- | --- |
| S1 | `python3 tools/tests/run.py` (complet) | à corriger | 64/65, 2 040 cas, 768 s. Seul échec : test R2 (attente trop courte, voir T1). |
| S2 | 44 fichiers `labo/essais*.mjs` | OK | Tous « Tout est bon » / « Tout est au vert » ; `essais.mjs` 44 réussis, 0 raté, 15 sautés. |
| S3 | `tools/tests/atelier/tout.mjs` | OK | 11 fichiers de moteurs, tout est bon (bud-csv 41, bud-enveloppes 23, cons-score 17…). |
| S4 | `git diff main -- js css index.html` | OK | Vide : rien modifié. |
| S5 | Fichiers atteignables depuis `main.js` présents dans le `PRECACHE` de `sw.js` | OK | 138 fichiers, 0 manquant ; 176 entrées du PRECACHE, toutes présentes sur le disque. |
| S6 | Aucun outil du Noyau n'appelle un geste (`outils.js`) | OK | Appels sur `o.modules` : `enregistrer`, `lire`, `lister` seulement ; `o.sessions` : `lister`, `reprendre` ; `o.espaces` : `lister`. `gestes-lucien.js` n'est importé que par `noyau.js` (pour l'interface). |

### R1 et R2 (Refonte 5)
| # | Point | Statut | Détail |
| --- | --- | --- | --- |
| R1 | `fermer_appli("direct")` coupe le partage sans fenêtre ouverte | OK | `test_refonte5_r1_fermer_direct_coupe_le_partage_sans_fenetre` vert. Partage simulé (flux canvas). |
| R2 | Échap réduit la fenêtre après un clic sur sa barre de titre | OK (le correctif) / à corriger (le test) | Fonctionne dès que la fenêtre a fini son fondu d'ouverture (3/3 avec 6 s d'attente). Le test n'attend que 1,5 s : T1. |

### Budget (PC 1440×900 et téléphone 390×844, mêmes résultats)
| # | Point | PC | Tél. | Détail |
| --- | --- | --- | --- | --- |
| B1 | Import CSV français : BOM, « ; », lignes de banque avant le tableau | OK | OK | « 4 opérations ajoutées ». |
| B2 | Enveloppes, règle « toujours classer », montant mis dans l'enveloppe | OK | OK | Reste Courses 124,60 €, à répartir 1 600,00 €. |
| B3 | Colonnes Débit / Crédit | OK | OK | 2 opérations. |
| B4 | Séparateur virgule, guillemets, dates ISO, virgule dans un libellé | OK | OK | 1 opération. |
| B5 | Relevé sans opération | OK | OK | « 0 opération ajoutée », pas de plantage. |
| B6 | Libellé piégé (`<img onerror>`, formule `=HYPERLINK`) | OK | OK | Affiché en texte : 0 `<img>`, 0 lien, rien d'exécuté. |
| B7 | Fichier binaire | OK | OK | Refusé, aucune erreur console. |
| B8 | Rechargement : enveloppes, montants et opérations conservés | **KO** | **KO** | Enveloppes et montants mis restent ; **les opérations des imports précédents du même mois disparaissent** : BUD-1. |

### Achats
| # | Point | PC | Tél. | Détail |
| --- | --- | --- | --- | --- |
| A1 | Deux achats (en ligne, magasin), garantie, délai de retour, prochains rappels | OK | OK | |
| A2 | État de garantie de l'achat ancien (700 jours) | OK | OK | Affiché. |
| A3 | Colis UPS à clé valide : transporteur reconnu, bouton « Ouvrir le suivi » | OK | OK | `window.open("https://www.ups.com/track?…", "_blank", "noopener,noreferrer")` seulement au clic ; aucune requête extérieure avant le clic. |
| A4 | Numéro trop court / message collé | OK | OK | Message clair. |
| A5 | Rechargement : achats conservés | OK | OK | |
| A6 | Aucun défilement horizontal de la page | OK | OK | 0 px. |
| C1 | Aucune violation CSP | OK | OK | |
| C2 | Aucune erreur console | OK | OK | |

### Données chiffrées, hors ligne, Noyau, adresses
| # | Point | Statut | Détail |
| --- | --- | --- | --- |
| V1 | Verrouillage actif : aucun libellé Budget/Achats en clair dans IndexedDB (tous les magasins) | OK | CARREFOUR, SALAIRE, ELECTRICITE, « Courses secrètes », « Achat confidentiel » : aucun trouvé. |
| V2 | Rien en clair dans `localStorage` | OK | |
| V3 | Rechargement + déverrouillage : enveloppe et achat reviennent | OK | |
| V4 | Export du hub avec verrouillage : fichier chiffré | OK | 4 673 octets, aucun libellé lisible. |
| V5 | Aucune erreur console ni violation CSP | OK | |
| H1 | Les 18 nouveaux fichiers dans le cache `hub-7.42.0` (seul cache présent) | OK | 0 manquant. |
| H2 | Rechargement réseau coupé | OK | |
| H3 | Budget importe un CSV hors ligne | OK | |
| H4 | Achats enregistre hors ligne | OK | |
| H5 | Noyau hors ligne : outils (45), workflows, 5 plans-modèles, sessions, cache-jeux, gestes chargés | OK | |
| H6 | Hors ligne : aucune erreur console ni violation CSP | OK | |
| N1 | 45 outils au catalogue = liste validée | OK | 0 manquant, 0 en trop. |
| N2 | Niveaux inchangés | OK | 0 écart avec `OUTILS_VALIDES`. |
| N3 | `enregistrer_module` CONFIRMATION ; `afficher_module`, `lire_modules` LIBRE | OK | |
| N4 | 16 noms de gestes refusés (« inconnu ») | OK | retirer/supprimer/exporter/importer/restaurer_module, restaurer_version, actualiser_module, rejouer/lancer/supprimer_workflow, vider_cache, supprimer_session, exporter, importer, sauvegarder, restaurer. |
| N5 | Aucun nom d'outil évoquant suppression, export, restauration, workflow, session, espace | OK | |
| N6 | `enregistrer_module` sans accord de Lucien | OK | Refusé (« Lucien a refusé cette action »), 0 module avant et après. |
| N7 | Gestes de Lucien offerts à l'interface seulement | OK | `hote.ui.orchestrateur.gestes` est une fonction ; absente du catalogue. |
| U1 | `?pc` à 1440 px | OK | Démarre, pas d'erreur, pas de violation CSP, Budget et Achats présents, 0 px de débordement. |
| U2 | `?mobile` à 390 px | OK | Idem (classe `lite`). |
| U3 | `?auto` à 1440 px et à 390 px | OK | Idem. |

### Non vérifiable ici
| # | Point | Pourquoi |
| --- | --- | --- |
| NV1 | Relevé bancaire réel (colonnes, encodage, signes) | Aucun vrai relevé ; seuls les formats couverts par les moteurs sont essayés. |
| NV2 | Sélecteur de fichier CSV sur Android, clavier numérique, doigt | Chromium PC uniquement. Le champ fichier est alimenté par script. |
| NV3 | Ouverture réelle du lien de suivi dans un nouvel onglet | `window.open` est simulé pour relever ses arguments. |
| NV4 | IndexedDB réel de Brave : cache des jeux, sessions, taille réelle des `kv/noyau-module-*` après synchro | Chromium de test ; synchro non essayée. |
| NV5 | Workflow avec une étape CONFIRMATION, bouton « Annuler », liste des modules, « Reprendre la dernière session » | Pas encore d'interface dans le hub (reste à la Refonte d'après `docs/noyau-orchestrateur/etat.md`) ; les moteurs sont couverts par `essais-workflows.mjs`, `essais-persistance.mjs`, `essais-annulation.mjs`, tous verts. |
| NV6 | Acceptation d'un `enregistrer_module` par Lucien dans la vraie fenêtre | Seul le refus est joué ici ; l'acceptation est couverte par `essais-modules-dynamiques.mjs`. |
| NV7 | Sources de données réelles (DBnomics, Banque mondiale) | Réseau extérieur bloqué ; voir `labo/essai-sources-donnees.html`. |
| NV8 | Images par seconde, 3D | Pas de carte graphique. |

## Anomalies

### BUD-1 · importante · Budget : un deuxième import du même mois efface le premier après rechargement
- **Où** : `js/widgets/budget.js`, `sauverOps(liste)` (appelée par `importer` avec `a`, les opérations **nouvelles** seulement) : elle écrit `{ id: "budget-ops-AAAA-MM", operations: l }` avec `l` = les nouvelles opérations du mois, ce qui **remplace** le document du mois. La mémoire de la fenêtre (`ops`) garde tout, d'où l'impression que tout va bien jusqu'au rechargement. (L'autre écriture, ligne du classement manuel, réécrit bien tout le mois à partir de la mémoire.)
- **Reproduction** : ouvrir Budget ; importer un relevé de 2 opérations d'octobre (`01/10` et `02/10`) ; importer un second relevé d'octobre avec 1 opération (`20/10`) ; lire le magasin : `budget-ops-2026-10` contient **1** opération au lieu de 3 ; recharger : les 2 premières ont disparu. Deux relevés de mois différents : conservés (septembre 1, octobre 2).
  Observé aussi avec les fichiers du banc : `Date;Libellé;Montant` en 4, puis 2, puis 1 opération : après rechargement il ne reste que la dernière importée, les enveloppes affichent « dépensé 0,00 € » et un « à répartir » négatif (−200,00 €). Avant le rechargement, le pied de fenêtre disait « 8 opérations sur l'appareil ».
- **Pourquoi les essais verts ne l'ont pas vu** : `t11_atelier3` n'importe qu'un seul fichier par mois, et le réimport du même fichier (0 nouvelle) n'écrit rien.
- **Gravité** : importante. Perte silencieuse de données de l'utilisateur dès qu'un relevé est importé en deux fois sur un mois (cas courant : relevé de mi-mois puis de fin de mois). Elle se propage à la synchro et à l'export.
- **Piste** (non appliquée) : écrire pour chaque mois touché `ops.filter((o) => o.date.slice(0, 7) === m)` (toute la mémoire), comme le fait déjà le classement manuel. Ajouter un essai « deux imports du même mois, rechargement ».
- Corriger ne demande ni changement de format ni migration ; les mois déjà écrasés ne se récupèrent pas (il faut réimporter le relevé).

### T1 · mineure (banc) · test R2 : attente trop courte
- `tools/tests/t10_refonte5.py::test_refonte5_r2_echap_apres_clic_sur_la_barre_de_titre` attend 1 500 ms après `ouvrir_appli("internet")`, puis clique la barre de titre. Ici la fenêtre est encore `visibility: hidden` (opacité 0 pendant le fondu, classe `cine` sur `body` jusqu'à environ 4 s) : le clic tombe sur le fond, le focus reste sur `BODY`.
- Reproduction : `python3 tools/tests/run.py r2_echap` : échec 6 fois sur 6 ; avec 6 000 ms d'attente : 2 succès sur 2 (et 1 500 ms : échec dans la même série).
- Pas de défaut du hub ; le correctif de Refonte 5 (`tabIndex = -1` sur la fenêtre) fait son travail. À corriger côté test (attendre `visibility: visible` et opacité 1 plutôt qu'un délai fixe).

### Observations (rien à corriger obligatoirement)
- **Téléphone, hauteur de la pile** : 18 fenêtres visibles et 8 801 px de défilement par défaut (7 599 px et 16 fenêtres en 7.35.0). Budget et Achats ajoutent environ 1 200 px. Rappel de la décision A2 de la recette de la refonte (réserve ou fonctions rares masquées) : à trancher par Lucien.
- Les gestes de Lucien (`hote.ui.orchestrateur.gestes`) sont atteignables depuis la console de la page, comme `window.__hub` (convention connue, B16) ; ils ne le sont pas depuis le modèle.
- Le pied de la fenêtre Budget (« N opérations sur l'appareil ») compte la mémoire, pas le magasin : il aurait montré l'écart de BUD-1.

## Essais à faire par Lucien (Brave PC et Android)

1. **Relevé bancaire réel** (Brave PC) : Budget → importer le CSV de ta banque (le fichier ne quitte pas l'appareil). Colonnes reconnues ? dates et signes justes ? accents lisibles (Excel en Windows-1252) ? **Après correction de BUD-1** : importer deux relevés du même mois, recharger, vérifier que tout est là.
2. **Sélecteur de fichier CSV sur Android** : le bouton « Importer un relevé » ouvre-t-il le sélecteur (Téléchargements, Drive) ? les `.csv` apparaissent-ils ? un fichier « text/plain » passe-t-il ?
3. **Clavier numérique Android** : saisie d'un montant avec la virgule dans « Mis dans l'enveloppe » ; taille des boutons et des listes au doigt.
4. **Lien de colis** : sur un vrai numéro (La Poste, UPS, Colissimo) : « Ouvrir le suivi » ouvre bien un nouvel onglet vers le site du transporteur, sans que rien ne parte avant le clic.
5. **Verrouillage actif** : fermer puis rouvrir le hub sur PC et sur Android : enveloppes et achats reviennent ; après une synchro entre les deux appareils aussi.
6. **Cache IndexedDB réel** (Noyau lot 9) : charger une série dans la fenêtre du Noyau, recharger la page, puis `lire_modules` avec `session` : le jeu revient-il sans réseau ? Mesurer la taille des documents `kv/noyau-module-*` après synchro.
7. **Workflow avec confirmation** : depuis la console (`await window.__hub`… puis `hote.ui.orchestrateur.workflows()`), lancer un modèle de plan dont une étape est en CONFIRMATION : la fenêtre de validation s'ouvre, le budget annoncé est juste, un refus arrête le plan, un « Annuler » en cours d'exécution laisse des étapes « non exécutées ». (L'interface complète est encore à venir.)
8. **Hors ligne réel** : installer le hub (PWA) sur Android, couper les données, relancer : Budget et Achats s'ouvrent et gardent leurs données.
9. **`enregistrer_module`** : demander au Noyau d'enregistrer un graphique ; vérifier que la confirmation montre titre, source, période et date ; accepter puis refuser.
10. **Sources de données** : ouvrir `labo/essai-sources-donnees.html` (3 boutons) sur PC puis Android et relever les trois lignes (reste attendu du lot 3).

## Reproduire ce qui a été fait

- Suites : `python3 tools/tests/run.py` ; `for f in labo/essais*.mjs; do node $f; done` ; `node tools/tests/atelier/tout.mjs`.
- Parcours Playwright : script du poste (non versionné, regroupe les points B, A, C, V, H, N, U ci-dessus, avec `securitypolicyviolation` écouté). Captures de Budget et Achats (PC et téléphone) : `docs/banc-essai/recette3/`.
