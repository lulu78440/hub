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
