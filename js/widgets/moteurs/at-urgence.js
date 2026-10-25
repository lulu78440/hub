// Atelier · moteur at-urgence : structure, validation et export texte de la fiche d'urgence.
// Module pur : sans DOM, sans réseau, sans IA. AUCUN chiffrement ici : la fiche contient des données de santé,
// le coffre chiffré du hub s'en charge au branchement (ne jamais l'écrire en clair dans un fichier public).
// Ce moteur ne donne aucun conseil médical : il range et vérifie ce que Lucien saisit.
//
// Fiche : { version: 1, maj?: "AAAA-MM-JJ",
//   personne: { nom, prenom?, naissance?: "AAAA-MM-JJ", groupeSanguin?, poidsKg?, langue? },
//   contacts: [{ nom, lien?, telephone, prioritaire? }],
//   allergies: [{ substance, reaction?, gravite?: "legere"|"moderee"|"severe" }],
//   traitements: [{ nom, dose?, frequence?, motif? }],
//   antecedents?: [texte], procedures: [{ titre, etapes: [texte] }], notes? }

export const VERSION = 1;
const GROUPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GRAVITES = { legere: "légère", moderee: "modérée", severe: "SÉVÈRE" };
// Numéros d'urgence publics (France / Europe), ajoutés en tête de l'export texte.
export const NUMEROS = [["15", "SAMU"], ["112", "Urgences (Europe)"], ["18", "Pompiers"], ["17", "Police"], ["114", "Urgences par SMS (sourds et malentendants)"]];

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateOk = (s) => { const m = DAY_RE.exec(s || ""); if (!m) return false; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1; };
const txt = (x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : x == null ? "" : String(x).trim());
const liste = (x) => (Array.isArray(x) ? x : []);
const fr = (s) => s.split("-").reverse().join("/");

/** Téléphone normalisé : chiffres et « + » initial seulement (« 06 12 34 56 78 » → « 0612345678 »). */
export function normaliserTelephone(t) {
  const s = txt(t).replace(/[\s.\-()/]/g, "");
  return /^\+?\d+$/.test(s) ? s : "";
}
/** Téléphone plausible : numéro français à 10 chiffres (0X…), international « +XX… » de 8 à 15 chiffres, ou numéro court d'urgence. */
export function telephoneValide(t) {
  const s = normaliserTelephone(t);
  return /^0[1-9]\d{8}$/.test(s) || /^\+[1-9]\d{7,14}$/.test(s) || /^(15|17|18|112|114|115|119)$/.test(s);
}
/** Affichage d'un téléphone : « 06 12 34 56 78 » pour un numéro français, tel quel sinon. */
export function afficherTelephone(t) {
  const s = normaliserTelephone(t);
  if (/^0\d{9}$/.test(s)) return s.replace(/(\d{2})(?=\d)/g, "$1 ");
  if (/^\+33[1-9]\d{8}$/.test(s)) return "+33 " + s.slice(3, 4) + " " + s.slice(4).replace(/(\d{2})(?=\d)/g, "$1 ");
  return s || txt(t);
}

/** Fiche vide, prête à remplir. */
export function ficheVide() {
  return { version: VERSION, maj: null, personne: { nom: "", prenom: "", naissance: "", groupeSanguin: "", poidsKg: null, langue: "" }, contacts: [], allergies: [], traitements: [], antecedents: [], procedures: [], notes: "" };
}

/** Nettoie une fiche (espaces, téléphones, champs inconnus retirés, entrées vides supprimées) sans rien inventer.
 *  Renvoie une NOUVELLE fiche ; l'original n'est pas modifié. */
export function normaliser(fiche) {
  const f = fiche || {}, p = f.personne || {};
  const g = txt(p.groupeSanguin).toUpperCase().replace(/\s/g, "").replace(/^0/, "O").replace(/POS(ITIF)?$/, "+").replace(/NEG(ATIF)?$/, "-");
  return {
    version: VERSION,
    maj: dateOk(f.maj) ? f.maj : null,
    personne: { nom: txt(p.nom), prenom: txt(p.prenom), naissance: txt(p.naissance), groupeSanguin: g, poidsKg: Number.isFinite(+p.poidsKg) && +p.poidsKg > 0 ? Math.round(+p.poidsKg * 10) / 10 : null, langue: txt(p.langue) },
    contacts: liste(f.contacts).map((c) => ({ nom: txt(c?.nom), lien: txt(c?.lien), telephone: normaliserTelephone(c?.telephone) || txt(c?.telephone), prioritaire: !!c?.prioritaire })).filter((c) => c.nom || c.telephone),
    allergies: liste(f.allergies).map((a) => ({ substance: txt(a?.substance ?? a), reaction: txt(a?.reaction), gravite: txt(a?.gravite).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") })).filter((a) => a.substance),
    traitements: liste(f.traitements).map((t) => ({ nom: txt(t?.nom ?? t), dose: txt(t?.dose), frequence: txt(t?.frequence), motif: txt(t?.motif) })).filter((t) => t.nom),
    antecedents: liste(f.antecedents).map(txt).filter(Boolean),
    procedures: liste(f.procedures).map((x) => ({ titre: txt(x?.titre), etapes: liste(x?.etapes).map(txt).filter(Boolean) })).filter((x) => x.titre || x.etapes.length),
    notes: txt(f.notes),
  };
}

/** Valide : { ok, erreurs, avertissements, fiche (normalisée) }. ok = aucune erreur (les avertissements n'empêchent rien).
 *  aujourdhui (facultatif, « AAAA-MM-JJ ») : signale une fiche non relue depuis plus de `ageMaxJours` (défaut 365). */
export function valider(fiche, { aujourdhui, ageMaxJours = 365 } = {}) {
  const E = [], A = [];
  if (!fiche || typeof fiche !== "object") return { ok: false, erreurs: ["fiche absente"], avertissements: [], fiche: normaliser(null) };
  if (fiche.version != null && fiche.version !== VERSION) A.push(`version ${fiche.version} inconnue (lue comme version ${VERSION})`);
  const f = normaliser(fiche), p = f.personne;
  if (!p.nom) E.push("nom de la personne manquant");
  if (p.naissance && !dateOk(p.naissance)) E.push("date de naissance invalide (AAAA-MM-JJ)");
  else if (p.naissance && aujourdhui && p.naissance > aujourdhui) E.push("date de naissance dans le futur");
  if (p.groupeSanguin && !GROUPES.includes(p.groupeSanguin)) E.push(`groupe sanguin « ${p.groupeSanguin} » non reconnu`);
  if (!p.groupeSanguin) A.push("groupe sanguin non renseigné");
  if (!f.contacts.length) E.push("au moins un contact d'urgence est nécessaire");
  f.contacts.forEach((c, i) => {
    const n = c.nom || `contact ${i + 1}`;
    if (!c.nom) E.push(`contact ${i + 1} : nom manquant`);
    if (!c.telephone) E.push(`${n} : téléphone manquant`);
    else if (!telephoneValide(c.telephone)) E.push(`${n} : téléphone « ${c.telephone} » invalide`);
    if (!c.lien) A.push(`${n} : lien (conjoint, parent, ami…) non précisé`);
  });
  const vus = new Set();
  for (const c of f.contacts) { if (c.telephone && vus.has(c.telephone)) A.push(`téléphone ${afficherTelephone(c.telephone)} en double`); vus.add(c.telephone); }
  if (f.contacts.length && !f.contacts.some((c) => c.prioritaire)) A.push("aucun contact prioritaire : le premier de la liste sera appelé en premier");
  if (f.contacts.filter((c) => c.prioritaire).length > 1) A.push("plusieurs contacts prioritaires");
  f.allergies.forEach((a) => { if (a.gravite && !GRAVITES[a.gravite]) E.push(`allergie « ${a.substance} » : gravité « ${a.gravite} » non reconnue (legere, moderee, severe)`); });
  const sv = new Set(); for (const a of f.allergies) { const k = a.substance.toLowerCase(); if (sv.has(k)) A.push(`allergie « ${a.substance} » en double`); sv.add(k); }
  f.traitements.forEach((t) => { if (!t.dose) A.push(`traitement « ${t.nom} » : dose non précisée`); });
  f.procedures.forEach((x, i) => { if (!x.titre) E.push(`procédure ${i + 1} : titre manquant`); if (!x.etapes.length) E.push(`procédure « ${x.titre || i + 1} » : aucune étape`); });
  if (!f.allergies.length) A.push("aucune allergie saisie : écrire « aucune connue » si c'est le cas, pour lever le doute");
  if (aujourdhui && dateOk(aujourdhui)) {
    if (!f.maj) A.push("date de mise à jour absente");
    else { const j = Math.round((Date.parse(aujourdhui) - Date.parse(f.maj)) / 86400000); if (j > ageMaxJours) A.push(`fiche non relue depuis ${j} jours`); }
  }
  return { ok: E.length === 0, erreurs: E, avertissements: A, fiche: f };
}

/** Export texte lisible (à imprimer ou à afficher sur l'écran verrouillé). Les allergies sévères et les contacts prioritaires passent en tête.
 *  Options : { numeros: true } pour ajouter les numéros d'urgence publics. */
export function exporterTexte(fiche, { numeros = true } = {}) {
  const f = normaliser(fiche), p = f.personne, L = [];
  const identite = [p.prenom, p.nom ? p.nom.toUpperCase() : ""].filter(Boolean).join(" ") || "(nom non renseigné)";
  L.push("FICHE D'URGENCE", "=".repeat(15), identite);
  const infos = [p.naissance && dateOk(p.naissance) ? `né(e) le ${fr(p.naissance)}` : "", p.groupeSanguin ? `groupe sanguin ${p.groupeSanguin}` : "", p.poidsKg ? `${String(p.poidsKg).replace(".", ",")} kg` : "", p.langue ? `langue : ${p.langue}` : ""].filter(Boolean);
  if (infos.length) L.push(infos.join(" · "));
  const severes = f.allergies.filter((a) => a.gravite === "severe");
  if (severes.length) L.push("", `!! ALLERGIE SÉVÈRE : ${severes.map((a) => a.substance).join(", ")} !!`);
  L.push("", "CONTACTS");
  const contacts = [...f.contacts].sort((a, b) => (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0));
  if (!contacts.length) L.push("- aucun");
  contacts.forEach((c, i) => L.push(`${i + 1}. ${c.nom || "?"}${c.lien ? ` (${c.lien})` : ""} : ${afficherTelephone(c.telephone)}${c.prioritaire ? " — à appeler en premier" : ""}`));
  L.push("", "ALLERGIES");
  if (!f.allergies.length) L.push("- non renseignées");
  const ordreG = { severe: 0, moderee: 1, legere: 2, "": 3 };
  [...f.allergies].sort((a, b) => (ordreG[a.gravite] ?? 3) - (ordreG[b.gravite] ?? 3)).forEach((a) => L.push(`- ${a.substance}${a.gravite && GRAVITES[a.gravite] ? ` [${GRAVITES[a.gravite]}]` : ""}${a.reaction ? ` : ${a.reaction}` : ""}`));
  L.push("", "TRAITEMENTS EN COURS");
  if (!f.traitements.length) L.push("- aucun renseigné");
  f.traitements.forEach((t) => L.push(`- ${t.nom}${[t.dose, t.frequence].filter(Boolean).length ? ` : ${[t.dose, t.frequence].filter(Boolean).join(", ")}` : ""}${t.motif ? ` (${t.motif})` : ""}`));
  if (f.antecedents.length) { L.push("", "ANTÉCÉDENTS"); f.antecedents.forEach((a) => L.push(`- ${a}`)); }
  if (f.procedures.length) {
    L.push("", "QUE FAIRE");
    f.procedures.forEach((x) => { L.push(`> ${x.titre || "Procédure"}`); x.etapes.forEach((e, i) => L.push(`  ${i + 1}. ${e}`)); });
  }
  if (f.notes) L.push("", "NOTES", f.notes);
  if (numeros) L.push("", "NUMÉROS D'URGENCE : " + NUMEROS.map(([n, q]) => `${n} ${q}`).join(" · "));
  if (f.maj) L.push("", `Mise à jour : ${fr(f.maj)}`);
  return L.join("\n");
}
