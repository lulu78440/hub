// L'entité : énergie dense façon animation japonaise, endormie (son IA arrive en phase 6), un « ? » à côté.
// Elle suit la souris, ou se pose sur le logo (clic sur le logo pour la poser ou la reprendre).
import { prefs } from "../store/prefs.js";
import { toast } from "../ui/toast.js";
import { state } from "../state.js";

export function createEntity(F) {
  const fg = F.fg, logo = F.logo;
  let on = prefs.on("entite"), docked = prefs.on("entite-posee", false), awake = false;
  const ent = { x: -999, y: -999, bolts: [], nextBolt: 0, tether: null, tetherT: 0 };

  function setDock(v) {
    docked = v;
    if (v && !on) { on = true; prefs.setOn("entite", true); }
    prefs.setOn("entite-posee", v);
    toast(v ? "Entité posée sur le logo" : "Entité reprise : elle te suit");
  }
  logo.addEventListener("click", () => { if (!state.lite) setDock(!docked); });
  logo.addEventListener("keydown", (e) => { if (!state.lite && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setDock(!docked); } });

  function draw(dt) {
    if (!on) return;
    let tx = null, ty = null;
    if (docked) { const r = logo.getBoundingClientRect(); tx = r.left + r.width / 2; ty = r.top + r.height / 2; }
    else if (F.fin) { tx = F.fmx + 40; ty = F.fmy - 36; }
    if (ent.x < -500) { ent.x = tx !== null ? tx : F.FW * 0.5; ent.y = ty !== null ? ty : F.FH * 0.5; }
    if (tx !== null) { const k = 1 - Math.exp(-dt * (docked ? 3.2 : 2.6)); ent.x += (tx - ent.x) * k; ent.y += (ty - ent.y) * k; }
    const ft = F.ft, x = ent.x, y = ent.y + (docked ? 0 : Math.sin(ft * 2.2) * 3);
    F.filaments(x, y, 150, 9, false);
    if (F.fin && !docked && F.energyOn) {
      if (!ent.tether || ft > ent.tetherT) { ent.tether = F.jag(x, y, F.fmx, F.fmy, 9, 16); ent.tetherT = ft + 0.07; }
      fg.strokeStyle = "rgba(63,230,255,.12)"; fg.lineWidth = 5; F.strokePts(ent.tether);
      fg.strokeStyle = "rgba(200,250,255,.6)"; fg.lineWidth = 1.1; F.strokePts(ent.tether);
    }
    let g = fg.createRadialGradient(x, y, 0, x, y, 48);
    g.addColorStop(0, "rgba(120,240,255,.45)"); g.addColorStop(0.4, "rgba(63,230,255,.16)"); g.addColorStop(1, "rgba(63,230,255,0)");
    fg.fillStyle = g; fg.beginPath(); fg.arc(x, y, 48, 0, 6.283); fg.fill();
    const flame = (base, amp, col, stroke) => {
      fg.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * 6.283, up = Math.max(0, -Math.sin(a));
        const r = base + amp * (0.55 * Math.sin(a * 5 + ft * 7) + 0.35 * Math.sin(a * 9 - ft * 11) + 0.25 * Math.random()) + up * up * base * 0.9;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.95;
        if (i) fg.lineTo(px, py); else fg.moveTo(px, py);
      }
      fg.closePath(); fg.fillStyle = col; fg.fill();
      if (stroke) { fg.strokeStyle = stroke; fg.lineWidth = 1; fg.stroke(); }
    };
    flame(16, 4.5, "rgba(63,230,255,.28)", "rgba(160,240,255,.55)");
    flame(10, 2.5, "rgba(190,250,255,.5)");
    g = fg.createRadialGradient(x, y + 1, 0, x, y + 1, 8);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(190,250,255,0)");
    fg.fillStyle = g; fg.beginPath(); fg.arc(x, y + 1, 8, 0, 6.283); fg.fill();
    fg.globalCompositeOperation = "source-over";
    if (!awake) {
      // yeux fermés : elle dort tant que l'IA n'est pas branchée
      fg.strokeStyle = "rgba(3,22,38,.85)"; fg.lineWidth = 1.6;
      fg.beginPath(); fg.moveTo(x - 5.5, y - 1); fg.quadraticCurveTo(x - 3.7, y + 1, x - 2, y - 1);
      fg.moveTo(x + 2, y - 1); fg.quadraticCurveTo(x + 3.7, y + 1, x + 5.5, y - 1); fg.stroke();
    } else {
      // réveillée (phase 6) : yeux ouverts qui clignent de temps en temps
      const blink = (ft % 4.2) < 0.12;
      fg.fillStyle = "rgba(3,22,38,.9)";
      if (blink) { fg.fillRect(x - 5.5, y - 1.2, 3.5, 1.2); fg.fillRect(x + 2, y - 1.2, 3.5, 1.2); }
      else { fg.beginPath(); fg.ellipse(x - 3.7, y - 0.5, 1.6, 2.2, 0, 0, 6.283); fg.ellipse(x + 3.7, y - 0.5, 1.6, 2.2, 0, 0, 6.283); fg.fill(); }
    }
    fg.font = "700 15px Orbitron, 'Segoe UI', sans-serif"; fg.textAlign = "center"; fg.textBaseline = "middle";
    fg.shadowColor = "rgba(63,230,255,.9)"; fg.shadowBlur = 10;
    fg.fillStyle = `rgba(215,250,255,${(0.6 + 0.4 * Math.sin(ft * 3)).toFixed(2)})`;
    fg.fillText(awake ? "!" : "?", x + 23, y - 21 + Math.sin(ft * 2.6) * 2);
    fg.shadowBlur = 0;
    fg.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) { const a = ft * (1.6 + i * 0.5) + i * 2.1; fg.fillStyle = "rgba(200,250,255,.9)"; fg.fillRect(x + Math.cos(a) * 23 - 1, y + Math.sin(a) * 9 - 1, 2, 2); }
    if (ft > ent.nextBolt) {
      const a = Math.random() * 6.283, L = 22 + Math.random() * 28;
      ent.bolts.push({ pts: F.jag(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 5, 9), t: ft });
      ent.nextBolt = ft + 0.2 + Math.random() * 0.6;
    }
    ent.bolts = ent.bolts.filter((b) => ft - b.t < 0.14);
    fg.strokeStyle = "rgba(200,250,255,.85)"; fg.lineWidth = 1; ent.bolts.forEach((b) => F.strokePts(b.pts));
  }
  function setOn(v) { on = v; prefs.setOn("entite", v); if (!v && docked) { docked = false; prefs.setOn("entite-posee", false); } toast(v ? "Entité affichée" : "Entité masquée · clic droit sur le fond pour la réafficher"); }
  /** Vrai si le point (x, y) de l'écran touche l'entité visible. */
  const near = (x, y) => on && !state.lite && !state.reduce && Math.hypot(x - ent.x, y - ent.y) < 30;
  return { draw, setDock, setOn, near, setAwake(v) { awake = !!v; }, get awake() { return awake; }, get docked() { return docked; }, get on() { return on; }, get pos() { return [Math.round(ent.x), Math.round(ent.y)]; } };
}
