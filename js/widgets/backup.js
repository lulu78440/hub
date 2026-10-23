// Rappel de sauvegarde du dimanche (2.10) : le dimanche à partir de 9 h, si le dernier export a plus de 5 jours,
// une alerte propose « Exporter maintenant ». Si le dimanche a été manqué (plus de 8 jours), l'alerte revient n'importe quel jour.
// « Plus tard » la repousse de 3 heures. Le fichier exporté se range ensuite sur le PC et dans Google Drive.
import { prefs } from "../store/prefs.js";
import { store } from "../store/storage.js";
import { sound } from "../device/sound.js";
import { notify } from "../device/notify.js";
import { pulse } from "../state.js";

const DAY = 864e5;

export function initBackup(data) {
  const box = document.getElementById("alerts");
  let card = null;

  async function hasData() { for (const c of ["notes", "tasks", "events", "favs", "images"]) if ((await store.all(c)).length) return true; return false; }
  function due(now = new Date()) {
    const last = Date.parse(prefs.get("dernier-export", "")) || 0, later = +prefs.get("sauvegarde-plus-tard", "0") || 0;
    if (now.getTime() < later) return null;
    const age = now.getTime() - last;
    if (now.getDay() === 0 && now.getHours() >= 9 && age > 5 * DAY) return "dimanche";
    if (last && age > 8 * DAY) return "retard";
    return null;
  }
  function close() { if (card) { card.remove(); card = null; if (!box.children.length) box.hidden = true; } }
  function show(kind) {
    if (card) return;
    const last = Date.parse(prefs.get("dernier-export", ""));
    card = document.createElement("div"); card.className = "alert backup"; card.setAttribute("role", "alertdialog");
    card.innerHTML = '<span class="ring" aria-hidden="true"></span><div class="atx"><small></small><b></b><span class="sub"></span></div><div class="aacts"></div>';
    card.querySelector("small").textContent = kind === "retard" ? "SAUVEGARDE EN RETARD" : kind === "essai" ? "SAUVEGARDE · ESSAI" : "SAUVEGARDE DU DIMANCHE";
    card.querySelector("b").textContent = "Exporte tes données du hub";
    card.querySelector(".sub").textContent = (last ? "Dernier export : il y a " + Math.max(1, Math.round((Date.now() - last) / DAY)) + " jour(s)" : "Aucun export pour l'instant") + " · puis range le fichier sur le PC et dans Google Drive";
    const acts = card.querySelector(".aacts");
    const mk = (l, cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = l; b.addEventListener("click", fn); acts.append(b); };
    mk("Exporter maintenant", "ok", async () => { close(); prefs.set("sauvegarde-plus-tard", "0"); await data.exportFile(); });
    mk("Plus tard", "", () => { prefs.set("sauvegarde-plus-tard", String(Date.now() + 3 * 3600e3)); close(); });
    box.append(card); box.hidden = false; pulse(1);
    if (document.visibilityState === "visible") sound.play("doux");
    else notify.show("Hub · sauvegarde du dimanche", "Exporte tes données et range le fichier", "hub-sauvegarde");
  }
  async function check() { const k = due(); if (k && await hasData()) show(k); else if (!k) close(); }

  setTimeout(check, 4000);
  setInterval(check, 15 * 60e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  return { test: () => show("essai"), due };
}
