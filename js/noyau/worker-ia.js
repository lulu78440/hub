// Noyau · worker de l'IA locale (lab-socle). Tourne HORS de la page : le hub ne se fige jamais pendant un calcul.
// `traiter` est pur (essais dans labo/essais-socle.mjs) ; les vraies bibliothèques ne sont chargées qu'au premier besoin, et seulement
// sur demande de Lucien (téléchargement de modèle à l'accord, voir lab-modeles). Le chargement des bibliothèques n'a PAS été essayé
// dans l'atelier de Claude (pas de WebGPU, réseau filtré) : à éprouver sur l'appareil de Lucien.
//
// Bibliothèques (constats B14 et L1 du Banc, décision de Lucien du 25/10) : versions EXACTES, jamais flottantes. Copie dans vendor/ impossible
// depuis l'atelier (registre npm et CDN bloqués, les dépôts git ne contiennent pas les fichiers construits) : chargées depuis jsDelivr à version
// figée. Pas de contrôle d'intégrité possible sur un import() dynamique sans connaître l'empreinte du fichier : à ajouter avec la copie vendor/.
//
// Cloisonnement : le worker partage l'origine du hub. Il ne reçoit QUE le texte nécessaire (consigne + messages de la conversation, en texte,
// bornés : voir nettoyerDemande) ; jamais d'objet du hub, de clé ni de base. Avant de charger une bibliothèque, il ferme l'accès aux bases
// IndexedDB du hub (verrouillerBases) : seules les bases des bibliothèques d'IA restent ouvrables. C'est une défense en profondeur, pas une
// garantie absolue (même origine) ; la garantie complète demanderait une origine à part (iframe isolée), à étudier avec la refonte.
import { diffuserMots } from "./socle.js";

export const LIB_WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";            // Apache-2.0, étiquette v0.2.85 du 07/09/2026
export const LIB_TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm"; // Apache-2.0, même version que sens.js

// ---------- Ce que le worker accepte de la page ----------
export const BORNES = { systeme: 8000, message: 4000, messages: 40, modele: 120 };
const texte = (v, max) => String(v == null ? "" : v).slice(0, max);
/**
 * Ne garde d'une demande que des champs simples et du texte borné. Tout autre champ (objet du hub, clé, base, fonction…) est jeté.
 * Renvoie la demande nettoyée, ou null si elle est illisible.
 */
export function nettoyerDemande(msg) {
  if (!msg || typeof msg !== "object") return null;
  const id = typeof msg.id === "number" || typeof msg.id === "string" ? msg.id : null;
  if (msg.type === "annuler") return { id, type: "annuler" };
  const modele = typeof msg.modele === "string" && /^[\w.\-\/]{1,120}$/.test(msg.modele) ? msg.modele : null;
  if (msg.type === "transcrire") return msg.audio instanceof Float32Array ? { id, type: "transcrire", modele, audio: msg.audio } : null;
  if (msg.type !== "generer") return null;
  const messages = (Array.isArray(msg.messages) ? msg.messages : []).slice(-BORNES.messages)
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: texte(m.content, BORNES.message) }));
  return { id, type: "generer", mode: typeof msg.mode === "string" ? msg.mode : "", modele, systeme: texte(msg.systeme, BORNES.systeme), messages };
}

// ---------- Fermeture des bases du hub dans le worker ----------
/** Bases que les bibliothèques d'IA peuvent ouvrir (caches de modèles). Toute autre base (hub, hub-appareil, noyau-…) est refusée. */
export const BASES_PERMISES = /^(webllm|tvmjs|transformers|onnx)/i;
/** Remplace indexedDB dans la portée `glob` par une version qui refuse les bases du hub. Renvoie true si le verrou est posé. */
export function verrouillerBases(glob) {
  const vrai = glob && glob.indexedDB; if (!vrai) return false;
  const refus = (nom) => { const e = new Error("Base « " + nom + " » fermée au worker de l'IA (données du hub)."); e.name = "SecurityError"; return e; };
  const garde = Object.freeze({
    open(nom, ...r) { if (!BASES_PERMISES.test(String(nom))) throw refus(nom); return vrai.open(nom, ...r); },
    deleteDatabase(nom) { if (!BASES_PERMISES.test(String(nom))) throw refus(nom); return vrai.deleteDatabase(nom); },
    databases() { return Promise.resolve([]); },
    cmp: (a, b) => vrai.cmp(a, b)
  });
  const desc = { get: () => garde, configurable: false, enumerable: true };
  for (let o = glob; o; o = Object.getPrototypeOf(o)) {          // la propriété vit sur le prototype (WorkerGlobalScope) : on la masque partout
    if (Object.prototype.hasOwnProperty.call(o, "indexedDB")) { try { Object.defineProperty(o, "indexedDB", desc); } catch { /* déjà verrouillée */ } }
  }
  try { if (!Object.prototype.hasOwnProperty.call(glob, "indexedDB")) Object.defineProperty(glob, "indexedDB", desc); } catch { /* idem */ }
  return glob.indexedDB === garde;
}

/** Chargeurs réels. Chacun renvoie un backend : { async generer({ systeme, messages, modele, surMot, signal, surProgres }) → texte }. */
export const CHARGEURS = {
  // WebGPU : WebLLM (Apache-2.0), comme l'IA locale actuelle.
  async webgpu({ modele, surProgres }) {
    const lib = await import(/* @vite-ignore */ LIB_WEBLLM);
    const moteur = await lib.CreateMLCEngine(modele || "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", { initProgressCallback: (r) => surProgres(r.text, r.progress) });
    return { async generer({ systeme, messages, surMot, signal }) {
      let cumul = "";
      const flux = await moteur.chat.completions.create({ messages: [{ role: "system", content: systeme }, ...messages], temperature: 0.6, max_tokens: 500, stream: true });
      for await (const part of flux) {
        if (signal && signal.aborted) { try { moteur.interruptGenerate(); } catch { /* rien à interrompre */ } break; }
        const d = (part.choices[0] && part.choices[0].delta && part.choices[0].delta.content) || ""; if (d) { cumul += d; surMot(d, cumul); }
      }
      return cumul;
    } };
  },
  // Dictée : Whisper tiny (MIT) via Transformers.js, ≈ 40 Mo, téléchargé seulement avec l'accord de Lucien. Jamais essayé dans l'atelier.
  async whisper({ modele, surProgres }) {
    const lib = await import(/* @vite-ignore */ LIB_TRANSFORMERS);
    const pipe = await lib.pipeline("automatic-speech-recognition", modele || "onnx-community/whisper-tiny", { dtype: "q8", device: "wasm", progress_callback: (p) => surProgres(p.status || "", typeof p.progress === "number" ? p.progress / 100 : null) });
    return { async transcrire(audio) { const r = await pipe(audio, { language: "french", task: "transcribe" }); return String((r && r.text) || "").trim(); } };
  },
  // WASM : Transformers.js (Apache-2.0), petit modèle quantifié sur le processeur. Version figée (3.0.2).
  async wasm({ modele, surProgres }) {
    const lib = await import(/* @vite-ignore */ LIB_TRANSFORMERS);
    const pipe = await lib.pipeline("text-generation", modele || "onnx-community/Qwen2.5-0.5B-Instruct", { dtype: "q4", device: "wasm", progress_callback: (p) => surProgres(p.status || "", typeof p.progress === "number" ? p.progress / 100 : null) });
    return { async generer({ systeme, messages, signal }) {
      if (signal && signal.aborted) return "";
      const sortie = await pipe([{ role: "system", content: systeme }, ...messages], { max_new_tokens: 300, do_sample: false });
      const t = sortie[0] && sortie[0].generated_text; return Array.isArray(t) ? (t[t.length - 1].content || "") : String(t || "");
    } };
  }
};

/**
 * Traite un message reçu de la page.
 *  - envoyer(msg) : renvoie un message à la page ;
 *  - etat : { backends: Map mode→backend, annules: Set d'identifiants } conservé entre les messages ;
 *  - chargeurs : remplaçable par les essais.
 */
export async function traiter(brut, { envoyer, etat, chargeurs = CHARGEURS, delaiMot = 18, attendre } = {}) {
  const msg = nettoyerDemande(brut); if (!msg) return;              // demande illisible ou champ inattendu : ignorée
  const { id } = msg;
  if (msg.type === "annuler") { etat.annules.add(id); return; }
  if (msg.type === "transcrire") {          // dictée : audio 16 kHz (Float32Array) → texte, dans le worker
    try {
      if (!etat.backends.has("whisper")) etat.backends.set("whisper", await chargeurs.whisper({ modele: msg.modele, surProgres: (texte, part) => envoyer({ id, type: "progres", texte, part }) }));
      const texte = await etat.backends.get("whisper").transcrire(msg.audio);
      envoyer({ id, type: "fin", texte, interrompu: false });
    } catch (e) { envoyer({ id, type: "erreur", message: e && e.message ? e.message : String(e) }); }
    return;
  }
  if (msg.type !== "generer") return;
  const signal = { get aborted() { return etat.annules.has(id); } };
  try {
    if (!etat.backends.has(msg.mode)) {
      if (!chargeurs[msg.mode]) throw new Error("Mode inconnu : " + msg.mode);
      etat.backends.set(msg.mode, await chargeurs[msg.mode]({ modele: msg.modele, surProgres: (texte, part) => envoyer({ id, type: "progres", texte, part }) }));
    }
    let vu = false;
    const surMot = (mot, cumul) => { vu = true; envoyer({ id, type: "mot", mot, cumul }); };
    const texte = await etat.backends.get(msg.mode).generer({ systeme: msg.systeme, messages: msg.messages, modele: msg.modele, surMot, signal, surProgres: () => {} });
    if (!vu && texte) await diffuserMots(texte, (mot, cumul) => envoyer({ id, type: "mot", mot, cumul }), { delai: delaiMot, signal, ...(attendre ? { attendre } : {}) });   // moteur sans diffusion : mot par mot quand même
    envoyer({ id, type: "fin", texte, interrompu: signal.aborted });
  } catch (e) {
    envoyer({ id, type: "erreur", message: e && e.message ? e.message : String(e) });
  } finally { etat.annules.delete(id); }
}

// Branchement réel : seulement quand ce fichier tourne dans un worker.
if (typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope) {
  verrouillerBases(self);                                            // avant tout chargement de bibliothèque
  const etat = { backends: new Map(), annules: new Set() };
  self.onmessage = (e) => { traiter(e.data || {}, { envoyer: (m) => self.postMessage(m), etat }); };
}
