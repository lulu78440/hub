# Décisions prises à la place de Lucien (mission bloc A, branche `refonte-auto2`)

| Date | Décision | Raison |
| --- | --- | --- |
| 25/10 21:20 | Branche `refonte-auto2` créée depuis `refonte-auto` (non fusionnée dans main). | Elle contient la palette (7.27.x) ; consigne de la mission. |
| 25/10 21:25 | Maquette mix 2 : le centre garde 2 fenêtres de chaque côté nettes (mur), les suivantes sont plus sombres et plus refermées (arc) ; orbe reculée à 105 % du rayon, voilée. | Zones demandées ; option la plus lisible, réglable par les curseurs. |
| 25/10 21:50 | « Rendu au repos » = scène 3D redessinée une image sur deux (pas d'arrêt complet), après 15 s sans action et sans pulsation d'énergie. | Un arrêt total figerait les particules et l'orbe : « aucun changement visuel du fond » ne serait plus tenu. Réversible (tuile Complet). |
| 25/10 21:50 | Qualité automatique : seulement vers le bas, jamais de remontée seule ; mesure sur 2 s, 3 mesures sous 40 images/s, pas avant 6 s ; images espacées de plus d'1 s ignorées. | Évite le yo-yo et les faux positifs au changement d'onglet. Le mode choisi est gardé (`hub-qualite`), le niveau automatique ne l'est pas. |
| 25/10 21:50 | Aucun fichier de `js/scene/` modifié ; seul `js/main.js` (boucle) est touché, noté au journal. | La consigne demandait de noter le fichier de scène avant de le toucher : il n'y en a pas eu besoin. |
