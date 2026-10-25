# lv-00 · audit en lecture seule (Laboratoire vivant, direction D)

Rien n'a été modifié dans le hub pour cet audit. Poste : Refonte · ergonomie, branche `refonte-auto`, 25/10.

## Déjà en place (à réutiliser, pas à refaire)
- **Salle immersive et fond 3D** : `js/scene/` (core3d, postfx, loader) et `js/fx/` (entity, force, cursor). Hors périmètre du poste Refonte : le Labo les possède.
- **Tuiles** : `js/ui/tuiles.js`, styles Normal, Hologramme 3D, Fin, Verre, Minimal, effets Constellation, Halo, Énergie, texte 90–130 %. Point d'appui pour « ouverture d'une fenêtre holographique ».
- **Teinte jour/nuit** : `js/ui/dusk.js` (lever/coucher issus du cache météo `meteo-cache`). Point d'appui pour lv-meteo : la météo est déjà lue et mise en cache par `js/widgets/weather.js` (Open-Meteo).
- **Plans et profondeur** : `js/ui/plans.js`, fenêtres `.win` dans `#world` ; trois maquettes de profondeur isolées : `maquettes/p2-profondeur-*.html`.
- **Points de réglage `--ui-*`** (barre, horloge, recherche, bandeau, orbe) pour que le Noyau ajuste sans code.

## Manques pour lv-01 (réacteur vivant + ouverture de fenêtre holographique)
- Aucune animation d'ouverture de fenêtre aujourd'hui (la pose rebondit seulement). Charte : pas d'animation qui simule une action → l'ouverture doit accompagner une vraie ouverture.
- Pas de lien orbe ↔ état réel (Focus, veille, alertes) autre que `pulse()` : un « réacteur » devrait lire ces états, pas les inventer.
- Tout doit rester utilisable sans WebGL ni IA : prévoir un repli CSS.

## Proposition lv-01 (prototype isolé, non construit ici)
1. `maquettes/lv-01-reacteur.html` autonome : anneau CSS/SVG en deux couches, pulsation liée à un faux état commutable (Focus / repos / alerte).
2. Clic sur une tuile démo : ouverture holographique (balayage de lignes + fondu 400 ms), `prefers-reduced-motion` = apparition simple.
3. À valider par Lucien avant toute intégration (lv-02…06).

## Risques
- Coût GPU sur le téléphone : tout effet en `transform`/`opacity`, pas de `filter` sur grands parents.
- Conflit de fichiers avec le Labo : passer par le journal avant de toucher `css/hud.css` ou `tuiles.js`.
