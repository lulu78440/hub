# Refonte 6 · état

26/10/2026 · poste Refonte · branche `refonte-auto6` (depuis `main` 7.42.0), version 7.43.0, **poussée, non fusionnée**.

| Tâche | État |
| --- | --- |
| 1 · « Annuler le plan » sur `planEnCours()` / `annulerPlan()`, enveloppe de la barrière et `__vuesPlan` retirés | fait (`js/ui/noyau-controles.js`) |
| 2 · Panneau « Modules, espaces et workflows » (modules : ouvrir, versions et restauration, export, suppression confirmée avec sauvegarde et annulation ; reprise de la dernière session ; espaces : créer, ouvrir, retirer ; workflows et modèles : validation du budget, confirmations par étape) | fait (`js/ui/noyau-gestes.js`, bloc « Refonte 6 » de `css/noyau.css`) |
| 3 · Entrée de palette (Outils / Ctrl+K, PC et téléphone) et bouton « Modules » dans la barre du Noyau | fait (`js/ui/outils.js`) |

Fichiers : `js/ui/noyau-gestes.js` (nouveau), `js/ui/noyau-controles.js`, `js/ui/outils.js`, `css/noyau.css`, `sw.js` (PRECACHE + 7.43.0), `js/version.js`, `tools/tests/t12_refonte6.py` (+ `run.py`), `labo/essais-vues.mjs` et `labo/essais-annulation.mjs` (adaptés), journal. **Aucun fichier de `js/noyau/` ni de `js/widgets/` modifié.**

Essais : voir le compte rendu du poste (suite complète 66/68, `node labo/essais*.mjs` 44/44).
- `test_refonte5_r2_echap_apres_clic_sur_la_barre_de_titre` échoue aussi sur `main` 7.42.0 (vérifié) : hors de cette branche.
- `test_sauvegarde_synchro_deux_appareils` a échoué une fois dans la suite complète et passe seul : instable.

Reste à Lucien : essayer le panneau à la main (PC et téléphone), notamment l'export et une étape à accord dans un workflow réel ; non faits : importer, actualiser, « Modifier » (voir `decisions.md`).
