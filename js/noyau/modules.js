// Noyau · modules enregistrés (orchestrateur, lot 3) : lire_modules et enregistrer_module.
// Un « module » = une vue (courbe, barres, tableau, chiffre clé) + un titre + la copie vérifiée de son jeu (source, date, unité, licence).
// Aucune fonction « supprimer » ni « exporter » ici : ce sont des gestes de Lucien, jamais du Noyau. Enregistrer exige son accord (barrière).
// Lots 5 et 9 : un document « kv » par module (`noyau-module-<id>`), versions, spécification de module (modules/spec.js) : voir modules/stockage.js.
// L'ancien document « noyau-modules » (lot 3) reste lisible, jamais modifié ni supprimé par le Noyau.
import { verifierJeu, TYPES_VUE } from "./modules/composants.js";
import { creerStockageModules, MAX_MODULES as MAX, MAX_OCTETS_MODULE as MAXO, RE_ID } from "./modules/stockage.js";

export const DOC = "noyau-modules";
export const MAX_MODULES = MAX;
export const MAX_OCTETS_MODULE = MAXO;

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
  const st = creerStockageModules({ stockage, maintenant, optionsParDefaut });
  return {
    /** Liste sans aucune valeur chiffrée. */
    lister: () => st.lister(),
    /** Les versions d'un module (sans données). */
    versions: (id) => st.versions(id),
    /** Un module complet (jeu re-vérifié, transformations de la spécification appliquées : un stockage altéré est refusé, pas affiché). */
    lire: (id, opts) => st.lire(id, opts),
    /** Enregistre (ou remplace : nouvelle version, l'ancienne est gardée) un module d'une vue. À n'appeler qu'après l'accord de Lucien. */
    async enregistrer({ id, titre, vue, jeu, options = {}, transformations = [], provenance = null }) {
      const t = String(titre || "").trim(); if (!t || t.length > 80) throw new Error("Titre : 1 à 80 signes");
      if (!TYPES_VUE.includes(vue)) throw new Error("Vue inconnue (permises : " + TYPES_VUE.join(", ") + ")");
      if (!RE_ID.test(String(id))) throw new Error("Identifiant : minuscules, chiffres et tirets (2 à 40 signes)");
      const j = jeu && jeu.verifie === true && Object.isFrozen(jeu) ? jeu : verifierJeu(jeu);     // jamais de module sans jeu vérifié, donc sans source
      const opts = optionsParDefaut(vue, j, options);
      const vueSpec = { type: vue, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => typeof v === "string")) };
      return st.enregistrer({ id, spec: { v: 1, titre: t, jeux: ["j1"], transformations, vues: [vueSpec] }, jeu: () => j, provenance });
    },
    /** Enregistre une spécification complète (plusieurs jeux, transformations, vues). `jeu(ref)` rend le jeu vérifié d'une référence. */
    enregistrerSpec: ({ id, spec, jeu, provenance }) => st.enregistrer({ id, spec, jeu, provenance }),
    _stockage: st
  };
}
