// Synchro PC / Android (3.5) : les données du hub (notes, tâches, agenda, favoris, réglages des rappels) sont chiffrées
// sur l'appareil (AES-GCM 256, clé tirée de ta phrase secrète avec PBKDF2) puis rangées dans un Gist SECRET de ton compte GitHub.
// GitHub ne voit qu'un bloc illisible. Chaque appareil fusionne élément par élément : le plus récent gagne, les suppressions suivent.
// Il faut un jeton GitHub limité aux Gists (mode d'emploi dans Diag) ; jeton et phrase restent sur l'appareil, jamais exportés.
// Les images ne sont pas synchronisées (trop lourdes) : elles passent par l'export.
import { store, tombstones } from "./storage.js";
import { vault } from "./vault.js";

const KEY = "hub-synchro", DESC = "hub-synchro (données chiffrées du hub, ne pas modifier)", FILE = "hub-synchro.txt";
const COLLS = ["notes", "tasks", "events", "favs", "kv"];
const API = "https://api.github.com";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Jeton et phrase de synchro : chiffrés par le coffre quand le verrouillage est actif.
export function config() { try { return JSON.parse(vault.lsGet(KEY) || "null"); } catch (e) { return null; } }
function saveConfig(c) { if (c) vault.lsSet(KEY, JSON.stringify(c)); else vault.lsRemove(KEY); }

async function keyFrom(phrase, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(phrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function seal(obj, phrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(phrase, salt), enc.encode(JSON.stringify(obj))));
  return "HUB1." + b64(salt) + "." + b64(iv) + "." + b64(ct);
}
export async function open(text, phrase) {
  const [tag, s, i, c] = (text || "").trim().split(".");
  if (tag !== "HUB1") throw new Error("Contenu de synchro inconnu");
  try { return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(i) }, await keyFrom(phrase, unb64(s)), unb64(c)))); }
  catch (e) { throw new Error("Phrase secrète différente de celle de l'autre appareil"); }
}

async function gh(path, token, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) }, cache: "no-store" });
  if (r.status === 401) throw new Error("Jeton GitHub refusé (expiré ou mal copié)");
  if (r.status === 403 || r.status === 404) throw new Error("Le jeton n'a pas le droit « Gists : lecture et écriture »");
  if (!r.ok) throw new Error("GitHub répond " + r.status);
  return r.json();
}
async function findGist(token) {
  for (let page = 1; page <= 5; page++) {
    const list = await gh("/gists?per_page=100&page=" + page, token);
    const g = list.find((x) => x.description === DESC && x.files && x.files[FILE]);
    if (g) return g.id;
    if (list.length < 100) return null;
  }
  return null;
}
async function readRemote(c) {
  const g = await gh("/gists/" + c.gist, c.token), f = g.files && g.files[FILE];
  if (!f) return null;
  let text = f.content;
  if (f.truncated) text = await (await fetch(f.raw_url, { cache: "no-store" })).text();
  return open(text, c.phrase);
}
async function writeRemote(c, payload) {
  const content = await seal(payload, c.phrase);
  await gh("/gists/" + c.gist, c.token, { method: "PATCH", body: JSON.stringify({ files: { [FILE]: { content } } }) });
}

async function snapshot() {
  const data = {};
  for (const k of COLLS) data[k] = await store.all(k);
  return { v: 1, at: Date.now(), data, tomb: tombstones() };
}

/** Fusionne l'état distant dans l'appareil. Renvoie le nombre de changements faits ici. */
async function mergeIn(remote) {
  let changes = 0;
  const lt = tombstones();
  for (const k of COLLS) {
    const local = new Map((await store.all(k)).map((x) => [x.id, x]));
    const rt = (remote.tomb && remote.tomb[k]) || {}, toPut = [], toDel = [];
    for (const r of (remote.data && remote.data[k]) || []) {
      if (!r || typeof r.id !== "string") continue;
      const l = local.get(r.id), localDeleted = lt[k] && lt[k][r.id];
      if (localDeleted && localDeleted >= (r._m || 0)) continue;              // supprimé ici après la dernière modif là-bas
      if (!l || (r._m || 0) > (l._m || 0)) toPut.push(r);
    }
    // Suppression venue de l'autre appareil : comparée à la version retenue ICI après fusion (une note supprimée puis
    // remise avec « Annuler » là-bas est plus récente que sa trace de suppression : elle doit rester).
    const kept = new Map(toPut.map((x) => [x.id, x]));
    for (const [id, t] of Object.entries(rt)) { const cur = kept.get(id) || local.get(id); if (cur && t >= (cur._m || 0)) { toDel.push(id); kept.delete(id); } }
    toPut.length = 0; toPut.push(...kept.values());
    if (toPut.length) { await store.putMany(k, toPut, true); changes += toPut.length; }
    if (toDel.length) { await store.delMany(k, toDel, true); changes += toDel.length; }
    // On garde aussi les traces de suppression de l'autre appareil (pour les transmettre à un 3e)
    if (Object.keys(rt).length) { lt[k] = { ...(lt[k] || {}), ...rt }; }
  }
  try { localStorage.setItem("hub-synchro-suppressions", JSON.stringify(lt)); } catch (e) { /* plein */ }
  return changes;
}

export const sync = {
  get configured() { const c = config(); return !!(c && c.token && c.phrase && c.gist); },
  /** Première mise en route sur un appareil : vérifie le jeton, trouve ou crée le Gist secret. */
  async setup(token, phrase) {
    token = token.trim(); phrase = phrase.trim();
    if (phrase.length < 8) throw new Error("Phrase secrète trop courte (8 caractères au moins)");
    let gist = await findGist(token), created = false;
    if (!gist) {
      const c0 = { token, phrase };
      const content = await seal(await snapshot(), phrase);
      const g = await gh("/gists", token, { method: "POST", body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content } } }) });
      gist = g.id; created = true; saveConfig({ ...c0, gist });
    } else {
      const c = { token, phrase, gist };
      await readRemote(c);                                   // vérifie la phrase avant d'enregistrer
      saveConfig(c);
    }
    return { created };
  },
  forget() { saveConfig(null); localStorage.removeItem("hub-synchro-etat"); },
  /** Tire, fusionne, pousse. Renvoie { pulled, pushed }. */
  async run() {
    const c = config(); if (!c) throw new Error("Synchro non configurée");
    const remote = await readRemote(c);
    const pulled = remote ? await mergeIn(remote) : 0;
    const snap = await snapshot();
    await writeRemote(c, snap);
    localStorage.setItem("hub-synchro-etat", JSON.stringify({ at: Date.now(), ok: true }));
    return { pulled, pushed: true };
  },
  state() { try { return JSON.parse(localStorage.getItem("hub-synchro-etat") || "null"); } catch (e) { return null; } }
};
