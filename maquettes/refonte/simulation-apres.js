// Maquette ergo-plan : captures AVANT / APRÈS du vrai hub (copie locale), l'« après » étant simulé par injection.
const { chromium } = require('playwright');
const OUT = process.argv[2];
const URL = 'http://localhost:8765/hub/index.html';
const today = new Date().toISOString().slice(0, 10);

async function seed(p) {
  await p.evaluate(async (today) => {
    const { store } = await import('/hub/js/store/storage.js');
    const now = Date.now();
    const notes = [['Idées vacances : Bretagne en juin, réserver le gîte', true], ['Code Wi-Fi invités : voir le dos de la box', false], ['Livres : Dune tome 2, Fondation', false]];
    for (const [i, [text, pinned]] of notes.entries()) await store.put('notes', { id: 'n' + i, text, pinned, created: now - i * 9e6, updated: now - i * 9e6 });
    const favs = [['Wikipédia', 'https://fr.wikipedia.org', 'Savoir'], ['GitHub', 'https://github.com', 'Tech'], ['MDN', 'https://developer.mozilla.org', 'Tech'], ['Météo-France', 'https://meteofrance.com', 'Quotidien'], ['La Poste', 'https://www.laposte.fr', 'Quotidien'], ['YouTube', 'https://www.youtube.com', 'Quotidien'], ['Brave Search', 'https://search.brave.com', 'Tech'], ['OpenStreetMap', 'https://www.openstreetmap.org', 'Savoir']];
    for (const [i, [title, url, group]] of favs.entries()) await store.put('favs', { id: 'f' + i, title, url, group, created: now });
    await store.put('events', { id: 'e1', title: 'Dentiste', date: today, start: '16:30', end: '17:15', remind: 10, created: now });
    await store.put('events', { id: 'e2', title: 'Appel maman', date: today, start: '19:00', end: '19:30', remind: 10, created: now });
    localStorage.setItem('hub-meteo-lieu', JSON.stringify({ lat: 48.85, lon: 2.35, name: 'Paris' }));
  }, today);
}
const clean = (p) => p.evaluate(() => { document.querySelectorAll('.brief, .toast').forEach((e) => e.remove()); const a = document.getElementById('alerts'); if (a) a.hidden = true; document.getElementById('q').blur(); });

// ---------- Simulation de l'APRÈS (PC) ----------
async function afterPC(p) {
  await p.evaluate(() => {
    const H = window.__hub, W = H.wins, S = W.S;
    const el = (id) => W.elById(id);
    const vw = innerWidth, T = 124, B = innerHeight - 52, Lw = Math.min(Math.max(vw * 0.23, 280), 380), Rw = Math.min(Math.max(vw * 0.27, 320), 440), Rx = vw - 16 - Rw;
    const vh = (Rw - 36) * 9 / 16 + 76;
    const put = (id, x, y, w, h) => { const s = S[id], e = el(id); if (!s || !e) return; s.tx = s.cx = x; s.ty = s.cy = y; s.w = w; s.h = h; e.style.width = w + 'px'; e.style.height = h + 'px'; };
    put('favs', 16, T, Lw, 330);
    put('notes', 16, T + 344, Lw, B - T - 344);
    put('video', Rx, T, Rw, vh);
    put('music', Rx, T + vh + 14, Rw, B - T - vh - 14);
    put('web', -(Lw + 120), T, Lw + 40, 420);
    put('pc', -(Lw + 120), T + 440, Lw + 40, 250);
    put('noyau', vw + 80, T, 480, 680);
    ['watch', 'tasks', 'rituels', 'radar', 'securite', 'savoir', 'mails', 'progress'].forEach((id) => { const e = el(id); if (e) { S[id].hid = true; e.classList.add('hid'); } });
    W.togglePin(el('notes')); W.togglePin(el('notes'));   // force l'enregistrement de la disposition
    dispatchEvent(new Event('resize'));
    document.querySelectorAll('.toast').forEach((e) => e.remove());
    // Allègement des fenêtres : étiquette seulement si elle dit quelque chose, pieds de page fixes retirés.
    document.querySelectorAll('#world .win').forEach((w) => {
      const t = w.querySelector('.ph .tag'), h = w.querySelector('h2');
      if (t && h && t.textContent.trim().toUpperCase() === h.textContent.trim().toUpperCase()) t.style.display = 'none';
      const pf = w.querySelector('.pf'); if (pf && !pf.querySelector('button, a')) pf.style.display = 'none';
    });
    const st = document.createElement('style'); st.id = 'apres'; st.textContent = `
      #search .hints, #fps, .zoom, .brand > div > span, #fs, #b-diag { display: none !important; }
      #search:focus-within .hints { display: flex !important; }
      .win .hatch { opacity: .35; }
      .vsub-help, .vstrip-help { display: none; }
    `; document.head.append(st);
    // Barre du haut : Outils à la place de Plein écran et Diag
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'b-outils'; b.textContent = 'Outils'; b.title = 'Outils et réglages (touche O)';
    document.getElementById('b-labo').before(b);
    // Légende « Tâches » retirée avec la fenêtre
    document.querySelectorAll('#labels .lab').forEach((l) => { if (/Tâches/.test(l.textContent)) l.style.display = 'none'; });
    // Aide longue de « Vidéos à suivre » raccourcie
    document.querySelectorAll('[data-id="video"] p, [data-id="video"] .empty').forEach((pp) => { if (/Ajoute des chaînes/.test(pp.textContent)) pp.textContent = 'Rien à suivre · colle un lien ou ajoute une chaîne'; });
  });
  await p.waitForTimeout(600);
  await p.keyboard.press('2'); await p.waitForTimeout(2500); await p.keyboard.press('1'); await p.waitForTimeout(5000);
}

function menuHTML(items) {
  return items.map((it) => it === '-' ? '<hr>' : it.h ? `<div class="ch">${it.h}</div>` : `<button type="button" role="menuitem"${it.off ? ' disabled' : ''}${it.hi ? ' style="background:rgba(63,230,255,.14);color:var(--cyan)"' : ''}><span>${it.t}</span>${it.k ? `<kbd>${it.k}</kbd>` : ''}</button>`).join('');
}
async function showMenu(p, x, y, items, sheet = false) {
  await p.evaluate(({ x, y, html, sheet }) => {
    const box = document.getElementById('ctx'); box.innerHTML = html; box.hidden = false; box.classList.toggle('sheet', sheet);
    if (!sheet) { const r = box.getBoundingClientRect(); box.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; box.style.top = Math.min(y, innerHeight - r.height - 8) + 'px'; }
  }, { x, y, html: menuHTML(items), sheet });
}
const hideMenu = (p) => p.evaluate(() => { const b = document.getElementById('ctx'); b.hidden = true; b.innerHTML = ''; });

const FOND_APRES = [{ h: 'Hub' }, { t: 'Focus 25 min' }, { t: 'Revoir le briefing du jour' }, { t: 'Coller une image ici', k: 'Ctrl+V' }, '-',
  { t: 'Aller au plan 2 · Noyau et web', k: '2' }, { t: 'Aller au plan 3 · Mon PC', k: '3' }, '-', { t: 'Verrouiller maintenant' }, { t: 'Outils…', k: 'O', hi: true }];
const FEN_APRES = [{ h: 'Vidéo' }, { t: 'Plein écran', off: true }, { t: 'Arrêter', off: true }, '-', { h: 'Fenêtre' }, { t: 'Ramener vers moi' }, { t: 'Figer la fenêtre' }, { t: 'Masquer la fenêtre' }, { t: 'Plus…', k: '›', hi: true }];
const PLUS_APRES = [{ h: 'Vidéo · plus' }, { t: 'Masquer les vidéos à suivre' }, { t: 'Ajouter des chaînes YouTube ↗' }, '-', { t: 'Agrandir', k: 'double-clic' }, { t: 'Ramener devant' }, { t: 'Focus 25 min sur cette fenêtre' }, { t: 'Résumer avec le Noyau' }, '-', { t: '‹ Retour' }];

async function showOutils(p, lite = false) {
  await p.evaluate((lite) => {
    const o = document.createElement('div'); o.id = 'outils-proto';
    const tile = (ico, t, s) => `<button type="button" class="ot"><b>${ico}</b><span>${t}</span>${s ? `<small>${s}</small>` : ''}</button>`;
    o.innerHTML = `<div class="oh"><h2>Outils</h2><span>${lite ? '' : 'O pour ouvrir · Échap pour fermer'}</span><button type="button" class="ox" aria-label="Fermer">✕</button></div>
    <h3>Gestes</h3><div class="og">${tile('◎', 'Focus', '25 · 50 min')}${tile('☀', 'Briefing', 'revoir')}${tile('✎', 'Capture', 'note rapide')}${lite ? '' : tile('▣', 'Image', 'ajouter') + tile('⤢', 'Plein écran', 'F11')}${tile('🔒', 'Verrouiller', '')}</div>
    <h3>Fenêtres rangées</h3><div class="og">${tile('▤', 'Progression', '78 %')}${tile('✉', 'Mails', 'à configurer')}${tile('◫', 'Masquées', '0')}${tile('↺', lite ? 'Ordre' : 'Disposition', "d'origine")}</div>
    <h3>Ambiance</h3><div class="og">${tile('☾', 'Crépuscule', 'auto')}${lite ? '' : tile('✦', 'Entité', 'posée') + tile('⌖', 'Curseur HUD', 'auto')}${tile('🔊', 'Son', 'rappels actif')}</div>
    <h3>Données</h3><div class="og">${tile('⇩', 'Exporter', 'il y a 3 j')}${tile('⇧', 'Importer', '')}${tile('◇', 'Coffre du Hub', 'ajouter')}${tile('⟳', 'Synchro', 'PC ✓')}</div>
    <button type="button" class="oreg">Réglages et diagnostic <span>verrouillage · synchro · surprises · fonctions en réserve · état technique${lite ? '' : ' · D'}</span></button>`;
    const st = document.createElement('style'); st.textContent = `
    #outils-proto { position: fixed; z-index: 12; ${lite ? 'left: 8px; width: calc(100vw - 16px); bottom: 8px; max-height: 82vh; overflow:auto;' : 'right: 16px; top: 64px; width: 560px;'} padding: 14px 16px 16px; background: rgba(3,13,24,.97); border: 1px solid var(--cyan); clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); box-shadow: 0 0 40px rgba(63,230,255,.18); font-family: var(--ui); color: var(--ink); }
    #outils-proto .oh { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
    #outils-proto h2 { margin: 0; font-family: var(--hud, Orbitron, sans-serif); font-size: 15px; letter-spacing: .3em; color: var(--cyan); text-transform: uppercase; }
    #outils-proto .oh span { font-family: var(--mono); font-size: 10px; color: var(--dim); flex: 1; }
    #outils-proto .ox { border: 0; background: none; color: var(--dim); font-size: 16px; cursor: pointer; }
    #outils-proto h3 { margin: 12px 0 6px; font-family: var(--mono); font-size: 10px; letter-spacing: .16em; color: var(--dim); text-transform: uppercase; font-weight: 400; }
    #outils-proto, #outils-proto * { box-sizing: border-box; } #outils-proto .ot { min-width: 0; } #outils-proto .og { display: grid; grid-template-columns: repeat(${lite ? 3 : 6}, minmax(0, 1fr)); gap: 6px; }
    #outils-proto .ot { display: grid; justify-items: center; gap: 2px; padding: 9px 4px 7px; border: 1px solid rgba(63,230,255,.22); background: rgba(63,230,255,.04); color: var(--ink); font: inherit; cursor: pointer; }
    #outils-proto .ot:hover { border-color: var(--cyan); background: rgba(63,230,255,.12); }
    #outils-proto .ot b { font-size: 18px; color: var(--cyan); font-weight: 400; line-height: 1.2; }
    #outils-proto .ot span { font-size: 13px; font-weight: 600; }
    #outils-proto .ot small { font-family: var(--mono); font-size: 9.5px; color: var(--dim); }
    #outils-proto .oreg { margin-top: 12px; width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 9px 12px; border: 1px solid rgba(63,230,255,.35); background: transparent; color: var(--ink); font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; text-align: left; }
    #outils-proto .oreg span { font-family: var(--mono); font-size: 10px; color: var(--dim); font-weight: 400; }`;
    document.head.append(st); document.body.append(o);
  }, lite);
}

// ---------- Simulation de l'APRÈS (mobile) ----------
async function afterMob(p) {
  await p.evaluate(() => {
    const order = ['meteo', 'agenda', 'notes', 'favs', 'video', 'music', 'noyau', 'web'];
    const hide = ['tasks', 'rituels', 'radar', 'watch', 'securite', 'savoir', 'mails', 'strip'];
    document.querySelectorAll('#world .win').forEach((w) => {
      const id = w.dataset.id; const i = order.indexOf(id);
      if (i >= 0) w.style.order = String(3 + i);
      if (hide.includes(id)) w.style.display = 'none';
      const t = w.querySelector('.ph .tag'), h = w.querySelector('h2');
      if (t && h && t.textContent.trim().toUpperCase() === h.textContent.trim().toUpperCase()) t.style.display = 'none';
      const pf = w.querySelector('.pf'); if (pf && !pf.querySelector('button, a')) pf.style.display = 'none';
    });
    const st = document.createElement('style'); st.textContent = `#fps, #mlayout > p, #b-diag, #fs { display: none !important; } .win .hatch { opacity: .35; }`;
    document.head.append(st);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Outils';
    document.getElementById('b-labo').before(b);
    document.querySelectorAll('[data-id="video"] p, [data-id="video"] .empty').forEach((pp) => { if (/Ajoute des chaînes/.test(pp.textContent)) pp.textContent = 'Rien à suivre · colle un lien ou ajoute une chaîne'; });
  });
  await p.waitForTimeout(500);
}

module.exports = { seed, clean, afterPC, showMenu, hideMenu, menuHTML, showOutils, afterMob };
if (require.main === module) (async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  // PC
  {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('pc: ' + e.message));
    await p.goto(URL); await p.waitForTimeout(2500); await seed(p); await p.reload(); await p.waitForTimeout(6000); await clean(p);
    await p.screenshot({ path: `${OUT}/avant-pc-plan1.png` });
    await p.mouse.click(700, 560, { button: 'right' }); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/avant-pc-menu-fond.png` }); await p.keyboard.press('Escape');
    const vb = await p.locator('[data-id="video"] .pb').first().boundingBox();
    await p.mouse.click(vb.x + vb.width - 40, vb.y + vb.height - 20, { button: 'right' }); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/avant-pc-menu-fenetre.png` }); await p.keyboard.press('Escape');
    await p.keyboard.press('2'); await p.waitForTimeout(2500); await clean(p); await p.screenshot({ path: `${OUT}/avant-pc-plan2.png` });
    await p.keyboard.press('1'); await p.waitForTimeout(2000);
    await afterPC(p); await clean(p);
    await p.screenshot({ path: `${OUT}/apres-pc-plan1.png` });
    await showMenu(p, 700, 520, FOND_APRES); await p.screenshot({ path: `${OUT}/apres-pc-menu-fond.png` }); await hideMenu(p);
    await showMenu(p, vb.x + vb.width - 300, vb.y + 40, FEN_APRES); await p.screenshot({ path: `${OUT}/apres-pc-menu-fenetre.png` }); await hideMenu(p);
    await showMenu(p, vb.x + vb.width - 300, vb.y + 40, PLUS_APRES); await p.screenshot({ path: `${OUT}/apres-pc-menu-plus.png` }); await hideMenu(p);
    await showOutils(p); await p.screenshot({ path: `${OUT}/apres-pc-outils.png` }); await p.evaluate(() => document.getElementById('outils-proto').remove());
    await p.keyboard.press('2'); await p.waitForTimeout(4000); await clean(p); await p.screenshot({ path: `${OUT}/apres-pc-plan2.png` });
    await ctx.close();
  }
  // Mobile
  {
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('mob: ' + e.message));
    await p.goto(URL); await p.waitForTimeout(2500); await seed(p); await p.reload(); await p.waitForTimeout(6000); await clean(p);
    await p.screenshot({ path: `${OUT}/avant-mob.png`, fullPage: true });
    const h0 = await p.evaluate(() => document.documentElement.scrollHeight);
    await afterMob(p); await clean(p);
    await p.screenshot({ path: `${OUT}/apres-mob.png`, fullPage: true });
    const h1 = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.evaluate(() => scrollTo(0, 0));
    await showMenu(p, 0, 0, [{ h: 'Fenêtre · Notes' }, { t: 'Ramener vers moi' }, { t: 'Monter' }, { t: 'Descendre' }, { t: 'Masquer la fenêtre' }], true);
    await p.screenshot({ path: `${OUT}/apres-mob-menu.png` }); await hideMenu(p);
    await showOutils(p, true); await p.screenshot({ path: `${OUT}/apres-mob-outils.png` });
    console.log('hauteur mobile avant / après :', h0, h1);
    await ctx.close();
  }
  console.log(errs.join('\n') || 'aucune erreur');
  await b.close();
})();
