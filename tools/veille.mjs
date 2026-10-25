// Veille d'étude sur GitHub (tâche programmée) : étudie des sous-thèmes du programme du Noyau pendant que tous tes appareils dorment.
// Même liste fixe de sources publiques et même résumé local que dans le hub. AUCUNE clé, AUCUNE donnée personnelle : seuls les mots-clés du programme partent.
// Sortie : sortie/veille.json (publié sur la branche « veille »). Le hub le lit, si Lucien l'a accepté, et dépose les fiches dans « À valider ».
// Usage : node tools/veille.mjs sortie [nombre de sous-thèmes par passage]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PROGRAMME } from "../js/noyau/curriculum.js";
import { interroger } from "../js/noyau/sources.js";
import { resumerLocalement } from "../js/noyau/recherche.js";

const dossier = process.argv[2] || "sortie", PAR_PASSAGE = Math.min(Math.max(+process.argv[3] || 8, 1), 20), GARDE = 150;
mkdirSync(dossier, { recursive: true });
let avant = { curseur: 0, fiches: [] };
try { avant = JSON.parse(readFileSync(`${dossier}/veille.json`, "utf8")); } catch (e) { /* premier passage */ }

const tous = PROGRAMME.flatMap((d) => d.sousThemes.map((s) => ({ ...s, domaine: d })));
const get = async (u) => { const r = await fetch(u, { headers: { Accept: "application/json", "User-Agent": "hub-veille (github.com/lulu78440/hub)" }, signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
let curseur = (avant.curseur || 0) % tous.length, nouvelles = [], erreurs = 0;
for (let i = 0; i < PAR_PASSAGE; i++) {
  const s = tous[(curseur + i) % tous.length];
  try {
    const r = await interroger(s.requete, { domaines: s.domaine.sources, get });
    erreurs += r.erreurs.length;
    const vus = new Set(); let n = 0;
    for (const x of r.resultats.filter((x) => (x.extrait || "").length > 60)) {
      if (n >= 3 || vus.has(x.titre)) continue; vus.add(x.titre);
      nouvelles.push({ id: `${s.id}|${(x.url || x.titre).slice(0, 160)}`, sousTheme: s.id, titre: x.titre, texte: `${x.titre}. ${resumerLocalement(x.extrait, s.requete, 2)}`.trim(), source: x.url || x.sourceNom, sourceNom: x.sourceNom }); n++;
    }
  } catch (e) { erreurs++; }
}
const deja = new Set(nouvelles.map((f) => f.id));
const fiches = nouvelles.concat((avant.fiches || []).filter((f) => !deja.has(f.id))).slice(0, GARDE);
writeFileSync(`${dossier}/veille.json`, JSON.stringify({ maj: new Date().toISOString(), curseur: (curseur + PAR_PASSAGE) % tous.length, passage: PAR_PASSAGE, total: tous.length, erreurs, fiches }));
console.log(`veille : ${nouvelles.length} nouvelles fiches, ${fiches.length} gardées, curseur ${(curseur + PAR_PASSAGE) % tous.length}/${tous.length}, ${erreurs} erreur(s) de source`);
