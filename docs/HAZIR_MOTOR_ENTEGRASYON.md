# Hazır motor entegrasyonu — 5 Kasım 2026

## Karar ve doğrulanmış kapsam

Michael Borck NetSim'in **gerçek, değiştirilmemiş MIT TypeScript motoru** AğLab'ın
çevrimdışı HTML'sine derlenmiştir. Sürüm sabiti:
`c3075e7fe65b7e17515d802eaef625bab751af58`.
Bu, mevcut bağımsız `engine-adapter-prototype.cjs` motorunun yeniden adlandırılması
değildir. O prototip ve karşılaştırma testleri korunur; yeni özellik eklenmedi.

Yeni yol isteğe bağlı karşılaştırmadır: **Lab → Paket Dedektifi → MIT NetSim ile
karşılaştır**. Seçili kaynak ve hedef kullanılır. Mevcut CLI, varsayılan ping,
Akademi ve puanlama kendi motorunda kalır. CLI ile değişen ortak yapılandırma
sonraki karşılaştırmada tekrar alınır. İçe aktarılan orijinal PKT ve öğrenci
topolojisi değiştirilmez. İlk gerçek örnek iki PC ve iki access switch'tir.
VLAN 10/20 access izolasyonu vardır; **802.1Q trunk yoktur**. İstenen trunk
topolojisini bu motorda çalışıyor saymıyoruz. Trunk varlığında açık kapsam
reddi döner; mevcut AğLab motoru kullanılmaya devam eder.

## Kaynak kodu incelemesi

| Ölçüt | NetSim Labs | Michael Borck NetSim | NetForge | FRRouting |
|---|---|---|---|---|
| İncelenen sürüm | df683455d05feaeed1fde7982a1cb2e9462b4768 | c3075e7fe65b7e17515d802eaef625bab751af58 | cad4ac90358ac5ef748483de7e78d8086405d1e8 | AğLab imajı containerlab-10.7.1; FRR 10.7.1 kaynakları |
| Gerçek kod | Rust simulation/mod.rs, lib.rs, routing.rs; TS bgpUtils.ts | engine/network,device,switch,ipdevice,scheduler,firewall,conntrack | scheduler,simulation,eth-switch,ospf,events/CLI/capture kaynakları | ospfd/ospf_neighbor.c, bgpd/bgp_fsm.c, COPYING; mevcut AğLab topology/config/API |
| Protokol bulgusu | Rust paket yolu yalnız doğrudan kablo/IP eşleşmesi; OSPF komşu çıktısı sabit boş; BGP summary simüle/sabit. Ayrı TS recomputeBgp modeli var; tam Rust protokol motoru kanıtı değil | ARP/IPv4/ICMP, VLAN bazlı MAC öğrenimi, access VLAN; ayrıca kodda TCP/UDP, DHCP/DNS/HTTP, RIP, firewall/NAT; bu tur yalnız ARP/ICMP/access VLAN çalıştırıldı | VLAN/trunk, ARP/ICMP, IPv4/6, TCP/UDP, DHCP/DNS/HTTP, STP, OSPF/EIGRP ve capture kodları var; çalıştırılmadı. BGP daemon desteği doğrulanmadı | Gerçek OSPF/BGP daemonları ve Linux veri düzlemi; mevcut canlı örnek statik routing kullanıyor |
| Tarayıcı / WASM | React + Rust WASM; wasm-bindgen set_topology/get_devices/execute_command | Saf TS; WASM, sunucu ve çalışma zamanı npm bağımlılığı gerekmez | Saf TS; DOM'suz engine, React/Pixi client; WASM gerektirmez | Yerel Linux/Docker; doğrudan çevrimdışı HTML içinde çalışmaz |
| Topoloji uyumu | NetworkDevice/NetworkCable/port config dönüşümü + WASM araç zinciri | devices/interfaces → Network, Host, SwitchDevice; access port eşlemesi küçük | Model kataloğu, config AST, process/port/profile şemaları büyük dönüşüm gerektirir | Containerlab ve cihaz config üretimi; mevcut örnek altyapı korunmalı |
| CLI | Cisco/Huawei komut katmanları; her komutun paket semantiği ayrıca doğrulanmalı | Linux CLI ayrı uygulama katmanı; Cisco CLI ithal edilmedi | Cisco benzeri parser/mode/handlers var; AğLab eşdeğerliği çalıştırılmadı | vtysh; Cisco benzerliği tam IOS eşitliği değildir |
| Paket olayları | TS UI olayları ve Rust event iskeleti; uçtan uca yol doğrulanmadı | onWireTransfer bağlantı gönderim bildirimi: id/link/kaynak/hedef/kind/sanal zaman; ARP op/ICMP type/ham byte yok | SimEvent/PDU, DebugEvent, capture/tap/PCAP API kaynakları var | Paket yakalama ayrı Linux araçlarıyla; mevcut snapshot API metinsel tanı verir |
| Performans kanıtı | Ölçülmedi | Bu tur 10/50/100/250 cihaz karşılaştırması; sınırlar aşağıda | Ölçülmedi | Önceki canlı CI; bu tur hız karşılaştırması yok |
| Lisans | LICENSE: AGPLv3. Birleştirilmiş türev dağıtımı ve değiştirilmiş ağ etkileşimi kaynak koşulları getirir; AğLab'da kök lisans yok. Kod alınmadı | LICENSE: MIT, telif/izin metni korunur. 10 özgün kaynak + LICENSE hashleri upstream Git bloblarıyla doğrulandı; lisans bundle/HTML ve ZIP'te | Kök veya engine lisans dosyası bulunamadı, package.json lisans tanımlamıyor. Açık depo olmak kullanım izni yerine geçmez; kod alınmadı | COPYING dosya bazlı SPDX lisanslarını belirtir; birleşik binary için GPLv2+ görüşü verir. Mevcut ayrı container yolu; tarayıcıya FRR kodu kopyalanmadı |
| Entegrasyon / 40 lab | Yüksek; README tüm labların çalışacağını kanıtlamaz | Düşük başlangıç maliyeti ama trunk/STP/OSPF/BGP eksik. 40 labın yerine geçemez | Yüksek şema maliyeti; lisans açıklığı ön koşul. Kapsamı umut verici ama 40 lab uyumu kanıtlanmadı | Mevcut Gerçek Lab yeniden yazılmaz. 40 labın otomatik gerçek cihaz kurulumu henüz yok |

Birincil kaynaklar:

- [NetSim Labs kaynakları ve lisansı](https://github.com/netsim-labs/netsim/tree/df683455d05feaeed1fde7982a1cb2e9462b4768)
- [Borck motor kaynakları](https://github.com/michael-borck/netsim/tree/c3075e7fe65b7e17515d802eaef625bab751af58/src/engine), [MIT lisansı](https://github.com/michael-borck/netsim/blob/c3075e7fe65b7e17515d802eaef625bab751af58/LICENSE)
- [NetForge engine](https://github.com/FediMechergui/netforge/tree/cad4ac90358ac5ef748483de7e78d8086405d1e8/packages/engine)
- [FRR kaynakları](https://github.com/FRRouting/frr/tree/frr-10.7.1), [COPYING](https://github.com/FRRouting/frr/blob/frr-10.7.1/COPYING), [OSPF](https://docs.frrouting.org/en/latest/ospfd.html), [BGP](https://docs.frrouting.org/en/latest/bgp.html)

MIT seçimi, Packet Tracer kapsamına en yakın motor olduğu iddiası değildir.
İzinleri açık ve küçük bir çalıştırılabilir entegrasyonu kanıtlamaya uygun adaydır.
İleri routing için mevcut FRR daha doğru hedeftir. Yeni bağımsız protokol motoru
yazmak yerine sonraki adım bu sınırdaki gerçek ihtiyacı ölçmektir.

## Gerçek entegrasyonun kanıtı

- `third_party/borck-netsim/engine/*.ts`: upstream'den byte eşit özgün kaynaklar.
- `LICENSE` ve `provenance.json`: sürüm, kaynak ve her dosyanın SHA256 özeti.
- `simulator/borck-adapter.ts`: yalnız şema dönüşümü, kapsam kapısı, API çağrıları
  ve gerçek tablo/olay okuması. `Host.sendEcho`, `Scheduler.advanceTo`,
  `SwitchDevice.receiveFrame` upstream kodunda çalışır.
- `tools/build_borck_engine.cjs`, sabit `esbuild@0.25.12` ve lock dosyası:
  hash kapısı ardından tekrarlanabilir browser IIFE. Çalışma anında CDN yok.
- `borck-engine.generated.js` ve `borck-ui.js` tek HTML'ye gömülür.
- `packet-detective-ui.js` gerçek `onWireTransfer` bildirimlerini ayrı kaynak
  etiketiyle gösterir. Bunlar simülasyon bildirimidir, PCAP veya gerçek kablo
  yakalaması değildir. İletim bildirimi alıcıya ulaşma kanıtı diye sunulmaz.
  Sahte ARP request/reply alanı veya düşme sebebi üretilmez.
- `test_borck_engine.cjs`: 10 sözleşme grubu; gerçek kaynak hashleri,
  iki switch ARP/ICMP, önbellek, FDB, izolasyon, kablo/port/cihaz arızası,
  gateway hatası, destek reddi, özgün verinin değişmemesi.
- `test_aglab_borck_engine.py`: tam çevrimdışı HTML'de üretim CLI ping ile
  sonuç karşılaştırması; gerçek CLI shutdown/VLAN değişiminin yeni motora
  yansıması, Paket Dedektifi, yanlış gateway, kablo ve VLAN başarısızlıkları.
  Trunk mevcut motorda çalışır, yeni motor açıkça reddeder.

Kapsam kapısı router/server, alt arayüz/SVI, port-security, ACL/NAT/static route,
trunk ve L2 döngüyü reddeder. AğLab'ın desteklediği bir özelliği sessizce atlayıp
başarılı sonuç üretmez. İlk sürüm oturumunu yeniden kurar; UI karşılaştırmaları
arasında ARP/FDB korunmaz. Bağımsız createSession testi sıcak önbelleği doğrular.
Mevcut CLI aynen korunur; paralel Cisco komut ayrıştırıcısı eklenmedi.

## Performans yöntemi ve sınırları

`node --expose-gc simulator/benchmark_borck_engine.cjs` aynı Node sürecinde
iki access switch + 8/48/98/248 PC ağını çalıştırır. İki ısınma + yedi örnek
medyanı: başlangıç, soğuk/sıcak ping, heap tahsis farkı ve olay sayısı kaydedilir.
Mevcut gerçek Ethernet/MAC modülleri VM içinde, dış uygulama bağımlılıkları
sağlanarak çalışır; karşısında derlenmiş upstream motor vardır. Başlangıçta
VM kurma maliyeti mevcut motora dahildir. Ping süresi tablo/olay okumasını da
içerir. Heap farkı kalıcı bellek veya RSS değildir. Olayların anlamı/sınırı
farklıdır (AğLab 256 olay; NetSim adaptörü 4096 bildirim). Tek paketin CPU
işleme süresi ayrıca izole edilmedi. Bu mikro ölçüm genel hız üstünlüğü,
tarayıcı çizim performansı, trunk veya 40 lab performansı kanıtı değildir.

Makine/sürüm ve kesin sayılar CI `borck-benchmark.json` dosyasındadır.
Çalışma sonu raporunda yerel tablo ayrıca verilir. Yeni motorun daha hızlı
olduğu genel iddiası yapılmaz.

## Çalıştırma ve koruma kapıları

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build:engine
python build_simulator.py
python build_academy.py
node simulator/test_borck_engine.cjs
python test_aglab_borck_engine.py
python run_pipeline.py
```

CI, derlenmiş bundle'ın kaynaklara eşitliğini ve iki ardışık HTML üretiminin
byte eşitliğini denetler. `run_pipeline.py` HTML'yi testlerden önce kaynaklardan
yeniler; başarılı ZIP güncel HTML'yi içerir. Depodaki hazır HTML de NetSim,
motor seçimi ve tanı modüllerini içerir. CI, yeniden üretilen HTML ile kaydedilmiş
HTML arasında fark varsa başarısız olur; hazır çevrimdışı dosya kaynaklardan geri kalamaz.
Yeni motor testleri, karşılaştırma ve ölçüm pipeline'a dahildir. ZIP doğrulama
lisans, özgün kaynak hashleri, yeni bağımlılıklar, 40 lab ve öğrenci/öğretmen
ayrımını kontrol eder. Geçmeyen koşuda doğrulanmış ZIP üretilmez.

Geri alma: `build_simulator.py` içindeki BORCK ENGINE/BORCK UI gömme girdilerini
ve ilgili generated blokları kaldırmak karşılaştırmayı çıkarır; varsayılan
ping/CLI/puanlama zaten değiştirilmemiştir. FRR, admin token ve öğrenci API'si
bu entegrasyona taşınmaz. Şube senaryosu ve gelecek fikirleri uygulanmadı.

## Kalan öncelikler

1. Bu dar entegrasyonun CI/paket sonuçlarını doğrula; 40 labın yeni motora
   taşındığı veya Packet Tracer eşdeğerliğinin sağlandığı iddiasında bulunma.
2. Tarayıcıda trunk/STP ihtiyacı için lisansı açık ve gerçek API'si yeterli
   bir bileşen bul; NetForge lisansı açıklığa kavuşmadan kodunu alma.
3. OSPF/BGP'de mevcut FRR örneğini yeniden kurmadan, komşuluk/rota/çekilme
   doğrulamalarını genişlet; öğrenciye Docker/admin yetkisi verme.
