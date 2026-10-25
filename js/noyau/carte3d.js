// Noyau · carte 3D du savoir. Canvas 2D avec projection en perspective (aucune bibliothèque : marche dans le hub, le labo et un fichier seul).
// Une sphère de domaines ; autour de chaque domaine, ses sous-thèmes. Un sous-thème sans fiche est un point creux ; il s'allume quand le Noyau apprend,
// et un arc électrique le relie à son domaine. Des liens croisés apparaissent quand des connaissances se recoupent. Glisser = tourner, molette = zoom, clic = choisir.
import { PROGRAMME } from "./curriculum.js";

const TAU = Math.PI * 2;
const hex = (h, a = 1) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
function fibonacci(n, r) { const out = []; const g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2, rad = Math.sqrt(Math.max(0, 1 - y * y)), t = g * i; out.push([Math.cos(t) * rad * r, y * r, Math.sin(t) * rad * r]); } return out; }

export function monterCarte3d(canvas, { surSelection = () => {} } = {}) {
  const ctx = canvas.getContext("2d"); const reduit = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pos = new Map();            // id -> [x,y,z]
  const hubs = fibonacci(PROGRAMME.length, 1);
  PROGRAMME.forEach((d, i) => { const h = hubs[i]; pos.set(d.id, h); const n = d.sousThemes.length, dir = fibonacci(n, 0.3), len = Math.hypot(...h) || 1; d.sousThemes.forEach((s, j) => { const o = dir[j], out = [h[0] / len, h[1] / len, h[2] / len]; pos.set(s.id, [h[0] + o[0] + out[0] * 0.16, h[1] + o[1] + out[1] * 0.16, h[2] + o[2] + out[2] * 0.16]); }); });
  let carte = null, selection = null, survol = null, rotY = 0.6, rotX = -0.25, zoom = 1, auto = !reduit, derniere = 0, vitesse = 0.00012, actif = true, raf = 0, w = 0, h = 0, dpr = 1;
  const proj = new Map();
  let drag = null;

  function dimensionner() { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); w = Math.max(200, r.width); h = Math.max(200, r.height); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function projeter(p) {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1] * cx - z * sx; z = p[1] * sx + z * cx;
    const f = 3.2, k = f / (f + z + 1.6), e = Math.min(w, h) * 0.62 * zoom;
    return { x: w / 2 + x * k * e, y: h / 2 + y * k * e, z, k };
  }
  const niveauDe = (id) => { if (!carte) return 0; for (const d of carte.domaines) { const s = d.sousThemes.find((x) => x.id === id); if (s) return s.niveau; } return 0; };
  const domaineDe = (id) => PROGRAMME.find((d) => d.id === id || d.sousThemes.some((s) => s.id === id));

  function eclair(a, b, t, couleur, force) {
    // arc électrique : segment brisé dont les décrochages bougent dans le temps
    const n = 7; ctx.beginPath(); ctx.moveTo(a.x, a.y);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < n; i++) { const u = i / n, j = reduit ? 0 : Math.sin(t * 0.004 + i * 7.3 + a.x * 0.01) * 3.2 * k0(force); ctx.lineTo(a.x + dx * u + nx * j, a.y + dy * u + ny * j); }
    ctx.lineTo(b.x, b.y); ctx.strokeStyle = couleur; ctx.stroke();
  }
  const k0 = (f) => 0.4 + f;

  function dessiner(t) {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.65); bg.addColorStop(0, "rgba(10,40,60,.55)"); bg.addColorStop(1, "rgba(2,6,13,0)"); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // socle hologramme : cercles au sol
    ctx.save(); ctx.lineWidth = 1; for (let i = 1; i <= 4; i++) { const p0 = projeter([0, 1.25, 0]); const r = Math.min(w, h) * 0.17 * i * zoom; ctx.strokeStyle = `rgba(63,230,255,${0.07 - i * 0.01})`; ctx.beginPath(); ctx.ellipse(p0.x, p0.y + r * 0.12, r, r * 0.28, 0, 0, TAU); ctx.stroke(); } ctx.restore();
    proj.clear(); for (const [id, p] of pos) proj.set(id, projeter(p));
    if (!carte) return;
    ctx.globalCompositeOperation = "lighter";
    // liens hub -> sous-thèmes
    for (const d of carte.domaines) {
      const ph = proj.get(d.id), col = PROGRAMME.find((x) => x.id === d.id).couleur, sel = selection && domaineDe(selection) && domaineDe(selection).id === d.id;
      for (const s of d.sousThemes) {
        const ps = proj.get(s.id);
        if (s.niveau <= 0) { if (sel) { ctx.strokeStyle = hex(col, 0.1); ctx.lineWidth = 0.6; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(ph.x, ph.y); ctx.lineTo(ps.x, ps.y); ctx.stroke(); ctx.setLineDash([]); } continue; }
        ctx.lineWidth = 0.8 + s.niveau * 1.4; eclair(ph, ps, t, hex(col, 0.25 + s.niveau * 0.55), s.niveau);
        if (!reduit) { const u = ((t * 0.0004 * (0.6 + s.niveau) + (s.id.length * 0.13)) % 1); ctx.fillStyle = hex("#ffffff", 0.85); ctx.beginPath(); ctx.arc(ph.x + (ps.x - ph.x) * u, ph.y + (ps.y - ph.y) * u, 1.6 + s.niveau, 0, TAU); ctx.fill(); }
      }
    }
    // liens croisés entre sous-thèmes (connaissances partagées)
    for (const l of carte.liens) { const a = proj.get(l.a), b = proj.get(l.b); if (!a || !b) continue; ctx.lineWidth = 0.7 + l.force * 1.2; eclair(a, b, t + 900, `rgba(255,255,255,${0.12 + l.force * 0.4})`, l.force); }
    // liens hub <-> hub quand deux domaines partagent des connaissances
    const entre = new Map(); for (const l of carte.liens) { const da = domaineDe(l.a).id, db = domaineDe(l.b).id; if (da !== db) { const k = da < db ? da + "|" + db : db + "|" + da; entre.set(k, (entre.get(k) || 0) + l.force); } }
    for (const [k, f] of entre) { const [a, b] = k.split("|"); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(155,114,255,${Math.min(0.6, 0.15 + f * 0.2)})`; ctx.beginPath(); ctx.moveTo(proj.get(a).x, proj.get(a).y); ctx.lineTo(proj.get(b).x, proj.get(b).y); ctx.stroke(); }
    ctx.globalCompositeOperation = "source-over";
    // nœuds triés par profondeur (le plus loin d'abord)
    const noeuds = []; for (const d of carte.domaines) { noeuds.push({ id: d.id, hub: true, d }); for (const s of d.sousThemes) noeuds.push({ id: s.id, hub: false, d, s }); }
    noeuds.sort((a, b) => proj.get(b.id).z - proj.get(a.id).z);
    const selD = selection && domaineDe(selection);
    for (const n of noeuds) {
      const p = proj.get(n.id), col = PROGRAMME.find((x) => x.id === n.d.id).couleur, prof = Math.max(0.35, Math.min(1, p.k * 0.9)), estSel = selection === n.id, estSurvol = survol === n.id, dansSel = selD && selD.id === n.d.id;
      if (n.hub) {
        const r = (13 + n.d.pct * 0.06) * p.k * zoom * 1.1;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6); g.addColorStop(0, hex(col, 0.18 + n.d.pct / 400)); g.addColorStop(1, hex(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, TAU); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = hex(col, 0.18 * prof); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
        if (n.d.pct > 0) { ctx.strokeStyle = hex(col, 0.95 * prof); ctx.beginPath(); ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * n.d.pct / 100); ctx.stroke(); }
        ctx.fillStyle = hex("#02060d", 0.8); ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.82, 0, TAU); ctx.fill();
        ctx.fillStyle = hex(col, (n.d.pct > 0 ? 1 : 0.55) * prof); ctx.font = `${Math.round(r * 0.95)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.d.symbole, p.x, p.y + 1);
        if (estSel || estSurvol) { ctx.strokeStyle = hex("#ffffff", 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, TAU); ctx.stroke(); }
        if (prof > 0.5 || estSel) { ctx.font = `${Math.max(9, Math.round(10.5 * p.k * zoom))}px Rajdhani, system-ui, sans-serif`; ctx.fillStyle = hex("#dff6fd", 0.9 * prof); ctx.textBaseline = "top"; ctx.fillText(n.d.nom, p.x, p.y + r + 4); ctx.fillStyle = hex(col, prof); ctx.fillText(n.d.pct + " %", p.x, p.y + r + 4 + 12 * p.k * zoom); }
      } else {
        const r = (2.2 + n.s.niveau * 3.2) * p.k * zoom * 1.1;
        if (n.s.niveau > 0) { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3); g.addColorStop(0, hex(col, 0.55 * prof)); g.addColorStop(1, hex(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, TAU); ctx.fill(); ctx.fillStyle = hex(col, prof); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); if (n.s.niveau >= 1) { ctx.fillStyle = hex("#ffffff", 0.9); ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.45, 0, TAU); ctx.fill(); } }
        else { ctx.strokeStyle = hex(col, (dansSel ? 0.7 : 0.28) * prof); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); }
        if (estSel || estSurvol) { ctx.strokeStyle = hex("#ffffff", 0.85); ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, TAU); ctx.stroke(); }
        if (dansSel && (prof > 0.55 || estSel)) { ctx.font = `${Math.max(9, Math.round(9.5 * p.k * zoom))}px Rajdhani, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = hex("#dff6fd", 0.82 * prof); ctx.fillText(n.s.titre, p.x, p.y + r + 3); }
      }
    }
    // info-bulle
    if (survol) { const p = proj.get(survol), d = domaineDe(survol), s = d.sousThemes.find((x) => x.id === survol); const txt = s ? `${s.titre} · ${Math.round(niveauDe(s.id) * 100)} %` : `${d.nom} · ${carte.domaines.find((x) => x.id === d.id).pct} %`; ctx.font = "12px Rajdhani, system-ui, sans-serif"; const tw = ctx.measureText(txt).width + 14, bx = Math.min(w - tw - 4, Math.max(4, p.x - tw / 2)), by = Math.max(4, p.y - 34); ctx.fillStyle = "rgba(2,6,13,.88)"; ctx.fillRect(bx, by, tw, 20); ctx.strokeStyle = "rgba(63,230,255,.5)"; ctx.strokeRect(bx, by, tw, 20); ctx.fillStyle = "#dff6fd"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, bx + 7, by + 10); }
  }

  function boucle(t) {
    raf = requestAnimationFrame(boucle);
    if (!actif || document.hidden || canvas.offsetParent === null) { derniere = t; return; }
    if (canvas.clientWidth !== Math.round(w) || canvas.clientHeight !== Math.round(h)) dimensionner();
    if (auto && !drag) rotY += (t - derniere) * vitesse; derniere = t;
    dessiner(t);
  }
  function choisir(x, y) {
    let meilleur = null, dist = 1e9;
    for (const [id, p] of proj) { const hub = PROGRAMME.some((d) => d.id === id), r = (hub ? 18 : 9) * p.k * zoom + 6, dd = Math.hypot(p.x - x, p.y - y); if (dd < r && (dd - r) < dist) { dist = dd - r; meilleur = id; } }
    return meilleur;
  }
  const xy = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, rx: rotX, ry: rotY, bouge: false }; });
  canvas.addEventListener("pointermove", (e) => {
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) drag.bouge = true; if (drag.bouge) { rotY = drag.ry + dx * 0.007; rotX = Math.max(-1.2, Math.min(1.2, drag.rx + dy * 0.007)); } }
    else { const [x, y] = xy(e); const s = choisir(x, y); if (s !== survol) { survol = s; canvas.style.cursor = s ? "pointer" : "grab"; } }
  });
  canvas.addEventListener("pointerup", (e) => { const d = drag; drag = null; if (d && !d.bouge) { const [x, y] = xy(e); const s = choisir(x, y); selection = s; surSelection(s, domaineDe(s || "") ? domaineDe(s).id : null); if (reduit) dessiner(performance.now()); } });
  canvas.addEventListener("pointerleave", () => { survol = null; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.max(0.6, Math.min(2.4, zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  canvas.addEventListener("dblclick", () => { zoom = 1; rotX = -0.25; auto = !reduit; });
  canvas.style.cursor = "grab"; canvas.style.touchAction = "none"; canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Carte 3D du savoir du Noyau : un point par sous-thème, allumé quand il est appris");
  dimensionner(); raf = requestAnimationFrame(boucle);
  if (typeof ResizeObserver === "function") new ResizeObserver(() => dimensionner()).observe(canvas);

  return {
    definir(c) { carte = c; if (reduit) dessiner(performance.now()); },
    selectionner(id) { selection = id; },
    pause(v) { actif = !v; },
    auto(v) { auto = v && !reduit; },
    arreter() { cancelAnimationFrame(raf); }
  };
}
