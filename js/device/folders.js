// Accès aux dossiers du PC choisis par toi (plan 3). Deux façons, selon Brave :
// 1) Accès mémorisé (API « File System Access ») : désactivé par défaut dans Brave, s'active avec brave://flags/#file-system-access-api.
//    Les dossiers autorisés sont gardés d'une visite à l'autre (Brave redemande parfois la permission d'un clic).
// 2) Sans ce réglage : on choisit un dossier pour la session (lecture d'une copie de la liste de ses fichiers), rien n'est mémorisé.
// Lecture seule dans les deux cas : le hub ne modifie, ne déplace ni ne supprime jamais un fichier.
export const persistentSupported = typeof window.showDirectoryPicker === "function";

// ---------- Mémorisation des dossiers autorisés (base à part, jamais exportée) ----------
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res) => {
    try { const r = indexedDB.open("hub-appareil", 1); r.onupgradeneeded = () => r.result.createObjectStore("dossiers", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }
    catch (e) { res(null); }
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db(); if (!d) return null;
  return new Promise((res) => { const t = d.transaction("dossiers", mode), r = fn(t.objectStore("dossiers")); t.oncomplete = () => res(r && "result" in r ? r.result : null); t.onerror = () => res(null); });
}
export const savedFolders = async () => (await tx("readonly", (s) => s.getAll())) || [];
export const forgetFolder = (id) => tx("readwrite", (s) => s.delete(id));

/** Choisir un dossier à mémoriser (à appeler depuis un clic). */
export async function pickFolder() {
  const handle = await window.showDirectoryPicker({ id: "hub-dossiers", mode: "read" });
  const all = await savedFolders();
  for (const f of all) if (await f.handle.isSameEntry(handle)) return f;          // déjà là
  const f = { id: "d" + Date.now().toString(36), name: handle.name, handle, added: Date.now() };
  await tx("readwrite", (s) => s.put(f));
  return f;
}
/** "granted" si le dossier est lisible maintenant, sinon "prompt" (un clic pour réautoriser) ou "denied". */
export async function permission(f, ask = false) {
  try {
    const opts = { mode: "read" };
    let p = await f.handle.queryPermission(opts);
    if (p !== "granted" && ask) p = await f.handle.requestPermission(opts);
    return p;
  } catch (e) { return "denied"; }
}

// ---------- Lecture (les deux façons donnent le même format) ----------
// Un élément : { name, kind: "file" | "dir", size, modified (ms), open() → Blob | null, children() → éléments }
function fromHandle(h) {
  if (h.kind === "directory") return { name: h.name, kind: "dir", children: async () => { const out = []; for await (const e of h.values()) out.push(fromHandle(e)); return out; } };
  let meta = null;
  const item = { name: h.name, kind: "file", async info() { if (!meta) { try { const f = await h.getFile(); meta = { size: f.size, modified: f.lastModified }; } catch (e) { meta = { size: 0, modified: 0 }; } } return meta; }, open: () => h.getFile() };
  return item;
}
export const rootOf = (f) => fromHandle(f.handle);

/** Dossier choisi pour la session seulement (sans le réglage de Brave) : à partir d'un <input webkitdirectory>. */
export function fromFileList(files) {
  const root = { name: "", kind: "dir", map: new Map() };
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split("/");
    root.name = root.name || parts[0];
    let cur = root;
    for (let i = 1; i < parts.length - 1; i++) {
      if (!cur.map.has(parts[i])) cur.map.set(parts[i], { name: parts[i], kind: "dir", map: new Map() });
      cur = cur.map.get(parts[i]);
    }
    const meta = { size: file.size, modified: file.lastModified };
    cur.map.set(parts[parts.length - 1], { name: file.name, kind: "file", info: async () => meta, open: async () => file });
  }
  const wrap = (d) => d.kind === "dir" ? { name: d.name, kind: "dir", children: async () => [...d.map.values()].map(wrap) } : d;
  return wrap(root);
}

/** Les fichiers modifiés le plus récemment dans un dossier (2 niveaux de profondeur, lecture limitée pour rester rapide). */
export async function recentFiles(root, max = 8, budget = 400) {
  const out = []; let n = 0;
  async function walk(dir, depth, path) {
    let kids; try { kids = await dir.children(); } catch (e) { return; }
    for (const k of kids) {
      if (n >= budget) return;
      if (k.name.startsWith(".") || k.name.startsWith("~$") || /^(desktop\.ini|thumbs\.db)$/i.test(k.name)) continue;
      if (k.kind === "file") { n++; const m = await k.info(); out.push({ ...k, ...m, path }); }
      else if (depth < 2) await walk(k, depth + 1, path.concat(k.name));
    }
  }
  await walk(root, 0, [root.name]);
  return out.sort((a, b) => b.modified - a.modified).slice(0, max);
}

/** Ouvre un fichier dans un nouvel onglet de Brave (PDF, images, texte s'affichent ; le reste se télécharge). */
export async function openFile(item) {
  const f = await item.open(); if (!f) return false;
  const url = URL.createObjectURL(f);
  const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
  // Affichés dans l'onglet : seulement des formats qui ne peuvent pas exécuter de code. HTML, SVG, XML… sont téléchargés :
  // ouverts en blob:, ils tourneraient avec les droits du hub (même origine) et pourraient lire ses données.
  const SAFE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|text\/plain|application\/pdf|video\/[\w.+-]+|audio\/[\w.+-]+)$/i;
  if (!SAFE.test(f.type || "")) a.download = item.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60e3);
  return true;
}
