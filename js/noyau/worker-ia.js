// Noyau · worker de l'IA locale (lab-socle). Tourne HORS de la page : le hub ne se fige jamais pendant un calcul.
// `traiter` est pur (essais dans labo/essais-socle.mjs) ; les vraies bibliothèques ne sont chargées qu'au premier besoin, et seulement
// sur demande de Lucien (téléchargement de modèle à l'accord, voir lab-modeles). Le chargement des bibliothèques n'a PAS été essayé
// dans l'atelier de Claude (pas de WebGPU, réseau filtré) : à éprouver sur l'appareil de Lucien.
import { diffuserMots } from "./socle.js";

/** Chargeurs réels. Chacun renvoie un backend : { async generer({ systeme, messages, modele, surMot, signal, surProgres }) → texte }. */
export const CHARGEURS = {
  // WebGPU : WebLLM (Apache-2.0), comme l'IA locale actuelle.
  async webgpu({ modele, surProgres }) {
    const lib = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2/+esm");
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
  // WASM : Transformers.js (Apache-2.0), petit modèle quantifié sur le processeur. Version à figer lors du premier essai réel.
  async wasm({ modele, surProgres }) {
    const lib = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/+esm");
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
export async function traiter(msg, { envoyer, etat, chargeurs = CHARGEURS, delaiMot = 18, attendre } = {}) {
  const { id } = msg;
  if (msg.type === "annuler") { etat.annules.add(id); return; }
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
  const etat = { backends: new Map(), annules: new Set() };
  self.onmessage = (e) => { traiter(e.data || {}, { envoyer: (m) => self.postMessage(m), etat }); };
}
