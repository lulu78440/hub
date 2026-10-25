// Laboratoire · recherche par le sens (chargeur simulé) : `node labo/essais-sens.mjs`
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { creerSens } from "../js/noyau/sens.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
// Faux modèle : chaque mot pointe vers un « concept » ; deux mots de même concept ont le même vecteur.
const CONCEPT = { chien: 0, canide: 0, aboie: 0, chat: 1, felin: 1, voiture: 2, moteur: 2, automobile: 2 };
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const faux = async () => async (t) => { const v = new Float32Array(3); for (const m of norm(t).split(/\W+/)) if (m in CONCEPT) v[CONCEPT[m]] += 1; const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const h = creerHubSimule({ vide: true });
let sens = null; const n = await creerNoyau({ sens: (sens = creerSens({ memoire: { tous: () => [] }, charger: faux, pas: 0 })) });
sens = creerSens({ memoire: n.memoire, charger: faux, pas: 0 }); n.memoire.definirSens(sens);
await n.memoire.confirmer({ type: "kb", titre: "Le chien", texte: "Le chien aboie quand un inconnu approche.", source: "https://exemple.test/c", verifie: true });
await n.memoire.confirmer({ type: "kb", titre: "La voiture", texte: "Le moteur de la voiture consomme du carburant.", source: "https://exemple.test/v", verifie: true });
ok(n.memoire.rappeler("canide", { limite: 3 }).length === 0, "sans le sens : « canide » ne retrouve rien (aucun mot commun)");
ok(sens.statut().etat === "off" && !sens.pret(), "désactivé par défaut");
await sens.activer(); await new Promise((r) => setTimeout(r, 200));
ok(sens.statut().etat === "pret" && sens.statut().vecteurs === 2, "accord de Lucien : modèle chargé, 2 fiches vectorisées (" + sens.statut().vecteurs + ")");
const v = await n.memoire.preparer("canide"); const r = n.memoire.rappeler("canide", { limite: 3, vecteur: v });
ok(r.length >= 1 && r[0].titre === "Le chien", "avec le sens : « canide » retrouve la fiche « Le chien » : " + (r[0] && r[0].titre));
const v2 = await n.memoire.preparer("automobile"); const r2 = n.memoire.rappeler("automobile", { limite: 3, vecteur: v2 });
ok(r2[0] && r2[0].titre === "La voiture", "« automobile » retrouve « La voiture »");
const r3 = n.memoire.rappeler("chien", { limite: 3, vecteur: await n.memoire.preparer("chien") }); ok(r3[0].titre === "Le chien", "la recherche par mots reste prioritaire quand elle trouve");
await sens.desactiver(); ok((await n.memoire.preparer("canide")) === null, "désactivé : plus de vecteur, retour à la recherche par mots");
const casse = creerSens({ memoire: n.memoire, charger: async () => { throw new Error("hors ligne"); } }); await casse.activer(); ok(casse.statut().etat === "erreur" && !casse.pret(), "échec du téléchargement : état « erreur », le Noyau continue sans");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
