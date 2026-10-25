# Banc de test · propositions en attente de décision

Rédigé le 25/10/2026 au soir pendant la mission autonome (Lucien absent). Rien de ceci n'est appliqué hors de la branche `banc-essai`.

## 1. Conventions des règles 11 et 12 de la Charte (pour la Commande)

Le test `tools/tests/t7_charte.py` applique ces conventions provisoires, choisies comme les plus prudentes :

| Question | Convention provisoire | Pourquoi |
| --- | --- | --- |
| Qu'est-ce qu'une « fonction livrée » ? | Une fenêtre déclarée dans `index.html` (`class="win"`, `data-id`). 15 aujourd'hui sur banc-essai. | Seule liste stable dans le code ; la fenêtre Outils reprend des lignes de menu, sans liste centrale. |
| Où est le manuel ? | Aligné sur le format de la branche `labo-auto` (`docs/manuel/FORMAT.md`) : `docs/manuel/fiches/<id>.md`, en-tête `id:`. Le test contrôle aussi chaque fiche : champs présents, aucune adresse ni code. Essayé sur les 3 fiches de labo-auto : valides. | Un seul format pour tous les postes. |
| Le test bloque-t-il ? | Non : il liste les fiches manquantes (0/15 aujourd'hui). `HUB_MANUEL_STRICT=1` le rend bloquant. | Aucune fiche n'existe : un test rouge partout ne dirait rien d'utile. |
| « Sans IA et sans WebGL » | WebGL et WebGPU coupés, réseau extérieur bloqué (Gemini, Claude, relais, WebLLM) ; chaque fenêtre doit s'afficher avec du contenu, les données factices être lisibles et modifiables, sans erreur. PC et téléphone simulé. | Couvre la règle sans dépendre de la mise en page de la Refonte. |

**Écart à trancher** : les fiches de labo-auto décrivent des fonctions (Focus, Hyperespace, Ramener vers moi) qui ne sont pas des fenêtres ; avec la convention « une fonction = une fenêtre », elles ne comptent pas, et 0/15 fenêtres ont leur fiche. Proposition : une liste des fonctions livrées tenue dans `docs/manuel/index.json` (ou le Suivi), que le test comparerait aux fenêtres et tuiles Outils.

À décider : garder ces conventions, ou les écrire autrement dans la Charte ; date à partir de laquelle le test du manuel devient bloquant (proposition : pour toute fonction livrée après la fin de la Refonte).

## 2. B29 · clés d'IA à la désactivation du verrouillage

Corrigé sur `banc-essai` (`js/store/vault.js · destroy()`) : les clés `hub-secret-ia`, `hub-secret-claude`, `hub-secret-libre` partent avec le verrouillage. Les jetons des mails restent (ils fonctionnent sans verrouillage par conception). Proposition pour l'avenir : nommer toute nouvelle clé d'IA `hub-secret-ia-…`, pour qu'une seule règle les couvre.

## 3. Décisions déjà ouvertes (rappel)

B2 (import sur appareil synchronisé = fusion), B9 (clé Gemini retirée à la désactivation, garder ?), B14 (WebLLM à figer, origine partagée github.io), B15 (CSP à tester sur Brave), B16 (`window.__hub`, workflow non figé). Détail : `rapport.md`.
