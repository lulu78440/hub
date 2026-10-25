// Noyau · recherche par le sens (facultative, désactivée par défaut).
// Un petit modèle multilingue (embeddings) transforme chaque fiche et chaque question en vecteur ; deux textes de même sens se retrouvent
// même sans mot commun (« canidé » → « chien »). Il s'ajoute à la recherche par mots (BM25), il ne la remplace pas.
// Téléchargé une seule fois depuis Hugging Face (environ 120 Mo) sur accord explicite de Lucien, puis gardé par le navigateur. Tout tourne dans le navigateur
// (WebGPU si disponible, sinon WebAssembly) : aucun texte ne quitte l'appareil. Les vecteurs restent sur l'appareil (jamais synchronisés, jamais dans le dépôt).
// Non testé sur un vrai navigateur dans l'espace de travail de Claude (pas de WebGPU ni d'accès à Hugging Face) : le chargeur est injectable pour les essais.
import { hote } from "./hote.js";

export const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm";
export const MODELE = "Xenova/multilingual-e5-small";
const TYPES = ["kb", "wiki", "sem", "pro"];

/** Chargeur réel : renvoie une fonction texte -> Float32Array normalisé. */
export async function chargerTransformers(surProgres = () => {}) {
  const lib = await import(/* @vite-ignore */ LIB);
  lib.env.allowLocalModels = false;
  const extraire = await lib.pipeline("feature-extraction", MODELE, { device: typeof navigator !== "undefined" && navigator.gpu ? "webgpu" : "wasm", dtype: "q8", progress_callback: (p) => { if (p && p.status === "progress") surProgres(Math.round(p.progress || 0)); } });
  return async (texte) => { const o = await extraire(texte, { pooling: "mean", normalize: true }); return Float32Array.from(o.data); };
}

const empreinte = (t) => { let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36) + t.length; };
const cos = (a, b) => { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; };      // vecteurs normalisés

/** Stockage des vecteurs : IndexedDB dédiée (hors des collections synchronisées) ; en mémoire seulement si indisponible. */
function stockage() {
  const mem = new Map(); let db = null;
  const ouvrir = () => new Promise((ok) => { try { const r = indexedDB.open("noyau-sens", 1); r.onupgradeneeded = () => r.result.createObjectStore("v", { keyPath: "id" }); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); } });
  return {
    async charger() { db = typeof indexedDB !== "undefined" ? await ouvrir() : null; if (!db) return mem; await new Promise((ok) => { const q = db.transaction("v").objectStore("v").getAll(); q.onsuccess = () => { for (const x of q.result) mem.set(x.id, x); ok(); }; q.onerror = () => ok(); }); return mem; },
    async mettre(x) { mem.set(x.id, x); if (db) try { db.transaction("v", "readwrite").objectStore("v").put(x); } catch (e) { /* tant pis */ } },
    async retirer(id) { mem.delete(id); if (db) try { db.transaction("v", "readwrite").objectStore("v").delete(id); } catch (e) { /* tant pis */ } },
    async vider() { mem.clear(); if (db) try { db.transaction("v", "readwrite").objectStore("v").clear(); } catch (e) { /* tant pis */ } },
    vecteurs: mem
  };
}

export function creerSens({ memoire, charger = chargerTransformers, pas = 60 }) {
  const st = stockage(); let etat = "off", progres = 0, erreur = "", embed = null, enCours = false, charge = false, indexes = 0;
  const actif = () => hote.reglage.lire("noyau-sens", "off") === "on";
  const texteDe = (it) => "passage: " + [it.titre, it.texte].filter(Boolean).join(". ").slice(0, 700);

  async function preparer() {
    if (embed || etat === "telechargement") return;
    etat = "telechargement"; progres = 0; erreur = "";
    try { await st.charger(); embed = await charger((p) => { progres = p; }); etat = "pret"; charge = true; }
    catch (e) { etat = "erreur"; erreur = String(e && e.message || e).slice(0, 120); embed = null; }
  }
  /** Calcule les vecteurs manquants par petits lots, quand la page est visible. Reprend là où il s'est arrêté. */
  async function indexer() {
    if (enCours || etat !== "pret") return; enCours = true;
    try {
      const items = memoire.tous({ archive: false }).filter((it) => TYPES.includes(it.type));
      for (const it of items) {
        if (etat !== "pret") break;
        const t = texteDe(it), h = empreinte(t), x = st.vecteurs.get(it.id);
        if (x && x.h === h) continue;
        while (typeof document !== "undefined" && document.hidden) await new Promise((r) => setTimeout(r, 2000));
        try { await st.mettre({ id: it.id, h, v: await embed(t) }); indexes++; } catch (e) { erreur = String(e.message || e).slice(0, 80); break; }
        await new Promise((r) => setTimeout(r, pas));        // respire : le hub reste fluide
      }
    } finally { enCours = false; }
  }
  const api = {
    get etat() { return !actif() ? "off" : etat; },
    statut() { const n = [...st.vecteurs.keys()].length; return { actif: actif(), etat: api.etat, progres, erreur, vecteurs: n, ajoutes: indexes, webgpu: typeof navigator !== "undefined" && !!navigator.gpu }; },
    /** Accord explicite de Lucien : active, télécharge, indexe. */
    async activer() { hote.reglage.ecrire("noyau-sens", "on"); await preparer(); indexer(); return api.statut(); },
    async desactiver({ effacer = false } = {}) { hote.reglage.ecrire("noyau-sens", "off"); if (effacer) { await st.vider(); } return api.statut(); },
    /** Au démarrage : si Lucien l'a déjà accepté, recharge (depuis le cache du navigateur) et complète l'index. */
    async demarrer() { if (actif() && !charge) { await preparer(); indexer(); } },
    nouveau() { if (actif() && etat === "pret") indexer(); },
    pret: () => actif() && etat === "pret",
    /** Vecteur d'une question ; null si le sens n'est pas prêt (la recherche par mots suffit alors). */
    async vecteurRequete(texte) { if (!api.pret()) return null; try { return await Promise.race([embed("query: " + String(texte).slice(0, 300)), new Promise((r) => setTimeout(() => r(null), 4000))]); } catch (e) { return null; } },
    /** Proximité de sens (0 à 1) entre la question et une fiche déjà vectorisée ; null si la fiche n'a pas de vecteur. */
    proximite(vecteur, id) { const x = st.vecteurs.get(id); if (!x || !vecteur) return null; return Math.max(0, Math.min(1, (cos(vecteur, x.v) - 0.78) / 0.2)); },
    plusProches(vecteur, n = 20, filtre = null) { const out = []; for (const [id, x] of st.vecteurs) { if (filtre && !filtre(id)) continue; out.push({ id, s: cos(vecteur, x.v) }); } return out.sort((a, b) => b.s - a.s).slice(0, n); }
  };
  return api;
}
