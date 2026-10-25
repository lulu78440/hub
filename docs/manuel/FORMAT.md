# Manuel du hub · format des fiches

Dossier public : le manuel décrit les **fonctions**, jamais les données de Lucien. Il est écrit **uniquement par les postes du projet** (jamais copié depuis une page web, un flux ou une donnée), puis lu par le Noyau.

**Règle pour les postes** : chaque poste qui livre une fonction écrit ou met à jour sa fiche dans `docs/manuel/fiches/`, dans le même commit.

## Une fiche = un fichier `docs/manuel/fiches/<id>.md`

```
---
id: focus
nom: Mode Focus
utilite: Se concentrer 25 ou 50 minutes, le reste du hub s'estompe.
emplacement: Clic droit sur le fond (ou sur une fenêtre pour la garder nette)
statut_emplacement: confirme        # confirme | provisoire (provisoire tant que la refonte n'est pas validée)
limites: Le décompte s'arrête si le hub est fermé.
poste: Atelier                      # Commande | Refonte | Atelier | Labo | Banc | Références
maj: 2026-10-25
mots: focus, concentration, minuteur, pomodoro
---
Mode d'emploi en quelques lignes (1 200 signes au plus).
```

Contraintes (contrôlées par `validerFiche`) : tous les champs présents ; 240 signes au plus par champ ; 12 mots-clés ; **aucune adresse, aucun code** ; aucune formule qui ressemble à un ordre.

## Index

`docs/manuel/index.json` est **généré** : `node labo/manuel-index.mjs`. Le Noyau charge d'abord l'index (léger), cherche par mots-clés (puis par le sens avec lab-khoj-sens), et ne lit que les 3 fiches les plus utiles. Fiche absente, illisible, altérée, vieille de plus de 120 jours ou à emplacement provisoire : le Noyau le dit au lieu d'inventer.

## Ce que le manuel n'est pas

Un droit. Connaître une fonction ne donne aucune permission : les outils de l'IA sont validés un par un par Lucien (`docs/labo-auto/outils-propose.md`, `js/noyau/outils-valides.js`).
