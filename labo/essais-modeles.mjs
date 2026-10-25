// Laboratoire · essais de la gestion des modèles : `node labo/essais-modeles.mjs`
import { readFileSync } from "node:fs";
import { MODELES, formaterTaille, etatModeles, supprimerModele, telechargerModele, placeSuffisante } from "../js/noyau/modeles.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
// Faux Cache Storage
function fauxCaches(contenu) {
  const stock = new Map(Object.entries(contenu).map(([n, urls]) => [n, new Map(Object.entries(urls))]));
  const api = (nom) => ({ keys: async () => [...stock.get(nom).keys()].map((url) => ({ url })), match: async (req) => { const t = stock.get(nom).get(req.url); return t == null ? undefined : { headers: { get: () => String(t) }, clone() { return this; } }; }, delete: async (req) => stock.get(nom).delete(req.url) });
  return { keys: async () => [...stock.keys()], open: async (n) => api(n), _stock: stock };
}
const caches = fauxCaches({
  "webllm/model": { "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/params_shard_0.bin": 80000000, "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/params_shard_1.bin": 20000000 },
  "transformers-cache": { "https://huggingface.co/Xenova/whisper-tiny/resolve/main/onnx/encoder.onnx": 33000000 },
  "hub-1.2.3": { "https://lulu78440.github.io/hub/js/qwen2.5-0.5b-note.js": 1000 }          // le cache du hub ne doit JAMAIS être touché
});
let etat = await etatModeles({ caches });
const par = (id) => etat.find((m) => m.id === id);
ok(par("qwen-1.5b").telecharge && par("qwen-1.5b").octets === 100000000 && par("qwen-1.5b").tailleAffichee === "100 Mo", "modèle téléchargé : taille réelle additionnée (" + par("qwen-1.5b").tailleAffichee + ")");
ok(par("whisper-tiny").telecharge && par("whisper-tiny").tailleAffichee === "33 Mo", "Whisper reconnu dans le cache de la bibliothèque");
ok(!par("qwen-0.5b").telecharge && /^≈ /.test(par("qwen-0.5b").tailleAffichee), "modèle absent : taille annoncée à l'avance (« " + par("qwen-0.5b").tailleAffichee + " »)");
ok(!par("qwen-0.5b").telecharge, "le cache du hub n'est pas pris pour un modèle");
ok(formaterTaille(1.5e9) === "1,5 Go" && formaterTaille(40e6) === "40 Mo" && formaterTaille(NaN) === "taille inconnue", "formatage des tailles");
let n = await supprimerModele("qwen-1.5b", { caches });
ok(n === 2 && caches._stock.get("webllm/model").size === 0, "suppression : fichiers du modèle retirés (" + n + ")");
ok(caches._stock.get("hub-1.2.3").size === 1 && caches._stock.get("transformers-cache").size === 1, "suppression : le cache du hub et les autres modèles sont intacts");
etat = await etatModeles({ caches }); ok(!par("qwen-1.5b").telecharge, "après suppression : de nouveau « non téléchargé »");
let err = null; try { await supprimerModele("n-importe-quoi", { caches }); } catch (e) { err = e; } ok(!!err, "modèle inconnu refusé");
etat = await etatModeles({ caches: null }); ok(etat.every((m) => !m.telecharge), "Cache Storage absent : pas de plantage");

let charge = 0, message = null;
let r = await telechargerModele("whisper-tiny", { accord: async (i) => { message = i.message; return false; }, charger: async () => { charge++; } });
ok(!r.fait && charge === 0 && /40 Mo/.test(message), "refus de Lucien : rien ne part ; la fenêtre annonce la taille (« …40 Mo… »)");
r = await telechargerModele("whisper-tiny", { charger: async () => { charge++; } });
ok(!r.fait && charge === 0, "sans fenêtre d'accord : rien ne part");
r = await telechargerModele("whisper-tiny", { accord: async () => "oui peut-être", charger: async () => { charge++; } });
ok(!r.fait && charge === 0, "seule la réponse « vrai » vaut accord");
const prog = [];
r = await telechargerModele("whisper-tiny", { accord: async () => true, charger: async (m, p) => { charge++; p("Téléchargement", 0.25); p("Téléchargement", 7); }, surProgres: (x) => prog.push(x) });
ok(r.fait && charge === 1 && prog.length === 2 && prog[0].part === 0.25 && prog[1].part === 1 && prog[0].tailleTotale === "40 Mo", "accord : progression avec barre bornée et taille totale");
ok(await placeSuffisante(1000, { storage: { estimate: async () => ({ quota: 5e9, usage: 1e9 }) } }) === true && await placeSuffisante(4000, { storage: { estimate: async () => ({ quota: 5e9, usage: 3e9 }) } }) === false, "avertissement si la place manque");
// Le service worker ne doit pas garder les modèles (autres sites ignorés)
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
ok(/url\.origin !== self\.location\.origin\) return/.test(sw), "sw.js ignore les autres sites : les modèles ne passent pas par son cache");
ok(MODELES.filter((m) => !/^à vérifier/.test(m.licence)).every((m) => ["Apache-2.0", "MIT"].includes(m.licence)) && MODELES.filter((m) => /^à vérifier/.test(m.licence)).map((m) => m.id).join() === "piper-siwis", "licences : MIT ou Apache pour tous, sauf la voix Piper marquée « à vérifier » (lab-veille-os)");
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
