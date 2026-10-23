# Plan de construction · Phases 3 à 6

24 octobre 2026 · rédigé avec Opus 5.5. Consigne de Lucien (24/10) : enchaîner toutes les étapes sans attendre sa confirmation.
Ce document fixe les décisions prises à sa place ; il fait foi avec le journal de bord (`maquettes/journal-de-bord.md`).

## Règles qui ne changent pas

- 0 €, sans carte bancaire, aucun nouveau compte créé par Claude. Quand un service exige un identifiant de Lucien (jeton, application OAuth), Claude écrit le code et un mode d'emploi court ; Lucien fait l'étape de compte.
- Dépôt public, rien de personnel dedans. Les données restent sur les appareils ; la synchro est chiffrée.
- Les cases du Suivi du Hub sont cochées par Lucien seulement (ce sont ses constats).
- Une version stable par phase (`v3.0.0`, `v4.0.0`…), archive .zip à ranger sur le PC et dans Google Drive.

## Phase 3 · Monde extérieur

Problème : un navigateur ne peut pas lire directement les flux RSS, les pages YouTube ni tester un site d'un autre domaine (blocage CORS).
**Décision** : une tâche programmée **GitHub Actions** dans le dépôt de Lucien (gratuite pour un dépôt public, aucun compte en plus).
Toutes les 20 minutes environ, elle lit les sources de `flux/sources.json`, vérifie les sites surveillés, et publie `flux.json` sur une branche à part `flux` (un seul commit, réécrit à chaque fois, pour ne pas encombrer l'historique). Le hub lit ce fichier sur `raw.githubusercontent.com` (lecture autorisée depuis n'importe quel site).
Limites honnêtes : GitHub peut retarder une tâche programmée de quelques minutes ; les sources et sites surveillés sont visibles publiquement (pas de « ta ville » par défaut pour cette raison).

| Sous-étape | Contenu |
| --- | --- |
| 3.1 | Moteur de flux : `tools/flux.py` (RSS, Atom, flux YouTube, test des sites), workflow `.github/workflows/flux.yml`, sources par défaut (Tech et IA, France, Monde, Jeux vidéo ; chaînes YouTube à ajouter) |
| 3.2 | Bandeau d'actualité défilant (v8), fenêtre Veille (sites en ligne / en panne, nouveaux articles), alerte quand un site tombe, « Modifier les sources » (éditeur GitHub) |
| 3.3 | Médias : Vidéo (lecteur YouTube intégré, vidéos à suivre, grand écran, raccourcis Netflix / Prime), Musique (radios web, playlist YouTube, MP3 du PC), grand écran musique |
| 3.4 | Page en direct : aperçu d'une adresse quand le site l'autorise, sinon lien |
| 3.5 | Synchro PC / Android : export chiffré (AES-GCM, phrase secrète de Lucien) dans un **Gist secret** GitHub, fusion élément par élément (le plus récent gagne, suppressions suivies). Lucien crée un jeton GitHub « Gists » (mode d'emploi dans le hub) |
| 3.6 | Recette, `v3.0.0`, archive |

## Phase 4 · Surprises

Inventées par Opus, gardées secrètes jusqu'à la livraison (cahier des charges). Contraintes : 0 €, fluides sur les deux appareils, désactivables une par une, rien qui envoie de données.

## Phase 5 · Mails importants (lecture seule)

Gmail et Outlook exigent une application déclarée par Lucien (Google Cloud et Microsoft Entra, gratuits). Claude écrit le client (connexion OAuth avec PKCE dans le navigateur, droits **lecture seule** `gmail.readonly` / `Mail.Read`, aucun secret dans le code), les règles de tri, et le mode d'emploi. Les jetons restent sur l'appareil.

## Phase 6 · Assistant IA

0 € sans API payante : modèle d'IA qui tourne dans Brave sur le PC (WebGPU). D'abord relié à l'orbe, ensuite à l'entité. Gros téléchargement unique, pas sur téléphone.
