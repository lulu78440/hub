// Noyau · sources de données chiffrées (orchestrateur, lot 3) : chercher_donnees et lire_serie.
// Liste FIXE et publique de sources, sans clé, sans compte, lecture seule. Chaque réponse est contrôlée (taille, forme, valeurs) avant de devenir
// un jeu : une réponse vide ou inattendue donne une ERREUR claire, jamais un zéro par défaut. Le modèle ne reçoit que des références (jeux.js).
// ⚠ CORS et formats : écrits d'après la documentation des sources ; l'atelier n'a pas accès à ces sites (proxy 403). Chaque source doit être
// essayée en direct par Lucien (labo → Sources, sur Brave PC puis Android) avant d'être considérée comme sûre. Voir docs/noyau-orchestrateur/etat.md.
import { resumeJeu } from "./jeux.js";

export const SOURCES_DONNEES = Object.freeze([
  { id: "dbnomics", nom: "DBnomics", hote: "api.db.nomics.world", max_par_minute: 30, licence: "selon le fournisseur (INSEE : Licence Ouverte Etalab)", acces: "direct", exemple_serie: "INSEE/IPC-2015/M.00.SO.SO.ENSEMBLE.FE" },
  { id: "banque_mondiale", nom: "Banque mondiale", hote: "api.worldbank.org", max_par_minute: 30, licence: "CC BY 4.0", acces: "direct", exemple_serie: "FR/SP.POP.TOTL" },
  { id: "publie", nom: "Séries publiées par la tâche GitHub (désactivée tant que Lucien ne l'active pas)", hote: "raw.githubusercontent.com", max_par_minute: 30, licence: "selon la série", acces: "tache_github", exemple_serie: "population-france" }
]);
export const HOTES_DONNEES = Object.freeze([...new Set(SOURCES_DONNEES.map((s) => s.hote))].sort());

// Indicateurs de la Banque mondiale connus d'avance (recherche locale, sans réseau).
export const INDICATEURS_BM = Object.freeze([
  { code: "SP.POP.TOTL", nom: "Population totale", unite: "habitants", mots: "population habitants demographie" },
  { code: "NY.GDP.MKTP.CD", nom: "PIB (dollars courants)", unite: "USD courants", mots: "pib produit interieur brut richesse economie" },
  { code: "NY.GDP.PCAP.CD", nom: "PIB par habitant (dollars courants)", unite: "USD courants", mots: "pib habitant richesse niveau de vie" },
  { code: "FP.CPI.TOTL.ZG", nom: "Inflation, prix à la consommation (% annuel)", unite: "% par an", mots: "inflation prix consommation" },
  { code: "SL.UEM.TOTL.ZS", nom: "Chômage (% de la population active)", unite: "% de la population active", mots: "chomage emploi travail" },
  { code: "SP.DYN.LE00.IN", nom: "Espérance de vie à la naissance", unite: "années", mots: "esperance vie sante" },
  { code: "EN.ATM.CO2E.PC", nom: "Émissions de CO2 par habitant", unite: "tonnes par habitant", mots: "co2 carbone emissions climat environnement" }
]);

export const MAX_OCTETS = 2000000;
export const DELAI_MS = 10000;
const RE_SERIE = { dbnomics: /^[A-Za-z0-9_-]{1,40}\/[A-Za-z0-9_.-]{1,60}\/[A-Za-z0-9_.@+-]{1,120}$/, banque_mondiale: /^[A-Z]{2,3}\/[A-Z0-9.]{4,30}$/, publie: /^[a-z0-9-]{2,60}$/ };
const RE_PERIODE = /^\d{4}(-\d{2})?$/;
const propre = (v, n = 120) => String(v == null ? "" : v).replace(new RegExp("[\\u0000-\\u001f\\u007f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]", "g"), " ").replace(/\s+/g, " ").trim().slice(0, n);
const sansAccent = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const jourISO = (d) => d.toISOString().slice(0, 10);

export class ErreurDonnees extends Error { constructor(m, code = "donnees") { super(m); this.name = "ErreurDonnees"; this.code = code; } }
const echec = (m, code) => { throw new ErreurDonnees(m, code); };

/** Date « source » → AAAA, AAAA-MM ou AAAA-MM-JJ ; trimestres et semestres ramenés à leur premier mois (annoncé dans la période). */
export function dateSerie(p) {
  const s = String(p).trim();
  let m;
  if ((m = /^(\d{4})$/.exec(s))) return { d: m[1] };
  if ((m = /^(\d{4})-(\d{2})$/.exec(s))) return { d: s };
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return { d: s };
  if ((m = /^(\d{4})-?Q([1-4])$/i.exec(s))) return { d: `${m[1]}-${String((+m[2] - 1) * 3 + 1).padStart(2, "0")}`, trim: true };
  if ((m = /^(\d{4})-?S([12])$/i.exec(s))) return { d: `${m[1]}-${m[2] === "1" ? "01" : "07"}`, sem: true };
  return null;
}

export function creerDonnees({ fetch, maintenant = () => new Date(), jeux, reglage = null, delai = DELAI_MS, racinePubliee = "https://raw.githubusercontent.com/lulu78440/hub/donnees/donnees/" } = {}) {
  const appels = new Map();      // hôte → horodatages de la dernière minute
  const coupees = () => { try { const l = reglage ? reglage("noyau-donnees-coupees", []) : []; return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  const source = (id) => { const s = SOURCES_DONNEES.find((x) => x.id === id); if (!s) echec(`Source inconnue « ${propre(id, 30)} » (permises : ${SOURCES_DONNEES.map((x) => x.id).join(", ")})`, "source"); return s; };
  const controler = (s) => {
    if (coupees().includes(s.id)) echec(`La source « ${s.nom} » est coupée dans les réglages de Lucien.`, "coupee");
    const t = maintenant().getTime(), l = (appels.get(s.hote) || []).filter((x) => t - x < 60000);
    if (l.length >= s.max_par_minute) echec(`Limite de ${s.max_par_minute} appels par minute atteinte pour ${s.nom} : réessaie dans ${Math.max(1, Math.ceil((60000 - (t - l[0])) / 1000))} s.`, "debit");
    l.push(t); appels.set(s.hote, l);
  };

  async function chercherJSON(url, s) {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.hostname !== s.hote) echec("Adresse refusée : seul l'hôte de la source est permis.", "hote");
    controler(s);
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const minuterie = ctl ? setTimeout(() => ctl.abort(), delai) : null;
    let rep;
    try { rep = await fetch(url, ctl ? { signal: ctl.signal, headers: { accept: "application/json" } } : { headers: { accept: "application/json" } }); }
    catch (e) { echec(e && e.name === "AbortError" ? `${s.nom} met trop de temps à répondre (plus de ${Math.round(delai / 1000)} s).` : `${s.nom} est injoignable (réseau coupé, site hors service ou accès bloqué par le navigateur).`, "reseau"); }
    finally { if (minuterie) clearTimeout(minuterie); }
    if (!rep || !rep.ok) echec(`${s.nom} a répondu par une erreur${rep && rep.status ? " (" + rep.status + ")" : ""}${rep && rep.status === 404 && s.id === "publie" ? " : la série n'est pas publiée (la tâche GitHub n'est pas activée ?)" : ""}.`, "http");
    let texte; try { texte = await rep.text(); } catch (e) { echec(`Réponse de ${s.nom} illisible.`, "format"); }
    if (texte.length > MAX_OCTETS) echec(`Réponse de ${s.nom} trop volumineuse (plus de ${MAX_OCTETS / 1e6} Mo) : refusée.`, "taille");
    try { return JSON.parse(texte); } catch (e) { echec(`Réponse de ${s.nom} : ce n'est pas du JSON.`, "format"); }
  }
  const ajouterParam = (base, o) => base + "?" + Object.entries(o).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

  // ------------------------------------------------------------------ chercher_donnees
  async function chercher({ requete, source: id = "dbnomics", jeu_de_donnees = "" } = {}) {
    const s = source(id), q = propre(requete, 120);
    if (q.length < 2) echec("Requête trop courte.", "requete");
    const mots = sansAccent(q).split(/[^a-z0-9]+/).filter((m) => m.length > 1);
    if (s.id === "banque_mondiale") {
      const r = INDICATEURS_BM.filter((i) => mots.some((m) => sansAccent(i.nom + " " + i.mots).includes(m)));
      return { source: s.nom, licence: s.licence, resultats: r.slice(0, 8).map((i) => ({ identifiant: "FR/" + i.code, indicateur: i.nom, unite: i.unite })), note: "Identifiant = PAYS/INDICATEUR : remplace FR par le code du pays (DE, ES, US…). Liste locale d'indicateurs courants." };
    }
    if (s.id === "publie") {
      const rep = await chercherJSON(racinePubliee + "index.json", s);
      const l = Array.isArray(rep && rep.series) ? rep.series : echec("Index des séries publiées : forme inattendue.", "format");
      const r = l.filter((x) => x && typeof x.id === "string" && RE_SERIE.publie.test(x.id) && mots.some((m) => sansAccent(String(x.nom) + " " + String(x.id)).includes(m)));
      return { source: s.nom, licence: s.licence, resultats: r.slice(0, 8).map((x) => ({ identifiant: x.id, titre: propre(x.nom), actualise: propre(x.maj, 20) })) };
    }
    // DBnomics : recherche de jeux de données, ou de séries dans un jeu précis
    let r;
    if (jeu_de_donnees) {
      if (!/^[A-Za-z0-9_-]{1,40}\/[A-Za-z0-9_.-]{1,60}$/.test(jeu_de_donnees)) echec("jeu_de_donnees : format FOURNISSEUR/JEU attendu (ex. INSEE/IPC-2015).", "requete");
      const rep = await chercherJSON(ajouterParam(`https://${s.hote}/v22/series/${jeu_de_donnees}`, { q, limit: 8, observations: 0, metadata: 0 }), s);
      const docs = rep && rep.series && Array.isArray(rep.series.docs) ? rep.series.docs : echec("Réponse DBnomics : forme inattendue (liste de séries absente).", "format");
      r = docs.filter((d) => d && typeof d.series_code === "string").slice(0, 8).map((d) => ({ identifiant: `${jeu_de_donnees}/${d.series_code}`, titre: propre(d.series_name) }));
    } else {
      const rep = await chercherJSON(ajouterParam(`https://${s.hote}/v22/search`, { q, limit: 8, offset: 0 }), s);
      const docs = rep && rep.results && Array.isArray(rep.results.docs) ? rep.results.docs : echec("Réponse DBnomics : forme inattendue (résultats absents).", "format");
      r = docs.filter((d) => d && typeof d.provider_code === "string" && typeof d.code === "string").slice(0, 8).map((d) => ({ jeu_de_donnees: `${d.provider_code}/${d.code}`, titre: propre(d.name) }));
    }
    return { source: s.nom, licence: s.licence, resultats: r, note: jeu_de_donnees ? "Passe `identifiant` à lire_serie." : "Ce sont des jeux de données : relance chercher_donnees avec `jeu_de_donnees` pour voir ses séries, puis lire_serie." };
  }

  // ------------------------------------------------------------------ lire_serie
  const filtrerPeriode = (lignes, debut, fin) => {
    const d0 = debut ? debut : "0000", d1 = fin ? fin : "9999-99-99";
    return lignes.filter((l) => l[0].slice(0, d0.length) >= d0 && l[0].slice(0, d1.length) <= d1);
  };
  async function lire({ source: id, identifiant, debut = "", fin = "" } = {}) {
    const s = source(id);
    if (typeof identifiant !== "string" || !RE_SERIE[s.id].test(identifiant)) echec(`Identifiant de série invalide pour ${s.nom} (exemple : ${s.exemple_serie}).`, "requete");
    for (const p of [debut, fin]) if (p && !RE_PERIODE.test(p)) echec("Période : AAAA ou AAAA-MM.", "requete");
    const requete = jourISO(maintenant());
    let lignes, nomSerie, unite = "unité non précisée", maj = null, licence = s.licence, periodeNote = "", url;
    if (s.id === "dbnomics") {
      url = `https://${s.hote}/v22/series/${identifiant}?observations=1`;
      const rep = await chercherJSON(url, s);
      const d = rep && rep.series && Array.isArray(rep.series.docs) ? rep.series.docs[0] : null;
      if (!d || !Array.isArray(d.period) || !Array.isArray(d.value) || d.period.length !== d.value.length) echec("Réponse DBnomics : forme inattendue (période et valeurs absentes ou de tailles différentes).", "format");
      let trim = false, sem = false;
      lignes = d.period.map((p, i) => {
        const dt = dateSerie(p); if (!dt) echec(`Réponse DBnomics : date non reconnue « ${propre(p, 20)} ».`, "format");
        if (dt.trim) trim = true; if (dt.sem) sem = true;
        const v = d.value[i]; return [dt.d, typeof v === "number" && Number.isFinite(v) ? v : null];       // « NA » ou autre : valeur absente, jamais 0
      });
      nomSerie = propre(d.series_name) || identifiant;
      if (typeof d.indexed_at === "string" && /^\d{4}-\d{2}-\d{2}/.test(d.indexed_at)) maj = d.indexed_at.slice(0, 10);
      if (trim) periodeNote = " · trimestres datés de leur premier mois"; if (sem) periodeNote += " · semestres datés de janvier ou juillet";
      if (/^INSEE\//.test(identifiant)) licence = "Licence Ouverte Etalab 2.0 (INSEE, via DBnomics)";
    } else if (s.id === "banque_mondiale") {
      const [pays, ind] = identifiant.split("/");
      url = ajouterParam(`https://${s.hote}/v2/country/${pays}/indicator/${ind}`, { format: "json", per_page: 200, date: (debut || fin) ? `${(debut || "1960").slice(0, 4)}:${(fin || String(maintenant().getUTCFullYear())).slice(0, 4)}` : "" });
      const rep = await chercherJSON(url, s);
      if (Array.isArray(rep) && rep[0] && rep[0].message) echec("La Banque mondiale refuse cette demande : " + propre(JSON.stringify(rep[0].message), 140), "http");
      const rows = Array.isArray(rep) && Array.isArray(rep[1]) ? rep[1] : null;
      if (!rows) echec("Réponse Banque mondiale : forme inattendue (liste d'observations absente).", "format");
      lignes = rows.map((r) => { if (!r || !/^\d{4}$/.test(String(r.date))) echec("Réponse Banque mondiale : date non reconnue.", "format"); return [String(r.date), typeof r.value === "number" && Number.isFinite(r.value) ? r.value : null]; }).reverse();
      const c = INDICATEURS_BM.find((i) => i.code === ind);
      nomSerie = propre((rows[0] && rows[0].country && rows[0].country.value ? rows[0].country.value + " · " : "") + (c ? c.nom : rows[0] && rows[0].indicator && rows[0].indicator.value) || identifiant);
      if (c) unite = c.unite;
      const lu = rep[0] && typeof rep[0].lastupdated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rep[0].lastupdated) ? rep[0].lastupdated : null; maj = lu;
    } else {
      url = racinePubliee + identifiant + ".json";
      const rep = await chercherJSON(url, s);
      if (!rep || !Array.isArray(rep.lignes) || !Array.isArray(rep.colonnes) || typeof rep.unite !== "string" || !rep.source) echec("Série publiée : forme inattendue.", "format");
      const brut = jeux.deposer({ ...rep, source: { ...rep.source, requete } }, { origine: { source: s.id, identifiant } });     // déjà au format jeu : vérifié par le magasin
      return { ref: brut.ref, jeu: brut.jeu, resume: resumeJeu(brut.ref, brut.jeu) };
    }
    lignes = filtrerPeriode(lignes, debut, fin);
    if (!lignes.length) echec(`${s.nom} n'a renvoyé aucune donnée pour cette série et cette période. Rien n'est affiché.`, "vide");
    if (lignes.every((l) => l[1] == null)) echec(`${s.nom} n'a renvoyé que des valeurs manquantes pour cette série. Rien n'est affiché.`, "vide");
    const premiere = lignes[0][0], derniere = lignes[lignes.length - 1][0];
    const majConnue = maj !== null;
    const { ref, jeu } = jeux.deposer({
      titre: nomSerie.slice(0, 120), unite: unite.slice(0, 40),
      colonnes: [{ id: "date", libelle: "Date", type: "date" }, { id: "valeur", libelle: nomSerie.slice(0, 60), type: "nombre" }],
      lignes,
      // Les mentions d'honnêteté vont dans le NOM de la source (120 signes, toujours affiché), pas dans la période (60 signes, tronquée sans prévenir).
      source: { nom: ((n) => `${`${s.nom} · ${identifiant}`.slice(0, 120 - n.length)}${n}`)(`${periodeNote}${majConnue ? "" : " · mise à jour de la source inconnue (date de la requête)"}`), maj: maj || requete, periode: `${premiere} → ${derniere}`.slice(0, 60), url: url.split("?")[0], licence: licence.slice(0, 80), requete, verifie: true },
      exemple: false
    }, { origine: { source: s.id, identifiant, debut, fin } });
    return { ref, jeu, resume: resumeJeu(ref, jeu) };
  }

  return { chercher, lire, sources: () => SOURCES_DONNEES.map((s) => ({ id: s.id, nom: s.nom, hote: s.hote, licence: s.licence, acces: s.acces, coupee: coupees().includes(s.id), exemple: s.exemple_serie })) };
}
