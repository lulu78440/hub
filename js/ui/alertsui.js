// Réglages des rappels dans Diag : son (activer, couper, tester) et notifications de Brave.
import { sound } from "../device/sound.js";
import { notify } from "../device/notify.js";
import { toast } from "./toast.js";

export function initAlertsUI(reminders) {
  const $ = (id) => document.getElementById(id);
  const NOTIF = { granted: ["Autorisées", "ok"], denied: ["Refusées (réglage de Brave)", "warn"], default: ["Pas encore demandées", "warn"], unsupported: ["Non disponibles ici", ""] };
  function refresh() {
    $("d-sound").textContent = sound.on ? "Activé" : "Coupé"; $("d-sound").className = sound.on ? "ok" : "warn";
    $("b-sound").textContent = sound.on ? "Couper le son" : "Activer le son";
    const [txt, cls] = NOTIF[notify.state] || NOTIF.unsupported;
    $("d-notif").textContent = txt; $("d-notif").className = cls;
    $("b-notif").hidden = notify.state !== "default";
  }
  $("b-sound").addEventListener("click", () => { sound.set(!sound.on); refresh(); if (sound.on) sound.play("doux"); });
  $("b-notif").addEventListener("click", async () => { const s = await notify.ask(); refresh(); toast(s === "granted" ? "Notifications activées" : "Notifications refusées"); });
  $("b-test").addEventListener("click", () => { reminders.test(); });
  $("b-diag").addEventListener("click", refresh);
  addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "d") setTimeout(refresh, 0); });
  refresh();
}
