// Noyau · sources de connaissances autorisées pour `chercher_sources` (contrat, section 6).
// Liste FIXE, dans le code public, en lecture seule. Seuls les mots-clés partent vers ces sites.
// Aucun import : le réseau passe par la fonction `get` fournie par l'appelant (hote.fetch).
//
// Retirées du contrat faute de recherche par mots avec accès direct depuis une page web : dev.to (pas de recherche publique)
// et arXiv (réponse XML sans CORS). Aucune des sources ci-dessous n'a pu être interrogée depuis l'espace de travail de Claude
// (réseau filtré) : leur forme de réponse suit la documentation de chaque API et reste À VÉRIFIER chez Lucien (journal, étape 5).

const coupe = (s, n = 300) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const enc = encodeURIComponent;

export const SOURCES = [
  { id: "wikipedia-fr", nom: "Wikipedia FR", hote: "fr.wikipedia.org", verifie: false,
    url: (q) => `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc(q)}&gsrlimit=3&prop=extracts|info&exintro=1&explaintext=1&exsentences=3&inprop=url&format=json&origin=*`,
    extraire: (j) => Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).map((p) => ({ titre: p.title, extrait: coupe(p.extract), url: p.fullurl })) },
  { id: "wikipedia-en", nom: "Wikipedia EN", hote: "en.wikipedia.org", verifie: false,
    url: (q) => `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc(q)}&gsrlimit=3&prop=extracts|info&exintro=1&explaintext=1&exsentences=3&inprop=url&format=json&origin=*`,
    extraire: (j) => Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).map((p) => ({ titre: p.title, extrait: coupe(p.extract), url: p.fullurl })) },
  { id: "openalex", nom: "OpenAlex", hote: "api.openalex.org", verifie: false,
    url: (q) => `https://api.openalex.org/works?search=${enc(q)}&per-page=3&select=title,publication_year,doi,cited_by_count`,
    extraire: (j) => (j.results || []).map((r) => ({ titre: r.title, extrait: `Publication de ${r.publication_year || "date inconnue"}, citée ${r.cited_by_count || 0} fois.`, url: r.doi })) },
  { id: "europepmc", nom: "Europe PMC", hote: "www.ebi.ac.uk", verifie: false,
    url: (q) => `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${enc(q)}&format=json&pageSize=3&resultType=lite`,
    extraire: (j) => ((j.resultList && j.resultList.result) || []).map((r) => ({ titre: r.title, extrait: coupe(`${r.authorString || ""} · ${r.journalTitle || ""} ${r.pubYear || ""}`), url: r.doi ? "https://doi.org/" + r.doi : null })) },
  { id: "openlibrary", nom: "Open Library", hote: "openlibrary.org", verifie: false,
    url: (q) => `https://openlibrary.org/search.json?q=${enc(q)}&limit=3&fields=title,author_name,first_publish_year,key`,
    extraire: (j) => (j.docs || []).map((d) => ({ titre: d.title, extrait: `${(d.author_name || []).slice(0, 2).join(", ")} · ${d.first_publish_year || "?"}`, url: d.key ? "https://openlibrary.org" + d.key : null })) },
  { id: "hackernews", nom: "Hacker News", hote: "hn.algolia.com", verifie: false,
    url: (q) => `https://hn.algolia.com/api/v1/search?query=${enc(q)}&tags=story&hitsPerPage=3`,
    extraire: (j) => (j.hits || []).map((h) => ({ titre: h.title, extrait: `${h.points || 0} points · ${h.num_comments || 0} commentaires · ${String(h.created_at || "").slice(0, 10)}`, url: h.url || "https://news.ycombinator.com/item?id=" + h.objectID })) },
  { id: "spaceflight", nom: "Spaceflight News", hote: "api.spaceflightnewsapi.net", verifie: false,
    url: (q) => `https://api.spaceflightnewsapi.net/v4/articles/?search=${enc(q)}&limit=3`,
    extraire: (j) => (j.results || []).map((a) => ({ titre: a.title, extrait: coupe(a.summary), url: a.url, date: a.published_at })) },
  { id: "mdn", nom: "MDN", hote: "developer.mozilla.org", verifie: false,
    url: (q) => `https://developer.mozilla.org/api/v1/search?q=${enc(q)}&locale=fr&size=3`,
    extraire: (j) => (j.documents || []).map((d) => ({ titre: d.title, extrait: coupe(d.summary), url: "https://developer.mozilla.org" + d.mdn_url })) }
];

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

/** Interroge les sources demandées (toutes par défaut). `get(url)` renvoie du JSON. Chaque source échoue seule. */
export async function interroger(requete, { ids = null, get, interdits = [] } = {}) {
  const { motsCles, retires } = filtrerMotsCles(requete, interdits);
  if (!motsCles) return { motsCles, retires, resultats: [], erreurs: ["Aucun mot-clé utilisable après filtrage."], sorties: [] };
  const choisies = SOURCES.filter((s) => !ids || ids.includes(s.id));
  const resultats = [], erreurs = [], sorties = [];
  await Promise.all(choisies.map(async (s) => {
    sorties.push(s.hote);
    try {
      const j = await get(s.url(motsCles));
      for (const r of s.extraire(j).slice(0, 3)) if (r && r.titre) resultats.push({ source: s.id, sourceNom: s.nom, ...r });
    } catch (e) { erreurs.push(s.nom + " : " + (e && e.message ? e.message : "indisponible")); }
  }));
  return { motsCles, retires, resultats, erreurs, sorties };
}
