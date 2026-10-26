# Noyau orchestrateur · décisions

Règle 13 : décisions prudentes et réversibles. Chacune peut être défaite sans toucher aux données de Lucien.

| Date | Décision | Pourquoi | Pour revenir en arrière |
| --- | --- | --- | --- |
| 25/10 | Lot 2 limité aux quatre vues `courbe`, `barres`, `tableau`, `chiffre_cle`, plus `filtres`, `piedSources` et `exporter` | Demande de Lucien ; `Plan`, `EtatVide`/`Erreur` réutilisable, export JSON et PNG viennent avec les lots 5 et 6 | Rien à défaire |
| 25/10 | Aucun outil du Noyau : `afficherComposant` est une méthode de la fenêtre, appelable par le code | `afficher_module` attend la validation de Lucien et son niveau | Retirer la méthode et l'import dans `fenetre.js` |
| 25/10 | Source obligatoire = nom, date de mise à jour, unité, période ; lien, licence et date de requête facultatifs | Les quatre champs demandés ; une donnée locale peut ne pas avoir de lien | Durcir `verifierJeu` |
| 25/10 | Lien de source en `https` seulement, sans identifiants | Pas de lien `javascript:` ni non chiffré | Assouplir `adresse()` |
| 25/10 | Aucune conversion silencieuse : un nombre écrit en texte, `NaN`, une date inexistante ou une catégorie en double sont refusés ; une valeur manquante reste « — » ou « n.d. », jamais 0 | « Aucun chiffre inventé » | — |
| 25/10 | Export uniquement si `event.isTrusted` | Un clic simulé par le code (donc par le Noyau) ne peut pas exporter | Retirer le test dans `exporter()` |
| 25/10 | CSV en « ; », point décimal, BOM UTF-8, CRLF, nombres en pleine précision, cellules commençant par `= + - @` préfixées d'une apostrophe | Ouverture correcte dans un tableur français, sans formule exécutée ni arrondi caché | Changer `versCSV` |
| 25/10 | Axe y de la courbe arrondi aux valeurs rondes autour des données (sans zéro forcé) ; barres toujours depuis zéro | Une courbe montre une évolution ; une barre qui ne part pas de zéro trompe | Option `zero` de `domaine()` |
| 25/10 | Couleurs des séries prises dans le thème, en dur dans le module (valeurs de `--cyan`, `--amber`…) | Le SVG exporté doit rester lisible hors du hub ; contrastes vérifiés par l'essai | Brancher sur les variables CSS à la relecture Refonte |
| 25/10 | `js/noyau/modules/composants.js` ajouté au cache hors ligne de `sw.js` sans changer la version | Importé par `fenetre.js` ; la version est montée par la Commande à la fusion | Retirer la ligne |

## Lot 3 · registre d'outils (26/10)
| Date | Décision | Pourquoi | Pour revenir en arrière |
| --- | --- | --- | --- |
| 26/10 | Les 6 outils entrent dans `OUTILS_VALIDES` avec les niveaux demandés par Lucien (5 LIBRE, `enregistrer_module` CONFIRMATION). Aucun autre outil. | Validation de Lucien le 26/10 ; la règle « aucun outil sans validation » reste la seule porte | Retirer les 6 noms de `OUTILS_VALIDES` : la règle écarte les outils |
| 26/10 | **Le modèle ne passe que des références** `jeu:…` ; paramètres `jeu` et `avec` contraints par un motif, nombre ou liste de nombres refusés ; le résumé rendu au modèle ne contient que premier, dernier et extrêmes (avec leur date) | « Jamais des chiffres » : le modèle ne peut pas inventer ni recopier une série | Élargir le résumé dans `resumeJeu` |
| 26/10 | Les jeux vivent **en mémoire de la page** (30 au plus), pas dans le stockage ; seul `enregistrer_module`, avec l'accord de Lucien, en garde une copie | Rien n'est écrit sans accord ; un rechargement efface les jeux | — |
| 26/10 | Les modules d'orchestration sont chargés **à la demande** (`import()`), `registre.js` seul est importé au démarrage | Pas de cycle d'imports (`routines.js` ↔ `outils.js`), démarrage du Noyau inchangé | Passer en imports statiques |
| 26/10 | **Plans : jusqu'à 6 outils dans UN tour**, références `$N.champ` (valeur entière d'un paramètre). Pas de nouvel outil « plan ». | « Des plans de 6 étapes au lieu de 3 tours » ; un plan n'est pas un droit nouveau | Remettre `MAX_OUTILS_PAR_APPEL` à 4 dans `boucle.js` |
| 26/10 | **Écart avec le plan écrit du lot 4** : un échec n'arrête pas tout le plan ; chaque étape reste jugée et journalisée séparément, et seule une étape qui dépend (`$N`) d'une étape en échec ou refusée n'est pas exécutée | Un essai de sécurité existant (page piégée) exige que chaque appel soit jugé par la barrière et journalisé ; sauter les autres aurait caché des refus | Ajouter un arrêt à la première erreur dans `executerPlan` |
| 26/10 | **Écart avec le plan écrit du lot 4** : pas de fenêtre « plan complet » ; chaque étape CONFIRMATION redemande son accord, avec source et période dans la demande | Pas d'interface nouvelle (hors de mes fichiers) ; plus sûr, jamais moins | Lot 4 avec la Refonte |
| 26/10 | Les drapeaux (`lecture_seule`, `reversible`, `monde_ouvert`, `idempotent`) **ne peuvent que durcir** un niveau ; `reversible: false` = interdit au Noyau ; un outil incohérent est écarté du catalogue | Le niveau validé par Lucien reste la référence | Retirer `controlerCatalogue` dans `creerCatalogue` |
| 26/10 | `sortie_schema` vérifié par la barrière après l'exécution ; un résultat non conforme est une ERREUR journalisée | Résultats structurés fiables | Retirer les 3 lignes dans `barriere.js` |
| 26/10 | Sources de données en **liste fixe** de 3 (DBnomics, Banque mondiale, « publie »), adresses construites par le code, https et hôte de la liste, 2 Mo, 10 s, 30 appels par minute | Pas de proxy, pas de clé, pas de compte ; pas d'URL libre donnée par le modèle (contrairement à `lire_page`, qui demande l'accord) | Retirer une entrée de `SOURCES_DONNEES` |
| 26/10 | **Melodi (INSEE) non branchée** ; l'INSEE passe par DBnomics | Format et CORS impossibles à vérifier depuis l'atelier : je n'écris pas un adaptateur à l'aveugle | Ajouter l'adaptateur après essai réel |
| 26/10 | Les mentions « mise à jour de la source inconnue » et « trimestres datés de leur premier mois » sont écrites dans le **nom** de la source (120 signes), pas dans la période (60 signes) | La période était tronquée en silence, donc la mention d'honnêteté disparaissait | — |
| 26/10 | Une date de mise à jour absente n'est jamais inventée : on met la date de la requête et on le dit | « Aucun chiffre inventé » s'applique aussi aux dates | — |
| 26/10 | La comparaison de deux jeux est refusée si leurs unités diffèrent, et sort en forme « date, série, valeur » | Comparer des euros et des habitants trompe ; la courbe trace une ligne par série | Assouplir `comparer` |
| 26/10 | Tâche GitHub « données » **préparée dans `docs/`, jamais dans `.github/`**, planification en commentaire | Demande de Lucien : préparer sans activer ; GitHub ne lit pas `docs/` | Supprimer le dossier `donnees-action/` |
| 26/10 | Les nouveaux modules ne sont **pas** ajoutés à `sw.js` (hors de mes fichiers) ; liste donnée à la Commande dans `etat.md` | Périmètre de la mission | — |
| 26/10 | Page d'essai réel `labo/essai-sources-donnees.html` (3 boutons, rien n'est gardé, aucune clé) | Seul moyen de vérifier CORS et format réels, que l'atelier ne peut pas atteindre | Supprimer le fichier |
