// Noyau · registre central des outils (orchestrateur, lot 3).
// Ce module ne donne AUCUN droit : il vérifie les paramètres, contrôle que les déclarations d'un outil sont cohérentes avec son niveau,
// et liste les sites qu'un outil contacte. La liste des outils validés et leurs niveaux restent dans outils.js (seule porte d'entrée).
// Contraintes : aucune dépendance, aucun réseau, aucun accès au hub.

// ---------- Validation des paramètres (schéma de type JSON-Schema réduit) ----------
const TYPES = ["string", "integer", "number", "boolean", "array", "object"];
const court = (v, n = 40) => String(v).replace(/\s+/g, " ").slice(0, n);

function verifier(v, def, chemin, profondeur) {
  if (profondeur > 4) return `${chemin} : imbrication trop profonde`;
  const t = def.type;
  if (t === "string") {
    if (typeof v !== "string") return `${chemin} doit être du texte`;
    if (v.length > (def.maxLength || 2000)) return `${chemin} est trop long`;
    if (def.minLength && v.length < def.minLength) return `${chemin} est trop court`;
    if (def.pattern && !new RegExp(def.pattern).test(v)) return `${chemin} : format non valide`;
  } else if (t === "integer") {
    if (!Number.isInteger(v)) return `${chemin} doit être un nombre entier`;
  } else if (t === "number") {
    if (typeof v !== "number" || !Number.isFinite(v)) return `${chemin} doit être un nombre`;
  } else if (t === "boolean") {
    if (typeof v !== "boolean") return `${chemin} doit être vrai ou faux`;
  } else if (t === "array") {
    if (!Array.isArray(v)) return `${chemin} doit être une liste`;
    if (v.length > (def.maxItems == null ? 50 : def.maxItems)) return `${chemin} : trop d'éléments (${def.maxItems == null ? 50 : def.maxItems} au plus)`;
    if (def.items) for (let i = 0; i < v.length; i++) { const e = verifier(v[i], def.items, `${chemin}[${i + 1}]`, profondeur + 1); if (e) return e; }
    return null;
  } else if (t === "object") {
    if (!v || typeof v !== "object" || Array.isArray(v)) return `${chemin} doit être un objet`;
    return verifierObjet(v, def, chemin, profondeur + 1);
  }
  if (typeof v === "number") {
    if (def.minimum != null && v < def.minimum) return `${chemin} : ${def.minimum} au moins`;
    if (def.maximum != null && v > def.maximum) return `${chemin} : ${def.maximum} au plus`;
  }
  if (def.enum && !def.enum.includes(v)) return `${chemin} : valeur permise ${def.enum.join(", ")}`;
  return null;
}

function verifierObjet(p, schema, chemin, profondeur) {
  for (const k of schema.required || []) if (p[k] === undefined || p[k] === null || p[k] === "") return `Paramètre manquant : ${chemin ? chemin + "." : ""}${k}`;
  const props = schema.properties || {};
  if (schema.additionalProperties === false) for (const k of Object.keys(p)) if (!Object.prototype.hasOwnProperty.call(props, k)) return `Paramètre inconnu : ${chemin ? chemin + "." : ""}${court(k)}`;
  for (const [k, def] of Object.entries(props)) {
    const v = p[k]; if (v === undefined || v === null) continue;
    const e = verifier(v, def, chemin ? `${chemin}.${k}` : k, profondeur); if (e) return e;
  }
  return null;
}

/** Renvoie null si les paramètres respectent le schéma, sinon la raison en français (jamais d'exception). */
export function validerParams(params, schema) {
  const p = params && typeof params === "object" && !Array.isArray(params) ? params : {};
  try { return verifierObjet(p, schema || {}, "", 0); } catch (e) { return "Paramètres illisibles"; }
}

// ---------- Cohérence des déclarations d'un outil ----------
// `drapeaux` (inspirés des annotations MCP) : { lecture_seule, reversible, monde_ouvert, idempotent }.
// Règle d'or : un drapeau ne peut que DURCIR un niveau, jamais l'assouplir (le niveau validé par Lucien reste la référence).
const NIVEAUX = ["LIBRE", "CONFIRMATION", "INTERDIT"];
const RE_HOTE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Problèmes d'un outil (liste vide = cohérent). Ne modifie rien. */
export function controlerOutil(o, valides = null) {
  const p = [];
  if (!o || typeof o.nom !== "string" || !/^[a-z][a-z0-9_]{1,40}$/.test(o.nom)) return ["nom d'outil invalide"];
  if (!NIVEAUX.includes(o.niveau)) p.push("niveau inconnu");
  if (valides && valides[o.nom] !== o.niveau) p.push(`niveau ${o.niveau} différent du niveau validé ${valides[o.nom]}`);
  if (!o.params || o.params.type !== "object") p.push("paramètres : un objet est attendu");
  if (typeof o.exec !== "function") p.push("exec manquant");
  const d = o.drapeaux;
  if (d != null) {
    for (const k of Object.keys(d)) if (!["lecture_seule", "reversible", "monde_ouvert", "idempotent"].includes(k)) p.push(`drapeau inconnu : ${court(k)}`);
    for (const k of ["lecture_seule", "reversible", "monde_ouvert", "idempotent"]) if (d[k] != null && typeof d[k] !== "boolean") p.push(`drapeau ${k} : vrai ou faux`);
    if (d.lecture_seule === false && o.niveau === "LIBRE") p.push("un outil qui écrit ne peut pas être en accès libre (CONFIRMATION au moins)");
    if (d.reversible === false && o.niveau !== "INTERDIT") p.push("une action irréversible est INTERDITE au Noyau");
    if (d.lecture_seule === true && d.reversible === false) p.push("drapeaux contradictoires : lecture seule et irréversible");
  }
  if (o.sortie_schema != null && (typeof o.sortie_schema !== "object" || o.sortie_schema.type !== "object")) p.push("sortie_schema : un objet est attendu");
  if (o.limites != null) {
    const l = o.limites;
    for (const k of Object.keys(l)) if (!["delai_ms", "max_par_minute", "taille_max"].includes(k)) p.push(`limite inconnue : ${court(k)}`);
    if (l.delai_ms != null && !(Number.isInteger(l.delai_ms) && l.delai_ms >= 100 && l.delai_ms <= 120000)) p.push("limites.delai_ms : 100 à 120 000");
    if (l.max_par_minute != null && !(Number.isInteger(l.max_par_minute) && l.max_par_minute >= 1 && l.max_par_minute <= 600)) p.push("limites.max_par_minute : 1 à 600");
    if (l.taille_max != null && !(Number.isInteger(l.taille_max) && l.taille_max >= 1000 && l.taille_max <= 5000000)) p.push("limites.taille_max : 1 000 à 5 000 000 octets");
  }
  if (o.hotes != null) {
    if (!Array.isArray(o.hotes) || o.hotes.length > 20) p.push("hotes : liste de 20 noms de domaine au plus");
    else for (const h of o.hotes) if (typeof h !== "string" || !RE_HOTE.test(h)) p.push(`hôte invalide : ${court(h)}`);
    if (Array.isArray(o.hotes) && o.hotes.length && d && d.monde_ouvert === false) p.push("un outil qui contacte un site est « monde ouvert »");
  }
  return p;
}

/** Contrôle tout un catalogue : { ok, problemes: [{ nom, raison }] }. */
export function controlerCatalogue(catalogue, valides = null) {
  const problemes = [], vus = new Set();
  for (const o of catalogue) {
    if (o && vus.has(o.nom)) problemes.push({ nom: o.nom, raison: "nom en double" }); else if (o) vus.add(o.nom);
    for (const raison of controlerOutil(o, valides)) problemes.push({ nom: o && o.nom, raison });
  }
  return { ok: problemes.length === 0, problemes };
}

/** Sortie d'un outil contre son `sortie_schema` (si déclaré). Renvoie null si conforme, sinon la raison. */
export function validerSortie(sortie, schema) {
  if (!schema) return null;
  if (!sortie || typeof sortie !== "object" || Array.isArray(sortie)) return "résultat : un objet est attendu";
  const e = verifierObjet(sortie, schema, "", 0);
  return e ? "résultat non conforme : " + e : null;
}

/** Hôtes contactés par les outils du catalogue (pour préparer la liste `connect-src` de la future CSP). Tri et doublons retirés. */
export function hotesDuCatalogue(catalogue) {
  const s = new Set();
  for (const o of catalogue) for (const h of o.hotes || []) if (RE_HOTE.test(h)) s.add(h);
  return [...s].sort();
}

/** Fiche lisible d'un outil (laboratoire, palette « Outils du Noyau »). */
export function fiche(o) {
  const d = o.drapeaux || {};
  return {
    nom: o.nom, niveau: o.niveau, categorie: o.categorie || null, description: String(o.description || "").slice(0, 160),
    lecture_seule: d.lecture_seule == null ? null : d.lecture_seule, reversible: d.reversible == null ? null : d.reversible,
    monde_ouvert: d.monde_ouvert == null ? null : d.monde_ouvert, hotes: (o.hotes || []).slice(), limites: o.limites || null,
    parametres: Object.keys((o.params && o.params.properties) || {})
  };
}
