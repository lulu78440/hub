# Commandes pour l'orbe (p3-ia) · contrat pour le Labo

Poste Refonte, version 7.33.0. Code : `js/ui/commandes.js`. Rien dans `js/noyau/` n'est modifié : le Labo branche seulement ces noms.

## Appel
- `window.__hub.commandes.executer(nom, params)` → promesse `{ nom, ok, message | raison, refuse?, etat? }` (`__hub.commandes` vaut `null` sur téléphone : pas de plan 3).
- Ou par événement : `document.dispatchEvent(new CustomEvent("hub:commande", { detail: { nom, params, repondre: (res) => … } }))`.
- `commandes.liste()` : noms, permissions, paramètres bornés, disponibilité. `commandes.journal()` : 100 derniers appels.

## Règles
- Liste fermée : une commande inconnue, un paramètre inconnu ou hors bornes est refusé. Aucun code n'est exécuté, aucune adresse libre n'est acceptée.
- Permission « confirmation » : une fenêtre du hub demande l'accord de Lucien à chaque appel (refus par défaut, Échap ou 60 s = refus, une seule demande à la fois). Aucun paramètre ne permet de la contourner.
- L'écran en direct : le Noyau peut le démarrer (après accord de Lucien, qui choisit ensuite l'écran lui-même) et le couper ; il ne reçoit jamais l'image et ne peut pas la lire.

## Commandes
| Nom | Permission | Paramètres | Effet |
| --- | --- | --- | --- |
| ouvrir_appli | libre | app : fichiers, pc, internet, mails, direct | Ouvre l'appli (va au plan 3 sauf pour Mails) |
| fermer_appli | libre | app : fichiers, pc, internet, direct | Ferme la fenêtre (fermer « direct » coupe le partage) |
| aller_plan | libre | plan : 1, 2, 3 | Change de plan |
| poser_icone | libre | cle : une entrée du catalogue du bureau | Pose l'icône (une seule par entrée) |
| ranger_icones | libre | aucun | Range les icônes en grille |
| retirer_icone | confirmation | cle | Retire l'icône du bureau (rien n'est supprimé sur le PC) |
| ecran_direct_demarrer | confirmation | aucun | Démarre l'écran en direct, lecture seule |
| ecran_direct_couper | libre | aucun | Coupe l'écran en direct |
| etat_bureau | libre | aucun | Plan, applis ouvertes, icônes, écran en direct actif ou non |
| catalogue_ouvrir | libre | aucun | Réservé : indisponible tant que le catalogue de jeux (Atelier) n'existe pas |
| jeu_lancer | confirmation | jeu (texte ≤ 60) | Réservé : indisponible, confirmation obligatoire quand il existera |

Cette liste ne s'étend que dans `js/ui/commandes.js`, par le poste Refonte, avec l'accord de Lucien (règle `lab-outils-regle`).
