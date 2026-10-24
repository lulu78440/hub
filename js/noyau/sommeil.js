// Noyau · le sommeil (contrat, section 4.6) : consolidation quotidienne, 1 requête par jour.
// Au premier moment calme (hub inactif 20 minutes, ou première ouverture du matin) : relit les épisodes de la veille (résumés courts,
// jamais les conversations entières), propose AU PLUS 5 éléments (faits durables, leçons de méthode, faits à rafraîchir) dans la boîte
// « À valider », et écrit une ligne de journal intime (épisodique). Rien n'est enregistré sans Lucien. Coupable dans les réglages.
import { hote } from "./hote.js";
import { journalActions } from "./journal.js";
import { ErreurNoyau } from "./moteurs.js";

const jourDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const O = (properties, required) => ({ type: "object", properties, required });

export const OUTIL_CONSOLIDER = {
  nom: "consolider", niveau: "INTERNE",
  description: "Rend le résultat du sommeil : au plus 5 propositions pour la mémoire, et une ligne de journal intime.",
  params: O({
    propositions: { type: "array", description: "5 au plus", items: O({
      genre: { type: "string", enum: ["fait", "regle", "rafraichir"], description: "fait durable sur l'utilisateur, règle de méthode, ou nouvelle version d'un fait ancien" },
      texte: { type: "string", description: "Une phrase" },
      cible: { type: "integer", description: "Pour « rafraichir » : numéro [n] du fait ancien concerné" }
    }, ["genre", "texte"]) },
    journal_intime: { type: "string", description: "Une ligne : ce qui a marqué la journée" }
  }, ["propositions", "journal_intime"])
};

export function creerSommeil({ memoire, cerveau, etat, budget, moteur, emettre, phase }) {
  const actif = () => hote.reglage.lire("noyau-sommeil", "on") !== "off";
  const faitAujourdhui = () => hote.reglage.lire("noyau-sommeil-jour", "") === jourDe(hote.maintenant());
  return {
    actif, faitAujourdhui,
    /** Est-ce le bon moment ? inactifMs : durée sans geste ; ouvertureMatin : première ouverture du hub de la journée. */
    moment({ inactifMs = 0, ouvertureMatin = false } = {}) {
      return actif() && !faitAujourdhui() && hote.enLigne() && (inactifMs >= 20 * 6e4 || (ouvertureMatin && hote.maintenant().getHours() >= 6));
    },
    async dormir({ force = false } = {}) {
      if (!actif() && !force) return { fait: false, raison: "Sommeil coupé dans les réglages." };
      if (faitAujourdhui() && !force) return { fait: false, raison: "Déjà fait aujourd'hui." };
      const now = hote.maintenant(), veille = new Date(now); veille.setDate(veille.getDate() - 1); veille.setHours(0, 0, 0, 0);
      const eps = memoire.episodesDepuis(veille.getTime()).slice(-30);
      const anciens = memoire.faitsAChallenger().slice(0, 8);
      if (!eps.length && !anciens.length) { hote.reglage.ecrire("noyau-sommeil-jour", jourDe(now)); return { fait: true, propositions: 0, raison: "Rien à consolider." }; }
      if (!hote.enLigne()) return { fait: false, raison: "Hors ligne." };
      if (budget.restant() < 4) return { fait: false, raison: "Budget du jour trop bas pour dormir (4 requêtes de marge gardées)." };
      phase("dort");
      const systeme = cerveau.systeme() + `\n\n# Sommeil\nTu consolides ta mémoire. Tu reçois les résumés des épisodes récents et, parfois, de vieux faits datés. Propose AU PLUS 5 éléments utiles : faits durables sur l'utilisateur (seulement s'ils reviennent ou s'ils sont clairs), règles de méthode, ou nouvelle version d'un vieux fait (genre « rafraichir », avec le numéro [n]). N'invente rien : appuie-toi uniquement sur les résumés. Écris aussi une ligne de journal intime sur ce qui a marqué la journée. Termine par l'outil consolider.`;
      const corps = `Épisodes :\n${eps.map((e) => `- (${new Date(e.cree).toLocaleDateString("fr-FR")}, importance ${e.importance}) ${e.texte}`).join("\n") || "(aucun)"}\n\nVieux faits à rafraîchir :\n${anciens.map((f, i) => `[${i + 1}] ${f.texte}`).join("\n") || "(aucun)"}`;
      let r;
      try { r = await moteur().generer({ systeme, messages: [{ role: "user", texte: corps }], outils: [OUTIL_CONSOLIDER], forcer: ["consolider"], temperature: 0.4 }); }
      catch (e) { phase("repos"); return { fait: false, raison: e instanceof ErreurNoyau ? e.message : "Erreur pendant le sommeil." }; }
      const res = (r.appels.find((a) => a.nom === "consolider") || { params: { propositions: [], journal_intime: "" } }).params;
      let n = 0;
      for (const p of (Array.isArray(res.propositions) ? res.propositions : []).slice(0, 5)) {
        if (!p || typeof p.texte !== "string" || !p.texte.trim()) continue;
        const cible = p.genre === "rafraichir" && Number.isInteger(p.cible) ? anciens[p.cible - 1] : null;
        const prop = p.genre === "regle" ? { type: "pro" } : p.genre === "rafraichir" && cible ? { type: "modif", avant: cible.texte, cibleId: cible.id } : { type: "sem" };
        if (await memoire.proposer({ ...prop, texte: p.texte.trim(), origine: "sommeil du " + now.toLocaleDateString("fr-FR") })) n++;
      }
      const j = typeof res.journal_intime === "string" ? res.journal_intime.trim() : "";
      if (j) await memoire.ecrireEpisode({ resume: "Journal intime : " + j.slice(0, 300), importance: 5, tonalite: "calme", actions: [], origine: "sommeil" });
      hote.reglage.ecrire("noyau-sommeil-jour", jourDe(now));
      await journalActions.ecrire({ outil: "(sommeil)", niveau: "—", params: `${n} proposition(s), ${eps.length} épisode(s) relus`, statut: "EXÉCUTÉ", origine: "sommeil", sortie: ["google (résumés d'épisodes)"] });
      phase("repos");
      return { fait: true, propositions: n, journal: j, episodes: eps.length };
    }
  };
}
