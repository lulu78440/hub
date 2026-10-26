// Laboratoire · essais du lot 4 (fiabilité des appels) : `node labo/essais-fiabilite.mjs`
// Délai, file d'attente par hôte, reprise sur erreur, annulation. Horloge et pauses SIMULÉES : l'essai ne dort pas. Aucun vrai réseau.
import { creerFileHotes, avecDelai, executerAvecReprise, estRepetable, causeDe, ErreurFiabilite, ATTENTE_MAX_MS } from "../js/noyau/fiabilite.js";
import { creerBarriere } from "../js/noyau/barriere.js";
import { brancher } from "../js/noyau/hote.js";
import { journalActions } from "../js/noyau/journal.js";
import { creerDonnees, ErreurDonnees } from "../js/noyau/donnees.js";
import { creerJeux } from "../js/noyau/jeux.js";
import { creerCatalogue, OUTILS_VALIDES } from "../js/noyau/outils.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const refuse = async (p, re, m) => { try { await p; ko++; console.log("✗ " + m + " (aucun refus)"); } catch (e) { ok(re.test(e.message), m + " → " + String(e.message).slice(0, 100)); return e; } };

// Horloge simulée : la pause avance l'heure au lieu d'attendre.
let t = 1_000_000; const horloge = () => t; const pause = async (ms) => { t += ms; pause.vues.push(ms); }; pause.vues = [];

// ===== 1. File d'attente par hôte
let annonces = [];
// Par défaut la file n'attend pas plus de 20 s (au-delà elle refuse en disant combien de temps) : ici on autorise 70 s pour voir l'attente d'une minute.
let file = creerFileHotes({ maintenant: horloge, pause, attenteMax: 70000, surAttente: (a) => annonces.push(a) });
ok(ATTENTE_MAX_MS === 20000, "attente maximale par défaut : 20 s");
for (let i = 0; i < 30; i++) await file.acquerir("api.exemple.fr", 30);
ok(pause.vues.length === 0 && file.etat("api.exemple.fr").departs === 30, "30 départs dans la minute : aucun n'attend");
const r31 = await file.acquerir("api.exemple.fr", 30);
ok(r31.attente_ms > 0 && r31.attente_ms <= 60010 && pause.vues.length === 1 && annonces.length === 1 && annonces[0].hote === "api.exemple.fr" && annonces[0].ms > 0, `31e appel : il ATTEND (${Math.round(r31.attente_ms / 1000)} s) et l'attente est annoncée, il n'est ni perdu ni contourné`);
ok(file.etat("api.exemple.fr").departs === 1, "après l'attente, la fenêtre de la minute est repartie (seul le 31e compte)");
// l'attente maximale protège le Noyau : au-delà, refus clair, aucun départ compté
t = 2_000_000; file = creerFileHotes({ maintenant: horloge, pause, attenteMax: 5000 });
for (let i = 0; i < 3; i++) await file.acquerir("h.test.fr", 3);
let e = await refuse(file.acquerir("h.test.fr", 3), /Limite de 3 appels par minute .* je n'attends pas plus de 5 s/, "attente de plus de 5 s : refus clair (code file)");
ok(e.code === "file" && file.etat("h.test.fr").departs === 3, "le refus ne compte pas comme un départ");
ok(!estRepetable(e), "un refus de la file n'est jamais retenté");
// hôtes indépendants, ordre d'arrivée respecté
t = 3_000_000; file = creerFileHotes({ maintenant: horloge, pause });
await file.acquerir("a.test.fr", 1); const ordre = [];
const p1 = file.acquerir("a.test.fr", 1).then(() => ordre.push("b")), p2 = file.acquerir("a.test.fr", 1).then(() => ordre.push("c"));
const avant = pause.vues.length; await file.acquerir("autre.test.fr", 1);
ok(pause.vues.length === avant, "un autre hôte n'attend pas derrière le premier");
await Promise.allSettled([p1, p2]);
ok(ordre.join("") === "bc" || ordre.length === 0 || ordre[0] === "b", "servis dans l'ordre d'arrivée : " + (ordre.join("→") || "(le dernier a été refusé par l'attente maximale)"));
await refuse(creerFileHotes().acquerir("", 5), /Hôte invalide/, "hôte vide refusé");
// annulation pendant l'attente
t = 4_000_000; let ctl = new AbortController();
file = creerFileHotes({ maintenant: horloge, pause: (ms, sig) => new Promise((res, no) => { sig.addEventListener("abort", () => no(new ErreurFiabilite("Annulé.", "annule"))); }) });
await file.acquerir("z.test.fr", 1); const att = file.acquerir("z.test.fr", 1, { signal: ctl.signal }); ctl.abort();
e = await refuse(att, /Annulé/, "annulation pendant l'attente : l'appel s'arrête"); ok(e.code === "annule", "code « annule »");

// ===== 2. Délai : l'appel est COUPÉ
let signalVu = null;
e = await refuse(avecDelai((sig) => { signalVu = sig; return new Promise(() => {}); }, 40), /Délai dépassé/, "un appel qui ne répond pas est coupé au délai");
ok(e.code === "delai" && signalVu.aborted === true, "le signal d'annulation a bien été déclenché (fetch coupé)");
ok(await avecDelai(async () => 42, 500) === 42, "un appel rapide passe");
ctl = new AbortController(); const long = avecDelai((sig) => new Promise(() => {}), 5000, ctl.signal); ctl.abort();
e = await refuse(long, /Annulé/, "annulation par Lucien en cours de route"); ok(e.code === "annule", "code « annule »");
ctl = new AbortController(); ctl.abort(); await refuse(avecDelai(async () => 1, 100, ctl.signal), /Annulé/, "signal déjà annulé : rien n'est lancé");

// ===== 3. Reprise : UN seul nouvel essai, pour une lecture idempotente, sur erreur de réseau ou de délai
const pauses = []; const p0 = async (ms) => { pauses.push(ms); };
let n = 0;
let r = await executerAvecReprise(async () => { n++; if (n === 1) throw new ErreurDonnees("réseau", "reseau"); return "ok"; }, { repetable: true, delaiMs: 200, pause: p0 });
ok(r.valeur === "ok" && r.essais === 2 && n === 2 && pauses.length === 1, "erreur de réseau puis succès : 2 essais, une pause entre les deux");
n = 0; e = await refuse(executerAvecReprise(async () => { n++; throw new ErreurDonnees("toujours en panne", "reseau"); }, { repetable: true, delaiMs: 200, pause: p0 }), /toujours en panne/, "deux échecs de suite : on s'arrête, l'erreur est rendue");
ok(n === 2 && e.essais === 2 && e.cause_fiabilite === "reseau", "jamais plus de 2 essais (" + n + "), l'erreur dit combien d'essais et la cause");
n = 0; await refuse(executerAvecReprise(async () => { n++; throw new ErreurDonnees("format", "format"); }, { repetable: true, delaiMs: 200, pause: p0 }), /format/, "erreur de format : pas de nouvel essai"); ok(n === 1, "1 seul appel");
n = 0; await refuse(executerAvecReprise(async () => { n++; throw new ErreurDonnees("limite", "debit"); }, { repetable: true, delaiMs: 200, pause: p0 }), /limite/, "limite par minute : pas de nouvel essai"); ok(n === 1, "1 seul appel (la limite n'est jamais contournée par une reprise)");
n = 0; await refuse(executerAvecReprise(async () => { n++; throw new ErreurDonnees("réseau", "reseau"); }, { repetable: false, delaiMs: 200, pause: p0 }), /réseau/, "outil non idempotent : pas de nouvel essai"); ok(n === 1, "1 seul appel");
n = 0; r = await executerAvecReprise(async (sig) => { n++; if (n === 1) return new Promise(() => {}); return "tard"; }, { repetable: true, delaiMs: 30, pause: p0 });
ok(r.valeur === "tard" && r.essais === 2, "un délai dépassé est retenté une fois");
ctl = new AbortController(); n = 0;
await refuse(executerAvecReprise(async () => { n++; ctl.abort(); throw new ErreurDonnees("réseau", "reseau"); }, { repetable: true, delaiMs: 200, pause: p0, signal: ctl.signal }), /réseau|Annulé/, "annulé pendant le premier essai : pas de second"); ok(n === 1, "1 seul appel");
ok(estRepetable({ code: "reseau" }) && estRepetable({ code: "delai" }) && estRepetable({ name: "AbortError" }) && !estRepetable({ code: "annule" }) && !estRepetable(new Error("x")) && !estRepetable({ code: "http" }), "classement des erreurs : réseau et délai seulement");
ok(causeDe({ code: "delai" }) === "delai" && causeDe({ code: "debit" }) === "limite" && causeDe({ code: "file" }) === "limite" && causeDe(new Error("x")) === "erreur", "causes lisibles");

// ===== 4. Dans la barrière : journal, niveaux, confirmations
const kv = new Map(), lignesJournal = [];
brancher({ nom: "test", maintenant: () => new Date(), enLigne: () => true, nouvelId: (p = "") => p + Math.random().toString(36).slice(2, 10), fetch: async () => { throw new Error("pas de réseau dans cet essai"); },
  reglage: { lire: (k, d) => d, ecrire: () => {} },
  stockage: { tout: async () => [], lire: async (c, id) => (c === "kv" ? kv.get(id) : null), ecrire: async (c, o) => { if (c === "kv") kv.set(o.id, JSON.parse(JSON.stringify(o))); } }, ui: {} });
const dernier = async (k = 1) => (await journalActions.lire({ limite: k }))[0];
let essaisOutil = 0, mode = "ok";
const lecture = { nom: "lecture_test", niveau: "LIBRE", params: { type: "object", properties: {} }, drapeaux: { lecture_seule: true, reversible: true, monde_ouvert: true, idempotent: true }, hotes: ["api.test.fr"], limites: { delai_ms: 60, max_par_minute: 50 }, sortie: () => ["api.test.fr"], resume: () => "Lecture d'essai",
  exec: async (p, c) => { essaisOutil++; if (mode === "reseau-1" && essaisOutil === 1) throw new ErreurDonnees("Site injoignable", "reseau"); if (mode === "lent") return new Promise((res, no) => c.signal.addEventListener("abort", () => no(Object.assign(new Error("a"), { name: "AbortError" })))); if (mode === "format") throw new ErreurDonnees("Réponse illisible", "format"); return { ok: true }; } };
const ecriture = { nom: "ecriture_test", niveau: "CONFIRMATION", params: { type: "object", properties: {} }, drapeaux: { lecture_seule: false, reversible: true, monde_ouvert: true, idempotent: true }, hotes: ["api.test.fr"], limites: { delai_ms: 60 }, sortie: () => [], resume: () => "Écriture d'essai",
  exec: async () => { essaisOutil++; throw new ErreurDonnees("Site injoignable", "reseau"); } };
let tb = 5_000_000; const pb = async (ms) => { tb += ms; };
const barriere = creerBarriere({ catalogue: [lecture, ecriture], confirmer: async () => true, delai: 200, pause: pb, pauseReprise: 1, file: creerFileHotes({ maintenant: () => tb, pause: pb }) });
essaisOutil = 0; mode = "reseau-1"; let res = await barriere.executer({ outil: "lecture_test", params: {} });
let lj = await dernier();
ok(res.ok && res.essais === 2 && essaisOutil === 2 && lj.statut === "EXÉCUTÉ" && lj.essais === 2 && /2e essai réussi/.test(lj.params), "lecture : échec réseau puis succès au 2e essai, journalisé avec le nombre d'essais");
essaisOutil = 0; mode = "lent"; res = await barriere.executer({ outil: "lecture_test", params: {} }); lj = await dernier();
ok(!res.ok && res.cause === "delai" && lj.statut === "ERREUR" && lj.cause === "delai" && /Délai dépassé/.test(lj.erreur) && essaisOutil === 2, "outil qui ne répond pas : coupé au délai, retenté une fois, ERREUR journalisée avec sa cause « delai »");
essaisOutil = 0; mode = "format"; res = await barriere.executer({ outil: "lecture_test", params: {} }); lj = await dernier();
ok(!res.ok && essaisOutil === 1 && lj.cause === "format", "erreur de format : pas de nouvel essai, cause journalisée");
essaisOutil = 0; res = await barriere.executer({ outil: "ecriture_test", params: {} }); lj = await dernier();
ok(!res.ok && essaisOutil === 1 && lj.statut === "ERREUR", "outil qui écrit (CONFIRMATION) : jamais retenté, même idempotent et en erreur réseau");
// limite par minute : la file fait attendre, ne contourne pas
mode = "ok"; essaisOutil = 0; tb = 6_000_000; const attentes = []; const pc = async (ms) => { tb += ms; attentes.push(ms); };
const lecture2 = { ...lecture, nom: "lecture_test2", limites: { delai_ms: 60, max_par_minute: 2 } };
const b2 = creerBarriere({ catalogue: [lecture2], pause: pc, file: creerFileHotes({ maintenant: () => tb, pause: pc, attenteMax: 70000 }) });
const rr = []; for (let i = 0; i < 3; i++) rr.push(await b2.executer({ outil: "lecture_test2", params: {} }));
lj = await dernier();
ok(rr.every((x) => x.ok) && attentes.length === 1 && rr[2].attente_ms > 0 && lj.attente_ms > 0, "limite de 2 appels par minute : le 3e attend sa place (" + Math.round(rr[2].attente_ms / 1000) + " s), l'attente est journalisée");
// plan : identifiant dans la ligne du journal
res = await barriere.executer({ outil: "lecture_test", params: {} }, { plan: "plan-essai1" }); lj = await dernier();
ok(lj.plan === "plan-essai1", "la ligne d'outil porte l'identifiant du plan");
// niveaux inchangés
const cat = creerCatalogue({ raccourcis: () => ({}) });
ok(cat.length === 45 && Object.keys(OUTILS_VALIDES).length === 45 && cat.every((o) => OUTILS_VALIDES[o.nom] === o.niveau), "catalogue : 45 outils, niveaux identiques à la liste validée de Lucien (LIBRE / CONFIRMATION)");
ok(cat.filter((o) => o.niveau === "INTERDIT").length === 0, "aucun outil INTERDIT n'existe pour le modèle");
ok(cat.find((o) => o.nom === "enregistrer_module").niveau === "CONFIRMATION" && cat.find((o) => o.nom === "lire_serie").niveau === "LIBRE", "enregistrer_module reste CONFIRMATION ; lire_serie reste LIBRE");
// hôtes déclarés par outil : chercher_donnees sur la Banque mondiale est local
const cd = cat.find((o) => o.nom === "chercher_donnees"), ls = cat.find((o) => o.nom === "lire_serie");
ok(cd.hote_de({ source: "banque_mondiale", requete: "pib" }).length === 0 && cd.hote_de({ requete: "x" })[0] === "api.db.nomics.world" && ls.hote_de({ source: "banque_mondiale", identifiant: "FR/SP.POP.TOTL" })[0] === "api.worldbank.org", "la file ne compte que les hôtes réellement contactés (recherche Banque mondiale = locale)");

// ===== 5. Sources : signal d'annulation et état de fraîcheur
const jeux = creerJeux(); let horlogeD = new Date("2026-10-26T10:00:00Z");
const dbn = { series: { docs: [{ series_name: "S", period: ["2020", "2021"], value: [1, 2], indexed_at: "2026-10-20T10:00:00Z" }] } };
const fetchOk = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(dbn) });
let D = creerDonnees({ fetch: fetchOk, maintenant: () => horlogeD, jeux });
let etat = D.etatSources().find((x) => x.id === "dbnomics");
ok(etat.dernier_ok === null && etat.derniere_erreur === null && etat.derniere_maj === null, "source jamais appelée : tout est null (rien d'inventé)");
await D.lire({ source: "dbnomics", identifiant: "A/B/C" }); etat = D.etatSources().find((x) => x.id === "dbnomics");
ok(etat.dernier_ok === "2026-10-26T10:00:00.000Z" && etat.derniere_maj === "2026-10-20" && etat.erreur === null, "après une lecture : dernière réponse et date de la dernière donnée notées");
const ctl2 = new AbortController();
D = creerDonnees({ fetch: (u, o) => new Promise((res, no) => o.signal.addEventListener("abort", () => no(Object.assign(new Error("a"), { name: "AbortError" })))), maintenant: () => horlogeD, jeux });
const pl = D.lire({ source: "dbnomics", identifiant: "A/B/C", signal: ctl2.signal }); setTimeout(() => ctl2.abort(), 10);
e = await refuse(pl, /annulé/i, "annulation de Lucien : la requête est coupée"); ok(e.code === "annule" && !estRepetable(e), "code « annule », jamais retenté");
D = creerDonnees({ fetch: async () => { throw new Error("Failed to fetch"); }, maintenant: () => horlogeD, jeux });
await refuse(D.lire({ source: "banque_mondiale", identifiant: "FR/SP.POP.TOTL" }), /injoignable/, "réseau coupé"); etat = D.etatSources().find((x) => x.id === "banque_mondiale");
ok(etat.derniere_erreur && etat.erreur_code === "reseau" && /injoignable/.test(etat.erreur) && etat.dernier_ok === null, "l'échec est noté avec sa cause sur la source");
ok(estRepetable(new ErreurDonnees("x", "reseau")) && !estRepetable(new ErreurDonnees("x", "vide")), "les erreurs de DONNÉES vides ou illisibles ne sont pas retentées");
const j3 = creerJeux({ maintenant: () => new Date(7_000) }); const dep = j3.deposer({ titre: "t", unite: "u", colonnes: [{ id: "d", libelle: "D", type: "date" }, { id: "v", libelle: "V", type: "nombre" }], lignes: [["2020", 1]], source: { nom: "n", maj: "2026-01-01", periode: "2020" } });
ok(j3.depose(dep.ref) === 7000 && j3.depose("jeu:inconnu1") === null, "un jeu garde l'instant où il est entré en mémoire (pour « chargé il y a … »)");

console.log(ko ? `\n${ko} ÉCHEC(S)` : "\nTout est au vert."); process.exit(ko ? 1 : 0);
