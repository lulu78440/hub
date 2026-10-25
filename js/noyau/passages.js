// Noyau · recherche par passages (lab-khoj-sens, partie « mots » : prête avant le modèle de sens). Idées reprises de Khoj, code écrit à la main :
//  1. découper les notes et fiches en petits passages (le Noyau ressort la phrase utile, pas la fiche entière) ;
//  2. ne réindexer que ce qui a changé (empreinte) ;
//  3. second tri des meilleurs résultats (termes de la question tous présents, proches les uns des autres).
// Sans IA, sans requête. La recherche par le sens (`sens.js`) pourra se brancher sur `reclasser` une fois essayée en réel.
import { Index, jetons } from "./recherche.js";

export function decouperPassages(texte, { mots = 60, chevauchement = 1 } = {}) {
  const phrases = String(texte == null ? "" : texte).replace(/\r/g, "").split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const out = []; let cur = [], n = 0;
  const pousser = () => { if (cur.length) out.push(cur.join(" ")); };
  for (const p of phrases) {
    const k = p.split(/\s+/).length;
    if (n + k > mots && cur.length) { pousser(); cur = cur.slice(-chevauchement); n = cur.reduce((s, x) => s + x.split(/\s+/).length, 0); }
    cur.push(p); n += k;
  }
  pousser(); return out;
}
/** Empreinte rapide (FNV-1a 32 bits) : sert seulement à voir qu'un texte a changé. */
export function empreinte(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }

/** Plus petite fenêtre (en mots) qui contient tous les termes trouvés ; Infinity s'il n'y en a aucun. */
function fenetreMin(motsPassage, termes) {
  const voulus = new Set(termes.filter((t) => motsPassage.includes(t))); if (!voulus.size) return Infinity;
  const vus = new Map(); let g = 0, best = Infinity;
  for (let d = 0; d < motsPassage.length; d++) {
    if (voulus.has(motsPassage[d])) vus.set(motsPassage[d], (vus.get(motsPassage[d]) || 0) + 1);
    while (vus.size === voulus.size) { best = Math.min(best, d - g + 1); const m = motsPassage[g]; if (voulus.has(m)) { vus.set(m, vus.get(m) - 1); if (!vus.get(m)) vus.delete(m); } g++; }
  }
  return best;
}

export function creerIndexPassages({ mots = 60, reclasser = null } = {}) {
  const ix = new Index(), docs = new Map(), passages = new Map();     // docs: id → { hash, ids[] }, passages: id → { doc, i, texte, mots[] }
  const retirerDoc = (id) => { const d = docs.get(id); if (!d) return; for (const p of d.ids) { ix.retirer(p); passages.delete(p); } docs.delete(id); };
  return {
    get taille() { return passages.size; },
    /** Met l'index à jour : seuls les documents nouveaux ou modifiés sont réindexés ; ceux qui ont disparu sont retirés. */
    maj(documents) {
      const bilan = { ajoutes: 0, modifies: 0, retires: 0, inchanges: 0 }, presents = new Set();
      for (const { id, texte } of documents || []) {
        presents.add(id); const h = empreinte(String(texte || "")), ancien = docs.get(id);
        if (ancien && ancien.hash === h) { bilan.inchanges++; continue; }
        if (ancien) { retirerDoc(id); bilan.modifies++; } else bilan.ajoutes++;
        const ids = decouperPassages(texte, { mots }).map((t, i) => { const pid = id + "#" + i; passages.set(pid, { doc: id, i, texte: t, mots: jetons(t) }); ix.ajouter(pid, t); return pid; });
        docs.set(id, { hash: h, ids });
      }
      for (const id of [...docs.keys()]) if (!presents.has(id)) { retirerDoc(id); bilan.retires++; }
      return bilan;
    },
    /** Meilleurs passages (jamais plus d'un par document en tête de liste), avec second tri. */
    async chercher(question, { limite = 5 } = {}) {
      const termes = [...new Set(jetons(question))]; if (!termes.length) return [];
      const brut = ix.chercher(question, { limite: limite * 4 });
      let res = brut.map((r) => { const p = passages.get(r.id), trouves = termes.filter((t) => p.mots.includes(t)), part = trouves.length / termes.length, fen = fenetreMin(p.mots, termes), proche = fen === Infinity ? 0 : Math.min(1, trouves.length / fen);
        return { doc: p.doc, passage: p.i, extrait: p.texte, score: r.score * (1 + 0.6 * part) * (1 + 0.4 * proche), termes_trouves: trouves.length }; });
      res.sort((a, b) => b.score - a.score);
      if (reclasser) { try { res = (await reclasser(question, res)) || res; } catch { /* retour au classement par mots */ } }
      const vus = new Set(), tete = [], reste = [];
      for (const r of res) (vus.has(r.doc) ? reste : tete).push(r), vus.add(r.doc);
      return [...tete, ...reste].slice(0, limite);
    }
  };
}
