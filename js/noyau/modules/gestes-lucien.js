// Noyau · gestes de LUCIEN sur ses modules, espaces et workflows (orchestrateur, lots 5, 8 et 9).
// ⚠ Ce fichier n'est importé NI par outils.js NI par la barrière : aucun outil du Noyau ne mène ici. Ce sont les actions d'un bouton cliqué par Lucien
//   (liste « Modules » de la Refonte) : restaurer une version, retirer (avec sauvegarde avant), exporter, importer, actualiser, gérer les espaces et les workflows.
//   Le hub (Refonte) construit ces gestes avec `hote.ui.orchestrateur.gestes()` ; un essai vérifie que le Noyau ne peut pas les atteindre.
import { verifierJeu } from "./composants.js";
import { verifierSpec } from "./spec.js";
import { PREFIXE as P_MODULE, DOC_ANCIEN, RE_ID, copierJeu } from "./stockage.js";
import { PREFIXE as P_ESPACE, MAX_ESPACES, verifierEspace } from "../espaces.js";
import { PREFIXE as P_WORKFLOW, MAX_WORKFLOWS, verifierWorkflow } from "../workflows.js";
import { transformer } from "../transformer.js";

const P_CORBEILLE = "noyau-corbeille-";
const jour = (d) => d.toISOString().slice(0, 10);

export function creerGestesLucien({ stockage, modules, donnees = null, jeux = null, maintenant = () => new Date(), catalogue = null }) {
  const st = modules._stockage, interne = st._interne;
  const retirer = async (id) => { if (typeof stockage.retirerMany !== "function") throw new Error("Ce stockage ne sait pas retirer un document."); await stockage.retirerMany("kv", [id]); };
  const jeuDeSlot = (v) => (nom) => { const c = v.jeux && v.jeux[nom]; if (!c) throw new Error(`Les données de la version ${v.n} ne sont plus gardées (seules les deux dernières le sont).`); return verifierJeu(c); };

  return {
    // ----------------------------------------------------------------- modules
    /** Redonne à un module le contenu d'une de ses versions : c'est une NOUVELLE version (rien n'est perdu). */
    async restaurerVersion(id, n) {
      const d = await interne.lireDoc(id); if (!d) throw new Error(`Module inconnu : « ${String(id).slice(0, 40)} »`);
      const v = d.versions.find((x) => x.n === n); if (!v) throw new Error(`Version ${n} inconnue`);
      return modules.enregistrerSpec({ id, spec: v.spec, jeu: jeuDeSlot(v), provenance: v.provenance || null });
    },
    /** Retire un module. Sauvegarde AVANT : le document complet est copié dans `noyau-corbeille-<id>`. */
    async retirerModule(id) {
      const d = await interne.lireDoc(id), anc = d ? null : (await interne.ancien()).find((m) => m.id === id);
      if (!d && !anc) throw new Error(`Module inconnu : « ${String(id).slice(0, 40)} »`);
      await stockage.ecrire("kv", { id: P_CORBEILLE + id, module_id: id, retire_le: jour(maintenant()), doc: d || { ancien_format: true, ligne: anc } });
      if (d) await retirer(P_MODULE + id);
      else { const doc = await stockage.lire("kv", DOC_ANCIEN); await stockage.ecrire("kv", { ...doc, lignes: doc.lignes.filter((m) => m.id !== id) }); }
      return { id, sauvegarde: P_CORBEILLE + id };
    },
    async restaurerCorbeille(id) {
      const c = await stockage.lire("kv", P_CORBEILLE + id); if (!c || !c.doc) throw new Error(`Rien à restaurer pour « ${String(id).slice(0, 40)} »`);
      if (c.doc.ancien_format) { const doc = (await stockage.lire("kv", DOC_ANCIEN)) || { id: DOC_ANCIEN, lignes: [] }; if (!doc.lignes.some((m) => m.id === id)) doc.lignes.push(c.doc.ligne); await stockage.ecrire("kv", doc); }
      else await stockage.ecrire("kv", c.doc);
      await modules.lire(id);          // relu et re-vérifié : un document altéré est signalé tout de suite
      return { id };
    },
    /** Le module complet (spécification, versions, copies de données) en objet JSON, pour le bouton « Exporter » de Lucien. */
    async exporterModule(id) {
      const d = await interne.lireDoc(id); if (!d) throw new Error(`Module inconnu ou d'ancien format : « ${String(id).slice(0, 40)} »`);
      return { format: "hub-noyau-module", v: 1, exporte_le: maintenant().toISOString(), module: d };
    },
    /** Importe un module exporté. Tout est re-vérifié ; un module existant n'est remplacé qu'avec `remplacer: true` (et sa version actuelle reste une version). */
    async importerModule(obj, { remplacer = false } = {}) {
      if (!obj || obj.format !== "hub-noyau-module" || obj.v !== 1 || !obj.module) throw new Error("Ce n'est pas un module exporté du Noyau.");
      const m = obj.module; if (!RE_ID.test(String(m.module_id)) || !Array.isArray(m.versions) || !m.versions.length || m.versions.length > 10) throw new Error("Module importé : forme inattendue.");
      const versions = m.versions.map((v) => {
        const spec = verifierSpec(v.spec), jeux2 = v.jeux ? Object.fromEntries(Object.entries(v.jeux).map(([k, c]) => [k, copierJeu(verifierJeu(c))])) : null;
        return { n: Number(v.n), date: String(v.date || "").slice(0, 10), titre: spec.titre, spec, vue: spec.vues[0].type, resume: { source: String(v.resume.source).slice(0, 120), periode: String(v.resume.periode).slice(0, 60), maj: String(v.resume.maj).slice(0, 10), exemple: !!v.resume.exemple }, jeux: jeux2, provenance: v.provenance || null };
      });
      if (versions.some((v) => !Number.isInteger(v.n) || v.n < 1)) throw new Error("Module importé : numéros de version invalides.");
      const existe = await interne.lireDoc(m.module_id);
      if (existe && !remplacer) throw new Error(`Le module « ${m.module_id} » existe déjà : confirme le remplacement.`);
      if (!existe) { const tous = await modules.lister(); if (tous.length >= 50) throw new Error("50 modules au plus."); }
      if (existe) await stockage.ecrire("kv", { id: P_CORBEILLE + m.module_id, module_id: m.module_id, retire_le: jour(maintenant()), doc: existe });
      const courant = versions.some((v) => v.n === m.courant) ? m.courant : versions[versions.length - 1].n;
      await stockage.ecrire("kv", { id: P_MODULE + m.module_id, module_id: m.module_id, courant, versions });
      await modules.lire(m.module_id);
      return { id: m.module_id, remplace: !!existe };
    },
    /**
     * « Actualiser » : relit la série d'origine (lecture seule, source de la liste fixe), refait les mêmes calculs, et enregistre une NOUVELLE version.
     * Seulement pour un module à un jeu dont la provenance est complète et rejouable ; sinon refus clair.
     */
    async actualiserModule(id) {
      if (!donnees || !jeux) throw new Error("Sources de données indisponibles.");
      const d = await interne.lireDoc(id); if (!d) throw new Error(`Module inconnu ou d'ancien format : « ${String(id).slice(0, 40)} »`);
      const v = d.versions.find((x) => x.n === d.courant), p = v && v.provenance;
      if (!p || !p.racine || !p.reconstructible || v.spec.jeux.length !== 1) throw new Error("Ce module ne peut pas être actualisé automatiquement (provenance incomplète, ou plusieurs jeux). Refais-le avec lire_serie.");
      const lu = await donnees.lire({ source: p.racine.source, identifiant: p.racine.identifiant, debut: p.racine.debut, fin: p.racine.fin });
      let cur = lu.jeu;
      for (const e of p.etapes) cur = verifierJeu(transformer(cur, e));
      return modules.enregistrerSpec({ id, spec: v.spec, jeu: () => cur, provenance: p });
    },

    // ----------------------------------------------------------------- espaces de travail
    async enregistrerEspace(e) {
      const v = verifierEspace(e), docs = await (await import("../espaces.js")).creerEspaces({ stockage })._docs();
      if (!docs.some((d) => d.espace_id === v.id) && docs.length >= MAX_ESPACES) throw new Error(`${MAX_ESPACES} espaces au plus.`);
      const connus = new Set((await modules.lister()).map((m) => m.id)); for (const m of v.modules) if (!connus.has(m)) throw new Error(`Espace : le module « ${m} » n'existe pas.`);
      await stockage.ecrire("kv", { id: P_ESPACE + v.id, espace_id: v.id, titre: v.titre, modules: v.modules, note: v.note, maj: jour(maintenant()) });
      return { id: v.id };
    },
    async retirerEspace(id) {
      const d = await stockage.lire("kv", P_ESPACE + id); if (!d) throw new Error(`Espace inconnu : « ${String(id).slice(0, 40)} »`);
      await stockage.ecrire("kv", { id: P_CORBEILLE + "espace-" + id, espace_id: id, retire_le: jour(maintenant()), doc: d });
      await retirer(P_ESPACE + id); return { id };
    },

    // ----------------------------------------------------------------- workflows (lot 8)
    async enregistrerWorkflow(w) {
      const v = verifierWorkflow(w, { catalogue });
      const tous = (await stockage.tout("kv")).filter((d) => d && typeof d.id === "string" && d.id.startsWith(P_WORKFLOW));
      if (!tous.some((d) => d.id === P_WORKFLOW + v.id) && tous.length >= MAX_WORKFLOWS) throw new Error(`${MAX_WORKFLOWS} workflows au plus.`);
      const avant = tous.find((d) => d.id === P_WORKFLOW + v.id);
      await stockage.ecrire("kv", { id: P_WORKFLOW + v.id, workflow_id: v.id, nom: v.nom, parametres: v.parametres, etapes: v.etapes, cree_le: avant ? avant.cree_le : jour(maintenant()), maj: jour(maintenant()), lancements: avant ? avant.lancements || 0 : 0 });
      return { id: v.id, remplace: !!avant };
    },
    async retirerWorkflow(id) {
      const d = await stockage.lire("kv", P_WORKFLOW + id); if (!d) throw new Error(`Workflow inconnu : « ${String(id).slice(0, 40)} »`);
      await stockage.ecrire("kv", { id: P_CORBEILLE + "workflow-" + id, workflow_id: id, retire_le: jour(maintenant()), doc: d });
      await retirer(P_WORKFLOW + id); return { id };
    }
  };
}
