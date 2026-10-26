// Noyau · modèles d'IA locale (lab-modeles). Rien n'est téléchargé sans l'accord de Lucien, taille affichée AVANT.
// Les modèles sont gardés par le cache de leur bibliothèque (Cache Storage : « webllm/… », « transformers-cache »), jamais par celui du
// service worker (qui ne touche pas aux autres sites : voir sw.js). « Gérer les modèles » (fenêtre Outils, à brancher par la Refonte)
// s'appuie sur etatModeles() et supprimerModele(). Module sans effet de bord : `caches` et `storage` sont injectables.

/** Catalogue fermé. Tailles en Mo : ESTIMATIONS annoncées par les bibliothèques (journal N15 et cahier), à recontrôler au premier essai réel. */
export const MODELES = [
  { id: "qwen-0.5b", nom: "Qwen 2.5 · 0,5 Md (WebGPU)", mode: "webgpu", usage: "chat", mo: 400, motif: "Qwen2.5-0.5B", licence: "Apache-2.0" },
  { id: "qwen-1.5b", nom: "Qwen 2.5 · 1,5 Md (WebGPU)", mode: "webgpu", usage: "chat", mo: 1000, motif: "Qwen2.5-1.5B", licence: "Apache-2.0" },
  { id: "qwen-wasm", nom: "Qwen 2.5 · 0,5 Md (WASM, processeur)", mode: "wasm", usage: "chat", mo: 400, motif: "Qwen2.5-0.5B-Instruct", licence: "Apache-2.0" },
  { id: "whisper-tiny", nom: "Whisper tiny (dictée locale)", mode: "wasm", usage: "voix", mo: 40, motif: "whisper-tiny", licence: "MIT" },
  { id: "piper-siwis", nom: "Voix Piper · siwis (lecture)", mode: "wasm", usage: "voix", mo: 60, motif: "fr_FR-siwis", licence: "à vérifier (moteur Piper : MIT ; la licence de la voix dépend de son jeu de données)" },
  { id: "e5-small", nom: "Recherche par le sens · e5-small", mode: "wasm", usage: "sens", mo: 120, motif: "multilingual-e5-small", licence: "MIT" }
];
/** Caches des bibliothèques (le nom exact peut varier avec la version : on teste le début). */
export const CACHES_BIBLIOTHEQUES = ["webllm", "transformers-cache", "piper", "sens"];

export function formaterTaille(octets) {
  if (!Number.isFinite(octets) || octets < 0) return "taille inconnue";
  if (octets < 1e6) return Math.max(1, Math.round(octets / 1e3)) + " Ko";
  if (octets < 1e9) return Math.round(octets / 1e6) + " Mo";
  return (octets / 1e9).toFixed(1).replace(".", ",") + " Go";
}

const correspond = (url, m) => String(url).toLowerCase().includes(m.motif.toLowerCase());
async function parcourir(caches, fn) {
  if (!caches || typeof caches.keys !== "function") return;
  for (const nom of await caches.keys()) {
    if (!CACHES_BIBLIOTHEQUES.some((b) => nom.toLowerCase().startsWith(b))) continue;    // jamais le cache du hub ni celui d'un autre site
    const c = await caches.open(nom);
    for (const req of await c.keys()) await fn(c, req, nom);
  }
}

/** État de chaque modèle du catalogue : téléchargé ou non, taille réelle si le navigateur la donne. */
export async function etatModeles({ caches = typeof globalThis.caches !== "undefined" ? globalThis.caches : null } = {}) {
  const etat = MODELES.map((m) => ({ ...m, telecharge: false, octets: 0, tailleAffichee: "≈ " + formaterTaille(m.mo * 1e6) }));
  try {
    await parcourir(caches, async (c, req) => {
      const m = etat.find((x) => correspond(req.url, x)); if (!m) return;
      m.telecharge = true;
      try { const r = await c.match(req); if (r) { const l = parseInt(r.headers.get("content-length"), 10); m.octets += Number.isFinite(l) ? l : (await r.clone().blob()).size; } } catch { /* taille inconnue */ }
    });
  } catch { /* Cache Storage indisponible : tout apparaît « non téléchargé » */ }
  for (const m of etat) if (m.telecharge && m.octets > 0) m.tailleAffichee = formaterTaille(m.octets);
  return etat;
}

/** Supprime un modèle (jamais autre chose que ses fichiers dans les caches des bibliothèques). Renvoie le nombre de fichiers retirés. */
export async function supprimerModele(id, { caches = globalThis.caches } = {}) {
  const m = MODELES.find((x) => x.id === id); if (!m) throw new Error("Modèle inconnu : " + id);
  let n = 0;
  await parcourir(caches, async (c, req) => { if (correspond(req.url, m) && (await c.delete(req))) n++; });
  return n;
}

/**
 * Téléchargement à la demande. `accord(info)` est la fenêtre de Lucien : elle reçoit le nom, la taille et le mode, et répond oui ou non.
 * Sans `accord`, ou sur un non, rien ne part. `charger` est la fonction qui lance réellement le téléchargement (worker du socle).
 */
export async function telechargerModele(id, { accord, charger, surProgres = () => {} } = {}) {
  const m = MODELES.find((x) => x.id === id); if (!m) throw new Error("Modèle inconnu : " + id);
  if (typeof accord !== "function") return { fait: false, raison: "Aucune fenêtre d'accord : rien n'est téléchargé." };
  const oui = await accord({ id: m.id, nom: m.nom, taille: "≈ " + formaterTaille(m.mo * 1e6), mode: m.mode, licence: m.licence, message: `Télécharger « ${m.nom} » (≈ ${formaterTaille(m.mo * 1e6)}) ? Le fichier est gardé sur cet appareil et se supprime dans « Gérer les modèles ».` });
  if (oui !== true) return { fait: false, raison: "Refusé par Lucien." };
  await charger(m, (texte, part) => surProgres({ id: m.id, texte, part: typeof part === "number" ? Math.max(0, Math.min(1, part)) : null, tailleTotale: formaterTaille(m.mo * 1e6) }));
  return { fait: true };
}

/** Place libre estimée : on prévient avant un gros téléchargement. */
export async function placeSuffisante(mo, { storage = typeof navigator !== "undefined" ? navigator.storage : null } = {}) {
  try { if (storage && storage.estimate) { const { quota, usage } = await storage.estimate(); if (quota) return (quota - (usage || 0)) > mo * 1e6 * 1.3; } } catch { /* inconnu */ }
  return true;      // inconnu : on laisse faire, le navigateur refusera si besoin
}
