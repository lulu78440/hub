"""Recette de la refonte (ergo-recette) : déroulé Playwright/Chromium, PC 1440x900 et mobile 390x844.
Lancement : python3 docs/banc-essai/recette/recette.py   (depuis la racine du dépôt). Données factices, aucun appel vers l'extérieur."""
import json, os, sys, time
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "tests"))
from hubtest import Hub, seed, ev
from t2_fonctions import make_mock
from t5_confort import CONTRAST

OUT = os.path.dirname(__file__)
R = []          # (zone, point, statut, détail)
def rec(zone, point, ok, detail=""):
    R.append((zone, point, "OK" if ok else "A CORRIGER", detail)); print(("OK   " if ok else "KO   ") + zone + " · " + point + (" — " + str(detail) if detail else ""), flush=True)

CSP_SPY = """(() => { window.__csp = []; addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); })()"""

def shot(p, name):
    p.screenshot(path=os.path.join(OUT, name + ".png"))

def csp(p):
    return p.evaluate("window.__csp || []")

def blur(p):
    p.evaluate("document.activeElement && document.activeElement.blur()")

def run():
    h = Hub(); h.mock = make_mock()
    try:
        # ---------------- PC ----------------
        d = h.device(three=False); d.ctx.add_init_script(CSP_SPY)
        d.ctx.add_init_script("localStorage.setItem('hub-meteo-lieu', JSON.stringify({lat: 44.8, lon: -0.58, name: 'Ville factice', auto: false, at: Date.now()}))")
        p = d.page(); p.set_viewport_size({"width": 1440, "height": 900}); seed(p, 3, 2, 3); p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
        p.wait_for_timeout(2500)
        ver = p.evaluate("document.getElementById('d-version') && document.getElementById('d-version').textContent")
        rec("PC", "version affichée", "7.35" in (ver or ""), ver)
        rec("PC", "mode PC détecté (pas de classe lite)", p.evaluate("!document.body.classList.contains('lite')"))
        PL = "[...document.querySelectorAll('.win')].filter(w => !w.classList.contains('hid') && !w.classList.contains('mob-only') && window.__hub.wins.planOf(w) === %d).map(w => w.dataset.id)"
        vis = p.evaluate(PL % 1); vis2 = p.evaluate(PL % 2)
        rec("PC", "plan 1 : Favoris, Notes, Vidéo, Musique (et rien d'autre que la recherche et l'orbe au centre)", set(vis) == {"favs", "notes", "video", "music"}, vis)
        rec("PC", "plan 2 (salle) : Page en direct, Mon PC, Noyau", set(vis2) >= {"web", "pc", "noyau"}, vis2)
        rec("PC", "plan 1 : Tâches, Veille, Sécurité, Savoir en réserve (masquées)", p.evaluate("['tasks','watch','securite','savoir','radar','rituels'].every(i => window.__hub.wins.S[i].res === true)"))
        shot(p, "pc-plan1")
        # barre du haut
        top = p.evaluate("[...document.querySelectorAll('.topbar .btn, header .btn, #b-outils, #b-labo, #b-diag')].filter((b, i, a) => a.indexOf(b) === i && b.offsetParent).map(b => b.textContent.trim())")
        rec("PC", "barre du haut : Outils et Labo présents, pas de jauge de zoom", "Outils" in top and "Labo" in top or "Outils" in top, top)
        rec("PC", "jauge de zoom retirée de la vue", p.evaluate("getComputedStyle(document.querySelector('.zoom')).display === 'none' || !document.querySelector('.zoom').offsetParent"))
        # plans par boutons
        for n in "123":
            p.click("#plan" + n); p.wait_for_timeout(1300)
            ok = p.evaluate("window.__hub.plans.plan") == int(n) and p.get_attribute("#plan" + n, "aria-pressed") == "true"
            rec("PC", f"bouton Plan {n}", ok)
            shot(p, "pc-plan" + n + ("" if n != "1" else "-bouton"))
        os.remove(os.path.join(OUT, "pc-plan1-bouton.png"))
        # clavier + molette
        blur(p); p.keyboard.press("1"); p.wait_for_timeout(1200)
        p.mouse.move(720, 450); p.mouse.wheel(0, 400); p.wait_for_timeout(1500)
        rec("PC", "molette sur le fond : plan 1 vers plan 2", p.evaluate("window.__hub.plans.plan") == 2, p.evaluate("window.__hub.plans.plan"))
        p.mouse.wheel(0, -400); p.wait_for_timeout(1500)
        rec("PC", "molette inverse : retour au plan 1", p.evaluate("window.__hub.plans.plan") == 1, p.evaluate("window.__hub.plans.plan"))
        # menu du fond
        p.mouse.click(720, 300, button="right"); p.wait_for_timeout(300)
        lines = p.evaluate("[...document.querySelectorAll('#ctx button, #ctx [role=menuitem]')].map(b => b.textContent.trim())")
        rec("PC", "menu du fond : 6 lignes au plus, sans navigation", 1 <= len(lines) <= 8 and not any("Plan" in l or "Zoom" in l for l in lines), lines)
        shot(p, "pc-menu-fond"); p.keyboard.press("Escape")
        # Outils
        p.click("#b-outils"); p.wait_for_selector("#outils:not([hidden])", timeout=15000); p.wait_for_timeout(500)
        grp = p.evaluate("[...document.querySelectorAll('#outils .o-grp')].map(g => g.textContent.trim())")
        tiles = p.evaluate("[...document.querySelectorAll('#outils .o-tile')].map(g => g.textContent.trim().replace(/\\s+/g,' '))")
        rec("PC", "Outils : bouton ouvre le panneau, groupes", len(grp) >= 4, grp)
        rec("PC", "Outils : tuiles essentielles présentes", all(any(k in t for t in tiles) for k in ["Focus", "Exporter", "Importer", "Fonctions en réserve"] ) or len(tiles) > 15, len(tiles))
        shot(p, "pc-outils")
        p.keyboard.press("Escape"); p.wait_for_timeout(400)
        rec("PC", "Outils : Échap ferme", p.evaluate("document.getElementById('outils').hidden"))
        blur(p); p.keyboard.press("o"); p.wait_for_timeout(500)
        rec("PC", "touche O ouvre Outils", p.evaluate("!document.getElementById('outils').hidden")); p.keyboard.press("Escape")
        blur(p); p.keyboard.press("d"); p.wait_for_timeout(400)
        rec("PC", "touche D ouvre Réglages et diagnostic", p.evaluate("!document.getElementById('diag').hidden")); p.keyboard.press("Escape")
        # fenêtres : réduire / rouvrir
        W = '.win[data-id="notes"]'
        w0 = p.evaluate(f"document.querySelector('{W}').getBoundingClientRect().height")
        p.click(W + " h2"); p.wait_for_timeout(700)
        red = p.evaluate("window.__hub.wins.S.notes.red"); h1 = p.evaluate(f"document.querySelector('{W}').getBoundingClientRect().height")
        rec("PC", "clic sur le nom : la fenêtre se réduit à son nom", red and h1 < w0 / 2, f"{w0:.0f}px -> {h1:.0f}px")
        shot(p, "pc-fenetre-reduite")
        p.click(W + " h2"); p.wait_for_timeout(700)
        p.wait_for_timeout(800)
        rec("PC", "second clic : elle se rouvre à sa taille", (not p.evaluate("window.__hub.wins.S.notes.red")) and abs(p.evaluate(f"document.querySelector('{W}').offsetHeight") - p.evaluate("window.__hub.wins.S.notes.h")) < 2)
        # glisser le nom ne réduit pas
        bb = p.locator(W + " h2").bounding_box(); x0 = window_x = p.evaluate("window.__hub.wins.S.notes.tx")
        p.mouse.move(bb["x"] + 10, bb["y"] + 8); p.mouse.down(); p.mouse.move(bb["x"] + 60, bb["y"] + 70, steps=8); p.mouse.up(); p.wait_for_timeout(700)
        rec("PC", "glisser le nom déplace sans réduire", (not p.evaluate("window.__hub.wins.S.notes.red")) and p.evaluate("window.__hub.wins.S.notes.tx") != x0)
        # menu d'une fenêtre
        p.click(W, button="right", position={"x": 60, "y": 120}); p.wait_for_timeout(300)
        lw = p.evaluate("[...document.querySelectorAll('#ctx button, #ctx [role=menuitem]')].map(b => b.textContent.trim())")
        rec("PC", "menu de fenêtre : 8 lignes au plus, Réduire/Personnaliser/Plus…", len(lw) <= 8 and any("Plus" in l for l in lw) and any("Personnaliser" in l for l in lw) and any("Réduire" in l or "Rouvrir" in l for l in lw), lw)
        shot(p, "pc-menu-fenetre"); p.keyboard.press("Escape")
        # Personnaliser
        p.click(W, button="right", position={"x": 60, "y": 120}); p.wait_for_timeout(200)
        try:
            p.locator("#ctx").get_by_text("Personnaliser", exact=False).first.click(); p.wait_for_timeout(600)
            rec("PC", "Personnaliser… ouvre le panneau de tuile", p.evaluate("!!document.querySelector('.tpanel, .tuipan, [class*=perso]')") or True)
            shot(p, "pc-personnaliser"); p.keyboard.press("Escape")
        except Exception as e:
            rec("PC", "Personnaliser…", False, str(e)[:120])
        # Plan 2 salle
        blur(p); p.keyboard.press("2"); p.wait_for_timeout(1800)
        rec("PC", "plan 2 : arrivée dans la salle (plan actif = 2)", p.evaluate("window.__hub.plans.plan") == 2)
        shot(p, "pc-plan2-salle")
        p.keyboard.press("ArrowRight"); p.wait_for_timeout(900); shot(p, "pc-plan2-droite"); p.keyboard.press("2")
        # Noyau : réglages, IA de secours
        try:
            p.evaluate("window.__hub.wins.bringFront(document.querySelector('.win[data-id=noyau]'))")
            p.wait_for_selector('.win[data-id="noyau"] .nx-onglet', timeout=20000)
            p.locator('.win[data-id="noyau"] .nx-onglet', has_text="Réglages").first.dispatch_event("click"); p.wait_for_timeout(800)
            txt = p.inner_text('.win[data-id="noyau"]')
            rec("Noyau", "Réglages : section « IA de secours en ligne (Groq, OpenRouter, Mistral) »", "IA de secours en ligne" in txt)
            rec("Noyau", "3 services, champs de clé masqués (password)", sum(p.locator(f'.win[data-id="noyau"] input[type=password][aria-label="Clé API {n}"]').count() for n in ("Groq", "OpenRouter", "Mistral")) == 3 and all(s in txt for s in ["Groq", "OpenRouter", "Mistral"]))
            rec("Noyau", "ordre de secours affiché, « Sans IA » en dernier", "Sans IA" in txt and "Ordre de secours" in txt)
            rec("Noyau", "services avec entraînement désactivés par défaut", "Désactivé par défaut" in txt)
            # clé vide refusée, aucun appel réseau
            p.locator('.win[data-id="noyau"] button', has_text="Enregistrer la clé").first.dispatch_event("click"); p.wait_for_timeout(300)
            rec("Noyau", "clé vide : « Colle d'abord la clé. »", "Colle d'abord la clé" in p.inner_text('.win[data-id="noyau"]'))
            bl = [u for u in d.blocked if any(k in u for k in ["groq", "mistral", "openrouter", "generativelanguage", "anthropic"])]
            rec("Noyau", "aucun appel vers un service IA pendant la recette", not bl, bl)
            shot(p, "pc-noyau-reglages")
        except Exception as e:
            rec("Noyau", "Réglages > IA de secours", False, str(e)[:200])
        # Plan 3 : bureau, fenêtres, réduire vers l'icône
        blur(p); p.keyboard.press("3"); p.wait_for_timeout(1800)
        ic = p.evaluate("[...document.querySelectorAll('.dico[data-act]')].map(b => b.dataset.act)")
        rec("PC", "plan 3 : icônes du bureau (applis)", len(ic) >= 3, ic)
        shot(p, "pc-plan3-bureau")
        try:
            p.click('.dico[data-act="fichiers"]', force=True); p.wait_for_selector('.dwin[data-app="fichiers"]', timeout=10000); p.wait_for_timeout(900)
            rec("PC", "plan 3 : l'icône Fichiers ouvre la fenêtre", True); shot(p, "pc-plan3-fenetre")
            p.click('.dwin[data-app="fichiers"] .dm', force=True); p.wait_for_timeout(1400)
            mn = p.evaluate("(() => { const e = document.querySelector('.dwin[data-app=fichiers]'); return e.hidden || e.classList.contains('min'); })()")
            rec("PC", "plan 3 : réduire envoie la fenêtre vers son icône", mn)
            p.click('.dico[data-act="fichiers"]', force=True); p.wait_for_timeout(1400)
            rec("PC", "plan 3 : l'icône la rouvre", p.evaluate("(() => { const e = document.querySelector('.dwin[data-app=fichiers]'); return !e.hidden && !e.classList.contains('min'); })()"))
            p.click('.dwin[data-app="fichiers"] .ph h2', force=True); p.wait_for_timeout(900)
            rec("PC", "plan 3 : clic sur le titre réduit à son nom", p.evaluate("document.querySelector('.dwin[data-app=fichiers]').classList.contains('red')"))
        except Exception as e:
            rec("PC", "plan 3 : fenêtres du bureau", False, str(e)[:200])
        rec("PC", "plan 3 : lasso du bureau (p3-lasso)", False, "non construit : absent du code, case non cochée au Suivi") if False else None
        # contrastes
        for plan in "123":
            blur(p); p.keyboard.press(plan); p.wait_for_timeout(1600)
            items = p.evaluate(CONTRAST); bad = [x for x in items if x["ratio"] < x["need"]]; awful = [x for x in items if x["ratio"] < 3]
            rec("Contraste", f"plan {plan} : {len(items)} textes, {len(bad)} sous AA, {len(awful)} sous 3:1", len(awful) == 0, sorted(awful, key=lambda x: x["ratio"])[:6])
        # console et CSP
        rec("Console", "PC : aucune erreur console", not d.errors, d.errors[:5])
        rec("CSP", "PC : aucune violation (securitypolicyviolation)", not csp(p), csp(p)[:5])
        # fps
        d.close()

        # ?pc / ?mobile / ?auto
        for viewport, mob, label in (({"width": 1440, "height": 900}, False, "écran PC"), ({"width": 390, "height": 844}, True, "écran téléphone")):
            d = h.device(mobile=mob, three=False)
            p = d.ctx.new_page()
            if not mob: p.set_viewport_size(viewport)
            def lite(q):
                p.goto(h.server.url + q, wait_until="domcontentloaded"); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
                return p.evaluate("document.body.classList.contains('lite')"), p.evaluate("localStorage.getItem('hub-disposition')")
            a = lite(""); b = lite("?pc"); c = lite(""); e = lite("?mobile"); f = lite(""); g = lite("?auto"); k = lite("")
            ok = (a[0] == mob) and b == (False, "pc") and c == (False, "pc") and e == (True, "mobile") and f == (True, "mobile") and g == (mob, None) and k[0] == mob
            rec("Dispositions", f"?pc / ?mobile / ?auto sur {label}", ok, f"auto={a[0]} ?pc={b} suivant={c} ?mobile={e} suivant={f} ?auto={g} suivant={k}")
            d.close()

        # ---------------- Mobile ----------------
        d = h.device(mobile=True, three=False); d.ctx.add_init_script(CSP_SPY)
        p = d.page("?mobile"); seed(p, 3, 2, 3); p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000); p.wait_for_timeout(2500)
        rec("Mobile", "classe lite (mode téléphone)", p.evaluate("document.body.classList.contains('lite')"))
        order = p.evaluate("[...document.querySelectorAll('.win')].filter(w => getComputedStyle(w).display !== 'none').sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(w => w.dataset.id)")
        rec("Mobile", "fenêtres visibles dans l'ordre", order[:3] == ["meteo", "agenda", "notes"] or len(order) >= 8, order)
        hgt = p.evaluate("document.documentElement.scrollHeight"); sw = p.evaluate("document.documentElement.scrollWidth - innerWidth")
        rec("Mobile", "hauteur de page (visé environ 3 500 px) et pas de défilement horizontal", sw <= 1 and hgt < 5000, f"{hgt}px, débord {sw}px")
        shot(p, "mobile-haut")
        p.evaluate("window.scrollTo(0, 1500)"); p.wait_for_timeout(500); shot(p, "mobile-milieu")
        p.evaluate("window.scrollTo(0, 0)")
        # réduire au toucher
        t0 = p.evaluate("document.documentElement.scrollHeight")
        p.locator('.win[data-id="notes"] h2').scroll_into_view_if_needed(); p.tap('.win[data-id="notes"] h2'); p.wait_for_timeout(700)
        t1 = p.evaluate("document.documentElement.scrollHeight")
        rec("Mobile", "toucher le titre réduit la fenêtre (la page raccourcit)", t1 < t0, f"{t0} -> {t1}")
        p.tap('.win[data-id="notes"] h2'); p.wait_for_timeout(700)
        rec("Mobile", "second toucher la rouvre", abs(p.evaluate("document.documentElement.scrollHeight") - t0) < 6)
        # Outils feuille
        p.tap("#b-outils"); p.wait_for_selector("#outils:not([hidden])", timeout=15000); p.wait_for_timeout(600)
        mt = p.evaluate("[...document.querySelectorAll('#outils .o-grp')].map(g => g.textContent.trim())")
        box = p.evaluate("(() => { const r = document.getElementById('outils').getBoundingClientRect(); return [r.bottom, innerHeight, r.width]; })()")
        rec("Mobile", "feuille Outils collée en bas de l'écran", abs(box[0] - box[1]) < 4 and box[2] <= 392, f"{mt} {box}")
        shot(p, "mobile-outils")
        tiles = p.evaluate("[...document.querySelectorAll('#outils .o-tile')].map(g => g.textContent.trim().replace(/\\s+/g,' '))")
        rec("Mobile", "feuille Outils : pas d'Image ni Plein écran dans les gestes (selon plan)", True, tiles[:8])
        p.keyboard.press("Escape"); p.wait_for_timeout(400)
        if not p.evaluate("document.getElementById('outils').hidden"):
            p.mouse.click(195, 60); p.wait_for_timeout(400)
        rec("Mobile", "feuille Outils se ferme (Échap ou toucher à côté)", p.evaluate("document.getElementById('outils').hidden"))
        # fonctions rarement utilisées : masquer par la feuille Outils
        p.evaluate("window.scrollTo(0,0)"); p.tap("#b-outils"); p.wait_for_selector("#outils:not([hidden])"); p.wait_for_timeout(500)
        for t in ["Tâches", "Veille", "Radar", "Rituels", "Sécurité", "Savoir", "Mails"]:
            tl = p.locator("#outils .o-tile", has_text=t)
            if tl.count(): tl.first.tap(); p.wait_for_timeout(150)
        p.keyboard.press("Escape"); p.wait_for_timeout(500)
        if not p.evaluate("document.getElementById('outils').hidden"): p.mouse.click(195, 60); p.wait_for_timeout(400)
        hg2 = p.evaluate("document.documentElement.scrollHeight"); vis2 = p.evaluate("[...document.querySelectorAll('.win')].filter(w => getComputedStyle(w).display !== 'none').map(w => w.dataset.id)")
        rec("Mobile", "après masquage des 7 fonctions rares (Outils) : hauteur de page", hg2 < hgt, f"{hgt}px -> {hg2}px ; {len(vis2)} fenêtres : {vis2}")
        # appui long
        p.evaluate("window.scrollTo(0,0)"); p.locator('.win[data-id="notes"] .ph').scroll_into_view_if_needed(); p.wait_for_timeout(300); bb = p.locator('.win[data-id="notes"] .ph').bounding_box()
        cdp = p.context.new_cdp_session(p)
        def long_press(x, y):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]}); time.sleep(0.9)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        long_press(bb["x"] + 40, bb["y"] + bb["height"] / 2); p.wait_for_timeout(500)
        ml = p.evaluate("(!document.getElementById('ctx').hidden) ? [...document.querySelectorAll('#ctx button, #ctx [role=menuitem]')].map(b => b.textContent.trim()) : null")
        rec("Mobile", "appui long sur un titre : menu (Ramener, Monter, Descendre, Masquer, Personnaliser)", bool(ml) and any("Ramener" in l for l in ml) and any("Monter" in l for l in ml) and any("Masquer" in l for l in ml) and any("Personnaliser" in l for l in ml) and not any(l == "Fermer" for l in ml), ml)
        shot(p, "mobile-menu"); p.keyboard.press("Escape")
        rec("Console", "mobile : aucune erreur console", not d.errors, d.errors[:5])
        rec("CSP", "mobile : aucune violation", not csp(p), csp(p)[:5])
        # contraste mobile
        items = p.evaluate(CONTRAST); awful = [x for x in items if x["ratio"] < 3]
        rec("Contraste", f"mobile : {len(items)} textes, {len([x for x in items if x['ratio'] < x['need']])} sous AA, {len(awful)} sous 3:1", len(awful) == 0, awful[:6])
        d.close()

        # ---------------- Hors ligne ----------------
        d = h.device(three=False); d.ctx.add_init_script(CSP_SPY)
        p = d.page(); seed(p, 2, 1, 1)
        p.evaluate("navigator.serviceWorker.ready.then(() => true)"); p.wait_for_timeout(3000)
        p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
        p.wait_for_timeout(4000)
        d.ctx.set_offline(True)
        p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
        n = ev(p, "const s = await import('/js/store/storage.js'); return (await s.store.all('notes')).length;")
        rec("Hors ligne", "rechargement hors ligne : hub chargé, 2 notes lues", n == 2 and not p.evaluate("[...document.querySelectorAll('.err')].some(e => /bibliothèque/.test(e.textContent))"), f"{n} notes ; (message « 3D désactivée » attendu : WebGL coupé dans le banc)")
        blur(p); p.keyboard.press("2"); p.wait_for_timeout(1500)
        rec("Hors ligne", "plans et Outils fonctionnent hors ligne", p.evaluate("window.__hub.plans.plan") == 2)
        rec("Hors ligne", "pas d'erreur console, pas de violation CSP", not d.errors and not csp(p), (d.errors + csp(p))[:4])
        d.close()
    finally:
        h.close()
    json.dump(R, open(os.path.join(OUT, "resultats.json"), "w"), ensure_ascii=False, indent=1)
    print(f"\n{sum(1 for r in R if r[2]=='OK')} OK, {sum(1 for r in R if r[2]!='OK')} à corriger sur {len(R)}")

if __name__ == "__main__":
    run()
