# lab-veille-os · veille de petites briques libres (méthode et fiche modèle)

Règle : on s'inspire des idées, on ne copie aucun code sous licence AGPL ou « fair-code » (Khoj, n8n) ; on n'embarque que des briques MIT, Apache-2.0 ou BSD, avec leur mention, chargées à la demande et jamais sans accord de Lucien.

## Fiche à remplir pour chaque brique (une par mois, ou à la demande)
| Question | Réponse attendue |
| --- | --- |
| Nom, version figée, adresse du dépôt | |
| Licence (lue dans le dépôt, pas de mémoire) | MIT, Apache-2.0 ou BSD ; sinon refus |
| Taille (code et modèle) | en Ko ou Mo |
| Entretien | dernier commit, dernière version, nombre de mainteneurs |
| Tourne dans le navigateur, sans serveur ? | oui ou non |
| Remplace quoi dans le hub ? | code maison à supprimer, ou fonction nouvelle |
| Risque | réseau, données qui sortent, poids, compatibilité Brave et Android |
| Décision | refuser, garder à l'œil, essayer (avec Lucien) |

## Briques déjà utilisées ou prévues (licences connues, à relire dans les dépôts lors du premier essai réel)
| Brique | Rôle | Licence connue | Statut |
| --- | --- | --- | --- |
| WebLLM | IA locale WebGPU | Apache-2.0 | utilisée (`moteurLocal`, worker du socle) |
| Transformers.js | IA locale WASM, Whisper | Apache-2.0 | prévue (worker du socle), version à figer |
| Whisper (modèle tiny) | dictée locale | MIT | prévue |
| Piper (moteur) | voix | MIT (la licence de la voix choisie est à vérifier) | utilisée en option |
| multilingual-e5-small | recherche par le sens | MIT | utilisée en option |

Je n'ai pas pu vérifier ces licences sur les dépôts depuis l'atelier (réseau filtré) : ce tableau vient de ma connaissance et doit être relu avant d'intégrer quoi que ce soit de nouveau.

## Pistes à examiner (aucune n'est examinée ici)
Un petit moteur de règles pour les routines (inspiré de n8n, écrit maison), un découpeur de texte pour les passages (inspiré de Khoj), un détecteur de silence plus fin pour la dictée, un lecteur de PDF léger pour le trieur de fichiers.
