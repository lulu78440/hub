// Noyau · l'initiative (contrat, section 4.10) : parler sans être interrogé, avec retenue.
//  - Accueil : une phrase par jour liée au contexte (heure, prochain rendez-vous, humeur, actualité). Composée en local : 0 requête.
//  - Remarques opportunes : au plus une toutes les 2 heures, jamais en mode Focus, pendant un média, la nuit (22 h – 7 h) ni quand
//    Lucien semble fatigué. Locales (0 requête), coupables dans les réglages.
//  - Curiosité (mode autonome) : COUPÉE par défaut, hub ouvert seulement ; au plus une recherche toutes les 30 min et 20 par jour,
//    sur les sources autorisées et les centres d'intérêt, SANS requête Gemini (résumé local). Les fiches attendent dans « À valider ».
import { hote } from "./hote.js";
import { jetons, resumerLocalement } from "./recherche.js";
import { depuis } from "./actualite.js";

const jourDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DEUX_HEURES = 2 * 36e5, TRENTE_MIN = 30 * 6e4, MAX_CURIOSITE_JOUR = 20;

export function creerInitiative({ memoire, actualite, etat, barriere }) {
  const on = (cle, defaut = true) => hote.reglage.lire("noyau-" + cle, defaut ? "on" : "off") !== "off";
  const live = () => (hote.hub.contexteLive ? hote.hub.contexteLive() : {});
  const heureOk = () => { const h = hote.maintenant().getHours(); return h >= 7 && h < 22; };

  const i = {
    reglages: { accueil: () => on("accueil"), remarques: () => on("remarques"), curiosite: () => on("curiosite", false) },

    /** Phrase d'accueil du jour (une seule fois par jour). Renvoie { texte, raison } ou null. */
    async accueil() {
      if (!on("accueil")) return null;
      const now = hote.maintenant(), j = jourDe(now);
      if (hote.reglage.lire("noyau-accueil-jour", "") === j) return null;
      hote.reglage.ecrire("noyau-accueil-jour", j);
      await etat.rafraichir();
      const h = now.getHours(), salut = h < 6 ? "Tu es debout tard" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
      const L = [salut + "."];
      const ev = (await hote.stockage.tout("events")).filter((e) => e.date === j && (!e.start || e.start >= now.toTimeString().slice(0, 5))).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
      if (ev.length) L.push(`Prochain rendez-vous : ${ev[0].title}${ev[0].start ? " à " + ev[0].start : ""}.`);
      const ta = (await hote.stockage.tout("tasks")).filter((t) => !t.done), retard = ta.filter((t) => t.due && t.due < j);
      if (!etat.doux) { if (retard.length) L.push(`${retard.length} tâche${retard.length > 1 ? "s" : ""} en retard.`); else if (ta.length) L.push(`${ta.length} tâche${ta.length > 1 ? "s" : ""} à faire.`); }
      else L.push("On y va doucement aujourd'hui.");
      const a = actualite.brief(1)[0];
      if (a && !etat.doux) L.push(`À la une : ${a.titre} (${a.source}, ${depuis(a.date)}).`);
      return { texte: L.join(" "), raison: "accueil" };
    },

    /** Remarque opportune (au plus une toutes les 2 h). Renvoie { texte, raison } ou null ; ne parle jamais deux fois d'affilée du même sujet. */
    async remarque() {
      if (!on("remarques") || !heureOk()) return null;
      const lv = live(); if (lv.focus || lv.media) return null;
      const t = hote.maintenant().getTime(), dernier = parseInt(hote.reglage.lire("noyau-remarque-quand", "0"), 10) || 0;
      if (t - dernier < DEUX_HEURES) return null;
      await etat.rafraichir();
      const now = hote.maintenant(), j = jourDe(now), hhmm = now.toTimeString().slice(0, 5), vus = JSON.parse(hote.reglage.lire("noyau-remarque-vus", "[]"));
      const dit = (cle, texte, raison) => { if (vus.includes(j + cle)) return null; vus.push(j + cle); hote.reglage.ecrire("noyau-remarque-vus", JSON.stringify(vus.slice(-40))); hote.reglage.ecrire("noyau-remarque-quand", String(t)); return { texte, raison }; };
      // 1) un rendez-vous approche sans tâche préparée
      const ta = (await hote.stockage.tout("tasks")).filter((x) => !x.done);
      for (const e of (await hote.stockage.tout("events")).filter((x) => x.date === j && x.start && x.start > hhmm)) {
        const [h, m] = e.start.split(":").map(Number), dans = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
        if (dans > 0 && dans <= 90) {
          const mots = new Set(jetons(e.title)); const prepare = ta.some((x) => jetons(x.text).some((w) => mots.has(w)));
          if (!prepare) { const r = dit("rdv" + e.id, `« ${e.title} » dans ${dans} min, et aucune tâche ne le prépare. Tu veux que j'en ajoute une ?`, "rendez-vous"); if (r) return r; }
        }
      }
      // 2) un site surveillé est tombé
      const f = hote.hub.actus(); const panne = ((f && f.sites) || []).find((s) => !s.ok);
      if (panne) { const r = dit("site" + panne.nom, `Le site « ${panne.nom} » ne répond plus (${depuis(panne.depuis)}).`, "site"); if (r) return r; }
      // 3) une habitude oubliée, en fin de journée (jamais si Lucien semble fatigué)
      if (!etat.doux && now.getHours() >= 18) {
        const cfg = await hote.stockage.lire("kv", "rituels-config"), rit = await hote.stockage.lire("kv", "rit-" + j);
        const oubli = ((cfg && cfg.habits) || []).find((h) => !((rit && rit.counts && rit.counts[h.id]) || 0));
        if (oubli) { const r = dit("hab" + oubli.id, `L'habitude « ${oubli.name} » n'est pas encore faite aujourd'hui.`, "habitude"); if (r) return r; }
      }
      return null;
    },

    // ----- Curiosité : mode autonome (coupé par défaut) -----
    etatCuriosite() { try { const c = JSON.parse(hote.reglage.lire("noyau-curiosite-etat", "null")); return c && c.jour === jourDe(hote.maintenant()) ? c : { jour: jourDe(hote.maintenant()), n: 0, derniere: 0, faits: [] }; } catch (e) { return { jour: jourDe(hote.maintenant()), n: 0, derniere: 0, faits: [] }; } },
    /** Un tour de curiosité : une recherche sur un centre d'intérêt, résumée localement. Aucune requête Gemini. */
    async curiosite() {
      if (!on("curiosite", false) || !hote.enLigne()) return { fait: false, raison: "coupée ou hors ligne" };
      const st = i.etatCuriosite(), t = hote.maintenant().getTime();
      if (st.n >= MAX_CURIOSITE_JOUR) return { fait: false, raison: "20 recherches atteintes aujourd'hui" };
      if (t - st.derniere < TRENTE_MIN) return { fait: false, raison: "30 minutes pas encore écoulées" };
      const sujets = actualite.centresInteret().filter((w) => !st.faits.includes(w));
      if (!sujets.length) return { fait: false, raison: "aucun centre d'intérêt nouveau" };
      const sujet = sujets[0];
      const r = await barriere.executer({ outil: "chercher_sources", params: { requete: sujet } }, { origine: "autonome" });
      st.n++; st.derniere = t; st.faits.push(sujet); hote.reglage.ecrire("noyau-curiosite-etat", JSON.stringify(st));
      if (!r.ok) return { fait: true, sujet, trouve: 0, erreur: r.erreur };
      let n = 0;
      for (const x of (r.donnees.resultats || []).slice(0, 2)) {
        const texte = `${x.titre}. ${resumerLocalement(x.extrait || "", sujet, 2)}`.trim();
        if (await memoire.proposer({ type: "kb", titre: x.titre, texte, source: x.url || x.sourceNom, origine: "curiosité (" + x.sourceNom + ")", exterieur: true })) n++;
      }
      return { fait: true, sujet, trouve: n };
    }
  };
  return i;
}
