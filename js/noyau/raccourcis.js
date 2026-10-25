// Noyau · raccourcis : une phrase de Lucien qui déclenche une suite d'actions déjà autorisées (« mode soirée » = Focus + afficher la météo…).
//  - Ce ne sont pas des programmes : seulement des appels d'outils du catalogue, rejoués un par un par la barrière, donc chacun garde son
//    niveau (une action à confirmer redemande toujours ton accord). Au plus 20 raccourcis, 5 étapes chacun.
//  - Exclus : tout ce qui touche au cerveau, à la mémoire, à la personnalisation elle-même ou à un autre raccourci.
//  - Le raccourci ne se déclenche que si TA phrase correspond exactement (jamais sur du texte venu d'une page, d'une source ou d'un mail).
import { hote } from "./hote.js";
import { normaliser } from "./recherche.js";

export const EXCLUS = new Set(["memoriser", "apprendre", "personnaliser_hub", "creer_raccourci", "repondre", "lire_mails", "lire_page"]);
const cle = (t) => normaliser(String(t || "")).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function creerRaccourcis({ barriere }) {
  const lire = () => { try { const r = JSON.parse(hote.reglage.lire("noyau-raccourcis", "{}")); return r && typeof r === "object" ? r : {}; } catch (e) { return {}; } };
  const ecrire = (r) => hote.reglage.ecrire("noyau-raccourcis", JSON.stringify(r));
  function verifier(etapes) {
    if (!Array.isArray(etapes) || !etapes.length || etapes.length > 5) throw new Error("1 à 5 étapes");
    return etapes.map((e) => {
      const o = barriere.outil(e && e.outil); if (!o || (o.niveau !== "LIBRE" && o.niveau !== "CONFIRMATION")) throw new Error("Outil inconnu ou interdit : " + (e && e.outil));
      if (EXCLUS.has(o.nom)) throw new Error("L'outil « " + o.nom + " » ne peut pas entrer dans un raccourci.");
      let params = {}; if (e.params_json) { try { params = JSON.parse(e.params_json); } catch (x) { throw new Error("params_json : JSON invalide"); } } else if (e.params && typeof e.params === "object") params = JSON.parse(JSON.stringify(e.params));
      if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("Paramètres : un objet JSON");
      return { outil: o.nom, params };
    });
  }
  const api = {
    liste: () => Object.values(lire()).map((r) => ({ nom: r.nom, phrase: r.phrase, etapes: r.etapes.map((e) => e.outil) })),
    resume(p) { if (p.action === "supprimer") return `Supprimer le raccourci « ${p.phrase} »`; if (p.action === "lister") return "Lister mes raccourcis"; return `Créer le raccourci « ${p.phrase} » : ${verifier(p.etapes).map((e) => e.outil).join(" → ")}`; },
    executerOutil(p) {
      const r = lire();
      if (p.action === "lister") return { raccourcis: api.liste() };
      const k = cle(p.phrase); if (!k || k.length < 4) throw new Error("Phrase trop courte");
      if (p.action === "supprimer") { if (!r[k]) throw new Error("Raccourci introuvable"); delete r[k]; ecrire(r); return { supprime: p.phrase }; }
      if (!r[k] && Object.keys(r).length >= 20) throw new Error("20 raccourcis au maximum");
      r[k] = { nom: String(p.nom || p.phrase).slice(0, 60), phrase: String(p.phrase).slice(0, 80), etapes: verifier(p.etapes) }; ecrire(r);
      return { cree: r[k].phrase, etapes: r[k].etapes.map((e) => e.outil) };
    },
    /** Si le texte de Lucien est exactement un raccourci, le rejoue. Renvoie la réponse, ou null. */
    async tenter(texte, origine) {
      if (origine !== "lucien" && origine !== "voix") return null;
      const r = lire()[cle(texte)]; if (!r) return null;
      const lignes = [];
      for (const e of r.etapes) { const x = await barriere.executer({ outil: e.outil, params: e.params }, { origine: "lucien" }); lignes.push(`${e.outil} : ${x.ok ? "fait" : (x.erreur || x.statut || "refusé")}`); }
      return { texte: `Raccourci « ${r.nom} » joué (${lignes.join(" ; ")}).`, ton: "calme", confiance: "haute", sources: [], raccourci: true };
    }
  };
  return api;
}
