// Données venues du monde extérieur (phase 3) : le fichier flux.json publié par la tâche programmée GitHub Actions
// (tools/flux.py) sur la branche « flux » du dépôt. Lu toutes les 10 minutes, gardé pour le hors ligne.
import { prefs } from "../store/prefs.js";

export const FLUX_URL = "https://raw.githubusercontent.com/lulu78440/hub/flux/flux.json";
export const SOURCES_EDIT = "https://github.com/lulu78440/hub/edit/main/flux/sources.json";
const KEY = "flux-cache", EVERY = 10 * 60e3;
const subs = [];
let data = null, last = 0;
try { const c = JSON.parse(prefs.get(KEY, "null")); if (c && c.data) { data = c.data; last = c.at || 0; } } catch (e) { data = null; }

export const flux = {
  get data() { return data; },
  get fetchedAt() { return last; },
  /** fn(data) appelé à chaque nouveau flux (et tout de suite si un flux est déjà en mémoire). */
  on(fn) { subs.push(fn); if (data) fn(data); },
  async refresh(force) {
    if (!force && Date.now() - last < EVERY - 5e3) return data;
    if (!navigator.onLine) return data;
    try {
      const r = await fetch(FLUX_URL + "?t=" + Math.floor(Date.now() / 60e3), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const changed = !data || d.genere !== data.genere;
      data = d; last = Date.now();
      prefs.set(KEY, JSON.stringify({ at: last, data }));
      if (changed) subs.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
    } catch (e) { /* hors ligne ou flux pas encore publié : on garde l'ancien */ }
    return data;
  }
};

/** « il y a 12 min » depuis une date ISO. */
export function ago(iso) {
  const t = Date.parse(iso); if (!t) return "";
  const m = Math.round((Date.now() - t) / 60e3);
  if (m < 1) return "à l'instant"; if (m < 60) return "il y a " + m + " min";
  const h = Math.round(m / 60); if (h < 24) return "il y a " + h + " h";
  return "il y a " + Math.round(h / 24) + " j";
}

setInterval(() => flux.refresh(), 60e3);
addEventListener("online", () => flux.refresh(true));
document.addEventListener("visibilitychange", () => { if (!document.hidden) flux.refresh(); });
