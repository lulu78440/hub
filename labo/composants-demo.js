// Laboratoire · onglet « Composants » (lot 2 orchestrateur) : chaque composant sur des données FACTICES, marquées « exemple ».
// Aucune donnée réelle, aucun réseau, aucun outil du Noyau : la démonstration appelle les composants par le code.
import { h } from "./ui-labo.js";
import { courbe, barres, tableau, chiffreCle, filtres, rendre, verifierJeu } from "../js/noyau/modules/composants.js";

const SOURCE = { nom: "Exemple fictif du labo (aucune source réelle)", maj: "2026-10-25", periode: "2010-2024", licence: "aucune (données inventées)", verifie: false };

/** Population fictive de trois villes imaginaires (une valeur manquante volontaire en 2016 pour Brumeval). */
export function jeuCourbe() {
  const lignes = [];
  const villes = { "Ville A (fictive)": [52000, 410], "Ville B (fictive)": [38000, 620], "Brumeval (fictive)": [61000, -150] };
  for (const [nom, [base, pente]] of Object.entries(villes))
    for (let a = 2010; a <= 2024; a++) lignes.push([String(a), nom, nom.startsWith("Brumeval") && a === 2016 ? null : Math.round(base + pente * (a - 2010) + ((a * 37) % 11) * 90)]);
  return { titre: "Population de villes imaginaires", colonnes: [{ id: "annee", libelle: "Année", type: "date" }, { id: "ville", libelle: "Ville", type: "texte" }, { id: "valeur", libelle: "Population", type: "nombre" }], lignes, unite: "habitants", source: SOURCE, exemple: true };
}
export function jeuBarres() {
  const k = [["Lundi", 4.2], ["Mardi", 6.8], ["Mercredi", 3.1], ["Jeudi", null], ["Vendredi", 7.5], ["Samedi", -1.2], ["Dimanche", 2.4]];
  return { titre: "Écart de température fictif par jour", colonnes: [{ id: "jour", libelle: "Jour", type: "texte" }, { id: "ecart", libelle: "Écart", type: "nombre" }], lignes: k.map(([a, b]) => [a, b]), unite: "°C", source: { ...SOURCE, periode: "semaine fictive" }, exemple: true };
}
export function jeuChiffre() {
  return { titre: "Indice fictif", colonnes: [{ id: "mois", libelle: "Mois", type: "date" }, { id: "indice", libelle: "Indice", type: "nombre" }], lignes: [["2026-08", 101.4], ["2026-09", 102.1]], unite: "base 100", source: { ...SOURCE, periode: "août-sept. 2026" }, exemple: true };
}

export function rendreComposants(c) {
  c.textContent = "";
  const jc = verifierJeu(jeuCourbe()), jb = verifierJeu(jeuBarres()), jk = verifierJeu(jeuChiffre());
  const graphe = courbe(jc, { x: "annee", y: "valeur", series: "ville" });
  const tab = tableau(jc, { titre: "Les mêmes données en tableau" });
  const fl = filtres(jc, { champs: ["ville", "annee"], surChangement: (p) => { graphe.composant.filtrer(p); tab.composant.filtrer(p); } });
  const refus = rendre("courbe", { ...jeuCourbe(), source: undefined }, { x: "annee", y: "valeur" });
  const piege = { ...jeuBarres(), titre: '<img src=x onerror="alert(1)">', lignes: [['<b>gras ?</b>', 3], ["Normal", 5]] };
  c.append(
    h("p", { class: "avert" }, "EXEMPLE · toutes les données de cet onglet sont inventées. Les composants sont ceux qu'affichera la fenêtre du Noyau (lot 2) ; aucun outil du Noyau n'y donne accès pour l'instant."),
    h("h3", {}, "Filtres (pilotent la courbe et le tableau)"), fl,
    h("h3", {}, "Courbe"), graphe,
    h("h3", {}, "Barres (valeur négative, valeur manquante)"), barres(jb, { categorie: "jour", valeur: "ecart" }),
    h("h3", {}, "Chiffre clé"), chiffreCle(jk, { valeur: "indice", x: "mois" }),
    h("h3", {}, "Tableau"), tab,
    h("h3", {}, "Refus sans source"), refus,
    h("h3", {}, "Texte piégé rendu comme du texte"), rendre("barres", piege, { categorie: "jour", valeur: "ecart" }),
    h("div", { class: "lab-ligne" }, h("button", { class: "lab-btn", type: "button", onclick: () => { const f = window.__fenetre; if (f && f.afficherComposant) f.afficherComposant("courbe", jc, { x: "annee", y: "valeur", series: "ville" }); } }, "Afficher la courbe dans la fenêtre du Noyau"), h("small", { class: "dim" }, "Appel par le code (pas un outil du Noyau)."))
  );
}
