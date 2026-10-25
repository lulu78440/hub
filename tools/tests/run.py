#!/usr/bin/env python3
"""Banc d'essai du hub : lance toute la suite en une commande.

    python3 tools/tests/run.py            # tout
    python3 tools/tests/run.py sauvegarde # seulement les tests dont le nom contient « sauvegarde »
    python3 tools/tests/run.py --rapide   # sans les tests longs (charge, 30 min…)

Prérequis : Python 3 + Playwright (pip install playwright && playwright install chromium).
Serveur local et navigateur headless lancés automatiquement ; données factices ; réseau extérieur bloqué.
"""
import importlib, os, signal, sys, time, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from hubtest import Hub  # noqa: E402

MODULES = ["t1_sauvegardes", "t2_fonctions", "t3_securite", "t4_limites", "t5_confort", "t6_precis", "t7_charte"]
LIMIT = int(os.environ.get("HUB_LIMITE", "420"))     # secondes par test : au-delà, le test est déclaré bloqué (au lieu de geler la suite)


def _stuck(*_):
    raise TimeoutError(f"test bloqué depuis plus de {LIMIT} s")


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
    ok = fail = cases = 0
    t0 = time.time()
    signal.signal(signal.SIGALRM, _stuck)
    try:
        for m, name, fn in tests:
            t = time.time()
            h.mock = None
            signal.alarm(getattr(fn, "limite", LIMIT))
            try:
                r = fn(h)
                n = r if isinstance(r, int) else 1
                cases += n
                ok += 1
                print(f"  OK    {name}  ({time.time() - t:.1f} s" + (f", {n} cas" if n > 1 else "") + ")", flush=True)
            except Exception as e:  # noqa: BLE001
                fail += 1
                cases += getattr(e, "cas", 1)
                print(f"  ÉCHEC {name}  ({time.time() - t:.1f} s)\n        {type(e).__name__}: {str(e)[:600]}", flush=True)
                if os.environ.get("HUB_TRACE"):
                    traceback.print_exc()
            finally:
                signal.alarm(0)
    finally:
        h.close()
    print(f"\n{ok} réussi(s), {fail} échec(s) sur {len(tests)} test(s) ({cases} cas vérifiés) en {time.time() - t0:.0f} s")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
