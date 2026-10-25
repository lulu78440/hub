// Noyau · socle d'IA locale (lab-socle). Trois promesses :
//  1. le hub ne se fige jamais : tout calcul d'IA se fait dans un worker, jamais dans la page ;
//  2. le meilleur mode selon l'appareil (WebGPU, sinon WASM, sinon pas d'IA) ;
//  3. les réponses arrivent mot par mot, partout, même si le moteur ne sait pas diffuser.
// Toute fonction IA doit aussi marcher sans IA : le mode « sans-ia » lève une erreur claire et l'appelant retombe sur ses règles.
// Module sans effet de bord : worker, navigateur et horloge sont injectables (essais dans labo/essais-socle.mjs).
import { ErreurNoyau } from "./moteurs.js";

export const MODES = ["webgpu", "wasm", "sans-ia"];
export const DELAI_SILENCE_MS = 120000;        // un worker muet plus de 2 min est arrêté (le premier chargement d'un modèle peut être long)

// ---------- 1. Détection ----------
/** Sonde l'appareil. `nav` et `glob` sont injectables. Ne télécharge rien. */
export async function detecterCapacites({ nav = typeof navigator !== "undefined" ? navigator : {}, glob = globalThis } = {}) {
  let webgpu = false;
  try { if (nav.gpu && typeof nav.gpu.requestAdapter === "function") webgpu = !!(await nav.gpu.requestAdapter()); } catch { webgpu = false; }
  const wasm = typeof glob.WebAssembly === "object" && glob.WebAssembly !== null;
  const worker = typeof glob.Worker === "function";
  const memoire = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;   // Go, arrondi par le navigateur (absent dans Firefox et Safari)
  const mobile = !!(nav.userAgentData ? nav.userAgentData.mobile : /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || ""));
  return { webgpu, wasm, worker, memoire, coeurs: nav.hardwareConcurrency || null, mobile };
}

/**
 * Choisit le mode. `preference` vient des réglages de Lucien : "auto" ou un mode précis (jamais plus puissant que l'appareil ne le permet).
 * Prudence : sans worker, jamais d'IA dans la page. Mobile ou mémoire inférieure à 4 Go : pas de WASM (batterie, plantages).
 */
export function choisirMode(cap, { preference = "auto" } = {}) {
  if (preference === "sans-ia") return { mode: "sans-ia", raison: "IA locale coupée dans les réglages." };
  if (!cap.worker) return { mode: "sans-ia", raison: "Ce navigateur n'a pas de worker : l'IA locale pourrait figer le hub, elle reste coupée." };
  const faible = cap.mobile || (cap.memoire !== null && cap.memoire < 4);
  if (cap.webgpu && preference !== "wasm") return { mode: "webgpu", raison: "WebGPU disponible : calcul sur la carte graphique." };
  if (cap.wasm && !faible) return { mode: "wasm", raison: cap.webgpu ? "WASM choisi dans les réglages." : "Pas de WebGPU : calcul sur le processeur (plus lent)." };
  if (cap.wasm && faible) return { mode: "sans-ia", raison: "Appareil léger (mobile ou moins de 4 Go de mémoire) sans WebGPU : l'IA locale est coupée pour protéger la batterie." };
  return { mode: "sans-ia", raison: "Ni WebGPU ni WebAssembly : pas d'IA locale sur cet appareil." };
}

// ---------- 2. Mot par mot ----------
/** Coupe en mots en gardant les espaces et les retours à la ligne : concaténer les morceaux redonne exactement le texte. */
export const decouperMots = (texte) => String(texte == null ? "" : texte).match(/\s+|[^\s]+/g) || [];

/** Diffuse un texte déjà complet mot par mot, en rendant la main entre deux mots (la page reste fluide). */
export async function diffuserMots(texte, surMot, { delai = 18, signal = null, attendre = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let envoye = "";
  for (const m of decouperMots(texte)) {
    if (signal && signal.aborted) return { texte: envoye, interrompu: true };
    envoye += m; surMot(m, envoye);
    if (/\S/.test(m)) await attendre(delai);
  }
  return { texte: envoye, interrompu: false };
}

// ---------- 3. Client du worker ----------
/** Crée le vrai worker (module). Écrit ici pour que les essais le remplacent par un faux. */
export function creerWorkerReel() { return new Worker(new URL("./worker-ia.js", import.meta.url), { type: "module" }); }

/**
 * Client : parle au worker par messages, jamais autrement.
 *  - creerWorker() : renvoie un objet { postMessage, terminate, onmessage, onerror } ;
 *  - mode : "webgpu" | "wasm" (le mode "sans-ia" ne crée aucun worker) ;
 *  - generer({ systeme, messages, surMot, surProgres, signal, modele }) → { texte, interrompu, ms }.
 */
export function creerClientIA({ creerWorker = creerWorkerReel, mode, silenceMax = DELAI_SILENCE_MS, minuteur = { debut: setTimeout, fin: clearTimeout } } = {}) {
  let w = null, seq = 0; const en_cours = new Map();
  function demarrer() {
    if (w) return w;
    w = creerWorker();
    w.onmessage = (e) => { const m = e.data || {}; const t = en_cours.get(m.id); if (t) t(m); };
    w.onerror = (e) => { const err = new ErreurNoyau("local", "Le worker de l'IA locale a planté : " + (e && e.message ? e.message : "erreur inconnue")); for (const t of [...en_cours.values()]) t({ type: "plantage", erreur: err }); };
    return w;
  }
  function arreter() { if (w) { try { w.terminate(); } catch { /* déjà arrêté */ } } w = null; }
  return {
    mode,
    async generer({ systeme = "", messages = [], surMot = () => {}, surProgres = () => {}, signal = null, modele = null } = {}) {
      if (mode === "sans-ia") throw new ErreurNoyau("local", "Pas d'IA locale sur cet appareil ou dans les réglages : réponse sans IA.");
      const t0 = Date.now(), id = ++seq, ww = demarrer();
      return new Promise((resolve, reject) => {
        let garde = null, fini = false;
        const clore = () => { fini = true; minuteur.fin(garde); en_cours.delete(id); if (signal) signal.removeEventListener("abort", surAbort); };
        const armer = () => { minuteur.fin(garde); garde = minuteur.debut(() => { if (fini) return; clore(); arreter(); reject(new ErreurNoyau("local", "L'IA locale ne répond plus : worker arrêté, le hub continue sans IA.")); }, silenceMax); };
        const surAbort = () => { try { ww.postMessage({ id, type: "annuler" }); } catch { /* worker déjà parti */ } };
        en_cours.set(id, (m) => {
          if (fini) return; armer();
          if (m.type === "mot") surMot(m.mot, m.cumul);
          else if (m.type === "progres") surProgres(m.texte, m.part);
          else if (m.type === "fin") { clore(); resolve({ texte: m.texte, interrompu: !!m.interrompu, ms: Date.now() - t0 }); }
          else if (m.type === "erreur") { clore(); reject(new ErreurNoyau("local", m.message || "Erreur de l'IA locale")); }
          else if (m.type === "plantage") { clore(); arreter(); reject(m.erreur); }
        });
        armer();
        if (signal) { if (signal.aborted) { clore(); return resolve({ texte: "", interrompu: true, ms: 0 }); } signal.addEventListener("abort", surAbort); }
        ww.postMessage({ id, type: "generer", mode, modele, systeme, messages });
      });
    },
    arreter
  };
}

/** Moteur au format du Noyau (comme moteurLocal) : texte seulement, aucun outil. Les mots arrivent par `surMot` s'il est fourni. */
export function moteurSocle({ client, surMot = () => {}, surProgres = () => {} }) {
  return {
    nom: "IA locale · " + client.mode, type: "local", texteSeulement: true, mode: client.mode,
    async generer({ systeme, messages, signal = null }) {
      const r = await client.generer({ systeme, messages: (messages || []).filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.texte || "" })), surMot, surProgres, signal });
      return { texte: r.texte, appels: [], brut: null, usage: { entree: 0, sortie: 0, total: 0 }, ms: r.ms, interrompu: r.interrompu };
    }
  };
}
