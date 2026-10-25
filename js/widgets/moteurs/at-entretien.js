// Atelier · moteur at-entretien : carnet d'entretien → prochaines échéances et retards.
// Module pur : sans DOM, sans réseau, sans IA. Dates « AAAA-MM-JJ » en jours calendaires (sans fuseau).
// Tâche : { id, appareil, tache?, intervalleJours?, intervalleUsage?, unite? (ex. "km", "h", "cycles"),
//           derniere?: { date?, usage? }, usageActuel?, usageParJour? (estimation pour dater une échéance d'usage) }
// Une tâche peut avoir les deux intervalles (ex. vidange tous les 365 jours OU 15 000 km) : la première échéance atteinte compte.
// Sans dernière intervention connue, la tâche est « à faire » (on ne suppose rien).

const JOUR = 86400000, DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const versUTC = (s) => { const m = DAY_RE.exec(s || ""); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? d : null; };
const versJour = (d) => d.toISOString().slice(0, 10);
const fr = (s) => s.split("-").reverse().join("/");
const pos = (x) => Number.isFinite(+x) && +x > 0;

/** Ajoute des jours à une date. */
export function ajouterJours(s, n) { const d = versUTC(s); if (!d) return null; d.setUTCDate(d.getUTCDate() + n); return versJour(d); }
/** Jours de a à b. */
export function ecartJours(a, b) { const x = versUTC(a), y = versUTC(b); return x && y ? Math.round((y - x) / JOUR) : null; }

/** Échéance d'une tâche : { id, appareil, tache, statut, prochaineDate, joursRestants, prochainUsage, usageRestant, retardJours, retardUsage, cause, texte, problemes }.
 *  statut : "retard" | "bientot" | "ok" | "a-faire" (jamais faite) | "invalide". seuilJours / seuilUsagePct : « bientôt ». */
export function echeance(tache, aujourdhui, { seuilJours = 14, seuilUsagePct = 10 } = {}) {
  if (!versUTC(aujourdhui)) throw new Error("Date du jour attendue au format AAAA-MM-JJ.");
  const t = tache || {}, P = [];
  const appareil = t.appareil || "Appareil sans nom", nomTache = t.tache || "entretien", nom = `${appareil} · ${nomTache}`;
  const base = { id: t.id, appareil, tache: nomTache, prochaineDate: null, joursRestants: null, prochainUsage: null, usageRestant: null, retardJours: 0, retardUsage: 0, cause: null };
  const iJ = pos(t.intervalleJours) ? Math.round(+t.intervalleJours) : null, iU = pos(t.intervalleUsage) ? +t.intervalleUsage : null;
  if (!iJ && !iU) return { ...base, statut: "invalide", problemes: ["aucun intervalle (jours ou usage)"], texte: `${nom} : intervalle à renseigner.` };
  const d = t.derniere || {}, unite = t.unite ? " " + t.unite : "";
  if (d.date != null && !versUTC(d.date)) P.push("date de dernière intervention invalide");
  if (versUTC(d.date) && d.date > aujourdhui) P.push("dernière intervention dans le futur");
  const aDate = !!versUTC(d.date), aUsage = Number.isFinite(+d.usage) && d.usage !== null && d.usage !== "";
  const usageActuel = Number.isFinite(+t.usageActuel) && t.usageActuel !== null ? +t.usageActuel : null;
  if (iU && aUsage && usageActuel != null && usageActuel < +d.usage) P.push("usage actuel inférieur au dernier relevé");
  if (iU && usageActuel == null) P.push("usage actuel inconnu : échéance d'usage non calculée");
  const connue = (iJ && aDate) || (iU && aUsage);
  if (!connue) return { ...base, statut: "a-faire", problemes: [...P, "dernière intervention inconnue"], texte: `${nom} : jamais fait (ou date inconnue) — à faire.` };

  const r = { ...base, problemes: P };
  // Échéance par le temps.
  if (iJ && aDate) { r.prochaineDate = ajouterJours(d.date, iJ); r.joursRestants = ecartJours(aujourdhui, r.prochaineDate); }
  // Échéance par l'usage (et date estimée si l'usage quotidien est connu).
  let dateUsage = null;
  if (iU && aUsage) {
    r.prochainUsage = +d.usage + iU;
    if (usageActuel != null) {
      r.usageRestant = Math.round((r.prochainUsage - usageActuel) * 100) / 100;
      if (pos(t.usageParJour)) { const j = Math.floor(r.usageRestant / +t.usageParJour); dateUsage = ajouterJours(aujourdhui, j); }
    }
  }
  const retardT = r.joursRestants != null && r.joursRestants < 0, retardU = r.usageRestant != null && r.usageRestant < 0;
  if (retardT) r.retardJours = -r.joursRestants;
  if (retardU) r.retardUsage = -r.usageRestant;
  const bientotT = r.joursRestants != null && r.joursRestants <= seuilJours;
  const bientotU = r.usageRestant != null && r.usageRestant <= (iU * seuilUsagePct) / 100;
  const bientotE = dateUsage != null && ecartJours(aujourdhui, dateUsage) <= seuilJours;
  r.statut = retardT || retardU ? "retard" : bientotT || bientotU || bientotE ? "bientot" : "ok";
  r.cause = retardT && retardU ? "temps et usage" : retardT ? "temps" : retardU ? "usage" : bientotT && !(bientotU || bientotE) ? "temps" : (bientotU || bientotE) && !bientotT ? "usage" : bientotT ? "temps et usage" : null;
  // Date à retenir : la plus proche entre l'échéance de temps et l'échéance d'usage estimée.
  if (dateUsage && (!r.prochaineDate || dateUsage < r.prochaineDate)) { r.dateEstimeeUsage = dateUsage; }
  const morceaux = [];
  if (r.prochaineDate) morceaux.push(retardT ? `en retard de ${r.retardJours} j (prévu le ${fr(r.prochaineDate)})` : `le ${fr(r.prochaineDate)} (dans ${r.joursRestants} j)`);
  if (r.usageRestant != null) morceaux.push(retardU ? `dépassé de ${r.retardUsage.toLocaleString("fr-FR")}${unite}` : `dans ${r.usageRestant.toLocaleString("fr-FR")}${unite}${r.dateEstimeeUsage ? ` (vers le ${fr(r.dateEstimeeUsage)})` : ""}`);
  r.texte = `${nom} : ${morceaux.join(" ou ") || "échéance inconnue"}.`;
  return r;
}

/** Tout le carnet, le plus urgent d'abord : retards (les plus anciens d'abord), puis « à faire », bientôt, à jour, invalides. */
export function prochaines(taches, aujourdhui, options) {
  const rang = { retard: 0, "a-faire": 1, bientot: 2, ok: 3, invalide: 4 };
  const proche = (e) => Math.min(e.joursRestants ?? Infinity, e.dateEstimeeUsage ? ecartJours(aujourdhui, e.dateEstimeeUsage) : Infinity);
  return (taches || []).filter((t) => t && typeof t === "object").map((t) => echeance(t, aujourdhui, options))
    .sort((a, b) => rang[a.statut] - rang[b.statut]
      || (a.statut === "retard" ? b.retardJours - a.retardJours || b.retardUsage - a.retardUsage : proche(a) - proche(b))
      || String(a.appareil).localeCompare(String(b.appareil), "fr"));
}

/** Retards seuls. */
export function retards(taches, aujourdhui, options) { return prochaines(taches, aujourdhui, options).filter((e) => e.statut === "retard"); }

/** Enregistre une intervention (renvoie une NOUVELLE tâche, l'ancienne n'est pas modifiée). */
export function enregistrer(tache, { date, usage } = {}) {
  if (!versUTC(date)) throw new Error("Date d'intervention attendue au format AAAA-MM-JJ.");
  const derniere = { date };
  if (Number.isFinite(+usage) && usage !== null && usage !== "") derniere.usage = +usage;
  const n = { ...tache, derniere };
  if (derniere.usage != null && !(Number.isFinite(+tache.usageActuel) && +tache.usageActuel > derniere.usage)) n.usageActuel = derniere.usage;
  return n;
}

/** Résumé texte du carnet (pour une note ou un rappel). */
export function resumeTexte(taches, aujourdhui, options) {
  const l = prochaines(taches, aujourdhui, options);
  const n = (s) => l.filter((e) => e.statut === s).length;
  const tete = `Entretien au ${fr(aujourdhui)} : ${n("retard")} en retard, ${n("a-faire")} à faire, ${n("bientot")} bientôt, ${n("ok")} à jour.`;
  return [tete, ...l.filter((e) => e.statut !== "ok").map((e) => `- ${e.texte}`)].join("\n");
}
