// Laboratoire · hub simulé (annexe A du contrat). Branche à la place de l'hôte réel : tout vit en mémoire, rien n'est écrit dans les vraies données.
// Données d'exemple 100 % fictives (aucune donnée personnelle). Utilisé par labo.html et par les essais en Node.
import { brancher } from "../js/noyau/hote.js";

const pad = (n) => String(n).padStart(2, "0");
const jour = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/**
 * @param {object} o
 *  - maintenant : Date de départ de l'horloge simulée (par défaut 2026-10-26 09:00)
 *  - cle : clé Gemini du laboratoire (jamais enregistrée)
 *  - fetch : fonction réseau (par défaut : vrai réseau du navigateur si présent, sinon échec)
 *  - enLigne : booléen
 *  - vide : true = aucune donnée d'exemple
 */
export function creerHubSimule(o = {}) {
  let t = (o.maintenant || new Date(2026, 9, 26, 9, 0, 0)).getTime();
  let nid = 0, enLigne = o.enLigne !== false, cle = o.cle || null, cleC = o.cleClaude || null, cleL = o.cleLibre || null;
  const clesS = { ...(o.clesServices || {}) };          // IA de secours (groq, openrouter, mistral) : chaînes factices seulement
  const coll = { notes: new Map(), tasks: new Map(), events: new Map(), favs: new Map(), kv: new Map(), images: new Map() };
  const regl = new Map(), ecouteurs = {}, appels = [], toasts = [], orbe = [];
  let live = {}, dossierFictif = null, droitFictif = "granted"; const fichiers = [];
  const now = () => new Date(t);
  const D = now();
  if (!o.vide) {
    const add = (c, x) => coll[c].set(x.id, x);
    add("tasks", { id: "t1", text: "Préparer la présentation du projet", done: false, prio: 1, due: jour(plus(D, 1)), remindAt: null, created: t - 864e5, doneAt: null });
    add("tasks", { id: "t2", text: "Appeler le garage", done: false, prio: 0, due: jour(plus(D, -2)), remindAt: null, created: t - 5 * 864e5, doneAt: null });
    add("tasks", { id: "t3", text: "Ranger le bureau", done: true, prio: 0, due: null, remindAt: null, created: t - 6 * 864e5, doneAt: t - 864e5 });
    add("events", { id: "e1", title: "Réunion d'équipe", date: jour(D), start: "14:00", end: "15:00", remind: 10, created: t - 864e5 });
    add("events", { id: "e2", title: "Dentiste", date: jour(plus(D, 3)), start: "10:30", end: null, remind: 10, created: t - 864e5 });
    add("notes", { id: "n1", text: "Idée : un jardin de plantes aromatiques sur le balcon (basilic, menthe, thym).", pinned: true, created: t - 3 * 864e5, updated: t - 3 * 864e5 });
    add("notes", { id: "n2", text: "Livres à lire : Le Petit Prince, Dune, Fondation.", pinned: false, created: t - 2 * 864e5, updated: t - 2 * 864e5 });
    add("favs", { id: "f1", title: "Wikipedia", url: "https://fr.wikipedia.org/", group: "Références", created: t });
    add("favs", { id: "f2", title: "Météo France", url: "https://meteofrance.com/", group: "Pratique", created: t });
    add("kv", { id: "rituels-config", habits: [{ id: "h1", name: "Sport", goal: 1, unit: "séance" }, { id: "h2", name: "Eau", goal: 8, unit: "verres" }] });
    add("kv", { id: "rit-" + jour(D), counts: { h2: 3 }, mood: 4 });
  }
  const meteo = o.vide ? null : { name: "Ville d'exemple", data: { current: { temperature_2m: 14.2, apparent_temperature: 12.8, weather_code: 3, wind_speed_10m: 11 } } };
  const iso = (n) => new Date(t - n * 6e4).toISOString();
  const actus = o.vide ? null : { genere: now().toISOString(), actus: [
    { titre: "Une nouvelle puce d'IA annoncée pour les ordinateurs portables", source: "exemple-tech.test", cat: "TECH & IA", date: iso(35), lien: "https://exemple-tech.test/a" },
    { titre: "Le Conseil de l'Union européenne adopte un texte sur le numérique", source: "exemple-info.test", cat: "FRANCE", date: iso(80), lien: "https://exemple-info.test/b" },
    { titre: "Sommet international sur le climat : ouverture des négociations", source: "exemple-monde.test", cat: "MONDE", date: iso(130), lien: "https://exemple-monde.test/c" },
    { titre: "Un grand studio dévoile son prochain jeu d'aventure", source: "exemple-jeux.test", cat: "JEUX VIDÉO", date: iso(200), lien: "https://exemple-jeux.test/d" }
  ], sites: [{ nom: "Le hub", url: "https://exemple.test/", ok: true, code: 200, ms: 120, depuis: iso(900) }, { nom: "Un site en panne", url: "https://panne.test/", ok: false, code: 503, ms: 0, depuis: iso(45) }] };

  const emit = (c) => (ecouteurs[c] || []).forEach((f) => { try { f(); } catch (e) { /* ignoré */ } });
  const hote = {
    nom: "hub simulé (laboratoire)",
    maintenant: now,
    enLigne: () => enLigne,
    fetch: (u, opts) => { appels.push({ url: String(u), quand: now().toISOString() }); if (o.fetch) return o.fetch(u, opts); if (typeof fetch === "function") return fetch(u, opts); return Promise.reject(new Error("Pas de réseau dans le laboratoire")); },
    nouvelId: (p = "") => p + "sim" + (++nid).toString(36) + Math.random().toString(36).slice(2, 5),
    stockage: {
      tout: async (c) => [...coll[c].values()].map((x) => structuredClone(x)),
      lire: async (c, id) => { const x = coll[c].get(id); return x ? structuredClone(x) : undefined; },
      ecrire: async (c, x) => { x._m = t; coll[c].set(x.id, structuredClone(x)); emit(c); return x; },
      ecrireMany: async (c, xs) => { xs.forEach((x) => { x._m = t; coll[c].set(x.id, structuredClone(x)); }); emit(c); },
      retirerMany: async (c, ids) => { ids.forEach((id) => coll[c].delete(id)); emit(c); },
      surChangement: (c, f) => { (ecouteurs[c] = ecouteurs[c] || []).push(f); return () => { ecouteurs[c] = ecouteurs[c].filter((g) => g !== f); }; }
    },
    reglage: { lire: (k, d) => (regl.has(k) ? regl.get(k) : d), ecrire: (k, v) => { regl.set(k, String(v)); } },
    secret: { cle: () => cle, protege: () => true, cleClaude: () => cleC, definirCleClaude: (k) => { cleC = k || null; }, cleLibre: () => cleL, definirCleLibre: (k) => { cleL = k || null; }, cleService: (id) => clesS[id] || null, definirCleService: (id, k) => { if (!['groq', 'openrouter', 'mistral'].includes(id)) throw new Error('Service inconnu.'); if (k) clesS[id] = k; else delete clesS[id]; } },
    hub: {
      styleNoyau: (css) => { appels.push({ style: css }); }, disposer: async (id, d, o = {}) => { appels.push({ disposer: id, d, o }); if (id === "inconnue") return { ok: false, erreur: "Fenêtre inconnue" }; return { ok: true, avant: { x: 0.1, y: 0.1, w: 0.3, h: 0.3, pin: false, hid: false } }; }, remettreDisposition: async () => { appels.push({ remettre: 1 }); },
      actus: () => actus, meteo: () => meteo, contexteLive: () => live,
      agir: async (nom, p = {}) => { appels.push({ agir: nom, p }); if (nom === "afficher") return { ok: true, resume: "Fenêtre « " + p.fenetre + " » ramenée (simulé)." }; if (nom === "lancer_focus") return { ok: true, resume: "Focus " + p.minutes + " min lancé (simulé)." }; if (nom === "lire_fenetre") return { ok: true, texte: "(contenu simulé de la fenêtre " + p.fenetre + ")" }; return { ok: false, erreur: "Action « " + nom + " » non simulée." }; }
    },
    sauvegarde: {
      dispo: () => true, dossier: async () => dossierFictif, droit: async () => (dossierFictif ? droitFictif : "aucun"), retirer: async () => { dossierFictif = null; },
      choisir: async () => { dossierFictif = { nom: "Sauvegardes-fictives" }; return dossierFictif; },
      ecrire: async ({ demander = false } = {}) => { if (!dossierFictif) throw new Error("Aucun dossier choisi."); if (droitFictif !== "granted" && demander) droitFictif = "granted"; if (droitFictif !== "granted") throw new Error("réautoriser"); const nom = "hub-sauvegarde-" + jour(now()) + ".json"; fichiers.push(nom); regl.set("derniere-sauvegarde-auto", now().toISOString()); return { nom, octets: 1234, chiffre: true }; }
    },
    racine: () => "http://hub.test/",
    ui: {
      toast: (m) => toasts.push(m),
      orbe: (e) => orbe.push(e),
      ajouterMenuFond: () => {},
      conteneur: () => (typeof document !== "undefined" ? document.getElementById("noyau-mount") : null)
    }
  };
  brancher(hote);
  // Poignées pour le banc d'essai (hors de l'interface `hote`)
  return {
    hote, coll, appels, toasts, orbe,
    definirDroitDossier: (d) => { droitFictif = d; }, fichiersSauvegarde: () => fichiers.slice(), definirLive: (o) => { live = o || {}; }, avancer: (ms) => { t += ms; }, fixer: (d) => { t = d.getTime(); },
    reseau: (v) => { enLigne = !!v; }, definirCle: (k) => { cle = k || null; }, definirCleClaude: (k) => { cleC = k || null; },
    reglage: regl
  };
}
