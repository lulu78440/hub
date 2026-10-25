#!/usr/bin/env python3
"""Fabrique apercu-labo.html : une page unique (double-clic) qui montre les modules de la mission labo-auto. Usage : python3 labo/apercu.py"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import bundle as B

def load(entree):
    mods, order = {}, []
    def visit(name, base):
        key = (base / name).resolve().relative_to(ROOT).as_posix()
        if key in mods: return key
        src = B.read(key)
        src = src.replace('new URL("../../sw.js", import.meta.url).href', '"sw.js"').replace('new URL("./worker-ia.js", import.meta.url)', '"worker-ia.js"')
        mods[key] = None; deps = []
        for m in B.IMPORT.finditer(src): deps.append((m.group(1), visit(m.group(2), (ROOT / key).parent)))
        for m in B.IMPORT_NS.finditer(src): deps.append(("*" + m.group(1), visit(m.group(2), (ROOT / key).parent)))
        src = B.DYN.sub(lambda m: "Promise.resolve(__M[%r])" % visit(m.group(1), (ROOT / key).parent), src)
        mods[key] = (src, deps); order.append(key); return key
    visit(entree, ROOT / "labo"); return mods, order

B.load_modules = lambda: load("apercu-entree.js")
js = B.bundle_js()
index = json.loads((ROOT / "docs/manuel/index.json").read_text(encoding="utf-8"))
fiches = {e["chemin"]: (ROOT / e["chemin"]).read_text(encoding="utf-8") for e in index}
data = "window.__APERCU = %s;" % json.dumps({"index": index, "fiches": fiches}, ensure_ascii=False).replace("</", "<\\/")
css = """:root{color-scheme:dark}body{background:#02060d;color:#cfeffd;font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:860px;padding:16px}h1{color:#35e0ff;font-size:1.3rem}h2{color:#35e0ff;font-size:1.05rem;margin:0 0 8px}
section{border:1px solid #14485a;border-radius:10px;padding:12px 14px;margin:14px 0;background:#06121d}pre{white-space:pre-wrap;background:#020a12;border-radius:8px;padding:10px;font-size:13px}input{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #14485a;background:#020a12;color:inherit;font-size:15px}
table{border-collapse:collapse;width:100%;font-size:13px}td{border-bottom:1px solid #0f2f3d;padding:3px 6px}.ok{color:#5dffb0}.b{border:1px solid #14485a;border-radius:99px;padding:1px 9px;font-size:12px}.n-LIBRE{color:#5dffb0}.n-CONFIRMATION{color:#ffb454}.note{color:#8fb3c4;font-size:13px}"""
html = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aperçu du labo</title><style>{css}</style></head><body>
<h1>Aperçu du labo · mission autonome du 25/10</h1><p class="note">Une seule page, sans réseau, sans donnée personnelle (tout est fictif ou public). Elle montre les modules préparés sur la branche labo-auto ; rien n'est encore branché dans le hub.</p>
<script>{data}</script><script>{js.replace('</script', '<\\/script')}</script></body></html>"""
out = ROOT / "apercu-labo.html"; out.write_text(html, encoding="utf-8"); print("écrit :", out.name, "·", round(out.stat().st_size / 1024), "Ko")
