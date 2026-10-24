# Banc d'essai automatique du hub

Une commande rejoue tout ce qui a été vérifié pendant le banc d'essai du 24/10/2026 (cycles 1 à 5).

```bash
pip install playwright && playwright install chromium   # une seule fois
python3 tools/tests/run.py              # tout (environ 10 min)
python3 tools/tests/run.py --rapide     # sans les tests longs (charge, mémoire) : environ 6 min
python3 tools/tests/run.py securite     # seulement les tests dont le nom contient « securite »
```

Le script lance un serveur local et un Chromium sans fenêtre, crée des « appareils » vierges (contextes de navigateur
séparés), n'utilise que des données factices et **bloque toute requête vers un autre site** : GitHub (Gists), la météo
et le flux d'actualité sont simulés (`fakes.py`, `t2_fonctions.py`). Code de sortie 0 = tout est vert.

| Fichier | Cycle | Ce qui est vérifié |
| --- | --- | --- |
| `t1_sauvegardes.py` | 1 | export / import sur appareil vierge ; export chiffré rouvert avec la phrase et avec la clé de secours ; fichiers corrompus, d'une autre version ou trafiqués refusés ; Coffre du Hub (ajout sans effacer, doublons, liens non https) ; rappel du dimanche (horloge simulée) ; synchro entre deux appareils (fusion, suppressions, conflits) |
| `t2_fonctions.py` | 2 | recette PC (plans, notes, tâches, favoris, menus, météo, actu, veille, rappel) et mobile ; hors ligne ; mise à jour du service worker ; deux onglets |
| `t3_securite.py` | 3 | secrets dans le dépôt ; textes piégés ; liens `javascript:` (flux, exports trafiqués) ; verrouillage (repos, mauvaise phrase, vieil onglet, verrouillage auto) ; jetons jamais exportés ni synchronisés ; page en direct isolée ; cache météo piégé ; clé Gemini |
| `t4_limites.py` | 4 | 1 000 notes et tâches, 2 000 favoris ; stockage plein ; coupure réseau en pleine synchro ; onglet fermé en plein import ; fuseaux, horloge, textes de 100 000 caractères |
| `t5_confort.py` | 5 | chargement à froid, images/s (rendu logiciel : valeur plancher), mémoire dans la durée, mouvement réduit, clavier, contrastes |

Limites : Chromium et non Brave ; 3D sans carte graphique ; l'ouverture de fichiers de Mon PC (accès aux dossiers) et les
vraies connexions Google, Microsoft et GitHub ne sont pas rejouées. Les tests utilisent `window.__hub` et les modules du hub.
