#!/usr/bin/env python3
"""Tâche programmée du hub (phase 3) : lit les flux d'actualité et YouTube, vérifie les sites surveillés,
écrit dist-flux/flux.json. Lancé par .github/workflows/flux.yml (GitHub Actions), publié sur la branche « flux ».
Uniquement la bibliothèque standard de Python. Usage local : python3 tools/flux.py [dossier_de_sortie]
"""
import json, sys, time, re, html, urllib.request, urllib.error, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (compatible; HubFlux/1.0; +https://github.com/lulu78440/hub)"
NS = {"a": "http://www.w3.org/2005/Atom", "media": "http://search.yahoo.com/mrss/", "yt": "http://www.youtube.com/xml/schemas/2015"}

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.status

def clean(s, n=220):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or "")).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:n]

def iso(s):
    if not s: return None
    try: return parsedate_to_datetime(s).astimezone(timezone.utc).isoformat()
    except Exception: pass
    try: return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except Exception: return None

def parse_feed(data):
    """RSS 2.0 ou Atom → liste {titre, lien, date, image}."""
    root = ET.fromstring(data)
    out = []
    if root.tag.endswith("rss") or root.find("channel") is not None:
        for it in root.iter("item"):
            img = None
            enc = it.find("enclosure")
            if enc is not None and (enc.get("type") or "").startswith("image"): img = enc.get("url")
            m = it.find("media:content", NS)
            if m is None: m = it.find("media:thumbnail", NS)
            if img is None and m is not None: img = m.get("url")
            out.append({"titre": clean(it.findtext("title")), "lien": (it.findtext("link") or "").strip(), "date": iso(it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date")), "image": img})
    else:
        for e in root.findall("a:entry", NS):
            link = e.find("a:link[@rel='alternate']", NS)
            if link is None: link = e.find("a:link", NS)
            th = e.find("media:group/media:thumbnail", NS)
            vid = e.findtext("yt:videoId", namespaces=NS)
            out.append({"titre": clean(e.findtext("a:title", namespaces=NS)), "lien": link.get("href") if link is not None else "", "date": iso(e.findtext("a:published", namespaces=NS) or e.findtext("a:updated", namespaces=NS)),
                        "image": th.get("url") if th is not None else None, "video": vid, "auteur": clean(e.findtext("a:author/a:name", namespaces=NS), 80)})
    # Seuls les liens web : un flux hostile ne doit pas glisser un lien javascript: ou data: dans le hub
    return [x for x in out if x["titre"] and x["lien"] and re.match(r"https?://", x["lien"], re.I)]

def source_name(url):
    return re.sub(r"^www\.", "", urllib.request.urlparse(url).hostname or url)

def check_site(url):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read(2048); code = r.status
        return {"ok": 200 <= code < 400, "code": code, "ms": int((time.time() - t0) * 1000)}
    except urllib.error.HTTPError as e:
        return {"ok": e.code < 500 and e.code not in (404, 410), "code": e.code, "ms": int((time.time() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "code": 0, "ms": int((time.time() - t0) * 1000), "erreur": type(e).__name__}

def main(out_dir):
    src = json.loads((ROOT / "flux" / "sources.json").read_text(encoding="utf-8"))
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    prev = {}
    try: prev = json.loads((out_dir / "flux.json").read_text(encoding="utf-8"))
    except Exception: pass
    per = int(src.get("par_categorie", 12)); erreurs = []
    actus = []
    for c in src.get("actus", []):
        items = []
        for u in c.get("flux", []):
            try:
                data, _ = fetch(u)
                for it in parse_feed(data)[:per]: it.update(cat=c["cat"], couleur=c.get("couleur", "var(--cyan)"), source=source_name(u)); items.append(it)
            except Exception as e: erreurs.append(f"{u} : {type(e).__name__}")
        items.sort(key=lambda x: x["date"] or "", reverse=True)
        actus += items[:per]
    videos = []
    for ch in src.get("youtube", []):
        cid = ch if isinstance(ch, str) else ch.get("id")
        try:
            data, _ = fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + cid)
            videos += parse_feed(data)[:6]
        except Exception as e: erreurs.append(f"youtube {cid} : {type(e).__name__}")
    videos.sort(key=lambda x: x["date"] or "", reverse=True)
    sites, prev_sites = [], {s["url"]: s for s in prev.get("sites", [])}
    now = datetime.now(timezone.utc).isoformat()
    for s in src.get("sites", []):
        r = check_site(s["url"]); p = prev_sites.get(s["url"], {})
        etat = {"nom": s.get("nom") or source_name(s["url"]), "url": s["url"], **r}
        etat["depuis"] = p.get("depuis") if p.get("ok") == r["ok"] and p.get("depuis") else now
        if s.get("articles"):
            try: data, _ = fetch(s["articles"]); etat["articles"] = parse_feed(data)[:5]
            except Exception as e: erreurs.append(f"{s['articles']} : {type(e).__name__}")
        sites.append(etat)
    res = {"genere": now, "actus": actus, "videos": videos[:30], "sites": sites, "erreurs": erreurs}
    (out_dir / "flux.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(actus)} actus, {len(videos)} vidéos, {len(sites)} sites, {len(erreurs)} erreur(s)")
    for e in erreurs: print("  !", e)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "dist-flux"))
