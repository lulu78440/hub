"""Cycle 4 · Cas limites et charge : gros volumes, stockage plein, coupures, onglet fermé en pleine écriture, horloge, fuseaux, textes longs."""
import json, time, datetime
from hubtest import FAKE_TOKEN, ev, seed, counts, export_file, import_file, write_json
from fakes import FakeGitHub
from t2_fonctions import make_mock


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


BIG = """
  const s = await import('/js/store/storage.js'); const now = Date.now();
  const emo = ['😀', '🚀', 'é', 'à', 'ç', 'Ω', '中文', 'ﷺ', '🇫🇷', '👨‍👩‍👧'];
  await s.store.putMany('notes', Array.from({length: arg.n}, (_, i) => ({ id: 'n' + i, text: 'Note ' + i + ' ' + emo[i % 10] + ' accentuée éèêë', pinned: i % 50 === 0, created: now - i * 1000, updated: now - i * 1000 })));
  await s.store.putMany('tasks', Array.from({length: arg.n}, (_, i) => ({ id: 't' + i, text: 'Tâche ' + i + ' ' + emo[i % 10], done: i % 3 === 0, prio: i % 7 === 0 ? 1 : 0, due: i % 5 ? null : new Date(now + (i % 30 - 10) * 864e5).toISOString().slice(0, 10), remindAt: null, created: now - i, doneAt: null })));
  await s.store.putMany('favs', Array.from({length: arg.f}, (_, i) => ({ id: 'f' + i, title: 'Favori ' + i + ' ' + emo[i % 10], url: 'https://site' + i + '.test/page', group: 'Groupe ' + (i % 25), created: now - i })));
  return true;
"""


def test_limites_charge_1000_notes_taches_2000_favoris(h):
    h.mock = make_mock()
    d = h.device(); p = d.page()
    ev(p, BIG, {"n": 1000, "f": 2000})
    t0 = time.time()
    p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
    p.wait_for_function("document.querySelectorAll('.win[data-id=\"notes\"] .note').length > 0", timeout=30000)
    load = time.time() - t0
    c = counts(p)
    _assert(c["notes"] == 1000 and c["tasks"] == 1000 and c["favs"] == 2000, "comptes : " + str(c))
    _assert(load < 15, f"chargement avec 4 000 éléments trop lent : {load:.1f} s")
    # Ajout d'une note avec 1 000 notes présentes : rapide
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(900)
    t1 = time.time()
    inp = p.locator('.win[data-id="notes"] form.addrow input'); inp.fill("Encore une"); inp.press("Enter")
    p.wait_for_function("[...document.querySelectorAll('.win[data-id=\"notes\"] .note')].some(n => n.textContent.includes('Encore une'))", timeout=10000)
    add = time.time() - t1
    _assert(add < 2, f"ajout d'une note lent avec 1 000 notes : {add:.1f} s")
    # Recherche dans 2 000 favoris
    t2 = time.time()
    p.fill('.win[data-id="favs"] input[type=search]', "Favori 1999"); p.wait_for_timeout(400)
    _assert(time.time() - t2 < 3, "recherche lente dans 2 000 favoris")
    # Export puis import de ce volume
    t3 = time.time(); path, _ = export_file(p, "c4-gros.json"); exp = time.time() - t3
    d2 = h.device(); q = d2.page()
    t4 = time.time(); import_file(q, path); q.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000); imp = time.time() - t4
    _assert(counts(q)["favs"] == 2000 and counts(q)["notes"] == 1001, "import du gros export : " + str(counts(q)))
    _assert(not d.errors and not d2.errors, "erreurs console : " + str((d.errors + d2.errors)[:3]))
    print(f"        chargement {load:.1f} s · ajout {add:.2f} s · export {exp:.1f} s · import {imp:.1f} s")
    d.close(); d2.close()
test_limites_charge_1000_notes_taches_2000_favoris.long = True


def test_limites_stockage_plein(h):
    """IndexedDB et localStorage pleins : l'utilisateur doit être prévenu, rien ne doit planter en silence."""
    d = h.device(); p = d.page()
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(900)
    # Stockage plein simulé : chaque écriture IndexedDB échoue avec QuotaExceededError, localStorage aussi
    p.evaluate("""() => {
      const q = () => { throw new DOMException('Quota simulé', 'QuotaExceededError'); };
      IDBObjectStore.prototype.put = q; IDBObjectStore.prototype.add = q;
      Storage.prototype.setItem = q;
      window.__rejections = []; addEventListener('unhandledrejection', (e) => window.__rejections.push(String(e.reason)));
    }""")
    p.evaluate("document.getElementById('toast').textContent = ''")
    inp = p.locator('.win[data-id="notes"] form.addrow input'); inp.fill("Note qui ne tient pas"); inp.press("Enter")
    p.wait_for_timeout(800)
    msg = p.evaluate("document.getElementById('toast').textContent")
    rej = p.evaluate("window.__rejections")
    d.errors.clear()
    _assert("plein" in msg.lower() or "enregistr" in msg.lower(), f"aucun avertissement quand le stockage est plein (message : « {msg} », rejets non gérés : {rej})")
    d.close()


def test_limites_coupure_reseau_pendant_synchro(h):
    gh = FakeGitHub(FAKE_TOKEN); h.mock = gh
    d = h.device(); p = d.page(); seed(p)
    ev(p, "const { sync } = await import('/js/store/sync.js'); await sync.setup(arg, 'phrase de synchro factice');", FAKE_TOKEN)
    before = json.dumps(gh.gists)
    ev(p, "const s = await import('/js/store/storage.js'); await s.store.put('notes', { id: 'n-coupure', text: 'avant coupure', created: 1, updated: 1 });")
    gh.offline = True
    r = ev(p, "const { sync } = await import('/js/store/sync.js'); try { await sync.run(); return 'ok'; } catch (e) { return 'ERR ' + e.message; }")
    _assert(r.startswith("ERR"), "synchro réussie sans réseau ?")
    _assert(json.dumps(gh.gists) == before, "Gist modifié pendant la coupure")
    _assert(counts(p)["notes"] == 4, "données locales touchées par la coupure")
    gh.offline = False
    r = ev(p, "const { sync } = await import('/js/store/sync.js'); try { await sync.run(); return 'ok'; } catch (e) { return 'ERR ' + e.message; }")
    _assert(r == "ok", "synchro après retour du réseau : " + r)
    clear = ev(p, "const { open } = await import('/js/store/sync.js'); return JSON.stringify(await open(arg, 'phrase de synchro factice'));", gh.gists[next(iter(gh.gists))]["files"]["hub-synchro.txt"])
    _assert("avant coupure" in clear, "note non envoyée après retour du réseau")
    # Coupure ENTRE la lecture et l'écriture (PATCH perdu) : rien de perdu, la prochaine synchro rattrape
    orig = gh.__call__
    cut = {"on": True}            # toutes les écritures (PATCH) échouent tant que la coupure dure (la synchro auto peut aussi tourner)
    def flaky(route):
        if route.request.method == "PATCH" and cut["on"] and route.request.url.startswith("https://api.github.com/"):
            route.abort(); return True
        return orig(route)
    h.mock = flaky
    ev(p, "const s = await import('/js/store/storage.js'); await s.store.put('notes', { id: 'n-coupure2', text: 'pendant coupure', created: 1, updated: 1 });")
    r1 = ev(p, "const { sync } = await import('/js/store/sync.js'); try { await sync.run(); return 'ok'; } catch (e) { return 'ERR ' + e.message; }")
    cut["on"] = False
    r2 = ev(p, "const { sync } = await import('/js/store/sync.js'); try { await sync.run(); return 'ok'; } catch (e) { return 'ERR ' + e.message; }")
    clear = ev(p, "const { open } = await import('/js/store/sync.js'); return JSON.stringify(await open(arg, 'phrase de synchro factice'));", gh.gists[next(iter(gh.gists))]["files"]["hub-synchro.txt"])
    _assert(r1.startswith("ERR") and r2 == "ok" and "pendant coupure" in clear, f"reprise après PATCH perdu : {r1} / {r2}")
    d.close()


def test_limites_onglet_ferme_pendant_import(h):
    """Import tout ou rien : fermer l'onglet en plein import laisse soit l'ancien état, soit le nouveau, jamais un mélange."""
    a = h.device(); pa = a.page(); ev(pa, BIG, {"n": 800, "f": 1500}); path, _ = export_file(pa, "c4-import-coupe.json"); a.close()
    results = []
    for delay in (50, 250, 600, 1200):
        d = h.device(); p = d.page(); seed(p, 3, 2, 2)
        with p.expect_file_chooser() as fc:
            p.evaluate("window.__hub.data.importFile()")
        fc.value.set_files(path)
        p.wait_for_timeout(delay)
        p.close()
        q = d.page()
        c = counts(q)
        results.append((delay, c["notes"], c["favs"]))
        ok = (c["notes"], c["tasks"], c["favs"]) in ((3, 2, 2), (800, 800, 1500))
        _assert(ok, f"état mélangé après fermeture à {delay} ms : {c}")
        d.close()
    print("        états après fermeture :", results)


def test_limites_fuseaux_horloge_textes_longs(h):
    for tz in ("Pacific/Kiritimati", "America/Los_Angeles", "Asia/Kolkata"):
        d = h.device(tz=tz); p = d.page()
        p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(700)
        inp = p.locator('.win[data-id="tasks"] form.addrow input'); inp.fill("Tâche fuseau @demain 9h"); inp.press("Enter"); p.wait_for_timeout(300)
        t = ev(p, "const s = await import('/js/store/storage.js'); const t = (await s.store.all('tasks'))[0]; const d = new Date(); d.setDate(d.getDate() + 1); return [t.due, d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')];")
        _assert(t[0] == t[1], f"« @demain » faux dans le fuseau {tz} : {t}")
        _assert(not d.errors, f"erreurs console ({tz}) : " + str(d.errors))
        d.close()
    # Horloge reculée puis avancée (changement d'heure, mauvaise heure corrigée) : pas d'erreur, rappels cohérents
    d = h.device(); p = d.ctx.new_page(); p.on("dialog", lambda x: x.accept())
    p.clock.install(time=datetime.datetime(2026, 10, 25, 1, 50))      # nuit du passage à l'heure d'hiver
    p.goto(h.server.url, wait_until="domcontentloaded"); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.clock.fast_forward("02:00:00")
    p.clock.set_system_time(datetime.datetime(2026, 10, 20, 12, 0))   # horloge reculée de 5 jours
    p.clock.fast_forward("00:01:00")
    p.clock.set_system_time(datetime.datetime(2026, 11, 3, 12, 0))
    p.clock.fast_forward("00:16:00")
    _assert(not d.errors, "erreurs console (horloge) : " + str(d.errors))
    d.close()
    # Textes très longs et caractères variés
    d = h.device(); p = d.page()
    long = ("Très long texte 😀🚀 éàçù 中文 ﷺ 👨‍👩‍👧 " * 3000)[:100000]
    ev(p, "const s = await import('/js/store/storage.js'); await s.store.put('notes', { id: 'n-long', text: arg, pinned: true, created: 1, updated: Date.now() }); await s.store.put('tasks', { id: 't-long', text: arg.slice(0, 5000), done: false, prio: 1, due: null, remindAt: null, created: 1 }); await s.store.put('favs', { id: 'f-long', title: arg.slice(0, 3000), url: 'https://long.test/' + 'a'.repeat(5000), group: arg.slice(0, 500), created: 1 });", long)
    p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(1000)
    over = p.evaluate("[...document.querySelectorAll('.win')].filter(w => w.scrollWidth > w.clientWidth + 40).map(w => w.dataset.id + ':' + (w.scrollWidth - w.clientWidth))")
    sw = p.evaluate("document.documentElement.scrollWidth - innerWidth")
    _assert(sw <= 1, f"texte long : défilement horizontal de la page ({sw} px)")
    _assert(not over, "texte long qui déborde des fenêtres : " + str(over))
    back = ev(p, "const s = await import('/js/store/storage.js'); return (await s.store.get('notes', 'n-long')).text === arg;", long)
    _assert(back, "texte long altéré")
    _assert(not d.errors, "erreurs console (textes longs) : " + str(d.errors))
    d.close()


def test_limites_onglet_ferme_pendant_changement_de_phrase(h):
    """Changement de phrase (nouvelle clé interne, données rechiffrées) interrompu par la fermeture de l'onglet :
    au retour, l'ancienne OU la nouvelle phrase ouvre le hub et toutes les données sont lisibles."""
    from hubtest import PHRASE, enable_vault, unlock_page
    NEW = "nouvelle phrase factice 77"
    for delay in (5, 60, 200, 800):
        d = h.device(); p = d.page()
        ev(p, BIG, {"n": 300, "f": 300})
        enable_vault(p)
        p.evaluate("""(np) => { import('/js/store/storage.js').then(async (s) => { const { vault } = await import('/js/store/vault.js');
            await s.migrate(async () => { await vault.rotate(np); await s.rewriteAll(); await vault.flush(); vault.endRotation(); }); }); }""", NEW)
        p.wait_for_timeout(delay)
        p.close()
        q = d.ctx.new_page(); q.on("dialog", lambda x: x.accept())
        q.goto(h.server.url, wait_until="domcontentloaded")
        q.wait_for_selector(".lock .lcard input", timeout=20000)
        ok_new = ev(q, "return (await import('/js/store/vault.js')).vault.check(arg);", NEW)
        unlock_page(q, NEW if ok_new else PHRASE)
        q.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
        c = counts(q)
        _assert(c["notes"] == 300 and c["tasks"] == 300 and c["favs"] == 300, f"données perdues après interruption à {delay} ms (phrase {'nouvelle' if ok_new else 'ancienne'}) : {c}")
        d.close()
