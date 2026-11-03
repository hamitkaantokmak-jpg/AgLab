# PKT örnek ve doğrulama matrisi

Makine tarafından çalıştırılan tanım: `pkt-sample-matrix.json`.
`test_aglab_pkt_matrix.py` her satırın beklenen alanlarını doğrular; sonuçlar ana pipeline raporunda yer alır. Gerçek şifreli PKT ile sentetik XML senaryoları ayrı kaynak türleridir. Bu matris genel Packet Tracer uyumluluk sertifikası değildir.

| Örnek | Kaynak | Doğrulanan kapsam | Sınır |
| --- | --- | --- | --- |
| real-static-routing | Depodaki izinli `static-routing-two-routers(1).pkt` | SHA-256, bütünlük doğrulamalı şifre çözme, XML/arşiv eşitliği, 9 kaynak/8 aktarılan cihaz, 7/7 bağlantı, statik rotalar | Güç dağıtım cihazı modellenmez; tüm IOS komutları simüle edilmez |
| synthetic-switch-state | Özgün sentetik PT XML | VLAN 20, trunk izinleri/native VLAN alanı, shutdown, STP priority alanı | Tam STP zamanlaması ve Cisco donanım davranışı doğrulanmaz |
| synthetic-router-route | Özgün sentetik PT XML | Fiziksel IPv4/mask/shutdown, next-hop ve administrative distance | Tek başına uçtan uca paket iletimini doğrulamaz |
| synthetic-switch-interface-range | Özgün sentetik PT XML | Fiziksel port listesi/aralığı, VLAN/shutdown ve tek port override | Router/SVI range, eksik prefixli liste üyesi yok |
| synthetic-switch-invalid-range | Özgün sentetik PT XML | Hatalı aralıkta hiçbir porta kısmi uygulama yok; özgün komut raporu | Desteklenmeyen range çalıştırılmaz |
| synthetic-port-security-static | Özgün sentetik PT XML | Temel port-security, maximum/violation ve statik MAC | Sticky/aging ve kaynak runtime sayaçları yok |
| synthetic-port-security-invalid | Özgün sentetik PT XML | Geçersiz maximum/MAC ve sticky satırlarının raporlanması | Model dışı satırlar uygulanmaz |

Gerçek örnekteki tarayıcı içe aktarımı, dört ping ve JSON arşiv round-trip kontrolleri ayrıca `test_aglab_import.py` tarafından çalıştırılır. Sayılar yalnızca ilgili koşunun raporu PASS ise doğrulanmış sayılır. Yeni örnek eklemek için izinli ve kişisel veri içermeyen kaynak kullanın; kaynak türünü, beklenen sonucu ve sınırları açıkça belirtin.

## Büyük topoloji kontrolü

`test_aglab_large_topology.py`, JSON ile oluşturulan 298 switch ve iki PC'den oluşan 300 cihaz/300 bağlantılık halkayı çalıştırır. Bu yük senaryosu bir `.pkt` sürüm uyumluluk örneği değildir.

Uzak uçlar arasındaki senkron ping komutu için her ölçümde 1000 ms bütçe uygulanır. Ölçümler test çıktısında pipeline JSON raporuna kaydedilir. Bu eşik CI regresyon bütçesidir; her donanım için gecikme garantisi değildir. Tek bağlantı kapanınca alternatif yol, iki bağlantı kapanınca izolasyon, tekrar açılınca erişim ve 301 cihaz/1001 bağlantı girişinin mevcut kaydı bozmadan reddi doğrulanır. Port değişikliklerinin sonuçları yeni yol aramasında yeniden hesaplanır.

## Endpoint port regresyonu

`test_aglab_endpoint_ports.py`, izinli gerçek örneğin çözülmüş XML'inden oluşturulan **sentetik mutasyonları** kullanır: ilgisiz servis IP'si, fiziksel port gücü, GigabitEthernet0 kablosu, çoklu NIC ve bilinmeyen port indeksi. Adres/port eşlemesi ve başarılı/başarısız/yeniden başarılı tarayıcı ping'i doğrulanır. Bu mutasyonlar ikinci bir gerçek PKT sürümü veya yeni gerçek dosya örneği sayılmaz.

## IOS bağlamı ve kaynak dosya güvenliği

`test_aglab_pkt_config_context.py`, özgün sentetik XML ile router birincil IP'sinin
`secondary` satırı tarafından değiştirilememesini; `!`/`exit`/`end` ve desteklenmeyen
`interface range` (router veya hatalı switch seçimi) sonrasında eski porta komut uygulanmamasını doğrular. Switch VLAN
komutlarındaki ek sözcükler ve statik rota seçenekleri kısmen uygulanmaz; desteklenmeyen
satırlar raporda ve özgün XML/running-config arşivinde kalır. Tarayıcı testi birincil
router adresine başarılı, modellenmeyen ikincil adrese başarısız yerel ping yürütür.
Bu bağlam regresyonları ikinci bir gerçek PKT dosyası veya secondary IP/router
range desteği değildir; kabul edilen switch range kapsamı aşağıdadır.

Dönüştürücü kaynak PKT, JSON çıktı ve rapor yollarının aynı dosyaya yönelmesini
şifre çözmeden reddeder; symlink ve mevcut hardlink eşleşmeleri de sınanır. Normal
kullanımda ayrı çıktı yolları seçilmelidir. Bu kontrol eşzamanlı kötü niyetli dosya
sistemi değişikliklerine karşı bir atomik yazma garantisi sağlamaz.

## Switch interface range aktarımı

`interface range FastEthernet0/1 - 3, GigabitEthernet0/1 - GigabitEthernet0/2`
gibi seçimler, **o satırda mevcut olan** fiziksel switch portlarına uygulanır.
Kısa `fa0/1 - 3, gi0/1` yazımı da kabul edilir. Access/trunk modu, access/native VLAN,
allowed VLAN set/add/remove/all/none ve shutdown/no shutdown aynı tek-port
ayrıştırıcısını kullanır. Yinelenen portlar bir kez seçilir; sonraki tek-port komutu
o portun durumunu değiştirebilir. Kaynak running-config ve XML değiştirilmez.

Bir üye hatalıysa tüm seçim reddedilir; eski arayüz bağlamı kullanılmaz ve port
icat edilmez. Port envanteri dışı, ters veya prefix değiştiren aralıklar, SVI/router
range ve `fa0/1, 3` gibi eksik prefixli liste üyeleri desteklenmez. Seçim metni en
fazla 1024 karakterdir. Rapor özgün satır numaralarını korur. `!`, `exit`, `end`,
VLAN/global gateway/STP bağlamları seçimi bitirir.

`test_aglab_pkt_config_context.py` tarayıcıda gerçek JSON dosyası içe aktarımıyla
aynı VLAN'da ping başarısını, tek port VLAN değişimi veya range shutdown ile
başarısızlığı ve mevcut tek-port CLI komutlarıyla erişimin geri gelmesini sınar.
Bu geliştirme interaktif CLI'ye `interface range` komutu eklemez; kapsam PKT
running-config aktarımıdır. Yeni iki matris kaydı özgün sentetik XML'dir.

## Fiziksel endpoint MAC ve port-security aktarımı

Tek kablolu NIC'i kesin eşlenen PC/Server için yalnız o NIC'in `MACADDRESS` alanı
kanonik `mac` alanına aktarılır; ilgisiz servis/Bluetooth MAC'i kullanılmaz.
Kaynak MAC yoksa önceki sentetik adres davranışı korunur ve aktarım notu verilir.
Kaynakta açıkça geçersiz, sıfır, multicast veya yinelenen endpoint MAC varsa dönüşüm
açık hatayla reddedilir. Çoklu NIC belirsizliğinde mevcut adres/port/kablo reddi sürer.
JSON doğrulaması da bozuk/yinelenen MAC'i mevcut çalışmayı değiştirmeden reddeder.
Sentetik adres üretimi, açık kaynak MAC'leriyle çakışmayı önler; kaynak MAC yokken
eski dN adresleri korunur. Router/switch fiziksel port MAC'leri bu kapsamda değildir.

Switch fiziksel portlarında `switchport port-security`, `no switchport port-security`,
`maximum 1-1024`, `violation shutdown|restrict|protect`, `mac-address <MAC>` ve
`no switchport port-security mac-address <MAC>` mevcut CLI sözleşmesine göre aktarılır.
Geçersiz satır önceki geçerli kuralı değiştirmez. Range seçimi içinde bir portun
MAC kapasitesi komutu karşılamıyorsa o satır hiçbir seçili porta uygulanmaz ve
özgün satır numarasıyla raporlanır. Sticky, aging, VLAN'a özel secure MAC, kaynak
runtime ihlal sayacı/err-disabled ve recovery timer desteklenmez.

`test_aglab_pkt_port_security.py`, fiziksel NIC kökenini, Server/missing-MAC
uyumluluğunu, bozuk MAC/komutları ve range atomikliğini sınar. Chromium'da gerçek
JSON içe aktarımıyla doğru MAC'in üç modda geçişi, yanlış MAC'in engellenmesi,
shutdown modunda err-disabled, CLI ile toparlanma, dinamik öğrenme, yenileme ve
JSON dışa aktarmada kaynak arşivi/kural/MAC korunması doğrulanır.

İzinli gerçek PKT'den hazır topoloji ve rapor yeniden üretildi. Matris testi artık
hazır JSON ve raporun kaynak PKT dönüşümüyle bütünüyle aynı olduğunu da denetler.
Yeni port-security örnekleri sentetiktir; gerçek dosyada bu protokolün bulunduğu
veya yeni bir Packet Tracer sürümünün doğrulandığı iddia edilmez.
