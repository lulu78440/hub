// Laboratoire · essais de la curiosité autonome guidée par le programme : `node labo/essais-curiosite.mjs`
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const wiki = { query: { pages: { 1: { title: "Droit pénal français", index: 1, extract: "Le droit pénal français définit les infractions, crimes, délits et contraventions, et les peines applicables selon le code pénal et la procédure pénale." }, 2: { title: "Code pénal", index: 2, extract: "Le code pénal est le recueil des lois qui définit les infractions et fixe leurs peines en France, avec les principes de légalité." } } } };
const h = creerHubSimule({ vide: true, fetch: async (u) => ({ ok: true, status: 200, json: async () => (String(u).includes("wikipedia") ? wiki : {}), text: async () => "" }) });
const n = await creerNoyau();
let r = await n.curiosite(); ok(!r.fait && /coupée/.test(r.raison), "coupée par défaut : rien n'est fait");
n.reglage("curiosite", "on");
h.hote.reglage.ecrire("noyau-curiosite", "on");
h.definirLive({ focus: true }); r = await n.curiosite(); ok(!r.fait && /calme/.test(r.raison), "jamais en Focus");
h.definirLive({ verrouille: true }); r = await n.curiosite(); ok(!r.fait, "jamais écran verrouillé");
h.definirLive({}); h.fixer(new Date(2026, 9, 26, 23, 30)); r = await n.curiosite(); ok(!r.fait, "jamais la nuit");
h.fixer(new Date(2026, 9, 26, 10, 0));
r = await n.curiosite(); ok(r.fait && r.programme && r.trouve >= 1, "étudie un sous-thème du programme : « " + r.sujet + " » (" + r.domaine + "), " + r.trouve + " fiche(s)");
const av = n.aValider(); ok(av.length >= 1 && av.every((p) => p.theme), "les fiches attendent dans « À valider », rattachées à leur sous-thème");
ok(n.savoir.carte().global === 0, "rien n'est appris sans ton accord : toujours 0 %");
r = await n.curiosite(); ok(!r.fait && /30 minutes/.test(r.raison), "une étude toutes les 30 min au plus");
const premier = av[0].theme;
let sujets = [premier];
for (let i = 0; i < 8; i++) { h.avancer(31 * 6e4); r = await n.curiosite(); if (r.fait) sujets.push(r.sujet); }
ok(r.raison === undefined || /atteintes|pleine|rien/.test(r.raison), "limite atteinte ou boîte pleine : " + (r.raison || "ok"));
ok(n.aValider().length <= 14, "la boîte « À valider » ne déborde pas : " + n.aValider().length);
ok(new Set(sujets).size === sujets.length, "pas deux fois le même sous-thème cette semaine");
const j = h.hote.reglage.lire("noyau-curiosite-etat", "{}"); ok(JSON.parse(j).prog <= 6, "au plus 6 études par jour");
ok(n.budget.utilisees() === 0, "aucune requête Gemini");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
