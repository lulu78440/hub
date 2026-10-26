// Noyau · modules enregistrés, versions (orchestrateur, lots 5 et 9). Un module = un document « kv » par module : `noyau-module-<id>`.
//   { id, module_id, courant, versions: [{ n, date, titre, spec, vue, resume, jeux: { j1: copie } | null, provenance }] }
//  - 50 modules au plus, 10 versions au plus par module ; les copies de données ne sont gardées que pour la version COURANTE et la PRÉCÉDENTE
//    (les plus anciennes ne gardent que leur spécification : la synchronisation reste petite) ;
//  - ancien format du lot 3 (document unique `noyau-modules`) : lu sans être modifié, ni supprimé ; un module réenregistré passe au nouveau format ;
//  - CE FICHIER NE CONTIENT AUCUNE SUPPRESSION ni aucun export : ce sont des gestes de Lucien (gestes-lucien.js), que le Noyau n'importe jamais.
import { verifierJeu, TYPES_VUE } from "./composants.js";
import { verifierSpec, figerSpec, appliquerSpec } from "./spec.js";

export const PREFIXE = "noyau-module-";
export const DOC_ANCIEN = "noyau-modules";
export const MAX_MODULES = 50;
export const MAX_VERSIONS = 10;
export const MAX_OCTETS_MODULE = 250000;          // par copie de données
export const RE_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const RE_DOC = /^noyau-module-([a-z0-9][a-z0-9-]{1,39})$/;
const jour = (d) => d.toISOString().slice(0, 10);

/** Copie propre et bornée d'un jeu vérifié (sans l'index de colonne). Refuse au-delà de 250 Ko. */
export function copierJeu(j) {
  const c = JSON.parse(JSON.stringify({ titre: j.titre, unite: j.unite, colonnes: j.colonnes.map((x) => ({ id: x.id, libelle: x.libelle, type: x.type })), lignes: j.lignes, source: j.source, exemple: j.exemple }));
  if (JSON.stringify(c).length > MAX_OCTETS_MODULE) throw new Error(`Module trop volumineux (plus de ${Math.round(MAX_OCTETS_MODULE / 1000)} Ko) : réduis la période avec transformer_donnees.`);
  return c;
}

export function creerStockageModules({ stockage, maintenant = () => new Date(), optionsParDefaut }) {
  const lireDoc = async (id) => { const d = await stockage.lire("kv", PREFIXE + id); return d && d.module_id === id && Array.isArray(d.versions) ? d : null; };
  const ancien = async () => { const d = await stockage.lire("kv", DOC_ANCIEN); return d && Array.isArray(d.lignes) ? d.lignes : []; };
  const tousLesDocs = async () => (await stockage.tout("kv")).filter((d) => d && typeof d.id === "string" && RE_DOC.test(d.id) && d.module_id === RE_DOC.exec(d.id)[1] && Array.isArray(d.versions));

  const courante = (d) => d.versions.find((v) => v.n === d.courant) || d.versions[d.versions.length - 1];
  const resumeNouveau = (d) => {
    const v = courante(d);
    return { id: d.module_id, titre: v.titre, vue: v.vue, source: v.resume.source, periode: v.resume.periode, donnees_du: v.resume.maj, exemple: !!v.resume.exemple, enregistre_le: d.versions[0].date, modifie_le: d.versions.length > 1 || d.versions[0].n > 1 ? v.date : null, version: v.n, versions: d.versions.length };
  };
  const resumeAncien = (m) => ({ id: m.id, titre: m.titre, vue: m.vue, source: m.jeu.source.nom, periode: m.jeu.source.periode, donnees_du: m.jeu.source.maj, exemple: !!m.jeu.exemple, enregistre_le: m.cree_le, modifie_le: m.modifie_le || null, version: 1, versions: 1, ancien_format: true });

  async function lister() {
    const docs = await tousLesDocs(), vus = new Set(docs.map((d) => d.module_id));
    const anc = (await ancien()).filter((m) => m && !vus.has(m.id));
    return [...docs.map(resumeNouveau), ...anc.map(resumeAncien)].sort((a, b) => String(b.modifie_le || b.enregistre_le).localeCompare(String(a.modifie_le || a.enregistre_le)));
  }
  /** Les versions d'un module (sans données) : numéro, date, titre, vue, si les données sont gardées. */
  async function versions(id) {
    const d = await lireDoc(id); if (!d) { if ((await ancien()).some((m) => m.id === id)) return [{ n: 1, date: null, courante: true, donnees_gardees: true, ancien_format: true }]; throw new Error(`Module inconnu : « ${String(id).slice(0, 40)} »`); }
    return d.versions.map((v) => ({ n: v.n, date: v.date, titre: v.titre, vue: v.vue, courante: v.n === d.courant, donnees_gardees: !!v.jeux, source: v.resume.source, periode: v.resume.periode }));
  }
  function construire(m, v) {   // un enregistrement (version) → ce que l'on affiche, re-vérifié : un stockage altéré est refusé, pas affiché
    const copies = {}; for (const [k, c] of Object.entries(v.jeux || {})) copies[k] = verifierJeu(c);
    if (!v.jeux) throw new Error(`Les données de la version ${v.n} ne sont plus gardées (seules les deux dernières le sont).`);
    const r = appliquerSpec(v.spec, (nom) => copies[nom] || (() => { throw new Error(`jeu ${nom} absent du module`); })(), optionsParDefaut);
    return { id: m, titre: v.titre, vue: r.vues[0].type, options: r.vues[0].options, vues: r.vues, jeu: r.jeu, version: v.n, enregistre_le: v.date };
  }
  async function lire(id, { version = null } = {}) {
    const d = await lireDoc(id);
    if (d) { const v = version == null ? courante(d) : d.versions.find((x) => x.n === version); if (!v) throw new Error(`Module « ${id} » : version ${version} inconnue`); return construire(id, v); }
    const m = (await ancien()).find((x) => x.id === id);
    if (!m) throw new Error(`Module inconnu : « ${String(id).slice(0, 40)} »`);
    return { id: m.id, titre: m.titre, vue: m.vue, options: m.options || {}, vues: [{ type: m.vue, options: m.options || {}, titre: m.titre }], jeu: verifierJeu(m.jeu), version: 1, enregistre_le: m.cree_le, ancien_format: true };
  }
  /**
   * Enregistre une NOUVELLE VERSION (ou crée le module). `spec` est vérifiée ; `jeu(ref)` rend le jeu vérifié d'une référence ; `provenance` est facultative (texte public).
   * À n'appeler qu'après l'accord de Lucien (barrière) ou par un geste de Lucien.
   */
  async function enregistrer({ id, spec, jeu, provenance = null }) {
    if (!RE_ID.test(String(id))) throw new Error("Identifiant : minuscules, chiffres et tirets (2 à 40 signes)");
    const f = figerSpec(spec), copies = {}, jeuxVerifies = {};
    for (const [slot, ref] of Object.entries(f.refs)) { const j = jeu(ref); jeuxVerifies[slot] = j.verifie === true && Object.isFrozen(j) ? j : verifierJeu(j); copies[slot] = copierJeu(jeuxVerifies[slot]); }
    const r = appliquerSpec(f.spec, (nom) => jeuxVerifies[nom], optionsParDefaut);        // refus ici si la spécification ne marche pas sur ces données
    if (!r.vues.length) throw new Error("Aucune vue");
    const d0 = await lireDoc(id);
    if (!d0) {
      const ids = new Set([...(await tousLesDocs()).map((d) => d.module_id), ...(await ancien()).map((m) => m && m.id)]);
      if (!ids.has(id) && ids.size >= MAX_MODULES) throw new Error(`${MAX_MODULES} modules au plus : Lucien doit en retirer un lui-même.`);
    }
    let versionsAvant = d0 ? d0.versions.slice() : [];
    if (!d0) { const m = (await ancien()).find((x) => x.id === id); if (m) versionsAvant = [{ n: 1, date: m.modifie_le || m.cree_le, titre: m.titre, vue: m.vue, spec: { v: 1, titre: m.titre, jeux: ["j1"], transformations: [], vues: [{ type: m.vue, ...Object.fromEntries(Object.entries(m.options || {}).filter(([, x]) => typeof x === "string")) }] }, resume: { source: m.jeu.source.nom, periode: m.jeu.source.periode, maj: m.jeu.source.maj, exemple: !!m.jeu.exemple }, jeux: { j1: m.jeu }, provenance: null }]; }
    const n = versionsAvant.length ? Math.max(...versionsAvant.map((v) => v.n)) + 1 : 1;
    const nouvelle = { n, date: jour(maintenant()), titre: f.spec.titre, spec: f.spec, vue: r.vues[0].type, resume: { source: r.jeu.source.nom, periode: r.jeu.source.periode, maj: r.jeu.source.maj, exemple: !!r.jeu.exemple }, jeux: copies, provenance };
    const toutes = [...versionsAvant, nouvelle].slice(-MAX_VERSIONS);
    toutes.forEach((v, i) => { if (i < toutes.length - 2) v.jeux = null; });          // données gardées pour la courante et la précédente seulement
    const doc = { id: PREFIXE + id, module_id: id, courant: n, versions: toutes };
    await stockage.ecrire("kv", doc);
    return { ...resumeNouveau(doc), remplace: versionsAvant.length > 0 };
  }
  return { lister, versions, lire, enregistrer, _interne: { lireDoc, tousLesDocs, ancien } };
}
