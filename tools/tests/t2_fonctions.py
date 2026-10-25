"""Cycle 2 · Fonctionnalités : recette PC et mobile simulé, hors ligne, mise à jour du service worker, deux onglets, console."""
import json, datetime
from hubtest import ev, seed, counts, write_json
from fakes import FakeGitHub


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def _today(delta=0):
    d = datetime.date.today() + datetime.timedelta(days=delta)
    return d.isoformat()


def fake_weather(route):
    u = route.request.url
    if u.startswith("https://api.open-meteo.com/"):
        days = [_today(i) for i in range(7)]
        body = {"current": {"temperature_2m": 14.2, "relative_humidity_2m": 70, "apparent_temperature": 13, "weather_code": 2, "wind_speed_10m": 12, "is_day": 1},
                "daily": {"time": days, "weather_code": [2, 61, 3, 0, 95, 71, 45], "temperature_2m_max": [16, 15, 17, 19, 14, 6, 12],
                          "temperature_2m_min": [9, 8, 10, 11, 7, 0, 5], "sunrise": [d + "T07:30" for d in days], "sunset": [d + "T18:20" for d in days],
                          "precipitation_probability_max": [10, 80, 20, 0, 60, 30, 5]}}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body)); return True
    if u.startswith("https://geocoding-api.open-meteo.com/"):
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"results": [{"name": "Ville factice", "latitude": 44.8, "longitude": -0.58, "country": "France"}]})); return True
    return False


FLUX = {"genere": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "actus": [{"titre": "Titre factice " + str(i), "lien": "https://actu.test/" + str(i), "date": "2026-10-24T10:0%d:00Z" % i, "cat": "TECH", "couleur": "var(--cyan)", "source": "actu.test"} for i in range(5)],
        "videos": [], "sites": [{"nom": "Site factice", "url": "https://site.test/", "ok": True, "code": 200, "ms": 120, "depuis": "2026-10-24T08:00:00Z",
                                 "articles": [{"titre": "Article factice", "lien": "https://site.test/a", "date": "2026-10-24T09:00:00Z"}]},
                                {"nom": "Site en panne", "url": "https://panne.test/", "ok": False, "code": 0, "ms": 9000, "depuis": "2026-10-24T09:30:00Z"}],
        "erreurs": []}


def make_mock(flux=FLUX, extra=None):
    def mock(route):
        u = route.request.url
        if u.startswith("https://raw.githubusercontent.com/lulu78440/hub/flux/flux.json"):
            route.fulfill(status=200, content_type="application/json", body=json.dumps(flux)); return True
        if fake_weather(route):
            return True
        return bool(extra and extra(route))
    return mock


def _ui_add(p, win, text):
    inp = p.locator(f'.win[data-id="{win}"] form.addrow input')
    inp.fill(text); inp.press("Enter")


def sortir_de_reserve(p, win="tasks", titre="Tâches"):
    """Refonte (ergo-fusion) : sur PC, Tâches est « en réserve » par défaut (fenêtre masquée, code gardé).
    On la remet comme Lucien le ferait : touche O → Outils → « Fonctions en réserve » → tuile de la fenêtre."""
    _assert(p.evaluate(f"window.__hub.wins.S['{win}'] && window.__hub.wins.S['{win}'].res === true"), f"{titre} n'est plus en réserve par défaut")
    p.evaluate("document.activeElement && document.activeElement.blur()")
    p.keyboard.press("o")
    p.wait_for_selector("#outils:not([hidden])", timeout=15000)
    sec = p.locator("#outils section").filter(has=p.locator(".o-grp", has_text="Fonctions en réserve"))
    sec.locator(".o-tile").filter(has_text=titre).first.click()
    p.keyboard.press("Escape")
    p.wait_for_function(f"!window.__hub.wins.S['{win}'].res && !document.querySelector('.win[data-id=\"{win}\"]').classList.contains('hid')", timeout=15000)
    p.wait_for_timeout(600)


def test_fonctions_recette_pc(h):
    h.mock = make_mock()
    d = h.device()
    d.ctx.add_init_script("localStorage.setItem('hub-meteo-lieu', JSON.stringify({lat: 44.8, lon: -0.58, name: 'Ville factice', auto: false, at: Date.now()}))")
    p = d.page()
    p.evaluate("document.activeElement && document.activeElement.blur()")
    # Plans 1, 2, 3 au clavier (hors du champ de recherche, qui a le focus au démarrage)
    for k in "231":
        p.keyboard.press(k); p.wait_for_timeout(900)
        _assert(p.evaluate("window.__hub.plans.plan") == int(k), "plan " + k)
    p.keyboard.press("2"); p.wait_for_timeout(900)
    # Notes, tâches, agenda par l'interface (Tâches est en réserve depuis la refonte : remise par Outils)
    sortir_de_reserve(p)
    _ui_add(p, "notes", "Note de recette é à ç 😀")
    _ui_add(p, "tasks", "Acheter du pain ! @demain 18h")
    p.wait_for_timeout(300)
    c = counts(p)
    _assert(c["notes"] == 1 and c["tasks"] == 1, "ajout note/tâche : " + str(c))
    t = ev(p, "const s = await import('/js/store/storage.js'); return (await s.store.all('tasks'))[0];")
    _assert(t["prio"] == 1 and t["due"] == _today(1) and t["remindAt"] == _today(1) + "T18:00" and t["text"] == "Acheter du pain", "analyse de la tâche : " + str(t))
    _assert(p.locator('.win[data-id="notes"] .note').count() == 1, "note non affichée")
    _assert("Acheter du pain" in p.inner_text('.win[data-id="tasks"]'), "tâche non affichée")
    # Favori ajouté par le formulaire : adresse complétée en https
    p.click('.win[data-id="favs"] .fadd')
    p.fill('.win[data-id="favs"] input[placeholder^="Adresse"]', "lemonde.fr")
    p.locator('.win[data-id="favs"] input[placeholder^="Adresse"]').press("Enter")
    p.wait_for_timeout(300)
    favs = ev(p, "const s = await import('/js/store/storage.js'); return (await s.store.all('favs')).map(f => f.url);")
    _assert(favs and favs[0].startswith("https://") and "lemonde.fr" in favs[0], "favori : " + str(favs))
    # Menus clic droit : fond et fenêtre
    p.keyboard.press("1"); p.wait_for_timeout(900)
    p.mouse.click(800, 450, button="right"); p.wait_for_timeout(200)
    _assert(p.evaluate("!document.getElementById('ctx').hidden && document.getElementById('ctx').textContent.length > 20"), "menu du fond absent")
    p.keyboard.press("Escape")
    # Météo simulée affichée
    p.wait_for_function("(document.querySelector('.wxm .wt') || {}).textContent === '14°'", timeout=60000)
    # Actualité et veille (flux simulé)
    p.wait_for_function("document.querySelectorAll('.ticker .run a.it').length >= 5", timeout=60000)
    _assert(p.locator(".alert").filter(has_text="EN PANNE").count() >= 1, "alerte de site en panne absente")
    # Rappel d'essai
    p.evaluate("window.__hub.reminders.test()"); p.wait_for_timeout(300)
    _assert(p.locator(".alert").count() >= 1, "rappel d'essai non affiché")
    # Toutes les fenêtres PC présentes et visibles au plan 2, sauf celles rangées en réserve (masquées par conception, Tâches remise ci-dessus)
    p.keyboard.press("2"); p.wait_for_timeout(1000)
    hidden = p.evaluate("[...document.querySelectorAll('.win:not(.mob-only)')].filter(w => getComputedStyle(w).display === 'none' && !(window.__hub.wins.S[w.dataset.id] || {}).res).map(w => w.dataset.id)")
    _assert(not hidden, "fenêtres masquées au plan 2 : " + str(hidden))
    _assert(not d.errors, "erreurs console : " + str(d.errors))
    d.close()


def test_fonctions_recette_mobile(h):
    h.mock = make_mock()
    d = h.device(mobile=True)
    p = d.page()
    _assert(p.evaluate("document.body.classList.contains('lite')"), "mode mobile non détecté")
    _ui_add(p, "notes", "Note mobile")
    _ui_add(p, "tasks", "Tâche mobile")
    p.wait_for_timeout(300)
    _assert(counts(p)["notes"] == 1 and counts(p)["tasks"] == 1, "ajout sur mobile")
    # Fenêtres empilées, pas de défilement horizontal
    sw = p.evaluate("document.documentElement.scrollWidth - innerWidth")
    _assert(sw <= 1, f"défilement horizontal sur mobile : {sw} px")
    vis = p.evaluate("[...document.querySelectorAll('.win')].filter(w => getComputedStyle(w).display !== 'none').length")
    _assert(vis >= 8, f"fenêtres visibles sur mobile : {vis}")
    p.wait_for_timeout(1500)
    _assert(not d.errors, "erreurs console : " + str(d.errors))
    d.close()


def test_fonctions_hors_ligne_et_service_worker(h):
    h.mock = make_mock()
    d = h.device()
    p = d.page()
    p.wait_for_function("navigator.serviceWorker.controller || false", timeout=30000) if p.evaluate("!!navigator.serviceWorker.controller") else None
    p.evaluate("navigator.serviceWorker.ready.then(() => true)")
    p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    _assert(p.evaluate("!!navigator.serviceWorker.controller"), "service worker non actif")
    seed(p, 2, 1, 0)
    d.ctx.set_offline(True)
    p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    _assert(counts(p)["notes"] == 2, "données absentes hors ligne")
    _assert(p.evaluate("!!window.THREE || !document.querySelector('.err')"), "3D non chargée hors ligne")
    d.ctx.set_offline(False)
    # Mise à jour : une nouvelle version de sw.js remplace le cache et prévient la page
    import os
    from hubtest import ROOT
    src = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
    old = src.split('const VERSION = "', 1)[1].split('"', 1)[0]
    newsrc = src.replace(f'const VERSION = "{old}"', 'const VERSION = "99.0.0-essai"')
    from hubtest import _Quiet
    _Quiet.overrides["/sw.js"] = ("text/javascript", newsrc)
    p.evaluate("window.__toasts = []; new MutationObserver(() => window.__toasts.push(document.getElementById('toast').textContent)).observe(document.getElementById('toast'), {childList: true, characterData: true, subtree: true})")
    p.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
    p.wait_for_function("caches.keys().then(k => k.includes('hub-99.0.0-essai'))", timeout=40000)
    try:
        p.wait_for_function("window.__toasts.some(t => t.includes('Nouvelle version'))", timeout=20000)
    except Exception:
        raise AssertionError("pas d'avis « Nouvelle version » ; messages : " + str(p.evaluate("window.__toasts")) + " ; contrôleur : " + str(p.evaluate("navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL")))
    _Quiet.overrides.clear()
    p.wait_for_timeout(3000)
    keys = p.evaluate("caches.keys()")
    if f"hub-{old}" in keys:
        n = p.evaluate(f"caches.open('hub-{old}').then(c => c.keys()).then(k => k.map(r => r.url))")
        raise AssertionError(f"ancien cache encore là après 3 s ({len(n)} entrée(s) : {n[:5]})")
    _assert(f"hub-{old}" not in keys, "ancien cache non supprimé : " + str(keys))
    _assert(counts(p)["notes"] == 2, "données perdues à la mise à jour")
    _assert(not d.errors, "erreurs console : " + str(d.errors))
    d.close()


def test_fonctions_deux_onglets(h):
    h.mock = make_mock()
    d = h.device()
    a = d.page(); b = d.page()
    for x in (a, b): x.evaluate("document.activeElement && document.activeElement.blur()")
    a.keyboard.press("2"); b.keyboard.press("2")
    _ui_add(a, "notes", "Écrite dans l'onglet A")
    b.wait_for_function("[...document.querySelectorAll('.win[data-id=\"notes\"] .note')].some(n => n.textContent.includes(\"onglet A\"))", timeout=60000)
    _ui_add(b, "tasks", "Écrite dans l'onglet B")
    a.wait_for_function("[...document.querySelectorAll('.win[data-id=\"tasks\"] li')].some(n => n.textContent.includes('onglet B'))", timeout=60000)
    # Suppression dans B vue dans A
    nid = ev(a, "const s = await import('/js/store/storage.js'); return (await s.store.all('notes'))[0].id;")
    ev(b, "const s = await import('/js/store/storage.js'); await s.store.del('notes', arg);", nid)
    a.wait_for_function("document.querySelectorAll('.win[data-id=\"notes\"] .note').length === 0", timeout=60000)
    _assert(not d.errors, "erreurs console : " + str(d.errors))
    d.close()


def test_fonctions_medias_et_page_en_direct(h):
    """Vidéo collée → lecteur youtube-nocookie au clic ; lien piégé refusé ; page en direct d'un autre site dans un bac à sable."""
    h.mock = make_mock()
    d = h.device(); p = d.page()
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(900)
    inp = p.locator('.win[data-id="video"] form.vlink input')
    inp.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL0123456789abcdef"); inp.press("Enter"); p.wait_for_timeout(400)
    p.evaluate("document.querySelector('.win[data-id=\"video\"] .poster').click()"); p.wait_for_timeout(500)
    src = p.evaluate("(document.querySelector('.win[data-id=\"video\"] iframe') || {}).src || ''")
    _assert(src.startswith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ") and "list=PL0123456789abcdef" in src, "lecteur vidéo : " + src)
    inp.fill('https://www.youtube.com/playlist?list=PL"><img src=x onerror=alert(1)>'); inp.press("Enter"); p.wait_for_timeout(400)
    _assert(p.evaluate("document.querySelectorAll('img[src=x]').length") == 0, "lien vidéo piégé inséré")
    web = p.locator('.win[data-id="web"] form.url input'); web.fill("fr.wikipedia.org"); web.press("Enter"); p.wait_for_timeout(500)
    fr = p.locator('.win[data-id="web"] iframe')
    _assert(fr.get_attribute("src") == "https://fr.wikipedia.org/" and "allow-scripts" in (fr.get_attribute("sandbox") or ""), "page en direct : " + str(fr.get_attribute("src")))
    _assert(not [e for e in d.errors if "wikipedia" not in e], "erreurs console : " + str(d.errors))
    d.close()
