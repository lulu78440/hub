# Décisions prises à la place de Lucien (mission autonome Atelier, 25/10, 21 h 58 → 22 h 58)

Règle 13 : option la plus prudente et réversible. Tout est sur la branche `atelier-auto`, créée depuis `main` (76b7a99) ; rien sur `main`.
Pour tout annuler : supprimer la branche `atelier-auto` (aucun fichier existant n'a été modifié, seuls des fichiers nouveaux ont été ajoutés).

| Heure | Décision | Pourquoi | Pour revenir en arrière |
| --- | --- | --- | --- |
| 21:58 | Moteurs rangés dans `js/widgets/moteurs/`, un fichier par moteur, modules ES sans DOM, sans réseau, sans IA, sans import d'autres fichiers du hub. | Consigne de la mission ; aucun couplage avec l'interface en refonte. La Commande les branchera ensuite. | Supprimer le dossier. |
| 21:58 | Essais en scripts node autonomes dans `tools/tests/atelier/` (aucune dépendance npm), lancés par `node tools/tests/atelier/tout.mjs`. | Le dossier `tools/tests/` appartient au Banc : j'ajoute un sous-dossier neuf sans toucher à ses fichiers. | Supprimer le sous-dossier. |
| 21:58 | Format d'article de veille repris de `tools/flux.py` : `{ titre, lien, date, cat, source }`. | Le moteur doit lire exactement ce que la tâche programmée produit. | — |
