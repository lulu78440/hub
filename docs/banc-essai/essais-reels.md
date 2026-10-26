# Banc de test · essais réels en attente

Relevé automatique du journal (statuts du 25/10, branche `banc-essai`) : ce que la simulation ne peut pas prouver. À faire par Lucien, sur Brave (PC) et Android ; le Banc prépare, toi seul peux essayer.

| # | Étape | Ce qui manque |
| --- | --- | --- |
| 1 | Correctif radios (7.2.1) | Attend un essai réel · lecture réelle des nouvelles adresses à confirmer ; À tester par Lucien |
| 2 | 5.1 Mails en lecture seule | Attend un essai réel · Livrée (en attente des identifiants de Lucien) |
| 3 | 6.1 IA de l'orbe | Validée par Lucien · case p6-orbe cochée dans le Suivi ; IA locale à essayer sur le PC ; Livrée (à essayer par Lucien sur son PC) |
| 4 | 6.3 Noyau IA avec Gemini | Attend un essai réel · Livrée (en attente de la clé de Lucien) |
| 5 | 7.1b Recherche vocale | Attend un essai réel · micro simulé seulement ; Brave bloque la reconnaissance vocale (p7-voix livrée, non cochée) |
| 6 | N5.5 Limites connues du prototype | Attend un essai réel · À éprouver (étape 5) |
| 7 | N6.1 Aperçu publié | Attend un essai réel · À faire par Lucien |
| 8 | N6.2 Contrôle des sources en direct | Attend un essai réel · En cours |
| 9 | Import du catalogue par lien, radios corrigées, notes importées marquées (versio | Testée en simulation · navigateur automatisé ; à faire passer au Banc de test |
| 10 | N13.0 Carte en arborescence + fenêtre du Noyau retouchée (version 7.10.0, sur `n | Validée par Lucien · case p4-noyau-fenetre cochée dans le Suivi ; test Android à faire |
| 11 | ergo-points : points de réglage des éléments fixes (version 7.23.0) | Attend un essai réel · aucun test noté ; ajout validé par la Commande, pas encore par Lucien |
| 12 | ergo-mobile : réduire au toucher, feuille Outils, fonctions rares masquables (ve | Validée par Lucien · case ergo-mobile cochée dans le Suivi ; testé en émulation, vrai téléphone à essayer |
| 13 | Plan 3 · p3-bureau : icônes flottantes (version 7.25.0) | Attend un essai réel · à valider par Lucien sur son PC |
| 14 | Plan 3 · p3-applis : fenêtres d'applis du bureau (version 7.26.0) | Attend un essai réel · à valider par Lucien sur son PC |

## Essais réels venus du banc d'essai (rapport.md)

| # | Essai | Pourquoi la simulation ne suffit pas |
| --- | --- | --- |
| R1 | Mon PC : ouvrir un .html, .svg et .pdf depuis un dossier autorisé (B7) | l'accès aux dossiers demande un geste réel dans Brave |
| R2 | Mémoire sur 30 min d'usage (PC) | mesurée 3 min seulement |
| R3 | Images/s réelles PC et Android (3D allumée) | le banc n'a qu'un rendu logiciel (2 à 9 img/s, non représentatif) |
| R4 | Synchro réelle PC ↔ téléphone avec le jeton Gists | GitHub simulé seulement |
| R5 | CSP (B15, branche `banc-csp`) sur Brave et Android : les 11 essais de `csp.md` (WebLLM, YouTube, radios, Open-Meteo, connexion Gmail/Outlook…) | une CSP mal réglée casse des fonctions sans prévenir |
| R6 | Désactiver puis réactiver le verrouillage : les clés d'IA sont à recoller (B9, B29) | à confirmer que c'est le comportement voulu |

Après chaque essai, une phrase suffit (« R3 : 58 img/s PC, 31 Android ») : le Banc la reporte dans le journal et le rapport.
