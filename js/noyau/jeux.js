// Noyau · jeux de données en mémoire (orchestrateur, lot 3).
// PRINCIPE : le modèle ne manipule JAMAIS de chiffres. Un outil de données dépose un jeu vérifié ici et ne renvoie au modèle qu'une
// RÉFÉRENCE (« jeu:ab12cd34 ») avec un résumé calculé par le hub. Les autres outils (transformer, afficher, enregistrer) reçoivent la
// référence, jamais les valeurs. Une référence inconnue ou périmée est refusée : le modèle ne peut pas inventer un jeu.
// Les jeux vivent en mémoire de la page (aucune écriture) ; seul « enregistrer_module », avec l'accord de Lucien, en garde une copie.
import { verifierJeu, dateTexte } from "./modules/composants.js";

export const RE_REF = /^jeu:[a-z0-9]{6,16}$/;
export const MAX_JEUX = 30;

export function creerJeux({ nouvelId = () => Math.random().toString(36).slice(2, 10), maintenant = () => new Date() } = {}) {
  const m = new Map();      // ordre d'insertion = ordre d'ancienneté (le plus ancien part le premier)
  const idPropre = () => { for (let i = 0; i < 20; i++) { const id = "jeu:" + String(nouvelId("")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(-10).padStart(6, "0"); if (!m.has(id) && RE_REF.test(id)) return id; } throw new Error("Impossible de nommer le jeu"); };
  return {
    /** Vérifie le jeu (schéma strict, source obligatoire) puis le range. Renvoie { ref, jeu }. */
    deposer(brut, { origine = null } = {}) {
      const jeu = verifierJeu(brut);
      const ref = idPropre();
      m.set(ref, { jeu, origine, depose: maintenant().getTime() });
      while (m.size > MAX_JEUX) m.delete(m.keys().next().value);
      return { ref, jeu };
    },
    /** Le jeu derrière une référence, ou une erreur claire (jamais un jeu « par défaut »). */
    lire(ref) {
      if (typeof ref !== "string" || !RE_REF.test(ref)) throw new Error("Référence de jeu invalide : le modèle ne peut passer que des références « jeu:… » reçues d'un outil.");
      const e = m.get(ref);
      if (!e) throw new Error(`Jeu inconnu : « ${ref} ». Il n'existe pas ou n'est plus en mémoire : refais d'abord lire_serie.`);
      return e.jeu;
    },
    /** Instant (ms) où le jeu est entré en mémoire : sert à dire « chargé il y a … » (la date de la donnée est dans sa source). */
    depose(ref) { const e = m.get(ref); return e ? e.depose : null; },
    origine(ref) { const e = m.get(ref); return e ? e.origine : null; },
    existe: (ref) => m.has(ref),
    refs: () => [...m.keys()],
    vider() { m.clear(); }
  };
}

/** Résumé donné au modèle : calculé par le hub, sans valeur à recopier (extrêmes et bornes seulement, avec leur date). */
export function resumeJeu(ref, jeu) {
  const num = jeu.colonnes.filter((c) => c.type === "nombre"), dat = jeu.colonnes.find((c) => c.type === "date");
  const colonnes = num.map((c) => {
    const vals = jeu.lignes.map((l, i) => ({ v: l[c.i], d: dat ? l[dat.i] : null, i })).filter((x) => x.v != null);
    if (!vals.length) return { id: c.id, libelle: c.libelle, valeurs: 0 };
    let min = vals[0], max = vals[0]; for (const x of vals) { if (x.v < min.v) min = x; if (x.v > max.v) max = x; }
    const prem = vals[0], der = vals[vals.length - 1];
    return { id: c.id, libelle: c.libelle, valeurs: vals.length, manquantes: jeu.lignes.length - vals.length, premier: { date: prem.d, valeur: prem.v }, dernier: { date: der.d, valeur: der.v }, min: { date: min.d, valeur: min.v }, max: { date: max.d, valeur: max.v } };
  });
  return {
    jeu: ref, titre: jeu.titre || null, lignes: jeu.lignes.length, unite: jeu.unite,
    colonnes_disponibles: jeu.colonnes.map((c) => ({ id: c.id, libelle: c.libelle, type: c.type })),
    periode: jeu.source.periode, source: jeu.source.nom, donnees_du: jeu.source.maj, licence: jeu.source.licence || null, verifie: jeu.source.verifie, exemple: jeu.exemple,
    colonnes, note: "Valeurs calculées par le hub. Pour afficher ou comparer, passe cette référence (« " + ref + " ») aux outils ; ne recopie aucun chiffre."
  };
}
export { dateTexte };
