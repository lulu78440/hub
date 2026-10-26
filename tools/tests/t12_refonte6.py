"""Refonte 6 (7.43.0) : panneau « Modules, espaces et workflows » de la fenêtre du Noyau (gestes de Lucien des lots 5, 8 et 9) et bouton « Annuler le plan » branché sur annulation.js.

Données factices uniquement (deux modules inventés, un workflow de calcul sans réseau). Aucun réseau, aucune clé : toute requête extérieure est bloquée par le banc.
Vérifie sur PC (1440x900) et téléphone (390x844) :
- ouverture par la palette (Outils / Ctrl+K sur PC, bouton Outils sur téléphone) ;
- chaque geste ne part que d'un vrai clic (un clic simulé par le code est refusé et dit) ;
- modules : ouvrir, versions et restauration, export (fichier JSON), suppression avec confirmation, sauvegarde faite avant, annulation juste après ;
- espaces : création au formulaire, ouverture ; reprise de la dernière session ;
- workflows : validation du budget annoncé avant tout lancement, refus sans effet, lancement puis bilan ; modèle de plan refusé sans requête réseau ;
- « Annuler le plan » visible pendant un plan (planEnCours) et qui l'annule (annulerPlan), sans l'ancienne enveloppe de la barrière ;
- noms accessibles, clavier, contraste d'au moins 4,5:1, cibles d'au moins 44 px, aucun défilement horizontal, aucune erreur de console ni violation de la CSP."""
import json
import t2_fonctions as t2
import t11_atelier3 as t11
from hubtest import ev

CONTRASTE = """() => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const fond = [4, 10, 20], bad = [];
  document.querySelectorAll('.ng, .ng *').forEach((e) => {
    if (!e.offsetParent && e.tagName !== 'BODY') return;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const cs = getComputedStyle(e), c = rgb(cs.color), bg = rgb(cs.backgroundColor);
    if ((c.length > 3 ? c[3] : 1) < 1) return;
    const base = bg.length === 3 || (bg.length === 4 && bg[3] === 1) ? bg : fond;
    const L1 = lum(c), L2 = lum(base), r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (r < 4.5) bad.push(e.tagName + '.' + e.className + ' ' + r.toFixed(2) + ' « ' + e.textContent.trim().slice(0, 30) + ' »');
  });
  return bad;
}"""

SANS_NOM = """() => [...document.querySelectorAll('.ng button, .ng input, .ng select')].filter((e) => e.offsetParent && !(e.getAttribute('aria-label') || (e.tagName === 'BUTTON' && e.textContent.trim()) || (e.labels && e.labels.length))).map((e) => e.outerHTML.slice(0, 90))"""

PETITES = """() => [...document.querySelectorAll('.ng button, .ng input[type=text], .ng select, .ng .ng-coche')].filter((e) => e.offsetParent).map((e) => [e.tagName + '.' + e.className + ' « ' + (e.textContent || e.id).trim().slice(0, 25) + ' »', e.offsetHeight]).filter(([, h]) => h < 44)"""

DEBORDE = """() => { const r = document.querySelector('.ng'); return { page: document.documentElement.scrollWidth - innerWidth, zone: r.scrollWidth - r.clientWidth }; }"""

SEMER = """
const { hote } = await import('/js/noyau/hote.js');
const { verifierJeu } = await import('/js/noyau/modules/composants.js');
const o = hote.ui.orchestrateur, c = await o.composants(), g = await o.gestes();
const jeu = (nom, k) => verifierJeu({ titre: nom, unite: 'habitants', colonnes: [{ id: 'date', libelle: 'Date', type: 'date' }, { id: 'valeur', libelle: 'Valeur', type: 'nombre' }],
  lignes: [['2000-01', 10 * k], ['2001-01', 20 * k], ['2002-01', 30 * k]], source: { nom: 'Série factice ' + nom, maj: '2026-10-01', periode: '2000-01 → 2002-01', licence: 'LO', url: 'https://example.org/x', requete: '2026-10-20', verifie: true } });
await c.modules.enregistrer({ id: 'pop-alpha', titre: 'Population Alpha', vue: 'courbe', jeu: jeu('Alpha', 1) });
await c.modules.enregistrer({ id: 'pop-alpha', titre: 'Population Alpha bis', vue: 'courbe', jeu: jeu('Alpha', 2) });
await c.modules.enregistrer({ id: 'pop-beta', titre: 'Population Beta', vue: 'barres', jeu: jeu('Beta', 3) });
await g.enregistrerWorkflow({ id: 'calcul-test', nom: 'Calcul de test', parametres: [{ id: 'expr', libelle: 'Expression à calculer', type: 'texte', exemple: '2+3' }], etapes: [{ nom: 'calculer', params: { expression: '@expr' } }] });
const r = c.jeux.deposer(jeu('Session', 4));
await c.sessions.noterPlan({ appels: [{ nom: 'lire_serie', params: {} }], lignes: Object.assign([{ ok: true, nom: 'lire_serie', donnees: { jeu: r.ref } }], { id: 'plan-seme', bilan: { reussies: 1, en_echec: 0, refusees: 0, non_executees: 0 } }) });
return true;
"""


def _assert(c, msg):
    if not c:
        raise AssertionError(msg)


def _etat(p):
    return p.locator(".ng-etat").inner_text()


def _ouvrir_palette(p, mobile):
    if mobile:
        p.locator("#b-outils").click()
        p.wait_for_timeout(300)
        p.locator(".o-tile", has_text="Modules, espaces, workflows").first.click()
    else:
        p.keyboard.press("Control+k")
        p.wait_for_timeout(300)
        p.keyboard.type("workflows")
        p.wait_for_timeout(300)
        p.locator(".o-tile", has_text="Modules, espaces, workflows").first.click()
    p.locator(".ng").wait_for(state="visible", timeout=20000)
    p.wait_for_timeout(800)


def _parcours(h, mobile):
    d, p = t11._pret(h, mobile)

    def A(loc):
        """Geste réel de Lucien : toucher sur téléphone ; sur PC, touche Entrée sur le bouton pris au clavier (la fenêtre 3D bouge sans cesse sous la souris, ce qui fait rater les clics du banc)."""
        if mobile:
            loc.click()
        else:
            loc.scroll_into_view_if_needed(); loc.focus(); p.keyboard.press("Enter")

    def AC(loc):
        if mobile:
            loc.check()
        else:
            loc.focus(); p.keyboard.press("Space")
    t11._ouvrir(p, "noyau", mobile)
    _assert(ev(p, SEMER), "semis des données factices")

    # --- 1. palette ---
    _ouvrir_palette(p, mobile)
    _assert(p.locator(".nx-vues button", has_text="Modules").count() == 1, "bouton « Modules » dans la barre du Noyau")
    panneau = p.locator(".ng")
    t = panneau.inner_text()
    _assert("Population Alpha bis" in t and "Population Beta" in t, f"les deux modules sont listés : {t[:300]}")
    _assert("Calcul de test" in t and "Une série en courbe" in t, "workflow enregistré et modèles listés")
    _assert("Reprendre la dernière session" in t, "reprise de la dernière session proposée")
    foc = p.evaluate("document.activeElement && document.activeElement.className")
    _assert("ng-h" in str(foc), f"le titre du panneau reçoit le focus à l'ouverture : {foc}")

    # --- 2. accessibilité ---
    sans = p.evaluate(SANS_NOM)
    _assert(not sans, f"commandes sans nom accessible : {sans}")
    deb = p.evaluate(DEBORDE)
    _assert(deb["zone"] <= 1 and deb["page"] <= 1, f"défilement horizontal : {deb}")
    mauvais = p.evaluate(CONTRASTE)
    _assert(not mauvais, f"contraste sous 4,5:1 : {mauvais[:6]}")
    petites = p.evaluate(PETITES)
    _assert(not petites, f"cibles sous 44 px : {petites[:6]}")
    p.keyboard.press("Tab")
    _assert(p.evaluate("!!document.activeElement.closest('.ng')"), "Tab mène au premier bouton du panneau")

    # --- 3. un clic simulé par le code est refusé ---
    p.evaluate("document.querySelector('.ng button[aria-label^=\"Supprimer le module « Population Beta\"]').click()")
    p.wait_for_timeout(300)
    _assert("refusé" in _etat(p) and p.locator(".ng-confirme").count() == 0, f"clic simulé : refus attendu, obtenu « {_etat(p)} »")
    p.evaluate("document.querySelector('.ng button[aria-label^=\"Reprendre la dernière\"]').click()")
    p.wait_for_timeout(300)
    _assert("refusé" in _etat(p), "reprise simulée refusée")
    p.evaluate("document.querySelector('.ng button[aria-label^=\"Ouvrir le module\"]').click()")
    p.wait_for_timeout(300)
    _assert(p.locator(".nx-fil .nxc").count() == 0, "ouverture simulée : rien n'est affiché")

    # --- 4. ouvrir un module (vrai clic) ---
    A(p.locator('.ng button[aria-label^="Ouvrir le module « Population Alpha"]'))
    p.wait_for_timeout(600)
    _assert(p.locator(".nx-fil .nxc").count() >= 1 and "affiché" in _etat(p), f"module ouvert dans l'échange : {_etat(p)}")

    # --- 5. versions et restauration ---
    A(p.locator('.ng button[aria-label^="Versions du module « Population Alpha"]'))
    p.wait_for_timeout(500)
    _assert(p.locator(".ng-version").count() == 2, "deux versions listées")
    A(p.locator('.ng button[aria-label^="Restaurer la version 1"]'))
    p.wait_for_timeout(800)
    _assert("version 3" in _etat(p), f"restauration : nouvelle version 3 : {_etat(p)}")
    nv = ev(p, "const { hote } = await import('/js/noyau/hote.js'); const c = await hote.ui.orchestrateur.composants(); return (await c.modules.versions('pop-alpha')).length;")
    _assert(nv == 3, f"trois versions gardées (rien n'est perdu), obtenu {nv}")

    # --- 6. export ---
    with p.expect_download() as dl:
        A(p.locator('.ng button[aria-label^="Exporter le module « Population Beta"]'))
    f = dl.value
    obj = json.load(open(f.path(), encoding="utf-8"))
    _assert(obj.get("format") == "hub-noyau-module" and obj["module"]["module_id"] == "pop-beta", f"export JSON : {str(obj)[:120]}")

    # --- 7. suppression : confirmation, sauvegarde avant, annulation ---
    A(p.locator('.ng button[aria-label^="Supprimer le module « Population Beta"]'))
    p.wait_for_timeout(300)
    _assert(p.locator(".ng-confirme").count() == 1, "la suppression demande une confirmation")
    _assert(p.evaluate("document.activeElement.textContent") == "Garder le module", "focus sur le choix sûr")
    A(p.locator(".ng-confirme button", has_text="Garder"))
    _assert(p.locator(".ng-confirme").count() == 0 and "Population Beta" in panneau.inner_text(), "« Garder » ne supprime rien")
    A(p.locator('.ng button[aria-label^="Supprimer le module « Population Beta"]'))
    A(p.locator('.ng button[aria-label^="Confirmer la suppression"]'))
    p.wait_for_timeout(900)
    corb = ev(p, "const { hote } = await import('/js/noyau/hote.js'); const d = await hote.stockage.lire('kv', 'noyau-corbeille-pop-beta'); const m = await hote.stockage.lire('kv', 'noyau-module-pop-beta'); return { sauvegarde: !!(d && d.doc && d.doc.versions && d.doc.versions.length), reste: !!m };")
    _assert(corb["sauvegarde"] and not corb["reste"], f"sauvegarde faite avant, module retiré : {corb}")
    _assert("sauvegarde" in _etat(p) and "Population Beta" not in p.locator(".ng-liste").first.inner_text(), "module retiré de la liste, sauvegarde annoncée")
    A(p.locator(".ng-annuler button"))
    p.wait_for_timeout(900)
    _assert("Population Beta" in panneau.inner_text(), "« Annuler » remet le module")

    # --- 8. espaces ---
    p.locator("#ng-esp-titre").fill("Mon espace test")
    AC(p.locator("#ng-esp-m-pop-alpha"))
    AC(p.locator("#ng-esp-m-pop-beta"))
    A(p.locator('.ng button[aria-label^="Créer l\'espace"]'))
    p.wait_for_timeout(900)
    _assert("Mon espace test" in panneau.inner_text() and "créé" in _etat(p), f"espace créé : {_etat(p)}")
    avant = p.locator(".nx-fil .nxc").count()
    A(p.locator('.ng button[aria-label^="Ouvrir l\'espace « Mon espace test"]'))
    p.wait_for_timeout(1000)
    _assert(p.locator(".nx-fil .nxc").count() >= avant + 2, f"l'espace rouvre ses deux modules ({avant} -> {p.locator('.nx-fil .nxc').count()}) : {_etat(p)}")

    # --- 9. reprise de session ---
    A(p.locator('.ng button[aria-label^="Reprendre la dernière"]'))
    p.wait_for_timeout(900)
    _assert("Session reprise" in _etat(p) and "aucun appel réseau" in _etat(p), f"reprise : {_etat(p)}")

    # --- 10. workflow enregistré : validation du budget ---
    A(p.locator('.ng button[aria-label^="Lancer le workflow « Calcul de test"]'))
    p.locator("#ng-p-calcul-test-expr").fill("6*7")
    A(p.locator('.ng button[aria-label^="Préparer le lancement de « Calcul de test"]'))
    p.locator(".ng-validation").wait_for(state="visible")
    v = p.locator(".ng-validation").inner_text()
    _assert("Budget annoncé" in v and "1 étape(s)" in v and "0 accord(s)" in v and "0 requête(s) au modèle" in v and "calculer" in v, f"budget annoncé : {v[:300]}")
    p.evaluate("document.querySelector('.ng-validation .nx-primaire').click()")
    p.wait_for_timeout(400)
    _assert(p.locator(".ng-validation").count() == 1 and "refusé" in _etat(p), "« Lancer le plan » simulé par le code : refusé, rien ne part")
    A(p.locator(".ng-validation button", has_text="Lancer le plan"))
    p.wait_for_timeout(1500)
    _assert("Plan terminé : 1 étape(s) réussie(s)" in _etat(p), f"bilan du workflow : {_etat(p)}")
    j = ev(p, "const { hote } = await import('/js/noyau/hote.js'); const d = await hote.stockage.lire('kv', 'noyau-journal'); return (d && d.lignes || []).filter((l) => l.outil === 'calculer').length;")
    _assert(j >= 1, "l'étape est passée par la barrière (journal)")
    # refus : rien ne part
    A(p.locator('.ng button[aria-label^="Lancer le workflow « Calcul de test"]'))
    p.locator("#ng-p-calcul-test-expr").fill("1+1")
    A(p.locator('.ng button[aria-label^="Préparer le lancement de « Calcul de test"]'))
    p.locator(".ng-validation").wait_for(state="visible")
    A(p.locator(".ng-validation button", has_text="Refuser"))
    p.wait_for_timeout(500)
    _assert("Rien n'est parti" in _etat(p) or "refusé" in _etat(p), f"refus : {_etat(p)}")
    j2 = ev(p, "const { hote } = await import('/js/noyau/hote.js'); const d = await hote.stockage.lire('kv', 'noyau-journal'); return (d && d.lignes || []).filter((l) => l.outil === 'calculer').length;")
    _assert(j2 == j, f"refus : aucune étape de plus ({j} -> {j2})")

    # --- 11. modèle de plan : le budget annonce le réseau, un refus ne le touche pas ---
    A(p.locator('.ng button[aria-label^="Lancer le modèle « Une série en courbe"]'))
    p.locator("#ng-p-serie-en-courbe-identifiant").fill("FR/SP.POP.TOTL")
    A(p.locator('.ng button[aria-label^="Préparer le lancement de « Une série en courbe"]'))
    p.locator(".ng-validation").wait_for(state="visible")
    v = p.locator(".ng-validation").inner_text()
    _assert("1 étape(s) avec appel réseau" in v and "lire_serie" in v, f"modèle : réseau annoncé : {v[:300]}")
    A(p.locator(".ng-validation button", has_text="Refuser"))
    p.wait_for_timeout(400)
    _assert(not d.blocked, f"aucune requête extérieure : {d.blocked}")

    # --- 12. « Annuler le plan » branché sur annulation.js (sans enveloppe de la barrière) ---
    ev(p, "const a = await import('/js/noyau/annulation.js'); window.__sig = a.ouvrirSignal('essai-bouton'); return true;")
    p.wait_for_timeout(700)
    btn = p.locator(".nx-vues-annuler")
    _assert(btn.is_visible(), "plan en cours : « Annuler le plan » visible")
    A(btn)
    p.wait_for_timeout(400)
    _assert(ev(p, "return window.__sig.aborted === true;"), "le clic abat le signal du plan en cours (annulerPlan)")
    ev(p, "const a = await import('/js/noyau/annulation.js'); a.fermerSignal('essai-bouton'); return true;")
    p.wait_for_timeout(800)
    _assert(not btn.is_visible(), "plan fini : le bouton se cache")
    _assert("Plan annulé" in p.locator(".nx-vues-etat").inner_text(), "message d'état en texte")

    # --- 13. console / CSP ---
    _assert(not d.errors, f"erreurs de console : {d.errors[:4]}")
    d.close()
    return 40


def test_refonte6_gestes_pc(h):
    return _parcours(h, False)


def test_refonte6_gestes_mobile(h):
    return _parcours(h, True)


def test_refonte6_enveloppe_retiree(h):
    """Le bouton « Annuler le plan » ne réécrit plus la barrière : pas de marqueur __vuesPlan, et le code source n'y fait plus référence."""
    d, p = t11._pret(h, False)
    t11._ouvrir(p, "noyau", False)
    r = ev(p, "const t = await (await fetch('/js/ui/noyau-controles.js')).text(); const { hote } = await import('/js/noyau/hote.js'); return { ref: /__vuesPlan/.test(t), exec: /barriere\\.executer\\s*=|b\\.executer\\s*=/.test(t), importe: /annulation\\.js/.test(t) };")
    _assert(not r["ref"] and not r["exec"] and r["importe"], f"enveloppe retirée : {r}")
    gestes = ev(p, r"""const t = await (await fetch('/js/noyau/outils.js')).text(); const b = await (await fetch('/js/noyau/barriere.js')).text(); return /(from\s+|import\()["'][^"']*(gestes-lucien|noyau-gestes)/.test(t + b);""")
    _assert(not gestes, "ni outils.js ni barriere.js ne mènent aux gestes de Lucien")
    d.close()
    return 3
