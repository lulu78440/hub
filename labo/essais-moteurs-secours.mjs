// Laboratoire · essais des IA de secours en ligne (Groq, OpenRouter, Mistral) et de la chaîne de secours : `node labo/essais-moteurs-secours.mjs`
// Réseau entièrement simulé : aucun service réel n'est appelé. Les clés sont des chaînes FACTICES évidentes.
import { readFileSync } from "node:fs";
import { creerHubSimule } from "./hub-simule.js";
import { creerNoyau } from "../js/noyau/noyau.js";
import { hote } from "../js/noyau/hote.js";
import { moteurService, moteurCompatibleOpenAI, masquerCle, lireOrdreSecours, ORDRE_SECOURS_DEFAUT, SERVICES_SECOURS, ErreurNoyau } from "../js/noyau/moteurs.js";
import { badgeReponse } from "../js/noyau/ia-regles.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };

const CLES = { gemini: "AIza-FACTICE-gemini-0000", claude: "sk-ant-FACTICE-claude-0000", groq: "gsk_FACTICEgroq0000", openrouter: "sk-or-FACTICE-openrouter-0000", mistral: "FACTICE-mistral-0000" };
const toutesCles = Object.values(CLES);
const contientCle = (t) => toutesCles.some((k) => String(t).includes(k));

// Journaux de la console capturés : aucune clé ne doit y apparaître.
const journaux = []; for (const n of ["log", "warn", "error", "info"]) { const o = console[n].bind(console); console[n] = (...a) => { journaux.push(a.map(String).join(" ")); if (n === "log") o(...a); }; }

// ---------- Réseau simulé ----------
const appels = []; const comportement = { gemini: "ok", claude: "429", groq: "ok", openrouter: "ok", mistral: "ok" };
const repondre = (texte) => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "repondre", arguments: JSON.stringify({ texte, ton: "calme", confiance: "moyenne", sources: [] }) } }] } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } });
const service = (u) => (u.includes("generativelanguage") ? "gemini" : u.includes("api.anthropic.com") ? "claude" : u.includes("api.groq.com") ? "groq" : u.includes("openrouter.ai") ? "openrouter" : u.includes("api.mistral.ai") ? "mistral" : "autre");
const fetchFictif = (u, o = {}) => {
  u = String(u); const s = service(u), h = o.headers || {}; appels.push({ s, url: u, h, corps: o.body ? JSON.parse(o.body) : null });
  const mode = comportement[s] || "ok";
  if (mode === "reseau") return Promise.reject(new TypeError("Failed to fetch"));
  if (mode === "pend") return new Promise((_, ko2) => { if (o.signal) o.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; ko2(e); }); });
  if (mode === "429") return Promise.resolve({ ok: false, status: 429, json: async () => ({ error: { message: "rate limit" } }) });
  if (mode === "401") return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid API Key: " + (h.authorization || h["x-goog-api-key"] || "") } }) });
  if (mode === "400") return Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: "bad request for key " + (h.authorization || "") } }) });
  if (s === "gemini") return Promise.resolve({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "repondre", args: { texte: "Réponse de Gemini.", ton: "calme", confiance: "moyenne", sources: [] } } }] } }], usageMetadata: { totalTokenCount: 50 } }) });
  if (s === "autre") return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  return Promise.resolve({ ok: true, status: 200, json: async () => repondre("Réponse de " + s + ".") });
};
const remettre = () => { Object.keys(comportement).forEach((k) => { comportement[k] = k === "claude" ? "429" : "ok"; }); };

// ---------- 1. Adaptateur générique : format de requête, en-têtes, lecture de la réponse ----------
creerHubSimule({ vide: true, fetch: fetchFictif });
const outils = [{ nom: "repondre", description: "Répond", params: { type: "object", properties: { texte: { type: "string" } }, required: ["texte"] } }];
const entree = { systeme: "SYS", messages: [{ role: "user", texte: "Bonjour" }], outils };
let m = moteurService({ id: "groq", cle: CLES.groq, racine: "http://hub.test/" }); let r = await m.generer(entree); let a = appels.at(-1);
ok(a.url === "https://api.groq.com/openai/v1/chat/completions" && a.h.authorization === "Bearer " + CLES.groq && a.h["content-type"] === "application/json", "Groq : bonne adresse, clé dans l'en-tête Authorization seulement");
ok(!a.url.includes(CLES.groq) && !JSON.stringify(a.corps).includes(CLES.groq), "Groq : la clé n'est ni dans l'adresse ni dans le corps");
ok(a.corps.model === "openai/gpt-oss-120b" && a.corps.messages[0].role === "system" && a.corps.messages[0].content === "SYS" && a.corps.messages[1].content === "Bonjour", "Groq : modèle gratuit par défaut, message système puis question");
ok(a.corps.tools[0].type === "function" && a.corps.tools[0].function.name === "repondre" && a.corps.tool_choice === "required", "Groq : outils au format function, choix d'outil obligatoire");
ok(r.appels.length === 1 && r.appels[0].nom === "repondre" && r.appels[0].params.texte === "Réponse de groq." && r.usage.total === 120, "Groq : réponse lue (appel d'outil, arguments JSON, jetons)");
ok(m.type === "secours" && m.service === "Groq" && !m.entrainement, "Groq : moteur de type « secours », sans entraînement");
m = moteurService({ id: "openrouter", cle: CLES.openrouter, racine: "http://hub.test/" }); await m.generer(entree); a = appels.at(-1);
ok(a.url === "https://openrouter.ai/api/v1/chat/completions" && a.h["HTTP-Referer"] === "http://hub.test/" && a.h["X-Title"] && a.h.authorization === "Bearer " + CLES.openrouter, "OpenRouter : adresse, en-têtes HTTP-Referer et X-Title, clé Bearer");
ok(/:free$/.test(a.corps.model), "OpenRouter : modèle « :free » par défaut (" + a.corps.model + ")");
m = moteurService({ id: "mistral", cle: CLES.mistral }); await m.generer({ ...entree, forcer: null }); a = appels.at(-1);
ok(a.url === "https://api.mistral.ai/v1/chat/completions" && a.corps.tool_choice === "any" && m.entrainement === true, "Mistral : adresse, tool_choice « any », marqué « peut servir à l'entraînement »");
await m.generer({ ...entree, forcer: ["repondre"] }); a = appels.at(-1);
ok(a.corps.tool_choice && a.corps.tool_choice.function && a.corps.tool_choice.function.name === "repondre", "outil forcé : tool_choice nommé");
r = await moteurCompatibleOpenAI({ nom: "Test", url: "https://api.groq.com/openai/v1/chat/completions", cle: CLES.groq, modele: "x" }).generer({ systeme: "S", messages: [{ role: "user", texte: "q" }] });
ok(r.appels.length === 1, "adaptateur générique utilisable seul");

// ---------- 2. Erreurs : codes, clé jamais dans le message ----------
const erreur = async (mode, opts = {}) => { comportement.groq = mode; try { await moteurService({ id: "groq", cle: CLES.groq, ...opts }).generer(entree); return null; } catch (e) { return e; } finally { remettre(); } };
let e = await erreur("429"); ok(e instanceof ErreurNoyau && e.code === "quota", "429 → code « quota »");
e = await erreur("401"); ok(e && e.code === "cle" && !contientCle(e.message), "401 → code « cle », message sans la clé (le service la renvoyait)");
e = await erreur("reseau"); ok(e && e.code === "reseau" && /CORS/.test(e.message), "erreur réseau → code « reseau » (mentionne le CORS possible)");
e = await erreur("pend", { delaiMax: 40 }); ok(e && e.code === "delai", "délai dépassé → code « delai »");
e = await erreur("400"); ok(e && e.code === "http" && !contientCle(e.message), "400 → code « http » (pas de secours), message nettoyé de la clé : " + (e && e.message));
ok(masquerCle("Invalid key gsk_abcdef123456 and sk-or-v1-zzzzzz9") === "Invalid key [clé masquée] and [clé masquée]", "masquerCle retire les formes de clé connues");
e = null; try { await moteurService({ id: "groq", cle: null }).generer(entree); } catch (x) { e = x; } ok(e && e.code === "cle", "sans clé → code « cle »");
hote.enLigne = () => false; e = null; try { await moteurService({ id: "groq", cle: CLES.groq }).generer(entree); } catch (x) { e = x; } ok(e && e.code === "hors_ligne", "hors ligne → code « hors_ligne », aucune requête");

// ---------- 3. Ordre de secours ----------
ok(ORDRE_SECOURS_DEFAUT.join(">") === "gemini>claude>relais>groq>openrouter>mistral>local>sans-ia", "ordre par défaut : Gemini → Claude → relais → Groq → OpenRouter → Mistral → IA locale → sans IA");
ok(lireOrdreSecours("mistral, groq, inconnu, groq").join(",") === "mistral,groq,sans-ia" && lireOrdreSecours("").length === 8, "ordre réglé : identifiants connus, sans doublon, « sans-ia » toujours à la fin");

// ---------- 4. Chaîne complète dans le Noyau ----------
const hS = creerHubSimule({ vide: true, cle: CLES.gemini, clesServices: { groq: CLES.groq, openrouter: CLES.openrouter, mistral: CLES.mistral }, fetch: fetchFictif });
hS.hote.reglage.ecrire("noyau-delai-secours", "150");
const n = await creerNoyau({ delaiConfirmation: 50 });
const s0 = n.statut();
ok(/Auto/.test(s0.moteur) && /Groq/.test(s0.moteur) && /OpenRouter/.test(s0.moteur) && !/Mistral/.test(s0.moteur), "clés de secours présentes : mode Auto, Groq et OpenRouter dans la chaîne, Mistral absent (désactivé par défaut) : " + s0.moteur);
const svc = Object.fromEntries(s0.secours.services.map((x) => [x.id, x]));
ok(svc.groq.page === "https://console.groq.com/keys" && svc.openrouter.page === "https://openrouter.ai/keys" && /console\.mistral\.ai/.test(svc.mistral.page) && s0.secours.services.every((x) => x.limite.length > 20), "statut : page de création de clé et limite gratuite pour chaque service");
ok(svc.mistral.cle && !svc.mistral.autorise && svc.mistral.entrainement, "Mistral : clé présente mais désactivé tant que Lucien ne l'active pas");

const poser = async (q) => { const avant = appels.length, t0 = hS.toasts.length; const rep = await n.poser(q); return { rep, faits: appels.slice(avant), toasts: hS.toasts.slice(t0) }; };
let x = await poser("Dis bonjour.");
ok(x.faits.length === 1 && x.faits[0].s === "gemini" && /Gemini/.test(x.rep.texte), "tout va bien : Gemini répond seul, aucun service de secours appelé");
ok(x.rep.badges && x.rep.badges[0] === "En ligne · Gemini", "badge honnête : « En ligne · Gemini »");

comportement.gemini = "401"; x = await poser("Dis bonjour encore.");
ok(x.faits.map((f) => f.s).join(">") === "gemini>groq" && /groq/.test(x.rep.texte), "clé Gemini refusée (401) → Groq répond");
ok(x.rep.badges.includes("En ligne · Groq") && x.rep.moteurs.includes("Groq"), "badge : « En ligne · Groq » (" + x.rep.badges + ")");
ok(x.toasts.some((t) => /Gemini : clé absente ou refusée/.test(t) && /Groq a répondu/.test(t)), "message clair à Lucien : quel moteur a échoué et lequel a répondu (" + x.toasts.join(" | ") + ")");
ok(x.rep.secours && x.rep.secours.repondu === "Groq", "la réponse garde la trace du secours");

comportement.groq = "429"; x = await poser("Et maintenant ?");
ok(x.faits.map((f) => f.s).join(">") === "gemini>groq>openrouter" && x.rep.badges.includes("En ligne · OpenRouter"), "Groq en quota (429) → OpenRouter répond");
comportement.groq = "reseau"; x = await poser("Encore une fois ?");
ok(x.faits.map((f) => f.s).join(">") === "gemini>groq>openrouter", "Groq en erreur réseau → OpenRouter répond");
comportement.groq = "pend"; const t1 = Date.now(); x = await poser("Toujours là ?");
ok(x.faits.map((f) => f.s).join(">") === "gemini>groq>openrouter" && Date.now() - t1 < 5000, "Groq muet (délai dépassé) → OpenRouter répond");
comportement.groq = "400"; x = await poser("Une demande mal formée ?");
ok(x.faits.map((f) => f.s).join(">") === "gemini>groq" && x.rep.reduit, "Groq répond 400 (ni réseau, ni quota, ni clé, ni délai) → PAS de secours, réponse sans IA");

comportement.groq = "429"; comportement.openrouter = "429"; x = await poser("Plus personne ?");
ok(!x.faits.some((f) => f.s === "mistral"), "Mistral désactivé : jamais appelé, même quand les autres échouent");
ok(x.rep.reduit && /Gemini : clé absente ou refusée/.test(x.rep.texte) && /Groq : quota atteint/.test(x.rep.texte) && /OpenRouter : quota atteint/.test(x.rep.texte), "tous en échec → réponse sans IA qui dit qui a échoué et pourquoi");

n.activerService("mistral", true); x = await poser("Et avec Mistral ?");
ok(x.faits.map((f) => f.s).join(">") === "gemini>groq>openrouter>mistral" && /mistral/.test(x.rep.texte), "Mistral activé par Lucien → il répond en dernier recours en ligne");
ok(x.rep.badges.includes("En ligne · peut servir à l'entraînement (Mistral)"), "badge Mistral : « En ligne · peut servir à l'entraînement » (" + x.rep.badges + ")");
n.activerService("mistral", false);
remettre(); comportement.gemini = "401";
n.definirOrdreSecours(["gemini", "openrouter", "groq", "mistral", "local"]); x = await poser("Ordre changé ?");
ok(x.faits.map((f) => f.s).join(">") === "gemini>openrouter", "ordre réglé (OpenRouter avant Groq) respecté");
ok(n.statut().secours.ordre.join(",") === "gemini,openrouter,groq,mistral,local,sans-ia", "ordre enregistré dans les réglages");
n.definirOrdreSecours([]); ok(n.statut().secours.ordre.join(">") === ORDRE_SECOURS_DEFAUT.join(">"), "« Ordre par défaut » rétablit l'ordre d'origine");

// Chaque clé ne part que vers son service
const fuite = appels.filter((f) => { const enTetes = JSON.stringify(f.h); return Object.entries(CLES).some(([s, k]) => s !== f.s && enTetes.includes(k)); });
ok(appels.length > 10 && !fuite.length, "aucune clé n'a été envoyée à un autre service (" + appels.length + " requêtes contrôlées)");
ok(appels.filter((f) => f.s !== "gemini").every((f) => f.h.authorization === "Bearer " + CLES[f.s]), "chaque service reçoit SA clé, et seulement dans Authorization");
ok(appels.every((f) => !contientCle(f.url)), "aucune clé dans une adresse");

// Comptage : chaque service a son propre plafond
ok(n.budgetsSecours.groq.utilisees() >= 4 && n.budgetsSecours.openrouter.utilisees() >= 3 && n.budget.utilisees() >= 1, "requêtes comptées par service (Groq " + n.budgetsSecours.groq.utilisees() + ", OpenRouter " + n.budgetsSecours.openrouter.utilisees() + ")");
n.budgetsSecours.groq.definirPlafond(1); remettre(); comportement.gemini = "401"; x = await poser("Plafond Groq ?");
ok(x.faits.map((f) => f.s).join(">") === "gemini>openrouter", "plafond du jour de Groq atteint → OpenRouter, sans requête à Groq");
remettre();

// Hors ligne : aucune requête, réponse sans IA (pas d'IA locale téléchargée dans Node)
const enLigneAvant = hote.enLigne; hote.enLigne = () => false; x = await poser("Hors ligne ?"); hote.enLigne = enLigneAvant;
ok(!x.faits.length && x.rep.reduit, "hors ligne : aucune requête, IA locale absente → réponse sans IA");

// Aucune clé dans les journaux, le journal des actions, les messages et les erreurs
const journalNoyau = JSON.stringify(await n.journal({ limite: 500 }));
const traces = JSON.stringify(n.inspecteur ? n.inspecteur() : "");
ok(!journaux.some(contientCle), "aucune clé dans les journaux de la console (" + journaux.length + " lignes)");
ok(!contientCle(journalNoyau) && !contientCle(traces) && !hS.toasts.some(contientCle), "aucune clé dans le journal du Noyau, l'inspecteur ni les messages à Lucien");
ok(!contientCle(JSON.stringify(n.statut())), "aucune clé dans le statut (seulement « clé présente : oui/non »)");

// Clé exigeant le verrouillage, liste fermée de services
let refus = null; try { n.definirCleService("autre", "x"); } catch (y) { refus = y; } ok(refus && /inconnu/.test(refus.message), "service inconnu refusé");
n.definirCleService("groq", null); ok(!n.statut().secours.services.find((s2) => s2.id === "groq").cle, "« Retirer la clé » efface la clé Groq");
const hP = creerHubSimule({ vide: true, cle: CLES.gemini, clesServices: { groq: CLES.groq }, fetch: fetchFictif }); hP.hote.secret.protege = () => false;
const nP = await creerNoyau(); comportement.gemini = "401"; const av = appels.length; const rp = await nP.poser("Coffre inactif ?");
ok(!appels.slice(av).some((f) => f.s === "groq") && rp.reduit, "coffre inactif : la clé Groq n'est pas utilisée (verrouillage exigé)");
remettre();

// Gemini → Claude → Groq : l'ordre par défaut traverse Claude avant les IA de secours
const hC = creerHubSimule({ vide: true, cle: CLES.gemini, cleClaude: CLES.claude, clesServices: { groq: CLES.groq }, fetch: fetchFictif });
const nC = await creerNoyau(); remettre(); comportement.gemini = "401"; const avC = appels.length; const rC = await nC.poser("Bonjour Claude ?");
ok(appels.slice(avC).map((f) => f.s).join(">") === "gemini>claude>groq" && rC.badges.includes("En ligne · Groq"), "Gemini refusé, Claude en limite (429) → Groq répond (ordre par défaut)");
ok(appels.slice(avC).find((f) => f.s === "claude").h["x-api-key"] === CLES.claude, "la clé Claude part chez Anthropic seulement");
remettre();

// ---------- 5. Badge, règles d'export et de verrouillage (lecture des sources) ----------
ok(badgeReponse({ moteur: { type: "secours", service: "Groq", nom: "Groq · x" } }).texte === "En ligne · Groq" && badgeReponse({ moteur: { type: "secours", service: "OpenRouter" } }).sortant === true, "badge des IA de secours : « En ligne · <service> », le contenu sort");
ok(badgeReponse({ moteur: { type: "secours", service: "Mistral", entrainement: true } }).texte === "En ligne · peut servir à l'entraînement (Mistral)", "badge Mistral dédié");
ok(badgeReponse({ moteur: { type: "libre", nom: "Mistral · m", entrainement: true } }).entrainement === true, "le relais réglé sur Mistral porte aussi l'avertissement");
const vault = readFileSync(new URL("../js/store/vault.js", import.meta.url), "utf8"), storage = readFileSync(new URL("../js/store/storage.js", import.meta.url), "utf8"), sync = readFileSync(new URL("../js/store/sync.js", import.meta.url), "utf8");
ok(/iaKey = \(k\) =>[^\n]*k\.startsWith\("hub-secret-ia-"\)/.test(vault), "vault.destroy : le préfixe hub-secret-ia-… est retiré avec le verrouillage");
ok(/isPrivate = \(k\) =>[^\n]*k\.startsWith\("hub-secret"\)/.test(vault), "coffre : les clés hub-secret-ia-… sont chiffrées (préfixe hub-secret)");
ok(/SKIP = \(k\) =>[^\n]*k\.startsWith\("hub-secret"\)/.test(storage), "export : tout hub-secret… est exclu des fichiers");
ok(/COLLS = \["notes", "tasks", "events", "favs", "kv"\]/.test(sync) && !/localStorage\.getItem\(k\)/.test(sync), "synchro : seules les collections partent, jamais les réglages ni les secrets");
const hoteSrc = readFileSync(new URL("../js/noyau/hote.js", import.meta.url), "utf8");
ok(/"hub-secret-ia-" \+ id/.test(hoteSrc) && /definirCleService[^\n]*vault\.active/.test(hoteSrc), "hôte réel : clés rangées sous hub-secret-ia-<service>, verrouillage exigé");
const src = readFileSync(new URL("../js/noyau/moteurs.js", import.meta.url), "utf8");
ok(!/gsk_[A-Za-z0-9]{20,}|sk-or-v1-[a-f0-9]{20,}/.test(src) && Object.values(SERVICES_SECOURS).every((s2) => s2.url.startsWith("https://")), "aucune clé dans le code, adresses en https");

// ---------- 6. Aucun nouvel outil ----------
const noms = n.barriere.presenter().map((o) => o.nom);
ok(!noms.some((nm) => /secours|groq|mistral|openrouter|moteur|cle/i.test(nm)), "aucun nouvel outil pour le Noyau (" + noms.length + " outils, inchangés)");

console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
