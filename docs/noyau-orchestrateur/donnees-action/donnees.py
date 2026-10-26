#!/usr/bin/env python3
"""Tâche « Données du hub » (MODÈLE DÉSACTIVÉ, voir donnees.yml).

Usage : python3 donnees.py sources.json dossier_de_sortie
Hors ligne (essais) : variable DONNEES_FIXTURES=<dossier> → lit <id>.json dans ce dossier au lieu d'interroger le réseau.

Pour chaque série active : télécharge (https, hôtes de la liste fixe, 2 Mo au plus, 15 s), normalise au format « jeu » du hub
(colonnes date + valeur, jamais de zéro par défaut : valeur absente = null) et écrit <id>.json ; écrit index.json.
Une série en échec garde sa version précédente (si elle existe) et l'erreur est notée dans index.json. Sans clé, sans secret.
"""
import json, os, re, sys, urllib.error, urllib.request, urllib.parse
from datetime import datetime, timezone

HOTES = {"api.db.nomics.world", "api.worldbank.org"}
MAX_OCTETS = 2_000_000
RE_ID = re.compile(r"^[a-z0-9-]{2,60}$")
INDICATEURS = {  # même liste que js/noyau/donnees.js (INDICATEURS_BM)
    "SP.POP.TOTL": "habitants", "NY.GDP.MKTP.CD": "USD courants", "NY.GDP.PCAP.CD": "USD courants", "FP.CPI.TOTL.ZG": "% par an",
    "SL.UEM.TOTL.ZS": "% de la population active", "SP.DYN.LE00.IN": "années", "EN.ATM.CO2E.PC": "tonnes par habitant",
}
LICENCES = {"banque_mondiale": "CC BY 4.0", "dbnomics": "selon le fournisseur (INSEE : Licence Ouverte Etalab)"}


class Erreur(Exception):
    pass


def maintenant():
    return datetime.now(timezone.utc)


def lire_json(url, id_serie):
    f = os.environ.get("DONNEES_FIXTURES")
    if f:
        chemin = os.path.join(f, id_serie + ".json")
        if not os.path.exists(chemin):
            raise Erreur("aucune réponse simulée")
        with open(chemin, encoding="utf-8") as fh:
            return json.load(fh)
    u = urllib.parse.urlparse(url)
    if u.scheme != "https" or u.hostname not in HOTES:
        raise Erreur("adresse refusée (hôte hors liste)")
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "hub-donnees"})
    with urllib.request.urlopen(req, timeout=15) as r:
        brut = r.read(MAX_OCTETS + 1)
    if len(brut) > MAX_OCTETS:
        raise Erreur("réponse trop volumineuse")
    try:
        return json.loads(brut.decode("utf-8"))
    except ValueError:
        raise Erreur("ce n'est pas du JSON")


def date_serie(p):
    """Même règle que dateSerie() de donnees.js : AAAA, AAAA-MM, AAAA-MM-JJ ; trimestres et semestres ramenés à leur premier mois."""
    s = str(p).strip()
    if re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", s):
        return s, False
    m = re.fullmatch(r"(\d{4})-?Q([1-4])", s, re.I)
    if m:
        return "%s-%02d" % (m.group(1), (int(m.group(2)) - 1) * 3 + 1), True
    m = re.fullmatch(r"(\d{4})-?S([12])", s, re.I)
    if m:
        return "%s-%s" % (m.group(1), "01" if m.group(2) == "1" else "07"), True
    raise Erreur("date non reconnue « %s »" % s[:20])


def nombre(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf") else None


def jeu(titre, unite, lignes, nom_source, maj, url, licence, approx_note=""):
    if not lignes:
        raise Erreur("aucune donnée")
    if all(l[1] is None for l in lignes):
        raise Erreur("que des valeurs manquantes")
    lignes = sorted(lignes, key=lambda l: l[0])
    j = maintenant().strftime("%Y-%m-%d")
    notes = approx_note + ("" if maj else " · mise à jour de la source inconnue (date de la requête)")
    # mêmes règles que lire() de donnees.js : les mentions d'honnêteté vont dans le NOM de la source (120 signes), pas dans la période (60 signes)
    nom = nom_source[:120 - len(notes)] + notes
    return {
        "titre": titre[:120], "unite": unite[:40],
        "colonnes": [{"id": "date", "libelle": "Date", "type": "date"}, {"id": "valeur", "libelle": titre[:60], "type": "nombre"}],
        "lignes": lignes,
        "source": {"nom": nom, "maj": maj or j, "periode": ("%s → %s" % (lignes[0][0], lignes[-1][0]))[:60],
                   "url": url, "licence": licence[:80], "verifie": True},
        "exemple": False,
    }


def banque_mondiale(s):
    pays, ind = s["pays"], s["indicateur"]
    if not re.fullmatch(r"[A-Z]{2,3}", pays) or not re.fullmatch(r"[A-Z0-9.]{4,30}", ind):
        raise Erreur("pays ou indicateur mal écrit")
    base = "https://api.worldbank.org/v2/country/%s/indicator/%s" % (pays, ind)
    rep = lire_json(base + "?format=json&per_page=200", s["id"])
    if isinstance(rep, list) and rep and isinstance(rep[0], dict) and rep[0].get("message"):
        raise Erreur("refusé par la Banque mondiale")
    if not (isinstance(rep, list) and len(rep) > 1 and isinstance(rep[1], list)):
        raise Erreur("forme inattendue")
    lignes = []
    for r in rep[1]:
        if not isinstance(r, dict) or not re.fullmatch(r"\d{4}", str(r.get("date", ""))):
            raise Erreur("date non reconnue")
        lignes.append([str(r["date"]), nombre(r.get("value"))])
    lu = rep[0].get("lastupdated") if isinstance(rep[0], dict) else None
    maj = lu if isinstance(lu, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", lu) else None
    unite = s.get("unite") or INDICATEURS.get(ind, "unité non précisée")
    return jeu(s["nom"], unite, lignes, "Banque mondiale · %s/%s" % (pays, ind), maj, base, LICENCES["banque_mondiale"])


def dbnomics(s):
    serie = s["serie"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}/[A-Za-z0-9_.-]{1,60}/[A-Za-z0-9_.@+-]{1,120}", serie):
        raise Erreur("identifiant mal écrit")
    url = "https://api.db.nomics.world/v22/series/%s?observations=1" % serie
    rep = lire_json(url, s["id"])
    try:
        d = rep["series"]["docs"][0]
        periodes, valeurs = d["period"], d["value"]
    except (KeyError, IndexError, TypeError):
        raise Erreur("forme inattendue")
    if not isinstance(periodes, list) or not isinstance(valeurs, list) or len(periodes) != len(valeurs):
        raise Erreur("périodes et valeurs de tailles différentes")
    lignes, approx = [], False
    for p, v in zip(periodes, valeurs):
        dt, a = date_serie(p)
        approx = approx or a
        lignes.append([dt, nombre(v)])
    ia = d.get("indexed_at")
    maj = ia[:10] if isinstance(ia, str) and re.match(r"\d{4}-\d{2}-\d{2}", ia) else None
    lic = "Licence Ouverte Etalab 2.0 (INSEE, via DBnomics)" if serie.startswith("INSEE/") else LICENCES["dbnomics"]
    return jeu(str(d.get("series_name") or s["nom"]), s.get("unite") or "unité non précisée", lignes, "DBnomics · " + serie, maj, url.split("?")[0], lic,
               " · trimestres ou semestres datés de leur premier mois" if approx else "")


TYPES = {"banque_mondiale": banque_mondiale, "dbnomics": dbnomics}


def main(argv):
    if len(argv) != 3:
        print(__doc__)
        return 2
    with open(argv[1], encoding="utf-8") as fh:
        conf = json.load(fh)
    sortie = argv[2]
    os.makedirs(sortie, exist_ok=True)
    try:
        with open(os.path.join(sortie, "index.json"), encoding="utf-8") as fh:
            avant = {x["id"]: x for x in json.load(fh).get("series", []) if isinstance(x, dict) and "id" in x}
    except (OSError, ValueError):
        avant = {}
    index, erreurs = [], 0
    for s in conf.get("series", []):
        if not isinstance(s, dict) or s.get("actif") is not True:
            continue
        sid = s.get("id", "")
        if not RE_ID.fullmatch(str(sid)) or s.get("kind") not in TYPES:
            print("ignorée (entrée mal écrite) : %r" % sid)
            erreurs += 1
            continue
        try:
            j = TYPES[s["kind"]](s)
            with open(os.path.join(sortie, sid + ".json"), "w", encoding="utf-8") as fh:
                json.dump(j, fh, ensure_ascii=False)
            index.append({"id": sid, "nom": s["nom"], "maj": j["source"]["maj"], "periode": j["source"]["periode"], "lignes": len(j["lignes"])})
            print("ok  %s (%d lignes)" % (sid, len(j["lignes"])))
        except (Erreur, OSError, ValueError, urllib.error.URLError) as e:
            erreurs += 1
            print("ÉCHEC %s : %s" % (sid, e))
            vieux = avant.get(sid)
            if vieux and os.path.exists(os.path.join(sortie, sid + ".json")):
                index.append({**vieux, "erreur": str(e)[:120]})       # on garde la dernière version, et on le dit
    with open(os.path.join(sortie, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"genere": maintenant().strftime("%Y-%m-%dT%H:%M:%SZ"), "series": index}, fh, ensure_ascii=False, indent=1)
    return 0 if index or not erreurs else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
