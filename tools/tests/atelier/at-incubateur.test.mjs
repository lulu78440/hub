// Essais du moteur at-incubateur (idées factices).
import { incuber, typer, titrer, lireBudget, lireDuree, motsCles, ficheTexte } from "../../../js/widgets/moteurs/at-incubateur.js";
import { vrai, egal, fin } from "./_outil.mjs";

egal([lireBudget("pour 1 200 €"), lireBudget("49,90 euros"), lireBudget("80€"), lireBudget("3,5 EUR"), lireBudget("sans prix")], [120000, 4990, 8000, 350, null], "montants repérés en centimes");
egal([lireDuree("pendant 2 semaines"), lireDuree("un mois"), lireDuree("3 jours"), lireDuree("rien")], [14, 30, 3, null], "durées repérées en jours");
egal(["acheter un vélo", "apprendre le piano", "faire du sport chaque jour", "organiser une soirée", "créer un site", "repeindre le balcon"].map((t) => typer(t).id),
  ["achat", "apprendre", "habitude", "evenement", "creation", "general"], "types reconnus par mots repères");
egal(titrer("Je voudrais acheter un vélo électrique pour 1 200 € pour aller au travail. Et vite !"), "Acheter un vélo électrique pour aller au travail", "titre : amorce, montant et 2e phrase retirés");
vrai(titrer("a".repeat(10) + " " + "b".repeat(80)).length <= 61, "titre limité à 60 caractères");
egal(motsCles("J'aimerais apprendre le japonais, le japonais vite"), ["apprendre", "japonais", "vite"], "mots-clés sans mots vides ni doublons");

const velo = incuber("Je voudrais acheter un vélo électrique pour 1 200 € pour aller au travail.");
egal([velo.type, velo.budget, velo.objet], ["achat", 120000, "un vélo électrique pour aller au travail"], "fiche d'achat : type, budget, objet");
vrai(velo.criteres.includes("Coût total de 1 200 € au plus") && velo.criteres.length === 3, "critère de budget remplace le critère de coût");
vrai(velo.variantes[0].startsWith("Ne rien acheter") && velo.variantes.at(-1) === "Version à moitié prix : 600 € au plus", "variantes dont « ne rien acheter » et moitié prix");
egal(velo.prochaineAction, "Ouvrir une note et compter les occasions d'usage d'un vélo électrique pour aller au travail cette semaine", "prochaine action accordée (d'un)");
vrai(velo.essais.some((e) => e.includes("chaque fois qu'un vélo")), "élision « qu'un »");

const japon = incuber("Apprendre le japonais pendant 2 semaines");
egal([japon.type, japon.duree, japon.essais[0], japon.objet], ["apprendre", 14, "Tester pendant 14 jours, puis faire le bilan", "le japonais"], "durée transformée en essai");
egal(incuber("Acheter le nouveau robot").prochaineAction.includes("du nouveau robot"), true, "contraction « de le » → « du »");
egal(incuber("Et si je faisais 10 pompes chaque jour le matin").titre, "10 pompes chaque jour le matin", "amorce « et si je faisais » retirée");
const fete = incuber("Organiser une soirée jeux pour l'anniversaire de Léa, 80 euros");
egal([fete.type, fete.budget, fete.criteres[1]], ["evenement", 8000, "Coût total de 80 € au plus"], "événement avec budget");
egal(incuber("Créer un petit jeu de cartes", { type: "achat" }).type, "achat", "type imposé respecté");
vrai(incuber("Créer un jeu", { type: "inconnu" }).problemes.some((p) => p.includes("inconnu")), "type imposé inconnu signalé");
const vague = incuber("bof");
vrai(vague.type === "general" && vague.problemes.length === 2, "idée courte et non reconnue : modèle général et 2 remarques");
egal([incuber("").type, incuber(null).problemes, incuber("   ").texte], ["invalide", ["idée vide"], "Idée vide : rien à incuber."], "idée vide refusée sans erreur");
const t = velo.texte;
vrai(t.startsWith("# Acheter un vélo") && t.includes("Essais à faire :") && t.includes("Critères de réussite :") && t.includes("Prochaine action :"), "texte lisible complet");
egal(ficheTexte(null), "Idée vide : rien à incuber.", "texte d'une fiche absente");
fin("at-incubateur");
