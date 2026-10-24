// Mode crépuscule (idée de la Boîte à idées) : le soir, moins de lumière bleue et des tons ambrés pour mieux dormir.
// Un voile ambré (mélange « couleur » : il garde la lumière, change la teinte) se lève au coucher du soleil (heure lue dans la météo, sinon 20 h 30) et s'efface
// au lever (sinon 7 h). Réglage dans Diag : automatique, toujours, jamais. Clic droit sur le fond : basculer tout de suite.
import { prefs } from "../store/prefs.js";
import { extendMenu } from "./menus.js";
import { toast } from "./toast.js";

const m = (s) => +s.slice(11, 13) * 60 + +s.slice(14, 16);
/** Minutes du lever et du coucher du soleil du jour (météo mémorisée), ou valeurs par défaut. Exporté pour les essais. */
export function sunTimes() {
  try { const c = JSON.parse(prefs.get("meteo-cache", "null")); const d = c && c.data && c.data.daily; if (d && d.sunrise && d.sunset && d.sunrise[0] && d.sunset[0]) return { rise: m(d.sunrise[0]), set: m(d.sunset[0]) }; } catch (e) { /* météo absente */ }
  return { rise: 7 * 60, set: 20 * 60 + 30 };
}
export const isNight = (now = new Date()) => { const { rise, set } = sunTimes(), n = now.getHours() * 60 + now.getMinutes(); return n >= set || n < rise; };

export function initDusk() {
  const veil = document.createElement("div"); veil.className = "dusk"; veil.setAttribute("aria-hidden", "true"); document.body.append(veil);
  const mode = () => prefs.get("crepuscule", "auto");           // auto | on | off
  function apply() { const on = mode() === "on" || (mode() === "auto" && isNight()); document.body.classList.toggle("dusk-on", on); }
  const box = document.getElementById("surprises");
  if (box) {
    const lab = document.createElement("label"); lab.className = "chkl"; lab.append(document.createTextNode("Mode crépuscule "));
    const sel = document.createElement("select"); sel.className = "inl";
    [["auto", "automatique (le soir)"], ["on", "toujours"], ["off", "jamais"]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.append(o); });
    sel.value = mode(); sel.addEventListener("change", () => { prefs.set("crepuscule", sel.value); apply(); }); lab.append(sel); box.append(lab);
  }
  extendMenu("fond", () => [{ t: document.body.classList.contains("dusk-on") ? "Quitter le mode crépuscule" : "Mode crépuscule maintenant", fn: () => {
    const on = !document.body.classList.contains("dusk-on"); prefs.set("crepuscule", on ? "on" : (isNight() ? "off" : "auto")); apply(); toast(on ? "Crépuscule : tons ambrés" : "Crépuscule coupé");
  } }]);
  apply(); setInterval(apply, 60e3);
  return { apply };
}
