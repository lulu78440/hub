// Noyau · import de la mémoire de l'application v3.8 (contrat, section 8), sans perte et vérifié.
// Règles : tout est importé ; comptage et empreinte SHA-256 AVANT et APRÈS (s'il manque une unité ou si une seule lettre a changé,
// l'import entier est annulé) ; identifiants renumérotés (les identifiants de l'application, en double, ne servent plus de clé) ;
// qualité marquée, rien supprimé ; un second import est refusé. Le fichier est choisi par Lucien : il n'est jamais dans le dépôt.
import { hote } from "./hote.js";
import { journalMemoire } from "./journal.js";

const SEP = "␟";
const MARQUEUR = "noyau-import-38";

export async function sha256Hex(texte) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const dateFr = (s) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || "")); return m ? new Date(+m[3], +m[2] - 1, +m[1], 12).getTime() : null; };
const TONALITE = { CURIOSITE: "curieux", SERENITE: "calme", NOSTALGIE: "calme", EMPATHIE: "calme", JOIE: "enthousiaste", ENTHOUSIASME: "enthousiaste", INQUIETUDE: "preoccupe" };

// Qualité des fiches (audit de la v3.8, refait sur le fichier reçu : le contrat annonçait 203 fiches creuses, ce fichier en contient davantage)
const RE_EXPLORATION = /Exploration autonome|extraite? en autonomie par le Noyau/i;
const RE_ACTU_FABRIQUEE = /^(Presse France\s*:|Actualité Monde\s*:|Sources d'Actualité de Référence)/i;
const CAT_ACTU = /^(Investigation & Actualités France|Actualités|Actualités & Médias)$/i;
const RE_SOURCE_REELLE = /^(Ouvrage de référence répertorié dans OpenLibrary|Publication académique indexée|Veille technologique HackerNews|Ressource technique indexée|Étude biomédicale et neuroscientif|Observation atmosphérique temps réel)/;
const RE_WIKI = /^Wikipedia (FR|EN|Local)\s*:/i;

export function classerFiche(k) {
  const topic = String(k.topic || ""), sum = String(k.summary || ""), cat = String(k.category || ""), url = String(k.sourceUrl || "");
  if (RE_EXPLORATION.test(topic) || RE_EXPLORATION.test(sum)) return { qualite: "archivée", motif: "fiche d'exploration autonome sans contenu réel (texte de modèle)" };
  if (RE_ACTU_FABRIQUEE.test(topic) || CAT_ACTU.test(cat)) return { qualite: "archivée", motif: "actualité fabriquée par l'application (jamais interrogée à la source)" };
  if (RE_SOURCE_REELLE.test(sum)) return { qualite: "vérifiée", motif: "enregistrement tiré d'une source réellement interrogée", actualite: /Observation atmosphérique/.test(sum) };
  if (RE_WIKI.test(topic) && /wikipedia\.org/.test(url)) return { qualite: "vérifiée", motif: "extrait d'article Wikipedia" };
  return { qualite: "non vérifiée", motif: "texte écrit dans le code ou ajouté à la main, source jamais interrogée" };
}

/** Lit et contrôle le fichier de sauvegarde. */
export function lireSauvegarde(texte) {
  let d; try { d = JSON.parse(texte); } catch (e) { throw new Error("Ce fichier n'est pas un JSON valide."); }
  if (!d || typeof d !== "object" || !Array.isArray(d.memories) || !Array.isArray(d.knowledgeBase) || !Array.isArray(d.localWikipediaVault)) throw new Error("Ce n'est pas une sauvegarde du Noyau v3.8 (memories, knowledgeBase et localWikipediaVault attendus).");
  return d;
}

const aplatir = (v) => Array.isArray(v) ? v.map(aplatir).join(" ") : v && typeof v === "object" ? Object.values(v).map(aplatir).join(" ") : v == null ? "" : String(v);

/** Transforme la sauvegarde en éléments de mémoire (pur : n'écrit rien). */
export function preparer(d) {
  const items = []; const num = (n) => String(n).padStart(4, "0");
  d.memories.forEach((m, i) => {
    const epi = m.category === "SOUVENIR_EPISODIQUE", base = { titre: String(m.key ?? ""), texte: String(m.value ?? ""), origine: "import v3.8", confiance: "moyenne", cree: dateFr(m.timestamp) || 0, dernierRappel: null, importance: Math.min(Math.max(Math.round((+m.vividness || 50) / 10), 1), 10), tonalite: TONALITE[m.emotion] || "calme", categorieSource: m.category, import38: true, src: { section: "m", origId: String(m.id), rang: i } };
    items.push(epi ? { ...base, id: "noyau-epi-v38-" + num(i), type: "epi" } : { ...base, id: "noyau-sem-v38-" + num(i), type: "sem", cle: base.titre });
  });
  d.knowledgeBase.forEach((k, i) => {
    const c = classerFiche(k);
    items.push({ id: "noyau-kb-v38-" + num(i), type: "kb", titre: String(k.topic ?? ""), texte: String(k.summary ?? ""), source: String(k.sourceUrl || ""), url: k.sourceUrl || null, categorieSource: k.category, origine: "import v3.8", confiance: c.qualite === "vérifiée" ? "haute" : "basse", verifie: c.qualite === "vérifiée", archive: c.qualite === "archivée", qualite: c.qualite, motif: c.motif, actualite: !!c.actualite, importance: 5, cree: dateFr(k.timestamp) || 0, dernierRappel: null, import38: true, src: { section: "k", origId: String(k.id), rang: i } });
  });
  d.localWikipediaVault.forEach((w, i) => {
    items.push({ id: "noyau-wiki-v38-" + num(i), type: "wiki", titre: String(w.title ?? ""), texte: String(w.extract ?? ""), complet: aplatir(w.fullSections), source: String(w.url || ""), url: w.url || null, categorieSource: w.category, origine: "import v3.8", confiance: "haute", verifie: true, importance: 5, cree: dateFr(w.cachedAt) || 0, dernierRappel: null, import38: true, src: { section: "w", origId: String(w.id), rang: i } });
  });
  return items;
}

const ligne = (it) => `${it.src.section}|${it.src.origId}#${it.src.rang}|${it.titre}${SEP}${it.texte}`;
/** Empreinte d'un lot : SHA-256 des lignes (section, identifiant d'origine, rang, texte exact) triées. */
export async function empreinte(items) { return sha256Hex(items.map(ligne).sort().join("\n")); }
/** Empreinte calculée directement sur le fichier, indépendamment de `preparer` (contrôle croisé). */
export async function empreinteSource(d) {
  const L = [];
  d.memories.forEach((m, i) => L.push(`m|${m.id}#${i}|${m.key ?? ""}${SEP}${m.value ?? ""}`));
  d.knowledgeBase.forEach((k, i) => L.push(`k|${k.id}#${i}|${k.topic ?? ""}${SEP}${k.summary ?? ""}`));
  d.localWikipediaVault.forEach((w, i) => L.push(`w|${w.id}#${i}|${w.title ?? ""}${SEP}${w.extract ?? ""}`));
  return sha256Hex(L.sort().join("\n"));
}

export function resumer(items) {
  const r = { total: items.length, souvenirs: 0, faits: 0, fiches: 0, vérifiées: 0, nonVérifiées: 0, archivées: 0, articles: 0, identifiantsEnDouble: 0 };
  const vus = new Map();
  for (const it of items) {
    if (it.type === "epi") r.souvenirs++; else if (it.type === "sem") r.faits++; else if (it.type === "wiki") r.articles++;
    else { r.fiches++; if (it.qualite === "vérifiée") r["vérifiées"]++; else if (it.qualite === "archivée") r["archivées"]++; else r["nonVérifiées"]++; }
    const cle = it.src.section + ":" + it.src.origId; vus.set(cle, (vus.get(cle) || 0) + 1);
  }
  r.identifiantsEnDouble = [...vus.values()].filter((n) => n > 1).length;
  return r;
}

/** Aperçu avant import : aucun effet. */
export async function apercu(d) {
  const items = preparer(d), avant = await empreinte(items), croisee = await empreinteSource(d);
  return { items, resume: resumer(items), empreinte: avant, empreinteSource: croisee, coherent: avant === croisee };
}

/**
 * Importe la mémoire. Étapes : contrôle avant → écriture en un seul lot → relecture → contrôle après → annulation si une unité manque.
 * @returns {ok, raison?, comptes, empreinteAvant, empreinteApres}
 */
export async function importer(memoire, d, { surEtape = () => {} } = {}) {
  const marque = await hote.stockage.lire("kv", MARQUEUR);
  if (marque) return { ok: false, raison: `Déjà importé le ${marque.quand.slice(0, 10)} (empreinte ${marque.empreinte.slice(0, 12)}…). Un second import est refusé pour ne rien dupliquer.` };
  surEtape("Contrôle du fichier");
  const items = preparer(d), avant = await empreinte(items);
  if (avant !== await empreinteSource(d)) return { ok: false, raison: "Contrôle croisé en échec avant l'écriture : rien n'a été importé." };
  const existants = new Set((await hote.stockage.tout("kv")).map((x) => x.id));
  const clash = items.find((it) => existants.has(it.id));
  if (clash) return { ok: false, raison: "Un identifiant existe déjà (" + clash.id + ") : rien n'a été importé." };
  surEtape("Écriture (" + items.length + " éléments)");
  await memoire.importer(items);
  surEtape("Relecture et vérification");
  const relus = (await hote.stockage.tout("kv")).filter((x) => x.import38 === true && x.src);
  const apres = await empreinte(relus);
  if (relus.length !== items.length || apres !== avant) {
    await memoire.annulerLot(items.map((it) => it.id));
    return { ok: false, annule: true, raison: `Vérification en échec (${relus.length} éléments relus sur ${items.length}, empreinte ${apres === avant ? "identique" : "différente"}) : import annulé, rien n'a été gardé.`, comptes: resumer(items), empreinteAvant: avant, empreinteApres: apres };
  }
  await hote.stockage.ecrire("kv", { id: MARQUEUR, quand: hote.maintenant().toISOString(), empreinte: avant, comptes: resumer(items) });
  await journalMemoire.ecrire({ action: "import_verifie", id: "(lot)", type: "lot", avant: null, apres: { n: items.length, empreinte: avant }, origine: "import v3.8" });
  return { ok: true, comptes: resumer(items), empreinteAvant: avant, empreinteApres: apres };
}

// ---------- Tâches, notes, favoris, rappel : proposés une seule fois, à cocher (certains peuvent être des données de démonstration) ----------
export function elementsHub(d) {
  const L = [];
  (d.tasks || []).forEach((t) => L.push({ cle: "t:" + t.id, genre: "tâche", texte: String(t.title || ""), detail: (t.done ? "faite" : "à faire") + (t.dueDate ? " · " + t.dueDate : ""), src: t }));
  (d.notes || []).forEach((n) => L.push({ cle: "n:" + n.id, genre: "note", texte: String(n.title || "") + (n.content ? " — " + n.content : ""), detail: n.private ? "marquée privée" : "", src: n }));
  (d.bookmarks || []).forEach((b) => L.push({ cle: "f:" + b.id, genre: "favori", texte: String(b.title || b.url || ""), detail: b.url || "", src: b }));
  (d.reminders || []).forEach((r) => L.push({ cle: "r:" + r.id, genre: "rappel", texte: String(r.text || ""), detail: r.time || "", src: r }));
  return L;
}
const jourDe = (s) => { const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); if (iso) return iso[0]; const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || "")); return fr ? `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}` : null; };
export async function importerHub(elements, cles) {
  const choisis = elements.filter((e) => cles.includes(e.cle)), t = hote.maintenant().getTime(), res = { taches: 0, notes: 0, favoris: 0, rappels: 0 };
  for (const e of choisis) {
    const s = e.src;
    if (e.genre === "tâche") { await hote.stockage.ecrire("tasks", { id: hote.nouvelId("t"), text: e.texte, done: !!s.done, prio: 0, due: jourDe(s.dueDate), remindAt: null, created: t, doneAt: s.done ? t : null }); res.taches++; }
    else if (e.genre === "note") { await hote.stockage.ecrire("notes", { id: hote.nouvelId("n"), text: e.texte, pinned: false, created: t, updated: t }); res.notes++; }
    else if (e.genre === "favori") { if (/^https?:\/\//i.test(s.url || "")) { await hote.stockage.ecrire("favs", { id: hote.nouvelId("f"), title: String(s.title || s.url).slice(0, 120), url: s.url, group: String(s.category || "Importés"), created: t }); res.favoris++; } }
    else if (e.genre === "rappel") { const m = /(\d{1,2})[:h](\d{2})/.exec(String(s.time || "")); const jour = jourDe(s.time) || jourDe(new Date(t).toISOString()); await hote.stockage.ecrire("tasks", { id: hote.nouvelId("t"), text: e.texte, done: false, prio: 0, due: jour, remindAt: m ? `${jour}T${m[1].padStart(2, "0")}:${m[2]}` : null, created: t, doneAt: null }); res.rappels++; }
  }
  await hote.stockage.ecrire("kv", { id: "noyau-import-38-hub", quand: hote.maintenant().toISOString(), n: choisis.length });
  return res;
}
export const dejaImporteHub = async () => !!(await hote.stockage.lire("kv", "noyau-import-38-hub"));
