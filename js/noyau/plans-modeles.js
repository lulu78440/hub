// Noyau · modèles de plan (orchestrateur, lot 8) : des workflows prêts à l'emploi, SANS IA (formulaire ou palette).
// Même forme et même validation que les workflows enregistrés (workflows.js) : les mêmes outils validés, les mêmes niveaux, les mêmes accords de Lucien.
// Proposés, jamais lancés d'office. « Une demande en langage naturel devient un plan » reste le travail du modèle (boucle.js) ; ces modèles sont le chemin sans IA.
import { verifierWorkflow } from "./workflows.js";

const SOURCE = { id: "source", libelle: "Source (dbnomics, banque_mondiale ou publie)", type: "choix", choix: ["dbnomics", "banque_mondiale", "publie"] };

export const MODELES_PLANS = Object.freeze([
  { id: "serie-en-courbe", nom: "Une série en courbe", pourquoi: "Lit une série d'une source publique et l'affiche en courbe, avec sa source et sa date.",
    parametres: [SOURCE, { id: "identifiant", libelle: "Identifiant de la série", exemple: "FR/SP.POP.TOTL" }],
    etapes: [{ nom: "lire_serie", params: { source: "@source", identifiant: "@identifiant" } }, { nom: "afficher_module", params: { jeu: "$1.jeu", vue: "courbe" } }] },
  { id: "serie-depuis", nom: "Une série depuis une date", pourquoi: "Lit une série, ne garde que la période qui suit une année, et l'affiche en courbe.",
    parametres: [SOURCE, { id: "identifiant", libelle: "Identifiant de la série", exemple: "FR/SP.POP.TOTL" }, { id: "debut", libelle: "Début (AAAA)", exemple: "2000" }],
    etapes: [{ nom: "lire_serie", params: { source: "@source", identifiant: "@identifiant" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "periode", debut: "@debut" } }, { nom: "afficher_module", params: { jeu: "$2.jeu", vue: "courbe" } }] },
  { id: "comparer-deux-series", nom: "Comparer deux séries", pourquoi: "Lit deux séries de même unité, les compare date par date et trace une courbe à deux lignes.",
    parametres: [SOURCE, { id: "serie_a", libelle: "Première série", exemple: "FR/SP.POP.TOTL" }, { id: "serie_b", libelle: "Seconde série", exemple: "DE/SP.POP.TOTL" }],
    etapes: [{ nom: "lire_serie", params: { source: "@source", identifiant: "@serie_a" } }, { nom: "lire_serie", params: { source: "@source", identifiant: "@serie_b" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "comparer", avec: "$2.jeu" } }, { nom: "afficher_module", params: { jeu: "$3.jeu", vue: "courbe" } }] },
  { id: "variation-en-barres", nom: "Variation d'une série en barres", pourquoi: "Lit une série, calcule sa variation en pourcentage d'une ligne à l'autre et l'affiche en barres.",
    parametres: [SOURCE, { id: "identifiant", libelle: "Identifiant de la série", exemple: "FR/FP.CPI.TOTL.ZG" }],
    etapes: [{ nom: "lire_serie", params: { source: "@source", identifiant: "@identifiant" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "variation", mode: "precedente" } }, { nom: "afficher_module", params: { jeu: "$2.jeu", vue: "barres" } }] },
  { id: "serie-a-enregistrer", nom: "Une série à enregistrer en module", pourquoi: "Lit une série, l'affiche, puis propose de l'enregistrer : Lucien voit la source avant d'accepter.",
    parametres: [SOURCE, { id: "identifiant", libelle: "Identifiant de la série", exemple: "FR/SP.POP.TOTL" }, { id: "module", libelle: "Identifiant du module (minuscules et tirets)", exemple: "population-france" }, { id: "titre", libelle: "Titre du module", exemple: "Population de la France" }],
    etapes: [{ nom: "lire_serie", params: { source: "@source", identifiant: "@identifiant" } }, { nom: "afficher_module", params: { jeu: "$1.jeu", vue: "courbe" } }, { nom: "enregistrer_module", params: { id: "@module", titre: "@titre", vue: "courbe", jeu: "$1.jeu" } }] }
].map((m) => Object.freeze(verifierWorkflow(m))));
