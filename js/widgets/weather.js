// Widget Météo (2.6) : Open-Meteo (gratuit, sans clé), position automatique ou ville choisie.
// PC : météo discrète dans le bandeau (survol = détail, 7 jours, course du soleil). Mobile : la fenêtre Météo.
// Hors ligne : la dernière météo reçue reste affichée, avec son heure. Actualisation toutes les 30 minutes.
// Le ciel teinte légèrement la scène (pluie, neige, orage, brouillard, nuit).
import { prefs } from "../store/prefs.js";
import { locate } from "../device/geo.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { setLabel } from "../ui/labels.js";
import { state } from "../state.js";
import { moon } from "./surprises.js";

const REFRESH = 30 * 60e3, PLACE_MAX_AGE = 7 * 864e5;
const API = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const REV = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const pad = (n) => String(n).padStart(2, "0");
/** Lit des coordonnées saisies à la main : « 48.85, 2.35 », « 48,85 ; 2,35 », « 48.85 2.35 », avec ou sans nom devant (« Maison 48.85, 2.35 »).
 *  Renvoie { lat, lon, name } vérifiés (latitude -90…90, longitude -180…180), ou null si ce n'est pas un couple de nombres, ou { error } si hors limites. */
export function parseCoords(text) {
  const t = String(text || "").trim();
  const m = t.match(/^(.*?)(-?\d+(?:[.,]\d+)?)\s*°?\s*(?:[;,]|\s)\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[2].replace(",", ".")), lon = parseFloat(m[3].replace(",", "."));
  if (!isFinite(lat) || !isFinite(lon)) return null;
  if (lat < -90 || lat > 90) return { error: "Latitude hors limites : entre -90 et 90." };
  if (lon < -180 || lon > 180) return { error: "Longitude hors limites : entre -180 et 180." };
  return { lat, lon, name: m[1].replace(/[\s:,;-]+$/, "").trim().slice(0, 60) };
}
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** Code météo WMO → libellé et famille d'icône. */
function sky(code, day = 1) {
  const c = +code;
  if (c === 0) return [day ? "Ciel dégagé" : "Nuit claire", day ? "sun" : "moon", "clair"];
  if (c === 1) return ["Peu nuageux", day ? "part" : "moon", "clair"];
  if (c === 2) return ["Éclaircies", day ? "part" : "cloud", "nuages"];
  if (c === 3) return ["Couvert", "cloud", "nuages"];
  if (c === 45 || c === 48) return ["Brouillard", "fog", "brouillard"];
  if (c >= 51 && c <= 57) return ["Bruine", "rain", "pluie"];
  if (c >= 61 && c <= 67) return [c >= 65 ? "Forte pluie" : "Pluie", "rain", "pluie"];
  if (c >= 71 && c <= 77) return ["Neige", "snow", "neige"];
  if (c >= 80 && c <= 82) return [c === 82 ? "Fortes averses" : "Averses", "rain", "pluie"];
  if (c === 85 || c === 86) return ["Averses de neige", "snow", "neige"];
  if (c >= 95) return ["Orage", "storm", "orage"];
  return ["—", "cloud", "nuages"];
}
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5z"/>',
  part: '<path d="M8 4v1.6M3.6 8.4H2M4.9 5.3l1.1 1.1M12.4 6.4A4 4 0 0 0 5 9"/><path d="M8 20h10a3.6 3.6 0 0 0 .4-7.2A5.4 5.4 0 0 0 8 12.6 3.7 3.7 0 0 0 8 20z"/>',
  cloud: '<path d="M7 18h11a4 4 0 0 0 .5-8A6 6 0 0 0 7 8.5 4.8 4.8 0 0 0 7 18z"/>',
  rain: '<path d="M7 14h11a4 4 0 0 0 .5-8A6 6 0 0 0 7 4.5 4.8 4.8 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  snow: '<path d="M7 13h11a4 4 0 0 0 .5-8A6 6 0 0 0 7 3.5 4.8 4.8 0 0 0 7 13z"/><path d="M8 17v.01M12 19v.01M16 17v.01M10 21v.01M14 21v.01"/>',
  storm: '<path d="M7 13h11a4 4 0 0 0 .5-8A6 6 0 0 0 7 3.5 4.8 4.8 0 0 0 7 13z"/><path d="M12 14l-2 4h3l-2 4"/>',
  fog: '<path d="M7 12h11a4 4 0 0 0 .5-8A6 6 0 0 0 7 2.5 4.8 4.8 0 0 0 7 12z"/><path d="M4 16h16M6 19.5h12"/>'
};
const icon = (k, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.cloud}</svg>`;
const SUN_SVG = '<svg class="sun" viewBox="0 0 300 56" preserveAspectRatio="none" aria-label="Course du soleil"><line x1="0" y1="52" x2="300" y2="52" stroke="rgba(63,230,255,.35)" stroke-width="1"/><path d="M10 52 Q150 -28 290 52" fill="none" stroke="rgba(255,179,71,.55)" stroke-width="1.5" stroke-dasharray="4 4"/><circle class="sundot" cx="150" cy="12" r="6" fill="#ffb347" style="filter:drop-shadow(0 0 6px #ffb347)"/><text class="sr" x="10" y="46" fill="#7ea3b6" font-size="10" font-family="IBM Plex Mono, monospace">--:--</text><text class="ss" x="290" y="46" fill="#7ea3b6" font-size="10" font-family="IBM Plex Mono, monospace" text-anchor="end">--:--</text></svg>';

function readJSON(key) { try { return JSON.parse(prefs.get(key, "null")); } catch (e) { return null; } }
async function getJSON(url) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
  try { const r = await fetch(url, { signal: ctl.signal, cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(to); }
}

export function initWeather() {
  let place = readJSON("meteo-lieu"), cache = readJSON("meteo-cache"), busy = false;
  const unit = () => prefs.get("meteo-unite", "c");
  const T = (c) => Math.round(unit() === "f" ? c * 9 / 5 + 32 : c);
  const deg = () => (unit() === "f" ? "°F" : "°");

  // ---------- Éléments ----------
  const slot = document.querySelector(".wxslot");
  let wxm = null;
  if (slot) {
    wxm = document.createElement("div"); wxm.className = "wxm pc-only"; wxm.tabIndex = 0; wxm.dataset.menu = "meteo";
    wxm.innerHTML = '<span class="wi"></span><b class="wt">--°</b><span class="wl">Météo…</span><div class="wxpop" role="group" aria-label="Prévisions"><p class="wtop"><span class="wcity">—</span><span class="wfeel"></span></p>' + SUN_SVG + '<div class="days"></div><div class="wpick"></div><p class="wsrc"><span>Source Open-Meteo</span><span class="wage"></span></p></div>';
    slot.replaceWith(wxm);
  }
  const win = document.querySelector('.win[data-id="meteo"]');
  let mob = null;
  if (win && state.lite) {
    const pb = win.querySelector(".pb"); pb.className = "pb pb-meteo";
    pb.innerHTML = '<div class="wx-top"><div class="deg">--<sup>°C</sup></div><p><b class="wl">Météo…</b><span class="wd"></span></p></div>' + SUN_SVG + '<div class="days"></div><div class="wpick"></div><button type="button" class="btn wchg">Changer de ville</button>';
    mob = { pb, tag: win.querySelector(".tag"), pf: win.querySelector(".pf") };
    mob.tag.textContent = "MÉTÉO";
    pb.querySelector(".wchg").addEventListener("click", () => openPicker(pb.querySelector(".wpick")));
  }

  // ---------- Affichage ----------
  function sunPos(root, d) {
    if (!d || !d.daily || !d.daily.sunrise) return;
    const sr = d.daily.sunrise[0], ss = d.daily.sunset[0]; if (!sr || !ss) return;
    root.querySelectorAll(".sr").forEach((x) => { x.textContent = sr.slice(11, 16); });
    root.querySelectorAll(".ss").forEach((x) => { x.textContent = ss.slice(11, 16); });
    const m = (s) => +s.slice(11, 13) * 60 + +s.slice(14, 16), now = new Date(), n = now.getHours() * 60 + now.getMinutes();
    const p = Math.min(Math.max((n - m(sr)) / (m(ss) - m(sr)), 0), 1);
    const x = 10 + 280 * p, y = (1 - p) * (1 - p) * 52 + 2 * (1 - p) * p * -28 + p * p * 52;
    root.querySelectorAll(".sundot").forEach((c) => { c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1)); c.style.opacity = n < m(sr) || n > m(ss) ? ".35" : "1"; });
  }
  function daysHtml(d) {
    const dl = d.daily, hi = Math.max(...dl.temperature_2m_max), lo = Math.min(...dl.temperature_2m_min);
    return dl.time.slice(0, 7).map((k, i) => {
      const [y, mo, da] = k.split("-").map(Number), wd = i === 0 ? "auj" : JOURS[new Date(y, mo - 1, da).getDay()].slice(0, 3);
      const h = 4 + 30 * (dl.temperature_2m_max[i] - lo) / Math.max(hi - lo, 1), s = sky(dl.weather_code[i]);
      const rain = dl.precipitation_probability_max && dl.precipitation_probability_max[i] != null ? " · pluie " + dl.precipitation_probability_max[i] + " %" : "";
      return `<div title="${wd} : ${s[0]}, ${T(dl.temperature_2m_min[i])}${deg()} / ${T(dl.temperature_2m_max[i])}${deg()}${rain}"><span class="di">${icon(s[1], 13)}</span>${T(dl.temperature_2m_max[i])}°<u style="height:${h.toFixed(0)}px"></u>${wd}</div>`;
    }).join("");
  }
  const ageText = () => {
    if (!cache) return "";
    const min = Math.round((Date.now() - cache.at) / 60e3), d = new Date(cache.at);
    return (navigator.onLine ? "" : "hors ligne · ") + (min < 2 ? "à l'instant" : min < 60 ? "il y a " + min + " min" : "à " + pad(d.getHours()) + ":" + pad(d.getMinutes()));
  };

  function render() {
    const d = cache && cache.data, name = (cache && cache.name) || (place && place.name) || "Ma position";
    if (!d || !d.current) {
      if (wxm) { wxm.querySelector(".wl").textContent = place ? "Météo…" : "Météo : où es-tu ?"; wxm.querySelector(".wcity").textContent = place ? name : "Position non autorisée"; }
      if (mob) { mob.pb.querySelector(".wl").textContent = place ? "Chargement…" : "Choisis ta ville"; if (mob.pf) mob.pf.lastElementChild.textContent = "—"; }
      setLabel("meteo", ""); return;
    }
    const c = d.current, s = sky(c.weather_code, c.is_day);
    const feel = c.apparent_temperature != null ? "ressenti " + T(c.apparent_temperature) + deg() + " · " : "";
    const detail = feel + "vent " + Math.round(c.wind_speed_10m) + " km/h · " + Math.round(c.relative_humidity_2m) + " %";
    if (wxm) {
      wxm.querySelector(".wi").innerHTML = icon(s[1]);
      wxm.querySelector(".wt").textContent = T(c.temperature_2m) + deg();
      wxm.querySelector(".wl").textContent = s[0];
      wxm.querySelector(".wcity").textContent = name;
      const mo = moon(); wxm.querySelector(".wfeel").textContent = detail + " · " + mo.icon + " " + mo.name.toLowerCase();
      wxm.querySelector(".days").innerHTML = daysHtml(d);
      wxm.querySelector(".wage").textContent = ageText();
      wxm.setAttribute("aria-label", `Météo à ${name} : ${T(c.temperature_2m)} degrés, ${s[0]}. Survole pour les prévisions.`);
      sunPos(wxm, d);
    }
    if (mob) {
      mob.pb.querySelector(".deg").innerHTML = T(c.temperature_2m) + "<sup>" + (unit() === "f" ? "°F" : "°C") + "</sup>";
      mob.pb.querySelector(".wl").textContent = s[0];
      mob.pb.querySelector(".wd").textContent = detail;
      mob.pb.querySelector(".days").innerHTML = daysHtml(d);
      mob.tag.textContent = name.toUpperCase();
      if (mob.pf) { mob.pf.firstElementChild.textContent = "Open-Meteo · " + ageText(); mob.pf.lastElementChild.textContent = "7 jours"; }
      sunPos(mob.pb, d);
    }
    setLabel("meteo", T(c.temperature_2m) + deg());
    document.body.dataset.sky = c.is_day ? s[2] : (s[2] === "clair" ? "nuit" : s[2]);
  }

  // ---------- Données ----------
  async function refresh(force) {
    if (!place || busy) return;
    if (!force && cache && cache.lat === place.lat && cache.lon === place.lon && Date.now() - cache.at < REFRESH) { render(); return; }
    if (!navigator.onLine) { render(); return; }
    busy = true;
    try {
      const q = `?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&timezone=auto&forecast_days=7`;
      const data = await getJSON(API + q);
      cache = { at: Date.now(), lat: place.lat, lon: place.lon, name: place.name, data };
      prefs.set("meteo-cache", JSON.stringify(cache));
      if (force) toast("Météo actualisée · " + (place.name || "ma position"));
    } catch (e) { if (force) toast("Météo indisponible pour le moment (réseau)"); }
    finally { busy = false; render(); }
  }
  async function cityName(lat, lon) {
    try {
      const r = await getJSON(`${REV}?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
      return r.city || r.locality || r.principalSubdivision || "Ma position";
    } catch (e) { return "Ma position"; }
  }
  async function useMyPosition(manual) {
    try {
      const p = await locate();
      place = { lat: p.lat, lon: p.lon, name: await cityName(p.lat, p.lon), auto: true, at: Date.now() };
      prefs.set("meteo-lieu", JSON.stringify(place));
      if (manual) toast("Position trouvée : " + place.name);
      await refresh(true);
    } catch (e) {
      if (!place) render();
      toast(e.message === "refusée" ? "Localisation refusée : choisis ta ville (clic droit sur la météo, ou fenêtre Météo)" : "Position introuvable pour l'instant", { ms: 5000 });
    }
  }

  // ---------- Choix d'une ville ----------
  /** Retient un lieu saisi par ses coordonnées (mémorisé et chiffré par le coffre comme « meteo-lieu »). */
  async function useCoords(c, close) {
    const lat = +c.lat.toFixed(4), lon = +c.lon.toFixed(4);
    place = { lat, lon, name: c.name || (lat + ", " + lon), auto: false, manual: true, at: Date.now() };
    prefs.set("meteo-lieu", JSON.stringify(place)); close(); refresh(true);
    if (!c.name) { const n = await cityName(lat, lon).catch(() => ""); if (n && n !== "Ma position" && place && place.lat === lat && place.lon === lon) { place.name = n; prefs.set("meteo-lieu", JSON.stringify(place)); render(); } }
  }
  function openPicker(box) {
    if (!box) return;
    box.innerHTML = ""; box.classList.add("open");
    const f = document.createElement("form"); f.className = "addrow"; f.autocomplete = "off";
    const inp = document.createElement("input"); inp.className = "inl"; inp.type = "search"; inp.placeholder = "Ville, ou coordonnées : 48.85, 2.35"; inp.setAttribute("aria-label", "Ville");
    const ul = document.createElement("div"); ul.className = "wres";
    const mine = document.createElement("button"); mine.type = "button"; mine.className = "btn"; mine.textContent = "📍 Ma position";
    mine.addEventListener("click", () => { close(); useMyPosition(true); });
    const cf = document.createElement("form"); cf.className = "addrow wcoord"; cf.autocomplete = "off";
    const mk = (ph, lab) => { const i = document.createElement("input"); i.className = "inl"; i.type = "text"; i.inputMode = "decimal"; i.placeholder = ph; i.setAttribute("aria-label", lab); return i; };
    const la = mk("Latitude (48.85)", "Latitude"), lo = mk("Longitude (2.35)", "Longitude"), nm = mk("Nom (facultatif)", "Nom du lieu"); nm.inputMode = "text";
    const go = document.createElement("button"); go.type = "submit"; go.className = "btn"; go.textContent = "Utiliser ces coordonnées";
    const cm = document.createElement("p"); cm.className = "wcmsg"; cm.setAttribute("role", "alert");
    cf.append(la, lo, nm, go, cm);
    [la, lo, nm].forEach((x) => x.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); }));
    cf.addEventListener("submit", (e) => {
      e.preventDefault(); const r = parseCoords(la.value + " ; " + lo.value);
      if (!r) { cm.textContent = "Entre deux nombres, par exemple 48.85 et 2.35."; return; }
      if (r.error) { cm.textContent = r.error; return; }
      useCoords({ lat: r.lat, lon: r.lon, name: nm.value.trim().slice(0, 60) }, close);
    });
    f.append(inp); box.append(f, ul, cf, mine);
    const close = () => { box.innerHTML = ""; box.classList.remove("open"); if (wxm) wxm.classList.remove("pinned"); };
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const v = inp.value.trim(); if (!v) return;
      const pc = parseCoords(v);
      if (pc) { if (pc.error) { ul.textContent = pc.error; return; } useCoords(pc, close); return; }
      ul.textContent = "Recherche…";
      try {
        const r = await getJSON(`${GEO}?name=${encodeURIComponent(v)}&count=6&language=fr&format=json`);
        ul.innerHTML = "";
        (r.results || []).forEach((c) => {
          const b = document.createElement("button"); b.type = "button"; b.className = "btn";
          b.textContent = c.name + (c.admin1 ? " · " + c.admin1 : "") + (c.country_code && c.country_code !== "FR" ? " (" + c.country_code + ")" : "");
          b.addEventListener("click", () => { place = { lat: +c.latitude.toFixed(3), lon: +c.longitude.toFixed(3), name: c.name, auto: false, at: Date.now() }; prefs.set("meteo-lieu", JSON.stringify(place)); close(); refresh(true); });
          ul.append(b);
        });
        if (!ul.children.length) ul.textContent = "Aucune ville trouvée.";
      } catch (err) { ul.textContent = "Recherche impossible (réseau)."; }
    });
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") close(); });
    if (wxm) wxm.classList.add("pinned");
    inp.focus();
  }

  if (wxm) {
    registerMenu("meteo", () => [{ h: "Météo" + (place && place.name ? " · " + place.name : "") },
      { t: "Actualiser", fn: () => refresh(true) },
      { t: unit() === "f" ? "Afficher en °C" : "Afficher en °F", fn: () => { prefs.set("meteo-unite", unit() === "f" ? "c" : "f"); render(); } },
      { t: "Changer de ville", fn: () => openPicker(wxm.querySelector(".wpick")) },
      { t: "Utiliser ma position", fn: () => useMyPosition(true) }]);
    addEventListener("pointerdown", (e) => { if (wxm.classList.contains("pinned") && !wxm.contains(e.target) && !e.target.closest(".ctx")) { wxm.querySelector(".wpick").innerHTML = ""; wxm.classList.remove("pinned"); } }, true);
  }

  // ---------- Démarrage ----------
  render();
  if (!place || (place.auto && Date.now() - (place.at || 0) > PLACE_MAX_AGE)) useMyPosition(false);
  else refresh(false);
  setInterval(() => refresh(false), 5 * 60e3);           // vérifie toutes les 5 min, recharge si plus de 30 min
  setInterval(() => { const d = cache && cache.data; if (wxm) { sunPos(wxm, d); wxm.querySelector(".wage").textContent = ageText(); } if (mob) sunPos(mob.pb, d); }, 60e3);
  addEventListener("online", () => refresh(false));
  return { refresh, useMyPosition };
}
