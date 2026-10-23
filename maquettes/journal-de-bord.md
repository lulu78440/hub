# Journal de bord du Hub

Ce journal suit l'avancée du projet entre deux étapes du « Suivi du Hub ». Les versions de maquette sont des versions de test : rien n'est encore du code final.

## Où on en est

- **Phase en cours** : **phase 2 · widgets**, ouverte le 23/10 dans la discussion « Phase 2 · widgets ». Découpage en 11 sous-étapes validé par Lucien (ci-dessous). **2.1** et **2.2** validées ; **2.3 Coffre de données, notes, tâches** publiée, à tester par toi (« 1 » = validé). **La semaine d'usage du Suivi démarre** dès que tu utilises notes et tâches au quotidien.
- **Code réel** : version stable `v1.0.0` sur `lulu78440.github.io/hub` (phase 1 terminée, sous-étapes 1.1 à 1.7 validées le 23/10, archive `hub-v1.0.0.zip` à ranger sur le PC et dans Google Drive).
- **Maquettes** : v8 figée, référence PC (v4 ★ pour la validation) ; v3 référence mobile.
- **Modèle** : découpage de la phase 2 fait avec Opus ; construction avec Sonnet 5.5. Retour à Opus seulement sur STOP (voir 2.8, ou bug qui résiste après deux essais).
- **Suivi du Hub** : cases de la phase 1 à cocher par toi si ce n'est pas fait : « Scène 3D fluide sur le PC » (au moins 50 img/s), « Barre de recherche fonctionnelle », « Version allégée fluide sur Android », « Page d'accueil », « Installation Android », « Hors ligne », « Archive du code rangée ».

## Historique

| Date | Version | Ce qui a été fait |
| --- | --- | --- |
| 23/10 | v1 | Première maquette : noyau holographique, horloge, recherche, panneaux d'exemple. Jugée « bof » sur PC. |
| 23/10 | v2 | Direction cinématographique : cadres épais, vidéo, actualité défilante, page en direct, densité. |
| 23/10 | v3 | Fenêtres déplaçables, redimensionnables, figeables ; vue globale. Vue mobile figée à partir d'ici. |
| 23/10 | v4 ★ | Vue PC : météo discrète, agenda intégré, panneau Mon PC, bureau du PC en plan 3. Jugée « géniale ». |
| 23/10 | v5 | Vue PC : filaments liés à la souris, effet de force en déplaçant, curseur HUD en plein écran, clic droit, vidéos à suivre sous le lecteur, fenêtre Progression + mods, images libres. |
| 23/10 | v6 | Entité d'énergie en sommeil qui suit la souris (« ? »), traînée longue et lente, clic droit propre à chaque fenêtre, double-clic pour changer de plan, « Plan 3 ». |
| 23/10 | v7 | Plan 2 en mode cinéma, grand écran vidéo et musique, appui long sur l'orbe pour l'énergie de la souris, entité posée sur le logo. |
| 23/10 | v8 | Bouton « Écran en direct » inactif sur le plan 3. Maquette figée, plan de construction de la phase 1 rédigé. |
| 23/10 | Abyss v0 | Ligne parallèle « Mods » ajoutée à la feuille de route. Copie de départ d'Abyss créée depuis la v8 (`maquettes/mods/abyss-v0-base.html`). |
| 24/10 | Abyss v1 | Mod Abyss : méduse géante qui attrape les fenêtres du plan 1, fenêtres en membrane, bulles et rayons de lumière, petite méduse cartoon aux tentacules collants. Onglet « Horreur abyssale » : Cthulhu, fenêtres en chair avec dents, yeux dans le noir, lamproie à lanterne, énergie rouge. Hub et v8 non modifiés. |

## Construction · Phase 1

| Date | Sous-étape | Ce qui a été fait | Statut |
| --- | --- | --- | --- |
| 23/10 | 1.1 Squelette | Arborescence du plan (`index.html`, `css/`, `js/`, `fonts/`, `icons/`), manifeste, icônes (192, 512, maskable, Apple), polices Orbitron / Rajdhani / IBM Plex Mono en local, service worker avec cache versionné `hub-1.1.0`, page de contrôle (version, mode PC / mobile, réseau, hors ligne, installation). Testé en local sous `/hub/` : installation du service worker, rechargement hors ligne, aucune erreur. | Validée par Lucien (23/10) |
| 23/10 | 1.2 Scène 3D PC | Three.js r147 copié dans `vendor/three/` (plus aucun lien externe). Scène reprise de la v8 en modules : `scene/core3d.js` (noyau, anneaux, cadran, constellation, faisceau, sol en grille, colonnes, poussière), `scene/postfx.js` (halo, aberration chromatique, vignette, grain), `scene/loader.js`, `state.js`. Une seule boucle d'animation, arrêtée onglet caché, mouvement réduit respecté, compteur d'images par seconde en bas à gauche. Page de contrôle 1.1 gardée derrière le bouton « Diag » (ou touche D). Service worker v1.2.0. Rendu comparé à la v8 : identique. | Validée par Lucien (23/10) |
| 23/10 | 1.3 Bandeau, horloge, recherche | Bandeau repris de la v8 : logo, horloge à la seconde et date en français, sélecteur Hub / Plan 2 / Plan 3 (Plan 2 et 3 grisés jusqu'à 1.4), bouton Plein écran, place réservée à la météo (phase 2). Recherche : Brave par défaut, `!g` Google, `!d` DuckDuckGo, `!y` YouTube, ouverture dans un nouvel onglet (lien de secours affiché si le navigateur bloque), curseur dans la barre au démarrage sur PC, touche `/` pour y revenir. Service worker v1.3.0. | Validée par Lucien (23/10) |
| 23/10 | 1.4 Plans, cinéma, effets de souris | Plans : molette sur le fond avec calage sur le plan le plus proche, touches 1 2 3 / G / - / +, double-clic sur le fond, sélecteur Hub / Plan 2 / Plan 3, jauge de zoom. Plan 2 en mode cinéma (bandes noires, bascule de caméra, bandeau estompé, recherche floue, bokeh, reflet). Plan 3 vide, avec cadres réservés au bureau du PC (phase 2) et bouton « Écran en direct » inactif. Effets de souris : filaments vers la constellation, charge électrique, longue traînée lente, entité endormie avec son « ? » (clic sur le logo pour la poser ou la reprendre), appui long sur l'orbe pour couper ou relancer l'énergie, curseur HUD automatique en plein écran. Modules `ui/plans.js`, `fx/force.js`, `fx/entity.js`, `fx/cursor.js`, `store/prefs.js`. Service worker v1.4.0. | Validée par Lucien (23/10) |
| 23/10 | 1.5 Mode mobile allégé | Disposition empilée de la v3 : bandeau, horloge, noyau (44 % de la hauteur) qui défile avec la page, recherche, puis les 10 fenêtres dans l'ordre de la v3 (Vidéo, Vidéos à suivre, Météo, Tâches, Agenda, Musique, Notes, Favoris, Veille, Page en direct) sous forme de coques vides « PHASE 2 / PHASE 3 ». 3D allégée (résolution réduite, moins de particules et de colonnes). Inclinaison du téléphone pour la caméra (`device/orientation.js`, sans autorisation sur Android, après un toucher sur iOS), balancement lent sinon. Animation de démarrage « INITIALISATION ». `css/mobile.css` chargé seulement sur mobile. Service worker v1.5.0. | Validée par Lucien (23/10) |
| 23/10 | 1.6 Accueil Brave, installation, hors ligne | Manifeste vérifié par le navigateur de test : aucune erreur d'installabilité (3 icônes, `start_url`, mode autonome). Message « Nouvelle version prête : recharge la page » quand une mise à jour s'installe. Service worker v1.6.0. Consignes de réglage de Brave (page d'accueil et nouvel onglet) et d'installation Android données à Lucien. | Validée par Lucien (23/10) |
| 23/10 | 1.7 Archive et version stable | Constat : un dossier du hub ouvert par double-clic ne marche pas (modules JavaScript bloqués sur fichier local), la promesse du cahier « l'archive s'ouvre dans Brave » était fausse. Ajout de `tools/bundle.py` (tout le hub en un seul fichier `hub-hors-ligne.html`, testé depuis un fichier local : 3D, plans, recherche, mobile) et `tools/make-archive.py` (archive .zip : fichier unique + code complet + mode d'emploi). Service worker v1.7.0. | Terminée : étiquette `v1.0.0` posée, archive `hub-v1.0.0.zip` livrée |

Notes de construction :
- Three.js v0.147.0 (comme les maquettes) est dans `vendor/three/`, pris depuis GitHub (npm est bloqué dans l'espace de travail).
- Les images par seconde n'ont pas pu être mesurées sur une vraie carte graphique (l'espace de travail n'a qu'un rendu logiciel) : la mesure réelle se fait chez Lucien, avec le compteur en bas à gauche.
- Pas de légendes flottantes (Météo, Tâches…) autour du noyau : elles affichaient des données d'exemple et viendront avec les widgets (phase 2).
- Recherche : amélioration par rapport à la v8 : le raccourci doit être suivi d'un espace (`!y chat`). « !yoga » est donc une recherche Brave normale au lieu d'une recherche « oga » sur YouTube.
- Plans : le zoom agit sur un « monde » (le noyau et la recherche) ; les fenêtres de la phase 2 viendront s'y ajouter. Les réglages d'énergie, d'entité et de pose sont mémorisés sur l'appareil (clés `hub-energie`, `hub-entite`, `hub-entite-posee`).
- Mouvement réduit (réglage Windows « animations ») : la scène ralentit, le zoom est immédiat et les effets de souris (traînée, filaments, entité) sont coupés. Le diagnostic affiche « Mouvement réduit : Oui » dans ce cas.
- Non repris de la v8, faute de fenêtres : champ de force autour d'une fenêtre qu'on déplace (phase 2), menu du clic droit (phase 2), grand écran vidéo et musique (phase 3).
- Mobile : les fenêtres sont des coques vides (titre, étiquette de phase, pied) au lieu des données d'exemple de la v3, pour ne pas montrer de fausses données dans le vrai hub. Si tu préfères les contenus d'exemple de la v3, dis-le et je les recopie.
- Mobile : le compteur d'images par seconde reste affiché en bas à gauche pour la mesure (objectif 30 ou plus). Si ça chauffe, on allège (résolution, particules) avant d'ajouter quoi que ce soit.
- Nouvel onglet Brave : réglage natif en deux temps (Apparence : bouton Accueil avec l'adresse du hub, puis « La page Nouvel onglet affiche : Page d'accueil »). Si Brave n'affiche pas le hub ou met le curseur dans la barre d'adresse, plan B : une petite extension maison qui remplace la page Nouvel onglet (non construite, à faire seulement si besoin).
- Restauration : l'archive contient `hub-hors-ligne.html` à ouvrir par double-clic. Régénérer avec `python3 tools/make-archive.py v1.0.0` (le dossier `dist/` n'est pas versionné).
- Le noyau est cadré au centre de l'écran ; les plans (1.4) fourniront leur propre rectangle de cadrage.
- Les maquettes ne sont pas mises en cache hors ligne (elles restent en ligne).
- Pour publier une nouvelle version du code : changer `VERSION` dans `sw.js` et `js/version.js`.

Notes de construction phase 2 :
- Depuis la 2.3, les fenêtres et les widgets démarrent avant la 3D : si WebGL est coupé, le hub reste utilisable (message en bas de l'écran).
- Les données (notes, tâches…) sont propres à chaque appareil jusqu'à la synchro (phase 3). Le fichier d'export permet de les passer de l'un à l'autre (l'import remplace tout).
- Agrandir et réinitialiser se feront aussi par le clic droit en 2.2.

## Construction · Phase 2

Découpage validé par Lucien le 23/10. Références : `maquettes/noyau-v8.html` (PC), `maquettes/noyau-v3.html` (mobile). Ordre choisi : le cadre (fenêtres) d'abord ; notes et tâches tôt, pour que la « semaine d'usage » du Suivi tourne pendant qu'on construit le reste ; l'export arrive avec les premières vraies données.

Ordre de test à chaque sous-étape : 1) push sur `main`, version du service worker montée ; 2) test PC dans Brave (après « Nouvelle version prête » ou Ctrl+F5) ; 3) test Android, au minimum pour vérifier que rien n'a cassé ; 4) « validé » de Lucien, journal mis à jour, sous-étape suivante.

| Date | Sous-étape | Contenu prévu / ce qui a été fait | Étape du Suivi | Statut |
| --- | --- | --- | --- | --- |
| 23/10 | 2.1 Fenêtres PC | Module `ui/windows.js` (coque v8 : punaise, poignée, badge « FIGÉE »). Déplacer par la barre de titre (calage sur 8 px), redimensionner par le coin, figer, agrandir / restaurer par double-clic sur la barre, inclinaison vers le noyau, penche quand on la traîne, champ de force autour de la fenêtre déplacée (`fx/force.js`), halo couleur de la fenêtre survolée sur le noyau. Disposition v8 : Mon PC + Veille à gauche, Vidéo (figée par défaut) + Page en direct + Tâches à droite, Progression en bas au centre, Musique + Favoris + Notes hors champ (plan 2). Le noyau et la recherche se placent entre les deux colonnes. Vue globale (plans 2 et 3) : fenêtres figées en vedette ; mode cinéma : premier plan flouté. Double-clic sur une fenêtre depuis le plan 2 ou 3 : on va à son plan. Disposition mémorisée (`hub-disposition-pc-v1`), bouton « Réinitialiser la disposition » dans Diag. Mobile inchangé (mêmes coques partagées, sans punaise ni poignée). Testé dans un navigateur de test : déplacement, taille, figer, agrandir, mémorisation après rechargement, plans, réinitialisation, mobile, aucune erreur. Service worker v2.1.0. | prépare « Panneaux déplacés » | Validée par Lucien (24/10) |
| 24/10 | 2.2 Clic droit et masquage | Menu du hub `ui/ctxmenu.js` (titres, notes, actions grisées, flèches et Tab au clavier, Échap) et menus `ui/menus.js`. PC : clic droit sur le fond (entité, fenêtres masquées à réafficher, plans 1 2 3, plein écran, curseur HUD forcé, réinitialiser), sur une fenêtre (figer / libérer, agrandir, ramener devant, masquer), sur l'entité ou le logo (poser / reprendre, réveiller : phase 6, masquer), au plan 3 (revenir au hub, plan 2, écran en direct grisé). Maj + clic droit : menu de Brave. Les widgets ajouteront leurs lignes en haut du menu de leur fenêtre (`registerMenu`). Fenêtres masquées mémorisées. Mobile : appui long sur le titre d'une fenêtre (petite vibration, `device/vibrate.js`) → menu en bas d'écran : monter, descendre, tout en haut, masquer. En bas de la page : boutons « + Fenêtre » pour réafficher et « Ordre d'origine ». Ordre et masquage mémorisés (`hub-disposition-mobile-v1`). Testé dans le navigateur de test (PC et téléphone simulé), aucune erreur. Service worker v2.2.0. | prépare « Panneaux déplacés » | Validée par Lucien (24/10) |
| 24/10 | 2.3 Coffre de données, notes, tâches | `store/storage.js` : base IndexedDB « hub » (collections notes, tasks, events, favs, kv), demande de stockage protégé au navigateur, mise à jour entre onglets ouverts (BroadcastChannel), secours en mémoire avec alerte si le navigateur n'enregistre rien. Export / import (`ui/data.js`) : fichier `hub-donnees-AAAA-MM-JJ.json` (toutes les collections + réglages `hub-…`), import avec confirmation et résumé, qui remplace tout. Boutons dans Diag (+ lignes « Données » et « Dernier export ») et dans le clic droit du fond. Notes (`widgets/notes.js`) : ajout par Entrée, clic pour écrire sur place (Ctrl+Entrée ou OK, Échap annule), épingler, copier, supprimer avec « Annuler ». Tâches (`widgets/tasks.js`) : saisie rapide `!` urgent, `@demain`, `@lun`, `@25/10` ; case losange, échéance (auj., dem., en retard en rouge), priorité, modification sur place (texte, date, urgent), jauge, « Effacer les faites », menu du clic droit, Annuler après suppression. Les fenêtres et les widgets ne dépendent plus de la 3D (WebGL coupé = hub utilisable). Fenêtre Tâches plus haute par défaut. Testé : ajout, modification, rechargement, 2 onglets, export puis import sur un appareil vierge, téléphone simulé, fichier hors ligne. Service worker v2.3.0. | démarre « Notes, tâches, calendrier une semaine » | À tester par Lucien |
| — | 2.4 Agenda | Bande du jour sur PC (repère « maintenant », prochain événement). Fenêtre agenda, vues jour, semaine, mois. Ajout, modification, suppression. | idem | À faire |
| — | 2.5 Rappels et son | Rappel sur tâche ou événement, alerte dans le hub, notification Brave si autorisée, rattrapage des rappels manqués à l'ouverture. Son futuriste synthétisé dans le code, désactivable (remplaçable plus tard par un son d'IA). Limite : hub ouvert. | « Rappel reçu avec le son futuriste » | À faire |
| — | 2.6 Météo | Open-Meteo, localisation automatique (autorisation demandée, via `js/device/`). Bandeau discret, survol 7 jours, lever et coucher du soleil, °C ou °F, cache hors ligne, fenêtre Météo mobile. Légendes flottantes autour du noyau avec vraies données. Teinte légère de la scène selon le ciel. | « Météo exacte pour ta ville » | À faire |
| — | 2.7 Favoris | Import du fichier HTML exporté par Brave et Chrome, groupes, ajout et retrait, icônes hexagonales. | « Favoris importés » | À faire |
| — | 2.8 Mon PC et plan 3 | Batterie, réseau, écran réels. Liens vers les réglages Windows. Dossiers autorisés et fichiers récents. Barre d'applis ✓ / ◇ (◇ inactifs jusqu'à l'appli Windows). ⚠ À vérifier : Brave désactive peut-être par défaut l'accès aux dossiers depuis une page web → STOP Opus possible pour choisir la voie. | — | À faire |
| — | 2.9 Images libres et Progression | 12 images max (glisser, coller, hologramme, opacité, devant / derrière, mémorisées). Fenêtre Progression qui lit un fichier de suivi dans le dépôt, aperçus des mods. | — | À faire |
| — | 2.10 Sauvegarde des données | Export et import complets avec confirmation, rappel de sauvegarde du dimanche dans le hub. | « Export puis import testé », « Rappel du dimanche reçu » | À faire |
| — | 2.11 Recette et v2.0.0 | Test complet PC et Android (50 img/s PC, 30 Android, hors ligne), étiquette `v2.0.0`, archive .zip. | « Panneaux déplacés, disposition mémorisée PC et mobile » ; clôture de la semaine d'usage | À faire |

## Décisions prises

- **Vue mobile** : on n'y touche plus jusqu'à nouvel ordre (état de la v3). Exception accordée le 23/10 (phase 2) : masquer et réordonner les fenêtres par appui long, pour la disposition mémorisée sur mobile.
- **Trois plans sur PC** : 1 = hub, 2 = notes et applis, 3 = bureau du PC.
- **Sauvegarde** : chaque version est rangée sur GitHub (`maquettes/`), dans le Projet et dans l'historique de la maquette. Rien n'est écrasé.
- **IA à 0 €, sans carte bancaire** : l'entité utilisera un petit modèle d'IA qui tourne directement dans Brave, sur le PC (gratuit, privé, moins puissant, gros téléchargement unique, pas sur téléphone). Pas d'API payante.
- **Ordre de la phase 6** : d'abord une IA reliée à l'orbe principale, ensuite l'entité.
- **Mods graphiques** : refontes visuelles fortes sans changer les fonctions. Maquettes en parallèle (ligne Mods, fichiers dans `maquettes/mods/`), construction en V2. Mods : Hologramme (actif), Abyss (ex-Biomécanique, renommé le 23/10), Putréfaction, Mécanique, Esprits des planètes.
- **Habillage séparé des fonctions** dans le code dès la phase 1, pour pouvoir brancher les mods sans réécriture.
- **Phase 2 · fenêtres de la phase 3** (Vidéo, Musique, Veille, Page en direct) : coques vides « PHASE 3 » sur PC, à leur place de la v8 (23/10).
- **Phase 2 · son des rappels** : son synthétisé dans le code d'abord, remplaçable plus tard par un son créé avec une IA de sons (23/10).
- **Phase 2 · météo** : localisation automatique, avec l'autorisation du navigateur (23/10).

## À trancher plus tard

- **IA de l'orbe** : avec la règle 0 €, une API payante est exclue. Options à étudier en phase 6 : le même type de modèle local (plus gros), ou une offre gratuite sans carte bancaire si elle existe à ce moment-là.
- **Onglet « Nos projets »** à gauche, avec Mon PC : Suivi, journal, cahier des charges et maquettes lus depuis GitHub, liens vers le Projet Claude.
- **Appli Windows** pour les fonctions marquées ◇ (processeur, volume direct, lancement de programmes, Corbeille) et pour l'écran du PC en direct avec navigation. Une page web peut seulement afficher une vue en direct (avec l'accord de Brave), sans pouvoir cliquer dedans.
- **Accès aux dossiers du PC dans Brave** (sous-étape 2.8) : vérifier si Brave le bloque par défaut ; sinon choisir entre réglage `brave://flags`, choix manuel des fichiers, ou report à l'appli Windows.
- **Cahier des charges** : les ajouts des maquettes sont repris dans `docs/plan-phase1.md` (tableau des phases), qui fait foi en cas de doute.
- **Liaison automatique** entre la fenêtre Progression et le Suivi du Hub : pour l'instant c'est un relevé, mis à jour à chaque nouvelle version.
