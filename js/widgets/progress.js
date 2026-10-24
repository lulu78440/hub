// Fenêtre Progression (2.9, v8, PC) : avancement du projet relevé dans le Suivi du Hub (fichier docs/suivi.json du dépôt,
// mis à jour par Claude à chaque sous-étape) et aperçus des mods graphiques (prévus en V2).
import { toast } from "../ui/toast.js";
import { registerMenu } from "../ui/menus.js";
import { state } from "../state.js";

// ---------- Aperçus des mods (dessins de la maquette v8) ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function drawHolo(g, w, h, r) {
  let gr = g.createRadialGradient(w / 2, h * .45, 2, w / 2, h * .45, w * .7); gr.addColorStop(0, "#0b3a58"); gr.addColorStop(1, "#02060d");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(63,230,255,.28)"; g.lineWidth = .7;
  for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(w / 2 + i * w * .02, h * .72); g.lineTo(w / 2 + i * w * .16, h); g.stroke(); }
  for (let j = 0; j < 6; j++) { const y = h * .72 + h * .28 * (j / 5) ** 2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  gr = g.createRadialGradient(w / 2, h * .45, 0, w / 2, h * .45, h * .34); gr.addColorStop(0, "rgba(220,252,255,1)"); gr.addColorStop(.2, "rgba(63,230,255,.65)"); gr.addColorStop(1, "rgba(63,230,255,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h * .45, h * .34, 0, 6.283); g.fill();
  g.lineWidth = 1; g.strokeStyle = "rgba(63,230,255,.9)"; g.beginPath(); g.ellipse(w / 2, h * .45, h * .42, h * .12, -.2, 0, 6.283); g.stroke();
  g.strokeStyle = "rgba(155,114,255,.8)"; g.beginPath(); g.ellipse(w / 2, h * .45, h * .34, h * .1, .5, 0, 6.283); g.stroke();
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(160,240,255,${(r() * .8).toFixed(2)})`; g.fillRect(r() * w, r() * h * .7, 1, 1); }
}
function drawBio(g, w, h, r) {
  let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#14120f"); gr.addColorStop(1, "#030303"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i <= 16; i++) { // colonne vertébrale en arche
    const t = i / 16, x = w * (.04 + .92 * t), y = h * .12 + (1 - Math.sin(t * Math.PI)) * h * .3;
    const eg = g.createRadialGradient(x - 1, y - 2, 0, x, y, h * .08); eg.addColorStop(0, "#5a5249"); eg.addColorStop(1, "#110f0d");
    g.fillStyle = eg; g.beginPath(); g.ellipse(x, y, w * .028, h * .075, t - .5, 0, 6.283); g.fill();
    g.strokeStyle = "rgba(140,128,112,.35)"; g.lineWidth = .6; g.stroke();
  }
  for (let k = 0; k < 6; k++) { // tentacules annelés
    const x0 = w * r(), len = .55 + r() * .35, ph = r() * 6;
    for (let s = 0; s <= 1; s += .04) {
      const x = x0 + Math.sin(s * 4 + ph) * w * .14 * s, y = h - s * h * len, rad = (1 - s) * h * .085 + .8;
      const tg2 = g.createRadialGradient(x - rad * .3, y - rad * .3, 0, x, y, rad); tg2.addColorStop(0, "#4a443c"); tg2.addColorStop(1, "#0d0c0a");
      g.fillStyle = tg2; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
      if (Math.round(s * 25) % 2 === 0) { g.strokeStyle = "rgba(170,158,140,.22)"; g.lineWidth = .6; g.beginPath(); g.arc(x, y, rad * .9, 3.6, 5.8); g.stroke(); }
    }
  }
  gr = g.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, w * .7); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.75)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
function drawRot(g, w, h, r) {
  let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1e2510"); gr.addColorStop(1, "#080a04"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  gr = g.createRadialGradient(w * .5, h * .65, 0, w * .5, h * .65, w * .6); gr.addColorStop(0, "rgba(150,180,40,.35)"); gr.addColorStop(1, "rgba(150,180,40,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) { // chairs boursouflées
    const x = r() * w, y = h * (.45 + r() * .6), rad = h * (.06 + r() * .16);
    const bg = g.createRadialGradient(x - rad * .3, y - rad * .3, 0, x, y, rad); bg.addColorStop(0, "#6f7d28"); bg.addColorStop(.7, "#3a4214"); bg.addColorStop(1, "#151804");
    g.fillStyle = bg; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
    if (r() > .5) { g.fillStyle = "rgba(200,210,90,.75)"; g.beginPath(); g.arc(x + rad * .3, y - rad * .2, rad * .18, 0, 6.283); g.fill(); g.fillStyle = "rgba(40,30,10,.8)"; g.beginPath(); g.arc(x + rad * .3, y - rad * .2, rad * .07, 0, 6.283); g.fill(); }
  }
  g.lineCap = "round";
  for (let i = 0; i < 8; i++) { const x = r() * w, l = h * (.1 + r() * .35); g.strokeStyle = "rgba(130,150,30,.6)"; g.lineWidth = 1.5 + r() * 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, l); g.stroke(); g.fillStyle = "rgba(160,180,40,.8)"; g.beginPath(); g.arc(x, l, g.lineWidth * .9, 0, 6.283); g.fill(); }
  for (let i = 0; i < 14; i++) { g.strokeStyle = "rgba(200,220,90,.45)"; g.lineWidth = .7; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3, 0, 6.283); g.stroke(); }
  for (let i = 0; i < 26; i++) { g.fillStyle = "#050600"; g.fillRect(r() * w, r() * h * .7, 1.6, 1.2); }
}
function gear(g, cx, cy, R, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a0 = i / (n * 2) * 6.283, a1 = (i + 1) / (n * 2) * 6.283, rr = i % 2 ? R * .8 : R; g.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr); g.lineTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr); }
  g.closePath();
  const gg = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); gg.addColorStop(0, "#8a97a2"); gg.addColorStop(1, "#2d353c");
  g.fillStyle = gg; g.fill(); g.strokeStyle = "rgba(190,205,215,.6)"; g.lineWidth = .7; g.stroke();
  g.fillStyle = "#0e1215"; g.beginPath(); g.arc(cx, cy, R * .32, 0, 6.283); g.fill();
  g.strokeStyle = "#ff8a2a"; g.beginPath(); g.arc(cx, cy, R * .2, 0, 6.283); g.stroke();
}
function drawMech(g, w, h, r) {
  let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1f272e"); gr.addColorStop(1, "#090b0d"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(255,138,42,.5)"; g.lineWidth = .8;
  for (let i = 0; i < 10; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { if (k % 2) y += (r() - .5) * h * .5; else x += (r() - .5) * w * .5; g.lineTo(x, y); } g.stroke(); g.fillStyle = "#ff8a2a"; g.fillRect(x - 1.5, y - 1.5, 3, 3); }
  gear(g, w * .34, h * .58, h * .4, 14); gear(g, w * .68, h * .36, h * .25, 10); gear(g, w * .84, h * .8, h * .15, 8);
  g.fillStyle = "rgba(255,138,42,.25)"; g.fillRect(0, h * .18, w, 1.5);
  for (let i = 0; i < 12; i++) { g.fillStyle = "#59636c"; g.beginPath(); g.arc(r() * w, r() < .5 ? 4 : h - 4, 1.8, 0, 6.283); g.fill(); }
}
function drawSpirit(g, w, h, r) {
  let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#140f33"); gr.addColorStop(1, "#04030c"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(220,225,255,${(r() * .8).toFixed(2)})`; g.fillRect(r() * w, r() * h, 1, 1); }
  gr = g.createRadialGradient(w * .66, h * .3, h * .02, w * .7, h * .36, h * .36); gr.addColorStop(0, "rgba(230,236,255,.6)"); gr.addColorStop(.6, "rgba(130,140,230,.18)"); gr.addColorStop(1, "rgba(130,140,230,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(w * .7, h * .36, h * .36, 0, 6.283); g.fill();
  g.strokeStyle = "rgba(200,210,255,.25)"; g.lineWidth = .8; g.beginPath(); g.ellipse(w * .7, h * .36, h * .55, h * .1, -.3, 0, 6.283); g.stroke();
  g.filter = "blur(2px)";
  for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(205,215,255,${(.12 + r() * .14).toFixed(2)})`; g.lineWidth = 3 + r() * 6; g.beginPath(); const x = r() * w * .5; g.moveTo(x, h); g.bezierCurveTo(x + w * .2, h * .6, x - w * .1, h * .4, x + w * (.2 + r() * .3), h * (.05 + r() * .3)); g.stroke(); }
  gr = g.createRadialGradient(w * .28, h * .5, 0, w * .28, h * .5, h * .3); gr.addColorStop(0, "rgba(225,232,255,.3)"); gr.addColorStop(1, "rgba(225,232,255,0)");
  g.fillStyle = gr; g.beginPath(); g.ellipse(w * .28, h * .55, h * .14, h * .32, 0, 0, 6.283); g.fill();
  g.filter = "none";
  g.fillStyle = "rgba(10,8,30,.55)"; g.beginPath(); g.arc(w * .26, h * .45, 1.6, 0, 6.283); g.arc(w * .3, h * .45, 1.6, 0, 6.283); g.fill();
}
const MODS = [
  { n: "Hologramme", st: "ACTIF", draw: drawHolo },
  { n: "Abyss", st: "EN ATTENTE · V2", draw: drawBio },
  { n: "Putréfaction", st: "EN ATTENTE · V2", draw: drawRot },
  { n: "Mécanique", st: "EN ATTENTE · V2", draw: drawMech },
  { n: "Esprits des planètes", st: "EN ATTENTE · V2", draw: drawSpirit }
];
const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function initProgress() {
  const win = document.querySelector('.win[data-id="progress"]');
  if (!win || state.lite) return;
  const pb = win.querySelector(".pb"), pf = win.querySelector(".pf"), tag = win.querySelector(".tag");
  pb.className = "pb pb-prog";
  pb.innerHTML = '<div class="prog-top"><span class="pct">--</span><div class="psegs" aria-label="Avancement par phase"></div><span class="pnext"></span></div><div class="mods" role="group" aria-label="Mods graphiques"></div>';
  pf.classList.add("psub");
  pf.innerHTML = '<span class="psrc">Relevé du Suivi du Hub</span><a href="https://claude.ai/artifact/55penHsSCPQaYcWNrhn2da" target="_blank" rel="noopener">Ouvrir le suivi ↗</a>';
  tag.textContent = "SUIVI DU HUB";
  let S = null;

  async function load() {
    try { const r = await fetch("docs/suivi.json", { cache: "no-store" }); if (!r.ok) throw new Error(); S = await r.json(); render(); }
    catch (e) { if (!S) pb.querySelector(".pnext").textContent = "Relevé indisponible hors ligne"; }
  }
  function render() {
    const done = new Set(S.faites || []);
    let tot = 0, ok = 0, curSet = false;
    const segs = pb.querySelector(".psegs"); segs.innerHTML = "";
    S.phases.forEach((ph) => {
      const n = ph.etapes.length, d = ph.etapes.filter((id) => done.has(id)).length; tot += n; ok += d;
      const cur = !curSet && d < n; if (cur) curSet = true;
      const div = document.createElement("div"); div.style.flex = String(n); div.className = cur ? "cur" : ""; div.title = `${ph.cle} · ${ph.nom} · ${d}/${n}`;
      const u = document.createElement("u"); u.style.width = (d / n * 100).toFixed(0) + "%"; div.append(u); segs.append(div);
    });
    pb.querySelector(".pct").textContent = Math.round(ok / tot * 100) + " %";
    const nx = pb.querySelector(".pnext"); nx.textContent = `${ok}/${tot} · prochaine : `;
    const b = document.createElement("b"); b.textContent = S.prochaine ? S.prochaine.texte : "tout est fait"; nx.append(b);
    pf.querySelector(".psrc").textContent = "Relevé dans ton Suivi le " + fmt.format(new Date(S.releve));
    renderMini(done, ok, tot);
  }
  // Mini barre dans la barre du haut, à côté de « HUB » : une case par phase (remplie selon l'avancement) et le pourcentage.
  function renderMini(done, ok, tot) {
    const ms = document.getElementById("mp-segs"), mp = document.getElementById("mp-pct"), mb = document.getElementById("mprog");
    if (!ms || !mp || !mb) return;
    ms.innerHTML = ""; let curSet = false;
    S.phases.forEach((ph) => {
      const n = ph.etapes.length, d = ph.etapes.filter((id) => done.has(id)).length, cur = !curSet && d < n; if (cur) curSet = true;
      const u = document.createElement("u"); u.style.flex = String(n); if (cur) u.className = "cur"; u.title = `${ph.cle} · ${ph.nom} · ${d}/${n}`;
      const f = document.createElement("i"); f.style.width = (d / n * 100).toFixed(0) + "%"; u.append(f); ms.append(u);
    });
    mp.textContent = Math.round(ok / tot * 100) + " %";
    mb.title = `Progression : ${ok}/${tot} étapes` + (S.prochaine ? " · prochaine : " + S.prochaine.texte : "") + " · clic pour le détail";
  }

  // Mods
  const box = pb.querySelector(".mods");
  box.innerHTML = MODS.map((m, i) => `<button type="button" class="mod${i === 0 ? " active" : ""}" data-i="${i}" aria-label="Mod ${m.n}, ${m.st.toLowerCase()}"><canvas></canvas><span class="st">${m.st}</span><span class="mn">${m.n}</span></button>`).join("");
  const btns = [...box.querySelectorAll(".mod")];
  btns.forEach((b) => b.addEventListener("click", () => {
    const m = MODS[+b.dataset.i];
    toast(b.classList.contains("active") ? "Mod actif : Hologramme (version actuelle)" : `Mod « ${m.n} » : prévu en V2. Refonte graphique, mêmes fonctions.`);
  }));
  function drawMods() {
    btns.forEach((b, i) => {
      const c = b.querySelector("canvas"), w = Math.max(2, b.clientWidth), h = Math.max(2, b.clientHeight);
      c.width = Math.round(w * 2); c.height = Math.round(h * 2);
      const g = c.getContext("2d"); g.setTransform(2, 0, 0, 2, 0, 0);
      MODS[i].draw(g, w, h, rng(7 + i * 13));
    });
  }
  if (window.ResizeObserver) new ResizeObserver(drawMods).observe(box); else drawMods();
  function preview(i) {
    const ov = document.createElement("div"); ov.className = "modview pc-only";
    ov.innerHTML = "<canvas></canvas><span></span>"; ov.lastChild.textContent = MODS[i].n + " · " + MODS[i].st + " · clic pour fermer";
    document.body.append(ov);
    const c = ov.querySelector("canvas"), w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * 1.5); c.height = Math.round(h * 1.5);
    const g = c.getContext("2d"); g.setTransform(1.5, 0, 0, 1.5, 0, 0); MODS[i].draw(g, w, h, rng(7 + i * 13));
    const close = (e) => { if (e && e.type === "keydown" && e.key !== "Escape") return; ov.remove(); removeEventListener("keydown", close); };
    ov.addEventListener("click", () => close()); addEventListener("keydown", close);
  }
  registerMenu("progress", (el, t) => {
    const m = t.closest(".mod"), it = [];
    if (m) { const i = +m.dataset.i; it.push({ h: "Mod · " + MODS[i].n }, { t: "Voir en grand", fn: () => preview(i) }, "-"); }
    it.push({ h: "Progression" },
      { t: "Ouvrir le suivi ↗", fn: () => pf.querySelector("a").click() },
      { t: "Actualiser le relevé", fn: () => { load(); toast("Relevé actualisé"); } });
    return it;
  });

  load();
  setInterval(load, 30 * 60e3);
}
