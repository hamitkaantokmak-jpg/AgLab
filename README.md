# AğLab

Tarayıcı tabanlı ağ simülatörü ve Packet Tracer `.pkt` aktarımı.

Güncel dağıtım için başarılı PR CI çalışmasının öğrenci ZIP'ini kullanın. Kök HTML, derlemeye giren eski tabandır; güncel modüller CI'da gömülür. ZIP içindeki `html-build-manifest.json`, kaynak commit kimliğini ve HTML/modül SHA256'larını içerir. [Ortak JSON → gerçek Lab](docs/ORTAK_GERCEK_LAB.md) ve [40 laboratuvar–motor haritası](docs/LAB_MOTOR_HARITASI.md).

## Otomatik kalite kapısı

`python -m pip install playwright` ve `python -m playwright install chromium` sonrasında `python run_pipeline.py` çalıştırın.

GitHub Actions her push ve pull request'te tüm regresyon gruplarını çalıştırır. Tüm testler başarılıysa doğrulanmış ZIP üretir, aksi durumda test raporunu saklar.

Detaylı kurulum: `OTOMASYON.md`.

Deneysel gerçek üçüncü taraf motor karşılaştırması: [kapsam, lisans ve testler](docs/HAZIR_MOTOR_ENTEGRASYON.md).
HTML çevrimdışı çalışır; kaynak motoru yeniden derlemek için `npm ci --ignore-scripts` ve `npm run build:engine` kullanılır.
Yeni entegrasyonu içeren HTML, `python run_pipeline.py` tarafından kaynak modüllerden üretilir ve başarılı CI ZIP'ine eklenir. Depodaki önceden üretilmiş HTML tabanı yerine güncel CI paketindeki HTML'yi kullanın. CI ayrıca iki ardışık HTML derlemesinin eşitliğini doğrular.

[Motor uyumluluk matrisi](docs/UYUMLULUK_MATRISI.md) · [Gerçek VLAN/STP ve FRR testleri, ortak motor yönetimi](docs/GELISMIS_MOTOR_ENTEGRASYON.md). ZIP içindeki `html-build-manifest.json` HTML/modül bütünlüğünü doğrular; native protokoller ayrı Linux/Docker lablarında çalışır.

**Sınır:** Testlerin geçmesi tüm Packet Tracer özelliklerinin desteklendiği anlamına gelmez. Yeni özellikler için ayrı regresyon testleri gereklidir.
