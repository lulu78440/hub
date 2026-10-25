// Laboratoire · essais de la recherche tolérante : `node labo/essais-recherche.mjs`
import { Index } from "../js/noyau/recherche.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const ix = new Index(); ix.ajouter("a", "Ma voiture est au garage pour la révision"); ix.ajouter("b", "Le chat noir dort sur le canapé"); ix.ajouter("c", "Le chat roux mange des croquettes"); ix.ajouter("d", "Je dois faire une sauvegarde de mes données");
const ids = (q) => ix.chercher(q).map((r) => r.id);
ok(ids("auto")[0] === "a", "synonyme : « auto » retrouve la voiture : " + ids("auto"));
ok(ids("backup")[0] === "d", "synonyme : « backup » retrouve la sauvegarde");
ok(ids("chat").length === 2 && !ids("chat -noir").includes("b") && ids("chat -noir").includes("c"), "exclusion : « chat -noir » écarte le chat noir : " + ids("chat -noir"));
ok(ids("voitrue")[0] === "a", "faute de frappe : « voitrue »");
ix.ajouter("e", "Une auto électrique"); const r = ix.chercher("auto"); ok(r[0].id === "e" && r.some((x) => x.id === "a"), "le mot demandé pèse plus que son synonyme : " + r.map((x) => x.id));
ok(ids("zzz").length === 0, "rien de trouvé : liste vide");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
