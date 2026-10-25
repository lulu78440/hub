// Fonctions en réserve (refonte, 25/10) : fenêtres que Lucien n'utilise pas chaque semaine (Tâches, Veille, Radar, Rituels, Sécurité,
// Savoir, Mails). Elles sortent de la vue mais leur code reste en place : « Plus… » du menu du fond → « Fonctions en réserve » les remet.
// Sur téléphone, rien ne change pour l'instant (étape ergo-mobile).
import { state } from "../state.js";
import { prefs } from "../store/prefs.js";

const KEY = "reserve-v1";
export const PAR_DEFAUT = ["tasks", "watch", "radar", "rituels", "securite", "savoir", "mails"];
const fns = [];
let cache = null;
function load() {
  if (cache) return cache;
  try { const d = JSON.parse(prefs.get(KEY, "null")); cache = Array.isArray(d) ? d.filter((x) => typeof x === "string") : PAR_DEFAUT.slice(); }
  catch (e) { cache = PAR_DEFAUT.slice(); }
  return cache;
}
/** Vrai si la fonction est rangée en réserve (jamais sur téléphone). */
export const inReserve = (id) => !state.lite && load().includes(id);
export const reserveList = () => load().slice();
export const onReserve = (fn) => fns.push(fn);
export function setReserve(id, on) {
  const l = load(), i = l.indexOf(id);
  if (on && i < 0) l.push(id); else if (!on && i >= 0) l.splice(i, 1); else return;
  prefs.set(KEY, JSON.stringify(l));
  fns.forEach((f) => { try { f(id, on); } catch (e) { console.error(e); } });
}
