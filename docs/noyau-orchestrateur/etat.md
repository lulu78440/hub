# Noyau orchestrateur · état

26/10/2026 · poste Labo · Cerveau IA · branche `labo-orchestrateur3` (créée depuis `origin/main` 7.36.2, **poussée, non fusionnée**).

| Lot | État |
| --- | --- |
| 1 · Audit | fait (`audit.md`) |
| 2 · Composants affichables | construit (déjà dans `main`) ; relecture visuelle par Lucien et test Android encore attendus |
| **3 · Registre d'outils** | **construit sur `labo-orchestrateur3`, à relire par Lucien** (détail ci-dessous) |
| **4 · Fiabilité et panneaux** | **construit sur `labo-orchestrateur4` (7.39.0), à relire par Lucien** (détail en bas) |
| 5 et suivants | non commencés |

## Lot 3 · ce qui est construit (26/10)
**Principe : le modèle passe des références aux données, jamais des chiffres.** Un outil de données range un jeu vérifié en mémoire de la page et ne rend au modèle qu'une référence `jeu:xxxxxxxx` avec un résumé calculé par le hub (unité, période, source, date, premier, dernier et extrêmes). Une référence inconnue ou mal écrite est refusée ; un nombre à la place d'une référence est refusé par le validateur.

### Les 6 outils (validés par Lucien le 26/10 : 5 en accès libre, 1 avec confirmation)
| Outil | Niveau | Rôle |
| --- | --- | --- |
| `chercher_donnees` | LIBRE | Cherche des séries (DBnomics, indicateurs Banque mondiale, séries publiées). Mots-clés filtrés comme `chercher_sources` (mots privés retirés). Rend des identifiants. |
| `lire_serie` | LIBRE | Télécharge UNE série, la range en mémoire, rend la référence et le résumé. |
| `transformer_donnees` | LIBRE | Calcule un nouveau jeu : `periode`, `colonnes`, `variation`, `indice100`, `moyenne_mobile`, `derniers`, `comparer`. Calcul fait par le hub ; source, date et licence conservées. |
| `afficher_module` | LIBRE | Affiche courbe, barres, tableau ou chiffre clé dans la fenêtre du Noyau (éphémère), ou réaffiche un module enregistré. Source et date toujours visibles. |
| `lire_modules` | LIBRE | Liste les modules enregistrés (aucune valeur chiffrée). |
| `enregistrer_module` | CONFIRMATION | Enregistre ou remplace un module (copie vérifiée du jeu). Lucien voit titre, source, période et date des données avant d'accepter. |

Aucune suppression ni export de module pour le Noyau (gestes de Lucien). 20 modules au plus, 250 Ko chacun. Catalogue : 45 outils (34 + 5 + 6), liste validée = 45.

### Fichiers (tous dans `js/noyau/`, `labo/`, `docs/`)
- `registre.js` : validateur complet (nombre, borne, liste, objet, motif, paramètre inconnu), contrôle de cohérence des déclarations (`drapeaux` ne peuvent que **durcir** un niveau, jamais l'assouplir), `hotes`, `limites`, `sortie_schema`, liste des hôtes, fiche lisible. Le catalogue est contrôlé à sa création : un outil incohérent est écarté (avec avertissement), comme un outil non validé.
- `jeux.js` : mémoire de jeux (30 au plus), références, résumé pour le modèle.
- `donnees.js` : 3 sources en liste fixe (DBnomics, Banque mondiale, séries publiées par la tâche GitHub). Adresses construites par le code, jamais par le modèle ; https et hôte de la liste seulement ; 2 Mo au plus ; 10 s ; 30 appels par minute et par source ; source coupable dans les réglages (`noyau-donnees-coupees`) ; réponse vide, hors format ou que des valeurs manquantes = erreur claire (jamais 0).
- `transformer.js`, `modules.js` (collection `kv`, document `noyau-modules`), `execution.js` (plans).
- `outils.js` : les 6 outils (modules chargés à la demande par `import()`, rien de plus au démarrage), `OUTILS_VALIDES` à 45 ; `barriere.js` : un résultat qui ne respecte pas son `sortie_schema` est refusé ; `boucle.js` : plans ; `fenetre.js` : accroche `hote.ui.afficherComposant` (seule porte de `afficher_module`).
- `docs/noyau-orchestrateur/donnees-action/` : tâche GitHub **préparée, désactivée** (voir plus bas).
- `labo/essai-sources-donnees.html` : page d'essai réel pour Lucien (3 boutons).

### Plans de 6 étapes
Un seul tour de modèle peut demander jusqu'à **6 outils** (avant : 4 outils par tour, 3 tours). Une étape reprend le résultat d'une étape précédente en écrivant `$N.champ` (ex. `$1.jeu`), valeur entière d'un paramètre, jamais une expression. Chaque étape passe par la barrière comme avant : mêmes niveaux, mêmes confirmations, même journal, plus une ligne « (plan) » dans le journal. Mesuré : lire 2 séries, les comparer, afficher et proposer l'enregistrement = **2 requêtes** au modèle en tout.

### Tâche GitHub pour les sources sans CORS (préparée, NON activée)
`docs/noyau-orchestrateur/donnees-action/` : `donnees.yml` (modèle de workflow, lancement manuel seulement, planification en commentaire), `donnees.py` (normalise au format « jeu », une série en échec garde sa version précédente), `sources-donnees.json` (liste fixe et publique, 2 séries actives, 1 exemple inactif). **Rien n'est dans `.github/`** : GitHub ne la lit pas. Pour l'activer, la Commande, avec l'accord de Lucien : copier les 3 fichiers (`.github/workflows/donnees.yml`, `tools/donnees.py`, `donnees/sources.json`) et décider de la fréquence. Le hub la lit via la source « publie » (`raw.githubusercontent.com/lulu78440/hub/donnees/donnees/<id>.json`). Les données ne sont pas en direct.

## Essais (26/10)
- **36 suites `node labo/essais*.mjs` : toutes au vert.** Nouvelles : `essais-orchestrateur.mjs` (88 vérifications : validateur, cohérence, références, transformations, modules, plans, accord de Lucien), `essais-donnees.mjs` (sources, refus, débit, délai), `essais-donnees-action.mjs` (la tâche Python, hors ligne, relue par le hub), `essais-plan-boucle.mjs` (le vrai cycle de pensée, moteur simulé). Mises à jour : `essais-outils-regle.mjs` (45 outils), `essais-composants.mjs`.
- `python3 tools/tests/run.py charte securite` : **13 réussis, 0 échec** (64 cas).
- Navigateur (Chromium, réseau coupé) : `labo.html` et `index.html` chargent sans erreur ; les 6 outils sont dans le catalogue (45) et passent le contrôle du registre.
- Aucune clé ni secret dans le dépôt (analyse de toute la différence avec `main`). Fichiers modifiés hors `js/noyau/`, `labo/`, `docs/` : aucun.

## Ce qui n'est PAS vérifié (honnêtement)
- **CORS et format réels de DBnomics et de la Banque mondiale** : l'atelier n'y accède pas (proxy 403). Les réponses sont simulées d'après la documentation. Lucien doit ouvrir `labo/essai-sources-donnees.html` dans Brave (PC puis Android) et relever les trois lignes. Si une source échoue, elle bascule sur la tâche GitHub.
- **Melodi (INSEE)** : pas branchée (format non vérifiable d'ici) ; l'INSEE reste accessible via DBnomics.
- **Fenêtre du Noyau** : l'affichage réel d'un module n'a été essayé qu'avec une fenêtre simulée.
- Pas d'essai avec un vrai modèle (Gemini, Claude) : le script de réponses est simulé. La qualité des plans écrits par un vrai modèle reste à observer.

## À faire par la Commande à la fusion (hors de mes fichiers)
1. `sw.js` : ajouter au `PRECACHE` `js/noyau/registre.js`, `jeux.js`, `donnees.js`, `transformer.js`, `modules.js`, `execution.js` (et vérifier `js/noyau/modules/composants.js` déjà présent) ; la version est montée par la Commande.
2. Suivi du Hub et journal de bord (je n'y touche pas dans cette mission).
3. Option : activer la tâche GitHub (voir plus haut).
4. Option : onglet « Outils du Noyau » dans la palette / `labo.html` (fiches de `registre.js`) : `labo.html` et la palette ne sont pas à moi.

## Reste à faire
- Relecture visuelle par Lucien (courbe à deux séries, tableau, chiffre clé dans la vraie fenêtre) et essai Android.
- Lot 4 : délai par outil (`AbortSignal`), file par hôte, un seul nouvel essai sur erreur réseau d'un outil idempotent, validation d'un plan en une fois, plan à confirmations vu en entier.
- Lots 5 et suivants : panneau hôte de la Refonte (`orch-hote`), persistance des espaces de travail, plus de sources.

## Lot 4 · ce qui est construit (26/10, branche `labo-orchestrateur4`, version 7.39.0)
- **Fiabilité** (`js/noyau/fiabilite.js`, `barriere.js`) : délai par outil avec coupure du réseau (`AbortSignal`), file d'attente par hôte (limite par minute, attente annoncée, 20 s au plus), un seul nouvel essai pour une lecture idempotente en erreur de réseau ou de délai. Journal : `cause`, `essais`, `attente_ms`, `plan`.
- **Plans** (`execution.js`) : identifiant de plan sur chaque ligne du journal, étape dépendante d'un échec journalisée comme « non exécutée », bilan chiffré, annulation par signal, étape de secours écrite par le code, `verifierPlan` (références circulaires repérées avant exécution).
- **Panneaux partagés** (`panneaux.js`, `modules/vues-orch.js`) : une plage de temps et 3 genres de variables (colonne, lissage, échelle) commandent tous les panneaux ; badge de fraîcheur sur chaque panneau.
- **Fraîcheur** (`modules/fraicheur.js`) : niveau jugé selon le rythme de la série, forme ET mots, ligne ajoutée au pied de sources de chaque composant ; bandeau « Sources de données » (répond, en échec avec raison, coupée, pas encore appelée).
- **Graphe de plan** (`modules/plan-graphe.js`) : SVG en lecture seule, affiché dans la fenêtre pour tout plan de 2 étapes ou plus.
- Aucun outil nouveau, niveaux inchangés. Détail des choix : `decisions.md`.

## Essais du lot 4
Nouveaux : `essais-fiabilite.mjs` (50), `essais-plans-qualite.mjs` (32), `essais-panneaux.mjs` (110). Bilan complet dans le compte rendu du poste ; vérification visuelle sous Chromium (PC 1100 px et mobile 390 px, sans défilement horizontal de la page).

## Reste à faire après le lot 4
- Essai sur Brave PC et Android : voir les trois vues (`afficherSources()`, `afficherPanneaux(spec)` depuis la console ou le labo, graphe après un vrai plan), seuils de fraîcheur, attente de la file en vrai.
- Aucune entrée de palette ni bouton « Sources » / « Annuler le plan » : à la Refonte (hors de mes fichiers).
- Lots 5 à 9 : modules dynamiques, plus de sources, workflows, persistance.
