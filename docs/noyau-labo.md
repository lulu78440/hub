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
| noyau-1.3 | 25/10/2026 | Ton humain (désaccord constructif, validation affective, sans question réflexe, sans répétition), recherche tolérante (synonymes, « -mot »), curiosité autonome guidée par le programme, sauvegarde chiffrée vers un dossier du PC, alerte fichier modifié sans commit, suggestion du soir, plan de test dans le labo | 44 réussis, 0 raté, 15 sautés (moteur réel requis) sur 59 ; essais recherche, curiosité, sauvegarde, sentinelle, usages, labo : tous bons |
| noyau-1.11 | 25/10/2026 | Veille sur GitHub (tâche programmée toutes les 2 h, import facultatif dans « À valider ») | essais-veille : tous bons |
| noyau-1.10 | 25/10/2026 | Veille d'étude (opt-in) : une étude toutes les 8 min, écran maintenu allumé, garde-fous, rapport du matin | essais-veille : tous bons |
| noyau-1.9 | 25/10/2026 | Synchro : fusion des journaux sans écrasement ; recherche par le sens (facultative) ; voix naturelle Piper (facultative) ; interruption à la voix | essais-sync, essais-sens, essais-voix : tous bons |
| noyau-1.8 | 25/10/2026 | Orbe branchée sur le Noyau ; vue vocale plein écran ; bouton Labo (clic humain seulement) et labo fermé au Noyau ; test de validation avec contrôle d'exactitude par un modèle ; lecture des radars ; clés reprises depuis le coffre dans le labo | tous les essais bons (dont essais-labo-ferme) |
| noyau-1.7 | 25/10/2026 | Carte en arborescence (fibres qui se divisent, faisceaux) ; fenêtre du Noyau : barre fine, liseré qui pulse | tous les essais bons |
| noyau-1.6 | 25/10/2026 | Carte : orbe centrale et flux de données, domaines proches voisins, vue occupée ; test automatique de validation d'un point de connaissance (bouton « Réaliser le test pour valider ce point ») | essais-savoir : tous bons ; banc 44/0/15 |
| noyau-1.5 | 25/10/2026 | Carte neuronale (neurones à dendrites, axones qui crépitent, influx par salves en cours d'apprentissage et réguliers une fois validé), relais gratuit compatible OpenAI (Groq, Mistral, OpenRouter, Cerebras), onglet Visuel du labo (carte, radars, courbes) | essais-moteurs : tous bons ; banc 44/0/15 |
| noyau-1.4 | 25/10/2026 | Moteur Claude (API Messages, clé dans le coffre, facultative) et routage automatique Gemini/Claude selon la complexité et les jetons restants ; mémoire, cerveau et réactions inchangés | essais-moteurs : tous bons ; banc 44/0/15 |

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


## Intégrations tirées du « Cerveau v4.0 » analysé le 25/10
- Repris : contradiction constructive avec cession sur insistance (jamais pour les actions interdites), validation affective avant les listes et 3 priorités maximum, pas de question réflexe en fin de réponse, non-répétition (le modèle reçoit ses 3 dernières réponses ; le Noyau mesure les questions de fin et les répétitions : visibles dans l'onglet Progression), synonymes et exclusion « -mot » dans la recherche, sauvegarde chiffrée automatique vers un dossier du PC.
- Gardé pour plus tard : embeddings locaux sur le GPU, voix neuronale locale (Piper), Wikipédia complet hors ligne (fichier ZIM de 34 Go), synchronisation PC et téléphone chiffrée, dialogue vocal full-duplex.
- Refusé : boucle d'auto-amélioration toutes les 6 s (budget de requêtes), auto-réécriture du fichier .html (le Noyau ne modifie jamais son code), proxy anti-CORS ou serveur local aspirant des sites (sécurité), « 721 savoirs » non vérifiés (seules comptent les fiches sourcées validées), scores auto-attribués.
## Curiosité autonome (noyau-1.3)
Coupée par défaut ; interrupteur dans la fenêtre Savoir. Quand elle est active : une étude au plus toutes les 30 min et 6 par jour, du prochain sous-thème du programme (domaine déjà entamé en priorité, jamais deux fois le même en 7 jours), jamais en Focus, la nuit, pendant un média ou écran verrouillé, jamais si « À valider » compte déjà 12 propositions, sans requête Gemini. Les fiches attendent ta validation.
## Sauvegarde dans un dossier du PC (noyau-1.3)
Réglages du Noyau → Sauvegarde automatique. Dossier choisi par Lucien (File System Access API : Chrome, Edge, Brave sur PC), une sauvegarde par jour hub ouvert, chiffrée si le verrouillage est actif, 7 gardées. Le navigateur peut demander de réautoriser le dossier après un redémarrage : le Noyau le signale. Le Noyau n'a toujours aucun outil pour exporter ; seuls le bouton et la veille appellent cette fonction.


## Moteur Claude et routage automatique (noyau-1.4)
Les deux moteurs reçoivent la même instruction système, les mêmes outils et la même mémoire : seule la forme des messages change (conversion dans `moteurs.js`). Chaque moteur a ses propres plafonds (Gemini : requêtes ; Claude : 20 requêtes et 60 000 jetons par jour). En mode Auto, `complexite()` note la demande de 0 à 4 : à partir de 2 elle part chez Claude, sinon chez Gemini (gratuit) ; le seuil monte quand les jetons Claude sont presque épuisés. En cas de quota, de crédit ou de réseau, l'autre moteur prend le relais. Sans clé Claude, rien ne change. L'API Claude est payante et le contenu part chez Anthropic, comme chez Google pour Gemini.

## Relais gratuit et carte neuronale (noyau-1.5)
Le relais n'est consulté qu'en dernier, quand Gemini et Claude échouent ou sont absents ; il a son propre plafond (30 requêtes par jour). La clé est chiffrée par le coffre et ne figure jamais dans le dépôt. La carte neuronale ne connecte que les sous-thèmes entamés : ils crépitent par salves tant que l'apprentissage est en cours, puis envoient des influx réguliers une fois validés. L'onglet Visuel du labo montre la même carte, une démonstration animée, les radars des notes et les courbes du banc.

## Test de validation (noyau-1.6)
Lucien demande le test sur un sous-thème ; le Noyau s'interroge lui-même, sans requête ni jeton. Pour chaque fiche (4 au plus) : retrouve-t-il la fiche à partir d'une phrase dont un mot clé est masqué, retrouve-t-il ce mot dans la fiche, la source est-elle indiquée, aucune fiche voisine ne la contredit-elle. Seuil : 75 % des questions et au moins une fiche qui réussit tout. Si le test est réussi, les fiches qui ont tout réussi sont validées seules (propositions gardées, fiches existantes marquées vérifiées, journalisé) ; sinon rien n'est validé. Si le sous-thème n'a aucune fiche, le Noyau l'étudie d'abord. Limite assumée : le test mesure la présence, la retrouvabilité et la sourcing des connaissances, pas leur exactitude, qui dépend de la source.

## Orbe, voix et laboratoire fermé (noyau-1.8)
- **Orbe sur le Noyau** : par défaut, le chat de l'orbe passe par le Noyau (`js/noyau/pont.js` n'expose que « poser une question »). Les anciens moteurs (Gemini direct, local) restent au choix dans l'engrenage de l'orbe.
- **Vue vocale** : bouton « Parler » (barre du haut) ou menu du fond. Écoute, réponse du Noyau, lecture à voix haute, puis nouvelle écoute. Le micro ne démarre que sur un geste ; Brave bloque la dictée (ouvrir dans Chrome).
- **Labo fermé** : le bouton « Labo » ne réagit qu'à un vrai clic (`isTrusted`). La barrière refuse toute action dont un paramètre vise le laboratoire, et refuse les demandes en texte de l'ouvrir ou de le modifier (famille « accès au laboratoire »).
- **Test exigeant** : après le test local, un modèle confirme l'exactitude des fiches (1 requête par test). Réglable (« Test de validation exigeant »). Sans modèle disponible, rien n'est validé en mode exigeant.
- **Lecture des radars** : au moins 5 notes par labo ; les critères sous 3,5 donnent une piste de réglage et une demande à copier pour Claude. Le Noyau ne s'ajuste jamais seul.
- **Clés sans les retaper** : dans le hub, elles sont enregistrées une fois dans le coffre (Réglages), chiffrées, et reprises à chaque déverrouillage. Dans le labo, onglet Moteur, « Reprendre mes clés » les relit du coffre avec ta phrase secrète.

## Options avancées (noyau-1.9)
- **Synchro PC/téléphone** : la mémoire du Noyau est dans la collection `kv`, déjà portée par la synchro du hub (Gist secret chiffré). Les journaux (ajout seul) étaient exposés à l'écrasement quand deux appareils écrivaient ; `js/store/fusion.js` fait maintenant l'union des lignes par identifiant (idempotente, commutative).
- **Recherche par le sens** (`sens.js`) : modèle `multilingual-e5-small` chargé depuis Hugging Face (≈120 Mo) sur accord ; les vecteurs restent dans une base locale hors synchro ; fusion avec BM25 (60 % mots, 40 % sens). Désactivée par défaut. Chargeur injectable, essais avec un faux modèle ; non testée sur un vrai WebGPU.
- **Voix Piper** (`piper.js`) : `@mintplex-labs/piper-tts-web` et voix `fr_FR-siwis-medium` (≈60 Mo) sur accord ; repli automatique sur la voix du système. Non testée avec un vrai téléchargement.
- **Interruption à la voix** : micro ouvert pendant que l'orbe parle, écho de sa propre voix filtré (plus de 60 % de mots communs). Réglage « Interruption à la voix ».
- **Kiwix** : non fait. Il faut un fichier ZIM (plusieurs Go) et un serveur local lancé par Lucien ; la liste des sources reste fixe et publique.

## Veille d'étude (noyau-1.10)
Réglages → « Veille d'étude » → « Lancer la veille d'étude » (geste de Lucien obligatoire). `veille.js` : une étude du programme toutes les 8 minutes, 40 par jour au plus, résumé local (0 requête de modèle), fiches déposées dans « À valider » (jamais validées seules). Écran maintenu allumé (Wake Lock). Arrêts : hors ligne, batterie < 20 % hors charge, 20 propositions en attente, plafond du jour. Rapport du matin émis à la première ouverture. Limite : un navigateur ne tourne pas hors écran allumé ; la veille 24 h/24 (GitHub Actions) n'est pas faite.

## Veille sur GitHub (noyau-1.11)
`.github/workflows/veille.yml` + `tools/veille.mjs` : toutes les 2 heures, GitHub étudie 8 sous-thèmes du programme (même liste fixe de sources publiques, même résumé local que le hub, aucune clé, aucune donnée personnelle) et publie `veille.json` sur la branche `veille` (un seul commit réécrit, comme le flux). Le hub, si Lucien active « Lire les fiches préparées par GitHub », importe chaque heure les nouvelles fiches dans « À valider » (plafond 20, jamais de validation automatique). Non testé en réel : le bac à sable de Claude n'atteint pas les sources ; premier passage à lancer à la main (Actions → Veille d'étude → Run workflow).
