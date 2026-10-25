// Noyau · l'actualité (contrat, section 4.9). Le hub publie déjà flux.json toutes les 20 minutes : le Noyau le lit sans requête de plus.
// Il sait quel jour on est et ce qui se passe, ne confond pas son savoir et l'actualité (titres datés et sourcés), peut garder un titre
// dont Lucien parle comme fiche d'actualité (confirmation), qui perd sa fraîcheur après 7 jours.
import { hote } from "./hote.js";
import { Index, jetons } from "./recherche.js";

export function depuis(iso) {
  const t = Date.parse(iso); if (!t) return "";
  const m = Math.round((hote.maintenant().getTime() - t) / 6e4);
  if (m < 1) return "à l'instant"; if (m < 60) return "il y a " + m + " min";
  const h = Math.round(m / 60); if (h < 24) return "il y a " + h + " h";
  return "il y a " + Math.round(h / 24) + " j";
}

export function creerActualite({ memoire }) {
  const flux = () => hote.hub.actus();
  const titres = () => (flux() && flux().actus) || [];
  const fmt = (a) => `« ${a.titre} » (${a.source || "source ?"}, ${depuis(a.date)})`;
  return {
    disponible: () => titres().length > 0,
    /** Titres liés à la question (BM25 sur les titres), sinon rien : on ne meuble pas. */
    pour(question, max = 3) {
      const l = titres(); if (!l.length) return [];
      const ix = new Index(); l.forEach((a, i) => ix.ajouter(String(i), a.titre + " " + (a.cat || "")));
      return ix.chercher(question, { limite: max, corriger: false }).filter((r) => r.pertinence > 0.4).map((r) => l[+r.id]);
    },
    recents(max = 3) { return titres().slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, max); },
    fmt,
    /** Centres d'intérêt de Lucien déduits de la mémoire sémantique (mots les plus fréquents), pour trier le brief. */
    centresInteret() {
      const c = new Map();
      for (const t of memoire.texteDe("sem")) for (const w of jetons(t)) if (w.length > 3) c.set(w, (c.get(w) || 0) + 1);
      return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
    },
    /** Brief : les 3 à 5 titres les plus utiles selon les centres d'intérêt, sinon les plus récents. */
    brief(max = 4) {
      const l = titres(); if (!l.length) return [];
      const ci = this.centresInteret().join(" ");
      if (ci) { const ix = new Index(); l.forEach((a, i) => ix.ajouter(String(i), a.titre + " " + (a.cat || ""))); const r = ix.chercher(ci, { limite: max, corriger: false }).map((x) => l[+x.id]); if (r.length >= 2) return r; }
      return this.recents(max);
    },
    /** Garde un titre comme fiche d'actualité datée (en attente dans la boîte « À valider »). */
    async retenir(a) {
      return memoire.proposer({ type: "actualite", titre: a.titre, texte: `${a.titre} (${a.source || "source ?"}, ${String(a.date || "").slice(0, 10)})`, source: a.lien || a.source || "", origine: "flux d'actualité du hub", exterieur: true });
    }
  };
}
