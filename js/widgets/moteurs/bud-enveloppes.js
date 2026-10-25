// Atelier · moteur bud-enveloppes : budget par enveloppes mensuelles avec report du reste.
// Inspiré du principe de la budgétisation par enveloppes (comme Actual Budget), écrit de zéro : aucun code copié.
// Module pur : sans DOM, sans réseau, sans IA. Montants en CENTIMES (entiers). Ne modifie jamais l'état reçu.
//
// etat = {
//   enveloppes: [{ id, nom, categories?: ["Courses", …] }],        // une opération va dans l'enveloppe dont l'id, le nom ou une catégorie = op.categorie
//   allocations: { "2026-10": { courses: 30000, … } },              // ce que Lucien met dans chaque enveloppe ce mois-là
//   revenus?: ["Revenus"],                                          // catégories comptées comme argent à répartir (défaut : « Revenus »)
// }
// operations : sorties de bud-csv (avec categorie), { date: "AAAA-MM-JJ", montant (négatif = dépense), categorie }.
//
// Règles de calcul (choix prudents, voir docs/atelier-auto/decisions.md) :
// - le reste POSITIF d'une enveloppe est reporté au mois suivant ;
// - un DÉPASSEMENT n'est pas reporté dans l'enveloppe (elle repart de 0) : il est retiré de l'argent à répartir du mois suivant ;
// - les dépenses sans catégorie ne touchent aucune enveloppe : elles sont listées à part pour être classées.

const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const MOIS_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function moisSuivant(m) { let [a, n] = m.split("-").map(Number); n++; if (n > 12) { n = 1; a++; } return `${a}-${String(n).padStart(2, "0")}`; }
export function moisPrecedent(m) { let [a, n] = m.split("-").map(Number); n--; if (n < 1) { n = 12; a--; } return `${a}-${String(n).padStart(2, "0")}`; }
export function nomMois(m) { const [a, n] = m.split("-").map(Number); return `${NOMS_MOIS[n - 1]} ${a}`; }

/** 123456 → « 1 234,56 € » (espace insécable fine pour les milliers, comme en français). */
export function euros(c) {
  const neg = c < 0, v = Math.abs(Math.round(c)), e = Math.floor(v / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "−" : ""}${e},${String(v % 100).padStart(2, "0")} €`;
}

/** Retrouve l'enveloppe d'une catégorie (id, nom ou liste de catégories, sans accents ni casse). */
function index(enveloppes) {
  const map = new Map();
  for (const e of enveloppes) for (const k of [e.id, e.nom, ...(e.categories || [])]) if (k && !map.has(norm(k))) map.set(norm(k), e.id);
  return (cat) => (cat ? map.get(norm(cat)) || null : null);
}

/** Calcule un mois et tous ceux d'avant (le report en dépend).
 *  Renvoie { mois, aRepartir, revenus, enveloppes: [{ id, nom, report, alloue, activite, reste, depasse }],
 *            totaux: { report, alloue, activite, reste }, nonClassees: [ops], horsEnveloppe: [ops], alertes: [texte] }. */
export function calculerMois(etat, operations, mois) {
  if (!MOIS_RE.test(mois || "")) throw new Error("Mois attendu au format AAAA-MM.");
  const E = (etat && Array.isArray(etat.enveloppes) ? etat.enveloppes : []).filter((e) => e && e.id);
  const alloc = (etat && etat.allocations) || {}, revenusCats = new Set(((etat && etat.revenus) || ["Revenus"]).map(norm));
  const env = index(E), ops = (operations || []).filter((o) => o && typeof o.date === "string" && Number.isFinite(o.montant));

  // Premier mois à calculer : le plus ancien parmi les opérations et les allocations (jamais après le mois demandé).
  let debut = mois;
  for (const o of ops) { const m = o.date.slice(0, 7); if (MOIS_RE.test(m) && m < debut) debut = m; }
  for (const m of Object.keys(alloc)) if (MOIS_RE.test(m) && m < debut) debut = m;

  let reports = Object.fromEntries(E.map((e) => [e.id, 0])), aRepartir = 0, depassePrec = 0, res = null;
  for (let m = debut; ; m = moisSuivant(m)) {
    const duMois = ops.filter((o) => o.date.slice(0, 7) === m);
    const revenus = duMois.filter((o) => revenusCats.has(norm(o.categorie))).reduce((s, o) => s + o.montant, 0);
    const a = alloc[m] || {}, lignes = [];
    let depasseTotal = 0;
    for (const e of E) {
      const alloue = Math.round(+a[e.id] || 0), activite = duMois.filter((o) => !revenusCats.has(norm(o.categorie)) && env(o.categorie) === e.id).reduce((s, o) => s + o.montant, 0);
      const reste = reports[e.id] + alloue + activite;
      lignes.push({ id: e.id, nom: e.nom || e.id, report: reports[e.id], alloue, activite, reste, depasse: reste < 0 });
      if (reste < 0) depasseTotal += -reste;
    }
    const totalAlloue = lignes.reduce((s, l) => s + l.alloue, 0);
    aRepartir = aRepartir + revenus - totalAlloue - depassePrec;
    if (m === mois) {
      const nonClassees = duMois.filter((o) => !o.categorie);
      const horsEnveloppe = duMois.filter((o) => o.categorie && !revenusCats.has(norm(o.categorie)) && !env(o.categorie));
      const somme = (k) => lignes.reduce((s, l) => s + l[k], 0);
      const alertes = [
        ...lignes.filter((l) => l.depasse).map((l) => `${l.nom} : dépassée de ${euros(-l.reste)} (retiré de l'argent à répartir le mois prochain).`),
        ...(aRepartir < 0 ? [`Tu as réparti ${euros(-aRepartir)} de plus que tes revenus.`] : []),
        ...(nonClassees.length ? [`${nonClassees.length} opération${nonClassees.length > 1 ? "s" : ""} sans catégorie.`] : []),
        ...(horsEnveloppe.length ? [`${horsEnveloppe.length} opération${horsEnveloppe.length > 1 ? "s" : ""} dans une catégorie sans enveloppe.`] : []),
      ];
      res = { mois, aRepartir, revenus, enveloppes: lignes, totaux: { report: somme("report"), alloue: somme("alloue"), activite: somme("activite"), reste: somme("reste") }, nonClassees, horsEnveloppe, alertes };
      break;
    }
    reports = Object.fromEntries(lignes.map((l) => [l.id, Math.max(0, l.reste)]));   // seul le reste positif est reporté
    depassePrec = depasseTotal;
  }
  return res;
}

/** Nouvel état avec une allocation changée (l'état reçu n'est pas modifié). centimes = 0 retire l'allocation. */
export function allouer(etat, mois, idEnveloppe, centimes) {
  if (!MOIS_RE.test(mois || "")) throw new Error("Mois attendu au format AAAA-MM.");
  const allocations = { ...((etat && etat.allocations) || {}) }, m = { ...(allocations[mois] || {}) };
  if (Math.round(centimes)) m[idEnveloppe] = Math.round(centimes); else delete m[idEnveloppe];
  allocations[mois] = m;
  return { ...etat, allocations };
}

/** Nouvel état où le mois reçoit les mêmes allocations que le mois précédent (sans écraser ce qui est déjà saisi). */
export function reprendreMoisPrecedent(etat, mois) {
  const prec = ((etat && etat.allocations) || {})[moisPrecedent(mois)] || {};
  const allocations = { ...((etat && etat.allocations) || {}) };
  allocations[mois] = { ...prec, ...(allocations[mois] || {}) };
  return { ...etat, allocations };
}

/** Bilan du mois en quelques phrases, sans IA (le rapport en prose par l'IA reste une option). */
export function bilanTexte(r) {
  const dep = -r.enveloppes.reduce((s, l) => s + Math.min(0, l.activite), 0);
  const top = r.enveloppes.filter((l) => l.activite < 0).sort((a, b) => a.activite - b.activite).slice(0, 3).map((l) => `${l.nom} (${euros(-l.activite)})`);
  return [
    `Bilan ${/^[aeiouyéèêâàô]/.test(nomMois(r.mois)) ? "d'" : "de "}${nomMois(r.mois)} : ${euros(r.revenus)} de revenus, ${euros(dep)} de dépenses dans les enveloppes.`,
    top.length ? `Plus grosses enveloppes : ${top.join(", ")}.` : "Aucune dépense dans les enveloppes.",
    `Reste dans les enveloppes : ${euros(r.totaux.reste)} ; à répartir : ${euros(r.aRepartir)}.`,
    ...r.alertes,
  ].join("\n");
}
