// Noyau · disposition d'un plan en graphe de nœuds (orchestrateur, lot 4). Fonction pure, sans DOM.
// Idée empruntée à React Flow, en lecture seule : les étapes sont des nœuds, les « $N.champ » des flèches.
// Disposition en colonnes, de gauche à droite : une étape est placée une colonne après la plus lointaine de ses dépendances.

const MAX_ETAPES = 6;
const RE_REF = /^\$([1-9])\.([a-z_][a-z0-9_]{0,30})$/;

export const NOEUD = Object.freeze({ l: 176, h: 54, ecartX: 46, ecartY: 16, marge: 10 });
export const STATUTS_PLAN = Object.freeze({
  prevue: { libelle: "Prévue", glyphe: "·" },
  reussie: { libelle: "Réussie", glyphe: "✓" },
  echec: { libelle: "En échec", glyphe: "✕" },
  refusee: { libelle: "Refusée", glyphe: "⏸" },
  non_executee: { libelle: "Non exécutée", glyphe: "○" },
  annulee: { libelle: "Annulée", glyphe: "⊘" },
  ignoree: { libelle: "Ignorée (plan limité)", glyphe: "–" }
});

/** Statut d'une ligne rendue par executerPlan (ou « prévue » si l'on n'a que le plan, sans exécution). */
export function statutEtape(l) {
  if (!l || typeof l.ok !== "boolean") return "prevue";
  if (l.ok) return "reussie";
  if (l.saute) return "ignoree";
  if (l.annule) return "annulee";
  if (l.refus) return "refusee";
  if (l.cause === "dependance") return "non_executee";
  return "echec";
}

/**
 * Disposition : étapes = [{ n, nom, depend_de: [n…], ligne? }] (verifierPlan().etapes, éventuellement avec la ligne exécutée).
 * Rend { noeuds: [{ n, nom, x, y, couche, statut }], liens: [{ de, a, d }], largeur, hauteur }.
 * Une dépendance vers une étape qui n'existe pas ou n'est pas avant est ignorée (le plan est déjà refusé ailleurs), jamais tracée.
 */
export function disposerPlan(etapes) {
  const l = Array.isArray(etapes) ? etapes.slice(0, 12) : [];
  const par = new Map(l.map((e) => [e.n, e]));
  const couche = new Map();
  for (const e of l) {
    const deps = (e.depend_de || []).filter((d) => par.has(d) && d < e.n);
    couche.set(e.n, deps.length ? 1 + Math.max(...deps.map((d) => couche.get(d))) : 0);
  }
  const lignes = new Map(), noeuds = [];
  for (const e of l) {
    const c = couche.get(e.n), r = lignes.get(c) || 0; lignes.set(c, r + 1);
    noeuds.push({ n: e.n, nom: String(e.nom || "?"), couche: c, rang: r, x: NOEUD.marge + c * (NOEUD.l + NOEUD.ecartX), y: NOEUD.marge + r * (NOEUD.h + NOEUD.ecartY), statut: statutEtape(e.ligne), ligne: e.ligne || null });
  }
  const pos = new Map(noeuds.map((n) => [n.n, n]));
  const liens = [];
  for (const e of l) for (const d of (e.depend_de || [])) {
    const a = pos.get(d), b = pos.get(e.n); if (!a || !b || d >= e.n) continue;
    const x1 = a.x + NOEUD.l, y1 = a.y + NOEUD.h / 2, x2 = b.x, y2 = b.y + NOEUD.h / 2, m = (x1 + x2) / 2;
    liens.push({ de: d, a: e.n, d: `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2 - 2} ${y2}` });
  }
  const colonnes = noeuds.length ? Math.max(...noeuds.map((n) => n.couche)) + 1 : 0, rangs = noeuds.length ? Math.max(...lignes.values()) : 0;
  return { noeuds, liens, largeur: colonnes ? 2 * NOEUD.marge + colonnes * NOEUD.l + (colonnes - 1) * NOEUD.ecartX : 0, hauteur: rangs ? 2 * NOEUD.marge + rangs * NOEUD.h + (rangs - 1) * NOEUD.ecartY : 0 };
}

/** Texte d'une étape pour la liste de secours (lecteur d'écran, petit écran) : « 2. lire_serie · Réussie · 2 essais ». */
export function lignePlanTexte(n) {
  const L = n.ligne || {};
  return `${n.n}. ${n.nom} · ${STATUTS_PLAN[n.statut].libelle}${(L.essais || 1) > 1 ? ` · ${L.essais} essais` : ""}${L.secours ? ` · remplacée par ${L.secours}` : ""}${L.erreur && n.statut !== "reussie" ? ` · ${String(L.erreur).slice(0, 100)}` : ""}`;
}

/** Étapes dont dépend une étape (les « $N.champ » de ses paramètres), dans l'ordre croissant. Texte mal écrit : ignoré ici, refusé à l'exécution. */
export function dependances(params, profondeur = 0, out = new Set()) {
  if (profondeur > 4) return [];
  if (typeof params === "string") { const m = RE_REF.exec(params); if (m) out.add(+m[1]); }
  else if (Array.isArray(params)) params.forEach((x) => dependances(x, profondeur + 1, out));
  else if (params && typeof params === "object") Object.values(params).forEach((x) => dependances(x, profondeur + 1, out));
  return [...out].sort((a, b) => a - b);
}

/** Contrôle statique d'un plan, sans rien exécuter : { ok, problemes: [texte], etapes: [{ n, nom, depend_de }] }. Sert à l'affichage du graphe. */
export function verifierPlan(appels, { max = MAX_ETAPES } = {}) {
  const problemes = [], etapes = [];
  if (!Array.isArray(appels) || !appels.length) return { ok: false, problemes: ["plan vide"], etapes };
  appels.forEach((a, i) => {
    const n = i + 1, dep = dependances(a && a.params || {});
    etapes.push({ n, nom: a && typeof a.nom === "string" ? a.nom : "?", depend_de: dep });
    if (n > max) problemes.push(`étape ${n} au-delà de la limite de ${max}`);
    for (const d of dep) if (d >= n) problemes.push(`étape ${n} : dépend de l'étape ${d}, qui n'est pas avant elle (référence circulaire ou vers l'avenir)`);
  });
  return { ok: problemes.length === 0, problemes, etapes };
}

