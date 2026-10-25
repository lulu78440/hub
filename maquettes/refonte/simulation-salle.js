// Maquette 2 : fenêtres réduites (clic sur le nom) et plan 2 « salle immersive » (type cinéma VR), simulés sur le vrai hub.
const { chromium } = require('playwright');
const { seed, clean, afterPC } = require('./simulation-apres.js');
const OUT = process.argv[2];

const REDUCE_CSS = `
.win.reduite { height: 30px !important; width: auto !important; }
.win.reduite::before, .win.reduite .pb, .win.reduite .pf, .win.reduite .hatch, .win.reduite .tag, .win.reduite .pin, .win.reduite .badge, .win.reduite .grip, .win.reduite .in::before { display: none !important; }
.win.reduite .panel { background: none !important; padding: 0 !important; clip-path: none !important; animation: none !important; }
.win.reduite .in { background: none !important; clip-path: none !important; }
.win.reduite .ph h2 { cursor: pointer; }`;

async function reduce(p, ids) {
  await p.evaluate(({ ids, css }) => {
    if (!document.getElementById('reduite-css')) { const st = document.createElement('style'); st.id = 'reduite-css'; st.textContent = css; document.head.append(st); }
    ids.forEach((id) => document.querySelector(`#world .win[data-id="${id}"]`).classList.add('reduite'));
  }, { ids, css: REDUCE_CSS });
  await p.waitForTimeout(400);
}

// Salle immersive : mur courbe autour de toi, plan 1 au loin au centre, sol miroir jusqu'à l'horizon.
async function vr(p, yaw = 0) {
  await p.evaluate((yaw) => {
    const vw = innerWidth, vh = innerHeight, P = 1000, R = 1300, rad = Math.PI / 180;
    const W = window.__hub.wins, S = W.S;
    const rules = [];
    const wall = { web: [-25, 0.42], pc: [-56, 0.50], noyau: [25, 0.47], progress: [56, 0.44] };
    Object.entries(wall).forEach(([id, [deg, yc]]) => {
      const s = S[id]; if (!s || s.hid) return;
      const f = deg * rad, w = s.w, h = s.h;
      const x = vw / 2 + R * Math.sin(f) - w / 2, z = P - R * Math.cos(f), y = vh * yc - h / 2;
      rules.push(`body.vr #world .win[data-id="${id}"] { transform: translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, ${z.toFixed(0)}px) rotateY(${(-deg).toFixed(1)}deg) !important; -webkit-box-reflect: below 14px linear-gradient(transparent 62%, rgba(255,255,255,.16)); }`);
    });
    // Le plan 1 (fenêtres, recherche, emplacement de l'orbe) recule au fond de la salle
    const Z1 = -1700;
    ['favs', 'notes', 'video', 'music'].forEach((id) => {
      const s = S[id]; if (!s || s.hid) return;
      rules.push(`body.vr #world .win[data-id="${id}"] { transform: translate3d(${s.tx.toFixed(0)}px, ${s.ty.toFixed(0)}px, ${Z1}px) !important; filter: brightness(.62) blur(.6px); }`);
    });
    rules.push(`body.vr #world #search, body.vr #world #anchor { transform: translateZ(${Z1}px) !important; }`);
    rules.push(`body.vr { perspective: ${P}px; perspective-origin: 50% 44%; }`);
    rules.push(`body.vr #world { transform: translateZ(${P}px) rotateY(${yaw}deg) translateZ(-${P}px) !important; transform-style: preserve-3d; }`);
    rules.push(`body.vr #world .floor { display: block !important; opacity: 1 !important; left: ${vw / 2 - 5000}px !important; top: ${vh * 0.97 - 5000}px !important; width: 10000px !important; height: 10000px !important; transform: rotateX(90deg) !important;
      background: linear-gradient(rgba(63,230,255,.22) 1.5px, transparent 1.5px) 0 0 / 120px 120px, linear-gradient(90deg, rgba(63,230,255,.22) 1.5px, transparent 1.5px) 0 0 / 120px 120px, radial-gradient(closest-side, rgba(3,16,30,.85), rgba(2,6,13,.95)) !important;
      -webkit-mask-image: radial-gradient(closest-side, #000 20%, transparent 70%); mask-image: radial-gradient(closest-side, #000 20%, transparent 70%); }`);
    rules.push(`body.vr .vr-haze { position: fixed; inset: 0; z-index: 3; pointer-events: none; background: linear-gradient(to bottom, rgba(2,6,13,.55) 0%, transparent 22%, transparent 48%, rgba(63,230,255,.07) 60%, transparent 72%, rgba(2,6,13,.35) 100%); }`);
    rules.push(`body.vr .dof, body.vr #agband, body.vr .labels { display: none !important; }`);
    let st = document.getElementById('vr-css'); if (!st) { st = document.createElement('style'); st.id = 'vr-css'; document.head.append(st); }
    st.textContent = rules.join('\n');
    if (!document.querySelector('.vr-haze')) { const hz = document.createElement('div'); hz.className = 'vr-haze'; document.body.append(hz); }
    document.body.classList.add('vr', 'cine'); document.body.style.setProperty('--cine', '1');
    ['plan1', 'plan2', 'plan3'].forEach((b, i) => document.getElementById(b).setAttribute('aria-pressed', String(i === 1)));
  }, yaw);
  await p.waitForTimeout(1800);
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/hub/index.html'); await p.waitForTimeout(2500); await seed(p); await p.reload(); await p.waitForTimeout(6000); await clean(p);
  await afterPC(p); await clean(p);
  // Fenêtres réduites : Notes et Musique
  await reduce(p, ['notes', 'music']); await clean(p);
  await p.screenshot({ path: `${OUT}/reduite-plan1.png` });
  await p.evaluate(() => document.querySelectorAll('.win.reduite').forEach((w) => w.classList.remove('reduite')));
  // Plan 2 : progression affichée pour peupler le mur
  await p.evaluate(() => { const W = window.__hub.wins, e = W.elById('progress'); W.S.progress.hid = false; e.classList.remove('hid'); W.S.progress.w = 380; W.S.progress.h = 330; e.style.width = '380px'; e.style.height = '330px'; });
  await vr(p, 0); await clean(p); await p.screenshot({ path: `${OUT}/vr-face.png` });
  await vr(p, 28); await clean(p); await p.screenshot({ path: `${OUT}/vr-gauche.png` });
  await vr(p, -28); await clean(p); await p.screenshot({ path: `${OUT}/vr-droite.png` });
  console.log(errs.join('\n') || 'aucune erreur');
  await b.close();
})();
