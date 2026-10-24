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
| B3 | important | Actualité, veille, médias, mails | Un lien « javascript: » ou « data: » venu d'un flux RSS (ou d'un mail) était posé tel quel dans le bandeau, la Veille et l'ouverture des médias. Un éditeur de flux hostile ou piraté pouvait ainsi glisser du code exécuté dans le hub (qui détient les données déverrouillées). Chromium a bloqué le clic en nouvel onglet pendant le test, mais rien dans le hub ne l'empêchait. | `t3_securite.py · test_securite_flux_rss_piege` (flux simulé avec `lien: "javascript:…"`). | `news.js`, `media.js` : `webUrl()` ne garde que http(s) ; `mail.js` : https seulement ; `tools/flux.py` écarte les liens non web à la source (effet après fusion sur main, la tâche GitHub lit main). | corrigé (banc-essai) |
| B4 | important | Favoris | Un favori `javascript:` ou `data:` arrivé par un export trafiqué restait cliquable, et « Ouvrir ici » faisait `location.href = f.url` : exécution dans le hub. (Le formulaire et l'import de favoris du navigateur, eux, refusaient déjà ces liens.) | `test_securite_liens_javascript_fichiers_importes` (export du hub avec un favori `javascript:`). | `favs.js` : lien posé et « Ouvrir ici » seulement si http(s). | corrigé (banc-essai) |
| B5 | mineur | Page en direct | Avec `allow-scripts allow-same-origin`, une page du même site que le hub (toute page de `lulu78440.github.io`, dont les maquettes) affichée dans la fenêtre pouvait lire le hub et ses données déverrouillées. Une adresse mémorisée ou importée (`hub-web-url`) n'était pas revérifiée (`javascript:` possible dans l'iframe). | `test_securite_liens_externes_et_page_en_direct`. | `webview.js` : pas d'`allow-same-origin` pour une page du même site ; adresse mémorisée repassée par `norm()`. | corrigé (banc-essai) |
