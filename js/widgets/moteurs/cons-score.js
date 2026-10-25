// Atelier · moteur cons-score : score de pertinence d'un article de veille d'après les mots-clés de Lucien.
// Module pur : sans DOM, sans réseau, sans IA, utilisable hors ligne. Ne modifie jamais les articles reçus.
// Article attendu (format de tools/flux.py) : { titre, lien, date (ISO), cat, source }.
// Le « pourquoi » liste les mots trouvés et où ; l'ordre chronologique reste toujours disponible (mode "chrono").

/** Minuscules, sans accents, ponctuation remplacée par des espaces. */
export function normaliser(t) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9+#]+/g, " ").trim();
}

/** « ia, steam*2, -bourse, jeux vidéo » (virgules ou retours à la ligne) → profil de mots-clés.
 *  « *2 » : poids 2 (1 à 5) ; « - » devant : mot à écarter (l'article descend). */
export function lireMotsCles(texte) {
  const vus = new Set(), mots = [];
  for (const brut of String(texte || "").split(/[,;\n]+/)) {
    let s = brut.trim(); if (!s) continue;
    let exclu = false, poids = 1;
    if (s.startsWith("-")) { exclu = true; s = s.slice(1).trim(); }
    const m = s.match(/\*\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (m) { poids = Math.min(5, Math.max(0.5, parseFloat(m[1].replace(",", ".")))); s = s.slice(0, m.index).trim(); }
    const n = normaliser(s); if (!n || vus.has(n)) continue;
    vus.add(n); mots.push({ mot: s, n, poids, exclu });
  }
  return mots;
}

const ZONES = [["titre", 2], ["cat", 1], ["source", 1]];   // un mot dans le titre compte double
const echap = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Mot entier (ou expression), pluriel simple en s/x sur chaque mot : « jeu vidéo » trouve « jeux vidéos », « jeu » ne trouve pas « jeudi ».
const motif = (n) => new RegExp("(^| )" + n.split(" ").map((w) => echap(w) + "(?:s|x)?").join(" ") + "( |$)");

/** Score d'un article. Renvoie { score, pertinent, trouves: [{ mot, zone, points }], pourquoi }. */
export function scorer(article, profil) {
  const a = article || {}, mots = Array.isArray(profil) ? profil : lireMotsCles(profil);
  const zones = Object.fromEntries(ZONES.map(([z]) => [z, normaliser(a[z])]));
  let score = 0; const trouves = [];
  for (const k of mots) {
    const re = motif(k.n);
    for (const [z, coef] of ZONES) {
      if (!re.test(zones[z])) continue;
      const points = (k.exclu ? -3 : 1) * k.poids * coef;
      score += points; trouves.push({ mot: k.mot, zone: z, points, exclu: k.exclu });
      break;                                   // un mot ne compte qu'une fois, dans sa meilleure zone
    }
  }
  score = Math.round(score * 10) / 10;
  return { score, pertinent: score > 0, trouves, pourquoi: expliquer(trouves) };
}

const NOM_ZONE = { titre: "titre", cat: "catégorie", source: "source" };
/** Phrase lisible : « Trouvé : steam (titre), ia (catégorie) · écarté : bourse (titre) ». */
export function expliquer(trouves) {
  if (!trouves || !trouves.length) return "Aucun de tes mots-clés.";
  const f = (l) => l.map((t) => `${t.mot} (${NOM_ZONE[t.zone]})`).join(", ");
  const pos = trouves.filter((t) => !t.exclu), neg = trouves.filter((t) => t.exclu);
  return [pos.length ? "Trouvé : " + f(pos) : "", neg.length ? "écarté : " + f(neg) : ""].filter(Boolean).join(" · ");
}

const temps = (a) => { const t = Date.parse(a && a.date); return Number.isFinite(t) ? t : -Infinity; };

/** Trie une copie des articles. mode "chrono" (défaut, le plus récent d'abord, sans date à la fin)
 *  ou "pertinence" (score, puis date). Chaque élément devient { ...article, _score }.
 *  options.masquerNegatifs : en mode pertinence, retire les articles au score négatif (jamais en chrono). */
export function trier(articles, profil, mode = "chrono", options = {}) {
  const mots = Array.isArray(profil) ? profil : lireMotsCles(profil);
  const liste = (Array.isArray(articles) ? articles : []).filter((a) => a && typeof a === "object")
    .map((a, i) => ({ ...a, _score: scorer(a, mots), _i: i }));
  const parDate = (x, y) => temps(y) - temps(x) || x._i - y._i;
  let out;
  if (mode === "pertinence") {
    out = liste.sort((x, y) => y._score.score - x._score.score || parDate(x, y));
    if (options.masquerNegatifs) out = out.filter((a) => a._score.score >= 0);
  } else out = liste.sort(parDate);
  return out.map(({ _i, ...a }) => a);
}
