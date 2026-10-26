// Refonte 4 (7.40.0) · boutons « Sources » et « Annuler le plan » : `node labo/essais-vues.mjs`
// Hub simulé, DOM simulé, réseau simulé : aucun service réel. Prouve que le bouton n'apparaît que pendant un plan, que l'annulation coupe l'étape en cours,
// que les étapes restantes ne partent pas (et sont journalisées), et que la vue Sources est ouverte par le bouton et par l'événement de la palette.
import { installer, Elem } from "./faux-dom.js";
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { executerPlan } from "../js/noyau/execution.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const doc = installer(); const ecoutes = {};
doc.addEventListener = (t, f) => { (ecoutes[t] ||= []).push(f); }; doc.dispatchEvent = (e) => { (ecoutes[e.type] || []).forEach((f) => f(e)); return true; };
globalThis.CustomEvent = class { constructor(type, o = {}) { this.type = type; this.detail = o.detail; } };
function h(tag, attrs = {}, ...enf) { const e = doc.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "texte") e.textContent = v; else e.setAttribute(k, v === true ? "" : v); } for (const c of enf.flat()) if (c != null && c !== false) e.append(c); return e; }
const cache = (b) => (b.hidden === undefined ? b.hasAttribute("hidden") : b.hidden === true);   // le DOM simulé ne relie pas la propriété à l'attribut
const { monterControles } = await import("../js/ui/noyau-controles.js");

let appelsReseau = 0, coupes = 0;
const hub = creerHubSimule({ vide: true, fetch: (u, o) => { appelsReseau++; return new Promise((_, rej) => { if (o && o.signal) o.signal.addEventListener("abort", () => { coupes++; rej(Object.assign(new Error("abort"), { name: "AbortError" })); }); }); } });
const n = await creerNoyau({ moteur: { nom: "simulé", generer: async () => ({ texte: "", appels: [], usage: { total: 0 } }) } });
const racine = h("div", { class: "nx" }); racine.dataset = { vue: "chat" }; racine.closest = () => null; racine.querySelector = (s) => (s === ".nx-etat" ? null : racine.parClasse(s.slice(1))[0] || null); racine.prepend = (e) => { e.parentNode = racine; racine.childNodes.unshift(e); };
let sources = 0; const api = { afficherSources: async () => { sources++; }, changerVue() {} };
const c = monterControles({ racine, api, noyau: n, h });
ok(c && c.bSources.textContent === "Sources" && c.bSources.getAttribute("aria-label").includes("Sources de données"), "bouton « Sources » présent, étiquette ARIA");
ok(cache(c.bAnnuler) && c.bAnnuler.getAttribute("aria-label") === "Annuler le plan en cours", "« Annuler le plan » caché au repos, étiquette ARIA");
ok(c.bSources.getAttribute("type") === "button" && c.bAnnuler.getAttribute("type") === "button", "vrais boutons (clavier natif)");
c.bSources.click(); await new Promise((r) => setTimeout(r, 5)); ok(sources === 1, "clic sur « Sources » : afficherSources() appelée");
ok(monterControles({ racine, api, noyau: n, h }) === null, "second montage refusé (pas de doublon)");

// Palette : l'événement ouvre la vue ; sans écouteur, rien n'est pris
const d = { vue: "sources", pris: false }; doc.dispatchEvent(new CustomEvent("noyau:vue", { detail: d })); await new Promise((r) => setTimeout(r, 5));
ok(d.pris === true && sources === 2, "événement de la palette : vue Sources ouverte");
const d2 = { vue: "autre", pris: false }; doc.dispatchEvent(new CustomEvent("noyau:vue", { detail: d2 })); ok(!d2.pris && sources === 2, "vue inconnue : ignorée");

// Plan de 3 étapes : la 1re reste en attente réseau ; on annule pendant ce temps
const appels = [1, 2, 3].map((k) => ({ nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/V" + k } }));
const p = executerPlan(appels, { barriere: n.barriere, origine: "modele" });
await new Promise((r) => setTimeout(r, 400));
ok(!cache(c.bAnnuler), "pendant le plan : « Annuler le plan » visible");
c.bAnnuler.click();
const lignes = await p;
ok(coupes === 1 && appelsReseau === 1, "l'appel en cours est coupé, aucune autre requête n'est partie (" + appelsReseau + " requête)");
ok(lignes.length === 3 && !lignes[0].ok && lignes[1].cause === "annule" && lignes[2].cause === "annule", "étapes 2 et 3 : non exécutées, cause « annule »");
const lg = await hub.hote.stockage.lire("kv", "noyau-journal"); const journal = lg ? lg.lignes : [];
ok(journal.filter((l) => l.cause === "annule" && /Plan annulé/.test(l.erreur || "")).length >= 2, "les étapes non exécutées sont journalisées une à une");
await new Promise((r) => setTimeout(r, 900));
ok(cache(c.bAnnuler), "plan fini : le bouton se cache");
ok(/Plan annulé/.test(racine.parClasse("nx-vues-etat")[0].textContent), "message d'état en texte (pas de couleur seule)");

// Un appel hors plan n'est pas touché ; un nouveau plan repart avec un signal neuf
const r = await n.barriere.executer({ outil: "lire_fenetre", params: { fenetre: "notes" } }, { origine: "lucien" });
ok(typeof r.ok === "boolean" && cache(c.bAnnuler), "appel hors plan : traité comme avant, bouton resté caché");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
