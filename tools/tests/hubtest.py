"""Outils communs du banc d'essai : serveur local, navigateur de test (Chromium headless via Playwright), helpers.

Données factices uniquement. Toute requête vers un autre site que le serveur local est bloquée (et notée),
pour ne jamais toucher un service extérieur pendant les tests.
"""
import functools, http.server, json, os, socket, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PHRASE = "girafe tunnel citron 47"          # phrase factice des tests
FAKE_TOKEN = "jeton-factice-0000"           # jeton factice (jamais un vrai)

# Erreurs de console attendues dans le serveur de test (réseau extérieur bloqué volontairement)
IGNORED = ("Failed to load resource", "net::ERR_", "ERR_FAILED", "ERR_BLOCKED")


class _Quiet(http.server.SimpleHTTPRequestHandler):
    overrides = {}          # chemin → (type, contenu) : fichiers remplacés le temps d'un test (ex. nouvelle version de sw.js)

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in self.overrides:
            ctype, body = self.overrides[path]
            data = body.encode("utf-8")
            self.send_response(200); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(data)))
            self.end_headers(); self.wfile.write(data); return
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


class Server:
    def __init__(self, root=ROOT):
        self.port = free_port()
        handler = functools.partial(_Quiet, directory=root)
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", self.port), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.port}/"

    def stop(self):
        self.httpd.shutdown()


class Device:
    """Un « appareil » = un contexte de navigateur neuf (stockage vierge)."""

    def __init__(self, h, mobile=False, reduced=False, tz=None, sw=True):
        self.h = h
        opts = dict(accept_downloads=True, locale="fr-FR", timezone_id=tz or "Europe/Paris",
                    service_workers="allow" if sw else "block")
        if mobile:
            opts.update(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        else:
            opts.update(viewport={"width": 1600, "height": 900})
        if reduced:
            opts["reduced_motion"] = "reduce"
        self.ctx = h.browser.new_context(**opts)
        self.blocked = []
        self.ctx.route("**/*", self._route)
        self.errors = []
        self.pages = []

    def _route(self, route):
        u = route.request.url
        if u.startswith(self.h.server.url) or u.startswith("data:") or u.startswith("blob:"):
            return route.continue_()
        if self.h.mock and self.h.mock(route):
            return
        self.blocked.append(u)
        return route.abort()

    def page(self, path="", wait=True, unlock=None):
        p = self.ctx.new_page()
        self.pages.append(p)
        p.on("console", lambda m: m.type == "error" and not any(x in m.text for x in IGNORED) and self.errors.append(m.text))
        p.on("pageerror", lambda e: self.errors.append("pageerror: " + str(e)))
        p.on("dialog", lambda d: d.accept())
        p.goto(self.h.server.url + path, wait_until="domcontentloaded")
        if unlock:
            unlock_page(p, unlock)
        if wait:
            p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
        return p

    def close(self):
        self.ctx.close()


class Hub:
    def __init__(self, headless=True):
        self.server = Server()
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(headless=headless, args=["--enable-unsafe-swiftshader", "--use-gl=swiftshader"])
        self.mock = None          # fonction(route) -> bool : réponses simulées (GitHub, météo…)
        self.tmp = os.path.join(ROOT, "tools", "tests", ".tmp")
        os.makedirs(self.tmp, exist_ok=True)

    def device(self, **kw):
        return Device(self, **kw)

    def close(self):
        self.browser.close(); self.pw.stop(); self.server.stop()


# ---------- helpers côté page ----------
JS_STORE = "await import('/js/store/storage.js')"
JS_VAULT = "(await import('/js/store/vault.js')).vault"


def ev(page, body, arg=None):
    """Exécute un corps de fonction async dans la page (accès aux modules par import dynamique)."""
    return page.evaluate("async (arg) => { " + body + " }", arg)


def seed(page, n_notes=3, n_tasks=2, n_favs=2, extra=None):
    """Remplit l'appareil de données factices."""
    return ev(page, """
      const s = await import('/js/store/storage.js');
      const now = Date.now();
      const notes = Array.from({length: arg.n}, (_, i) => ({ id: 'n-test-' + i, text: 'Note factice ' + i + ' é à 😀', pinned: i === 0, created: now - i, updated: now - i }));
      const tasks = Array.from({length: arg.t}, (_, i) => ({ id: 't-test-' + i, text: 'Tâche factice ' + i, done: false, prio: 0, due: null, remindAt: null, created: now - i, doneAt: null }));
      const favs = Array.from({length: arg.f}, (_, i) => ({ id: 'f-test-' + i, title: 'Site factice ' + i, url: 'https://exemple.test/' + i, group: 'Tests', created: now - i }));
      if (notes.length) await s.store.putMany('notes', notes);
      if (tasks.length) await s.store.putMany('tasks', tasks);
      if (favs.length) await s.store.putMany('favs', favs);
      const d = new Date(now + 864e5), dk = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      await s.store.put('events', { id: 'e-test-0', title: 'RDV factice', date: dk, start: '10:00', end: '11:00', created: now });
      await s.store.put('kv', { id: 'kv-test', items: ['Test 12/03'] });
      return true;
    """, {"n": n_notes, "t": n_tasks, "f": n_favs})


def counts(page):
    return ev(page, """
      const s = await import('/js/store/storage.js'); const out = {};
      for (const c of s.COLLECTIONS) out[c] = (await s.store.all(c)).length; return out;
    """)


def enable_vault(page, phrase=PHRASE):
    """Active le verrouillage comme le bouton de Diag (sans l'interface). Renvoie la clé de secours."""
    return ev(page, """
      const s = await import('/js/store/storage.js'); const { vault } = await import('/js/store/vault.js');
      return await s.migrate(async () => { const c = await vault.create(arg); await s.rewriteAll(); await vault.flush(); return c; });
    """, phrase)


def unlock_page(page, secret, rescue=False, new_phrase=None):
    page.wait_for_selector(".lock .lcard input", timeout=15000)
    if rescue:
        page.click(".lock .lnkb")
        page.wait_for_selector(".lock .lcard input[type=text]")
    page.fill(".lock .lcard input", secret)
    page.click(".lock .lcard button[type=submit]")
    if rescue and new_phrase:
        page.wait_for_selector(".lock input[autocomplete=new-password]", timeout=15000)
        ins = page.query_selector_all(".lock input[autocomplete=new-password]")
        ins[0].fill(new_phrase); ins[1].fill(new_phrase)
        page.click(".lock .lcard button[type=submit]")
        page.wait_for_selector(".lock .lkey", timeout=30000)
        code = page.inner_text(".lock .lkey")
        page.check(".lock .chkl input")
        page.click(".lock .lcard button.ok")
        return code


def export_file(page, name="export.json"):
    """Clique « Exporter » (fonction du hub) et récupère le fichier téléchargé."""
    with page.expect_download() as dl:
        page.evaluate("window.__hub.data.exportFile()")
    path = os.path.join(ROOT, "tools", "tests", ".tmp", name)
    dl.value.save_as(path)
    return path, dl.value.suggested_filename


def import_file(page, path, secret=None, reload=True):
    """Importe un fichier par le bouton du hub (confirmation acceptée automatiquement)."""
    with page.expect_file_chooser() as fc:
        page.evaluate("window.__hub.data.importFile()")
    if reload:
        with page.expect_navigation(timeout=30000):
            fc.value.set_files(path)
            if secret is not None:
                page.wait_for_selector(".lock .lcard input", timeout=10000)
                page.fill(".lock .lcard input", secret)
                page.click(".lock .lcard button[type=submit]")
    else:
        fc.value.set_files(path)


def toast(page):
    return page.evaluate("(document.getElementById('toast') || {}).textContent || ''")


def write_json(h, name, obj):
    p = os.path.join(h.tmp, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False))
    return p
