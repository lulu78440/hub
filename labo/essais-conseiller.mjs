// Laboratoire · essais du conseiller proactif : `node labo/essais-conseiller.mjs`
import { creerConseiller, LIMITES } from "../js/noyau/conseiller.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const kv = new Map(); const stockage = { lire: async (c, id) => kv.get(id) || null, ecrire: async (c, o) => { kv.set(o.id, JSON.parse(JSON.stringify(o))); } };
let now = new Date(2026, 9, 26, 13, 30); const c = creerConseiller({ stockage, maintenant: () => now });
const etat = { evenements: [{ id: "e1", titre: "Réunion budget", date: "2026-10-26", debut: "14:30" }], taches: [{ id: "t1", texte: "Préparer le budget", faite: false }] };
let s = await c.quandUtile(etat);
ok(s && /Réunion budget/.test(s.texte) && /Préparer le budget/.test(s.texte) && s.cle.startsWith("rdv-tache:"), "rendez-vous dans 1 h + tâche liée non faite : suggestion utile");
ok(await c.quandUtile(etat) === null, "aucune deuxième suggestion dans les 2 heures");
now = new Date(2026, 9, 26, 16, 0); ok(await c.quandUtile(etat) === null, "la même suggestion ne revient jamais");
const rien = creerConseiller({ stockage: { lire: async () => null, ecrire: async () => {} }, maintenant: () => new Date(2026, 9, 26, 13, 30) });
ok(await rien.quandUtile({ evenements: [{ id: "e", titre: "Dentiste", date: "2026-10-26", debut: "14:30" }], taches: [{ id: "t", texte: "Acheter du pain", faite: false }] }) === null, "rendez-vous sans tâche liée : silence (pas de bruit)");
ok(await rien.quandUtile({ evenements: [{ id: "e", titre: "Réunion budget", date: "2026-10-26", debut: "13:40" }], taches: [{ id: "t", texte: "Budget", faite: false }] }) === null, "rendez-vous dans moins de 15 min : trop tard pour conseiller");
// Moments à respecter
const calme = (o) => creerConseiller({ stockage: { lire: async () => null, ecrire: async () => {} }, maintenant: () => o.h });
const retard = { taches: ["a", "b", "c"].map((x) => ({ id: x, texte: "T" + x, faite: false, echeance: "2026-10-01" })) };
ok(await calme({ h: new Date(2026, 9, 26, 23, 0) }).quandUtile(retard) === null && await calme({ h: new Date(2026, 9, 26, 6, 0) }).quandUtile(retard) === null, "silence la nuit");
ok(await calme({ h: new Date(2026, 9, 26, 10, 0) }).quandUtile(retard, { focus: true }) === null && await calme({ h: new Date(2026, 9, 26, 10, 0) }).quandUtile(retard, { media: true }) === null && await calme({ h: new Date(2026, 9, 26, 10, 0) }).quandUtile(retard, { verrouille: true }) === null, "silence en Focus, pendant un média, écran verrouillé");
ok((await calme({ h: new Date(2026, 9, 26, 10, 0) }).quandUtile(retard))?.cle.startsWith("retard:"), "3 tâches en retard : suggestion de revue");
ok(await calme({ h: new Date(2026, 9, 26, 10, 0) }).quandUtile({ taches: retard.taches.slice(0, 2) }) === null, "2 tâches en retard seulement : silence");
// Réponses de Lucien
kv.clear(); now = new Date(2026, 9, 27, 10, 0); const c2 = creerConseiller({ stockage, maintenant: () => now });
s = await c2.quandUtile(retard); await c2.repondre(s.cle, "non");
now = new Date(2026, 10, 15, 10, 0); ok(await c2.quandUtile({ taches: retard.taches }) === null, "« non » : la règle se tait 30 jours");
now = new Date(2026, 11, 5, 10, 0); ok(await c2.quandUtile({ taches: retard.taches }) !== null, "…puis elle peut reparler");
kv.clear(); now = new Date(2026, 9, 27, 10, 0); const c3 = creerConseiller({ stockage, maintenant: () => now });
s = await c3.quandUtile(retard); await c3.repondre(s.cle, "plus-tard");
now = new Date(2026, 9, 27, 12, 0); ok(await c3.quandUtile(retard) === null, "« plus tard » : silence 4 h");
now = new Date(2026, 9, 27, 14, 30); ok(await c3.quandUtile(retard) !== null, "…puis la même suggestion revient");
kv.clear(); const c4 = creerConseiller({ stockage, maintenant: () => now }); let vus = 0;
for (let j = 0; j < 8; j++) { now = new Date(2026, 9, 1 + j, 10, 0); const r = await c4.quandUtile({ taches: ["a", "b", "c"].map((x) => ({ id: x + j, texte: "T", faite: false, echeance: "2026-09-01" })) }); if (r) vus++; }
ok(vus === LIMITES.ignoreesMax && (await c4.etat()).regles.retard.coupee, "suggestions ignorées " + LIMITES.ignoreesMax + " fois : la règle se coupe d'elle-même (" + vus + " vues)");
await c4.rallumer("retard"); now = new Date(2026, 9, 20, 10, 0);
ok((await c4.quandUtile({ taches: retard.taches }))?.cle.startsWith("retard:"), "Lucien peut rallumer une règle coupée");
kv.clear(); const c5 = creerConseiller({ stockage, maintenant: () => now }); let n = 0;
for (let h = 8; h < 22; h += 2) { now = new Date(2026, 9, 21, h, 5); const r = await c5.quandUtile({ taches: retard.taches, dernierExport: "2026-01-01", decisionsARevoir: [{ id: "d" + h, decision: "X", derniere_nouvelle: "2026-08-01" }] }); if (r) n++; }
ok(n === LIMITES.parJour, "au plus " + LIMITES.parJour + " suggestions par jour, même avec beaucoup de motifs (" + n + ")");
let er = null; try { await c5.repondre("retard:x", "peut-être"); } catch (e) { er = e; } ok(!!er, "réponse inconnue refusée");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
