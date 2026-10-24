// Noyau · recherche locale BM25 (contrat, sections 2 et 4.4). Aucun import : module pur.
// Différences voulues avec l'application v3.8 : vrai BM25 (fréquence ET rareté des mots), mots entiers (« ia » ne trouve plus « via »),
// accents et pluriels ignorés, aucun favoritisme pour une source, aucun synonyme orienté. Les fautes de frappe ne servent qu'en dernier
// recours, quand la recherche exacte ne trouve rien.

const STOP = new Set(("a au aux avec ce ces cet cette c d de des du elle elles en es est et eux il ils j je l la le les leur leurs lui m ma mais me meme mes moi mon n ne nos notre nous on ou par pas pour qu que qui s sa se ses son sur t ta te tes toi ton tu un une vos votre vous y " +
  "ai as avons avez ont suis sommes etes sont etais etait ete etre avoir fait faire dit dans plus tout tous tres si comme donc or ni car aussi bien cela ca ceci quoi dont ou quel quelle quels quelles quand comment pourquoi combien the of and to in is it for on that this with").split(" "));

/** Minuscules, sans accents, apostrophes unifiées. */
export function normaliser(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`´]/g, "'").replace(/œ/g, "oe").replace(/æ/g, "ae");
}

/** Pluriel simple, appliqué pareil à la question et aux textes. */
function racine(m) {
  if (m.length > 5 && m.endsWith("aux")) return m.slice(0, -3) + "al";
  if (m.length > 3 && (m.endsWith("s") || m.endsWith("x"))) return m.slice(0, -1);
  return m;
}

/** Mots entiers, sans mots vides ; les nombres sont gardés. */
export function jetons(s, { vides = true } = {}) {
  const out = [];
  for (const m of normaliser(s).split(/[^a-z0-9]+/)) {
    if (!m) continue;
    if (vides && (STOP.has(m) || (m.length < 2 && !/\d/.test(m)))) continue;
    out.push(racine(m));
  }
  return out;
}

function levenshtein1(a, b) {          // vrai si la distance d'édition est au plus 1
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {                       // deux lettres échangées (« ordinatuer »)
    for (let k = 0; k < la - 1; k++) if (a[k] !== b[k]) { if (a[k] === b[k + 1] && a[k + 1] === b[k] && a.slice(k + 2) === b.slice(k + 2)) return true; break; }
  }
  let i = 0, j = 0, diff = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return diff + (la - i) + (lb - j) <= 1;
}

export class Index {
  constructor({ k1 = 1.5, b = 0.75 } = {}) { this.k1 = k1; this.b = b; this.docs = new Map(); this.df = new Map(); this.total = 0; }
  get taille() { return this.docs.size; }

  ajouter(id, texte) {
    if (this.docs.has(id)) this.retirer(id);
    const tf = new Map(); let len = 0;
    for (const t of jetons(texte)) { tf.set(t, (tf.get(t) || 0) + 1); len++; }
    this.docs.set(id, { tf, len }); this.total += len;
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
  }
  retirer(id) {
    const d = this.docs.get(id); if (!d) return;
    for (const t of d.tf.keys()) { const n = (this.df.get(t) || 1) - 1; if (n <= 0) this.df.delete(t); else this.df.set(t, n); }
    this.total -= d.len; this.docs.delete(id);
  }
  /** Résultats triés [{ id, score, pertinence }] ; pertinence = score ramené entre 0 et 1 (le meilleur vaut 1). */
  chercher(requete, { limite = 10, filtre = null, corriger = true } = {}) {
    let q = jetons(requete);
    if (!q.length || !this.docs.size) return [];
    let res = this._score(q, filtre);
    if (!res.length && corriger) {            // dernier recours : une lettre de travers
      const voc = [...this.df.keys()];
      q = q.flatMap((t) => this.df.has(t) || t.length < 5 ? [t] : (voc.filter((v) => v.length >= 5 && levenshtein1(t, v)).slice(0, 3) || [t]));
      res = this._score(q, filtre);
    }
    res.sort((a, b) => b.score - a.score);
    const max = res.length ? res[0].score : 1;
    return res.slice(0, limite).map((r) => ({ ...r, pertinence: max > 0 ? r.score / max : 0 }));
  }
  _score(q, filtre) {
    const N = this.docs.size, avg = this.total / N || 1, out = [];
    const uniq = [...new Set(q)];
    for (const [id, d] of this.docs) {
      if (filtre && !filtre(id)) continue;
      let s = 0;
      for (const t of uniq) {
        const f = d.tf.get(t); if (!f) continue;
        const df = this.df.get(t) || 0, idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        s += idf * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * d.len / avg));
      }
      if (s > 0) out.push({ id, score: s });
    }
    return out;
  }
}

/** Résumé local d'un texte : les phrases qui contiennent le plus de mots de la question (0 requête). */
export function resumerLocalement(texte, question, max = 2) {
  const phrases = String(texte || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter((p) => p.length > 20);
  if (!phrases.length) return String(texte || "").slice(0, 240);
  const q = new Set(jetons(question));
  const notes = phrases.map((p, i) => ({ p, i, s: jetons(p).filter((t) => q.has(t)).length - i * 0.01 }));
  return notes.sort((a, b) => b.s - a.s).slice(0, max).sort((a, b) => a.i - b.i).map((x) => x.p).join(" ").slice(0, 400);
}
