# AğLab

Tarayıcı tabanlı ağ simülatörü ve Packet Tracer `.pkt` aktarımı.

Simulation Mode V1, mevcut ARP/ICMP motor kayıtlarını adım adım ve SVG üzerinde yeniden oynatır; yeni trafik üretmez. Realtime, CLI, Akademi ve çevrimdışı kullanım korunur. Kapsam ve gerçek Lab ayrımı: [Simulation Mode V1](docs/SIMULATION_MODE_V1.md).

Güncel dağıtım için başarılı PR CI çalışmasının öğrenci ZIP'ini kullanın veya `python build_simulator.py` ve `python build_academy.py` çalıştırın. Kök HTML derleme tabanıdır; yeni CLI hareket/geçmiş kancaları ve modüller derleme sırasında güncellenir. Yalnız raw HTML'yi indirmek en son düzeltmeleri garanti etmez. CI tekrar üretimde aynı HTML'yi doğrular. ZIP içindeki `html-build-manifest.json`, kaynak commit kimliğini ve cihaz CLI'si dahil HTML/modül SHA256'larını içerir. [Ortak JSON → gerçek Lab](docs/ORTAK_GERCEK_LAB.md) ve [40 laboratuvar–motor haritası](docs/LAB_MOTOR_HARITASI.md).

## Otomatik kalite kapısı

`python -m pip install playwright` ve `python -m playwright install chromium` sonrasında `python run_pipeline.py` çalıştırın.

GitHub Actions her push ve pull request'te tüm regresyon gruplarını çalıştırır. Tüm testler başarılıysa doğrulanmış ZIP üretir, aksi durumda test raporunu saklar.

Detaylı kurulum: `OTOMASYON.md`.

Deneysel gerçek üçüncü taraf motor karşılaştırması: [kapsam, lisans ve testler](docs/HAZIR_MOTOR_ENTEGRASYON.md).
HTML çevrimdışı çalışır; kaynak motoru yeniden derlemek için `npm ci --ignore-scripts` ve `npm run build:engine` kullanılır.
Yeni entegrasyonu içeren HTML, `python run_pipeline.py` tarafından kaynak modüllerden üretilir ve başarılı CI ZIP'ine eklenir. Depodaki hazır HTML de aynı modüllerle günceldir. CI hem iki ardışık derlemenin hem de kaydedilmiş HTML ile yeniden üretilen çıktının eşitliğini doğrular.

[Motor uyumluluk matrisi](docs/UYUMLULUK_MATRISI.md) · [Gerçek VLAN/STP ve FRR testleri, ortak motor yönetimi](docs/GELISMIS_MOTOR_ENTEGRASYON.md). ZIP içindeki `html-build-manifest.json` HTML/modül bütünlüğünü doğrular; native protokoller ayrı Linux/Docker lablarında çalışır.

**Sınır:** Testlerin geçmesi tüm Packet Tracer özelliklerinin desteklendiği anlamına gelmez. Yeni özellikler için ayrı regresyon testleri gereklidir.

