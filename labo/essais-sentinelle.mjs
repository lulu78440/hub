// Laboratoire · essais de l'alerte « fichier sensible modifié sans commit » : `node labo/essais-sentinelle.mjs`
import { creerHubSimule } from "./hub-simule.js";
import { brancher, hote } from "../js/noyau/hote.js";
import { creerSentinelle } from "../js/noyau/sentinelle.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
let contenu = "version A", commits = [];
const reponse = (u) => String(u).includes("api.github.com") ? { ok: commits !== null, status: commits === null ? 500 : 200, json: async () => commits, text: async () => "" } : { ok: true, status: 200, text: async () => contenu, json: async () => ({}) };
const h = creerHubSimule({ vide: true, fetch: async (u) => reponse(u) });
const s = creerSentinelle(); await s.accepterReference();
const emp = async () => (await s.controles()).find((x) => x.id === "empreintes");
let c = await emp(); ok(c.niveau === "ok", "fichiers conformes à la référence : « ok »");
contenu = "version B"; commits = []; h.avancer(36e5);
c = await emp(); ok(c.niveau === "critique" && /sans aucun commit/.test(c.titre), "modifié SANS commit sur le dépôt : critique (" + c.niveau + ")");
contenu = "version B"; commits = [{ sha: "abc" }]; h.avancer(40 * 6e4); c = await emp(); ok(c.niveau === "alerte" && /1 commit/.test(c.detail), "modifié avec un commit connu : simple alerte");
commits = null; h.avancer(40 * 6e4); c = await emp(); ok(c.niveau === "alerte", "GitHub injoignable : alerte prudente, pas de faux critique");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
