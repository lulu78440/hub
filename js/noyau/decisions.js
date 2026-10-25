// Noyau · mémoire des décisions (lab-decisions). Moteur à règles, SANS IA : une décision = ce qui a été décidé, pourquoi, et ce qu'on a observé ensuite.
// En ajout seul : une décision n'est jamais effacée, elle peut être « revue » ou « abandonnée » par Lucien. Le Noyau PROPOSE (détection dans une phrase
// de Lucien) ; rien n'est enregistré sans qu'il valide. Une IA, si présente, ne sert qu'à reformuler la raison (`enrichir`, facultatif).
import { Index } from "./recherche.js";

export const STATUTS = ["active", "revue", "abandonnee"];
const DOC = "noyau-decisions";
const MOTIFS = [/\bj'ai decide (de|d')\s*(.+)/, /\bon a decide (de|d')\s*(.+)/, /\bdesormais,?\s+(?:je|on)\s+(.+)/, /\bje (?:choisis|prends la decision) (?:de|d')\s*(.+)/, /\bje ne (?:vais|veux) plus\s+(.+)/, /\bje (?:vais|veux) arreter (?:de|d')\s*(.+)/];
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'");

/** Repère une décision dans une phrase de Lucien. Renvoie une PROPOSITION { decision, raison? } ou null : jamais d'enregistrement automatique. */
export function detecterDecision(phrase) {
  const t = norm(phrase).trim();
  if (t.length < 12 || /\?\s*$/.test(t)) return null;                 // une question n'est pas une décision
  if (/\b(si|peut-etre|et si|j'hesite|je me demande|faut-il)\b/.test(t)) return null;   // conditionnel, doute : pas de décision
  for (const re of MOTIFS) {
    const m = re.exec(t); if (!m) continue;
    const reste = m[m.length - 1].replace(/[.!]+$/, "");
    const [dec, raison] = reste.split(/\s+(?:parce que|car|puisque|afin de|pour)\s+/);
    if (!dec || dec.length < 4) continue;
    return { decision: dec.trim().slice(0, 200), raison: raison ? raison.trim().slice(0, 200) : null, brut: String(phrase).slice(0, 300) };
  }
  return null;
}

export function creerDecisions({ stockage, maintenant = () => new Date(), nouvelId = () => "dec-" + Math.random().toString(36).slice(2, 10), enrichir = null } = {}) {
  let doc = null;
  const charger = async () => doc || (doc = (await stockage.lire("kv", DOC)) || { id: DOC, lignes: [] });
  const sauver = async () => stockage.ecrire("kv", doc);
  return {
    /** Enregistre une décision (appelé SEULEMENT après la validation de Lucien). */
    async enregistrer({ decision, raison = null, cle = null, valeur = null, domaine = null }) {
      if (!decision || String(decision).trim().length < 4) throw new Error("Décision vide");
      const d = await charger();
      let r = raison; if (!r && enrichir) { try { r = await enrichir(decision); } catch { r = null; } }
      const ligne = { id: nouvelId(), decision: String(decision).slice(0, 200), raison: r ? String(r).slice(0, 300) : null, cle, valeur, domaine, date: maintenant().toISOString().slice(0, 10), statut: "active", consequences: [] };
      d.lignes.push(ligne); await sauver(); return ligne;
    },
    /** Ajoute une conséquence observée (jamais de modification de la décision elle-même). */
    async consequence(id, observation) {
      const d = await charger(); const l = d.lignes.find((x) => x.id === id); if (!l) throw new Error("Décision introuvable");
      l.consequences.push({ date: maintenant().toISOString().slice(0, 10), observation: String(observation).slice(0, 300) }); await sauver(); return l;
    },
    async changerStatut(id, statut) {
      if (!STATUTS.includes(statut)) throw new Error("Statut inconnu"); const d = await charger(); const l = d.lignes.find((x) => x.id === id); if (!l) throw new Error("Décision introuvable");
      l.statut = statut; l.statut_le = maintenant().toISOString().slice(0, 10); await sauver(); return l;
    },
    async lister({ statut = null } = {}) { const d = await charger(); return d.lignes.filter((l) => !statut || l.statut === statut); },
    /** Retrouve les décisions utiles à une question (mots-clés), pour que le Noyau s'en souvienne en répondant. */
    async chercher(question, { limite = 3 } = {}) {
      const d = await charger(); const ix = new Index(); for (const l of d.lignes) ix.ajouter(l.id, [l.decision, l.raison, l.cle, l.domaine, ...l.consequences.map((c) => c.observation)].filter(Boolean).join(" "));
      return ix.chercher(question, { limite }).map((r) => d.lignes.find((l) => l.id === r.id)).filter(Boolean);
    },
    /** Décisions actives sans nouvelle depuis `jours` jours : à revoir (au plus 3, pour ne pas devenir bavard). */
    async aRevoir({ jours = 45 } = {}) {
      const d = await charger(), now = maintenant();
      return d.lignes.filter((l) => l.statut === "active").map((l) => ({ l, dern: [l.date, ...l.consequences.map((c) => c.date)].sort().pop() })).filter(({ dern }) => (now - new Date(dern)) / 86400000 >= jours).slice(0, 3).map(({ l, dern }) => ({ id: l.id, decision: l.decision, derniere_nouvelle: dern }));
    }
  };
}
