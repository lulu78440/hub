// Coffre de données du hub : IndexedDB sur l'appareil (notes, tâches, puis agenda, favoris, images…).
// Chaque « collection » est une liste d'objets avec un champ id. Les changements sont annoncés aux widgets
// de cet onglet et des autres onglets du hub ouverts (BroadcastChannel), pour que tout reste à jour.
// Export / import : un seul fichier JSON avec toutes les collections et les réglages (clés hub-…).

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

function emit(coll, broadcast = true) {
  (listeners[coll] || []).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  if (broadcast && chan) chan.postMessage({ coll });
}

/** Nouvel identifiant court, unique sur l'appareil. */
export const newId = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const store = {
  /** Vrai si les données sont vraiment enregistrées (faux = secours en mémoire, perdu à la fermeture). */
  async durable() { return !!(await open()); },
  async all(coll) {
    const db = await open();
    if (!db) return [...memory[coll].values()];
    return tx(db, coll, "readonly", (st) => st.getAll());
  },
  async get(coll, id) {
    const db = await open();
    if (!db) return memory[coll].get(id);
    return tx(db, coll, "readonly", (st) => st.get(id));
  },
  async put(coll, obj) {
    const db = await open();
    if (!db) memory[coll].set(obj.id, obj); else await tx(db, coll, "readwrite", (st) => st.put(obj));
    emit(coll); return obj;
  },
  async del(coll, id) {
    const db = await open();
    if (!db) memory[coll].delete(id); else await tx(db, coll, "readwrite", (st) => st.delete(id));
    emit(coll);
  },
  /** Plusieurs ajouts ou remplacements en une fois (un seul signal de changement). */
  async putMany(coll, objs) {
    const db = await open();
    if (!db) objs.forEach((o) => memory[coll].set(o.id, o));
    else await tx(db, coll, "readwrite", (st) => { objs.forEach((o) => st.put(o)); });
    emit(coll);
  },
  /** Plusieurs suppressions en une fois. */
  async delMany(coll, ids) {
    const db = await open();
    if (!db) ids.forEach((id) => memory[coll].delete(id));
    else await tx(db, coll, "readwrite", (st) => { ids.forEach((id) => st.delete(id)); });
    emit(coll);
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
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("hub-")) prefs[k] = localStorage.getItem(k); } } catch (e) { /* réglages indisponibles */ }
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
    else await tx(db, c, "readwrite", (st) => { st.clear(); items.forEach((x) => st.put(x)); });
  }
  if (d.prefs && typeof d.prefs === "object") {
    try { Object.entries(d.prefs).forEach(([k, v]) => { if (k.startsWith("hub-") && typeof v === "string") localStorage.setItem(k, v); }); } catch (e) { /* réglages non restaurés */ }
  }
  COLLECTIONS.forEach((c) => emit(c));
}
