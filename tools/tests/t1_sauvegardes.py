"""Cycle 1 · Sauvegardes : export / import, exports chiffrés, fichiers refusés, Coffre du Hub, rappel du dimanche, synchro."""
import json, datetime
from hubtest import PHRASE, FAKE_TOKEN, ev, seed, counts, enable_vault, unlock_page, export_file, import_file, toast, write_json
from fakes import FakeGitHub


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def test_sauvegarde_export_import_appareil_vierge(h):
    a = h.device(); pa = a.page()
    seed(pa)
    ev(pa, "localStorage.setItem('hub-meteo-lieu', 'Ville factice'); localStorage.setItem('hub-secret-mails', 'jeton-mail-factice'); localStorage.setItem('hub-synchro', JSON.stringify({token:'x', phrase:'y', gist:'z'}));")
    before = counts(pa)
    path, name = export_file(pa, "c1-clair.json")
    _assert(name.startswith("hub-donnees-2") and name.endswith(".json"), "nom d'export inattendu : " + name)
    text = open(path, encoding="utf-8").read(); d = json.loads(text)
    _assert(d["format"] == "hub-donnees" and d["formatVersion"] == 1, "format d'export")
    for secret in ("jeton-mail-factice", "hub-secret", "hub-synchro\"", "hub-coffre"):
        _assert(secret not in text, "secret présent dans l'export : " + secret)
    b = h.device(); pb = b.page()
    _assert(sum(counts(pb).values()) == 0, "l'appareil vierge n'est pas vide")
    import_file(pb, path)
    pb.wait_for_function("window.__hub && document.body.classList.contains('ready')")
    after = counts(pb)
    _assert(after == before, f"comptes différents après import : {before} → {after}")
    txt = ev(pb, "const s = await import('/js/store/storage.js'); return (await s.store.get('notes', 'n-test-0')).text;")
    _assert(txt == "Note factice 0 é à 😀", "texte de note altéré : " + repr(txt))
    _assert(ev(pb, "return localStorage.getItem('hub-meteo-lieu');") == "Ville factice", "réglage non restauré")
    _assert(ev(pb, "return localStorage.getItem('hub-secret-mails');") is None, "jeton importé")
    _assert(not a.errors and not b.errors, "erreurs console : " + str(a.errors + b.errors))
    a.close(); b.close()


def _sealed_export(h, name):
    a = h.device(); pa = a.page(); seed(pa)
    code = enable_vault(pa)
    path, fname = export_file(pa, name)
    a.close()
    return path, fname, code


def test_sauvegarde_export_chiffre_phrase(h):
    path, fname, code = _sealed_export(h, "c1-chiffre.json")
    _assert("chiffre" in fname, "nom de l'export chiffré : " + fname)
    text = open(path, encoding="utf-8").read(); d = json.loads(text)
    _assert(d["format"] == "hub-donnees-chiffre", "export non chiffré")
    for clair in ("Note factice", "Tâche factice", "exemple.test", "RDV factice"):
        _assert(clair not in text, "texte en clair dans l'export chiffré : " + clair)
    b = h.device(); pb = b.page()
    # Mauvaise phrase d'abord : refusée, rien d'importé
    with pb.expect_file_chooser() as fc:
        pb.evaluate("window.__hub.data.importFile()")
    fc.value.set_files(path)
    pb.wait_for_selector(".lock .lcard input")
    pb.fill(".lock .lcard input", "mauvaise phrase 123")
    pb.click(".lock .lcard button[type=submit]")
    pb.wait_for_function("document.querySelector('.lock .lmsg').textContent.includes('incorrecte')")
    pb.evaluate("document.querySelector('.lock .lcard button:not([type=submit])').click()")       # Annuler (clic direct : voir import_file)
    pb.wait_for_function("document.querySelector('.lock').hidden", timeout=120000)
    _assert(sum(counts(pb).values()) == 0, "import malgré une mauvaise phrase")
    import_file(pb, path, secret=PHRASE)
    unlock_page(pb, PHRASE)
    pb.wait_for_function("window.__hub && document.body.classList.contains('ready')")
    c = counts(pb)
    _assert(c["notes"] == 3 and c["tasks"] == 2 and c["favs"] == 2, "comptes après import chiffré : " + str(c))
    _assert(ev(pb, "return (await import('/js/store/vault.js')).vault.active;"), "l'appareil n'a pas repris le verrouillage")
    raw = ev(pb, "const r = indexedDB.open('hub'); const db = await new Promise(x => r.onsuccess = () => x(r.result)); return await new Promise(x => { const q = db.transaction('notes').objectStore('notes').getAll(); q.onsuccess = () => x(JSON.stringify(q.result.map(o => Object.keys(o)))); });")
    _assert("text" not in raw, "notes en clair dans IndexedDB après import chiffré")
    _assert(not b.errors, "erreurs console : " + str(b.errors))
    b.close()


def test_sauvegarde_export_chiffre_cle_secours(h):
    path, fname, code = _sealed_export(h, "c1-chiffre-secours.json")
    b = h.device(); pb = b.page()
    import_file(pb, path, secret=code.lower().replace("-", " "))      # clé tapée en minuscules et espaces : acceptée
    # Au redémarrage, ouverture avec la clé de secours → nouvelle phrase → nouvelle clé de secours
    new = unlock_page(pb, code, rescue=True, new_phrase="nouvelle phrase factice 9")
    pb.wait_for_function("window.__hub && document.body.classList.contains('ready')")
    _assert(counts(pb)["notes"] == 3, "notes absentes après import par clé de secours")
    _assert(new and new != code, "pas de nouvelle clé de secours")
    ok_old = ev(pb, "return (await import('/js/store/vault.js')).vault.checkRescue(arg);", code)
    _assert(not ok_old, "l'ancienne clé de secours ouvre encore le hub")
    pb.reload(); unlock_page(pb, "nouvelle phrase factice 9")
    pb.wait_for_function("window.__hub && document.body.classList.contains('ready')")
    _assert(counts(pb)["notes"] == 3, "données illisibles après changement de clé")
    _assert(not b.errors, "erreurs console : " + str(b.errors))
    b.close()


def test_sauvegarde_refus_fichiers_invalides(h):
    a = h.device(); pa = a.page(); seed(pa)
    before = counts(pa)
    cases = {
        "corrompu.json": ("{ pas du json", "illisible"),
        "autre.json": (json.dumps({"format": "autre-chose", "data": {}}), "n'est pas un export"),
        "futur.json": (json.dumps({"format": "hub-donnees", "formatVersion": 99, "data": {"notes": []}}), "plus récente"),
        "vide.json": ("", "illisible"),
        "coffre.json": (json.dumps({"format": "coffre-hub", "sections": {}}), "n'est pas un export"),
    }
    for name, (content, expect) in cases.items():
        p = write_json(h, "c1-" + name, content)
        pa.evaluate("document.getElementById('toast').textContent = ''")
        import_file(pa, p, reload=False)
        try:
            pa.wait_for_function("t => (document.getElementById('toast').textContent || '').includes(t)", arg=expect, timeout=5000)
        except Exception:
            raise AssertionError(f"{name} : message attendu « {expect} », obtenu « {toast(pa)} »")
        _assert(counts(pa) == before, "données modifiées par " + name)
    # Export chiffré trafiqué : refusé, rien ne change
    a2 = h.device(); p2 = a2.page(); seed(p2, 1, 0, 0); enable_vault(p2); path, _ = export_file(p2, "c1-trafique.json"); a2.close()
    d = json.load(open(path)); d["coffre"]["pass"]["iter"] = 1
    p = write_json(h, "c1-trafique2.json", d)
    import_file(pa, p, reload=False)
    pa.wait_for_selector(".lock .lcard input"); pa.fill(".lock .lcard input", PHRASE); pa.click(".lock .lcard button[type=submit]")
    pa.wait_for_function("document.querySelector('.lock .lmsg').textContent.length > 0 && !document.querySelector('.lock .lmsg').textContent.includes('Vérification')")
    msg = pa.inner_text(".lock .lmsg")
    _assert("abîmé" in msg, "message pour un export trafiqué : " + msg)
    pa.click(".lock .lcard button:not([type=submit])")
    _assert(counts(pa) == before, "export trafiqué importé")
    _assert(not a.errors, "erreurs console : " + str(a.errors))
    a.close()


COFFRE = {"format": "coffre-hub", "sections": {
    "sites": [{"nom": "Déjà là", "lien": "https://EXEMPLE.test/0/", "cat": "Tests"},
              {"nom": "Nouveau site", "lien": "https://nouveau.test/", "cat": "Divers"},
              {"nom": "Piège", "lien": "javascript:alert(1)"},
              {"nom": "En clair", "lien": "http://pas-https.test/"}],
    "radios": [{"nom": "Radio factice", "lien": "https://radio.test/flux.mp3"}],
    "videos": [{"nom": "Vidéo factice", "lien": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
               {"nom": "Vimeo factice", "lien": "https://vimeo.com/1"}],
    "playlists": [{"nom": "PL factice", "lien": "https://www.youtube.com/playlist?list=PL0123456789abcdef"}],
    "musique": [{"nom": "Album factice"}], "divers": [{"nom": "Idée <img src=x onerror=alert(1)>"}]}}


def test_sauvegarde_import_coffre(h):
    a = h.device(); pa = a.page(); seed(pa)
    p = write_json(h, "c1-coffre-hub.json", COFFRE)
    def imp():
        pa.evaluate("document.getElementById('toast').textContent = ''")
        with pa.expect_file_chooser() as fc:
            pa.evaluate("window.__hub.data.importCoffre()")
        fc.value.set_files(p)
        pa.wait_for_function("(document.getElementById('toast').textContent || '').includes('Coffre') || (document.getElementById('toast').textContent || '').includes('Rien de nouveau')")
        return toast(pa)
    before = counts(pa)
    t1 = imp()
    c1 = counts(pa)
    _assert(c1["notes"] == before["notes"] + 2, "notes du Coffre : " + str(c1))
    _assert(c1["favs"] == before["favs"] + 3, f"favoris du Coffre (attendu +3 : nouveau site, Vimeo, playlist) : {before} → {c1} · {t1}")
    urls = ev(pa, "const s = await import('/js/store/storage.js'); return (await s.store.all('favs')).map(f => f.url);")
    _assert(not any(u.startswith("javascript:") or u.startswith("http:") for u in urls), "lien non https accepté : " + str(urls))
    _assert(ev(pa, "return (await import('/js/store/storage.js')).store.get('notes', 'n-test-0').then(n => !!n);"), "note existante effacée")
    t2 = imp()
    _assert(counts(pa) == c1, "doublons ajoutés au 2e import")
    _assert("Rien de nouveau" in t2, "message du 2e import : " + t2)
    # Un export du hub n'est pas un Coffre
    path, _ = export_file(pa, "c1-pas-coffre.json")
    pa.evaluate("document.getElementById('toast').textContent = ''")
    with pa.expect_file_chooser() as fc:
        pa.evaluate("window.__hub.data.importCoffre()")
    fc.value.set_files(path)
    pa.wait_for_function("(document.getElementById('toast').textContent || '').includes(\"n'est pas un export du Coffre\")")
    _assert(not pa.evaluate("window.__xss"), "script exécuté")
    _assert(not a.errors, "erreurs console : " + str(a.errors))
    a.close()


def _backup_alert(h, when, last_export=None, data=True):
    a = h.device()
    p = a.ctx.new_page()
    p.clock.install(time=when)
    p.on("dialog", lambda d: d.accept())
    if last_export is not None:
        p.add_init_script(f"localStorage.setItem('hub-dernier-export', {json.dumps(last_export.isoformat())})")
    p.goto(h.server.url, wait_until="domcontentloaded")
    p.wait_for_function("window.__hub && document.body.classList.contains('ready')")
    if data:
        seed(p, 1, 0, 0)
    p.clock.fast_forward("00:16:00")
    shown = p.evaluate("!!document.querySelector('.alert.backup')")
    return a, p, shown


def test_sauvegarde_rappel_dimanche(h):
    sun = datetime.datetime(2026, 10, 25, 10, 0)        # dimanche 10 h
    a, p, shown = _backup_alert(h, sun, sun - datetime.timedelta(days=7))
    _assert(shown, "pas d'alerte le dimanche 10 h (dernier export il y a 7 j)")
    p.click(".alert.backup button:has-text('Plus tard')")
    _assert(not p.evaluate("!!document.querySelector('.alert.backup')"), "alerte non fermée par « Plus tard »")
    p.clock.fast_forward("02:00:00"); p.clock.run_for(1000)
    _assert(not p.evaluate("!!document.querySelector('.alert.backup')"), "alerte revenue avant 3 h")
    p.clock.fast_forward("01:30:00"); p.clock.fast_forward("00:16:00")
    _assert(p.evaluate("!!document.querySelector('.alert.backup')"), "alerte non revenue après 3 h")
    a.close()
    for label, when, last, data, expect in [
        ("dimanche 8 h", datetime.datetime(2026, 10, 25, 8, 0), datetime.datetime(2026, 10, 18), True, False),
        ("samedi, export il y a 6 j", datetime.datetime(2026, 10, 24, 10, 0), datetime.datetime(2026, 10, 18), True, False),
        ("dimanche, export il y a 2 j", sun, datetime.datetime(2026, 10, 23), True, False),
        ("mercredi, export il y a 10 j (retard)", datetime.datetime(2026, 10, 28, 15, 0), datetime.datetime(2026, 10, 18), True, True),
        ("dimanche sans aucune donnée", sun, None, False, False),
        ("dimanche, jamais exporté", sun, None, True, True),
    ]:
        a, p, shown = _backup_alert(h, when, last, data)
        _assert(shown == expect, f"rappel « {label} » : attendu {expect}, obtenu {shown}")
        a.close()


def _sync_setup(p, token=FAKE_TOKEN, phrase="phrase de synchro factice"):
    return ev(p, "const { sync } = await import('/js/store/sync.js'); try { return await sync.setup(arg[0], arg[1]); } catch (e) { return 'ERR ' + e.message; }", [token, phrase])


def _sync_run(p):
    return ev(p, "const { sync } = await import('/js/store/sync.js'); try { return await sync.run(); } catch (e) { return 'ERR ' + e.message; }")


def _notes(p):
    return ev(p, "const s = await import('/js/store/storage.js'); return Object.fromEntries((await s.store.all('notes')).map(n => [n.id, n.text]));")


def test_sauvegarde_synchro_deux_appareils(h):
    gh = FakeGitHub(FAKE_TOKEN); h.mock = gh
    pc = h.device(); tel = h.device(mobile=True)
    a = pc.page(); seed(a, 3, 1, 1)
    r = _sync_setup(a); _assert(r == {"created": True}, "mise en route PC : " + str(r))
    gist = next(iter(gh.gists.values()))
    _assert(not gist["public"], "Gist public")
    blob = json.dumps(gist)
    _assert("Note factice" not in blob and "exemple.test" not in blob, "données en clair sur GitHub")
    b = tel.page()
    _assert(str(_sync_setup(b, phrase="mauvaise phrase factice")).startswith("ERR"), "mauvaise phrase acceptée")
    _assert(_sync_setup(b) == {"created": False}, "mise en route téléphone")
    _sync_run(b)
    _assert(len(_notes(b)) == 3, "notes non reçues sur le téléphone : " + str(_notes(b)))
    # Téléphone : supprime n-test-1, modifie n-test-2, ajoute une note
    ev(b, """const s = await import('/js/store/storage.js'); await s.store.del('notes', 'n-test-1');
      const n = await s.store.get('notes', 'n-test-2'); n.text = 'modifiée sur le téléphone'; await s.store.put('notes', n);
      await s.store.put('notes', { id: 'n-tel', text: 'née sur le téléphone', pinned: false, created: Date.now(), updated: Date.now() });""")
    _sync_run(b); _sync_run(a)
    na = _notes(a)
    _assert("n-test-1" not in na, "suppression non transmise au PC")
    _assert(na.get("n-test-2") == "modifiée sur le téléphone", "modification non transmise")
    _assert("n-tel" in na, "ajout non transmis")
    # Conflit : les deux modifient n-test-0 ; la plus récente gagne
    ev(a, "const s = await import('/js/store/storage.js'); const n = await s.store.get('notes', 'n-test-0'); n.text = 'version PC'; await s.store.put('notes', n);")
    a.wait_for_timeout(20)
    ev(b, "const s = await import('/js/store/storage.js'); const n = await s.store.get('notes', 'n-test-0'); n.text = 'version téléphone (plus récente)'; await s.store.put('notes', n);")
    _sync_run(a); _sync_run(b); _sync_run(a)
    _assert(_notes(a)["n-test-0"] == _notes(b)["n-test-0"] == "version téléphone (plus récente)", f"conflit mal résolu : {_notes(a)['n-test-0']} / {_notes(b)['n-test-0']}")
    # Suppression sur le PC d'une note modifiée AVANT sur le téléphone : la suppression gagne
    ev(a, "const s = await import('/js/store/storage.js'); await s.store.del('notes', 'n-tel');")
    _sync_run(a); _sync_run(b)
    _assert("n-tel" not in _notes(b), "suppression du PC non appliquée au téléphone")
    _assert(_notes(a) == _notes(b), "appareils différents après synchro")
    # Jeton et phrase jamais dans le contenu synchronisé
    tok = gh.gists[next(iter(gh.gists))]["files"]
    _assert(FAKE_TOKEN not in json.dumps(tok), "jeton dans le Gist")
    _assert(not pc.errors and not tel.errors, "erreurs console : " + str(pc.errors + tel.errors))
    pc.close(); tel.close()
