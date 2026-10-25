# Études des applis de référence (25/10, poste Refonte · ergonomie)

Lecture seule : rien n'a été copié dans le hub. Licences lues dans les dépôts le 25/10/2026.

## Licences
| Reprise possible avec avis de copyright | Étude de principe seulement |
| --- | --- |
| MIT : God's Eye View, DaedalOS, Bruno Simon (code seul), WebGL Fluid Simulation, Kepler.gl, React Flow, Excalidraw, Dashy, Langflow | AGPL-3.0 : World Monitor, Puter, Stellarium Web Engine, Glance, Grafana, Theatre.js `packages/studio` |
| Apache-2.0 (avis conservé, modifications signalées) : SC-DataV, Homarr, Home Assistant frontend, Theatre.js (hors studio) | GPL-3.0 : Homepage |
| MPL-2.0 (fichier par fichier) : Penpot | Modèles 3D, textures, sons, polices : droits à vérifier un par un |

## Retenu
- **Plan 2** : entrée en travelling (une fois par session), brume, flou de profondeur, rendu du fond au repos, qualité automatique, `prefers-reduced-motion` (fonction de God's Eye View reprenable, MIT).
- **Plan 3** (DaedalOS, Homarr) : pile de focus, réduction animée vers l'icône, lasso, menu contextuel unique, registre d'applis ; grille de widgets plus tard.
- **Laboratoire vivant** (SC-DataV, Theatre.js) : bus d'événements (~80 lignes écrites par nous), panneaux à coins qui s'ouvrent, bande de scan jouée une fois.

## Nouvelles étapes au Suivi (aucune cochée) — à reporter dans `docs/suivi.json` après la fusion
`ergo-plan2-maquette`, `ergo-plan2-salle`, `ergo-perf-repos` (bloc Refonte) ; `p3-fenetres`, `p3-lasso` (bloc Plan 3) ; `lv-bus`, `lv-panneaux` (bloc Laboratoire vivant).
