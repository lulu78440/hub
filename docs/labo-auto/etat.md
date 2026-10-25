# État de la mission autonome (labo-auto) · résumé de 20 h 00, mis à jour le 25/10 après 21 h 05

**Depuis le retour de Lucien (21 h 05, « je valide tout »)** : les 5 outils proposés sont validés (dans `OUTILS_VALIDES`, à brancher à la fusion) ; WebLLM figé en 0.2.85 et Transformers.js en 3.0.2 (constats B14 et L1 du Banc) ; le worker ne reçoit que du texte et n'ouvre pas les bases du hub. 29 suites d'essais toutes bonnes.


1. **Fait** (branche `labo-auto`, rien sur `main`) : manuel du hub (format, lecteur, 3 fiches, 14 fiches à valider), règle « aucun outil sans validation » appliquée, socle d'IA locale (détection, worker, mot par mot), gestion des modèles, badge honnête, verrou, hors ligne, décisions, contradictions, passeport, voix locale (modules), performance, citations phrase par phrase, routines avec 4 modèles, conseiller proactif, recherche par passages, trieur de mails et fichiers (moteur, sans accès aux mails), méthode de veille des briques libres.
2. **Essais** : 29 suites dans `labo/` toutes bonnes (`node labo/essais*.mjs`), dont 13 nouvelles ; aperçu de 12 sections ouvert sans erreur dans un navigateur (Chromium).
3. **À tester en priorité** : ouvrir `apercu-labo.html` (double-clic) ; lire `docs/labo-auto/a-decider.md`.
4. **Jamais essayé en réel** : WebLLM 0.2.85 (WebGPU) et Transformers.js 3.0.2 (WASM) dans le worker (versions figées, chargées depuis jsDelivr : copie `vendor/` à faire hors de l'atelier), tailles des modèles (estimations), licence de la voix Piper.
5. **Décisions prises à ta place** : 23, listées dans `decisions.md` (la plus importante : la liste des 34 outils existants est tenue pour validée).
6. **Outils validés le 25/10** : `consulter_manuel`, `chercher_decisions`, `lire_contradictions` (LIBRE) ; `proposer_decision` et `creer_routine` (CONFIRMATION) sont dans `OUTILS_VALIDES` et `OUTILS_A_BRANCHER`. Aucun actif tant que leurs modules ne sont pas branchés (`sw.js`) ; aucun outil pour le passeport (bouton de Lucien).
7. **Rien n'est branché dans le hub** : les nouveaux modules ne sont pas importés par le Noyau (cache `sw.js` et interface = fichiers partagés).
8. **Suivi du Hub** : non mis à jour (rien n'est livré au sens du Suivi tant que ce n'est pas branché et validé) ; à faire à ton retour.
9. **Non fait volontairement** : fenêtre de chat, lab-perso-fixes, essais réels, branchement du micro et de l'affichage Outils.
10. **Pour annuler** : supprimer la branche `labo-auto`.


| Étape | État | Essais |
| --- | --- | --- |
| 1 · lab-manuel | Fait (format, lecteur, 3 fiches, index, essais) | `node labo/essais-manuel.mjs` : tout est bon |
| 2 · lab-outils-regle | Fait (règle appliquée dans outils.js, liste visible prête, onglet du labo non branché) ; 5 outils validés le 25/10, à brancher | `node labo/essais-outils-regle.mjs` : tout est bon ; les 18 suites existantes toujours bonnes |
| 3 · lab-socle | Fait (détection, choix du mode, worker, mot par mot, annulation, garde-fous) ; bibliothèques figées (0.2.85, 3.0.2), worker cloisonné (texte seul, bases du hub fermées) ; bibliothèques réelles non essayées | `node labo/essais-socle.mjs` : tout est bon |
| 4 · lab-modeles | Fait (catalogue, taille avant accord, état, suppression, progression) ; fenêtre « Gérer les modèles » à brancher par la Refonte | `node labo/essais-modeles.mjs` : tout est bon |
| 5 · lab-badge, lab-verrou, lab-offline | Fait (`ia-regles.js`) ; affichage du badge à brancher dans le chat | `node labo/essais-ia-regles.mjs` : tout est bon |
| 6 · lab-decisions, lab-contradictions, lab-passeport | Fait (moteurs à règles, sans IA) ; 3 outils proposés en attente, aucun outil pour le passeport (bouton de Lucien) | `node labo/essais-intelligence.mjs` : tout est bon (34 vérifications) |
| 7 · Fiches de rattrapage | 14 fiches à valider dans `docs/labo-auto/manuel-a-valider/` (emplacement provisoire) | `node labo/essais-manuel-rattrapage.mjs` : tout est bon |
| 8 · lab-voix (modules) et lab-perf | Fait : rééchantillonnage, découpe, dictée, backend Whisper du worker (jamais essayé en réel), mesures de vitesse, mémoire, batterie | `node labo/essais-voix-perf.mjs` : tout est bon |
| 9 · Aperçu | `apercu-labo.html` (double-clic, sans réseau), généré par `python3 labo/apercu.py`, ouvert sans erreur dans Chromium | |
| 10 · lab-khoj-sources | Fait (`citations.js`, contrôle local phrase par phrase) | `node labo/essais-citations.mjs` : tout est bon |
| 11 · lab-veille-os | Méthode et fiche modèle écrites (`veille-os.md`) ; aucune brique examinée | |
| 12 · lab-n8n-routines et modèles | Fait (moteur à règles, 4 modèles, historique) ; outil `creer_routine` proposé | `node labo/essais-routines.mjs` : tout est bon |
| 13 · lab-proactif | Fait (4 règles, plafonds, silence, mémoire des refus) ; aucun outil | `node labo/essais-conseiller.mjs` : tout est bon |
| 14 · lab-khoj-sens (partie mots) | Fait (`passages.js` : passages, réindexation incrémentale, second tri) ; le modèle de sens reste à essayer en réel | `node labo/essais-passages.mjs` : tout est bon |
| 15 · Trieur intelligent | Moteur prêt (propositions, protections, corbeille 30 jours, validation obligatoire) ; aucun accès aux mails ni aux fichiers tant que l'Atelier n'a pas livré le bloc Mails ; aucun outil de suppression pour le Noyau | `node labo/essais-trieur.mjs` : tout est bon |

## Pour fusionner `labo-auto` dans `main` (à faire avec Lucien)
- La branche part d'une base ancienne (7.15.0) : fusionner `main` dans une copie de travail, ou reprendre fichier par fichier ; vérifier `js/noyau/moteurs.js`, `outils.js` et `js/widgets/ai.js`, modifiés des deux côtés.
- `sw.js` : ajouter au cache hors ligne les nouveaux modules (manuel, socle, worker-ia, modeles, ia-regles, decisions, contradictions, passeport, voix-locale, perf, citations, routines, conseiller, passages, trieur) et monter sa version.
- Brancher les 5 outils validés dans `creerCatalogue` (même nom, même niveau).
- Ne pas fusionner `apercu-labo.html` (ni d'autres `apercu-*.html`) : page de démonstration de l'atelier.
- Rejouer `node labo/essais*.mjs` après la fusion.

