// Noyau · modules enregistrés (orchestrateur, lot 3) : lire_modules et enregistrer_module.
// Un « module » = une vue (courbe, barres, tableau, chiffre clé) + un titre + la copie vérifiée de son jeu (source, date, unité, licence).
// Aucune fonction « supprimer » ni « exporter » ici : ce sont des gestes de Lucien, jamais du Noyau. Enregistrer exige son accord (barrière).
// Stockage : collection « kv », document « noyau-modules » (chiffré par le coffre comme le reste).
import { verifierJeu, TYPES_VUE } from "./modules/composants.js";

export const DOC = "noyau-modules";
export const MAX_MODULES = 20;
export const MAX_OCTETS_MODULE = 250000;
const RE_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

const premiere = (j, types) => j.colonnes.find((c) => types.includes(c.type));
/** Colonnes choisies par le hub quand le modèle n'en précise pas. Renvoie les options pour `rendre(vue, jeu, options)`. */
export function optionsParDefaut(vue, jeu, voulu = {}) {
  const ok = (id, types) => { if (id == null) return null; const c = jeu.colonnes.find((x) => x.id === id); if (!c || !types.includes(c.type)) throw new Error(`colonne « ${String(id).slice(0, 30)} » absente ou de mauvais type`); return c.id; };
  const serie = ok(voulu.series, ["texte"]) || (vue === "courbe" ? ((c) => (c && jeu.colonnes.some((x) => x.type === "nombre") ? c.id : null))(jeu.colonnes.find((c) => c.id === "serie" && c.type === "texte")) : null);
  const num = ok(voulu.valeur || voulu.y, ["nombre"]) || (premiere(jeu, ["nombre"]) || {}).id;
  if (!num && vue !== "tableau") throw new Error("ce jeu n'a aucune colonne de nombres à représenter");
  const date = ok(voulu.x, ["date", "nombre"]) || (premiere(jeu, ["date"]) || {}).id;
  if (vue === "courbe") { if (!date) throw new Error("courbe : le jeu n'a pas de colonne de dates (essaie « barres » ou « tableau »)"); const o = { x: date, y: num }; if (serie) o.series = serie; return o; }
  if (vue === "barres") { const cat = ok(voulu.categorie, ["texte", "date"]) || (premiere(jeu, ["texte"]) || premiere(jeu, ["date"]) || {}).id; if (!cat) throw new Error("barres : aucune colonne de catégories"); return { categorie: cat, valeur: num }; }
  if (vue === "chiffre_cle") return date ? { valeur: num, x: date } : { valeur: num };
  return {};
}

export function creerModules({ stockage, maintenant = () => new Date() } = {}) {
  let doc = null;
  const charger = async () => doc || (doc = (await stockage.lire("kv", DOC)) || { id: DOC, lignes: [] });
  const resume = (m) => ({ id: m.id, titre: m.titre, vue: m.vue, source: m.jeu.source.nom, periode: m.jeu.source.periode, donnees_du: m.jeu.source.maj, exemple: !!m.jeu.exemple, enregistre_le: m.cree_le, modifie_le: m.modifie_le || null });
  return {
    /** Liste sans aucune valeur chiffrée. */
    async lister() { return (await charger()).lignes.map(resume); },
    /** Un module complet (jeu re-vérifié : un stockage altéré est refusé, pas affiché). */
    async lire(id) {
      const m = (await charger()).lignes.find((x) => x.id === id); if (!m) throw new Error(`Module inconnu : « ${String(id).slice(0, 40)} »`);
      return { id: m.id, titre: m.titre, vue: m.vue, options: m.options || {}, jeu: verifierJeu(m.jeu) };
    },
    /** Enregistre (ou remplace, même identifiant) un module. À n'appeler qu'après l'accord de Lucien. */
    async enregistrer({ id, titre, vue, jeu, options = {} }) {
      if (!RE_ID.test(String(id))) throw new Error("Identifiant : minuscules, chiffres et tirets (2 à 40 signes)");
      const t = String(titre || "").trim(); if (!t || t.length > 80) throw new Error("Titre : 1 à 80 signes");
      if (!TYPES_VUE.includes(vue)) throw new Error("Vue inconnue (permises : " + TYPES_VUE.join(", ") + ")");
      const j = jeu && jeu.verifie === true && Object.isFrozen(jeu) ? jeu : verifierJeu(jeu);     // jamais de module sans jeu vérifié, donc sans source
      const opts = optionsParDefaut(vue, j, options);
      const copie = JSON.parse(JSON.stringify({ titre: j.titre, unite: j.unite, colonnes: j.colonnes.map((c) => ({ id: c.id, libelle: c.libelle, type: c.type })), lignes: j.lignes, source: j.source, exemple: j.exemple }));
      if (JSON.stringify(copie).length > MAX_OCTETS_MODULE) throw new Error(`Module trop volumineux (plus de ${Math.round(MAX_OCTETS_MODULE / 1000)} Ko) : réduis la période avec transformer_donnees.`);
      const d = await charger(), i = d.lignes.findIndex((x) => x.id === id);
      if (i < 0 && d.lignes.length >= MAX_MODULES) throw new Error(`${MAX_MODULES} modules au plus : Lucien doit en retirer un lui-même.`);
      const ligne = { id, titre: t, vue, options: opts, jeu: copie, cree_le: i >= 0 ? d.lignes[i].cree_le : maintenant().toISOString().slice(0, 10), modifie_le: i >= 0 ? maintenant().toISOString().slice(0, 10) : null };
      if (i >= 0) d.lignes[i] = ligne; else d.lignes.push(ligne);
      await stockage.ecrire("kv", d);
      return { ...resume(ligne), remplace: i >= 0 };
    }
  };
}
