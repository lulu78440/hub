// Noyau · sessions de travail (orchestrateur, lot 9) : reprendre « le graphique d'hier » après un rechargement.
// Une session = ce qu'un plan a fait : les étapes et leur statut, la provenance des jeux (source, identifiant, opérations : du texte public), la vue affichée.
//  - `kv/noyau-session-NN` : 30 emplacements en anneau (00 à 29) ; le 31e plan réécrit le plus ancien. Aucune suppression nulle part.
//  - AUCUN chiffre ni texte de Lucien : la demande n'est PAS gardée (elle peut contenir des mots privés) ; le libellé vient du titre public de la vue ou du jeu.
//  - Les données ne sont pas dans la session : elles sont dans le cache LOCAL (cache-jeux.js, non synchronisé). Au rechargement, le jeu est repris du cache
//    avec sa date de requête (et « périmé » si la source l'est) ; s'il manque, la session dit lequel et comment le relire (lire_serie), sans rien deviner.
//  - Écrite par le code du hub après un plan (jamais par un outil du Noyau, jamais sur ordre du modèle) ; coupée par le réglage « noyau-sessions » = « off ».
import { provenanceDe } from "./provenance.js";
import { empreinte } from "./cache-jeux.js";

export const MAX_SESSIONS = 30;
export const PREFIXE = "noyau-session-";
const RE_DOC = /^noyau-session-(\d\d)$/;
const RE_ID = /^s\d{1,6}$/;
const court = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const OPTIONS_PERMISES = ["x", "y", "series", "categorie", "valeur"];

export function creerSessions({ stockage, jeux, cache = null, reglage = null, maintenant = () => new Date() }) {
  const actif = () => { try { return !reglage || reglage("noyau-sessions", "on") !== "off"; } catch (e) { return true; } };
  const docs = async () => (await stockage.tout("kv")).filter((d) => d && RE_DOC.test(String(d.id)) && RE_ID.test(String(d.session_id)) && Array.isArray(d.etapes));
  const resume = (d) => ({ id: d.session_id, date: d.date, libelle: d.libelle, etapes: d.etapes.length, reussies: d.bilan ? d.bilan.reussies : null, vue: d.vue ? d.vue.type : null, jeux: d.jeux.length, module: d.vue && d.vue.module || null });

  return {
    actif,
    /**
     * Note un plan terminé. `appels` = les étapes demandées, `lignes` = le résultat d'executerPlan (avec .id et .bilan).
     * Renvoie la session écrite ou null (réglage coupé, rien à reprendre, ou stockage indisponible : cela ne gêne jamais le plan).
     */
    async noterPlan({ appels, lignes }) {
      if (!actif() || !Array.isArray(appels) || !appels.length) return null;
      try {
        const affiche = lignes.find((l) => l.ok && l.nom === "afficher_module" && l.donnees && l.donnees.affiche);
        const vus = lignes.filter((l) => l.ok && l.donnees && typeof l.donnees.jeu === "string").map((l) => l.donnees.jeu);
        if (affiche && affiche.params && typeof affiche.params.jeu === "string") vus.push(affiche.params.jeu);        // un jeu repris d'une session ou d'un plan précédent
        const refs = [...new Set(vus.filter((r) => jeux.existe(r)))];
        if (!refs.length && !(affiche && affiche.donnees.module)) return null;                // rien à reprendre
        const liste = [];
        for (const ref of refs) {
          const j = jeux.lire(ref), cle = empreinte(j), prov = provenanceDe((r) => jeux.origine(r), ref);
          liste.push({ cle, titre: court(j.titre || j.source.nom, 120), source: court(j.source.nom, 120), periode: court(j.source.periode, 60), maj: j.source.maj, unite: court(j.unite, 40), provenance: prov, ref_origine: ref });
          if (cache) await cache.noter(j, { provenance: prov });
        }
        let vue = null;
        if (affiche) {
          const a = appels[lignes.indexOf(affiche)] || {}, p = affiche.params || a.params || {}, opts = {};
          for (const k of OPTIONS_PERMISES) if (typeof p[k] === "string") opts[k] = court(p[k], 32);
          const cible = typeof p.jeu === "string" ? liste.find((x) => x.ref_origine === p.jeu) : null;
          vue = { type: p.vue, options: opts, titre: p.titre ? court(p.titre, 80) : null, jeu_cle: cible ? cible.cle : null, module: typeof p.module === "string" ? court(p.module, 40) : null };
        }
        const tous = await docs(), seq = tous.reduce((m, d) => Math.max(m, d.seq || 0), 0) + 1, slot = String((seq - 1) % MAX_SESSIONS).padStart(2, "0");
        const t = maintenant();
        const doc = {
          id: PREFIXE + slot, session_id: "s" + seq, seq, date: t.toISOString(), plan: lignes.id || null,
          libelle: (vue && vue.titre) || (liste.length ? liste[liste.length - 1].titre : "Plan") || "Plan",
          etapes: appels.slice(0, 6).map((a, i) => ({ n: i + 1, outil: court(a.nom, 40), statut: lignes[i] ? (lignes[i].ok ? "fait" : lignes[i].refus ? "refuse" : lignes[i].annule || lignes[i].cause === "dependance" ? "non_execute" : "echec") : "non_execute" })),
          bilan: lignes.bilan ? { reussies: lignes.bilan.reussies, en_echec: lignes.bilan.en_echec, refusees: lignes.bilan.refusees, non_executees: lignes.bilan.non_executees } : null,
          jeux: liste.map(({ ref_origine, ...x }) => x), vue
        };
        await stockage.ecrire("kv", doc);
        return resume(doc);
      } catch (e) { return null; }
    },
    /** Les sessions, de la plus récente à la plus ancienne (sans données). */
    async lister() { return (await docs()).sort((a, b) => (b.seq || 0) - (a.seq || 0)).map(resume); },
    async derniere() { return (await this.lister())[0] || null; },
    /**
     * Reprend une session : remet en mémoire les jeux trouvés dans le cache local et rend leurs NOUVELLES références.
     * → { session, jeux: [{ ref, titre, du_cache, requete_le, perime, age_h }], manquants: [{ titre, source, comment }], vue }
     * Aucun appel réseau ici. `vue.jeu` est la référence de la vue si son jeu a pu être repris.
     */
    async reprendre(id) {
      const d = (await docs()).find((x) => x.session_id === id); if (!d) throw new Error(`Session inconnue : « ${court(id, 20)} »`);
      const repris = [], manquants = [], carte = new Map();
      for (const j of d.jeux) {
        const e = cache ? await cache.lire(j.cle) : null;
        if (!e) {
          const p = j.provenance && j.provenance.racine;
          manquants.push({ titre: j.titre, source: j.source, donnees_du: j.maj, comment: p ? `relire avec lire_serie (source ${p.source}, identifiant ${p.identifiant}${p.debut || p.fin ? ", période " + (p.debut || "…") + " → " + (p.fin || "…") : ""})${j.provenance.etapes.length ? " puis refaire : " + j.provenance.etapes.map((x) => x.operation).join(", ") : ""}` : "ce jeu ne peut pas être relu automatiquement" });
          continue;
        }
        const pv = e.origine && e.origine.provenance, direct = pv && pv.racine && !pv.etapes.length;       // un jeu calculé repris du cache n'est plus relié à sa série d'origine
        const r = jeux.deposer(e.jeu, { origine: { ...(direct ? pv.racine : {}), repris: d.session_id } });
        carte.set(j.cle, r.ref);
        repris.push({ ref: r.ref, titre: j.titre, du_cache: true, requete_le: e.requete_le, perime: e.perime, age_h: e.age_h, donnees_du: r.jeu.source.maj });
      }
      const vue = d.vue ? { type: d.vue.type, options: d.vue.options || {}, titre: d.vue.titre, module: d.vue.module, jeu: d.vue.jeu_cle ? (carte.get(d.vue.jeu_cle) || null) : null } : null;
      return { session: resume(d), jeux: repris, manquants, vue };
    }
  };
}
