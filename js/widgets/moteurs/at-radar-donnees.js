// Atelier · moteur at-radar-donnees : contrôle d'un export du hub (fichier « hub-donnees » de js/store/storage.js).
// Module pur : sans DOM, sans réseau, sans IA. Ne modifie jamais l'export ; il le lit et rend un rapport.
// Contrôles : format et âge de la sauvegarde, identifiants absents ou en double, doublons de contenu,
// dates invalides, champs manquants, liens non https (et liens dangereux), images sans contenu.

export const COLLECTIONS = ["notes", "tasks", "events", "favs", "kv", "images"];
const NOMS = { notes: "Notes", tasks: "Tâches", events: "Agenda", favs: "Favoris", kv: "Réglages divers", images: "Images", export: "Export" };
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/, AT_RE = /^(\d{4}-\d\d-\d\d)T([01]\d|2[0-3]):[0-5]\d$/;
const JOUR = 86400000;

/** « 2026-02-30 » → false ; « 2026-02-28 » → true. */
export function jourValide(s) {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number), x = new Date(Date.UTC(y, m - 1, d));
  return x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
}
const sansAccent = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/** Adresse comparable : sans http(s), sans www., sans « / » final, sans #ancre. */
export function urlComparable(u) {
  return String(u || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/#.*$/, "").replace(/\/+$/, "");
}
const LIEN_RE = /\b((?:https?|ftp|javascript|data|file):[^\s<>"')]+)/gi;

/** Contrôle complet. `maintenant` (ms) se passe pour les essais ; `ageMaxJours` : âge au-delà duquel la sauvegarde est signalée. */
export function controler(exportHub, { maintenant = Date.now(), ageMaxJours = 7 } = {}) {
  const P = [];
  const ajoute = (gravite, collection, id, type, message) => P.push({ gravite, collection, id: id == null ? null : String(id), type, message });
  let d = exportHub;
  if (typeof d === "string") { try { d = JSON.parse(d.replace(/^﻿/, "")); } catch (e) { d = null; } }
  if (!d || typeof d !== "object" || d.format !== "hub-donnees" || !d.data || typeof d.data !== "object" || Array.isArray(d.data)) {
    ajoute("erreur", "export", null, "format", "Ce fichier n'est pas un export du hub.");
    return rapport(P, {});
  }
  // Sauvegarde : date et âge
  const quand = Date.parse(d.exportedAt);
  if (!Number.isFinite(quand)) ajoute("avertissement", "export", null, "date", "L'export n'indique pas sa date.");
  else if (quand > maintenant + JOUR) ajoute("avertissement", "export", null, "date", "L'export est daté dans le futur (horloge de l'appareil ?).");
  else if (maintenant - quand > ageMaxJours * JOUR) ajoute("avertissement", "export", null, "sauvegarde", `Sauvegarde vieille de ${Math.floor((maintenant - quand) / JOUR)} jours : pense à en refaire une.`);

  const comptes = {};
  for (const c of COLLECTIONS) {
    const liste = d.data[c];
    if (liste == null) { comptes[c] = 0; continue; }
    if (!Array.isArray(liste)) { ajoute("erreur", c, null, "format", `${NOMS[c]} : la liste est abîmée (ce n'est pas un tableau).`); comptes[c] = 0; continue; }
    comptes[c] = liste.length;
    const ids = new Map(), contenus = new Map();
    liste.forEach((x, i) => {
      if (!x || typeof x !== "object") { ajoute("erreur", c, null, "format", `${NOMS[c]} : l'élément n° ${i + 1} est illisible.`); return; }
      const id = typeof x.id === "string" && x.id ? x.id : null, nom = id || `n° ${i + 1}`;
      if (!id) ajoute("erreur", c, null, "manquant", `${NOMS[c]} : l'élément n° ${i + 1} n'a pas d'identifiant (il sera ignoré à l'import).`);
      else if (ids.has(id)) ajoute("erreur", c, id, "doublon", `${NOMS[c]} : identifiant « ${id} » en double (éléments n° ${ids.get(id) + 1} et ${i + 1}).`);
      else ids.set(id, i);
      // Dates de création / modification (horodatages en ms)
      for (const k of ["created", "updated", "doneAt"]) {
        if (x[k] == null) continue;
        if (!Number.isFinite(x[k]) || x[k] < 0) ajoute("avertissement", c, nom, "date", `${NOMS[c]} « ${nom} » : date « ${k} » invalide.`);
        else if (x[k] > maintenant + JOUR) ajoute("avertissement", c, nom, "date", `${NOMS[c]} « ${nom} » : date « ${k} » dans le futur.`);
      }
      const cle = verifier(c, x, nom, ajoute);
      if (cle) { if (contenus.has(cle)) ajoute("avertissement", c, nom, "doublon", `${NOMS[c]} : « ${nom} » a le même contenu que « ${contenus.get(cle)} ».`); else contenus.set(cle, nom); }
    });
  }
  return rapport(P, comptes);
}

/** Contrôles propres à chaque collection ; renvoie la clé de contenu servant à repérer les doublons. */
function verifier(c, x, nom, ajoute) {
  const N = NOMS[c], liens = (t) => { const out = []; String(t || "").replace(LIEN_RE, (m) => out.push(m)); return out; };
  const lienTexte = (t) => {
    for (const u of liens(t)) {
      if (/^(javascript|data|file):/i.test(u)) ajoute("erreur", c, nom, "lien", `${N} « ${nom} » : lien dangereux (${u.slice(0, 40)}).`);
      else if (!/^https:/i.test(u)) ajoute("avertissement", c, nom, "lien", `${N} « ${nom} » : lien non sécurisé (${u.slice(0, 60)}).`);
    }
  };
  if (c === "notes") {
    if (typeof x.text !== "string" || !x.text.trim()) { ajoute("avertissement", c, nom, "manquant", `${N} « ${nom} » : note vide.`); return null; }
    lienTexte(x.text); return sansAccent(x.text);
  }
  if (c === "tasks") {
    if (typeof x.text !== "string" || !x.text.trim()) ajoute("avertissement", c, nom, "manquant", `${N} « ${nom} » : tâche sans texte.`);
    if (x.due != null && !jourValide(x.due)) ajoute("erreur", c, nom, "date", `${N} « ${nom} » : échéance invalide (${x.due}).`);
    if (x.remindAt != null) { const m = typeof x.remindAt === "string" && x.remindAt.match(AT_RE); if (!m || !jourValide(m[1])) ajoute("erreur", c, nom, "date", `${N} « ${nom} » : rappel invalide (${x.remindAt}).`); }
    if (x.done === true && x.doneAt == null) ajoute("avertissement", c, nom, "manquant", `${N} « ${nom} » : faite, mais sans date de fin.`);
    lienTexte(x.text);
    return x.done === true || !x.text ? null : sansAccent(x.text) + "|" + (x.due || "");
  }
  if (c === "events") {
    if (typeof x.title !== "string" || !x.title.trim()) ajoute("avertissement", c, nom, "manquant", `${N} « ${nom} » : rendez-vous sans titre.`);
    if (x.date == null) ajoute("erreur", c, nom, "manquant", `${N} « ${nom} » : rendez-vous sans date (il sera ignoré à l'import).`);
    else if (!jourValide(x.date)) ajoute("erreur", c, nom, "date", `${N} « ${nom} » : date invalide (${x.date}).`);
    for (const k of ["start", "end"]) if (x[k] != null && !(typeof x[k] === "string" && HM_RE.test(x[k]))) ajoute("erreur", c, nom, "date", `${N} « ${nom} » : heure « ${k} » invalide (${x[k]}).`);
    if (HM_RE.test(x.start || "") && HM_RE.test(x.end || "") && x.end < x.start) ajoute("avertissement", c, nom, "date", `${N} « ${nom} » : finit avant de commencer (${x.start} → ${x.end}).`);
    return sansAccent(x.title) + "|" + x.date + "|" + (x.start || "");
  }
  if (c === "favs") {
    if (typeof x.url !== "string" || !x.url.trim()) { ajoute("erreur", c, nom, "manquant", `${N} « ${nom} » : favori sans adresse.`); return null; }
    const u = x.url.trim();
    if (!/^https?:\/\//i.test(u)) ajoute("erreur", c, nom, "lien", `${N} « ${nom} » : adresse refusée à l'import (${u.slice(0, 40)}).`);
    else if (!/^https:/i.test(u)) ajoute("avertissement", c, nom, "lien", `${N} « ${nom} » : lien non sécurisé (http).`);
    if (typeof x.title !== "string" || !x.title.trim()) ajoute("avertissement", c, nom, "manquant", `${N} « ${nom} » : favori sans titre.`);
    return urlComparable(u);
  }
  if (c === "images") {
    if (typeof x.blob !== "string" || !/^data:image\//.test(x.blob)) ajoute("avertissement", c, nom, "manquant", `${N} « ${nom} » : image sans contenu.`);
    return null;
  }
  return null;
}

/** Rassemble les problèmes en rapport : erreurs d'abord, puis par collection. */
function rapport(problemes, comptes) {
  const ordre = { erreur: 0, avertissement: 1 };
  const P = problemes.slice().sort((a, b) => ordre[a.gravite] - ordre[b.gravite] || COLLECTIONS.concat("export").indexOf(a.collection) - COLLECTIONS.concat("export").indexOf(b.collection));
  const erreurs = P.filter((p) => p.gravite === "erreur").length, avertissements = P.length - erreurs;
  const total = Object.values(comptes).reduce((s, n) => s + n, 0);
  const resume = !P.length ? `Tout est en ordre (${total} éléments contrôlés).`
    : `${erreurs} erreur${erreurs > 1 ? "s" : ""} et ${avertissements} avertissement${avertissements > 1 ? "s" : ""} sur ${total} éléments.`;
  const texte = [resume, ...P.map((p) => `${p.gravite === "erreur" ? "✖" : "⚠"} ${p.message}`)].join("\n");
  return { ok: erreurs === 0, erreurs, avertissements, comptes, problemes: P, resume, texte };
}
