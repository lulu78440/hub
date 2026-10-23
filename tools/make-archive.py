#!/usr/bin/env python3
"""Fabrique l'archive de sauvegarde : tout le dépôt (version commitée) + le fichier unique hors ligne + un mode d'emploi.
Usage : python3 tools/make-archive.py NOM-DE-VERSION   (ex. v1.0.0)   → dist/hub-NOM-DE-VERSION.zip
"""
import subprocess, sys, zipfile, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
version = sys.argv[1] if len(sys.argv) > 1 else "sans-version"
subprocess.run([sys.executable, str(ROOT / "tools" / "bundle.py")], check=True)
files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split("\n")
commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
lisez = f"""HUB · sauvegarde {version}
Créée le {datetime.date.today().strftime('%d/%m/%Y')} · commit {commit}

POUR OUVRIR LE HUB DEPUIS CETTE ARCHIVE
1. Décompresse l'archive (clic droit > Extraire tout).
2. Ouvre le fichier « hub-hors-ligne.html » avec Brave (double-clic, ou glisse-le dans Brave).
   C'est tout le hub dans un seul fichier : il marche sans Internet, sans serveur et sans installation.
   Limites : pas d'installation en appli ni de mise à jour automatique (le fichier est une photo de cette version).
   La recherche a évidemment besoin d'Internet pour ouvrir les sites.

POUR RETROUVER LA VERSION EN LIGNE
- Code complet et historique : https://github.com/lulu78440/hub (étiquette « {version} » dans Releases / Tags)
- Hub en ligne : https://lulu78440.github.io/hub/

CONTENU DE L'ARCHIVE
- hub-hors-ligne.html : le hub en un seul fichier (à ouvrir)
- code/ : tout le dépôt GitHub à cette version (index.html, css/, js/, vendor/, maquettes/, docs/…)
  Attention : ouvrir code/index.html directement ne marche pas (les navigateurs bloquent les modules JavaScript
  sur un fichier local). Utilise hub-hors-ligne.html, ou GitHub Pages.

TES DONNÉES
Notes, tâches, favoris et réglages ne sont PAS dans cette archive : ils restent sur chaque appareil
(export / import en fichier à partir de la phase 2).
"""
out = ROOT / "dist" / f"hub-{version}.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr(f"hub-{version}/LISEZ-MOI.txt", lisez)
    z.write(ROOT / "dist" / "hub-hors-ligne.html", f"hub-{version}/hub-hors-ligne.html")
    for f in files:
        if f: z.write(ROOT / f, f"hub-{version}/code/{f}")
print("écrit :", out.relative_to(ROOT), "·", round(out.stat().st_size / 1024), "Ko ·", len(files), "fichiers de code")
