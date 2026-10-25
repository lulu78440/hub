// Fusion de documents « en ajout seul » entre deux appareils (journaux du Noyau).
// Deux appareils qui ajoutent chacun une ligne ne doivent pas s'écraser : on garde l'union des lignes (par identifiant), triée par date.
// Idempotente (refusionner donne le même résultat) et commutative : c'est ce qui permet à PC et téléphone de converger sans coordination.
export function fusionnerLignes(local, distant, plafond = 5000) {
  if (!local || !distant || !Array.isArray(local.lignes) || !Array.isArray(distant.lignes)) return null;
  const par = new Map();
  for (const l of [...local.lignes, ...distant.lignes]) if (l && typeof l.id === "string" && !par.has(l.id)) par.set(l.id, l);
  const lignes = [...par.values()].sort((a, b) => String(a.quand || "").localeCompare(String(b.quand || "")) || String(a.id).localeCompare(String(b.id)));
  if (lignes.length > plafond) lignes.splice(0, lignes.length - plafond);
  const identique = lignes.length === local.lignes.length && lignes.every((l, i) => l.id === local.lignes[i].id);
  return identique ? null : { ...local, lignes };            // null : rien à changer ici
}
