// Noyau · spécification de module, version 1 (orchestrateur, lot 5). Une spécification DÉCRIT un module, elle n'en contient pas les chiffres :
//   { v: 1, titre, jeux: ["jeu:ab12cd34", "jeu:…"], transformations: [{ op, … }], vues: [{ type, x, y, series, categorie, valeur, titre }] }
// Le modèle propose, le hub dispose : tout est validé champ par champ (champ inconnu = refus), en liste blanche, avec des textes bornés sans adresse ni balise.
// Les transformations sont appliquées EN SÉRIE au premier jeu, par des fonctions écrites à la main (aucune expression, aucun code) ; les calculs sont ceux du hub
// et le résultat garde la source, la date des données et la licence. Le pied de sources est ajouté d'office par les composants : une vue ne peut pas le retirer.
// Quand le module est enregistré, les références « jeu:… » deviennent des emplacements « j1 », « j2 » dont la copie vérifiée est gardée à côté (stockage.js).
import { TYPES_VUE, verifierJeu, dateVersMs } from "./composants.js";
import { transformer, deriver, axe, bornes } from "../transformer.js";

export const VERSION_SPEC = 1;
export const MAX_JEUX = 3;
export const MAX_TRANSFORMATIONS = 6;
export const MAX_VUES = 3;
export const OPERATIONS_SPEC = Object.freeze(["filtrer", "trier", "agreger", "variation", "garder_colonnes", "limiter", "periode", "comparer"]);
const RE_REF = /^jeu:[a-z0-9]{6,16}$/, RE_SLOT = /^j[1-3]$/, RE_COL = /^[a-z][a-z0-9_]{0,31}$/;
const CONTROLE = new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]");
const FONCTIONS = ["somme", "moyenne", "min", "max"];

export class RefusSpec extends Error { constructor(m) { super("Spécification de module refusée : " + m); this.name = "RefusSpec"; } }
const refus = (m) => { throw new RefusSpec(m); };
const court = (v) => String(v).slice(0, 30);

function texte(v, max, nom) {
  if (typeof v !== "string" || !v.trim()) refus(nom + " manquant");
  const t = v.trim();
  if (t.length > max) refus(`${nom} trop long (${max} signes au plus)`);
  if (CONTROLE.test(t)) refus(nom + " : caractères de contrôle interdits");
  if (/[<>]/.test(t) || /(https?:|www\.|\/\/)/i.test(t)) refus(nom + " : ni balise ni adresse dans un texte");
  return t;
}
function champs(o, permis, nom) {
  if (!o || typeof o !== "object" || Array.isArray(o)) refus(nom + " : un objet est attendu");
  for (const k of Object.keys(o)) if (!permis.includes(k)) refus(`${nom} : champ inconnu « ${court(k)} »`);
}
const col = (v, nom) => { if (typeof v !== "string" || !RE_COL.test(v)) refus(`${nom} : identifiant de colonne invalide « ${court(v)} »`); return v; };
const entierEntre = (v, a, b, nom) => { if (!Number.isInteger(v) || v < a || v > b) refus(`${nom} : entier de ${a} à ${b}`); return v; };
const dateOk = (v, nom) => { if (typeof v !== "string" || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v) || dateVersMs(v) == null) refus(`${nom} : date AAAA, AAAA-MM ou AAAA-MM-JJ`); return v; };

const FORME_OP = {
  filtrer: ["op", "champ", "min", "max", "egal", "dans"], trier: ["op", "champ", "ordre"], agreger: ["op", "par", "fonction", "colonne"],
  variation: ["op", "colonnes", "mode"], garder_colonnes: ["op", "colonnes"], limiter: ["op", "n", "depuis"], periode: ["op", "debut", "fin"], comparer: ["op", "avec", "colonnes", "colonnes_avec"]
};
function verifierOp(o, i, nbJeux) {
  const nom = `transformation ${i + 1}`;
  if (!o || typeof o !== "object" || Array.isArray(o)) refus(nom + " : un objet est attendu");
  if (!OPERATIONS_SPEC.includes(o.op)) refus(`${nom} : opération inconnue « ${court(o.op)} » (permises : ${OPERATIONS_SPEC.join(", ")})`);
  champs(o, FORME_OP[o.op], nom);
  const r = { op: o.op };
  const liste = (v, n) => { if (v == null) return undefined; if (!Array.isArray(v) || !v.length || v.length > n) refus(`${nom} : liste de 1 à ${n} colonnes`); return v.map((c) => col(c, nom)); };
  if (o.op === "filtrer") {
    r.champ = col(o.champ, nom);
    for (const k of ["min", "max"]) if (o[k] != null) r[k] = typeof o[k] === "number" ? (Number.isFinite(o[k]) ? o[k] : refus(nom + " : nombre fini")) : dateOk(o[k], `${nom} · ${k}`);
    if (o.egal != null) r.egal = texte(String(o.egal), 80, nom + " · egal");
    if (o.dans != null) { if (!Array.isArray(o.dans) || !o.dans.length || o.dans.length > 10) refus(nom + " : « dans » est une liste de 1 à 10 valeurs"); r.dans = o.dans.map((x) => texte(String(x), 80, nom + " · dans")); }
    if (r.min === undefined && r.max === undefined && r.egal === undefined && r.dans === undefined) refus(nom + " : filtrer demande min, max, egal ou dans");
    if ([r.min, r.max].filter((x) => x !== undefined).some((x, _, a) => typeof x !== typeof a[0])) refus(nom + " : min et max du même genre");
  } else if (o.op === "trier") { r.champ = col(o.champ, nom); r.ordre = o.ordre == null ? "croissant" : o.ordre; if (!["croissant", "decroissant"].includes(r.ordre)) refus(nom + " : ordre croissant ou decroissant"); }
  else if (o.op === "agreger") {
    r.par = o.par === "annee" ? "annee" : col(o.par, nom); r.fonction = o.fonction; if (!FONCTIONS.includes(r.fonction)) refus(`${nom} : fonction ${FONCTIONS.join(", ")}`);
    r.colonne = col(o.colonne, nom);
  } else if (o.op === "variation") { const c = liste(o.colonnes, 8); if (c) r.colonnes = c; r.mode = o.mode == null ? "precedente" : o.mode; if (!["precedente", "depuis_debut"].includes(r.mode)) refus(nom + " : mode precedente ou depuis_debut"); }
  else if (o.op === "garder_colonnes") { r.colonnes = liste(o.colonnes, 8); if (!r.colonnes) refus(nom + " : colonnes manquantes"); }
  else if (o.op === "limiter") { r.n = entierEntre(o.n, 1, 500, nom + " · n"); r.depuis = o.depuis == null ? "fin" : o.depuis; if (!["debut", "fin"].includes(r.depuis)) refus(nom + " : depuis debut ou fin"); }
  else if (o.op === "periode") { if (o.debut == null && o.fin == null) refus(nom + " : un début et/ou une fin"); if (o.debut != null) r.debut = dateOk(o.debut, nom + " · debut"); if (o.fin != null) r.fin = dateOk(o.fin, nom + " · fin"); }
  else if (o.op === "comparer") {
    r.avec = entierEntre(o.avec, 1, MAX_JEUX - 1, nom + " · avec"); if (r.avec >= nbJeux) refus(`${nom} : le jeu n° ${r.avec + 1} n'existe pas dans « jeux »`);
    const c = liste(o.colonnes, 1), d = liste(o.colonnes_avec, 1); if (c) r.colonnes = c; if (d) r.colonnes_avec = d;
  }
  return r;
}
const OPTIONS_VUE = ["type", "x", "y", "series", "categorie", "valeur", "titre"];
function verifierVue(v, i) {
  const nom = `vue ${i + 1}`;
  champs(v, OPTIONS_VUE, nom);
  if (!TYPES_VUE.includes(v.type)) refus(`${nom} : type inconnu « ${court(v.type)} » (permis : ${TYPES_VUE.join(", ")})`);
  const r = { type: v.type };
  for (const k of ["x", "y", "series", "categorie", "valeur"]) if (v[k] != null) r[k] = col(v[k], `${nom} · ${k}`);
  if (v.titre != null) r.titre = texte(v.titre, 80, nom + " · titre");
  return r;
}

/** Vérifie une spécification et renvoie sa copie propre (rien du modèle n'est gardé tel quel). */
export function verifierSpec(spec) {
  champs(spec, ["v", "titre", "jeux", "transformations", "vues"], "spécification");
  if (spec.v !== VERSION_SPEC) refus(`version ${VERSION_SPEC} seulement (reçu : ${court(spec.v)})`);
  const titre = texte(spec.titre, 80, "titre");
  if (!Array.isArray(spec.jeux) || !spec.jeux.length || spec.jeux.length > MAX_JEUX) refus(`« jeux » : de 1 à ${MAX_JEUX} références`);
  const jeux = spec.jeux.map((j) => { if (typeof j !== "string" || !(RE_REF.test(j) || RE_SLOT.test(j))) refus(`jeu invalide « ${court(j)} » : seules des références « jeu:… » reçues d'un outil sont permises`); return j; });
  if (new Set(jeux).size !== jeux.length) refus("un même jeu est cité deux fois");
  const tr = spec.transformations == null ? [] : spec.transformations;
  if (!Array.isArray(tr) || tr.length > MAX_TRANSFORMATIONS) refus(`${MAX_TRANSFORMATIONS} transformations au plus`);
  const transformations = tr.map((o, i) => verifierOp(o, i, jeux.length));
  if (!Array.isArray(spec.vues) || !spec.vues.length || spec.vues.length > MAX_VUES) refus(`« vues » : de 1 à ${MAX_VUES}`);
  return { v: VERSION_SPEC, titre, jeux, transformations, vues: spec.vues.map(verifierVue) };
}

const sur = (j) => (j && j.verifie === true && Object.isFrozen(j) ? j : verifierJeu(j));
const nombres = (j) => j.colonnes.filter((c) => c.type === "nombre");
const colDe = (j, id, nom) => { const c = j.colonnes.find((x) => x.id === id); if (!c) refus(`${nom} : colonne « ${court(id)} » absente du jeu (disponibles : ${j.colonnes.map((x) => x.id).join(", ")})`); return c; };
const cmp = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : a < b ? -1 : a > b ? 1 : 0);   // les valeurs absentes vont à la fin

const EXEC = {
  filtrer(j, o) {
    const c = colDe(j, o.champ, "filtrer");
    let garde;
    if (c.type === "date") {
      if (typeof o.min === "number" || typeof o.max === "number") refus("filtrer : une colonne de dates se filtre avec des dates");
      const d0 = o.min !== undefined ? bornes(o.min)[0] : -Infinity, d1 = o.max !== undefined ? bornes(o.max)[1] : Infinity;
      garde = (v) => { const t = dateVersMs(v); return t != null && t >= d0 && t < d1; };
    } else if (c.type === "nombre") {
      if (typeof o.min === "string" || typeof o.max === "string") refus("filtrer : une colonne de nombres se filtre avec des nombres");
      garde = (v) => v != null && (o.min === undefined || v >= o.min) && (o.max === undefined || v <= o.max);
    } else {
      if (o.min !== undefined || o.max !== undefined) refus("filtrer : une colonne de texte se filtre avec egal ou dans");
      const permis = o.dans || [o.egal]; garde = (v) => v != null && permis.includes(v);
    }
    const lignes = j.lignes.filter((l) => garde(l[c.i])).map((l) => l.slice());
    if (!lignes.length) refus("filtrer : aucune ligne ne reste (rien n'est affiché)");
    return deriver(j, `filtre sur ${c.id}`, { lignes });
  },
  trier(j, o) {
    const c = colDe(j, o.champ, "trier"), s = o.ordre === "decroissant" ? -1 : 1;
    const lignes = j.lignes.map((l) => l.slice()).sort((a, b) => { const x = a[c.i], y = b[c.i]; return x == null || y == null ? cmp(x, y) : s * (c.type === "date" ? (dateVersMs(x) - dateVersMs(y)) : cmp(x, y)); });
    return deriver(j, `trié par ${c.id}`, { lignes });
  },
  agreger(j, o) {
    const v = colDe(j, o.colonne, "agreger"); if (v.type !== "nombre") refus("agreger : la colonne agrégée doit être numérique");
    let cle, colCle;
    if (o.par === "annee") { const a = axe(j); cle = (l) => (l[a.i] == null ? null : String(l[a.i]).slice(0, 4)); colCle = { id: "annee", libelle: "Année", type: "date" }; }
    else { const c = colDe(j, o.par, "agreger"); if (c.type === "nombre") refus("agreger : on regroupe par une date (annee) ou un texte"); cle = (l) => l[c.i]; colCle = { id: c.id, libelle: c.libelle, type: c.type }; }
    const g = new Map();
    for (const l of j.lignes) { const k = cle(l); if (k == null) continue; if (!g.has(k)) g.set(k, []); if (l[v.i] != null) g.get(k).push(l[v.i]); }
    const f = { somme: (a) => a.reduce((s, x) => s + x, 0), moyenne: (a) => a.reduce((s, x) => s + x, 0) / a.length, min: (a) => Math.min(...a), max: (a) => Math.max(...a) }[o.fonction];
    const lignes = [...g.entries()].map(([k, a]) => [k, a.length ? f(a) : null]);
    if (!lignes.length) refus("agreger : aucun groupe");
    const mot = { somme: "somme", moyenne: "moyenne", min: "minimum", max: "maximum" }[o.fonction];
    return deriver(j, `${mot} par ${colCle.id}`, { colonnes: [colCle, { id: v.id, libelle: `${v.libelle} (${mot})`.slice(0, 60), type: "nombre" }], lignes });
  },
  variation: (j, o) => transformer(j, { operation: "variation", colonnes: o.colonnes, mode: o.mode }),
  garder_colonnes: (j, o) => transformer(j, { operation: "colonnes", colonnes: o.colonnes }),
  limiter(j, o) { return o.depuis === "debut" ? deriver(j, `${o.n} premières lignes`, { lignes: j.lignes.slice(0, o.n).map((l) => l.slice()) }) : transformer(j, { operation: "derniers", n: o.n }); },
  periode: (j, o) => transformer(j, { operation: "periode", debut: o.debut, fin: o.fin })
};

/**
 * Applique la spécification (déjà vérifiée) : `jeu(nom)` renvoie le jeu vérifié d'un emplacement ou d'une référence (ou lève une erreur claire).
 * Renvoie { jeu, vues: [{ type, options, titre }] } où `jeu` est le jeu final (vérifié) et `options` les colonnes choisies par le hub quand la vue n'en précise pas.
 */
export function appliquerSpec(spec, jeu, optionsParDefaut) {
  const s = verifierSpec(spec);
  let cur = sur(jeu(s.jeux[0]));
  for (const o of s.transformations) {
    const brut = o.op === "comparer" ? transformer(cur, { operation: "comparer", colonnes: o.colonnes, colonnes_avec: o.colonnes_avec }, sur(jeu(s.jeux[o.avec]))) : EXEC[o.op](cur, o);
    cur = verifierJeu(brut);
  }
  const vues = s.vues.map((v) => {
    const { type, titre, ...voulu } = v;
    return { type, titre: titre || s.titre, options: optionsParDefaut(type, cur, voulu) };
  });
  return { jeu: cur, vues, titre: s.titre };
}

/** Remplace les références « jeu:… » par des emplacements j1, j2… (pour l'enregistrement). Renvoie { spec, refs: { j1: "jeu:…" } }. */
export function figerSpec(spec) {
  const s = verifierSpec(spec), refs = {};
  const jeux = s.jeux.map((r, i) => { const slot = "j" + (i + 1); refs[slot] = r; return slot; });
  return { spec: { ...s, jeux }, refs };
}

// ---------------------------------------------------------------- Modifier une spécification (« change en barres », « garde 2010-2024 »)
/** Nouvelle spécification où chaque vue prend le type demandé (colonnes remises au choix du hub). */
export function avecVue(spec, type) {
  if (!TYPES_VUE.includes(type)) refus(`type de vue inconnu « ${court(type)} »`);
  const s = verifierSpec(spec);
  return verifierSpec({ ...s, vues: s.vues.map((v) => ({ type, ...(v.titre ? { titre: v.titre } : {}) })) });
}
/** Nouvelle spécification qui ne garde que la période demandée (remplace une transformation « periode » déjà là). */
export function avecPeriode(spec, debut, fin) {
  const s = verifierSpec(spec), sans = s.transformations.filter((o) => o.op !== "periode");
  return verifierSpec({ ...s, transformations: [{ op: "periode", ...(debut ? { debut } : {}), ...(fin ? { fin } : {}) }, ...sans] });
}
const ligneOp = (o) => `${o.op}${o.champ ? " " + o.champ : ""}${o.debut || o.fin ? ` ${o.debut || "…"} → ${o.fin || "…"}` : ""}${o.n ? " " + o.n : ""}${o.fonction ? ` ${o.fonction} par ${o.par}` : ""}${o.ordre ? " " + o.ordre : ""}`;
/** Différence lisible entre deux spécifications, montrée à Lucien avant d'appliquer un changement. Liste vide = identiques. */
export function differenceSpec(a, b) {
  const x = verifierSpec(a), y = verifierSpec(b), d = [];
  if (x.titre !== y.titre) d.push(`titre : « ${x.titre} » → « ${y.titre} »`);
  if (x.jeux.join() !== y.jeux.join()) d.push(`jeux : ${x.jeux.join(", ")} → ${y.jeux.join(", ")}`);
  const tx = x.transformations.map(ligneOp), ty = y.transformations.map(ligneOp);
  for (const t of ty) if (!tx.includes(t)) d.push("ajouté : " + t);
  for (const t of tx) if (!ty.includes(t)) d.push("retiré : " + t);
  const vx = x.vues.map((v) => v.type).join(", "), vy = y.vues.map((v) => v.type).join(", ");
  if (vx !== vy) d.push(`vues : ${vx} → ${vy}`);
  return d;
}
