# Banc de test · plan de la recette finale de la refonte (étape ergo-recette)

Préparé le 25/10 au soir, pendant la mission autonome, pour être prêt quand le poste Refonte aura fini. Rien n'est lancé tant que Lucien ne le demande pas.

## 1. Automatique (navigateur de test, une commande)

`python3 tools/tests/run.py` sur la version finale de la Refonte, comparée à main d'avant la refonte (`version-7.14.0`) :

| Domaine | Ce qui est vérifié | Test |
| --- | --- | --- |
| Rien de perdu | mêmes données lues et écrites (notes, tâches, agenda, favoris, images), export puis import sur appareil vierge, chiffré compris | `t1_sauvegardes.py` |
| Fonctions | recette PC et téléphone simulé, hors ligne, mise à jour du service worker, deux onglets | `t2_fonctions.py` |
| Sécurité | textes piégés, liens `javascript:`, verrouillage, secrets jamais exportés | `t3_securite.py` |
| Charte | règle 11 (mode simple sans IA ni WebGL, PC et téléphone), règle 12 (fiches du manuel) | `t7_charte.py` |
| Confort | chargement à froid, mouvement réduit, clavier (contour au focus), contrastes | `t5_confort.py` |
| Dispositions | une disposition PC et mobile enregistrée avant la refonte est reprise sans perte (fenêtres à leur place, masquées toujours masquées) | à écrire au moment de la recette, d'après le format final (`disposition-pc-v3`) |
| Fenêtre Outils | chaque tuile ouvre ce qu'elle annonce, aucune ligne de menu perdue (ce qu'aucune tuile ne reprend est dans « Autres actions ») | à écrire d'après la liste finale des tuiles |

## 2. À faire par Lucien (essais réels, environ 20 min)

1. Brave PC : ouvrir le hub après la mise à jour (« Nouvelle version prête »), vérifier que tes fenêtres sont à leur place.
2. Glisser une fenêtre, réduire à son nom, rouvrir ; plan 2 en salle immersive ; touche O (Outils) ; molette.
3. Android : réduire au toucher, feuille Outils, fonctions rares masquées puis remises.
4. Un export, puis l'import sur le téléphone.
5. Compteur d'images par seconde : PC et Android, avant et après (une phrase suffit : « 58 / 31 img/s »).

## 3. Rapport

Court (une page), avant ta validation : ce qui passe, ce qui casse, avec la correction proposée sur `banc-essai`. Le Banc ne fusionne jamais.
