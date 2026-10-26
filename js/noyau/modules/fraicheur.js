// Noyau · fraîcheur des données et des sources (orchestrateur, lot 4). Fonctions pures, sans DOM, sans réseau.
// Idée empruntée à World Monitor : chaque source dit CLAIREMENT si elle est à jour, en retard, ancienne ou inconnue,
// avec des MOTS et une FORME (jamais la couleur seule). Rien n'est inventé : une date inconnue reste « inconnue ».
// L'âge d'une donnée est jugé par rapport à son RYTHME (une série annuelle de l'an dernier est à jour ; une série mensuelle de l'an dernier ne l'est pas).

export const horloge = { maintenant: () => new Date() };       // remplaçable dans les essais, comme `sortie` dans composants.js

export const NIVEAUX = Object.freeze({
  a_jour: { libelle: "À jour", glyphe: "●", ordre: 0 },
  en_retard: { libelle: "En retard", glyphe: "◐", ordre: 1 },
  ancien: { libelle: "Ancien", glyphe: "○", ordre: 2 },
  inconnu: { libelle: "Fraîcheur inconnue", glyphe: "?", ordre: 3 },
  exemple: { libelle: "Exemple factice", glyphe: "◇", ordre: 4 }
});
export const NIVEAUX_SOURCE = Object.freeze({
  ok: { libelle: "Répond", glyphe: "●" },
  erreur: { libelle: "En échec", glyphe: "✕" },
  coupee: { libelle: "Coupée par Lucien", glyphe: "⏸" },
  inactive: { libelle: "Pas encore appelée", glyphe: "○" }
});

const JOUR = 86400000;
const RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
/** Début d'une date « AAAA », « AAAA-MM », « AAAA-MM-JJ » ou ISO complète, en ms UTC ; null si elle n'existe pas. */
export function dateMs(s) {
  const m = RE.exec(String(s == null ? "" : s).trim()); if (!m) return null;
  const y = +m[1], mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1;
  const t = Date.UTC(y, mo - 1, d); const x = new Date(t);
  if (x.getUTCFullYear() !== y || x.getUTCMonth() !== mo - 1 || x.getUTCDate() !== d) return null;
  return String(s).includes("T") ? Date.parse(String(s)) : t;
}
/** Fin (exclue) de la période que désigne une date courte : « 2024 » → 1er janvier 2025. */
export function finDePeriode(s) {
  const t = dateMs(s); if (t == null) return null; const n = String(s).trim().length, d = new Date(t);
  return n === 4 ? Date.UTC(d.getUTCFullYear() + 1, 0, 1) : n === 7 ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) : t + JOUR;
}

/** « il y a 5 min », « il y a 3 jours », « il y a 1 an » ; une date dans le futur est dite telle quelle (jamais masquée). */
export function ageTexte(ms) {
  if (!Number.isFinite(ms)) return "date inconnue";
  if (ms < -60000) return "date dans le futur";
  const s = Math.max(0, ms) / 1000;
  if (s < 45) return "à l'instant";
  const p = (n, u, pl = u + "s") => `il y a ${n} ${n > 1 ? pl : u}`;
  if (s < 3600) return p(Math.max(1, Math.round(s / 60)), "min", "min");
  if (s < 86400) return p(Math.round(s / 3600), "heure");
  const j = s / 86400;
  if (j < 45) return p(Math.round(j), "jour");
  if (j < 700) return p(Math.round(j / 30.44), "mois", "mois");
  return p(Math.round(j / 365.25), "an");
}

const CADENCES = [[1.5, 1, "quotidienne"], [10, 7, "hebdomadaire"], [45, 30.44, "mensuelle"], [120, 91.3, "trimestrielle"], [250, 182.6, "semestrielle"], [Infinity, 365.25, "annuelle"]];
/** Rythme d'une série : médiane des écarts entre dates (au moins 3 dates). { jours, nom } ou null. */
export function cadenceSerie(dates) {
  const t = dates.map(dateMs).filter((x) => x != null).sort((a, b) => a - b);
  if (t.length < 3) return null;
  const e = []; for (let i = 1; i < t.length; i++) e.push((t[i] - t[i - 1]) / JOUR);
  e.sort((a, b) => a - b); const med = e[Math.floor(e.length / 2)];
  if (!(med > 0)) return null;
  const c = CADENCES.find((x) => med <= x[0]); return { jours: c[1], nom: c[2] };
}

function dernierePoint(jeu) {
  const d = jeu.colonnes.findIndex((c) => c.type === "date"), nums = jeu.colonnes.map((c, i) => (c.type === "nombre" ? i : -1)).filter((i) => i >= 0);
  if (d < 0 || !nums.length) return { dates: [], derniere: null };
  const lignes = jeu.lignes.filter((l) => l[d] != null && nums.some((i) => l[i] != null));
  const dates = [...new Set(lignes.map((l) => l[d]))];
  const tri = dates.map((x) => [dateMs(x), x]).filter((x) => x[0] != null).sort((a, b) => a[0] - b[0]);
  return { dates: tri.map((x) => x[1]), derniere: tri.length ? tri[tri.length - 1][1] : null };
}

/**
 * Fraîcheur d'un jeu (déjà vérifié) : niveau, mots et chiffres à afficher.
 * `chargeMs` (facultatif) = instant où le jeu est entré en mémoire de la page.
 * Règle : on juge le PLUS MAUVAIS de deux retards, tous deux comptés en rythmes de la série : retard de la dernière observation
 * (fin de sa période) et âge de la mise à jour déclarée par la source. Sans rythme connu (moins de 3 dates), seule la mise à jour compte (7 jours / 90 jours).
 */
export function evaluerFraicheur(jeu, { maintenant = horloge.maintenant(), chargeMs = null } = {}) {
  const now = maintenant.getTime ? maintenant.getTime() : +maintenant;
  const s = jeu.source || {};
  const majInconnue = /mise à jour de la source inconnue/.test(String(s.nom || ""));
  let maj = majInconnue ? null : dateMs(s.maj);
  const majFutur = maj != null && maj > now + JOUR;      // une mise à jour « dans le futur » est une erreur de la source : dite, jamais prise pour fraîche
  if (majFutur) maj = null;
  const { dates, derniere } = dernierePoint(jeu), cad = cadenceSerie(dates);
  const out = { niveau: "inconnu", cadence: cad ? cad.nom : null, derniere_donnee: derniere, maj_inconnue: majInconnue, maj_futur: majFutur, maj: s.maj || null, maj_age_texte: null, retard_texte: null, charge_texte: null, requete: s.requete || null };
  out.maj_age_texte = maj != null ? ageTexte(now - maj) : null;
  if (chargeMs != null && Number.isFinite(chargeMs)) out.charge_texte = `chargé ${ageTexte(now - chargeMs)} dans cette page`;
  if (jeu.exemple === true) { out.niveau = "exemple"; return fin(out); }
  let ratio = null;
  if (cad) {
    const rets = [];
    const fp = derniere ? finDePeriode(derniere) : null;
    if (fp != null) { const r = (now - fp) / JOUR / cad.jours; rets.push(r); out.retard_texte = r <= 0 ? "dernière période encore en cours" : `dernière donnée : ${derniere}, soit ${(Math.round(r * 10) / 10).toString().replace(".", ",")} rythme(s) ${cad.nom}(s) de retard`; }
    if (maj != null) rets.push((now - maj) / JOUR / cad.jours);
    if (rets.length) ratio = Math.max(...rets);
    out.ratio = ratio;
    if (ratio != null) out.niveau = ratio <= 1.5 ? "a_jour" : ratio <= 3 ? "en_retard" : "ancien";
  } else if (maj != null) {
    const j = (now - maj) / JOUR; out.niveau = j <= 7 ? "a_jour" : j <= 90 ? "en_retard" : "ancien";
  }
  return fin(out);
  function fin(o) {
    const n = NIVEAUX[o.niveau]; o.libelle = n.libelle; o.glyphe = n.glyphe;
    o.resume = o.niveau === "exemple" ? "Exemple : données factices, pas de mise à jour"
      : o.maj_futur ? "Date de mise à jour dans le futur : à vérifier auprès de la source"
      : o.maj_inconnue ? `Mise à jour de la source inconnue${o.requete ? " (requête du " + o.requete + ")" : ""}`
        : o.maj_age_texte ? `Mis à jour ${o.maj_age_texte}` : "Mise à jour inconnue";
    return o;
  }
}

/** Le plus mauvais niveau d'une liste (ordre : à jour < en retard < ancien < inconnu) : « la plus ancienne des sources » d'un tableau de panneaux. */
export function pireNiveau(niveaux) {
  const l = niveaux.filter((n) => NIVEAUX[n] && n !== "exemple"); if (!l.length) return niveaux.includes("exemple") ? "exemple" : "inconnu";
  return l.reduce((a, b) => (NIVEAUX[b].ordre > NIVEAUX[a].ordre ? b : a));
}

/** État d'une source (donnees.etatSources()) → niveau, mots. */
export function evaluerSource(e, { maintenant = horloge.maintenant() } = {}) {
  const now = maintenant.getTime ? maintenant.getTime() : +maintenant;
  const ok = e.dernier_ok ? Date.parse(e.dernier_ok) : null, ko = e.derniere_erreur ? Date.parse(e.derniere_erreur) : null;
  let niveau = "inactive";
  if (e.coupee) niveau = "coupee";
  else if (ko != null && (ok == null || ko >= ok)) niveau = "erreur";
  else if (ok != null) niveau = "ok";
  const n = NIVEAUX_SOURCE[niveau];
  const lignes = [];
  if (ok != null) lignes.push(`dernière réponse ${ageTexte(now - ok)}`);
  if (niveau === "erreur") lignes.push(`échec ${ageTexte(now - ko)} : ${String(e.erreur || "raison inconnue").slice(0, 120)}`);
  if (e.derniere_maj) { const m = dateMs(e.derniere_maj); if (m != null) lignes.push(`dernière donnée lue, mise à jour ${ageTexte(now - m)} (${e.derniere_maj})`); }
  if (niveau === "inactive") lignes.push("aucune requête depuis l'ouverture de la page");
  if (niveau === "coupee") lignes.push("coupée dans les réglages : aucun appel");
  return { id: e.id, nom: e.nom, hote: e.hote, niveau, libelle: n.libelle, glyphe: n.glyphe, lignes, age_ms: ok != null ? now - ok : null };
}
