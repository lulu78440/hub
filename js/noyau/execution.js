// Noyau · plans de 6 étapes (orchestrateur, lot 3).
// Avant : 3 tours de modèle, 4 outils au plus par tour. Maintenant : le modèle peut demander jusqu'à 6 étapes dans UN SEUL tour, par exemple
//   1 lire_serie · 2 lire_serie · 3 transformer_donnees (comparer $1.jeu et $2.jeu) · 4 afficher_module ($3.jeu)
// Une étape peut utiliser le résultat d'une étape PRÉCÉDENTE en écrivant « $N.champ » (valeur entière d'un paramètre, jamais une expression) :
// ainsi le modèle passe des références (« $1.jeu »), jamais des chiffres. Chaque étape passe par la barrière exactement comme avant :
// mêmes niveaux, mêmes confirmations de Lucien, même journal. Le plan n'est pas un outil et ne donne aucun droit nouveau.
import { journalActions } from "./journal.js";

export const MAX_ETAPES = 6;
const RE_REF = /^\$([1-9])\.([a-z_][a-z0-9_]{0,30})$/;

/** Remplace, dans les paramètres, chaque texte « $N.champ » par la valeur du champ de l'étape N. Lève une Error claire sinon. */
export function resoudreRefs(params, indice, resultats, profondeur = 0) {
  if (profondeur > 4) throw new Error("paramètres trop imbriqués");
  if (typeof params === "string") {
    if (!params.startsWith("$")) return params;
    const m = RE_REF.exec(params); if (!m) throw new Error(`référence « ${params.slice(0, 20)} » mal écrite (forme permise : $1.jeu)`);
    const n = +m[1];
    if (n >= indice) throw new Error(`référence « ${params} » : l'étape ${n} n'est pas avant l'étape ${indice}`);
    const r = resultats[n - 1];
    if (!r || !r.ok) throw new Error(`référence « ${params} » : l'étape ${n} n'a pas réussi`);
    const v = r.donnees && typeof r.donnees === "object" ? r.donnees[m[2]] : undefined;
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") throw new Error(`référence « ${params} » : l'étape ${n} ne renvoie pas de champ « ${m[2]} »`);
    return v;
  }
  if (Array.isArray(params)) return params.map((x) => resoudreRefs(x, indice, resultats, profondeur + 1));
  if (params && typeof params === "object") { const o = {}; for (const [k, v] of Object.entries(params)) o[k] = resoudreRefs(v, indice, resultats, profondeur + 1); return o; }
  return params;
}

/**
 * Exécute les étapes dans l'ordre par la barrière. Chaque étape est jugée et journalisée séparément, comme avant (un refus de Lucien ou un outil bloqué
 * n'empêche pas de juger les autres étapes). Une étape qui s'appuie sur « $N.champ » d'une étape qui a échoué ou été refusée n'est PAS exécutée : erreur claire.
 * Renvoie [{ nom, params, ok, donnees, erreur, refus, saute }] (une ligne par appel reçu ; saute = au-delà de 6 étapes).
 */
export async function executerPlan(appels, { barriere, origine = "modele", max = MAX_ETAPES, apres = null } = {}) {
  const lignes = [];
  for (let i = 0; i < appels.length; i++) {
    const a = appels[i];
    if (i >= max) { lignes.push({ nom: a.nom, params: a.params, ok: false, saute: true, erreur: `Plan limité à ${max} étapes : étape ${i + 1} ignorée.` }); continue; }
    let params;
    try { params = resoudreRefs(a.params || {}, i + 1, lignes); }
    catch (e) { lignes.push({ nom: a.nom, params: a.params, ok: false, erreur: "Référence refusée : " + e.message }); continue; }
    const res = await barriere.executer({ outil: a.nom, params }, { origine });
    const l = { nom: a.nom, params, ok: !!res.ok, donnees: res.donnees, erreur: res.erreur || null, refus: res.refus ? res.refus.raison : null };
    lignes.push(l);
    if (apres) { try { apres(l, i); } catch (e) { /* le suivi ne doit jamais casser le plan */ } }
  }
  if (appels.length >= 2) {
    const faites = lignes.filter((l) => l.ok).length;
    try { await journalActions.ecrire({ outil: "(plan)", niveau: "—", params: `plan de ${Math.min(appels.length, max)} étape(s) : ${appels.slice(0, max).map((a) => a.nom).join(" → ")} · ${faites} réussie(s)`.slice(0, 300), statut: faites === Math.min(appels.length, max) ? "EXÉCUTÉ" : "ERREUR", origine, sortie: [] }); } catch (e) { /* journal indisponible */ }
  }
  return lignes;
}
