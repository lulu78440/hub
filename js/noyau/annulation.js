// Noyau · annulation propre d'un plan (orchestrateur, lot 5). Remplace le contournement de Refonte 4 pour les nouveaux chemins.
// boucle.js ouvre un signal par plan et le passe à executerPlan ; « annulerPlan() » (appelable par un bouton de Lucien) l'abat.
// Rien ici ne donne un droit au Noyau : ce n'est pas un outil, et aucun outil ne l'appelle.
const actifs = new Map();                       // identifiant de plan -> AbortController
let dernier = null;

/** Ouvre le signal d'un plan. Le plan le recevra via executerPlan({ signal }). */
export function ouvrirSignal(id) {
  const ctl = new AbortController(); actifs.set(id, ctl); dernier = id;
  return ctl.signal;
}
/** À appeler à la fin du plan (réussi ou non) : le signal ne reste pas en mémoire. */
export function fermerSignal(id) { actifs.delete(id); if (dernier === id) dernier = [...actifs.keys()].pop() || null; }
/** Plan en cours le plus récent, ou null. */
export function planEnCours() { return dernier && actifs.has(dernier) ? dernier : null; }
/** Annule un plan (par défaut le plus récent). Renvoie vrai si un plan a été annulé. Les étapes restantes ne partent pas ; l'étape en cours est coupée. */
export function annulerPlan(id = null) {
  const cible = id || planEnCours(); const ctl = cible && actifs.get(cible);
  if (!ctl || ctl.signal.aborted) return false;
  ctl.abort(); return true;
}
