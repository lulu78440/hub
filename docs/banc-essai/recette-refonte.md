# Banc de test · recette finale de la refonte (étape ergo-recette)

Faite le 26/10/2026 sur `main` à jour, version **7.35.0** (b774e1e), branche `banc-recette`. Poste « Banc de test ». Aucun fichier de `js/`, `css/` ni `index.html` modifié. Rien fusionné. Aucune clé, aucun appel vers un service IA (réseau extérieur bloqué par le banc ; 0 requête vers Groq, Mistral, OpenRouter, Gemini ou Claude).

Limite à garder en tête : Chromium sans carte graphique (3D coupée, message « La 3D (WebGL) est désactivée » attendu dans les captures) ; Brave et Android réels non disponibles ici.

## 1. Résultats automatiques

| Lot | Résultat |
| --- | --- |
| `python3 tools/tests/run.py` | **57 réussis, 0 échec, 2 026 cas, 593 s** (contrastes : plan 1 = 31 textes, plan 2 = 30 textes, 0 sous AA) |
| `node labo/essais*.mjs` (33 fichiers) | tous « Tout est bon » ; `essais.mjs` : 44 réussis, 0 raté, 15 sautés (moteur réel requis) sur 59 |
| `node tools/tests/atelier/tout.mjs` | « Tous les moteurs de l'Atelier : Tout est bon » (11 fichiers) |
| Déroulé de la recette `docs/banc-essai/recette/recette.py` | **55 OK, 3 à corriger, sur 58 points** (détail ci-dessous) ; relançable, résultats bruts dans `recette/resultats.json` |

## 2. Recette point par point

Légende : OK · à corriger · non vérifiable ici. Captures dans `docs/banc-essai/recette/`.

| Zone | Point | Statut | Détail |
| --- | --- | --- | --- |
| PC 1440x900 | Version 7.35.0 affichée, mode PC | OK | |
| PC | Plan 1 : exactement Favoris, Notes, Vidéo, Musique ; orbe et recherche au centre | OK | `pc-plan1.png` |
| PC | Plan 2 (salle) : Page en direct, Mon PC, Noyau (Progression y est aussi) | OK | `pc-plan2-salle.png`, `pc-plan2-droite.png` ; rotation de la tête testée par flèche droite |
| PC | Plan 3 : bureau, icônes Fichiers, Ce PC, Internet, Mails | OK | `pc-plan3-bureau.png` |
| PC | Boutons Hub / Plan 2 / Plan 3, touches 1-2-3 | OK | `aria-pressed` correct |
| PC | Molette sur le fond : plan 1 → 2 et retour | OK | |
| PC | Tâches, Veille, Radar, Rituels, Sécurité, Savoir, Mails en réserve par défaut | OK | |
| PC | Barre du haut : Hub, Plan 2, Plan 3, Outils, Parler, Labo ; jauge de zoom retirée | OK | |
| PC | Menu du fond : 4 lignes (image, Focus, briefing, Outils…), aucune navigation | OK | `pc-menu-fond.png` |
| PC | Menu de fenêtre : 8 lignes, Réduire, Personnaliser…, Plus… | OK | `pc-menu-fenetre.png` |
| PC | Outils : bouton, touche O, Échap ferme, touche D ouvre Réglages et diagnostic | OK | 10 groupes, 39 tuiles ; `pc-outils.png` |
| Fenêtres | Clic sur le nom : réduite à son nom (447 px → 30 px) ; second clic : rouverte à sa taille | OK | `pc-fenetre-reduite.png` |
| Fenêtres | Glisser le nom déplace sans réduire | OK | seuil de 6 px respecté |
| Fenêtres | Personnaliser… ouvre le panneau de la tuile | OK | `pc-personnaliser.png` (styles et effets non rejoués un par un) |
| Plan 3 | L'icône ouvre la fenêtre ; « réduire » l'envoie vers son icône ; l'icône la rouvre ; clic sur le titre la réduit à son nom | OK | `pc-plan3-fenetre.png` |
| Plan 3 | **Lasso du bureau** | non vérifiable ici | pas construit : étape `p3-lasso` du Suivi non cochée, aucune trace dans `js/` ni `css/` |
| Plan 3 | Écran du PC en direct, commandes pour l'orbe, plan 3 sur téléphone, catalogue Steam | non vérifiable ici | étapes `p3-direct`, `p3-ia`, `p3-mobile`, `p3-jeux` non construites (bouton « Écran en direct · bientôt » seulement) |
| Contraste | Plans 1 et 2 : 0 texte sous AA | OK | 26 textes mesurés par plan dans le déroulé, 31 et 30 dans la suite |
| Contraste | Plan 3 : « ● Écran en direct · bientôt » | **à corriger (mineur)** | voir A1 |
| Contraste | Textes sur fond dégradé ou image | non vérifiable ici | non mesurables par le banc (règle déjà notée) |
| Console | Aucune erreur console : PC (3 plans, Outils, fenêtres, Noyau), mobile, hors ligne | OK | |
| CSP | Aucune violation `securitypolicyviolation` : PC, mobile, hors ligne | OK | YouTube, radios, IA locale réelles : voir §5 |
| Dispositions | `?pc`, `?mobile`, `?auto` sur un écran 1440 et sur un téléphone 390 : la disposition forcée est gardée au rechargement, `?auto` la retire | OK | |
| Hors ligne | Après premier chargement et service worker actif : rechargement hors ligne, données lues, plans fonctionnels, aucune erreur ni violation | OK | message de mise à jour du service worker déjà couvert par la suite (`t2`) |
| Noyau | Réglages → « IA de secours en ligne (Groq, OpenRouter, Mistral) » : ordre de secours (Sans IA en dernier), 3 champs de clé masqués, Mistral, OpenRouter et Groq désactivés par défaut, « Colle d'abord la clé. » si champ vide | OK | `pc-noyau-reglages.png` ; aucune clé saisie |
| Noyau | Bascule réelle vers une IA de secours | non vérifiable ici | demande une vraie clé et un vrai service |
| Mobile 390x844 | Mode téléphone, pas de défilement horizontal | OK | `mobile-haut.png`, `mobile-milieu.png` |
| Mobile | Toucher le titre réduit la fenêtre (la page raccourcit), second toucher la rouvre | OK | |
| Mobile | Feuille Outils collée en bas, se ferme | OK | `mobile-outils.png` |
| Mobile | Masquer les 7 fonctions rares par la feuille Outils : 7 599 px → 3 871 px, 9 fenêtres | OK | proche des 3 500 px du plan |
| Mobile | Hauteur de page **par défaut** (visée : environ 3 500 px) | **à corriger / à décider** | voir A2 |
| Mobile | Menu d'appui long | **à corriger (mineur)** | voir A3 |
| Mobile | Contrastes | OK | seulement 3 textes mesurables sur la première vue |
| Fond et orbe | Scène 3D, halo, orbe inchangés (règle 1) | non vérifiable ici | pas de carte graphique ; à regarder sur Brave |
| Images par seconde | Déplacement à 60 img/s, salle immersive | non vérifiable ici | rendu logiciel |

## 3. Anomalies

**A1 · mineur · Plan 3, bouton « ● Écran en direct · bientôt » illisible.** Contraste mesuré entre 1,9:1 et 2,6:1 (texte de 11 px, seuil 4,5:1). C'est un bouton volontairement éteint (`aria-disabled`), mais l'étiquette qui annonce l'état reste illisible.
Reproduire : `?pc`, touche 3, mesurer `#live-btn`. Correction proposée : texte plus clair (opacité du texte au moins 0,7) en gardant le contour atténué.

**A2 · à décider · Mobile : la liste de fenêtres du plan n'est pas appliquée par défaut.** Le plan (§1) vise Météo, Agenda, Notes, Favoris, Vidéo, Musique, Noyau, Page en direct, environ 3 500 px. Sur un téléphone neuf, 16 fenêtres sont visibles, 7 599 px de haut, et Noyau, Sécurité, Savoir restent en tête (Notes est la 12e). `js/ui/reserve.js` : `inReserve` renvoie faux sur téléphone (« jamais sur téléphone », décision de l'étape ergo-mobile, qui laisse le masquage au choix dans Outils). Masqués à la main par la feuille Outils, on obtient 3 871 px et les 9 fenêtres attendues.
Reproduire : appareil neuf, `?mobile`, compter les fenêtres et `document.documentElement.scrollHeight`. Décision de Lucien : garder le choix manuel, ou appliquer la réserve par défaut sur téléphone et remettre l'ordre du plan.

**A3 · mineur · Mobile : menu d'appui long différent du plan (§5).** Lignes obtenues : Ramener vers moi, Réduire à son nom, Monter, Descendre, Tout en haut, Masquer la fenêtre, Fermer. Le plan annonce : Personnaliser… présent (§9 : « appui long sur téléphone »), « Tout en haut » dans Plus…, « Fermer » supprimé. Les tuiles Personnaliser n'ont donc pas d'entrée sur téléphone, et le menu fait 7 lignes sans « Plus… ».
Reproduire : mobile, appui long (550 ms) sur le titre de Notes. Correction : `js/ui/menus.js` (`mobMenu`).

Aucune autre anomalie : aucune erreur console, aucune violation CSP, aucune perte de données, aucune fenêtre perdue (celles en réserve sont dans Outils → Fonctions en réserve).

**Écart de la suite d'origine, sans effet sur le hub** : `t2_fonctions.py`, test hors ligne, attend le service worker par une condition inversée (`if p.evaluate(...)` au lieu de `if not`), ce qui passe parce qu'un rechargement suit. Non modifié (les tests de `tools/tests/` ne font pas partie de ma mission ici).

## 4. Rejoué et non rejoué

- Rejoué : tous les points de la demande sauf ceux notés « non vérifiable ici ».
- Dispositions enregistrées avant la refonte (reprise sans perte de `disposition-pc-v3`) et tuiles de la fenêtre Outils vs lignes de menu : le plan du 25/10 prévoyait deux tests à écrire ; non écrits ici (la suite d'origine n'a pas de test dédié). Le déroulé vérifie seulement que les 10 groupes d'Outils sont là et que « Fonctions en réserve » est joignable.

## 5. À essayer par Lucien (environ 20 min), Brave PC puis Android

Brave PC (écran réel, 3D allumée)
1. Ouvrir le hub, accepter « Nouvelle version prête » (7.35.0) ; vérifier que les fenêtres sont à leur place et que le fond 3D et l'orbe sont comme avant (règle 1).
2. Plan 1 : Favoris, Notes à gauche, Vidéo, Musique à droite. Cliquer un nom de fenêtre (réduit), recliquer (rouvre) ; glisser un nom (déplace, ne réduit pas).
3. Plan 2 en salle : tourner la tête (souris au bord, flèches, Maj + molette), touche 2 ou double-clic pour revenir de face ; le sol miroir, la brume, la fluidité (si ça saccade : réglage « Salle allégée »). Maintenir le clic sur une fenêtre et tourner la molette : elle change de plan.
4. Touche O (Outils), touche D (Réglages), « Fonctions en réserve » (remettre Tâches puis la ranger).
5. Plan 3 : ouvrir Fichiers, Ce PC, Internet ; réduire vers l'icône, rouvrir. Mon PC : ouvrir un `.html`, `.svg` et `.pdf` depuis un dossier autorisé (R1 du rapport).
6. Compteur d'images par seconde (Maj + F ou `?fps`) : une phrase « PC 58 img/s » au repos, pendant un déplacement et en salle.
7. Noyau → Réglages → IA de secours en ligne : coller ta propre clé Groq (verrouillage actif obligatoire), poser une question en coupant Gemini, vérifier que le Noyau annonce le moteur qui répond. Ne jamais me donner la clé.
8. CSP sur Brave : les 11 essais de `csp.md` (IA locale, YouTube, radios, Open-Meteo, connexion Gmail/Outlook en tête). La console de Brave (F12) ne doit montrer aucun « Refused to … » ; me dire sinon l'adresse bloquée.
9. Couper le réseau après un premier chargement, recharger : le hub doit s'ouvrir avec tes données.
10. `?mobile` puis `?auto` sur le PC (dans l'adresse) : la disposition change et `?auto` la remet.

Android
1. Ouvrir, installer si proposé ; vérifier le nombre de fenêtres et la longueur de la page (A2).
2. Toucher un titre : réduit, rectoucher : rouvre. Appui long : menu (A3).
3. Feuille Outils : ouvrir, masquer Tâches, Veille, Rituels…, remettre une fonction ; se fermer en touchant à côté.
4. Un export sur le PC, puis l'import sur le téléphone, vérifier notes, favoris, agenda.
5. Images par seconde sur le téléphone (`?fps`) : une phrase « Android 31 img/s ».
6. Hors ligne en avion après un premier chargement.
7. IA de secours en ligne : même essai qu'au PC, avec le clavier du téléphone pour coller la clé.

## 6. Préparation de la fusion (rappel)

Monter la version au-dessus de celle de main (`sw.js`, `js/version.js`) si main avance, rejouer la suite juste avant ; A1 à A3 peuvent être corrigées après ou avant la fusion selon la décision de Lucien sur A2.
