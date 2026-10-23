# Hub futuriste — cahier des charges

23 octobre 2026 · Lucien · mis à jour le 23 octobre au soir (feuille de route, IA à 0 €, ligne Mods)

## Vision

Un hub personnel ultra futuriste, ouvert à chaque nouvel onglet sur PC et installé comme une appli sur Android, qui réunit recherche, favoris, veille, agenda, tâches, médias et surprises dans une scène 3D holographique bleu cyan.

Quatre principes guident chaque décision :

- **Futuriste** : la 3D est au cœur de l'expérience, pas un décor ajouté après coup.
- **Personnel** : chaque contenu reflète tes sites, tes thèmes, tes habitudes.
- **Personnalisable** : chaque panneau se déplace, se redimensionne, se masque, sans toucher au code.
- **Durable** : technologies standards et gratuites, code versionné, aucune dépendance à un service payant qui pourrait disparaître.

Objectif lointain : un assistant IA conversationnel au centre, puis un visage holographique animé, comme sur l'image de référence.

## Profil et contraintes

Tu as des bases en code et 7 h par semaine : Claude écrit, teste et publie le code ; toi, tu testes et tu valides chaque étape, sans rien installer.

| Élément | Valeur |
| --- | --- |
| Niveau code | Bases : tu suis des instructions pas à pas |
| Ordinateur | Windows, navigateur Brave |
| Téléphone | Android |
| Temps disponible | 7 h par semaine |
| Budget | 0 € en plus de l'abonnement Claude à 20 €, sans carte bancaire nulle part |
| IA dans le hub | Gratuite, qui tourne directement dans Brave (pas d'API payante) |
| Agendas externes | Aucun pour l'instant, calendrier propre au hub |

Conséquence directe du budget : uniquement des services gratuits sans carte bancaire, et une gestion attentive des limites d'usage de l'abonnement Claude (voir la section sur les IA).

## Direction artistique

L'ambiance est fidèle à l'image de référence : un hologramme bleu cyan sur fond noir profond, avec une 3D spectaculaire (intensité 10/10) sur PC et une version allégée sur Android.

- **Palette** : noir bleuté en fond, cyan lumineux dominant, touches de violet et d'orange ambré pour les accents (comme les halos de l'image).
- **Matières** : panneaux en verre translucide, bordures lumineuses, halos (effet *bloom*), particules flottantes, grilles holographiques.
- **Centre de la scène** : un noyau holographique animé (orbe, anneaux en rotation, constellation de particules) qui réservera la place du futur visage.
- **Mouvement** : la scène réagit à la souris sur PC, à l'inclinaison du téléphone sur Android, avec des transitions fluides à l'ouverture des panneaux.
- **Son** : sons futuristes discrets pour les rappels et les interactions, désactivables.
- **Typographie** : une police techno pour les titres (type Orbitron ou Rajdhani), une police lisible pour le texte.

**Mode PC** : 3D complète, effets lumineux, nombreuses particules, panneaux répartis autour du noyau.

**Mode mobile** : même univers, 3D allégée pour préserver la batterie, panneaux empilés à faire défiler, gros boutons tactiles.

**Référence de construction** : les maquettes `maquettes/noyau-v8.html` (PC) et `maquettes/noyau-v3.html` (mobile, figée), détaillées dans `docs/plan-phase1.md`.

**Mods graphiques** : des habillages complets (couleurs, matières, scène 3D, effets, sons) qui changent l'apparence du hub sans changer ses fonctions. L'habillage actuel s'appelle Hologramme.

## Fonctionnalités

Chaque module est un panneau holographique déplaçable par glisser-déposer ; la phase indique quand il arrive. Le tableau complet des éléments ajoutés en maquette (plans, Mon PC, clic droit, images, entité…) est dans `docs/plan-phase1.md`.

| Module | Ce qu'il fait | Limite honnête | Phase |
| --- | --- | --- | --- |
| Recherche | Brave Search par défaut, bascule vers Google, DuckDuckGo ou YouTube par raccourci (ex. « !y chat ») | Aucune | 1 |
| Horloge et date | Heure animée, lever et coucher du soleil | Aucune | 1 |
| Favoris | Import depuis Brave et Chrome (fichier HTML), classés en groupes | Import manuel une fois, pas de synchro automatique avec le navigateur | 2 |
| Notes | Notes rapides, épinglables | Stockées sur l'appareil jusqu'à la synchro | 2 |
| Tâches | Liste avec priorités et échéances | Idem | 2 |
| Rappels | Alerte avec son futuriste | Ne sonne que si le hub est ouvert ; alerte téléphone fermé en phase 3 | 2 |
| Calendrier | Agenda propre au hub, vues jour, semaine, mois | Lecture d'agendas externes possible plus tard, masquables | 2 |
| Météo | Actuelle et sur 7 jours, ciel 3D assorti | Aucune | 2 |
| Mon PC et bureau du PC | Batterie, réseau, raccourcis Windows, dossiers autorisés, fichiers récents | Fonctions marquées ◇ seulement avec l'appli Windows (V2 PC) | 2 |
| Actualité | Flux Tech et IA, France, Monde, Jeux vidéo, ta ville | Sources à choisir ensemble (flux RSS) | 3 |
| Suivi de sites | Tes sites en ligne ou en panne, nouveaux articles, nouvelles vidéos YouTube | Vérification toutes les 5 à 15 minutes, pas en temps réel | 3 |
| Musique | Radios web, playlists YouTube, tes fichiers MP3 | YouTube Music n'a pas de lecteur intégrable officiel : on passe par le lecteur YouTube | 3 |
| Vidéo | Lecteur YouTube intégré, raccourcis Netflix et Prime | Netflix et Prime s'ouvrent dans leur site, pas dans le hub | 3 |
| Synchronisation | Mêmes données sur PC et Android | Solution gratuite à valider en phase 3 | 3 |
| Surprises | Fonctions originales gardées secrètes | Dévoilées à la livraison | 4 |
| Mails importants | Gmail et Outlook, lecture seule, filtrés par règles | Accès sensible, traité en dernier | 5 |
| Assistant IA | IA de l'orbe, puis entité qui suit la souris et analyse au clic droit | IA gratuite dans Brave : moins puissante, gros téléchargement unique, PC seulement | 6 |

**Personnalisation** : glisser-déposer et redimensionnement de chaque panneau, masquage, et disposition mémorisée séparément pour le mode PC et le mode mobile.

## Choix techniques

Tout repose sur des standards du web et des services gratuits, pour que le hub fonctionne encore dans plusieurs années.

| Besoin | Choix | Pourquoi |
| --- | --- | --- |
| Langage | HTML, CSS, JavaScript purs, sans outil de construction | Standard universel, rien à installer, lisible avec des bases |
| 3D | Three.js avec effets lumineux (*bloom*), copié dans les fichiers du hub | Aucun lien externe qui puisse casser, fonctionne hors ligne |
| Habillage | Thème séparé des fonctions (couleurs, scène 3D, effets, sons) | Permet de brancher les mods en V2 sans réécrire le hub |
| Glisser-déposer des panneaux | Bibliothèque légère, copiée dans les fichiers du hub | Évite de réinventer un mécanisme délicat |
| Appli Android | PWA avec cache hors ligne, installable depuis Brave ou Chrome | Pas de Play Store, pas de frais, marche sans réseau |
| Données | Stockage sur chaque appareil (IndexedDB), export et import en fichier | Gratuit, privé, disponible hors ligne |
| Météo | Open-Meteo | Gratuit, sans clé ni inscription |
| Actualité, YouTube, suivi de sites | Flux RSS, via une tâche programmée Claude ou une solution sans compte, à trancher en phase 3 | Contourne les blocages des navigateurs |
| IA | Modèle gratuit qui tourne dans Brave | 0 €, sans carte bancaire, privé |
| Code | Dépôt GitHub `lulu78440/hub`, public, mis à jour directement par Claude | Historique de chaque version, retour arrière possible |
| Hébergement | GitHub Pages, adresse `lulu78440.github.io/hub` | Gratuit, aucun compte supplémentaire, HTTPS inclus ; exige un dépôt public sur l'offre gratuite |
| Sauvegardes | Trois copies du code et deux des données (voir Sécurité) | Le hub survit à la disparition de n'importe quel service |

**Page d'accueil dans Brave** : le hub sera défini comme page d'accueil ; pour l'afficher aussi à chaque nouvel onglet, on testera le réglage de Brave puis, si besoin, une petite extension maison. À vérifier en phase 1.

**Méthode de travail (zéro installation)** : Claude écrit et teste le code dans son espace en ligne, le dépose sur ton dépôt GitHub, et GitHub Pages met le hub en ligne automatiquement. Ta part se limite à tester, valider, et ranger les copies de sauvegarde.

## Plan de vol

Sept phases, de la coquille 3D jusqu'à l'assistant IA, plus une ligne parallèle pour les mods graphiques. La phase 1 (construction) est la prochaine. Chaque phase est validée sur PC et Android, puis enregistrée comme version stable sur GitHub, avant la suivante.

| Phase | Contenu | Modèle |
| --- | --- | --- |
| 0 · Fondations | Cahier des charges, Projet Claude, GitHub | Opus |
| 1 · Coquille 3D | Conception terminée (maquettes v1 à v8). Construction : scène 3D, bandeau, recherche, trois plans, effets de souris, entité endormie, modes PC et mobile, appli installable | Sonnet |
| 2 · Widgets | Fenêtres, clic droit, favoris, notes, tâches, rappels, agenda, météo, Mon PC, bureau du PC, images | Sonnet |
| 3 · Extérieur | Actus, sites, vidéo, musique, grand écran, synchro PC et Android | Sonnet |
| 4 · Surprises | Fonctions secrètes, visuels IA externes | Opus puis Sonnet |
| 5 · Mails | Gmail et Outlook en lecture seule | Opus puis Sonnet |
| 6 · Assistant IA | IA de l'orbe d'abord, puis entité réveillée, gratuites dans Brave | Opus puis Sonnet |

### Ligne parallèle · Mods graphiques

Les maquettes d'ambiance des mods se font en parallèle des phases, sur des fichiers séparés (`maquettes/mods/`), sans toucher au hub ni à sa construction. Leur construction réelle vient en V2, en habillage branché sur le même code.

| Mod | Direction | Maquette d'ambiance | Construction |
| --- | --- | --- | --- |
| Hologramme | Actuel : hologramme bleu cyan | Fait (v8) | Phase 1 |
| Abyss (ex-Biomécanique) | Sombre, organique, tentaculaire | En cours | V2 |
| Putréfaction | Organique en décomposition, verts maladifs | À faire | V2 |
| Mécanique | Robotique, acier, engrenages | À faire | V2 |
| Esprits des planètes | Fantomatique, céleste | À faire | V2 |

À raison de 7 h par semaine, compte en estimation 3 à 4 semaines pour la phase 1 (effets de la maquette inclus), 2 à 3 semaines pour la phase 2, puis 3 à 4 semaines pour la phase 3. Les phases 4 et 5 dépendront des surprises retenues et de la complexité de l'accès aux mails. Les mods se font quand tu le souhaites, en alternant avec la construction pour ménager ton quota.

Livrable de chaque phase : un hub fonctionnel et testé, jamais une version à moitié cassée.

Les étapes à valider (40 au total, ligne Mods comprise) sont suivies dans le tableau « Suivi du Hub » (https://claude.ai/artifact/55penHsSCPQaYcWNrhn2da), épinglé dans la barre latérale de Claude. Le journal de bord (`maquettes/journal-de-bord.md`) retrace les versions et les décisions.

## V2 : application Android native

La V2 transforme le hub en vraie application Android installée, capable d'utiliser les outils du téléphone, en réutilisant le même code grâce à Capacitor (outil gratuit qui emballe une appli web en appli Android). La V2 apporte aussi les mods graphiques et, côté PC, une appli Windows pour les fonctions que le navigateur ne permet pas (fonctions ◇, écran du PC en direct avec navigation).

**Décision** : tous les accès du tableau ci-dessous sont retenus ; leur ordre de construction sera fixé au début de la V2.

**Conséquence dès la phase 1** : le code est organisé pour être emballé par Capacitor sans réécriture, chaque accès au téléphone passe par un module isolé, et l'habillage est séparé des fonctions.

| Accès au téléphone | Version web (V1) | Appli native (V2) |
| --- | --- | --- |
| Notifications et sons, même appli fermée | Partiel | Oui |
| Vibrations | Oui | Oui |
| Localisation (météo, actu locale) | Oui, avec autorisation | Oui |
| Appareil photo, micro | Oui, avec autorisation | Oui |
| Contacts | Sélection ponctuelle | Lecture complète, avec autorisation |
| Agenda du téléphone | Non | Oui, avec autorisation |
| Fichiers et musique du téléphone | Sélection manuelle | Accès aux dossiers autorisés |
| Lampe torche, capteurs, batterie | Limité | Oui |
| Widget sur l'écran d'accueil Android | Non | Oui, avec un peu de code natif |
| Ouvrir des écrans de réglages (Wi-Fi, Bluetooth, son) | Non | Oui |
| Modifier soi-même ces réglages | Non | Très limité : Android l'interdit à la plupart des applis |

**Limites honnêtes** : Android protège les réglages système, donc le hub pourra souvent ouvrir le bon écran de réglage en un geste, mais rarement changer le réglage à ta place. Chaque accès demandera ton autorisation au premier usage.

**Coût** : 0 €. L'appli s'installe directement sur ton téléphone via un fichier APK ; la publication sur le Play Store (frais d'inscription unique) n'est pas nécessaire.

**Outils à installer en V2** : Android Studio sur ton PC. Conception avec Opus 5.5, construction avec Sonnet 5.5, dans une nouvelle discussion « V2 » du Projet.

## Répartition des IA

Règle d'or : Opus pour décider, Sonnet pour construire, Haiku pour ajuster. Opus consomme ton quota plus vite, on le réserve aux moments qui demandent de la réflexion.

### Quel modèle Claude, à quel moment

| Étape | Modèle | Discussion |
| --- | --- | --- |
| Phase 0 : cadrage, ce document | Opus 5.5 | Discussion de cadrage |
| Phase 1 : conception de la scène 3D (maquettes) | Opus 5.5 | Discussion de conception (terminée) |
| Phase 1 : écriture et intégration du code | Sonnet 5.5 | Nouvelle discussion « Phase 1 · construction » |
| Phases 2 et 3 : widgets, flux, synchro | Sonnet 5.5 | Une nouvelle discussion par phase |
| Mods : maquettes d'ambiance | Opus 5.5 | Une discussion par mod, par exemple « Mods · Abyss » |
| Phase 4 : invention des surprises | Opus 5.5 | Nouvelle discussion « Phase 4 » |
| Phase 4 : construction des surprises | Sonnet 5.5 | Même discussion |
| Phase 5 : sécurité de l'accès aux mails | Opus 5.5 | Nouvelle discussion « Phase 5 » |
| Bug qui résiste après 2 essais avec Sonnet | Opus 5.5 | Même discussion, changement de modèle |
| Retouches : couleur, texte, taille, question rapide | Haiku 5.5 | Discussion de la phase en cours |

### Quand ouvrir une nouvelle discussion

- Au début de chaque phase, toujours dans le Projet « Hub ».
- Quand une discussion dépasse environ 40 échanges, ou que les réponses commencent à oublier des décisions : demande un résumé, puis repars dans une nouvelle discussion avec ce résumé.
- Claude l'annonce explicitement par un message **« STOP : change pour [modèle] / ouvre une nouvelle discussion »** et s'arrête avant d'agir.

### Les autres IA, pour le visuel et le son

Claude ne génère pas d'images ni de sons. Pour aller au maximum sur le visuel, on enrôlera d'autres outils aux moments utiles, en offre gratuite uniquement (offres à vérifier le moment venu) :

- **Générateur d'images IA** : fonds d'écran, textures holographiques, icônes personnalisées (phases 1 et 4, mods).
- **Générateur de sons IA** : sons d'interface et alertes futuristes (phase 2, mods).
- **Banques 3D libres de droits** (licence CC0) : modèles et textures si besoin.
- **Outils d'avatar et de voix IA** : évalués en phase 6 pour le visage holographique.

Claude te fournira les prompts exacts à coller dans ces outils, pour que tout reste cohérent avec la charte.

## Sécurité et prudence

Tes données restent sur tes appareils par défaut ; chaque ouverture vers l'extérieur est décidée explicitement.

- **Aucun secret dans le code** : mots de passe, liens privés d'agenda et accès mail ne sont jamais écrits dans le code ni publiés sur GitHub. Claude signale à chaque fois ce qui doit rester protégé.
- **Dépôt GitHub public, sans rien de personnel** : le code est lisible par tous, mais il ne contient ni données personnelles ni secret ; tes notes, tâches, favoris et réglages restent sur tes appareils, et quelqu'un qui ouvre l'adresse du hub voit un hub vide.
- **Mails en lecture seule** : le hub pourra lire, jamais envoyer ni supprimer.
- **Une phase validée avant la suivante** : test sur PC et sur Android, puis enregistrement d'une version stable sur GitHub.
- **Sauvegarde des données** : export régulier de tes notes, tâches et réglages en fichier.
- **Performance mobile** : si le téléphone chauffe ou que la batterie fond, on allège la 3D avant d'ajouter quoi que ce soit.
- **Pas de bibliothèque obscure** : uniquement des outils populaires et maintenus, pour la durabilité.

### Double cordon de sauvegarde

Le code existe en trois exemplaires et tes données en deux, sans aucun nouveau compte.

| Quoi | Copie 1 | Copie 2 | Copie 3 | Fréquence |
| --- | --- | --- | --- | --- |
| Code du hub | GitHub (historique complet) | Archive .zip dans un dossier « Hub-sauvegardes » sur ton PC | La même archive dans ton Google Drive (compte Gmail existant) | À chaque phase validée, envoyée par Claude |
| Maquettes (hub et mods) | GitHub, dossier `maquettes/` | Projet Claude « hub » | Historique de chaque maquette dans Claude | À chaque version |
| Tes données (notes, tâches, agenda, réglages) | Sur l'appareil (PC et Android) | Fichier d'export du hub, rangé sur ton PC et dans ton Google Drive | — | Rappel automatique du hub chaque dimanche |

Restauration : en cas de perte, l'archive .zip se décompresse et s'ouvre dans Brave, et le fichier d'export se réimporte en un clic dans le hub.
