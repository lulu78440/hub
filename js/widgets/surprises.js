// Phase 4 · Surprises (inventées avec Opus, dévoilées à la livraison). Chacune se coupe dans Diag → Surprises.
// 1. Briefing holographique : à la première ouverture du jour, le noyau te résume la journée (météo, tâches, rendez-vous, lune, sauvegarde).
// 2. Constellation des exploits : chaque tâche cochée allume une étoile durable autour du noyau (survol = la tâche et sa date).
// 3. Mode Focus : un minuteur de concentration (25 ou 50 min) dessiné en anneau autour de l'orbe ; tout le reste s'estompe.
// 4. Hyperespace : maintiens la barre Espace sur le fond (ou ↑ ↑ ↓ ↓ ← → ← → B A, ou « hyper ») et le hub passe en vitesse lumière.
// 5. Phase de la lune, calculée sur l'appareil, dans le briefing et la météo.
// Rien ne sort de l'appareil ; tout respecte « mouvement réduit ».
import { store } from "../store/storage.js";
import { prefs } from "../store/prefs.js";
import { sound } from "../device/sound.js";
import { notify } from "../device/notify.js";
import { toast } from "../ui/toast.js";
import { extendMenu } from "../ui/menus.js";
import { daysFrom, dayKey } from "./when.js";
import { state, pulse } from "../state.js";
// Lecture seule : flux.json déjà gardé par la phase 3 (rien n'est modifié côté actualité)
import { flux } from "./flux.js";

const ON = (k) => prefs.on("surprise-" + k);
const pad = (n) => String(n).padStart(2, "0");
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/** Phase de la lune (0 = nouvelle, 0.5 = pleine), à partir d'une nouvelle lune connue (6 janvier 2000 18:14 UTC). */
export function moon(d = new Date()) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const p = (((d.getTime() - ref) / 864e5) % syn + syn) % syn / syn;
  const names = [[0.03, "Nouvelle lune", "🌑"], [0.22, "Premier croissant", "🌒"], [0.28, "Premier quartier", "🌓"], [0.47, "Lune gibbeuse croissante", "🌔"], [0.53, "Pleine lune", "🌕"], [0.72, "Lune gibbeuse décroissante", "🌖"], [0.78, "Dernier quartier", "🌗"], [0.97, "Dernier croissant", "🌘"], [1.01, "Nouvelle lune", "🌑"]];
  const [, name, icon] = names.find(([lim]) => p < lim);
  return { phase: p, name, icon };
}

// ---------- Briefing : actualité majeure en France et nouveauté des sites suivis (demande de Lucien, 25/10) ----------
const STOP = new Set("avant apres alors aussi autre avoir cette comme contre depuis donc elles entre encore faire leurs mais meme notre nous pendant peut plus pour quand quel quelle sans selon sont sous tous tout toute toutes votre vous avec dans chez leur etait etre font fait france francais francaise".split(" "));
const words = (t) => new Set((t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !STOP.has(w)));
const fresh = (iso, h) => { const t = Date.parse(iso || ""); return t && Date.now() - t < h * 36e5; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
const cut = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
/** Le titre « France » le plus repris par les autres sources ces dernières 24 h (sinon le plus récent). */
function franceHeadline(d) {
  const all = (d.actus || []).filter((a) => fresh(a.date, 24));
  const fr = all.filter((a) => a.cat === "FRANCE"); if (!fr.length) return null;
  const W = all.map((a) => words(a.titre));
  let best = null, bs = -1;
  fr.forEach((a) => {
    const wa = words(a.titre);
    const echo = all.reduce((n, b, i) => n + (b !== a && b.source !== a.source && [...wa].filter((w) => W[i].has(w)).length >= 2 ? 1 : 0), 0);
    const score = echo * 3 + (Date.parse(a.date) / 36e5) * 0.02;   // repris ailleurs = majeur ; à égalité, le plus récent
    if (score > bs) { bs = score; best = a; }
  });
  return best;
}
/** Nouveauté des sites suivis : article d'un site de la Veille, vidéo d'une chaîne suivie, ou titre venu d'un site des Favoris.
 *  Seulement si elle est parue depuis le dernier briefing (au plus 36 h) : rien d'ancien, rien d'inventé. */
async function siteNews(d, since, skip) {
  const favHosts = new Set((await store.all("favs")).map((f) => host(f.url)).filter(Boolean));
  const c = [];
  (d.sites || []).forEach((s) => (s.articles || []).forEach((a) => c.push({ ...a, from: s.nom })));
  (d.videos || []).forEach((v) => c.push({ ...v, from: v.source || "YouTube", video: true }));
  (d.actus || []).forEach((a) => { const h = host(a.lien); if (h && favHosts.has(h)) c.push({ ...a, from: a.source || h }); });
  return c.filter((a) => a.titre && a.lien !== (skip && skip.lien) && fresh(a.date, 36) && Date.parse(a.date) > since)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null;
}

export function initSurprises({ force, plans, wins }) {
  const anchor = document.getElementById("anchor");
  const core = () => { const r = anchor.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: Math.max(50, Math.min(r.width, r.height) * 0.3) }; };

  // ---------- 1. Briefing holographique ----------
  const brief = document.createElement("div"); brief.className = "brief"; brief.hidden = true; brief.setAttribute("role", "status");
  document.body.append(brief);
  async function briefing(force = false) {
    if (!force && (!ON("briefing") || prefs.get("briefing-jour", "") === dayKey() || new Date().getHours() < 5)) return;
    prefs.set("briefing-jour", dayKey());
    const now = new Date(), h = now.getHours();
    const hello = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
    const tasks = (await store.all("tasks")).filter((t) => !t.done);
    const today = tasks.filter((t) => t.due && daysFrom(t.due) <= 0), urgent = tasks.filter((t) => t.prio);
    const m = now.getHours() * 60 + now.getMinutes();
    const evs = (await store.all("events")).filter((e) => e.date === dayKey() && e.start).sort((a, b) => a.start.localeCompare(b.start));
    const next = evs.find((e) => +e.start.slice(0, 2) * 60 + +e.start.slice(3) > m);
    let wx = null; try { wx = JSON.parse(prefs.get("meteo-cache", "null")); } catch (e) { wx = null; }
    const lines = [`${hello} Lucien · ${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(now)}`];
    if (wx && wx.data && wx.data.current) lines.push(`${Math.round(wx.data.current.temperature_2m)}° à ${wx.name || "ta position"} · max ${Math.round(wx.data.daily.temperature_2m_max[0])}°`);
    lines.push(tasks.length ? `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} à faire` + (today.length ? `, dont ${today.length} pour aujourd'hui` : "") + (urgent.length ? ` · ${urgent.length} urgente${urgent.length > 1 ? "s" : ""}` : "") : "Aucune tâche en attente : journée libre");
    lines.push(next ? `Prochain rendez-vous : ${next.start} · ${next.title}` : evs.length ? "Plus de rendez-vous aujourd'hui" : "Aucun rendez-vous aujourd'hui");
    // Actualité et nouveauté (si le flux est disponible ; 3 s au plus pour l'actualiser)
    let fr = null, nw = null;
    try {
      const d = await Promise.race([flux.refresh(), new Promise((r) => setTimeout(r, 3000))]) || flux.data;
      if (!force) { prefs.set("briefing-avant", prefs.get("briefing-vu", "0")); prefs.set("briefing-vu", String(Date.now())); }
      if (d) { fr = franceHeadline(d); nw = await siteNews(d, +prefs.get("briefing-avant", "0") || 0, fr); }
    } catch (e) { /* pas d'actualité : le briefing reste complet sans elle */ }
    if (fr) lines.push({ t: `À la une · ${cut(fr.titre, 110)}`, href: fr.lien, src: fr.source });
    if (nw) lines.push({ t: `${nw.video ? "Nouvelle vidéo" : "Nouveau"} · ${nw.from} : ${cut(nw.titre, 90)}`, href: nw.lien });
    const mo = moon(now); lines.push(`${mo.icon} ${mo.name}`);
    const last = Date.parse(prefs.get("dernier-export", "")) || 0;
    if (!last || Date.now() - last > 7 * 864e5) lines.push("Pense à exporter tes données (Diag)");
    brief.innerHTML = '<span class="bh">BRIEFING · ' + pad(h) + ":" + pad(now.getMinutes()) + "</span>";
    lines.forEach((l, i) => {
      const p = document.createElement("p"); p.style.animationDelay = (i * 0.35) + "s"; if (i === 0) p.className = "b1";
      if (typeof l === "string") p.textContent = l;
      else { const a = document.createElement("a"); a.href = l.href; a.target = "_blank"; a.rel = "noopener"; a.className = "blink"; a.textContent = l.t; if (l.src) a.title = l.src; p.append(a); }
      brief.append(p);
    });
    brief.hidden = false; pulse(1.2); sound.play("doux");
    clearTimeout(briefing.t); briefing.t = setTimeout(() => { brief.hidden = true; }, 14000 + lines.length * 400);
  }
  brief.addEventListener("click", () => { brief.hidden = true; });

  // ---------- Calque sous les fenêtres (demande de Lucien, 25/10) ----------
  // L'anneau du Focus, son compte à rebours et la constellation se dessinent ici : au-dessus de la 3D, SOUS les fenêtres
  // (la fenêtre choisie reste toujours au premier plan). Le calque des effets de souris, lui, reste au-dessus.
  const ucv = document.createElement("canvas"); ucv.id = "surprises-sous"; ucv.className = "pc-only"; ucv.setAttribute("aria-hidden", "true");
  ucv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;display:block";
  const world = document.getElementById("world"); world.parentNode.insertBefore(ucv, world);
  const ug = ucv.getContext("2d"), uLayers = [];
  const usize = () => { ucv.width = innerWidth; ucv.height = innerHeight; };
  usize(); addEventListener("resize", usize);
  let uDirty = false, uBox = { x: 0, y: 0, w: 0, h: 0 };
  const under = (fn) => uLayers.push(fn);
  force.addLayer((g, dt, F) => {
    // p4-perf : on n'efface que la zone dessinée (autour de l'orbe, plus la place de l'infobulle d'une étoile)
    if (uDirty) { const b = uBox; ug.clearRect(b.x, b.y, b.w, b.h); uDirty = false; }
    const r = anchor.getBoundingClientRect(); uBox = { x: Math.floor(r.left - 70), y: Math.floor(r.top - 70), w: Math.ceil(r.width + 70 + 360), h: Math.ceil(r.height + 140) };
    uLayers.forEach((fn) => { ug.save(); const drew = fn(ug, dt, F); ug.restore(); if (drew) uDirty = true; });
  });
  setInterval(() => { if (uDirty && (state.paused || state.reduce || state.lite)) { ug.clearRect(0, 0, ucv.width, ucv.height); uDirty = false; } }, 500);
  // p4-perf : halo d'étoile dessiné une seule fois, puis simplement recopié (au lieu d'un dégradé par étoile et par image)
  const STAR = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,248,225,1)"); gr.addColorStop(0.13, "rgba(255,248,230,1)"); gr.addColorStop(0.3, "rgba(255,200,120,.55)"); gr.addColorStop(1, "rgba(255,179,71,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c; })();

  // ---------- 2. Constellation des exploits ----------
  let stars = [];
  async function loadStars() {
    const done = (await store.all("tasks")).filter((t) => t.done && t.doneAt).sort((a, b) => a.doneAt - b.doneAt).slice(-120);
    let saved = {}; try { saved = JSON.parse(prefs.get("constellation", "{}")) || {}; } catch (e) { saved = {}; }
    // Étoiles déjà nées gardées (même si la tâche a été effacée), nouvelles ajoutées
    done.forEach((t) => { if (!saved[t.id]) { const a = Math.random() * 6.283, r = 1.25 + Math.random() * 0.55; saved[t.id] = { a, r, y: (Math.random() - 0.5) * 0.9, at: t.doneAt, n: t.text.slice(0, 60), born: Date.now() }; } });
    const ids = Object.keys(saved).sort((a, b) => saved[a].at - saved[b].at).slice(-150);
    saved = Object.fromEntries(ids.map((id) => [id, saved[id]]));
    prefs.set("constellation", JSON.stringify(saved));
    stars = ids.map((id) => ({ ...saved[id], id }));
  }
  store.on("tasks", loadStars); loadStars();
  // Ajustement validé par Lucien (25/10) : étoiles plus grandes et plus lumineuses, rangées dans un anneau autour de l'orbe
  // (jamais sur les fenêtres : bornées par la zone de l'orbe), groupées par 5 en figures reliées par des traits.
  // Place calculée depuis l'identifiant de la tâche : stable d'une ouverture à l'autre.
  const hash = (str, k) => { let h = 2166136261 ^ k; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
  let hoverStar = null, t0 = 0;
  under((g, dt, F) => {
    t0 += dt;
    if (!ON("constellation") || !stars.length || plans.zoom < 0.8) return false;
    const c = core(), box = anchor.getBoundingClientRect();
    const inner = c.R * 1.45, outerX = Math.max(inner + 20, Math.min(box.width / 2 - 14, c.R * 2.7)), outerY = Math.max(30, Math.min(box.height / 2 - 14, outerX * 0.55));
    const spin = t0 * 0.02, pos = [];
    stars.forEach((s, i) => {
      const grp = Math.floor(i / 5), k = i % 5, id = s.id || String(s.at);
      const base = hash("g" + grp, 7) * 6.283, a = base + (k - 2) * 0.16 + (hash(id, 1) - 0.5) * 0.12 + spin;
      const f = 0.15 + hash(id, 2) * 0.85, rx = inner + (outerX - inner) * f, ry = inner * 0.55 + (outerY - inner * 0.55) * f;
      pos.push({ x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * ry, grp });
    });
    // Figures : traits entre les étoiles d'un même groupe
    g.lineWidth = 1.2;
    for (let i = 1; i < pos.length; i++) if (pos[i].grp === pos[i - 1].grp) {
      g.strokeStyle = "rgba(255,190,110,.32)"; g.beginPath(); g.moveTo(pos[i - 1].x, pos[i - 1].y); g.lineTo(pos[i].x, pos[i].y); g.stroke();
    }
    hoverStar = null;
    stars.forEach((s, i) => {
      const { x, y } = pos[i];
      const fresh = Math.max(0, 1 - (Date.now() - (s.born || 0)) / 4000), tw = 0.75 + 0.25 * Math.sin(t0 * 2 + i * 1.7);
      const near = F.fin && Math.hypot(F.fmx - x, F.fmy - y) < 14; if (near) hoverStar = { s, x, y };
      const rad = (near ? 5 : 3) + fresh * 8, d = rad * 6.8;
      g.globalAlpha = Math.min(1, tw); g.drawImage(STAR, x - d / 2, y - d / 2, d, d); g.globalAlpha = 1;
    });
    if (hoverStar) {
      const d = new Date(hoverStar.s.at), txt = "★ " + hoverStar.s.n + " · " + pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
      g.font = "500 12px 'IBM Plex Mono', monospace"; const w = g.measureText(txt).width + 14;
      g.fillStyle = "rgba(3,13,24,.92)"; g.fillRect(hoverStar.x + 12, hoverStar.y - 24, w, 20);
      g.fillStyle = "#ffd9a8"; g.fillText(txt, hoverStar.x + 19, hoverStar.y - 10);
    }
    return true;
  });

  // ---------- 3. Mode Focus ----------
  let focus = null;   // { end, total, win }
  function startFocus(min, winEl) {
    if (!ON("focus")) { toast("Mode Focus coupé dans Diag → Surprises"); return; }
    focus = { end: Date.now() + min * 60e3, total: min * 60e3, win: winEl || null };
    document.body.classList.add("focus"); if (winEl) winEl.classList.add("focused");
    toast(`Focus ${min} min : concentre-toi, le hub veille`); pulse(1);
  }
  function stopFocus(done) {
    if (!focus) return;
    document.body.classList.remove("focus"); if (focus.win) focus.win.classList.remove("focused");
    focus = null;
    if (done) { sound.play("rappel"); toast("Focus terminé : bravo, fais une pause", { ms: 6000 }); if (document.hidden) notify.show("Hub · Focus terminé", "Bravo : fais une pause", "hub-focus"); pulse(1.5); }
  }
  // Ajustement validé par Lucien (25/10) : anneau plus épais et lumineux, compte à rebours qui tourne autour de l'orbe
  // (écrit le long du cercle, il suit la tête de l'anneau), voile sombre uniforme au lieu du flou.
  under((g) => {
    if (!focus) return false;
    const left = focus.end - Date.now(); if (left <= 0) { stopFocus(true); return false; }
    const c = core(), p = 1 - left / focus.total, R = c.R * 1.25, a0 = -Math.PI / 2, head = a0 + p * 6.283;
    g.save(); g.lineCap = "round";
    g.lineWidth = 9; g.strokeStyle = "rgba(255,179,71,.14)"; g.beginPath(); g.arc(c.x, c.y, R, 0, 6.283); g.stroke();
    if (p > 0.001) {
      g.lineWidth = 14; g.strokeStyle = "rgba(255,179,71,.18)"; g.beginPath(); g.arc(c.x, c.y, R, a0, head); g.stroke();   // lueur
      g.lineWidth = 6; g.strokeStyle = "rgba(255,206,130,.98)"; g.beginPath(); g.arc(c.x, c.y, R, a0, head); g.stroke();
    }
    const hx = c.x + Math.cos(head) * R, hy = c.y + Math.sin(head) * R;
    const hg = g.createRadialGradient(hx, hy, 0, hx, hy, 18); hg.addColorStop(0, "rgba(255,248,225,1)"); hg.addColorStop(1, "rgba(255,179,71,0)");
    g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 18, 0, 6.283); g.fill();
    // Compte à rebours écrit le long du cercle, centré sur la tête de l'anneau, à l'extérieur
    const mm = Math.floor(left / 60e3), ss = Math.floor(left / 1e3) % 60, txt = pad(mm) + ":" + pad(ss);
    g.font = "700 24px Orbitron, sans-serif"; g.fillStyle = "rgba(255,232,195,.98)"; g.textAlign = "center"; g.textBaseline = "middle";
    const Rt = R + 30, widths = [...txt].map((ch) => g.measureText(ch).width + 2), total = widths.reduce((x, y) => x + y, 0);
    // Moitié haute : lettres dans le sens des aiguilles ; moitié basse : sens inverse, pour rester lisible (jamais à l'envers)
    const low = Math.sin(head) > 0, dir = low ? -1 : 1, Rl = low ? Rt + 8 : Rt;
    let ang = head - dir * total / 2 / Rl;
    [...txt].forEach((ch, i) => {
      const m = ang + dir * widths[i] / 2 / Rl;
      g.save(); g.translate(c.x + Math.cos(m) * Rl, c.y + Math.sin(m) * Rl); g.rotate(m + (low ? -Math.PI / 2 : Math.PI / 2)); g.fillText(ch, 0, 0); g.restore();
      ang += dir * widths[i] / Rl;
    });
    g.restore();
    return true;
  });
  setInterval(() => { if (focus && focus.end <= Date.now()) stopFocus(true); }, 1000);   // aussi quand le dessin est coupé (onglet caché)

  // ---------- 4. Hyperespace ----------
  let warp = 0;
  const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let seq = [], typed = "";
  // Déclencheur principal (demande de Lucien, 25/10) : maintenir la barre Espace 0,6 s sur le fond. Le noyau se charge pendant l'appui.
  const HOLD_MS = 600;
  let spaceT = null, spaceFired = false;
  const canHyper = () => ON("hyper") && !state.lite && !state.reduce && warp <= 0;
  const isSpace = (e) => e.code === "Space" || e.key === " ";
  addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (isSpace(e) && !(e.target.closest && e.target.closest("button, a, [role='button'], [tabindex]"))) {
      e.preventDefault();
      if (e.repeat || spaceT || spaceFired) return;
      if (state.reduce && ON("hyper")) { hyper(); spaceFired = true; return; }   // affiche le message « mouvement réduit »
      if (!canHyper()) return;
      state.energyTarget = 0.9; pulse(0.5);
      spaceT = setTimeout(() => { spaceT = null; spaceFired = true; hyper(); }, HOLD_MS);
      return;
    }
    seq = seq.concat(e.key.length === 1 ? e.key.toLowerCase() : e.key).slice(-CODE.length);
    typed = (typed + (e.key.length === 1 ? e.key.toLowerCase() : " ")).slice(-5);
    if (seq.join() === CODE.join() || typed === "hyper") { seq = []; typed = ""; hyper(); }
  });
  const releaseSpace = () => { if (spaceT) { clearTimeout(spaceT); spaceT = null; state.energyTarget = 0; } spaceFired = false; };
  addEventListener("keyup", (e) => { if (isSpace(e)) releaseSpace(); });
  addEventListener("blur", releaseSpace);
  function hyper() {
    if (!ON("hyper") || state.lite || state.reduce) { if (state.reduce) toast("Hyperespace désactivé : « mouvement réduit » est demandé par Windows"); return; }
    warp = WARP; state.energyTarget = 1.6; state.accent = 0x9b72ff; sound.play("rappel", true); toast("Saut en hyperespace…");
    sparks.length = 0; waves = [0, 0.45, 1.05, 1.75]; burst = 260;
    document.body.classList.add("hyperon", "hypertr");
    clearTimeout(hyper.t); hyper.t = setTimeout(() => { if (warp > 0) { warp = 0; sparks.length = 0; } endHyper(); }, WARP * 1000 + 400);   // garde-fou si le dessin s'arrête (onglet caché)
    setTimeout(() => { state.energyTarget = 0; state.accent = null; }, 3000);
  }
  // Effets (demande de Lucien, 25/10) : tout l'écran vibre, l'interface se floute, l'orbe déverse de l'énergie
  // (ondes de choc, éclairs, gerbes de particules), en plus des traits de vitesse lumière. Durée 3,2 s, PC seulement.
  const WARP = 3.2;
  const css = document.createElement("style");
  css.textContent = `html { background: var(--void, #02070d); }
body.hypertr .win .panel, body.hypertr header.top, body.hypertr .agband, body.hypertr .search, body.hypertr .ticker, body.hypertr .labels, body.hypertr .mthumbs { transition: filter .35s ease, opacity .35s ease; }
.brief a.blink { color: inherit; text-decoration: none; border-bottom: 1px dotted rgba(63,230,255,.55); }
.brief a.blink:hover { color: #bff8ff; border-bottom-style: solid; }
body.focus:not(.lite) .win:not(.focused) .panel { filter: brightness(.38) saturate(.6) !important; opacity: .7 !important; }
body.focus:not(.lite) .win:not(.focused):hover .panel { filter: none !important; opacity: 1 !important; }
body.hyperon .win .panel, body.hyperon header.top, body.hyperon .agband, body.hyperon .search, body.hyperon .ticker, body.hyperon .labels { filter: blur(5px) brightness(1.25) saturate(1.3); opacity: .7; }`;
  document.head.append(css);
  const streaks = Array.from({ length: 160 }, () => ({ a: Math.random() * 6.283, d: Math.random(), s: 0.4 + Math.random() }));
  const sparks = []; let waves = [], burst = 0, bolts = [], boltT = 0;
  const COLS = ["190,248,255", "120,230,255", "200,180,255", "255,255,255"];
  function spawn(c, n) {
    for (let i = 0; i < n && sparks.length < 650; i++) {
      const a = Math.random() * 6.283, v = 260 + Math.random() * 1100, r0 = c.R * (0.3 + Math.random() * 0.5);
      sparks.push({ x: c.x + Math.cos(a) * r0, y: c.y + Math.sin(a) * r0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7 + Math.random() * 1.1, age: 0, col: COLS[(Math.random() * COLS.length) | 0], w: 0.8 + Math.random() * 2.4 });
    }
  }
  function makeBolt(c, maxR) {
    const a = Math.random() * 6.283, len = maxR * (0.25 + Math.random() * 0.5), pts = [[c.x + Math.cos(a) * c.R * 0.4, c.y + Math.sin(a) * c.R * 0.4]];
    const steps = 9 + ((Math.random() * 6) | 0);
    for (let i = 1; i <= steps; i++) { const r = c.R * 0.4 + (len * i) / steps, j = (Math.random() - 0.5) * 0.35; pts.push([c.x + Math.cos(a + j) * r, c.y + Math.sin(a + j) * r]); }
    return pts;
  }
  const endHyper = () => { document.body.classList.remove("hyperon"); document.body.style.translate = ""; setTimeout(() => document.body.classList.remove("hypertr"), 500); };
  force.addLayer((g, dt) => {
    if (warp <= 0) return; warp -= dt;
    if (warp <= 0) { endHyper(); sparks.length = 0; return; }
    const c = core(), W = g.canvas.width, H = g.canvas.height, e = WARP - warp, k = Math.min(1, warp / 0.6) * Math.min(1, e / 0.4), maxR = Math.hypot(W, H) * 0.6;
    if (warp < 0.45) document.body.classList.remove("hyperon");   // l'interface revient nette pendant la retombée
    // Vibration de tout l'écran (forte au départ, puis grondement)
    const amp = (e < 0.35 ? 14 : 6) * k;
    document.body.style.translate = `${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px ${((Math.random() - 0.5) * 2 * amp).toFixed(1)}px`;
    g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    // Cœur qui irradie
    const glowR = c.R * (2.2 + 0.6 * Math.sin(e * 22)) * (0.6 + k);
    let gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowR);
    gr.addColorStop(0, `rgba(235,250,255,${(0.55 * k).toFixed(2)})`); gr.addColorStop(0.35, `rgba(120,220,255,${(0.28 * k).toFixed(2)})`); gr.addColorStop(1, "rgba(155,114,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, glowR, 0, 6.283); g.fill();
    // Ondes de choc
    waves.forEach((t0, i) => {
      const age = e - t0; if (age < 0 || age > 1.3) return;
      const r = c.R * 0.6 + age * maxR * 0.95, al = (1 - age / 1.3) * 0.75;
      g.lineWidth = 10 * (1 - age / 1.3) + 1.5; g.strokeStyle = `rgba(${i % 2 ? "190,170,255" : "150,240,255"},${al.toFixed(2)})`;
      g.beginPath(); g.arc(c.x, c.y, r, 0, 6.283); g.stroke();
      g.lineWidth = 2; g.strokeStyle = `rgba(255,255,255,${(al * 0.8).toFixed(2)})`; g.beginPath(); g.arc(c.x, c.y, r - 4, 0, 6.283); g.stroke();
    });
    // Gerbes de particules d'énergie
    if (burst) { spawn(c, burst); burst = 0; }
    if (warp > 0.6) spawn(c, Math.round(dt * 220));
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; }
      const px = s.x, py = s.y; s.vx *= 1 + dt * 0.6; s.vy *= 1 + dt * 0.6; s.x += s.vx * dt; s.y += s.vy * dt;
      const al = (1 - s.age / s.life) * k;
      g.strokeStyle = `rgba(${s.col},${al.toFixed(2)})`; g.lineWidth = s.w;
      g.beginPath(); g.moveTo(px - s.vx * dt * 2, py - s.vy * dt * 2); g.lineTo(s.x, s.y); g.stroke();
    }
    // Éclairs qui jaillissent de l'orbe
    boltT -= dt; if (boltT <= 0) { boltT = 0.07; bolts = Array.from({ length: e < 0.5 ? 7 : 4 }, () => makeBolt(c, maxR)); }
    bolts.forEach((pts) => {
      [[7, `rgba(140,200,255,${(0.22 * k).toFixed(2)})`], [2, `rgba(240,250,255,${(0.9 * k).toFixed(2)})`]].forEach(([w, col]) => {
        g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => g.lineTo(x, y)); g.stroke();
      });
    });
    // Traits de vitesse lumière
    streaks.forEach((s) => {
      s.d += dt * s.s * 1.6; if (s.d > 1) s.d -= 1;
      const r1 = s.d * s.d * maxR, r2 = r1 + (20 + s.d * 160) * k;
      g.strokeStyle = `rgba(${s.s > 1.1 ? "200,180,255" : "190,248,255"},${(0.75 * k * s.d + 0.05).toFixed(2)})`; g.lineWidth = 1 + s.d * 2.2;
      g.beginPath(); g.moveTo(c.x + Math.cos(s.a) * r1, c.y + Math.sin(s.a) * r1); g.lineTo(c.x + Math.cos(s.a) * r2, c.y + Math.sin(s.a) * r2); g.stroke();
    });
    g.restore();
    // Éclair blanc au départ, voile lumineux ensuite
    g.fillStyle = `rgba(220,240,255,${(e < 0.18 ? 0.45 * (1 - e / 0.18) + 0.12 * k : 0.12 * k).toFixed(3)})`; g.fillRect(0, 0, W, H);
  });

  // ---------- 5b. Pleine lune dans le ciel 3D (demande de Lucien, 25/10) ----------
  // Visible seulement les nuits de pleine lune (phase 0,47 → 0,53, environ 3 nuits par mois), dans le ciel derrière l'orbe.
  let moon3d = null;
  document.addEventListener("hub:scene", ({ detail: { THREE, scene, lite } }) => {
    // Texture réaliste dessinée une seule fois : gris neutre, mers aux contours irréguliers, grain des hauts plateaux,
    // cratères éclairés de côté (fond sombre, rebord clair), éjectas, Tycho et Copernic avec leurs rayons, bord assombri.
    const c = document.createElement("canvas"); c.width = c.height = lite ? 384 : 1024;
    const g = c.getContext("2d"), S = c.width, R = S / 2 - 2, rnd = mulberry(7), u = S / 1024;
    g.save(); g.beginPath(); g.arc(S / 2, S / 2, R, 0, 6.283); g.clip();
    g.fillStyle = "#bdbdb8"; g.fillRect(0, 0, S, S);
    // Grain des hauts plateaux
    for (let i = 0; i < (lite ? 2500 : 14000); i++) { const v = rnd() < 0.5 ? "255,255,250" : "60,60,62"; g.fillStyle = `rgba(${v},${(0.04 + rnd() * 0.08).toFixed(3)})`; g.fillRect(rnd() * S, rnd() * S, (1 + rnd() * 2) * u, (1 + rnd() * 2) * u); }
    // Mers : chaque mer = un amas de taches qui se chevauchent (contours irréguliers)
    g.filter = `blur(${3 * u}px)`;
    [[0.40, 0.30, 0.13], [0.30, 0.42, 0.15], [0.55, 0.33, 0.09], [0.60, 0.47, 0.10], [0.40, 0.55, 0.09], [0.22, 0.30, 0.07], [0.70, 0.40, 0.05], [0.50, 0.62, 0.06]].forEach(([x, y, r]) => {
      for (let k = 0; k < 18; k++) { const a = rnd() * 6.283, d = rnd() * r * 0.8, rr = r * (0.25 + rnd() * 0.45); g.fillStyle = `rgba(50,52,58,${(0.4 + rnd() * 0.2).toFixed(2)})`; g.beginPath(); g.arc((x + Math.cos(a) * d) * S, (y + Math.sin(a) * d) * S, rr * S, 0, 6.283); g.fill(); }
    });
    g.filter = "none";
    // Cratères éclairés depuis la gauche
    const crater = (x, y, r, ejecta) => {
      if (ejecta) { const eg = g.createRadialGradient(x, y, r, x, y, r * 2.6); eg.addColorStop(0, "rgba(255,255,250,.22)"); eg.addColorStop(1, "rgba(255,255,250,0)"); g.fillStyle = eg; g.beginPath(); g.arc(x, y, r * 2.6, 0, 6.283); g.fill(); }
      g.fillStyle = "rgba(25,25,30,.8)"; g.beginPath(); g.arc(x - r * 0.12, y, r * 0.92, 0, 6.283); g.fill();      // fond dans l'ombre
      g.fillStyle = "rgba(170,170,165,.5)"; g.beginPath(); g.arc(x + r * 0.15, y, r * 0.6, 0, 6.283); g.fill();     // fond éclairé
      g.strokeStyle = "rgba(255,255,248,.95)"; g.lineWidth = Math.max(1.5 * u, r * 0.22); g.beginPath(); g.arc(x, y, r, -1.2, 1.2); g.stroke();   // rebord éclairé (côté droit)
      g.strokeStyle = "rgba(40,40,45,.45)"; g.lineWidth = Math.max(1, r * 0.12); g.beginPath(); g.arc(x, y, r, 1.9, 4.4); g.stroke();      // rebord dans l'ombre
    };
    for (let i = 0; i < (lite ? 70 : 170); i++) { const r = (3 + Math.pow(rnd(), 3) * 34) * u; crater(rnd() * S, rnd() * S, r, r > 18 * u && rnd() < 0.5); }
    // Tycho (sud) et Copernic, avec leurs rayons clairs
    [[0.46, 0.80, 16, 22], [0.37, 0.47, 14, 12]].forEach(([x, y, r, n]) => {
      g.strokeStyle = "rgba(255,255,250,.13)";
      for (let i = 0; i < n; i++) { const a = rnd() * 6.283, l = (0.1 + rnd() * 0.32) * S; g.lineWidth = (1 + rnd() * 3) * u; g.beginPath(); g.moveTo(x * S, y * S); g.lineTo(x * S + Math.cos(a) * l, y * S + Math.sin(a) * l); g.stroke(); }
      crater(x * S, y * S, r * u, true);
    });
    // Assombrissement du bord
    const gr = g.createRadialGradient(S / 2, S / 2, R * 0.55, S / 2, S / 2, R); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(8,12,20,.6)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S); g.restore();
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    // Teinte sombre : la lueur de la scène (bloom sans seuil) éclaircit tout ; plus clair, les cratères disparaissent.
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x2e3338, fog: false, depthWrite: false, transparent: true }));
    // Halo bleuté autour
    const hc = document.createElement("canvas"); hc.width = hc.height = 128; const hg = hc.getContext("2d");
    const hr = hg.createRadialGradient(64, 64, 20, 64, 64, 64); hr.addColorStop(0, "rgba(190,215,255,.55)"); hr.addColorStop(0.45, "rgba(150,190,255,.14)"); hr.addColorStop(1, "rgba(150,190,255,0)");
    hg.fillStyle = hr; hg.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.12 }));
    const grp = new THREE.Group(); grp.add(glow, disc); grp.renderOrder = -10; disc.renderOrder = glow.renderOrder = -10;
    scene.add(grp);
    // Place choisie par Lucien (A) : dans le ciel libre, en haut à gauche de l'orbe, entre les deux colonnes de fenêtres.
    const D = 10; grp.position.set(-7.5, 7.2, -45); disc.scale.set(D, D, 1); glow.scale.set(D * 2.4, D * 2.4, 1);
    moon3d = { grp };
    showMoon();
  });
  function showMoon(forceOn) {
    if (!moon3d) return;
    const p = moon().phase;
    moon3d.grp.visible = forceOn ?? (ON("lune") && p >= 0.47 && p < 0.53);
  }
  setInterval(() => showMoon(), 30 * 60e3);

  // ---------- Menus et réglages ----------
  extendMenu("fond", () => (focus ? [{ t: "Arrêter le Focus", fn: () => stopFocus(false) }] : [{ t: "Focus 25 min", fn: () => startFocus(25) }, { t: "Focus 50 min", fn: () => startFocus(50) }])
    .concat([{ t: "Revoir le briefing du jour", fn: () => briefing(true) }]));
  extendMenu("fenetre", (el) => focus ? [] : [{ t: "Focus 25 min sur cette fenêtre", fn: () => startFocus(25, el) }]);
  const list = [["briefing", "Briefing holographique du matin"], ["constellation", "Constellation des tâches accomplies"], ["focus", "Mode Focus autour de l'orbe"], ["hyper", "Hyperespace (maintenir la barre Espace)"], ["lune", "Pleine lune dans le ciel 3D"]];
  const box = document.getElementById("surprises");
  if (box) {
    list.forEach(([k, label]) => {
      const lab = document.createElement("label"); lab.className = "chkl";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = ON(k);
      cb.addEventListener("change", () => { prefs.setOn("surprise-" + k, cb.checked); if (k === "constellation") pulse(0.6); if (k === "lune") showMoon(); });
      lab.append(cb, document.createTextNode(" " + label)); box.append(lab);
    });
  }
  setTimeout(() => briefing(false), 2500);
  return { briefing, startFocus, stopFocus, hyper, moon, moonPreview: (on = true) => showMoon(on) };
}
