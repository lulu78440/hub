// Laboratoire · plan de 6 étapes dans le vrai cycle de pensée (orchestrateur, lot 3) : `node labo/essais-plan-boucle.mjs`
// Moteur simulé (un script de réponses), hub simulé, réseau simulé. Prouve qu'un plan tient en UN tour de modèle (avant : 3 tours, 4 outils au plus).
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const dbn = (nom, v) => ({ series: { docs: [{ series_name: nom, period: ["2000", "2005", "2010", "2015"], value: v, indexed_at: "2026-10-20T10:00:00Z" }] } });
const h = creerHubSimule({ vide: true, fetch: async (u) => ({ ok: true, status: 200, json: async () => ({}), text: async () => JSON.stringify(/RENNES/.test(u) ? dbn("Rennes", [206000, 212000, 206000, 215000]) : dbn("Versailles", [85000, 86000, 85500, 85800])) }) });
const affiches = []; h.hote.ui.afficherComposant = (vue, jeu, o) => { affiches.push({ vue, o, lignes: jeu.lignes.length }); return { classList: { contains: () => false } }; };
const vus = [];
const script = [
  { appels: [
    { nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/VERSAILLES" } },
    { nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/RENNES" } },
    { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "comparer", avec: "$2.jeu" } },
    { nom: "afficher_module", params: { jeu: "$3.jeu", vue: "courbe", titre: "Versailles et Rennes" } },
    { nom: "enregistrer_module", params: { id: "versailles-rennes", titre: "Versailles et Rennes", vue: "courbe", jeu: "$3.jeu" } }
  ] },
  { appels: [{ nom: "repondre", params: { texte: "Voici la comparaison, source DBnomics (INSEE), données du 20/10/2026.", ton: "calme", confiance: "haute", sources: [] } }] }
];
let tour = 0;
const moteur = { nom: "moteur simulé", generer: async ({ messages }) => { const s = script[tour++]; vus.push(JSON.stringify(messages)); return { texte: "", appels: s.appels, brut: null, usage: { total: 10 }, ms: 1 }; } };
const n = await creerNoyau({ moteur });
const demandes = []; n.confirmerAvec(async (d) => { demandes.push(d); return false; });          // Lucien REFUSE l'enregistrement
const r = await n.poser("Compare la population de Versailles et de Rennes depuis 2000 et garde le graphique");
const tr = n.cycle.inspecteur()[0];
ok(tour === 2 && tr.requetes === 2, "tout le travail tient en 2 requêtes au modèle (1 tour de plan + la réponse), au lieu de 3 tours");
ok(tr.outils.length === 5 && tr.outils.slice(0, 4).every((o) => o.ok), "5 étapes demandées en un seul tour : les 4 premières réussissent");
ok(affiches.length === 1 && affiches[0].vue === "courbe" && affiches[0].lignes === 8, "la courbe est affichée (8 lignes = 4 dates × 2 séries)");
ok(demandes.length === 1 && demandes[0].outil === "enregistrer_module" && demandes[0].niveau === "CONFIRMATION", "seule l'étape d'enregistrement demande l'accord de Lucien");
ok(!tr.outils[4].ok && tr.outils[4].refus === "refuse_par_lucien", "Lucien refuse : le module n'est pas enregistré et l'échange continue");
const kv = await h.hote.stockage.lire("kv", "noyau-modules"); ok(!kv || kv.lignes.length === 0, "rien n'a été écrit dans les modules");
ok(r.texte.includes("DBnomics") || /Voici/.test(r.texte), "la réponse finale du modèle est rendue à Lucien");
const second = vus[1]; ok(!/85500|212000/.test(second), "le modèle n'a reçu aucune valeur intermédiaire de la série (ni 85500 ni 212000) : seulement des références et des résumés");
ok(/jeu:[a-z0-9]{6,16}/.test(second), "il a reçu les références « jeu:… »");
const lignes = await h.hote.stockage.lire("kv", "noyau-journal"); const journal = lignes ? lignes.lignes : [];
ok(journal.some((l) => l.outil === "(plan)" && /lire_serie → lire_serie → transformer_donnees → afficher_module → enregistrer_module/.test(l.params)), "une ligne « plan » dans le journal des actions, en plus d'une ligne par outil");
ok(journal.filter((l) => l.outil === "enregistrer_module").every((l) => l.statut === "REFUSÉ_PAR_LUCIEN"), "le refus de Lucien est journalisé");
console.log("  (requêtes comptées au budget : " + n.budget.utilisees() + ")");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
