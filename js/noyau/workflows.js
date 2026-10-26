// Noyau · workflows : une suite d'étapes NOMMÉE et REJOUABLE (orchestrateur, lot 8).
// Un workflow est un plan (execution.js) écrit une fois, avec des paramètres « @nom » qu'on remplit à chaque lancement (« compare @ville_a et @ville_b »).
//  - Les étapes sont des outils DÉJÀ validés du catalogue ; rien de nouveau n'est permis. 6 étapes au plus, 20 workflows au plus.
//  - AUCUN droit de plus : chaque étape passe par la barrière avec son niveau. Une étape CONFIRMATION redemande l'accord de Lucien À CHAQUE LANCEMENT, étape par étape.
//    Sans fenêtre de validation, rien ne part (comme les routines). L'annulation par signal et le bilan « non exécutées » du moteur de plans s'appliquent.
//  - Pas de secours posé par le workflow, pas d'expression, pas de code : seulement « $N.champ » (résultat d'une étape précédente) et « @nom » (paramètre rempli par Lucien,
//    valeur entière d'un paramètre d'outil). Une valeur de paramètre qui commence par « $ » ou « @ » est refusée.
//  - Lancé par Lucien (palette, Refonte) ou par le code du hub ; le Noyau (le modèle) n'a ni outil pour en écrire, ni outil pour en lancer.
import { EXCLUS } from "./raccourcis.js";
import { OUTILS_VALIDES } from "./outils.js";
import { RE_REF, verifierPlan, executerPlan, MAX_ETAPES } from "./execution.js";

export const PREFIXE = "noyau-workflow-";
export const MAX_WORKFLOWS = 20;
export const MAX_PARAMETRES = 5;
const RE_ID = /^[a-z0-9][a-z0-9-]{1,39}$/, RE_PARAM = /^[a-z][a-z0-9_]{0,23}$/, RE_ARO = /^@([a-z][a-z0-9_]{0,23})$/;
const CONTROLE = new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]");
export class RefusWorkflow extends Error { constructor(m) { super("Workflow refusé : " + m); this.name = "RefusWorkflow"; } }
const refus = (m) => { throw new RefusWorkflow(m); };
const court = (v, n = 30) => String(v == null ? "" : v).slice(0, n);
const propre = (v, max, nom) => { const t = String(v == null ? "" : v).trim(); if (!t || t.length > max || CONTROLE.test(t) || /[<>]/.test(t)) refus(`${nom} : 1 à ${max} signes, sans balise`); return t; };

function verifierValeur(v, parametres, prof, utilises) {
  if (prof > 4) refus("paramètres trop imbriqués");
  if (typeof v === "string") {
    if (v.startsWith("$")) { if (!RE_REF.test(v)) refus(`référence « ${court(v, 20)} » mal écrite (forme permise : $1.jeu)`); return v; }
    if (v.startsWith("@")) { const m = RE_ARO.exec(v); if (!m || !parametres.some((p) => p.id === m[1])) refus(`paramètre « ${court(v, 20)} » non déclaré`); utilises.add(m[1]); return v; }
    if (v.length > 300 || CONTROLE.test(v)) refus("texte trop long ou avec caractères de contrôle");
    return v;
  }
  if (typeof v === "number") { if (!Number.isFinite(v)) refus("nombre fini attendu"); return v; }
  if (typeof v === "boolean" || v === null) return v;
  if (Array.isArray(v)) { if (v.length > 12) refus("liste trop longue"); return v.map((x) => verifierValeur(x, parametres, prof + 1, utilises)); }
  if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) { if (!/^[a-z_][a-z0-9_]{0,31}$/.test(k)) refus(`nom de paramètre d'outil invalide « ${court(k)} »`); o[k] = verifierValeur(x, parametres, prof + 1, utilises); } return o; }
  return refus("valeur non permise");
}

/** Vérifie un workflow et rend sa copie propre. `catalogue` = barrière ou { outil(nom) } (facultatif : sinon seule la liste des outils validés compte). */
export function verifierWorkflow(w, { catalogue = null, valides = OUTILS_VALIDES } = {}) {
  if (!w || typeof w !== "object" || Array.isArray(w)) refus("un objet est attendu");
  for (const k of Object.keys(w)) if (!["id", "nom", "parametres", "etapes", "pourquoi"].includes(k)) refus(`champ inconnu « ${court(k)} »`);
  if (!RE_ID.test(String(w.id))) refus("identifiant : minuscules, chiffres et tirets (2 à 40 signes)");
  const nom = propre(w.nom, 60, "nom");
  const ps = w.parametres == null ? [] : w.parametres;
  if (!Array.isArray(ps) || ps.length > MAX_PARAMETRES) refus(`${MAX_PARAMETRES} paramètres au plus`);
  const parametres = ps.map((p) => {
    if (!p || typeof p !== "object") refus("paramètre mal formé");
    for (const k of Object.keys(p)) if (!["id", "libelle", "type", "choix", "exemple"].includes(k)) refus(`paramètre : champ inconnu « ${court(k)} »`);
    if (!RE_PARAM.test(String(p.id))) refus("paramètre : identifiant en minuscules, chiffres et _");
    const type = p.type || "texte"; if (!["texte", "nombre", "choix"].includes(type)) refus("paramètre : type texte, nombre ou choix");
    const r = { id: p.id, libelle: propre(p.libelle || p.id, 60, "libellé de paramètre"), type };
    if (type === "choix") { if (!Array.isArray(p.choix) || p.choix.length < 2 || p.choix.length > 10) refus("paramètre « choix » : de 2 à 10 valeurs"); r.choix = p.choix.map((c) => propre(c, 40, "choix")); }
    if (p.exemple != null) r.exemple = propre(p.exemple, 80, "exemple");
    return r;
  });
  if (new Set(parametres.map((p) => p.id)).size !== parametres.length) refus("un paramètre est déclaré deux fois");
  if (!Array.isArray(w.etapes) || w.etapes.length < 1 || w.etapes.length > MAX_ETAPES) refus(`de 1 à ${MAX_ETAPES} étapes`);
  const utilises = new Set();
  const etapes = w.etapes.map((e, i) => {
    if (!e || typeof e !== "object" || typeof e.nom !== "string") refus(`étape ${i + 1} : un outil est attendu`);
    for (const k of Object.keys(e)) if (!["nom", "params"].includes(k)) refus(`étape ${i + 1} : champ « ${court(k)} » non permis (pas d'étape de secours dans un workflow)`);
    if (!Object.prototype.hasOwnProperty.call(valides, e.nom)) refus(`étape ${i + 1} : « ${court(e.nom)} » n'est pas un outil validé par Lucien`);
    if (EXCLUS.has(e.nom)) refus(`étape ${i + 1} : « ${e.nom} » ne peut pas entrer dans un workflow`);
    if (catalogue && catalogue.outil && !catalogue.outil(e.nom)) refus(`étape ${i + 1} : « ${e.nom} » est absent du catalogue actif`);
    if (e.params != null && (typeof e.params !== "object" || Array.isArray(e.params))) refus(`étape ${i + 1} : les paramètres sont un objet`);
    return { nom: e.nom, params: verifierValeur(e.params || {}, parametres, 0, utilises) };
  });
  for (const p of parametres) if (!utilises.has(p.id)) refus(`paramètre « ${p.id} » déclaré mais jamais utilisé`);
  const plan = verifierPlan(etapes); if (!plan.ok) refus(plan.problemes[0]);
  const r = { id: w.id, nom, parametres, etapes };
  if (w.pourquoi != null) r.pourquoi = propre(w.pourquoi, 200, "pourquoi");
  return r;
}

/** Remplit les « @nom » avec les valeurs de Lucien. Chaque paramètre est obligatoire ; le type est contrôlé ; une valeur ne peut pas commencer par « $ » ou « @ ». */
export function instancier(w, valeurs = {}) {
  const v = verifierWorkflow(w, { catalogue: null }), bonnes = {};
  for (const k of Object.keys(valeurs)) if (!v.parametres.some((p) => p.id === k)) refus(`valeur donnée pour un paramètre inconnu « ${court(k)} »`);
  for (const p of v.parametres) {
    let x = valeurs[p.id];
    if (x == null || x === "") refus(`il manque la valeur de « ${p.libelle} »`);
    if (p.type === "nombre") { x = typeof x === "string" && x.trim() !== "" ? Number(x) : x; if (typeof x !== "number" || !Number.isFinite(x)) refus(`« ${p.libelle} » : un nombre est attendu`); }
    else { x = String(x).trim(); if (!x || x.length > 200 || CONTROLE.test(x)) refus(`« ${p.libelle} » : texte de 1 à 200 signes`); if (/^[$@]/.test(x)) refus(`« ${p.libelle} » ne peut pas commencer par $ ou @`); if (p.type === "choix" && !p.choix.includes(x)) refus(`« ${p.libelle} » : choix permis ${p.choix.join(", ")}`); }
    bonnes[p.id] = x;
  }
  const remplacer = (x) => { if (typeof x === "string") { const m = RE_ARO.exec(x); return m ? bonnes[m[1]] : x; } if (Array.isArray(x)) return x.map(remplacer); if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, remplacer(y)])); return x; };
  return v.etapes.map((e) => ({ nom: e.nom, params: remplacer(e.params) }));
}

/** Budget annoncé avant lancement : étapes, accords demandés à Lucien, appels réseau, requêtes au modèle (aucune : le workflow n'appelle pas l'IA). */
export function budget(appels, barriere) {
  let confirmations = 0, reseau = 0;
  const etapes = appels.map((a, i) => {
    const o = barriere.outil ? barriere.outil(a.nom) : null, niveau = (o && o.niveau) || "?";
    if (niveau === "CONFIRMATION") confirmations++;
    let hotes = []; try { hotes = o && typeof o.hote_de === "function" ? o.hote_de(a.params) : (o && o.hotes) || []; } catch (e) { hotes = (o && o.hotes) || []; }
    if (hotes.length) reseau++;
    return { n: i + 1, outil: a.nom, niveau, reseau: hotes.length > 0 };
  });
  return { etapes: appels.length, confirmations, appels_reseau: reseau, requetes_modele: 0, detail: etapes };
}

/**
 * Lance un workflow pour Lucien. `annoncer({ nom, etapes, budget })` est sa fenêtre de validation : sans elle, ou si elle ne répond pas vrai, RIEN ne part.
 * Les étapes passent ensuite par la barrière avec leur niveau d'origine (une CONFIRMATION redemande son accord). Renvoie { lance, lignes?, bilan?, budget, raison? }.
 */
export async function rejouer(w, valeurs, { barriere, annoncer = null, signal = null, origine = "lucien", apres = null, noter = null } = {}) {
  const v = verifierWorkflow(w, { catalogue: barriere });
  const appels = instancier(v, valeurs), plan = verifierPlan(appels);
  if (!plan.ok) refus(plan.problemes[0]);
  const b = budget(appels, barriere);
  if (typeof annoncer !== "function") return { lance: false, raison: "aucune fenêtre de validation : rien ne s'exécute", budget: b };
  const ok = await annoncer({ nom: v.nom, etapes: b.detail.map((d, i) => ({ ...d, params: appels[i].params })), budget: b });
  if (ok !== true) return { lance: false, raison: "refusé par Lucien", budget: b };
  const lignes = await executerPlan(appels, { barriere, origine, signal, ...(apres ? { apres } : {}) });
  if (noter) { try { await noter(v, lignes); } catch (e) { /* le suivi ne doit jamais casser le workflow */ } }
  return { lance: true, lignes, bilan: lignes.bilan, budget: b, id_plan: lignes.id };
}

/** Accès aux workflows enregistrés (lecture) et statistiques de lancement. Les écritures de définition sont des gestes de Lucien (gestes-lucien.js). */
export function creerWorkflows({ stockage, maintenant = () => new Date() }) {
  const docs = async () => (await stockage.tout("kv")).filter((d) => d && typeof d.id === "string" && d.id.startsWith(PREFIXE) && d.workflow_id === d.id.slice(PREFIXE.length) && Array.isArray(d.etapes));
  return {
    async lister() { return (await docs()).map((d) => ({ id: d.workflow_id, nom: d.nom, etapes: d.etapes.length, parametres: d.parametres.map((p) => p.id), lancements: d.lancements || 0, dernier_lancement: d.dernier_lancement || null })); },
    async lire(id) { const d = (await docs()).find((x) => x.workflow_id === id); if (!d) throw new Error(`Workflow inconnu : « ${court(id, 40)} »`); return verifierWorkflow({ id: d.workflow_id, nom: d.nom, parametres: d.parametres, etapes: d.etapes }); },
    /** Compte un lancement (réécrit le document de stockage du workflow, rien d'autre). */
    async noterLancement(id) { const d = await stockage.lire("kv", PREFIXE + id); if (!d) return; await stockage.ecrire("kv", { ...d, lancements: (d.lancements || 0) + 1, dernier_lancement: maintenant().toISOString().slice(0, 10) }); }
  };
}
