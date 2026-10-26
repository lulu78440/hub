// Noyau · jeu de panneaux à plage de temps et variables partagées (orchestrateur, lot 4). Idée empruntée à Grafana :
// UNE plage de temps et quelques variables commandent plusieurs panneaux à la fois. Pure logique, sans DOM (l'affichage est dans modules/vues-orch.js).
// Règles :
//  - un panneau montre un jeu par RÉFÉRENCE (« jeu:… ») : aucun chiffre dans la spécification, que des références et des choix ;
//  - les variables sont de 3 genres en liste blanche (colonne, lissage, echelle) : pas de modèle de texte, pas d'expression ;
//  - tout est calculé par transformer.js (les calculs du hub), la source et la date des données restent attachées ;
//  - un panneau qui ne peut pas suivre la plage ou une variable le DIT (message dans le panneau), il n'affiche jamais un autre jeu à la place.
import { transformer, bornes, RefusTransformation } from "./transformer.js";
import { TYPES_VUE, verifierJeu } from "./modules/composants.js";

export const MAX_PANNEAUX = 8;
export const MAX_VARIABLES = 3;
export const MAX_OPTIONS = 12;
export const GENRES_VARIABLE = Object.freeze(["colonne", "lissage", "echelle"]);
const RE_ID = /^[a-z][a-z0-9_]{0,23}$/;
const RE_REF = /^jeu:[a-z0-9]{6,16}$/;
const ECHELLES = { brut: "Valeurs d'origine", indice100: "Indice base 100", variation: "Variation en %" };
const LISSAGES = { "1": "Aucun", "3": "Moyenne sur 3", "6": "Moyenne sur 6", "12": "Moyenne sur 12" };

export class RefusPanneaux extends Error { constructor(m) { super("Tableau de panneaux refusé : " + m); this.name = "RefusPanneaux"; } }
const refus = (m) => { throw new RefusPanneaux(m); };
const CONTROLE = new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]");
const txt = (v, max, nom) => { if (typeof v !== "string" || !v.trim()) refus(nom + " manquant"); if (v.trim().length > max) refus(`${nom} trop long (${max} signes au plus)`); if (CONTROLE.test(v)) refus(nom + " contient des caractères de contrôle"); return v.trim(); };

/** Vérifie la spécification et la rend telle qu'elle sera utilisée (copie propre). `lire(ref)` renvoie le jeu ou lève une erreur. */
export function verifierTableau(spec, lire) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) refus("une spécification (objet) est attendue");
  for (const k of Object.keys(spec)) if (!["titre", "plage", "variables", "panneaux"].includes(k)) refus(`champ inconnu « ${String(k).slice(0, 30)} »`);
  const titre = txt(spec.titre, 80, "titre");
  if (!Array.isArray(spec.panneaux) || !spec.panneaux.length) refus("au moins un panneau");
  if (spec.panneaux.length > MAX_PANNEAUX) refus(`${MAX_PANNEAUX} panneaux au plus`);
  const vars = spec.variables == null ? [] : spec.variables;
  if (!Array.isArray(vars) || vars.length > MAX_VARIABLES) refus(`${MAX_VARIABLES} variables au plus`);
  const ids = new Set(), variables = vars.map((v) => {
    if (!v || typeof v !== "object") refus("variable mal formée");
    for (const k of Object.keys(v)) if (!["id", "genre", "libelle", "options", "defaut"].includes(k)) refus(`variable : champ inconnu « ${String(k).slice(0, 30)} »`);
    if (typeof v.id !== "string" || !RE_ID.test(v.id)) refus("variable : identifiant invalide (lettres minuscules, chiffres, _)");
    if (ids.has(v.id)) refus(`variable « ${v.id} » en double`); ids.add(v.id);
    if (!GENRES_VARIABLE.includes(v.genre)) refus(`variable « ${v.id} » : genre inconnu (permis : ${GENRES_VARIABLE.join(", ")})`);
    const libelle = txt(v.libelle || v.id, 40, "libellé de variable");
    let options;
    if (v.genre === "colonne") {
      if (!Array.isArray(v.options) || !v.options.length || v.options.length > MAX_OPTIONS) refus(`variable « ${v.id} » : 1 à ${MAX_OPTIONS} colonnes proposées`);
      options = v.options.map((o) => ({ valeur: txt(typeof o === "string" ? o : o && o.valeur, 32, "colonne"), libelle: txt(typeof o === "string" ? o : (o && (o.libelle || o.valeur)), 40, "libellé de colonne") }));
    } else if (v.genre === "lissage") options = Object.entries(LISSAGES).map(([valeur, libelle]) => ({ valeur, libelle }));
    else options = Object.entries(ECHELLES).map(([valeur, libelle]) => ({ valeur, libelle }));
    if (new Set(options.map((o) => o.valeur)).size !== options.length) refus(`variable « ${v.id} » : choix en double`);
    const defaut = v.defaut == null ? options[0].valeur : String(v.defaut);
    if (!options.some((o) => o.valeur === defaut)) refus(`variable « ${v.id} » : valeur par défaut hors des choix`);
    return { id: v.id, genre: v.genre, libelle, options, defaut };
  });
  if (new Set(variables.map((v) => v.genre)).size !== variables.length) refus("une seule variable par genre");
  const pids = new Set(), panneaux = spec.panneaux.map((p) => {
    if (!p || typeof p !== "object") refus("panneau mal formé");
    for (const k of Object.keys(p)) if (!["id", "titre", "jeu", "vue", "options", "plage"].includes(k)) refus(`panneau : champ inconnu « ${String(k).slice(0, 30)} »`);
    if (typeof p.id !== "string" || !RE_ID.test(p.id)) refus("panneau : identifiant invalide");
    if (pids.has(p.id)) refus(`panneau « ${p.id} » en double`); pids.add(p.id);
    if (typeof p.jeu !== "string" || !RE_REF.test(p.jeu)) refus(`panneau « ${p.id} » : le jeu doit être une référence « jeu:… » (jamais des valeurs)`);
    if (!TYPES_VUE.includes(p.vue)) refus(`panneau « ${p.id} » : vue inconnue (permises : ${TYPES_VUE.join(", ")})`);
    try { lire(p.jeu); } catch (e) { refus(`panneau « ${p.id} » : ${e.message}`); }
    const o = p.options == null ? {} : p.options;
    if (!o || typeof o !== "object" || Array.isArray(o) || JSON.stringify(o).length > 600) refus(`panneau « ${p.id} » : options trop grosses ou mal formées`);
    if (p.plage != null && typeof p.plage !== "boolean") refus(`panneau « ${p.id} » : « plage » vaut vrai ou faux`);
    return { id: p.id, titre: txt(p.titre || p.id, 80, "titre de panneau"), jeu: p.jeu, vue: p.vue, options: JSON.parse(JSON.stringify(o)), plage: p.plage !== false };
  });
  let plage = { debut: "", fin: "" };
  if (spec.plage != null) plage = verifierPlage(spec.plage);
  return { titre, plage, variables, panneaux };
}

/** Plage de temps : { debut, fin } en AAAA, AAAA-MM ou AAAA-MM-JJ, l'un ou l'autre pouvant manquer. */
export function verifierPlage(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) refus("plage : { debut, fin } attendu");
  const o = { debut: p.debut == null ? "" : String(p.debut), fin: p.fin == null ? "" : String(p.fin) };
  for (const k of ["debut", "fin"]) if (o[k]) { try { bornes(o[k]); } catch (e) { refus(`plage : ${k} « ${o[k].slice(0, 12)} » n'est pas une date (AAAA, AAAA-MM ou AAAA-MM-JJ)`); } }
  if (o.debut && o.fin && bornes(o.debut)[0] >= bornes(o.fin)[1]) refus("plage : le début est après la fin");
  return o;
}

/** État partagé : plage + valeur de chaque variable. Les abonnés (l'affichage) sont prévenus à chaque changement valide. */
export function creerEtat(spec) {
  const etat = { plage: { ...spec.plage }, valeurs: Object.fromEntries(spec.variables.map((v) => [v.id, v.defaut])) };
  const abonnes = new Set(), signaler = () => abonnes.forEach((f) => { try { f(lire()); } catch (e) { console.error(e); } });
  const lire = () => ({ plage: { ...etat.plage }, valeurs: { ...etat.valeurs } });
  return {
    lire,
    definirPlage(p) { etat.plage = verifierPlage(p); signaler(); return lire(); },
    definirVariable(id, valeur) {
      const v = spec.variables.find((x) => x.id === id); if (!v) refus(`variable inconnue « ${String(id).slice(0, 24)} »`);
      if (!v.options.some((o) => o.valeur === String(valeur))) refus(`variable « ${id} » : choix inconnu « ${String(valeur).slice(0, 24)} »`);
      etat.valeurs[id] = String(valeur); signaler(); return lire();
    },
    reinitialiser() { etat.plage = { ...spec.plage }; spec.variables.forEach((v) => { etat.valeurs[v.id] = v.defaut; }); signaler(); return lire(); },
    abonner(f) { abonnes.add(f); return () => abonnes.delete(f); }
  };
}

/** Plages proposées, comptées à partir de la DERNIÈRE observation des panneaux (pas d'aujourd'hui : une donnée qui s'arrête en 2023 reste visible). */
export function plagesProposees(jeux) {
  let max = null;
  for (const j of jeux) {
    const d = j.colonnes.findIndex((c) => c.type === "date"); if (d < 0) continue;
    for (const l of j.lignes) if (l[d] != null) { try { const t = bornes(l[d])[0]; if (max == null || t > max) max = t; } catch (e) { /* date illisible : ignorée */ } }
  }
  const out = [{ id: "tout", libelle: "Toute la période", debut: "", fin: "" }];
  if (max == null) return out;
  const fin = new Date(max), an = fin.getUTCFullYear(), mo = fin.getUTCMonth() + 1;
  const iso = (a, m) => `${a}-${String(m).padStart(2, "0")}`;
  for (const n of [10, 5, 1]) out.push({ id: `${n}a`, libelle: n === 1 ? "Dernier an" : `${n} derniers ans`, debut: iso(an - n, mo), fin: iso(an, mo) });
  return out;
}

/**
 * Jeu à afficher pour un panneau, selon l'état partagé. Rend { jeu } ou { erreur } (le panneau l'écrit à la place du graphique).
 * Ordre fixe : plage → colonne → échelle → lissage. Chaque étape est un calcul du hub (transformer.js).
 */
export function deriver(panneau, spec, etat, lire) {
  let jeu;
  try { jeu = lire(panneau.jeu); } catch (e) { return { erreur: e.message }; }
  const etapes = [];
  try {
    if (panneau.plage && (etat.plage.debut || etat.plage.fin)) { jeu = verifierJeu(transformer(jeu, { operation: "periode", ...(etat.plage.debut ? { debut: etat.plage.debut } : {}), ...(etat.plage.fin ? { fin: etat.plage.fin } : {}) })); etapes.push("plage"); }
    const col = spec.variables.find((v) => v.genre === "colonne");
    if (col) { jeu = verifierJeu(transformer(jeu, { operation: "colonnes", colonnes: [etat.valeurs[col.id]] })); etapes.push("colonne"); }
    const ech = spec.variables.find((v) => v.genre === "echelle");
    if (ech && etat.valeurs[ech.id] !== "brut") { jeu = verifierJeu(transformer(jeu, { operation: etat.valeurs[ech.id] === "variation" ? "variation" : "indice100", ...(etat.valeurs[ech.id] === "variation" ? { mode: "precedente" } : {}) })); etapes.push("echelle"); }
    const lis = spec.variables.find((v) => v.genre === "lissage");
    if (lis && etat.valeurs[lis.id] !== "1") { jeu = verifierJeu(transformer(jeu, { operation: "moyenne_mobile", n: +etat.valeurs[lis.id] })); etapes.push("lissage"); }
  } catch (e) {
    if (e instanceof RefusTransformation) return { erreur: `Ce panneau ne peut pas suivre ce réglage : ${e.message}` };
    if (e && e.name === "RefusComposant") return { erreur: `Ce panneau ne peut pas suivre ce réglage : ${e.message}` };
    return { erreur: "Ce panneau ne peut pas être calculé (erreur interne)." };
  }
  if (!jeu.lignes.length) return { erreur: "Aucune donnée dans la plage choisie pour ce panneau." };
  return { jeu, etapes };
}
