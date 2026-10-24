# Banc d'essai · rapport

(Résumé ajouté en fin de mission.)

## Décisions prises en l'absence de Lucien

- Tests en Chromium headless (Playwright) sur serveur local ; Brave non disponible dans l'espace de travail : comportements propres à Brave non vérifiés.
- `docs/suivi.json` (relevé du Suivi) jamais modifié, conformément à la consigne.

## Problèmes

| # | Gravité | Zone | Problème | Reproduction | Correction | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | mineur | Import chiffré | Un export chiffré abîmé ou modifié affichait « Phrase ou clé incorrecte », ce qui pousse à réessayer en vain. | Modifier `coffre.pass.iter` (ou `data`) d'un export chiffré, l'importer avec la bonne phrase. | `lockui.js` · `askSecret` : message « Fichier chiffré abîmé ou modifié » quand le fichier est refusé, « illisible » s'il ne se déchiffre pas. | corrigé (banc-essai) |
| B2 | mineur | Import + synchro | Sur un appareil synchronisé, « Importer » remplace les données, mais la synchro suivante remet les éléments du Gist absents du fichier (aucune trace de suppression n'est créée par l'import). L'import se comporte donc comme une fusion. Pas de perte de données. | Synchro active, importer un vieil export, attendre la synchro. | À décider par Lucien : garder ce comportement (le plus prudent, retenu ici) ou, à l'import, poser des traces de suppression pour les éléments remplacés. Non modifié. | décrit |
