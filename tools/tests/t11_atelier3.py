"""Atelier 3 (7.41.0) : fenêtres Budget (bud-csv + bud-enveloppes) et Achats (at-garantie + at-colis).

Données factices uniquement : relevé CSV inventé, achats inventés, numéros de colis d'essai. Aucun réseau, aucune clé.
Vérifie : saisie et affichage, données gardées dans le magasin (chiffrées quand le verrouillage est actif), clavier,
noms accessibles, contraste d'au moins 4,5:1, aucun défilement horizontal (PC 1440x900 et téléphone 390x844),
aucune erreur de console ni violation de la politique de sécurité (CSP)."""
import t2_fonctions as t2
from hubtest import seed, ev, enable_vault, unlock_page, PHRASE

CSV = ("Compte;FR76 0000 0000 0000;\r\nDate;Libellé;Montant\r\n"
       "05/10/2026;VIR SALAIRE ENTREPRISE FICTIVE;1800,00\r\n"
       "12/10/2026;CB CARREFOUR MARKET 12/10 CARTE 0000XXXX;-45,30\r\n"
       "19/10/2026;CB CARREFOUR MARKET 19/10 CARTE 0000XXXX;-30,10\r\n"
       "20/10/2026;PRLV ELECTRICITE FICTIVE;-62,00\r\n")

CONTRASTE = """() => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const fond = [4, 10, 20];                                   // fond sombre des fenêtres (var(--void) et panneaux)
  const bad = [];
  document.querySelectorAll('%s .atl *').forEach((e) => {
    if (!e.offsetParent && e.tagName !== 'BODY') return;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const cs = getComputedStyle(e), c = rgb(cs.color); let bg = rgb(cs.backgroundColor);
    const a = c.length > 3 ? c[3] : 1; if (a < 1) return;
    const bgOpaque = bg.length === 3 || (bg.length === 4 && bg[3] === 1);
    const base = bgOpaque ? bg : fond;
    const L1 = lum(c), L2 = lum(base), r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (r < 4.5) bad.push(e.tagName + '.' + e.className + ' ' + r.toFixed(2) + ' « ' + e.textContent.trim().slice(0, 30) + ' »');
  });
  return bad;
}"""

SANS_NOM = """() => [...document.querySelectorAll('%s button, %s input:not([hidden]), %s select')].filter((e) => !e.closest('[hidden]') && !(e.getAttribute('aria-label') || e.textContent.trim() || (e.labels && e.labels.length) || e.getAttribute('placeholder'))).map((e) => e.outerHTML.slice(0, 80))"""

DEBORDE = """() => { const r = document.querySelector('%s .atl'); return { page: document.documentElement.scrollWidth - innerWidth, zone: r.scrollWidth - r.clientWidth }; }"""


def _n(t):
    return t.replace("\u202f", " ").replace("\u00a0", " ")


def _in(aiguille, texte):
    """Présence d'un texte sans tenir compte des majuscules (les titres sont affichés en capitales par le style du hub) ni des espaces insécables."""
    return _n(aiguille).lower() in _n(texte).lower()


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def _pret(h, mobile, vault=False):
    h.mock = t2.make_mock()
    d = h.device(three=False, mobile=mobile)
    p = d.page()
    if mobile:
        p.set_viewport_size({"width": 390, "height": 844})
    else:
        p.set_viewport_size({"width": 1440, "height": 900})
    seed(p, 1, 1, 1)
    if vault:
        enable_vault(p)
    p.reload()
    if vault:
        unlock_page(p, PHRASE)
    p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
    p.wait_for_timeout(1200)
    for _ in range(4):
        b = p.locator("#alerts button", has_text="OK").first
        if not b.count():
            break
        b.click()
        p.wait_for_timeout(300)
    return d, p


def _ouvrir(p, wid, mobile):
    if not mobile:
        # PC : la fenêtre attend au mur du plan 2 ; on l'agrandit dans l'écran du hub (même geste que le double-clic sur sa barre)
        p.evaluate("(id) => { const w = window.__hub.wins, el = w.elById(id); if (!w.S[id].max) w.toggleMax(el); }", wid)
        p.wait_for_timeout(1800)
    p.evaluate("document.querySelectorAll('.brief, .toast, .err').forEach(b => { b.hidden = true; })")
    p.locator(f'.win[data-id="{wid}"]').scroll_into_view_if_needed()
    p.wait_for_timeout(300)


def _controles(p, wid, mobile):
    sel = f'.win[data-id="{wid}"]'
    sans = p.evaluate(SANS_NOM % (sel, sel, sel))
    _assert(not sans, f"{wid} : commandes sans nom accessible : {sans}")
    deb = p.evaluate(DEBORDE % sel)
    _assert(deb["zone"] <= 1, f"{wid} : défilement horizontal dans la fenêtre ({deb})")
    if mobile:
        _assert(deb["page"] <= 1, f"{wid} : la page déborde à droite de {deb['page']} px")
    mauvais = p.evaluate(CONTRASTE % sel)
    _assert(not mauvais, f"{wid} : contraste sous 4,5:1 : {mauvais[:6]}")


def _budget(h, mobile):
    d, p = _pret(h, mobile)
    _ouvrir(p, "budget", mobile)
    w = p.locator('.win[data-id="budget"]')
    # enveloppe créée au clavier : champ, texte, Entrée
    w.locator('[data-k="nouvelle"]').fill("Courses")
    w.locator('[data-k="nouvelle"]').press("Enter")
    p.wait_for_timeout(300)
    w.locator('[data-k="nouvelle"]').fill("Énergie")
    w.locator('[data-k="nouvelle"]').press("Enter")
    p.wait_for_timeout(300)
    _assert(_in("Courses", w.inner_text()) and _in("Énergie", w.inner_text()), "les deux enveloppes devraient apparaître")
    # relevé importé (CSV français : « ; », virgule décimale, lignes de banque avant le tableau)
    p.set_input_files('.win[data-id="budget"] input[type=file]', files=[{"name": "releve.csv", "mimeType": "text/csv", "buffer": CSV.encode("utf-8")}])
    p.wait_for_timeout(700)
    t = w.inner_text()
    _assert(_in("4 opérations ajoutées", t), f"import : message attendu, obtenu : {t[:400]}")
    # classement à la main + règle proposée, puis appliquée à l'autre opération du même magasin
    _assert(_in("À classer (4)", t), f"4 opérations à classer (salaire compris) : {t[:600]}")
    sel = w.locator('select[aria-label*="CARREFOUR"]').first
    sel.select_option("Courses")
    p.wait_for_timeout(500)
    t = w.inner_text()
    _assert(_in("Toujours classer", t) and _in("carrefour market", t), f"règle proposée attendue : {t[:600]}")
    w.locator('[data-k="regle-oui"]').click()
    p.wait_for_timeout(500)
    t = w.inner_text()
    _assert(_in("À classer (2)", t), f"l'autre opération Carrefour doit être classée par la règle : {t[:700]}")
    # le salaire et l'électricité restent : on les classe aussi
    for _ in range(3):
        s = w.locator("select").first
        if not s.count():
            break
        lab = s.get_attribute("aria-label") or ""
        s.select_option("Revenus" if "SALAIRE" in lab.upper() else "Énergie")
        p.wait_for_timeout(400)
        refus = w.get_by_role("button", name="Non merci")
        if refus.count():
            refus.click()
            p.wait_for_timeout(200)
    t = w.inner_text()
    _assert(_in("À classer (0)", t), f"tout doit être classé : {t[:700]}")
    # montant mis dans l'enveloppe
    champ = w.locator('[data-k="alloc-courses"]')
    champ.fill("200")
    champ.press("Tab")
    p.wait_for_timeout(500)
    t = w.inner_text()
    _assert("124,60 €" in _n(t), f"reste de Courses attendu 124,60 € (200 − 45,30 − 30,10) : {t[:900]}")
    _assert("1 600,00 €" in _n(t), f"à répartir attendu 1 600,00 € (1 800 − 200) : {t[:600]}")
    # montant illisible refusé sans rien casser
    champ = w.locator('[data-k="alloc-courses"]')
    champ.fill("abc")
    champ.press("Enter")
    p.wait_for_timeout(400)
    _assert(_in("Montant illisible", w.inner_text()), "un montant illisible doit être signalé")
    # retrait en deux temps : un seul clic ne retire rien
    w.get_by_role("button", name="Retirer Énergie").click()
    p.wait_for_timeout(200)
    _assert(_in("Énergie", w.inner_text()), "un seul clic ne doit rien retirer")
    _controles(p, "budget", mobile)
    # bilan texte
    w.locator("summary", has_text="Bilan du mois").click()
    _assert(_in("Bilan d'octobre 2026", w.inner_text()), "bilan du mois attendu")
    # données dans le magasin : opérations par mois, état
    n = ev(p, "const s = await import('/js/store/storage.js'); const kv = await s.store.all('kv'); return [kv.filter(x => x.id.startsWith('budget-ops-')).length, !!kv.find(x => x.id === 'budget-etat')];")
    _assert(n == [1, True], f"magasin : un mois d'opérations et l'état attendus, obtenu {n}")
    # réimport du même fichier : rien en double
    p.set_input_files('.win[data-id="budget"] input[type=file]', files=[{"name": "releve.csv", "mimeType": "text/csv", "buffer": CSV.encode("utf-8")}])
    p.wait_for_timeout(600)
    _assert(_in("0 opération ajoutée", w.inner_text()) and _in("4 déjà connues", w.inner_text()), "le réimport ne doit rien ajouter")
    # fichier qui n'est pas un relevé : message clair, aucune erreur
    p.set_input_files('.win[data-id="budget"] input[type=file]', files=[{"name": "x.csv", "mimeType": "text/csv", "buffer": b"bonjour;monde\r\n1;2\r\n"}])
    p.wait_for_timeout(500)
    _assert(_in("illisible", w.inner_text()), "un fichier sans colonnes Date/Libellé/Montant doit être refusé clairement")
    _assert(not d.errors, f"erreurs de console : {d.errors}")
    d.close()
    return 1


def test_atelier3_budget_pc(h):
    return _budget(h, False)


def test_atelier3_budget_mobile(h):
    return _budget(h, True)


def _achats(h, mobile):
    d, p = _pret(h, mobile)
    _ouvrir(p, "achats", mobile)
    w = p.locator('.win[data-id="achats"]')
    jour = ev(p, "const m = await import('/js/widgets/when.js'); return [m.dayKey(), m.dayKey(m.addDays(new Date(), -5)), m.dayKey(m.addDays(new Date(), -700))];")
    # le formulaire est ouvert tant qu'il n'y a pas d'achat ; saisie au clavier
    for nom, date in (("Casque fictif", jour[1]), ("Grille-pain fictif", jour[2])):
        w.locator('[data-k="f-nom"]').fill(nom)
        w.locator('[data-k="f-date"]').fill(date)
        if nom.startswith("Grille"):
            w.locator('[data-k="f-mode"]').select_option("magasin")
        w.locator('[data-k="f-nom"]').press("Enter")
        p.wait_for_timeout(500)
        if nom.startswith("Casque"):
            w.locator("summary", has_text="Nouvel achat").click()
            p.wait_for_timeout(200)
    t = w.inner_text()
    _assert(_in("Casque fictif", t) and _in("Grille-pain fictif", t), f"les deux achats doivent apparaître : {t[:500]}")
    _assert(_in("retour possible jusqu'au", t), f"le casque acheté en ligne a un délai de retour de 14 jours : {t[:800]}")
    _assert(_in("Retour possible", t) and (_in("Garantie bientôt finie", t) or _in("Sous garantie", t)), f"états attendus : {t[:700]}")
    _assert(_in("Prochains rappels", t), "les rappels à venir sont listés")
    # un achat sans nom est refusé
    w.locator("summary", has_text="Nouvel achat").click()
    w.locator('[data-k="f-nom"]').fill("   ")
    w.locator('[data-k="f-ok"]').click()
    p.wait_for_timeout(300)
    _assert(_in("Donne un nom", w.inner_text()) or p.evaluate("document.querySelector('.win[data-id=achats] [data-k=f-nom]').validity.valueMissing"), "nom vide refusé")
    # modification
    w.get_by_role("button", name="Modifier Casque fictif").click()
    p.wait_for_timeout(300)
    w.locator('[data-k="f-gar"]').fill("36")
    w.locator('[data-k="f-ok"]').click()
    p.wait_for_timeout(500)
    _assert(_in("modifié", w.inner_text()), f"modification confirmée : {w.inner_text()[:500]}")
    # colis : reconnaissance sans réseau (numéro UPS d'essai à clé valide)
    ups = ev(p, "const m = await import('/js/widgets/moteurs/at-colis.js'); const base = '1Z999AA10123456784'; return m.cleUPS(base) ? base : null;")
    _assert(ups, "numéro UPS d'essai à clé de contrôle valide")
    w.locator("summary", has_text="Suivre un colis").click()
    w.locator('[data-k="colis"]').fill(ups)
    w.locator('[data-k="colis"]').press("Enter")
    p.wait_for_timeout(300)
    _assert(_in("UPS", w.inner_text()) and _in("numéro vérifié", w.inner_text()), f"UPS reconnu : {w.inner_text()[-400:]}")
    _controles(p, "achats", mobile)
    # retrait en deux temps
    b = w.get_by_role("button", name="Retirer Grille-pain fictif")
    b.click()
    p.wait_for_timeout(200)
    _assert(_in("Grille-pain fictif", w.inner_text()), "un seul clic ne doit rien retirer")
    w.get_by_role("button", name="Confirmer le retrait Grille-pain fictif").click()
    p.wait_for_timeout(500)
    _assert(not _in("Grille-pain fictif", w.locator("ul").first.inner_text()), "le second geste retire l'achat")
    n = ev(p, "const s = await import('/js/store/storage.js'); return (await s.store.all('kv')).filter(x => x.id.startsWith('achat-')).length;")
    _assert(n == 1, f"un achat doit rester dans le magasin, obtenu {n}")
    _assert(not d.errors, f"erreurs de console : {d.errors}")
    d.close()
    return 1


def test_atelier3_achats_pc(h):
    return _achats(h, False)


def test_atelier3_achats_mobile(h):
    return _achats(h, True)


def test_atelier3_donnees_chiffrees_si_verrouillage(h):
    """Verrouillage actif : les enregistrements Budget et Achats sont chiffrés dans IndexedDB (aucun libellé lisible), puis relus après déverrouillage."""
    d, p = _pret(h, True, vault=True)
    _ouvrir(p, "budget", True)
    w = p.locator('.win[data-id="budget"]')
    w.locator('[data-k="nouvelle"]').fill("Courses secrètes")
    w.locator('[data-k="nouvelle"]').press("Enter")
    p.wait_for_timeout(300)
    p.set_input_files('.win[data-id="budget"] input[type=file]', files=[{"name": "releve.csv", "mimeType": "text/csv", "buffer": CSV.encode("utf-8")}])
    p.wait_for_timeout(700)
    _ouvrir(p, "achats", True)
    a = p.locator('.win[data-id="achats"]')
    a.locator('[data-k="f-nom"]').fill("Achat confidentiel")
    a.locator('[data-k="f-nom"]').press("Enter")
    p.wait_for_timeout(600)
    brut = ev(p, """return await new Promise((res) => { const r = indexedDB.open('hub'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').getAll(); q.onsuccess = () => res(JSON.stringify(q.result)); }; });""")
    _assert("budget-ops-" in brut or "budget-etat" in brut or '"_e"' in brut, "enregistrements présents")
    for secret in ("CARREFOUR", "Courses secrètes", "Achat confidentiel", "SALAIRE"):
        _assert(secret not in brut, f"« {secret} » est lisible en clair dans IndexedDB alors que le verrouillage est actif")
    p.reload()
    unlock_page(p, PHRASE)
    p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=60000)
    p.wait_for_timeout(1500)
    _ouvrir(p, "budget", True)
    _assert("Courses secrètes" in p.locator('.win[data-id="budget"]').inner_text(), "après déverrouillage, l'enveloppe est relue")
    _ouvrir(p, "achats", True)
    _assert("Achat confidentiel" in p.locator('.win[data-id="achats"]').inner_text(), "après déverrouillage, l'achat est relu")
    _assert(not d.errors, f"erreurs de console : {d.errors}")
    d.close()
    return 1


def test_atelier3_clavier_et_csp(h):
    """Tabulation : les commandes des deux fenêtres reçoivent le focus dans l'ordre ; aucune violation de la politique de sécurité."""
    d, p = _pret(h, False)
    viol = []
    p.on("console", lambda m: viol.append(m.text) if "Content Security Policy" in m.text or "Refused to" in m.text else None)
    for wid in ("budget", "achats"):
        _ouvrir(p, wid, False)
        p.evaluate("(id) => { const e = document.querySelector('.win[data-id=\"' + id + '\"] .atl button, .win[data-id=\"' + id + '\"] .atl summary'); e.focus(); }", wid)
        vus = []
        for _ in range(6):
            vus.append(p.evaluate("(() => { const a = document.activeElement; return a && a.closest('.win') ? a.closest('.win').dataset.id : 'ailleurs'; })()"))
            p.keyboard.press("Tab")
        _assert(vus.count(wid) >= 4, f"{wid} : la tabulation doit rester dans la fenêtre : {vus}")
    _assert(not viol, f"violations CSP : {viol}")
    _assert(not d.errors, f"erreurs de console : {d.errors}")
    d.close()
    return 1
