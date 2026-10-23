/* Panneau de diagnostic : version, mode, réseau, hors ligne, installation. Ouvert par le bouton « Diag » ou la touche D. */
import { VERSION } from "../version.js";
import { toast } from "./toast.js";

const $ = (id) => document.getElementById(id);
const set = (id, text, cls = "") => { const el = $(id); el.textContent = text; el.className = cls; };

export function initDiag({ lite, reduce }) {
set("d-version", VERSION);
set("d-mode", lite ? "Mobile (allégé)" : "PC (complet)");
set("d-motion", reduce ? "Oui (respecté)" : "Non");

const standalone = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone;
set("d-display", standalone ? "Appli installée" : "Onglet de navigateur", standalone ? "ok" : "");

const net = () => set("d-net", navigator.onLine ? "En ligne" : "Hors ligne", navigator.onLine ? "ok" : "warn");
addEventListener("online", net); addEventListener("offline", net); net();

// Installation (Brave / Chrome : bouton proposé quand le navigateur le permet)
let deferred = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("b-install").hidden = false; });
$("b-install").addEventListener("click", async () => {
  if (!deferred) return;
  deferred.prompt(); await deferred.userChoice; deferred = null; $("b-install").hidden = true;
});
addEventListener("appinstalled", () => { $("b-install").hidden = true; set("d-display", "Appli installée", "ok"); });

// Service worker
async function askVersion(sw) {
  return new Promise((res) => {
    const ch = new MessageChannel(); ch.port1.onmessage = (e) => res(e.data);
    sw.postMessage({ type: "VERSION" }, [ch.port2]); setTimeout(() => res(null), 2000);
  });
}
async function refreshStatus(reg) {
  const sw = navigator.serviceWorker.controller || reg.active;
  if (!sw) { set("d-sw", "En cours d'installation…", "warn"); return; }
  const info = await askVersion(sw);
  set("d-sw", info ? "Actif · v" + info.version : "Actif", "ok");
  const keys = await caches.keys();
  const mine = info && keys.includes(info.cache);
  set("d-cache", mine ? "Oui · tout est en mémoire" : "Non", mine ? "ok" : "bad");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(new URL("../../sw.js", import.meta.url).href).then((reg) => {
    refreshStatus(reg);
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      refreshStatus(reg);
      if (hadController) toast("Nouvelle version prête : recharge la page");   // la page ouverte est encore l'ancienne
    });
    reg.addEventListener("updatefound", () => {
      const n = reg.installing;
      n && n.addEventListener("statechange", () => { if (n.state === "activated") refreshStatus(reg); });
    });
    $("b-update").addEventListener("click", async () => {
      set("d-sw", "Vérification…", "warn"); await reg.update(); setTimeout(() => refreshStatus(reg), 800);
    });
    $("b-reset").addEventListener("click", async () => {
      for (const k of await caches.keys()) await caches.delete(k);
      await reg.unregister(); location.reload();
    });
  }).catch((err) => { set("d-sw", "Erreur : " + err.message, "bad"); set("d-cache", "Non", "bad"); });
} else {
  set("d-sw", "Non pris en charge (HTTPS requis)", "bad"); set("d-cache", "Non", "bad");
}
}
