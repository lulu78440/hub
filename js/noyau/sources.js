// Noyau · sources de connaissances autorisées pour `chercher_sources` (contrat, section 6).
// Liste FIXE, dans le code public, en lecture seule. Seuls les mots-clés partent vers ces sites.
// Aucun import : le réseau passe par la fonction `get` fournie par l'appelant (hote.fetch).
//
// Sources : une trentaine de références publiques, sans clé, en lecture, accessibles depuis une page web (CORS). Retirées : dev.to (pas de recherche publique) et arXiv (XML sans CORS).
// Les formes de réponse suivent la documentation de chaque API ; le laboratoire (onglet Sources) les vérifie en direct depuis le navigateur de Lucien.

const coupe = (s, n = 300) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const enc = encodeURIComponent;

const nettoyer = (s) => String(s == null ? "" : s).replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const mediawiki = (hote, n = 3) => (q) => `https://${hote}/w/api.php?action=query&generator=search&gsrsearch=${enc(q)}&gsrlimit=${n}&prop=extracts|info&exintro=1&explaintext=1&exsentences=3&inprop=url&format=json&origin=*`;
const pagesMW = (j) => Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).map((p) => ({ titre: p.title, extrait: coupe(p.extract), url: p.fullurl }));
const S = (id, nom, hote, domaines, url, extraire, delai = 0) => ({ id, nom, hote, domaines, verifie: false, url, extraire, delai });

/** Domaines : « general » est interrogé par défaut ; le modèle choisit les autres selon la question ; « tout » les interroge toutes. */
export const DOMAINES = {
  general: "Encyclopédies et savoirs généraux", langue: "Mots, définitions, langue", science: "Articles scientifiques", sante: "Santé, médecine, alimentation",
  livres: "Livres et textes anciens", code: "Programmation et logiciels", espace: "Espace et astronomie", nature: "Espèces vivantes, nature",
  france: "Données publiques françaises", culture: "Art, musées, archives", lieux: "Lieux et géographie", chimie: "Chimie", voyage: "Voyage", actualite: "Technologie et actualité du web", cuisine: "Recettes"
};

export const SOURCES = [
  S("wikipedia-fr", "Wikipedia FR", "fr.wikipedia.org", ["general"], mediawiki("fr.wikipedia.org"), pagesMW),
  S("wikipedia-en", "Wikipedia EN", "en.wikipedia.org", ["general"], mediawiki("en.wikipedia.org"), pagesMW),
  S("wikidata", "Wikidata", "www.wikidata.org", ["general"], (q) => `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${enc(q)}&language=fr&uselang=fr&limit=3&format=json&origin=*`,
    (j) => (j.search || []).map((e) => ({ titre: e.label, extrait: coupe(e.description), url: e.concepturi || e.url }))),
  S("openalex", "OpenAlex", "api.openalex.org", ["general", "science"], (q) => `https://api.openalex.org/works?search=${enc(q)}&per-page=3&select=title,publication_year,doi,cited_by_count`,
    (j) => (j.results || []).map((r) => ({ titre: r.title, extrait: `Publication de ${r.publication_year || "date inconnue"}, citée ${r.cited_by_count || 0} fois.`, url: r.doi }))),
  S("wiktionnaire", "Wiktionnaire", "fr.wiktionary.org", ["langue"], mediawiki("fr.wiktionary.org", 2), pagesMW),
  S("wikivoyage", "Wikivoyage", "fr.wikivoyage.org", ["voyage", "lieux"], mediawiki("fr.wikivoyage.org", 2), pagesMW),
  S("wikibooks", "Wikibooks FR", "fr.wikibooks.org", ["science", "code", "langue"], mediawiki("fr.wikibooks.org", 2), pagesMW),
  S("crossref", "Crossref", "api.crossref.org", ["science"], (q) => `https://api.crossref.org/works?query=${enc(q)}&rows=3&select=title,issued,DOI,container-title`,
    (j) => ((j.message && j.message.items) || []).map((r) => ({ titre: (r.title || [])[0], extrait: coupe(`${(r["container-title"] || [])[0] || ""} ${r.issued && r.issued["date-parts"] && r.issued["date-parts"][0] ? r.issued["date-parts"][0][0] : ""}`), url: r.DOI ? "https://doi.org/" + r.DOI : null }))),
  S("europepmc", "Europe PMC", "www.ebi.ac.uk", ["science", "sante"], (q) => `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${enc(q)}&format=json&pageSize=3&resultType=lite`,
    (j) => ((j.resultList && j.resultList.result) || []).map((r) => ({ titre: r.title, extrait: coupe(`${r.authorString || ""} · ${r.journalTitle || ""} ${r.pubYear || ""}`), url: r.doi ? "https://doi.org/" + r.doi : null }))),
  S("doaj", "DOAJ", "doaj.org", ["science"], (q) => `https://doaj.org/api/search/articles/${enc(q)}?pageSize=3`,
    (j) => (j.results || []).map((r) => { const b = r.bibjson || {}; return { titre: b.title, extrait: coupe(b.abstract), url: ((b.link || [])[0] || {}).url }; })),
  S("zenodo", "Zenodo", "zenodo.org", ["science"], (q) => `https://zenodo.org/api/records?q=${enc(q)}&size=3`,
    (j) => ((j.hits && j.hits.hits) || []).map((r) => ({ titre: r.metadata && r.metadata.title, extrait: coupe(nettoyer(r.metadata && r.metadata.description)), url: r.links && r.links.html }))),
  S("openfoodfacts", "Open Food Facts", "world.openfoodfacts.org", ["sante", "cuisine"], (q) => `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc(q)}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,nutriscore_grade,code`,
    (j) => (j.products || []).map((p) => ({ titre: p.product_name, extrait: `${p.brands || "marque inconnue"} · Nutri-Score ${(p.nutriscore_grade || "?").toUpperCase()}`, url: p.code ? "https://world.openfoodfacts.org/product/" + p.code : null }))),
  S("themealdb", "TheMealDB", "www.themealdb.com", ["cuisine"], (q) => `https://www.themealdb.com/api/json/v1/1/search.php?s=${enc(q)}`,
    (j) => (j.meals || []).map((m) => ({ titre: m.strMeal, extrait: coupe(`${m.strCategory || ""} · ${m.strArea || ""} · ${m.strInstructions || ""}`), url: m.strSource || ("https://www.themealdb.com/meal/" + m.idMeal) }))),
  S("openlibrary", "Open Library", "openlibrary.org", ["livres"], (q) => `https://openlibrary.org/search.json?q=${enc(q)}&limit=3&fields=title,author_name,first_publish_year,key`,
    (j) => (j.docs || []).map((d) => ({ titre: d.title, extrait: `${(d.author_name || []).slice(0, 2).join(", ")} · ${d.first_publish_year || "?"}`, url: d.key ? "https://openlibrary.org" + d.key : null }))),
  S("gutendex", "Project Gutenberg", "gutendex.com", ["livres", "culture"], (q) => `https://gutendex.com/books/?search=${enc(q)}`,
    (j) => (j.results || []).slice(0, 3).map((b) => ({ titre: b.title, extrait: `${((b.authors || [])[0] || {}).name || "auteur inconnu"} · texte libre de droits`, url: "https://www.gutenberg.org/ebooks/" + b.id })), 22000),
  S("archive-org", "Internet Archive", "archive.org", ["livres", "culture"], (q) => `https://archive.org/advancedsearch.php?q=${enc(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=3&output=json`,
    (j) => ((j.response && j.response.docs) || []).map((d) => ({ titre: d.title, extrait: `Archive ${d.year || ""}`.trim(), url: "https://archive.org/details/" + d.identifier }))),
  S("stackexchange", "Stack Overflow", "api.stackexchange.com", ["code"], (q) => `https://api.stackexchange.com/2.3/search/advanced?q=${enc(q)}&site=stackoverflow&pagesize=3&order=desc&sort=relevance`,
    (j) => (j.items || []).map((i) => ({ titre: nettoyer(i.title), extrait: `${i.score || 0} votes · ${i.is_answered ? "répondue" : "sans réponse acceptée"}`, url: i.link }))),
  S("github", "GitHub (dépôts)", "api.github.com", ["code"], (q) => `https://api.github.com/search/repositories?q=${enc(q)}&per_page=3`,
    (j) => (j.items || []).map((r) => ({ titre: r.full_name, extrait: coupe(`${r.stargazers_count || 0} étoiles · ${r.description || ""}`), url: r.html_url }))),
  S("npm", "npm", "registry.npmjs.org", ["code"], (q) => `https://registry.npmjs.org/-/v1/search?text=${enc(q)}&size=3`,
    (j) => (j.objects || []).map((o) => ({ titre: o.package && o.package.name, extrait: coupe(o.package && o.package.description), url: o.package && o.package.links && o.package.links.npm }))),
  S("dblp", "DBLP", "dblp.org", ["code", "science"], (q) => `https://dblp.org/search/publ/api?q=${enc(q)}&format=json&h=3`,
    (j) => ((((j.result || {}).hits || {}).hit) || []).map((h) => ({ titre: h.info && h.info.title, extrait: `${(h.info && h.info.venue) || ""} ${(h.info && h.info.year) || ""}`.trim(), url: h.info && h.info.url }))),
  S("mdn", "MDN", "developer.mozilla.org", ["code"], (q) => `https://developer.mozilla.org/api/v1/search?q=${enc(q)}&locale=fr&size=3`,
    (j) => (j.documents || []).map((d) => ({ titre: d.title, extrait: coupe(d.summary), url: "https://developer.mozilla.org" + d.mdn_url }))),
  S("hackernews", "Hacker News", "hn.algolia.com", ["actualite", "code"], (q) => `https://hn.algolia.com/api/v1/search?query=${enc(q)}&tags=story&hitsPerPage=3`,
    (j) => (j.hits || []).map((h) => ({ titre: h.title, extrait: `${h.points || 0} points · ${h.num_comments || 0} commentaires · ${String(h.created_at || "").slice(0, 10)}`, url: h.url || "https://news.ycombinator.com/item?id=" + h.objectID, date: h.created_at }))),
  S("spaceflight", "Spaceflight News", "api.spaceflightnewsapi.net", ["espace", "actualite"], (q) => `https://api.spaceflightnewsapi.net/v4/articles/?search=${enc(q)}&limit=3`,
    (j) => (j.results || []).map((a) => ({ titre: a.title, extrait: coupe(a.summary), url: a.url, date: a.published_at }))),
  S("launchlibrary", "Launch Library", "ll.thespacedevs.com", ["espace"], (q) => `https://ll.thespacedevs.com/2.2.0/launch/?search=${enc(q)}&limit=3&mode=list`,
    (j) => (j.results || []).map((l) => ({ titre: l.name, extrait: `${(l.status && l.status.name) || ""} · ${String(l.net || "").slice(0, 10)}`, url: l.url, date: l.net }))),
  S("nasa", "NASA images", "images-api.nasa.gov", ["espace", "culture"], (q) => `https://images-api.nasa.gov/search?q=${enc(q)}&media_type=image&page_size=3`,
    (j) => (((j.collection || {}).items) || []).slice(0, 3).map((i) => { const d = (i.data || [])[0] || {}; return { titre: d.title, extrait: coupe(`${String(d.date_created || "").slice(0, 10)} · ${nettoyer(d.description)}`), url: d.nasa_id ? "https://images.nasa.gov/details/" + enc(d.nasa_id) : null }; })),
  S("gbif", "GBIF", "api.gbif.org", ["nature"], (q) => `https://api.gbif.org/v1/species/search?q=${enc(q)}&limit=3`,
    (j) => (j.results || []).map((r) => ({ titre: r.scientificName, extrait: `${r.kingdom || ""} · ${r.rank || ""}${r.vernacularName ? " · " + r.vernacularName : ""}`, url: r.key ? "https://www.gbif.org/species/" + r.key : null }))),
  S("inaturalist", "iNaturalist", "api.inaturalist.org", ["nature"], (q) => `https://api.inaturalist.org/v1/taxa?q=${enc(q)}&per_page=3`,
    (j) => (j.results || []).map((t) => ({ titre: t.preferred_common_name ? `${t.preferred_common_name} (${t.name})` : t.name, extrait: `${t.rank || ""} · ${t.observations_count || 0} observations`, url: t.wikipedia_url || ("https://www.inaturalist.org/taxa/" + t.id) }))),
  S("pubchem", "PubChem", "pubchem.ncbi.nlm.nih.gov", ["chimie", "sante"], (q) => `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${enc(q)}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`,
    (j) => ((j.PropertyTable && j.PropertyTable.Properties) || []).slice(0, 2).map((p) => ({ titre: p.IUPACName || ("Composé " + p.CID), extrait: `Formule ${p.MolecularFormula} · masse ${p.MolecularWeight}`, url: "https://pubchem.ncbi.nlm.nih.gov/compound/" + p.CID }))),
  S("datagouv", "data.gouv.fr", "www.data.gouv.fr", ["france"], (q) => `https://www.data.gouv.fr/api/1/datasets/?q=${enc(q)}&page_size=3`,
    (j) => (j.data || []).map((d) => ({ titre: d.title, extrait: coupe(nettoyer(d.description)), url: d.page }))),
  S("nominatim", "OpenStreetMap", "nominatim.openstreetmap.org", ["lieux"], (q) => `https://nominatim.openstreetmap.org/search?q=${enc(q)}&format=json&limit=3&accept-language=fr`,
    (j) => (Array.isArray(j) ? j : []).map((l) => ({ titre: l.display_name, extrait: `${l.type || ""} · ${Number(l.lat).toFixed(3)}, ${Number(l.lon).toFixed(3)}`, url: l.osm_type && l.osm_id ? `https://www.openstreetmap.org/${l.osm_type}/${l.osm_id}` : null })))
];

/** Aperçu lisible du catalogue (pour la description de l'outil et les réglages). */
export function catalogue() { return Object.entries(DOMAINES).map(([d, nom]) => ({ domaine: d, nom, sources: SOURCES.filter((s) => s.domaines.includes(d)).map((s) => s.id) })); }

/** Mots-clés autorisés à sortir : sans adresse mail, numéro de téléphone ni mot interdit (noms tirés des souvenirs) ; 8 mots au plus. */
export function filtrerMotsCles(requete, interdits = []) {
  const bloque = new Set(interdits.map((m) => String(m).toLowerCase()));
  const retires = [];
  let txt = String(requete || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, () => { retires.push("adresse mail"); return " "; })
    .replace(/(?:\+?\d[\s.\-]?){7,}/g, () => { retires.push("numéro"); return " "; });
  const mots = [];
  for (const m of txt.split(/[\s,;:!?()«»"]+/)) {
    if (!m) continue;
    if (bloque.has(m.toLowerCase())) { retires.push("nom"); continue; }
    mots.push(m);
  }
  return { motsCles: mots.slice(0, 8).join(" "), retires: [...new Set(retires)] };
}

/** Choisit les sources : identifiants explicites > domaines demandés > domaine « general ». « tout » les prend toutes. Les sources coupées par Lucien sont exclues. */
export function choisir({ ids = null, domaines = null, coupees = [] } = {}) {
  const off = new Set(coupees);
  let l;
  if (ids && ids.length) l = SOURCES.filter((s) => ids.includes(s.id));
  else if (domaines && domaines.includes("tout")) l = SOURCES;
  else { const d = domaines && domaines.length ? domaines : ["general"]; l = SOURCES.filter((s) => s.domaines.some((x) => d.includes(x))); }
  return l.filter((s) => !off.has(s.id));
}

/** Interroge les sources choisies, en parallèle, chacune avec son délai ; chacune échoue seule. `get(url)` renvoie du JSON. */
export async function interroger(requete, { ids = null, domaines = null, coupees = [], get, interdits = [], delai = 9000, max = 12 } = {}) {
  const { motsCles, retires } = filtrerMotsCles(requete, interdits);
  if (!motsCles) return { motsCles, retires, resultats: [], erreurs: ["Aucun mot-clé utilisable après filtrage."], sorties: [], interrogees: [] };
  const choisies = choisir({ ids, domaines, coupees });
  const parSource = [], erreurs = [], sorties = [];
  await Promise.all(choisies.map(async (s) => {
    sorties.push(s.hote);
    let t;
    try {
      const j = await Promise.race([get(s.url(motsCles)), new Promise((_, no) => { t = setTimeout(() => no(new Error("délai dépassé")), s.delai || delai); })]);
      parSource.push({ s, items: s.extraire(j).filter((r) => r && r.titre).slice(0, 3) });
    } catch (e) { erreurs.push(s.nom + " : " + (e && e.message ? e.message : "indisponible")); }
    finally { clearTimeout(t); }
  }));
  // Tourniquet entre sources pour la diversité, sans doublon de titre ni d'adresse
  const vus = new Set(), resultats = [];
  for (let rang = 0; rang < 3 && resultats.length < max; rang++) {
    for (const { s, items } of parSource) {
      const r = items[rang]; if (!r) continue;
      const cle = (r.url || r.titre).toLowerCase(); if (vus.has(cle)) continue; vus.add(cle);
      resultats.push({ source: s.id, sourceNom: s.nom, ...r }); if (resultats.length >= max) break;
    }
  }
  return { motsCles, retires, resultats, erreurs, sorties, interrogees: choisies.map((s) => s.id) };
}
