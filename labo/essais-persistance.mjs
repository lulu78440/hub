// Laboratoire · persistance et sessions (orchestrateur, lot 9) : `node labo/essais-persistance.mjs`
// Cache local des jeux (faux IndexedDB), sessions en anneau, reprise après rechargement SANS réseau, espaces de travail, réglage de coupure.
// Hub simulé, réseau simulé : aucun service réel.
// Faux IndexedDB (le strict nécessaire : open, createObjectStore, transaction, get, put, delete, getAllKeys), partagé entre « deux chargements de la page ».
const bases = new Map();
const req = (f) => { const r = { result: undefined, error: null, onsuccess: null, onerror: null }; setTimeout(() => { try { r.result = f(); r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 0); return r; };
globalThis.indexedDB = { open(nom) { const r = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
  setTimeout(() => { const neuf = !bases.has(nom); if (neuf) bases.set(nom, { jeux: new Map() }); const b = bases.get(nom);
    r.result = { createObjectStore() {}, transaction: () => ({ objectStore: () => ({ get: (k) => req(() => structuredClone(b.jeux.get(k))), put: (v, k) => req(() => { b.jeux.set(k, structuredClone(v)); return k; }), delete: (k) => req(() => { b.jeux.delete(k); }), getAllKeys: () => req(() => [...b.jeux.keys()]) }) }) };
    if (neuf && r.onupgradeneeded) r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }, 0); return r; } };
const { creerHubSimule } = await import("./hub-simule.js");
const { creerNoyau } = await import("../js/noyau/noyau.js");
const { creerCacheJeux, backendMemoire, backendIDB, empreinte, MAX_ENTREES, FRAICHEUR_H } = await import("../js/noyau/cache-jeux.js");
const { creerSessions, MAX_SESSIONS } = await import("../js/noyau/sessions.js");
const { creerEspaces, verifierEspace } = await import("../js/noyau/espaces.js");
const { creerJeux } = await import("../js/noyau/jeux.js");
const { provenanceDe } = await import("../js/noyau/provenance.js");
const { verifierJeu } = await import("../js/noyau/modules/composants.js");
const { creerGestesLucien } = await import("../js/noyau/modules/gestes-lucien.js");
const { creerModules } = await import("../js/noyau/modules.js");
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const leve = async (f, re, m) => { try { await f(); ko++; console.log("✗ " + m + " (aucune erreur)"); } catch (e) { if (re.test(e.message)) console.log("✓ " + m); else { ko++; console.log("✗ " + m + " : " + e.message); } } };

const brut = (extra = {}) => ({ titre: "Population", unite: "habitants", colonnes: [{ id: "date", libelle: "Date", type: "date" }, { id: "valeur", libelle: "Population", type: "nombre" }], lignes: [["2000", 10], ["2005", 20], ["2010", 30]], source: { nom: "Test · FR/POP", maj: "2026-10-01", periode: "2000 → 2010", licence: "LO", requete: "2026-10-20", verifie: true }, ...extra });

// ===== 1. Cache local : IndexedDB (faux) et mémoire
let t = new Date("2026-10-26T09:00:00Z");
for (const [nom, backend] of [["IndexedDB (faux)", backendIDB(globalThis.indexedDB, "essai-cache")], ["mémoire", backendMemoire()]]) {
  const C = creerCacheJeux({ backend, maintenant: () => t });
  const j = verifierJeu(brut()), cle = await C.noter(j, { source: "dbnomics", identifiant: "INSEE/POP/V" });
  ok(typeof cle === "string" && cle === empreinte(j), `${nom} : un jeu est rangé sous son empreinte`);
  const e = await C.lire(cle); ok(e && e.jeu.lignes.length === 3 && e.jeu.verifie === true && e.perime === false && e.age_h === 0, `${nom} : relu, re-vérifié, frais`);
  t = new Date(t.getTime() + 25 * 3600000); const e2 = await C.lire(cle); ok(e2.perime === true && e2.age_h === 25, `${nom} : 25 h plus tard, un jeu DBnomics est dit périmé (fraîcheur ${FRAICHEUR_H.dbnomics} h), mais reste lisible avec son âge`);
  t = new Date("2026-10-26T09:00:00Z");
  ok(empreinte(verifierJeu(brut())) === cle && empreinte(verifierJeu(brut({ lignes: [["2000", 10], ["2005", 21], ["2010", 30]] }))) !== cle, `${nom} : même contenu = même empreinte ; une valeur change = autre empreinte`);
  ok((await C.lire("e-inconnu")) === null, `${nom} : entrée inconnue = null, jamais un jeu par défaut`);
  for (let i = 0; i < MAX_ENTREES + 5; i++) await C.noter(verifierJeu(brut({ titre: "Jeu " + i, lignes: [["2000", i]] })), null);
  ok((await C.liste()).length <= MAX_ENTREES, `${nom} : ${MAX_ENTREES} entrées au plus`);
  await C.vider(); ok((await C.liste()).length === 0, `${nom} : Lucien peut vider le cache`);
}
const cassé = creerCacheJeux({ backend: { lire: async () => { throw new Error("quota"); }, ecrire: async () => { throw new Error("quota"); }, retirer: async () => {}, cles: async () => { throw new Error("quota"); } } });
ok((await cassé.noter(verifierJeu(brut()))) === null && (await cassé.lire("x")) === null && (await cassé.liste()).length === 0, "un stockage en panne ne casse rien : le cache répond « rien »");
const alt = backendMemoire(); const Ca = creerCacheJeux({ backend: alt }); const cl = await Ca.noter(verifierJeu(brut())); const en = await alt.lire(cl); en.jeu.lignes[0][1] = "x"; await alt.ecrire(cl, en);
ok((await Ca.lire(cl)) === null, "un cache altéré est refusé (jeu re-vérifié), pas affiché");
const gros = verifierJeu(brut({ lignes: Array.from({ length: 20000 }, (_, i) => [`${1000 + (i % 9000)}`, i * 1.123456789]) })); ok((await creerCacheJeux({ backend: backendMemoire() }).noter(gros)) === null, "un jeu de plus de 300 Ko n'est pas gardé en cache");
ok(backendIDB(null) === null, "sans IndexedDB : pas de backend (le Noyau retombe sur la mémoire)");

// ===== 2. Provenance d'un jeu calculé
const jx = creerJeux(); const a = jx.deposer(brut(), { origine: { source: "dbnomics", identifiant: "INSEE/POP/V", debut: "2000", fin: "" } });
const b = jx.deposer(brut(), { origine: { de: a.ref, operation: "periode", debut: "2005" } }); const c2 = jx.deposer(brut(), { origine: { de: b.ref, operation: "variation", mode: "depuis_debut" } });
let p = provenanceDe((r) => jx.origine(r), c2.ref); ok(p.racine.identifiant === "INSEE/POP/V" && p.etapes.length === 2 && p.etapes[0].operation === "periode" && p.etapes[1].mode === "depuis_debut" && p.reconstructible, "provenance : série d'origine + opérations dans l'ordre");
const d = jx.deposer(brut(), { origine: { de: a.ref, operation: "comparer" } }); ok(provenanceDe((r) => jx.origine(r), d.ref).reconstructible === false, "une comparaison n'est pas rejouée à l'aveugle");
ok(provenanceDe((r) => jx.origine(r), "jeu:inconnu1").racine === null, "origine inconnue : pas de provenance inventée");

// ===== 3. Sessions : anneau de 30, aucun texte de Lucien, réglage de coupure
const kv = new Map(); const stockage = { tout: async (c) => (c === "kv" ? [...kv.values()].map((x) => structuredClone(x)) : []), lire: async (c, id) => (kv.has(id) ? structuredClone(kv.get(id)) : undefined), ecrire: async (c, o) => { kv.set(o.id, structuredClone(o)); } };
const jeux = creerJeux(); const cacheS = creerCacheJeux({ backend: backendMemoire(), maintenant: () => t });
let reglages = {}; const S = creerSessions({ stockage, jeux, cache: cacheS, reglage: (k, d) => (k in reglages ? reglages[k] : d), maintenant: () => t });
const lirePlan = (n) => { const x = jeux.deposer(brut({ titre: "Série " + n, lignes: [["2000", n]] }), { origine: { source: "dbnomics", identifiant: "INSEE/S/" + n } }); const ap = [{ nom: "lire_serie", params: {} }, { nom: "afficher_module", params: {} }];
  const lg = [{ n: 1, nom: "lire_serie", ok: true, donnees: { jeu: x.ref } }, { n: 2, nom: "afficher_module", ok: true, params: { jeu: x.ref, vue: "courbe", titre: "Courbe " + n, y: "valeur" }, donnees: { affiche: true, jeu: x.ref } }]; lg.id = "plan-" + n; lg.bilan = { reussies: 2, en_echec: 0, refusees: 0, non_executees: 0 }; return { appels: ap, lignes: lg }; };
for (let i = 1; i <= 33; i++) { t = new Date(t.getTime() + 60000); await S.noterPlan(lirePlan(i)); }
const docs = [...kv.keys()].filter((k) => /^noyau-session-\d\d$/.test(k)); ok(docs.length === MAX_SESSIONS, `33 plans notés : ${MAX_SESSIONS} emplacements en anneau, aucun de plus (${docs.length})`);
const liste = await S.lister(); ok(liste.length === 30 && liste[0].id === "s33" && liste[29].id === "s4", "les plus récentes d'abord ; les 3 plus anciennes (s1 à s3) ont été réécrites");
const s33 = kv.get("noyau-session-02"); ok(s33.session_id === "s33" && s33.libelle === "Courbe 33" && s33.vue.type === "courbe" && s33.jeux.length === 1 && !JSON.stringify(s33).includes("Lis ") , "session : libellé public, vue, jeu (provenance), sans demande");
ok(!("demande" in s33) && !("lignes" in s33) && !JSON.stringify(s33).includes('"lignes"'), "la session ne contient ni texte de Lucien ni donnée chiffrée");
ok(JSON.stringify(kv.get("noyau-session-00").jeux[0].provenance.racine) === JSON.stringify({ source: "dbnomics", identifiant: "INSEE/S/31", debut: "", fin: "" }), "provenance gardée : source et identifiant (de quoi relire la série)");
reglages["noyau-sessions"] = "off"; ok((await S.noterPlan(lirePlan(99))) === null && (await S.lister())[0].id === "s33", "réglage « noyau-sessions » = off : rien n'est noté");
reglages = {}; ok((await S.noterPlan({ appels: [{ nom: "heure", params: {} }], lignes: Object.assign([{ n: 1, nom: "heure", ok: true, donnees: { heure: "x" } }], { id: "p" }) })) === null, "un plan sans jeu ni module n'est pas noté");
// reprise (jeux vidés = rechargement)
const jeux2 = creerJeux(); const S2 = creerSessions({ stockage, jeux: jeux2, cache: cacheS, maintenant: () => t });
const rp = await S2.reprendre("s33"); ok(rp.jeux.length === 1 && rp.jeux[0].du_cache && !rp.jeux[0].perime && /^jeu:/.test(rp.jeux[0].ref) && jeux2.lire(rp.jeux[0].ref).lignes[0][1] === 33, "reprise : le jeu revient du cache sous une NOUVELLE référence");
ok(rp.vue.type === "courbe" && rp.vue.jeu === rp.jeux[0].ref && rp.vue.options.y === "valeur" && rp.manquants.length === 0, "la vue est rendue avec la nouvelle référence");
t = new Date(t.getTime() + 30 * 3600000); const rp2 = await S2.reprendre("s33"); ok(rp2.jeux[0].perime === true && rp2.jeux[0].age_h >= 30, "30 h plus tard : repris mais dit périmé, avec son âge");
const S3 = creerSessions({ stockage, jeux: creerJeux(), cache: creerCacheJeux({ backend: backendMemoire() }), maintenant: () => t });
const rp3 = await S3.reprendre("s33"); ok(rp3.jeux.length === 0 && rp3.manquants.length === 1 && /lire_serie \(source dbnomics, identifiant INSEE\/S\/33/.test(rp3.manquants[0].comment) && rp3.vue.jeu === null, "cache vide : le jeu manquant est listé avec la façon de le relire, rien n'est inventé");
await leve(() => S2.reprendre("s999"), /Session inconnue/, "session inconnue : refus clair");

// ===== 4. Espaces de travail
ok(verifierEspace({ id: "economie", titre: "Économie", modules: ["pop-france", "pib"] }).modules.length === 2, "un espace valide");
await leve(async () => verifierEspace({ id: "x", titre: "T", modules: ["a"] }), /identifiant/, "identifiant d'espace invalide refusé");
await leve(async () => verifierEspace({ id: "eco", titre: "<b>T</b>", modules: ["ab"] }), /titre/, "titre avec balise refusé");
await leve(async () => verifierEspace({ id: "eco", titre: "T", modules: Array.from({ length: 13 }, (_, i) => "mod-" + i) }), /de 1 à 12/, "12 modules au plus par espace");
await leve(async () => verifierEspace({ id: "eco", titre: "T", modules: ["ab"], code: "x" }), /champ inconnu/, "champ inconnu refusé");
const Mo = creerModules({ stockage: { ...stockage, retirerMany: async (c, ids) => ids.forEach((i) => kv.delete(i)) } });
const stockageRetire = { ...stockage, retirerMany: async (c, ids) => ids.forEach((i) => kv.delete(i)) };
await Mo.enregistrer({ id: "pop-france", titre: "Pop", vue: "courbe", jeu: verifierJeu(brut()) }); await Mo.enregistrer({ id: "pib", titre: "PIB", vue: "barres", jeu: verifierJeu(brut({ titre: "PIB" })) });
const G = creerGestesLucien({ stockage: stockageRetire, modules: Mo, maintenant: () => t });
await G.enregistrerEspace({ id: "economie", titre: "Économie", modules: ["pop-france", "pib"], note: "Mes deux courbes" });
await leve(() => G.enregistrerEspace({ id: "fantome", titre: "Fantôme", modules: ["inconnu-1"] }), /n'existe pas/, "un espace ne peut citer qu'un module existant");
const E = creerEspaces({ stockage }); ok((await E.lister()).length === 1 && (await E.lire("economie")).modules.join() === "pop-france,pib", "lister et lire un espace (lecture seule pour le Noyau)");
await leve(() => E.lire("inconnu"), /Espace inconnu/, "espace inconnu : refus clair");
for (let i = 0; i < 12; i++) await G.enregistrerEspace({ id: "e-" + i, titre: "E" + i, modules: ["pib"] }).catch(() => {});
ok((await E.lister()).length === 10, "10 espaces au plus");
await G.retirerEspace("e-0"); ok(kv.has("noyau-corbeille-espace-e-0") && !kv.has("noyau-espace-e-0"), "retirer un espace : sauvegarde AVANT (geste de Lucien)");

// ===== 5. Bout en bout : un plan, un « rechargement », la reprise par l'outil lire_modules (aucun réseau)
bases.clear(); kv.clear();
let reseau = 0; const dbn = (nom) => ({ series: { docs: [{ series_name: nom, period: ["2000", "2005", "2010", "2015"], value: [100, 110, 120, 130], indexed_at: "2026-10-20T10:00:00Z" }] } });
const hub = creerHubSimule({ vide: true, fetch: async () => { reseau++; return { ok: true, status: 200, json: async () => ({}), text: async () => JSON.stringify(dbn("Versailles")) }; } });
const affiches = []; hub.hote.ui.afficherComposant = (vue, jeu, o) => { affiches.push({ vue, o, lignes: jeu.lignes.length, titre: o.titre }); return { classList: { contains: () => false } }; };
let tour = 0; const script = [{ appels: [{ nom: "lire_serie", params: { source: "dbnomics", identifiant: "INSEE/POP/VERSAILLES" } }, { nom: "transformer_donnees", params: { jeu: "$1.jeu", operation: "periode", debut: "2005" } }, { nom: "afficher_module", params: { jeu: "$2.jeu", vue: "courbe", titre: "Versailles depuis 2005" } }] }, { appels: [{ nom: "repondre", params: { texte: "Voici la courbe.", ton: "calme", confiance: "haute", sources: [] } }] }];
const n1 = await creerNoyau({ moteur: { nom: "simulé", generer: async () => { const s = script[tour++]; return { texte: "", appels: s.appels, brut: null, usage: { total: 10 }, ms: 1 }; } } });
await n1.poser("Montre-moi la population de Versailles depuis 2005, c'est pour mon rapport privé");
const sess = (await hub.hote.stockage.tout("kv")).filter((d) => /^noyau-session-/.test(d.id)); ok(sess.length === 1 && sess[0].libelle === "Versailles depuis 2005" && sess[0].etapes.length === 3 && sess[0].vue.type === "courbe", "le cycle de pensée a noté la session (libellé = titre de la vue)");
ok(!JSON.stringify(sess[0]).includes("rapport") && !JSON.stringify(sess[0]).includes("population de Versailles depuis 2005, c"), "le texte de la demande n'est PAS dans la session");
ok(sess[0].jeux.length === 2 && sess[0].jeux.some((j) => j.provenance.etapes.length === 1 && j.provenance.etapes[0].operation === "periode" && j.provenance.racine.identifiant === "INSEE/POP/VERSAILLES"), "2 jeux notés (série lue, période) avec leur provenance");
ok(bases.get("hub-noyau-jeux") && bases.get("hub-noyau-jeux").jeux.size >= 2, "le cache LOCAL (IndexedDB) contient les jeux ; ils ne sont pas dans « kv »");
ok(!(await hub.hote.stockage.tout("kv")).some((d) => JSON.stringify(d).includes("85800") || (d.id !== "noyau-journal" && d.lignes && d.id.startsWith("noyau-session") && JSON.stringify(d.lignes).includes("110"))), "aucune donnée chiffrée dans les documents synchronisés des sessions");
// --- rechargement : nouveau Noyau (nouvelle mémoire de jeux), même stockage et même cache local
const reseauAvant = reseau; const n2 = await creerNoyau({ moteur: { nom: "simulé", generer: async () => ({ texte: "", appels: [], usage: { total: 0 } }) } });
let r = await n2.barriere.executer({ outil: "lire_modules", params: {} }); ok(r.ok && r.donnees.sessions.length === 1 && r.donnees.sessions[0].id === "s1" && r.donnees.sessions[0].libelle === "Versailles depuis 2005", "après rechargement : lire_modules liste la session s1");
const dates = () => JSON.stringify([...bases.get("hub-noyau-jeux").jeux.values()].map((e) => e.requete_le).sort()); const datesAvant = dates();
r = await n2.barriere.executer({ outil: "lire_modules", params: { session: "s1" } });
ok(dates() === datesAvant, "la reprise ne rafraîchit PAS la date de requête gardée (un jeu repris n'est pas redevenu « frais »)");
ok(r.ok && r.donnees.reprise.jeux.length === 2 && r.donnees.reprise.manquants.length === 0 && reseau === reseauAvant, "reprise : 2 jeux remis en mémoire depuis le cache local, ZÉRO requête réseau");
const rv = r.donnees.reprise; ok(rv.vue.type === "courbe" && /^jeu:/.test(rv.vue.jeu) && rv.jeux.every((j) => j.du_cache && j.requete_le && j.resume.donnees_du === "2026-10-20"), "la vue conseillée et la date de requête de chaque jeu sont rendues");
ok(!JSON.stringify(rv).includes("\"lignes\":[") && rv.jeux[0].resume.jeu === rv.jeux[0].ref, "le modèle ne reçoit que des références et des résumés");
r = await n2.barriere.executer({ outil: "afficher_module", params: { jeu: rv.vue.jeu, vue: rv.vue.type, titre: rv.vue.titre } }); ok(r.ok && affiches.length === 2 && affiches[1].lignes === 3, "la vue est réaffichée avec les données du cache (3 lignes depuis 2005)");
r = await n2.barriere.executer({ outil: "lire_modules", params: { session: "s77" } }); ok(!r.ok && /Session inconnue/.test(r.erreur), "session inconnue : refus clair");
r = await n2.barriere.executer({ outil: "lire_modules", params: { session: "x;y" } }); ok(!r.ok, "identifiant de session mal formé refusé par le validateur");
bases.get("hub-noyau-jeux").jeux.clear(); const n3 = await creerNoyau({ moteur: { nom: "simulé", generer: async () => ({ texte: "", appels: [], usage: { total: 0 } }) } });
r = await n3.barriere.executer({ outil: "lire_modules", params: { session: "s1" } }); ok(r.ok && r.donnees.reprise.jeux.length === 0 && r.donnees.reprise.manquants.length === 2 && reseau === reseauAvant, "cache effacé : les 2 jeux sont dits manquants (et comment les relire), toujours aucune requête réseau");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
