# Refonte · ergonomie — plan de simplification (ergo-plan)

25 octobre 2026 · poste Refonte, conçu avec Opus · à construire avec Sonnet, une étape à la fois.
Base : `docs/ergo-audit.md` et les réponses de Lucien. Maquette avant / après : captures du vrai hub (copie locale, « après » simulé), toile de design privée « Hub · refonte ergonomie » (https://claude.ai/artifact/DMFPu4TRGjApNtGY8vh9Pz) et `maquettes/refonte/` (captures et `simulation-apres.js`, le script qui simule l'après sur une copie locale, utile pour la construction).

## Règles de la refonte

1. **Le fond et l'orbe ne changent pas** (scène 3D, halo, colonnes, poussière, constellation, lune, effets de souris, légendes autour du noyau). La refonte porte sur les fenêtres, leurs contenus, les menus et la barre du haut.
2. **Rien n'est effacé** : ni code, ni données. Ce qui sort de la vue reste accessible (fenêtre Outils ou Réglages → Fonctions en réserve).
3. **Huit lignes au plus par menu** ; l'essentiel d'abord, le reste derrière « Plus… ».
4. **Un seul endroit par réglage.**
5. Chaque fichier touché hors du poste (`js/main.js`, un widget) est listé au journal avant la modification.

## 1. Ce qu'on garde en vue

| Où | Avant | Après |
| --- | --- | --- |
| PC · plan 1 « Hub » | Mon PC, Veille, Vidéo, Page en direct, Tâches | **Favoris, Notes** à gauche ; **Vidéo** (figée), **Musique** à droite ; orbe et recherche au centre |
| PC · plan 2 « Noyau et web » | 10 fenêtres réduites à 50 %, dont Noyau, Sécurité et Savoir hors de l'écran | **Salle immersive** (§7) : Page en direct, Mon PC, Noyau et les fenêtres que tu y ranges, grandeur nature sur un mur courbe |
| PC · plan 3 « Mon PC » | bureau du PC | inchangé pendant la refonte ; il deviendra un vrai bureau comme celui du PC, travaillé plus tard (demande de Lucien du 25/10) |
| Mobile | 17 fenêtres, environ 7 600 px à faire défiler ; Noyau, Sécurité et Savoir en tête | **Météo, Agenda, Notes, Favoris, Vidéo, Musique, Noyau, Page en direct** : environ 3 500 px |
| Barre du haut | 12 éléments | logo et HUB, progression, vignettes des mods, horloge, météo, Hub / Plan 2 / Plan 3, 🎙 Parler, **Outils**, Labo |
| Bande d'agenda, bandeau d'actualité | — | inchangés |

Nouvelle disposition des fenêtres (version 3) appliquée une fois au chargement ; l'ancienne est gardée dans l'appareil et « Disposition d'origine » reste possible.

## 2. Ce qu'on fusionne

| Doublon | Après |
| --- | --- |
| Diag + Plein écran + 7 réglages répétés au clic droit | un seul bouton **Outils** ; « Réglages et diagnostic » (l'ancien Diag) est rangé dedans ; touche **O** pour Outils, **D** garde l'accès direct aux réglages |
| Mon PC (plan 1) et bureau du PC (plan 3) | Mon PC passe au plan 2, sans les puces batterie et réseau (elles restent au plan 3) |
| « Vidéos à suivre » : bloc de Vidéo + fenêtre mobile à part | une seule place, dans la fenêtre Vidéo |
| « Demander à l'entité » et « Résumer avec le Noyau » (menu de fenêtre) | une seule ligne, « Résumer avec le Noyau », dans « Plus… » |
| Fenêtre Progression + mini barre + panneau de résumé | mini barre, panneau et vignettes gardés en haut ; la fenêtre de détail est rangée dans Outils |
| Navigation : boutons de plan, molette, touches, double-clic, menu, jauge de zoom | la jauge de zoom disparaît ; plus aucune ligne de navigation dans les menus : tout passe par la molette (§10) |

Les trois entrées vers le Noyau (clic sur l'orbe, appui long, 🎙 Parler) restent : Lucien utilise les trois.

## 3. Fenêtre Outils

Bouton **Outils** dans la barre du haut (PC et mobile), touche **O**, dernière ligne du menu du fond. Panneau à droite sur PC, feuille en bas d'écran sur mobile ; Échap ou clic à côté pour fermer.

| Groupe | Tuiles (PC) | Mobile |
| --- | --- | --- |
| Gestes | Focus (25 · 50 min), Revoir le briefing, Capture rapide (note du Noyau), Ajouter une image, Plein écran, Verrouiller | sans Image ni Plein écran |
| Fenêtres rangées | Progression, Mails (à configurer), Fenêtres masquées, Disposition d'origine | Ordre d'origine |
| Ambiance | Crépuscule, Entité, Curseur HUD, Son des rappels | Crépuscule, Son |
| Données | Exporter, Importer, Coffre du Hub, Synchro | idem |
| Réglages et diagnostic | verrouillage, synchro, notifications, surprises, **Fonctions en réserve**, état technique (repliés), mises à jour, vider le cache | idem |

Chaque tuile affiche son état en petit (« il y a 3 j », « auto », « 78 % »).

## 4. Ce qui sort de la vue (code et données gardés)

| Élément | Où le retrouver |
| --- | --- |
| Tâches, Veille, Radar des dates, Rituels | Réglages → Fonctions en réserve (coupées par défaut, réactivables d'une case) |
| Sécurité, Savoir (fenêtres du Noyau) | Fonctions en réserve ; elles s'ouvrent aussi quand le Noyau ou le Labo les demande |
| Mails | tuile Outils (en attente du bloc E de l'Atelier) |
| Compteur img/s | Réglages → Affichage (case « afficher le compteur ») |
| Raccourcis de la recherche (!g !d !y !v) | affichés seulement quand on écrit dans la recherche |

Retirés pour de bon (texte seulement) : sous-titre « Phase 7 · radar », jauge de zoom, textes périmés (« phase 6 », « sous-étape 2.8 », « PHASE 2 / 3 »), note « Maj + clic droit » répétée dans chaque menu (elle passe dans l'aide d'Outils).

**Conséquences des fonctions en réserve** : les rappels des tâches s'arrêtent, les losanges de tâches quittent l'agenda, le briefing ne parle plus des tâches, la légende « Tâches » autour de l'orbe disparaît, les anneaux des rituels et la teinte d'humeur ne s'affichent plus. **La constellation**, gardée, s'allumait à chaque tâche faite : voir la question 1.

## 5. Menus du clic droit (décidé par le poste, à la demande de Lucien)

**Plus aucune navigation dans les menus** (décision de Lucien, 25/10) : changer de plan, ramener une fenêtre vers soi ou devant se fait à la molette (§10).

**Fond** (27 lignes → 6 au plus) : Focus 25 min (ou Arrêter le Focus) · Revoir le briefing du jour · Coller une image ici · Fenêtres masquées (si besoin) · Verrouiller maintenant (si le verrouillage est actif) · **Outils…**

**Fenêtre** (jusqu'à 15 lignes → 8 au plus) : 2 ou 3 lignes propres à la fenêtre · Réduire / Rouvrir · **Personnaliser…** · Figer / Libérer · Masquer · **Plus…** (Agrandir, Focus sur cette fenêtre, Résumer avec le Noyau, autres lignes de la fenêtre, ‹ Retour).

| Fenêtre ou zone | Lignes gardées en tête | Dans « Plus… » |
| --- | --- | --- |
| Vidéo | Plein écran, Arrêter | vidéos à suivre, ajouter des chaînes |
| Musique | Lecture / Pause, Suivant, Grand écran | ajouter une radio, radios d'origine |
| Notes (sur une note) | Modifier, Épingler, Supprimer | Copier le texte |
| Favoris (sur un lien) | Ouvrir, Copier l'adresse, Modifier | Ouvrir ici, Retirer, Importer |
| Page en direct | Actualiser, Ouvrir ↗, Changer d'adresse | actualisation automatique |
| Agenda (bande) | Nouvel événement, Ouvrir la semaine | vues jour et mois |
| Météo (barre du haut) | Changer de ville, Actualiser | °C / °F, ma position |
| Mon PC | Ouvrir le bureau du PC, Ajouter un dossier | Actualiser |
| Actualité (bandeau) | Arrêter le défilement, Actualiser | Modifier les sources |
| Entité / logo | Poser ou reprendre, Masquer | — (textes « phase 6 » retirés) |

**Mobile** (appui long sur un titre ; pas de molette sur téléphone) : Ramener vers moi · Monter · Descendre · Masquer · Personnaliser… ; « Tout en haut » dans Plus… ; « Fermer » disparaît (toucher à côté ferme).

**Correction** : « Verrouiller maintenant » réapparaît (`js/widgets/images.js:124`, `registerMenu` → `extendMenu`).

Mécanisme : le tri « en tête / Plus… » se fait dans `js/ui/menus.js` (table des lignes essentielles par fenêtre) ; les widgets ne sont pas réécrits.

## 6. Visuel des fenêtres (sans toucher au fond ni à l'orbe)

- Étiquette en haut à droite seulement si elle dit quelque chose (« 3 notes », « en direct ») ; plus de « VIDÉO » sous « VIDÉO ».
- Pieds de fenêtre fixes retirés (« Lecteur YouTube intégré », « Stockées sur l'appareil ») ; gardés quand ils portent une action ou un chiffre.
- Aides longues ramenées à une ligne (« Rien à suivre · colle un lien ou ajoute une chaîne »).
- Hachures des barres de titre atténuées (35 %).
- Mêmes tailles de titre, de texte et de bouton dans toutes les fenêtres.

## 7. Réduire une fenêtre à son nom (demande de Lucien, 25/10)

- **Un clic sur le nom** de la fenêtre (l'onglet coloré en haut à gauche) la réduit : il ne reste que ce nom, sans cadre, sans hachures, sans étiquette, sans contenu. Un second clic la rouvre à sa taille.
- Glisser le nom déplace toujours la fenêtre (au-delà de 6 px, c'est un déplacement, pas un clic). Le double-clic sur le reste de la barre garde « Agrandir ».
- La fenêtre réduite continue de vivre (la radio joue, les rappels sonnent). « Ramener vers moi » la rouvre d'abord.
- L'état est mémorisé avec la disposition, au plan 1 comme au plan 2. Menu de la fenêtre : « Réduire » / « Rouvrir » en tête.
- **Mobile** : toucher le titre réduit ou rouvre (la page raccourcit d'autant) ; l'appui long garde le menu.

## 8. Plan 2 · salle immersive, type cinéma VR (demande de Lucien, 25/10)

Aujourd'hui le plan 2 réduit tout le monde à 50 % : les fenêtres sont petites et floues. Il devient une **salle** dans laquelle on se tient :
- **Mur courbe** autour de toi : chaque fenêtre du plan 2 est posée sur un cylindre (rayon environ 1 300 px), tournée vers toi, **à sa vraie taille**, donc lisible. Deux fenêtres de face, les autres sur les côtés, à découvrir en tournant la tête.
- **Tourner la tête** : souris près du bord gauche ou droit, glisser sur le fond, flèches ← →, ou molette avec Maj ; jusqu'à environ 60° de chaque côté. Retour de face : touche 2 ou double-clic sur le fond.
- **Immensité et profondeur** : le plan 1 (ses fenêtres, la recherche et l'orbe) recule au fond de la salle, au centre, plus sombre ; **sol miroir** quadrillé jusqu'à l'horizon, avec le reflet des fenêtres du mur ; voile de brume à l'horizon ; bandes noires du cinéma gardées.
- La scène 3D du fond et l'orbe ne sont pas modifiées : l'orbe suit simplement la place de son emplacement, au fond de la salle.
- Arrivée en 0,8 s depuis le plan 1 (les fenêtres glissent vers le mur) ; « mouvement réduit » : sans animation ni rotation douce.
- Déplacer une fenêtre dans la salle la fait glisser le long du mur ; on y range aussi des fenêtres réduites (§7).
- Si les images par seconde chutent sur ton PC : réglage « Salle allégée » (sans reflets ni brume).
- Mobile : pas de plan 2, comme aujourd'hui.

Technique : `perspective` sur la page, monde en 3D (`preserve-3d`) tourné autour du point de vue, place de chaque fenêtre du plan 2 enregistrée en angle et hauteur (disposition version 3), reflets en `-webkit-box-reflect` (Brave le gère). Fichiers : `js/ui/plans.js`, `js/ui/windows.js`, `css/hud.css`. Script de simulation : `maquettes/refonte/simulation-salle.js`.

## 9. Tuiles magnétiques personnalisables (proposition du 25/10, revue avec Lucien)

Reprend les idées gardées de la maquette « tuiles » (palette d'origine, pas de survol axonométrique) et les rend **personnalisables**. Planche interactive « Tuiles magnétiques personnalisables » sur la toile : on y glisse les tuiles, on change leur style, leurs effets et la taille du texte en direct, et on essaie la molette (§10).

**Le principe** : chaque fenêtre devient une tuile posée sur une grille invisible aimantée ; sa taille suit son contenu ; deux états (repos : contour fin ; active : texture et lueur de sa couleur, une seule active à la fois).

**Personnaliser…** : dans la liste du clic droit de chaque fenêtre (et dans l'appui long sur téléphone) ; panneau à côté de la tuile, aperçu en direct.

| Réglage | Choix | Par défaut |
| --- | --- | --- |
| Style | **Normal** (l'apparence actuelle : onglet coloré, coins coupés) · **Hologramme 3D** (ci-dessous) · Fin · Verre · Minimal | Normal |
| Effets (chacun activable) | **Constellation** (points et traits lumineux autour du cadre, qui scintillent) · **Halo** (lueur de la couleur de la tuile, comme le halo de l'orbe) · **Énergie** (un trait de lumière qui fait le tour du cadre) | aucun |
| Couleur | celle de la fenêtre · cyan · violet · ambre · rouge (palette d'origine) | celle de la fenêtre |
| Taille du texte | 90 % · 100 % · 115 % · 130 % (titre, lignes et chiffres ensemble) | 100 % |
| Taille de la tuile | Auto (suit le contenu et le texte) · S · M · L · Libre (poignée du coin) | Auto |
| Fond | 100 % · 70 % · 40 % | 100 % |
| Nom | toujours visible · au survol seulement | toujours |
| Aimant | oui · non | oui |

**Style Hologramme 3D** (reprend le dessin de l'orbe et pousse le panneau holographique) :
- vraie profondeur : trois plaques empilées en 3D (fond quadrillé en retrait, contenu, verre en avant avec reflet) et coins lumineux en avant ;
- lignes de balayage qui défilent, texte légèrement dédoublé cyan / magenta comme l'aberration de l'orbe, scintillement rare ;
- **mini-noyau** devant le nom : la sphère blanche et cyan de l'orbe avec son anneau ;
- **faisceau projeté** depuis un petit émetteur lumineux sous la tuile, comme le faisceau de l'orbe ;
- flottement lent en 3D, inclinaison vers la souris au survol ; « mouvement réduit » : immobile.

**Pour toutes** (Outils → Tuiles) : modèle appliqué à toutes (Normal, Hologramme 3D, Fin, Verre, Minimal), effets pour toutes, pas de la grille (8, 16 ou 24 px, ou sans aimant), écart entre tuiles (6, 10 ou 16 px), « Revenir au style d'origine ».

**Règles** : réglages gardés à part pour le PC et le téléphone et inclus dans l'export ; une tuile réduite (§7) garde son nom dans sa couleur ; au plan 2, les tuiles du mur gardent leur style ; sur téléphone : pas d'aimant (pile), Hologramme 3D allégé (sans flottement), effets Constellation et Énergie coupés pour la batterie ; tout en CSS et SVG, dans la boucle unique, à l'arrêt quand l'onglet est caché ou l'écran verrouillé ; images par seconde mesurées avec chaque effet.

## 10. Molette : changer de plan et déplacer une fenêtre (demande de Lucien, 25/10)

Toute la navigation passe par la molette ; les menus n'en contiennent plus.

| Geste | Effet |
| --- | --- |
| Molette sur le fond | changer de plan, comme aujourd'hui (plan 1 ↔ plan 2, puis plan 3) |
| **Maintenir le clic sur une fenêtre + molette vers le haut** | la fenêtre vient vers toi, un cran par niveau : plan 2 → plan 1 → **vers moi** (au centre, agrandie, le reste voilé : l'ancien « Ramener vers moi ») |
| **Maintenir le clic + molette vers le bas** | elle repart : vers moi → plan 1 → plan 2 |
| Lâcher le clic | la fenêtre reste au niveau choisi ; une jauge « VERS MOI · PLAN 1 · PLAN 2 » s'affiche à côté pendant le geste |
| Clic n'importe où sur une fenêtre | elle passe devant les autres (remplace « Ramener devant ») |
| Échap, clic sur le fond | renvoie la fenêtre « vers moi » à sa place |
| Survol + Alt+↑ / Alt+↓ | même chose au clavier |

- Arrivée au plan 1 : la fenêtre prend la place aimantée libre la plus proche ; arrivée au plan 2 : la place libre du mur en face de ton regard (salle immersive, §8).
- Le plan 3 (bureau du PC) viendra plus tard ; la molette s'arrête au plan 2 pour les fenêtres.
- Sans maintenir le clic, la molette fait défiler normalement le contenu d'une fenêtre (listes) ; pendant le maintien, le défilement est bloqué.
- L'ancien maintien de 0,55 s (« Ramener vers moi » automatique) disparaît : le maintien sert maintenant à la molette.
- Téléphone : pas de molette ni de plans ; « Ramener vers moi » reste dans l'appui long.

## 10 bis. Déplacement plus fluide (demande de Lucien, 25/10)

Causes relevées dans le code actuel : la fenêtre rattrape la souris avec un amortissement (environ 60 ms de retard) ; à chaque image, le champ de force relit la place de la fenêtre déplacée et celle de l'orbe (calcul de mise en page forcé) ; le survol applique un filtre de luminosité à toute la fenêtre ; la fenêtre penche selon la vitesse ; au lâcher, elle saute sur la grille de 8 px.

Corrections :
- **La tuile suit la souris sans retard** pendant le glisser (position posée directement, amortissement seulement après le lâcher).
- **Mouvements de souris complets** (`getCoalescedEvents`) pour une trace sans à-coups sur les souris rapides.
- **Aucune relecture de mise en page pendant le glisser** : le champ de force reçoit la position calculée au lieu de la relire ; la place de l'orbe est relue une fois par image au lieu de trois.
- **Place aimantée affichée en pointillé** pendant le glisser, puis **pose avec un léger rebond** (0,4 s) au lieu du saut.
- Filtre de survol coupé pendant le glisser ; inclinaison limitée à 2° et adoucie.
- Lancer une tuile d'un geste vif : elle glisse puis ralentit (désactivable, coupé en « mouvement réduit »).
- Objectif mesuré : 60 images par seconde pendant un déplacement, avec le compteur des réglages.

## 11. Ordre de construction (Sonnet)

| Étape | Contenu | Fichiers |
| --- | --- | --- |
| ergo-visuel a | déplacement fluide (§10 bis), §6, réduction des fenêtres (§7), barre du haut allégée (sous-titre, img/s, jauge de zoom), raccourcis de recherche au focus, textes périmés | `css/`, `index.html`, `js/ui/topbar.js`, `js/ui/windows.js` |
| ergo-visuel b | tuiles magnétiques personnalisables (§9) : styles dont Hologramme 3D, effets, taille du texte, panneau Personnaliser | `js/ui/windows.js`, `js/ui/tuiles.js` (nouveau), `css/hud.css`, `js/fx/force.js` (lecture de position) |
| ergo-visuel c | salle immersive du plan 2 (§8) | `js/ui/plans.js`, `js/ui/windows.js`, `css/hud.css` |
| ergo-fusion | §5 menus sans navigation, molette (§10), correction du verrouillage, doublons du §2, nouvelle disposition v3, Fonctions en réserve | `js/ui/menus.js`, `js/ui/ctxmenu.js`, `js/ui/windows.js`, `js/ui/plans.js`, `js/ui/reserve.js` (nouveau), `js/main.js` (démarrage des fonctions en réserve), `js/widgets/images.js` (1 ligne) |
| ergo-outils | §3 fenêtre Outils, Réglages (ex-Diag) dedans, touches O et D | `js/ui/outils.js` (nouveau), `js/ui/diag.js`, `css/hud.css`, `index.html` |
| ergo-mobile | ordre et contenu mobile du §1, menu d'appui long, feuille Outils | `css/mobile.css`, `js/ui/menus.js` |

Après chaque étape : test de Lucien sur PC et Android, « validé », puis la suivante. À la fin : recette du poste Banc (ergo-recette), puis version stable.

## 12. Décisions de Lucien (25/10)

1. **Plan validé**, avec la réduction des fenêtres (§7), la salle immersive (§8) et un déplacement plus fluide (§10 bis).
2. **Constellation** : une étoile s'allume à chaque **Focus terminé** (touche `widgets/surprises.js`, noté au journal à la construction).
3. **Tuiles magnétiques** : maintenant, et **personnalisables** (§9) : l'apparence actuelle devient le style **Normal** ; un vrai style **Hologramme 3D** reprenant l'orbe ; effets Constellation, Halo, Énergie activables ; taille du texte ; « Personnaliser… » dans le clic droit de chaque fenêtre.
4. **Molette** pour toute la navigation (§10) : maintenir le clic sur une fenêtre + molette la fait changer de plan ; plus aucune ligne de navigation dans les menus.
5. **Plan 3** : vrai bureau du PC, plus tard.
6. Passage sur Sonnet seulement après le feu vert de Lucien.
