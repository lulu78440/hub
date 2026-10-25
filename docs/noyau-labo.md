# Noyau · cahier du laboratoire

Cahier public du laboratoire du Noyau (annexe A du contrat). Aucune donnée personnelle : les scénarios et le hub fictif sont génériques.

## Ce qu'est le laboratoire
- `labo.html` : le Noyau monté sur un **hub fictif** (`labo/hub-simule.js`), avec les mêmes modules que dans le hub et la même barrière de permissions.
- **Moteur** : « Démonstration » (aiguillage à mots-clés, sans modèle ni clé, pour voir la mécanique) ou « Gemini réel » (clé du laboratoire gardée en mémoire de la page, jamais écrite).
- **Banc d'essai** (`labo/scenarios.json`, `labo/banc.js`, `node labo/essais.mjs`) : scénarios mécaniques (modèle simulé, aucune requête) et scénarios « réels » (vraie clé, consomment du quota).
- **Inspecteur** : pour chaque tour, souvenirs rappelés, état du monde injecté, appels au modèle, outils, réponse structurée et vérification.

## Versions
| Version | Date | Contenu | Banc mécanique |
|---|---|---|---|
| noyau-0.9 | 24/10/2026 | Prototype complet : barrière, cycle, mémoires, import v3.8, fenêtre, labo | 32 réussis, 0 raté, 5 sautés (moteur réel requis) sur 37 |
| noyau-1.0 | 24/10/2026 | 33 sources de référence par domaine, onglet Sources du labo (contrôle en direct), sources coupables dans les réglages, essais de sources (`node labo/essais-sources.mjs`) | 32 réussis, 0 raté, 6 sautés sur 38 ; essais de sources : tous bons |
| noyau-1.2 | 25/10/2026 | Carte 3D du savoir (16 domaines, 110 sous-thèmes), usages du quotidien (capture, rappels, briefing, revue du soir, recherche globale, résumé de fenêtre, hors ligne, sauvegarde), sentinelle et sécurité, labos social et réflexion, historique et progression | 40 réussis, 0 raté, 14 sautés (moteur réel requis) sur 54 ; essais : savoir, usages, labo, sources tous bons |

## Hypothèses à éprouver
1. Flash-Lite suffit-il pour le cycle outil → réponse structurée, ou faut-il Flash ?
2. La confiance déclarée par le modèle est-elle bien calibrée (la vérification locale la corrige-t-elle assez) ?
3. Le rappel (BM25 + importance + récence) ramène-t-il les bons souvenirs sur de vraies questions ?
4. Le modèle admet-il ne pas savoir plutôt que d'inventer (scénarios « réels » de franchise) ?

## Résultats
Aucun encore sur un vrai modèle : voir étape 5.

## Notes d'exploitation
- Conseil : une **deuxième clé Gemini** (projet distinct) pour le labo, afin de ne pas consommer le quota de l'orbe. Sans cela, plafond de 15 requêtes par jour pour les essais.
- Le banc rejoue toujours sur des hubs fictifs tout neufs : il ne touche jamais aux données du hub réel.

## Sources de référence
30 sources publiques sans clé (33 au départ ; Semantic Scholar, Bibliothèque du Congrès et Art Institute of Chicago retirées après contrôle en direct : « Failed to fetch »), classées en 15 domaines (voir `js/noyau/sources.js`). Le modèle choisit les domaines utiles ; sans choix, seules les encyclopédies générales sont interrogées ; « tout » les interroge toutes. Seuls des mots-clés partent (mails, numéros et noms tirés des souvenirs sont retirés avant l'envoi). Lucien peut couper chaque source dans les réglages. La forme de réponse de chaque API suit sa documentation et se vérifie en direct avec l'onglet « Sources » de `labo.html` ouvert depuis un vrai navigateur (le cadre fermé d'un aperçu bloque ces appels).


## Laboratoire : progression réelle, deux labos (noyau-1.2)
Onglets de `labo.html` ajoutés :
- **Progression** : santé du Noyau (taux de réussite du dernier banc, courbe des lancements, détection de régression avec les nouveaux échecs), **feuille de route** (`labo/feuille-de-route.js` : le pourcentage est le nombre d'étapes faites sur le total ; les étapes « mesurées » ne passent à « faite » que quand la mesure réelle atteint la cible), métriques des réponses (latence médiane, requêtes, part de réflexes, confiance « haute » appuyée par une source), bilan des 7 derniers jours avec suggestions fondées sur les mesures.
- **Labo social** et **Labo réflexion** : 8 situations chacune (`labo/situations.js`), grille de 5 critères notés de 1 à 5 par Lucien (social : chaleur, ton juste, sobriété, honnêteté, initiative ; réflexion : raisonnement, prudence, sources, utilité, concision), moyennes avec tendance (5 dernières notes contre les 5 précédentes), **comparateur A/B** de deux consignes d'essai (2 requêtes Gemini ; la consigne n'est jamais gardée).
- **Idées & état** : boîte à idées (copiable comme demande pour Claude, avec le contexte mesuré), export / import de l'état du labo (fusion sans doublon).
- Pastille **Santé** dans l'en-tête.
L'état est gardé dans le navigateur (`labo/etat-labo.js`, localStorage si disponible). Il ne contient ni clé ni donnée du vrai hub. Essais : `node labo/essais-labo.mjs`.
Banc : familles ajoutées `usages` (8 scénarios mécaniques sans requête), `social` (4) et `reflexion` (4) en mode réel.
Limite assumée : les notes de Lucien mesurent la perception de la qualité, pas une vérité ; les critères automatiques du banc réel ne repèrent que des défauts grossiers (flatterie, affirmation sans prudence).
