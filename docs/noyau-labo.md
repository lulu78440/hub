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
33 sources publiques sans clé, classées en 15 domaines (voir `js/noyau/sources.js`). Le modèle choisit les domaines utiles ; sans choix, seules les encyclopédies générales sont interrogées ; « tout » les interroge toutes. Seuls des mots-clés partent (mails, numéros et noms tirés des souvenirs sont retirés avant l'envoi). Lucien peut couper chaque source dans les réglages. La forme de réponse de chaque API suit sa documentation et se vérifie en direct avec l'onglet « Sources » de `labo.html` ouvert depuis un vrai navigateur (le cadre fermé d'un aperçu bloque ces appels).
