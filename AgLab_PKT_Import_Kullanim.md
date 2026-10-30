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

## Trunk VLAN listesi aktarımı

Dönüştürücü, açık `switchport trunk allowed vlan` komutlarında sayısal liste/aralık, `all`, `none`, `add` ve `remove` işlemlerini kaynak sırasıyla uygular. `all`, VLAN veritabanında bulunmayanlar dahil 1–4094 aralığını kapsar; trunk referansları VLAN veritabanına kayıt eklemez. Boş liste korunur. Geçersiz veya desteklenmeyen `except` gibi sözdizimleri önceki listeyi değiştirmez ve model dışı CLI raporuna girer. Bu kapsam, diğer IOS trunk komutlarının veya tüm Packet Tracer özelliklerinin desteklendiği anlamına gelmez.

## Varsayılan trunk izinleri

Packet Tracer kaynak yapılandırmasında `switchport mode trunk` var ama açık `switchport trunk allowed vlan` listesi yoksa trunk, 1–4094 aralığına izin verir. Açık sayısal liste veya `none`, komutun trunk modundan önce/sonra gelmesinden bağımsız korunur. İlk `add`/`remove` işlemi varsayılan tüm VLAN listesi üzerinden uygulanır.

AğLab CLI'daki `switchport trunk allowed vlan all` da 1–4094 aralığını kapsar; daha sonra oluşturulan VLAN'lar ayrıca izin eklenmeden taşınabilir. Bu izin VLAN veritabanını doldurmaz: bir VLAN'ın gerçekten taşınması için switch üzerinde oluşturulmuş olması gerekir. JSON dışa aktarımında izin listesi korunur. Mevcut eğitim senaryolarının önceden sınırlandırılmış trunk listeleri otomatik olarak genişletilmez.

## Etiketli router alt arayüzleri

`interface GigabitEthernet0/0.200` altında `encapsulation dot1Q 20` ve IPv4 yapılandırması, parent `g0/0` ve VLAN 20 bilgileriyle aktarılır. Alt arayüz numarası VLAN kimliğinden farklı olabilir. Mantıksal alt arayüzler fiziksel kablo portları listesine eklenmez. Aynı switch üzerindeki VLAN'lar, router'a giden trunk üzerinden yönlendirilebilir; parent/alt arayüz shutdown ve trunk izinleri paket akışını etkiler.

`native`, ISL ve geçersiz VLAN etiketleri bu aktarımda modellenmez; kaynak running-config/XML korunur ve komutlar model dışı raporlanır. Sentetik PT XML regresyonu aktarımı gerçek tarayıcı ping testleriyle doğrular; tüm Packet Tracer sürümleri ve özellikleri için uyumluluk garantisi vermez.

## CLI ile alt arayüz düzenleme

CLI, içe aktarılan topolojideki bağımsız alt arayüz/VLAN eşlemesini korur: örneğin `interface g0/0.200` altında `encapsulation dot1q 20` geçerlidir. Yeni alt arayüzler mevcut fiziksel parent üzerinden oluşturulur; `GigabitEthernet1/0.5000` gibi tam adlar normalleştirilir ve mantıksal arayüz fiziksel kablo portları listesine eklenmez. Bu modelde alt arayüz numarası 1–4294967295, VLAN etiketi ise ayrıca 1–4094 aralığındadır. Yeni alt arayüz, geçerli encapsulation ve IP yapılandırılana kadar yönlendirmeye katılmaz.

Desteklenen komut yalnızca `encapsulation dot1q <VLAN>` biçimidir. `native`, ISL, eksik/fazla parametre veya geçersiz VLAN etiketi hata verir ve önceki eşlemeyi değiştirmez. JSON dışa/içe aktarımı bu bilgileri korur. Bu kapsam tam IOS uyumluluğu anlamına gelmez.

## Tarayıcı kaydı ve aktarım raporu

İçe aktarılan topolojinin özgün `.pkt`/XML arşivi ve `importReport` kapsam raporu, otomatik tarayıcı kaydında ve JSON dışa aktarımında birlikte korunur. Sayfa yeniden açıldığında model dışı CLI ve desteklenmeyen cihaz uyarıları tekrar gösterilir; rapor, kaynak içe aktarma anını açıklar ve sonraki düzenlemeler için yeni bir doğrulama raporu değildir.

Tarayıcı depolaması dolarsa uyarı gösterilir; son başarılı kayıt korunur ve bellekteki güncel topoloji Dışa aktar ile kurtarılabilir. Sıfırlama veya yeni hazır eğitim topolojisine geçme eski kaynak arşivini ve aktarım raporunu yeni senaryoya eklemez.

## PC/Server fiziksel Ethernet portu

Kaynak XML'de tek desteklenen kablolu `MODULE/PORT` varsa endpoint IP/maske, port güç durumu ve öncelikle `PORT_GATEWAY` bu kayıttan alınır; port gateway boşsa cihazın `GATEWAY` alanı kullanılır. Servis veya Bluetooth altındaki ilgisiz IP/maske değerleri endpoint adresi olarak seçilmez. Cihaz gücü ile port gücü ayrı korunur. Kaynakta modül envanteri olmayan basit XML için doğrudan ENGINE IPv4 alanları desteklenir.

Tek Ethernet endpoint'in `FastEthernet0`, `GigabitEthernet0` ve `Ethernet0` kablo adları AğLab `eth0` portuna eşlenir. Diğer port indeksleri bu porta otomatik yönlendirilmez. Birden fazla Ethernet NIC veya desteklenmeyen modül envanteri varsa adres/port modellenmez, ilgili bağlantılar atlanır ve kapsam kaybı notlarda/atlanan bağlantılarda belirtilir. Bu durumda özgün XML arşivi korunur. Kaynak port sayısı/türü ve model eşlemesi `importReport.endpointPorts` içinde bulunur. Çoklu NIC veya kablosuz simülasyonu desteklenmiş sayılmaz.
