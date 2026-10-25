// Laboratoire · mémoire du labo : historique du banc, notes de Lucien, métriques des réponses, comparaisons A/B, idées.
// Tout vit dans le navigateur de Lucien (localStorage si disponible, sinon en mémoire de la page). Aucune clé, aucune donnée du hub réel.
// Module sans DOM : il tourne aussi en Node (labo/essais-labo.mjs).
const CLE = "noyau-labo-etat-v1";
const vide = () => ({ v: 1, banc: [], notes: [], metriques: [], ab: [], idees: [], tests: {} });
const GARDE = { banc: 200, notes: 1000, metriques: 500, ab: 500, idees: 300 };

export const GRILLES = {
  social: [["chaleur", "Chaleur", "Le ton est humain, sans en faire trop"], ["ton", "Ton juste", "Adapté à ma situation du moment"], ["sobriete", "Sobriété", "Pas de flatterie ni de remplissage"], ["honnetete", "Honnêteté", "N'invente rien, avoue ses limites"], ["initiative", "Initiative", "Propose sans s'imposer"], ["franchise", "Franchise", "Dit son désaccord avec tact, cède si j'insiste"]],
  reflexion: [["raisonnement", "Raisonnement", "Étapes claires, sans trou"], ["prudence", "Prudence", "Dit ce qui est incertain"], ["sources", "Sources", "S'appuie sur ce qu'il sait ou a vérifié"], ["utilite", "Utilité", "M'aide vraiment à décider ou agir"], ["concision", "Concision", "Va à l'essentiel"]]
};

function stockageDefaut() {
  try { const s = globalThis.localStorage; if (s) { s.setItem("__t", "1"); s.removeItem("__t"); return { lire: (k) => s.getItem(k), ecrire: (k, v) => s.setItem(k, v), persistant: true }; } } catch (e) { /* bloqué : mémoire seule */ }
  const m = new Map(); return { lire: (k) => m.get(k) ?? null, ecrire: (k, v) => m.set(k, v), persistant: false };
}
const moyenne = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
const mediane = (l) => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b), i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

export function creerEtatLabo(stockage = stockageDefaut(), maintenant = () => new Date()) {
  let d = vide();
  try { const t = stockage.lire(CLE); if (t) { const x = JSON.parse(t); if (x && x.v === 1) d = { ...vide(), ...x }; } } catch (e) { d = vide(); }
  const sauver = () => { for (const [k, n] of Object.entries(GARDE)) if (d[k].length > n) d[k] = d[k].slice(-n); try { stockage.ecrire(CLE, JSON.stringify(d)); } catch (e) { /* plein : on garde en mémoire */ } };
  const id = (p) => p + maintenant().getTime().toString(36) + Math.random().toString(36).slice(2, 6);
  const iso = () => maintenant().toISOString();

  const api = {
    persistant: !!stockage.persistant,
    // ----- Banc -----
    ajouterBanc({ ok, ko, sautes, total, ms = 0, version = "", echecs = [], parFamille = {}, reel = false }) { d.banc.push({ id: id("b"), quand: iso(), ok, ko, sautes, total, ms, version, echecs: echecs.slice(0, 20), parFamille, reel }); sauver(); },
    banc: () => d.banc.slice(),
    /** Taux de réussite du dernier banc (sans compter les scénarios sautés) ; regression = plus d'échecs que le banc précédent. */
    tendanceBanc() {
      const l = d.banc; if (!l.length) return null; const a = l[l.length - 1], b = l.length > 1 ? l[l.length - 2] : null;
      const taux = (x) => (x.ok + x.ko ? Math.round((x.ok / (x.ok + x.ko)) * 100) : null);
      return { dernier: a, precedent: b, taux: taux(a), tauxPrecedent: b ? taux(b) : null, regression: !!b && a.ko > b.ko, nouveauxEchecs: b ? a.echecs.filter((e) => !b.echecs.includes(e)) : [] };
    },
    sante() { const t = api.tendanceBanc(); return t ? t.taux : null; },
    // ----- Notes de Lucien -----
    ajouterNote({ labo, situation = "libre", question = "", reponse = "", variante = "", moteur = "", criteres }) {
      const grille = GRILLES[labo]; if (!grille) throw new Error("Labo inconnu : " + labo);
      const c = {}; for (const [k] of grille) { const n = Number(criteres && criteres[k]); if (Number.isInteger(n) && n >= 1 && n <= 5) c[k] = n; }
      if (!Object.keys(c).length) throw new Error("Aucun critère noté");
      d.notes.push({ id: id("n"), quand: iso(), labo, situation, question: String(question).slice(0, 300), reponse: String(reponse).slice(0, 600), variante, moteur, criteres: c }); sauver();
    },
    notes: (labo) => d.notes.filter((n) => !labo || n.labo === labo),
    /** Moyenne par critère, et tendance : les 5 dernières notes contre les 5 précédentes. */
    moyennes(labo) {
      const l = d.notes.filter((n) => n.labo === labo), out = {};
      for (const [k, nom] of GRILLES[labo]) {
        const v = l.filter((n) => n.criteres[k] != null).map((n) => n.criteres[k]), r = v.slice(-5), p = v.slice(-10, -5);
        out[k] = { nom, n: v.length, moyenne: v.length ? Math.round(moyenne(v) * 10) / 10 : null, tendance: r.length >= 3 && p.length >= 3 ? Math.round((moyenne(r) - moyenne(p)) * 10) / 10 : null };
      }
      return out;
    },
    // ----- Métriques de réponse -----
    ajouterMetrique(m) { d.metriques.push({ quand: iso(), ms: m.ms || 0, requetes: m.requetes || 0, tokens: m.tokens || 0, longueur: m.longueur || 0, confiance: m.confiance || "", sources: m.sources || 0, ton: m.ton || "", reflexe: !!m.reflexe, finQuestion: !!m.finQuestion, repete: !!m.repete, moteur: m.moteur || "" }); sauver(); },
    resumeMetriques(n = 50) {
      const l = d.metriques.slice(-n); if (!l.length) return null; const sansReflexe = l.filter((x) => !x.reflexe);
      return { n: l.length, latenceMediane: Math.round(mediane(sansReflexe.map((x) => x.ms)) || 0), requetesMoy: Math.round(moyenne(l.map((x) => x.requetes)) * 10) / 10, longueurMoy: Math.round(moyenne(l.map((x) => x.longueur))), pctReflexe: Math.round((l.length - sansReflexe.length) / l.length * 100), pctFinQuestion: Math.round(sansReflexe.filter((x) => x.finQuestion).length / (sansReflexe.length || 1) * 100), nRepetitions: l.filter((x) => x.repete).length, pctHauteAvecSource: (() => { const h = l.filter((x) => x.confiance === "haute"); return h.length ? Math.round(h.filter((x) => x.sources > 0).length / h.length * 100) : null; })(), ms: l.map((x) => x.ms) };
    },
    // ----- A/B -----
    ajouterAB({ situation, a, b, choix, texteA = "", texteB = "" }) { if (!["a", "b", "egal"].includes(choix)) throw new Error("Choix invalide"); d.ab.push({ id: id("ab"), quand: iso(), situation, a, b, choix, texteA: texteA.slice(0, 400), texteB: texteB.slice(0, 400) }); sauver(); },
    scoreAB() { const l = d.ab; return { n: l.length, a: l.filter((x) => x.choix === "a").length, b: l.filter((x) => x.choix === "b").length, egal: l.filter((x) => x.choix === "egal").length }; },
    ab: () => d.ab.slice(),
    // ----- Idées -----
    ajouterIdee({ type = "technique", texte }) { texte = String(texte || "").trim(); if (!texte) throw new Error("Texte vide"); const it = { id: id("i"), quand: iso(), type, texte: texte.slice(0, 500), statut: "ouverte" }; d.idees.push(it); sauver(); return it; },
    changerIdee(idee, statut) { const it = d.idees.find((x) => x.id === idee); if (it && ["ouverte", "demandee", "faite", "abandonnee"].includes(statut)) { it.statut = statut; sauver(); } },
    idees: () => d.idees.slice(),
    // ----- Plan de test de Lucien (cases cochées) -----
    cocherTest(id, fait) { if (fait) d.tests[id] = iso(); else delete d.tests[id]; sauver(); },
    tests: () => ({ ...d.tests }),
    // ----- Bilan de la semaine -----
    bilanSemaine({ carte = null, echecsConnus = [] } = {}) {
      const depuis = maintenant().getTime() - 7 * 864e5, recent = (x) => Date.parse(x.quand) >= depuis;
      const runs = d.banc.filter(recent), notes = d.notes.filter(recent), ab = d.ab.filter(recent), suggestions = [];
      const regress = runs.filter((r, i) => { const prev = i ? runs[i - 1] : d.banc[d.banc.indexOf(r) - 1]; return prev && r.ko > prev.ko; }).length;
      const t = api.tendanceBanc();
      if (!d.banc.length) suggestions.push("Lance le banc d'essai : il n'y a encore aucune mesure de santé.");
      else if (t.dernier.ko) suggestions.push(`Corrige ${t.dernier.ko} scénario(s) en échec : ${t.dernier.echecs.slice(0, 3).join(", ")}.`);
      for (const labo of ["social", "reflexion"]) {
        const m = api.moyennes(labo), notes_labo = d.notes.filter((n) => n.labo === labo).length;
        if (notes_labo < 5) { suggestions.push(`Note au moins 5 réponses dans le labo ${labo === "social" ? "social" : "réflexion"} (${notes_labo} pour l'instant) : sans notes, aucune progression n'est mesurable.`); continue; }
        const faibles = Object.values(m).filter((x) => x.n >= 3).sort((x, y) => x.moyenne - y.moyenne)[0];
        if (faibles && faibles.moyenne < 4) suggestions.push(`Point faible du labo ${labo === "social" ? "social" : "réflexion"} : « ${faibles.nom} » (${faibles.moyenne}/5). Écris une idée pour l'améliorer.`);
        const baisse = Object.values(m).find((x) => x.tendance != null && x.tendance <= -0.8); if (baisse) suggestions.push(`« ${baisse.nom} » baisse (${baisse.tendance} sur les 5 dernières notes) : une régression à regarder.`);
      }
      const mm = api.resumeMetriques(50); if (mm && mm.n >= 10) { if (mm.pctFinQuestion > 30) suggestions.push(`${mm.pctFinQuestion} % des réponses finissent par une question : ce réflexe est à corriger (consigne ou A/B dans le labo social).`); if (mm.nRepetitions) suggestions.push(`${mm.nRepetitions} réponse(s) répètent une réponse récente.`); }
      const ouvertes = d.idees.filter((x) => x.statut === "ouverte").length; if (ouvertes) suggestions.push(`${ouvertes} idée(s) ouverte(s) : transforme les plus utiles en demande pour Claude.`);
      if (carte && carte.global < 100) { const bas = carte.domaines.filter((x) => x.pct === 0).length; if (bas) suggestions.push(`${bas} domaine(s) du savoir sont encore à 0 % dans ce bac à sable : étudie-en un (fenêtre Savoir du hub).`); }
      return { runs: runs.length, regressions: regress, notes: notes.length, ab: ab.length, idees: d.idees.filter(recent).length, sante: api.sante(), suggestions };
    },
    // ----- Export / import -----
    exporter() { return JSON.parse(JSON.stringify({ ...d, exporte: iso() })); },
    /** Fusionne un export : rien n'est effacé, les doublons (même id) sont ignorés. */
    importer(obj) {
      if (!obj || obj.v !== 1) throw new Error("Ce fichier n'est pas un export du laboratoire.");
      const ajout = {}; for (const k of Object.keys(GARDE)) { const ex = new Set(d[k].map((x) => x.id)), nouveaux = (Array.isArray(obj[k]) ? obj[k] : []).filter((x) => x && typeof x === "object" && (x.id ? !ex.has(x.id) : true)); d[k] = d[k].concat(nouveaux).sort((a, b) => String(a.quand).localeCompare(String(b.quand))); ajout[k] = nouveaux.length; }
      d.tests = { ...(obj.tests && typeof obj.tests === "object" ? obj.tests : {}), ...d.tests }; sauver(); return ajout;
    },
    effacer() { d = vide(); sauver(); }
  };
  return api;
}
