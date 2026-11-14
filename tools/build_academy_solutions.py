#!/usr/bin/env python3
"""Akademi öğretmen çözümlerini tek HTML'e gömülecek veri dosyasına yazar.

Arayüz yenilemesi PR 2 (kullanıcı kararı): öğrenci/öğretmen ayrımı kalktı; uygulama kendi
kendine öğrenme içindir. Her labın `teacher_solution` alanı (`academy/teacher/AGL-*.json`)
`academy/solution-data.js` dosyasına `const academySolutions = {...};` olarak yazılır ve
Simülatör'deki "Çözümü göster" kilidi açılınca gösterilir. `target_topology` gömülmez (yalnız
paket doğrulamasının ve 100/100 testlerinin hedef topolojisi). Kaynak değiştirilmez.

`--check`: dosya güncel değilse hata verir (CI ve run_pipeline).
"""

import argparse, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "academy/solution-data.js"


def solutions():
    out = {}
    for path in sorted((ROOT / "academy/teacher").glob("AGL-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        out[data["id"]] = data["teacher_solution"]
    if len(out) != 40:
        raise SystemExit("Beklenen 40 öğretmen çözümü, bulunan: " + str(len(out)))
    return out


def render():
    return (
        "// Üretildi: tools/build_academy_solutions.py (academy/teacher/*.json teacher_solution).\n"
        "// Elle düzenleme. Çözüm, Simülatör'de \"Çözümü göster\" kilidi açılınca DOM'a eklenir.\n"
        "const academySolutions = "
        + json.dumps(solutions(), ensure_ascii=False, sort_keys=True)
        + ";\n"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    text = render()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != text:
            print("academy/solution-data.js güncel değil: python tools/build_academy_solutions.py")
            return 1
        return 0
    OUTPUT.write_text(text, encoding="utf-8")
    print("academy/solution-data.js: " + str(len(text)) + " karakter")
    return 0


if __name__ == "__main__":
    sys.exit(main())
