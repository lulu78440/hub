// Laboratoire · essais du socle d'IA locale : `node labo/essais-socle.mjs` (aucun modèle, aucun réseau : worker et backend simulés)
import { detecterCapacites, choisirMode, decouperMots, diffuserMots, creerClientIA, moteurSocle } from "../js/noyau/socle.js";
import { traiter } from "../js/noyau/worker-ia.js";
import { ErreurNoyau } from "../js/noyau/moteurs.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Détection et choix du mode ---
const cap = (o) => ({ webgpu: false, wasm: true, worker: true, memoire: 8, coeurs: 8, mobile: false, ...o });
ok(choisirMode(cap({ webgpu: true })).mode === "webgpu", "PC avec WebGPU : mode webgpu");
ok(choisirMode(cap({})).mode === "wasm", "PC sans WebGPU : mode wasm");
ok(choisirMode(cap({ mobile: true })).mode === "sans-ia", "mobile sans WebGPU : pas d'IA (batterie)");
ok(choisirMode(cap({ memoire: 2 })).mode === "sans-ia", "moins de 4 Go sans WebGPU : pas d'IA");
ok(choisirMode(cap({ memoire: null })).mode === "wasm", "mémoire inconnue (Firefox) : wasm permis");
ok(choisirMode(cap({ webgpu: true, worker: false })).mode === "sans-ia", "sans worker : jamais d'IA dans la page");
ok(choisirMode(cap({ webgpu: false, wasm: false })).mode === "sans-ia", "ni WebGPU ni WASM : pas d'IA");
ok(choisirMode(cap({ webgpu: true }), { preference: "wasm" }).mode === "wasm", "préférence wasm respectée");
ok(choisirMode(cap({ webgpu: true }), { preference: "sans-ia" }).mode === "sans-ia", "préférence « sans IA » respectée");
ok(choisirMode(cap({ webgpu: false }), { preference: "webgpu" }).mode !== "webgpu", "une préférence ne force jamais plus que l'appareil ne permet");
ok(choisirMode(cap({ mobile: true })).raison.length > 10, "chaque choix s'explique en une phrase");
const c1 = await detecterCapacites({ nav: { gpu: { requestAdapter: async () => ({}) }, deviceMemory: 8, userAgent: "Windows" }, glob: { WebAssembly: {}, Worker: function () {} } });
ok(c1.webgpu && c1.wasm && c1.worker && !c1.mobile, "détection : PC complet");
const c2 = await detecterCapacites({ nav: { gpu: { requestAdapter: async () => { throw new Error("refusé"); } }, userAgent: "Android Mobile" }, glob: { WebAssembly: {} } });
ok(!c2.webgpu && c2.wasm && !c2.worker && c2.mobile, "détection : adaptateur refusé, mobile, pas de worker");
const c3 = await detecterCapacites({ nav: {}, glob: {} });
ok(!c3.webgpu && !c3.wasm && !c3.worker, "détection : environnement vide sans planter");

// --- Mot par mot ---
const phrase = "Bonjour Lucien,\n  voici   ta journée.";
ok(decouperMots(phrase).join("") === phrase, "découpe en mots sans rien perdre (espaces et retours à la ligne gardés)");
const recus = []; const r1 = await diffuserMots(phrase, (m) => recus.push(m), { delai: 0 });
ok(recus.join("") === phrase && r1.texte === phrase && recus.length > 5, "diffusion mot par mot : " + recus.filter((x) => /\S/.test(x)).length + " mots");
const ctl = new AbortController(); let n = 0;
const r2 = await diffuserMots("un deux trois quatre cinq", () => { if (++n === 3) ctl.abort(); }, { delai: 0, signal: ctl.signal });
ok(r2.interrompu && r2.texte.length < "un deux trois quatre cinq".length, "arrêt en cours de diffusion");
let tics = 0; const iv = setInterval(() => tics++, 2);
await diffuserMots("mot ".repeat(60), () => {}, { delai: 3 });
clearInterval(iv);
ok(tics > 10, "la page garde la main pendant la diffusion (" + tics + " tics d'horloge)");

// --- Worker simulé : deux fils séparés par des messages, comme le vrai ---
function faussesDeuxFaces(backend, { chargeurs = null, muet = false, planter = false } = {}) {
  const etat = { backends: new Map(), annules: new Set() };
  const w = { onmessage: null, onerror: null, arrete: false, recu: [],
    postMessage(msg) { w.recu.push(msg); if (muet) return; if (planter) { setTimeout(() => w.onerror && w.onerror({ message: "boum" }), 1); return; }
      setTimeout(() => traiter(msg, { envoyer: (m) => setTimeout(() => w.onmessage && w.onmessage({ data: m }), 0), etat, chargeurs: chargeurs || { webgpu: async () => backend, wasm: async () => backend }, delaiMot: 0 }), 0); },
    terminate() { w.arrete = true; } };
  return w;
}
const flux = { async generer({ surMot }) { let c = ""; for (const m of ["Bon", "jour", " Lu", "cien"]) { c += m; surMot(m, c); await pause(1); } return c; } };
const brut = { async generer() { return "Voici une réponse complète sans diffusion."; } };

let w = faussesDeuxFaces(flux); let client = creerClientIA({ creerWorker: () => w, mode: "webgpu" }); const morceaux = [];
let res = await client.generer({ systeme: "s", messages: [{ role: "user", content: "salut" }], surMot: (m) => morceaux.push(m) });
ok(res.texte === "Bonjour Lucien" && morceaux.join("") === "Bonjour Lucien" && morceaux.length === 4, "moteur qui diffuse : les morceaux arrivent un à un");
ok(w.recu[0].type === "generer" && w.recu[0].mode === "webgpu", "la page ne fait que poster un message au worker");

w = faussesDeuxFaces(brut); client = creerClientIA({ creerWorker: () => w, mode: "wasm" }); const mots = [];
res = await client.generer({ systeme: "s", messages: [], surMot: (m) => mots.push(m) });
ok(res.texte === "Voici une réponse complète sans diffusion." && mots.join("") === res.texte && mots.length > 8, "moteur sans diffusion : mot par mot quand même (« partout »)");

const lent = { async generer({ surMot, signal }) { let c = ""; for (let i = 0; i < 50; i++) { if (signal.aborted) break; c += "mot" + i + " "; surMot("mot" + i + " ", c); await pause(3); } return c; } };
w = faussesDeuxFaces(lent); client = creerClientIA({ creerWorker: () => w, mode: "webgpu" }); const ac = new AbortController(); let vus = 0;
res = await client.generer({ systeme: "s", messages: [], surMot: () => { if (++vus === 4) ac.abort(); }, signal: ac.signal });
ok(res.interrompu && vus < 50 && w.recu.some((m) => m.type === "annuler"), "« arrêter la réponse » : le worker reçoit l'annulation et s'arrête (" + vus + " mots sur 50)");

const casse = { async generer() { throw new Error("mémoire insuffisante"); } };
w = faussesDeuxFaces(casse); client = creerClientIA({ creerWorker: () => w, mode: "webgpu" });
let err = null; try { await client.generer({ systeme: "s", messages: [] }); } catch (e) { err = e; }
ok(err instanceof ErreurNoyau && /mémoire insuffisante/.test(err.message), "erreur du modèle : remontée en ErreurNoyau claire");

w = faussesDeuxFaces(null, { muet: true }); client = creerClientIA({ creerWorker: () => w, mode: "webgpu", silenceMax: 40 });
err = null; try { await client.generer({ systeme: "s", messages: [] }); } catch (e) { err = e; }
ok(err instanceof ErreurNoyau && w.arrete, "worker muet : arrêté après le délai, le hub continue sans IA");

w = faussesDeuxFaces(null, { planter: true }); client = creerClientIA({ creerWorker: () => w, mode: "webgpu" });
err = null; try { await client.generer({ systeme: "s", messages: [] }); } catch (e) { err = e; }
ok(err instanceof ErreurNoyau && /planté/.test(err.message) && w.arrete, "worker qui plante : erreur claire et worker arrêté");

let cree = 0; client = creerClientIA({ creerWorker: () => { cree++; return {}; }, mode: "sans-ia" });
err = null; try { await client.generer({ systeme: "s", messages: [] }); } catch (e) { err = e; }
ok(err instanceof ErreurNoyau && cree === 0, "mode sans-ia : aucun worker créé, erreur claire pour que l'appelant réponde sans IA");

w = faussesDeuxFaces(flux); client = creerClientIA({ creerWorker: () => w, mode: "webgpu" }); const moteur = moteurSocle({ client });
const rep = await moteur.generer({ systeme: "s", messages: [{ role: "user", texte: "salut" }, { role: "outil", texte: "ignoré" }] });
ok(rep.texte === "Bonjour Lucien" && rep.appels.length === 0 && moteur.texteSeulement && w.recu[0].messages.length === 1, "moteur au format du Noyau : texte seulement, sans outils");

const progres = []; w = faussesDeuxFaces(null, { chargeurs: { webgpu: async ({ surProgres }) => { surProgres("Téléchargement", 0.5); return brut; } } }); client = creerClientIA({ creerWorker: () => w, mode: "webgpu" });
await client.generer({ systeme: "s", messages: [], surProgres: (t, p) => progres.push([t, p]) });
ok(progres.length === 1 && progres[0][1] === 0.5, "la progression du chargement remonte à la page (taille et barre : lab-modeles)");

console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
