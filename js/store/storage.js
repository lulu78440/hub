// Coffre de données du hub : IndexedDB sur l'appareil (notes, tâches, puis agenda, favoris, images…).
// Chaque « collection » est une liste d'objets avec un champ id. Les changements sont annoncés aux widgets
// de cet onglet et des autres onglets du hub ouverts (BroadcastChannel), pour que tout reste à jour.
// Export / import : un seul fichier JSON avec toutes les collections et les réglages (clés hub-…).
// Verrouillage (vault.js) : quand il est actif, chaque enregistrement est chiffré avant d'entrer dans IndexedDB
// et déchiffré à la lecture ; les widgets ne voient aucune différence.
import { vault } from "./vault.js";

const DB_NAME = "hub", DB_VERSION = 2;
export const COLLECTIONS = ["notes", "tasks", "events", "favs", "kv", "images"];    // kv : petites valeurs diverses ; images : champ blob
const FORMAT = "hub-donnees", FORMAT_VERSION = 1;

let dbp = null, memory = null;            // memory : secours si IndexedDB est indisponible (navigation privée…)
const listeners = {};
const chan = (() => { try { return new BroadcastChannel("hub-data"); } catch (e) { return null; } })();
if (chan) chan.onmessage = (e) => { const c = e.data && e.data.coll; if (c) emit(c, false); };

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { res(null); return; }
    req.onupgradeneeded = () => { const db = req.result; COLLECTIONS.forEach((c) => { if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: "id" }); }); };
    req.onsuccess = () => { const db = req.result; db.onversionchange = () => db.close(); res(db); };
    req.onerror = () => res(null);
    // Mise à jour de la base bloquée par un vieil onglet du hub : il se ferme tout seul (onversionchange) ; sinon on attend un peu
    req.onblocked = () => { setTimeout(() => res(null), 10000); };
  }).then((db) => {
    if (!db) memory = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
    // Demande au navigateur de ne pas effacer ces données quand l'espace manque
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* sans effet */ }
    return db;
  });
  return dbp;
}

function tx(db, coll, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(coll, mode), st = t.objectStore(coll), r = fn(st);
    t.oncomplete = () => res(r && "result" in r ? r.result : undefined);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}

function emit(coll, broadcast = true, fromSync = false) {
  (listeners[coll] || []).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  if (!fromSync) (listeners["*"] || []).forEach((fn) => { try { fn(coll); } catch (e) { console.error(e); } });   // « quelque chose a changé ici » (synchro)
  if (broadcast && chan) chan.postMessage({ coll });
}

// Traces des suppressions (pour la synchro) : { collection: { id: date } }, gardées 90 jours, jamais exportées.
const TOMB = "hub-synchro-suppressions";
export function tombstones() { try { return JSON.parse(localStorage.getItem(TOMB) || "{}") || {}; } catch (e) { return {}; } }
function tomb(coll, ids) {
  if (coll === "images") return;
  const t = tombstones(), now = Date.now(); t[coll] = t[coll] || {};
  ids.forEach((id) => { t[coll][id] = now; });
  Object.keys(t).forEach((c) => Object.keys(t[c]).forEach((id) => { if (now - t[c][id] > 90 * 864e5) delete t[c][id]; }));
  try { localStorage.setItem(TOMB, JSON.stringify(t)); } catch (e) { /* plein : tant pis pour la trace */ }
}

/** Nouvel identifiant court, unique sur l'appareil. */
export const newId = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const seal = (o) => (vault.on ? vault.seal(o) : o);
const openAll = (list) => (list.some((r) => r && r._e) ? Promise.all(list.map((r) => vault.open(r))) : list);
const SKIP = (k) => k.startsWith("hub-synchro") || k.startsWith("hub-secret") || k.startsWith("hub-coffre");   // jamais dans un fichier

export const store = {
  /** Vrai si les données sont vraiment enregistrées (faux = secours en mémoire, perdu à la fermeture). */
  async durable() { return !!(await open()); },
  async all(coll) {
    const db = await open();
    if (!db) return [...memory[coll].values()];
    return openAll(await tx(db, coll, "readonly", (st) => st.getAll()));
  },
  async get(coll, id) {
    const db = await open();
    if (!db) return memory[coll].get(id);
    return vault.open(await tx(db, coll, "readonly", (st) => st.get(id)));
  },
  // Chaque écriture est datée (_m) et chaque suppression laisse une trace (pour la synchro entre appareils, 3.5).
  // sync = true : écriture venue de la synchro (on garde sa date, pas de nouvelle trace).
  async put(coll, obj, sync = false) {
    if (!sync) obj._m = Date.now();
    const db = await open();
    if (!db) memory[coll].set(obj.id, obj); else { const rec = await seal(obj); await tx(db, coll, "readwrite", (st) => st.put(rec)); }
    emit(coll, true, sync); return obj;
  },
  async del(coll, id, sync = false) {
    const db = await open();
    if (!db) memory[coll].delete(id); else await tx(db, coll, "readwrite", (st) => st.delete(id));
    if (!sync) tomb(coll, [id]);
    emit(coll, true, sync);
  },
  /** Plusieurs ajouts ou remplacements en une fois (un seul signal de changement). */
  async putMany(coll, objs, sync = false) {
    if (!sync) { const now = Date.now(); objs.forEach((o) => { o._m = now; }); }
    const db = await open();
    if (!db) objs.forEach((o) => memory[coll].set(o.id, o));
    else { const recs = await Promise.all(objs.map(seal)); await tx(db, coll, "readwrite", (st) => { recs.forEach((o) => st.put(o)); }); }
    emit(coll, true, sync);
  },
  /** Plusieurs suppressions en une fois. */
  async delMany(coll, ids, sync = false) {
    const db = await open();
    if (!db) ids.forEach((id) => memory[coll].delete(id));
    else await tx(db, coll, "readwrite", (st) => { ids.forEach((id) => st.delete(id)); });
    if (!sync) tomb(coll, ids);
    emit(coll, true, sync);
  },
  /** Écoute les changements d'une collection (cet onglet et les autres). Renvoie de quoi se désabonner. */
  on(coll, fn) { (listeners[coll] = listeners[coll] || []).push(fn); return () => { listeners[coll] = listeners[coll].filter((f) => f !== fn); }; }
};

/** Toutes les données et les réglages, prêts à être enregistrés dans un fichier. */
const toDataURL = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); });
async function fromDataURL(s) { try { return await (await fetch(s)).blob(); } catch (e) { return null; } }

export async function exportAll(version) {
  const data = {};
  for (const c of COLLECTIONS) data[c] = await store.all(c);
  // Les images voyagent dans le fichier sous forme de texte (data:…)
  data.images = await Promise.all(data.images.map(async (im) => ({ ...im, blob: im.blob instanceof Blob ? await toDataURL(im.blob) : null })));
  const prefs = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("hub-") && !SKIP(k)) prefs[k] = vault.lsGet(k); /* jamais le jeton de synchro dans un fichier */ } } catch (e) { /* réglages indisponibles */ }
  return { format: FORMAT, formatVersion: FORMAT_VERSION, appVersion: version, exportedAt: new Date().toISOString(), data, prefs };
}

/** Lit un fichier d'export et renvoie un résumé (sans rien modifier), ou lève une erreur lisible. */
export function readExport(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { throw new Error("Ce fichier n'est pas un export du hub (illisible)."); }
  if (!d || d.format !== FORMAT || typeof d.data !== "object") throw new Error("Ce fichier n'est pas un export du hub.");
  if (d.formatVersion > FORMAT_VERSION) throw new Error("Cet export vient d'une version plus récente du hub : mets d'abord le hub à jour.");
  const counts = {};
  COLLECTIONS.forEach((c) => { counts[c] = Array.isArray(d.data[c]) ? d.data[c].length : 0; });
  return { d, counts, date: d.exportedAt ? new Date(d.exportedAt) : null };
}

/** Remplace toutes les données de l'appareil par celles de l'export (déjà lu avec readExport). */
export async function importAll(d) {
  const db = await open();
  for (const c of COLLECTIONS) {
    let items = (Array.isArray(d.data[c]) ? d.data[c] : []).filter((x) => x && typeof x === "object" && typeof x.id === "string");
    if (c === "images") items = (await Promise.all(items.map(async (im) => ({ ...im, blob: typeof im.blob === "string" && im.blob.startsWith("data:image/") ? await fromDataURL(im.blob) : null })))).filter((im) => im.blob);
    if (!db) { memory[c] = new Map(items.map((x) => [x.id, x])); }
    else { const recs = await Promise.all(items.map(seal)); await tx(db, c, "readwrite", (st) => { st.clear(); recs.forEach((x) => st.put(x)); }); }
  }
  if (d.prefs && typeof d.prefs === "object") {
    try { Object.entries(d.prefs).forEach(([k, v]) => { if (k.startsWith("hub-") && !SKIP(k) && typeof v === "string") vault.lsSet(k, v); }); } catch (e) { /* réglages non restaurés */ }
  }
  await vault.flush();
  COLLECTIONS.forEach((c) => emit(c));
}

/** Réécrit toutes les collections selon l'état du coffre : chiffrées s'il est ouvert et actif, en clair sinon.
 *  Lecture complète d'abord (déchiffrée), puis une écriture par collection : un enregistrement est toujours lisible. */
export async function rewriteAll() {
  const db = await open(); if (!db) return;
  for (const c of COLLECTIONS) {
    const plain = await openAll(await tx(db, c, "readonly", (st) => st.getAll()));
    const recs = await Promise.all(plain.map(seal));
    await tx(db, c, "readwrite", (st) => { recs.forEach((x) => st.put(x)); });
  }
}
/** Déchiffre tout pour arrêter le verrouillage (à appeler AVANT vault.destroy()). */
export async function plainAll() {
  const db = await open(); if (!db) return;
  for (const c of COLLECTIONS) {
    const plain = await openAll(await tx(db, c, "readonly", (st) => st.getAll()));
    await tx(db, c, "readwrite", (st) => { plain.forEach((x) => st.put(x)); });
  }
}
