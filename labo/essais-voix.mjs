// Laboratoire · voix naturelle Piper et repli sur la voix du système : `node labo/essais-voix.mjs`
import { creerPiper } from "../js/noyau/piper.js";
import { lire, definirMoteurVoix } from "../js/noyau/voix.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const dits = []; const lib = { async predict({ text, voiceId }) { return { text, voiceId }; } };
const p = creerPiper({ charger: async () => lib, lecteur: async (wav) => { dits.push(wav.text); } });
ok(p.statut().etat === "off" && !p.pret(), "désactivée par défaut");
await p.preparer(); ok(p.pret() && p.statut().voix === "fr_FR-siwis-medium", "préparée : voix française");
definirMoteurVoix(p);
await new Promise((r) => { lire("Bonjour **Lucien**, il est 14 h.", { fin: r }); });
ok(dits.length === 1 && /Bonjour Lucien/.test(dits[0]) && !/\*/.test(dits[0]), "Piper lit le texte nettoyé pour l'oral : « " + dits[0] + " »");
const casse = creerPiper({ charger: async () => ({ predict: async () => { if (!casse.pret()) return {}; throw new Error("modèle absent"); } }), lecteur: async () => {} });
await casse.preparer(); definirMoteurVoix(casse);
let fin = false; await new Promise((r) => { lire("Un test.", { fin: () => { fin = true; r(); } }); }); ok(fin, "Piper échoue en cours de route : repli sur la voix du système, la lecture se termine quand même");
const hs = creerPiper({ charger: async () => { throw new Error("réseau"); } }); await hs.preparer(); ok(hs.statut().etat === "erreur" && !hs.pret(), "échec du téléchargement : état « erreur »");
definirMoteurVoix(null);
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
