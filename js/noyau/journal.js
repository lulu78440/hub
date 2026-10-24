// Noyau · journaux en ajout seul (contrat, sections 4.5 et 10).
// Deux journaux : celui des actions (outils) et celui des changements de mémoire. Ni le modèle ni aucun outil ne peut
// les effacer ni les modifier : ce module n'offre que « ajouter » et « lire ». Rangés dans la collection kv (chiffrée par le coffre).
import { hote } from "./hote.js";

export const STATUTS = ["EXÉCUTÉ", "CONFIRMÉ_PAR_LUCIEN", "REFUSÉ_PAR_LUCIEN", "EXPIRÉ", "BLOQUÉ_INTERDIT", "BUDGET_ATTEINT", "ERREUR"];
export const ORIGINES = ["lucien", "modele", "initiative", "autonome", "sommeil"];

function creer(docId, max) {
  let cache = null, file = Promise.resolve();
  const charger = async () => {
    if (cache) return cache;
    const d = await hote.stockage.lire("kv", docId);
    cache = d && Array.isArray(d.lignes) ? d : { id: docId, lignes: [] };
    return cache;
  };
  return {
    /** Ajoute une ligne. Les écritures se suivent une par une (jamais deux à la fois). */
    ecrire(ligne) {
      const l = { id: hote.nouvelId("j"), quand: hote.maintenant().toISOString(), ...ligne };
      file = file.then(async () => {
        const d = await charger();
        d.lignes.push(l);
        if (d.lignes.length > max) d.lignes.splice(0, d.lignes.length - max);
        await hote.stockage.ecrire("kv", d);
      }).catch((e) => { console.error("journal", e); });
      return file.then(() => l);
    },
    /** Dernières lignes, de la plus récente à la plus ancienne ; filtre facultatif par statut. */
    async lire({ statut, limite = 100 } = {}) {
      const d = await charger();
      const l = statut ? d.lignes.filter((x) => x.statut === statut) : d.lignes;
      return l.slice(-limite).reverse();
    },
    async compter() { return (await charger()).lignes.length; },
    /** À appeler quand l'hôte a changé (laboratoire) : oublie la copie en mémoire. */
    oublier() { cache = null; }
  };
}

export const journalActions = creer("noyau-journal", 1000);
export const journalMemoire = creer("noyau-journal-memoire", 5000);
