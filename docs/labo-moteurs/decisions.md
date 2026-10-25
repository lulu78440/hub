# Labo · moteurs de secours · décisions (branche `labo-moteurs`)

Chaque décision est prudente et réversible ; le retour arrière est indiqué. Rien n'a été fait sur `main`.

| # | Décision | Pourquoi | Retour arrière |
| --- | --- | --- | --- |
| 1 | Un seul adaptateur `moteurCompatibleOpenAI` ; Groq, OpenRouter, Mistral et le relais historique l'utilisent. | Même format pour tous : un seul endroit pour les en-têtes, les erreurs et le masquage de la clé. | Remettre l'ancien corps de `moteurLibre` (historique git). |
| 2 | Nouveau type de moteur `secours` (le relais garde `libre`), avec `service` et `entrainement`. | Le badge dit le nom du service réellement utilisé, et l'avertissement Mistral suit le moteur, pas le réglage. | — |
| 3 | Secours seulement sur `reseau`, `hors_ligne`, `quota`, `budget`, `credit`, `cle`, `delai`. Les réponses 5xx comptent comme « réseau » (service indisponible) ; les autres 4xx (400…) deviennent `http` et **ne déclenchent pas** de secours. | Consigne : réseau, 429, clé, délai. Le plafond interne du jour et le crédit Claude épuisé sont des quotas ; une requête mal formée ne doit pas être renvoyée en boucle à tous les services. | Ajouter `http` à `CODES_SECOURS`. |
| 4 | Délai de 20 s par moteur en ligne, appliqué par la chaîne à Gemini et Claude aussi (leur propre délai reste 45 s hors chaîne). Pas de délai pour l'IA locale (le premier chargement est long). Réglage caché `noyau-delai-secours` (ms) pour les essais. | Consigne « délai dépassé (20 s) ». | `delaiMaillon: 0` dans `noyau.js`. |
| 5 | L'ordre réglé est la base ; le routage par complexité ne fait qu'échanger Gemini et Claude. | Garder le comportement validé (Claude pour l'exigeant) sans casser l'ordre choisi par Lucien. | — |
| 6 | Mistral coupé par défaut (`noyau-secours-mistral` = `off`), activé seulement par une case cochée par Lucien ; le relais réglé sur Mistral porte aussi l'avertissement dans le badge. | Plan Experiment : les requêtes peuvent entraîner Mistral ; aucun contenu privé ne part sans son choix. | Décocher la case. |
| 7 | IA locale dans la chaîne seulement si WebGPU et le modèle Qwen 1,5 Md sont déjà dans le cache de web-llm (`etatModeles`). | Jamais de téléchargement de 1 Go déclenché par un secours. | — |
| 8 | Plafonds internes : Groq 300, OpenRouter 45, Mistral 100 requêtes par jour ; comptés dans le budget total du Noyau seulement si la clé est là (et Mistral activé). | Rester sous les limites gratuites ; le cycle et le sommeil continuent tant qu'un moteur reste. | Réglages `noyau-plafond-<id>`. |
| 9 | Champs de clé dans Noyau → Réglages (`js/noyau/fenetre.js`), sous la phrase sur la clé Gemini ; le champ Gemini lui-même est dans `js/widgets/ai.js` (panneau de l'orbe), **non modifié**. | Ni le champ Gemini ni ces réglages ne sont dans `js/ui/` ; les blocs Claude et relais sont déjà dans `fenetre.js` : ajout le plus petit, sans fichier partagé de la Refonte. | Retirer `secoursBloc` et sa ligne d'appel. |
| 10 | Fichiers partagés touchés : `js/store/vault.js` (une ligne : `destroy` retire aussi `hub-secret-ia-…`) et `tools/tests/t7_charte.py` (test B29 : 3 clés ajoutées). | Consigne : vérifier la couverture du préfixe, sinon la couvrir ; le test doit prouver la règle. | Revenir sur ces deux lignes. |
| 11 | OpenRouter : `HTTP-Referer` = adresse du hub (`hote.racine()`), `X-Title` = « Hub de Lucien ». | En-têtes recommandés par OpenRouter ; aucune donnée personnelle. | Retirer `entetes` dans `SERVICES_SECOURS.openrouter`. |
| 12 | Mistral : `tool_choice: "any"` (au lieu de `"required"`). | Valeur documentée par Mistral pour « appel d'outil obligatoire » ; à confirmer au premier essai réel. | Retirer `choixObligatoire`. |
| 13 | `sw.js` non modifié. | Aucun nouveau module chargé par le hub (`modeles.js` est déjà dans le cache). | — |

## À signaler à Lucien / Commande
- CORS des trois services à vérifier sur Brave au premier essai réel ; domaines à prévoir dans une future CSP (`connect-src`) : `api.groq.com`, `api.mistral.ai`, `openrouter.ai`.
- Les offres gratuites (modèles, limites) viennent de pages datées du 18/10/2026 : elles peuvent changer ; le modèle de chaque service est modifiable dans les réglages.
