"""Cycle 3 · Sécurité : secrets du dépôt, textes piégés, liens javascript:, verrouillage, secrets jamais exportés ni synchronisés,
liens externes, page en direct isolée. Tout se passe sur le serveur local, avec des données factices."""
import json, os, re, subprocess, datetime, time
from hubtest import ROOT, PHRASE, FAKE_TOKEN, ev, seed, counts, enable_vault, unlock_page, export_file, import_file, write_json
from fakes import FakeGitHub
from t2_fonctions import make_mock, FLUX

PWN = "window.__pwn = (window.__pwn || 0) + 1"
TRAPS = [
    '<img src=x onerror="' + PWN + '">',
    '<script>' + PWN + '</script>',
    '"><svg onload="' + PWN + '">',
    "javascript:" + PWN,
    "<a href=\"javascript:" + PWN + "\">clic</a>",
]
JS_LINK = "javascript:" + PWN + ";void 0"


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def _pwned(p):
    """Le piège s'est-il déclenché (dans la page ou dans un onglet ouvert depuis elle) ?"""
    return any((x.evaluate("window.__pwn || 0") if not x.is_closed() else 0) for x in p.context.pages)


EXEMPLES = {"maman@gmail.com"}      # exemples d'interface (mail.js), pas des données réelles


def test_securite_aucun_secret_dans_le_depot(h):
    files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    pats = {"jeton GitHub": r"gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}", "clé Google": r"AIza[0-9A-Za-z_\-]{30,}",
            "clé privée": r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "secret OAuth": r"GOCSPX-[A-Za-z0-9_\-]{20,}",
            "adresse mail": r"[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo|orange|free|sfr|laposte|icloud)\.[a-z]{2,}"}
    found = []
    for f in files:
        if f.startswith(("vendor/", "fonts/", "tools/tests/")) or f.endswith((".png", ".woff2", ".zip", ".jpg", ".webp")):
            continue
        try:
            s = open(os.path.join(ROOT, f), encoding="utf-8", errors="ignore").read()
        except (IsADirectoryError, FileNotFoundError):
            continue
        for k, rx in pats.items():
            for m in re.finditer(rx, s):
                if m.group(0) in EXEMPLES:
                    continue
                found.append(f"{f} : {k} « {m.group(0)[:12]}… »")
    _assert(not found, "secrets ou données personnelles dans le dépôt : " + "; ".join(found))


def test_securite_textes_pieges_notes_taches_agenda_favoris(h):
    h.mock = make_mock()
    d = h.device(); p = d.page()
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(900)
    for t in TRAPS:
        for w in ("notes", "tasks"):
            inp = p.locator(f'.win[data-id="{w}"] form.addrow input'); inp.fill(t); inp.press("Enter")
    ev(p, """const s = await import('/js/store/storage.js'); const now = Date.now();
      for (const [i, t] of arg.entries()) {
        await s.store.put('events', { id: 'e-pi-' + i, title: t, date: new Date().toISOString().slice(0, 10), start: '10:0' + i, end: null, created: now });
        await s.store.put('favs', { id: 'f-pi-' + i, title: t, url: 'https://piege.test/' + i, group: t, created: now });
      }""", TRAPS)
    p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.keyboard.press("2"); p.wait_for_timeout(1500)
    # ouvrir l'agenda complet et le briefing pour que tout soit affiché
    p.evaluate("document.getElementById('agband') && document.getElementById('agband').click()"); p.wait_for_timeout(500)
    _assert(not _pwned(p), "un texte piégé s'est exécuté")
    n = p.evaluate("document.querySelectorAll('.win img[src=x], .win svg[onload], .win script, .agdrawer img[src=x]').length")
    _assert(n == 0, f"{n} balise(s) piégée(s) insérée(s) dans la page")
    _assert(not d.errors, "erreurs console : " + str(d.errors))
    d.close()


def test_securite_liens_javascript_fichiers_importes(h):
    """Un export du hub trafiqué (favori, vidéo, radio, page en direct en javascript:) ne doit rien exécuter."""
    h.mock = make_mock()
    d = h.device(); p = d.page()
    data = {"format": "hub-donnees", "formatVersion": 1, "exportedAt": datetime.datetime.now().isoformat(),
            "data": {"notes": [], "tasks": [], "events": [], "kv": [], "images": [],
                     "favs": [{"id": "f-js", "title": "Favori piégé", "url": JS_LINK, "group": "Pièges", "created": 1},
                              {"id": "f-data", "title": "Favori data", "url": "data:text/html,<script>" + PWN + "</script>", "group": "Pièges", "created": 2}]},
            "prefs": {"hub-web-url": JS_LINK, "hub-radios": json.dumps([{"n": "Radio piégée", "u": JS_LINK}])}}
    path = write_json(h, "c3-export-piege.json", data)
    import_file(p, path)
    p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(1000)
    hrefs = p.evaluate("[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^\\s*(javascript|data|vbscript):/i.test(h))")
    srcs = p.evaluate("[...document.querySelectorAll('iframe[src], audio[src]')].map(a => a.getAttribute('src')).filter(h => /^\\s*(javascript|data):/i.test(h))")
    # Clic sur les favoris piégés et « Ouvrir ici » du menu
    for fid in ("f-js", "f-data"):
        p.evaluate("id => { const a = document.querySelector('.win[data-id=\"favs\"] a[data-id=\"' + id + '\"]'); if (a) a.click(); }", fid); p.wait_for_timeout(300)
    opened = p.evaluate("""() => { const a = document.querySelector('.win[data-id="favs"] a[data-id="f-js"]'); if (!a) return 'absent';
      const r = a.getBoundingClientRect(); a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 2, clientY: r.y + 2, button: 2 }));
      const it = [...document.querySelectorAll('#ctx *')].find(e => e.children.length === 0 && e.textContent.trim() === 'Ouvrir ici');
      if (!it) return 'menu sans « Ouvrir ici »'; (it.closest('button') || it).click(); return 'cliqué'; }""")
    p.wait_for_timeout(500)
    pw = _pwned(p)
    _assert(not hrefs and not srcs and not pw, f"liens dangereux : href={hrefs} src={srcs} exécuté={pw} (Ouvrir ici : {opened})")
    d.close()


def test_securite_flux_rss_piege(h):
    """Un flux RSS hostile (titre HTML, lien javascript:) ne doit rien exécuter dans le hub."""
    flux = json.loads(json.dumps(FLUX))
    flux["actus"].insert(0, {"titre": TRAPS[0], "lien": JS_LINK, "date": "2026-10-24T11:00:00Z", "cat": "<b>X</b>", "couleur": "red;background:url(https://fuite.test/x)", "source": TRAPS[1]})
    flux["sites"][0]["articles"].insert(0, {"titre": TRAPS[2], "lien": JS_LINK, "date": "2026-10-24T11:00:00Z"})
    flux["sites"][1]["url"] = JS_LINK
    flux["sites"][1]["nom"] = TRAPS[0]
    h.mock = make_mock(flux)
    d = h.device(); p = d.page()
    p.wait_for_function("document.querySelectorAll('.ticker .run a.it').length >= 1", timeout=60000)
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(1000)
    hrefs = p.evaluate("[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^\\s*javascript:/i.test(h))")
    # clic sur le premier titre du bandeau et sur l'article de la veille
    p.evaluate("const a = document.querySelector('.ticker .run a.it'); a && a.click()"); p.wait_for_timeout(400)
    p.evaluate("const a = document.querySelector('.win[data-id=\"watch\"] .warts a'); a && a.click()"); p.wait_for_timeout(400)
    p.evaluate("const b = [...document.querySelectorAll('.alert button')].find(b => !b.classList.contains('ok')); b && b.click()"); p.wait_for_timeout(400)
    pw = _pwned(p)
    leaks = [u for u in d.blocked if "fuite.test" in u]
    _assert(not hrefs and not pw, f"liens javascript: du flux : {hrefs} ; exécuté : {pw}")
    _assert(not leaks, "requête vers un site extérieur provoquée par le flux : " + str(leaks))
    _assert(p.evaluate("document.querySelectorAll('.ticker img, .ticker script, .win img[src=x]').length") == 0, "balises du flux insérées")
    d.close()


def test_securite_verrouillage(h):
    d = h.device(); p = d.page(); seed(p)
    ev(p, "localStorage.setItem('hub-meteo-lieu', JSON.stringify({lat: 1, lon: 2, name: 'Ville secrète factice'})); localStorage.setItem('hub-secret-mails', JSON.stringify({gmail: {at: 'jeton-mail-factice'}}));")
    enable_vault(p)
    # Données illisibles au repos : IndexedDB et réglages privés
    dump = ev(p, """const r = indexedDB.open('hub'); const db = await new Promise(x => r.onsuccess = () => x(r.result)); const out = {};
      for (const c of ['notes','tasks','events','favs','kv']) out[c] = await new Promise(x => { const q = db.transaction(c).objectStore(c).getAll(); q.onsuccess = () => x(q.result); });
      return JSON.stringify(out) + JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));""")
    for clair in ("Note factice", "Tâche factice", "exemple.test", "RDV factice", "Ville secrète", "jeton-mail-factice"):
        _assert(clair not in dump, "en clair au repos : " + clair)
    # Redémarrage : mauvaise phrase refusée, puis bonne phrase
    p.reload()
    p.wait_for_selector(".lock .lcard input")
    _assert(not p.evaluate("!!window.__hub"), "le hub s'ouvre sans phrase")
    p.fill(".lock .lcard input", "pas la bonne phrase"); p.click(".lock .lcard button[type=submit]")
    p.wait_for_function("document.querySelector('.lock .lmsg').textContent.includes('incorrecte')", timeout=30000)
    _assert(not p.evaluate("!!window.__hub"), "le hub s'ouvre avec une mauvaise phrase")
    unlock_page(p, PHRASE); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    _assert(counts(p)["notes"] == 3, "données illisibles après déverrouillage")
    # Vieil onglet : coffre activé ailleurs, cet onglet n'a pas la clé → aucune écriture en clair
    d2 = h.device(); q = d2.page(); seed(q, 1, 0, 0)
    meta = ev(p, "return localStorage.getItem('hub-coffre');")
    q.evaluate("m => { window.__noReload = true; }", meta)
    ev(q, "localStorage.setItem('hub-coffre', arg);", meta)            # même tableau de bord qu'un coffre activé dans un autre onglet
    res = ev(q, "const s = await import('/js/store/storage.js'); try { await s.store.put('notes', { id: 'n-vieil', text: 'écrit en clair ?', created: 1 }); return 'écrit'; } catch (e) { return 'refusé : ' + e.message; }")
    raw = ev(q, "const r = indexedDB.open('hub'); const db = await new Promise(x => r.onsuccess = () => x(r.result)); return await new Promise(x => { const g = db.transaction('notes').objectStore('notes').get('n-vieil'); g.onsuccess = () => x(g.result || null); });")
    _assert(res.startswith("refusé") and raw is None, f"vieil onglet : {res} ; enregistrement : {raw}")
    ev(q, "localStorage.setItem('hub-meteo-lieu', 'x'); (await import('/js/store/prefs.js')).prefs.set('meteo-lieu', 'Ville en clair ?');")
    _assert(ev(q, "return localStorage.getItem('hub-meteo-lieu');") != "Ville en clair ?", "réglage privé écrit en clair par un vieil onglet")
    d2.close()
    d.close()


def test_securite_verrouillage_automatique(h):
    d = h.device(); p = d.page(); seed(p, 1, 0, 0); enable_vault(p)
    ev(p, "localStorage.setItem('hub-coffre-delai', '5');")
    p.close()
    p = d.ctx.new_page(); p.on("dialog", lambda x: x.accept())
    p.clock.install(time=datetime.datetime(2026, 10, 24, 12, 0))
    p.goto(h.server.url, wait_until="domcontentloaded")
    unlock_page(p, PHRASE); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.clock.fast_forward("00:04:00")
    _assert(not p.evaluate("!!document.querySelector('.lock:not([hidden]) .lcard')"), "verrouillé avant 5 min")
    p.clock.fast_forward("00:02:00")
    _assert(p.evaluate("!!document.querySelector('.lock:not([hidden]) .lcard')"), "pas de verrouillage automatique après 6 min")
    p.fill(".lock .lcard input", "pas la bonne phrase"); p.click(".lock .lcard button[type=submit]")
    p.wait_for_function("document.querySelector('.lock .lmsg').textContent.includes('incorrecte')", timeout=30000)
    p.fill(".lock .lcard input", PHRASE); p.click(".lock .lcard button[type=submit]")
    p.wait_for_function("!document.querySelector('.lock:not([hidden]) .lcard')", timeout=30000)
    d.close()


def test_securite_secrets_jamais_exportes_ni_synchronises(h):
    gh = FakeGitHub(FAKE_TOKEN); h.mock = gh
    d = h.device(); p = d.page(); seed(p)
    ev(p, """localStorage.setItem('hub-secret-mails', JSON.stringify({gmail: {at: 'jeton-mail-factice-123'}}));
      localStorage.setItem('hub-secret-gemini', 'cle-gemini-factice-456');
      localStorage.setItem('hub-mails', JSON.stringify({gmail: 'id-client-factice', outlook: '', from: [], mots: []}));""")
    ev(p, "const { sync } = await import('/js/store/sync.js'); await sync.setup(arg, 'phrase de synchro factice'); await sync.run();", FAKE_TOKEN)
    gist = gh.gists[next(iter(gh.gists))]["files"]["hub-synchro.txt"]
    clear = ev(p, "const { open } = await import('/js/store/sync.js'); return JSON.stringify(await open(arg, 'phrase de synchro factice'));", gist)
    for s in ("jeton-mail-factice-123", "cle-gemini-factice-456", FAKE_TOKEN, "phrase de synchro factice"):
        _assert(s not in clear, "secret dans la synchro : " + s)
    path, _ = export_file(p, "c3-secrets.json")
    text = open(path, encoding="utf-8").read()
    for s in ("jeton-mail-factice-123", "cle-gemini-factice-456", FAKE_TOKEN, "phrase de synchro factice"):
        _assert(s not in text, "secret dans l'export : " + s)
    # Le jeton ne part que vers api.github.com
    others = [c for c in gh.calls if not c[1].startswith("https://api.github.com/")]
    _assert(not others, "jeton envoyé ailleurs : " + str(others))
    d.close()


def test_securite_liens_externes_et_page_en_direct(h):
    h.mock = make_mock()
    d = h.device(); p = d.page(); seed(p)
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(1200)
    bad = p.evaluate("[...document.querySelectorAll('a[target=_blank]')].filter(a => !/noopener|noreferrer/.test(a.rel)).map(a => a.outerHTML.slice(0, 120))")
    _assert(not bad, "liens externes sans noopener : " + str(bad))
    # Page en direct : adresse du hub lui-même → la page affichée ne doit pas pouvoir lire le hub
    web = p.locator('.win[data-id="web"] form.url input')
    web.fill(h.server.url + "index.html"); web.press("Enter"); p.wait_for_timeout(2500)
    fr = p.locator('.win[data-id="web"] iframe')
    _assert(fr.count() == 1, "iframe de la page en direct absente")
    sandbox = fr.get_attribute("sandbox") or ""
    frame = fr.element_handle().content_frame()
    reach = None
    if frame:
        try:
            reach = frame.evaluate("(() => { try { return !!(window.parent.__hub || window.parent.document.body.innerHTML.length); } catch (e) { return false; } })()")
        except Exception:
            reach = False
    _assert(not reach, f"la page en direct peut lire le hub (sandbox « {sandbox} »)")
    web.fill("javascript:" + PWN); web.press("Enter"); p.wait_for_timeout(500)
    _assert(not _pwned(p) and "javascript" not in (fr.get_attribute("src") or ""), "javascript: accepté dans la page en direct")
    d.close()


def test_securite_meteo_et_secrets_apres_desactivation(h):
    """Cache météo piégé (export trafiqué) : rien ne s'exécute. Désactiver le verrouillage retire la clé Gemini au lieu de la laisser en clair."""
    h.mock = make_mock()
    d = h.device(); p = d.page()
    days = [datetime.date.today().isoformat()] * 7
    cache = {"at": int(time.time() * 1000), "lat": 44.8, "lon": -0.58, "name": "Ville factice",
             "data": {"current": {"temperature_2m": 10, "relative_humidity_2m": 50, "apparent_temperature": 9, "weather_code": 1, "wind_speed_10m": 5, "is_day": 1},
                      "daily": {"time": days, "weather_code": [1] * 7, "temperature_2m_max": [12] * 7, "temperature_2m_min": [5] * 7,
                                "sunrise": [x + "T07:00" for x in days], "sunset": [x + "T18:00" for x in days],
                                "precipitation_probability_max": ['"><img src=x onerror="' + PWN + '">'] * 7}}}
    data = {"format": "hub-donnees", "formatVersion": 1, "data": {}, "prefs": {
        "hub-meteo-cache": json.dumps(cache), "hub-meteo-lieu": json.dumps({"lat": 44.8, "lon": -0.58, "name": "Ville factice", "at": int(time.time() * 1000)})}}
    import_file(p, write_json(h, "c3-meteo-piege.json", data))
    p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.hover(".wxm"); p.wait_for_timeout(800)
    _assert(not _pwned(p) and p.evaluate("document.querySelectorAll('img[src=x]').length") == 0, "cache météo piégé exécuté")
    # Clé Gemini factice, verrouillage activé puis désactivé
    enable_vault(p)
    ev(p, "(await import('/js/store/vault.js')).vault.lsSet('hub-secret-ia', 'cle-gemini-factice-789'); await (await import('/js/store/vault.js')).vault.flush();")
    ev(p, "const s = await import('/js/store/storage.js'); const { vault } = await import('/js/store/vault.js'); await s.migrate(async () => { await s.plainAll(); await vault.destroy(); });")
    left = ev(p, "return localStorage.getItem('hub-secret-ia');")
    _assert(left is None, "clé Gemini laissée en clair après désactivation : " + str(left))
    d.close()
