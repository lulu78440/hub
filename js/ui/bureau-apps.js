// Applis du bureau (plan 3, étape p3-applis) : les panneaux fixes du plan 3 deviennent des fenêtres qu'on ouvre à la demande
// depuis les icônes du bureau : Fichiers (dossiers autorisés + fichiers récents), Ce PC (système + réglages rapides), Internet
// (recherche simplifiée, favoris, vidéo), Mails (ouvre la fenêtre Mails du hub). Chaque fenêtre se déplace par sa barre de titre,
// se réduit à son nom d'un clic sur ce titre, se redimensionne par le coin et se ferme par la croix. Position, taille et état
// sont gardés sur l'appareil (clé hub-bureau-fen-v1). Les contenus (dossiers, fichiers, réglages) restent ceux de widgets/mypc.js.
import { prefs } from "../store/prefs.js";
import { toast } from "./toast.js";
import { pulse } from "../state.js";
import { parseQuery } from "./search.js";

const KEY = "bureau-fen-v1";
const GRID = 8, MIN = { w: 320, h: 200 };

/** Liste des applis (nom, glyphe, couleur) : `fenetre` = ouvre une fenêtre du bureau ; sinon une action. */
export const HUB_APPS = [
  { k: "fichiers", name: "Fichiers", g: "folder", a: "cyan", fenetre: true },
  { k: "pc", name: "Ce PC", g: "desk", a: "ambre", fenetre: true },
  { k: "internet", name: "Internet", g: "globe", a: "violet", fenetre: true },
  { k: "mails", name: "Mails", g: "mail", a: "vert", fenetre: false }
];
const SIZE = { fichiers: [480, 460], pc: [440, 500], internet: [480, 270] };
const COL = { cyan: "cyan", ambre: "amber", violet: "violet", vert: "ok" };

export function initApps({ desk, panels: P, wins, plans }) {
  const layer = document.createElement("div"); layer.className = "dwins"; layer.setAttribute("aria-label", "Fenêtres du bureau"); desk.append(layer);
  let st = {};
  try { const d = JSON.parse(prefs.get(KEY, "{}")); if (d && typeof d === "object") st = d; } catch (e) { st = {}; }
  const save = () => prefs.set(KEY, JSON.stringify(st));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const open = {};   // k -> élément
  let zTop = 10;

  // ---------- Contenus ----------
  const sub = (t) => { const s = document.createElement("div"); s.className = "dsec"; s.textContent = t; return s; };
  const BUILD = {
    fichiers(body, win) {
      const tabs = document.createElement("div"); tabs.className = "dtabs";
      const pairs = [["Dossiers", P.dirs.pb, P.dirs.pf], ["Récents", P.rec.pb, P.rec.pf]];
      const bs = pairs.map(([t, pb, pf], i) => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.addEventListener("click", () => pick(i)); tabs.append(b); return b; });
      function pick(i) { pairs.forEach(([, pb, pf], j) => { pb.hidden = j !== i; pf.hidden = j !== i; bs[j].classList.toggle("on", j === i); bs[j].setAttribute("aria-pressed", String(j === i)); }); st.fichiers = { ...(st.fichiers || {}), tab: i }; save(); }
      body.append(tabs, P.dirs.pb, P.rec.pb); win.append(P.dirs.pf, P.rec.pf);
      pick(st.fichiers && st.fichiers.tab === 1 ? 1 : 0);
      win.querySelector(".tag").textContent = "LECTURE SEULE";
    },
    pc(body, win) {
      body.append(sub("Système"), P.sys.pb, sub("Réglages rapides"), P.set.pb); win.append(P.set.pf);
      win.querySelector(".tag").textContent = "EN DIRECT";
    },
    internet(body, win) {
      const f = document.createElement("form"); f.className = "dnet"; f.setAttribute("role", "search");
      f.innerHTML = '<div class="dnrow"><input type="search" placeholder="Rechercher, ou !y pour YouTube…" aria-label="Recherche" autocomplete="off" enterkeyhint="search"><button type="submit" class="btn">Chercher</button></div><div class="dchips" role="group" aria-label="Moteur"></div><div class="dlinks"></div>';
      const chips = f.querySelector(".dchips"), inp = f.querySelector("input"); let eng = "";
      [["", "Brave"], ["g", "Google"], ["d", "DuckDuckGo"], ["y", "YouTube"], ["v", "Vidéos"]].forEach(([k, n]) => {
        const b = document.createElement("button"); b.type = "button"; b.textContent = n; b.className = k === eng ? "on" : ""; b.setAttribute("aria-pressed", String(k === eng));
        b.addEventListener("click", () => { eng = k; [...chips.children].forEach((c) => { c.classList.toggle("on", c === b); c.setAttribute("aria-pressed", String(c === b)); }); inp.focus(); });
        chips.append(b);
      });
      f.addEventListener("submit", (e) => {
        e.preventDefault(); const v = inp.value.trim(); if (!v) return;
        const { e: en, q } = parseQuery(/^!/.test(v) || !eng ? v : "!" + eng + " " + v); if (!q) return;
        window.open(en.url + encodeURIComponent(q), "_blank", "noopener,noreferrer"); pulse(0.8);
      });
      const links = f.querySelector(".dlinks");
      [["Mes favoris", "favs"], ["Vidéo", "video"], ["Page en direct", "web"]].forEach(([n, id]) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = n; b.title = "Ouvre la fenêtre « " + n + " » du hub";
        b.addEventListener("click", () => { plans.goPlan(1); document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: id })); });
        links.append(b);
      });
      body.append(f); win.querySelector(".tag").textContent = "RECHERCHE";
      setTimeout(() => inp.focus({ preventScroll: true }), 50);
    }
  };
  const TITRE = { fichiers: "Fichiers", pc: "Ce PC", internet: "Internet" };

  // ---------- Fenêtre ----------
  const deskSize = () => ({ w: desk.clientWidth || innerWidth - 32, h: desk.clientHeight || innerHeight - 170 });
  function geom(k) {
    const d = deskSize(), s = st[k] || {}, def = SIZE[k] || [440, 360];
    const w = clamp(s.w || def[0], MIN.w, d.w), h = clamp(s.h || def[1], MIN.h, d.h);
    const slot = Object.keys(open).length;
    const x = clamp(Number.isFinite(s.x) ? s.x : 40 + (k === "pc" ? d.w - w - 80 : k === "internet" ? (d.w - w) / 2 : 0) + slot * 24, 0, Math.max(0, d.w - 120));
    const y = clamp(Number.isFinite(s.y) ? s.y : 28 + slot * 24, 0, Math.max(0, d.h - 40));
    return { x, y, w, h };
  }
  function front(el) { el.style.zIndex = String(++zTop); }
  function build(k) {
    const sec = document.createElement("section"); sec.className = "panel dp dwin"; sec.dataset.app = k;
    const app = HUB_APPS.find((a) => a.k === k), acc = COL[app.a] || "cyan"; sec.dataset.accent = acc === "ok" ? "cyan" : acc; sec.style.setProperty("--a", `var(--${acc})`);
    sec.innerHTML = '<div class="in"><div class="ph"><h2></h2><span class="hatch"></span><span class="tag"></span><button type="button" class="dx" aria-label="Fermer" title="Fermer">×</button></div><div class="dbody"></div></div><span class="dres" aria-hidden="true"></span>';
    sec.querySelector("h2").textContent = TITRE[k];
    const g = geom(k); Object.assign(sec.style, { left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.h + "px" });
    BUILD[k](sec.querySelector(".dbody"), sec.querySelector(".in"));
    if (st[k] && st[k].red) sec.classList.add("red");
    layer.append(sec); front(sec); open[k] = sec; wire(sec, k);
    return sec;
  }
  function wire(sec, k) {
    const ph = sec.querySelector(".ph"), rs = sec.querySelector(".dres");
    sec.addEventListener("pointerdown", () => front(sec), true);
    sec.querySelector(".dx").addEventListener("click", () => close(k));
    let d = null;
    ph.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      d = { x0: e.clientX, y0: e.clientY, l: sec.offsetLeft, t: sec.offsetTop, moved: false };
      try { ph.setPointerCapture(e.pointerId); } catch (err) { /* glisser sans capture */ }
    });
    ph.addEventListener("pointermove", (e) => {
      if (!d) return; if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
      if (!d.moved) { d.moved = true; sec.classList.add("dragging"); }
      const s = deskSize();
      sec.style.left = clamp(d.l + e.clientX - d.x0, -sec.offsetWidth + 120, s.w - 120) + "px"; sec.style.top = clamp(d.t + e.clientY - d.y0, 0, s.h - 40) + "px";
    });
    const endMove = (e, cancel) => {
      if (!d) return; const m = d.moved; d = null; sec.classList.remove("dragging");
      if (m) { const x = Math.round(sec.offsetLeft / GRID) * GRID, y = Math.round(sec.offsetTop / GRID) * GRID; sec.style.left = x + "px"; sec.style.top = y + "px"; st[k] = { ...(st[k] || {}), x, y }; save(); }
      else if (!cancel) toggleRed(k);
    };
    ph.addEventListener("pointerup", (e) => endMove(e, false)); ph.addEventListener("pointercancel", (e) => endMove(e, true));
    let r = null;
    rs.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; e.stopPropagation(); r = { x0: e.clientX, y0: e.clientY, w: sec.offsetWidth, h: sec.offsetHeight }; try { rs.setPointerCapture(e.pointerId); } catch (err) { /* sans capture */ } });
    rs.addEventListener("pointermove", (e) => { if (!r) return; const s = deskSize(); sec.style.width = clamp(r.w + e.clientX - r.x0, MIN.w, s.w - sec.offsetLeft) + "px"; sec.style.height = clamp(r.h + e.clientY - r.y0, MIN.h, s.h - sec.offsetTop) + "px"; });
    const endRes = () => { if (!r) return; r = null; st[k] = { ...(st[k] || {}), w: sec.offsetWidth, h: sec.offsetHeight }; save(); };
    rs.addEventListener("pointerup", endRes); rs.addEventListener("pointercancel", endRes);
  }
  function toggleRed(k) { const el = open[k]; if (!el) return; const on = !el.classList.contains("red"); el.classList.toggle("red", on); st[k] = { ...(st[k] || {}), red: on }; save(); }

  // ---------- API ----------
  function openMails() {
    const el = wins && wins.elById("mails");
    if (!el) { toast("Mails : pas encore disponible dans ce hub"); return; }
    plans.goPlan(1);
    if (wins.S.mails && wins.S.mails.res) wins.setReserve(el, false);
    document.dispatchEvent(new CustomEvent("hub:focus-win", { detail: "mails" }));
  }
  function openApp(k) {
    pulse(0.7);
    if (k === "mails") { openMails(); return; }
    if (!BUILD[k]) return;
    if (open[k]) { open[k].classList.remove("red"); st[k] = { ...(st[k] || {}), red: false }; front(open[k]); save(); return; }
    build(k); st[k] = { ...(st[k] || {}), open: true }; save();
  }
  function close(k) {
    const el = open[k]; if (!el) return;
    el.remove(); delete open[k]; st[k] = { ...(st[k] || {}), open: false }; save();
  }
  // Fenêtres ouvertes la dernière fois : on les remet (le bureau est caché tant qu'on n'est pas en plan 3)
  Object.keys(BUILD).forEach((k) => { if (st[k] && st[k].open) build(k); });
  return { open: openApp, close, isOpen: (k) => !!open[k], list: () => Object.keys(open) };
}
