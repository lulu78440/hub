# Banc d'essai · politique de sécurité du contenu (B15)

Préparé sur la branche `banc-csp` (base main 7.31.0, 25/10/2026, poste « Banc de test »). Rien n'est fusionné dans main.
Pas de changement de version : la Commande la montera à la fusion.

## Ce qui change

- `index.html` et `labo.html` : une balise `<meta http-equiv="Content-Security-Policy">` (même politique pour les deux) et `<meta name="referrer" content="no-referrer">`.
- `oauth.html` : une politique à part, fermée (`default-src 'none'`), où seuls son script et son style en ligne peuvent tourner (empreintes sha256), plus `no-referrer`.
- `tools/tests/t9_csp.py` (branché dans `run.py`) : aucune violation pendant la recette.
- Aucun fichier de `js/` ni de `css/` modifié.

## Politique du hub (index.html, labo.html)

```
default-src 'self';
script-src 'self' blob: https://cdn.jsdelivr.net/npm/ https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/ 'wasm-unsafe-eval';
worker-src 'self' blob:;
connect-src 'self' https: data: blob: https://api.groq.com https://api.mistral.ai https://openrouter.ai;
img-src 'self' data: blob: https://i.ytimg.com;
media-src 'self' blob: https:;
frame-src 'self' https:;
style-src 'self' 'unsafe-inline';
font-src 'self';
manifest-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none'
```

## Recensement de ce que le hub charge (lecture de index.html, js/**, sw.js, labo.html, oauth.html)

| Type | Ce qui est chargé | Où dans le code |
| --- | --- | --- |
| Scripts | modules du site (`js/main.js`, `js/ui/labo-bouton.js`, `labo/labo.js`, imports dynamiques), three.js et ses extensions dans `vendor/` (balises `<script>` posées par `js/scene/loader.js`) | index.html, labo.html, loader.js |
| Scripts d'un CDN | WebLLM 0.2.85, Transformers.js 3.0.2, Piper (`@mintplex-labs/piper-tts-web@1.0.4`) par `import()` sur `cdn.jsdelivr.net/npm/…/+esm` | ai.js, moteurs.js, worker-ia.js, sens.js, piper.js |
| Scripts en ligne | aucun dans index.html et labo.html (aucun `onclick=`, aucun `javascript:`) ; un seul dans oauth.html | — |
| eval | aucun `eval()` ni `new Function` dans le code du hub ni dans `vendor/three` | grep |
| Workers | `js/noyau/worker-ia.js` (module, même site) ; les bibliothèques d'IA créent leurs propres workers, en `blob:` quand elles viennent d'un CDN (onnxruntime-web) | socle.js |
| WebAssembly | onnxruntime-web (Transformers.js, Piper) et la bibliothèque TVM de WebLLM | sens.js, worker-ia.js |
| WebGPU | WebLLM et Transformers.js (`navigator.gpu`) : ce n'est pas une ressource, la CSP ne le règle pas | moteurs.js, sens.js |
| Styles | `css/*.css` ; `<style>` en ligne de labo.html ; `<style>` créés par le code (personnalisation du Noyau, surprises) ; attributs `style=` dans les gabarits HTML (tuiles, météo, rituels…) et `element.style` | hote.js, surprises.js, tuiles.js, weather.js… |
| Polices | `fonts/*.woff2` du site | css/base.css, labo.html |
| Images | `icons/` ; `data:` (masque SVG de hud.css, images importées) ; `blob:` (images du bureau) ; vignettes `https://i.ytimg.com` | images.js, storage.js, media.js |
| Médias | radios en https de domaines variés (Radio France, SomaFM, Infomaniak, et toute radio ajoutée par Lucien ou le Coffre) ; MP3 du PC et voix Piper en `blob:` | media.js, piper.js |
| Cadres | lecteur `https://www.youtube-nocookie.com/embed/…` ; page en direct (toute adresse https choisie par Lucien, `sandbox`) | media.js, webview.js |
| Connexions | Open-Meteo (prévision et géocodage), BigDataCloud, api.github.com (Gists, Sentinelle) et `gist.githubusercontent.com` (raw_url), raw.githubusercontent.com (flux RSS publié, veille), Gemini, Claude, Groq, Mistral, OpenRouter, Cerebras, Gmail, Microsoft (jeton et Graph), une trentaine de sources publiques du Noyau (Wikipédia, Wikidata, OpenAlex, Crossref…), toute page https lue par l'outil `lire_page`, Hugging Face et ses CDN pour les modèles ; `data:` (images réimportées) ; `docs/suivi.json`, `docs/manuel/` | weather.js, sync.js, flux.js, veille.js, moteurs.js, mail.js, sources.js, outils.js, storage.js |
| Manifest et service worker | `manifest.webmanifest`, `sw.js` (même site ; le service worker n'intercepte que les adresses du site) | index.html, diag.js |
| Liens sortants | `window.open` et liens `target=_blank` (recherche, favoris, connexions Google/Microsoft) : la CSP ne les règle pas | search.js, mail.js… |

## Justification de chaque source

| Directive | Valeur | Pourquoi |
| --- | --- | --- |
| `default-src` | `'self'` | Tout ce qui n'est pas listé ne vient que du site. |
| `script-src` | `'self'` | modules du hub, three.js de `vendor/`. |
| | `https://cdn.jsdelivr.net/npm/` | WebLLM, Transformers.js, Piper (versions figées dans le code). Limité au chemin `/npm/` : pas les autres miroirs de jsDelivr (`/gh/`, `/wp/`…). |
| | `https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/` | Piper charge par défaut onnxruntime-web depuis cdnjs (à confirmer sur Brave, voir plus bas). Limité à cette seule bibliothèque. |
| | `blob:` | onnxruntime-web, chargé depuis un CDN, recharge sa colle Emscripten et ses workers depuis une adresse `blob:` (documentation officielle « Deploying ONNX Runtime Web »). |
| | `'wasm-unsafe-eval'` | WebAssembly (onnxruntime-web, TVM de WebLLM). N'autorise que la compilation de WebAssembly, pas `eval()`. |
| | pas de `'unsafe-eval'` | Aucun `eval`/`new Function` dans le hub. WebLLM et Transformers.js publient des exemples d'extension Chrome (Manifest V3, où `'unsafe-eval'` est interdit et seul `'wasm-unsafe-eval'` est permis), ce qui indique qu'elles s'en passent. **Non vérifié dans le code exact de 0.2.85 et 3.0.2** : jsDelivr, unpkg et npm sont bloqués dans l'espace de travail, impossible de lire les fichiers. À confirmer sur Brave (essai 2). |
| | pas de `'unsafe-inline'` | Aucun script en ligne. Témoin du test : un script en ligne est refusé. |
| `worker-src` | `'self' blob:` | worker du Noyau ; workers `blob:` des bibliothèques d'IA. |
| `connect-src` | `'self' https: data: blob:` | **Élargissement 1** (voir plus bas). |
| | `https://api.groq.com https://api.mistral.ai https://openrouter.ai` | Demande de la Commande (25/10) : moteurs d'IA en ligne de secours du Noyau (branche `labo-moteurs`), avec les clés de Lucien gardées dans le coffre. Déjà couverts par `https:` ; écrits en clair pour rester autorisés si `https:` est un jour remplacé par une liste fermée. |
| `img-src` | `'self' data: blob: https://i.ytimg.com` | icônes ; masque SVG en `data:` et images réimportées ; images du bureau en `blob:` ; vignettes YouTube. |
| `media-src` | `'self' blob: https:` | **Élargissement 2**. |
| `frame-src` | `'self' https:` | **Élargissement 3**. |
| `style-src` | `'self' 'unsafe-inline'` | **Élargissement 4**. |
| `font-src` | `'self'` | polices du site uniquement (aucune police d'un autre site). |
| `manifest-src` | `'self'` | manifest de l'application installée. |
| `object-src` | `'none'` | aucun `<object>`/`<embed>` (témoin du test). |
| `base-uri` | `'none'` | empêche un `<base>` injecté de détourner les adresses relatives. |
| `form-action` | `'none'` | tous les formulaires du hub sont traités par le code (`preventDefault` vérifié sur les 33) ; un formulaire injecté ne peut rien envoyer. |

## Élargissements et leur raison

1. **`connect-src https:`** : les connexions viennent de beaucoup d'endroits (une trentaine de sources publiques du Noyau, quatre relais d'IA, Gmail et Microsoft, Gists et leurs `raw_url`, modèles de Hugging Face servis par ses CDN), et l'outil `lire_page` lit **n'importe quelle page https** sur accord de Lucien. Une liste fermée casserait `lire_page` et chaque nouvelle source. `data:` : réimport des images (storage.js lit une adresse `data:image/…` par `fetch`). `blob:` : lecture de fichiers locaux par les bibliothèques d'IA. Le `http:` en clair reste refusé.
2. **`media-src https:`** : les radios sont des flux https de domaines variés, et Lucien (ou le Coffre) peut en ajouter n'importe lequel. `blob:` : MP3 du PC et voix Piper.
3. **`frame-src https:`** : la page en direct affiche n'importe quelle adresse https choisie par Lucien (déjà dans un `sandbox`, sans `allow-same-origin` pour une page du même site). Le lecteur YouTube passe par là aussi.
4. **`style-src 'unsafe-inline'`** : le hub pose des attributs `style=` dans ses gabarits HTML (tuiles, météo, rituels…), des `<style>` créés par le code (personnalisation du Noyau, surprises) et labo.html a un `<style>` en ligne. Sans `'unsafe-inline'`, la recette PC et mobile casse (contre-épreuve faite : le test rougit). Le risque est faible (pas d'exécution de code par le CSS) ; le retirer demanderait de modifier `js/` et `css/` (hors de cette mission).

## Limites d'une CSP en `<meta>`

- Pas de `frame-ancestors` (empêcher qu'un autre site affiche le hub dans un cadre), pas de `report-uri`/`report-to`, pas de `sandbox` : ignorés en `<meta>`. GitHub Pages ne permet pas d'envoyer de vrais en-têtes HTTP.
- La politique ne s'applique qu'à partir de la balise : elle est placée juste après `<meta charset>`, avant tout chargement.
- `sw.js` (service worker) n'a pas de CSP propre (en-têtes HTTP impossibles) ; il ne charge que des fichiers du site.
- Le worker du Noyau (`worker-ia.js`, même site) hérite de la politique de la page en Chromium ; les workers `blob:` aussi.

## Referrer

`no-referrer` sur toute la page : les sites visités, les API et les radios ne voient plus l'adresse du hub. Le lecteur YouTube garde son propre réglage (`referrerpolicy="strict-origin-when-cross-origin"` sur l'iframe, déjà dans media.js) : un attribut posé sur un élément l'emporte sur la politique de la page, donc YouTube reçoit toujours l'origine dont il a besoin (sinon « erreur 153 »). À confirmer sur Brave (essai 4).

## oauth.html

`default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…'; base-uri 'none'; form-action 'none'; object-src 'none'`.
La page ne charge rien : seuls son script (relais du jeton au hub, même site) et son style peuvent tourner, par empreinte. **Si on modifie le script ou le style de oauth.html, il faut recalculer les deux empreintes** (sinon la connexion Gmail/Outlook ne revient plus au hub) ; le test `test_csp_labo_et_connexion_sans_violation` le signale.

## Test automatique (`tools/tests/t9_csp.py`)

- Recette PC, recette mobile et médias / page en direct de `t2_fonctions.py` rejouées telles quelles, avec écoute de `securitypolicyviolation` (liaison Playwright) et des messages de console de Chromium.
- Sonde de ce que la recette n'atteint pas (pas de réseau ni de carte graphique dans le banc) : imports des bibliothèques d'IA, module `blob:`, WebAssembly, worker du Noyau et worker `blob:`, neuf connexions (Open-Meteo, BigDataCloud, GitHub, flux, Gemini, Claude, Groq, Hugging Face, Wikipédia), `fetch` de `data:`, radio https et MP3 `blob:`, vignette YouTube, images `data:`/`blob:`, `<style>` créé par le code, cadres YouTube et page en direct. Le banc bloque ensuite le réseau : seule la CSP est jugée.
- Témoins qui doivent être refusés : `eval()`, `new Function`, script d'un autre site, script en ligne, `<embed>`.
- labo.html et oauth.html (jeton factice effacé de l'adresse).
- Contre-épreuve faite : en retirant `https://i.ytimg.com`, `media-src https:` et `'unsafe-inline'` des styles, les cinq tests échouent sauf celui du labo.

## Résultats (25/10, banc-csp)

- `python3 tools/tests/run.py` complet : **57 réussis, 0 échec sur 57 tests (2 026 cas) en 799 s** (dont les 5 de `t9_csp.py` ; `test_confort_contrastes` vert lui aussi). `t9_csp.py` rejoué après l'ajout de Groq, Mistral et OpenRouter : 5/5.
- `node labo/essais*.mjs` : 30 fichiers, tous « Tout est bon » ; `essais.mjs` : 44 réussis, 0 raté, 15 sautés (moteur réel requis) sur 59.

## Ce qui reste à essayer sur Brave (PC) et Android

Le banc tourne sur Chromium sans réseau extérieur, sans carte graphique ni Brave : les points suivants ne peuvent être vérifiés que sur les vrais appareils. Pour chacun : ouvrir la console (F12 → Console) et chercher « Content Security Policy ».

1. **Chargement à froid** (PC et Android) : aucun message CSP ; plans, 3D, polices, icônes normaux ; mode hors ligne après un premier passage.
2. **IA locale WebLLM** (PC, WebGPU) : télécharger et lancer un modèle depuis le Chat IA et depuis le Noyau. Si un message cite `'unsafe-eval'`, noter la ligne : c'est le seul cas où il faudrait l'ajouter.
3. **Recherche par le sens** (Transformers.js), **dictée Whisper** et **voix Piper** : premier téléchargement puis usage. Si un message cite une adresse non listée (autre CDN que jsDelivr/cdnjs pour onnxruntime ou la phonétisation de Piper), noter l'adresse : elle s'ajoute à `script-src`.
4. **Vidéo YouTube** : lecture d'une vidéo et d'une playlist (vérifier qu'il n'y a pas d'« erreur 153 »), vignettes visibles.
5. **Radios** : FIP, France Inter, SomaFM, Nova ; une radio ajoutée à la main.
6. **Page en direct** : fr.wikipedia.org.
7. **Météo** : position automatique (BigDataCloud) et ville tapée (Open-Meteo).
8. **Synchro Gists** (PC ↔ téléphone), **Gemini**, **Claude**, **relais gratuits** : un échange chacun.
9. **Connexion Gmail ou Outlook** : la fenêtre de retour (oauth.html) doit se fermer seule et les mails s'afficher.
10. **Labo** (labo.html) : ouverture, banc, onglets.
11. **Boucliers de Brave** : vérifier que rien ne change avec les boucliers en mode strict.

Si quelque chose casse : retirer la ligne `<meta http-equiv="Content-Security-Policy" …>` de la page rétablit l'ancien comportement immédiatement.

Sources consultées : [Deploying ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/deploy.html) (workers `blob:` depuis un CDN, environnements CSP), [Chrome · Manifest Content Security Policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) (`'wasm-unsafe-eval'` sans `'unsafe-eval'`), [YouTube error 153](https://wpsecurityninja.com/docs/errors-and-debugging/troubleshooting-youtube-embed-issues-error-153/) (référent exigé par le lecteur).
