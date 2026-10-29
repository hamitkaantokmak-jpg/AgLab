# AğLab

Tarayıcı tabanlı ağ simülatörü ve Packet Tracer `.pkt` aktarımı.

## Otomatik kalite kapısı

`python -m pip install playwright` ve `python -m playwright install chromium` sonrasında `python run_pipeline.py` çalıştırın.

GitHub Actions her push ve pull request'te 10 test grubunu çalıştırır. Tüm testler başarılıysa doğrulanmış ZIP üretir, aksi durumda test raporunu saklar.

Detaylı kurulum: `OTOMASYON.md`.

**Sınır:** Testlerin geçmesi tüm Packet Tracer özelliklerinin desteklendiği anlamına gelmez. Yeni özellikler için ayrı regresyon testleri gereklidir.
