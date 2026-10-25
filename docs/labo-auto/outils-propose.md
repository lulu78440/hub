# Outils proposés au Noyau · EN ATTENTE DE VALIDATION DE LUCIEN

Aucun de ces outils n'est dans le catalogue. Ils ne le seront qu'après un « validé » de Lucien (règle lab-outils-regle).

| Outil proposé | Niveau | Pourquoi ce niveau | Lot | Où |
| --- | --- | --- | --- | --- |
| `consulter_manuel` (paramètre : `question`, texte de 200 signes) | LIBRE | Lecture seule d'un dossier public écrit par les postes ; ne donne aucun droit sur les fonctions décrites ; contenu encadré comme donnée ; aucune requête réseau extérieure | lab-manuel | `creerManuel().pourModele()` dans `js/noyau/manuel.js` |
| `chercher_decisions` (paramètre : `question`) | LIBRE | Lecture seule de la mémoire des décisions | lab-decisions | `creerDecisions().chercher()` dans `js/noyau/decisions.js` |
| `proposer_decision` (paramètres : `decision`, `raison`) | CONFIRMATION | Écriture : Lucien valide chaque enregistrement ; ajout seul, jamais d'effacement | lab-decisions | `creerDecisions().enregistrer()` |
| `lire_contradictions` (aucun paramètre) | LIBRE | Lecture seule de signaux calculés par règles (au plus 3, un signal écarté ne revient pas) | lab-contradictions | `detecterContradictions()` dans `js/noyau/contradictions.js` |

**Pas d'outil pour le passeport (lab-passeport)** : « exporter les données » est INTERDIT pour le Noyau. Le passeport se prépare et s'exporte par un **bouton cliqué par Lucien** (aperçu, secrets retirés, confirmation), jamais par un appel de l'IA.
| `creer_routine` (paramètres : `id`, `nom`, `declencheur`, `etapes`) | CONFIRMATION | Écriture : crée ou modifie une routine ; Lucien valide la liste des étapes ; ne lance rien. Le lancement reste un geste de Lucien (bouton, phrase exacte, ou heure avec fenêtre de validation) | lab-n8n-routines | `validerRoutine()` dans `js/noyau/routines.js` |
