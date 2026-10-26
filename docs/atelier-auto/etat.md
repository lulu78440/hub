# Résumé pour Lucien (22:07)
1. **Fait**, sur la branche `atelier-auto` (rien sur main, aucun fichier existant modifié) : les 4 étapes de la mission, soit 6 moteurs sans interface.
2. **cons-score** : veille triée par pertinence d'après tes mots-clés (`ia, steam*2, -bourse`), avec le « pourquoi » ; l'ordre chronologique reste le mode par défaut.
3. **at-radar-donnees** : contrôle d'un export du hub (doublons, dates invalides, champs manquants, liens non https ou dangereux, sauvegarde de plus de 7 jours), rapport lisible ligne par ligne.
4. **bud-csv** : relevé bancaire CSV français (« ; », virgule décimale, JJ/MM/AAAA, BOM, Windows-1252, Débit/Crédit, lignes de banque avant le tableau), règles de catégorisation, suggestion de règle sans IA à confirmer.
5. **bud-enveloppes** : enveloppes mensuelles, report du reste positif, dépassement retiré de l'argent à répartir le mois suivant, bilan du mois en texte.
6. **at-garantie** (fins de garantie, délais de retour, rappels J-7/J-1) et **at-colis** (transporteur d'après le format, clés S10 et UPS, aucun appel réseau).
7. **Essais** : `node tools/tests/atelier/tout.mjs` → 144 vérifications, « Tout est bon », données entièrement factices.
8. **Décidé à ta place** (`decisions.md`) : règle de dépassement des enveloppes, valeurs légales par défaut (24 mois, 14 jours à distance), liens de suivi à vérifier.
9. **Pas fait** : branchement dans l'interface (attend la refonte), fiches du manuel (au branchement), journal de bord et Suivi (la Commande reportera).
10. **Mode d'emploi pour brancher** : `docs/atelier-auto/moteurs.md`.

# État de la mission autonome Atelier (branche `atelier-auto`)

Début : 25/10 21 h 58. Fin : 22 h 07 (toutes les étapes faites avant l'heure prévue, 22 h 58). Voir `decisions.md` pour les décisions prises à la place de Lucien.

| Étape | État |
| --- | --- |
| 1. cons-score | fait · `js/widgets/moteurs/cons-score.js` · 17 vérifications |
| 2. at-radar-donnees | fait · `js/widgets/moteurs/at-radar-donnees.js` · 28 vérifications |
| 3. bud-csv, bud-enveloppes | fait · `bud-csv.js` (41) et `bud-enveloppes.js` (23) |
| 4. at-garantie, at-colis | fait · `at-garantie.js` (17) et `at-colis.js` (18) |

Rien d'importé depuis un autre fichier du hub ; aucun DOM, aucun réseau, aucune IA, aucun secret, aucune vraie donnée.
