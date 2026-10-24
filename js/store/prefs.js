// Petits réglages mémorisés sur l'appareil (localStorage). Les données du hub (notes, tâches…) iront dans IndexedDB dès la phase 2.
// Les réglages qui contiennent du personnel passent par le coffre (chiffrés quand le verrouillage est actif).
import { vault } from "./vault.js";
const P = "hub-";
export const prefs = {
  get(key, fallback) { try { const v = vault.lsGet(P + key); return v === null ? fallback : v; } catch (e) { return fallback; } },
  set(key, value) { try { vault.lsSet(P + key, String(value)); } catch (e) { /* stockage indisponible : le réglage vaut pour cette session */ } },
  on(key, fallback = true) { return this.get(key, fallback ? "on" : "off") !== "off"; },
  setOn(key, v) { this.set(key, v ? "on" : "off"); }
};
