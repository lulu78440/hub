// Noyau · contradictions entre objectifs, échéances et décisions (lab-contradictions). Moteur à règles, SANS IA, conçu contre le bruit :
// chaque règle exige des champs structurés ou un recouvrement de mots RARES ; au plus 3 signaux ; un signal écarté par Lucien ne revient pas.
// Entrées : { objectifs: [{id, texte, echeance?, statut?}], decisions: [{id, decision, cle?, valeur?, statut, interdit?: [mots]}],
//             taches: [{id, texte, faite, echeance?}], evenements: [{id, titre, date, debut?, fin?}] }  ·  now : Date.
import { jetons } from "./recherche.js";

const jour = (d) => d.toISOString().slice(0, 10);
const minutes = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(h || ""); return m ? +m[1] * 60 + +m[2] : null; };
const sig = (type, ids, message, confiance) => ({ id: type + ":" + [...ids].sort().join("+"), type, ids, message, confiance });

export function detecterContradictions({ objectifs = [], decisions = [], taches = [], evenements = [] } = {}, { now = new Date(), ecartes = [], seuil = 0.7, max = 3 } = {}) {
  const out = []; const auj = jour(now);
  const actives = decisions.filter((d) => d.statut === "active");
  // 1. Deux décisions actives sur le même sujet (même clé) avec des valeurs différentes.
  const parCle = new Map(); for (const d of actives) if (d.cle && d.valeur != null) (parCle.get(d.cle) || parCle.set(d.cle, []).get(d.cle)).push(d);
  for (const [cle, l] of parCle) { const vals = new Set(l.map((d) => String(d.valeur).toLowerCase())); if (vals.size > 1) out.push(sig("decision-decision", l.map((d) => d.id), `Deux décisions actives sur « ${cle} » se contredisent : ${l.map((d) => `« ${d.decision} »`).join(" et ")}.`, 0.95)); }
  // 2. Objectif non terminé dont l'échéance est passée.
  for (const o of objectifs) if ((o.statut || "actif") === "actif" && o.echeance && o.echeance < auj) out.push(sig("echeance-passee", [o.id], `L'objectif « ${o.texte} » avait pour échéance le ${o.echeance} et n'est pas terminé.`, 0.9));
  // 3. Deux rendez-vous qui se chevauchent le même jour (heures renseignées des deux côtés).
  const evs = evenements.filter((e) => e.date >= auj && minutes(e.debut) != null && minutes(e.fin) != null);
  for (let i = 0; i < evs.length; i++) for (let j = i + 1; j < evs.length; j++) { const a = evs[i], b = evs[j]; if (a.date === b.date && minutes(a.debut) < minutes(b.fin) && minutes(b.debut) < minutes(a.fin)) out.push(sig("chevauchement", [a.id, b.id], `« ${a.titre} » (${a.debut}-${a.fin}) et « ${b.titre} » (${b.debut}-${b.fin}) se chevauchent le ${a.date}.`, 0.9)); }
  // 4. Décision qui interdit un mot (champ `interdit`, rempli par Lucien) alors qu'une tâche ou un objectif actif le contient en entier.
  for (const d of actives) for (const mot of d.interdit || []) {
    const [cible] = jetons(mot); if (!cible) continue;
    for (const t of taches.filter((x) => !x.faite)) if (jetons(t.texte).includes(cible)) out.push(sig("decision-tache", [d.id, t.id], `Tu avais décidé « ${d.decision} », et la tâche « ${t.texte} » parle de « ${mot} ».`, 0.75));
    for (const o of objectifs.filter((x) => (x.statut || "actif") === "actif")) if (jetons(o.texte).includes(cible)) out.push(sig("decision-objectif", [d.id, o.id], `Tu avais décidé « ${d.decision} », et l'objectif « ${o.texte} » parle de « ${mot} ».`, 0.75));
  }
  const vus = new Set(); const garde = [];
  for (const s of out.sort((a, b) => b.confiance - a.confiance)) { if (vus.has(s.id) || ecartes.includes(s.id) || s.confiance < seuil) continue; vus.add(s.id); garde.push(s); }
  return garde.slice(0, max);
}
