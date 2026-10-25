// Noyau · carte du savoir : ce que le Noyau a réellement appris, domaine par domaine, calculé depuis sa mémoire.
// Règle de calcul (publique, affichée dans la fenêtre) :
//   - une fiche rattachée à un sous-thème vaut 1 si elle est vérifiée (source + validation de Lucien, ou article), 0,5 si elle ne l'est pas,
//     un fait sur Lucien vaut 0,5, un souvenir d'échange 0,25 ;
//   - un sous-thème est « couvert » à 100 % quand ses fiches totalisent 2 points ; avant, il avance proportionnellement ;
//   - le pourcentage d'un domaine est la moyenne de ses sous-thèmes. Il part de 0 % et ne monte que par des fiches que Lucien a validées.
// Ce pourcentage mesure la couverture du programme (curriculum.js), pas le savoir total sur le sujet.
import { hote } from "./hote.js";
import { jetons, normaliser, resumerLocalement } from "./recherche.js";
import { PROGRAMME, SOUS_THEMES, DOMAINES_SAVOIR, TOTAL_SOUS_THEMES } from "./curriculum.js";

const POIDS = (it) => it.type === "wiki" ? 1 : it.type === "kb" ? (it.verifie === true ? 1 : 0.5) : it.type === "sem" ? 0.5 : it.type === "epi" ? 0.25 : 0;
const SEUIL = 2;

export function creerSavoir({ memoire, barriere }) {
  const cache = new Map(); const motsST = new Map();
  for (const [id, s] of SOUS_THEMES) motsST.set(id, new Set(s.mots.flatMap((m) => jetons(m, { vides: false }))));

  /** Sous-thème d'une fiche : le champ « theme » s'il existe, sinon reconnaissance par mots-clés (au moins 2 mots du sous-thème). */
  function themeDe(it) {
    if (it.theme && SOUS_THEMES.has(it.theme)) return it.theme;
    const cle = it.id + ":" + (it.texte || "").length; if (cache.has(cle)) return cache.get(cle);
    const t = new Set(jetons([it.titre, it.texte, it.complet].filter(Boolean).join(" "), { vides: false }));
    let meilleur = null, score = 1;
    for (const [id, mots] of motsST) { let n = 0; for (const m of mots) if (t.has(m)) n++; if (n > score) { score = n; meilleur = id; } }
    cache.set(cle, meilleur); return meilleur;
  }

  function carte() {
    const par = new Map(); for (const [id] of SOUS_THEMES) par.set(id, { points: 0, fiches: [] });
    for (const it of memoire.tous({ archive: false })) {
      if (!["kb", "wiki", "sem", "epi"].includes(it.type)) continue;
      const th = themeDe(it); if (!th) continue; const e = par.get(th); e.points += POIDS(it); e.fiches.push(it);
    }
    const domaines = PROGRAMME.map((d) => {
      const sts = d.sousThemes.map((s) => { const e = par.get(s.id); return { id: s.id, titre: s.titre, niveau: Math.min(1, e.points / SEUIL), fiches: e.fiches.length, points: e.points }; });
      const pct = Math.round((sts.reduce((a, s) => a + s.niveau, 0) / sts.length) * 100);
      return { id: d.id, nom: d.nom, symbole: d.symbole, couleur: d.couleur, pct, couverts: sts.filter((s) => s.niveau >= 1).length, entames: sts.filter((s) => s.niveau > 0).length, total: sts.length, fiches: sts.reduce((a, s) => a + s.fiches, 0), sousThemes: sts };
    });
    // Liens : deux sous-thèmes entamés partagent des mots forts de leurs fiches
    const termes = new Map();
    for (const [id, e] of par) { if (!e.fiches.length) continue; const f = new Map(); for (const it of e.fiches) for (const w of new Set(jetons([it.titre, it.texte].join(" ")))) if (w.length > 4) f.set(w, (f.get(w) || 0) + 1); termes.set(id, new Set([...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([w]) => w))); }
    const liens = [], ids = [...termes.keys()];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { let n = 0; for (const w of termes.get(ids[i])) if (termes.get(ids[j]).has(w)) n++; if (n >= 3) liens.push({ a: ids[i], b: ids[j], force: Math.min(1, n / 8) }); }
    liens.sort((x, y) => y.force - x.force);
    const global = Math.round(([...par.values()].reduce((a, e) => a + Math.min(1, e.points / SEUIL), 0) / TOTAL_SOUS_THEMES) * 100);
    return { domaines, liens: liens.slice(0, 160), global, fiches: domaines.reduce((a, d) => a + d.fiches, 0), couverts: domaines.reduce((a, d) => a + d.couverts, 0), total: TOTAL_SOUS_THEMES };
  }

  /** Prochain sous-thème à étudier : dans un domaine déjà entamé en priorité, le moins avancé. */
  function prochain(c = carte(), { exclure = [] } = {}) {
    const entames = c.domaines.filter((d) => d.pct > 0 && d.pct < 100).sort((a, b) => b.pct - a.pct);
    const pool = entames.length ? entames : c.domaines;
    for (const d of pool) { const s = d.sousThemes.filter((x) => x.niveau < 1 && !exclure.includes(x.id)).sort((a, b) => a.niveau - b.niveau)[0]; if (s) return { domaine: d.id, sousTheme: s.id, titre: s.titre, domaineNom: d.nom }; }
    return null;
  }

  /** Étudie un sous-thème : cherche dans les références du domaine et dépose des fiches dans « À valider ». Rien n'est appris sans l'accord de Lucien. */
  async function etudier(idSousTheme, { origine = "lucien" } = {}) {
    const s = SOUS_THEMES.get(idSousTheme); if (!s) throw new Error("Sous-thème inconnu");
    const d = DOMAINES_SAVOIR.get(s.domaine);
    const r = await barriere.executer({ outil: "chercher_sources", params: { requete: s.requete, domaines: d.sources } }, { origine });
    if (!r.ok) return { ok: false, erreur: r.erreur, propose: 0 };
    const jolis = (r.donnees.resultats || []).filter((x) => (x.extrait || "").length > 60);
    const vus = new Set(); let n = 0;
    for (const x of jolis) {
      if (n >= 3) break; if (vus.has(x.titre)) continue; vus.add(x.titre);
      const texte = `${x.titre}. ${resumerLocalement(x.extrait, s.requete, 2)}`.trim();
      if (await memoire.proposer({ type: "kb", titre: x.titre, texte, source: x.url || x.sourceNom, origine: "étude (" + x.sourceNom + ")", exterieur: true, theme: idSousTheme })) n++;
    }
    return { ok: true, propose: n, interrogees: (r.donnees.sources_interrogees || []).length, erreurs: r.donnees.erreurs || [] };
  }

  return { carte, prochain, etudier, themeDe, SEUIL };
}
