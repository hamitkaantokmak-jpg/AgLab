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
