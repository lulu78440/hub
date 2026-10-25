// Noyau · voix (facultative) : lecture à voix haute et dictée. Aucune dépendance au hub.
// Reprend l'idée du module le plus propre de l'application v3.8 (texte nettoyé pour l'oral, voix françaises préférées), sans son code.
// Limite connue : Brave bloque la reconnaissance vocale (dictée) ; la lecture à voix haute marche partout.

/** Texte nettoyé pour l'oral : sans numéros de source, adresses, symboles, listes. */
export function nettoyerPourOral(t) {
  return String(t || "").replace(/\[\d+\]/g, "").replace(/https?:\/\/\S+/g, "ce lien").replace(/[*_`#>~]/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/\s*\n+\s*/g, ". ").replace(/\.\s*\./g, ".").replace(/\s{2,}/g, " ").trim();
}
export const lectureDispo = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
export const dicteeDispo = () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

let voixFr = null;
function choisirVoix() {
  if (voixFr || !lectureDispo()) return voixFr;
  const l = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
  voixFr = l.find((v) => /natural|neural|online/i.test(v.name)) || l.find((v) => /fr-FR/i.test(v.lang)) || l[0] || null;
  return voixFr;
}

/** Lit un texte. `ton` règle légèrement hauteur et débit (pas d'émotion jouée). */
export function lire(texte, { ton = "calme", fin = () => {} } = {}) {
  if (!lectureDispo()) { fin(); return false; }
  arreter();
  const u = new SpeechSynthesisUtterance(nettoyerPourOral(texte)); u.lang = "fr-FR";
  const v = choisirVoix(); if (v) u.voice = v;
  const reglages = { calme: [1, 0.98], curieux: [1.03, 1.02], enthousiaste: [1.06, 1.08], vigilant: [0.98, 1], amuse: [1.04, 1.05], preoccupe: [0.95, 0.94] }[ton] || [1, 1];
  u.pitch = reglages[0]; u.rate = reglages[1];
  u.onend = u.onerror = () => fin();
  speechSynthesis.speak(u); return true;
}
export function arreter() { if (lectureDispo()) speechSynthesis.cancel(); }
if (lectureDispo()) { speechSynthesis.onvoiceschanged = () => { voixFr = null; choisirVoix(); }; }

/** Dictée : renvoie { arreter }. Erreurs lisibles (Brave bloque la reconnaissance vocale). */
export function dicter({ surTexte, surFin = () => {}, surErreur = () => {} }) {
  const R = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!R) { surErreur("La dictée n'est pas disponible dans ce navigateur (Brave la bloque). Ouvre le hub dans Chrome pour dicter."); return { arreter() {} }; }
  const r = new R(); r.lang = "fr-FR"; r.interimResults = true; r.continuous = false;
  r.onresult = (e) => { surTexte([...e.results].map((x) => x[0].transcript).join(" "), e.results[e.results.length - 1].isFinal); };
  r.onerror = (e) => surErreur(e.error === "not-allowed" ? "Micro refusé : autorise-le dans le navigateur." : e.error === "network" || e.error === "service-not-allowed" ? "Le navigateur bloque la reconnaissance vocale (Brave le fait). Essaie dans Chrome." : "Dictée interrompue (" + e.error + ").");
  r.onend = () => surFin();
  try { r.start(); } catch (e) { surErreur("Impossible de démarrer le micro."); }
  return { arreter() { try { r.stop(); } catch (e) { /* déjà arrêté */ } } };
}
