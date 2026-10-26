// Noyau · provenance d'un jeu (orchestrateur, lot 9). Un jeu calculé garde l'histoire de sa fabrication dans son « origine » en mémoire :
//   lire_serie → { source, identifiant, debut, fin } ; transformer_donnees → { de: "jeu:…", operation, … } ; comparer ajoute { avec: "jeu:…" }.
// Ici, on remonte cette histoire jusqu'à la série d'origine : c'est ce qui permet de RECHARGER un jeu au lieu de recopier ses données dans la synchronisation.
// Rien de chiffré : que des noms de sources, d'identifiants et d'opérations (texte public).
const CLES_OP = ["operation", "debut", "fin", "colonnes", "mode", "n"];

/** → { racine: { source, identifiant, debut, fin } | null, etapes: [{ operation, … }], reconstructible } ; `origine(ref)` rend l'origine en mémoire d'une référence. */
export function provenanceDe(origine, ref) {
  const etapes = []; let cur = ref, reconstructible = true;
  for (let i = 0; i < 8 && cur; i++) {
    const o = origine(cur);
    if (!o) return { racine: null, etapes: etapes.reverse(), reconstructible: false };
    if (o.de) {
      const e = {}; for (const k of CLES_OP) if (o[k] != null) e[k] = o[k];
      if (o.operation === "comparer") reconstructible = false;                  // un second jeu intervient : on ne le rejoue pas à l'aveugle
      etapes.push(e); cur = o.de; continue;
    }
    if (typeof o.source === "string" && typeof o.identifiant === "string") return { racine: { source: o.source, identifiant: o.identifiant, debut: o.debut || "", fin: o.fin || "" }, etapes: etapes.reverse(), reconstructible };
    break;
  }
  return { racine: null, etapes: etapes.reverse(), reconstructible: false };
}
