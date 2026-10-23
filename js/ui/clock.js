// Horloge et date du bandeau (heure locale, mise à jour à la seconde).
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function initClock() {
  const time = document.getElementById("time"), sec = document.getElementById("sec"), date = document.getElementById("date");
  let lastDay = "";
  function tick() {
    const d = new Date();
    time.firstChild.nodeValue = pad(d.getHours()) + ":" + pad(d.getMinutes());
    sec.textContent = pad(d.getSeconds());
    const day = d.toDateString();
    if (day !== lastDay) { lastDay = day; date.textContent = fmtDate.format(d); }
  }
  tick();
  // Aligné sur le changement de seconde ; l'onglet caché ralentit le minuteur, tick() se recale au retour.
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}
