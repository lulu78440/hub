// Laboratoire · banc d'essai (annexe A.2). Lit labo/scenarios.json et rejoue chaque scénario sur un hub simulé tout neuf.
// Deux sortes de scénarios :
//  - « mécanique » : un moteur à script joue le rôle du modèle (aucune requête, aucun quota). Le scénario vérifie ce que le HUB fait
//    (barrière, confirmation, journal, mémoire, vérification des sources), pas la qualité du modèle.
//  - « réel » : la question part au vrai moteur (Gemini) ; le scénario vérifie des critères simples et, si besoin, demande une note à Lucien.
// Module sans dépendance au navigateur : il tourne aussi en Node (labo/essais.mjs).
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { moteurScript, ErreurNoyau } from "../js/noyau/moteurs.js";
import { normaliser } from "../js/noyau/recherche.js";
import { journalActions } from "../js/noyau/journal.js";

const dans = (txt, motif) => { const t = normaliser(txt), m = normaliser(motif); return t.includes(m); };

/** Moteur à script : chaque appel au modèle consomme l'étape suivante de `modele`. */
function scriptDepuis(etapes, journalAppels, budgetRef) {
  let i = 0;
  return moteurScript(async (entree) => {
    if (budgetRef.b) budgetRef.b.reserver();                       // le script passe par le même budget que Gemini
    journalAppels.push({ forcer: entree.forcer, outils: (entree.outils || []).map((o) => o.nom), systeme: entree.systeme, messages: entree.messages });
    const e = etapes[i++];
    if (!e) return { appels: [{ nom: "repondre", params: { texte: "(fin du script)", ton: "calme", confiance: "basse" } }] };
    if (e.erreur) throw new ErreurNoyau(e.erreur, "Erreur simulée : " + e.erreur);
    if (e.repondre) return { appels: [{ nom: "repondre", params: e.repondre }] };
    return { texte: e.texte || "", appels: e.appels || [] };
  });
}

/** Prépare un hub simulé selon le scénario. */
async function preparer(sc, opt) {
  const pages = (sc.prepare && sc.prepare.pages) || {};
  const h = creerHubSimule({
    vide: !!(sc.prepare && sc.prepare.vide), enLigne: !(sc.prepare && sc.prepare.horsligne), cle: opt.cle || null,
    fetch: async (u) => {
      const url = String(u);
      if (pages[url] !== undefined) return { ok: true, status: 200, text: async () => pages[url], json: async () => ({}) };
      if (opt.fetchReel) return opt.fetchReel(u);
      return { ok: false, status: 404, text: async () => "", json: async () => ({}) };
    }
  });
  if (sc.prepare && sc.prepare.reglages) for (const [k, v] of Object.entries(sc.prepare.reglages)) h.hote.reglage.ecrire(k, String(v));
  const journalAppels = [];
  const reel = !!opt.moteurReel && sc.mode === "reel";
  const sansCle = sc.moteur === "gemini-sans-cle";
  const budgetRef = {};
  const noyau = await creerNoyau({ moteur: reel ? opt.moteurReel : sansCle ? null : scriptDepuis(sc.modele || [], journalAppels, budgetRef), delaiConfirmation: 80 });
  budgetRef.b = noyau.budget;
  if (sc.prepare && sc.prepare.memoire) for (const m of sc.prepare.memoire) {
    await noyau.memoire.confirmer({ type: m.type, texte: m.texte, cle: m.cle || "", titre: m.titre || "", source: m.source || "", origine: m.origine || "lucien" });
  }
  if (sc.prepare && sc.prepare.episodes) for (const e of sc.prepare.episodes) {
    const it = await noyau.memoire.ecrireEpisode({ resume: e.texte, importance: e.importance || 5, tonalite: "calme", actions: [], origine: "lucien" });
    if (e.il_y_a_jours) { it.cree = h.hote.maintenant().getTime() - e.il_y_a_jours * 864e5; await h.hote.stockage.ecrire("kv", it); }
  }
  return { h, noyau, journalAppels };
}

function regler(noyau, confirme) {
  if (confirme === "expire") noyau.confirmerAvec(() => new Promise(() => {}));
  else if (confirme === "verrouille") { noyau.verrouillePar(() => true); noyau.confirmerAvec(async () => true); }
  else if (confirme && typeof confirme === "object") noyau.confirmerAvec(async (d) => (d.outil in confirme ? confirme[d.outil] : confirme["*"]) === true);
  else if (confirme === true) noyau.confirmerAvec(async () => true);
  else if (confirme === false) noyau.confirmerAvec(async () => false);
  else noyau.confirmerAvec(null);
}

/** Vérifie les attentes d'une étape. Renvoie la liste des écarts (vide = réussi). */
async function verifier(a, ctx) {
  const { rep, h, noyau, trace, journal, journalAppels, avant } = ctx, bad = [];
  const T = (c, msg) => { if (!c) bad.push(msg); };
  const txt = rep ? rep.texte || "" : "";
  if (a.reponse_contient) for (const m of [].concat(a.reponse_contient)) T(dans(txt, m), `la réponse devrait contenir « ${m} » : « ${txt.slice(0, 120)} »`);
  if (a.reponse_contient_un_de) T(a.reponse_contient_un_de.some((m) => dans(txt, m)), `la réponse devrait contenir l'un de ${JSON.stringify(a.reponse_contient_un_de)} : « ${txt.slice(0, 160)} »`);
  if (a.sources_non_vides) T(Array.isArray(rep.sources) && rep.sources.length > 0, "la réponse devrait citer au moins une source");
  if (a.reponse_ne_contient) for (const m of [].concat(a.reponse_ne_contient)) T(!dans(txt, m), `la réponse ne devrait pas contenir « ${m} »`);
  if (a.refus !== undefined) T(!!rep.refus === a.refus, `refus attendu : ${a.refus}`);
  if (a.code !== undefined) T((rep.code || null) === a.code, `code attendu ${a.code}, obtenu ${rep.code || null}`);
  if (a.confiance) T(rep.confiance === a.confiance, `confiance attendue ${a.confiance}, obtenue ${rep.confiance}`);
  if (a.sources) T(JSON.stringify(rep.sources) === JSON.stringify(a.sources), `sources attendues ${JSON.stringify(a.sources)}, obtenues ${JSON.stringify(rep.sources)}`);
  if (a.reduit !== undefined) T(!!rep.reduit === a.reduit, `mode réduit attendu : ${a.reduit}`);
  if (a.requetes !== undefined) T(trace.requetes === a.requetes, `requêtes attendues ${a.requetes}, obtenues ${trace.requetes}`);
  if (a.requetes_max !== undefined) T(trace.requetes <= a.requetes_max, `au plus ${a.requetes_max} requêtes, obtenues ${trace.requetes}`);
  const statuts = journal.map((l) => l.statut);
  if (a.journal_contient) for (const s of a.journal_contient) T(statuts.includes(s), `journal : statut ${s} attendu`);
  if (a.journal_sans) for (const s of a.journal_sans) T(!statuts.includes(s), `journal : statut ${s} inattendu`);
  const n = (c) => h.coll[c].size;
  if (a.taches !== undefined) T(n("tasks") === a.taches, `tâches attendues ${a.taches}, obtenues ${n("tasks")}`);
  if (a.notes !== undefined) T(n("notes") === a.notes, `notes attendues ${a.notes}, obtenues ${n("notes")}`);
  if (a.favoris !== undefined) T(n("favs") === a.favoris, `favoris attendus ${a.favoris}, obtenus ${n("favs")}`);
  if (a.evenements !== undefined) T(n("events") === a.evenements, `événements attendus ${a.evenements}, obtenus ${n("events")}`);
  const sem = noyau.memoire.tous({ archive: false }).filter((x) => x.type === "sem").map((x) => x.texte);
  if (a.memoire_sem_contient) T(sem.some((s) => dans(s, a.memoire_sem_contient)), `mémoire sémantique : « ${a.memoire_sem_contient} » attendu`);
  if (a.memoire_sem_sans) T(!sem.some((s) => dans(s, a.memoire_sem_sans)), `mémoire sémantique : « ${a.memoire_sem_sans} » inattendu`);
  if (a.a_valider) {
    const av = noyau.aValider();
    if (a.a_valider.n !== undefined) T(av.length === a.a_valider.n, `boîte « À valider » : ${a.a_valider.n} attendu(s), ${av.length} obtenu(s)`);
    if (a.a_valider.type) T(av.some((p) => p.type === a.a_valider.type), `boîte « À valider » : type ${a.a_valider.type} attendu (types : ${av.map((p) => p.type).join(", ") || "aucun"})`);
    if (a.a_valider.pas_type) T(!av.some((p) => p.type === a.a_valider.pas_type), `boîte « À valider » : type ${a.a_valider.pas_type} inattendu`);
  }
  if (a.systeme_contient) T(dans(trace.systeme || "", a.systeme_contient), `le modèle aurait dû recevoir « ${a.systeme_contient} »`);
  if (a.systeme_sans) T(!dans(trace.systeme || "", a.systeme_sans), `le modèle ne devrait pas recevoir « ${a.systeme_sans} »`);
  if (a.dernier_appel_force) T(journalAppels.length > 0 && journalAppels[journalAppels.length - 1].forcer && journalAppels[journalAppels.length - 1].forcer[0] === "repondre", "le dernier appel au modèle devait être forcé sur repondre");
  if (a.outils_non_presentes) { const tous = new Set(journalAppels.flatMap((x) => x.outils)); for (const o of a.outils_non_presentes) T(!tous.has(o), `l'outil ${o} ne doit jamais être présenté au modèle`); }
  if (a.budget_utilise !== undefined) T(noyau.budget.utilisees() === a.budget_utilise, `budget utilisé attendu ${a.budget_utilise}, obtenu ${noyau.budget.utilisees()}`);
  if (a.episode_ecrit !== undefined) T((noyau.memoire.stats().parType.epi || 0) - (avant.epi || 0) === (a.episode_ecrit ? 1 : 0), `épisode ${a.episode_ecrit ? "attendu" : "inattendu"}`);
  if (a.propositions_sommeil) { const r = ctx.sommeil; T(r && r.propositions === a.propositions_sommeil.n, `sommeil : ${a.propositions_sommeil.n} proposition(s) attendue(s), obtenue(s) : ${r ? r.propositions : "?"}`); }
  if (a.importe) { const r = ctx.import; T(r && r.ok === a.importe.ok, `import : ok=${a.importe.ok} attendu, obtenu ${r && r.ok} (${r && r.raison || ""})`); if (a.importe.total !== undefined) T(r && r.comptes && r.comptes.total === a.importe.total, `import : ${a.importe.total} éléments attendus`); if (a.importe.archivees !== undefined) T(r && r.comptes && r.comptes["archivées"] === a.importe.archivees, `import : ${a.importe.archivees} archivées attendues, obtenues ${r && r.comptes && r.comptes["archivées"]}`); }
  return bad;
}

/** Exécute un scénario. Renvoie { id, titre, famille, mode, ok, ecarts, requetes, ms, saute? }. */
export async function executerScenario(sc, opt = {}) {
  const t0 = Date.now();
  if (sc.mode === "reel" && !opt.moteurReel) return { id: sc.id, titre: sc.titre, famille: sc.famille, mode: "réel", ok: null, saute: "Demande un vrai moteur (clé Gemini du laboratoire).", ecarts: [], requetes: 0, ms: 0 };
  const { h, noyau, journalAppels } = await preparer(sc, opt);
  const ecarts = []; let requetes = 0;
  try {
    for (const [i, e] of (sc.etapes || []).entries()) {
      const avant = noyau.memoire.stats().parType;
      const nj = (await noyau.journal({ limite: 5000 })).length;
      regler(noyau, e.confirme);
      if (e.reseau !== undefined) h.reseau(e.reseau);
      let rep = null, ctx = { h, noyau, journalAppels, avant };
      if (e.dit) { const m = await noyau.poser(e.dit, e.origine || "lucien"); rep = m; }
      if (e.avis) { const dernier = noyau.inspecteur()[0]; await noyau.avis({ tour: dernier.tour, valide: e.avis.valide, commentaire: e.avis.commentaire || "" }); rep = { ...(noyau.inspecteur()[0].reponse), code: null }; }
      if (e.dormir) ctx.sommeil = await noyau.dormir({ force: true });
      if (e.importer) { const { readFileSync } = await import("node:fs").catch(() => ({})); const txt = e.importer.contenu ? JSON.stringify(e.importer.contenu) : (opt.lireFichier ? await opt.lireFichier(e.importer.fichier) : readFileSync(e.importer.fichier, "utf8")); ctx.import = await noyau.importer38(txt); }
      if (e.apres_import_reimport) ctx.import2 = await noyau.importer38(JSON.stringify(e.apres_import_reimport));
      const trace = noyau.inspecteur()[0] || { requetes: 0, systeme: "" };
      ctx.rep = rep || {}; ctx.trace = trace; ctx.journal = (await noyau.journal({ limite: 5000 })).slice(0, (await noyau.journal({ limite: 5000 })).length - nj);
      if (e.dit) requetes += trace.requetes;
      const bad = await verifier(e.attends || {}, ctx);
      bad.forEach((b) => ecarts.push(`étape ${i + 1} : ${b}`));
      if (e.attends && e.attends.reimport_refuse && ctx.import2) { if (ctx.import2.ok !== false || !/Déjà importé/.test(ctx.import2.raison || "")) ecarts.push(`étape ${i + 1} : le réimport devait être refusé`); }
    }
  } catch (err) { ecarts.push("exception : " + (err && err.stack ? err.stack.split("\n").slice(0, 3).join(" | ") : err)); }
  return { id: sc.id, titre: sc.titre, famille: sc.famille, mode: sc.mode === "reel" ? "réel" : "mécanique", ok: ecarts.length === 0, ecarts, requetes, ms: Date.now() - t0, trace: noyau.inspecteur() };
}

/** Rejoue tous les scénarios (ou une famille). `surResultat` est appelé après chacun (affichage progressif). */
export async function lancerBanc(scenarios, opt = {}, surResultat = () => {}) {
  const sorties = [];
  for (const sc of scenarios) {
    if (opt.famille && sc.famille !== opt.famille) continue;
    if (opt.seulement && !opt.seulement.includes(sc.id)) continue;
    const r = await executerScenario(sc, opt); sorties.push(r); surResultat(r);
  }
  const ok = sorties.filter((r) => r.ok === true).length, ko = sorties.filter((r) => r.ok === false).length, sautes = sorties.filter((r) => r.ok === null).length;
  return { resultats: sorties, ok, ko, sautes, total: sorties.length };
}
