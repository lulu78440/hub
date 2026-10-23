// Dates simples pour les widgets : jour au format AAAA-MM-JJ (heure locale), étiquettes courtes en français.
const pad = (n) => String(n).padStart(2, "0");
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const NOMS = { dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6 };

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Nombre de jours entre aujourd'hui et le jour k (négatif = passé). */
export const daysFrom = (k) => Math.round((fromKey(k) - fromKey(dayKey())) / 864e5);

/** Étiquette courte d'un jour : auj., dem., hier, lun. (dans la semaine), sinon 25/10. */
export function dayLabel(k) {
  const n = daysFrom(k), d = fromKey(k);
  if (n === 0) return "auj."; if (n === 1) return "dem."; if (n === -1) return "hier";
  if (n > 1 && n < 7) return JOURS[d.getDay()];
  return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + (d.getFullYear() !== new Date().getFullYear() ? "/" + String(d.getFullYear()).slice(2) : "");
}

/** Date relative d'un instant (création d'une note) : à l'instant, 14:32, hier, lun., 25/10. */
export function stampLabel(ms) {
  const d = new Date(ms), k = dayKey(d), n = daysFrom(k);
  if (Date.now() - ms < 60e3) return "à l'instant";
  if (n === 0) return pad(d.getHours()) + ":" + pad(d.getMinutes());
  return dayLabel(k);
}

/** Lit « @demain », « @lun », « @25/10 » dans un texte. Renvoie { text sans le mot, due: "AAAA-MM-JJ" | null }. */
export function parseDue(text) {
  let due = null;
  const out = text.replace(/(^|\s)@([\p{L}'\/\d-]+)/u, (all, sp, w) => {
    const v = w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const today = new Date();
    if (v === "auj" || v === "aujourd'hui" || v === "aujourdhui") due = dayKey(today);
    else if (v === "demain" || v === "dem") due = dayKey(addDays(today, 1));
    else if (v === "apres-demain") due = dayKey(addDays(today, 2));
    else if (NOMS[v.slice(0, 3)] !== undefined && /^[a-z]+$/.test(v)) {
      let n = (NOMS[v.slice(0, 3)] - today.getDay() + 7) % 7; if (n === 0) n = 7;
      due = dayKey(addDays(today, n));
    } else {
      const m = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
      if (m) {
        let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000;
        let d = new Date(y, +m[2] - 1, +m[1]);
        if (!m[3] && dayKey(d) < dayKey(today)) d = new Date(y + 1, +m[2] - 1, +m[1]);
        if (d.getDate() === +m[1]) due = dayKey(d);
      }
    }
    return due ? sp : all;
  });
  return { text: out.replace(/\s{2,}/g, " ").trim(), due };
}

/** « 14h30 », « 9h », « 14:30 », « 14h-16h » dans un texte → { text sans l'heure, start: "HH:MM" | null, end }. */
export function parseTime(text) {
  let start = null, end = null;
  const hm = "(\\d{1,2})(?:[h:](\\d{2})?|h)";
  const re = new RegExp("(^|\\s)" + hm + "(?:\\s?[-–à]\\s?" + hm + ")?(?=\\s|$)", "i");
  const out = text.replace(re, (all, sp, h1, m1, h2, m2) => {
    if (+h1 > 23 || (m1 && +m1 > 59)) return all;
    start = pad(+h1) + ":" + (m1 || "00");
    if (h2 !== undefined && +h2 <= 23 && !(m2 && +m2 > 59)) end = pad(+h2) + ":" + (m2 || "00");
    return sp;
  });
  return { text: out.replace(/\s{2,}/g, " ").trim(), start, end };
}
/** "HH:MM" → minutes depuis minuit. */
export const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
/** Lundi de la semaine du jour k. */
export const mondayOf = (k) => { const d = fromKey(k), n = (d.getDay() + 6) % 7; return dayKey(addDays(d, -n)); };
