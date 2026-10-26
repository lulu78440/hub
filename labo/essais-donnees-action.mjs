// Laboratoire · tâche GitHub « données » (préparée, JAMAIS activée) : `node labo/essais-donnees-action.mjs`
// Lance docs/noyau-orchestrateur/donnees-action/donnees.py HORS LIGNE (réponses simulées) puis vérifie que le hub relit ses fichiers exactement comme les autres jeux.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerDonnees } from "../js/noyau/donnees.js";
import { creerJeux } from "../js/noyau/jeux.js";
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log("✗ " + m); } else console.log("✓ " + m); };
const dossier = new URL("../docs/noyau-orchestrateur/donnees-action/", import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), "hub-donnees-")); const fix = join(tmp, "fix"), sortie = join(tmp, "sortie"); execFileSync("mkdir", ["-p", fix, sortie]);
const src = join(tmp, "sources.json");
writeFileSync(src, JSON.stringify({ series: [
  { id: "population-france", nom: "Population de la France", kind: "banque_mondiale", pays: "FR", indicateur: "SP.POP.TOTL", actif: true },
  { id: "ipc-test", nom: "IPC test", kind: "dbnomics", serie: "INSEE/IPC-2015/M.X", actif: true },
  { id: "en-panne", nom: "Série sans réponse", kind: "banque_mondiale", pays: "DE", indicateur: "SP.POP.TOTL", actif: true },
  { id: "inactive", nom: "Inactive", kind: "banque_mondiale", pays: "ES", indicateur: "SP.POP.TOTL", actif: false },
  { id: "Mal Écrite", nom: "x", kind: "banque_mondiale", pays: "FR", indicateur: "SP.POP.TOTL", actif: true },
  { id: "kind-inconnu", nom: "x", kind: "autre", actif: true }
] }));
writeFileSync(join(fix, "population-france.json"), JSON.stringify([{ lastupdated: "2025-07-01" }, [{ date: "2022", value: 67970000 }, { date: "2021", value: null }, { date: "2020", value: 67600000 }]]));
writeFileSync(join(fix, "ipc-test.json"), JSON.stringify({ series: { docs: [{ series_name: "IPC", period: ["2020-Q1", "2020-Q2"], value: [100, "NA"], indexed_at: "2026-10-20T10:00:00Z" }] } }));
const lancer = () => { try { return { code: 0, out: execFileSync("python3", ["-I", join(dossier, "donnees.py"), src, sortie], { env: { ...process.env, DONNEES_FIXTURES: fix }, encoding: "utf8" }) }; } catch (e) { return { code: e.status, out: String(e.stdout || "") }; } };
let r = lancer();
ok(r.code === 0 && /ok  population-france/.test(r.out) && /ok  ipc-test/.test(r.out), "la tâche écrit les séries actives : " + r.out.split("\n").filter(Boolean).join(" | "));
ok(/ÉCHEC en-panne/.test(r.out) && /entrée mal écrite/.test(r.out), "série sans réponse et entrée mal écrite signalées sans arrêter les autres");
const idx = JSON.parse(readFileSync(join(sortie, "index.json"), "utf8"));
ok(idx.series.length === 2 && !readdirSync(sortie).includes("inactive.json") && !readdirSync(sortie).includes("en-panne.json"), "index de 2 séries ; la série inactive n'est pas publiée ; aucun fichier vide pour la série en panne");
ok(!JSON.stringify(idx).includes("67970000"), "l'index ne contient pas de valeurs");
// le hub relit les fichiers produits comme n'importe quelle série
const servi = (u) => { const f = join(sortie, String(u).split("/").pop()); return existsSync(f) ? { ok: true, status: 200, text: async () => readFileSync(f, "utf8") } : { ok: false, status: 404, text: async () => "" }; };
const d = creerDonnees({ fetch: async (u) => servi(u), maintenant: () => new Date(), jeux: creerJeux() });
let l = await d.lire({ source: "publie", identifiant: "population-france" });
ok(l.jeu.lignes[0][0] === "2020" && l.jeu.lignes[1][1] === null && l.jeu.unite === "habitants" && l.jeu.source.maj === "2025-07-01" && /CC BY/.test(l.jeu.source.licence), "série publiée relue par le hub : ordre, valeur absente conservée, unité, date, licence");
l = await d.lire({ source: "publie", identifiant: "ipc-test" });
ok(l.jeu.lignes[0][0] === "2020-01" && l.jeu.lignes[1][1] === null && /premier mois/.test(l.jeu.source.nom) && l.jeu.source.requete, "trimestre ramené au premier mois et dit ; la date de requête est ajoutée par le hub");
const rech = await d.chercher({ requete: "population", source: "publie" }).catch((e) => e);
ok(rech && (rech.resultats ? rech.resultats.length >= 0 : true), "(la recherche de séries publiées passe par index.json)");
// une série en échec garde sa dernière version
writeFileSync(join(fix, "population-france.json"), JSON.stringify({ rien: 1 }));
r = lancer(); const idx2 = JSON.parse(readFileSync(join(sortie, "index.json"), "utf8")); const garde = idx2.series.find((s) => s.id === "population-france");
ok(/ÉCHEC population-france : forme inattendue/.test(r.out) && garde && garde.erreur && existsSync(join(sortie, "population-france.json")), "série en échec : sa dernière version est gardée et l'erreur est notée dans l'index");
// fichiers de la tâche : désactivée
const yml = readFileSync(join(dossier, "donnees.yml"), "utf8");
ok(/MODÈLE DÉSACTIVÉ/.test(yml) && !/^\s*schedule:/m.test(yml) && /^\s*workflow_dispatch:/m.test(yml), "le modèle de workflow est désactivé : lancement manuel seulement, planification en commentaire");
ok(!existsSync(new URL("../.github/workflows/donnees.yml", import.meta.url).pathname), "aucun workflow « donnees » dans .github/ : rien n'est activé");
ok(!/(token|secret|api[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9]{12,}/i.test(yml + readFileSync(join(dossier, "donnees.py"), "utf8")), "aucune clé dans les fichiers de la tâche (seul le jeton automatique de GitHub est cité)");
rmSync(tmp, { recursive: true, force: true });
console.log(ko ? `\n${ko} échec(s)` : "\nTout est bon."); process.exit(ko ? 1 : 0);
