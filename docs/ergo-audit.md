# Refonte · ergonomie — audit de l'existant (ergo-audit)

25 octobre 2026 · poste Refonte · version auditée : **7.15.0** (branche de sauvegarde `version-7.14.0`, posée sur l'état actuel de `main`).
Méthode : lecture du code (`index.html`, `css/`, `js/ui/`, `js/widgets/`, `js/noyau/`) et captures réelles du hub dans un navigateur de test (PC 1600×900, téléphone 400 px). Aucun fichier du hub modifié.
Fréquence probable : **Q** = plusieurs fois par jour · **H** = chaque semaine · **R** = rare (réglage, dépannage) · **?** = à confirmer par Lucien.

## 1. En chiffres

| Élément | Nombre |
| --- | --- |
| Fenêtres | 18 déclarées : 5 au plan 1 (PC), 10 au plan 2, 3 réservées au mobile ; 3 fenêtres d'IA (Noyau, Sécurité, Savoir) rangées hors champ, sous le plan 2 |
| Éléments permanents hors fenêtres (PC) | barre du haut (12 éléments), bande d'agenda, recherche + 5 raccourcis affichés, bandeau d'actualité, 3 légendes autour du noyau, compteur img/s, jauge de zoom |
| Entrées de menu clic droit | environ 150, dans 20 menus ; le menu du fond seul en compte jusqu'à 27 |
| Panneau Diag | 14 lignes d'état, 14 boutons, 3 blocs de réglages (synchro, verrouillage, surprises : 9 réglages) |
| Raccourcis clavier | une trentaine (D, 1 2 3, G, + −, /, Alt+V, Espace maintenue, code ↑↑↓↓…) |
| Effets visuels | une vingtaine ; **13 ne se coupent pas** |
| Longueur de la page mobile | environ 7 200 px (une vingtaine d'écrans à faire défiler) |

## 2. Barre du haut (PC)

| Élément | Utilité | Fréquence | Remarque |
| --- | --- | --- | --- |
| Logo (poser / reprendre l'entité) | ludique | R | action cachée dans le logo |
| « HUB » + « Phase 7 · radar » | décor | — | sous-titre périmé, texte figé dans index.html |
| Mini barre de progression + panneau de résumé | suivi du projet | H | outil de chantier, pas d'usage quotidien ; doublon de la fenêtre Progression |
| 5 vignettes des modes graphiques | aperçu des mods | R | doublon de la fenêtre Progression ; mods prévus en V2 |
| Compteur « img/s » (sous le logo) | mesure | R | toujours affiché, PC et mobile, rien pour le masquer |
| Horloge, secondes, date | utile | Q | — |
| Météo (icône, température, libellé ; fiche au survol) | utile | Q | doublon de la légende Météo autour du noyau |
| Boutons Hub / Plan 2 / Plan 3 | navigation | Q | doublon de la molette, des touches 1 2 3, du double-clic et du menu du fond |
| Plein écran | confort | R | aussi dans le menu du fond et F11 |
| 🎙 Parler (vue vocale du Noyau) | IA vocale | ? | ajouté par le Noyau ; Brave bloque la dictée |
| Labo | laboratoire du Noyau | R | outil de développement, dans la barre principale |
| Diag | réglages et état | R | le vrai « panneau de réglages » du hub, sous un nom technique |

## 3. Fenêtres

| Fenêtre | Plan PC (mobile : rang) | Contenu | Utilité | Fréquence | Doublons, remarques |
| --- | --- | --- | --- | --- | --- |
| Mon PC | 1, gauche | batterie, réseau, 8 raccourcis Windows, 3 fichiers récents | moyenne | ? | tout est repris, en plus grand, au plan 3 ; grande fenêtre souvent vide (« Touche 3 : ajoute un dossier ») |
| Veille | 1, gauche | sites en ligne / en panne, derniers articles | moyenne | H | vide tant qu'aucun site n'est ajouté ; texte « toutes les 10 min » puis « 20 min » |
| Vidéo (figée) | 1, droite | lecteur YouTube, coller un lien, vidéos à suivre, raccourcis YouTube / Netflix / Prime | forte | ? | — |
| Page en direct | 1, droite | une page web dans une fenêtre | faible | ? | beaucoup de sites refusent l'affichage ; occupe une place du plan 1 |
| Tâches | 1, droite | saisie rapide, liste, jauge | forte | Q | légende « n à faire » autour du noyau |
| Musique | 2 | radios, playlist YouTube, MP3, volume, grand écran | forte | ? | — |
| Favoris | 2 | recherche, groupes, icônes, import | forte | Q ? | au plan 2, alors que c'est un usage d'ouverture d'onglet |
| Rituels | 2 | anneaux d'habitudes, météo intérieure, grille 8 semaines | moyenne | ? | anneaux aussi autour du noyau ; « Météo intérieure » prête à confusion avec la Météo |
| Progression | 2 | barres par phase, mods | chantier | H | triple : mini barre, panneau de résumé, fenêtre |
| Notes | 2 | saisie, cartes épinglables | forte | Q ? | — |
| Mails | 2 | Gmail / Outlook en lecture seule | future | — | non configurée : n'affiche que des boutons de configuration |
| Radar des dates | 2 | radar animé, 90 jours de dates, anniversaires | moyenne | H | grande fenêtre (440 px de haut) pour une liste de dates |
| Noyau | 2, très bas (mobile : tout en haut) | chat, à valider, journal, mémoire, réglages | forte | ? | hors champ même au plan 2 sur un écran de 900 px ; s'ouvre par l'appui long sur l'orbe |
| Sécurité | 2, hors champ | vue d'ensemble, activité, code, correctifs | faible au quotidien | R | sur mobile, 2e fenêtre de la page ; ses alertes arrivent aussi dans le fil du Noyau |
| Savoir | 2, hors champ | carte 3D du savoir du Noyau | faible au quotidien | R | sur mobile, 3e fenêtre de la page |
| Météo | mobile seulement | température, soleil, 7 jours | forte | Q | sur PC : barre du haut |
| Agenda | mobile seulement | calendrier jour / semaine / mois | forte | Q | sur PC : bande d'agenda + tiroir |
| Vidéos à suivre | mobile seulement | vignettes | moyenne | ? | copie du bloc de la fenêtre Vidéo |

## 4. Autres éléments affichés

| Élément | Utilité | Fréquence | Remarque |
| --- | --- | --- | --- |
| Bande d'agenda (08 h → 20 h) + tiroir calendrier | forte | Q | la bande occupe toute la largeur même un jour vide (« Rien aujourd'hui ») |
| Recherche + 5 raccourcis affichés (!g !d !y !v /) | forte | Q | les raccourcis restent affichés en permanence ; !i et !n existent mais ne sont pas affichés |
| Bandeau d'actualité défilant | moyenne | Q | défile en continu ; affiche « En attente des premiers titres » sans flux |
| Légendes autour du noyau (Météo, Tâches, Agenda) | faible | — | répètent la barre du haut, la fenêtre Tâches et la bande d'agenda |
| Briefing du matin | forte | Q | une fois par jour ; contient « Pense à exporter (Diag) », déjà rappelé par la sauvegarde du dimanche et par le Noyau |
| Chat IA (clic sur l'orbe) | forte | ? | **doublon de la fenêtre Noyau** : même cerveau, affichage plus pauvre |
| Vue vocale (🎙 Parler) | ? | ? | troisième entrée vers le même Noyau |
| Alertes et toasts | utile | — | beaucoup de toasts pour de petites actions (punaise, masquage…) |
| Jauge de zoom « PLAN n · x % » | faible | — | répète la position déjà marquée par les boutons de plan |
| Plan 3 · bureau du PC | moyenne | ? | dossiers, fichiers récents, système, réglages rapides, applis (dont 5 marquées ◇ inactives), « Écran en direct · bientôt » inactif |
| Images libres | ludique | ? | 12 au maximum |

## 5. Menus du clic droit

- **Menu du fond : jusqu'à 27 lignes** : image, Focus 25 / 50, briefing, Chat IA, crépuscule, Ouvrir le Noyau, la sécurité, la carte du savoir, capture rapide, vue vocale, entité, fenêtres masquées, 3 plans, plein écran, curseur HUD, réinitialiser la disposition, son des rappels, tester un rappel, exporter, importer, importer le Coffre. Les usages quotidiens y sont mêlés aux réglages et au dépannage.
- **Menu de fenêtre** : 6 lignes communes, plus 3 lignes d'IA dont **deux font presque la même chose** (« Demander à l'entité » répond dans le Chat IA, « Résumer avec le Noyau » répond dans le Noyau) et « Focus 25 min sur cette fenêtre ». À ne pas confondre avec « Ramener vers moi », qui est un autre « focus ».
- **Menu de l'entité** : texte périmé (« Son IA sera branchée en phase 6 », « La réveiller : pas encore »).
- **Plan 3** : « Écran en direct · bientôt » toujours grisé.
- **Mobile** : l'appui long sur un titre de fenêtre est le seul accès aux menus ; aucun équivalent du menu du fond (briefing, Focus, export…).

## 6. Panneau Diag

Il mélange trois natures :
- **État technique (14 lignes)** : version, mode, réseau, service worker, hors ligne, affichage, mouvement réduit, inclinaison, données, dernier export, son, notifications, synchro, verrouillage. Utile en dépannage seulement (R).
- **Réglages** : synchro (jeton, phrase), verrouillage (phrase, clé de secours, délai), surprises (micro de recherche, briefing, constellation, Focus, Hyperespace, lune, Chat IA, crépuscule). Utiles une fois (R).
- **Actions** : installer, synchro (×3), tester un rappel, son, notifications, exporter, importer, importer le Coffre, tester le rappel du dimanche, réinitialiser la disposition, mises à jour, vider le cache. Exporter (H), les autres (R).

Six actions sont **en double** avec le menu du fond : son des rappels, tester un rappel, exporter, importer, importer le Coffre, réinitialiser la disposition ; le crépuscule aussi.

## 7. Noyau et IA (fichiers du poste Labo : constats seulement)

- **Trois entrées vers le même cerveau** : Chat IA (clic sur l'orbe), fenêtre Noyau (appui long 0,6 s sur l'orbe), vue vocale (🎙 Parler). Le moteur se choisit à deux endroits (engrenage du Chat IA, Noyau → Réglages) et la clé Gemini ne se colle que dans le Chat IA.
- **L'appui long sur l'orbe déclenche deux choses** : à 0,6 s il ouvre le Noyau, à 0,9 s il coupe l'énergie des effets de souris.
- **Messages spontanés** dans le fil du Noyau : accueil du jour, recommandation système toutes les 30 min, revue du soir, curiosité, sauvegarde automatique (toast toutes les 30 min), rapport de veille.
- **Onglets** en bas dans le Noyau, en haut dans Sécurité. Réglages du Noyau sur une seule page très longue (7 cases, 6 sections).
- La fenêtre du Noyau est sous la responsabilité du poste Labo : la Refonte peut proposer sa place et son mode d'ouverture, pas son contenu.

## 8. Effets visuels

| Effet | Peut-on le couper ? |
| --- | --- |
| Scène 3D (noyau, anneaux, faisceau, grilles, 140 colonnes, 180 points de constellation, 2 800 poussières) | non |
| Post-traitement : halo, aberration chromatique, vignette, grain | non |
| Lignes de balayage sur tout l'écran (aussi sur mobile) | non |
| Teinte du ciel selon la météo | non |
| Plan 2 cinéma : bandes noires, flous haut et bas, sol, bascule de caméra | non |
| Inclinaison des fenêtres vers le noyau, voile flou de « Ramener vers moi » | non |
| Balayage du radar | non |
| Particules, traînée et filaments de la souris | appui long sur l'orbe ; tout s'arrête avec « mouvement réduit » de Windows |
| Entité | clic droit |
| Curseur HUD (automatique en plein écran) | clic droit, non mémorisé |
| Anneaux des rituels, teinte d'humeur | clic droit sur Rituels |
| Mode crépuscule | Diag ou clic droit |
| Surprises : briefing, constellation, Focus, Hyperespace, lune | Diag → Surprises |

Mesure chez Lucien à refaire après allègement ; dans le navigateur de test (rendu logiciel), environ 20 img/s.

## 9. Doublons à traiter (synthèse)

1. **Progression** ×3 : mini barre + panneau de résumé + fenêtre ; vignettes des mods ×2.
2. **Météo** ×3 sur PC : barre du haut, légende autour du noyau, ciel teinté ; choix de la ville à deux endroits.
3. **Agenda** : bande + tiroir + légende ; rendez-vous aussi dans le briefing et le radar.
4. **Tâches** : fenêtre + légende ; échéances aussi dans l'agenda, le radar et le briefing.
5. **Mon PC** (plan 1) et **bureau du PC** (plan 3) : mêmes batterie, réseau, raccourcis, fichiers récents.
6. **IA** : Chat IA, fenêtre Noyau, vue vocale ; « Demander à l'entité » et « Résumer avec le Noyau ».
7. **Réglages** : Diag et menu du fond (son, rappel test, export, import, Coffre, disposition, crépuscule).
8. **Navigation** : boutons de plan, molette, 1 2 3, G, double-clic, menu du fond, jauge de zoom.
9. **Vidéos à suivre** : bloc de la fenêtre Vidéo et fenêtre mobile.
10. **Mots** : « Focus » (minuteur) et « Ramener vers moi » (`.focus` dans le code) ; « Veille » (sites) et l'étiquette « VEILLE » de Sécurité ; « Météo intérieure » et Météo.

## 10. Textes périmés et anomalies relevés

- Étiquettes de fenêtres « PHASE 2 / PHASE 3 » et textes « Cette fenêtre se remplira… » dans index.html (visibles une seconde au chargement, ou si un module ne démarre pas).
- Sous-titre « Phase 7 · radar » ; menu de l'entité « phase 6 » ; menu du plan 3 « sous-étape 2.8 ».
- **Bug** : « Verrouiller maintenant » n'apparaît jamais au clic droit du fond (le module des images remplace le menu du fond au lieu de le compléter : `js/widgets/images.js:124`, `registerMenu` au lieu d'`extendMenu`). À corriger pendant ergo-fusion (fichier widget : correction d'une ligne, notée au journal).
- **Bug (poste Labo)** : le rapport du matin de la veille d'étude ne s'affiche pas (`js/noyau/noyau.js:217`, `cycle` au lieu de `noyau.cycle`). Signalé, non corrigé ici.
- Mobile : Noyau, Sécurité et Savoir n'ont pas de rang défini, ils passent donc en tête de page, avant Vidéo et Tâches.
- PC : Sécurité et Savoir restent hors de l'écran même au plan 2.

## 11. Réponses de Lucien (25/10)

| Question | Réponse |
| --- | --- |
| Utilisé au moins chaque semaine | Agenda (bande + calendrier), Favoris, Notes ; Vidéo, Musique, Page en direct, bandeau d'actualité ; Mon PC + plan 3 ; Chat IA (clic sur l'orbe), fenêtre Noyau (appui long), vue vocale (🎙 Parler) |
| Non utilisé | Tâches, Veille, Radar des dates, Rituels, Sécurité, Savoir |
| Que faire des non-utilisés | **Les retirer de l'appli, mais garder leur code** pour un ajout futur (rien n'est effacé, ni le code ni les données) |
| Barre du haut, à garder en vue | mini barre de progression, vignettes des mods, bouton Labo (le compteur img/s peut sortir de la vue) |
| Surprises gardées actives | toutes : briefing du matin, Focus, Hyperespace, constellation + pleine lune |
| Effets visuels | **ne pas toucher au fond ni à l'orbe** : la refonte porte sur les fenêtres, les applications internes et les menus |

Conséquences à trancher dans ergo-plan :
- Sans fenêtre Tâches, la constellation des tâches accomplies (gardée) n'a plus de source ; les échéances et rappels de tâches disparaissent aussi de l'agenda, du briefing et de la légende.
- Sécurité et Savoir sont des fenêtres du Noyau (poste Labo) : la Refonte peut les retirer de la mise en page du hub ; elles resteraient accessibles depuis le Labo.
