// Noyau · cache LOCAL des jeux de données (orchestrateur, lot 9). Il sert à reprendre un travail après un rechargement de la page sans refaire les requêtes.
//  - Local à cet appareil : IndexedDB à part (comme les vecteurs de sens.js). Jamais dans « kv », donc ni synchronisé, ni chiffré avec le reste, ni exporté.
//    Ce sont des données publiques déjà affichées à Lucien ; il peut le vider (viderCache) et l'effacer en effaçant les données du site.
//  - Chaque entrée garde la date de la requête et une durée de fraîcheur propre à la source : passé ce délai, le jeu reste utilisable mais il est dit « périmé ».
//  - 40 entrées au plus (les plus anciennes partent), 300 Ko au plus chacune. Le cache est une aide : s'il manque ou échoue, tout fonctionne (on relit la source).
import { verifierJeu } from "./modules/composants.js";

export const MAX_ENTREES = 40;
export const MAX_OCTETS = 300000;
export const FRAICHEUR_H = Object.freeze({ dbnomics: 24, banque_mondiale: 168, publie: 6 });      // durée de fraîcheur par source (heures)
export const FRAICHEUR_DEFAUT_H = 24;

/** Empreinte stable d'un jeu (FNV-1a 32 bits sur son contenu) : sert de clé, et à reconnaître le même jeu après rechargement. */
export function empreinte(jeu) {
  const t = JSON.stringify([jeu.titre || "", jeu.unite, jeu.source.nom, jeu.source.maj, jeu.source.periode, jeu.colonnes.map((c) => c.id + ":" + c.type), jeu.lignes]);
  let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return "e" + h.toString(16).padStart(8, "0") + t.length.toString(36);
}
const copie = (j) => JSON.parse(JSON.stringify({ titre: j.titre, unite: j.unite, colonnes: j.colonnes.map((c) => ({ id: c.id, libelle: c.libelle, type: c.type })), lignes: j.lignes, source: j.source, exemple: j.exemple }));

/** Stockage en mémoire de la page (essais, ou navigateur sans IndexedDB). */
export function backendMemoire() {
  const m = new Map();
  return { async lire(k) { return m.has(k) ? structuredClone(m.get(k)) : null; }, async ecrire(k, v) { m.set(k, structuredClone(v)); }, async retirer(k) { m.delete(k); }, async cles() { return [...m.keys()]; } };
}
/** Stockage IndexedDB (base « hub-noyau-jeux »). `idb` = window.indexedDB ou un faux pour les essais. Renvoie null si indisponible. */
export function backendIDB(idb = (typeof indexedDB !== "undefined" ? indexedDB : null), nom = "hub-noyau-jeux") {
  if (!idb) return null;
  let base = null;
  const ouvrir = () => base || (base = new Promise((ok, no) => { try { const r = idb.open(nom, 1); r.onupgradeneeded = () => r.result.createObjectStore("jeux"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }));
  const op = async (mode, f) => { const db = await ouvrir(); return new Promise((ok, no) => { const t = db.transaction("jeux", mode), s = t.objectStore("jeux"), r = f(s); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); };
  return { lire: async (k) => (await op("readonly", (s) => s.get(k))) || null, ecrire: (k, v) => op("readwrite", (s) => s.put(v, k)), retirer: (k) => op("readwrite", (s) => s.delete(k)), cles: () => op("readonly", (s) => s.getAllKeys()) };
}

export function creerCacheJeux({ backend = backendIDB() || backendMemoire(), maintenant = () => new Date() } = {}) {
  const tenir = async (f, defaut) => { try { return await f(); } catch (e) { return defaut; } };      // le cache ne casse jamais le Noyau
  return {
    /** Range un jeu vérifié. `origine` = { source, identifiant, … } (public). Renvoie son empreinte, ou null s'il n'est pas gardé. */
    async noter(jeu, origine = null) {
      return tenir(async () => {
        const c = copie(jeu); if (JSON.stringify(c).length > MAX_OCTETS) return null;
        const cle = empreinte(jeu), t = maintenant();
        await backend.ecrire(cle, { cle, jeu: c, origine: origine && typeof origine === "object" ? JSON.parse(JSON.stringify(origine)) : null, requete_le: t.toISOString(), vu: t.getTime() });
        const cles = await backend.cles();
        if (cles.length > MAX_ENTREES) {
          const toutes = (await Promise.all(cles.map((k) => backend.lire(k)))).filter(Boolean).sort((a, b) => a.vu - b.vu);
          for (const e of toutes.slice(0, toutes.length - MAX_ENTREES)) await backend.retirer(e.cle);
        }
        return cle;
      }, null);
    },
    /** → { jeu (vérifié), origine, requete_le, age_h, perime } ou null. Un contenu altéré est refusé (jeu re-vérifié), pas rendu. */
    async lire(cle) {
      return tenir(async () => {
        const e = await backend.lire(cle); if (!e || !e.jeu) return null;
        const jeu = verifierJeu(e.jeu), src = e.origine && e.origine.source, h = (FRAICHEUR_H[src] || FRAICHEUR_DEFAUT_H);
        const age = (maintenant().getTime() - Date.parse(e.requete_le)) / 3600000;
        return { jeu, origine: e.origine, requete_le: e.requete_le, age_h: Math.max(0, Math.round(age * 10) / 10), perime: !(age <= h), fraicheur_h: h };
      }, null);
    },
    async liste() { return tenir(async () => (await Promise.all((await backend.cles()).map((k) => backend.lire(k)))).filter(Boolean).map((e) => ({ cle: e.cle, titre: e.jeu.titre || e.jeu.source.nom, requete_le: e.requete_le })), []); },
    /** Geste de Lucien : vider le cache local. */
    async vider() { return tenir(async () => { for (const k of await backend.cles()) await backend.retirer(k); return true; }, false); }
  };
}
