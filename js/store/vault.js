// Verrouillage de l'espace perso (ajout du cahier du 24/10, conception sécurité avec Opus).
// Principe : une clé de données aléatoire (AES-GCM 256) chiffre tout ce qui est personnel sur l'appareil :
//   - les collections IndexedDB (notes, tâches, agenda, favoris, kv, images) ;
//   - les réglages qui contiennent du personnel (lieu de la météo, règles des mails, constellation…) ;
//   - les secrets (jetons des mails, configuration de la synchro, clé Gemini).
// Cette clé n'est jamais écrite en clair : elle est rangée deux fois, chiffrée
//   1) par la phrase secrète (PBKDF2-SHA-256, 600 000 tours) ;
//   2) par la clé de secours (24 caractères aléatoires, à noter hors du dépôt).
// Elle ne vit qu'en mémoire, dans l'onglet ouvert : fermer l'onglet = tout est de nouveau illisible.
// Changer de phrase ne rechiffre pas les données : seule la clé rangée est rechiffrée.
// Ce que ça ne protège pas : un onglet déjà déverrouillé (d'où le verrouillage automatique), ni l'affichage des notifications.

const META = "hub-coffre";
const TAG = "§1:";                        // préfixe d'une valeur chiffrée dans localStorage
const ITER = 600000, ITER_RESCUE = 150000;
const enc = new TextEncoder(), dec = new TextDecoder();
export const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

// Réglages personnels (clés de localStorage) : chiffrés quand le verrouillage est actif.
const PRIVATE = new Set(["constellation", "meteo-cache", "meteo-lieu", "mails", "web-url", "video-suivre", "video-courante", "musique-yt", "ia-instructions", "radios", "video-file", "musique-source"].map((k) => "hub-" + k));
const isPrivate = (k) => PRIVATE.has(k) || k.startsWith("hub-secret") || k === "hub-synchro";

let dek = null;              // CryptoKey de la clé de données (en mémoire seulement)
let prevKey = null;          // ancienne clé pendant un changement de clé (rotation inachevée)
let raw = null;              // ses octets, gardés pour pouvoir la ranger de nouveau (changement de phrase)
const cache = new Map();     // réglages et secrets déchiffrés (en mémoire seulement)
let writes = Promise.resolve();

function readMeta() { try { return JSON.parse(localStorage.getItem(META) || "null"); } catch (e) { return null; } }
function writeMeta(m) { if (m) localStorage.setItem(META, JSON.stringify(m)); else localStorage.removeItem(META); }

async function kek(secret, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function wrap(secret, iterations) {
  const salt = rand(16), iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await kek(secret, salt, iterations), raw));
  return { salt: b64(salt), iter: iterations, iv: b64(iv), ct: b64(ct) };
}
async function unwrap(w, secret) {
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(w.iv) }, await kek(secret, unb64(w.salt), w.iter), unb64(w.ct))); }
  catch (e) { return null; }
}
async function setKey(bytes) {
  raw = bytes; dek = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]); prevKey = null;
  const m = readMeta();
  if (m && m.prev) { try { prevKey = await crypto.subtle.importKey("raw", await decBytes(unb64(m.prev)), "AES-GCM", false, ["decrypt"]); } catch (e) { prevKey = null; } }
}

/** Clé de secours : 24 caractères lisibles (sans 0/O ni 1/I), groupés par 4. ~120 bits de hasard. */
function newRescue() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = rand(24);
  return [...b].map((x) => A[x % 32]).join("").replace(/(.{4})(?=.)/g, "$1-");
}
const normRescue = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})(?=.)/g, "$1-");

// ---------- Chiffrement de base ----------
async function encBytes(u8) { const iv = rand(12); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dek, u8)); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; }
async function decBytes(u8, key = dek) { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8.subarray(0, 12) }, key, u8.subarray(12))); }
const encStr = async (s) => TAG + b64(await encBytes(enc.encode(s)));
const decStr = async (s) => { const u = unb64(s.slice(TAG.length)); try { return dec.decode(await decBytes(u)); } catch (e) { if (prevKey) return dec.decode(await decBytes(u, prevKey)); throw e; } };
const decAny = async (u8) => { try { return await decBytes(u8); } catch (e) { if (prevKey) return decBytes(u8, prevKey); throw e; } };

// ---------- Cache des réglages et secrets ----------
async function loadCache() {
  cache.clear();
  const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isPrivate(k)) keys.push(k); }
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v === null) continue;
    if (v.startsWith(TAG)) { try { cache.set(k, await decStr(v)); } catch (e) { /* illisible : ignoré */ } }
    else { cache.set(k, v); localStorage.setItem(k, await encStr(v)); }      // valeur en clair d'avant : chiffrée maintenant
  }
}

const chan = (() => { try { return new BroadcastChannel("hub-coffre"); } catch (e) { return null; } })();
if (chan) chan.onmessage = (e) => { if (e.data === "change") location.reload(); };   // activé / désactivé dans un autre onglet
addEventListener("storage", (e) => { if (e.key === META && !!e.newValue !== !!e.oldValue) location.reload(); });   // secours sans BroadcastChannel
const tellOthers = () => { if (chan) chan.postMessage("change"); };

export const vault = {
  get active() { return !!readMeta(); },
  get unlocked() { return !!dek; },
  get rotating() { const m = readMeta(); return !!(m && m.prev); },
  /** Le stockage doit-il chiffrer maintenant ? */
  get on() { return !!dek && !!readMeta(); },
  isPrivate,

  // ----- Ouverture -----
  async unlock(phrase) {
    const m = readMeta(); if (!m) return true;
    const b = await unwrap(m.pass, phrase); if (!b) return false;
    await setKey(b); await loadCache(); return true;
  },
  async unlockRescue(code) {
    const m = readMeta(); if (!m) return true;
    const b = await unwrap(m.rescue, normRescue(code)); if (!b) return false;
    await writes; await setKey(b); await loadCache(); return true;
  },
  /** Vérifie la phrase sans rien changer (déverrouillage après une mise en veille de l'écran). */
  async check(phrase) { const m = readMeta(); return !!(m && await unwrap(m.pass, phrase)); },
  async checkRescue(code) { const m = readMeta(); return !!(m && await unwrap(m.rescue, normRescue(code))); },

  // ----- Mise en route, changements, arrêt (le stockage rechiffre ses données à côté) -----
  /** Crée la clé et la range. Renvoie la clé de secours à noter. Les données sont rechiffrées par storage.lockAll(). */
  async create(phrase) {
    await setKey(rand(32));
    const rescue = newRescue();
    writeMeta({ v: 1, created: new Date().toISOString(), pass: await wrap(phrase, ITER), rescue: await wrap(rescue, ITER_RESCUE) });
    tellOthers();                                        // les autres onglets se rechargent et demandent la phrase
    // Réglages et secrets : copiés dans le cache puis chiffrés
    cache.clear();
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isPrivate(k)) cache.set(k, localStorage.getItem(k)); }
    for (const [k, v] of cache) localStorage.setItem(k, await encStr(v));
    return rescue;
  },
  /** Change de clé de données (phrase + nouvelle clé de secours) : les anciens exports et l'ancienne clé de secours
   *  n'ouvrent plus les données actuelles. Les enregistrements sont rechiffrés ensuite par storage.rewriteAll(),
   *  puis vault.endRotation(). Tant que ce n'est pas fini, l'ancienne clé (rangée chiffrée par la nouvelle) reste lisible. */
  async rotate(phrase) {
    if (!raw) throw new Error("Coffre fermé");
    await writes;
    const old = raw, oldKey = dek, fresh = rand(32);
    raw = fresh; dek = await crypto.subtle.importKey("raw", fresh, "AES-GCM", false, ["encrypt", "decrypt"]); prevKey = oldKey;
    const rescue = newRescue();
    writeMeta({ v: 1, created: (readMeta() || {}).created, changed: new Date().toISOString(), pass: await wrap(phrase, ITER), rescue: await wrap(rescue, ITER_RESCUE), prev: b64(await encBytes(old)) });
    for (const [k, v] of cache) localStorage.setItem(k, await encStr(v));
    return rescue;
  },
  endRotation() { const m = readMeta(); if (m && m.prev) { delete m.prev; writeMeta(m); } prevKey = null; },
  async changePhrase(phrase) { const m = readMeta(); if (!m || !raw) throw new Error("Coffre fermé"); m.pass = await wrap(phrase, ITER); m.changed = new Date().toISOString(); writeMeta(m); },
  async renewRescue() { const m = readMeta(); if (!m || !raw) throw new Error("Coffre fermé"); const r = newRescue(); m.rescue = await wrap(r, ITER_RESCUE); writeMeta(m); return r; },
  /** Remet les réglages et secrets en clair et oublie la clé (les données sont remises en clair par storage.unlockAll()). */
  async destroy() {
    await writes;
    // La clé Gemini exige le verrouillage : elle part avec lui, au lieu de rester en clair sur l'appareil
    for (const [k, v] of cache) if (k !== "hub-secret-ia") localStorage.setItem(k, v);
    localStorage.removeItem("hub-secret-ia");
    writeMeta(null); dek = null; raw = null; cache.clear(); tellOthers();
  },
  announce: tellOthers,

  // ----- Réglages et secrets (localStorage) -----
  lsGet(k) {
    if (isPrivate(k) && readMeta()) return cache.has(k) ? cache.get(k) : null;
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },
  lsSet(k, v) {
    v = String(v);
    if (isPrivate(k) && readMeta()) {
      if (!dek) return;                                  // coffre fermé : rien n'est écrit
      cache.set(k, v);
      writes = writes.then(async () => { if (cache.get(k) === v) localStorage.setItem(k, await encStr(v)); }).catch(() => {});
      return;
    }
    localStorage.setItem(k, v);
  },
  lsRemove(k) { cache.delete(k); try { localStorage.removeItem(k); } catch (e) { /* rien */ } },
  flush() { return writes; },

  // ----- Enregistrements IndexedDB -----
  async seal(obj) {
    const { id, _m, ...rest } = obj; let b = null;
    if (rest.blob instanceof Blob) { b = await encBytes(new Uint8Array(await rest.blob.arrayBuffer())); rest._type = rest.blob.type; delete rest.blob; }
    const out = { id, _m, _e: await encBytes(enc.encode(JSON.stringify(rest))) };
    if (b) out._b = b;
    return out;
  },
  async open(rec) {
    if (!rec || !rec._e) return rec;
    if (!dek) throw new Error("Coffre fermé");
    const o = JSON.parse(dec.decode(await decAny(new Uint8Array(rec._e))));
    if (rec._b) { o.blob = new Blob([await decAny(new Uint8Array(rec._b))], { type: o._type || "" }); delete o._type; }
    return { id: rec.id, _m: rec._m, ...o };
  },

  // ----- Exports chiffrés -----
  /** Emballe un export : s'ouvre avec la phrase ou la clé de secours du moment de l'export. */
  async sealExport(d) {
    const m = readMeta();
    return { format: "hub-donnees-chiffre", formatVersion: 1, appVersion: d.appVersion, exportedAt: d.exportedAt, coffre: { pass: m.pass, rescue: m.rescue },
      data: b64(await encBytes(enc.encode(JSON.stringify(d)))) };
  },
  isSealed(d) { return !!(d && d.format === "hub-donnees-chiffre"); },
  /** Ouvre un export chiffré avec la phrase ou la clé de secours. Renvoie { d, bytes } ou null si le secret est faux. */
  async openExport(file, secret) {
    const c = file.coffre || {};
    // Un fichier trafiqué ne doit pas installer une protection affaiblie
    if (!c.pass || !c.rescue || !(c.pass.iter >= 300000) || !(c.rescue.iter >= 100000)) throw new Error("Export chiffré non reconnu");
    const bytes = (c.pass && await unwrap(c.pass, secret)) || (c.rescue && await unwrap(c.rescue, normRescue(secret)));
    if (!bytes) return null;
    const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["decrypt"]);
    const d = JSON.parse(dec.decode(await decBytes(unb64(file.data), key)));
    return { d, bytes, coffre: c };
  },
  /** Appareil sans verrouillage qui importe un export chiffré : il reprend le même coffre (même phrase, même clé de secours). */
  async adopt(bytes, coffre) {
    await setKey(bytes);
    writeMeta({ v: 1, created: new Date().toISOString(), pass: coffre.pass, rescue: coffre.rescue });
    cache.clear();
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isPrivate(k)) cache.set(k, localStorage.getItem(k)); }
    for (const [k, v] of cache) localStorage.setItem(k, await encStr(v));
  }
};
