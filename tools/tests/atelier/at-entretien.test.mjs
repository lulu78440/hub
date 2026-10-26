// Essais du moteur at-entretien (carnet factice).
import { ajouterJours, ecartJours, echeance, prochaines, retards, enregistrer, resumeTexte } from "../../../js/widgets/moteurs/at-entretien.js";
import { vrai, egal, leve, fin } from "./_outil.mjs";

const J = "2026-10-25";
egal([ajouterJours("2025-10-01", 365), ecartJours(J, "2026-11-01"), ajouterJours("2026-02-30", 1)], ["2026-10-01", 7, null], "outils de dates");
const T = [
  { id: "t1", appareil: "Chaudière fictive", tache: "révision", intervalleJours: 365, derniere: { date: "2025-10-01" } },
  { id: "t2", appareil: "Voiture fictive", tache: "vidange", intervalleJours: 365, intervalleUsage: 15000, unite: "km", derniere: { date: "2026-03-01", usage: 40000 }, usageActuel: 54200, usageParJour: 40 },
  { id: "t3", appareil: "Hotte", tache: "filtre", intervalleJours: 90, derniere: { date: "2026-10-01" } },
  { id: "t4", appareil: "Vélo", tache: "chaîne", intervalleUsage: 3000, unite: "km", derniere: { usage: 1000 }, usageActuel: 4500 },
  { id: "t5", appareil: "Détecteur de fumée", tache: "pile", intervalleJours: 365 },
  { id: "t6", appareil: "Rien" },
  null,
];
const ch = echeance(T[0], J);
egal([ch.statut, ch.cause, ch.prochaineDate, ch.retardJours], ["retard", "temps", "2026-10-01", 24], "retard par le temps");
vrai(ch.texte === "Chaudière fictive · révision : en retard de 24 j (prévu le 01/10/2026).", "texte du retard");
const vo = echeance(T[1], J);
egal([vo.statut, vo.cause, vo.prochaineDate, vo.prochainUsage, vo.usageRestant, vo.dateEstimeeUsage], ["bientot", "usage", "2027-03-01", 55000, 800, "2026-11-14"], "double intervalle : l'usage arrive d'abord (date estimée)");
egal(echeance(T[2], J).statut, "ok", "tâche à jour");
egal(echeance(T[2], "2026-12-20").statut, "bientot", "bientôt par le temps (14 j)");
const ve = echeance(T[3], J);
egal([ve.statut, ve.cause, ve.retardUsage], ["retard", "usage", 500], "retard par l'usage");
egal(echeance(T[3], J, { seuilUsagePct: 0 }).statut, "retard", "option de seuil sans effet sur un retard");
egal(echeance({ ...T[3], usageActuel: 3800 }, J).statut, "bientot", "bientôt par l'usage (10 % de l'intervalle)");
const pile = echeance(T[4], J);
vrai(pile.statut === "a-faire" && pile.texte.includes("à faire"), "jamais faite : à faire, rien n'est supposé");
egal(echeance(T[5], J).statut, "invalide", "sans intervalle : invalide");
vrai(echeance({ ...T[2], derniere: { date: "2026-12-01" } }, J).problemes.includes("dernière intervention dans le futur"), "date future signalée");
vrai(echeance({ ...T[3], usageActuel: 500 }, J).problemes.includes("usage actuel inférieur au dernier relevé"), "compteur incohérent signalé");
vrai(echeance({ ...T[3], usageActuel: undefined }, J).problemes[0].includes("usage actuel inconnu"), "usage actuel inconnu signalé");
egal(echeance(T[0], J).joursRestants, -24, "jours restants négatifs en retard");
leve(() => echeance(T[0], "25/10/2026"), "date du jour mal écrite refusée");

egal(prochaines(T, J).map((e) => e.id), ["t1", "t4", "t5", "t2", "t3", "t6"], "carnet trié : retards, à faire, bientôt, à jour, invalides");
egal(retards(T, J).map((e) => e.id), ["t1", "t4"], "retards seuls");
const n = enregistrer(T[1], { date: J, usage: 54200 });
vrai(n !== T[1] && T[1].derniere.date === "2026-03-01", "enregistrer ne modifie pas l'original");
egal([echeance(n, J).statut, echeance(n, J).prochaineDate, echeance(n, J).prochainUsage], ["ok", "2027-10-25", 69200], "après intervention : à jour");
egal(enregistrer({ appareil: "x", intervalleUsage: 10 }, { date: J, usage: 7 }).usageActuel, 7, "usage actuel mis à jour si plus ancien");
leve(() => enregistrer(T[0], { date: "hier" }), "date d'intervention invalide refusée");
const txt = resumeTexte(T, J);
vrai(txt.startsWith("Entretien au 25/10/2026 : 2 en retard, 1 à faire, 1 bientôt, 1 à jour.") && !txt.includes("Hotte"), "résumé : tâches à jour non listées");
fin("at-entretien");
