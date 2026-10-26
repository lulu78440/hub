# État de la mission autonome Atelier 3 (branche `atelier-auto3`, version 7.41.0)

| Étape | État |
| --- | --- |
| 1. Fenêtre **Budget** (bud-csv + bud-enveloppes) | faite · `js/widgets/budget.js` |
| 2. Fenêtre **Achats** (at-garantie + at-colis) | faite · `js/widgets/achats.js` |
| 3. Outils communs (DOM sûr, montants, bouton en deux temps, style) | fait · `js/widgets/atelier-outils.js` |
| 4. Hors ligne (PRECACHE) et version 7.41.0 | fait · `sw.js`, `js/version.js` |
| 5. Essais | `tools/tests/t11_atelier3.py` (6 tests, PC et téléphone) ; moteurs : `node tools/tests/atelier/tout.mjs` |
| 6. Fiches du manuel | `docs/manuel/fiches/budget.md`, `achats.md` ; index régénéré |

## Accrochages hors de `js/widgets/` (à relire par la Commande)

Aucun fichier de `css/` n'est modifié. Les accrochages indispensables, au strict minimum :

1. `index.html` : deux blocs `<div class="win" data-id="budget" …>` et `data-id="achats"` (avec `style="order:13"` et `order:14` pour la pile du téléphone). Les fenêtres sont découvertes par `windows.js` et `menus.js` au démarrage, il n'y a pas d'autre moyen d'en créer.
2. `js/main.js` : deux imports et une ligne `initBudget(), initAchats()` après `initRadar` ; `window.__hub` reçoit `budget` et `achats` (pour les essais).
3. `js/ui/windows.js` : **deux lignes** dans `defaults()` (`L.budget`, `L.achats`) pour que les fenêtres attendent au mur du plan 2 au lieu de s'ouvrir au centre en 300 × 200. Sans ces lignes, tout marche, mais la place d'origine est mauvaise.
4. `sw.js` / `js/version.js` : VERSION 7.41.0 et sept fichiers ajoutés au PRECACHE (les trois widgets et les quatre moteurs branchés).
5. `tools/tests/run.py` : `t11_atelier3` ajouté à la liste des modules.

`js/ui/` n'a aucune autre modification ; le style des fenêtres est une balise `<style id="atelier-style">` posée par `atelier-outils.js` (la CSP l'autorise).

## Ce qui est fait pour Lucien

- **Budget** : importer le relevé CSV de la banque (« ; », virgule, dates JJ/MM/AAAA, lignes de banque avant le tableau, Excel), classer les opérations (menu déroulant), règle proposée après un classement à la main (confirmée par Lucien), enveloppes, montant mis dans chacune (champ en euros), reste, dépassement, argent à répartir, report du mois précédent, bilan du mois en texte (copiable), navigation mois par mois.
- **Achats** : nom, date, mode (en ligne ou magasin), réception, état, garantie, extension, retour accordé ; liste triée par urgence avec dates de fin ; modification ; prochains rappels ; reconnaissance d'un numéro de colis (ou d'un message collé) avec lien de suivi s'ouvrant seulement au clic.
- Données gardées dans le magasin du hub (`kv`) : chiffrées si le verrouillage est actif (vérifié par un essai : aucun libellé lisible dans IndexedDB), exportées et synchronisées comme le reste.
- Clavier : tout est bouton, champ, liste déroulante ou `details` natif ; Entrée valide les formulaires ; noms accessibles vérifiés par les essais ; contraste ≥ 4,5:1 vérifié par calcul sur chaque texte ; téléphone sans défilement horizontal (vérifié à 390 px).

## Reste à faire (pas dans cette mission)

- Poser les rappels de garantie dans les rappels du hub (`widgets/reminders.js`, hors Atelier) ; les dates sont déjà calculées par `rappels()`.
- Brancher at-entretien et at-urgence, puis at-incubateur, at-simulateur, at-comparateur (mêmes outils communs).
- Déplacer le style dans `css/` si la Commande le préfère ; ajouter les deux fenêtres à la réserve ou à une tuile d'Outils si Lucien le demande.
- Journal de bord : une ligne ajoutée ; le Suivi (`docs/suivi.json`) est laissé à la Commande.

## Résultats des essais (26/10)

- `node tools/tests/atelier/tout.mjs` : 11 fichiers de moteurs, « Tous les moteurs de l'Atelier : Tout est bon » (265 vérifications, inchangées : les moteurs ne sont pas modifiés).
- `python3 tools/tests/run.py` (complet) : **65 réussis, 0 échec sur 65 tests (2 040 cas)**, dont les 6 de `t11_atelier3` (Budget PC et téléphone, Achats PC et téléphone, données chiffrées, clavier et CSP) et `t9_csp` (aucune violation).
- Chromium sans fenêtre, PC 1440 × 900 et téléphone 390 × 844 : aucune erreur de console nouvelle, aucune violation CSP, aucun défilement horizontal, contraste ≥ 4,5:1 sur tous les textes des deux fenêtres.

## À essayer sur Brave et Android

- Choisir un vrai relevé de ta banque (le fichier ne quitte pas l'appareil) : colonnes reconnues ? opérations bien datées et signées ?
- Android : le sélecteur de fichier pour le CSV, la taille des boutons et des champs au doigt, la saisie d'un montant avec le clavier numérique (virgule), le lien de suivi d'un colis qui s'ouvre dans un nouvel onglet.
- PC : « Ramener vers moi » sur Budget et Achats (mur du plan 2), puis les glisser au plan 1 si tu les veux sous la main.
- Verrouillage actif : fermer puis rouvrir le hub, les enveloppes et les achats doivent revenir.
