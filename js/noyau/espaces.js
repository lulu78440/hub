// Noyau · espaces de travail (orchestrateur, lot 9) : un nom, une liste de modules enregistrés qu'on rouvre ensemble (« mon espace Économie »).
//  - `kv/noyau-espace-<id>` : titre + identifiants de modules (12 au plus) ; 10 espaces au plus. Aucune donnée chiffrée dedans.
//  - LE NOYAU NE FAIT QUE LIRE ici (lister, lire). Créer, modifier ou retirer un espace sont des gestes de Lucien (gestes-lucien.js, jamais importé par outils.js).
export const PREFIXE = "noyau-espace-";
export const MAX_ESPACES = 10;
export const MAX_MODULES_ESPACE = 12;
export const RE_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const RE_DOC = /^noyau-espace-([a-z0-9][a-z0-9-]{1,39})$/;
const CONTROLE = new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]");

/** Vérifie un espace (copie propre). Lève une Error claire. */
export function verifierEspace(e) {
  if (!e || typeof e !== "object" || Array.isArray(e)) throw new Error("Espace : un objet est attendu");
  for (const k of Object.keys(e)) if (!["id", "titre", "modules", "note"].includes(k)) throw new Error(`Espace : champ inconnu « ${String(k).slice(0, 30)} »`);
  if (!RE_ID.test(String(e.id))) throw new Error("Espace : identifiant en minuscules, chiffres et tirets (2 à 40 signes)");
  const t = String(e.titre || "").trim(); if (!t || t.length > 60 || CONTROLE.test(t) || /[<>]/.test(t)) throw new Error("Espace : titre de 1 à 60 signes, sans balise");
  if (!Array.isArray(e.modules) || e.modules.length < 1 || e.modules.length > MAX_MODULES_ESPACE) throw new Error(`Espace : de 1 à ${MAX_MODULES_ESPACE} modules`);
  for (const m of e.modules) if (!RE_ID.test(String(m))) throw new Error(`Espace : identifiant de module invalide « ${String(m).slice(0, 30)} »`);
  if (new Set(e.modules).size !== e.modules.length) throw new Error("Espace : un module est cité deux fois");
  const note = e.note == null ? "" : String(e.note).trim(); if (note.length > 200 || CONTROLE.test(note) || /[<>]/.test(note)) throw new Error("Espace : note de 200 signes au plus, sans balise");
  return { id: e.id, titre: t, modules: e.modules.slice(), note };
}

export function creerEspaces({ stockage }) {
  const docs = async () => (await stockage.tout("kv")).filter((d) => d && typeof d.id === "string" && RE_DOC.test(d.id) && d.espace_id === RE_DOC.exec(d.id)[1] && Array.isArray(d.modules));
  const resume = (d) => ({ id: d.espace_id, titre: d.titre, modules: d.modules.slice(), note: d.note || "", modifie_le: d.maj || null });
  return {
    async lister() { return (await docs()).map(resume).sort((a, b) => a.titre.localeCompare(b.titre, "fr")); },
    async lire(id) { const d = (await docs()).find((x) => x.espace_id === id); if (!d) throw new Error(`Espace inconnu : « ${String(id).slice(0, 40)} »`); return resume(d); },
    _docs: docs
  };
}
