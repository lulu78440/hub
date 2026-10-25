// Noyau · les mémoires (contrat, sections 4.3 à 4.5 et 8).
// Épisodique (ce qui s'est passé), sémantique (faits sur Lucien), procédurale (règles), connaissances (fiches avec source) et articles.
// La mémoire de travail est dans boucle.js ; la fondatrice est dans le cerveau (cerveau.js).
// Garanties : rien n'est jamais effacé par le Noyau (les fiches « archivées » restent) ; chaque changement est écrit dans un journal en ajout
// seul ; un contenu venu de l'extérieur ne devient jamais un fait sur Lucien, une règle ou une instruction ; un fait confirmé n'est jamais
// réécrit en silence (modification et contradiction passent par la boîte « À valider »).
import { hote } from "./hote.js";
import { Index, normaliser } from "./recherche.js";
import { journalMemoire } from "./journal.js";

export const PREFIXES = { epi: "noyau-epi-", sem: "noyau-sem-", pro: "noyau-pro-", kb: "noyau-kb-", wiki: "noyau-wiki-" };
const ETIQUETTE = { epi: "épisode", sem: "fait sur Lucien", pro: "règle de méthode", kb: "connaissance", wiki: "article" };
const IMPORTANCE = { epi: 5, sem: 7, pro: 7, kb: 5, wiki: 5 };
const JOUR = 864e5, DEMI_VIE = 30, LOINTAIN = 180, FRAICHEUR_ACTU = 7, FAIT_DATE = 90;
const EXTERNE = /^(source\b|page\b|mail\b|lecture ext|http|web)/i;      // origines venues du dehors

const typeDe = (id) => Object.entries(PREFIXES).find(([, p]) => id.startsWith(p))?.[0] || null;
const maintenant = () => hote.maintenant().getTime();

export function creerMemoire() {
  const items = new Map();               // id -> élément
  let index = new Index();
  let propositions = new Map();           // id -> proposition « À valider »
  let charge = false;

  const texteIndex = (it) => [it.titre, it.texte, it.cle, it.source, it.complet].filter(Boolean).join(" ");
  const ajouterLocal = (it) => { items.set(it.id, it); index.ajouter(it.id, texteIndex(it)); };
  const sauver = (it) => hote.stockage.ecrire("kv", it);
  const jours = (ms) => (maintenant() - ms) / JOUR;
  const dernierContact = (it) => it.dernierRappel || it.cree || 0;
  const estLointain = (it) => it.type === "epi" && jours(dernierContact(it)) > LOINTAIN;
  const recence = (it) => Math.pow(0.5, Math.max(jours(dernierContact(it)), 0) / DEMI_VIE);
  const periméActu = (it) => it.actualite && jours(it.cree || 0) > FRAICHEUR_ACTU;

  function vue(it, score = 0) {
    return { id: it.id, type: it.type, etiquette: periméActu(it) ? "actualité passée, contexte" : ETIQUETTE[it.type], titre: it.titre || "", texte: it.texte, verifie: it.verifie, date: it.cree, score: Math.round(score * 1000) / 1000, source: it.source || null };
  }

  /** Score de rappel = 3 × pertinence + 2 × importance + 0,5 × récence (chaque terme entre 0 et 1), comme Generative Agents. */
  function classer(requete, { limite = 6, lointain = false, archive = false, diversite = 3 } = {}) {
    const trouves = index.chercher(requete, { limite: 60, filtre: (id) => { const it = items.get(id); return it && (archive || !it.archive) && (lointain || !estLointain(it)); } });
    const notes = trouves.map((r) => {
      const it = items.get(r.id), imp = Math.min(Math.max(it.importance || IMPORTANCE[it.type] || 5, 1), 10) / 10;
      return { it, s: 3 * r.pertinence + 2 * imp + 0.5 * recence(it) };
    }).sort((a, b) => b.s - a.s);
    const compte = {}, out = [];
    for (const n of notes) {
      if ((compte[n.it.type] || 0) >= diversite) continue;
      compte[n.it.type] = (compte[n.it.type] || 0) + 1; out.push(vue(n.it, n.s));
      if (out.length >= limite) break;
    }
    return out;
  }

  async function ecrireJournal(action, it, avant = null, origine = "systeme") {
    await journalMemoire.ecrire({ action, id: it.id, type: it.type, avant, apres: action === "archiver" ? null : { texte: it.texte, titre: it.titre || "" }, origine });
  }

  const m = {
    async charger() {
      items.clear(); index = new Index(); propositions = new Map();
      for (const d of await hote.stockage.tout("kv")) {
        if (typeof d.id !== "string") continue;
        if (d.id.startsWith("noyau-av-")) { propositions.set(d.id, d); continue; }
        const t = typeDe(d.id); if (t) { d.type = t; ajouterLocal(d); }
      }
      charge = true; return m.stats();
    },
    get chargee() { return charge; },
    stats() {
      const s = { total: items.size, archives: 0, nonVerifies: 0, parType: {}, enAttente: [...propositions.values()].filter((p) => p.statut === "attente").length };
      for (const it of items.values()) { s.parType[it.type] = (s.parType[it.type] || 0) + 1; if (it.archive) s.archives++; else if (it.verifie === false) s.nonVerifies++; }
      return s;
    },
    tous: ({ archive = true } = {}) => [...items.values()].filter((it) => archive || !it.archive),
    lire: (id) => items.get(id) || null,
    texteDe: (type) => [...items.values()].filter((it) => it.type === type && !it.archive).map((it) => it.texte),
    rappeler: (requete, opt) => (charge ? classer(requete, opt) : []),
    chercher: (requete, opt) => classer(requete, { archive: false, ...opt }),
    /** Mots tirés des souvenirs qu'il ne faut jamais envoyer à un site (prénoms, noms propres cités dans les faits). */
    motsPrives() {
      const mots = new Set();
      for (const it of items.values()) if ((it.type === "sem" || it.type === "epi") && !it.archive) for (const w of String(it.texte).match(/\b[A-ZÉÈÀ][a-zéèêàîïôûç]{3,}\b/g) || []) mots.add(w);
      return [...mots].slice(0, 200);
    },

    async raviver(ids) {
      const t = maintenant(); const modifies = [];
      for (const id of ids) { const it = items.get(id); if (it) { it.dernierRappel = t; modifies.push(it); } }
      if (modifies.length) await hote.stockage.ecrireMany("kv", modifies);
    },

    async ecrireEpisode({ resume, importance = 5, tonalite = "calme", actions = [], humeur = null, origine = "lucien" }) {
      const it = { id: PREFIXES.epi + hote.nouvelId(), type: "epi", texte: String(resume).slice(0, 400), importance: Math.min(Math.max(importance | 0, 1), 10), tonalite, actions, humeur, origine: "conversation", confiance: "haute", cree: maintenant(), dernierRappel: null };
      ajouterLocal(it); await sauver(it); await ecrireJournal("ecrire", it, null, origine); return it;
    },

    /**
     * Crée un élément après VALIDATION de Lucien (outil confirmé ou boîte « À valider »).
     * Garde contre l'empoisonnement : une origine extérieure ne peut produire qu'une connaissance.
     */
    async confirmer({ type, texte, titre = "", cle = "", source = "", actualite = false, origine = "lucien", importance, url = null, theme = null, verifie }) {
      if (!PREFIXES[type] || type === "epi") throw new Error("Type de mémoire inconnu");
      if ((type === "sem" || type === "pro") && EXTERNE.test(origine)) throw new Error("Un contenu venu de l'extérieur ne peut pas devenir un fait sur Lucien ni une règle : seulement une fiche de connaissance.");
      const norm = normaliser(texte).trim();
      if (!norm) throw new Error("Texte vide");
      const meme = [...items.values()].find((x) => x.type === type && !x.archive && normaliser(x.texte).trim() === norm);
      if (meme) return { deja: true, id: meme.id };
      if (type === "sem" && cle) {                                         // contradiction : les deux sont montrés, rien n'est écrasé
        const ancien = [...items.values()].find((x) => x.type === "sem" && !x.archive && x.cle && normaliser(x.cle) === normaliser(cle));
        if (ancien) { const p = await m.proposer({ type: "contradiction", texte, cle, origine, avant: ancien.texte, cibleId: ancien.id }); return { propose: true, id: p.id, note: "Contredit un fait déjà retenu : ajouté à la boîte « À valider » pour que Lucien tranche." }; }
      }
      const it = { id: PREFIXES[type] + hote.nouvelId(), type, texte: String(texte).slice(0, 1500), titre, cle, source, url, actualite, origine, confiance: type === "kb" ? "moyenne" : "haute", verifie: type === "kb" ? (verifie === true) : undefined, theme: theme || undefined, importance: importance || IMPORTANCE[type], cree: maintenant(), dernierRappel: null };
      ajouterLocal(it); await sauver(it); await ecrireJournal("ecrire", it, null, origine);
      return { ajoute: true, id: it.id, type: it.type };
    },

    /** Dépose une proposition dans la boîte « À valider ». Rien n'entre dans la mémoire avant l'accord de Lucien. */
    async proposer({ type, texte, origine = "conversation", exterieur = false, avant = null, cle = "", cibleId = null, titre = "", source = "", theme = null }) {
      if (exterieur && (type === "sem" || type === "pro" || type === "fond")) type = "kb";
      const norm = normaliser(texte).trim(); if (!norm) return null;
      const doublon = [...propositions.values()].find((p) => p.statut === "attente" && p.type === type && normaliser(p.texte).trim() === norm)
        || [...items.values()].find((x) => x.type === (type === "contradiction" || type === "modif" ? "sem" : type) && !x.archive && normaliser(x.texte).trim() === norm);
      if (doublon) return doublon;
      const p = { id: "noyau-av-" + hote.nouvelId(), type, texte: String(texte).slice(0, 400), titre, cle, source, origine, avant, cibleId, theme: theme || undefined, cree: maintenant(), statut: "attente" };
      propositions.set(p.id, p); await hote.stockage.ecrire("kv", p); return p;
    },
    /** Marque une fiche de connaissance comme vérifiée après un test réussi (demandé par Lucien). Journalisé, réversible par « restaurer ». */
    async certifier(id, origine = "lucien (test de validation)") {
      const it = items.get(id); if (!it || it.type !== "kb" || it.archive) return null; if (it.verifie === true) return it;
      const avant = { texte: it.texte, titre: it.titre || "" }; it.verifie = true; it.confiance = "haute"; it.teste = maintenant();
      await sauver(it); await ecrireJournal("modifier", it, avant, origine); return it;
    },
    aValider: () => [...propositions.values()].filter((p) => p.statut === "attente").sort((a, b) => a.cree - b.cree),

    /** Tri de Lucien : garder, modifier (avec nouveau texte) ou écarter. Une proposition écartée est gardée (statut) mais ne sert plus. */
    async trier(id, action, nouveauTexte = "") {
      const p = propositions.get(id); if (!p || p.statut !== "attente") throw new Error("Proposition introuvable");
      const texte = action === "modifier" && nouveauTexte.trim() ? nouveauTexte.trim() : p.texte;
      let res = null;
      if (action === "ecarter") p.statut = "ecartee";
      else {
        if (p.type === "contradiction" || p.type === "modif") {
          const ancien = items.get(p.cibleId);
          if (ancien) { const avant = { texte: ancien.texte, titre: ancien.titre || "" }; ancien.archive = true; ancien.remplace = true; await sauver(ancien); await ecrireJournal("archiver", ancien, avant, "lucien"); }
          res = await m.confirmer({ type: "sem", texte, cle: "", origine: "lucien (tri de la boîte À valider)", importance: 7 });
        } else {
          const type = p.type === "lecon" ? "pro" : p.type === "actualite" ? "kb" : p.type;
          res = await m.confirmer({ type, texte, titre: p.titre, source: p.source, actualite: p.type === "actualite", theme: p.theme, verifie: !!(p.theme && p.source && type === "kb"), origine: p.type === "kb" ? "source : " + (p.origine || "conversation") : "lucien (tri de la boîte À valider)" });
        }
        p.statut = "acceptee";
      }
      p.tranche = maintenant(); await hote.stockage.ecrire("kv", p); return res;
    },

    /** Retour arrière : restaure l'ancienne version d'un élément modifié ou archivé (journal en ajout seul). */
    async restaurer(ligneId) {
      const l = (await journalMemoire.lire({ limite: 5000 })).find((x) => x.id === ligneId);
      if (!l || !l.avant) throw new Error("Cette ligne n'a pas d'ancienne version");
      const it = items.get(l.id); if (!it) throw new Error("Élément introuvable");
      const avant = { texte: it.texte, titre: it.titre || "" };
      it.texte = l.avant.texte; it.titre = l.avant.titre || it.titre; it.archive = false; delete it.remplace;
      index.ajouter(it.id, texteIndex(it)); await sauver(it); await ecrireJournal("restaurer", it, avant, "lucien"); return it;
    },

    /** Pour le sommeil : épisodes depuis une date, faits datés trop vieux, fiches d'actualité périmées. */
    episodesDepuis: (ms) => [...items.values()].filter((it) => it.type === "epi" && it.cree >= ms).sort((a, b) => a.cree - b.cree),
    faitsAChallenger: () => [...items.values()].filter((it) => it.type === "sem" && !it.archive && /\b(en cours|actuellement|cette semaine|ce mois|en ce moment|projet)\b/i.test(it.texte) && jours(it.cree) > FAIT_DATE),

    /** Import en bloc (import v3.8) : écrit tout en une seule opération et indexe. */
    async importer(liste, origine = "import v3.8") {
      liste.forEach(ajouterLocal);
      await hote.stockage.ecrireMany("kv", liste);
      await journalMemoire.ecrire({ action: "importer", id: "(lot)", type: "lot", avant: null, apres: { n: liste.length }, origine });
    },
    /** Annule un import raté : retire seulement ce lot (aucun outil du modèle n'y a accès). */
    async annulerLot(ids) {
      ids.forEach((id) => { items.delete(id); index.retirer(id); });
      await hote.stockage.retirerMany("kv", ids);
      await journalMemoire.ecrire({ action: "annuler_import", id: "(lot)", type: "lot", avant: null, apres: { n: ids.length }, origine: "import v3.8" });
    }
  };
  return m;
}
