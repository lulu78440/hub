// Atelier · moteur at-colis : reconnaît le transporteur d'après le FORMAT d'un numéro de suivi.
// Module pur : sans DOM, sans réseau, sans IA. Il n'interroge AUCUN site : il donne seulement un lien de suivi public
// (que l'interface pourra ouvrir si Lucien le demande) quand le format est connu.
// Confiance : "sure" (format + clé de contrôle vérifiée), "probable" (format propre au transporteur), "possible" (format partagé, ex. 12 chiffres).

const LIENS = {
  laposte: "https://www.laposte.fr/outils/suivre-vos-envois?code=",
  ups: "https://www.ups.com/track?tracknum=",
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  dhl: "https://www.dhl.com/fr-fr/home/suivi.html?tracking-id=",
};
const PAYS = { FR: "La Poste", CN: "China Post", GB: "Royal Mail", DE: "Deutsche Post", US: "USPS", BE: "bpost", ES: "Correos", IT: "Poste Italiane", NL: "PostNL", CH: "Poste suisse", HK: "Hongkong Post", SG: "Singapore Post", JP: "Japan Post", CA: "Postes Canada", LU: "Post Luxembourg" };

/** Retire espaces, tirets et points ; met en majuscules. */
export function nettoyer(n) { return String(n || "").toUpperCase().replace(/[\s\-. ]/g, ""); }

/** Clé du format postal international UPU S10 (AA123456789FR) : 9e chiffre. */
export function cleS10(n) {
  const m = /^[A-Z]{2}(\d{8})(\d)[A-Z]{2}$/.exec(n); if (!m) return false;
  const p = [8, 6, 4, 2, 3, 5, 9, 7], s = [...m[1]].reduce((t, d, i) => t + +d * p[i], 0);
  let c = 11 - (s % 11); if (c === 10) c = 0; else if (c === 11) c = 5;
  return c === +m[2];
}
/** Clé des numéros UPS (1Z + 16 caractères) : lettres converties, poids 1 et 2 alternés. */
export function cleUPS(n) {
  if (!/^1Z[0-9A-Z]{16}$/.test(n)) return false;
  const v = [...n.slice(2, 17)].map((c) => (/\d/.test(c) ? +c : (c.charCodeAt(0) - 63) % 10));
  const s = v.reduce((t, x, i) => t + (i % 2 ? 2 * x : x), 0);
  return (10 - (s % 10)) % 10 === +n[17];
}

/** Analyse un numéro : { numero, candidats: [{ transporteur, confiance, controle, lien }], message }. */
export function analyser(brut) {
  const n = nettoyer(brut), C = [];
  const ajoute = (transporteur, confiance, controle, cle) => C.push({ transporteur, confiance, controle, lien: cle && LIENS[cle] ? LIENS[cle] + encodeURIComponent(n) : null });
  let m;
  if ((m = /^([A-Z])([A-Z])\d{9}([A-Z]{2})$/.exec(n))) {
    const ok = cleS10(n), pays = m[3];
    let nom = PAYS[pays] || `Poste (${pays})`;
    if (pays === "FR") nom = m[1] === "E" ? "Chronopost (EMS)" : m[1] === "C" || m[1] === "V" ? "Colissimo international" : m[1] === "R" ? "La Poste, lettre recommandée" : m[1] === "L" ? "La Poste, lettre suivie" : "La Poste";
    ajoute(nom, ok ? "sure" : "possible", ok ? "ok" : "ko", pays === "FR" ? "laposte" : null);
  }
  if (/^\d[A-Z]\d{11}$/.test(n)) ajoute("Colissimo (France)", "probable", null, "laposte");
  if (/^1Z[0-9A-Z]{16}$/.test(n)) { const ok = cleUPS(n); ajoute("UPS", ok ? "sure" : "possible", ok ? "ok" : "ko", "ups"); }
  if (/^TBA\d{12}$/.test(n)) ajoute("Amazon Logistics", "probable", null, null);
  if (/^JJD\d{16,22}$/.test(n) || /^JVGL\d{16,22}$/.test(n)) ajoute("DHL", "probable", null, "dhl");
  if (/^\d+$/.test(n)) {
    if (n.length === 10) ajoute("DHL Express", "possible", null, "dhl");
    if (n.length === 12 || n.length === 15 || n.length === 20 || n.length === 22) ajoute("FedEx", "possible", null, "fedex");
    if (n.length === 14) ajoute("DPD", "possible", null, null);
    if (n.length === 11) ajoute("GLS", "possible", null, null);
    if (n.length === 8 || n.length === 10 || n.length === 12) ajoute("Mondial Relay", "possible", null, null);
  }
  const rang = { sure: 0, probable: 1, possible: 2 };
  C.sort((a, b) => rang[a.confiance] - rang[b.confiance]);
  const message = !n ? "Numéro vide." : !C.length ? "Format inconnu : vérifie le numéro sur le message du vendeur."
    : C[0].confiance === "sure" ? `${C[0].transporteur} (numéro vérifié).`
    : C[0].controle === "ko" ? `${C[0].transporteur} ? La clé de contrôle ne correspond pas : numéro peut-être mal recopié.`
    : C.length === 1 ? `Sans doute ${C[0].transporteur}.` : `Plusieurs transporteurs possibles : ${C.map((c) => c.transporteur).join(", ")}.`;
  return { numero: n, candidats: C, message };
}

/** Repère les numéros de suivi dans un texte collé (message de confirmation) : seulement ceux de confiance sûre ou probable. */
export function extraire(texte) {
  const vus = new Set(), out = [];
  const re = /\b(1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2}|\d[A-Z]\d{11}|TBA\d{12}|JJD\d{16,22}|JVGL\d{16,22})\b/g;
  for (const m of String(texte || "").toUpperCase().matchAll(re)) {
    if (vus.has(m[1])) continue; vus.add(m[1]);
    const a = analyser(m[1]);
    if (a.candidats.length && a.candidats[0].confiance !== "possible") out.push(a);
  }
  return out;
}
