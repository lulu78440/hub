"""Recette 7.38 (poste Banc de test) : ce qui est arrivé depuis 7.35.0 — plan 3 complet (fenêtres, lasso, écran en direct,
commandes pour l'orbe), p3-mobile, lot 3 du Noyau. Playwright/Chromium, PC 1440x900 et téléphone 390x844.
Lancement : python3 docs/banc-essai/recette2/recette.py   (depuis la racine du dépôt).
Données factices, réseau extérieur bloqué par le banc, aucune clé. Le partage d'écran est SIMULÉ (canvas), jamais un vrai écran."""
import json, os, sys, traceback
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "tests"))
from hubtest import Hub, seed, ev
from t2_fonctions import make_mock

OUT = os.path.dirname(os.path.abspath(__file__))
R = []
def rec(zone, point, ok, detail=""):
    st = "OK" if ok is True else ("NON VÉRIFIABLE" if ok is None else ("ANOMALIE MINEURE" if ok == "mineure" else "A CORRIGER"))
    R.append({"zone": zone, "point": point, "statut": st, "detail": str(detail)[:400]})
    print(f"{st:15} {zone} · {point}" + (f" — {detail}" if detail not in ("", None) else ""), flush=True)

def essai(zone, point, fn):
    try:
        r = fn()
        ok, det = (r if isinstance(r, tuple) else (bool(r), ""))
        rec(zone, point, ok, det)
    except Exception as e:  # noqa: BLE001
        rec(zone, point, False, "erreur du déroulé : " + type(e).__name__ + ": " + str(e).split("\n")[0][:300])

SPY = """(() => {
  window.__csp = []; addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
  window.__rec = 0; const MR = window.MediaRecorder; if (MR) window.MediaRecorder = function (...a) { window.__rec++; return new MR(...a); };
  window.__gdm = 0; window.__tracks = [];
  if (navigator.mediaDevices) navigator.mediaDevices.getDisplayMedia = async () => {
    window.__gdm++; const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d'); g.fillStyle = '#123'; g.fillRect(0, 0, 320, 180);
    const s = c.captureStream(5); window.__tracks.push(...s.getTracks()); return s; };
})()"""

def shot(p, name): p.screenshot(path=os.path.join(OUT, name + ".png"))
def ready(p): p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
def blur(p): p.evaluate("document.activeElement && document.activeElement.blur()")
def cmd(p, nom, params=None): return ev(p, "return await window.__hub.commandes.executer(arg[0], arg[1]);", [nom, params or {}])

def run():
    h = Hub(); h.mock = make_mock()
    try:
        # ===================== PC =====================
        d = h.device(three=False); d.ctx.add_init_script(SPY)
        p = d.page(); p.set_viewport_size({"width": 1440, "height": 900}); seed(p, 3, 2, 3); p.reload(); ready(p); p.wait_for_timeout(2000)
        essai("PC", "version 7.38.x affichée", lambda: ("7.38" in (p.evaluate("(document.getElementById('d-version')||{}).textContent") or ""), p.evaluate("(document.getElementById('d-version')||{}).textContent")))
        essai("PC", "commandes pour l'orbe exposées (window.__hub.commandes)", lambda: p.evaluate("!!(window.__hub.commandes && window.__hub.commandes.executer)"))

        # ---------- Plan 3 : bureau ----------
        # Une alerte de veille (site factice en panne) s'affiche sur le bureau : Lucien la ferme avec « OK » avant de travailler.
        alerte = p.evaluate("[...document.querySelectorAll('#alerts button')].map(b => b.textContent.trim())")
        for _ in range(4):
            b = p.locator("#alerts button", has_text="OK").first
            if not b.count(): break
            b.click(); p.wait_for_timeout(400)
        blur(p); p.keyboard.press("3"); p.wait_for_timeout(1500)
        icones = p.evaluate("[...document.querySelectorAll('.dico')].filter(b => b.offsetParent).map(b => (b.dataset.act || b.textContent.trim()))")
        essai("Plan 3", "bureau : icônes Fichiers, Ce PC, Internet, Mails, Écran", lambda: (all(any(k in str(i).lower() for i in icones) for k in ["fichiers", "pc", "internet", "mails", "direct"]), icones))
        shot(p, "pc-plan3")

        # ---------- p3-fenetres ----------
        def fenetres():
            cmd(p, "ouvrir_appli", {"app": "fichiers"}); p.wait_for_timeout(500); cmd(p, "ouvrir_appli", {"app": "internet"}); p.wait_for_timeout(700)
            st = p.evaluate("[...document.querySelectorAll('.dwin')].filter(w => !w.hidden).map(w => [w.dataset.app, w.classList.contains('actif')])")
            actifs = [a for a, on in st if on]
            return len(st) >= 2 and actifs == ["internet"], st
        essai("Plan 3", "deux applis ouvertes : une seule active (pile de focus)", fenetres)
        def echap():
            p.click('.dwin[data-app="internet"] .ph', position={"x": 60, "y": 10}); p.keyboard.press("Escape"); p.wait_for_timeout(1200)
            return p.evaluate("(() => { const w = document.querySelector('.dwin[data-app=\"internet\"]'); return !!w && (w.dataset.m === '1') && (w.hidden || w.classList.contains('min')); })()")
        essai("Plan 3", "Échap envoie la fenêtre active vers son icône", echap)
        def rouvrir():
            p.click('.dico[data-act="internet"]'); p.wait_for_timeout(900)
            return p.evaluate("(() => { const w = document.querySelector('.dwin[data-app=\"internet\"]'); return !!w && !w.hidden && w.classList.contains('actif'); })()")
        essai("Plan 3", "l'icône rouvre la fenêtre au premier plan", rouvrir)
        def garde():
            cmd(p, "ouvrir_appli", {"app": "pc"}); p.wait_for_timeout(500)
            p.keyboard.press("Escape"); p.wait_for_timeout(800)
            avant = p.evaluate("localStorage.getItem('hub-bureau-fen-v1')")
            p.reload(); ready(p); p.wait_for_timeout(1500); blur(p); p.keyboard.press("3"); p.wait_for_timeout(1300)
            ouvertes = p.evaluate("[...document.querySelectorAll('.dwin')].map(w => [w.dataset.app, w.hidden])")
            return bool(avant) and len(ouvertes) >= 1, {"cle": bool(avant), "apres": ouvertes}
        essai("Plan 3", "état des fenêtres gardé après rechargement (hub-bureau-fen-v1)", garde)
        shot(p, "pc-plan3-fenetres")

        # ---------- p3-lasso ----------
        def lasso():
            for k in ["fichiers", "internet"]: cmd(p, "fermer_appli", {"app": k})
            cmd(p, "fermer_appli", {"app": "pc"}); p.wait_for_timeout(600)
            boxes = p.evaluate("[...document.querySelectorAll('.dico')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
            x0 = min(b[0] for b in boxes) - 25; y0 = min(b[1] for b in boxes) - 25; x1 = max(b[2] for b in boxes) + 25; y1 = max(b[3] for b in boxes) + 25
            sous = p.evaluate("(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName).toString() : null; })", [x0, y0])
            p.mouse.move(x0, y0); p.mouse.down(); p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=6); p.mouse.move(x1, y1, steps=6); p.mouse.up(); p.wait_for_timeout(400)
            n = p.evaluate("document.querySelectorAll('.dico.sel, .dico[aria-selected=\"true\"]').length")
            return n == len(boxes), f"{n} choisies sur {len(boxes)} (rectangle {int(x0)},{int(y0)} → {int(x1)},{int(y1)} ; sous le départ : {sous})"
        essai("Plan 3", "lasso sur le fond choisit les icônes", lasso)
        def echap_desel():
            p.keyboard.press("Escape"); p.wait_for_timeout(300)
            return p.evaluate("document.querySelectorAll('.dico.sel, .dico[aria-selected=\"true\"]').length") == 0
        essai("Plan 3", "Échap désélectionne", echap_desel)
        def ctrl_a():
            p.focus(".dico"); p.keyboard.press("Control+a"); p.wait_for_timeout(300)
            n = p.evaluate("document.querySelectorAll('.dico.sel, .dico[aria-selected=\"true\"]').length"); tot = p.evaluate("[...document.querySelectorAll('.dico')].filter(b => b.offsetParent).length")
            return n == tot and n > 0, f"{n}/{tot}"
        essai("Plan 3", "Ctrl + A choisit toutes les icônes", ctrl_a)
        def groupe():
            b = p.locator(".dico").first; bb = b.bounding_box()
            avant = p.evaluate("[...document.querySelectorAll('.dico')].map(b => b.getBoundingClientRect().left)")
            p.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); p.mouse.down(); p.mouse.move(bb["x"] + 80, bb["y"] + 60, steps=8); p.mouse.up(); p.wait_for_timeout(500)
            apres = p.evaluate("[...document.querySelectorAll('.dico')].map(b => b.getBoundingClientRect().left)")
            bouges = sum(1 for a, z in zip(avant, apres) if abs(a - z) > 20)
            return bouges == len(avant) and bouges > 1, f"{bouges}/{len(avant)} icônes déplacées"
        essai("Plan 3", "glisser une icône choisie déplace tout le groupe", groupe)
        def menu_groupe():
            b = p.locator(".dico").first; b.click(button="right"); p.wait_for_timeout(400)
            L = p.evaluate("[...document.querySelectorAll('#ctx button, #ctx [role=menuitem]')].map(x => x.textContent.trim())")
            p.keyboard.press("Escape")
            return any("align" in l.lower() for l in L) and any("retirer" in l.lower() for l in L), L
        essai("Plan 3", "clic droit sur une icône choisie : menu de groupe (aligner, retirer…)", menu_groupe)
        shot(p, "pc-plan3-lasso")
        p.keyboard.press("Escape"); p.mouse.click(700, 760); p.wait_for_timeout(300)

        # ---------- p3-direct (partage SIMULÉ) ----------
        essai("Écran en direct", "coupé par défaut (aucun partage demandé au chargement)", lambda: (p.evaluate("window.__gdm") == 0 and not p.evaluate("document.body.classList.contains('direct-on')"), p.evaluate("window.__gdm")))
        def demarrer():
            # executer attend la confirmation : on lance sans attendre, on lit la fenêtre, puis on clique Autoriser
            p.evaluate("window.__pr = window.__hub.commandes.executer('ecran_direct_demarrer', {}); 0")
            p.wait_for_selector(".cmd-confirm", timeout=5000)
            foc = p.evaluate("document.activeElement && document.activeElement.textContent")
            p.click(".cmd-confirm .cc-yes"); p.wait_for_timeout(800)
            res = p.evaluate("window.__pr")
            on = p.evaluate("document.body.classList.contains('direct-on')"); chip = p.evaluate("!!document.querySelector('.live-stop') && !document.querySelector('.live-stop').hidden")
            return res.get("ok") and on and chip and foc == "Refuser", {"bouton par défaut": foc, "res": res, "pastille": chip}
        essai("Écran en direct", "commande de l'orbe : confirmation (Refuser par défaut), puis partage et pastille « Couper »", demarrer)
        def pastille_partout():
            vues = []
            for n in "12":
                blur(p); p.keyboard.press(n); p.wait_for_timeout(900)
                vues.append(p.evaluate("(() => { const c = document.querySelector('.live-stop'); if (!c || c.hidden) return false; const r = c.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()"))
            blur(p); p.keyboard.press("3"); p.wait_for_timeout(900)
            return all(vues), vues
        essai("Écran en direct", "pastille « Couper » visible aux plans 1 et 2", pastille_partout)
        essai("Écran en direct", "flux ni enregistré (MediaRecorder) ni envoyé (aucune requête sortante)", lambda: (p.evaluate("window.__rec") == 0 and not [u for u in d.blocked if "localhost" not in u and "127.0.0.1" not in u and "open-meteo" not in u], {"MediaRecorder": p.evaluate("window.__rec"), "bloquees": d.blocked[-5:]}))
        def fin_navigateur():
            p.evaluate("window.__tracks.forEach(t => { t.stop(); t.dispatchEvent(new Event('ended')); if (t.onended) t.onended(); })"); p.wait_for_timeout(500)
            return not p.evaluate("document.body.classList.contains('direct-on')") and p.evaluate("document.querySelector('.live-stop').hidden")
        essai("Écran en direct", "arrêt depuis la barre du navigateur (piste terminée) : partage coupé, pastille retirée", fin_navigateur)
        def fermer_coupe():
            cmd(p, "ouvrir_appli", {"app": "direct"}); p.wait_for_timeout(500)
            p.evaluate("window.__pr = window.__hub.commandes.executer('ecran_direct_demarrer', {}); 0"); p.wait_for_selector(".cmd-confirm", timeout=5000); p.click(".cmd-confirm .cc-yes"); p.wait_for_timeout(700)
            cmd(p, "fermer_appli", {"app": "direct"}); p.wait_for_timeout(500)
            live = p.evaluate("window.__tracks.filter(t => t.readyState === 'live').length")
            return live == 0 and not p.evaluate("document.body.classList.contains('direct-on')"), f"pistes encore actives : {live}"
        essai("Écran en direct", "fermer la fenêtre « Écran » ouverte coupe le partage", fermer_coupe)
        def fermer_sans_fenetre():
            p.evaluate("window.__pr = window.__hub.commandes.executer('ecran_direct_demarrer', {}); 0"); p.wait_for_selector(".cmd-confirm", timeout=5000); p.click(".cmd-confirm .cc-yes"); p.wait_for_timeout(700)
            fen = p.evaluate("!!document.querySelector('.dwin[data-app=\"direct\"]')")
            r = cmd(p, "fermer_appli", {"app": "direct"}); p.wait_for_timeout(400)
            actif = p.evaluate("document.body.classList.contains('direct-on')")
            p.click(".live-stop"); p.wait_for_timeout(400)
            return ("mineure" if actif else True), f"fenêtre ouverte au démarrage par la commande : {fen} ; fermer_appli → « {r.get('message')} » ; partage encore actif : {actif}"
        essai("Écran en direct", "commande fermer_appli « direct » alors que la fenêtre n'est pas ouverte : le partage reste-t-il actif ?", fermer_sans_fenetre)
        def refus():
            n0 = p.evaluate("window.__gdm")
            p.evaluate("window.__pr = window.__hub.commandes.executer('ecran_direct_demarrer', {}); 0"); p.wait_for_selector(".cmd-confirm", timeout=5000); p.keyboard.press("Enter"); p.wait_for_timeout(500)
            res = p.evaluate("window.__pr")
            return (not res.get("ok")) and p.evaluate("window.__gdm") == n0, res
        essai("Écran en direct", "Entrée sur la confirmation = Refuser (aucun partage demandé)", refus)

        # ---------- p3-ia : commandes ----------
        def liste():
            L = p.evaluate("window.__hub.commandes.liste()")
            noms = [c["nom"] for c in L]; conf = sorted(c["nom"] for c in L if c["permission"] == "confirmation"); indispo = sorted(c["nom"] for c in L if not c["disponible"])
            return len(L) == 11 and conf == ["ecran_direct_demarrer", "jeu_lancer", "retirer_icone"] and indispo == ["catalogue_ouvrir", "jeu_lancer"], {"n": len(L), "confirmation": conf, "indisponibles": indispo}
        essai("Commandes", "11 commandes ; confirmation pour retirer une icône, démarrer l'écran, lancer un jeu ; jeux indisponibles", liste)
        CAS = [("commande inconnue", "supprimer_tout", {}), ("paramètre hors liste", "ouvrir_appli", {"app": "cmd.exe"}), ("paramètre en trop", "aller_plan", {"plan": 2, "force": True}),
               ("injection dans un paramètre", "poser_icone", {"cle": "<img src=x onerror=alert(1)>"}), ("plan hors bornes", "aller_plan", {"plan": 9}),
               ("paramètres en liste", "aller_plan", [2]), ("jeu réservé", "jeu_lancer", {"jeu": "x"}), ("catalogue réservé", "catalogue_ouvrir", {})]
        def refus_cas():
            out = {k: cmd(p, n, pr).get("ok") for k, n, pr in CAS}
            return not any(out.values()) and p.evaluate("document.querySelectorAll('img[src=x]').length") == 0 and not p.evaluate("!!document.querySelector('.cmd-confirm')"), out
        essai("Commandes", "8 appels piégés ou hors contrat refusés sans confirmation ni exécution", refus_cas)
        def libres():
            r1 = cmd(p, "aller_plan", {"plan": 1}); p.wait_for_timeout(900); a = p.evaluate("window.__hub.plans.plan")
            r2 = cmd(p, "etat_bureau"); r3 = cmd(p, "aller_plan", {"plan": 3}); p.wait_for_timeout(900)
            e = (r2.get("etat") or {})
            return r1["ok"] and a == 1 and r2["ok"] and "ecran_direct" in e and isinstance(e.get("icones"), list) and r3["ok"], {"plan": a, "etat": list(e.keys())}
        essai("Commandes", "commandes libres (aller_plan, etat_bureau) : exécutées, l'état ne montre jamais le contenu de l'écran", libres)
        def retirer_refuse():
            k = p.evaluate("window.__hub.commandes.liste().find(c => c.nom === 'retirer_icone').parametres.cle[0]")
            n0 = len(cmd(p, "etat_bureau")["etat"]["icones"])
            p.evaluate("window.__pr = window.__hub.commandes.executer('retirer_icone', {cle: %s}); 0" % json.dumps(k)); p.wait_for_selector(".cmd-confirm", timeout=5000)
            deux = p.evaluate("window.__hub.commandes.executer('ranger_icones', {})")   # une libre pendant l'attente : passe
            p.click(".cmd-confirm .cc-no"); p.wait_for_timeout(400); res = p.evaluate("window.__pr")
            n1 = len(cmd(p, "etat_bureau")["etat"]["icones"])
            return res.get("refuse") and n0 == n1, {"res": res, "icones": [n0, n1]}
        essai("Commandes", "retirer une icône : refusé par Lucien = rien retiré", retirer_refuse)
        def journal():
            J = p.evaluate("window.__hub.commandes.journal()")
            return len(J) >= 10 and all("nom" in j and "ok" in j for j in J), len(J)
        essai("Commandes", "chaque appel est journalisé", journal)
        def evenement():
            return ev(p, "return await new Promise(r => document.dispatchEvent(new CustomEvent('hub:commande', { detail: { nom: 'aller_plan', params: { plan: 3 }, repondre: r } })));").get("ok")
        essai("Commandes", "accès par l'événement hub:commande", evenement)

        # ---------- Lot 3 du Noyau ----------
        def lot3():
            return ev(p, """const out = {};
              for (const m of ['registre','jeux','donnees','transformer','modules','execution']) { try { const x = await import('/js/noyau/' + m + '.js'); out[m] = Object.keys(x).length; } catch (e) { out[m] = 'ERREUR ' + e.message; } }
              return out;""")
        essai("Noyau lot 3", "les 6 modules se chargent dans le hub", lambda: (lambda o: (all(isinstance(v, int) and v > 0 for v in o.values()), o))(lot3()))
        def registre():
            r = ev(p, """const r = await import('/js/noyau/registre.js'), o = await import('/js/noyau/outils.js');
              const cat = (o.creerCatalogue ? o.creerCatalogue({}) : []);
              const c = r.controlerCatalogue ? r.controlerCatalogue(cat, o.OUTILS_VALIDES || null) : { ok: 'sans controlerCatalogue' };
              return { ok: c.ok, n: cat.length, pb: (c.problemes || []).slice(0, 5), hotes: r.hotesDuCatalogue ? r.hotesDuCatalogue(cat) : null };""")
            return r.get("ok") is True, r
        essai("Noyau lot 3", "catalogue d'outils contrôlé par le registre (aucun problème)", registre)
        def noyau_ouvert():
            n0 = len(d.errors); blur(p); p.keyboard.press("2"); p.wait_for_timeout(1200)
            ok = p.evaluate("!!document.querySelector('.win[data-id=\"noyau\"]')")
            return ok and len(d.errors) == n0, d.errors[n0:][:3]
        essai("Noyau lot 3", "fenêtre du Noyau présente, sans erreur", noyau_ouvert)

        essai("PC", "aucune erreur console sur tout le parcours PC", lambda: (not d.errors, d.errors[:5]))
        essai("PC", "aucune violation CSP sur tout le parcours PC", lambda: (not p.evaluate("window.__csp"), p.evaluate("window.__csp")[:5]))

        # ---------- Hors ligne (cache du service worker) ----------
        def hors_ligne():
            p.evaluate("navigator.serviceWorker.ready.then(() => true)"); p.wait_for_timeout(1500); p.reload(); ready(p)
            p.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller", timeout=30000)
            p.wait_for_timeout(1500)
            manquants = ev(p, """const k = await caches.keys(); const c = await caches.open(k.find(x => x.startsWith('hub-')) || k[0]);
              const L = ['registre','jeux','donnees','transformer','modules','execution'].map(m => '/js/noyau/' + m + '.js').concat(['/js/ui/commandes.js','/js/ui/direct.js']);
              const out = []; for (const u of L) if (!(await c.match(u, { ignoreSearch: true }))) out.push(u); return out;""")
            d.ctx.set_offline(True); p.reload(); ready(p); p.wait_for_timeout(1500)
            charge = lot3(); d.ctx.set_offline(False)
            return not manquants and all(isinstance(v, int) for v in charge.values()), {"absents du cache": manquants, "hors ligne": charge}
        essai("Hors ligne", "modules du lot 3, commandes et écran en direct dans le cache ; chargés hors ligne", hors_ligne)
        d.close()

        # ===================== Téléphone (p3-mobile) =====================
        m = h.device(mobile=True); m.ctx.add_init_script(SPY)
        liens = [{"id": "u1", "k": "url", "u": "https://exemple.test/a", "n": "Lien factice A", "x": .2, "y": .2},
                 {"id": "u2", "k": "url", "u": "http://exemple.test/b", "n": "Lien http", "x": .3, "y": .2},
                 {"id": "u3", "k": "url", "u": "javascript:window.__pwn=1", "n": "Lien piégé", "x": .4, "y": .2},
                 {"id": "u4", "k": "url", "u": "https://exemple.test/c", "n": "<img src=x onerror=window.__pwn=1>", "x": .5, "y": .2}] + \
                [{"id": f"v{i}", "k": "url", "u": f"https://exemple.test/{i}", "n": f"Lien {i}", "x": .1, "y": .5} for i in range(14)]
        m.ctx.add_init_script("localStorage.setItem('hub-bureau-v1', %s)" % json.dumps(json.dumps({"icons": liens})))
        q = m.page(); seed(q, 3, 2, 3); q.reload(); ready(q); q.wait_for_timeout(1800)
        essai("Téléphone", "mode téléphone, pas de défilement horizontal", lambda: (q.evaluate("document.body.classList.contains('lite') || document.body.classList.contains('mob')") and q.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), q.evaluate("[document.documentElement.scrollWidth, innerWidth]")))
        def outils_mob():
            q.click("#b-outils"); q.wait_for_selector("#outils:not([hidden])", timeout=15000); q.wait_for_timeout(500)
            g = q.evaluate("[...document.querySelectorAll('#outils .o-grp')].map(x => x.textContent.trim())")
            return bool(g) and g[0].startswith("Applis"), g[:4]
        essai("Téléphone", "feuille Outils : groupe « Applis » en tête", outils_mob)
        def tuiles_applis():
            T = q.evaluate("(() => { const g = [...document.querySelectorAll('#outils .o-grp')][0]; let s = g.nextElementSibling, out = []; while (s && !s.classList.contains('o-grp')) { out.push(...[...s.querySelectorAll('.o-tile')].map(t => t.textContent.trim().replace(/\\s+/g,' '))); if (s.classList.contains('o-tile')) out.push(s.textContent.trim()); s = s.nextElementSibling; } return out.length ? out : [...document.querySelectorAll('#outils .o-tile')].slice(0, 30).map(t => t.textContent.trim().replace(/\\s+/g,' ')); })()")
            j = " | ".join(T)
            attendus = all(k in j for k in ["Internet", "Favoris", "Notes", "Musique"])
            sans_piege = "Lien http" not in j and "Lien piégé" not in j
            nb = sum(1 for t in T if "exemple.test" in t)
            return attendus and sans_piege and nb <= 12, {"liens": nb, "tuiles": T[:10]}
        essai("Téléphone", "Applis : Internet et fenêtres du hub ; liens du bureau https seulement, 12 au plus", tuiles_applis)
        essai("Téléphone", "nom de lien piégé affiché en texte, rien n'est exécuté", lambda: (not q.evaluate("!!window.__pwn") and q.evaluate("document.querySelectorAll('img[src=x]').length") == 0, ""))
        def sous_doigt():
            q.evaluate("[...document.querySelectorAll('#outils .o-tile')].find(t => /Musique/.test(t.textContent)).click()"); q.wait_for_timeout(1200)
            r = q.evaluate("(() => { const w = document.querySelector('.win[data-id=\"music\"]'); const b = w.getBoundingClientRect(); return [Math.round(b.top), innerHeight, !w.classList.contains('hid')]; })()")
            return r[2] and -10 <= r[0] < r[1], r
        essai("Téléphone", "toucher « Musique » amène la fenêtre sous le doigt", sous_doigt)
        essai("Téléphone", "pas de plan 3, pas de bureau, pas d'écran en direct sur téléphone", lambda: (q.evaluate("!([...document.querySelectorAll('.dico')].some(b => b.offsetParent)) && !(document.querySelector('#live-btn') && document.querySelector('#live-btn').offsetParent)") and q.evaluate("window.__gdm") == 0, ""))
        shot(q, "mobile-outils-applis")
        essai("Téléphone", "aucune erreur console", lambda: (not m.errors, m.errors[:5]))
        essai("Téléphone", "aucune violation CSP", lambda: (not q.evaluate("window.__csp"), q.evaluate("window.__csp")[:5]))
        m.close()
    finally:
        h.close()
    with open(os.path.join(OUT, "resultats.json"), "w", encoding="utf-8") as f:
        json.dump(R, f, ensure_ascii=False, indent=1)
    ok = sum(1 for r in R if r["statut"] == "OK"); ko = sum(1 for r in R if r["statut"] == "A CORRIGER")
    print(f"\nRecette 7.38 : {ok} OK, {ko} à corriger, {len(R) - ok - ko} non vérifiable(s), sur {len(R)} points")

if __name__ == "__main__":
    run()
