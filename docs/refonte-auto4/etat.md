# État · refonte-auto4

Dernière mise à jour : 26/10, version 7.40.0, branche `refonte-auto4` (depuis main 7.39.0, poussée, non fusionnée).

| Étape | État |
| --- | --- |
| Bouton « Sources » dans la fenêtre du Noyau (ouvre `afficherSources()`) | construit, testé |
| Bouton « Annuler le plan » (visible seulement pendant un plan) | construit, testé hors navigateur (`labo/essais-vues.mjs`) ; pas de vrai plan lancé en navigateur |
| Entrée « Sources de données » dans Outils / Ctrl+K (groupe « Noyau ») | construit, testé (PC 1440x900 et mobile 390x844) |

Fichiers : `js/ui/noyau-controles.js` (nouveau), `js/ui/outils.js`, `css/noyau.css` (bloc en fin de fichier), `js/noyau/fenetre.js` (2 lignes), `sw.js`, `js/version.js`, `labo/essais-vues.mjs` (nouveau). Raisons : `decisions.md`.

Reste à Lucien : essayer sur Brave PC et Android (bouton Sources, tuile de la palette, annulation d'un vrai plan de 3 étapes ou plus avec une source lente), puis dire « validé ».
