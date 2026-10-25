# Labo · mission autonome n° 2 — état (branche `labo-auto2`, départ 21 h 57)

## Résumé en 10 lignes
1. `labo-auto2` créée depuis `main` à jour (7.29.0) ; `labo-auto` fusionnée dedans **sans aucun conflit** et sans `apercu-labo.html`.
2. 15 modules du Noyau ajoutés au cache hors ligne (`sw.js`) ; **version non changée** (7.29.0), donc ils ne seront disponibles hors ligne qu'au prochain bump décidé par Commande.
3. Les 5 outils validés le 25/10 sont branchés, mêmes noms et niveaux : `consulter_manuel`, `chercher_decisions`, `lire_contradictions` (LIBRE) ; `proposer_decision`, `creer_routine` (CONFIRMATION). Aucun autre outil (39 au total).
4. Un essai a révélé qu'une routine pouvait contenir `creer_routine` : interdit (et `proposer_decision`), décision 7 de `decisions.md`, retour arrière en une ligne.
5. Essais : 30 suites `node labo/essais*.mjs` au vert, dont la nouvelle `essais-outils-branches.mjs` (13 cas) ; `essais-outils-regle.mjs` mis à jour.
6. Banc du hub : Charte, sécurité, hors ligne au vert ; `--rapide` : 49 réussis sur 50. Le seul échec (contrastes < 3:1, plan 2 et libellés ACTU/TECH) existe **à l'identique sur `main`** : pas de mon fait, signalé.
7. Info Charte : « fiche de manuel par fonction » 0/18 (le test cherche ailleurs que `docs/manuel/fiches/`) — non bloquant, à régler par Commande.
8. Étape 5 faite : `maquettes/lab-chat-maquette.html` (isolée, rien dans le hub) : fenêtre déplaçable (souris, doigt, flèches), liseré qui pulse, badge honnête de mode (web / local rapide / local lent / sans IA / hors ligne), accord avec « Refuser » par défaut, téléchargement du modèle avec consentement et annulation.
9. Non touchés : `main`, `css/`, `js/ui/`, `js/widgets/`, `index.html`, `js/main.js`, menus, journal de bord, `docs/suivi.json`, Suivi du Hub. Aucun push forcé, aucune clé.
10. Reste : Lucien valide (ou non) la maquette du chat ; Commande décide la fusion de `labo-auto2` dans `main` et le bump de version. Retour arrière : supprimer la branche.

## Journal
- Fusion `origin/labo-auto` → `labo-auto2` : commit `f20d2e7`.
- `sw.js` + 5 outils + essais : second commit.
- Maquette + docs : dernier commit.
- Heures : mes messages d'avancement portaient des heures erronées (voir `decisions.md`) ; fin réelle vers 22 h 10.

## Suivi (pour Commande, je n'y touche pas)
`lab-outils-regle` et le branchement des 5 outils : livré sur `labo-auto2` (pas sur `main` : « construit » seulement après fusion). `lab-chat-maquette` : maquette prête, en attente de Lucien.
