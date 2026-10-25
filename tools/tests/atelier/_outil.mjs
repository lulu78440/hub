// Petit outil d'essai commun aux moteurs de l'Atelier (aucune dépendance).
let ok = 0, ko = 0;
export function vrai(cond, nom) { if (cond) ok++; else { ko++; console.log("  ÉCHEC : " + nom); } }
export function egal(a, b, nom) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) ok++; else { ko++; console.log(`  ÉCHEC : ${nom}\n    obtenu  : ${sa}\n    attendu : ${sb}`); }
}
export function leve(fn, nom) { try { fn(); ko++; console.log("  ÉCHEC (aucune erreur) : " + nom); } catch (e) { ok++; } }
export function fin(titre) {
  if (ko) { console.log(`${titre} : ${ko} échec(s), ${ok} réussi(s).`); process.exitCode = 1; }
  else console.log(`${titre} : ${ok} vérifications. Tout est bon`);
}
