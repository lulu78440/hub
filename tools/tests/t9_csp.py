"""Cycle 9 · Politique de sécurité du contenu (CSP, B15) : aucune violation pendant la recette PC et mobile simulée.

La CSP est posée en <meta> dans index.html, labo.html et oauth.html (détail : docs/banc-essai/csp.md).
Chaque appareil écoute « securitypolicyviolation » dans la page (relayé au test par une liaison Playwright)
et les messages de console de Chromium (« Refused to … because it violates the following Content Security Policy … »).

- la recette PC, la recette mobile et le test médias / page en direct de t2 sont rejoués tels quels, CSP active ;
- une sonde vérifie ce que la recette n'atteint pas sans réseau ni carte graphique : imports des bibliothèques d'IA
  (jsDelivr, cdnjs), WebAssembly, worker du Noyau et worker blob:, radios https, vignettes YouTube, images blob:/data:,
  appels aux API (GitHub, Open-Meteo, Gemini…) — le réseau extérieur reste bloqué par le banc : seule la CSP est jugée ;
- témoins : eval(), un script d'un autre site et un objet <embed> DOIVENT être refusés (la CSP est bien appliquée) ;
- labo.html et oauth.html s'ouvrent sans violation.
"""
import t2_fonctions as t2

LISTENER = """(() => {
  if (window.__cspListen) return; window.__cspListen = true;
  document.addEventListener('securitypolicyviolation', (e) => {
    try { window.__cspViolation({ dir: e.effectiveDirective || e.violatedDirective, uri: e.blockedURI, src: e.sourceFile, line: e.lineNumber, page: location.pathname }); } catch (x) {}
  });
})()"""


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


class _CspHub:
    """Enveloppe du banc : chaque appareil créé (y compris par les tests de t2) note les violations CSP."""

    def __init__(self, h):
        self.h = h
        self.violations = []

    def __getattr__(self, k):
        return getattr(self.h, k)

    def __setattr__(self, k, v):
        if k in ("h", "violations"):
            object.__setattr__(self, k, v)
        else:
            setattr(self.h, k, v)

    def device(self, **kw):
        d = self.h.device(**kw)
        d.ctx.expose_binding("__cspViolation", lambda src, v: self.violations.append(v))
        d.ctx.add_init_script(LISTENER)
        d.ctx.on("console", lambda m: ("Content Security Policy" in m.text) and self.violations.append({"console": m.text[:300]}))
        return d

    def take(self):
        v, self.violations = self.violations, []
        return v


def _check(ch, label):
    v = ch.take()
    _assert(not v, f"violation(s) CSP pendant {label} : {v[:6]}")


def _csp_meta(p):
    return p.evaluate("(document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]') || {}).content || ''")


def test_csp_recette_pc_sans_violation(h):
    ch = _CspHub(h)
    t2.test_fonctions_recette_pc(ch)
    _check(ch, "la recette PC")


def test_csp_recette_mobile_sans_violation(h):
    ch = _CspHub(h)
    t2.test_fonctions_recette_mobile(ch)
    _check(ch, "la recette mobile")


def test_csp_medias_et_page_en_direct_sans_violation(h):
    ch = _CspHub(h)
    t2.test_fonctions_medias_et_page_en_direct(ch)
    _check(ch, "vidéo YouTube et page en direct")


PROBE = r"""
  const out = {};
  const settle = (p, ms = 4000) => Promise.race([p.then(() => 'ok', (e) => 'rejet : ' + String(e && e.message || e).slice(0, 80)), new Promise((r) => setTimeout(() => r('délai'), ms))]);
  // Bibliothèques d'IA (versions figées du code) : la CSP doit les laisser partir (le banc coupe ensuite le réseau)
  out.webllm = await settle(import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm'));
  out.transformers = await settle(import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm'));
  out.piper = await settle(import('https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm'));
  out.ort = await settle(import('https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/ort.min.mjs'));
  // Module blob: (glue Emscripten chargée depuis un objet, cas de la voix Piper)
  const bm = URL.createObjectURL(new Blob(['export const x = 41 + 1;'], { type: 'text/javascript' }));
  out.blobModule = (await import(bm)).x;
  // WebAssembly (module vide valide) : 'wasm-unsafe-eval'
  const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  out.wasm = (await WebAssembly.instantiate(wasm)).instance ? 'ok' : 'non';
  // Worker du Noyau (même site) et worker blob: (onnxruntime-web depuis un CDN)
  const wk = await import('/js/noyau/socle.js'); const w1 = wk.creerWorkerReel(); out.workerNoyau = !!w1; w1.terminate();
  out.workerBlob = await new Promise((r) => { const u = URL.createObjectURL(new Blob(['postMessage(7)'], { type: 'text/javascript' })); const w = new Worker(u); w.onmessage = (e) => { r(e.data); w.terminate(); }; w.onerror = () => r('erreur'); setTimeout(() => r('délai'), 4000); });
  // Connexions (refusées ensuite par le banc, jamais par la CSP)
  const urls = ['https://api.open-meteo.com/v1/forecast?latitude=1&longitude=1', 'https://api.bigdatacloud.net/data/reverse-geocode-client', 'https://api.github.com/gists',
    'https://raw.githubusercontent.com/lulu78440/hub/flux/flux.json', 'https://generativelanguage.googleapis.com/v1beta/models', 'https://api.anthropic.com/v1/messages',
    'https://api.groq.com/openai/v1/chat/completions', 'https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/config.json', 'https://fr.wikipedia.org/w/api.php'];
  out.fetch = await Promise.all(urls.map((u) => settle(fetch(u, { cache: 'no-store' }), 3000)));
  out.dataFetch = (await (await fetch('data:text/plain,abc')).text());
  // Radio https (domaine quelconque) et MP3 local (blob:)
  const a = new Audio(); a.preload = 'auto'; a.src = 'https://icecast.radiofrance.fr/fip-hifi.aac?id=radiofrance'; a.load();
  const a2 = new Audio(); a2.src = URL.createObjectURL(new Blob([new Uint8Array(16)], { type: 'audio/mpeg' })); a2.load();
  // Images : vignette YouTube, blob:, data:, masque CSS data: (déjà dans hud.css)
  const img = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r('ok'); i.onerror = () => r('erreur'); i.src = u; setTimeout(() => r('délai'), 3000); });
  out.imgYt = await img('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  out.imgData = await img('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
  const c = document.createElement('canvas'); c.width = c.height = 2; const b = await new Promise((r) => c.toBlob(r, 'image/png'));
  out.imgBlob = await img(URL.createObjectURL(b));
  // Styles posés par le code (personnalisation du Noyau, surprises) et attributs style
  const st = document.createElement('style'); st.textContent = '.csp-essai{color:red}'; document.head.append(st); st.remove();
  // Lecteur YouTube et page en direct (https quelconque)
  for (const u of ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'https://exemple.test/']) { const f = document.createElement('iframe'); f.src = u; document.body.append(f); setTimeout(() => f.remove(), 1500); }
  await new Promise((r) => setTimeout(r, 2000));
  return out;
"""

CONTROLS = r"""
  const out = {};
  // eval() lancé depuis un module de la page (un eval lancé directement par l'outil de test passerait outre la CSP)
  const m = URL.createObjectURL(new Blob(["let a, b; try { eval('1 + 1'); a = 'accepté'; } catch (e) { a = 'refusé'; } try { new Function('return 1')(); b = 'accepté'; } catch (e) { b = 'refusé'; } export const r = [a, b];"], { type: 'text/javascript' }));
  [out.eval, out.fn] = (await import(m)).r;
  out.script = await new Promise((r) => { const s = document.createElement('script'); s.src = 'https://pirate.test/x.js'; s.onerror = () => r('refusé'); s.onload = () => r('accepté'); document.head.append(s); setTimeout(() => r('délai'), 3000); });
  out.inline = await new Promise((r) => { window.__inl = 0; const s = document.createElement('script'); s.textContent = 'window.__inl = 1'; document.head.append(s); setTimeout(() => r(window.__inl ? 'accepté' : 'refusé'), 300); });
  const e = document.createElement('embed'); e.src = '/manifest.webmanifest'; document.body.append(e);
  await new Promise((r) => setTimeout(r, 800)); e.remove();
  return out;
"""


def test_csp_sonde_ia_medias_connexions_et_temoins(h):
    h.mock = t2.make_mock()
    ch = _CspHub(h)
    d = ch.device()
    p = d.page()
    csp = _csp_meta(p)
    _assert("default-src 'self'" in csp and "'unsafe-eval'" not in csp and "object-src 'none'" in csp, "CSP absente ou affaiblie : " + csp)
    _assert(p.evaluate("(document.querySelector('meta[name=referrer]') || {}).content") == "no-referrer", "referrer no-referrer absent")
    out = p.evaluate("async () => { " + PROBE + " }")
    _assert(out["blobModule"] == 42 and out["wasm"] == "ok" and out["workerNoyau"] and out["workerBlob"] == 7 and out["dataFetch"] == "abc", "sonde : " + str(out))
    _assert(out["imgData"] == "ok" and out["imgBlob"] == "ok", "images data:/blob: : " + str({k: out[k] for k in ("imgData", "imgBlob", "imgYt")}))
    _check(ch, "la sonde (IA, WebAssembly, workers, radios, connexions, images, cadres)")
    # Témoins : la CSP est bien appliquée
    ctl = p.evaluate("async () => { " + CONTROLS + " }")
    _assert(ctl == {"eval": "refusé", "fn": "refusé", "script": "refusé", "inline": "refusé"}, "témoins non refusés : " + str(ctl))
    v = ch.take()
    dirs = {x.get("dir") for x in v if "dir" in x}
    _assert(any(x.startswith("script-src") for x in dirs) and "object-src" in dirs, "les témoins n'ont pas levé les violations attendues : " + str(v)[:600])
    # Les erreurs de console des témoins sont voulues : on ne les compte pas comme erreurs du hub
    d.errors.clear()
    d.close()
    return 9 + 4


def test_csp_labo_et_connexion_sans_violation(h):
    ch = _CspHub(h)
    d = ch.device()
    p = d.page("labo.html", wait=False)
    p.wait_for_load_state("load")
    p.wait_for_timeout(4000)
    _assert("'wasm-unsafe-eval'" in _csp_meta(p), "CSP du labo absente")
    _check(ch, "l'ouverture du labo")
    _assert(not d.errors, "erreurs console du labo : " + str(d.errors))
    p2 = d.page("oauth.html#access_token=jeton-factice&state=x", wait=False)
    p2.wait_for_function("document.getElementById('m').textContent.includes('Connexion terminée')", timeout=10000)
    _assert("default-src 'none'" in _csp_meta(p2), "CSP de oauth.html absente")
    _assert(p2.evaluate("location.hash") == "", "jeton laissé dans l'adresse")
    _check(ch, "la page de retour de connexion")
    d.close()
