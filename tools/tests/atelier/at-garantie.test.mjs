// Essais du moteur at-garantie (achats factices).
import { ajouterJours, ajouterMois, ecartJours, echeances, radar, rappels } from "../../../js/widgets/moteurs/at-garantie.js";
import { vrai, egal, leve, fin } from "./_outil.mjs";

egal([ajouterMois("2026-01-31", 1), ajouterMois("2028-01-31", 1), ajouterMois("2026-10-25", 24), ajouterMois("2026-12-15", 3)], ["2026-02-28", "2028-02-29", "2028-10-25", "2027-03-15"], "ajout de mois (fins de mois, années)");
egal([ajouterJours("2026-12-25", 14), ecartJours("2026-10-25", "2026-11-01"), ajouterMois("2026-02-30", 1)], ["2027-01-08", 7, null], "jours, écarts, date invalide");

const J = "2026-10-25";
const web = echeances({ id: "a1", nom: "Casque fictif", dateAchat: "2026-10-15", dateReception: "2026-10-20" }, J);
egal([web.statut, web.finRetour, web.joursRetour, web.finGarantie], ["retour", "2026-11-03", 9, "2028-10-15"], "achat en ligne : 14 j depuis la réception, garantie 24 mois");
vrai(web.texte.includes("03/11/2026") && web.texte.includes("9 j"), "texte lisible du retour");
const mag = echeances({ id: "a2", nom: "Grille-pain fictif", dateAchat: "2024-11-10", mode: "magasin" }, J);
egal([mag.statut, mag.finRetour, mag.joursGarantie], ["bientot", null, 16], "magasin : pas de retour légal, garantie bientôt finie");
egal(echeances({ id: "a3", nom: "Lampe", dateAchat: "2026-10-01", mode: "magasin", retourJours: 30 }, J).statut, "retour", "magasin : délai accordé par le magasin");
egal(echeances({ id: "a4", nom: "Vélo", dateAchat: "2024-01-05", extensionMois: 12 }, J).finGarantie, "2027-01-05", "extension de garantie");
egal(echeances({ id: "a5", nom: "Vieux", dateAchat: "2020-01-01" }, J).statut, "expiree", "garantie terminée");
const occ = echeances({ id: "a6", nom: "Téléphone d'occasion", dateAchat: "2026-05-01", etat: "occasion", garantieMois: 6, mode: "magasin" }, J);
vrai(occ.problemes.length === 1 && occ.finGarantie === "2026-11-01", "occasion à moins de 12 mois signalée");
egal(echeances({ id: "a7", nom: "Sans date" }, J).statut, "invalide", "date d'achat manquante");
vrai(echeances({ id: "a8", nom: "X", dateAchat: "2026-10-10", dateReception: "2026-10-01" }, J).problemes.includes("réception avant l'achat"), "réception incohérente signalée");
egal(echeances({ id: "a9", nom: "Dernier jour", dateAchat: "2026-10-11" }, J).joursRetour, 0, "dernier jour de retour compté");
leve(() => echeances({ dateAchat: "2026-01-01" }, "25/10/2026"), "date du jour mal écrite refusée");

const achats = [
  { id: "a5", nom: "Vieux", dateAchat: "2020-01-01" },
  { id: "a2", nom: "Grille-pain fictif", dateAchat: "2024-11-10", mode: "magasin" },
  { id: "a1", nom: "Casque fictif", dateAchat: "2026-10-15", dateReception: "2026-10-20" },
  { id: "a10", nom: "Écran fictif", dateAchat: "2026-10-20" },
  null,
];
egal(radar(achats, J).map((e) => e.id), ["a1", "a10", "a2", "a5"], "radar : retours qui finissent d'abord, puis garanties, puis expirées");
const r = rappels(achats, J);
vrai(r.every((x) => x.date >= J) && r.length > 0, "rappels seulement à venir");
egal(r[0], { id: "a1-retour-7", date: "2026-10-27", texte: "Casque fictif : fin du délai de retour dans 7 j." }, "premier rappel");
vrai(r.some((x) => x.id === "a2-garantie-7" && x.date === "2026-11-03"), "rappel de fin de garantie");
fin("at-garantie");
