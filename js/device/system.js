// Infos de l'appareil que le navigateur veut bien donner : batterie, réseau, écran.
// Brave masque certaines infos (batterie, type de réseau) pour limiter le pistage : on l'indique honnêtement.
export async function battery() {
  try {
    if (!navigator.getBattery) return null;
    const b = await navigator.getBattery();
    return b;
  } catch (e) { return null; }
}
export function network() {
  if (!navigator.onLine) return { text: "hors ligne", ok: false };
  const c = navigator.connection;
  const kind = c && c.type && c.type !== "unknown" ? ({ wifi: "Wi-Fi", ethernet: "câble", cellular: "mobile" }[c.type] || c.type) : null;
  return { text: "en ligne" + (kind ? " · " + kind : ""), ok: true };
}
export const screenInfo = () => `${screen.width} × ${screen.height}` + (devicePixelRatio > 1 ? ` · ×${+devicePixelRatio.toFixed(2)}` : "");

/** Ouvre une page des Paramètres Windows (ms-settings:…). Brave demande une confirmation la première fois. */
export function openWindows(uri) {
  const a = document.createElement("a"); a.href = uri; a.rel = "noopener"; document.body.append(a); a.click(); a.remove();
}
