// Laboratoire · veille d'étude : `node labo/essais-veille.mjs`
import { creerVeille, VEILLE } from "../js/noyau/veille.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const kv = {}; let t = Date.parse("2026-10-26T01:00:00"); let bat = { niveau: 0.8, charge: true }, ligne = true, att = 0, lacher = 0, pris = 0, n = 0;
const savoir = { prochain: (_, { exclure }) => { const id = "s" + n; return exclure.includes(id) ? { sousTheme: "s" + (n + 1), titre: "Thème " + (n + 1), domaineNom: "D" } : { sousTheme: id, titre: "Thème " + n, domaineNom: "D" }; }, etudier: async () => { n++; return { ok: true, propose: 2 }; } };
const mk = () => creerVeille({ savoir, memoire: { aValider: () => Array(att) }, lire: (k) => kv[k] || "", ecrire: (k, v) => (kv[k] = v), maintenant: () => new Date(t), enLigne: () => ligne, batterie: async () => bat, verrou: { prendre: async () => (pris++, { r: 1 }), lacher: async () => lacher++ } });
const v = mk();
ok((await v.cycle()).fait === false, "coupée par défaut : rien ne tourne");
const s = await v.activer(true); ok(s.actif && s.ecranAllume && pris === 1, "activation : écran maintenu allumé");
ok((await v.cycle()).fait === true && n === 1, "un cycle étudie un thème");
ok((await v.cycle()).raison === "pas encore l'heure", "pas deux études avant 8 minutes");
t += VEILLE.intervalleMs; ok((await v.cycle()).fait && n === 2, "après 8 minutes, une nouvelle étude");
t += VEILLE.intervalleMs; ligne = false; ok((await v.cycle()).raison === "hors ligne", "hors ligne : arrêt"); ligne = true;
bat = { niveau: 0.1, charge: false }; ok((await v.cycle()).raison.includes("batterie"), "batterie faible hors charge : arrêt"); bat = { niveau: 0.1, charge: true }; ok((await v.cycle()).fait, "batterie faible mais en charge : continue");
t += VEILLE.intervalleMs; att = VEILLE.maxAValider; ok((await v.cycle()).raison.includes("pleine"), "« À valider » pleine : arrêt"); att = 3;
for (let i = 0; i < VEILLE.maxJour + 2; i++) { t += VEILLE.intervalleMs; await v.cycle(); }
ok(v.statut().aujourdhui.etudes === VEILLE.maxJour, "plafond de " + VEILLE.maxJour + " études par jour : " + v.statut().aujourdhui.etudes);
const r = v.rapport(); ok(r && r.etudes === VEILLE.maxJour && /fiches proposées/.test(r.texte) && /plafond/.test(r.texte) && /validation/.test(r.texte), "rapport du matin : " + (r && r.texte.slice(0, 110)));
v.marquerVu(r); ok(v.rapport() === null, "rapport marqué comme vu : plus de répétition");
t += 864e5; await v.cycle(); ok(v.rapport() && v.rapport().etudes === 1, "le lendemain, nouveau rapport (1 étude)");
await v.activer(false); ok(lacher >= 1 && !v.statut().actif, "arrêt : verrou d'écran relâché");
const sans = creerVeille({ savoir, memoire: { aValider: () => [] }, lire: (k) => kv[k] || "", ecrire: (k, v) => (kv[k] = v), maintenant: () => new Date(t) }); ok((await sans.activer(true)).ecranAllume === false, "sans Wake Lock : veille possible, écran non maintenu (signalé)");
console.log(ko ? ko + " échec(s)" : "Tout est bon."); process.exit(ko ? 1 : 0);
