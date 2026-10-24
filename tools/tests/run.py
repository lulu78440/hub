#!/usr/bin/env python3
"""Banc d'essai du hub : lance toute la suite en une commande.

    python3 tools/tests/run.py            # tout
    python3 tools/tests/run.py sauvegarde # seulement les tests dont le nom contient « sauvegarde »
    python3 tools/tests/run.py --rapide   # sans les tests longs (charge, 30 min…)

Prérequis : Python 3 + Playwright (pip install playwright && playwright install chromium).
Serveur local et navigateur headless lancés automatiquement ; données factices ; réseau extérieur bloqué.
"""
import importlib, os, sys, time, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from hubtest import Hub  # noqa: E402

MODULES = ["t1_sauvegardes", "t2_fonctions", "t3_securite", "t4_limites", "t5_confort"]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    quick = "--rapide" in sys.argv
    tests = []
    for m in MODULES:
        try:
            mod = importlib.import_module(m)
        except ModuleNotFoundError:
            continue
        for name in sorted(n for n in dir(mod) if n.startswith("test_")):
            fn = getattr(mod, name)
            if quick and getattr(fn, "long", False):
                continue
            if args and not any(a in name for a in args):
                continue
            tests.append((m, name, fn))
    h = Hub()
    ok = fail = 0
    t0 = time.time()
    try:
        for m, name, fn in tests:
            t = time.time()
            h.mock = None
            try:
                fn(h)
                ok += 1
                print(f"  OK    {name}  ({time.time() - t:.1f} s)", flush=True)
            except Exception as e:  # noqa: BLE001
                fail += 1
                print(f"  ÉCHEC {name}  ({time.time() - t:.1f} s)\n        {type(e).__name__}: {str(e)[:600]}", flush=True)
                if os.environ.get("HUB_TRACE"):
                    traceback.print_exc()
    finally:
        h.close()
    print(f"\n{ok} réussi(s), {fail} échec(s) sur {len(tests)} test(s) en {time.time() - t0:.0f} s")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
