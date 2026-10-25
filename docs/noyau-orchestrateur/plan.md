# Noyau orchestrateur · plan (étapes 1 et 2 : audit et conception)

25/10/2026 · poste Labo · Cerveau IA · branche `labo-orchestrateur`. À lire après `audit.md`.
Les lots suivent l'ordre fixé par Lucien. **Rien n'est codé ici.** Chaque lot attend le feu vert de Lucien, et chaque nouvel outil attend sa validation avec son niveau.
Les licences et tailles marquées « mémoire » viennent de ma connaissance : le registre npm et les CDN sont bloqués depuis l'atelier. Elles sont à relire dans les dépôts et à mesurer au moment de la copie dans `vendor/`. **Le CORS de chaque source est « à vérifier »** : depuis l'atelier, tous les sites répondent 403 par le proxy, donc rien n'a pu être contrôlé.

## Principes de conception (valent pour tous les lots)
1. **Le modèle propose, le hub dispose** (contrat, principe 1). Le modèle produit un **plan** et une **spécification de module** en JSON. Le hub les vérifie, puis exécute et affiche avec du code écrit à la main. Aucun code généré n'est exécuté (ni `eval`, ni `new Function`, ni HTML injecté).
2. **Aucun chiffre ne vient du modèle.** Un outil de données renvoie un **jeu** (`jeu:<id>`) : valeurs, unité, source, URL, date de la requête, date ou période de la donnée, licence. Le modèle ne manipule que des références à ces jeux. Le rendu refuse une série qui ne renvoie pas à un jeu existant.
3. **Sans IA, même chemin.** Plan et spécification se remplissent aussi par formulaire (palette, puis « Nouveau module ») ou par modèle de demande. Le modèle n'est qu'un moyen plus rapide de les remplir.
4. **Autonomie graduée, alignée sur les niveaux existants.** Lire et afficher un module éphémère : LIBRE. Enregistrer ou modifier : CONFIRMATION. Supprimer, exporter, envoyer, dépenser : jamais par le Noyau (INTERDIT, bouton de Lucien seulement).
5. **Références : s'inspirer et réécrire.** MIT et Apache-2.0 peuvent être repris avec leur avis de copyright. AGPL et GPL : étude de principe seulement.

## Ce que je retiens des références

| Référence | Licence | Ce qu'on en retient (réécrit) |
| --- | --- | --- |
| MCP, function calling | spécification ouverte (mémoire) | Le format d'outil `inputSchema` / `outputSchema` / `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) : on l'adopte dans le registre et on le relie aux niveaux. **Brancher un vrai serveur MCP est impossible sans serveur** : stdio est impossible dans un navigateur, et un MCP distant demande CORS et le plus souvent une authentification |
| Vega-Lite | BSD-3 (mémoire) | La **grammaire déclarative** (données → transformation → marque → encodage) : notre spécification de module en est une version réduite. La bibliothèque elle-même n'est pas retenue : environ 1 Mo, et une compilation d'expressions incompatible avec une CSP stricte sans mode interprété |
| ECharts | Apache-2.0 (mémoire) | `dataZoom` (zoom par glissière), légende qui filtre, boîte d'outils d'export : on reprend ces gestes. Bibliothèque facultative du lot 6 si le SVG maison ne suffit plus |
| Grafana | AGPL (principe) | Panneau = requête + transformation + visualisation ; **plage de temps** et **variables** partagées par un tableau de bord ; « dernière mise à jour » affichée |
| Kepler.gl | MIT | La configuration de carte en JSON exportable, séparée des données |
| MapLibre | BSD-3 (mémoire) | Option seulement, **elle demande WebGL**. Le repli obligatoire est un tableau des lieux, ou une carte SVG simple |
| React Flow, Langflow | MIT | Les nœuds à entrées et sorties typées pour **afficher** un plan (graphe d'étapes). Rendu en SVG maison : le hub n'utilise pas React |
| Home Assistant (frontend) | Apache-2.0 | Le registre d'entités et de services, les **cartes déclaratives** (type + options) en liste blanche |
| Homarr, Dashy, DaedalOS | Apache-2.0, MIT, MIT | Le registre de widgets décrit par configuration, la grille, le menu contextuel unique |
| Homepage | GPL (principe) | Des widgets de service configurés par fichier |
| World Monitor | AGPL (principe) | Des couches de données superposées, avec la fraîcheur de chaque source bien visible |
| Theatre.js, Three.js | Apache-2.0 hors studio, MIT | Non retenus pour les graphiques (aucun besoin de 3D ; règles sans WebGL et sans animation qui simule une action) |

## Lot 1 · Audit
- **Contenu** : `docs/noyau-orchestrateur/audit.md` (fait, présent sur cette branche).
- **Propriétaire** : Labo. **Fichiers** : `docs/noyau-orchestrateur/`. **Essais** : aucun. **Risques** : CORS non vérifié depuis l'atelier.

## Lot 2 · Composants réutilisables (conception détaillée ici, code au feu vert)
- **Contenu** : une petite bibliothèque de **composants d'affichage sûrs**, sans IA, sans WebGL et sans réseau. Chacun prend des données déjà vérifiées et rend du DOM ou du SVG avec `createElement`, `createElementNS` et `textContent` uniquement. Elle part des fonctions `courbe` et `radar` du labo, déplacées et généralisées.

| Composant | Rôle | Interactions (geste de Lucien, rien d'automatique) |
| --- | --- | --- |
| `Courbe` | une ou plusieurs séries dans le temps | zoom par glissière ou sélection, remise à zéro, info-bulle au survol et au toucher, légende qui masque une série |
| `Barres` | comparaison de catégories (verticale ou horizontale) | tri, filtre des catégories, info-bulle |
| `Tableau` | les données brutes, toujours disponibles (repli universel, accessibilité) | tri par colonne, filtre texte, pagination |
| `ChiffreCle` | une valeur, sa variation et sa période | aucune |
| `Filtres` | période, catégories, unités (pilotent les autres composants du module) | listes et curseurs, au clavier |
| `PiedSources` | **obligatoire** dans chaque module : source, lien, licence, date de la donnée, date de la requête, « non vérifié » si besoin | ouvrir la source (lien en `rel="noopener noreferrer"`, clic de Lucien seulement) |
| `Exporter` | CSV, JSON (données et provenance) et PNG (SVG converti par canvas 2D) | **bouton cliqué par Lucien uniquement** ; aucun outil du Noyau ne l'appelle |
| `EtatVide` et `Erreur` | « aucune donnée », « source indisponible (raison) » | réessayer (geste) |
| `Plan` | les étapes d'un plan et leur statut réel (en attente, fait, refusé, erreur) | aucune ; jamais d'animation qui simule un avancement |

- **Règles de rendu** : couleurs prises dans les variables du thème (`--cyan`, `--violet`…) ; respect de `prefers-reduced-motion` ; contraste d'au moins 4,5:1 pour les textes (le banc a déjà un test de contraste) ; navigation au clavier ; affichage correct sur mobile (360 px) ; au plus 5 000 points par série, avec agrégation au-delà, annoncée.
- **Fichiers proposés** : `js/noyau/modules/composants.js` (nouveau, Labo) et styles dans `css/noyau.css` (Labo, selon le contrat). Ils s'affichent **dans la fenêtre du Noyau** au départ, donc sans nouvelle fenêtre. **Refonte** : relecture visuelle et accord sur les variables de thème. **Commande** : `sw.js` et version à la fusion.
- **Outils nouveaux** : aucun.
- **Bibliothèque** : SVG maison (0 Ko externe, aucune source à ajouter à la CSP).
- **Essais** : `labo/essais-composants.mjs` (DOM simulé : aucun `innerHTML`, libellé piégé rendu en texte, 0 série, 1 point, 5 001 points, valeurs manquantes, dates invalides) ; aperçu dans `labo.html` ; test du banc sans IA ni WebGL (règle 11) ; mesure du temps de rendu sur Android.
- **Risques** : un zoom fait main moins fluide qu'ECharts sur de grosses séries, d'où le plafond et l'agrégation ; et le travail pour qu'un PNG reste lisible en thème sombre.

## Lot 3 · Registre central d'outils (B)
- **Contenu** : enrichir le format d'outil **sans changer les niveaux ni les noms** :
  - `sortie_schema` : le résultat structuré attendu, vérifié après `exec`, avec une erreur claire s'il ne correspond pas ;
  - `limites` : `{ delai_ms, max_par_minute, taille_max }` ;
  - `drapeaux` : `{ lecture_seule, reversible, monde_ouvert, idempotent }`, inspirés des annotations MCP. **Contrôle de cohérence** : `lecture_seule: false` impose CONFIRMATION au minimum, et `reversible: false` impose INTERDIT pour le Noyau ;
  - `hotes` : liste des domaines contactés, pour générer la liste `connect-src` de la future CSP ;
  - `categorie`, `exemples`.
- **Validateur complet** : `number` (minimum, maximum), `array` (`items`, `maxItems`), objets imbriqués, `pattern`. Il reste maison : environ 80 lignes, aucune dépendance.
- `listeOutils()` affichée dans un onglet du labo, et une commande « Outils du Noyau » dans la palette pour lire (Refonte, plus tard).
- **Fichiers** : `js/noyau/outils.js`, `js/noyau/registre.js` (nouveau : validateur et contrôles de cohérence), `labo/` (onglet). **Propriétaire** : Labo.
- **Outils nouveaux** : aucun. La liste `OUTILS_VALIDES` reste la seule porte d'entrée.
- **Essais** : chaque outil existant passe le contrôle de cohérence ; paramètres hors bornes refusés ; sortie non conforme refusée ; `essais-outils-regle.mjs` et `essais-outils-branches.mjs` toujours au vert.
- **Risques** : un outil existant qui ne déclare pas encore ses `hotes` (le dernier point est à combler avant la CSP) ; ne jamais laisser les drapeaux **assouplir** un niveau validé (ils ne peuvent que le durcir).

## Lot 4 · Connexion au moteur d'exécution (C)
- **Contenu** :
  1. Dans la barrière, `exec` reçoit un `AbortSignal` et un **délai** tiré de `limites`. Le délai expiré est journalisé `ERREUR` avec sa cause.
  2. Une **file par hôte** fait respecter `max_par_minute` (Melodi 30, Nominatim 60) : attente annoncée, jamais de contournement.
  3. Un **plan** : `{ id, but, etapes: [{ id, outil, params, depend_de }] }`, 6 étapes au plus. Les paramètres peuvent contenir des références `{"$ref":"e1.jeu"}`, résolues par le moteur après l'étape e1. Ce sont des chemins simples, jamais des expressions.
  4. **Règles d'erreur** : un seul nouvel essai pour une erreur réseau ou un délai dépassé d'un outil `idempotent` ; une source de secours si le plan en prévoit une ; sinon arrêt propre, et les étapes déjà faites restent visibles.
  5. **Validation** : un plan qui ne contient que des étapes LIBRE part tout de suite. S'il contient au moins une CONFIRMATION, Lucien voit le plan entier une fois (comme pour les routines), puis chaque étape CONFIRMATION redemande son accord.
  6. **Journal de plan** : une ligne par plan dans `kv/noyau-journal` avec l'identifiant de plan, reliée aux lignes d'outils.
- **Fichiers** : `js/noyau/barriere.js`, `js/noyau/execution.js` (nouveau), `js/noyau/boucle.js`, `js/noyau/routines.js` (réutiliser le même moteur pour que les routines profitent du passage de résultats). **Propriétaire** : Labo.
- **Outils nouveaux** : aucun. Le plan n'est pas un outil, c'est une façon d'enchaîner des outils validés.
- **Essais** : un outil qui ne répond pas est coupé au délai ; une annulation en cours de route ; 31 appels à Melodi en 1 minute, dont le 31e attend ; une référence vers une étape inconnue est refusée ; une référence circulaire est refusée ; un plan avec CONFIRMATION sans fenêtre ne fait rien ; les essais de sécurité existants (page piégée, interdits) restent au vert.
- **Risques** : la complexité de la barrière, cœur de la sécurité, d'où des essais de non-régression obligatoires ; la latence cumulée sur mobile.

## Lot 5 · Modules dynamiques (D)
- **Contenu** : la **spécification de module** (version 1), vérifiée par un validateur strict, et son affichage par les composants du lot 2.
  ```json
  { "v": 1, "titre": "Population de la France", "jeux": ["jeu:ab12"],
    "transformations": [{ "op": "filtrer", "champ": "annee", "min": 2000 }],
    "vues": [{ "type": "courbe", "x": "annee", "y": "valeur", "series": "geo" }, { "type": "tableau" }],
    "filtres": [{ "champ": "geo", "type": "liste" }] }
  ```
- **Listes blanches** : types de vue (`courbe`, `barres`, `tableau`, `chiffre_cle`), opérations (`filtrer`, `trier`, `agreger` somme, moyenne, min, max, `variation` en pourcentage, `garder_colonnes`, `limiter`), champs existants dans le jeu uniquement. Les textes sont bornés, sans URL ni balise. **Le pied de sources est ajouté d'office**, sans possibilité de le retirer.
- **Modifiable** : « change en barres », « garde 2010-2024 », « ajoute la Belgique » produisent une nouvelle spécification, montrée en différence puis appliquée, annulable comme `perso.js`. Sans IA, un panneau « Modifier » sert de formulaire.
- **Où** : dans la fenêtre du Noyau, sous la réponse. Les modules enregistrés se rouvrent par la palette (« Modules ») ou par Outils, ce qui demande une ligne côté **Refonte** (`js/ui/outils.js`), à valider avec elle.
- **Fichiers** : `js/noyau/modules/spec.js`, `js/noyau/modules/transformer.js`, `js/noyau/modules/rendu.js` (nouveaux, Labo), `js/noyau/fenetre.js`, `css/noyau.css` (Labo), `js/ui/outils.js` (Refonte).
- **Outils nouveaux proposés** :

| Outil | Niveau proposé | Pourquoi |
| --- | --- | --- |
| `afficher_module` (spécification) | LIBRE | Affiche un module **éphémère** dans la fenêtre du Noyau : rien n'est écrit, tout disparaît à la fermeture. Même logique que `afficher` |
| `transformer_donnees` (jeu, opérations) | LIBRE | Calcul local en liste blanche sur un jeu existant ; produit un nouveau jeu dérivé qui garde la provenance de l'original |

- **Essais** : spécification avec un champ inconnu, un type inconnu, une URL dans le titre ou une série sans jeu, toutes refusées avec la raison ; une transformation qui garde la provenance ; un module affiché identique avec ou sans IA (formulaire).
- **Risques** : une spécification trop riche qui pousse le modèle à se tromper (garder la version 1 petite) ; la place dans la fenêtre du Noyau sur mobile.

## Lot 6 · Graphiques et tableaux
- **Contenu** : finition des composants (zoom au doigt, info-bulle au toucher, axes temporels jour, mois, trimestre ou année, échelle logarithmique, double axe interdit pour éviter les graphiques trompeurs), tableau accessible, export CSV, JSON et PNG.
- **Choix de bibliothèque (à valider par Lucien)** :

| Option | Licence | Taille (mémoire, à mesurer) | Sans WebGL | CSP | Avis |
| --- | --- | --- | --- | --- | --- |
| **SVG maison** (lot 2) | la nôtre | ~15 à 25 Ko de code | oui | rien à ajouter | **Proposé par défaut** |
| uPlot | MIT | ~50 Ko minifié (~22 Ko compressé) | oui (canvas 2D) | `vendor/`, rien à ajouter | **Option** pour les longues séries (plus de 5 000 points) |
| ECharts (version réduite : ligne, barres, dataZoom) | Apache-2.0 | ~400 Ko minifié (complet ~1 Mo) | oui (canvas ou SVG) | `vendor/`, sans `eval` (à vérifier) | Plus tard si les besoins dépassent le maison |
| Chart.js | MIT | ~200 Ko minifié | oui | `vendor/` | Zoom par greffon séparé, pas d'avantage net |
| Vega-Lite + Vega | BSD-3 | ~1 Mo et plus | oui | demande `unsafe-eval`, sauf interprète | Non retenu |
| MapLibre | BSD-3 | ~800 Ko et plus, plus les tuiles | **non** | tuiles externes à lister | Option cartographique, avec repli en tableau |

  Toute bibliothèque retenue est **copiée dans `vendor/`** (version exacte, licence, empreinte SHA-256), comme three.js, et chargée à la demande. La copie se fait depuis le PC de Lucien ou une session qui a accès au registre npm.
- **Fichiers** : `js/noyau/modules/composants.js`, `vendor/<bibliothèque>/` en option. **Propriétaire** : Labo, et Commande pour `vendor/` et `sw.js`.
- **Outils nouveaux** : aucun.
- **Essais** : rendu identique PC et mobile ; export CSV relu et comparé au jeu ; PNG en thème clair et sombre ; contraste ; temps de rendu pour 5 000 points sur Android.
- **Risques** : poids sur mobile si une bibliothèque est ajoutée ; une info-bulle au toucher mal gérée sur Android.

## Lot 7 · Sources de données réelles
- **Contenu** : des **adaptateurs de séries** dans une liste fixe et publique (comme `sources.js`), qui renvoient chacun un jeu normalisé `{ colonnes, lignes, unite, source, url, licence, date_requete, periode }`. Chaque source passe le contrôle en direct dans l'onglet Sources du labo **sur Brave PC et Android** avant d'entrer.
- **Sources envisagées, sans clé** (CORS **non vérifié**, à confirmer une par une) :

| Source | Données | Accès (selon leur documentation) | Remarque |
| --- | --- | --- | --- |
| INSEE · API Melodi (`api.insee.fr/melodi/`) | séries et données locales de l'INSEE | anonyme, 30 appels par minute ; compte facultatif | **Source phare de la demande.** CORS inconnu : sinon passer par GitHub Actions ou DBnomics |
| DBnomics (`api.db.nomics.world`) | copie d'INSEE (BDM), Eurostat, BCE, OCDE, FMI… | libre, sans clé | Bon secours pour l'INSEE si Melodi refuse le CORS |
| Eurostat (API de diffusion, JSON-stat) | statistiques européennes | libre, sans clé | |
| Banque mondiale (`api.worldbank.org/v2`) | indicateurs par pays | libre, sans clé | |
| geo.api.gouv.fr | communes, population légale, codes | libre | Utile pour relier un nom de commune à son code INSEE |
| tabular-api.data.gouv.fr | lignes des CSV publiés sur data.gouv.fr | libre | Complète `datagouv` (aujourd'hui catalogue seulement) |
| Open-Meteo (prévisions et archives) | météo, historique | libre, usage non commercial | Déjà utilisé par le hub |
| Hub'Eau, ODRE (éCO2mix) | eau, électricité | libre | |
| BCE (`data-api.ecb.europa.eu`) | taux de change | libre | CORS incertain |

- **Outils nouveaux proposés** :

| Outil | Niveau proposé | Pourquoi |
| --- | --- | --- |
| `chercher_donnees` (requête, sources) | LIBRE | Cherche des **jeux** (catalogues Melodi, DBnomics, Eurostat…). Seuls des mots-clés filtrés sortent, comme `chercher_sources` |
| `lire_serie` (source, identifiant, période, filtres) | LIBRE | Télécharge **une série précise** et renvoie un jeu daté avec sa provenance. Lecture seule, hôtes de la liste fixe seulement |

- **Ce qui demande une configuration, une API ou un serveur** :
  - une source **sans CORS** : GitHub Actions `donnees.yml`, sur le modèle de `flux.yml`, qui télécharge une liste fixe de séries et les publie en JSON sur une branche `donnees`. C'est gratuit et sans clé, mais **les données ne sont pas en direct** (fréquence fixe) et la liste est publique. **Configuration à valider par Lucien** ;
  - **INSEE Sirene** et les autres API à jeton : il faudrait un compte et une clé personnelle dans le coffre. Non proposé par défaut (contraire à « sans compte ») ;
  - aucune source **payante**, aucun proxy maison (refusé par le contrat).
- **Fichiers** : `js/noyau/donnees.js` (nouveau, Labo), `labo/essais-donnees.mjs`, onglet Sources du labo ; `.github/workflows/donnees.yml` et `tools/donnees.py` seulement si Lucien les valide (Commande).
- **CSP** : chaque hôte ajouté est listé dans `connect-src` grâce au champ `hotes` du registre (lot 3).
- **Essais** : essai réel par source sur Brave (statut, temps, forme de la réponse) ; réponse vide ; réponse au format inattendu, qui donne une erreur claire et jamais de zéro par défaut ; plafond de débit ; source coupée par Lucien dans les réglages.
- **Risques** : CORS ou bouclier Brave ; changement de format ; licences des données (afficher la licence ; la Licence Ouverte Etalab est la plus fréquente) ; volumes (pagination plafonnée).

## Lot 8 · Workflows multi-outils
- **Contenu** : la demande en langage naturel devient un **plan** (lot 4). Par exemple « Compare la population de Versailles et de Rennes depuis 2000 » donne la suite `chercher_donnees`, puis `lire_serie` ×2, puis `transformer_donnees`, puis `afficher_module`.
  - Avec IA, le modèle produit le plan en 1 requête. Le moteur l'exécute sans revenir au modèle, sauf en cas d'erreur, où il fait une requête au plus pour corriger.
  - Sans IA, des **modèles de plan** paramétrables se lancent depuis la palette (« série INSEE », « comparer deux communes », « météo passée d'une ville »).
  - Le plan s'affiche avec le composant `Plan` (statuts réels).
  - **À valider** : un mode plan à 6 étapes, au lieu des 3 appels au modèle et 4 outils par appel d'aujourd'hui, avec un budget annoncé avant exécution (requêtes au modèle, appels réseau).
- **Fichiers** : `js/noyau/boucle.js`, `js/noyau/execution.js`, `js/noyau/plans-modeles.js` (nouveau), `js/noyau/routines.js` (une routine peut contenir un plan, avec les mêmes garde-fous). **Propriétaire** : Labo ; une entrée de palette par la Refonte.
- **Outils nouveaux** : aucun de plus que ceux des lots 5 et 7.
- **Essais** (banc mécanique, moteur simulé, sans quota) : 10 demandes types qui donnent le plan attendu ; une source en panne donne la source de secours ou un arrêt propre ; aucun chiffre dans la réponse texte qui ne figure pas dans un jeu (**contrôle automatique « jamais inventé »**) ; des essais réels sur Gemini, limités et annoncés.
- **Risques** : plans faux du modèle sur Flash-Lite (à mesurer, hypothèse 1 du cahier du labo) ; coût en quota ; confusion entre commune et département (désambiguïsation par geo.api.gouv.fr).

## Lot 9 · Persistance et sessions (E)
- **Contenu** :
  - **Jeux** : un cache local **non synchronisé** (IndexedDB à part, comme les vecteurs de `sens.js`), avec date de la requête et durée de fraîcheur par source. Dans `kv` (chiffrée, synchronisée), seulement la **provenance** et l'adresse de la requête, ce qui permet de **recharger** le jeu à la demande au lieu de recopier les données.
  - **Modules enregistrés** : `kv/noyau-module-<id>` contient la spécification, les références de jeux, les versions (10 dernières) et la date. 50 modules au plus. **Pas de suppression par le Noyau** : bouton de Lucien seulement, avec sauvegarde avant.
  - **Sessions** : `kv/noyau-session-<id>` contient la demande, le plan, les statuts, les jeux et le module. On peut les reprendre (« reprends le graphique d'hier ») ; seules les 30 dernières sont gardées.
  - Un module rouvert affiche « données du … » et propose « Actualiser » (geste de Lucien, ou action LIBRE si la source est en lecture seule).
- **Outils nouveaux proposés** :

| Outil | Niveau proposé | Pourquoi |
| --- | --- | --- |
| `enregistrer_module` (spécification, titre) | CONFIRMATION | Écriture dans les données de Lucien (règle du hub : toute écriture est confirmée). Annulable : version précédente gardée |
| `lire_modules` (recherche) | LIBRE | Lister et rouvrir les modules et sessions enregistrés |
| (export d'un module) | **pas d'outil** | « Exporter les données » est INTERDIT pour le Noyau : bouton `Exporter` cliqué par Lucien |
| (suppression d'un module) | **pas d'outil** | INTERDIT pour le Noyau : bouton de Lucien seulement |

- **Fichiers** : `js/noyau/modules/stockage.js` (nouveau, Labo) ; `js/store/` inchangé (utilisation de `kv`). Une liste « Modules » dans la palette ou Outils (Refonte). La fusion des journaux existe déjà (`js/store/fusion.js`).
- **Essais** : enregistrer, rouvrir, modifier, annuler ; taille synchronisée bornée (la spécification seule) ; export du hub qui contient les modules ; import ; deux appareils qui modifient le même module (dernière version gardée, l'autre en version précédente).
- **Risques** : quota de stockage sur mobile ; synchro Gist trop volumineuse si des jeux y entrent par erreur (essai dédié) ; données périmées affichées comme actuelles (date toujours visible).

## Lot 10 · Tests
- **Banc mécanique** (`labo/essais*.mjs`, moteur simulé, 0 requête) : registre (cohérence, validateur), moteur d'exécution (délai, annulation, débit, références), spécification (refus), transformations (exactitude des calculs comparée à des valeurs calculées à la main), rendu (aucun `innerHTML`, libellés piégés), plans (10 demandes types), **« jamais inventé »** (tout nombre affiché ou écrit doit exister dans un jeu).
- **Banc du hub** (`tools/tests/`, poste Banc de test) : règle 11 (module créé et affiché sans IA ni WebGL, PC et téléphone simulé), sécurité (page ou jeu piégé, export non appelable par le Noyau), contraste, hors ligne (module enregistré qui s'affiche avec ses données du cache et la date).
- **Essais réels avec Lucien** : chaque source sur Brave PC et Android ; trois demandes réelles (« population de ma commune depuis 1990 », « inflation en France sur 10 ans », « température moyenne à Rennes l'an dernier ») ; la future CSP. GitHub Pages ne permet pas de poser d'en-têtes, et le mode « rapport seul » n'existe pas en `<meta>`. Elle s'essaie donc en `<meta http-equiv="Content-Security-Policy">` sur une copie locale (double-clic) ou dans le banc, en regardant la console de Brave, avant toute mise sur `main`.
- **Propriétaires** : Labo (`labo/`), Banc de test (`tools/tests/`).

## Récapitulatif des outils proposés (aucun n'est actif, tous attendent Lucien)

| Outil | Niveau | Lot |
| --- | --- | --- |
| `afficher_module` | LIBRE | 5 |
| `transformer_donnees` | LIBRE | 5 |
| `chercher_donnees` | LIBRE | 7 |
| `lire_serie` | LIBRE | 7 |
| `lire_modules` | LIBRE | 9 |
| `enregistrer_module` | CONFIRMATION | 9 |
| export, suppression de module | pas d'outil (bouton de Lucien) | 6, 9 |

## Ce qui demande une API, un serveur ou une configuration
- **Aucun serveur** n'est nécessaire pour les lots 2 à 6, 8, 9 et 10.
- **Lot 7** : les sources sans CORS demandent une tâche GitHub Actions (configuration, données en différé) ; les API à jeton (Sirene) demandent un compte et une clé personnelle dans le coffre (non proposé). MCP réel : impossible sans serveur, on n'en garde que le format.
- **Bibliothèques facultatives** (uPlot, ECharts, MapLibre) : copie dans `vendor/` depuis un poste qui a accès au registre npm.
- **CSP** : la liste des hôtes est produite par le registre (lot 3), puis essayée sur Brave avant d'être activée.

## Faisabilité honnête dans un navigateur sans serveur
- **Faisable** : comprendre la demande (Gemini gratuit, ou formulaire sans IA), enchaîner les outils, lire des API ouvertes **qui autorisent le CORS**, transformer en local, afficher des graphiques interactifs en SVG, exporter par bouton, enregistrer et synchroniser des modules.
- **Faisable avec réserve** : les sources sans CORS (seulement en différé, par GitHub Actions) ; les gros jeux (plafonnés et agrégés) ; l'orchestration avec l'IA locale (elle ne gère pas les outils : texte seulement, donc sans IA locale on passe par les modèles de plan).
- **Non faisable sans serveur** : lire en direct une API qui refuse le CORS, garder une clé secrète partagée, exécuter des plans quand le hub est fermé (sauf tâche GitHub programmée sur une liste fixe et publique).
