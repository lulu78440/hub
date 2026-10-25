// Laboratoire · moteur de démonstration. Ce n'est PAS une intelligence : un petit aiguillage à mots-clés qui appelle les vrais outils du Noyau,
// pour voir et tester sans clé la barrière, la fenêtre de confirmation, la mémoire, le journal et la vérification des sources.
// La qualité du raisonnement ne se juge qu'avec un vrai modèle (Gemini). Même interface que moteurGemini : generer({systeme, messages, outils, forcer}).
import { normaliser } from "../js/noyau/recherche.js";

const rep = (texte, extra = {}) => ({ appels: [{ nom: "repondre", params: { texte, ton: "calme", confiance: "moyenne", sources: [], ...extra } }], texte: "", ms: 5, usage: { entree: 0, sortie: 0, total: 0 } });
const appel = (nom, params = {}) => ({ appels: [{ nom, params }], texte: "", ms: 5, usage: { entree: 0, sortie: 0, total: 0 } });

function resumer(nom, c) {
  let d; try { d = JSON.parse(String(c).replace(/^[^\n]*\n/, "").replace(/\n\[FIN DES DONNÉES\]$/, "")); } catch (e) { return String(c).slice(0, 300); }
  const L = (x) => (Array.isArray(x) ? x : []);
  if (nom === "lire_taches") { const t = L(d.taches); return t.length ? "Tes tâches : " + t.map((x) => x.texte + (x.echeance ? " (" + x.echeance + ")" : "")).join(" ; ") + "." : "Aucune tâche dans cette liste."; }
  if (nom === "lire_agenda") { const e = L(d.evenements); return e.length ? "À l'agenda : " + e.map((x) => `${x.titre} le ${x.date}${x.debut ? " à " + x.debut : ""}`).join(" ; ") + "." : "Rien à l'agenda sur cette période."; }
  if (nom === "lire_meteo") return d.disponible ? `Il fait ${d.temperature} °C${d.lieu ? " à " + d.lieu : ""} (ressenti ${d.ressenti} °C).` : "La météo n'est pas chargée dans le hub.";
  if (nom === "lire_notes") { const n = L(d.notes); return n.length ? "Tes notes : " + n.map((x) => x.texte).join(" ; ") : "Aucune note."; }
  if (nom === "lire_actus") { const a = L(d.actus || d.titres); return a.length ? "À la une : " + a.slice(0, 4).map((x) => x.titre).join(" ; ") + "." : "Pas d'actualité chargée."; }
  if (nom === "chercher_memoire") { const x = L(d.extraits); return x.length ? "Dans ma mémoire : " + x.slice(0, 3).map((e) => e.titre || e.texte).join(" ; ") : "Je ne trouve rien là-dessus dans ma mémoire."; }
  return "Fait : " + JSON.stringify(d).slice(0, 200);
}

export function moteurDemo() {
  return {
    nom: "Démonstration (sans modèle)", type: "demo", demo: true,
    async generer({ messages }) {
      const dernier = messages[messages.length - 1];
      if (dernier.role === "outil") {
        const r = dernier.resultats[0], precedent = messages[messages.length - 2];
        if (/^REFUSÉ OU ÉCHEC/.test(r.contenu)) return rep("Je n'ai rien fait : " + r.contenu.replace(/^REFUSÉ OU ÉCHEC : /, ""), { confiance: "haute", ton: "vigilant" });
        const a = precedent && precedent.appels && precedent.appels[0];
        if (a && /^(ajouter|memoriser|creer)/.test(a.nom)) return rep("C'est fait, tu as confirmé : " + (a.params.texte || a.params.titre || a.nom) + ".", { confiance: "haute", ton: "enthousiaste" });
        return rep(resumer(a && a.nom, r.contenu), { confiance: "moyenne" });
      }
      const t = normaliser(dernier.texte);
      const apres = (re) => { const m = dernier.texte.match(re); return m ? m[1].trim().replace(/[.!]+$/, "") : ""; };
      let x;
      if ((x = apres(/(?:ajoute|cree|crée|ajouter)\s+(?:une\s+)?(?:tâche|tache)\s*(?::|que|de)?\s*(.+)/i))) return appel("ajouter_tache", { texte: x });
      if ((x = apres(/(?:ajoute|ajouter)\s+(?:une\s+)?note\s*(?::|que)?\s*(.+)/i))) return appel("ajouter_note", { texte: x });
      if ((x = apres(/(?:retiens|memorise|mémorise)\s+(?:que\s+)?(.+)/i))) return appel("memoriser", { texte: x, genre: "fait" });
      if (/\b(tache|taches|a faire)\b/.test(t)) return appel("lire_taches", { filtre: /retard/.test(t) ? "en_retard" : "a_faire" });
      if (/\b(agenda|rendez|rdv|reunion|calendrier)\b/.test(t)) return appel("lire_agenda", {});
      if (/\b(meteo|temps|temperature|degres)\b/.test(t)) return appel("lire_meteo", {});
      if (/\b(notes?)\b/.test(t)) return appel("lire_notes", {});
      if (/\b(actu|actualite|nouvelles|infos)\b/.test(t)) return appel("lire_actus", {});
      if (/\b(souviens|memoire|sais-tu|sais tu|retenu)\b/.test(t)) return appel("chercher_memoire", { requete: dernier.texte.slice(0, 120) });
      return rep("Je suis en mode démonstration : je sais lire tes tâches, ton agenda, tes notes, la météo et l'actualité, ajouter une tâche ou une note (avec ta confirmation) et retenir un fait. Pour un vrai raisonnement, branche une clé Gemini dans le panneau de droite.", { ton: "curieux", confiance: "haute" });
    }
  };
}
