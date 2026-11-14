#!/usr/bin/env python3
"""Ders şemalarını üretir: docs/dersler/gorseller/<konu>.py → docs/dersler/gorseller/<konu>/<id>.svg.

Her tanım dosyası `FIGURES = {"g1": fonksiyon, ...}` içerir; fonksiyon `tools.figures.Fig` döndürür.

    python tools/build_figures.py          # yaz
    python tools/build_figures.py --check  # dosyalar güncel değilse hata
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "dersler" / "gorseller"
sys.path.insert(0, str(ROOT / "tools"))


def load(spec_path: Path) -> dict:
    spec = importlib.util.spec_from_file_location("fig_" + spec_path.stem.replace("-", "_"), spec_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod.FIGURES


def render_all() -> dict[Path, str]:
    out: dict[Path, str] = {}
    for spec_path in sorted(SRC.glob("*.py")):
        topic = spec_path.stem
        for fid, fn in load(spec_path).items():
            out[SRC / topic / f"{fid}.svg"] = fn().svg(uid=f"{topic}-{fid}")
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    files = render_all()
    stale = []
    for path, svg in files.items():
        cur = path.read_text(encoding="utf-8") if path.exists() else None
        if cur != svg:
            stale.append(path)
            if not args.check:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(svg, encoding="utf-8")
    known = set(files)
    orphans = [p for p in SRC.glob("*/*.svg") if p not in known]
    if args.check and (stale or orphans):
        for p in stale + orphans:
            print("güncel değil:", p.relative_to(ROOT), file=sys.stderr)
        print("çalıştır: python tools/build_figures.py", file=sys.stderr)
        return 1
    if not args.check:
        for p in orphans:
            p.unlink()
        print(f"{len(files)} şema ({len(stale)} güncellendi, {len(orphans)} silindi)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
