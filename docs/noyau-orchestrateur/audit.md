# Noyau orchestrateur · étape 1 : audit (lecture seule)

25/10/2026 · poste Labo · Cerveau IA · branche `labo-orchestrateur` (depuis `origin/main`, 7.31.0).
Mission validée par Lucien : faire du Noyau un orchestrateur universel d'outils. Il comprend une demande en langage naturel, choisit les outils, cherche des données réelles, exécute, puis affiche dans le hub un module interactif (graphique zoomable, filtrable, exportable, avec sources et dates), modifiable et enregistrable. Il n'invente jamais un résultat.
Cet audit ne modifie aucun code. Fichiers lus : `docs/noyau-contrat.md`, `docs/noyau-labo.md`, `js/noyau/` (outils, barrière, boucle, routines, raccourcis, socle, worker-ia, perso, hôte, sources, journal, moteurs), `docs/labo-auto/*.md`, `docs/labo-auto2/*.md`, `docs/refonte-auto/etudes-references.md`, `docs/banc-essai/` (B15 sur la CSP), `docs/atelier-auto/moteurs.md` et `js/store/storage.js`.

## 1. Ce que le Noyau sait déjà faire

### 1.1 Outils et registre (`js/noyau/outils.js`)
- **39 outils actifs** : 19 LIBRE et 20 CONFIRMATION, dont les 5 validés le 25/10 et branchés par labo-auto2. Il y a aussi l'outil interne `repondre`.
- Chaque outil a un format neutre : `nom`, `niveau`, `description`, `params` (JSON Schema), `resume(p)` (le texte de la confirmation), `sortie(p)` facultatif (les sites qui reçoivent quelque chose) et `exec(p)`. `moteurs.js` convertit ce format pour Gemini (`functionDeclarations`), Claude (`input_schema`, `tool_choice`) et les relais compatibles OpenAI.
- **La règle « aucun outil sans validation de Lucien » est déjà dans le code.** `OUTILS_VALIDES` donne le nom et le niveau de chaque outil, et `appliquerRegle()` écarte tout outil absent de cette liste ou présenté à un autre niveau. Il n'élève jamais un niveau. `listeOutils()` prépare la liste visible pour le labo.
- **La validation des paramètres est légère** (`validerParams`). Elle contrôle les champs requis, `string`, `integer`, `boolean`, `enum` et `maxLength`. Elle ne contrôle pas `number` (minimum, maximum), `array` (`items`, `maxItems`) ni les objets imbriqués. Plusieurs outils se rattrapent dans leur `exec`, au cas par cas.
- **Les sources réelles existent déjà** : 30 références publiques sans clé, réparties en 15 domaines (`sources.js`). Seuls des mots-clés filtrés sortent : les adresses mail, les numéros et les noms tirés des souvenirs sont retirés. Chaque source a son propre délai et échoue seule. Le domaine `france` ne contient que le **catalogue** de data.gouv.fr : aucune source ne renvoie aujourd'hui des **séries chiffrées**.

### 1.2 Permissions et exécution (`barriere.js`, `journal.js`)
- Il y a trois niveaux. **LIBRE** s'exécute tout de suite et est journalisé. **CONFIRMATION** ouvre la fenêtre du hub. Le refus est la règle par défaut : sans fenêtre, sans réponse en 60 s ou écran verrouillé, rien ne s'exécute. **INTERDIT** n'est jamais présenté au modèle, et un nom inconnu donne `BLOQUÉ_INTERDIT`.
- Les demandes interdites sont détectées dans le texte avant l'appel au modèle (12 familles : suppression, envoi, sécurité, labo, export, ouverture de site, cerveau, code).
- Tout résultat d'outil est **encadré comme une donnée, jamais une instruction** (`encadrer`, `marquerSuspect`). Un paramètre qui vise le laboratoire est refusé.
- Le journal fonctionne en ajout seul (1 000 lignes, collection `kv` chiffrée). Il note le statut, l'origine et les destinations hors de l'appareil.
- **Ce qui manque** :
  - aucun délai imposé à `exec` (un `fetch` qui ne répond pas, dans `lire_page` par exemple, bloque le tour) ;
  - aucune annulation (`AbortSignal`) ;
  - aucun plafond de débit par source ;
  - tout s'exécute en série.

### 1.3 Cycle de pensée (`boucle.js`)
- Les réflexes locaux passent d'abord (interdits, heure, calcul, puis `usages.js` : capture, rappels, briefing, recherche), sans aucune requête. Viennent ensuite le rappel de mémoire, la perception, le modèle et la boucle d'outils.
- Le modèle a **3 appels au plus** et **4 outils par appel** (`MAX_APPELS`, `MAX_OUTILS_PAR_APPEL`). Le tour se termine toujours par `repondre`. Une vérification locale suit : les sources inexistantes sont retirées et la confiance baisse.
- L'inspecteur garde les 30 derniers tours (extraits, appels, outils, réponse).
- Les moteurs sont Gemini (gratuit, actif), Claude (facultatif), un relais gratuit, l'IA locale (WebLLM) et un repli sans modèle qui répond honnêtement avec la mémoire.

### 1.4 Routines et raccourcis (`routines.js`, `raccourcis.js`)
- Une routine, c'est un déclencheur (heure, événement, phrase exacte) et 1 à 5 étapes prises parmi les outils validés. Lucien valide la liste avant le départ, puis **chaque étape garde son niveau**. Tout s'arrête à la première étape refusée ou en erreur, avec une ligne d'historique. Ce moteur fonctionne sans IA.
- **Limite décisive pour les workflows** : les paramètres des étapes sont **figés**. Le résultat d'une étape ne peut pas nourrir la suivante, et il n'existe ni condition ni boucle.

### 1.5 Socle d'IA locale (`socle.js`, `worker-ia.js`)
- Le socle détecte WebGPU, WASM, la présence d'un worker, la mémoire et le mobile, puis choisit un mode prudent : sans IA sur mobile ou avec moins de 4 Go sans WebGPU.
- Le calcul se fait toujours dans un worker. La réponse arrive mot par mot. Un worker muet pendant 2 min est arrêté.
- Le worker ne reçoit que du texte borné et ferme l'accès aux bases du hub. WebLLM 0.2.85 et Transformers.js 3.0.2 sont figés, chargés depuis jsDelivr.
- **L'IA locale ne gère pas les outils** (`texteSeulement`). Elle ne peut pas orchestrer, seulement rédiger un texte.

### 1.6 Personnalisation (`perso.js`) : le bon précédent pour l'interface dynamique
- Le Noyau pose une **couche de réglages déclaratifs** sans réécrire de code. Tout passe par des listes blanches : 8 couleurs du thème, propriétés de fenêtre bornées, couleurs `#rrggbb` seulement, jamais d'URL ni de script. Les fenêtres de sécurité, du Noyau et du labo sont protégées.
- Chaque changement est confirmé, annulable (20 pas) et peut être remis à l'origine.
- **C'est exactement le modèle à suivre pour les modules (D)** : le modèle produit une description en JSON, le hub la vérifie, puis des composants écrits à la main l'affichent.

### 1.7 Hôte, stockage, affichage
- `hote.js` est le seul point de contact avec le hub (stockage, réglages, coffre, actualité, météo, `agir`, interface). Le labo le remplace par un hub simulé. Toute connexion vers un autre site est notée (`reseauJournal`).
- Le stockage a 6 collections (`notes`, `tasks`, `events`, `favs`, `kv`, `images`). `kv` est chiffrée par le coffre, comprise dans l'export et dans la synchro (Gist secret).
- Des graphiques SVG faits main existent **dans le labo seulement** (`labo/ui-labo.js` : `courbe` ; `labo/visuel.js` : `radar`). Les widgets du hub ont chacun leur propre dessin (canvas ou SVG). **Le hub n'a aucune bibliothèque de composants partagée.**
- L'Atelier fournit des moteurs purs (`js/widgets/moteurs/` : budget CSV, enveloppes, garanties…). Ce seront de futurs fournisseurs de données locales (lecture de relevés, par exemple).

## 2. Ce qui manque pour A à E

| Brique | Existe | Manque |
| --- | --- | --- |
| **A · Orchestrateur** (plan, choix d'outils, erreurs) | Boucle d'outils sur 3 tours ; choix laissé au modèle ; erreur rendue au modèle en texte ; réflexes et usages sans IA | Un **plan explicite** (étapes, dépendances, résultat attendu), visible avant une suite d'actions ; une règle d'erreur par outil (nouvel essai unique, source de secours, arrêt propre) ; un **mode sans IA** qui construit le même plan par formulaire ou modèle de demande ; un budget par plan (requêtes et appels réseau annoncés) |
| **B · Registre** | Catalogue JSON Schema, liste blanche nom et niveau, `resume`, `sortie` | Un **schéma de sortie** (résultat structuré, typé) ; des **limites** déclarées (délai, débit, taille) ; des drapeaux du type des *annotations* MCP (`lecture_seule`, `reversible`, `monde_ouvert`, `idempotent`) ; une catégorie ; des exemples ; un validateur complet (`number`, `array`, objets) ; des destinations réseau déclarées à l'avance (pour la CSP) |
| **C · Moteur d'exécution** | Barrière (permission, confirmation, journal), routines en série | Un délai et une annulation sur chaque `exec` ; un **passage de résultats entre étapes** par références (`$etape1.jeu`) ; une file avec plafond de débit par hôte (Melodi : 30 appels par minute en anonyme) ; un journal de plan (une ligne par plan, reliée aux lignes d'outils) ; une reprise après erreur |
| **D · Interfaces dynamiques** | Couche perso (liste blanche), SVG du labo | Une **spécification de module** déclarative et vérifiée ; une **bibliothèque de composants sûrs** (courbe, barres, tableau, chiffre clé, filtres, pied de sources) ; zoom, filtre, export CSV/PNG/JSON par bouton ; une place dans l'interface (fenêtre du Noyau, puis palette ou Outils) |
| **E · Mémoire et persistance** | 5 mémoires, `kv` chiffrée, journaux, mémoire de travail | Des **jeux de données** avec provenance (URL, date de la requête, date de la donnée, licence) et un cache local daté ; des **modules enregistrés** (spécification et références de jeux), avec versions et annulation ; des **sessions** (plan, résultats, module) qu'on peut reprendre ; un contrôle de taille pour la synchro |

## 3. Contraintes qui s'imposent (cahier des charges, Charte, contrat)
1. **0 €, sans carte bancaire, sans serveur, dépôt public** : aucune clé dans le code. Une clé personnelle n'est acceptable que dans le coffre (comme Gemini), et seulement si Lucien le décide. Les tâches GitHub Actions (comme `flux.yml` et `veille.yml`) sont gratuites et sans serveur à gérer, mais ce sont des **configurations** à valider.
2. **CORS** : une page web ne lit que les API qui l'autorisent. Le proxy maison est refusé (`noyau-labo.md`). Une API sans CORS ne peut être lue qu'à l'avance, par GitHub Actions, et publiée en fichier statique.
3. **Tout doit marcher sans IA et sans WebGL** (règle 11, testée par `tools/tests/t7_charte.py`) : chaque module doit pouvoir se créer et s'afficher sans modèle, en SVG ou canvas 2D, jamais avec une dépendance à WebGL. MapLibre et Three.js ne peuvent donc être qu'en option.
4. **Aucune animation qui simule une action** : une jauge ou un graphique ne bouge que si une donnée réelle change, et aucune barre de progression n'est inventée.
5. **Aucun nouvel outil sans validation de Lucien, avec son niveau** (`OUTILS_VALIDES`). « Exporter les données » est **INTERDIT** pour le Noyau : l'export d'un module ne peut être qu'un bouton cliqué par Lucien.
6. **Une nouvelle fonction se lance depuis la palette (Ctrl+K) ou Outils**, pas depuis une nouvelle fenêtre permanente. L'interface (`css/`, `js/ui/`, mise en page d'`index.html`) appartient au poste Refonte. `js/noyau/`, `labo/` et `css/noyau.css` appartiennent au Labo. `sw.js` et `js/version.js` (cache hors ligne, version) se changent à la fusion par la Commande ou le Banc de test.
7. **Une CSP va être ajoutée** (B15) : chaque hôte externe (scripts, `connect-src`, images, polices) doit être listé. Une bibliothèque qui a besoin d'`eval` ou de `new Function` est exclue, ou utilisée en mode interprété.
8. **Brave sur PC et Android** : batterie, mémoire, téléphone sans WebGPU. Le bouclier de Brave peut bloquer des requêtes tierces : chaque source doit être essayée sur Brave.
9. **Jamais de résultat inventé** (principe du contrat) : un chiffre affiché doit venir d'un résultat d'outil de ce tour ou d'un jeu enregistré, avec sa source et sa date.

## 4. Risques

| Risque | Gravité | Parade proposée |
| --- | --- | --- |
| Le modèle **écrit lui-même des chiffres** dans un graphique (invention) | critique | Le modèle ne passe jamais de valeurs, seulement des **références** aux jeux créés par les outils (`jeu:ab12`). Le rendu refuse toute série sans jeu connu. Les chiffres viennent du jeu, pas du texte du modèle |
| Une API n'autorise pas le CORS ou est **bloquée par Brave** | élevée | Essai en direct depuis l'onglet Sources du labo sur Brave avant toute entrée dans la liste ; sinon GitHub Actions (configuration à valider) ou abandon. **Aucun en-tête CORS n'a pu être vérifié depuis l'atelier** : le proxy renvoie 403 pour tous les sites essayés |
| Quota gratuit Gemini (un plan coûte 2 à 4 requêtes) | moyenne | Le plan est calculé par le modèle en 1 requête ; transformations et rendu se font en local ; le mode sans IA suit le même chemin |
| Débit des API (Melodi : 30 par minute en anonyme ; Nominatim : 1 par seconde) | moyenne | File avec plafond par hôte dans le moteur d'exécution ; cache daté |
| Une API **change de format** | moyenne | Chaque adaptateur a sa propre réponse attendue et un essai réel ; une erreur claire « source indisponible », jamais une valeur par défaut |
| Injection par les **libellés** d'un jeu (titre de série piégé) | moyenne | Libellés insérés en `textContent` uniquement, bornés en longueur, encadrés comme données pour le modèle |
| **Taille** des jeux dans `kv` et dans la synchro par Gist | moyenne | Jeux bruts dans un cache local non synchronisé ; seuls la spécification et la provenance se synchronisent ; plafond par jeu (par exemple 5 000 points) |
| Bibliothèque externe lourde ou chargée depuis un CDN | moyenne | Composants SVG faits main par défaut ; bibliothèque facultative copiée dans `vendor/` avec empreinte et licence, jamais en version flottante |
| Le Noyau **s'auto-étend** (crée des outils, du code) | critique | Interdit : un workflow n'est qu'un assemblage d'outils validés ; aucun code généré n'est exécuté ; les composants sont en liste blanche |
| Confusion entre **date de la donnée et date de la requête** | moyenne | Le pied de chaque module affiche les deux, plus l'URL et la licence de la source |
| Le Noyau devient une **fenêtre permanente de plus** | faible | Les modules s'affichent dans la fenêtre du Noyau et se rouvrent depuis la palette ou Outils (Refonte) |

## 5. En une phrase
Le Noyau a déjà une barrière solide, un registre avec liste blanche, 30 sources sans clé, des routines et un précédent d'interface déclarative sûre (`perso.js`). Pour devenir orchestrateur, il lui faut des données **chiffrées et datées** plutôt que des extraits de texte, le **passage de résultats** entre outils, une **spécification de module** affichée par des composants faits main, et la **persistance** des jeux et des modules.
