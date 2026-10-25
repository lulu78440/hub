# Outils proposés au Noyau · VALIDÉS PAR LUCIEN LE 25/10 À 21 H 05

Lucien a validé les cinq outils ci-dessous, avec leur niveau, le 25/10 à 21 h 05 (« je valide tout »). Ils sont dans `OUTILS_VALIDES` (`js/noyau/outils.js`) et listés dans `OUTILS_A_BRANCHER` : **validés mais pas encore actifs**, car leurs modules ne sont pas importés par le Noyau (le cache hors ligne `sw.js`, fichier partagé, sera mis à jour à la fusion de `labo-auto` dans `main`). Le jour du branchement, la règle les laissera entrer au niveau validé, et à aucun autre. Plus aucune proposition n'est en attente.

| Outil proposé | Niveau | Pourquoi ce niveau | Lot | Où |
| --- | --- | --- | --- | --- |
| `consulter_manuel` (paramètre : `question`, texte de 200 signes) | LIBRE | Lecture seule d'un dossier public écrit par les postes ; ne donne aucun droit sur les fonctions décrites ; contenu encadré comme donnée ; aucune requête réseau extérieure | lab-manuel | `creerManuel().pourModele()` dans `js/noyau/manuel.js` |
| `chercher_decisions` (paramètre : `question`) | LIBRE | Lecture seule de la mémoire des décisions | lab-decisions | `creerDecisions().chercher()` dans `js/noyau/decisions.js` |
| `proposer_decision` (paramètres : `decision`, `raison`) | CONFIRMATION | Écriture : Lucien valide chaque enregistrement ; ajout seul, jamais d'effacement | lab-decisions | `creerDecisions().enregistrer()` |
| `lire_contradictions` (aucun paramètre) | LIBRE | Lecture seule de signaux calculés par règles (au plus 3, un signal écarté ne revient pas) | lab-contradictions | `detecterContradictions()` dans `js/noyau/contradictions.js` |

**Pas d'outil pour le passeport (lab-passeport)** : « exporter les données » est INTERDIT pour le Noyau. Le passeport se prépare et s'exporte par un **bouton cliqué par Lucien** (aperçu, secrets retirés, confirmation), jamais par un appel de l'IA.
| `creer_routine` (paramètres : `id`, `nom`, `declencheur`, `etapes`) | CONFIRMATION | Écriture : crée ou modifie une routine ; Lucien valide la liste des étapes ; ne lance rien. Le lancement reste un geste de Lucien (bouton, phrase exacte, ou heure avec fenêtre de validation) | lab-n8n-routines | `validerRoutine()` dans `js/noyau/routines.js` |

**Pas d'outil pour le conseiller (lab-proactif)** : il ne lance rien, il propose un texte à Lucien (au plus 3 par jour). Son seul « geste » est d'afficher la suggestion ; agir passe ensuite par les outils déjà validés et leur confirmation.
