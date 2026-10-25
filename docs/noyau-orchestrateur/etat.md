# Noyau orchestrateur · état

25/10/2026 · poste Labo · Cerveau IA · branche `labo-orchestrateur` (origin/main fusionnée, déjà à jour).

| Lot | État |
| --- | --- |
| 1 · Audit | fait (`audit.md`) |
| 2 · Composants affichables | **construit sur la branche, à relire par Lucien** |
| 3 et suivants | non commencés (attendent le feu vert) |

## Lot 2 · ce qui est construit
- `js/noyau/modules/composants.js` (nouveau) : `verifierJeu` (schéma strict), `courbe`, `barres`, `tableau`, `chiffreCle`, `filtres`, `piedSources`, `exporter`, `rendre(type, jeu, options)` (point d'entrée en liste blanche : `courbe`, `barres`, `tableau`, `chiffre_cle`), plus les fonctions pures (échelles, graduations, axe temporel, agrégation, contraste, `versCSV`, `versSVG`).
  - SVG et DOM écrits à la main (`createElement`, `createElementNS`, `textContent`, `setAttribute`) ; aucune bibliothèque, aucun WebGL, aucun réseau, aucune IA, aucun `innerHTML`.
  - Pied de sources obligatoire : source, date de mise à jour, unité, période (plus lien, licence, date de requête, « non vérifié », « EXEMPLE »). Sans l'un des quatre, `rendre()` affiche « Affichage refusé : raison » à la place du graphique.
  - Accessibilité : tableau équivalent repliable sous chaque graphique, SVG `role="img"` avec titre et description, lecture des valeurs au clavier (flèches, Origine, Fin), au survol et au toucher ; séries distinguées par couleur **et** motif de trait ; contrastes ≥ 4,5:1 sur le fond du hub (vérifiés par l'essai) ; mouvement réduit respecté (aucune animation).
  - Interactions : légende qui masque une série, zoom par deux curseurs et « Tout afficher » (courbe) ; tri et filtre des catégories (barres) ; tri par colonne, filtre texte et pagination (tableau) ; filtres catégories et période qui pilotent les autres composants.
  - Plafonds : 5 000 points par série (moyenne par groupes au-delà, annoncée), 6 séries dessinées, 60 catégories ; le tableau garde tout.
  - Export CSV et SVG : seulement par un vrai clic (`event.isTrusted`), jamais par le code ni par le Noyau. CSV en « ; », UTF-8 avec BOM, CRLF, formules neutralisées ; SVG autonome avec le pied de sources.
- `js/noyau/fenetre.js` : un import et une méthode `afficherComposant(type, jeu, options)` sur l'objet renvoyé par `monterFenetre`, qui pose le composant dans l'échange avec un bouton « Fermer ». **Appel par le code uniquement, aucun outil du Noyau.**
- `css/noyau.css` (au Labo, d'après le contrat et le journal) : styles `.nxc-*` ajoutés à la fin.
- `labo.html`, `labo/labo.js` : onglet **Composants** ; `labo/composants-demo.js` : données factices marquées « EXEMPLE » et « non vérifié », exemple de refus sans source, exemple de texte piégé, bouton « Afficher la courbe dans la fenêtre du Noyau ».
- `sw.js` : `js/noyau/modules/composants.js` ajouté au PRECACHE (importé par `fenetre.js`), **version inchangée (7.31.0)** : la Commande la montera à la fusion.

## Essais (25/10)
- `node labo/essais-composants.mjs` : 107 vérifications, 0 échec (schéma et refus, échelles, rendu SVG, 0 ligne, 1 point, 5 001 points, valeurs manquantes, dates invalides, échappement, CSV exact, export refusé sans vrai clic, contraste, aucun nouvel outil).
- Les 31 `node labo/essais*.mjs` : tous au vert (`essais.mjs` : 44 réussis, 15 sautés faute de moteur réel, comme avant).
- `python3 tools/tests/run.py charte securite` : 13 réussis, 0 échec (64 cas).
- Navigateur automatisé (Chromium, 1400 px et 360 px) : onglet Composants sans erreur de console, aucun défilement horizontal, lecture clavier, affichage dans la fenêtre du Noyau, téléchargement CSV par clic, refus d'un clic par le code.

## Reste à faire
- Relecture visuelle par Lucien (onglet Composants du labo) et test Android (toucher, temps de rendu).
- Lot 3 (registre central d'outils) au feu vert.
- Plus tard (lots 5 et 6) : `Plan`, `EtatVide`/`Erreur` avec « réessayer », export JSON et PNG, zoom au doigt, échelle logarithmique.
