#!/usr/bin/env python3
"""Fabrique dist/hub-hors-ligne.html : tout le hub dans UN seul fichier (CSS, polices, Three.js, code).

Pourquoi : un dossier du hub ouvert par double-clic (file://) est bloqué par les navigateurs (modules JavaScript).
Ce fichier unique, lui, s'ouvre partout, sans serveur. Il sert à la restauration depuis l'archive .zip.
Limites : pas d'installation en appli ni de cache hors ligne (le fichier est déjà local).
Usage : python3 tools/bundle.py
"""
import base64, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def read(p): return (ROOT / p).read_text(encoding="utf-8")
def b64(p): return base64.b64encode((ROOT / p).read_bytes()).decode()

# ---------- CSS : polices en data: ----------
def css(p):
    t = read(p)
    return re.sub(r'url\("\.\./(fonts/[^"]+)"\)', lambda m: 'url("data:font/woff2;base64,%s")' % b64(m.group(1)), t)

# ---------- Modules JS → un seul script classique ----------
IMPORT = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*"([^"]+)";[ \t]*(?://[^\n]*)?$', re.M)   # commentaire de fin de ligne toléré
IMPORT_NS = re.compile(r'^import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*"([^"]+)";[ \t]*(?://[^\n]*)?$', re.M)   # import * as x from "…" (Noyau)
DYN = re.compile(r'import\(\s*"(\.{1,2}/[^"]+)"\s*\)')   # import("./…") relatif → module déjà inclus
EXPORT = re.compile(r'^export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)', re.M)

def load_modules():
    mods, order = {}, []
    def visit(name, base):
        key = (base / name).resolve().relative_to(ROOT).as_posix()
        if key in mods: return key
        src = read(key)
        if key == "js/scene/loader.js":   # remplacé : Three.js est déjà inclus dans la page
            src = "export async function loadThree() { return window.THREE; }\n"
        src = src.replace('new URL("../../sw.js", import.meta.url).href', '"sw.js"')
        mods[key] = None
        deps = []
        for m in IMPORT.finditer(src):
            deps.append((m.group(1), visit(m.group(2), (ROOT / key).parent)))
        for m in IMPORT_NS.finditer(src):
            deps.append(("*" + m.group(1), visit(m.group(2), (ROOT / key).parent)))
        src = DYN.sub(lambda m: "Promise.resolve(__M[%r])" % visit(m.group(1), (ROOT / key).parent), src)
        mods[key] = (src, deps); order.append(key)
        return key
    visit("main.js", ROOT / "js")
    return mods, order

def bundle_js():
    mods, order = load_modules()
    out = ['"use strict";', "const __M = {};"]
    for key in order:
        src, deps = mods[key]
        exports = EXPORT.findall(src)
        body = IMPORT_NS.sub("", IMPORT.sub("", src))
        body = re.sub(r'^export\s+', "", body, flags=re.M)
        head = ""
        for names, dep in deps:
            if names.startswith("*"):
                head += "const %s = __M[%r];\n" % (names[1:], dep); continue
            parts = [n.strip().replace(" as ", ": ") for n in names.split(",") if n.strip()]
            head += "const { %s } = __M[%r];\n" % (", ".join(parts), dep)
        ret = "return { %s };" % ", ".join(exports)
        out.append("__M[%r] = (() => {\n%s%s\n%s\n})();" % (key, head, body, ret))
    return "\n".join(out)

def main():
    html = read("index.html")
    # styles
    html = re.sub(r'<link rel="stylesheet" href="css/base.css">', lambda m: "<style>\n%s\n</style>" % css("css/base.css"), html)
    html = re.sub(r'<link rel="stylesheet" href="css/hud.css">', lambda m: "<style>\n%s\n</style>" % css("css/hud.css"), html)
    html = re.sub(r'<link rel="stylesheet" href="css/mobile.css" media="([^"]+)">', lambda m: '<style media="%s">\n%s\n</style>' % (m.group(1), css("css/mobile.css")), html)
    # manifeste et icônes
    html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', "")
    html = re.sub(r'<link rel="apple-touch-icon"[^>]*>\n?', "", html)
    html = html.replace('href="icons/favicon-48.png"', 'href="data:image/png;base64,%s"' % b64("icons/favicon-48.png"))
    # scripts : Three.js (scripts classiques) puis le code du hub
    three = ["vendor/three/three.min.js", "vendor/three/examples/shaders/CopyShader.js", "vendor/three/examples/shaders/LuminosityHighPassShader.js",
             "vendor/three/examples/postprocessing/EffectComposer.js", "vendor/three/examples/postprocessing/RenderPass.js",
             "vendor/three/examples/postprocessing/ShaderPass.js", "vendor/three/examples/postprocessing/UnrealBloomPass.js"]
    safe = lambda s: s.replace("</script", "<\\/script")
    scripts = "".join("<script>\n%s\n</script>\n" % safe(read(f)) for f in three)
    scripts += "<script>\n%s\n</script>" % safe(bundle_js())
    marker = '<script type="module" src="js/main.js"></script>'
    assert marker in html, "balise du script principal introuvable"
    html = html.replace(marker, scripts)
    html = html.replace("<title>Hub</title>", "<title>Hub (fichier hors ligne)</title>")
    out = ROOT / "dist" / "hub-hors-ligne.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("écrit :", out.relative_to(ROOT), "·", round(out.stat().st_size / 1024), "Ko")

if __name__ == "__main__":
    sys.exit(main())
