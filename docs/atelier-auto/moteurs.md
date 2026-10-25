# Moteurs de l'Atelier (sans interface) — mode d'emploi pour le branchement

Tous dans `js/widgets/moteurs/` : modules ES purs, sans DOM, sans réseau, sans IA, sans import d'un autre fichier du hub. Montants en centimes, dates « AAAA-MM-JJ ».
Essais : `node tools/tests/atelier/tout.mjs` (affiche « Tout est bon »). Données d'essai entièrement factices.

| Moteur | Fichier | Fonctions principales |
| --- | --- | --- |
| cons-score (A) | `cons-score.js` | `lireMotsCles("ia, steam*2, -bourse")`, `scorer(article, profil)` → `{ score, pertinent, trouves, pourquoi }`, `trier(articles, profil, "chrono" \| "pertinence", { masquerNegatifs })` |
| at-radar-donnees (A) | `at-radar-donnees.js` | `controler(exportOuTexte, { maintenant, ageMaxJours })` → `{ ok, erreurs, avertissements, problemes, resume, texte }` |
| bud-csv (C) | `bud-csv.js` | `importerReleve(octetsOuTexte)` → `{ operations, ignorees }`, `nouvelles(existantes, importees)`, `categoriser(operations, regles)`, `verifierRegle(r)`, `suggererRegle(libelle, categorie)` |
| bud-enveloppes (C) | `bud-enveloppes.js` | `calculerMois(etat, operations, "2026-10")`, `allouer(…)`, `reprendreMoisPrecedent(…)`, `bilanTexte(resultat)`, `euros(centimes)` |
| at-garantie (C2) | `at-garantie.js` | `echeances(achat, aujourdhui)`, `radar(achats, aujourdhui)`, `rappels(achats, aujourdhui)` |
| at-colis (C2) | `at-colis.js` | `analyser(numero)` → `{ candidats, message }`, `extraire(texte)` |
| at-incubateur (atelier-auto2) | `at-incubateur.js` | `incuber(idee, { type })` → `{ titre, objet, type, budget, duree, variantes, essais, criteres, prochaineAction, motsCles, problemes, texte }`, `ficheTexte(fiche)`, `typer`, `titrer`, `lireBudget`, `lireDuree` |
| at-simulateur (atelier-auto2) | `at-simulateur.js` | `comparer(options, criteres)` → `{ classement, poids, ecartPremier, egalite, problemes, texte }`, `sensibilite(options, criteres)` → `{ premier, criteres, plusFragile, texte }`, `normaliser(criteres)` |
| at-comparateur (atelier-auto2) | `at-comparateur.js` | `cout(offre)`, `comparer(offres, { par: "unite" \| "total" })` → `{ classement (ecart en centimes, ecartPct), invalides, meilleur, economie, texte }`, `euros(centimes)` |
| at-entretien (atelier-auto2) | `at-entretien.js` | `echeance(tache, aujourdhui)`, `prochaines(taches, aujourdhui)`, `retards(…)`, `enregistrer(tache, { date, usage })` (renvoie une copie), `resumeTexte(…)` |
| at-urgence (atelier-auto2) | `at-urgence.js` | `ficheVide()`, `normaliser(fiche)`, `valider(fiche, { aujourdhui })` → `{ ok, erreurs, avertissements, fiche }`, `exporterTexte(fiche, { numeros })`, `telephoneValide`, `afficherTelephone` |

Points d'attention au branchement :
- Le profil de mots-clés de la veille et les règles de budget sont des données de Lucien : à ranger dans les collections chiffrées du hub (kv), jamais dans `flux/sources.json` (public).
- `importerReleve` accepte directement les octets d'un fichier (`await fichier.arrayBuffer()`), ce qui règle l'encodage.
- `suggererRegle` renvoie une règle marquée `suggeree: true` : l'interface doit demander confirmation avant de l'ajouter.
- Les liens de suivi d'at-colis sont à vérifier avant d'être proposés.
- at-urgence ne chiffre rien : la fiche (données de santé) doit aller dans le coffre chiffré du hub, jamais dans un fichier public ni en clair dans le dépôt. Ne pas l'enregistrer si `valider(…).ok` est faux ; afficher les avertissements sans bloquer.
- at-simulateur : poids sur n'importe quelle échelle (normalisés), notes de 0 à 10, critère `sens: "bas"` pour « plus c'est bas, mieux c'est » (prix). La sensibilité est exprimée en points de pourcentage du total des poids.
- at-incubateur produit un brouillon à faire relire par Lucien (aucune IA) ; at-comparateur et at-entretien ne modifient jamais leurs entrées.
