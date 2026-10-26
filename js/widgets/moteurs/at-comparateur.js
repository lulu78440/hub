// Atelier · moteur at-comparateur : coût réel d'offres (prix, livraison, frais, réduction, quantité), classement et écarts.
// Module pur : sans DOM, sans réseau, sans IA. Montants en CENTIMES entiers.
// Offre : { id, nom?, prix (prix d'un article, centimes), quantite? (articles achetés, défaut 1), contenance? (unités par article,
//           ex. 6 pour un pack de 6, défaut 1), livraison? (centimes), frais? (centimes : service, paiement…),
//           reductionPct? (0-100, sur les articles), reduction? (centimes, sur les articles, après le pourcentage),
//           livraisonOfferteDes? (centimes : livraison gratuite si les articles, réduction faite, atteignent ce montant) }
// Règles : réductions appliquées aux articles seulement (pas à la livraison ni aux frais), jamais en dessous de 0 ;
//          le classement se fait au coût par unité (= au total quand les quantités sont les mêmes).

const entier = (x, def = 0) => (Number.isFinite(+x) ? Math.round(+x) : def);

/** « 12,34 € » à partir de centimes (espace ordinaire comme séparateur de milliers). */
export function euros(c) {
  const s = (Math.abs(c) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, " ");
  return (c < 0 ? "−" : "") + s + " €";
}

/** Coût détaillé d'une offre : { id, nom, articles, reductionTotale, livraison, frais, total, unites, parUnite, problemes }. */
export function cout(offre) {
  const o = offre || {}, P = [], nom = o.nom || String(o.id ?? "Offre");
  const prix = entier(o.prix, NaN);
  if (!Number.isFinite(prix) || prix < 0) return { id: o.id, nom, invalide: true, problemes: ["prix absent ou invalide"] };
  let q = entier(o.quantite, 1); if (q < 1) { P.push("quantité invalide (1 retenu)"); q = 1; }
  let k = +o.contenance > 0 ? +o.contenance : 1; if (o.contenance != null && !(+o.contenance > 0)) P.push("contenance invalide (1 retenue)");
  const brut = prix * q;
  let pct = +o.reductionPct || 0;
  if (pct < 0 || pct > 100) { P.push("réduction en % hors de 0-100 (ignorée)"); pct = 0; }
  let reductionTotale = Math.round((brut * pct) / 100) + Math.max(0, entier(o.reduction));
  if (entier(o.reduction) < 0) P.push("réduction négative ignorée");
  if (reductionTotale > brut) { P.push("réduction supérieure au prix (ramenée au prix)"); reductionTotale = brut; }
  const articles = brut - reductionTotale;
  let livraison = Math.max(0, entier(o.livraison));
  const seuil = entier(o.livraisonOfferteDes, -1);
  if (seuil >= 0 && articles >= seuil && livraison > 0) livraison = 0;
  const frais = Math.max(0, entier(o.frais));
  const total = articles + livraison + frais, unites = q * k;
  return { id: o.id, nom, brut, reductionTotale, articles, livraison, frais, total, unites, parUnite: total / unites, problemes: P };
}

/** Compare : { classement: [{ rang, …cout, ecart, ecartPct, ecartUnite }], invalides, meilleur, economie, texte }.
 *  ecart : surcoût en centimes par rapport à la meilleure offre, pour la même quantité que l'offre classée (ou le total si par: "total").
 *  ecartPct : en % du coût de la meilleure offre (une décimale). Options : { par: "unite" (défaut) | "total" }. */
export function comparer(offres, { par = "unite" } = {}) {
  const tous = (offres || []).filter((o) => o && typeof o === "object").map(cout);
  const ok = tous.filter((c) => !c.invalide), invalides = tous.filter((c) => c.invalide);
  if (!ok.length) return { classement: [], invalides, meilleur: null, economie: 0, texte: "Aucune offre valable à comparer." };
  const cle = (c) => (par === "total" ? c.total : c.parUnite);
  const ordre = ok.map((c, i) => ({ c, i })).sort((a, b) => cle(a.c) - cle(b.c) || a.i - b.i).map((x) => x.c);
  const m = ordre[0];
  const memeQuantite = ok.every((c) => c.unites === m.unites);
  let rang = 0, prec = null;
  const classement = ordre.map((c, k) => {
    const v = cle(c);
    if (prec === null || v - prec > 1e-9) rang = k + 1; prec = v;
    // Surcoût ramené à la quantité de cette offre : ce qu'on paierait de plus que chez la meilleure pour autant d'unités.
    const ecart = par === "total" ? c.total - m.total : Math.round((c.parUnite - m.parUnite) * c.unites);
    const ecartPct = Math.round(((cle(c) - cle(m)) / (cle(m) || 1)) * 1000) / 10;
    return { rang, ...c, parUnite: Math.round(c.parUnite * 100) / 100, ecart, ecartPct };
  });
  const dernier = classement.at(-1);
  const economie = dernier.ecart;
  const lignes = classement.map((c) => `${c.rang}. ${c.nom} — ${euros(c.total)}${memeQuantite || par === "total" ? "" : ` (${euros(Math.round(c.parUnite))} l'unité)`}${c.ecart > 0 ? ` · +${euros(c.ecart)} (+${c.ecartPct.toLocaleString("fr-FR")} %)` : ""}`);
  const tete = classement.length > 1 && economie > 0
    ? `Meilleure offre : ${m.nom}, ${euros(economie)} de moins que ${dernier.nom}${memeQuantite ? "" : " à quantité égale"}.`
    : classement.length > 1 ? `Offres au même coût : ${classement.filter((c) => c.rang === 1).map((c) => c.nom).join(", ")}.` : `Une seule offre : ${m.nom}.`;
  return { classement, invalides, meilleur: m.id, memeQuantite, economie, texte: [tete, ...lignes].join("\n") };
}
