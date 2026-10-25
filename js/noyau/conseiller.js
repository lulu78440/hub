// Noyau · conseiller proactif (lab-proactif). Parle seulement quand c'est utile, jamais à heure fixe, jamais en boucle. Moteur à règles, SANS IA.
// Garde-fous : au plus 3 suggestions par jour et une toutes les 2 h ; silence la nuit, en Focus, pendant un média, écran verrouillé ;
// un « non » coupe la règle 30 jours, deux suggestions ignorées la coupent jusqu'à ce que Lucien la rallume ; « plus tard » = 4 h.
// Le conseiller PROPOSE un texte ; il ne lance aucune action (agir passe par la barrière et la confirmation de Lucien).
import { jetons } from "./recherche.js";

export const LIMITES = { parJour: 3, ecartMin: 2 * 3600e3, nonJours: 30, ignoreesMax: 2, plusTardH: 4 };
const cleJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const heureOk = (d) => d.getHours() >= 8 && d.getHours() < 22;

/** Règles : chacune renvoie { cle, texte, priorite } ou null. `e` = état du hub : taches, evenements, dernierExport, decisionsARevoir. */
export const REGLES = [
  (e, now) => {   // un rendez-vous approche alors qu'une tâche du même sujet n'est pas faite
    for (const ev of e.evenements || []) {
      if (!ev.debut || ev.date !== cleJour(now)) continue; const [h, m] = ev.debut.split(":").map(Number), ecart = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
      if (ecart < 15 || ecart > 90) continue; const mots = new Set(jetons(ev.titre));
      const t = (e.taches || []).find((x) => !x.faite && jetons(x.texte).some((w) => mots.has(w)));
      if (t) return { cle: "rdv-tache:" + ev.id + ":" + t.id, priorite: 3, texte: `« ${ev.titre} » commence à ${ev.debut} et la tâche « ${t.texte} » n'est pas faite. On la fait maintenant ?` };
    } return null;
  },
  (e, now) => { const r = (e.taches || []).filter((t) => !t.faite && t.echeance && t.echeance < cleJour(now)); return r.length >= 3 ? { cle: "retard:" + cleJour(now), priorite: 2, texte: `${r.length} tâches sont en retard. Veux-tu les passer en revue (supprimer ou replanifier) ?` } : null; },
  (e, now) => { if (!e.dernierExport) return null; const j = (now - new Date(e.dernierExport)) / 86400000; return j > 8 ? { cle: "export:" + cleJour(now).slice(0, 7), priorite: 1, texte: `Ta dernière sauvegarde date de ${Math.floor(j)} jours. Tu l'exportes maintenant ?` } : null; },
  (e) => { const d = (e.decisionsARevoir || [])[0]; return d ? { cle: "decision:" + d.id, priorite: 1, texte: `Tu avais décidé « ${d.decision} » (dernière nouvelle : ${d.derniere_nouvelle}). Où en es-tu ?` } : null; }
];

export function creerConseiller({ stockage, maintenant = () => new Date(), regles = REGLES } = {}) {
  const DOC = "noyau-conseiller"; let doc = null;
  const charger = async () => doc || (doc = (await stockage.lire("kv", DOC)) || { id: DOC, regles: {}, jour: "", n: 0, derniere: 0 });
  const famille = (cle) => cle.split(":")[0];
  return {
    /** Renvoie UNE suggestion ou null. `calme` = { focus, media, verrouille }. */
    async quandUtile(etat, calme = {}) {
      const d = await charger(), now = maintenant();
      if (!heureOk(now) || calme.focus || calme.media || calme.verrouille) return null;
      if (d.jour !== cleJour(now)) { d.jour = cleJour(now); d.n = 0; }
      if (d.n >= LIMITES.parJour || now - d.derniere < LIMITES.ecartMin) return null;
      const cands = regles.map((r) => r(etat || {}, now)).filter(Boolean).sort((a, b) => b.priorite - a.priorite);
      for (const c of cands) {
        const f = d.regles[famille(c.cle)] || {};
        if (f.coupee) continue; if (f.jusqu_a && now < new Date(f.jusqu_a)) continue; if ((f.vues || []).includes(c.cle)) continue;   // jamais deux fois la même suggestion
        f.vues = [...(f.vues || []), c.cle].slice(-30); f.ignorees = (f.ignorees || 0) + 1;             // comptée « ignorée » tant que Lucien ne répond pas
        if (f.ignorees > LIMITES.ignoreesMax) { f.coupee = true; d.regles[famille(c.cle)] = f; await stockage.ecrire("kv", d); continue; }
        d.regles[famille(c.cle)] = f; d.n++; d.derniere = now.getTime(); await stockage.ecrire("kv", d); return c;
      } return null;
    },
    /** Réponse de Lucien : "ok" (utile), "plus-tard" ou "non". */
    async repondre(cle, reponse) {
      const d = await charger(), now = maintenant(), f = d.regles[famille(cle)] || {};
      if (reponse === "ok") f.ignorees = 0;
      else if (reponse === "plus-tard") { f.ignorees = Math.max(0, (f.ignorees || 1) - 1); f.jusqu_a = new Date(now.getTime() + LIMITES.plusTardH * 3600e3).toISOString(); f.vues = (f.vues || []).filter((x) => x !== cle); }
      else if (reponse === "non") { f.ignorees = 0; f.jusqu_a = new Date(now.getTime() + LIMITES.nonJours * 86400e3).toISOString(); }
      else throw new Error("Réponse inconnue");
      d.regles[famille(cle)] = f; await stockage.ecrire("kv", d);
    },
    /** Lucien rallume une règle coupée (réglage). */
    async rallumer(famille_) { const d = await charger(); delete d.regles[famille_]; await stockage.ecrire("kv", d); },
    async etat() { const d = await charger(); return { aujourdhui: d.n, regles: Object.fromEntries(Object.entries(d.regles).map(([k, v]) => [k, { coupee: !!v.coupee, jusqu_a: v.jusqu_a || null }])) }; }
  };
}
