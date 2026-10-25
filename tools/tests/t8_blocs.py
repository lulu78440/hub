"""Cycle 9 · Blocs livrés par les postes, passés au banc avant la validation de Lucien (étape test-blocs).

Bloc 7.21.0 (poste Références, arbitré par la Commande) : import du catalogue par lien `#catalogue=<base64url>`.
Le test est sauté (réussi, 0 cas) sur une branche qui n'a pas encore ce bloc (`readCatalogue` absent).
"""
import base64, json
from hubtest import ev, counts

PWN = "window.__pwn=1"


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def _b64(obj):
    raw = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _cat(sections):
    return {"format": "coffre-hub", "sections": sections}


def _has_bloc(p):
    return ev(p, "try { const m = await import('/js/ui/coffre.js'); return typeof m.readCatalogue === 'function'; } catch (e) { return false; }")


def test_bloc_catalogue_lecture_stricte(h):
    """readCatalogue : tout ce qui cloche est refusé en entier (rien d'importé) ; un catalogue propre passe."""
    d = h.device(); p = d.page()
    if not _has_bloc(p):
        d.close(); return 0
    ok = {"sites": [{"nom": "Site factice", "lien": "https://exemple.test/"}]}
    cas = {
        "propre": (_b64(_cat(ok)), True),
        "vide": ("", False),
        "base64 abîmé": ("%%%", False),
        "pas du JSON": (_b64(b"bonjour"), False),
        "UTF-8 invalide": (_b64(b"\xff\xfe\xfa"), False),
        "autre format": (_b64({"format": "hub-donnees", "sections": ok}), False),
        "sections en liste": (_b64({"format": "coffre-hub", "sections": []}), False),
        "lien http": (_b64(_cat({"sites": [{"nom": "x", "lien": "http://exemple.test/"}]})), False),
        "lien javascript": (_b64(_cat({"sites": [{"nom": "x", "lien": "javascript:alert(1)"}]})), False),
        "lien data": (_b64(_cat({"radios": [{"nom": "x", "lien": "data:text/html,<script>1</script>"}]})), False),
        "lien avec espace": (_b64(_cat({"sites": [{"nom": "x", "lien": "https://a.test/ b"}]})), False),
        "un seul lien http parmi des bons": (_b64(_cat({"sites": [{"nom": "a", "lien": "https://a.test/"}, {"nom": "b", "lien": "http://b.test/"}]})), False),
        "501 éléments": (_b64(_cat({"divers": [{"nom": "n%d" % i} for i in range(501)]})), False),
        "500 éléments": (_b64(_cat({"divers": [{"nom": "n%d" % i} for i in range(500)]})), True),
        "élément non objet": (_b64(_cat({"sites": ["https://a.test/"]})), False),
        "section non liste": (_b64(_cat({"sites": {"nom": "a"}})), False),
        "catalogue vide": (_b64(_cat({"sites": []})), False),
        "lien trop long": (_b64(_cat({"sites": [{"nom": "a", "lien": "https://a.test/" + "x" * 1200}]})), False),
        "plus de 200 Ko": (_b64(_cat({"divers": [{"nom": "x" * 1000} for i in range(260)]})), False),
    }
    res = ev(p, """const m = await import('/js/ui/coffre.js'); const out = {};
        for (const [k, v] of Object.entries(arg)) { try { m.readCatalogue(v[0]); out[k] = true; } catch (e) { out[k] = false; } } return out;""", cas)
    faux = [k for k, (b, attendu) in cas.items() if res[k] != attendu]
    d.close()
    _assert(not faux, "catalogue mal jugé : " + ", ".join(faux))
    return len(cas)


def test_bloc_catalogue_par_lien_de_bout_en_bout(h):
    """Lien ouvert : adresse effacée tout de suite, confirmation avec « Annuler » par défaut, Annuler = rien, Importer = ajout,
    deuxième ouverture = aucun doublon, nom piégé affiché en texte."""
    d = h.device(); p = d.page()
    if not _has_bloc(p):
        d.close(); return 0
    cat = _cat({"sites": [{"nom": '<img src=x onerror="' + PWN + '">Site piégé', "lien": "https://exemple.test/a"},
                          {"nom": "Site factice B", "lien": "https://exemple.test/b"}],
                "musique": [{"nom": "Note de musique factice"}]})
    lien = "#catalogue=" + _b64(cat)
    avant = counts(p)
    # 1. Annuler
    q = d.page(lien, wait=False)
    q.wait_for_function("document.body.classList.contains('ready')", timeout=40000)
    _assert("catalogue" not in q.evaluate("location.href"), "le lien du catalogue reste dans l'adresse")
    q.wait_for_selector(".cat-ask", timeout=15000)
    foc = q.evaluate("document.activeElement && document.activeElement.textContent")
    _assert(foc == "Annuler", "le bouton par défaut n'est pas « Annuler » : " + str(foc))
    q.keyboard.press("Enter")
    q.wait_for_timeout(1200)
    _assert(counts(q) == avant, "Annuler (Entrée sur le bouton par défaut) a importé quelque chose")
    q.close()
    # 2. Importer
    q = d.page(lien, wait=False)
    q.wait_for_function("document.body.classList.contains('ready')", timeout=40000)
    q.wait_for_selector(".cat-ask", timeout=15000)
    q.click(".cat-ask button:has-text('Importer')")
    q.wait_for_timeout(1500)
    apres = counts(q)
    _assert(apres["favs"] >= avant["favs"] + 2, f"favoris non importés : {avant['favs']} → {apres['favs']}")
    _assert(not q.evaluate("!!window.__pwn") and q.evaluate("document.querySelectorAll('img[src=x]').length") == 0, "nom piégé exécuté ou inséré en HTML")
    q.close()
    # 3. Même lien rouvert : aucun doublon
    q = d.page(lien, wait=False)
    q.wait_for_function("document.body.classList.contains('ready')", timeout=40000)
    try:
        q.wait_for_selector(".cat-ask", timeout=8000)
        q.click(".cat-ask button:has-text('Importer')")
        q.wait_for_timeout(1500)
    except Exception:
        pass
    encore = counts(q)
    _assert(encore["favs"] == apres["favs"] and encore["notes"] == apres["notes"], f"doublons après réimport : {apres} → {encore}")
    q.close()
    d.close()
    return 6
