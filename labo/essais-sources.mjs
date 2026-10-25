// Laboratoire · essais des sources avec des réponses d'exemple (forme documentée de chaque API). `node labo/essais-sources.mjs`
// Vérifie le code d'extraction, le choix par domaine, le tourniquet, le délai et le filtrage des mots-clés. La forme RÉELLE des réponses se vérifie en direct dans labo.html (onglet Sources).
import { SOURCES, interroger, choisir, filtrerMotsCles, DOMAINES } from "../js/noyau/sources.js";
const mw = { query: { pages: { 1: { title: "Thé", index: 1, extract: "Boisson infusée.", fullurl: "https://x/1" }, 2: { title: "Théier", index: 2, extract: "Arbuste.", fullurl: "https://x/2" } } } };
const EX = {
  "wikipedia-fr": mw, "wikipedia-en": mw, wiktionnaire: mw, wikivoyage: mw, wikibooks: mw,
  wikidata: { search: [{ label: "thé", description: "boisson", concepturi: "http://www.wikidata.org/entity/Q6097" }] },
  openalex: { results: [{ title: "Tea study", publication_year: 2020, doi: "https://doi.org/10/x", cited_by_count: 4 }] },
  crossref: { message: { items: [{ title: ["Tea"], DOI: "10/x", issued: { "date-parts": [[2019]] }, "container-title": ["J Tea"] }] } },
  semanticscholar: { data: [{ title: "Tea", year: 2018, abstract: "About tea", url: "https://s2/x" }] },
  europepmc: { resultList: { result: [{ title: "Tea & health", authorString: "A B", journalTitle: "J", pubYear: "2020", doi: "10/y" }] } },
  doaj: { results: [{ bibjson: { title: "Tea", abstract: "abs", link: [{ url: "https://d/1" }] } }] },
  zenodo: { hits: { hits: [{ metadata: { title: "Tea data", description: "<p>jeu de données</p>" }, links: { html: "https://z/1" } }] } },
  openfoodfacts: { products: [{ product_name: "Thé vert", brands: "Marque", nutriscore_grade: "a", code: "123" }] },
  themealdb: { meals: [{ strMeal: "Soupe", strCategory: "Starter", strArea: "French", strInstructions: "Mélanger.", idMeal: "1" }] },
  openlibrary: { docs: [{ title: "Le thé", author_name: ["X"], first_publish_year: 1900, key: "/works/OL1W" }] },
  gutendex: { results: [{ title: "Book of tea", authors: [{ name: "Okakura" }], id: 769 }] },
  "archive-org": { response: { docs: [{ identifier: "id1", title: "Tea film", year: 1950 }] } },
  loc: { results: [{ title: "Tea poster", description: ["Affiche"], url: "https://loc.gov/1" }] },
  artic: { data: [{ id: 1, title: "Tea Time", artist_display: "Artiste", date_display: "1890" }] },
  stackexchange: { items: [{ title: "How &amp; why?", score: 3, is_answered: true, link: "https://so/1" }] },
  github: { items: [{ full_name: "a/b", stargazers_count: 10, description: "outil", html_url: "https://github.com/a/b" }] },
  npm: { objects: [{ package: { name: "tea", description: "lib", links: { npm: "https://npm/tea" } } }] },
  dblp: { result: { hits: { hit: [{ info: { title: "Tea paper", venue: "ICSE", year: "2020", url: "https://dblp/1" } }] } } },
  mdn: { documents: [{ title: "Array", summary: "résumé", mdn_url: "/fr/docs/Array" }] },
  hackernews: { hits: [{ title: "Tea", points: 5, num_comments: 2, created_at: "2026-01-01T00:00:00Z", url: "https://n/1", objectID: "9" }] },
  spaceflight: { results: [{ title: "Lancement", summary: "ok", url: "https://s/1", published_at: "2026-01-01" }] },
  launchlibrary: { results: [{ name: "Falcon 9", status: { name: "Go" }, net: "2026-02-01T00:00:00Z", url: "https://ll/1" }] },
  nasa: { collection: { items: [{ data: [{ title: "Lune", description: "<b>Photo</b>", date_created: "2020-01-01T00:00:00Z", nasa_id: "N1" }] }] } },
  gbif: { results: [{ scientificName: "Camellia sinensis", kingdom: "Plantae", rank: "SPECIES", key: 5 }] },
  inaturalist: { results: [{ id: 1, name: "Camellia sinensis", preferred_common_name: "Théier", rank: "species", observations_count: 12 }] },
  pubchem: { PropertyTable: { Properties: [{ CID: 2519, MolecularFormula: "C8H10N4O2", MolecularWeight: "194.19", IUPACName: "1,3,7-trimethylpurine-2,6-dione" }] } },
  datagouv: { data: [{ title: "Jeu", description: "Texte **md**", page: "https://data.gouv.fr/1" }] },
  nominatim: [{ display_name: "Paris, France", type: "city", lat: "48.85", lon: "2.35", osm_type: "relation", osm_id: 7444 }]
};
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
for (const s of SOURCES) { try { const r = s.extraire(EX[s.id] || {}); ok(EX[s.id] && r.length > 0 && r[0].titre, `extraction ${s.id}`); } catch (e) { ok(false, `extraction ${s.id} : ${e.message}`); } try { ok(/^https:\/\//.test(s.url("thé vert")), `adresse https ${s.id}`); } catch (e) { ok(false, s.id + " url " + e.message); } }
ok(SOURCES.every((s) => s.domaines.every((d) => d in DOMAINES)), "tous les domaines existent");
ok(choisir({}).length === 4, "par défaut : domaine général (4 sources)");
ok(choisir({ domaines: ["code"] }).every((s) => s.domaines.includes("code")), "domaine code");
ok(choisir({ domaines: ["tout"] }).length === SOURCES.length, "« tout » = toutes les sources");
ok(choisir({ ids: ["npm"], domaines: ["code"] }).length === 1, "identifiant explicite prioritaire");
ok(choisir({ coupees: ["wikipedia-fr"] }).every((s) => s.id !== "wikipedia-fr"), "source coupée exclue");
const get = async (u) => { const s = SOURCES.find((x) => u.includes(x.hote)); if (s.id === "crossref") throw new Error("HTTP 503"); return EX[s.id]; };
const r = await interroger("thé vert contact lucien@example.org 06 12 34 56 78", { domaines: ["tout"], get, max: 12, interdits: [] });
ok(!/@|\d{6}/.test(r.motsCles) && r.retires.length === 2, "mail et numéro retirés avant l'envoi : « " + r.motsCles + " »");
ok(r.resultats.length === 12, "plafond de 12 résultats");
ok(new Set(r.resultats.map((x) => x.source)).size >= 8, "diversité : " + new Set(r.resultats.map((x) => x.source)).size + " sources représentées");
ok(r.erreurs.some((e) => /Crossref/.test(e)), "une source en panne n'arrête pas les autres");
const lent = await interroger("thé", { ids: ["npm", "gbif"], get: (u) => (u.includes("npm") ? new Promise(() => {}) : Promise.resolve(EX.gbif)), delai: 60 });
ok(lent.resultats.length === 1 && lent.erreurs.length === 1, "une source muette est coupée au délai");
ok(filtrerMotsCles("Marie Dupont thé", ["marie"]).retires.includes("nom"), "nom tiré des souvenirs retiré");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
