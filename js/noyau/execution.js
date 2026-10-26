// Noyau · plans de 6 étapes (orchestrateur, lots 3 et 4).
// Avant : 3 tours de modèle, 4 outils au plus par tour. Maintenant : le modèle peut demander jusqu'à 6 étapes dans UN SEUL tour, par exemple
//   1 lire_serie · 2 lire_serie · 3 transformer_donnees (comparer $1.jeu et $2.jeu) · 4 afficher_module ($3.jeu)
// Une étape peut utiliser le résultat d'une étape PRÉCÉDENTE en écrivant « $N.champ » (valeur entière d'un paramètre, jamais une expression) :
// ainsi le modèle passe des références (« $1.jeu »), jamais des chiffres. Chaque étape passe par la barrière exactement comme avant :
// mêmes niveaux, mêmes confirmations de Lucien, même journal. Le plan n'est pas un outil et ne donne aucun droit nouveau.
import { journalActions } from "./journal.js";
import { hote } from "./hote.js";
import { dependances, verifierPlan } from "./modules/plan-graphe.js";
export { dependances, verifierPlan };

export const MAX_ETAPES = 6;
export const RE_REF = /^\$([1-9])\.([a-z_][a-z0-9_]{0,30})$/;

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

const idPlan = () => "plan-" + (hote.pret && hote.nouvelId ? String(hote.nouvelId("")).replace(/[^a-z0-9]/gi, "").slice(-8) : Math.random().toString(36).slice(2, 10));
const SANS_REPRISE = new Set(["annule"]);

/**
 * Exécute les étapes dans l'ordre par la barrière. Chaque étape est jugée et journalisée séparément (un refus de Lucien ou un outil bloqué
 * n'empêche pas de juger les autres étapes), et chaque ligne du journal porte l'identifiant du plan. Une étape qui s'appuie sur « $N.champ » d'une étape
 * qui a échoué ou été refusée n'est PAS exécutée : erreur claire, journalisée elle aussi.
 * Lot 4 : `signal` annule le reste du plan ; une étape peut prévoir `secours: { nom, params }` (plans écrits par le code, jamais par le modèle),
 * exécuté par la barrière aux mêmes conditions si l'étape échoue (hors annulation et refus).
 * Renvoie [{ n, nom, params, ok, donnees, erreur, refus, saute, annule, depend_de, essais, cause, secours }] ; le tableau porte .id et .bilan.
 */
export async function executerPlan(appels, { barriere, origine = "modele", max = MAX_ETAPES, apres = null, signal = null, id = null } = {}) {
  const lignes = [], plan = id || idPlan(), t0 = Date.now();
  const noter = async (a, texte, extra = {}) => {      // étape qui ne part pas : elle est quand même journalisée, séparément
    try { const o = barriere.outil ? barriere.outil(a.nom) : null; await journalActions.ecrire({ outil: a.nom || "(sans nom)", niveau: (o && o.niveau) || "—", params: texte.slice(0, 300), statut: "ERREUR", origine, erreur: texte.slice(0, 200), sortie: [], plan, ...extra }); } catch (e) { /* journal indisponible */ }
  };
  const nbMax = Math.min(appels.length, max);
  for (let i = 0; i < appels.length; i++) {
    const a = appels[i], n = i + 1, dep = dependances(a.params || {});
    if (i >= max) { lignes.push({ n, nom: a.nom, params: a.params, ok: false, saute: true, depend_de: dep, erreur: `Plan limité à ${max} étapes : étape ${n} ignorée.` }); continue; }
    if (signal && signal.aborted) { const erreur = "Plan annulé : étape non exécutée."; lignes.push({ n, nom: a.nom, params: a.params, ok: false, annule: true, depend_de: dep, erreur }); await noter(a, `étape ${n} : ${erreur}`, { cause: "annule" }); continue; }
    let params;
    try { params = resoudreRefs(a.params || {}, n, lignes); }
    catch (e) { const erreur = "Référence refusée : " + e.message; lignes.push({ n, nom: a.nom, params: a.params, ok: false, depend_de: dep, erreur, cause: "dependance" }); await noter(a, `étape ${n} non exécutée : ${e.message}`, { cause: "dependance" }); continue; }
    let res = await barriere.executer({ outil: a.nom, params }, { origine, plan, signal });
    let l = { n, nom: a.nom, params, ok: !!res.ok, donnees: res.donnees, erreur: res.erreur || null, refus: res.refus ? res.refus.raison : null, depend_de: dep, essais: res.essais || 1, cause: res.cause || null };
    if (!l.ok && !l.refus && a.secours && a.secours.nom && !SANS_REPRISE.has(l.cause) && !(signal && signal.aborted)) {
      let ps; try { ps = resoudreRefs(a.secours.params || {}, n, lignes); } catch (e) { ps = null; }
      if (ps) {
        const r2 = await barriere.executer({ outil: a.secours.nom, params: ps }, { origine, plan, signal });
        l = { ...l, secours: a.secours.nom, echec_initial: l.erreur, ok: !!r2.ok, donnees: r2.donnees, erreur: r2.erreur || null, refus: r2.refus ? r2.refus.raison : null, params: ps, essais: (l.essais || 1) + (r2.essais || 1), cause: r2.cause || null };
      }
    }
    lignes.push(l);
    if (apres) { try { apres(l, i); } catch (e) { /* le suivi ne doit jamais casser le plan */ } }
  }
  const faites = lignes.filter((l) => l.ok).length, ratees = lignes.filter((l, k) => !l.ok && !l.saute && k < nbMax);
  const bilan = {
    etapes: nbMax, reussies: faites, refusees: ratees.filter((l) => l.refus).length,
    non_executees: ratees.filter((l) => l.cause === "dependance" || l.annule).length,
    en_echec: ratees.filter((l) => !l.refus && l.cause !== "dependance" && !l.annule).length,
    reprises: lignes.filter((l) => (l.essais || 1) > 1).length, ms: Date.now() - t0
  };
  lignes.id = plan; lignes.bilan = bilan;
  if (appels.length >= 2) {
    const mots = [`${faites} réussie(s)`, bilan.en_echec && `${bilan.en_echec} en échec`, bilan.refusees && `${bilan.refusees} refusée(s)`, bilan.non_executees && `${bilan.non_executees} non exécutée(s)`, bilan.reprises && `${bilan.reprises} reprise(s)`].filter(Boolean).join(", ");
    try { await journalActions.ecrire({ outil: "(plan)", niveau: "—", params: `plan de ${nbMax} étape(s) : ${appels.slice(0, max).map((a) => a.nom).join(" → ")} · ${mots}`.slice(0, 300), statut: faites === nbMax ? "EXÉCUTÉ" : "ERREUR", origine, sortie: [], plan, ...bilan }); } catch (e) { /* journal indisponible */ }
  }
  return lignes;
}
