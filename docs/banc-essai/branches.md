# Banc de test · branches refonte-auto et labo-auto (25/10, 19 h 40 → 19 h 55)

Méthode (la plus prudente dans le temps disponible) : la suite du banc (`tools/tests/` de `banc-essai`) est copiée dans une copie jetable de chaque branche, et rejouée aussi sur **main c611939** comme référence. Un échec qui existe déjà sur main n'est pas imputé à la branche. Rien n'est fusionné, rien n'est poussé sur ces branches.

La suite complète (`--rapide`, environ 40 tests) avançait trop lentement avec trois navigateurs en parallèle : arrêtée après 7 tests (identiques sur les trois), remplacée par une sélection ciblée : Charte (mode simple, manuel, B29), sécurité, recette PC et mobile, bloc 7.21.0, secrets dans le dépôt.

## Versions testées

| Branche | Commit | Ce qu'elle change par rapport à main |
| --- | --- | --- |
| main (référence) | c611939 | — |
| refonte-auto | ffa94c3 | `css/hud.css`, `js/ui/outils.js`, `sw.js`, `js/version.js` (7.27.1) ; maquettes de profondeur du plan 2 ; `apercu-refonte.html` (hub entier en un fichier, 15 000 lignes) |
| labo-auto | 546df41 | `js/noyau/` : manuel, règle des outils, socle d'IA locale (worker), modèles, contradictions, décisions, passeport ; `docs/manuel/` (format + 3 fiches) ; `apercu-labo.html` |

## Résultats

RESULTATS_A_COMPLETER

## Relecture du code (statique)

| # | Gravité | Branche | Constat | Proposition |
| --- | --- | --- | --- | --- |
| L1 | important | labo-auto | `js/noyau/worker-ia.js` charge WebLLM en version flottante (`@0.2`) et Transformers.js (`@3.0.0`) depuis jsDelivr, sans contrôle d'intégrité. Un worker partage l'origine du hub : il peut lire la base IndexedDB (en clair si le verrouillage est coupé). Même défaut que B14, sur un deuxième point d'entrée. | Figer les deux versions exactes testées, ou copier les bibliothèques dans `vendor/` comme three.js ; le worker ne doit recevoir que le texte de la question. |
| L2 | important | refonte-auto, labo-auto | `apercu-refonte.html` et `apercu-labo.html` sont des copies complètes du hub (ou du labo) à la racine. Sur leur branche : sans risque. **Fusionnés dans main**, GitHub Pages les servirait sur la même origine que le vrai hub : une autre version du code lirait et écrirait tes données (mises à jour de la base, disposition). Ouverts comme fichier local (double-clic) : sans risque. | Ne pas fusionner les fichiers `apercu-*.html` dans main (les garder sur la branche, ou les ranger dans les archives .zip), ou les faire tourner sur un autre nom de base. |
| L3 | mineur | labo-auto | Les 3 fiches du manuel (Focus, Hyperespace, Ramener vers moi) sont valides au contrôle du banc (champs, ni adresse ni code), mais décrivent des fonctions qui ne sont pas des fenêtres : la règle 12 n'a pas encore de liste des « fonctions livrées » (voir `propositions.md`). | Décision de la Commande. |
| L4 | mineur | labo-auto | Les nouveaux modules du Noyau (`socle`, `manuel`, `modeles`, `passeport`…) ne sont pas dans le cache hors ligne (`sw.js`). Aujourd'hui sans effet : aucun n'est encore chargé par le hub (seulement par les essais du labo). Version laissée à 7.15.0 (main : 7.26.0) : branche partie d'une main ancienne (c79eb5e). | Le jour où le hub les charge : les ajouter au cache et monter la version au-dessus de main, sinon le Noyau casse hors ligne. |
| — | — | refonte-auto | `js/ui/outils.js` : aucune insertion HTML de texte venu de l'extérieur (seul `innerHTML = ""` pour vider). Rien à signaler. | — |

Essais propres de labo-auto (`node labo/essais-manuel.mjs`, `essais-outils-regle.mjs`, `essais-socle.mjs`) : tous « Tout est bon » au commit 32f58c1.
