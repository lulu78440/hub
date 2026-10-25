# Banc de test · branches refonte-auto et labo-auto (25/10, 19 h 40 → 19 h 53)

Méthode (la plus prudente dans le temps disponible) : la suite du banc (`tools/tests/` de `banc-essai`) est copiée dans une copie jetable de chaque branche, et rejouée aussi sur **main c611939** comme référence. Un échec qui existe déjà sur main n'est pas imputé à la branche. Rien n'est fusionné, rien n'est poussé sur ces branches.

La suite complète (`--rapide`, environ 40 tests) avançait trop lentement avec trois navigateurs en parallèle : arrêtée après 7 tests (identiques sur les trois), remplacée par une sélection ciblée : Charte (mode simple, manuel, B29), sécurité, recette PC et mobile, bloc 7.21.0, secrets dans le dépôt.

## Versions testées

| Branche | Commit | Ce qu'elle change par rapport à main |
| --- | --- | --- |
| main (référence) | c611939 | — |
| refonte-auto | ffa94c3 | `css/hud.css`, `js/ui/outils.js`, `sw.js`, `js/version.js` (7.27.1) ; maquettes de profondeur du plan 2 ; `apercu-refonte.html` (hub entier en un fichier, 15 000 lignes) |
| labo-auto | 546df41 | `js/noyau/` : manuel, règle des outils, socle d'IA locale (worker), modèles, contradictions, décisions, passeport ; `docs/manuel/` (format + 3 fiches) ; `apercu-labo.html` |

## Résultats

Sélection de 17 tests, suite du banc du 25/10 au soir.

| Test | main c611939 | refonte-auto ffa94c3 | labo-auto 546df41 | Lecture |
| --- | --- | --- | --- | --- |
| Recette téléphone simulé | ✓ | ✓ | ✓ | |
| Recette PC | ✗ | ✗ | ✓ | test à mettre à jour : il saisit dans Tâches, fenêtre « en réserve » depuis ergo-fusion (labo-auto part d'une main plus ancienne) |
| Textes piégés | ✗ | ✗ | ✓ | même cause (saisie dans Tâches), pas un défaut |
| Aucun secret dans le dépôt | ✓ | ✓ | ✓ | |
| Secrets jamais exportés ni synchronisés | ✓ | ✓ | ✓ | |
| Verrouillage, verrouillage automatique | ✓ | ✓ | ✓ | |
| Flux RSS piégé (B3) | ✗ | ✗ | ✗ | défaut de main, corrigé sur banc-essai |
| Liens `javascript:` importés (B4) | ✗ | ✗ | ✗ | idem |
| Page en direct isolée (B5) | ✗ | ✗ | ✗ | idem |
| Cache météo piégé (B8) | ✗ | ✗ | ✗ | idem |
| Clés d'IA retirées à la désactivation (B29) | ✗ | ✗ | ✗ | idem |
| Mode simple sans IA ni WebGL, PC et téléphone (règle 11) | ✓ | ✓ * | ✓ | * premier passage rouge pour la même cause (Tâches en réserve) ; test corrigé, rejoué en vert sur main et banc-essai |
| Fiches de manuel (règle 12) | 0/18 | 0/18 | 0/18 | non bloquant ; les 3 fiches de labo-auto sont des fonctions, pas des fenêtres (L3) |
| Bloc 7.21.0 catalogue par lien | ✓ (25 cas) | ✓ (25 cas) | sauté | labo-auto n'a pas encore ce bloc |

**Conclusion** : aucune régression propre à refonte-auto ni à labo-auto : chaque échec existe déjà sur main (défauts corrigés sur banc-essai, ou tests à adapter à la refonte). Restent les constats de relecture L1, L2 (importants) et L3, L4 (mineurs) ci-dessous. Non rejoué faute de temps : sauvegardes, charge, confort et cas précis sur ces deux branches (la suite complète prend plus de 10 min par branche).

## Relecture du code (statique)

| # | Gravité | Branche | Constat | Proposition |
| --- | --- | --- | --- | --- |
| L1 | important | labo-auto | `js/noyau/worker-ia.js` charge WebLLM en version flottante (`@0.2`) et Transformers.js (`@3.0.0`) depuis jsDelivr, sans contrôle d'intégrité. Un worker partage l'origine du hub : il peut lire la base IndexedDB (en clair si le verrouillage est coupé). Même défaut que B14, sur un deuxième point d'entrée. | Figer les deux versions exactes testées, ou copier les bibliothèques dans `vendor/` comme three.js ; le worker ne doit recevoir que le texte de la question. |
| L2 | important | refonte-auto, labo-auto | `apercu-refonte.html` et `apercu-labo.html` sont des copies complètes du hub (ou du labo) à la racine. Sur leur branche : sans risque. **Fusionnés dans main**, GitHub Pages les servirait sur la même origine que le vrai hub : une autre version du code lirait et écrirait tes données (mises à jour de la base, disposition). Ouverts comme fichier local (double-clic) : sans risque. | Ne pas fusionner les fichiers `apercu-*.html` dans main (les garder sur la branche, ou les ranger dans les archives .zip), ou les faire tourner sur un autre nom de base. |
| L3 | mineur | labo-auto | Les 3 fiches du manuel (Focus, Hyperespace, Ramener vers moi) sont valides au contrôle du banc (champs, ni adresse ni code), mais décrivent des fonctions qui ne sont pas des fenêtres : la règle 12 n'a pas encore de liste des « fonctions livrées » (voir `propositions.md`). | Décision de la Commande. |
| L4 | mineur | labo-auto | Les nouveaux modules du Noyau (`socle`, `manuel`, `modeles`, `passeport`…) ne sont pas dans le cache hors ligne (`sw.js`). Aujourd'hui sans effet : aucun n'est encore chargé par le hub (seulement par les essais du labo). Version laissée à 7.15.0 (main : 7.26.0) : branche partie d'une main ancienne (c79eb5e). | Le jour où le hub les charge : les ajouter au cache et monter la version au-dessus de main, sinon le Noyau casse hors ligne. |
| — | — | refonte-auto | `js/ui/outils.js` : aucune insertion HTML de texte venu de l'extérieur (seul `innerHTML = ""` pour vider). Rien à signaler. | — |

Essais propres de labo-auto (`node labo/essais-manuel.mjs`, `essais-outils-regle.mjs`, `essais-socle.mjs`) : tous « Tout est bon » au commit 32f58c1.
