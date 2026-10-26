// Essai BUD-1 : un import sur un mois déjà enregistré AJOUTE, il ne remplace pas. Magasin simulé en mémoire, relevés ENTIÈREMENT FACTICES.
import { importerReleve, nouvelles, enregistrerOps, fusionner, cleOperation } from "../../../js/widgets/moteurs/bud-csv.js";
import { egal, vrai, fin } from "./_outil.mjs";

const mem = new Map();
const mag = { get: async (id) => (mem.has(id) ? JSON.parse(JSON.stringify(mem.get(id))) : undefined), put: async (d) => { mem.set(d.id, JSON.parse(JSON.stringify(d))); } };
const toutes = () => [...mem.values()].filter((d) => d.id.startsWith("budget-ops-")).flatMap((d) => d.operations);
// Ce que fait le widget : relire le magasin, ne garder que les nouvelles, les AJOUTER.
async function importer(csv) {
  const lu = importerReleve(csv), nouv = nouvelles(toutes(), lu.operations);
  await enregistrerOps(mag, nouv.map((o) => ({ id: o.id, date: o.date, libelle: o.libelle, montant: o.montant })));
  return { lues: lu.operations.length, nouvelles: nouv.length };
}
const T = "Date;Libellé;Montant\n";
const f1 = T + "05/10/2026;CB CARREFOUR MARKET;-45,30\n12/10/2026;PRLV ELECTRICITE FICTIVE;-62,00\n";
const f2 = T + "20/10/2026;CB BOULANGERIE FICTIVE;-3,40\n";

egal(await importer(f1), { lues: 2, nouvelles: 2 }, "premier import : 2 opérations d'octobre");
egal(toutes().length, 2, "magasin : 2 opérations");
egal(await importer(f2), { lues: 1, nouvelles: 1 }, "deuxième import, même mois : 1 opération");
egal(toutes().length, 3, "BUD-1 : les 3 opérations d'octobre sont là (avant la correction il n'en restait qu'une)");
egal([...mem.keys()].filter((k) => k.startsWith("budget-ops-")), ["budget-ops-2026-10"], "un seul document pour le mois");
egal(await importer(f1), { lues: 2, nouvelles: 0 }, "ré-import du premier relevé : rien de nouveau");
egal(await importer(f1 + f2.slice(T.length)), { lues: 3, nouvelles: 0 }, "relevé recouvrant : aucun doublon");
egal(toutes().length, 3, "toujours 3 opérations");
egal(new Set(toutes().map((o) => o.id)).size, 3, "identifiants tous distincts");

// Rechargement : on repart du magasin seul
egal(toutes().map((o) => o.libelle).sort(), ["CB BOULANGERIE FICTIVE", "CB CARREFOUR MARKET", "PRLV ELECTRICITE FICTIVE"], "après rechargement : rien de perdu");

// Un choix manuel déjà fait n'est pas écrasé par un ré-import
const doc = await mag.get("budget-ops-2026-10"); doc.operations[0].categorieManuelle = "Courses"; await mag.put(doc);
await importer(f1);
egal(toutes().filter((o) => o.categorieManuelle).length, 1, "le classement manuel survit au ré-import");

// Mois différents : un document par mois, l'autre mois n'est pas touché
await importer(T + "03/11/2026;CB TEST FICTIF;-1,00\n");
egal([...mem.keys()].sort(), ["budget-ops-2026-10", "budget-ops-2026-11"], "un document par mois");
egal(toutes().length, 4, "4 opérations en tout");

// Clé stable : date | libellé | montant | rang. Deux achats identiques le même jour = deux opérations, relues pareil dans un autre fichier.
const jumeaux = T + "05/10/2026;CB CAFE FICTIF;-1,20\n05/10/2026;CB CAFE FICTIF;-1,20\n";
const j = importerReleve(jumeaux).operations;
egal(cleOperation(j[0], 1), "2026-10-05|" + cleOperation(j[0], 1).split("|")[1] + "|-120|1", "forme de la clé");
vrai(j[0].id !== j[1].id, "rang : deux jumeaux restent distincts");
await importer(jumeaux); const n1 = toutes().length; await importer(jumeaux);
egal([n1, toutes().length], [6, 6], "jumeaux : ajoutés une fois, pas deux au ré-import");
egal(fusionner([{ id: "a" }], [{ id: "a", x: 1 }, { id: "b" }]).map((o) => o.id), ["a", "b"], "fusion par identifiant");
fin("bud-fusion");
