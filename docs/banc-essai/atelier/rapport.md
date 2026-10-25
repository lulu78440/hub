# Banc de test · moteurs de l'Atelier (branche `atelier-auto`, commit ba21624)

Contrôle du 25/10/2026 au soir, demandé par Lucien. Rien n'est fusionné ; les corrections sont proposées en patch sur `banc-essai`.

## Verdict

**Bon travail, utilisable après 4 petites corrections.** Modules purs (ni DOM, ni réseau, ni IA, ni `innerHTML`), montants en centimes entiers, états reçus jamais modifiés, aucun fichier existant touché, aucune donnée réelle.

| Contrôle | Résultat |
| --- | --- |
| 1. Essais de l'Atelier (`node tools/tests/atelier/tout.mjs`) | 144/144 justes |
| 1. Cas limites du Banc (`node tools/tests/atelier_banc/cas-limites.mjs <dossier des moteurs>`) | 81/85 sur ba21624 ; **85/85 avec le patch** (et 144/144 toujours) |
| 2. Fichiers existants (`git diff --stat 76b7a99..ba21624`) | 17 fichiers, **tous nouveaux**, aucun modifié ni supprimé |
| 3. Secrets, données personnelles, données bancaires | **rien trouvé** (IBAN, cartes, courriels, téléphones, jetons, nom de Lucien) ; libellés d'essai inventés |

Les cas limites couvrent 11 formats de relevés de banques françaises (Crédit Agricole, Société Générale, BNP Paribas, La Banque Postale, Crédit Mutuel/CIC, Caisse d'Épargne, Fortuneo, Boursorama, LCL sans en-tête, export Excel Windows-1252, UTF-8 avec BOM et CRLF), 20 montants, 13 dates, ré-import et chevauchement de relevés, libellé piégé, enveloppes (report, dépassement, passage d'année, état non modifié), garanties (fins de mois, 29 février, retour à distance ou en magasin), colis (clés S10, texte piégé, IBAN inventé), veille (regex, pluriels, poids), contrôle d'export. **Toutes les données sont inventées.** Les formats de banques sont reconstitués d'après leur structure habituelle : à confirmer avec un vrai export de Lucien, sur son PC, sans le mettre dans le dépôt.

## Écarts trouvés

| # | Gravité | Moteur | Écart | Correction (patch `corrections-ba21624.patch`) |
| --- | --- | --- | --- | --- |
| A1 | important | bud-csv | Un relevé **Boursorama / BoursoBank** (en-têtes `dateOp`, `label`, `amount`) est refusé : « Je ne trouve pas les colonnes… ». | Alias `dateop`, `label`, `amount` ajoutés. |
| A2 | important | at-garantie | **Promesse d'un droit qui peut ne pas exister** : 24 mois de garantie et 14 jours de rétractation sont appliqués à tout achat, même entre particuliers (Leboncoin, Vinted : ni garantie légale de conformité ni rétractation) ou pour les exceptions à la rétractation (bien personnalisé, denrée périssable, logiciel descellé…). | Non corrigé (choix de conception) : proposer un champ `vendeur: "pro" \| "particulier"` (particulier → aucun délai légal, texte « vices cachés seulement ») et une mention « sous réserve des exceptions » sur le délai de retour. **À trancher.** |
| A3 | mineur | at-radar-donnees | Un export **chiffré** (`hub-donnees-chiffre`) est déclaré « pas un export du hub ». | Avertissement « Export chiffré : contrôlable une fois ouvert dans le hub ». |
| A4 | mineur | bud-csv | « -0,00 » donne un zéro négatif ; « 2026-03-05abc » est acceptée comme date. | `-0` ramené à `0` ; date ISO suivie seulement d'une heure (« T10:00 », « 10:00 »). |
| A5 | mineur | at-garantie | Écarts au droit **dans le sens prudent** (échéance affichée plus tôt que la vraie) : garantie comptée depuis l'achat au lieu de la livraison (L217-3) ; délai de rétractation qui finit un samedi, dimanche ou férié non prolongé au jour ouvrable suivant (L221-19). | Non corrigé : sans risque pour Lucien ; à améliorer si on veut l'échéance exacte. |
| A6 | mineur | bud-csv | Relevé **LCL** sans ligne d'en-tête : refusé avec un message clair (pas de plantage). | Limite à connaître ; prise en charge possible plus tard (colonnes dans l'ordre fixe de LCL). |
| A7 | info | at-radar-donnees, bud-csv | Les messages et libellés contiennent du texte venu des exports et des relevés (exemple d'essai : `<img src=x onerror=…>` gardé tel quel). Le moteur a raison de ne pas le modifier. | **Au branchement** : l'interface devra l'afficher en texte (`textContent`), jamais en HTML. Le Banc le testera. |
| A8 | info | — | Essais rangés dans `tools/tests/atelier/` (dossier du Banc) : sous-dossier neuf, aucun fichier du Banc touché, l'Atelier l'a noté dans ses décisions. | À accepter par Lucien ; sinon les déplacer au branchement. |

## Points à trancher (`docs/atelier-auto/decisions.md`)

1. **Dépassement des enveloppes** : la règle choisie (reste positif reporté ; dépassement retiré de l'argent à répartir du mois suivant) est cohérente et vérifiée par le Banc (septembre −50 € sur Courses → octobre : Courses repart de 0, « à répartir » baisse de 50 €). C'est la méthode classique, la plus lisible : **avis du Banc, la garder**. L'autre choix (dépassement gardé dans l'enveloppe) tient en deux lignes, documentées.
2. **Valeurs légales par défaut** : 24 mois (bien neuf, vendeur professionnel), 12 mois possibles pour l'occasion si le vendeur l'a écrit, 14 jours de rétractation à distance depuis la réception : **justes pour un achat à un professionnel**. Le vrai problème est A2 (achats entre particuliers et exceptions) : à trancher avant le branchement.
3. **Liens de suivi des colis** (La Poste, UPS, FedEx, DHL) : non vérifiables depuis l'atelier (pages de suivi non documentées, le banc n'a pas d'accès à ces sites). Adresses en https, numéro encodé, rien n'est envoyé tant que Lucien ne clique pas. **Essai réel** : un clic par transporteur avec un vrai numéro, sur le PC de Lucien ; corriger l'entrée de `LIENS` si une page ne s'ouvre pas sur le bon colis.

## Pour appliquer les corrections (décision de Lucien)

Sur `atelier-auto` : `git apply docs/banc-essai/atelier/corrections-ba21624.patch` (2 fichiers : `bud-csv.js`, `at-radar-donnees.js`), puis `node tools/tests/atelier/tout.mjs` et `node tools/tests/atelier_banc/cas-limites.mjs js/widgets/moteurs`.
