// Noyau · composants d'affichage sûrs (lot 2 du plan orchestrateur, docs/noyau-orchestrateur/plan.md).
// Courbe, Barres, Tableau, ChiffreCle, Filtres, PiedSources, Exporter : SVG et DOM écrits à la main.
// Règles : aucune bibliothèque, aucun WebGL, aucune IA, aucun réseau. Les données arrivent sous forme d'un « jeu »
// vérifié par un schéma strict (listes blanches) ; tout texte venu de l'extérieur est posé avec textContent ou
// setAttribute, jamais en HTML. Sans source (nom, date de mise à jour, unité, période), un composant refuse de s'afficher.
// L'export (CSV, SVG) ne part que d'un vrai clic de Lucien (event.isTrusted) : le Noyau ne peut pas le déclencher.
// Aucun outil du Noyau n'appelle ces composants dans ce lot : ils sont appelables par le code (labo, fenêtre du Noyau).

const NS = "http://www.w3.org/2000/svg";
export const LIMITE_POINTS = 5000;          // par série ; au-delà, agrégation par moyenne, annoncée
export const MAX_SERIES = 6;
export const MAX_LIGNES = 100000;
export const MAX_COLONNES = 20;
export const MAX_CATEGORIES = 60;
export const FOND = "#02060d";              // fond du hub (--void) : référence des contrastes
export const TEXTE = "#dff6fd";             // --ink
export const DISCRET = "#7ea3b6";           // --dim
const GRILLE = "rgba(126,163,182,.22)";
/** Couleurs des séries (valeurs du thème) et motif de trait : une série ne se reconnaît jamais à la couleur seule. */
export const PALETTE = [
  { couleur: "#3fe6ff", tiret: "" }, { couleur: "#ffb347", tiret: "7 3" }, { couleur: "#9b72ff", tiret: "2 3" },
  { couleur: "#4fe3a8", tiret: "9 3 2 3" }, { couleur: "#ff8ad8", tiret: "12 4" }, { couleur: "#e8f4f8", tiret: "3 6" }
];
const TYPES = ["nombre", "texte", "date"];
const CLES_JEU = ["titre", "colonnes", "lignes", "unite", "source", "exemple"];
const CLES_SOURCE = ["nom", "url", "licence", "maj", "periode", "requete", "verifie"];
const CLES_COLONNE = ["id", "libelle", "type"];
// Caractères de contrôle, séparateurs de ligne Unicode et inversions bidirectionnelles (usurpation de texte) : refusés.
const CONTROLE = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]");

// ---------------------------------------------------------------- Vérification du jeu (schéma strict)
export class RefusComposant extends Error { constructor(m) { super("Affichage refusé : " + m); this.name = "RefusComposant"; } }
const refus = (m) => { throw new RefusComposant(m); };
const court = (v) => String(v).slice(0, 40);

function objet(o, permises, nom) {
  if (!o || typeof o !== "object" || Array.isArray(o)) refus(nom + " doit être un objet");
  for (const k of Object.keys(o)) if (!permises.includes(k)) refus(`${nom} : champ inconnu « ${court(k)} »`);
}
function texte(v, max, nom, requis = true) {
  if (v == null || v === "") { if (requis) refus(nom + " manquant"); return ""; }
  if (typeof v !== "string") refus(nom + " doit être un texte");
  const t = v.trim();
  if (!t && requis) refus(nom + " manquant");
  if (t.length > max) refus(`${nom} trop long (${max} caractères au plus)`);
  if (CONTROLE.test(t)) refus(nom + " contient des caractères de contrôle");
  return t;
}
const RE_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
/** "2024", "2024-03" ou "2024-03-15" → millisecondes UTC ; null si la date n'existe pas (2024-02-30, 2024-13). */
export function dateVersMs(s) {
  const m = typeof s === "string" && RE_DATE.exec(s); if (!m) return null;
  const a = +m[1], mo = m[2] ? +m[2] : 1, j = m[3] ? +m[3] : 1;
  if (mo < 1 || mo > 12 || j < 1) return null;
  const t = Date.UTC(a, mo - 1, j), d = new Date(t);
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j ? t : null;
}
const RE_HORODATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;
function horodate(v, nom, requis) {
  const t = texte(v, 40, nom, requis); if (!t) return "";
  if (!RE_HORODATE.test(t) || dateVersMs(t.slice(0, 10)) == null || Number.isNaN(Date.parse(t))) refus(`${nom} invalide (attendu AAAA-MM-JJ) : « ${court(t)} »`);
  if (Date.parse(t) > Date.now() + 86400000) refus(nom + " dans le futur");
  return t;
}
function adresse(v) {
  const t = texte(v, 300, "adresse de la source", false); if (!t) return "";
  let u; try { u = new URL(t); } catch (e) { refus("adresse de la source invalide"); }
  if (u.protocol !== "https:" || u.username || u.password) refus("adresse de la source : https seulement, sans identifiants");
  return u.href;
}

/**
 * Vérifie un jeu et en rend une copie figée. Forme attendue :
 * { titre?, colonnes: [{ id, libelle, type: "nombre"|"texte"|"date" }], lignes: [[…]], unite,
 *   source: { nom, maj, periode, url?, licence?, requete?, verifie? }, exemple? }
 * Tout champ inconnu, toute valeur hors type et toute source incomplète sont refusés, avec la raison.
 */
export function verifierJeu(jeu) {
  objet(jeu, CLES_JEU, "jeu");
  const titre = texte(jeu.titre, 120, "titre", false);
  const unite = texte(jeu.unite, 40, "unité");
  if (jeu.source == null) refus("source manquante");
  objet(jeu.source, CLES_SOURCE, "source");
  const s = jeu.source;
  if (s.verifie != null && typeof s.verifie !== "boolean") refus("source.verifie doit valoir vrai ou faux");
  const source = Object.freeze({
    nom: texte(s.nom, 120, "nom de la source"), maj: horodate(s.maj, "date de mise à jour", true), periode: texte(s.periode, 60, "période"),
    url: adresse(s.url), licence: texte(s.licence, 80, "licence", false), requete: horodate(s.requete, "date de la requête", false), verifie: s.verifie !== false
  });
  if (!Array.isArray(jeu.colonnes) || !jeu.colonnes.length || jeu.colonnes.length > MAX_COLONNES) refus(`colonnes : de 1 à ${MAX_COLONNES}`);
  const vus = new Set();
  const colonnes = Object.freeze(jeu.colonnes.map((c, i) => {
    objet(c, CLES_COLONNE, "colonne " + (i + 1));
    if (typeof c.id !== "string" || !/^[a-z][a-z0-9_]{0,31}$/.test(c.id)) refus(`identifiant de colonne invalide : « ${court(c.id)} »`);
    if (vus.has(c.id)) refus(`colonne en double : « ${c.id} »`); vus.add(c.id);
    if (!TYPES.includes(c.type)) refus(`type de colonne inconnu : « ${court(c.type)} »`);
    return Object.freeze({ id: c.id, libelle: texte(c.libelle, 60, "libellé de colonne"), type: c.type, i });
  }));
  if (!Array.isArray(jeu.lignes)) refus("lignes doit être une liste");
  if (jeu.lignes.length > MAX_LIGNES) refus(`trop de lignes (${MAX_LIGNES} au plus)`);
  const lignes = Object.freeze(jeu.lignes.map((l, n) => {
    if (!Array.isArray(l) || l.length !== colonnes.length) refus(`ligne ${n + 1} : ${colonnes.length} valeurs attendues`);
    return Object.freeze(l.map((v, i) => {
      const c = colonnes[i]; if (v == null) return null;
      if (c.type === "nombre") { if (typeof v !== "number" || !Number.isFinite(v)) refus(`ligne ${n + 1}, « ${c.id} » : nombre attendu`); return v; }
      if (c.type === "date") { if (dateVersMs(v) == null) refus(`ligne ${n + 1}, « ${c.id} » : date invalide « ${court(v)} »`); return v; }
      return texte(v, 200, `ligne ${n + 1}, « ${c.id} »`, false) || null;
    }));
  }));
  if (jeu.exemple != null && typeof jeu.exemple !== "boolean") refus("exemple doit valoir vrai ou faux");
  return Object.freeze({ titre, unite, source, colonnes, lignes, exemple: jeu.exemple === true, verifie: true });
}
const estVerifie = (j) => j && j.verifie === true && Object.isFrozen(j);
const jeuSur = (j) => (estVerifie(j) ? j : verifierJeu(j));
function colonne(j, id, types, role) {
  const c = j.colonnes.find((x) => x.id === id);
  if (!c) refus(`colonne « ${court(id)} » absente du jeu (${role})`);
  if (!types.includes(c.type)) refus(`colonne « ${c.id} » : type ${c.type} impossible pour ${role}`);
  return c;
}

// ---------------------------------------------------------------- Formats et échelles (fonctions pures)
const NF = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const nfCache = new Map();
/** Nombre en français ; « — » pour une donnée manquante (jamais 0 par défaut). */
export function nombre(v, decimales) {
  if (v == null) return "—";
  if (decimales == null) return NF.format(v);
  if (!nfCache.has(decimales)) nfCache.set(decimales, new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimales }));
  return nfCache.get(decimales).format(v);
}
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** Garde la précision d'origine : "2024" → 2024, "2024-03" → mars 2024, "2024-03-05" → 5 mars 2024. */
export function dateTexte(s) {
  if (s == null) return "—";
  const [a, m, j] = String(s).slice(0, 10).split("-");
  if (!m) return a; if (!j) return `${MOIS[+m - 1]} ${a}`; return `${+j} ${MOIS[+m - 1]} ${a}`;
}
const valeurTexte = (v, c, annees) => (v == null ? "—" : c.type === "date" ? dateTexte(v) : c.type === "nombre" ? (annees ? String(v) : nombre(v)) : v);

/** Pas « rond » (1, 2 ou 5 × 10^k) pour couper une étendue en environ n intervalles. */
export function pasArrondi(etendue, n = 5) {
  const brut = Math.abs(etendue) / Math.max(1, n);
  if (!(brut > 0) || !Number.isFinite(brut)) return 1;
  const p = 10 ** Math.floor(Math.log10(brut)), f = brut / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
const decimalesDe = (pas) => Math.max(0, Math.min(10, -Math.floor(Math.log10(pas) + 1e-9)));
const net = (v, pas) => { const r = Number(v.toFixed(decimalesDe(pas))); return Object.is(r, -0) ? 0 : r; };
function etendre(min, max) { if (min === max) { const e = Math.abs(min) || 1; return [min - e / 2, max + e / 2]; } return min < max ? [min, max] : [max, min]; }
/** Graduations rondes comprises dans [min, max]. */
export function graduations(min, max, n = 5, pasMin = 0) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  [min, max] = etendre(min, max);
  const pas = Math.max(pasArrondi(max - min, n), pasMin), t = [];
  for (let k = Math.ceil(min / pas - 1e-9); k * pas <= max + pas * 1e-9 && t.length < 100; k++) t.push(net(k * pas, pas));
  return t;
}
/** Domaine arrondi aux graduations (avec 0 si `zero`) : l'axe commence et finit sur une valeur ronde. */
export function domaine(min, max, n = 5, { zero = false } = {}) {
  if (zero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  [min, max] = etendre(min, max);
  const pas = pasArrondi(max - min, n);
  return [net(Math.floor(min / pas + 1e-9) * pas, pas), net(Math.ceil(max / pas - 1e-9) * pas, pas)];
}
/** Échelle linéaire du domaine [d0, d1] vers [r0, r1], avec son inverse. */
export function echelle([d0, d1], [r0, r1]) {
  const f = (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
  f.inverse = (p) => (r1 === r0 ? d0 : d0 + ((p - r0) / (r1 - r0)) * (d1 - d0));
  return f;
}
const AN = 365.2425 * 86400000;
/** Graduations temporelles : années, mois ou jours selon l'étendue (dates en ms UTC). */
export function graduationsTemps(min, max, n = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { valeurs: [], format: "annee" };
  if (max - min >= 2 * AN) {
    const a0 = new Date(min).getUTCFullYear(), a1 = new Date(max).getUTCFullYear(), pas = Math.max(1, pasArrondi(a1 - a0, n)), v = [];
    for (let a = Math.ceil(a0 / pas) * pas; a <= a1; a += pas) { const t = Date.UTC(a, 0, 1); if (t >= min - 1 && t <= max + 1) v.push(t); }
    return { valeurs: v, format: "annee" };
  }
  if (max - min >= 60 * 86400000) {
    const mois = (max - min) / (AN / 12), pas = [1, 2, 3, 6].find((p) => mois / p <= n) || 12, v = [];
    const d = new Date(min); let a = d.getUTCFullYear(), m = d.getUTCMonth(); if (Date.UTC(a, m, 1) < min) m++;
    m = Math.ceil(m / pas) * pas;
    for (let t = Date.UTC(a, m, 1); t <= max && v.length < 40; m += pas, t = Date.UTC(a, m, 1)) v.push(t);
    return { valeurs: v, format: "mois" };
  }
  const jours = Math.max(1, (max - min) / 86400000), pas = [1, 2, 7, 14].find((p) => jours / p <= n) || 30, v = [];
  for (let t = min; t <= max + 1 && v.length < 40; t += pas * 86400000) v.push(t);
  return { valeurs: v, format: "jour" };
}
function texteTemps(t, format) {
  const d = new Date(t), a = d.getUTCFullYear(), m = d.getUTCMonth();
  return format === "annee" ? String(a) : format === "mois" ? `${MOIS[m]} ${a}` : `${d.getUTCDate()} ${MOIS[m]}`;
}
/** Au-delà de `limite` points, moyenne par groupes réguliers (x moyen, y moyen des valeurs présentes). */
export function agreger(points, limite = LIMITE_POINTS) {
  if (points.length <= limite) return { points, agrege: false, avant: points.length };
  const taille = Math.ceil(points.length / limite), out = [];
  for (let i = 0; i < points.length; i += taille) {
    const g = points.slice(i, i + taille), ys = g.map((p) => p.y).filter((y) => y != null);
    out.push({ x: g.reduce((s, p) => s + p.x, 0) / g.length, xs: g[0].xs, y: ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : null, groupe: g.length });
  }
  return { points: out, agrege: true, avant: points.length };
}
/** Rapport de contraste WCAG entre deux couleurs #rrggbb. */
export function contraste(a, b) {
  const L = (hex) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05);
}

// ---------------------------------------------------------------- Export : CSV et SVG (texte pur, échappé)
const BOM = "﻿";
function champCSV(v, type) {
  if (v == null) return "";
  let t = String(v);
  if (type === "texte" && /^[=+\-@\t\r]/.test(t)) t = "'" + t;      // un tableur n'exécute jamais une cellule comme formule
  return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
/** CSV : séparateur « ; », point décimal, UTF-8 avec BOM, fins de ligne CRLF, en-tête = libellés (unité sur les colonnes nombre). */
export function versCSV(jeu, lignes) {
  const j = jeuSur(jeu), L = lignes || j.lignes;
  const tete = j.colonnes.map((c) => champCSV(c.type === "nombre" ? `${c.libelle} (${j.unite})` : c.libelle, "texte")).join(";");
  return BOM + [tete, ...L.map((l) => l.map((v, i) => champCSV(v, j.colonnes[i].type)).join(";"))].join("\r\n") + "\r\n";
}
/** Lignes du pied de sources, telles qu'affichées et exportées. */
export function piedSourcesTexte(jeu) {
  const j = jeuSur(jeu), s = j.source, l = [];
  if (j.exemple) l.push("EXEMPLE · données factices");
  l.push(`Source : ${s.nom}${s.url ? " · " + s.url : ""}`);
  l.push(`Mise à jour : ${dateTexte(s.maj)} · Unité : ${j.unite} · Période : ${s.periode}`);
  if (s.licence || s.requete) l.push([s.licence && `Licence : ${s.licence}`, s.requete && `Requête du ${dateTexte(s.requete)}`].filter(Boolean).join(" · "));
  if (!s.verifie) l.push("Non vérifié");
  return l;
}
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (t) => esc(t).replace(/"/g, "&quot;");
const SVG_PERMIS = new Set(["g", "path", "line", "rect", "circle", "text", "title", "desc", "polyline", "tspan"]);
function serialiser(n) {
  if (n.nodeType === 3) return esc(n.textContent);
  if (n.nodeType !== 1) return "";
  const nom = String(n.localName || n.tagName || "").toLowerCase();
  if (!SVG_PERMIS.has(nom)) return "";
  if (/\bnxc-interactif\b/.test(n.getAttribute("class") || "")) return "";
  let a = "";
  for (const at of Array.from(n.attributes || [])) {
    const k = at.name; if (!/^[a-z][a-z-]*$/.test(k) || k.startsWith("on") || k === "tabindex" || k === "href" || k === "style") continue;
    a += ` ${k}="${escAttr(at.value)}"`;
  }
  return `<${nom}${a}>${Array.from(n.childNodes || []).map(serialiser).join("")}</${nom}>`;
}
/** SVG autonome : fond, titre, graphique (sans les éléments interactifs) et pied de sources, toujours ensemble. */
export function versSVG(svg, jeu, titre) {
  const j = jeuSur(jeu), [, , w, hg] = (svg.getAttribute("viewBox") || "0 0 640 300").split(/\s+/).map(Number);
  const pied = piedSourcesTexte(j), haut = 26, H = Math.ceil(haut + hg + 10 + pied.length * 16);
  const corps = Array.from(svg.childNodes || []).map(serialiser).join("");
  const lignes = pied.map((t, i) => `<text x="8" y="${haut + hg + 20 + i * 16}" fill="${DISCRET}" font-size="11">${esc(t)}</text>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${NS}" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" font-family="Rajdhani, system-ui, sans-serif">`
    + `<rect width="${w}" height="${H}" fill="${FOND}"/><text x="8" y="18" fill="${TEXTE}" font-size="14">${esc(titre || j.titre || "Sans titre")}</text>`
    + `<g transform="translate(0 ${haut})">${corps}</g>${lignes}</svg>\n`;
}
export function nomFichier(jeu, ext) {
  const j = jeuSur(jeu);
  const base = (j.titre || "donnees").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "donnees";
  return `${base}-${j.source.maj.slice(0, 10)}.${ext}`;
}

// ---------------------------------------------------------------- DOM (createElement, createElementNS, textContent uniquement)
function doc() { const d = globalThis.document; if (!d) throw new Error("Aucun document pour afficher."); return d; }
function poser(e, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "texte") e.textContent = String(v); else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : String(v));
  }
}
function garnir(e, enfants) { for (const c of enfants.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : doc().createTextNode(String(c))); return e; }
function h(tag, attrs, ...enfants) { const e = doc().createElement(tag); poser(e, attrs); return garnir(e, enfants); }
function s(tag, attrs, ...enfants) { const e = doc().createElementNS(NS, tag); poser(e, attrs); return garnir(e, enfants); }
const vider = (e) => { e.textContent = ""; return e; };
let compteur = 0;
const uid = (p) => `nxc-${p}-${++compteur}`;
const coupe = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
const f1 = (v) => (Math.round(v * 10) / 10).toString();

/** Pied de sources obligatoire : source (lien ouvert seulement par un clic), mise à jour, unité, période, licence, « non vérifié ». */
export function piedSources(jeu) {
  const j = jeuSur(jeu), s0 = j.source;
  const nom = s0.url ? h("a", { href: s0.url, target: "_blank", rel: "noopener noreferrer", texte: s0.nom }) : h("span", { texte: s0.nom });
  return h("footer", { class: "nxc-pied", "aria-label": "Sources" },
    j.exemple ? h("p", { class: "nxc-exemple", texte: "EXEMPLE · données factices" }) : null,
    h("p", {}, h("b", { texte: "Source : " }), nom, s0.verifie ? null : h("span", { class: "nxc-nonverifie", texte: " · non vérifié" })),
    h("p", {}, h("b", { texte: "Mise à jour : " }), dateTexte(s0.maj), " · ", h("b", { texte: "Unité : " }), j.unite, " · ", h("b", { texte: "Période : " }), s0.periode),
    s0.licence || s0.requete ? h("p", { class: "nxc-discret" }, s0.licence ? `Licence : ${s0.licence}` : "", s0.licence && s0.requete ? " · " : "", s0.requete ? `Requête du ${dateTexte(s0.requete)}` : "") : null);
}

/** Téléchargement local (aucun envoi). Isolé pour pouvoir le remplacer dans les essais. */
export const sortie = {
  telecharger(nom, contenu, type) {
    const u = URL.createObjectURL(new Blob([contenu], { type })), a = h("a", { href: u, download: nom, hidden: true });
    doc().body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
};
/**
 * Boutons d'export. Seul un clic réel (event.isTrusted) les déclenche : un appel par le code, donc par le Noyau, est refusé.
 * @param {{ jeu, lignes?: () => any[][], svg?: () => SVGElement|null, titre?: string }} o
 */
export function exporter(o) {
  const j = jeuSur(o.jeu), etat = h("span", { class: "nxc-discret", role: "status", "aria-live": "polite" });
  const lancer = (genre) => (e) => {
    if (!e || e.isTrusted !== true) { etat.textContent = "Export refusé : il ne part que de ton clic."; return; }
    const lignes = o.lignes ? o.lignes() : j.lignes;
    if (genre === "csv") { sortie.telecharger(nomFichier(j, "csv"), versCSV(j, lignes), "text/csv;charset=utf-8"); etat.textContent = `CSV prêt : ${lignes.length} ligne(s)${lignes.length !== j.lignes.length ? ` sur ${j.lignes.length} (filtres appliqués)` : ""}.`; }
    else { const g = o.svg && o.svg(); if (!g) { etat.textContent = "Rien à exporter en SVG."; return; } sortie.telecharger(nomFichier(j, "svg"), versSVG(g, j, o.titre), "image/svg+xml;charset=utf-8"); etat.textContent = "SVG prêt, sources incluses."; }
  };
  return h("div", { class: "nxc-export", role: "group", "aria-label": "Exporter" },
    h("button", { class: "nxc-btn", type: "button", onclick: lancer("csv") }, "Exporter CSV"),
    o.svg ? h("button", { class: "nxc-btn", type: "button", onclick: lancer("svg") }, "Exporter SVG") : null, etat);
}

function cadre(j, titre, genre) {
  const id = uid("t");
  const fig = h("figure", { class: "nxc", "data-genre": genre, "aria-labelledby": id });
  fig.append(h("div", { class: "nxc-tete" }, h("h3", { class: "nxc-titre", id, texte: titre || j.titre || "Sans titre" }), j.exemple ? h("span", { class: "nxc-badge", texte: "EXEMPLE" }) : null));
  return fig;
}
const etatVide = (t) => h("p", { class: "nxc-vide", role: "status", texte: t });

// ---------------------------------------------------------------- Tableau (repli universel)
function corpsTableau(j, { parPage = 25, legende } = {}) {
  const st = { lignes: j.lignes, tri: null, sens: 1, filtre: "", page: 0 };
  const annees = new Set(j.colonnes.filter((c) => c.type === "nombre" && j.lignes.length && j.lignes.every((l) => l[c.i] == null || (Number.isInteger(l[c.i]) && l[c.i] >= 1000 && l[c.i] <= 2999))).map((c) => c.id));
  const champ = h("input", { class: "nxc-champ", type: "search", "aria-label": "Filtrer le tableau", placeholder: "Filtrer…", maxlength: "80" });
  const table = h("table", { class: "nxc-table" }), info = h("span", { class: "nxc-discret", role: "status", "aria-live": "polite" });
  const prec = h("button", { class: "nxc-btn", type: "button" }, "Précédent"), suiv = h("button", { class: "nxc-btn", type: "button" }, "Suivant");
  champ.addEventListener("input", () => { st.filtre = String(champ.value || "").toLowerCase(); st.page = 0; rendre(); });
  prec.addEventListener("click", () => { st.page--; rendre(); }); suiv.addEventListener("click", () => { st.page++; rendre(); });
  const comparer = (c) => (a, b) => {
    const x = a[c.i], y = b[c.i]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return (c.type === "nombre" ? x - y : c.type === "date" ? (dateVersMs(x) - dateVersMs(y)) : String(x).localeCompare(String(y), "fr")) * st.sens;
  };
  function visibles() {
    let L = st.lignes;
    if (st.filtre) L = L.filter((l) => l.some((v, i) => v != null && valeurTexte(v, j.colonnes[i], annees.has(j.colonnes[i].id)).toLowerCase().includes(st.filtre)));
    if (st.tri) L = [...L].sort(comparer(st.tri));
    return L;
  }
  function rendre() {
    const L = visibles(), pages = Math.max(1, Math.ceil(L.length / parPage)); st.page = Math.max(0, Math.min(st.page, pages - 1));
    vider(table);
    table.append(h("caption", { texte: legende || `${j.titre || "Données"} (unité : ${j.unite})` }));
    const tr = h("tr");
    for (const c of j.colonnes) {
      const actif = st.tri === c, b = h("button", { class: "nxc-tri", type: "button", "aria-label": `Trier par ${c.libelle}` }, c.libelle, h("span", { "aria-hidden": "true", texte: actif ? (st.sens > 0 ? " ▲" : " ▼") : "" }));
      b.addEventListener("click", () => { if (st.tri === c) st.sens = -st.sens; else { st.tri = c; st.sens = 1; } rendre(); });
      tr.append(h("th", { scope: "col", "aria-sort": actif ? (st.sens > 0 ? "ascending" : "descending") : "none", class: c.type === "nombre" ? "nxc-num" : null }, b));
    }
    const tb = h("tbody");
    for (const l of L.slice(st.page * parPage, (st.page + 1) * parPage)) tb.append(h("tr", {}, l.map((v, i) => h("td", { class: j.colonnes[i].type === "nombre" ? "nxc-num" : null, title: v == null ? "donnée manquante" : null, texte: valeurTexte(v, j.colonnes[i], annees.has(j.colonnes[i].id)) }))));
    if (!L.length) tb.append(h("tr", {}, h("td", { colspan: String(j.colonnes.length), class: "nxc-vide", texte: st.lignes.length ? "Aucune ligne ne correspond au filtre." : "Aucune donnée." })));
    table.append(h("thead", {}, tr), tb);
    info.textContent = `Page ${st.page + 1} sur ${pages} · ${L.length} ligne(s)`;
    prec.disabled = st.page === 0; suiv.disabled = st.page >= pages - 1;
  }
  rendre();
  const element = h("div", { class: "nxc-tableau" }, h("div", { class: "nxc-outils" }, champ), h("div", { class: "nxc-defile", tabindex: "0", role: "region", "aria-label": "Tableau des données" }, table), h("div", { class: "nxc-pages" }, prec, info, suiv));
  return { element, table, maj(lignes) { st.lignes = lignes; st.page = 0; rendre(); }, visibles };
}

/** Tableau : tri par colonne, filtre texte, pagination ; pied de sources et export CSV. */
export function tableau(jeu, o = {}) {
  const j = jeuSur(jeu), fig = cadre(j, o.titre, "tableau"), t = corpsTableau(j, o);
  let filtre = null;
  fig.append(t.element, piedSources(j), exporter({ jeu: j, lignes: () => t.visibles(), titre: o.titre }));
  fig.composant = { filtrer(p) { filtre = p; t.maj(filtre ? j.lignes.filter(filtre) : j.lignes); }, lignes: () => t.visibles() };
  return fig;
}
function equivalent(j, titre) {
  const t = corpsTableau(j, { legende: `${titre || j.titre || "Données"} : tableau équivalent (unité : ${j.unite})` });
  return { element: h("details", { class: "nxc-equivalent" }, h("summary", { texte: "Tableau des données (équivalent du graphique)" }), t.element), maj: t.maj };
}

// ---------------------------------------------------------------- Courbe
const L_ = 58, R_ = 16, T_ = 16, B_ = 34;
/**
 * Courbe : une ou plusieurs séries dans le temps. o = { x, y, series?, titre? }.
 * Légende qui masque une série, zoom par deux curseurs (clavier compris), lecture des valeurs au survol, au toucher
 * et aux flèches, tableau équivalent, pied de sources, export CSV et SVG.
 */
export function courbe(jeu, o = {}) {
  const j = jeuSur(jeu), cx = colonne(j, o.x, ["date", "nombre"], "l'axe x"), cy = colonne(j, o.y, ["nombre"], "l'axe y");
  const cs = o.series ? colonne(j, o.series, ["texte"], "les séries") : null;
  const W = 640, H = 300, x0 = L_, x1 = W - R_, y0 = H - B_, y1 = T_;
  const enX = (v) => (cx.type === "date" ? dateVersMs(v) : v);
  const annees = cx.type === "nombre" && j.lignes.every((l) => l[cx.i] == null || (Number.isInteger(l[cx.i]) && l[cx.i] >= 1000 && l[cx.i] <= 2999));
  const texteX = (xs) => (cx.type === "date" ? dateTexte(xs) : annees ? String(xs) : nombre(xs));
  const st = { filtre: null, cache: new Set(), debut: 0, fin: Infinity, curseur: -1 };
  const fig = cadre(j, o.titre, "courbe"), titreId = uid("st"), descId = uid("sd");
  const svg = s("svg", { class: "nxc-svg", viewBox: `0 0 ${W} ${H}`, role: "img", tabindex: "0", "aria-labelledby": titreId, "aria-describedby": descId, preserveAspectRatio: "xMidYMid meet" });
  const legende = h("div", { class: "nxc-legende", role: "group", "aria-label": "Séries (cliquer pour masquer ou afficher)" });
  const zoomA = h("input", { type: "range", min: "0", step: "1", "aria-label": "Début de la période affichée" }), zoomB = h("input", { type: "range", min: "0", step: "1", "aria-label": "Fin de la période affichée" });
  const remise = h("button", { class: "nxc-btn", type: "button" }, "Tout afficher");
  const zoom = h("div", { class: "nxc-zoom", role: "group", "aria-label": "Zoom sur la période" }, h("label", {}, "De ", zoomA), h("label", {}, "à ", zoomB), remise);
  const lecture = h("p", { class: "nxc-lecture", role: "status", "aria-live": "polite", texte: "Survole, touche ou utilise les flèches sur le graphique pour lire les valeurs." });
  const note = h("p", { class: "nxc-note", role: "note", hidden: true });
  const eq = equivalent(j, o.titre);
  const zone = h("div", { class: "nxc-graph" }, svg);
  fig.append(legende, zone, lecture, zoom, note, eq.element, piedSources(j));
  let courant = { xs: [], series: [], lignes: j.lignes, sx: null };

  function construire(lignes) {
    const m = new Map();
    for (const l of lignes) {
      const xv = l[cx.i]; if (xv == null) continue;
      const nom = cs ? (l[cs.i] ?? "(sans nom)") : cy.libelle;
      if (!m.has(nom)) m.set(nom, []); m.get(nom).push({ x: enX(xv), xs: xv, y: l[cy.i] });
    }
    return [...m].map(([nom, pts], k) => ({ nom, pts: pts.sort((a, b) => a.x - b.x), style: PALETTE[k % PALETTE.length] }));
  }
  const toutesX = (series) => [...new Map(series.flatMap((sr) => sr.pts.map((p) => [p.x, p.xs]))).entries()].sort((a, b) => a[0] - b[0]);

  function rendre() {
    const lignes = st.filtre ? j.lignes.filter(st.filtre) : j.lignes;
    let series = construire(lignes); const trop = series.length > MAX_SERIES; const total = series.length; series = series.slice(0, MAX_SERIES);
    const xs = toutesX(series), n = xs.length;
    vider(svg); vider(legende); eq.maj(lignes);
    svg.append(s("title", { id: titreId, texte: o.titre || j.titre || "Courbe" }));
    const notes = [];
    if (trop) notes.push(`${total} séries : seules les ${MAX_SERIES} premières sont dessinées ; le tableau les garde toutes.`);
    if (!n) { svg.append(s("desc", { id: descId, texte: "Aucune donnée à afficher." }), s("text", { x: W / 2, y: H / 2, "text-anchor": "middle", fill: DISCRET, "font-size": 14, texte: "Aucune donnée à afficher" })); zoom.hidden = true; note.hidden = !notes.length; note.textContent = notes.join(" "); courant = { xs, series, lignes, sx: null }; return; }
    st.fin = Math.min(st.fin, n - 1); st.debut = Math.max(0, Math.min(st.debut, st.fin));
    zoom.hidden = n < 3;
    for (const z of [zoomA, zoomB]) z.setAttribute("max", String(n - 1));
    zoomA.value = String(st.debut); zoomB.value = String(st.fin);
    zoomA.setAttribute("aria-valuetext", texteX(xs[st.debut][1])); zoomB.setAttribute("aria-valuetext", texteX(xs[st.fin][1]));
    const xmin = xs[st.debut][0], xmax = xs[st.fin][0];
    // Légende : bouton par série (aria-pressed = visible), trait d'exemple avec motif
    for (const sr of series) {
      const vis = !st.cache.has(sr.nom);
      const b = h("button", { class: "nxc-serie", type: "button", "aria-pressed": String(vis) },
        s("svg", { width: "26", height: "10", viewBox: "0 0 26 10", "aria-hidden": "true" }, s("line", { x1: 1, y1: 5, x2: 25, y2: 5, stroke: sr.style.couleur, "stroke-width": 2.5, "stroke-dasharray": sr.style.tiret || null })),
        h("span", { texte: sr.nom }));
      b.addEventListener("click", () => { if (st.cache.has(sr.nom)) st.cache.delete(sr.nom); else st.cache.add(sr.nom); rendre(); });
      legende.append(b);
    }
    legende.hidden = series.length < 2;
    const visibles = series.filter((sr) => !st.cache.has(sr.nom)).map((sr) => {
      const pts = sr.pts.filter((p) => p.x >= xmin && p.x <= xmax), a = agreger(pts);
      if (a.agrege) notes.push(`« ${sr.nom} » : ${a.avant} points ramenés à ${a.points.length} (moyenne par groupe de ${Math.ceil(a.avant / LIMITE_POINTS)}).`);
      return { ...sr, vus: a.points };
    });
    const ys = visibles.flatMap((sr) => sr.vus.map((p) => p.y)).filter((y) => y != null);
    const nulls = visibles.reduce((k, sr) => k + sr.vus.filter((p) => p.y == null).length, 0);
    if (nulls) notes.push(`${nulls} valeur(s) manquante(s) : la ligne est interrompue, rien n'est inventé.`);
    note.hidden = !notes.length; note.textContent = notes.join(" ");
    const dy = ys.length ? domaine(Math.min(...ys), Math.max(...ys)) : [0, 1];
    const sx = echelle(xmin === xmax ? [xmin - 1, xmax + 1] : [xmin, xmax], [x0, x1]), sy = echelle(dy, [y0, y1]);
    // Grille et axe y
    const ty = graduations(dy[0], dy[1], 5), dec = ty.length > 1 ? decimalesDe(Math.abs(ty[1] - ty[0])) : 2;
    const axe = s("g", { class: "nxc-axes", "font-size": 11, fill: DISCRET });
    for (const v of ty) { const y = f1(sy(v)); axe.append(s("line", { x1: x0, x2: x1, y1: y, y2: y, stroke: GRILLE }), s("text", { x: x0 - 6, y, "text-anchor": "end", "dominant-baseline": "middle", texte: nombre(v, dec) })); }
    axe.append(s("text", { x: 4, y: 10, fill: DISCRET, texte: coupe(j.unite, 28) }));
    // Axe x
    let tx;
    if (cx.type === "date") { const g = graduationsTemps(xmin, xmax, 6); tx = g.valeurs.map((t) => [t, texteTemps(t, g.format)]); }
    else tx = graduations(xmin, xmax, 6, annees ? 1 : 0).map((v) => [v, annees ? String(v) : nombre(v)]);
    axe.append(s("line", { x1: x0, x2: x1, y1: y0, y2: y0, stroke: DISCRET }));
    for (const [v, t] of tx) { const x = f1(sx(v)); axe.append(s("line", { x1: x, x2: x, y1: y0, y2: y0 + 4, stroke: DISCRET }), s("text", { x, y: y0 + 17, "text-anchor": "middle", texte: t })); }
    svg.append(axe);
    // Séries : chemin interrompu aux valeurs manquantes ; points si peu nombreux
    for (const sr of visibles) {
      let d = "", lever = true;
      for (const p of sr.vus) { if (p.y == null) { lever = true; continue; } d += `${lever ? "M" : "L"}${f1(sx(p.x))} ${f1(sy(p.y))}`; lever = false; }
      const g = s("g", { class: "nxc-trace" });
      g.append(s("path", { d: d || "M0 0", fill: "none", stroke: sr.style.couleur, "stroke-width": 2, "stroke-dasharray": sr.style.tiret || null, "stroke-linejoin": "round", "stroke-linecap": "round" }, s("title", { texte: sr.nom })));
      if (sr.vus.length <= 60) for (const p of sr.vus) if (p.y != null) g.append(s("circle", { cx: f1(sx(p.x)), cy: f1(sy(p.y)), r: 2.6, fill: sr.style.couleur }));
      svg.append(g);
    }
    const pieces = [`Courbe de ${visibles.length} série(s), de ${texteX(xs[st.debut][1])} à ${texteX(xs[st.fin][1])}`];
    if (ys.length) pieces.push(`valeurs de ${nombre(Math.min(...ys))} à ${nombre(Math.max(...ys))} ${j.unite}`);
    svg.append(s("desc", { id: descId, texte: pieces.join(", ") + "." }));
    courant = { xs, series: visibles, lignes, sx, sy, xmin, xmax };
    if (st.curseur >= 0) montrer(st.curseur);
  }
  // Lecture des valeurs : un curseur vertical (non exporté) et une ligne de texte lue par les lecteurs d'écran
  function montrer(k) {
    const { xs, series, sx, sy } = courant; if (!sx || !xs.length) return;
    k = Math.max(st.debut, Math.min(st.fin, k)); st.curseur = k;
    const [x, xsTexte] = xs[k];
    let g = null; for (const c of Array.from(svg.childNodes)) if ((c.getAttribute && c.getAttribute("class")) === "nxc-interactif") g = c;
    if (g) g.remove();
    g = s("g", { class: "nxc-interactif", "pointer-events": "none" }); const px = f1(sx(x));
    g.append(s("line", { x1: px, x2: px, y1: y1, y2: y0, stroke: TEXTE, "stroke-opacity": 0.5, "stroke-dasharray": "3 3" }));
    const morceaux = [];
    for (const sr of series) {
      let p = sr.vus.find((q) => q.x === x);
      if (!p && sr.vus.length) p = sr.vus.reduce((m, q) => (Math.abs(q.x - x) < Math.abs(m.x - x) ? q : m));
      if (!p) continue;
      morceaux.push(`${sr.nom} : ${nombre(p.y)}${p.groupe ? " (moyenne)" : ""}`);
      if (p.y != null) g.append(s("circle", { cx: f1(sx(p.x)), cy: f1(sy(p.y)), r: 4.5, fill: FOND, stroke: sr.style.couleur, "stroke-width": 2 }));
    }
    svg.append(g);
    lecture.textContent = `${texteX(xsTexte)} · ${morceaux.join(" · ") || "aucune série visible"} (${j.unite})`;
  }
  function proche(clientX) {
    const r = svg.getBoundingClientRect ? svg.getBoundingClientRect() : null; if (!r || !r.width || !courant.sx) return;
    const v = courant.sx.inverse(((clientX - r.left) / r.width) * W); let best = st.debut;
    for (let k = st.debut; k <= st.fin; k++) if (Math.abs(courant.xs[k][0] - v) < Math.abs(courant.xs[best][0] - v)) best = k;
    montrer(best);
  }
  svg.addEventListener("pointermove", (e) => proche(e.clientX));
  svg.addEventListener("pointerdown", (e) => proche(e.clientX));
  svg.addEventListener("keydown", (e) => {
    const pas = { ArrowRight: 1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (pas) { e.preventDefault(); montrer((st.curseur < 0 ? st.debut - (pas > 0 ? 1 : -1) : st.curseur) + pas); }
    else if (e.key === "Home") { e.preventDefault(); montrer(st.debut); } else if (e.key === "End") { e.preventDefault(); montrer(st.fin); }
  });
  zoomA.addEventListener("input", () => { st.debut = Math.min(+zoomA.value, st.fin - 1); rendre(); });
  zoomB.addEventListener("input", () => { st.fin = Math.max(+zoomB.value, st.debut + 1); rendre(); });
  remise.addEventListener("click", () => { st.debut = 0; st.fin = Infinity; st.cache.clear(); rendre(); });
  rendre();
  fig.append(exporter({ jeu: j, lignes: () => courant.lignes, svg: () => svg, titre: o.titre }));
  fig.composant = {
    svg, filtrer(p) { st.filtre = p; st.debut = 0; st.fin = Infinity; rendre(); }, zoomer(a, b) { st.debut = a; st.fin = b; rendre(); },
    basculer(nom) { if (st.cache.has(nom)) st.cache.delete(nom); else st.cache.add(nom); rendre(); }, lire: (k) => { montrer(k); return lecture.textContent; },
    etat: () => ({ series: courant.series.map((x) => ({ nom: x.nom, points: x.vus.length })), debut: st.debut, fin: st.fin, n: courant.xs.length })
  };
  return fig;
}

// ---------------------------------------------------------------- Barres
/** Barres : comparaison de catégories. o = { categorie, valeur, orientation?: "verticale"|"horizontale", tri?, titre? }. */
export function barres(jeu, o = {}) {
  const j = jeuSur(jeu), cc = colonne(j, o.categorie, ["texte", "date"], "les catégories"), cv = colonne(j, o.valeur, ["nombre"], "les valeurs");
  const vues = new Set();
  for (const l of j.lignes) { const k = l[cc.i]; if (k == null) refus("catégorie manquante dans une ligne"); if (vues.has(k)) refus(`catégorie en double : « ${court(k)} » (rien n'est additionné à ta place)`); vues.add(k); }
  const st = { tri: o.tri || "origine", filtre: null, actif: -1 };
  const fig = cadre(j, o.titre, "barres"), titreId = uid("st"), descId = uid("sd");
  const svg = s("svg", { class: "nxc-svg", role: "img", tabindex: "0", "aria-labelledby": titreId, "aria-describedby": descId });
  const tri = h("select", { class: "nxc-champ", "aria-label": "Ordre des barres" }, [["origine", "Ordre d'origine"], ["decroissant", "Plus grand d'abord"], ["croissant", "Plus petit d'abord"], ["alpha", "Ordre alphabétique"]].map(([v, t]) => h("option", { value: v, texte: t })));
  tri.value = st.tri; tri.addEventListener("change", () => { st.tri = tri.value; rendre(); });
  const lecture = h("p", { class: "nxc-lecture", role: "status", "aria-live": "polite", texte: "Survole, touche ou utilise les flèches sur le graphique pour lire les valeurs." });
  const note = h("p", { class: "nxc-note", role: "note", hidden: true }), eq = equivalent(j, o.titre);
  const fl = j.lignes.length > 1 ? filtres(j, { champs: [cc.id], surChangement: (p) => { st.filtre = p; rendre(); } }) : null;
  const outils = h("div", { class: "nxc-outils" }, h("label", {}, "Ordre ", tri));
  fig.append(outils, fl ? h("details", { class: "nxc-filtres-repli" }, h("summary", { texte: "Filtrer les catégories" }), fl) : null, h("div", { class: "nxc-graph" }, svg), lecture, note, eq.element, piedSources(j));
  let courant = { lignes: j.lignes, barres: [] };
  const etiquette = (k) => (cc.type === "date" ? dateTexte(k) : k);
  function ordonner(L) {
    if (st.tri === "alpha") return [...L].sort((a, b) => String(etiquette(a[cc.i])).localeCompare(String(etiquette(b[cc.i])), "fr"));
    if (st.tri === "croissant" || st.tri === "decroissant") { const sg = st.tri === "croissant" ? 1 : -1; return [...L].sort((a, b) => (a[cv.i] == null ? 1 : b[cv.i] == null ? -1 : (a[cv.i] - b[cv.i]) * sg)); }
    return L;
  }
  function rendre() {
    let L = st.filtre ? j.lignes.filter(st.filtre) : j.lignes; eq.maj(L);
    const notes = []; if (L.length > MAX_CATEGORIES) { notes.push(`${L.length} catégories : les ${MAX_CATEGORIES} premières sont dessinées ; le tableau les garde toutes.`); }
    const D = ordonner(L).slice(0, MAX_CATEGORIES), n = D.length;
    const horiz = (o.orientation || (n > 8 ? "horizontale" : "verticale")) === "horizontale";
    const W = 640, H = horiz ? Math.max(120, T_ + n * 24 + B_) : 300;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); vider(svg); svg.setAttribute("data-orientation", horiz ? "horizontale" : "verticale");
    svg.append(s("title", { id: titreId, texte: o.titre || j.titre || "Barres" }));
    const vals = D.map((l) => l[cv.i]).filter((v) => v != null), manq = n - vals.length;
    if (manq) notes.push(`${manq} valeur(s) manquante(s), marquée(s) « n.d. » : aucune barre à zéro n'est inventée.`);
    note.hidden = !notes.length; note.textContent = notes.join(" ");
    if (!n) { svg.append(s("desc", { id: descId, texte: "Aucune donnée à afficher." }), s("text", { x: W / 2, y: H / 2, "text-anchor": "middle", fill: DISCRET, "font-size": 14, texte: "Aucune donnée à afficher" })); courant = { lignes: L, barres: [] }; return; }
    const dv = domaine(vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) : 1, 5, { zero: true });
    const ticks = graduations(dv[0], dv[1], 5), dec = ticks.length > 1 ? decimalesDe(Math.abs(ticks[1] - ticks[0])) : 2;
    const gauche = horiz ? 140 : L_;
    const sv = horiz ? echelle(dv, [gauche, W - R_]) : echelle(dv, [H - B_, T_]);
    const axe = s("g", { class: "nxc-axes", "font-size": 11, fill: DISCRET });
    for (const v of ticks) { const p = f1(sv(v)); axe.append(horiz ? s("line", { x1: p, x2: p, y1: T_, y2: H - B_, stroke: GRILLE }) : s("line", { x1: L_, x2: W - R_, y1: p, y2: p, stroke: GRILLE }), horiz ? s("text", { x: p, y: H - B_ + 16, "text-anchor": "middle", texte: nombre(v, dec) }) : s("text", { x: L_ - 6, y: p, "text-anchor": "end", "dominant-baseline": "middle", texte: nombre(v, dec) })); }
    axe.append(s("text", { x: 4, y: 10, texte: coupe(j.unite, 28) }));
    const z = f1(sv(0)); axe.append(horiz ? s("line", { x1: z, x2: z, y1: T_, y2: H - B_, stroke: DISCRET }) : s("line", { x1: L_, x2: W - R_, y1: z, y2: z, stroke: DISCRET }));
    svg.append(axe);
    const bande = ((horiz ? H - B_ - T_ : W - R_ - L_) / n), ep = Math.max(2, bande * 0.68), limite = horiz ? 22 : Math.max(4, Math.floor(bande / 6.5));
    const bs = [];
    D.forEach((l, k) => {
      const v = l[cv.i], nom = String(etiquette(l[cc.i])), centre = (horiz ? T_ : L_) + bande * (k + 0.5), g = s("g", { class: "nxc-barre" });
      const lib = `${nom} : ${v == null ? "donnée manquante" : nombre(v) + " " + j.unite}`;
      if (v != null) {
        const p = sv(v), deb = Math.min(p, sv(0)), lg = Math.max(1, Math.abs(p - sv(0)));
        g.append(horiz ? s("rect", { x: f1(deb), y: f1(centre - ep / 2), width: f1(lg), height: f1(ep), fill: PALETTE[0].couleur }, s("title", { texte: lib }))
          : s("rect", { x: f1(centre - ep / 2), y: f1(deb), width: f1(ep), height: f1(lg), fill: PALETTE[0].couleur }, s("title", { texte: lib })));
        if (n <= 12) g.append(horiz ? s("text", { x: f1(v < 0 ? deb - 4 : deb + lg + 4), y: f1(centre), "dominant-baseline": "middle", "text-anchor": v < 0 ? "end" : "start", fill: TEXTE, "font-size": 11, texte: nombre(v) })
          : s("text", { x: f1(centre), y: f1(v < 0 ? deb + lg + 12 : deb - 4), "text-anchor": "middle", fill: TEXTE, "font-size": 11, texte: nombre(v) }));
      } else g.append(horiz ? s("text", { x: f1(sv(0) + 4), y: f1(centre), "dominant-baseline": "middle", fill: DISCRET, "font-size": 11, texte: "n.d." }) : s("text", { x: f1(centre), y: f1(sv(0) - 4), "text-anchor": "middle", fill: DISCRET, "font-size": 11, texte: "n.d." }));
      g.append(horiz ? s("text", { x: gauche - 6, y: f1(centre), "text-anchor": "end", "dominant-baseline": "middle", fill: TEXTE, "font-size": 11, texte: coupe(nom, limite) })
        : s("text", { x: f1(centre), y: H - B_ + 16, "text-anchor": "middle", fill: TEXTE, "font-size": 11, texte: coupe(nom, limite) }));
      g.addEventListener("pointerenter", () => montrer(k)); g.addEventListener("pointerdown", () => montrer(k));
      svg.append(g); bs.push({ g, lib, centre });
    });
    svg.append(s("desc", { id: descId, texte: `Barres ${horiz ? "horizontales" : "verticales"} : ${n} catégorie(s), valeurs de ${nombre(vals.length ? Math.min(...vals) : null)} à ${nombre(vals.length ? Math.max(...vals) : null)} ${j.unite}.` }));
    courant = { lignes: L, barres: bs, horiz }; if (st.actif >= n) st.actif = -1; if (st.actif >= 0) montrer(st.actif);
  }
  function montrer(k) {
    const b = courant.barres; if (!b.length) return; k = Math.max(0, Math.min(b.length - 1, k)); st.actif = k;
    b.forEach((x, i) => x.g.setAttribute("class", i === k ? "nxc-barre nxc-actif" : "nxc-barre"));
    lecture.textContent = b[k].lib;
  }
  svg.addEventListener("keydown", (e) => {
    const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (pas) { e.preventDefault(); montrer(st.actif < 0 ? 0 : st.actif + pas); } else if (e.key === "Home") { e.preventDefault(); montrer(0); } else if (e.key === "End") { e.preventDefault(); montrer(courant.barres.length - 1); }
  });
  rendre();
  fig.append(exporter({ jeu: j, lignes: () => courant.lignes, svg: () => svg, titre: o.titre }));
  fig.composant = { svg, filtrer(p) { st.filtre = p; rendre(); }, trier(t) { st.tri = t; tri.value = t; rendre(); }, lire: (k) => { montrer(k); return lecture.textContent; }, etat: () => ({ n: courant.barres.length, horizontale: !!courant.horiz, ordre: courant.barres.map((b) => b.lib) }) };
  return fig;
}

// ---------------------------------------------------------------- Chiffre clé
/** Une valeur, sa variation par rapport à la précédente et sa période. o = { valeur, x?, titre? }. */
export function chiffreCle(jeu, o = {}) {
  const j = jeuSur(jeu), cv = colonne(j, o.valeur, ["nombre"], "la valeur"), cx = o.x ? colonne(j, o.x, ["date", "nombre"], "la période") : null;
  const fig = cadre(j, o.titre, "chiffre_cle");
  let L = j.lignes.filter((l) => l[cv.i] != null && (!cx || l[cx.i] != null));
  if (cx) L = [...L].sort((a, b) => (cx.type === "date" ? dateVersMs(a[cx.i]) - dateVersMs(b[cx.i]) : a[cx.i] - b[cx.i]));
  const quand = (l) => (cx ? (cx.type === "date" ? dateTexte(l[cx.i]) : String(l[cx.i])) : "");
  if (!L.length) fig.append(etatVide("Aucune valeur disponible."));
  else {
    const der = L[L.length - 1], v = der[cv.i], prec = L.length > 1 ? L[L.length - 2] : null;
    const bloc = h("div", { class: "nxc-chiffre" }, h("p", { class: "nxc-valeur" }, h("span", { texte: nombre(v) }), h("span", { class: "nxc-unite", texte: " " + j.unite })));
    if (cx) bloc.append(h("p", { class: "nxc-discret", texte: `Valeur de ${quand(der)}` }));
    if (prec) {
      const p = prec[cv.i], diff = v - p, sens = diff > 0 ? "hausse" : diff < 0 ? "baisse" : "stable";
      const signe = diff > 0 ? "+" : diff < 0 ? "−" : "";
      const txt = p !== 0 ? `${signe}${nombre(Math.abs((diff / Math.abs(p)) * 100), 1)} %` : `${signe}${nombre(Math.abs(diff))} ${j.unite}`;
      const mot = sens === "stable" ? "stable" : `${sens} de ${txt.replace(/^[+−]/, "")}`;
      bloc.append(h("p", { class: "nxc-variation", "data-sens": sens, "aria-label": `${mot} par rapport à ${quand(prec) || "la valeur précédente"}` },
        h("span", { "aria-hidden": "true", texte: sens === "hausse" ? "▲ " : sens === "baisse" ? "▼ " : "■ " }), `${sens === "stable" ? "Stable" : txt} par rapport à ${quand(prec) || "la valeur précédente"}`));
    }
    fig.append(bloc);
  }
  fig.append(piedSources(j), exporter({ jeu: j, titre: o.titre }));
  return fig;
}

// ---------------------------------------------------------------- Filtres
/**
 * Filtres au clavier : cases à cocher pour une colonne texte, bornes « de / à » pour une date ou un nombre.
 * surChangement(predicat) reçoit une fonction ligne → booléen, à passer à composant.filtrer() des autres composants.
 */
export function filtres(jeu, { champs = [], surChangement = () => {} } = {}) {
  const j = jeuSur(jeu), etat = new Map(), boite = h("div", { class: "nxc-filtres", role: "group", "aria-label": "Filtres" });
  for (const id of champs) {
    const c = colonne(j, id, ["texte", "date", "nombre"], "un filtre");
    const valeurs = [...new Set(j.lignes.map((l) => l[c.i]).filter((v) => v != null))];
    if (c.type === "texte") {
      const coches = new Set(valeurs), fs = h("fieldset", { class: "nxc-fs" }, h("legend", { texte: c.libelle }));
      const cases = valeurs.slice(0, MAX_CATEGORIES).map((v) => { const cb = h("input", { type: "checkbox", checked: true }); cb.checked = true; cb.addEventListener("change", () => { if (cb.checked) coches.add(v); else coches.delete(v); signaler(); }); fs.append(h("label", { class: "nxc-case" }, cb, h("span", { texte: v }))); return [cb, v]; });
      const tout = (oui) => { cases.forEach(([cb, v]) => { cb.checked = oui; if (oui) coches.add(v); else coches.delete(v); }); signaler(); };
      fs.append(h("span", { class: "nxc-raccourcis" }, h("button", { class: "nxc-lien", type: "button", onclick: () => tout(true) }, "Tout"), h("button", { class: "nxc-lien", type: "button", onclick: () => tout(false) }, "Aucun")));
      etat.set(c, (l) => l[c.i] != null && coches.has(l[c.i])); boite.append(fs);
    } else {
      const tri = valeurs.sort((a, b) => (c.type === "date" ? dateVersMs(a) - dateVersMs(b) : a - b)), lib = (v) => (c.type === "date" ? dateTexte(v) : String(v));
      const de = h("select", { class: "nxc-champ", "aria-label": `${c.libelle} : à partir de` }, tri.map((v, i) => h("option", { value: String(i), texte: lib(v) })));
      const a = h("select", { class: "nxc-champ", "aria-label": `${c.libelle} : jusqu'à` }, tri.map((v, i) => h("option", { value: String(i), texte: lib(v) })));
      de.value = "0"; a.value = String(Math.max(0, tri.length - 1));
      const cle = (v) => (c.type === "date" ? dateVersMs(v) : v);
      const borne = () => { if (+de.value > +a.value) a.value = de.value; signaler(); };
      de.addEventListener("change", borne); a.addEventListener("change", borne);
      etat.set(c, (l) => { if (!tri.length) return true; const v = l[c.i]; if (v == null) return false; return cle(v) >= cle(tri[+de.value || 0]) && cle(v) <= cle(tri[+a.value || 0]); });
      boite.append(h("fieldset", { class: "nxc-fs" }, h("legend", { texte: c.libelle }), h("label", {}, "De ", de), h("label", {}, " à ", a)));
    }
  }
  const predicat = (l) => [...etat.values()].every((f) => f(l));
  function signaler() { surChangement(predicat); }
  boite.composant = { predicat };
  return boite;
}

// ---------------------------------------------------------------- Point d'entrée sûr
const GENRES = { courbe, barres, tableau, chiffre_cle: chiffreCle };
export const TYPES_VUE = Object.freeze(Object.keys(GENRES));
/**
 * rendre(type, jeu, options) : le composant demandé, ou un encadré « Affichage refusé : raison » (jamais d'exception
 * qui casse la fenêtre, jamais un graphique sans source). Types en liste blanche.
 */
export function rendre(type, jeu, options = {}) {
  try {
    if (!Object.prototype.hasOwnProperty.call(GENRES, type)) refus(`type de vue inconnu « ${court(type)} »`);
    return GENRES[type](jeu, options);
  } catch (e) {
    const raison = e instanceof RefusComposant ? e.message : "Affichage refusé : erreur interne du composant.";
    return h("div", { class: "nxc-refus", role: "alert", "data-raison": raison, texte: raison });
  }
}
