# Plan 3 · l'ordinateur futuriste du hub (plan de travail)

Poste : « Refonte · ergonomie ». Demande de Lucien (25/10) : « écran du PC en direct possible avec option activée ; sinon un écran similaire avec des icônes flottantes, petites, qu'on place sur toute l'application ; accès aux jeux Steam comme un catalogue ; internet et vidéo simplifiés, fichiers téléchargés, paramètres de l'ordinateur, e-mails… un vrai ordinateur complet, futuriste, contrôlé par l'IA de l'orbe ».
État de départ : le plan 3 actuel (touche 3, bouton Plan 3) est un bureau de trois colonnes de panneaux (Dossiers, Fichiers récents, Système, Réglages rapides, barre d'applis). Il reste en place tant que les nouvelles étapes ne l'ont pas remplacé.

## 1. Ce que le navigateur permet, et ce qu'il ne permet pas

| Souhait | Faisable dans Brave seul ? | Comment |
| --- | --- | --- |
| Écran du PC en direct (voir) | Oui, en lecture seule | Partage d'écran du navigateur (`getDisplayMedia`) : Lucien choisit l'écran, il s'affiche dans une fenêtre du plan 3. Rien n'est enregistré ni envoyé. |
| Écran du PC en direct (piloter : clics, clavier) | Non | Demande l'appli Windows (V2 PC, déjà prévue au cahier des charges). Le plan 3 garde l'emplacement et l'interrupteur. |
| Icônes flottantes placées partout | Oui | Même mécanique que les images libres : glisser, placer, mémoriser, sur tous les plans. |
| Catalogue de jeux Steam | Oui, sans clé secrète | Lucien ajoute ses jeux (numéro ou lien de la page Steam) ; pochette prise sur le serveur d'images de Steam ; lancement par `steam://run/<numéro>`. Pas d'appel à l'API Steam (bloquée par le navigateur et elle demande une clé). |
| Internet et vidéo simplifiés | Oui | Fenêtres existantes (Page en direct, Vidéo, recherche) présentées comme des applis du bureau. |
| Fichiers téléchargés, paramètres | Oui | Dossiers autorisés (lecture seule) et Réglages rapides, déjà construits. |
| E-mails | Oui, quand le bloc Mails de l'Atelier sera là | La fenêtre Mails (rangée en réserve) devient une appli du bureau. |
| Contrôlé par l'IA de l'orbe | Oui, par la couche de réglages du Noyau | Voir §4 : le poste Refonte ne touche pas `js/noyau/` ; il fournit des points de commande stables pour le Labo. |

## 2. Étapes proposées (une à la fois, Lucien teste puis dit « validé »)

1. **p3-bureau · bureau et icônes flottantes.** Le plan 3 devient un bureau : fond, barre des tâches en bas (horloge, applis ouvertes, menu « Démarrer » du hub), icônes petites et flottantes (glisser pour placer, double-clic ou toucher pour ouvrir, clic droit : renommer, retirer, taille). Les icônes peuvent aussi être posées sur les plans 1 et 2 (« sur toute l'application »). Les panneaux actuels deviennent des applis qu'on ouvre à la demande.
2. **p3-applis · applis du bureau.** Fichiers (dossiers autorisés, téléchargements, fichiers récents), Paramètres (réglages rapides, système), Internet et Vidéo (version simplifiée), Mails (quand disponible). Chacune s'ouvre dans une fenêtre du même système que les fenêtres du hub (déplaçable, réductible à son nom).
3. **p3-jeux · catalogue Steam.** Fenêtre « Jeux » : pochettes en grille, recherche, ajout par numéro ou lien, lancement d'un clic, favoris. Les jeux se rangent dans la collection locale du hub (incluse dans l'export). Compatible avec l'import de catalogue par lien déjà construit.
4. **p3-direct · écran en direct (option).** Interrupteur « Écran du PC en direct » dans Outils : partage d'écran du navigateur dans une fenêtre du plan 3, lecture seule, coupé par défaut, avec bouton d'arrêt toujours visible. Le pilotage attend l'appli Windows.
5. **p3-ia · points de commande pour l'orbe.** Liste stable de commandes que la couche de réglages du Noyau pourra demander (ouvrir une appli, poser une icône, ouvrir le catalogue, lancer un jeu, démarrer ou couper l'écran en direct), chacune avec sa confirmation, rien d'écrit en code. Documentée dans le journal et dans le manuel du hub pour que le Labo la branche.
6. **p3-mobile.** Sur téléphone : les icônes flottantes, le catalogue de jeux (lancement à distance non prévu) et la liste des applis, sans plan 3 ni écran en direct.

La recette de chaque étape reste au Banc de test.

## 3. Garde-fous

- Lecture seule pour les dossiers ; aucune écriture ni suppression de fichiers du PC.
- L'écran en direct est coupé par défaut, choisi à chaque fois par Lucien, jamais enregistré ni envoyé ; le Noyau ne peut le lancer qu'avec la confirmation de Lucien et ne peut jamais le voir ni l'analyser sans demande explicite.
- Les jeux, icônes et réglages sont des données locales : incluses dans l'export, jamais dans le dépôt public. Aucune clé ni identifiant Steam n'est demandé ni stocké.
- Un lien `steam://` ne s'ouvre que par un clic de Lucien ou après sa confirmation.
- Rien dans le fond 3D ni dans l'orbe n'est modifié.

## 4. Pour le Labo et le Noyau (rien dans `js/noyau/` n'est touché par ce poste)

À l'étape p3-ia, le poste Refonte expose un module d'actions (ouvrir une appli, poser une icône, ouvrir ou fermer le catalogue, lancer un jeu, démarrer ou couper l'écran en direct) avec des noms stables, des bornes et un niveau de permission (libre : ouvrir ; confirmation : lancer un jeu, démarrer l'écran). Le Labo branche ces noms sur la couche de réglages ; il ne peut ni étendre la liste ni lui faire exécuter du code.

## 5. Questions ouvertes pour Lucien

1. L'ordre proposé te convient-il, ou veux-tu le catalogue de jeux avant le bureau ?
2. Les icônes flottantes : sur tous les plans (proposé), ou seulement sur le bureau du plan 3 ?
3. Écran en direct : le partage d'écran en lecture seule te suffit-il en attendant l'appli Windows, ou préfères-tu attendre le pilotage complet ?
