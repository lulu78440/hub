// Atelier · moteur at-garantie : fins de garantie et délais de retour des achats.
// Module pur : sans DOM, sans réseau, sans IA. Dates au format « AAAA-MM-JJ », calculées en jours calendaires (sans fuseau).
// Valeurs par défaut prudentes (droit français, à vérifier par Lucien sur sa facture) :
//  - garantie légale de conformité : 24 mois pour un bien neuf acheté à un professionnel ;
//  - bien d'occasion : 24 mois par défaut (le vendeur peut la réduire à 12 mois s'il l'a écrit : saisir garantieMois: 12) ;
//  - achat à distance (internet, téléphone) : 14 jours de rétractation à partir de la RÉCEPTION ;
//  - achat en magasin : aucun droit de retour légal ; seul le délai que le magasin accorde compte (retourJours).
// Achat : { id, nom, dateAchat, dateReception?, mode?: "distance"|"magasin", etat?: "neuf"|"occasion",
//           garantieMois?, extensionMois?, retourJours? }

const JOUR = 86400000, DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const versUTC = (s) => { const m = DAY_RE.exec(s || ""); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? d : null; };
const versJour = (d) => d.toISOString().slice(0, 10);

/** Ajoute des jours à une date « AAAA-MM-JJ ». */
export function ajouterJours(s, n) { const d = versUTC(s); if (!d) return null; d.setUTCDate(d.getUTCDate() + n); return versJour(d); }
/** Ajoute des mois en restant dans le mois visé : 31 janvier + 1 mois → 28 (ou 29) février. */
export function ajouterMois(s, n) {
  const d = versUTC(s); if (!d) return null;
  const j = d.getUTCDate(), cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return versJour(cible);
}
/** Jours de a à b (positif si b est après a). */
export function ecartJours(a, b) { const x = versUTC(a), y = versUTC(b); return x && y ? Math.round((y - x) / JOUR) : null; }

/** Échéances d'un achat : { id, nom, finRetour, finGarantie, joursRetour, joursGarantie, statut, texte, problemes }.
 *  aujourdhui : « AAAA-MM-JJ ». statut : "retour" | "garantie" | "bientot" | "expiree" | "invalide". seuilJours : « bientôt fini ». */
export function echeances(achat, aujourdhui, { seuilJours = 30 } = {}) {
  if (!versUTC(aujourdhui)) throw new Error("Date du jour attendue au format AAAA-MM-JJ.");
  const a = achat || {}, P = [], nom = a.nom || "Achat sans nom";
  if (!versUTC(a.dateAchat)) return { id: a.id, nom, statut: "invalide", problemes: ["date d'achat absente ou invalide"], texte: `${nom} : date d'achat à corriger.` };
  if (a.dateReception != null && !versUTC(a.dateReception)) P.push("date de réception invalide (date d'achat utilisée)");
  if (versUTC(a.dateReception) && a.dateReception < a.dateAchat) P.push("réception avant l'achat");
  const mode = a.mode === "magasin" ? "magasin" : "distance";
  const mois = Number.isFinite(+a.garantieMois) && +a.garantieMois > 0 ? Math.round(+a.garantieMois) : 24;
  if (a.etat === "occasion" && mois < 12) P.push("garantie de moins de 12 mois sur un bien d'occasion : à vérifier");
  const extension = Number.isFinite(+a.extensionMois) && +a.extensionMois > 0 ? Math.round(+a.extensionMois) : 0;
  const finGarantie = ajouterMois(a.dateAchat, mois + extension);
  // Délai de retour : 14 jours à distance (depuis la réception), sinon ce que le magasin accorde.
  const depart = versUTC(a.dateReception) ? a.dateReception : a.dateAchat;
  const jr = Number.isFinite(+a.retourJours) && +a.retourJours >= 0 ? Math.round(+a.retourJours) : mode === "distance" ? 14 : 0;
  const finRetour = jr > 0 ? ajouterJours(depart, jr) : null;
  const joursRetour = finRetour ? ecartJours(aujourdhui, finRetour) : null, joursGarantie = ecartJours(aujourdhui, finGarantie);
  let statut;
  if (joursRetour != null && joursRetour >= 0) statut = "retour";
  else if (joursGarantie < 0) statut = "expiree";
  else statut = joursGarantie <= seuilJours ? "bientot" : "garantie";
  const fr = (s) => s.split("-").reverse().join("/");
  const texte = statut === "retour" ? `${nom} : retour possible jusqu'au ${fr(finRetour)} (${joursRetour === 0 ? "dernier jour" : joursRetour + " j"}).`
    : statut === "expiree" ? `${nom} : garantie terminée le ${fr(finGarantie)}.`
    : `${nom} : garanti jusqu'au ${fr(finGarantie)}${statut === "bientot" ? ` — plus que ${joursGarantie} j` : ""}.`;
  return { id: a.id, nom, finRetour, finGarantie, joursRetour, joursGarantie, statut, texte, problemes: P };
}

/** Tous les achats, les plus urgents d'abord (retour qui se termine, puis garanties qui se terminent, puis expirées). */
export function radar(achats, aujourdhui, options) {
  const rang = { retour: 0, bientot: 1, garantie: 2, expiree: 3, invalide: 4 };
  return (achats || []).filter((a) => a && typeof a === "object").map((a) => echeances(a, aujourdhui, options))
    .sort((x, y) => rang[x.statut] - rang[y.statut] || (x.statut === "retour" ? x.joursRetour - y.joursRetour : (x.joursGarantie ?? 0) - (y.joursGarantie ?? 0)) || String(x.nom).localeCompare(String(y.nom), "fr"));
}

/** Rappels à poser (pour le Radar des dates ou les rappels du hub) : la veille et 7 jours avant chaque fin, s'ils sont encore à venir. */
export function rappels(achats, aujourdhui, { avantJours = [7, 1] } = {}) {
  const out = [];
  for (const e of radar(achats, aujourdhui)) {
    for (const [quoi, fin] of [["retour", e.finRetour], ["garantie", e.finGarantie]]) {
      if (!fin) continue;
      for (const n of avantJours) {
        const date = ajouterJours(fin, -n);
        if (date >= aujourdhui) out.push({ id: `${e.id}-${quoi}-${n}`, date, texte: `${e.nom} : fin ${quoi === "retour" ? "du délai de retour" : "de garantie"} dans ${n} j.` });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
