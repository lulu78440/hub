# Labo · moteurs de secours · état

26/10/2026 · poste Labo · Cerveau IA · branche `labo-moteurs` (créée depuis `origin/main`, 7.33.0). Demande de Lucien du 25/10, 23 h 48 : trois IA en ligne de secours, tout automatique.

## Ce qui est construit
- **Adaptateur générique « compatible OpenAI »** (`js/noyau/moteurs.js` · `moteurCompatibleOpenAI`) : format `/v1/chat/completions`, outils `function`, appel direct depuis la page (pas de proxy). La clé ne part que dans l'en-tête `Authorization`, vers l'adresse fixe de son service ; `masquerCle` la retire de tout message d'erreur (même si le service la renvoie). Le relais historique (`moteurLibre`) passe maintenant par ce même adaptateur.
- **Trois moteurs**, au même niveau que Gemini, Claude et le relais (`SERVICES_SECOURS`, `moteurService`) :

| Service | Adresse | Modèle par défaut | Limite gratuite (page datée du 18/10) | Page de la clé |
| --- | --- | --- | --- | --- |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | `openai/gpt-oss-120b` (ou `openai/gpt-oss-20b`) | environ 1 000 requêtes par jour, 30 par minute | console.groq.com/keys |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` (+ `HTTP-Referer`, `X-Title`) | `openai/gpt-oss-20b:free` | 50 requêtes par jour sans crédit, modèles « :free » | openrouter.ai/keys |
| Mistral (Experiment) | `https://api.mistral.ai/v1/chat/completions` | `mistral-small-latest` | gratuit, téléphone vérifié, **les requêtes peuvent servir à l'entraînement** | console.mistral.ai (rubrique API keys) |

  Le modèle de chacun reste modifiable dans les réglages (les offres gratuites changent). Plafond interne par jour, sous la limite du service : Groq 300, OpenRouter 45, Mistral 100 (réglages `noyau-plafond-<id>`).
- **Ordre de secours, automatique** (`moteurAuto`) : par défaut **Gemini → Claude → relais → Groq → OpenRouter → Mistral → IA locale → sans IA**. Réglable (Noyau → Réglages → IA de secours, flèches ↑ ↓, « Ordre par défaut ») ; « sans IA » reste toujours en dernier. Le routage existant peut seulement échanger Gemini et Claude (Claude pour une demande exigeante).
  - On passe au suivant **seulement** sur : erreur réseau ou hors ligne, quota (429, plafond du jour, crédit Claude épuisé), clé absente ou refusée (401/403), délai dépassé (20 s par moteur en ligne). Toute autre erreur (400, refus de sécurité…) remonte : réponse sans IA, pas de secours.
  - Message clair : un toast « IA de secours · Gemini : quota atteint → Groq a répondu. », et sous chaque réponse le moteur et le badge. Si tout échoue, la réponse sans IA dit qui a échoué et pourquoi.
  - **Mistral est coupé par défaut** : il n'est jamais appelé tant que Lucien n'a pas coché « Utiliser Mistral en secours » (avertissement sur l'entraînement à côté).
  - **IA locale** : seulement si un modèle est déjà téléchargé (WebGPU et Qwen 1,5 Md présent dans le cache de web-llm) ; jamais de téléchargement déclenché par le secours.
  - Aucun nouvel outil pour le Noyau ; mêmes consignes, même barrière de permissions, même mémoire : seul le moteur change.
- **Badge honnête** (`ia-regles.js` · `badgeReponse`, affiché par `fenetre.js`) : « En ligne · Groq », « En ligne · OpenRouter », et pour Mistral « En ligne · peut servir à l'entraînement (Mistral) » (étiquette orange). Calculé d'après le moteur qui a réellement répondu.
- **Clés** : coffre, `hub-secret-ia-groq`, `hub-secret-ia-mistral`, `hub-secret-ia-openrouter` ; verrouillage actif exigé (sinon refus, et une clé présente n'est pas utilisée si le coffre est inactif) ; chiffrées (préfixe `hub-secret`) ; jamais exportées (`storage.js` · `SKIP`), jamais synchronisées (la synchro ne prend que les collections) ; retirées à la désactivation du verrouillage (`vault.js` · `destroy` couvre maintenant tout `hub-secret-ia-…`).

## Où Lucien colle ses clés
Noyau → onglet **Réglages** → « IA de secours en ligne (Groq, OpenRouter, Mistral) », juste sous la phrase sur la clé Gemini (la clé Gemini, elle, reste dans le panneau de l'orbe, `js/widgets/ai.js`, non modifié). Pour chaque service : lien de la page de création de clé, limite gratuite en une ligne, champ de clé, « Enregistrer la clé » / « Retirer la clé », modèle, compteur du jour.

## À vérifier au premier essai réel (sur Brave)
- **CORS de chaque service**, appelé directement depuis la page : Groq, OpenRouter, Mistral. Non testable ici (réseau filtré). Si le navigateur refuse, le message dit « Connexion à <service> impossible (réseau, ou CORS refusé par le navigateur) » et le suivant prend le relais.
- Appel d'outils avec `openai/gpt-oss-20b:free` sur OpenRouter (le support des outils varie selon les modèles gratuits) et `tool_choice: "any"` chez Mistral.
- **CSP** : le hub n'a pas encore de Content-Security-Policy. Le jour où elle sera posée, `connect-src` doit autoriser : `https://api.groq.com`, `https://api.mistral.ai`, `https://openrouter.ai` (en plus de Gemini et Anthropic).

## Essais (26/10)
- `node labo/essais-moteurs-secours.mjs` (nouveau, fetch simulé) : 65 vérifications, 0 échec — format de requête et en-têtes des 3 services, lecture de la réponse, codes d'erreur (429, 401, réseau, délai, 400 sans secours), passage au suivant, ordre réglé, Mistral jamais appelé tant qu'il est coupé, badge, plafonds par service, hors ligne, aucune clé dans les journaux, les erreurs, le statut ni les messages, chaque clé envoyée seulement à son service, verrouillage exigé, aucun nouvel outil.
- Les 32 `node labo/essais*.mjs` : tous au vert.
- `python3 tools/tests/run.py charte securite` : 13 réussis, 0 échec (64 cas) ; le test B29 couvre maintenant les 3 nouvelles clés.
- Chromium automatisé (1400 px) : onglet Réglages du Noyau sans erreur de console, liens des 3 pages de clé, ordre de secours affiché.
- `sw.js` : inchangé (aucun nouveau module chargé par le hub ; `modeles.js` y était déjà).

## Fichiers touchés
`js/noyau/moteurs.js`, `js/noyau/noyau.js`, `js/noyau/hote.js`, `js/noyau/ia-regles.js`, `js/noyau/boucle.js`, `js/noyau/fenetre.js`, `labo/hub-simule.js`, `labo/essais-moteurs-secours.mjs` (nouveau), et deux fichiers partagés : `js/store/vault.js` (1 ligne, `destroy`) et `tools/tests/t7_charte.py` (liste des clés du test B29). Aucun fichier de la Refonte (`js/ui/`).
