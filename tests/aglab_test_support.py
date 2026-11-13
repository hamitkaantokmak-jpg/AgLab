"""Ortak test yardımcıları: depo yolları, çıktı dizinleri ve Chromium başlatma.

Testler sabit ``/mnt/data`` veya ``/usr/bin/chromium`` yolları yerine bu modülü
kullanır; böylece depo kökünden, CI'dan ya da açılmış bir ZIP'ten aynı şekilde
çalışırlar.

Ortam değişkenleri:

* ``AGLAB_TEST_ARTIFACT_DIR`` – raporların/ekran görüntülerinin yazılacağı dizin
  (varsayılan: ``<kök>/dist``).
* ``AGLAB_CHROMIUM`` – belirli bir Chromium/Chrome ikilisi. Boşsa Playwright'ın
  kendi Chromium'u kullanılır.
"""

from __future__ import annotations

import atexit
import base64
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS_DIR = ROOT / "tests"
HTML = ROOT / "AgLab_Final_PKT_Import.html"
SAMPLE_JSON = ROOT / "static-routing-two-routers.aglab.json"

# Kök modüller (convert_pkt_to_aglab, verify_packages, ...) testlerden içe aktarılabilsin.
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def artifact_dir() -> Path:
    """Test kanıtlarının yazıldığı dizin; yoksa oluşturulur."""
    out = Path(os.environ.get("AGLAB_TEST_ARTIFACT_DIR") or ROOT / "dist")
    out.mkdir(parents=True, exist_ok=True)
    return out


_work: Path | None = None


def work_dir() -> Path:
    """Bu test sürecine özel, çıkışta silinen geçici dizin."""
    global _work
    if _work is None:
        _work = Path(tempfile.mkdtemp(prefix="aglab-test-"))
        atexit.register(shutil.rmtree, _work, True)
    return _work


def decoded_source_xml() -> bytes:
    """Örnek .pkt dosyasının çözülmüş XML'i (içe aktarılmış JSON'da saklanır)."""
    source = json.loads(SAMPLE_JSON.read_text(encoding="utf-8"))
    return base64.b64decode(source["sourceArchive"]["decodedXmlBase64"])


def chromium_executable() -> str | None:
    """``AGLAB_CHROMIUM`` ile verilen ikili; yoksa ``None`` (Playwright varsayılanı)."""
    return os.environ.get("AGLAB_CHROMIUM") or None


def launch_chromium(playwright, **kwargs):
    """Başsız Chromium başlatır; ``AGLAB_CHROMIUM`` verilmişse onu kullanır."""
    kwargs.setdefault("headless", True)
    executable = chromium_executable()
    if executable:
        kwargs.setdefault("executable_path", executable)
    return playwright.chromium.launch(**kwargs)


# ``src/app/main.js`` içindeki ``#ptImportFile`` işleyicisi asenkrondur
# (``await file.text()``) ve başarıda da hatada da sonunda ``value = ''`` yapar.
# ``set_input_files`` alanı eşzamanlı olarak doldurduğu için boş değer, içe
# aktarmanın bittiğinin kesin işaretidir; sabit bekleme CI yükünde yetmez.
IMPORT_DONE = "document.querySelector('#ptImportFile').value === ''"


def import_topology(page, path) -> None:
    """Topoloji dosyasını içe aktarır ve işleyicinin bitmesini bekler.

    Yalnızca tamamlanmayı bekler; içe aktarmanın başarılı olduğunu çağıran test
    ayrıca doğrulamalıdır (hata durumunda da alan boşaltılır).
    """
    page.locator("#ptImportFile").set_input_files(str(path))
    page.wait_for_function(IMPORT_DONE)


def cli_path(*topologies) -> list:
    """L5-h: AğLab JSON'larını Labber'ın IOS metin yolundan geçirir (tarayıcısız, Node).

    Her topoloji için ``{decision, reasons, diffs, lines, report}`` döner (bkz.
    ``tests/sim_node_runner.cjs`` ve ``src/sim-bridge/cli-import.ts``).
    """
    import subprocess

    out = subprocess.run(
        ["node", str(TESTS_DIR / "sim_node_runner.cjs")],
        input=json.dumps({"topologies": list(topologies)}),
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout)


def assert_cli_path_matches(obj) -> dict:
    """L5-h: yapısal yol (dönüştürücü + köprü) ile CLI yolu (runningConfig → Labber CLI)
    dönüştürücünün modellediği alanlarda aynı olmalı. Fark test hatasıdır."""
    result = cli_path(obj)[0]
    assert result["diffs"] == [], "Yapısal yol ile IOS metin yolu farklı: " + json.dumps(
        _compact(result["diffs"]), ensure_ascii=False
    )
    return result


def _compact(value):
    """Uzun VLAN listelerini aralık metnine çevirir (hata iletisi okunur kalsın)."""
    if isinstance(value, list) and len(value) > 8 and all(isinstance(x, int) for x in value):
        out, start = [], value[0]
        for prev, cur in zip(value, value[1:] + [None]):
            if cur != prev + 1 if cur is not None else True:
                out.append(str(start) if start == prev else f"{start}-{prev}")
                start = cur
        return ",".join(out)
    if isinstance(value, list):
        return [_compact(x) for x in value]
    if isinstance(value, dict):
        return {k: _compact(v) for k, v in value.items()}
    return value
