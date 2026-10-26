// Laboratoire · essais de la dictée locale (parties sans micro) et du tableau de performance : `node labo/essais-voix-perf.mjs`
import { reechantillonner, decouperAudio, estSilence, fusionnerTextes, dicter, rms, FREQ_WHISPER } from "../js/noyau/voix-locale.js";
import { creerMesures, lireMateriel, conseil } from "../js/noyau/perf.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const sinus = (sec, freq, f = 440, amp = 0.5) => Float32Array.from({ length: Math.floor(sec * freq) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / freq));
// --- voix ---
let r = reechantillonner(sinus(1, 48000), 48000);
ok(r.length === 16000 && Math.abs(rms(r) - 0.5 / Math.SQRT2) < 0.02, "48 kHz → 16 kHz : 1 s reste 1 s, énergie conservée");
ok(reechantillonner(new Float32Array(0), 44100).length === 0 && reechantillonner(null, 44100).length === 0, "audio vide : pas de plantage");
ok(reechantillonner(sinus(1, 16000), 16000).length === 16000, "déjà à 16 kHz : inchangé");
ok(estSilence(new Float32Array(16000)) && estSilence(sinus(1, 16000, 440, 0.001)) && !estSilence(sinus(1, 16000)), "silence détecté, parole non");
const long = new Float32Array(16000 * 60); long.set(sinus(30, 16000), 0); long.set(sinus(30, 16000), 16000 * 30);
for (let i = 16000 * 24.5; i < 16000 * 25; i++) long[Math.floor(i)] = 0;                 // un creux de 0,5 s avant la limite de 25 s
const m = decouperAudio(long); const total = m.reduce((s, x) => s + x.length, 0);
ok(total === long.length && m.every((x) => x.length <= 16000 * 25), "60 s coupées en morceaux de 25 s au plus, sans perdre un échantillon (" + m.length + " morceaux)");
ok(m[0].length >= 16000 * 24.5 && m[0].length <= 16000 * 25, "la coupe tombe dans le creux (" + (m[0].length / 16000).toFixed(2) + " s)");
ok(decouperAudio(sinus(5, 16000)).length === 1, "un court enregistrement reste d'un seul morceau");
ok(fusionnerTextes(["Bonjour Lucien comment", "comment vas-tu aujourd'hui"]) === "Bonjour Lucien comment vas-tu aujourd'hui", "la jonction ne répète pas le mot coupé en deux");
ok(fusionnerTextes(["", "  Salut ", null, "toi"]) === "Salut toi", "morceaux vides ignorés");
const vus = []; let dict = await dicter({ donnees: sinus(60, 16000), freq: 16000, transcrire: async (p) => "morceau" + (vus.push(p.length)), surPartiel: () => {} });
ok(!dict.silence && vus.length === 3 && /morceau1 morceau2 morceau3/.test(dict.texte), "dictée longue : un texte par morceau, recollé dans l'ordre");
let appels = 0; dict = await dicter({ donnees: new Float32Array(32000), freq: 16000, transcrire: async () => { appels++; return "texte inventé"; } });
ok(dict.silence && dict.texte === "" && appels === 0, "enregistrement muet : le modèle n'est même pas lancé (il inventerait du texte)");
const ac = new AbortController(); appels = 0;
dict = await dicter({ donnees: sinus(60, 16000), freq: 16000, signal: ac.signal, transcrire: async () => { if (++appels === 1) ac.abort(); return "un"; } });
ok(appels === 1 && dict.texte === "un", "arrêt de la dictée en cours : les morceaux suivants ne sont pas traités");
// --- Whisper dans le worker (backend simulé) ---
import { traiter } from "../js/noyau/worker-ia.js";
const sortie = []; const etatW = { backends: new Map(), annules: new Set() }; let charges = 0;
const chargeurs = { whisper: async ({ surProgres }) => { charges++; surProgres("Téléchargement", 0.5); return { transcrire: async (a) => "entendu " + a.length }; } };
await traiter({ id: 1, type: "transcrire", audio: new Float32Array(160) }, { envoyer: (x) => sortie.push(x), etat: etatW, chargeurs });
await traiter({ id: 2, type: "transcrire", audio: new Float32Array(320) }, { envoyer: (x) => sortie.push(x), etat: etatW, chargeurs });
ok(sortie.filter((x) => x.type === "fin").map((x) => x.texte).join("|") === "entendu 160|entendu 320" && charges === 1 && sortie.some((x) => x.type === "progres"), "Whisper dans le worker : chargé une seule fois, progression remontée");
const sortie2 = []; await traiter({ id: 3, type: "transcrire", audio: new Float32Array(1) }, { envoyer: (x) => sortie2.push(x), etat: { backends: new Map(), annules: new Set() }, chargeurs: { whisper: async () => { throw new Error("modèle introuvable"); } } });
ok(sortie2[0].type === "erreur" && /introuvable/.test(sortie2[0].message), "échec du chargement : erreur claire, le clavier reste disponible");
// --- perf ---
let t = 0; const mes = creerMesures({ maintenant: () => t });
let h = mes.debut({ mode: "webgpu", modele: "qwen-0.5b" }); t = 400; h.mot(); t = 500; h.mot(); t = 600; h.mot(); t = 800; h.mot(); const l1 = h.fin();
ok(l1.ms_premier_mot === 400 && l1.mots === 4 && l1.mots_par_s === 7.5 && l1.ms_total === 800, "mesure : premier mot 400 ms, 7,5 mots/s : " + JSON.stringify([l1.ms_premier_mot, l1.mots_par_s]));
t = 0; h = mes.debut({ mode: "wasm" }); t = 100; const l2 = h.fin({ erreur: "plantage" });
ok(l2.mots_par_s === null && l2.ms_premier_mot === null && l2.erreur === "plantage", "réponse sans mot : vitesses « non disponibles », jamais inventées");
const res = mes.resume(); ok(res.webgpu.reponses === 1 && res.wasm.erreurs === 1 && res.wasm.mots_par_s === null, "résumé par mode");
const lent = creerMesures({ maintenant: () => t }); t = 0; const hl = lent.debut({ mode: "wasm" }); t = 100; hl.mot(); t = 1100; hl.mot(); t = 1500; hl.fin();
ok(conseil(lent.resume(), { batterie_pct: 10, en_charge: false }).length === 2 && conseil(lent.resume(), { batterie_pct: 10, en_charge: false }).join(" ").includes("lent"), "conseil : mode lent et batterie faible signalés");
ok(conseil({}, { batterie_pct: null }).some((x) => /non mesurée/.test(x)), "batterie masquée par le navigateur : dit « non mesurée »");
let mat = await lireMateriel({ nav: { deviceMemory: 8, getBattery: async () => ({ level: 0.42, charging: true }), storage: { estimate: async () => ({ usage: 52428800, quota: 10485760000 }) } }, perf: { memory: { usedJSHeapSize: 104857600 } } });
ok(mat.batterie_pct === 42 && mat.en_charge && mat.memoire_page_mo === 100 && mat.stockage_utilise_mo === 50, "matériel : batterie, mémoire et stockage lus");
mat = await lireMateriel({ nav: { getBattery: async () => { throw new Error("masquée"); } }, perf: {} });
ok(mat.batterie_pct === null && mat.memoire_page_mo === null && mat.memoire_appareil_go === null, "tout masqué : « non disponible » partout, sans plantage");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
