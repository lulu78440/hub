"""Cycle 8 · Règles de la Charte des postes (25/10) : règle 11 « toujours un mode simple » (sans IA ni WebGL),
règle 12 « fiche de manuel pour chaque fonction livrée », et B29 (clés IA laissées en clair à la désactivation du verrouillage).

Conventions provisoires (prudentes, en attente de la Commande, voir docs/banc-essai/propositions.md) :
- une « fonction livrée » = une fenêtre déclarée dans index.html (attribut data-id) ;
- sa fiche = docs/manuel/<id>.md, ou tout fichier .md de docs/manuel/ qui contient la ligne « id: <id> » ;
- le test du manuel LISTE les fiches manquantes sans faire échouer la suite ; HUB_MANUEL_STRICT=1 le rend bloquant.
"""
import glob, os, re
from hubtest import ev, seed, enable_vault, ROOT

# Coupe l'IA locale (WebGPU) en plus de WebGL (déjà coupé par défaut dans Device) ; le réseau extérieur est déjà bloqué
# (Gemini, Claude, relais, jsDelivr pour WebLLM).
NO_AI = """(() => { try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch (e) {} })()"""


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def _window_ids():
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    ids = []
    for m in re.finditer(r'<[^>]*class="[^"]*\bwin\b[^"]*"[^>]*>', html):
        d = re.search(r'data-id="([^"]+)"', m.group(0))
        if d and d.group(1) not in ids:
            ids.append(d.group(1))
    return ids


def _check_simple_mode(h, mobile):
    d = h.device(mobile=mobile)
    d.ctx.add_init_script(NO_AI)
    p = d.page()
    seed(p)
    p.reload(wait_until="domcontentloaded")
    p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.wait_for_timeout(1500)
    _assert(p.evaluate("!('gpu' in navigator) || !navigator.gpu"), "WebGPU encore visible : l'essai sans IA n'est pas valable")
    gl = p.evaluate("!!document.createElement('canvas').getContext('webgl')")
    _assert(not gl, "WebGL encore disponible : l'essai sans WebGL n'est pas valable")
    wins = p.evaluate("""[...document.querySelectorAll('.win[data-id]')].map(w => ({ id: w.dataset.id,
        txt: (w.innerText || '').trim().length, kids: w.querySelectorAll('*').length }))""")
    _assert(len(wins) > 0, "aucune fenêtre affichée sans IA ni WebGL")
    vides = [w["id"] for w in wins if w["kids"] < 2]
    _assert(not vides, "fenêtres vides sans IA ni WebGL : " + ", ".join(vides))
    body = p.evaluate("document.body.innerText")
    for t in ("Note factice 0", "Tâche factice 0"):
        _assert(t in body, f"« {t} » absent de l'écran sans IA ni WebGL")
    # Une action de base par fonction de données, par le code du hub (pas d'IA)
    n = ev(p, """const s = await import('/js/store/storage.js');
        await s.store.put('notes', { id: 'n-simple', text: 'Note mode simple', pinned: false, created: Date.now(), updated: Date.now() });
        return (await s.store.all('notes')).length;""")
    _assert(n >= 4, "écriture d'une note impossible sans IA ni WebGL")
    errs = [e for e in d.errors if not re.search(r"webgl|webgpu|gpu", e, re.I)]
    _assert(not errs, "erreurs sans IA ni WebGL : " + " | ".join(errs[:5]))
    d.close()
    return len(wins)


def test_charte_mode_simple_sans_ia_ni_webgl_pc(h):
    """Règle 11 (PC) : WebGL et WebGPU coupés, réseau extérieur bloqué : chaque fenêtre s'affiche avec du contenu, données lisibles et modifiables, aucune erreur."""
    return _check_simple_mode(h, mobile=False)


def test_charte_mode_simple_sans_ia_ni_webgl_mobile(h):
    """Règle 11 (téléphone simulé)."""
    return _check_simple_mode(h, mobile=True)


def test_charte_fiche_de_manuel_par_fonction(h):
    """Règle 12 : une fiche de manuel par fenêtre livrée. Liste les manques ; bloquant seulement avec HUB_MANUEL_STRICT=1."""
    ids = _window_ids()
    _assert(ids, "aucune fenêtre trouvée dans index.html (convention à revoir)")
    dossier = os.path.join(ROOT, "docs", "manuel")
    fiches = glob.glob(os.path.join(dossier, "*.md"))
    noms = {os.path.splitext(os.path.basename(f))[0] for f in fiches}
    declares = set()
    for f in fiches:
        for m in re.finditer(r"^id:\s*([\w-]+)", open(f, encoding="utf-8").read(), re.M):
            declares.add(m.group(1))
    manque = [i for i in ids if i not in noms and i not in declares]
    print(f"        manuel : {len(ids) - len(manque)}/{len(ids)} fonctions ont leur fiche" +
          (f" ; manquantes : {', '.join(manque)}" if manque else ""))
    if manque and os.environ.get("HUB_MANUEL_STRICT") == "1":
        raise AssertionError("fiches de manuel manquantes : " + ", ".join(manque))
    return len(ids)


def test_charte_b29_cles_ia_retirees(h):
    """B29 : désactiver le verrouillage ne doit laisser en clair aucune clé d IA (Gemini, Claude, relais)."""
    d = h.device(); p = d.page()
    enable_vault(p)
    keys = ["hub-secret-ia", "hub-secret-claude", "hub-secret-libre"]   # clés IA : exigent le verrouillage (les jetons des mails, eux, restent sur l appareil par conception)
    ev(p, "const { vault } = await import('/js/store/vault.js'); for (const k of arg) vault.lsSet(k, 'valeur-factice-' + k); await vault.flush();", keys)
    ev(p, "const s = await import('/js/store/storage.js'); const { vault } = await import('/js/store/vault.js'); await s.migrate(async () => { await s.plainAll(); await vault.destroy(); });")
    left = ev(p, "return Object.keys(localStorage).filter(k => k.startsWith('hub-secret') && (localStorage.getItem(k) || '').includes('valeur-factice'));")
    d.close()
    _assert(not left, "clés laissées en clair après désactivation du verrouillage : " + ", ".join(left))
