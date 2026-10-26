# Recette 7.38 — poste Banc de test

Date : 26/10. Code vérifié : main en **7.38.1** (plan 3 complet, p3-mobile, lot 3 du Noyau, depuis 7.35.0).
Branche : `banc-recette2`. Rien n'est fusionné. Aucun fichier de `js/` ni de `css/` modifié. Données factices, réseau extérieur bloqué par le banc, aucune clé.
Le partage d'écran est **simulé** (flux canvas) : aucun vrai écran n'a été capturé.

## Résumé (10 lignes)

1. Suite complète `python3 tools/tests/run.py` : **57 réussis, 0 échec** (2026 cas, 788 s).
2. Les 36 `labo/essais*.mjs` : tous « Tout est bon ». `essais.mjs` : 44 réussis, 0 raté, 15 sautés (ils demandent un moteur réel).
3. Parcours Playwright PC (1440×900) et téléphone (390×844) : **41 points, 39 OK, 2 anomalies mineures, 0 bloquant**.
4. Aucune erreur console ni violation CSP sur les deux parcours.
5. Anomalie **R1** (mineure) : `fermer_appli("direct")` répond « Déjà fermée » alors que le partage d'écran reste actif.
6. Anomalie **R2** (mineure) : Échap ne réduit pas la fenêtre si l'on vient de cliquer sur sa barre de titre.
7. Observation : les fiches de manuel sont absentes pour les 18 fonctions (le test ne bloque pas, la convention reste à trancher).
8. Ce que le banc ne peut pas voir : vrai partage d'écran, CORS réel des sources de données, souris et doigt réels, performances 3D. Voir la liste d'essais plus bas.
9. Décisions pour Lucien : corriger R1 et R2 ou non (je ne touche pas à `js/`).
10. Prochaine étape : tes essais sur Brave PC et Android, puis ton « validé » éventuel.

## 1. Suite Python (57 tests)

Tout passe, dont : coffre, synchro, import, dates, CSP (5 tests), charte (mode simple sans IA ni WebGL PC et mobile), blocs du catalogue.
Seule réserve : `test_charte_fiche_de_manuel_par_fonction` passe en mode informatif (« 0/18 fonctions ont leur fiche : pc, progress, video, strip, meteo, tasks, rituels, radar, agenda, music, notes, noyau, securite, savoir, favs, mails, watch, web »). Il ne devient bloquant qu'avec `HUB_MANUEL_STRICT=1`.

## 2. Essais Node

Tous les `labo/essais*.mjs` sont verts. Les 15 essais sautés de `essais.mjs` attendent un moteur d'IA réel (voir la liste d'essais réels).
Les essais de l'Atelier (`tools/tests/atelier_banc/`) sont aussi verts.

## 3. Parcours Playwright (`docs/banc-essai/recette2/recette.py`)

Relance : `python3 docs/banc-essai/recette2/recette.py`. Résultats bruts : `recette2/resultats.json`. Captures : `recette2/*.png`.

| Zone | Points | Résultat |
|---|---|---|
| PC | version 7.38.x, commandes exposées, aucune erreur console, aucune violation CSP | OK |
| Plan 3, fenêtres | une seule fenêtre active, Échap réduit vers l'icône, l'icône rouvre au premier plan, état gardé après rechargement | OK (R2 à part) |
| Plan 3, lasso | lasso sur le fond (9/9 icônes), Échap désélectionne, Ctrl+A (9/9), glisser une icône déplace le groupe (9/9), menu de groupe au clic droit | OK |
| Écran en direct | coupé par défaut, confirmation « Refuser » par défaut, pastille « Couper » aux plans 1 et 2, rien enregistré (MediaRecorder = 0) ni envoyé, arrêt par la barre du navigateur, fermer la fenêtre coupe le partage, Entrée = Refuser | OK (R1 à part) |
| Commandes de l'orbe | 11 commandes, 3 avec confirmation, 8 appels piégés refusés, commandes libres, refus = rien retiré, journal, événement `hub:commande` | OK |
| Noyau lot 3 | 6 modules chargés, registre de 45 outils sans problème, fenêtre du Noyau sans erreur | OK |
| Hors ligne | modules du lot 3, commandes et écran en direct dans le cache, rechargement hors ligne | OK |
| Téléphone | pas de défilement horizontal, groupe « Applis » en tête de la feuille Outils (12 liens https au plus), nom de lien piégé affiché en texte, « Musique » sous le doigt, pas de bureau ni d'écran en direct | OK |

## 4. Anomalies

| N° | Gravité | Description | Comment la voir | Piste |
|---|---|---|---|---|
| **R1** | Mineure | Après un démarrage de l'écran en direct par la commande de l'orbe, la fenêtre « Écran » n'est pas ouverte. `fermer_appli("direct")` répond `ok: true, « Déjà fermée : direct »` et le partage **reste actif** (la pastille « Couper » reste visible, donc rien de caché). Une commande qui dit « fermée » alors qu'un partage tourne peut tromper l'orbe. | Plan 3 → `commandes.executer("ecran_direct_demarrer")` → confirmer → `commandes.executer("fermer_appli", {app:"direct"})` | Dans `bureau-apps.js`, `close("direct")` sort avant d'appeler `direct.stop(true)` si la fenêtre n'existe pas. Appeler `direct.stop(true)` avant ce retour, ou répondre « partage encore actif ». |
| **R2** | Mineure | Échap ne réduit la fenêtre que si le focus est dans la fenêtre. Après un clic sur la barre de titre, le focus passe sur `BODY` et Échap ne fait rien. | Plan 3 → ouvrir Internet → cliquer sur la barre de titre → Échap | Donner `tabindex="-1"` à la fenêtre et la focaliser au `pointerdown`, ou écouter Échap sur le document quand une fenêtre est active. |

Limites de mes propres essais (pas des anomalies du hub) : les icônes du bureau et les fenêtres sont animées en permanence, Playwright les juge « instables » ; mes clics les forcent. L'alerte de veille (« Site en panne ») s'affiche au milieu du bureau jusqu'à ce qu'on clique « OK » : normal, mais à savoir pendant tes essais.

## 5. Ce qui reste à essayer par Lucien (Brave PC et Android)

À cocher à la main ; le banc ne peut pas les faire.

### Brave PC
1. **Vrai écran en direct** : plan 3 → « ● Écran en direct » → Brave demande quel écran ou quelle fenêtre. Vérifier que la pastille « Couper » reste visible aux plans 1 et 2, que « Couper » arrête vraiment le partage (le témoin de Brave disparaît), et que refuser ou annuler ne laisse rien d'actif.
2. **Barre de partage de Brave** : cliquer « Arrêter le partage » dans la barre de Brave → la pastille du hub doit disparaître. Fermer l'onglet doit aussi couper.
3. **Lasso à la souris** : glisser sur le fond (entre les colonnes de panneaux) pour entourer des icônes, Maj/Ctrl + clic, Ctrl + A, glisser une icône choisie (tout le groupe suit), clic droit (menu de groupe).
4. **Fenêtres** : ouvrir 3 applis, Échap réduit la fenêtre active vers son icône, l'icône la rouvre, rechargement de la page (l'état revient). Essayer aussi Échap juste après un clic sur la barre de titre (R2).
5. **Sources de données du Noyau (CORS réel)** : ouvrir `labo/essai-sources-donnees.html` dans Brave, cliquer les 3 boutons (DBnomics, Banque mondiale, GitHub brut) et relever les 3 lignes. Refaire avec les Boucliers de Brave activés puis désactivés pour ce site. En cas d'échec, la source doit basculer sur la tâche GitHub.
6. **Hors ligne** : charger le hub, couper le réseau (mode avion ou DevTools), recharger : le hub, les commandes et la fenêtre « Écran » doivent s'ouvrir.
7. **Fluidité 3D** : plan 3 avec 3 fenêtres ouvertes et l'écran en direct actif, regarder si les images par seconde restent correctes.

### Android (Brave)
8. **Groupe « Applis »** : ouvrir Outils → « Applis » est en tête ; Internet s'ouvre, les fenêtres du hub s'ouvrent « sous le doigt », les liens du bureau (12 au plus, https seulement) s'ouvrent dans un nouvel onglet.
9. **Pas de bureau ni d'écran en direct** sur téléphone : le bouton « Écran en direct » ne doit pas apparaître.
10. **Appui long** et menu des fenêtres (corrigés en 7.36.2) : à revérifier au doigt.
11. **Installation en application** (PWA) puis ouverture hors ligne.
12. **Clavier et rotation** : pas de défilement horizontal en portrait ni en paysage.

### Commandes de l'orbe (sans voix, depuis la console)
13. Dans la console de Brave : `__hub.commandes.executer("aller_plan", {plan:3})` doit fonctionner sans question ; `executer("retirer_icone", {...})` doit afficher la fenêtre de confirmation avec « Refuser » sélectionné ; ne rien taper pendant 60 s = refus.

## 6. Décisions qui te reviennent

- Faire corriger R1 et R2 (petites corrections dans `js/`, par le poste concerné). Je ne touche pas à `js/` ni à `css/`.
- Fiches de manuel : passer le test en mode strict (`HUB_MANUEL_STRICT=1`) une fois les fiches écrites.
- Les décisions en attente des rapports précédents restent dans `docs/banc-essai/propositions.md` et `essais-reels.md`.

## 7. Suivi

Rien n'est passé en « done » : seul toi peux dire « validé ». Les étapes de cette recette restent en « built ».
