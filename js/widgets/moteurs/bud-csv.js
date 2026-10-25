// Atelier · moteur bud-csv : lecture d'un relevé bancaire CSV français et règles de catégorisation.
// Inspiré du principe d'Actual Budget (import local + règles), écrit de zéro : aucun code copié.
// Module pur : sans DOM, sans réseau, sans IA. Les montants sont en CENTIMES (entiers) pour éviter les erreurs d'arrondi.
// Formats pris en charge : séparateur « ; » (ou « , » / tabulation, détecté), virgule décimale, dates JJ/MM/AAAA (ou JJ/MM/AA),
// encodage UTF-8 avec ou sans BOM, UTF-16 avec BOM, Windows-1252 (exports Excel), lignes d'en-tête de banque avant le tableau,
// colonne « Montant » unique ou colonnes « Débit » / « Crédit ».

/** Octets (Uint8Array / ArrayBuffer) ou texte → texte sans BOM. */
export function decoder(entree) {
  if (typeof entree === "string") return entree.replace(/^﻿/, "");
  const o = entree instanceof Uint8Array ? entree : new Uint8Array(entree || []);
  if (o[0] === 0xef && o[1] === 0xbb && o[2] === 0xbf) return new TextDecoder("utf-8").decode(o.subarray(3));
  if (o[0] === 0xff && o[1] === 0xfe) return new TextDecoder("utf-16le").decode(o.subarray(2));
  if (o[0] === 0xfe && o[1] === 0xff) return new TextDecoder("utf-16be").decode(o.subarray(2));
  try { return new TextDecoder("utf-8", { fatal: true }).decode(o); }
  catch (e) { return new TextDecoder("windows-1252").decode(o); }   // fichier enregistré par Excel
}

const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Choisit le séparateur le plus fréquent hors guillemets dans les premières lignes. */
function separateurProbable(texte) {
  const lignes = texte.split(/\r?\n/).slice(0, 15);
  let best = ";", bestN = -1;
  for (const s of [";", "\t", ","]) {
    let n = 0;
    for (const l of lignes) { let q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === s && !q) n++; } }
    if (n > bestN) { best = s; bestN = n; }
  }
  return best;
}

/** Texte CSV → lignes, chacune { cellules, n } (n = numéro de ligne dans le fichier, lignes vides comprises).
 *  Gère les guillemets, "" et les retours à la ligne entre guillemets. */
export function lireLignes(texte, separateur) {
  const t = decoder(texte), s = separateur || separateurProbable(t), lignes = [];
  let ligne = [], cell = "", q = false, num = 1, debut = 1;
  const finLigne = () => { ligne.push(cell); lignes.push({ cellules: ligne.map((c) => c.trim()), n: debut }); ligne = []; cell = ""; };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else { if (ch === "\n") num++; cell += ch; } }
    else if (ch === '"') q = true;
    else if (ch === s) { ligne.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; finLigne(); num++; debut = num; }
    else cell += ch;
  }
  if (cell !== "" || ligne.length) finLigne();
  return lignes.filter((l) => l.cellules.some((c) => c !== ""));
}

/** Texte CSV → tableau de lignes (tableaux de cellules), lignes vides retirées. */
export function lireCSV(texte, separateur) { return lireLignes(texte, separateur).map((l) => l.cellules); }

/** « -1 234,56 € », « 1.234,56 », « (12,30) », « +5 » → centimes (entier), ou null si illisible. */
export function lireMontant(v) {
  let s = String(v == null ? "" : v).trim().replace(/[\s  ']/g, "").replace(/(€|eur|euros?)$/i, "").replace(/^(€|eur)/i, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); }       // « 12,30- » (certaines banques)
  if (s[0] === "-") { neg = !neg; s = s.slice(1); } else if (s[0] === "+") s = s.slice(1);
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");                    // virgule décimale, points de milliers
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");                   // « 1.234 » = mille deux cent trente-quatre
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [e, d = ""] = s.split(".");
  const c = Number(e) * 100 + Number((d + "00").slice(0, 2));
  return neg ? -c : c;
}

/** « 05/03/2026 », « 5/3/26 », « 05-03-2026 », « 05.03.2026 » ou « 2026-03-05 » → « 2026-03-05 », ou null. */
export function lireDate(v) {
  const s = String(v || "").trim();
  let j, m, a, r;
  if ((r = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) [a, m, j] = [+r[1], +r[2], +r[3]];
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) { j = +r[1]; m = +r[2]; a = +r[3]; if (r[3].length === 2) a += a >= 70 ? 1900 : 2000; }
  else return null;
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

const ALIAS = {
  date: ["date", "date operation", "date de l operation", "date comptable", "date de comptabilisation", "date op"],
  libelle: ["libelle", "libelle operation", "libelle de l operation", "intitule", "description", "detail", "details", "libelle simplifie", "nature de l operation"],
  montant: ["montant", "montant eur", "montant euros", "montant en euros", "somme"],
  debit: ["debit", "debit eur", "debit euros", "debits"],
  credit: ["credit", "credit eur", "credit euros", "credits"],
};
function colonnes(entete) {
  const n = entete.map(norm), col = {};
  for (const [k, al] of Object.entries(ALIAS)) {
    let i = n.findIndex((h) => al.includes(h));
    if (i < 0) i = n.findIndex((h) => al.some((a) => h.startsWith(a + " ")) && !(k === "date" && /valeur/.test(h)));
    if (i >= 0) col[k] = i;
  }
  return col;
}

/** Empreinte courte et stable (FNV-1a) : sert d'identifiant pour ne pas importer deux fois la même opération. */
export function empreinte(t) {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/** Relevé CSV → { operations, ignorees, colonnes, separateur }.
 *  operation : { id, date, libelle, montant (centimes, négatif = dépense), ligne (n° dans le fichier) }. */
export function importerReleve(entree, options = {}) {
  const texte = decoder(entree), separateur = options.separateur || separateurProbable(texte), L = lireLignes(texte, separateur), lignes = L.map((l) => l.cellules);
  // L'en-tête est la première ligne qui a une date, un libellé et un montant (ou débit/crédit) ; les banques mettent souvent des lignes avant.
  let h = -1, col = null;
  for (let i = 0; i < Math.min(lignes.length, 30); i++) {
    const c = colonnes(lignes[i]);
    if (c.date != null && c.libelle != null && (c.montant != null || c.debit != null || c.credit != null)) { h = i; col = c; break; }
  }
  if (h < 0) throw new Error("Je ne trouve pas les colonnes Date, Libellé et Montant (ou Débit/Crédit) dans ce fichier.");
  const operations = [], ignorees = [], vus = new Map();
  for (let i = h + 1; i < lignes.length; i++) {
    const l = lignes[i], date = lireDate(l[col.date]), libelle = (l[col.libelle] || "").replace(/\s+/g, " ").trim();
    let montant = null;
    if (col.montant != null) montant = lireMontant(l[col.montant]);
    else {
      const d = col.debit != null ? lireMontant(l[col.debit]) : null, c = col.credit != null ? lireMontant(l[col.credit]) : null;
      if (d != null || c != null) montant = (c || 0) - Math.abs(d || 0);   // débit toujours compté en dépense, signe ou pas
    }
    if (!date) { ignorees.push({ ligne: L[i].n, raison: l.some((x) => /solde|total/i.test(x)) ? "ligne de solde ou de total" : "date illisible" }); continue; }
    if (montant == null) { ignorees.push({ ligne: L[i].n, raison: "montant illisible" }); continue; }
    const base = `${date}|${norm(libelle)}|${montant}`, n = (vus.get(base) || 0) + 1;   // deux cafés identiques le même jour restent deux opérations
    vus.set(base, n);
    operations.push({ id: "op-" + empreinte(base + "|" + n), date, libelle, montant, ligne: L[i].n });
  }
  return { operations, ignorees, colonnes: col, separateur };
}

/** Ne garde que les opérations nouvelles (identifiant pas encore connu). */
export function nouvelles(existantes, importees) {
  const connus = new Set((existantes || []).map((o) => o.id));
  return (importees || []).filter((o) => !connus.has(o.id));
}

// ——— Règles de catégorisation ———
// regle : { id, nom?, conditions: [{ champ: "libelle"|"montant", op, valeur }], categorie }
// op libellé : "contient", "commence", "egal" (sans accents ni casse) ; op montant (euros) : "egal", "inferieur", "superieur", "entre" ([min, max]) ;
// op "sens" : "depense" | "revenu". Toutes les conditions doivent être vraies. La PREMIÈRE règle qui correspond l'emporte.

function vraie(c, op) {
  if (c.op === "sens") return c.valeur === "revenu" ? op.montant > 0 : op.montant < 0;
  if (c.champ === "montant") {
    const m = Math.abs(op.montant) / 100, v = c.valeur;
    if (c.op === "egal") return Math.abs(m - +v) < 0.005;
    if (c.op === "inferieur") return m < +v;
    if (c.op === "superieur") return m > +v;
    if (c.op === "entre") return Array.isArray(v) && m >= +v[0] && m <= +v[1];
    return false;
  }
  const l = " " + norm(op.libelle) + " ", v = norm(c.valeur);
  if (!v) return false;
  if (c.op === "contient") return l.includes(v);
  if (c.op === "commence") return l.startsWith(" " + v);
  if (c.op === "egal") return l.trim() === v;
  return false;
}

/** Vérifie une règle ; renvoie la liste des problèmes (vide si elle est bonne). */
export function verifierRegle(r) {
  const P = [];
  if (!r || typeof r !== "object") return ["règle illisible"];
  if (!r.categorie) P.push("catégorie manquante");
  if (!Array.isArray(r.conditions) || !r.conditions.length) P.push("aucune condition");
  else r.conditions.forEach((c, i) => {
    const okOp = c && (c.op === "sens" ? ["depense", "revenu"].includes(c.valeur)
      : c.champ === "libelle" ? ["contient", "commence", "egal"].includes(c.op) && String(c.valeur || "").trim()
      : c.champ === "montant" ? (c.op === "entre" ? Array.isArray(c.valeur) && c.valeur.length === 2 : ["egal", "inferieur", "superieur"].includes(c.op) && Number.isFinite(+c.valeur)) : false);
    if (!okOp) P.push(`condition n° ${i + 1} invalide`);
  });
  return P;
}

/** Applique les règles. Une catégorie déjà posée à la main (op.categorieManuelle) n'est jamais écrasée.
 *  Renvoie { operations (copies avec categorie et regle), nonClassees }. */
export function categoriser(operations, regles) {
  const R = (regles || []).filter((r) => !verifierRegle(r).length);
  const out = (operations || []).map((op) => {
    if (op.categorieManuelle) return { ...op, categorie: op.categorieManuelle, regle: null };
    const r = R.find((r) => r.conditions.every((c) => vraie(c, op)));
    return { ...op, categorie: r ? r.categorie : null, regle: r ? r.id : null };
  });
  return { operations: out, nonClassees: out.filter((o) => !o.categorie) };
}

// Mots sans intérêt dans les libellés bancaires français : préfixes de paiement, mots de liaison, références.
const BRUIT = new Set("cb carte paiement par prlv prelevement sepa vir virement recu emis inst instantane facture fact retrait dab de du des la le les et a au en sur pour ref mandat ech echeance achat cheque chq vers frais commission international europe ue fr france paris".split(" "));

/** Suggestion de règle SANS IA à partir d'un libellé que Lucien vient de classer à la main :
 *  « CB CARREFOUR MARKET 12/10 CARTE 4971XXXX » + « Courses » → contient « carrefour market ».
 *  La suggestion est seulement proposée : c'est Lucien qui la confirme. */
export function suggererRegle(libelle, categorie) {
  const mots = norm(libelle).split(" ").filter((w) => w.length > 1 && !BRUIT.has(w) && !/\d/.test(w) && !/^x+$/.test(w));
  if (!mots.length || !categorie) return null;
  const cle = mots.slice(0, 2).join(" ");
  return { id: "regle-" + empreinte(cle + "|" + categorie), nom: `« ${cle} » → ${categorie}`, conditions: [{ champ: "libelle", op: "contient", valeur: cle }], categorie, suggeree: true };
}
