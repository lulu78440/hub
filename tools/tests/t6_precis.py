"""Cycle 7 · Cas précis (environ 1 500 vérifications unitaires).

Chaque fonction du hub est appelée dans le navigateur de test avec des entrées choisies (bords, pièges, fuseaux, dates
particulières) et son résultat est comparé à un oracle écrit ici, en Python, indépendamment du code du hub
(ex. Pâques : bibliothèque dateutil ; jours de la semaine : module datetime). Un écart = un cas faux.
Tous les écarts d'un groupe sont listés dans tools/tests/.tmp/echecs-<groupe>.txt.
"""
import datetime as dt, json, os, re, random, unicodedata
from dateutil.easter import easter
from hubtest import ROOT, PHRASE, ev, write_json
from t2_fonctions import make_mock, FLUX

TMP = os.path.join(ROOT, "tools", "tests", ".tmp")
D = dt.date
day = dt.timedelta(days=1)


class Cases:
    def __init__(self, group):
        self.group, self.n, self.fails = group, 0, []

    def check(self, label, got, exp):
        self.n += 1
        if got != exp:
            self.fails.append(f"{label} → obtenu {got!r}, attendu {exp!r}")

    def ok(self, label, cond, detail=""):
        self.n += 1
        if not cond:
            self.fails.append(f"{label} {detail}".strip())

    def done(self):
        with open(os.path.join(TMP, f"echecs-{self.group}.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(self.fails))
        print(f"        {self.group} : {self.n - len(self.fails)}/{self.n} cas justes")
        if self.fails:
            e = AssertionError(f"{len(self.fails)}/{self.n} cas faux (liste : .tmp/echecs-{self.group}.txt) :\n          " + "\n          ".join(self.fails[:12]))
            e.cas = self.n
            raise e
        return self.n


CALL = """async ([m, f, args]) => { const mod = await import(m);
  return args.map((a) => { try { const r = mod[f](...a); return { r: r === undefined ? null : r }; } catch (e) { return { e: String(e && e.message || e) }; } }); }"""


def call(p, m, f, args):
    return [x["r"] if "e" not in x else ("ERREUR", x["e"]) for x in p.evaluate(CALL, [m, f, args])]


def blank(h, **kw):
    d = h.device(**kw)
    p = d.ctx.new_page()
    p.on("pageerror", lambda e: d.errors.append("pageerror: " + str(e)))
    p.goto(h.server.url + "tools/tests/vide.html")
    return d, p


def fix_clock(p, y, mo, da, hh=12, mi=0):
    p.clock.set_fixed_time(dt.datetime(y, mo, da, hh, mi))


def iso(d):
    return d.isoformat() if d else None


def squash(s):
    return re.sub(r"\s{2,}", " ", s).strip()


# =====================================================================================
# A · « @demain », « @lun », « @25/12 » (parseDue) — 8 jours de référence × 47 écritures
# =====================================================================================
FULL = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def due_oracle(word, today):
    v = unicodedata.normalize("NFD", word.lower())
    v = "".join(c for c in v if not unicodedata.combining(c))
    if v in ("auj", "aujourd'hui", "aujourdhui"):
        return today
    if v in ("demain", "dem"):
        return today + day
    if v == "apres-demain":
        return today + 2 * day
    for i, n in enumerate(FULL):          # nom complet ou abréviation de 3 lettres seulement (« @mars » n'est pas mardi)
        if v in (n, n[:3]):
            k = (i - today.weekday()) % 7 or 7
            return today + k * day
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?", v)
    if not m:
        return None
    dd, mm = int(m[1]), int(m[2])
    if m[3]:
        y = int(m[3]); y = y + 2000 if y < 100 else y
        try:
            return D(y, mm, dd)
        except ValueError:
            return None
    for y in range(today.year, today.year + 9):      # prochaine date qui existe (29/02 → prochaine année bissextile)
        try:
            c = D(y, mm, dd)
        except ValueError:
            continue
        if c >= today:
            return c
    return None


def test_precis_A_echeances_parseDue(h):
    c = Cases("A-echeances")
    d, p = blank(h)
    refs = [D(2026, 10, 25), D(2026, 10, 28), D(2026, 12, 31), D(2027, 1, 10), D(2027, 2, 28), D(2028, 2, 29), D(2026, 3, 28), D(2026, 6, 19)]
    words = ["auj", "aujourd'hui", "Aujourdhui", "demain", "Demain", "dem", "après-demain", "apres-demain",
             "lun", "lundi", "mar", "mardi", "mer", "mercredi", "jeu", "jeudi", "ven", "vendredi", "sam", "samedi", "dim", "dimanche", "LUNDI", "Vendredi",
             "mars", "merci", "jeux", "samba", "dimitri", "lune",
             "25/12", "1/1", "01/01", "29/02", "31/04", "31/12", "15/06/27", "15/06/2030", "29/02/2028", "29/02/2027", "32/01", "00/05", "13/13", "foo"]
    for ref in refs:
        fix_clock(p, ref.year, ref.month, ref.day)
        ws = words + [f"{ref.day}/{ref.month}", f"{(ref - day).day}/{(ref - day).month}", f"{(ref + day).day:02d}/{(ref + day).month:02d}"]
        texts = [f"Tâche @{w} fin" for w in ws]
        got = call(p, "/js/widgets/when.js", "parseDue", [[t] for t in texts])
        for w, t, g in zip(ws, texts, got):
            e = due_oracle(w, ref)
            c.check(f"{ref} « {t} »", g, {"text": "Tâche fin" if e else t, "due": iso(e)})
    # Écritures particulières (référence : 25/10/2026)
    fix_clock(p, 2026, 10, 25)
    extra = [("@demain", "", "2026-10-26"), ("x@demain", "x@demain", None), ("Deux @demain @lundi", "Deux @lundi", "2026-10-26"),
             ("  Pain   @demain   ", "Pain", "2026-10-26"), ("@ demain", "@ demain", None), ("Noël @25/12, cadeaux", "Noël , cadeaux", "2026-12-25")]
    got = call(p, "/js/widgets/when.js", "parseDue", [[x[0]] for x in extra])
    for (t, et, ed), g in zip(extra, got):
        c.check(f"« {t} »", g, {"text": et, "due": ed})
    d.close()
    return c.done()


# =====================================================================================
# B · « 14h30 », « 9h-17h », « à 18h » (parseTime)
# =====================================================================================
def time_oracle(text):
    """Heure de début (et de fin) d'une tâche ou d'un rendez-vous ; « à » / « vers » / « dès » devant l'heure partent avec elle."""
    hm = r"(\d{1,2})(?:[h:](\d{2})?|h)"
    rx = re.compile(r"(^|\s)(?:(?:à|vers|dès)\s)?" + hm + r"(?:\s?[-–à]\s?" + hm + r")?(?=\s|$)", re.I)
    for m in rx.finditer(text):
        h1, m1, h2, m2 = m[2], m[3], m[4], m[5]
        if int(h1) > 23 or (m1 and int(m1) > 59):
            continue
        start = f"{int(h1):02d}:{m1 or '00'}"
        end = f"{int(h2):02d}:{m2 or '00'}" if h2 is not None and int(h2) <= 23 and not (m2 and int(m2) > 59) else None
        return {"text": squash(text[:m.start()] + m[1] + text[m.end():]), "start": start, "end": end}
    return {"text": squash(text), "start": None, "end": None}


def test_precis_B_heures_parseTime(h):
    c = Cases("B-heures")
    d, p = blank(h)
    texts = []
    for hh in range(0, 26):
        for f in ("{h}h", "{h:02d}h", "{h}h30", "{h}:45", "{h}h60", "{h}h05"):
            texts.append("RDV " + f.format(h=hh) + " demain")
    texts += ["Réunion 14h-16h", "Réunion 14h–16h30", "Réunion 14h à 16h", "Cours 9:00-17:00", "Appeler maman à 18h", "Passer vers 9h30", "Ouvert dès 7h",
              "Garage 9h-25h", "7h5 trop court", "100h", "h", "Film 18h.", "à 18h", "9h 10h", "Train 6h45 quai 3", "08:00", "0h", "23h59", "Midi 12h00 pile",
              "RDV 14 h", "14h30 puis 16h", "le 3:30", "Sport 18h-18h30", "Dodo 23h-7h", "1h-2h"]
    got = call(p, "/js/widgets/when.js", "parseTime", [[t] for t in texts])
    for t, g in zip(texts, got):
        c.check(f"« {t} »", g, time_oracle(t))
    d.close()
    return c.done()


# =====================================================================================
# C · Raccourcis de recherche (parseQuery) et D · phrases dites (voiceToQuery)
# =====================================================================================
def test_precis_C_recherche_et_D_voix(h):
    c = Cases("CD-recherche-voix")
    d, p = blank(h)
    Q = [("chat", "Brave", "chat"), ("!g chat", "Google", "chat"), ("!G chat", "Google", "chat"), ("!d chat", "DuckDuckGo", "chat"),
         ("!y chat drôle", "YouTube", "chat drôle"), ("!Y chat", "YouTube", "chat"), ("!v recette", "Brave Vidéos", "recette"),
         ("!i montagne", "Brave Images", "montagne"), ("!n météo", "Brave Actus", "météo"), ("!x chat", "Brave", "!x chat"),
         ("!yoga", "Brave", "!yoga"), ("!y", "YouTube", ""), ("  !y   chat  ", "YouTube", "chat"), ("chat !y", "Brave", "chat !y"),
         ("!g!y", "Brave", "!g!y"), ("!", "Brave", "!"), ("", "Brave", ""), ("!g    ", "Google", ""), ("!d c'est l'été", "DuckDuckGo", "c'est l'été"),
         ("!y <script>", "YouTube", "<script>"), ("!n\tactus", "Brave Actus", "actus"), ("😀 !y", "Brave", "😀 !y")]
    got = call(p, "/js/ui/search.js", "parseQuery", [[q] for q, _, _ in Q])
    for (q, en, eq), g in zip(Q, got):
        c.check(f"recherche « {q} »", (g["e"]["name"], g["q"]) if isinstance(g, dict) else g, (en, eq))
    V = [("YouTube chats drôles", "!y chats drôles"), ("chats drôles sur YouTube", "!y chats drôles"), ("Recherche vidéo de recette de crêpes", "!v recette de crêpes"),
         ("vidéos chats", "!v chats"), ("recette de crêpes en vidéo", "!v recette de crêpes"), ("images de montagne", "!i montagne"), ("image chat", "!i chat"),
         ("actualités météo", "!n météo"), ("actus sport", "!n sport"), ("Google tour Eiffel", "!g tour eiffel"), ("duck duck go chats", "!d chats"),
         ("DuckDuckGo météo Paris.", "!d météo paris"), ("ok hub cherche pizza", "pizza"), ("Hub, youtube musique", "!y musique"),
         ("s'il te plaît montre-moi images de chats", "!i chats"), ("peux-tu chercher la météo", "la météo"), ("youtube", "youtube"),
         ("sur youtube clip", "!y clip"), ("ouvre youtube", "youtube"), ("Météo demain ?", "météo demain"), ("VIDÉOS DE CHATS", "!v chats"),
         ("youtube d'Angèle", "!y angèle"), ("vidéo chats", "!v chats"), ("OK, hub, cherche, pizza", "pizza"), ("images, de montagne", "!i montagne")]
    got = call(p, "/js/ui/voice.js", "voiceToQuery", [[v] for v, _ in V])
    for (v, e), g in zip(V, got):
        c.check(f"voix « {v} »", g, e)
    d.close()
    return c.done()


# =====================================================================================
# E · Liens YouTube, F · coordonnées, G · anniversaires
# =====================================================================================
YT = "dQw4w9WgXcQ"


def test_precis_EFG_youtube_coordonnees_anniversaires(h):
    c = Cases("EFG-youtube-coords-anniv")
    d, p = blank(h)
    fix_clock(p, 2026, 10, 25)
    E = [(f"https://www.youtube.com/watch?v={YT}", YT, None), (f"youtube.com/watch?v={YT}", YT, None), (f"https://youtu.be/{YT}", YT, None),
         (f"https://youtu.be/{YT}?t=42", YT, None), (f"https://m.youtube.com/watch?v={YT}&feature=share", YT, None),
         (f"https://music.youtube.com/watch?v={YT}&list=PLabc_-123", YT, "PLabc_-123"), (f"https://www.youtube.com/shorts/{YT}", YT, None),
         (f"https://www.youtube.com/embed/{YT}", YT, None), (f"https://www.youtube-nocookie.com/embed/{YT}", YT, None), (f"https://www.youtube.com/live/{YT}", YT, None),
         ("https://www.youtube.com/playlist?list=PL0123456789", None, "PL0123456789"), (YT, YT, None), (f"https://evil.test/watch?v={YT}", "nul", None),
         (f"https://youtube.com.evil.test/watch?v={YT}", "nul", None), ("https://www.youtube.com/watch?v=court", "nul", None),
         (f"https://www.youtube.com/watch?v={YT}&list=PL%22%3E%3Cimg", YT, None), ("javascript:alert(1)", "nul", None), ("", "nul", None),
         (f"http://youtu.be/{YT}", YT, None), ("https://youtu.be/", "nul", None), ("https://www.youtube.com/@chaine", "nul", None),
         (f"https://www.youtube.com/watch?v={YT}#t=1", YT, None), (f"  https://youtu.be/{YT}  ", YT, None), (f"HTTPS://YOUTU.BE/{YT}", YT, None),
         (f"www.youtube.com/watch?v={YT}", YT, None), (f"https://youtube.com/watch?app=desktop&v={YT}", YT, None), ("https://www.youtube.com/playlist?list=", "nul", None),
         (f"https://www.youtube.com/watch?v={YT}x", "nul", None)]
    got = call(p, "/js/widgets/media.js", "parseYouTube", [[u] for u, _, _ in E])
    for (u, v, l), g in zip(E, got):
        c.check(f"YouTube « {u} »", g, None if v == "nul" else {"v": v, "list": l})
    F = [("48.85, 2.35", (48.85, 2.35, "")), ("48,85 ; 2,35", (48.85, 2.35, "")), ("48.85 2.35", (48.85, 2.35, "")), ("Maison 48.85, 2.35", (48.85, 2.35, "Maison")),
         ("Maison : 48.85, 2.35", (48.85, 2.35, "Maison")), ("-33.86, 151.21", (-33.86, 151.21, "")), ("91, 0", "lat"), ("0, 181", "lon"), ("90, 180", (90, 180, "")),
         ("-90,-180", (-90, -180, "")), ("48.85°, 2.35°", (48.85, 2.35, "")), ("48,85,2,35", (48.85, 2.35, "")), ("abc", None), ("", None), ("48.85", None),
         ("48.8566 N, 2.3522 E", None), ("  48.85 ,  2.35  ", (48.85, 2.35, "")), ("Chez moi 48.85 2.35", (48.85, 2.35, "Chez moi")),
         ("Rue 12 48.85, 2.35", (48.85, 2.35, "Rue 12")), ("-0.5, -0.5", (-0.5, -0.5, "")), ("90.0001, 0", "lat"), ("0, -180.5", "lon")]
    got = call(p, "/js/widgets/weather.js", "parseCoords", [[t] for t, _ in F])
    for (t, e), g in zip(F, got):
        if e in ("lat", "lon"):
            c.ok(f"coordonnées « {t} » refusées ({e})", isinstance(g, dict) and "error" in g and ("Latitude" if e == "lat" else "Longitude") in g["error"], repr(g))
        else:
            c.check(f"coordonnées « {t} »", None if g is None else (g.get("lat"), g.get("lon"), g.get("name")), e)
    G = [("Maman 12/03", ("Maman", "03-12", None)), ("Maman 12/03/1960", ("Maman", "03-12", 1960)), ("Papa 1.1.60", ("Papa", "01-01", 1960)),
         ("Bébé 5-6-25", ("Bébé", "06-05", 2025)), ("Bébé 5/6/30", None), ("Vieux 5/6/31", ("Vieux", "06-05", 1931)),
         ("Léa 31/02", None), ("Léa 30/02", None), ("Léa 29/02", ("Léa", "02-29", None)), ("Léa 31/04", None), ("Léa 31/12", ("Léa", "12-31", None)),
         ("Léa 00/01", None), ("Léa 1/13", None), ("Léa 32/1", None), ("12/03", None), ("  Jean-Pierre   7/7  ", ("Jean-Pierre", "07-07", None)),
         ("N" * 50 + " 1/1", ("N" * 40, "01-01", None)), ("Anne 12/03/2099", None), ("Anne 12/03/196", None), ("Anne 29/02/2024", ("Anne", "02-29", 2024)),
         ("Anne 29/02/2023", None), ("Zoé 1/1/2026", ("Zoé", "01-01", 2026)), ("Tom 31/06", None), ("Tom 30/06", ("Tom", "06-30", None))]
    got = call(p, "/js/widgets/radar.js", "parseBirthday", [[t] for t, _ in G])
    for (t, e), g in zip(G, got):
        c.check(f"anniversaire « {t} »", None if g is None else (g["name"], g["md"], g["year"]), e)
    d.close()
    return c.done()


# =====================================================================================
# H · Jours fériés et fêtes (feteList), 2015 à 2045 — oracle : dateutil (Pâques) + règles françaises
# =====================================================================================
def last_sunday(y, m):
    x = (D(y, m + 1, 1) if m < 12 else D(y + 1, 1, 1)) - day
    return x - (x.weekday() + 1) % 7 * day


def nth_sunday(y, m, n):
    x = D(y, m, 1)
    return x + ((6 - x.weekday()) % 7) * day + (n - 1) * 7 * day


def fetes_oracle(y):
    E = easter(y)
    pent = E + 49 * day
    mothers = last_sunday(y, 5)
    if mothers == pent:
        mothers = nth_sunday(y, 6, 1)
    return {"Pâques": E, "Lundi de Pâques": E + day, "Ascension": E + 39 * day, "Lundi de Pentecôte": E + 50 * day,
            "Fête des mères": mothers, "Fête des pères": nth_sunday(y, 6, 3), "Passage à l'heure d'été": last_sunday(y, 3),
            "Passage à l'heure d'hiver": last_sunday(y, 10), "Jour de l'an": D(y, 1, 1), "Fête du Travail": D(y, 5, 1), "Victoire 1945": D(y, 5, 8),
            "Fête nationale": D(y, 7, 14), "Assomption": D(y, 8, 15), "Toussaint": D(y, 11, 1), "Armistice": D(y, 11, 11), "Noël": D(y, 12, 25)}


def test_precis_H_fetes_2015_2045(h):
    c = Cases("H-fetes")
    d, p = blank(h)
    years = list(range(2015, 2046))
    got = call(p, "/js/widgets/radar.js", "feteList", [[y] for y in years])
    for y, lst in zip(years, got):
        by = {x["name"]: x["date"] for x in lst}
        for name, date in fetes_oracle(y).items():
            if name in ("Jour de l'an", "Fête du Travail", "Victoire 1945", "Fête nationale", "Assomption", "Toussaint", "Armistice", "Noël") and y % 5:
                continue                                  # jours fixes : vérifiés une année sur cinq
            c.check(f"{y} {name}", by.get(name), date.isoformat())
    d.close()
    return c.done()


# =====================================================================================
# I · Rappel de sauvegarde du dimanche (due) : 7 jours × 6 heures × 7 âges du dernier export + « Plus tard »
# =====================================================================================
DAYMS = 86400000


def due_oracle_backup(now, age, later):
    if later and later > 0:
        return None
    sunday = now.weekday() == 6 and now.hour >= 9
    a = age if age is not None else 10 ** 15
    if sunday and a > 5 * DAYMS:
        return "dimanche"
    if age is not None and a > 8 * DAYMS:
        return "retard"
    return None


def test_precis_I_rappel_dimanche(h):
    c = Cases("I-rappel-dimanche")
    d, p = blank(h)
    cases = []
    for k in range(7):
        base = D(2026, 10, 19) + k * day                   # du lundi 19 au dimanche 25 octobre 2026 (jour du changement d'heure)
        for hh, mi in ((0, 0), (8, 0), (8, 59), (9, 0), (12, 0), (23, 59)):
            for age in (None, DAYMS, 5 * DAYMS, 5 * DAYMS + 60000, 8 * DAYMS, 8 * DAYMS + 60000, 30 * DAYMS):
                cases.append((base.year, base.month, base.day, hh, mi, age, 0))
    for later in (3600000, -3600000, 1):
        for age in (None, 9 * DAYMS):
            cases.append((2026, 10, 25, 10, 0, age, later))
    got = p.evaluate("""async (cases) => { const { initBackup } = await import('/js/widgets/backup.js'); const b = initBackup({ exportFile() {} });
      return cases.map(([y, mo, d, h, mi, age, later]) => { const now = new Date(y, mo - 1, d, h, mi);
        if (age === null) localStorage.removeItem('hub-dernier-export'); else localStorage.setItem('hub-dernier-export', new Date(now.getTime() - age).toISOString());
        localStorage.setItem('hub-sauvegarde-plus-tard', later ? String(now.getTime() + later) : '0'); return b.due(now); }); }""", cases)
    for (y, mo, da, hh, mi, age, later), g in zip(cases, got):
        now = dt.datetime(y, mo, da, hh, mi)
        lab = f"{now:%a %d/%m %H:%M} · export il y a {'jamais' if age is None else round(age / DAYMS, 3)} j" + (f" · plus tard {later:+d} ms" if later else "")
        c.check(lab, g, due_oracle_backup(now, age, later))
    d.close()
    return c.done()


# =====================================================================================
# P · Petites fonctions de dates (mondayOf, daysFrom, dayLabel) et phase de la lune
# =====================================================================================
def test_precis_P_dates_et_lune(h):
    c = Cases("P-dates-lune")
    d, p = blank(h)
    fix_clock(p, 2026, 10, 25, 10)
    today = D(2026, 10, 25)
    ks = [D(2026, 1, 1) + i * 11 * day for i in range(34)] + [D(2026, 3, 29), D(2026, 10, 25), D(2026, 10, 26), D(2028, 2, 29), D(2027, 1, 3)]
    got = call(p, "/js/widgets/when.js", "mondayOf", [[k.isoformat()] for k in ks])
    for k, g in zip(ks, got):
        c.check(f"lundi de la semaine du {k}", g, (k - k.weekday() * day).isoformat())
    ks2 = [today + n * day for n in (-400, -40, -7, -2, -1, 0, 1, 2, 6, 7, 30, 157, 365)] + [D(2026, 3, 29), D(2026, 3, 30), D(2027, 3, 28)]
    got = call(p, "/js/widgets/when.js", "daysFrom", [[k.isoformat()] for k in ks2])
    for k, g in zip(ks2, got):
        c.check(f"jours jusqu'au {k}", g, (k - today).days)
    JO = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]
    def lab(k):
        n = (k - today).days
        if n == 0: return "auj."
        if n == 1: return "dem."
        if n == -1: return "hier"
        if 1 < n < 7: return JO[k.weekday()]
        return f"{k.day:02d}/{k.month:02d}" + (f"/{str(k.year)[2:]}" if k.year != today.year else "")
    got = call(p, "/js/widgets/when.js", "dayLabel", [[k.isoformat()] for k in ks2])
    for k, g in zip(ks2, got):
        c.check(f"étiquette du {k}", g, lab(k))
    # Lune : instants d'éclipses (nouvelle lune = éclipse de soleil, pleine lune = éclipse de lune), à ±0,03 de phase
    ecl = [("2024-04-08T18:21:00Z", 0), ("2024-03-25T07:00:00Z", 0.5), ("2025-03-14T06:58:00Z", 0.5), ("2025-03-29T10:58:00Z", 0),
           ("2025-09-07T18:11:00Z", 0.5), ("2026-03-03T11:33:00Z", 0.5), ("2026-08-12T17:46:00Z", 0), ("2027-08-02T10:07:00Z", 0)]
    got = p.evaluate("async (l) => { const { moon } = await import('/js/widgets/surprises.js'); return l.map(([t]) => moon(new Date(t))); }", ecl)
    for (t, ph), g in zip(ecl, got):
        dist = min(abs(g["phase"] - ph), abs(g["phase"] - ph - 1), abs(g["phase"] - ph + 1))
        c.ok(f"lune {t} (attendu {'nouvelle' if ph == 0 else 'pleine'})", dist <= 0.03 and g["name"] == ("Nouvelle lune" if ph == 0 else "Pleine lune"), f"→ phase {g['phase']:.3f} « {g['name']} »")
    d.close()
    return c.done()


# =====================================================================================
# J · 20 pièges XSS × 7 endroits où un texte s'affiche (4 tours de 5 pièges)
# =====================================================================================
def marker(n):
    return f"(top.__x=top.__x||{{}})[{n}]=1"


XSS = [lambda M: f'<img src=x onerror="{M}">', lambda M: f'<svg onload="{M}">', lambda M: f"<script>{M}</script>",
       lambda M: f'"><img src=x onerror="{M}">', lambda M: f"'><img src=x onerror='{M}'>", lambda M: f'<iframe src="javascript:{M}"></iframe>',
       lambda M: f"<details open ontoggle={M}>", lambda M: f"<body onload={M}>", lambda M: f"<input autofocus onfocus={M}>",
       lambda M: f'<a href="javascript:{M}">x</a>', lambda M: f"<math><mtext><table><mglyph><style><img src=x onerror={M}>",
       lambda M: f"<style>@import 'x'</style><img src=x onerror={M}>", lambda M: f"</textarea><img src=x onerror={M}>",
       lambda M: f"</title><img src=x onerror={M}>", lambda M: "${" + M + "}{{constructor.constructor('" + M + "')()}}",
       lambda M: f"<video><source onerror={M}></video>", lambda M: f'<object data="javascript:{M}"></object>',
       lambda M: f"<marquee onstart={M}>x</marquee>", lambda M: f"&lt;img src=x onerror={M}&gt;",
       lambda M: f"<svg><animate onbegin={M} attributeName=x dur=1s></svg>"]
SURF = ["note", "tâche", "rendez-vous", "favori", "groupe de favoris", "anniversaire", "habitude"]


def test_precis_J_xss_7_endroits(h):
    c = Cases("J-xss")
    h.mock = make_mock()
    d = h.device(); p = d.page()
    for rnd in range(4):
        idx = list(range(rnd * 5, rnd * 5 + 5))
        pay = {s: [(si * 100 + i, XSS[i](marker(si * 100 + i))) for i in idx] for si, s in enumerate(SURF)}
        ev(p, """const s = await import('/js/store/storage.js'); const now = Date.now(), P = arg;
          for (const c of ['notes', 'tasks', 'events', 'favs']) await s.store.delMany(c, (await s.store.all(c)).map(x => x.id));
          const t = new Date(), k = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
          const md = (n) => { const x = new Date(now + n * 864e5); return String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
          await s.store.putMany('notes', P['note'].map(([n, v]) => ({ id: 'xn' + n, text: v, pinned: false, created: now, updated: now })));
          await s.store.putMany('tasks', P['tâche'].map(([n, v]) => ({ id: 'xt' + n, text: v, done: false, prio: 1, due: k, remindAt: null, created: now, doneAt: null })));
          await s.store.putMany('events', P['rendez-vous'].map(([n, v], i) => ({ id: 'xe' + n, title: v, date: k, start: '1' + i + ':00', end: null, created: now })));
          await s.store.putMany('favs', P['favori'].map(([n, v], i) => ({ id: 'xf' + n, title: v, url: 'https://piege.test/' + n, group: P['groupe de favoris'][i][1], created: now })));
          await s.store.put('kv', { id: 'radar-dates', items: P['anniversaire'].map(([n, v], i) => ({ id: 'xb' + n, name: v, md: md(i + 1), year: null })) });
          await s.store.put('kv', { id: 'rituels-config', habits: P['habitude'].map(([n, v]) => ({ id: 'xh' + n, name: v, goal: 2, unit: 'x' })) });
          return true;""", pay)
        p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
        p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(1200)
        p.evaluate("const b = document.getElementById('agband'); b && b.click()"); p.wait_for_timeout(600)
        p.evaluate("document.querySelectorAll('.win[data-id=\"favs\"] .fg button, .win[data-id=\"favs\"] [data-g]').forEach(b => b.click())"); p.wait_for_timeout(300)
        fired = p.evaluate("Object.keys(window.__x || {}).map(Number)")
        txt = p.evaluate("document.body.innerText")
        for s, lst in pay.items():
            for n, v in lst:
                c.ok(f"tour {rnd + 1} · {s} · piège n°{n % 100 + 1} ne s'exécute pas", n not in fired, f"(piège : {v[:50]})")
            c.ok(f"tour {rnd + 1} · {s} : texte affiché tel quel", any(v[:12] in txt for _, v in lst) or s in ("groupe de favoris", "rendez-vous"), "(aucun piège visible en texte)")
        bad = p.evaluate("[...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name) && a.value.includes('__x'))).map(e => e.tagName)")
        c.ok(f"tour {rnd + 1} · aucune balise piégée insérée", not bad, str(bad[:5]))
    c.ok("aucune erreur console", not d.errors, str(d.errors[:3]))
    d.close()
    return c.done()


# =====================================================================================
# K · 14 formes de liens × 4 endroits (favori, bandeau d'actu, article de veille, page en direct)
# =====================================================================================
LINKS = ["javascript:{M}", "JAVASCRIPT:{M}", " javascript:{M}", "\tjavascript:{M}", "java\nscript:{M}", "data:text/html,<script>{M}</script>",
         "vbscript:msgbox(1)", "file:///etc/passwd", "blob:https://x.test/y", "//evil.test/x", "https://ok.test/a", "http://ok.test/b", "HTTPS://OK.TEST/C",
         "  https://ok.test/espaces  "]


def allowed(u):
    return re.match(r"https?://", u.strip(), re.I) is not None


def test_precis_K_liens_4_endroits(h):
    c = Cases("K-liens")
    urls = [u.replace("{M}", marker(9000 + i)) for i, u in enumerate(LINKS)]
    flux = json.loads(json.dumps(FLUX))
    flux["actus"] = [{"titre": f"K{i}", "lien": u, "date": f"2026-10-24T10:{i:02d}:00Z", "cat": "TEST", "couleur": "var(--cyan)", "source": "test"} for i, u in enumerate(urls)]
    flux["sites"][0]["articles"] = [{"titre": f"A{i}", "lien": u, "date": f"2026-10-24T09:{i:02d}:00Z"} for i, u in enumerate(urls)][:5]
    h.mock = make_mock(flux)
    d = h.device(); p = d.page()
    ev(p, "const s = await import('/js/store/storage.js'); await s.store.putMany('favs', arg.map((u, i) => ({ id: 'fk' + i, title: 'K' + i, url: u, group: 'Liens', created: i })));", urls)
    p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
    p.wait_for_function("document.querySelectorAll('.ticker .run a.it').length > 0", timeout=10000)
    p.evaluate("document.activeElement && document.activeElement.blur()"); p.keyboard.press("2"); p.wait_for_timeout(1200)
    favs = p.evaluate("[...document.querySelectorAll('.win[data-id=\"favs\"] a[data-id^=\"fk\"]')].reduce((o, a) => (o[a.dataset.id] = a.getAttribute('href'), o), {})")
    tick = p.evaluate("[...document.querySelectorAll('.ticker .run a.it')].reduce((o, a) => (o[a.lastChild.textContent] = a.getAttribute('href'), o), {})")
    arts = p.evaluate("[...document.querySelectorAll('.win[data-id=\"watch\"] .warts a')].reduce((o, a) => (o[a.querySelector('span').textContent] = a.getAttribute('href'), o), {})")
    for i, u in enumerate(urls):
        exp = u.strip() if allowed(u) else None
        c.check(f"favori {LINKS[i]!r}", favs.get(f"fk{i}", "absent"), exp)
        c.check(f"bandeau {LINKS[i]!r}", tick.get(f"K{i}", "absent"), exp)
        if i < 5:
            c.check(f"veille {LINKS[i]!r}", arts.get(f"A{i}", "absent"), exp)
    # clic sur chaque favori et chaque titre : rien ne s'exécute
    p.evaluate("document.querySelectorAll('.win[data-id=\"favs\"] a[data-id^=\"fk\"], .ticker .run a.it, .win[data-id=\"watch\"] .warts a').forEach(a => { if (!/^https?:/i.test(a.getAttribute('href') || '')) a.click(); })")
    p.wait_for_timeout(500)
    for i, u in enumerate(urls):
        p.evaluate("u => localStorage.setItem('hub-web-url', u)", u)
        p.reload(); p.wait_for_function("window.__hub && document.body.classList.contains('ready')", timeout=40000)
        src = p.evaluate("(document.querySelector('.win[data-id=\"web\"] iframe') || {}).src || ''")
        c.ok(f"page en direct {LINKS[i]!r} : seulement http(s)", src == "" or re.match(r"https?://", src) is not None, f"→ src {src!r}")
        if allowed(u):
            c.ok(f"page en direct {LINKS[i]!r} affichée", src.lower().rstrip("/") == u.strip().lower().rstrip("/"), f"→ src {src!r}")
    fired = p.evaluate("Object.keys(window.__x || {})")
    c.ok("aucun lien piégé exécuté", not fired, str(fired))
    d.close()
    return c.done()


# =====================================================================================
# L · Coffre : chiffrement aller-retour, falsification, phrases voisines, clé de secours, réglages privés, exports
# =====================================================================================
def rnd_obj(r, depth=0):
    pool = ["", "é", "😀", "\u0000", "\ud83d", "中文", "a" * 3000, "<b>", '"\\', "‮", "ﷺ", "👨‍👩‍👧"]
    k = r.randint(0, 5) if depth < 2 else 0
    return {f"k{j}{r.choice(pool)[:3]}": (rnd_obj(r, depth + 1) if r.random() < 0.3 and depth < 2 else
                                          r.choice([r.choice(pool), r.randint(-10 ** 12, 10 ** 12), r.random(), True, False, None, [r.choice(pool), 1]]))
            for j in range(k + 1)}


def test_precis_L_coffre(h):
    c = Cases("L-coffre")
    d, p = blank(h)
    code = ev(p, "const { vault } = await import('/js/store/vault.js'); return await vault.create(arg);", PHRASE)
    r = random.Random(2026)
    objs = [rnd_obj(r) for _ in range(40)]
    back = ev(p, """const { vault } = await import('/js/store/vault.js');
      return await Promise.all(arg.map(async (o, i) => { const rec = await vault.seal({ id: 'r' + i, _m: i, ...o });
        const raw = JSON.stringify(Object.keys(rec)); const b = await vault.open(rec); delete b.id; delete b._m; return [raw, JSON.stringify(b)]; }));""", objs)
    for i, (o, (keys, b)) in enumerate(zip(objs, back)):
        c.check(f"objet chiffré n°{i + 1} : seuls id, _m et _e restent visibles", keys, '["id","_m","_e"]')
        c.check(f"objet n°{i + 1} : identique après chiffrement puis déchiffrement", json.loads(b), json.loads(json.dumps(o)))
    blobs = ev(p, """const { vault } = await import('/js/store/vault.js'); const h = async (b) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))).join(',');
      const out = []; for (const n of [0, 1, 1023, 65536, 1000001]) { const u = new Uint8Array(n); for (let i = 0; i < n; i += 65536) crypto.getRandomValues(u.subarray(i, i + 65536));
        const b = new Blob([u], { type: 'image/png' }); const rec = await vault.seal({ id: 'b' + n, _m: 1, blob: b, nom: 'img' }); const o = await vault.open(rec);
        out.push([n, await h(b) === await h(o.blob), o.blob.type, !('blob' in rec) && !!rec._b]); } return out;""")
    for n, same, typ, hidden in blobs:
        c.ok(f"image de {n} octets identique après aller-retour", same and typ == "image/png" and hidden, f"(identique {same}, type {typ}, masquée {hidden})")
    tam = ev(p, """const { vault } = await import('/js/store/vault.js'); const rec = await vault.seal({ id: 't', _m: 1, text: 'secret factice' }); const L = rec._e.length, out = [];
      for (const pos of [0, 5, 11, 12, 13, 20, Math.floor(L / 2), L - 17, L - 16, L - 9, L - 1]) { const e = new Uint8Array(rec._e); e[pos] ^= 1; try { await vault.open({ ...rec, _e: e }); out.push(['octet ' + pos, 'ouvert']); } catch (x) { out.push(['octet ' + pos, 'refusé']); } }
      for (const [nom, e] of [['tronqué', rec._e.slice(0, L - 1)], ['vide', new Uint8Array(0)], ['allongé', new Uint8Array([...rec._e, 0])], ['IV seul', rec._e.slice(0, 12)]]) {
        try { await vault.open({ ...rec, _e: e }); out.push([nom, 'ouvert']); } catch (x) { out.push([nom, 'refusé']); } }
      return out;""")
    for nom, res in tam:
        c.check(f"enregistrement falsifié ({nom})", res, "refusé")
    nfc = unicodedata.normalize("NFC", PHRASE)
    variants = [(PHRASE, True), ("", False), (" " + PHRASE, False), (PHRASE + " ", False), (PHRASE.upper(), False), (PHRASE[:-1], False), (PHRASE + "x", False),
                (PHRASE.replace(" ", "  "), False), ("girafe", False), ("x" * 1000, False)]
    got = ev(p, "const { vault } = await import('/js/store/vault.js'); return await Promise.all(arg.map(([v]) => vault.check(v)));", variants)
    for (v, e), g in zip(variants, got):
        c.check(f"phrase {v[:30]!r}", g, e)
    resc = [(code, True), (code.lower(), True), (code.replace("-", " "), True), (code.replace("-", ""), True), ("  " + code + "  ", True), (code.replace("-", "--"), True),
            (code[:-1] + ("A" if code[-1] != "A" else "B"), False), (code[:-4], False), ("", False), (PHRASE, False)]
    got = ev(p, "const { vault } = await import('/js/store/vault.js'); return await Promise.all(arg.map(([v]) => vault.checkRescue(v)));", resc)
    for (v, e), g in zip(resc, got):
        c.check(f"clé de secours {v[:34]!r}", g, e)
    keys = ["hub-meteo-lieu", "hub-mails", "hub-web-url", "hub-radios", "hub-secret-ia", "hub-secret-mails", "hub-synchro", "hub-video-file", "hub-musique-source", "hub-constellation"]
    vals = ["Ville é 😀", '{"a":1}', "https://x.test/", "[]", "clé-factice", "{}", '{"token":"t"}', "[1]", '{"n":"FIP"}', "x" * 5000]
    got = ev(p, """const { vault } = await import('/js/store/vault.js'); const [K, V] = arg; K.forEach((k, i) => vault.lsSet(k, V[i])); await vault.flush();
      vault.lsSet('hub-actu-pause', '1'); return K.map((k) => [vault.lsGet(k), localStorage.getItem(k).startsWith('§1:'), localStorage.getItem(k).includes(V[K.indexOf(k)].slice(0, 8))]).concat([[localStorage.getItem('hub-actu-pause')]]);""", [keys, vals])
    for k, v, g in zip(keys, vals, got):
        c.ok(f"réglage privé {k} : relu identique, chiffré sur le disque", g[0] == v and g[1] and not (g[2] and len(v) >= 8), str(g[:2]))
    c.check("réglage non privé (hub-actu-pause) reste lisible", got[-1][0], "1")
    exp = ev(p, """const { vault } = await import('/js/store/vault.js'); const d = { format: 'hub-donnees', formatVersion: 1, appVersion: 't', exportedAt: '2026-10-25', data: { notes: [{ id: 'n', text: 'secret' }] } };
      const f = await vault.sealExport(d), out = [];
      for (const s of [arg[0], arg[1], arg[1].toLowerCase(), 'mauvaise phrase']) { const o = await vault.openExport(f, s); out.push(o ? o.d.data.notes[0].text : null); }
      const weak = JSON.parse(JSON.stringify(f)); weak.coffre.pass.iter = 1000; try { await vault.openExport(weak, arg[0]); out.push('accepté'); } catch (e) { out.push(e.message); }
      const bad = JSON.parse(JSON.stringify(f)); bad.data = bad.data.slice(0, -4) + 'AAAA'; try { out.push(await vault.openExport(bad, arg[0]) ? 'ouvert' : 'null'); } catch (e) { out.push('refusé'); }
      out.push(JSON.stringify(f).includes('secret')); return out;""", [PHRASE, code])
    c.check("export chiffré rouvert avec la phrase", exp[0], "secret")
    c.check("export chiffré rouvert avec la clé de secours", exp[1], "secret")
    c.check("export chiffré rouvert avec la clé en minuscules", exp[2], "secret")
    c.check("export chiffré : mauvaise phrase", exp[3], None)
    c.check("export chiffré affaibli (1 000 tours) refusé", exp[4], "Export chiffré non reconnu")
    c.check("export chiffré au contenu modifié refusé", exp[5], "refusé")
    c.check("export chiffré : aucun texte en clair", exp[6], False)
    d.close()
    # Phrase avec accents tapée sous une autre forme Unicode (é composé / e + accent) : même phrase pour la personne
    for made, typed in (("NFC", "NFD"), ("NFD", "NFC")):
        d, p = blank(h)
        ph = "éléphant rosé café 42"
        res = ev(p, """const { vault } = await import('/js/store/vault.js'); await vault.create(arg[0]); return [await vault.check(arg[1]), await vault.check(arg[0])];""",
                 [unicodedata.normalize(made, ph), unicodedata.normalize(typed, ph)])
        c.ok(f"phrase créée en {made}, tapée en {typed} : acceptée", res[0], str(res))
        c.ok(f"phrase créée en {made}, tapée telle quelle : acceptée", res[1], str(res))
        d.close()
    return c.done()


# =====================================================================================
# M · Lecture des fichiers : export du hub, Coffre du Hub, favoris du navigateur
# =====================================================================================
def test_precis_M_lecture_fichiers(h):
    c = Cases("M-fichiers")
    d, p = blank(h)
    ok = '{"format":"hub-donnees","formatVersion":1,"data":{}}'
    Z = {k: 0 for k in ("notes", "tasks", "events", "favs", "kv", "images")}
    R = [(ok, Z), ("﻿" + ok, Z), ("  " + ok + " \n", Z), ("[]", "n'est pas un export"), ("null", "n'est pas un export"), ('"texte"', "n'est pas un export"),
         ('{"format":"hub-donnees"}', "n'est pas un export"), ('{"format":"hub-donnees","data":null}', "n'est pas un export"),
         ('{"format":"hub-donnees","data":[]}', "n'est pas un export"), ('{"format":"hub-donnees","data":"x"}', "n'est pas un export"),
         ('{"format":"hub-donnees","formatVersion":2,"data":{}}', "plus récente"), ('{"format":"hub-donnees","formatVersion":"2","data":{}}', "plus récente"),
         ('{"format":"hub-donnees","formatVersion":0,"data":{}}', Z), ('{"format":"hub-donnees","data":{}}', Z),
         ('{"format":"hub-donnees","data":{"notes":[{},{},{}]}}', {**Z, "notes": 3}), ('{"format":"hub-donnees","data":{"notes":"liste"}}', Z),
         ('{"format":"hub-donnees-chiffre","data":{}}', "n'est pas un export"), (ok + " xyz", "illisible"), ("", "illisible"), ("﻿[]", "n'est pas un export"),
         ('{"format":"HUB-DONNEES","data":{}}', "n'est pas un export"), ('{"format":"hub-donnees","data":{},"exportedAt":"pas une date"}', Z)]
    got = call(p, "/js/store/storage.js", "readExport", [[t] for t, _ in R])
    for (t, e), g in zip(R, got):
        if isinstance(e, dict):
            c.check(f"export {t[:60]!r}", g["counts"] if isinstance(g, dict) else g, e)
        else:
            c.ok(f"export {t[:60]!r} refusé avec un message clair", isinstance(g, tuple) and e in g[1], f"→ {g!r}")
    C = [('{"format":"coffre-hub","sections":{}}', 0), ('﻿{"format":"coffre-hub","sections":{}}', 0), ('{"format":"coffre-hub","sections":null}', "Coffre"),
         ('{"format":"coffre-hub"}', "Coffre"), ('{"format":"hub-donnees","sections":{"sites":[{"nom":"a"}]}}', 1), ('{"format":"hub-donnees","data":{}}', "Coffre"),
         ('{"format":"coffre-hub","sections":{"sites":[{"nom":5},{"nom":"  "},null,{"nom":"ok"},"x"]}}', 1),
         ('{"format":"coffre-hub","sections":{"sites":"pas une liste"}}', 0), ('{"format":"coffre-hub","sections":{"inconnu":[{"nom":"a"}]}}', 0), ("pas du json", "Coffre")]
    got = call(p, "/js/ui/coffre.js", "readCoffre", [[t] for t, _ in C])
    for (t, e), g in zip(C, got):
        if isinstance(e, int):
            c.check(f"Coffre {t[:60]!r} : éléments lus", sum(len(v) for v in g.values()) if isinstance(g, dict) else g, e)
        else:
            c.ok(f"Coffre {t[:60]!r} refusé", isinstance(g, tuple) and e in g[1], f"→ {g!r}")
    long = '{"format":"coffre-hub","sections":{"sites":[{"nom":"' + "n" * 300 + '","lien":"https://' + "l" * 1200 + '","cat":"' + "c" * 90 + '","note":"' + "o" * 400 + '"}]}}'
    g = call(p, "/js/ui/coffre.js", "readCoffre", [[long]])[0]["sites"][0]
    c.check("Coffre : nom coupé à 200", len(g["nom"]), 200); c.check("Coffre : lien coupé à 1000", len(g["lien"]), 1000)
    c.check("Coffre : catégorie coupée à 60", len(g["cat"]), 60); c.check("Coffre : note coupée à 300", len(g["note"]), 300)
    head = "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>\n"
    bm = head + """<DL><p>
<DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Barre de favoris</H3>
<DL><p><DT><A HREF="https://a.test/" ADD_DATE="1700000000">Site A</A>
<DT><A HREF="javascript:alert(1)">Marque-page piégé</A>
<DT><A HREF="data:text/html,x">Data</A>
<DT><A HREF="place:sort=8">Firefox</A>
<DT><A HREF="HTTPS://MAJ.TEST/">Majuscules</A>
<DT><A HREF="  https://espaces.test/  "></A>
<DT><H3>Tech</H3><DL><p><DT><H3>IA</H3><DL><p><DT><A HREF="http://ia.test/">IA &amp; co &lt;b&gt;</A></DL><p></DL><p>
</DL><p>
<DT><H3>Autres favoris</H3>
<DL><p><DT><A HREF="https://b.test/">B</A></DL><p>
</DL><p>"""
    got = call(p, "/js/store/bookmarks.js", "parseBookmarks", [[bm], ["<html><body>pas des favoris</body></html>"], [head + "<DL></DL>"], ['<DT><A HREF="https://seul.test/">Seul</A>']])
    lst = got[0]
    by = {x["url"]: x for x in lst} if isinstance(lst, list) else {}
    c.check("favoris du navigateur : liens gardés", sorted(by), sorted(["https://a.test/", "HTTPS://MAJ.TEST/", "https://espaces.test/", "http://ia.test/", "https://b.test/"]))
    c.check("favoris : javascript:, data:, place: écartés", [u for u in by if not u.lower().startswith("http")], [])
    c.check("favoris : date d'ajout en millisecondes", by.get("https://a.test/", {}).get("added"), 1700000000000)
    c.check("favoris : dossier imbriqué", by.get("http://ia.test/", {}).get("path"), ["Barre de favoris", "Tech", "IA"])
    c.check("favoris : titre avec &amp; décodé, balise gardée en texte", by.get("http://ia.test/", {}).get("title"), "IA & co <b>")
    c.check("favoris : titre vide → nom du site", by.get("https://espaces.test/", {}).get("title"), "espaces.test")
    c.ok("fichier qui n'est pas un export de favoris refusé", isinstance(got[1], tuple) and "favoris" in got[1][1], repr(got[1]))
    c.check("export de favoris vide", got[2], [])
    c.check("favoris sans dossier", [x["url"] for x in got[3]] if isinstance(got[3], list) else got[3], ["https://seul.test/"])
    G = [([], "Favoris"), (["Barre de favoris"], "Barre de favoris"), (["Bookmarks bar"], "Barre de favoris"), (["Other bookmarks"], "Autres favoris"),
         (["Menu des marque-pages"], "Autres favoris"), (["Barre de favoris", "Tech"], "Tech"), (["X", "Barre personnelle"], "Barre de favoris"), (["Recettes"], "Recettes")]
    got = call(p, "/js/store/bookmarks.js", "groupOf", [[x] for x, _ in G])
    for (x, e), g in zip(G, got):
        c.check(f"groupe de {x}", g, e)
    d.close()
    return c.done()


# =====================================================================================
# N · Import d'un export abîmé : chaque champ reprend un type sûr
# =====================================================================================
def test_precis_N_import_champs(h):
    c = Cases("N-import-champs")
    d, p = blank(h)
    data = {"format": "hub-donnees", "formatVersion": 1, "data": {
        "notes": [{"id": "n1", "text": 42}, {"id": "n2", "text": None, "pinned": "oui", "updated": "hier"}, {"id": "n3", "text": "ok", "pinned": True, "created": 5}, {"id": 7, "text": "id numérique"}, None],
        "tasks": [{"id": "t1", "text": None, "due": "pas une date"}, {"id": "t2", "text": "a", "due": "2026-13-45"}, {"id": "t3", "text": "b", "due": "2026-02-30"},
                  {"id": "t4", "text": "c", "due": "2026-10-25", "remindAt": 12, "prio": "1", "done": "true"}, {"id": "t5", "text": "d", "remindAt": "2026-10-25T18:00", "prio": 0, "done": True}],
        "events": [{"id": "e1", "title": "sans date"}, {"id": "e2", "title": "x", "date": "2026-02-31"}, {"id": "e3", "title": {"x": 1}, "date": "2026-10-25", "start": "99:99", "end": "9:00"},
                   {"id": "e4", "title": "ok", "date": "2026-10-25", "start": "09:00", "end": "10:30"}],
        "favs": [{"id": "f1", "url": None}, {"id": "f2", "url": "javascript:alert(1)", "title": "x"}, {"id": "f3", "url": "https://ok.test/", "title": 5, "group": ["g"]},
                 {"id": "f4", "url": " data:text/html,x "}],
        "kv": [{"id": "k1", "libre": {"a": [1, 2]}}],
        "images": [{"id": "i1", "blob": "data:text/html,<script>1</script>"}, {"id": "i2", "blob": 7}, {"id": "i3", "blob": "data:image/png;base64,iVBORw0KGgo="}]}}
    got = ev(p, """const s = await import('/js/store/storage.js'); const r = s.readExport(JSON.stringify(arg)); await s.importAll(r.d); const out = {};
      for (const c of s.COLLECTIONS) out[c] = Object.fromEntries((await s.store.all(c)).map(x => [x.id, c === 'images' ? { type: x.blob && x.blob.type } : x])); return out;""", data)
    N, T, E, F = got["notes"], got["tasks"], got["events"], got["favs"]
    c.check("note : texte numérique → texte", N.get("n1", {}).get("text"), "42")
    c.check("note : texte vide", N.get("n2", {}).get("text"), "")
    c.check("note : épinglée « oui » → non", N.get("n2", {}).get("pinned"), False)
    c.check("note : date « hier » → 0", N.get("n2", {}).get("updated"), 0)
    c.check("note correcte gardée", (N.get("n3", {}).get("text"), N.get("n3", {}).get("pinned")), ("ok", True))
    c.check("note à identifiant numérique écartée", "7" in N or 7 in N, False)
    c.check("tâche : texte vide", T.get("t1", {}).get("text"), "")
    c.check("tâche : échéance illisible → aucune", T.get("t1", {}).get("due"), None)
    c.check("tâche : 13e mois → aucune", T.get("t2", {}).get("due"), None)
    c.check("tâche : 30 février → aucune", T.get("t3", {}).get("due"), None)
    c.check("tâche : rappel numérique → aucun", T.get("t4", {}).get("remindAt"), None)
    c.check("tâche : urgence « 1 » → 1", T.get("t4", {}).get("prio"), 1)
    c.check("tâche : faite « true » (texte) → non", T.get("t4", {}).get("done"), False)
    c.check("tâche correcte gardée", (T.get("t5", {}).get("remindAt"), T.get("t5", {}).get("done")), ("2026-10-25T18:00", True))
    c.check("rendez-vous sans date écarté", "e1" in E, False)
    c.check("rendez-vous au 31 février écarté", "e2" in E, False)
    c.check("rendez-vous : heure 99:99 → aucune", E.get("e3", {}).get("start"), None)
    c.check("rendez-vous : heure « 9:00 » → aucune", E.get("e3", {}).get("end"), None)
    c.check("rendez-vous : titre objet → texte", isinstance(E.get("e3", {}).get("title"), str), True)
    c.check("rendez-vous correct gardé", (E.get("e4", {}).get("start"), E.get("e4", {}).get("end")), ("09:00", "10:30"))
    c.check("favori sans adresse écarté", "f1" in F, False)
    c.check("favori javascript: écarté", "f2" in F, False)
    c.check("favori data: écarté", "f4" in F, False)
    c.check("favori : titre et groupe remis en texte", (F.get("f3", {}).get("title"), F.get("f3", {}).get("group")), ("5", "g"))
    c.check("valeur libre (kv) gardée telle quelle", got["kv"].get("k1", {}).get("libre"), {"a": [1, 2]})
    c.check("images : seule la vraie image reste", sorted(got["images"]), ["i3"])
    c.check("image : type image/png", got["images"].get("i3", {}).get("type"), "image/png")
    c.ok("aucune erreur", not d.errors, str(d.errors[:3]))
    d.close()
    return c.done()


# =====================================================================================
# O · Synchro : 54 situations (version locale, distante, suppressions des deux côtés) — le plus récent gagne
# =====================================================================================
FAKE_GH = """(() => { if (window.__ghOn) return; window.__ghOn = true; window.__gist = null; const real = window.fetch;
  window.fetch = async (url, o = {}) => { url = String(url); if (!url.startsWith('https://api.github.com/')) return real(url, o);
    const path = url.slice(22), m = o.method || 'GET', J = (x, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (m === 'GET' && path.startsWith('/gists?')) return J(window.__gist ? [{ id: 'g1', description: 'hub-synchro (données chiffrées du hub, ne pas modifier)', files: { 'hub-synchro.txt': {} } }] : []);
    if (m === 'GET' && path === '/gists/g1') return J({ id: 'g1', files: { 'hub-synchro.txt': { content: window.__gist, truncated: false } } });
    if (m === 'PATCH' || m === 'POST') { window.__gist = JSON.parse(o.body).files['hub-synchro.txt'].content; return J({ id: 'g1' }); }
    return J({}, 404); }; })()"""


def sync_oracle(l, r, lt, rt):
    ev_ = [(t, 0, txt) for t, txt in ((l, "L"), (r, "R")) if t] + [(t, 1, None) for t in (lt, rt) if t]
    if not ev_:
        return None
    return max(ev_)[2]                           # le plus récent ; à égalité, la suppression (1) l'emporte


def test_precis_O_synchro_matrice(h):
    c = Cases("O-synchro")
    d, p = blank(h)
    p.evaluate(FAKE_GH)
    T = 1_760_000_000_000
    combos = [(l, r, lt, rt) for l in (None, 100, 300) for r in (None, 200) for lt in (None, 50, 250) for rt in (None, 150, 350)
              # états impossibles écartés : un appareil ne garde pas un élément qu'il a lui-même supprimé APRÈS sa dernière modification
              if not (l and lt and lt >= l) and not (r and rt and rt >= r)]
    got = ev(p, """const s = await import('/js/store/storage.js'), sy = await import('/js/store/sync.js'); const [combos, T, phrase] = arg; const out = [];
      localStorage.setItem('hub-synchro', JSON.stringify({ token: 'jeton-factice', phrase, gist: 'g1' }));
      const at = (v) => v ? T + v * 1000 : 0;
      for (const [l, r, lt, rt] of combos) {
        await s.store.delMany('notes', (await s.store.all('notes')).map(n => n.id), true); localStorage.removeItem('hub-synchro-suppressions');
        if (l) await s.store.put('notes', { id: 'x', text: 'L', _m: at(l) }, true);
        if (lt) localStorage.setItem('hub-synchro-suppressions', JSON.stringify({ notes: { x: at(lt) } }));
        window.__gist = await sy.seal({ v: 1, at: 1, data: { notes: r ? [{ id: 'x', text: 'R', _m: at(r) }] : [], tasks: [], events: [], favs: [], kv: [] }, tomb: rt ? { notes: { x: at(rt) } } : {} }, phrase);
        let err = null; try { await sy.sync.run(); } catch (e) { err = e.message; }
        const loc = await s.store.get('notes', 'x'), pushed = await sy.open(window.__gist, phrase), px = pushed.data.notes.find(n => n.id === 'x');
        out.push([loc ? loc.text : null, px ? px.text : null, err]);
      }
      return out;""", [combos, T, "phrase de synchro factice"])
    for (l, r, lt, rt), (loc, pushed, err) in zip(combos, got):
        lab = f"local {l or '—'} · distant {r or '—'} · supprimé ici {lt or '—'} · supprimé là-bas {rt or '—'}"
        e = sync_oracle(l, r, lt, rt)
        c.check(lab + " → sur l'appareil", loc, e)
        c.check(lab + " → envoyé à l'autre appareil", pushed, e)
        if err:
            c.ok(lab + " sans erreur", False, err)
    d.close()
    return c.done()
