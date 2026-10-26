"""Refonte 5 (7.40.1) : deux anomalies mineures de la recette 7.38 du Banc.

R1 : fermer_appli("direct") coupe le partage d'écran même si la fenêtre « Écran » n'est pas ouverte.
R2 : Échap réduit la fenêtre active juste après un clic sur sa barre de titre (le focus reste dans la fenêtre).
Le partage d'écran est SIMULÉ (canvas) : aucun vrai écran, aucune clé, aucun service."""
import t2_fonctions as t2
from hubtest import seed, ev

SPY = """(() => {
  window.__gdm = 0; window.__tracks = [];
  if (navigator.mediaDevices) navigator.mediaDevices.getDisplayMedia = async () => {
    window.__gdm++; const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d'); g.fillStyle = '#123'; g.fillRect(0, 0, 320, 180);
    const s = c.captureStream(5); window.__tracks.push(...s.getTracks()); return s; };
})()"""


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def _ready(p):
    p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)


def _cmd(p, nom, params=None):
    return ev(p, "return await window.__hub.commandes.executer(arg[0], arg[1]);", [nom, params or {}])


def _bureau(h):
    h.mock = t2.make_mock()
    d = h.device(three=False)
    d.ctx.add_init_script(SPY)
    p = d.page()
    p.set_viewport_size({"width": 1440, "height": 900})
    seed(p, 3, 2, 3)
    p.reload()
    _ready(p)
    p.wait_for_timeout(1500)
    for _ in range(4):
        b = p.locator("#alerts button", has_text="OK").first
        if not b.count():
            break
        b.click()
        p.wait_for_timeout(300)
    p.evaluate("document.activeElement && document.activeElement.blur()")
    p.keyboard.press("3")
    p.wait_for_timeout(1500)
    return p


def test_refonte5_r1_fermer_direct_coupe_le_partage_sans_fenetre(h):
    p = _bureau(h)
    p.evaluate("window.__pr = window.__hub.commandes.executer('ecran_direct_demarrer', {}); 0")
    p.wait_for_selector(".cmd-confirm", timeout=5000)
    p.click(".cmd-confirm .cc-yes")
    p.wait_for_timeout(700)
    _assert(p.evaluate("document.body.classList.contains('direct-on')"), "le partage simulé devait être actif")
    _assert(not p.evaluate("!!document.querySelector('.dwin[data-app=\"direct\"]')"), "la fenêtre « Écran » ne devait pas être ouverte")
    r = _cmd(p, "fermer_appli", {"app": "direct"})
    p.wait_for_timeout(400)
    _assert(not p.evaluate("document.body.classList.contains('direct-on')"), f"le partage reste actif après fermer_appli : {r}")
    live = p.evaluate("window.__tracks.filter(t => t.readyState === 'live').length")
    _assert(live == 0, f"pistes encore actives : {live}")
    _assert(r.get("ok") and "Déjà fermée" not in str(r.get("message")), f"réponse trompeuse : {r}")
    # sans partage ni fenêtre : toujours « Déjà fermée »
    r2 = _cmd(p, "fermer_appli", {"app": "direct"})
    _assert(r2.get("ok") and "Déjà fermée" in str(r2.get("message")), f"réponse inattendue : {r2}")
    # le défaut ne change pas : coupé au chargement, aucun partage demandé tout seul
    _assert(p.evaluate("window.__gdm") == 1, "un seul partage demandé (celui confirmé)")


def test_refonte5_r2_echap_apres_clic_sur_la_barre_de_titre(h):
    p = _bureau(h)
    _cmd(p, "ouvrir_appli", {"app": "internet"})
    p.wait_for_selector('.dwin[data-app="internet"] .ph', state="visible", timeout=15000)   # fondu d'ouverture : jusqu'à ~4 s sur une machine chargée
    p.wait_for_timeout(500)
    p.evaluate("document.querySelectorAll('.brief').forEach(b => { b.hidden = true; })")   # le message du jour couvre le haut du bureau
    p.click('.dwin[data-app="internet"] .ph', position={"x": 60, "y": 10}, force=True)
    foc = p.evaluate("(() => { const a = document.activeElement; return a === document.body ? 'BODY' : (a.closest('.dwin') ? 'fenetre' : a.tagName); })()")
    _assert(foc == "fenetre", f"le focus devrait rester dans la fenêtre, il est sur {foc}")
    p.keyboard.press("Escape")
    p.wait_for_timeout(1500)
    m = p.evaluate("(() => { const w = document.querySelector('.dwin[data-app=\"internet\"]'); return !!w && w.dataset.m === '1'; })()")
    _assert(m, "Échap n'a pas réduit la fenêtre après un clic sur sa barre de titre")
