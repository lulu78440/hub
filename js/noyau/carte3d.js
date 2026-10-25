// Noyau · carte neuronale 3D du savoir. Canvas 2D avec projection en perspective (aucune bibliothèque : marche dans le hub, le labo et un fichier seul).
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

  // ----- Neurones : chaque nœud a un corps, des dendrites ; chaque lien est un axone courbe où circulent des influx électriques -----
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967295; };
  const alea = (id, k) => hash(id + "#" + k);
  const dendrites = new Map();      // id -> segments 3D relatifs au corps
  function dendritesDe(id, hub) {
    if (dendrites.has(id)) return dendrites.get(id);
    const n = hub ? 8 : 5, L = hub ? 0.14 : 0.075, segs = [];
    for (let i = 0; i < n; i++) {
      const th = alea(id, "t" + i) * TAU, ph = Math.acos(2 * alea(id, "p" + i) - 1), len = L * (0.7 + alea(id, "l" + i) * 0.7);
      const e = [Math.sin(ph) * Math.cos(th) * len, Math.cos(ph) * len, Math.sin(ph) * Math.sin(th) * len]; segs.push([[0, 0, 0], e]);
      for (let k = 0; k < 2; k++) segs.push([e, [e[0] + (alea(id, "a" + i + k) - 0.5) * len, e[1] + (alea(id, "b" + i + k) - 0.5) * len, e[2] + (alea(id, "c" + i + k) - 0.5) * len]]);
    }
    dendrites.set(id, segs); return segs;
  }
  const controles = new Map();
  function controle(ida, idb) {
    const k = ida + ">" + idb; if (controles.has(k)) return controles.get(k);
    const A = pos.get(ida), B = pos.get(idb), d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1;
    const v = [alea(k, "x") - 0.5, alea(k, "y") - 0.5, alea(k, "z") - 0.5], vl = Math.hypot(...v) || 1;
    const c = [(A[0] + B[0]) / 2 + v[0] / vl * d * 0.28, (A[1] + B[1]) / 2 + v[1] / vl * d * 0.28, (A[2] + B[2]) / 2 + v[2] / vl * d * 0.28];
    controles.set(k, c); return c;
  }
  const bez = (a, c, b, u) => { const m = 1 - u; return { x: m * m * a.x + 2 * m * u * c.x + u * u * b.x, y: m * m * a.y + 2 * m * u * c.y + u * u * b.y }; };
  const etatDe = (niv) => niv >= 1 ? "valide" : niv > 0 ? "cours" : "dormant";

  /** Un axone : courbe, crépitement électrique et influx. niv ∈ ]0,1] ; graine pour désynchroniser. */
  function axone(ida, idb, a, b, t, col, niv, graine, blanc) {
    const c = projeter(controle(ida, idb)), et = etatDe(niv), N = 18;
    const pts = []; for (let i = 0; i <= N; i++) pts.push(bez(a, c, b, i / N));
    // halo
    ctx.lineWidth = 0.8 + niv * 1.6; ctx.strokeStyle = blanc ? `rgba(220,200,255,${0.12 + niv * 0.25})` : hex(col, 0.14 + niv * 0.3); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke();
    // crépitement : fil fin qui vibre (plus nerveux quand l'apprentissage est en cours)
    const amp = reduit ? 0 : (et === "cours" ? 3.4 : 1.2);
    ctx.lineWidth = 0.9; ctx.strokeStyle = blanc ? "rgba(235,225,255,.55)" : hex("#ffffff", et === "cours" ? 0.45 : 0.6); ctx.beginPath();
    pts.forEach((q, i) => { const nx = pts[Math.min(N, i + 1)].y - pts[Math.max(0, i - 1)].y, ny = -(pts[Math.min(N, i + 1)].x - pts[Math.max(0, i - 1)].x), nl = Math.hypot(nx, ny) || 1, j = i === 0 || i === N ? 0 : Math.sin(t * 0.017 + i * 5.3 + graine * 40) * amp; i ? ctx.lineTo(q.x + nx / nl * j, q.y + ny / nl * j) : ctx.moveTo(q.x, q.y); });
    ctx.stroke();
    // influx (potentiel d'action) : tête brillante + traîne, puis flash à la synapse d'arrivée
    const P = (et === "valide" ? 2300 : 4200) + graine * 900, nb = et === "valide" ? 2 : 1;
    for (let k = 0; k < nb; k++) {
      let ph = reduit ? 0.55 : (((t + graine * P + k * P / 2) % P) / P) * 1.3;
      if (et === "cours" && !reduit && Math.sin(t * 0.0013 + graine * 50) < -0.15) continue;    // salves irrégulières : le réseau « hésite »
      if (ph <= 1) {
        for (let q = 0; q < 8; q++) { const u0 = Math.max(0, ph - q * 0.025); const pt = bez(a, c, b, u0); ctx.fillStyle = blanc ? `rgba(230,215,255,${0.7 - q * 0.08})` : hex("#ffffff", 0.85 - q * 0.1); ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.6, 2.4 + niv - q * 0.25), 0, TAU); ctx.fill(); }
        const hd = bez(a, c, b, ph), g = ctx.createRadialGradient(hd.x, hd.y, 0, hd.x, hd.y, 9 + niv * 5); g.addColorStop(0, blanc ? "rgba(200,170,255,.7)" : hex(col, 0.75)); g.addColorStop(1, hex(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hd.x, hd.y, 9 + niv * 5, 0, TAU); ctx.fill();
      } else {
        const f = 1 - (ph - 1) / 0.3; if (f > 0) { const r = (6 + 12 * (1 - f)) * (0.6 + niv), g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r); g.addColorStop(0, `rgba(255,255,255,${0.75 * f})`); g.addColorStop(0.4, hex(col, 0.5 * f)); g.addColorStop(1, hex(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill(); }
      }
    }
  }

  function dessiner(t) {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.65); bg.addColorStop(0, "rgba(10,40,60,.55)"); bg.addColorStop(1, "rgba(2,6,13,0)"); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.lineWidth = 1; for (let i = 1; i <= 4; i++) { const p0 = projeter([0, 1.25, 0]); const r = Math.min(w, h) * 0.17 * i * zoom; ctx.strokeStyle = `rgba(63,230,255,${0.07 - i * 0.01})`; ctx.beginPath(); ctx.ellipse(p0.x, p0.y + r * 0.12, r, r * 0.28, 0, 0, TAU); ctx.stroke(); } ctx.restore();
    proj.clear(); for (const [id, p] of pos) proj.set(id, projeter(p));
    if (!carte) return;
    ctx.globalCompositeOperation = "lighter";
    const selD = selection && domaineDe(selection);
    // axones domaine -> sous-thèmes : seuls les sous-thèmes en cours d'apprentissage ou validés sont connectés
    for (const d of carte.domaines) {
      const ph = proj.get(d.id), col = PROGRAMME.find((x) => x.id === d.id).couleur, sel = selD && selD.id === d.id;
      for (const s of d.sousThemes) {
        const ps = proj.get(s.id);
        if (s.niveau <= 0) { if (sel) { ctx.strokeStyle = hex(col, 0.12); ctx.lineWidth = 0.6; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(ph.x, ph.y); ctx.lineTo(ps.x, ps.y); ctx.stroke(); ctx.setLineDash([]); } continue; }
        axone(d.id, s.id, ph, ps, t, col, s.niveau, alea(s.id, "g"), false);
      }
    }
    // axones longs entre connaissances qui se recoupent
    for (const l of carte.liens) { const a = proj.get(l.a), b = proj.get(l.b); if (!a || !b) continue; axone(l.a, l.b, a, b, t + 900, "#b79bff", 0.25 + l.force * 0.75, alea(l.a + l.b, "g"), true); }
    // faisceaux entre domaines qui partagent des connaissances
    const entre = new Map(); for (const l of carte.liens) { const da = domaineDe(l.a).id, db = domaineDe(l.b).id; if (da !== db) { const k = da < db ? da + "|" + db : db + "|" + da; entre.set(k, (entre.get(k) || 0) + l.force); } }
    for (const [k, f] of entre) { const [a, b] = k.split("|"); ctx.lineWidth = 1 + Math.min(2, f); ctx.strokeStyle = `rgba(155,114,255,${Math.min(0.6, 0.15 + f * 0.2)})`; ctx.beginPath(); ctx.moveTo(proj.get(a).x, proj.get(a).y); ctx.lineTo(proj.get(b).x, proj.get(b).y); ctx.stroke(); }
    ctx.globalCompositeOperation = "source-over";
    const noeuds = []; for (const d of carte.domaines) { noeuds.push({ id: d.id, hub: true, d }); for (const s of d.sousThemes) noeuds.push({ id: s.id, hub: false, d, s }); }
    noeuds.sort((a, b) => proj.get(b.id).z - proj.get(a.id).z);
    for (const n of noeuds) {
      const p = proj.get(n.id), col = PROGRAMME.find((x) => x.id === n.d.id).couleur, prof = Math.max(0.35, Math.min(1, p.k * 0.9)), estSel = selection === n.id, estSurvol = survol === n.id, dansSel = selD && selD.id === n.d.id;
      const niv = n.hub ? n.d.pct / 100 : n.s.niveau, et = n.hub ? (niv >= 1 ? "valide" : niv > 0 ? "cours" : "dormant") : etatDe(niv);
      // dendrites : les ramifications du neurone (visibles surtout quand il est actif ou son domaine choisi)
      const O = pos.get(n.id), alpha = et === "dormant" ? (dansSel ? 0.3 : 0.12) : 0.35 + niv * 0.45;
      ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = n.hub ? 1.1 : 0.8; ctx.strokeStyle = hex(col, alpha * prof); ctx.beginPath();
      for (const [u, v] of dendritesDe(n.id, n.hub)) { const pu = projeter([O[0] + u[0], O[1] + u[1], O[2] + u[2]]), pv = projeter([O[0] + v[0], O[1] + v[1], O[2] + v[2]]); ctx.moveTo(pu.x, pu.y); ctx.lineTo(pv.x, pv.y); }
      ctx.stroke();
      if (et !== "dormant" && !reduit) { const sc = Math.sin(t * 0.006 + alea(n.id, "s") * 30); if (sc > (et === "valide" ? 0.2 : 0.55)) { const segs = dendritesDe(n.id, n.hub), sg = segs[Math.floor(alea(n.id, "q" + Math.floor(t / 400)) * segs.length)], pe = projeter([O[0] + sg[1][0], O[1] + sg[1][1], O[2] + sg[1][2]]); ctx.fillStyle = hex("#ffffff", 0.8 * prof); ctx.beginPath(); ctx.arc(pe.x, pe.y, 1.3, 0, TAU); ctx.fill(); } }
      ctx.globalCompositeOperation = "source-over";
      if (n.hub) {
        const r = (13 + n.d.pct * 0.06) * p.k * zoom * 1.1, pulse = et === "dormant" || reduit ? 0 : Math.sin(t * 0.004 + alea(n.id, "h") * 9) * 0.5 + 0.5;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6); g.addColorStop(0, hex(col, 0.18 + n.d.pct / 400 + pulse * 0.12)); g.addColorStop(1, hex(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, TAU); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = hex(col, 0.18 * prof); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
        if (n.d.pct > 0) { ctx.strokeStyle = hex(col, 0.95 * prof); ctx.beginPath(); ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * n.d.pct / 100); ctx.stroke(); }
        ctx.fillStyle = hex("#02060d", 0.8); ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.82, 0, TAU); ctx.fill();
        ctx.fillStyle = hex(col, (n.d.pct > 0 ? 1 : 0.55) * prof); ctx.font = `${Math.round(r * 0.95)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.d.symbole, p.x, p.y + 1);
        if (estSel || estSurvol) { ctx.strokeStyle = hex("#ffffff", 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, TAU); ctx.stroke(); }
        if (prof > 0.5 || estSel) { ctx.font = `${Math.max(9, Math.round(10.5 * p.k * zoom))}px Rajdhani, system-ui, sans-serif`; ctx.fillStyle = hex("#dff6fd", 0.9 * prof); ctx.textBaseline = "top"; ctx.fillText(n.d.nom, p.x, p.y + r + 4); ctx.fillStyle = hex(col, prof); ctx.fillText(n.d.pct + " %", p.x, p.y + r + 4 + 12 * p.k * zoom); }
      } else {
        const r = (2.2 + n.s.niveau * 3.2) * p.k * zoom * 1.1;
        if (et === "valide") {            // neurone validé : corps vif et stable, cœur blanc
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.4); g.addColorStop(0, hex(col, 0.7 * prof)); g.addColorStop(1, hex(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.4, 0, TAU); ctx.fill();
          ctx.fillStyle = hex(col, prof); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.fillStyle = hex("#ffffff", 0.95); ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, TAU); ctx.fill();
        } else if (et === "cours") {       // neurone en cours : corps qui vacille, anneau qui respire
          const v = reduit ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.009 + alea(n.id, "v") * 20), rr = r * (0.9 + v * 0.35);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 3); g.addColorStop(0, hex(col, (0.3 + v * 0.35) * prof)); g.addColorStop(1, hex(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr * 3, 0, TAU); ctx.fill();
          ctx.fillStyle = hex(col, (0.55 + v * 0.3) * prof); ctx.beginPath(); ctx.arc(p.x, p.y, rr * 0.8, 0, TAU); ctx.fill(); ctx.strokeStyle = hex("#ffffff", (0.3 + v * 0.4) * prof); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, rr * 1.35, 0, TAU); ctx.stroke();
        } else { ctx.strokeStyle = hex(col, (dansSel ? 0.7 : 0.28) * prof); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); }
        if (estSel || estSurvol) { ctx.strokeStyle = hex("#ffffff", 0.85); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, TAU); ctx.stroke(); }
        if (dansSel && (prof > 0.55 || estSel)) { ctx.font = `${Math.max(9, Math.round(9.5 * p.k * zoom))}px Rajdhani, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = hex("#dff6fd", 0.82 * prof); ctx.fillText(n.s.titre, p.x, p.y + r + 3); }
      }
    }
    // légende
    ctx.font = "11px Rajdhani, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; const ly = h - 12;
    [["validé : influx réguliers", "#ffffff", true], ["en cours : influx par salves", "#ffb347", true], ["pas encore appris", "#6b8da0", false]].reduce((x, [txt, c, plein]) => { ctx.fillStyle = hex(c, 0.9); ctx.strokeStyle = hex(c, 0.9); ctx.beginPath(); ctx.arc(x + 4, ly, 3.5, 0, TAU); plein ? ctx.fill() : ctx.stroke(); ctx.fillStyle = "rgba(223,246,253,.75)"; ctx.fillText(txt, x + 12, ly); return x + 22 + ctx.measureText(txt).width; }, 10);
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
  canvas.style.cursor = "grab"; canvas.style.touchAction = "none"; canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Carte neuronale 3D du savoir du Noyau : un neurone par sous-thème, relié par des influx électriques quand il est en cours d'apprentissage ou validé");
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
