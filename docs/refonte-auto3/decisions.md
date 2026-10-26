# Décisions · refonte-auto3 (p3-mobile)

Poste Refonte, 26/10, branche `refonte-auto3` depuis main 7.36.2. Seulement `js/ui/` (menus.js, outils.js), version et service worker. Aucun fichier de `js/widgets/` ni de `js/noyau/`, CSP inchangée (pas d'eval, pas de script en ligne).

1. **Lanceur d'applis dans Outils, pas de nouvelle fenêtre.** Règle « aucune nouvelle fenêtre permanente » : sur téléphone, le plan 3 n'existe pas, donc les applis sont un groupe « Applis » en tête de la feuille Outils (la palette tapée les filtre déjà).
2. **Contenu.** Internet (met le curseur dans la recherche), les fenêtres du hub qui jouent le rôle d'applis (Mails, Favoris, Vidéo, Page en direct, Notes, Musique) et les liens https posés sur le bureau du PC (icônes « lien », reçues par l'export ou la synchro, 12 au plus, https seulement, ouverts dans un nouvel onglet sans lien vers l'appli).
3. **Pas d'icônes flottantes sur téléphone.** La page est une pile de fenêtres ; des icônes flottantes la recouvriraient. Les icônes du bureau restent au PC (plan 3). Réversible : le groupe peut être retiré d'un seul bloc.
4. **Rien du PC-seulement.** Fichiers, Ce PC et l'écran en direct (partage d'écran) restent absents du téléphone : `initMyPC`, `direct.js` et `commandes.js` ne s'y lancent pas (vérifié : pas de pastille, `__hub.commandes` vaut `null`). Le catalogue de jeux dépend de l'Atelier (lancement à distance non prévu).
5. **Ajout et retrait de liens depuis le téléphone : non.** Lecture seule, pour ne pas ouvrir une deuxième source de vérité pour `hub-bureau-v1`. À décider avec Lucien si besoin.
6. **Ramener vers moi.** Une tuile de fenêtre remet la fenêtre si elle était masquée ou réduite, puis utilise « Ramener vers moi » (nouvelle méthode `mob.reveal`).
