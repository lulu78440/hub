"""Cycle 5 · Performance et confort : images par seconde, mémoire dans la durée, chargement à froid, mouvement réduit,
navigation au clavier, contrastes. NB : le navigateur de test dessine la 3D sans carte graphique (SwiftShader) :
les images par seconde mesurées ici sont un plancher, pas la valeur du PC ou du téléphone de Lucien."""
import time, json
from hubtest import ev, seed
from t2_fonctions import make_mock


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


FPS = """async (ms) => { let n = 0; const t0 = performance.now(); await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n * 1000 / (performance.now() - t0); }"""


def test_confort_chargement_a_froid_et_images_par_seconde(h):
    h.mock = make_mock()
    res = {}
    for label, kw in (("PC", {"three": True}), ("mobile", {"mobile": True, "three": True})):
        d = h.device(**kw)
        p = d.ctx.new_page(); p.on("dialog", lambda x: x.accept())
        t0 = time.time()
        p.goto(h.server.url, wait_until="domcontentloaded")
        p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
        ready = time.time() - t0
        p.wait_for_function("!!document.querySelector('#scene') && document.querySelector('#scene').width > 0", timeout=40000)
        p.wait_for_timeout(1500)
        fps = p.evaluate(FPS, 3000)
        res[label] = (round(ready, 2), round(fps))
        _assert(ready < 8, f"chargement à froid {label} : {ready:.1f} s")
        _assert(not d.errors, f"erreurs console {label} : " + str(d.errors))
        d.close()
    print("        (chargement s, images/s logiciel) :", res)


def test_confort_memoire_dans_la_duree(h):
    """Fuite de mémoire : le tas JavaScript ne doit pas grimper sans fin (version courte : 3 min, avec gestes)."""
    h.mock = make_mock()
    d = h.device(three=True); p = d.page(); seed(p, 50, 50, 50)
    cdp = d.ctx.new_cdp_session(p)
    cdp.send("HeapProfiler.enable")
    def heap():
        cdp.send("HeapProfiler.collectGarbage")
        return p.evaluate("performance.memory.usedJSHeapSize") / 1e6
    p.evaluate("document.activeElement && document.activeElement.blur()")
    p.wait_for_timeout(5000); h0 = heap()
    samples = [h0]
    for i in range(6):
        for k in "2312":
            p.keyboard.press(k); p.wait_for_timeout(400)
        p.mouse.move(200 + i * 100, 300); p.mouse.click(800, 450, button="right"); p.keyboard.press("Escape")
        ev(p, "const s = await import('/js/store/storage.js'); await s.store.put('notes', { id: 'mem' + arg, text: 'x'.repeat(500), created: 1, updated: Date.now() });", i)
        p.wait_for_timeout(25000)
        samples.append(heap())
    growth = samples[-1] - samples[1]
    print("        tas JS (Mo) :", [round(x, 1) for x in samples])
    _assert(growth < 15, f"mémoire qui grimpe : +{growth:.1f} Mo en ~2,5 min")
    _assert(not d.errors, "erreurs console : " + str(d.errors))
    d.close()
test_confort_memoire_dans_la_duree.long = True


def test_confort_mouvement_reduit(h):
    h.mock = make_mock()
    d = h.device(reduced=True); p = d.page()
    _assert(p.evaluate("window.__hub.state.reduce === true"), "mouvement réduit non détecté")
    anim = p.evaluate("""[...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e);
        return s.animationName !== 'none' && s.animationPlayState === 'running' && parseFloat(s.animationDuration) > 0 && s.animationIterationCount === 'infinite' && e.getClientRects().length; })
        .map(e => (e.id || e.className || e.tagName).toString().slice(0, 40) + ' → ' + getComputedStyle(e).animationName)""")
    _assert(not anim, "animations sans fin malgré « mouvement réduit » : " + str(anim[:12]))
    d.close()


def test_confort_navigation_clavier(h):
    h.mock = make_mock()
    d = h.device(); p = d.page(); seed(p, 3, 3, 3)
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(900)
    seen, no_ring = [], []
    for _ in range(60):
        p.keyboard.press("Tab")
        info = p.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body) return null;
            const look = () => { const s = getComputedStyle(e); return [s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, s.boxShadow, s.color, s.backgroundColor, s.borderColor, s.textDecorationLine].join('|'); };
            const on = look(); const ring = /^true/.test(on);
            e.blur(); const off = look(); e.focus({ focusVisible: true });
            const r = e.getBoundingClientRect();
            return { d: (e.closest('.win') ? e.closest('.win').dataset.id + ' ' : '') + e.tagName + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label').slice(0, 25) + ']' : '') + ' ' + (e.textContent || '').trim().slice(0, 20), ring: ring || on !== off, vis: r.width > 0 && r.height > 0 }; }""")
        if not info:
            continue
        seen.append(info["d"])
        if info["vis"] and not info["ring"]:
            no_ring.append(info["d"])
    wins = {s.split(" ")[0] for s in seen}
    print(f"        {len(set(seen))} éléments atteints au clavier ; sans contour visible : {len(set(no_ring))}")
    _assert(len(set(seen)) >= 15, "trop peu d'éléments atteignables au clavier : " + str(seen[:10]))
    _assert({"notes", "tasks"} & wins, "fenêtres Notes / Tâches inaccessibles au clavier")
    _assert(len(set(no_ring)) <= 3, "éléments focalisés sans contour visible : " + str(sorted(set(no_ring))[:10]))
    # Échap ferme le menu, D ouvre le diagnostic
    p.evaluate("document.activeElement && document.activeElement.blur()")
    p.keyboard.press("d"); _assert(p.evaluate("!document.getElementById('diag').hidden"), "touche D sans effet")
    p.keyboard.press("Escape"); _assert(p.evaluate("document.getElementById('diag').hidden"), "Échap ne ferme pas le diagnostic")
    d.close()


CONTRAST = """() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const page = [2, 6, 13, 1];
  const bgOf = (e) => { const chain = []; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) chain.push(c); } let b = page; for (let i = chain.length - 1; i >= 0; i--) b = over(chain[i], b); return b; };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const done = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode, e = t.parentElement; if (!e || done.has(e) || !t.textContent.trim()) continue; done.add(e);
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) continue;
    let op = 1; for (let n = e; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    if (op < 0.2) continue;
    const fg = parse(s.color); if (!fg || fg[3] === 0) continue;
    if ((s.webkitTextFillColor && /rgba\\(.*, 0\\)|transparent/.test(s.webkitTextFillColor)) || /text/.test(s.backgroundClip + s.webkitBackgroundClip)) continue;   // texte en dégradé : non mesurable ici
    let grad = false; for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') { grad = true; break; } }
    if (grad) continue;   // fond en dégradé ou image : non mesurable ici
    const bg = bgOf(e), col = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const L1 = lum(col), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
    out.push({ txt: t.textContent.trim().slice(0, 30), where: (e.closest('[data-id]') || {}).dataset ? e.closest('[data-id]').dataset.id : (e.className || e.tagName).toString().slice(0, 20), ratio: Math.round(ratio * 10) / 10, need: big ? 3 : 4.5, size: s.fontSize });
  }
  return out;
}"""


def test_confort_contrastes(h):
    h.mock = make_mock()
    res = {}
    for plan in ("1", "2"):
        d = h.device(); p = d.page(); seed(p, 3, 3, 3)
        p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press(plan); p.wait_for_timeout(1500)
        items = p.evaluate(CONTRAST)
        bad = [x for x in items if x["ratio"] < x["need"]]
        awful = [x for x in items if x["ratio"] < 3]
        res[plan] = (len(items), len(bad), awful)
        d.close()
    for plan, (n, nbad, awful) in res.items():
        print(f"        plan {plan} : {n} textes, {nbad} sous le seuil WCAG AA, {len(awful)} sous 3:1")
    worst = res["1"][2] + res["2"][2]
    _assert(len(worst) <= 10, "textes peu lisibles (contraste < 3:1) : " + json.dumps(sorted(worst, key=lambda x: x["ratio"])[:12], ensure_ascii=False))
