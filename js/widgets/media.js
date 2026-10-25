// Médias (3.3) : Vidéo (lecteur YouTube intégré, vidéos à suivre, plein écran, raccourcis Netflix / Prime)
// et Musique (radios web, playlist YouTube, MP3 du PC pour la visite, grand écran animé).
// Netflix et Prime ne s'intègrent pas dans une page : ils s'ouvrent dans leur site (cahier des charges).
import { flux, ago } from "./flux.js";
import { prefs } from "../store/prefs.js";
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { state, pulse } from "../state.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const readJ = (k, d) => { try { const v = JSON.parse(prefs.get(k, "null")); return v ?? d; } catch (e) { return d; } };
const webUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");   // seuls les liens web (jamais javascript: ni data:)
const openUrl = (u) => { u = webUrl(u); if (!u) return; const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; document.body.append(a); a.click(); a.remove(); };

/** Identifiant de vidéo ou de playlist dans un lien YouTube (watch, youtu.be, shorts, embed, playlist). */
export function parseYouTube(s) {
  s = (s || "").trim();
  if (/^[\w-]{11}$/.test(s)) return { v: s, list: null };                 // identifiant seul, collé tel quel
  try {
    const u = new URL(/^https?:/i.test(s) ? s : "https://" + s), h = u.hostname.replace(/^www\.|^m\.|^music\./, "");
    let list = u.searchParams.get("list"); if (list && !/^[\w-]+$/.test(list)) list = null;     // identifiant de playlist propre ou rien
    let v = null;
    if (h === "youtu.be") v = u.pathname.slice(1).split("/")[0];
    else if (h === "youtube.com" || h === "youtube-nocookie.com") {
      v = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/) || [])[1] || null;
    } else return null;
    if (v && !/^[\w-]{11}$/.test(v)) v = null;
    if (!v && !list) return null;
    return { v, list };
  } catch (e) { return /^[\w-]{11}$/.test(s) ? { v: s, list: null } : null; }
}
// Identifiants revérifiés (ils peuvent venir d'un import ou du flux) : jamais de paramètre glissé dans l'adresse du lecteur
const embed = (y, autoplay = 1) => y.v && /^[\w-]{11}$/.test(y.v)
  ? `https://www.youtube-nocookie.com/embed/${y.v}?autoplay=${autoplay}&rel=0&playsinline=1${y.list ? "&list=" + encodeURIComponent(y.list) : ""}`
  : `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(y.list)}&autoplay=${autoplay}&rel=0&playsinline=1`;
const thumb = (v) => `https://i.ytimg.com/vi/${encodeURIComponent(v)}/hqdefault.jpg`;

// Radios web (flux directs, sans compte). On peut en ajouter depuis le menu de la fenêtre Musique.
// Anciennes adresses qui ne répondent plus → nouvelles (appliqué aux radios déjà enregistrées par l'import du Coffre ou une ancienne version)
const RADIO_FIX = {
  "https://icecast.radiofrance.fr/fip-midfi.mp3": "https://icecast.radiofrance.fr/fip-hifi.aac?id=radiofrance",
  "https://icecast.radiofrance.fr/fipelectro-midfi.mp3": "https://icecast.radiofrance.fr/fipelectro-hifi.aac?id=radiofrance",
  "https://ice2.somafm.com/spacestation-128-mp3": "https://ice.somafm.com/spacestation",
  "https://ice2.somafm.com/groovesalad-128-mp3": "https://ice.somafm.com/groovesalad"
};
export const fixRadios = (list) => { let ch = false; const out = list.map((r) => (RADIO_FIX[r.u] ? (ch = true, { ...r, u: RADIO_FIX[r.u] }) : r)); return { list: out, changed: ch }; };

export const RADIOS = [
  { n: "FIP", u: "https://icecast.radiofrance.fr/fip-hifi.aac?id=radiofrance" },
  { n: "FIP Électro", u: "https://icecast.radiofrance.fr/fipelectro-hifi.aac?id=radiofrance" },
  { n: "SomaFM · Space Station", u: "https://ice.somafm.com/spacestation" },
  { n: "SomaFM · Groove Salad", u: "https://ice.somafm.com/groovesalad" },
  { n: "France Inter", u: "https://icecast.radiofrance.fr/franceinter-midfi.mp3" },
  { n: "Radio Nova", u: "https://novazz.ice.infomaniak.ch/novazz-128.mp3" }
];

export function initMedia() {
  // ===================== Vidéo =====================
  const vw = document.querySelector('.win[data-id="video"]'), vpb = vw.querySelector(".pb"), vtag = vw.querySelector(".tag"), vpf = vw.querySelector(".pf");
  vpb.className = "pb pb-video";
  vpb.innerHTML = '<div class="player"><div class="poster"><span class="play" aria-hidden="true">▶</span><b class="vt"></b></div></div><form class="addrow vlink" autocomplete="off"><input class="inl" type="text" placeholder="Coller un lien YouTube (vidéo ou playlist)…" aria-label="Lien YouTube"><button type="button" class="btn vfs" title="Plein écran">⤢</button></form><div class="upnext"><div class="uh"><span class="sub">Vidéos à suivre</span><button type="button" class="lnk vtog"></button></div><div class="uprow"></div></div><div class="vapps"></div>';
  const player = vpb.querySelector(".player"), poster = vpb.querySelector(".poster"), vt = vpb.querySelector(".vt"), row = vpb.querySelector(".uprow"), upnext = vpb.querySelector(".upnext");
  let cur = readJ("video-courante", null), queue = readJ("video-file", []), upOpen = prefs.get("video-suivre", "1") === "1";
  [["YouTube", "https://www.youtube.com/"], ["Netflix", "https://www.netflix.com/"], ["Prime Video", "https://www.primevideo.com/"]].forEach(([n, u]) => {
    const b = el("button", "btn", n + " ↗"); b.type = "button"; b.addEventListener("click", () => openUrl(u)); vpb.querySelector(".vapps").append(b);
  });
  function list() {
    const fromFlux = ((flux.data && flux.data.videos) || []).filter((x) => x.video).map((x) => ({ v: x.video, t: x.titre, a: x.auteur, d: x.date }));
    const seen = new Set(); return queue.concat(fromFlux).filter((x) => /^[\w-]{11}$/.test(x.v || "") && !seen.has(x.v) && seen.add(x.v));
  }
  function showPoster() {
    player.querySelector("iframe")?.remove(); poster.hidden = false;
    if (cur && cur.v) { poster.style.backgroundImage = `url("${thumb(cur.v)}")`; vt.textContent = cur.t || "Vidéo YouTube"; }
    else if (cur && cur.list) { poster.style.backgroundImage = ""; vt.textContent = cur.t || "Playlist YouTube"; }
    else { poster.style.backgroundImage = ""; vt.textContent = "Colle un lien YouTube ci-dessous"; }
  }
  function play(item, autoplay = true) {
    cur = item; prefs.set("video-courante", JSON.stringify(cur));
    if (!autoplay) { showPoster(); return; }
    poster.hidden = true; player.querySelector("iframe")?.remove();
    const f = el("iframe"); f.src = embed(item); f.title = item.t || "Lecteur YouTube"; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true; f.referrerPolicy = "strict-origin-when-cross-origin";
    player.append(f); vtag.textContent = "LECTURE"; pulse(1); renderRow();
  }
  poster.addEventListener("click", () => { if (cur) play(cur); else vpb.querySelector(".vlink input").focus(); });
  function renderRow() {
    const L = list(); row.innerHTML = "";
    if (!L.length) row.append(el("p", "none", "Ajoute des chaînes YouTube aux sources (clic droit) ou colle des liens : ils s'afficheront ici."));
    L.slice(0, 12).forEach((x) => {
      const b = el("button", "thumb"); b.type = "button"; b.setAttribute("aria-pressed", String(!!cur && cur.v === x.v));
      b.style.backgroundImage = `url("${thumb(x.v)}")`; b.title = (x.t || "") + (x.a ? " · " + x.a : "") + (x.d ? " · " + ago(x.d) : "");
      const cap = el("span", "cap"); cap.append(el("b", "", x.t || "Vidéo")); b.append(cap);
      b.addEventListener("click", () => play(x));
      row.append(b);
    });
    upnext.classList.toggle("closed", !upOpen); vpb.querySelector(".vtog").textContent = upOpen ? "Masquer ▴" : "Afficher ▾";
    if (vpf) { vpf.firstElementChild.textContent = "Lecteur YouTube intégré"; vpf.lastElementChild.textContent = L.length ? L.length + " à suivre" : "—"; }
    const strip = document.querySelector('.win[data-id="strip"] .pb'); if (strip && state.lite) { strip.closest(".win").querySelector(".tag").textContent = L.length ? L.length + " À SUIVRE" : "À SUIVRE"; strip.className = "pb pb-strip"; strip.innerHTML = ""; strip.append(row.cloneNode(true)); strip.querySelectorAll(".thumb").forEach((b, i) => b.addEventListener("click", () => { play(L[i]); document.querySelector('.win[data-id="video"]').scrollIntoView({ block: "start", behavior: "smooth" }); })); }
  }
  vpb.querySelector(".vtog").addEventListener("click", () => { upOpen = !upOpen; prefs.set("video-suivre", upOpen ? "1" : "0"); renderRow(); });
  vpb.querySelector(".vlink").addEventListener("submit", (e) => {
    e.preventDefault(); const inp = vpb.querySelector(".vlink input"), y = parseYouTube(inp.value);
    if (!y) { toast("Ce n'est pas un lien YouTube"); return; }
    inp.value = ""; const item = { v: y.v, list: y.list, t: y.v ? "Vidéo ajoutée" : "Playlist YouTube" };
    if (y.v) { queue = [item].concat(queue.filter((x) => x.v !== y.v)).slice(0, 30); prefs.set("video-file", JSON.stringify(queue)); }
    play(item);
  });
  vpb.querySelector(".vlink input").addEventListener("keydown", (e) => e.stopPropagation());
  vpb.querySelector(".vfs").addEventListener("click", async () => { try { await player.requestFullscreen(); } catch (e) { toast("Plein écran refusé : F11"); } });
  registerMenu("video", (w, t) => {
    const th = t.closest(".thumb"), it = [];
    if (th) { const i = [...row.children].indexOf(th), x = list()[i]; if (x) it.push({ h: "Vidéo" }, { t: "Lire", fn: () => play(x) }, { t: "Ouvrir sur YouTube ↗", fn: () => openUrl("https://www.youtube.com/watch?v=" + x.v) }, { t: "Retirer de la liste", fn: () => { queue = queue.filter((q) => q.v !== x.v); prefs.set("video-file", JSON.stringify(queue)); renderRow(); }, off: !queue.some((q) => q.v === x.v) }, "-"); }
    it.push({ h: "Vidéo" }, { t: "Plein écran", fn: () => vpb.querySelector(".vfs").click(), off: !cur },
      { t: "Arrêter", fn: () => { showPoster(); vtag.textContent = "VIDÉO"; }, off: !player.querySelector("iframe") },
      { t: upOpen ? "Masquer les vidéos à suivre" : "Afficher les vidéos à suivre", fn: () => vpb.querySelector(".vtog").click() },
      { t: "Ajouter des chaînes YouTube (sources) ↗", fn: () => openUrl("https://github.com/lulu78440/hub/edit/main/flux/sources.json") });
    return it;
  });
  vtag.textContent = "VIDÉO"; showPoster(); renderRow(); flux.on(renderRow);

  // ===================== Musique =====================
  const mw = document.querySelector('.win[data-id="music"]'), mpb = mw.querySelector(".pb"), mtag = mw.querySelector(".tag"), mpf = mw.querySelector(".pf");
  mpb.className = "pb pb-music";
  mpb.innerHTML = '<div class="np"><div class="eq off" aria-hidden="true"><u></u><u></u><u></u><u></u><u></u><u></u></div><div><b class="mt">Rien en écoute</b><span class="ms">Choisis une radio ou tes MP3</span></div></div><div class="mctl"><button type="button" class="btn mplay">▶ Lecture</button><button type="button" class="btn mnext">Suivant</button><button type="button" class="btn mbig" title="Grand écran">⤢</button><input type="range" class="mvol" min="0" max="100" aria-label="Volume"></div><ul class="stations"></ul><div class="myt"></div><div class="erow"><button type="button" class="btn mmp3">Mes MP3…</button><button type="button" class="btn mytb">Playlist YouTube…</button></div>';
  const audio = new Audio(); audio.preload = "none";
  let radios = readJ("radios", null) || RADIOS, src = readJ("musique-source", null), mp3 = [], vol = +prefs.get("musique-volume", "60");
  { const fx = fixRadios(radios); if (fx.changed) { radios = fx.list; if (readJ("radios", null)) prefs.set("radios", JSON.stringify(radios)); if (src && src.kind === "radio") { const m = radios.find((r) => r.n === src.n); if (m) src = { ...src, u: m.u }; } } }
  audio.volume = vol / 100; mpb.querySelector(".mvol").value = vol;
  const eq = mpb.querySelector(".eq"), mt = mpb.querySelector(".mt"), ms = mpb.querySelector(".ms"), bplay = mpb.querySelector(".mplay"), ytBox = mpb.querySelector(".myt");
  function sources() { return radios.map((r) => ({ kind: "radio", n: r.n, u: r.u })).concat(mp3.map((f, i) => ({ kind: "mp3", n: f.name.replace(/\.[^.]+$/, ""), i }))); }
  function renderStations() {
    const ul = mpb.querySelector(".stations"); ul.innerHTML = "";
    sources().forEach((s) => {
      const li = el("li"); li.tabIndex = 0; const on = src && src.kind === s.kind && (s.kind === "radio" ? src.u === s.u : src.i === s.i);
      li.className = on ? "on" : ""; li.append(el("span", "", s.n), el("em", "", s.kind === "radio" ? "direct" : "mp3"));
      li.addEventListener("click", () => start(s)); li.addEventListener("keydown", (e) => { if (e.key === "Enter") start(s); });
      ul.append(li);
    });
    if (mpf) { mpf.firstElementChild.textContent = "Radios, YouTube, MP3"; mpf.lastElementChild.textContent = "vol. " + vol + " %"; }
  }
  const playing = () => !audio.paused;
  function ui() {
    eq.classList.toggle("off", !playing()); bplay.textContent = playing() ? "❚❚ Pause" : "▶ Lecture";
    mtag.textContent = playing() ? "EN ÉCOUTE" : "MUSIQUE";
    if (src) { mt.textContent = src.n; ms.textContent = (src.kind === "radio" ? "Radio web · " : src.kind === "mp3" ? "Mon MP3 · " : "YouTube · ") + (playing() ? "en écoute" : src.kind === "yt" ? "dans le lecteur" : "en pause"); }
    renderStations();
    if ("mediaSession" in navigator && src) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: src.n, artist: "Hub", album: src.kind === "radio" ? "Radio web" : "Musique" }); } catch (e) { /* ignoré */ } }
  }
  function start(s) {
    ytBox.innerHTML = "";
    src = s.kind === "radio" ? { kind: "radio", n: s.n, u: s.u } : { kind: "mp3", n: s.n, i: s.i };
    if (s.kind === "radio") prefs.set("musique-source", JSON.stringify(src));
    audio.src = s.kind === "radio" ? s.u : URL.createObjectURL(mp3[s.i]);
    audio.play().then(() => pulse(0.8)).catch(() => toast("Lecture impossible : clique encore une fois, ou cette radio ne répond pas"));
    ui();
  }
  function next() { const L = sources(); if (!L.length) return; const i = src ? L.findIndex((s) => s.n === src.n) : -1; start(L[(i + 1) % L.length]); }
  bplay.addEventListener("click", () => { if (!src) { start(sources()[0]); return; } if (src.kind === "yt") return; if (playing()) audio.pause(); else { if (!audio.src) start(src); else audio.play().catch(() => {}); } });
  mpb.querySelector(".mnext").addEventListener("click", next);
  mpb.querySelector(".mvol").addEventListener("input", (e) => { vol = +e.target.value; audio.volume = vol / 100; prefs.set("musique-volume", String(vol)); if (mpf) mpf.lastElementChild.textContent = "vol. " + vol + " %"; });
  ["play", "pause", "ended", "error"].forEach((ev) => audio.addEventListener(ev, () => { if (ev === "ended" && src && src.kind === "mp3") next(); if (ev === "error" && src && src.kind === "radio") toast("La radio « " + src.n + " » ne répond pas"); ui(); }));
  if ("mediaSession" in navigator) { try { navigator.mediaSession.setActionHandler("nexttrack", next); navigator.mediaSession.setActionHandler("play", () => audio.play()); navigator.mediaSession.setActionHandler("pause", () => audio.pause()); } catch (e) { /* ignoré */ } }
  // MP3 du PC (pour cette visite)
  const fin = el("input"); fin.type = "file"; fin.accept = "audio/*,.mp3,.m4a,.ogg,.flac,.wav"; fin.multiple = true; fin.hidden = true; document.body.append(fin);
  mpb.querySelector(".mmp3").addEventListener("click", () => fin.click());
  fin.addEventListener("change", () => { const fs = [...fin.files]; fin.value = ""; if (!fs.length) return; const base = mp3.length; mp3 = mp3.concat(fs); toast(fs.length + " morceau(x) ajouté(s) pour cette visite"); start({ kind: "mp3", n: fs[0].name.replace(/\.[^.]+$/, ""), i: base }); });
  // Playlist YouTube : le lecteur YouTube doit rester visible (règles de YouTube)
  function playYT(y) {
    audio.pause(); src = { kind: "yt", n: "Playlist YouTube", y }; prefs.set("musique-yt", JSON.stringify(y));
    ytBox.innerHTML = ""; const f = el("iframe"); f.src = embed(y); f.title = "Playlist YouTube"; f.allow = "autoplay; encrypted-media"; ytBox.append(f); ui();
  }
  mpb.querySelector(".mytb").addEventListener("click", () => {
    const v = prompt("Colle le lien d'une playlist YouTube (ou d'une vidéo) :", ""); if (!v) return;
    const y = parseYouTube(v); if (!y) { toast("Ce n'est pas un lien YouTube"); return; } playYT(y);
  });
  // Grand écran (PC) : visualisation animée
  const th = el("div", "theater pc-only"); th.hidden = true;
  th.innerHTML = '<canvas></canvas><div class="thbar"><b></b><button type="button" class="btn tplay"></button><button type="button" class="btn tnext">Suivant</button><button type="button" class="btn tclose">Quitter · Échap</button></div>';
  document.body.append(th);
  const thc = th.querySelector("canvas"), g = thc.getContext("2d"); let thRaf = 0, tt = 0, lastT = 0;
  function drawTh(now) {
    thRaf = requestAnimationFrame(drawTh); const dt = Math.min((now - lastT) / 1000 || 0, 0.05); lastT = now; tt += dt;
    const W = thc.width = thc.clientWidth, H = thc.height = thc.clientHeight, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.22, off = !playing() && !(src && src.kind === "yt");
    g.fillStyle = "#02060d"; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.4); gr.addColorStop(0, "rgba(155,114,255,.28)"); gr.addColorStop(1, "rgba(2,6,13,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.lineCap = "round";
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * 6.283 - Math.PI / 2, v = off ? 0.06 : (0.2 + 0.8 * Math.abs(Math.sin(tt * 2.1 + i * 0.37) * Math.sin(tt * 1.3 + i * 0.11))), L = R * 0.12 + v * R * 0.9;
      g.strokeStyle = i % 3 ? "rgba(63,230,255,.85)" : "rgba(155,114,255,.9)"; g.lineWidth = Math.max(2, R * 0.035);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + L), cy + Math.sin(a) * (R + L)); g.stroke();
    }
    g.strokeStyle = "rgba(160,240,255,.6)"; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R * 0.95, 0, 6.283); g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#dff6fd"; g.font = `700 ${Math.round(R * 0.13)}px Orbitron, sans-serif`;
    g.fillText(src ? src.n : "Musique", cx, cy - R * 0.08, R * 1.8);
    g.fillStyle = "#7ea3b6"; g.font = `500 ${Math.round(R * 0.08)}px 'IBM Plex Mono', monospace`; g.fillText(off ? "EN PAUSE" : "EN ÉCOUTE", cx, cy + R * 0.14);
    th.querySelector("b").textContent = src ? src.n : "Musique"; th.querySelector(".tplay").textContent = playing() ? "Pause" : "Lecture";
  }
  const openTh = () => { if (state.lite) return; th.hidden = false; lastT = performance.now(); thRaf = requestAnimationFrame(drawTh); pulse(1); };
  const closeTh = () => { if (th.hidden) return; th.hidden = true; cancelAnimationFrame(thRaf); };
  mpb.querySelector(".mbig").addEventListener("click", openTh);
  th.querySelector(".tplay").addEventListener("click", () => bplay.click());
  th.querySelector(".tnext").addEventListener("click", next);
  th.querySelector(".tclose").addEventListener("click", closeTh);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeTh(); });
  registerMenu("music", (w, t) => {
    const li = t.closest(".stations li"), it = [];
    if (li) { const s = sources()[[...li.parentNode.children].indexOf(li)]; if (s) it.push({ h: s.n }, { t: "Écouter", fn: () => start(s) }, ...(s.kind === "radio" ? [{ t: "Retirer cette radio", fn: () => { radios = radios.filter((r) => r.u !== s.u); prefs.set("radios", JSON.stringify(radios)); renderStations(); } }] : []), "-"); }
    it.push({ h: "Musique" }, { t: playing() ? "Pause" : "Lecture", fn: () => bplay.click() }, { t: "Suivant", fn: next }, { t: "Grand écran", fn: openTh },
      { t: "Ajouter une radio (adresse du flux)…", fn: () => { const u = prompt("Adresse du flux de la radio (se termine souvent par .mp3 ou .aac) :", "https://"); if (!u || !/^https:\/\//.test(u)) return; const n = prompt("Nom de la radio :", "Ma radio") || "Ma radio"; radios = radios.concat({ n, u }); prefs.set("radios", JSON.stringify(radios)); renderStations(); } },
      { t: "Remettre les radios d'origine", fn: () => { radios = RADIOS; prefs.set("radios", "null"); renderStations(); } });
    return it;
  });
  // Double-clic sur le lecteur ou sur « en écoute » : grand écran (comme la v8)
  mpb.querySelector(".np").addEventListener("dblclick", (e) => { e.stopPropagation(); openTh(); });
  ui();
  if (src) { mt.textContent = src.n; ms.textContent = "Clique « Lecture » pour reprendre"; }
  return { play, parseYouTube };
}
