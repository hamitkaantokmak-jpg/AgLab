# PKT örnek ve doğrulama matrisi

Makine tarafından çalıştırılan tanım: `pkt-sample-matrix.json`.
`test_aglab_pkt_matrix.py` her satırın beklenen alanlarını doğrular; sonuçlar ana pipeline raporunda yer alır. Gerçek şifreli PKT ile sentetik XML senaryoları ayrı kaynak türleridir. Bu matris genel Packet Tracer uyumluluk sertifikası değildir.

| Örnek | Kaynak | Doğrulanan kapsam | Sınır |
| --- | --- | --- | --- |
| real-static-routing | Depodaki izinli `static-routing-two-routers(1).pkt` | SHA-256, bütünlük doğrulamalı şifre çözme, XML/arşiv eşitliği, 9 kaynak/8 aktarılan cihaz, 7/7 bağlantı, statik rotalar | Güç dağıtım cihazı modellenmez; tüm IOS komutları simüle edilmez |
| synthetic-switch-state | Özgün sentetik PT XML | VLAN 20, trunk izinleri/native VLAN alanı, shutdown, STP priority alanı | Tam STP zamanlaması ve Cisco donanım davranışı doğrulanmaz |
| synthetic-router-route | Özgün sentetik PT XML | Fiziksel IPv4/mask/shutdown, next-hop ve administrative distance | Tek başına uçtan uca paket iletimini doğrulamaz |

Gerçek örnekteki tarayıcı içe aktarımı, dört ping ve JSON arşiv round-trip kontrolleri ayrıca `test_aglab_import.py` tarafından çalıştırılır. Sayılar yalnızca ilgili koşunun raporu PASS ise doğrulanmış sayılır. Yeni örnek eklemek için izinli ve kişisel veri içermeyen kaynak kullanın; kaynak türünü, beklenen sonucu ve sınırları açıkça belirtin.

## Büyük topoloji kontrolü

`test_aglab_large_topology.py`, JSON ile oluşturulan 298 switch ve iki PC'den oluşan 300 cihaz/300 bağlantılık halkayı çalıştırır. Bu yük senaryosu bir `.pkt` sürüm uyumluluk örneği değildir.

Uzak uçlar arasındaki senkron ping komutu için her ölçümde 1000 ms bütçe uygulanır. Ölçümler test çıktısında pipeline JSON raporuna kaydedilir. Bu eşik CI regresyon bütçesidir; her donanım için gecikme garantisi değildir. Tek bağlantı kapanınca alternatif yol, iki bağlantı kapanınca izolasyon, tekrar açılınca erişim ve 301 cihaz/1001 bağlantı girişinin mevcut kaydı bozmadan reddi doğrulanır. Port değişikliklerinin sonuçları yeni yol aramasında yeniden hesaplanır.
