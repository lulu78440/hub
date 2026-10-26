// Noyau · transformations de jeux (orchestrateur, lot 3). Fonctions pures : jeu vérifié (+ options) → jeu brut, que le magasin re-vérifie.
// Toute opération est écrite à la main, en liste blanche. Les calculs sont faits ICI, jamais par le modèle ; le résultat garde la source,
// la date des données et la licence du jeu d'origine, et son nom dit qu'il a été calculé par le hub.
import { dateVersMs } from "./modules/composants.js";

export const OPERATIONS = ["periode", "colonnes", "variation", "indice100", "moyenne_mobile", "derniers", "comparer"];
export class RefusTransformation extends Error { constructor(m) { super(m); this.name = "RefusTransformation"; } }
const refus = (m) => { throw new RefusTransformation(m); };

const axe = (j) => { const c = j.colonnes.find((x) => x.type === "date"); if (!c) refus("ce jeu n'a pas de colonne de dates : cette opération est impossible"); return c; };
const nombres = (j) => j.colonnes.filter((c) => c.type === "nombre");
const coupe = (s, n) => String(s).slice(0, n);
const id = (base, suf) => coupe(base, 31 - suf.length) + suf;

/** [début, fin exclue] en ms d'un texte « 2020 », « 2020-03 » ou « 2020-03-15 ». */
export function bornes(s) {
  const t = dateVersMs(s); if (t == null) refus(`date invalide « ${coupe(s, 20)} » (attendu AAAA, AAAA-MM ou AAAA-MM-JJ)`);
  const n = String(s).length, d = new Date(t);
  const fin = n === 4 ? Date.UTC(d.getUTCFullYear() + 1, 0, 1) : n === 7 ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) : t + 86400000;
  return [t, fin];
}
const periodeDe = (j, lignes) => {
  const a = axe(j); const d = lignes.map((l) => l[a.i]).filter(Boolean);
  return d.length ? (d[0] === d[d.length - 1] ? d[0] : `${d[0]} → ${d[d.length - 1]}`) : "aucune donnée";
};
function deriver(j, etiquette, { colonnes = j.colonnes, lignes, unite = j.unite, titre = j.titre } = {}) {
  const s = j.source;
  const nom = coupe(`${s.nom} · ${etiquette} (calculé par le hub)`, 120);
  const cols = colonnes.map((c, i) => ({ id: c.id, libelle: coupe(c.libelle, 60), type: c.type }));
  const tmp = { colonnes: cols.map((c, i) => ({ ...c, i })) };
  return {
    titre: coupe(titre ? `${titre} · ${etiquette}` : etiquette, 120), unite: coupe(unite, 40), colonnes: cols, lignes,
    source: { nom, maj: s.maj, periode: coupe(lignes.length ? periodeDe({ colonnes: tmp.colonnes }, lignes) : "aucune donnée", 60), url: s.url || "", licence: s.licence || "", requete: s.requete || "", verifie: s.verifie },
    exemple: j.exemple === true
  };
}
const colsChoisies = (j, ids) => {
  const num = nombres(j); if (!num.length) refus("ce jeu n'a aucune colonne de nombres");
  if (!ids || !ids.length) return num;
  return ids.map((x) => { const c = num.find((n) => n.id === x); if (!c) refus(`colonne « ${coupe(x, 30)} » absente ou non numérique (disponibles : ${num.map((n) => n.id).join(", ")})`); return c; });
};

const OPS = {
  periode(j, o) {
    const a = axe(j); if (!o.debut && !o.fin) refus("période : indique un début et/ou une fin");
    const d0 = o.debut ? bornes(o.debut)[0] : -Infinity, d1 = o.fin ? bornes(o.fin)[1] : Infinity;
    if (d0 >= d1) refus("période : le début est après la fin");
    const l = j.lignes.filter((r) => { const t = dateVersMs(r[a.i]); return t != null && t >= d0 && t < d1; });
    return deriver(j, `période ${o.debut || "…"} → ${o.fin || "…"}`, { lignes: l.map((r) => r.slice()) });
  },
  colonnes(j, o) {
    const a = axe(j), garde = colsChoisies(j, o.colonnes), cols = [a, ...garde];
    return deriver(j, "colonnes choisies", { colonnes: cols, lignes: j.lignes.map((r) => cols.map((c) => r[c.i])) });
  },
  variation(j, o) {
    const a = axe(j), garde = colsChoisies(j, o.colonnes), depuis = o.mode === "depuis_debut";
    const cols = [a, ...garde.map((c) => ({ id: id(c.id, "_pct"), libelle: coupe(c.libelle + " (variation %)", 60), type: "nombre" }))];
    const base = garde.map((c) => { const r = j.lignes.find((l) => l[c.i] != null); return r ? r[c.i] : null; });
    const lignes = j.lignes.map((r, n) => [r[a.i], ...garde.map((c, k) => {
      const v = r[c.i], ref = depuis ? base[k] : (n > 0 ? j.lignes[n - 1][c.i] : null);
      return v == null || ref == null || ref === 0 || (depuis && n === 0) ? null : ((v / ref) - 1) * 100;
    })]);
    return deriver(j, depuis ? "variation depuis le début" : "variation par rapport à la ligne précédente", { colonnes: cols, lignes, unite: "%" });
  },
  indice100(j, o) {
    const a = axe(j), garde = colsChoisies(j, o.colonnes);
    const base = garde.map((c) => { const r = j.lignes.find((l) => l[c.i] != null); return r ? r[c.i] : null; });
    if (base.some((b) => b == null || b === 0)) refus("indice base 100 impossible : la première valeur est absente ou nulle");
    const cols = [a, ...garde.map((c) => ({ id: id(c.id, "_i100"), libelle: coupe(c.libelle + " (base 100)", 60), type: "nombre" }))];
    return deriver(j, "base 100 à la première valeur", { colonnes: cols, lignes: j.lignes.map((r) => [r[a.i], ...garde.map((c, k) => (r[c.i] == null ? null : (r[c.i] / base[k]) * 100))]), unite: "indice base 100" });
  },
  moyenne_mobile(j, o) {
    const n = o.n; if (!Number.isInteger(n) || n < 2 || n > 24) refus("moyenne mobile : fenêtre de 2 à 24 lignes");
    const a = axe(j), garde = colsChoisies(j, o.colonnes);
    const cols = [a, ...garde.map((c) => ({ id: id(c.id, "_mm"), libelle: coupe(`${c.libelle} (moyenne sur ${n})`, 60), type: "nombre" }))];
    const lignes = j.lignes.map((r, i) => [r[a.i], ...garde.map((c) => {
      if (i < n - 1) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) { const v = j.lignes[k][c.i]; if (v == null) return null; s += v; } return s / n;
    })]);
    return deriver(j, `moyenne mobile sur ${n}`, { colonnes: cols, lignes });
  },
  derniers(j, o) {
    const n = o.n; if (!Number.isInteger(n) || n < 1 || n > 500) refus("derniers : de 1 à 500 lignes");
    return deriver(j, `${n} dernières lignes`, { lignes: j.lignes.slice(-n).map((r) => r.slice()) });
  },
  comparer(j, o, autre) {
    if (!autre) refus("comparer : il faut un second jeu (paramètre « avec »)");
    if (j.unite !== autre.unite) refus(`comparer : unités différentes (« ${j.unite} » et « ${autre.unite} »). Passe d'abord chaque jeu en base 100 ou en variation.`);
    const a = axe(j), b = axe(autre), ca = colsChoisies(j, o.colonnes && o.colonnes.slice(0, 1))[0], cb = colsChoisies(autre, o.colonnes_avec && o.colonnes_avec.slice(0, 1))[0];
    const mapA = new Map(j.lignes.map((r) => [r[a.i], r[ca.i]])), mapB = new Map(autre.lignes.map((r) => [r[b.i], r[cb.i]]));
    const communes = [...mapA.keys()].filter((d) => mapB.has(d));
    if (!communes.length) refus("comparer : les deux jeux n'ont aucune date en commun");
    const nomA = coupe(j.titre || j.source.nom, 60);
    let nomB = coupe(autre.titre || autre.source.nom, 60); if (nomB === nomA) nomB = coupe(nomB, 56) + " (2)";
    // forme « longue » (date, série, valeur) : c'est celle que la courbe sait tracer en deux lignes
    const lignes = []; for (const d of communes) lignes.push([d, nomA, mapA.get(d)], [d, nomB, mapB.get(d)]);
    const cols = [a, { id: "serie", libelle: "Série", type: "texte" }, { id: "valeur", libelle: coupe(`Valeur (${j.unite})`, 60), type: "nombre" }];
    const s1 = j.source, s2 = autre.source, memeSource = s1.nom === s2.nom;
    const brut = deriver(j, `comparaison avec ${coupe(nomB, 30)}`, { colonnes: cols, lignes });
    brut.source = { ...brut.source, nom: coupe(memeSource ? `${s1.nom} · comparaison (calculée par le hub)` : `${s1.nom} + ${s2.nom} · comparaison (calculée par le hub)`, 120),
      maj: s1.maj > s2.maj ? s1.maj : s2.maj, licence: s1.licence === s2.licence ? (s1.licence || "") : coupe([s1.licence, s2.licence].filter(Boolean).join(" ; "), 80), verifie: s1.verifie && s2.verifie };
    brut.exemple = j.exemple === true || autre.exemple === true;
    return brut;
  }
};

/** transformer(jeu, { operation, … }, autreJeu?) → jeu brut (à re-vérifier par le magasin). */
export function transformer(jeu, o, autre = null) {
  if (!o || !Object.prototype.hasOwnProperty.call(OPS, o.operation)) refus(`opération inconnue « ${coupe(o && o.operation, 30)} » (permises : ${OPERATIONS.join(", ")})`);
  return OPS[o.operation](jeu, o, autre);
}
