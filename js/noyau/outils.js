// Noyau · catalogue d'outils neutre (JSON Schema) et fonctions d'exécution (contrat, section 6).
// Le catalogue ne connaît ni Gemini ni Claude : moteurs.js le convertit. Les outils INTERDITS n'existent pas ici :
// ils ne sont jamais présentés au modèle (barriere.js refuse tout nom inconnu).
import { hote } from "./hote.js";
import { jetons, Index } from "./recherche.js";
import { interroger, DOMAINES, SOURCES } from "./sources.js";
import { journalActions } from "./journal.js";
import { creerPerso } from "./perso.js";

const pad = (n) => String(n).padStart(2, "0");
export const cleJour = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ajouterJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const estJour = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const estHeure = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const court = (s, n = 160) => String(s == null ? "" : s).replace(/\s+/g, " ").slice(0, n);

// ---------- Calculatrice sûre (remplace Function() de l'application v3.8) ----------
export function calculer(expr) {
  const s = String(expr || "").replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  if (!s || s.length > 200 || !/^[0-9a-z+\-*/^%().]+$/i.test(s)) throw new Error("Expression non reconnue");
  let i = 0;
  const FN = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, ln: Math.log, log: Math.log10, sin: Math.sin, cos: Math.cos, tan: Math.tan };
  const CONST = { pi: Math.PI, e: Math.E };
  const peek = () => s[i];
  function nombre() {
    if (peek() === "(") { i++; const v = somme(); if (peek() !== ")") throw new Error("Parenthèse manquante"); i++; return v; }
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    const w = /^[a-z]+/i.exec(s.slice(i));
    if (w) {
      const nom = w[0].toLowerCase(); i += nom.length;
      if (nom in CONST) return CONST[nom];
      if (nom in FN && peek() === "(") { i++; const v = somme(); if (peek() !== ")") throw new Error("Parenthèse manquante"); i++; return FN[nom](v); }
    }
    throw new Error("Expression non reconnue");
  }
  function unaire() { if (peek() === "-") { i++; return -unaire(); } if (peek() === "+") { i++; return unaire(); } return puissance(); }
  function puissance() { let b = nombre(); while (peek() === "%") { i++; b = b / 100; } if (peek() === "^") { i++; return Math.pow(b, unaire()); } return b; }
  function produit() {
    let v = unaire();
    while (peek() === "*" || peek() === "/") { const o = s[i++]; const r = unaire(); v = o === "*" ? v * r : v / r; }
    return v;
  }
  function somme() { let v = produit(); while (peek() === "+" || peek() === "-") { const o = s[i++]; const r = produit(); v = o === "+" ? v + r : v - r; } return v; }
  const v = somme();
  if (i < s.length) throw new Error("Expression non reconnue");
  if (!isFinite(v)) throw new Error("Résultat non défini (division par zéro ?)");
  return Math.round(v * 1e10) / 1e10;
}

// ---------- Validation légère des paramètres (selon le schéma de l'outil) ----------
export function validerParams(params, schema) {
  const p = params && typeof params === "object" ? params : {};
  for (const k of schema.required || []) if (p[k] === undefined || p[k] === null || p[k] === "") return `Paramètre manquant : ${k}`;
  for (const [k, def] of Object.entries(schema.properties || {})) {
    const v = p[k]; if (v === undefined || v === null) continue;
    if (def.type === "string" && typeof v !== "string") return `${k} doit être du texte`;
    if (def.type === "integer" && !Number.isInteger(v)) return `${k} doit être un nombre entier`;
    if (def.type === "boolean" && typeof v !== "boolean") return `${k} doit être vrai ou faux`;
    if (def.enum && !def.enum.includes(v)) return `${k} : valeur permise ${def.enum.join(", ")}`;
    if (def.type === "string" && v.length > (def.maxLength || 2000)) return `${k} est trop long`;
  }
  return null;
}

// ---------- Règle « aucun outil sans validation de Lucien » (lab-outils-regle) ----------
// Aucune nouvelle fonction du hub n'entre automatiquement dans les outils de l'IA. Un poste qui veut donner un outil au Noyau le PROPOSE
// avec son niveau (LIBRE = lecture seule, CONFIRMATION = dès qu'il y a une écriture, INTERDIT = sensible : jamais présenté) ; Lucien valide ;
// seulement alors le nom et le niveau sont ajoutés ci-dessous. Un outil absent de cette liste, ou dont le niveau diffère, est écarté du catalogue.
// Liste de départ = les 34 outils déjà en service et validés par Lucien au fil des étapes N3 à N20 (voir docs/labo-auto/decisions.md).
export const OUTILS_VALIDES = {
  heure: "LIBRE", calculer: "LIBRE", chercher_memoire: "LIBRE", lire_taches: "LIBRE", lire_agenda: "LIBRE", lire_notes: "LIBRE", lire_favoris: "LIBRE", lire_meteo: "LIBRE", lire_rituels: "LIBRE", lire_actus: "LIBRE", lire_veille: "LIBRE", lire_fenetre: "LIBRE", lire_journal: "LIBRE", chercher_sources: "LIBRE", afficher: "LIBRE", lancer_focus: "LIBRE",
  ajouter_tache: "CONFIRMATION", modifier_tache: "CONFIRMATION", cocher_tache: "CONFIRMATION", ajouter_evenement: "CONFIRMATION", modifier_evenement: "CONFIRMATION", ajouter_note: "CONFIRMATION", modifier_note: "CONFIRMATION", ajouter_favori: "CONFIRMATION", modifier_favori: "CONFIRMATION", creer_rappel: "CONFIRMATION", memoriser: "CONFIRMATION", apprendre: "CONFIRMATION", lire_page: "CONFIRMATION", lire_mails: "CONFIRMATION", jouer_media: "CONFIRMATION", regler_rituel: "CONFIRMATION", personnaliser_hub: "CONFIRMATION", creer_raccourci: "CONFIRMATION"
};
/** Outils proposés par les postes, EN ATTENTE de validation : ils ne sont pas actifs (voir docs/labo-auto/outils-propose.md). */
export const OUTILS_PROPOSES = [
  { nom: "consulter_manuel", niveau: "LIBRE", poste: "Labo", pourquoi: "Lecture seule du manuel public du hub ; ne donne aucun droit sur les fonctions décrites." },
  { nom: "chercher_decisions", niveau: "LIBRE", poste: "Labo", pourquoi: "Lecture seule des décisions déjà enregistrées par Lucien (décision, raison, conséquences)." },
  { nom: "proposer_decision", niveau: "CONFIRMATION", poste: "Labo", pourquoi: "Écriture dans la mémoire des décisions : Lucien valide chaque enregistrement ; jamais d'effacement." },
  { nom: "lire_contradictions", niveau: "LIBRE", poste: "Labo", pourquoi: "Lecture seule des signaux calculés par règles (au plus 3), sans rien modifier." }
];
/** Ne garde que les outils validés au bon niveau. Renvoie { catalogue, ecartes } ; rien n'est jamais ajouté ni élevé de niveau. */
export function appliquerRegle(outils, valides = OUTILS_VALIDES) {
  const catalogue = [], ecartes = [];
  for (const o of outils) {
    if (!Object.prototype.hasOwnProperty.call(valides, o.nom)) ecartes.push({ nom: o.nom, raison: "non validé par Lucien" });
    else if (valides[o.nom] !== o.niveau) ecartes.push({ nom: o.nom, raison: `niveau ${o.niveau} différent du niveau validé ${valides[o.nom]}` });
    else catalogue.push(o);
  }
  return { catalogue, ecartes };
}
/** Liste visible (laboratoire) : chaque outil actif avec son niveau, puis les propositions en attente. */
export function listeOutils(outils, valides = OUTILS_VALIDES, proposes = OUTILS_PROPOSES) {
  const actifs = outils.map((o) => ({ nom: o.nom, niveau: o.niveau, statut: valides[o.nom] === o.niveau ? "validé" : "écarté", description: String(o.description || "").slice(0, 120) }));
  const nonActifs = proposes.filter((p) => !outils.some((o) => o.nom === p.nom)).map((p) => ({ nom: p.nom, niveau: p.niveau, statut: "proposé · en attente de Lucien", description: p.pourquoi }));
  return [...actifs, ...nonActifs];
}

const S = (description, extra = {}) => ({ type: "string", description, ...extra });
const O = (properties = {}, required = []) => ({ type: "object", properties, required });

/** Construit le catalogue. `ctx` apporte memoire (mémoire du Noyau) et interdits (mots à ne pas envoyer dehors). */
export function creerCatalogue(ctx = {}) {
  let _perso = null; const perso = () => (_perso = _perso || creerPerso());
  const rac = () => { if (!ctx.raccourcis) throw new Error("Raccourcis indisponibles"); return ctx.raccourcis(); };
  const st = () => hote.stockage;
  const now = () => hote.maintenant();
  const agir = async (nom, p) => { const r = await hote.hub.agir(nom, p); if (r && r.ok === false) throw new Error(r.erreur || "Action impossible"); return r; };
  const ligneTache = (t) => ({ id: t.id, texte: t.text, faite: !!t.done, urgente: !!t.prio, echeance: t.due || null, rappel: t.remindAt || null, faite_le: t.doneAt ? cleJour(new Date(t.doneAt)) : null });
  const ligneEvt = (e) => ({ id: e.id, titre: e.title, date: e.date, debut: e.start || null, fin: e.end || null });

  const T = [
    // ----- LIBRE -----
    { nom: "heure", niveau: "LIBRE", description: "Date et heure actuelles de Lucien.", params: O(), resume: () => "Lire l'heure",
      exec: async () => { const d = now(); return { iso: d.toISOString(), local: d.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }), jour: cleJour(d) }; } },
    { nom: "calculer", niveau: "LIBRE", description: "Calcule une expression (+ - * / ^ %, parenthèses, sqrt, abs, round, pi).", params: O({ expression: S("L'expression, ex. 12*(3+4)", { maxLength: 200 }) }, ["expression"]),
      resume: (p) => "Calculer " + court(p.expression, 60), exec: async (p) => ({ expression: p.expression, resultat: calculer(p.expression) }) },
    { nom: "chercher_memoire", niveau: "LIBRE", description: "Cherche dans la mémoire du Noyau (épisodes, faits, règles, connaissances).", params: O({ requete: S("Mots à chercher"), lointain: { type: "boolean", description: "Inclure aussi les souvenirs lointains" } }, ["requete"]),
      resume: (p) => "Chercher dans la mémoire : " + court(p.requete, 60),
      exec: async (p) => { if (!ctx.memoire) throw new Error("Mémoire non chargée"); return { extraits: ctx.memoire.chercher(p.requete, { limite: 6, lointain: !!p.lointain }).map((x) => ({ ref: x.id, type: x.type, titre: x.titre, texte: court(x.texte, 300), verifie: x.verifie !== false })) }; } },
    { nom: "lire_taches", niveau: "LIBRE", description: "Liste les tâches du hub.", params: O({ filtre: S("Quelles tâches", { enum: ["a_faire", "faites", "en_retard", "toutes"] }) }),
      resume: (p) => "Lire les tâches (" + (p.filtre || "à faire") + ")",
      exec: async (p) => { const j = cleJour(now()), l = await st().tout("tasks"), f = p.filtre || "a_faire";
        const pick = l.filter((t) => f === "toutes" || (f === "faites" ? t.done : f === "en_retard" ? !t.done && t.due && t.due < j : !t.done));
        return { total: pick.length, taches: pick.sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).slice(0, 30).map(ligneTache) }; } },
    { nom: "lire_agenda", niveau: "LIBRE", description: "Rendez-vous sur une période (par défaut aujourd'hui + 7 jours).", params: O({ du: S("Date de début AAAA-MM-JJ"), au: S("Date de fin AAAA-MM-JJ") }),
      resume: (p) => "Lire l'agenda" + (p.du ? " du " + p.du : ""),
      exec: async (p) => { const d0 = estJour(p.du) ? p.du : cleJour(now()), d1 = estJour(p.au) ? p.au : cleJour(ajouterJours(now(), 7));
        return { du: d0, au: d1, evenements: (await st().tout("events")).filter((e) => e.date >= d0 && e.date <= d1).sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || ""))).slice(0, 40).map(ligneEvt) }; } },
    { nom: "lire_notes", niveau: "LIBRE", description: "Notes du hub, avec recherche par mot.", params: O({ mot: S("Mot à chercher (facultatif)") }),
      resume: (p) => "Lire les notes" + (p.mot ? " : " + court(p.mot, 40) : ""),
      exec: async (p) => { const l = await st().tout("notes"); let pick = l;
        if (p.mot) { const ix = new Index(); l.forEach((n) => ix.ajouter(n.id, n.text)); const ids = new Set(ix.chercher(p.mot, { limite: 15 }).map((r) => r.id)); pick = l.filter((n) => ids.has(n.id)); }
        return { total: pick.length, notes: pick.sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 15).map((n) => ({ id: n.id, texte: court(n.text, 300), epinglee: !!n.pinned })) }; } },
    { nom: "lire_favoris", niveau: "LIBRE", description: "Favoris du hub (recherche par mot ou groupe).", params: O({ mot: S("Mot à chercher"), groupe: S("Nom du groupe") }),
      resume: (p) => "Lire les favoris" + (p.mot ? " : " + court(p.mot, 40) : ""),
      exec: async (p) => { let l = await st().tout("favs"); if (p.groupe) l = l.filter((f) => (f.group || "").toLowerCase() === p.groupe.toLowerCase());
        if (p.mot) { const ix = new Index(); l.forEach((f) => ix.ajouter(f.id, f.title + " " + f.url + " " + (f.group || ""))); const ids = new Set(ix.chercher(p.mot, { limite: 15 }).map((r) => r.id)); l = l.filter((f) => ids.has(f.id)); }
        return { total: l.length, favoris: l.slice(0, 20).map((f) => ({ id: f.id, titre: f.title, url: f.url, groupe: f.group })) }; } },
    { nom: "lire_meteo", niveau: "LIBRE", description: "Météo déjà chargée par le hub (lieu de Lucien).", params: O(), resume: () => "Lire la météo du hub",
      exec: async () => { const m = hote.hub.meteo(); const c = m && m.data && m.data.current;
        if (!c) return { disponible: false, note: "Pas de météo chargée dans le hub." };
        return { disponible: true, lieu: m.name || null, temperature: Math.round(c.temperature_2m), ressenti: c.apparent_temperature != null ? Math.round(c.apparent_temperature) : null, code: c.weather_code, vent_kmh: c.wind_speed_10m != null ? Math.round(c.wind_speed_10m) : null }; } },
    { nom: "lire_rituels", niveau: "LIBRE", description: "Habitudes du jour et humeur notée par Lucien.", params: O(), resume: () => "Lire les rituels",
      exec: async () => { const kv = await st().tout("kv"), j = cleJour(now()), cfg = kv.find((x) => x.id === "rituels-config"), jour = kv.find((x) => x.id === "rit-" + j);
        const hab = cfg && cfg.habits ? cfg.habits : [];
        return { humeur: jour && jour.mood ? jour.mood : null, habitudes: hab.map((h) => ({ id: h.id, nom: h.name, objectif: h.goal, fait: (jour && jour.counts && jour.counts[h.id]) || 0 })) }; } },
    { nom: "lire_actus", niveau: "LIBRE", description: "Titres du flux d'actualité du hub (datés, avec leur source).", params: O({ sujet: S("Sujet ou mot (facultatif)"), max: { type: "integer", description: "1 à 8" } }),
      resume: (p) => "Lire l'actualité" + (p.sujet ? " : " + court(p.sujet, 40) : ""),
      exec: async (p) => { const f = hote.hub.actus(); if (!f || !f.actus) return { disponible: false, note: "Le flux d'actualité n'est pas chargé (hors ligne ?)." };
        let l = f.actus; if (p.sujet) { const ix = new Index(); l.forEach((a, i) => ix.ajouter(String(i), a.titre + " " + (a.cat || ""))); l = ix.chercher(p.sujet, { limite: 8 }).map((r) => l[+r.id]); }
        else l = l.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        return { flux_genere: f.genere, titres: l.slice(0, Math.min(Math.max(p.max || 5, 1), 8)).map((a) => ({ titre: a.titre, source: a.source, categorie: a.cat, date: a.date, lien: a.lien })) }; } },
    { nom: "lire_veille", niveau: "LIBRE", description: "Sites surveillés par le hub : en ligne ou en panne.", params: O(), resume: () => "Lire la veille des sites",
      exec: async () => { const f = hote.hub.actus(); return { sites: ((f && f.sites) || []).map((s) => ({ nom: s.nom, en_ligne: !!s.ok, ms: s.ms, depuis: s.depuis })) }; } },
    { nom: "lire_fenetre", niveau: "LIBRE", description: "Ce qu'affiche une fenêtre du hub (texte visible).", params: O({ fenetre: S("Identifiant : tasks, notes, agenda, favs, music, video, web, mails, watch, rituels, radar, pc, progress") }, ["fenetre"]),
      resume: (p) => "Lire la fenêtre " + p.fenetre,
      exec: async (p) => { if (/^mails?$/i.test(String(p.fenetre))) throw new Error("Les mails ne se lisent que par l'outil lire_mails (avec confirmation : leur contenu part chez Google)."); return agir("lire_fenetre", p); } },
    { nom: "lire_journal", niveau: "LIBRE", description: "Les dernières actions du Noyau.", params: O({ limite: { type: "integer", description: "1 à 30" } }), resume: () => "Lire le journal des actions",
      exec: async (p) => ({ lignes: (await journalActions.lire({ limite: Math.min(Math.max(p.limite || 10, 1), 30) })).map((l) => ({ quand: l.quand, outil: l.outil, statut: l.statut, resume: l.params })) }) },
    { nom: "chercher_sources", niveau: "LIBRE", description: "Interroge des références publiques (une trentaine de sources). Choisis les domaines utiles à la question : " + Object.entries(DOMAINES).map(([d, n]) => `${d} (${n})`).join(" ; ") + ". Sans domaine : encyclopédies générales. « tout » interroge toutes les sources (lent, à réserver aux recherches larges). Seuls les mots-clés partent.",
      params: O({ requete: S("Quelques mots-clés, 8 au plus", { maxLength: 120 }), domaines: { type: "array", items: { type: "string", enum: [...Object.keys(DOMAINES), "tout"] }, description: "Domaines à interroger (facultatif)" }, sources: { type: "array", items: { type: "string", enum: SOURCES.map((x) => x.id) }, description: "Identifiants de sources précis (facultatif, prioritaire sur les domaines)" } }, ["requete"]),
      resume: (p) => "Chercher dans les sources" + (Array.isArray(p.domaines) && p.domaines.length ? " (" + p.domaines.join(", ") + ")" : "") + " : « " + court(p.requete, 60) + " »", sortie: () => ["sites de référence publics (mots-clés seulement)"],
      exec: async (p) => { if (!hote.enLigne()) throw new Error("Hors ligne : les sources ne sont pas joignables.");
        let coupees = []; try { coupees = JSON.parse(hote.reglage.lire("noyau-sources-off", "[]")); } catch (e) { coupees = []; }
        const r = await interroger(p.requete, { ids: Array.isArray(p.sources) && p.sources.length ? p.sources : null, domaines: Array.isArray(p.domaines) ? p.domaines : null, coupees, interdits: ctx.interdits ? await ctx.interdits() : [], get: async (u) => { const x = await hote.fetch(u, { headers: { Accept: "application/json" } }); if (!x.ok) throw new Error("HTTP " + x.status); return x.json(); } });
        return { mots_cles_envoyes: r.motsCles, retires_avant_envoi: r.retires, sources_interrogees: r.interrogees, resultats: r.resultats, erreurs: r.erreurs.slice(0, 6), _sorties: r.sorties }; } },
    { nom: "afficher", niveau: "LIBRE", description: "Met une fenêtre du hub en avant.", params: O({ fenetre: S("Identifiant de la fenêtre") }, ["fenetre"]),
      resume: (p) => "Afficher la fenêtre " + p.fenetre, exec: async (p) => agir("afficher", p) },
    { nom: "lancer_focus", niveau: "LIBRE", description: "Lance le mode Focus du hub (25 ou 50 minutes).", params: O({ minutes: { type: "integer", description: "25 ou 50" } }, ["minutes"]),
      resume: (p) => "Lancer le Focus " + p.minutes + " min", exec: async (p) => { if (p.minutes !== 25 && p.minutes !== 50) throw new Error("Focus : 25 ou 50 minutes"); return agir("lancer_focus", p); } },

    // ----- CONFIRMATION -----
    { nom: "ajouter_tache", niveau: "CONFIRMATION", description: "Ajoute une tâche.", params: O({ texte: S("La tâche", { maxLength: 200 }), echeance: S("AAAA-MM-JJ"), urgente: { type: "boolean" }, heure_rappel: S("HH:MM (rappel le jour de l'échéance)") }, ["texte"]),
      resume: (p) => `Ajouter la tâche « ${court(p.texte, 80)} »${p.echeance ? " pour le " + p.echeance : ""}${p.urgente ? " (urgente)" : ""}`,
      exec: async (p) => { if (p.echeance && !estJour(p.echeance)) throw new Error("Échéance : AAAA-MM-JJ"); if (p.heure_rappel && !estHeure(p.heure_rappel)) throw new Error("Heure : HH:MM");
        const due = p.echeance || (p.heure_rappel ? cleJour(now()) : null);
        const t = { id: hote.nouvelId("t"), text: p.texte.trim(), done: false, prio: p.urgente ? 1 : 0, due, remindAt: p.heure_rappel ? due + "T" + p.heure_rappel : null, created: now().getTime(), doneAt: null };
        await st().ecrire("tasks", t); return { ajoutee: ligneTache(t) }; } },
    { nom: "modifier_tache", niveau: "CONFIRMATION", description: "Modifie une tâche (texte, échéance, urgence).", params: O({ id: S("Identifiant (voir lire_taches)"), texte: S("Nouveau texte"), echeance: S("AAAA-MM-JJ"), urgente: { type: "boolean" } }, ["id"]),
      resume: (p) => `Modifier la tâche ${p.id}${p.texte ? " : « " + court(p.texte, 60) + " »" : ""}${p.echeance ? ", échéance " + p.echeance : ""}`,
      exec: async (p) => { const t = await st().lire("tasks", p.id); if (!t) throw new Error("Tâche introuvable");
        if (p.echeance && !estJour(p.echeance)) throw new Error("Échéance : AAAA-MM-JJ");
        if (p.texte) t.text = p.texte.trim(); if (p.echeance) t.due = p.echeance; if (typeof p.urgente === "boolean") t.prio = p.urgente ? 1 : 0;
        await st().ecrire("tasks", t); return { modifiee: ligneTache(t) }; } },
    { nom: "cocher_tache", niveau: "CONFIRMATION", description: "Coche (ou décoche) une tâche.", params: O({ id: S("Identifiant"), faite: { type: "boolean" } }, ["id"]),
      resume: (p) => `${p.faite === false ? "Décocher" : "Cocher"} la tâche ${p.id}`,
      exec: async (p) => { const t = await st().lire("tasks", p.id); if (!t) throw new Error("Tâche introuvable");
        t.done = p.faite !== false; t.doneAt = t.done ? now().getTime() : null; await st().ecrire("tasks", t); return { tache: ligneTache(t) }; } },
    { nom: "ajouter_evenement", niveau: "CONFIRMATION", description: "Ajoute un rendez-vous à l'agenda.", params: O({ titre: S("Titre", { maxLength: 160 }), date: S("AAAA-MM-JJ"), debut: S("HH:MM"), fin: S("HH:MM"), rappel_min: { type: "integer", description: "Minutes avant (facultatif)" } }, ["titre", "date"]),
      resume: (p) => `Ajouter « ${court(p.titre, 80)} » à l'agenda le ${p.date}${p.debut ? " à " + p.debut : ""}`,
      exec: async (p) => { if (!estJour(p.date)) throw new Error("Date : AAAA-MM-JJ"); if (p.debut && !estHeure(p.debut)) throw new Error("Début : HH:MM"); if (p.fin && !estHeure(p.fin)) throw new Error("Fin : HH:MM");
        const e = { id: hote.nouvelId("e"), title: p.titre.trim(), date: p.date, start: p.debut || null, end: p.fin || null, remind: p.debut ? (Number.isInteger(p.rappel_min) ? p.rappel_min : 10) : null, created: now().getTime() };
        await st().ecrire("events", e); return { ajoute: ligneEvt(e) }; } },
    { nom: "modifier_evenement", niveau: "CONFIRMATION", description: "Modifie un rendez-vous.", params: O({ id: S("Identifiant (voir lire_agenda)"), titre: S("Nouveau titre"), date: S("AAAA-MM-JJ"), debut: S("HH:MM"), fin: S("HH:MM") }, ["id"]),
      resume: (p) => `Modifier le rendez-vous ${p.id}${p.titre ? " : « " + court(p.titre, 60) + " »" : ""}${p.date ? ", le " + p.date : ""}`,
      exec: async (p) => { const e = await st().lire("events", p.id); if (!e) throw new Error("Rendez-vous introuvable");
        if (p.date && !estJour(p.date)) throw new Error("Date : AAAA-MM-JJ"); if (p.debut && !estHeure(p.debut)) throw new Error("Début : HH:MM"); if (p.fin && !estHeure(p.fin)) throw new Error("Fin : HH:MM");
        if (p.titre) e.title = p.titre.trim(); if (p.date) e.date = p.date; if (p.debut) e.start = p.debut; if (p.fin) e.end = p.fin;
        await st().ecrire("events", e); return { modifie: ligneEvt(e) }; } },
    { nom: "ajouter_note", niveau: "CONFIRMATION", description: "Ajoute une note.", params: O({ texte: S("Le texte de la note", { maxLength: 4000 }) }, ["texte"]),
      resume: (p) => `Ajouter la note « ${court(p.texte, 100)} »`,
      exec: async (p) => { const t = now().getTime(), n = { id: hote.nouvelId("n"), text: p.texte.trim(), pinned: false, created: t, updated: t }; await st().ecrire("notes", n); return { ajoutee: { id: n.id, texte: court(n.text, 200) } }; } },
    { nom: "modifier_note", niveau: "CONFIRMATION", description: "Remplace le texte d'une note.", params: O({ id: S("Identifiant (voir lire_notes)"), texte: S("Nouveau texte", { maxLength: 4000 }) }, ["id", "texte"]),
      resume: (p) => `Modifier la note ${p.id} : « ${court(p.texte, 100)} »`,
      exec: async (p) => { const n = await st().lire("notes", p.id); if (!n) throw new Error("Note introuvable"); n.text = p.texte.trim(); n.updated = now().getTime(); await st().ecrire("notes", n); return { modifiee: { id: n.id, texte: court(n.text, 200) } }; } },
    { nom: "ajouter_favori", niveau: "CONFIRMATION", description: "Ajoute un favori (l'adresse n'est pas ouverte).", params: O({ url: S("Adresse https://…"), titre: S("Titre"), groupe: S("Groupe") }, ["url"]),
      resume: (p) => `Ajouter le favori ${court(p.url, 80)}`,
      exec: async (p) => { let u; try { u = new URL(/^https?:\/\//i.test(p.url) ? p.url : "https://" + p.url); } catch (e) { throw new Error("Adresse invalide"); } if (!/^https?:$/.test(u.protocol)) throw new Error("Adresse http(s) seulement");
        const f = { id: hote.nouvelId("f"), url: u.href, title: (p.titre || u.hostname).slice(0, 120), group: p.groupe || "Favoris", created: now().getTime() }; await st().ecrire("favs", f); return { ajoute: { id: f.id, titre: f.title, url: f.url } }; } },
    { nom: "modifier_favori", niveau: "CONFIRMATION", description: "Modifie le titre ou le groupe d'un favori.", params: O({ id: S("Identifiant (voir lire_favoris)"), titre: S("Titre"), groupe: S("Groupe") }, ["id"]),
      resume: (p) => `Modifier le favori ${p.id}`,
      exec: async (p) => { const f = await st().lire("favs", p.id); if (!f) throw new Error("Favori introuvable"); if (p.titre) f.title = p.titre.slice(0, 120); if (p.groupe) f.group = p.groupe; await st().ecrire("favs", f); return { modifie: { id: f.id, titre: f.title, groupe: f.group } }; } },
    { nom: "creer_rappel", niveau: "CONFIRMATION", description: "Crée un rappel à heure fixe (une tâche avec rappel).", params: O({ texte: S("Le rappel"), date: S("AAAA-MM-JJ"), heure: S("HH:MM") }, ["texte", "date", "heure"]),
      resume: (p) => `Créer le rappel « ${court(p.texte, 80)} » le ${p.date} à ${p.heure}`,
      exec: async (p) => { if (!estJour(p.date)) throw new Error("Date : AAAA-MM-JJ"); if (!estHeure(p.heure)) throw new Error("Heure : HH:MM");
        const t = { id: hote.nouvelId("t"), text: p.texte.trim(), done: false, prio: 0, due: p.date, remindAt: p.date + "T" + p.heure, created: now().getTime(), doneAt: null }; await st().ecrire("tasks", t); return { rappel: ligneTache(t) }; } },
    { nom: "memoriser", niveau: "CONFIRMATION", description: "Retient un fait sur Lucien ou une règle de méthode (mémoires sémantique et procédurale).", params: O({ texte: S("Le fait ou la règle, en une phrase", { maxLength: 300 }), genre: S("fait ou regle", { enum: ["fait", "regle"] }), cle: S("Sujet court, ex. « boisson préférée » (aide à repérer les contradictions)") }, ["texte", "genre"]),
      resume: (p) => `Retenir ${p.genre === "regle" ? "la règle" : "le fait"} : « ${court(p.texte, 120)} »`,
      exec: async (p) => { if (!ctx.memoire) throw new Error("Mémoire non chargée"); return ctx.memoire.confirmer({ type: p.genre === "regle" ? "pro" : "sem", texte: p.texte, cle: p.cle, origine: "lucien" }); } },
    { nom: "apprendre", niveau: "CONFIRMATION", description: "Range une fiche de connaissance ou d'actualité (avec sa source).", params: O({ titre: S("Titre"), texte: S("Contenu", { maxLength: 1500 }), source: S("D'où ça vient (nom ou adresse)"), actualite: { type: "boolean", description: "Vrai pour un titre d'actualité (fraîcheur 7 jours)" } }, ["titre", "texte", "source"]),
      resume: (p) => `Ajouter la fiche « ${court(p.titre, 80)} » (source : ${court(p.source, 60)})`,
      exec: async (p) => { if (!ctx.memoire) throw new Error("Mémoire non chargée"); return ctx.memoire.confirmer({ type: "kb", titre: p.titre, texte: p.texte, source: p.source, actualite: !!p.actualite, origine: "source : " + p.source }); } },
    { nom: "lire_page", niveau: "CONFIRMATION", description: "Lit une page web hors de la liste autorisée (si le site le permet). L'adresse part vers ce site.", params: O({ url: S("Adresse https://…") }, ["url"]),
      resume: (p) => `Lire la page ${court(p.url, 100)}`, sortie: (p) => { try { return [new URL(p.url).hostname]; } catch (e) { return [court(p.url, 60)]; } },
      exec: async (p) => { let u; try { u = new URL(p.url); } catch (e) { throw new Error("Adresse invalide"); } if (u.protocol !== "https:") throw new Error("https seulement");
        const r = await hote.fetch(u.href); if (!r.ok) throw new Error("La page répond " + r.status); const h = await r.text();
        return { page: u.href, texte: h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000) }; } },
    { nom: "lire_mails", niveau: "CONFIRMATION", description: "Résume les mails importants. Leur contenu part chez Google pour le résumé.", params: O(), resume: () => "Résumer les mails importants (leur contenu part chez Google)", sortie: () => ["google (contenu des mails)"],
      exec: async () => agir("lire_mails", {}) },
    { nom: "jouer_media", niveau: "CONFIRMATION", description: "Lance une radio ou une vidéo (le son démarre).", params: O({ cible: S("Nom de la radio ou de la vidéo") }, ["cible"]),
      resume: (p) => `Lancer « ${court(p.cible, 80)} » (le son démarre)`, exec: async (p) => agir("jouer_media", p) },
    { nom: "regler_rituel", niveau: "CONFIRMATION", description: "Coche une habitude du jour ou note l'humeur (1 orage … 5 soleil).", params: O({ habitude: S("Identifiant de l'habitude (voir lire_rituels)"), ajout: { type: "integer", description: "Quantité à ajouter (1 par défaut)" }, humeur: { type: "integer", description: "1 à 5" } }),
      resume: (p) => p.humeur ? `Noter l'humeur du jour : ${p.humeur}/5` : `Ajouter ${p.ajout || 1} à l'habitude ${p.habitude}`,
      exec: async (p) => { const j = cleJour(now()), id = "rit-" + j, d = (await st().lire("kv", id)) || { id, counts: {} };
        if (p.humeur) { if (p.humeur < 1 || p.humeur > 5) throw new Error("Humeur : 1 à 5"); d.mood = p.humeur; }
        else if (p.habitude) { d.counts = d.counts || {}; d.counts[p.habitude] = (d.counts[p.habitude] || 0) + (Number.isInteger(p.ajout) ? p.ajout : 1); }
        else throw new Error("Rien à régler"); await st().ecrire("kv", d); return { jour: j, humeur: d.mood || null, compteurs: d.counts }; } },
    { nom: "personnaliser_hub", niveau: "CONFIRMATION", description: "Change l'apparence ou la disposition du hub, UNIQUEMENT quand Lucien le demande explicitement : couleur du thème, fenêtre (afficher/masquer, place, taille, figer), opacité, taille et couleur du texte d'une fenêtre. C'est une couche de réglages, pas du code : tout se défait (action « annuler », ou « tout_remettre »). Positions et tailles en pourcentage de l'écran. Ne touche ni à la sécurité, ni au Noyau, ni au labo.",
      params: O({ action: S("annuler ou tout_remettre (facultatif ; sinon applique les changements demandés)", { enum: ["appliquer", "annuler", "tout_remettre"] }),
        couleur: S("Couleur du thème à changer", { enum: ["cyan", "violet", "ambre", "encre", "discret", "fond", "rouge", "ok"] }), valeur: S("Nouvelle couleur #rrggbb"),
        fenetre: S("Identifiant de la fenêtre (voir afficher / lire_fenetre : tasks, notes, agenda, favs, music, video, web, rituels, radar, pc, progress…)"),
        visible: { type: "boolean" }, figee: { type: "boolean" }, x: { type: "number", description: "Bord gauche, % de l'écran (0-90)" }, y: { type: "number", description: "Bord haut, % (0-90)" }, largeur: { type: "number", description: "% (8-100)" }, hauteur: { type: "number", description: "% (8-100)" },
        opacite: { type: "number", description: "0,3 à 1" }, taille_texte: { type: "integer", description: "11 à 26 px" }, couleur_texte: S("#rrggbb"), couleur_fond: S("#rrggbb") }),
      resume: (p) => { try { return "Personnaliser le hub : " + perso().resume(p); } catch (e) { return "Personnaliser le hub (demande invalide : " + e.message + ")"; } },
      exec: async (p) => perso().executer(p) },
    { nom: "creer_raccourci", niveau: "CONFIRMATION", description: "Crée, liste ou supprime un raccourci : une phrase de Lucien qui rejoue une suite de 1 à 5 outils déjà autorisés (ex. « mode soirée » = lancer_focus puis afficher). Uniquement sur demande explicite de Lucien. Chaque étape garde son niveau de permission.",
      params: O({ action: S("creer, supprimer ou lister", { enum: ["creer", "supprimer", "lister"] }), phrase: S("La phrase exacte qui déclenche le raccourci", { maxLength: 80 }), nom: S("Nom court (facultatif)", { maxLength: 60 }),
        etapes: { type: "array", maxItems: 5, description: "Étapes dans l'ordre", items: { type: "object", properties: { outil: S("Nom d'un outil du catalogue"), params_json: S("Paramètres de l'outil en JSON, ex. {\"minutes\":25} (facultatif)", { maxLength: 400 }) }, required: ["outil"] } } }, ["action"]),
      resume: (p) => { try { return rac().resume(p); } catch (e) { return "Raccourci (demande invalide : " + e.message + ")"; } },
      exec: async (p) => rac().executerOutil(p) }
  ];
  for (const o of T) o.params = o.params || O();
  const { catalogue, ecartes } = appliquerRegle(T);
  if (ecartes.length && typeof console !== "undefined") console.warn("[Noyau] outils écartés (règle de validation) :", ecartes.map((e) => `${e.nom} (${e.raison})`).join(", "));
  return catalogue;
}

/** Outil interne : fin obligatoire de chaque tour (contrat 4.2). Il n'agit pas sur le hub. */
export const OUTIL_REPONDRE = {
  nom: "repondre", niveau: "INTERNE",
  description: "Termine le tour : donne la réponse finale à Lucien avec ton, confiance, sources, épisode, faits à retenir et fil.",
  params: O({
    texte: S("La réponse à Lucien, en français", { maxLength: 4000 }),
    ton: S("Ton de la réponse", { enum: ["calme", "curieux", "enthousiaste", "vigilant", "amuse", "preoccupe"] }),
    confiance: S("Confiance dans la réponse", { enum: ["haute", "moyenne", "basse"] }),
    sources: { type: "array", items: { type: "integer" }, description: "Numéros [n] des extraits de mémoire réellement utilisés" },
    episode: S("Une phrase qui résume l'échange", { maxLength: 240 }),
    importance: { type: "integer", description: "Importance de l'échange, 1 à 10" },
    a_retenir: { type: "array", items: { type: "string" }, description: "0 à 2 faits candidats sur Lucien ou le monde (jamais enregistrés directement)" },
    fil: S("Le fil de la conversation en une phrase", { maxLength: 240 })
  }, ["texte", "ton", "confiance"])
};
