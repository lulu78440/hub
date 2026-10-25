// Noyau · usages du quotidien, sans requête Gemini : capture rapide, rappels en français, briefing, revue du soir, recherche globale.
// Chaque écriture passe par la barrière (confirmation de Lucien). Les lectures sont libres. Rien ici ne touche le hub directement.
import { hote } from "./hote.js";
import { normaliser, jetons } from "./recherche.js";

const pad = (n) => String(n).padStart(2, "0");
const cle = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plat = (s) => String(s).replace(/[éèêë]/gi, "e").replace(/[àâä]/gi, "a").replace(/[ûùü]/gi, "u").replace(/[ôö]/gi, "o").replace(/[îï]/gi, "i").replace(/ç/gi, "c").replace(/[’]/g, "'");   // même longueur : les index restent alignés
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const ajouter = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const maj = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

/** Comprend « demain à 9 h », « lundi 14h30 », « dans 2 heures », « le 12 novembre », « ce soir ». Renvoie { date, heure, reste } (date/heure null si absentes). */
export function parseQuand(texte, now = new Date()) {
  let s = String(texte), p = plat(s).toLowerCase(), date = null, heure = null;
  const retirer = (m) => { s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length); p = p.slice(0, m.index) + " ".repeat(m[0].length) + p.slice(m.index + m[0].length); p = plat(s).toLowerCase(); };
  let m;
  if ((m = /\bdans\s+(\d+|une?|deux|trois|quelques)\s*(minutes?|min|heures?|h|jours?|semaines?)\b/.exec(p))) {
    const n = { un: 1, une: 1, deux: 2, trois: 3, quelques: 3 }[m[1]] || parseInt(m[1], 10), u = m[2][0] === "m" ? "min" : m[2][0] === "h" ? "h" : m[2][0] === "j" ? "j" : "s";
    const d = new Date(now); if (u === "min") d.setMinutes(d.getMinutes() + n); else if (u === "h") d.setHours(d.getHours() + n); else d.setDate(d.getDate() + n * (u === "s" ? 7 : 1));
    date = cle(d); if (u === "min" || u === "h") heure = `${pad(d.getHours())}:${pad(d.getMinutes())}`; retirer(m);
  }
  if (!date) {
    if ((m = /\bapres[- ]demain\b/.exec(p))) { date = cle(ajouter(now, 2)); retirer(m); }
    else if ((m = /\bdemain\b/.exec(p))) { date = cle(ajouter(now, 1)); retirer(m); }
    else if ((m = /\b(aujourd'?hui|ce jour)\b/.exec(p))) { date = cle(now); retirer(m); }
    else if ((m = /\b(?:le\s+)?(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?\b/.exec(p))) {
      let a = m[3] ? +m[3] : now.getFullYear(), d = new Date(a, MOIS.indexOf(m[2]), +m[1]); if (!m[3] && cle(d) < cle(now)) d = new Date(a + 1, MOIS.indexOf(m[2]), +m[1]); date = cle(d); retirer(m);
    } else if ((m = /\ble\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(p))) {
      let a = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear(), d = new Date(a, +m[2] - 1, +m[1]); if (!m[3] && cle(d) < cle(now)) d = new Date(a + 1, +m[2] - 1, +m[1]); date = cle(d); retirer(m);
    } else if ((m = new RegExp("\\b(?:(?:ce|ce prochain|prochain)\\s+)?(" + JOURS.join("|") + ")(?:\\s+prochain)?\\b").exec(p))) {
      const cible = JOURS.indexOf(m[1]); let n = (cible - now.getDay() + 7) % 7; if (n === 0) n = 7; date = cle(ajouter(now, n)); retirer(m);
    }
  }
  if (!heure) {
    if ((m = /\b(?:a\s+)?(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b/.exec(p)) && +m[1] < 24 && (!m[2] || +m[2] < 60)) { heure = `${pad(+m[1])}:${m[2] || "00"}`; retirer(m); }
    else if ((m = /\b(?:a\s+)?midi\b/.exec(p))) { heure = "12:00"; retirer(m); }
    if ((m = /\b(ce matin|demain matin|le matin|matin)\b/.exec(p))) { if (!heure) heure = "09:00"; if (/ce matin/.test(m[0]) && !date) date = cle(now); retirer(m); }
    else if ((m = /\b(cet apres-midi|l'apres-midi|apres-midi)\b/.exec(p))) { if (!heure) heure = "15:00"; if (/cet/.test(m[0]) && !date) date = cle(now); retirer(m); }
    else if ((m = /\b(ce soir|le soir|soir)\b/.exec(p))) { if (!heure) heure = "19:00"; if (/ce soir/.test(m[0]) && !date) date = cle(now); retirer(m); }
  }
  let reste = s.replace(/\s+/g, " ").trim().replace(/^(?:[,;:.]\s*)+/, "").replace(/^(?:a|à|de|d'|d’|que|qu'il faut|qu'|pour|:)\s+/i, "").replace(/^(?:d'|d’)/i, "").replace(/\s*(?:a|à|de|le|pour|,)\s*$/i, "").replace(/[.\s]+$/, "").trim();
  reste = reste.replace(/^(?:de|d'|d’)\s*/i, "").replace(/^(?:a|à)\s+(?=\p{L})/iu, "");
  if (heure && !date) { const j = cle(now), maintenant = `${pad(now.getHours())}:${pad(now.getMinutes())}`; date = heure > maintenant ? j : cle(ajouter(now, 1)); }
  return { date, heure, reste: maj(reste) };
}

export function creerUsages({ barriere, memoire }) {
  const rep = (texte, extra = {}) => ({ texte, ton: "calme", confiance: "haute", sources: [], sur: false, local: true, ...extra });
  const lire = async (outil, params = {}) => { const r = await barriere.executer({ outil, params }, { origine: "lucien" }); return r.ok ? r.donnees : null; };
  const ecrire = async (outil, params, ok, reflexe) => {
    const r = await barriere.executer({ outil, params }, { origine: "lucien" });
    if (r.ok) return rep(ok, { reflexe });
    if (r.refus) return rep("Tu as refusé : je n'ai rien enregistré.", { reflexe, ton: "calme" });
    return rep("Je n'ai pas pu le faire : " + (r.erreur || "erreur inconnue") + ".", { reflexe, ton: "preoccupe" });
  };
  const fr = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); } catch (e) { return iso; } };

  // ---------- Briefing ----------
  async function briefing() {
    const j = cle(hote.maintenant()), l = [];
    const t = await lire("lire_taches", { filtre: "a_faire" }), ag = await lire("lire_agenda", { du: j, au: j }), me = await lire("lire_meteo"), ac = await lire("lire_actus", { max: 3 });
    const taches = (t && t.taches) || [], retard = taches.filter((x) => x.echeance && x.echeance < j), auj = taches.filter((x) => x.echeance === j);
    l.push(!taches.length ? "Aucune tâche en attente : journée libre." : `${taches.length} tâche(s) à faire${retard.length ? `, dont ${retard.length} en retard` : ""}${auj.length ? ` et ${auj.length} pour aujourd'hui` : ""}${(retard[0] || auj[0]) ? " : « " + (retard[0] || auj[0]).texte + " »" : ""}.`);
    const ev = (ag && ag.evenements) || [];
    l.push(ev.length ? `Agenda : ${ev.slice(0, 3).map((e) => (e.debut || e.heure || "") + " " + (e.titre || "")).map((x) => x.trim()).join(" ; ")}${ev.length > 3 ? ` (+${ev.length - 3})` : ""}.` : "Aucun rendez-vous aujourd'hui.");
    if (me && me.disponible) l.push(`Météo${me.lieu ? " à " + me.lieu : ""} : ${me.temperature} °C${me.ressenti != null ? " (ressenti " + me.ressenti + ")" : ""}${me.vent_kmh ? ", vent " + me.vent_kmh + " km/h" : ""}.`);
    const titres = (ac && ac.titres) || [];
    if (titres.length) l.push("À la une : " + titres.slice(0, 2).map((x) => x.titre).join(" ; ") + ".");
    const av = memoire ? memoire.aValider().length : 0; if (av) l.push(`${av} proposition(s) t'attendent dans « À valider ».`);
    return rep("Voici ton point du jour.\n" + l.join("\n"), { reflexe: "usage:briefing" });
  }

  // ---------- Revue de fin de journée ----------
  async function revue() {
    const d = hote.maintenant(), j = cle(d), debut = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), l = [];
    const faites = await lire("lire_taches", { filtre: "faites" }), reste = await lire("lire_taches", { filtre: "a_faire" }), dem = await lire("lire_agenda", { du: cle(ajouter(d, 1)), au: cle(ajouter(d, 1)) });
    const nf = ((faites && faites.taches) || []).filter((x) => x.faite_le ? String(x.faite_le).slice(0, 10) === j : false).length;
    const rt = (reste && reste.taches) || [], enRetard = rt.filter((x) => x.echeance && x.echeance < j);
    l.push(nf ? `${nf} tâche(s) terminée(s) aujourd'hui.` : "Aucune tâche terminée aujourd'hui (ou non datée).");
    l.push(rt.length ? `Il en reste ${rt.length}${enRetard.length ? `, dont ${enRetard.length} en retard` : ""}.` : "Plus rien à faire : bravo.");
    const appris = memoire ? memoire.tous({ archive: false }).filter((x) => (x.cree || 0) >= debut && x.type !== "epi") : [];
    l.push(appris.length ? `J'ai retenu ${appris.length} chose(s) aujourd'hui.` : "Je n'ai rien retenu de nouveau aujourd'hui.");
    const ev = (dem && dem.evenements) || []; l.push(ev.length ? `Demain : ${ev.slice(0, 3).map((e) => ((e.debut || e.heure || "") + " " + (e.titre || "")).trim()).join(" ; ")}.` : "Rien de prévu demain.");
    const av = memoire ? memoire.aValider().length : 0; if (av) l.push(`${av} proposition(s) à valider avant de dormir ?`);
    return rep("Revue de ta journée.\n" + l.join("\n"), { reflexe: "usage:revue" });
  }

  // ---------- Recherche globale ----------
  async function rechercher(q) {
    const mots = jetons(q).filter(Boolean), out = { memoire: [], notes: [], taches: [], agenda: [], favoris: [] };
    const j = hote.maintenant(), a = cle(ajouter(j, -365)), b = cle(ajouter(j, 365));
    const ok = (txt) => { const t = new Set(jetons(txt)); return mots.length && mots.every((m) => t.has(m)) || mots.length && mots.some((m) => normaliser(txt).includes(m)) && mots.length === 1; };
    const [m, n, t, e, f] = await Promise.all([lire("chercher_memoire", { requete: q, lointain: true }), lire("lire_notes", { mot: q }), lire("lire_taches", { filtre: "toutes" }), lire("lire_agenda", { du: a, au: b }), lire("lire_favoris", { mot: q })]);
    out.memoire = ((m && m.extraits) || []).map((x) => ({ titre: x.titre || x.type, texte: x.texte, type: x.type }));
    out.notes = ((n && n.notes) || []).map((x) => ({ titre: "Note", texte: x.texte }));
    out.taches = ((t && t.taches) || []).filter((x) => ok(x.texte || "")).map((x) => ({ titre: x.fait ? "Tâche faite" : "Tâche", texte: x.texte }));
    out.agenda = ((e && e.evenements) || []).filter((x) => ok((x.titre || "") + " " + (x.lieu || ""))).map((x) => ({ titre: x.date, texte: x.titre }));
    out.favoris = ((f && f.favoris) || []).map((x) => ({ titre: x.titre, texte: x.url }));
    out.total = Object.values(out).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
    return out;
  }
  async function rechercheTexte(q) {
    const r = await rechercher(q), noms = { memoire: "Mémoire", notes: "Notes", taches: "Tâches", agenda: "Agenda", favoris: "Favoris" };
    if (!r.total) return rep(`Rien trouvé pour « ${q} » dans ma mémoire, tes notes, tâches, agenda et favoris.`, { reflexe: "usage:recherche" });
    const l = []; for (const k of Object.keys(noms)) if (r[k].length) l.push(`${noms[k]} (${r[k].length}) : ` + r[k].slice(0, 3).map((x) => "« " + String(x.texte).slice(0, 90) + " »").join(" ; "));
    return rep(`${r.total} résultat(s) pour « ${q} ».\n` + l.join("\n"), { reflexe: "usage:recherche" });
  }

  /** Essaie de reconnaître une demande d'usage. Renvoie une réponse locale, ou null (le cycle normal continue). */
  async function essayer(texte) {
    const brut = String(texte || "").trim(), p = plat(brut).toLowerCase();
    let m;
    if ((m = /^(?:note|notes)\s*:\s*([\s\S]+)$/i.exec(brut))) return ecrire("ajouter_note", { texte: m[1].trim() }, "Note ajoutée.", "usage:note");
    if ((m = /^t[aâ]che\s*:\s*([\s\S]+)$/i.exec(brut))) {
      const q = parseQuand(m[1], hote.maintenant()); const params = { texte: (q.reste && (q.date || q.heure) ? q.reste : m[1].trim()).slice(0, 200) };
      if (q.date && (q.reste)) { params.echeance = q.date; if (q.heure) params.heure_rappel = q.heure; }
      return ecrire("ajouter_tache", params, `Tâche ajoutée${params.echeance ? " pour le " + fr(params.echeance) + (params.heure_rappel ? " à " + params.heure_rappel : "") : ""}.`, "usage:tache");
    }
    if ((m = /^(?:retiens|retiens-moi|souviens[- ]toi|n'oublie pas)\s+(?:que\s+|qu')?([\s\S]{3,})$/i.exec(brut))) return ecrire("memoriser", { texte: maj(m[1].trim()).slice(0, 300), genre: "fait" }, "C'est retenu.", "usage:retenir");
    if ((m = /^rappelle[- ]moi\b([\s\S]*)$/i.exec(brut))) {
      const q = parseQuand(m[1], hote.maintenant());
      if (!q.reste) return rep("Que dois-je te rappeler ? Par exemple : rappelle-moi demain à 9 h d'appeler le garage.", { reflexe: "usage:rappel" });
      if (!q.date) return rep("Pour quand ? Ajoute un jour ou une heure : « rappelle-moi demain à 9 h de " + q.reste.toLowerCase() + " ».", { reflexe: "usage:rappel" });
      if (!q.heure) return ecrire("ajouter_tache", { texte: q.reste, echeance: q.date }, `Tâche ajoutée pour le ${fr(q.date)} (sans heure : dis-moi une heure pour avoir un rappel).`, "usage:rappel");
      return ecrire("creer_rappel", { texte: q.reste, date: q.date, heure: q.heure }, `Rappel créé : « ${q.reste} », le ${fr(q.date)} à ${q.heure}.`, "usage:rappel");
    }
    if (/^(?:fais[- ]moi |donne[- ]moi )?(?:le |mon |un )?(?:briefing|point du (?:matin|jour)|programme du jour)\b/.test(p)) return briefing();
    if (/\b(?:revue|bilan)\s+(?:du soir|de (?:la |ma )?(?:fin de )?journee)|\bfin de journee\b/.test(p)) return revue();
    if ((m = /^(?:cherche|recherche|trouve)\s+(?:partout|dans tout(?:e)?(?: le hub)?|dans le hub)\s*:?\s*([\s\S]+)$/i.exec(brut)) && m[1].trim()) return rechercheTexte(m[1].trim());
    return null;
  }
  return { essayer, briefing, revue, rechercher, parseQuand };
}
