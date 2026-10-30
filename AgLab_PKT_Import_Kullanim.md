# AğLab Packet Tracer içe aktarma — geliştirme sürümü

## Kapsam

Bu paket `.pkt` dosyasını doğrudan AğLab içinde çözmez. Önce `convert_pkt_to_aglab.py` ile AğLab JSON biçimine dönüştürür; ardından HTML içindeki **İçe aktar (JSON)** düğmesiyle yüklenir. Kaynak `.pkt` dosyası değiştirilmez.

## Gereksinimler

- Python 3.9 veya üzeri
- Windows/macOS: `py -m pip install securedypkt` (veya `python -m pip install securedypkt`)
- Linux'ta `securedypkt` kullanılamıyorsa `libgcrypt` gerekir.

## Kullanım

```bash
python convert_pkt_to_aglab.py "static-routing-two-routers.pkt" \
  -o static-routing-two-routers.aglab.json \
  --report static-routing-two-routers-import-report.json
```

Sonra `AgLab_Final_PKT_Import.html` dosyasını açıp **İçe aktar (JSON)** ile `.aglab.json` dosyasını seçin.

## Kayıp / eşdeğerlik uyarısı

Dönüştürücü kaynak cihaz ve bağlantı sayılarını raporlar, eşlenemeyen cihazları/bağlantıları listeler ve ham IOS running-config metnini `config.runningConfig` alanında saklar. AğLab'ın simülasyon motoru bütün Cisco IOS komutlarını veya Packet Tracer'ın tüm cihaz davranışlarını çalıştırmaz. Ham yapılandırmanın korunması, tüm komutların simüle edildiği anlamına gelmez. İçe aktarma raporundaki `simulationCoverage` alanı modellenen kapsamı ve sınırlamaları belirtir.

## Bu örnek dosya için beklenen sonuç

- Kaynak: 9 cihaz, 7 bağlantı
- AğLab'a eşlenen: 8 cihaz, 7 bağlantı
- Desteklenmeyen: 1 Power Distribution Device
- Router statik rotaları: R1 → `192.168.2.0/24` via `10.0.0.2`; R2 → `192.168.1.0/24` via `10.0.0.1`
- Switch VLAN veritabanı: kaynak yapılandırmada yalnızca varsayılan VLAN 1; kaynakta bulunmayan VLAN'lar uydurularak eklenmez.

Bu örnek için dört uçtan uca ping testi ve AğLab'ın topoloji denetimi çalıştırılabilir. Cisco Packet Tracer uygulamasında açılış testi yapılmadığı için dosya Packet Tracer ile birebir uyumlu diye sunulmaz.


## Kaynak veriyi koruma ve geri çıkarma

Dönüştürücü, oluşturulan JSON içine kaynak `.pkt` dosyasının özgün baytlarını Base64 olarak ve çözümlenmiş `PACKETTRACER5` XML'ini ayrı bir arşiv alanında ekler. Her ikisi için bayt sayısı ve SHA-256 özeti tutulur. Bu arşiv, simülasyona eşlenmeyen alanların kaynağını korur; tek başına bu özelliklerin AğLab'da simüle edildiği anlamına gelmez.

JSON içindeki orijinal `.pkt` dosyasını geri çıkarmak için:

```bash
python restore_pkt_from_aglab_json.py static-routing-two-routers.aglab.json -o restored-original.pkt
```

Betik SHA-256 değerini doğrular. Geri çıkarılan dosya kaynak `.pkt` ile bayt bazında aynı olmalıdır. `importReport.unmodeledConfigLines` alanı, simülasyon modeline eşlenmeyen CLI satırlarını ve kaynak satır numaralarını listeler.

## Etiketli router alt arayüzleri

`interface GigabitEthernet0/0.200` altında `encapsulation dot1Q 20` ve IPv4 yapılandırması, parent `g0/0` ve VLAN 20 bilgileriyle aktarılır. Alt arayüz numarası VLAN kimliğinden farklı olabilir. Mantıksal alt arayüzler fiziksel kablo portları listesine eklenmez. Aynı switch üzerindeki VLAN'lar, router'a giden trunk üzerinden yönlendirilebilir; parent/alt arayüz shutdown ve trunk izinleri paket akışını etkiler.

`native`, ISL ve geçersiz VLAN etiketleri bu aktarımda modellenmez; kaynak running-config/XML korunur ve komutlar model dışı raporlanır. Sentetik PT XML regresyonu aktarımı gerçek tarayıcı ping testleriyle doğrular; tüm Packet Tracer sürümleri ve özellikleri için uyumluluk garantisi vermez.
