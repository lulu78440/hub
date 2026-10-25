// Atelier · moteur at-simulateur : compare des options selon des critères pondérés.
// Module pur : sans DOM, sans réseau, sans IA.
// Critère : { id, nom?, poids (>= 0, n'importe quelle échelle, normalisé à 1), sens?: "haut" (défaut, plus c'est haut mieux c'est) | "bas" }
// Option  : { id, nom?, notes: { [idCritere]: note de 0 à 10 } } ; une note absente compte 0 et est signalée.
// Score d'une option = somme(poids normalisé × note), sur 10. Pour un critère "bas", la note utilisée est 10 − note.

const arrondi = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

/** Poids normalisés (somme = 1). Poids négatifs ou invalides → 0. Si tous valent 0 : poids égaux. */
export function normaliser(criteres) {
  const p = (criteres || []).map((c) => (Number.isFinite(+c?.poids) && +c.poids > 0 ? +c.poids : 0));
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((x) => (s > 0 ? x / s : p.length ? 1 / p.length : 0));
}

function preparer(options, criteres) {
  const problemes = [];
  const C = (criteres || []).filter((c) => c && c.id != null);
  if (!C.length) throw new Error("Au moins un critère est attendu.");
  const O = (options || []).filter((o) => o && o.id != null);
  if (!O.length) throw new Error("Au moins une option est attendue.");
  const ids = new Set();
  for (const c of C) { if (ids.has(c.id)) problemes.push(`critère « ${c.id} » en double`); ids.add(c.id); if (!(+c.poids >= 0)) problemes.push(`poids invalide pour « ${c.nom || c.id} » (compté 0)`); }
  if (C.every((c) => !(+c.poids > 0))) problemes.push("tous les poids valent 0 : poids égaux utilisés");
  // Matrice des notes utiles (0-10, déjà inversées pour les critères "bas").
  const M = O.map((o) => C.map((c) => {
    let n = o.notes ? +o.notes[c.id] : NaN;
    if (!Number.isFinite(n)) { problemes.push(`note manquante : ${o.nom || o.id} / ${c.nom || c.id} (comptée 0)`); n = 0; }
    else if (n < 0 || n > 10) { problemes.push(`note hors de 0-10 ramenée dans l'intervalle : ${o.nom || o.id} / ${c.nom || c.id}`); n = Math.min(10, Math.max(0, n)); }
    return c.sens === "bas" ? 10 - n : n;
  }));
  return { C, O, M, problemes };
}

const scores = (M, w) => M.map((ligne) => ligne.reduce((s, n, j) => s + n * w[j], 0));
const premier = (sc) => sc.reduce((b, s, i) => (s > sc[b] + 1e-9 ? i : b), 0);

/** Compare : { classement: [{ rang, id, nom, score, detail: { [idCritere]: contribution } }], poids: { [id]: poids normalisé }, ecartPremier, egalite, problemes, texte }.
 *  À score égal (à 0,01 près), même rang ; l'ordre suit alors l'ordre d'entrée. */
export function comparer(options, criteres) {
  const { C, O, M, problemes } = preparer(options, criteres);
  const w = normaliser(C), sc = scores(M, w);
  const tri = O.map((o, i) => ({ i, s: sc[i] })).sort((a, b) => b.s - a.s || a.i - b.i);
  const classement = []; let rang = 0, prec = null;
  tri.forEach((t, k) => {
    const s = arrondi(t.s);
    if (prec === null || s < prec) rang = k + 1; prec = s;
    const detail = {}; C.forEach((c, j) => (detail[c.id] = arrondi(M[t.i][j] * w[j])));
    classement.push({ rang, id: O[t.i].id, nom: O[t.i].nom || String(O[t.i].id), score: s, detail });
  });
  const poids = {}; C.forEach((c, j) => (poids[c.id] = arrondi(w[j], 4)));
  const ecartPremier = classement.length > 1 ? arrondi(classement[0].score - classement[1].score) : null;
  const egalite = classement.length > 1 && classement[1].rang === 1;
  const texte = [`${egalite ? "Égalité en tête" : "En tête"} : ${classement.filter((x) => x.rang === 1).map((x) => x.nom).join(", ")} (${classement[0].score.toLocaleString("fr-FR")}/10)`,
    ...classement.map((x) => `${x.rang}. ${x.nom} — ${x.score.toLocaleString("fr-FR")}/10`)].join("\n");
  return { classement, poids, ecartPremier, egalite, problemes, texte };
}

/** Sensibilité : pour chaque critère, de combien faut-il changer son poids (en points de pourcentage du total, les autres
 *  gardant leurs proportions) pour que la première option change. Recherche par pas de `pas` points (défaut 1), puis affinage.
 *  → { premier, criteres: [{ id, nom, poids (en %), hausse: { points, nouveauPremier } | null, baisse: idem | null }], plusFragile, texte } */
export function sensibilite(options, criteres, { pas = 1 } = {}) {
  const { C, O, M } = preparer(options, criteres);
  const w = normaliser(C), p0 = premier(scores(M, w));
  const avec = (j, wj) => {
    const reste = 1 - w[j];
    return w.map((x, k) => (k === j ? wj : reste > 1e-12 ? (x * (1 - wj)) / reste : (1 - wj) / (w.length - 1)));
  };
  const chercher = (j, dir) => {
    if (C.length < 2) return null;
    const limite = dir > 0 ? (1 - w[j]) * 100 : w[j] * 100;
    let avant = 0;
    for (let d = pas; d <= limite + 1e-9; d += pas) {
      const p = premier(scores(M, avec(j, w[j] + (dir * Math.min(d, limite)) / 100)));
      if (p !== p0) {
        let lo = avant, hi = Math.min(d, limite); // affinage par dichotomie au centième de point
        for (let k = 0; k < 30 && hi - lo > 0.005; k++) { const m = (lo + hi) / 2; if (premier(scores(M, avec(j, w[j] + (dir * m) / 100))) !== p0) hi = m; else lo = m; }
        const pf = premier(scores(M, avec(j, w[j] + (dir * hi) / 100)));
        return { points: arrondi(hi, 1), nouveauPremier: O[pf].nom || String(O[pf].id) };
      }
      avant = Math.min(d, limite);
    }
    return null;
  };
  const res = C.map((c, j) => ({ id: c.id, nom: c.nom || String(c.id), poids: arrondi(w[j] * 100, 1), hausse: chercher(j, 1), baisse: chercher(j, -1) }));
  let fragile = null;
  for (const r of res) for (const [sens, v] of [["hausse", r.hausse], ["baisse", r.baisse]]) if (v && (!fragile || v.points < fragile.points)) fragile = { id: r.id, nom: r.nom, sens, ...v };
  const nomP = O[p0].nom || String(O[p0].id);
  const texte = fragile
    ? `${nomP} reste en tête tant qu'aucun poids ne bouge de plus de ${fragile.points.toLocaleString("fr-FR")} points ; au-delà, ${fragile.sens === "hausse" ? "augmenter" : "baisser"} « ${fragile.nom} » fait passer ${fragile.nouveauPremier} devant.`
    : `${nomP} reste en tête quel que soit le poids d'un critère pris seul : choix solide.`;
  return { premier: nomP, criteres: res, plusFragile: fragile, texte };
}
