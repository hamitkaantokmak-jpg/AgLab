# Motor bulguları

Testlerin ortaya çıkardığı, Labber motorunun gerçek IOS/VPCS'ten farklı davrandığı ve motorda
düzeltilen noktalar. Her satırda bulgu, gerçek davranış, düzeltme ve bunu sınayan test.

## I-1 (içe aktarma ve düzenleyici Labber'a)

| Bulgu | Gerçek davranış | Düzeltme | Test |
|---|---|---|---|
| Dinamik MAC girdileri yaşlanmıyordu | IOS `mac address-table aging-time` varsayılanı 300 s: son çerçeveden 300 s sonra girdi düşer, trafik tazeler | `src/sim/runtime.ts` `AgingSet` (öğrenme zamanı), okurken (`show mac address-table`, değerlendirme) süresi dolan girdiler silinir | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| Access VLAN değişince eski MAC girdisi yeni VLAN'da görünüyordu | IOS portun VLAN'ı/kipi değişince o portta öğrenilmiş dinamik girdileri siler; adres yeni VLAN'da yeniden trafik gönderince öğrenilir | `LabRuntime.flushRevlannedPorts` (commit'te port imzası: kip/access/native VLAN) | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| `clear mac address-table dynamic` bütün switch'lerin tablosunu siliyordu | IOS yalnız komutun çalıştığı switch'in tablosunu temizler | `LabRuntime.clearMacs`/`seenOn` (switch başına gizleme; adres yeni trafikte yeniden görünür; **doğrulanmadı:** trafiğin o switch'ten geçip geçmediği ayrımı yok) | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| STP kök vektörü en çok 64 turda yayılıyordu | 802.1D'de kök bilgisi her köprüden geçer; döngüsüz zincirde tek kök ve bloklu port yok | `computeStp` tur sayısı köprü sayısı + 1 (**doğrulanmadı:** IOS max-age/mesaj yaşı 802.1D çapını sınırlar; Labber zamanlayıcı modellemez) | `tests/sim/large_topology.test.ts`, `test_aglab_large_topology` |
| Ayrıcalık kipi testlerde ortak sanılıyordu | IOS: kip cihaz başına oturumdur | — (motor doğru; test uyarlandı) | `test_aglab_trunk_defaults` |
| "allowed vlan all" AğLab'a yazılamıyordu (kayıt/dışa aktarma eksik) | AğLab "hepsi"ni 1-4094 listesiyle ifade eder (PKT dönüştürücüsü de) | `toAglab` null → 1-4094 | `tests/sim/bridge.test.ts`, `test_aglab_trunk_defaults` |
| Bağlı ağda ARP çözülemeyince paket sessizce düşüyordu | IOS kaynağa ICMP host unreachable (kod 1) gönderir; ARP girdisi önbellekteyse (hedef sonradan kapandı) çerçeve gönderilir, yanıt gelmez | `deliver`: router ARP başarısızlığında `unreach` (önbellek soğuksa); router ARP önbelleği `markSeen` ile (`show ip arp`'ta görünür) | `tests/sim/routing-acceptance.test.ts`, `test_aglab_icmp_unreachable` |
| Çok yöncü/yayın hedeflerine ICMP hatası üretilebiliyordu | RFC 1812 / IOS: 224.0.0.0/4, 255.255.255.255 ve bağlı ağın yönlendirilmiş yayını için ICMP hatası yok | `noIcmpError`; izde `icmp-error-suppressed` | `test_aglab_icmp_unreachable` |
| Simulation Mode izinde ICMP unreachable dönüşü yoktu | Router'ın unreachable'ı kaynağa giden bir pakettir | `pingTrace`: `icmp-unreachable` çerçeveleri (tip 3, kod 1/13) | `test_aglab_icmp_unreachable` |
| VPCS `trace -m` yoktu | VPCS `trace <hedef> -m <ttl>` | `VpcsSession.trace(dst, maxHops)` | `test_aglab_icmp_unreachable` |
| NAT, ICMP hata iletisini (Time Exceeded/unreachable) geri çevirmiyordu (PAT arkasından traceroute yanıtsız) | NAT, ICMP hatasını içindeki özgün UDP/TCP başlığına göre çevirir (RFC 5508) | `natInbound`: ICMP hatası özgün kaynak portuyla eşleşir | `tests/sim/nat.test.ts`, `test_aglab_traceroute` |
| Paket 32 atlamada kesiliyordu (TTL'den önce) | Döngüde paket TTL dolunca düşer, Time Exceeded döner | `deliver`: varsayılan TTL 255, tur sınırı 256; VPCS ping TTL 64 | `test_aglab_traceroute` (64 atlamalı döngü) |
| IOS kendi adresine ping'de ilk paketi ARP'ye kaybediyordu (`.!!!!`) | Kendi adresi için ARP yok: `!!!!!` | `IosSession.ping`: atlama yoksa ARP soğuk sayılmaz | `tests/sim/sim.test.ts`, `test_aglab_v15_local_ping` |
| Switch'ler yalnız gidiş çerçevelerinden MAC öğreniyordu (asimetrik dönüşteki router görünmüyordu); yanıt veren uç ARP önbelleğine isteyeni almıyordu | Switch her iki yöndeki çerçevelerin kaynak MAC'ini öğrenir; ARP isteğinin hedefi göndereni önbelleğe alır (RFC 826) | `LabRuntime.markExchange` (gidiş ve dönüş teslimatı) | `test_aglab_next_hop`, `tests/sim/macarp.test.ts` |
| PKT IOS metin yoluyla kurulan durum AğLab görünümüne yazılamıyordu (kayıt kaybı) | — (köprü hatası) | `toAglab`: IOS `dynamic auto` port AğLab `access` gösterimiyle; metin yolu yalnız metin cihazı hâlâ tarif ediyorsa | `test_aglab_persistence` |
| Labber çalışma alanında Simulation Mode açıkken ping yeni izi yakalamıyordu (eski iz kalıyordu) | — (ürün hatası: `aglab:trace-ready` yalnız eski motor ping'inde yayılıyordu) | `labberSimulationTrace` iz hazır olayını yayar | `test_aglab_simulation_mode` |
| Labber'ın TTL düşürme kaydı (`ttl-expired <cihaz>`) Simulation Mode'da düşürme noktası olarak görünmüyordu | Router TTL 1'i düşürür, kaynağa Time Exceeded döner | `packet-events.js normalize`: alıntısız `ttl-expired` da `discard` (`ttl-expired`) | `test_aglab_simulation_mode` |
| "İlk Ağım" rehberinin ping düğmesi Labber çalışma alanında eski motorla ölçüyordu (terminal Labber, rehber eski motor) | — (iki motor) | Rehber Labber'dayken `aglabEngineChoice.labberPing` + Labber izi; inceleme kanıtı izin kaynağıyla eşlenir | `test_aglab_unified_rc` |
| Paket Dedektifi Labber izini "AğLab simülasyon motoru" diye etiketliyordu | — (yanlış kaynak adı) | Kaynak izin `origin` alanından: "Labber motoru" | `test_aglab_unified_rc`, `test_aglab_simulation_mode` |
| Sorun Çöz senaryosu yüklenirken iki Labber çalışma zamanı kuruluyordu (çalışma alanı kararı + senaryo kararı) | — (tek kalıcı çalışma zamanı kuralı) | Senaryo yüklenirken `workspaceDecideEngine` atlanır | `test_aglab_sim_embedded` |

## Ders yazarken görülen açık eksikler (Seviye 1–2)

Seviye 1 ve Seviye 2 derslerini yazarken Labber'da (src/sim) ve AğLab topoloji modelinde (src/sim-bridge)
görülen eksikler. Her satırın ayrıntısı ilgili dersin "Doğrulama notları" bölümündedir
(`docs/dersler/<konu>.md`). Öncelik: **P1** ders senaryosunu engelliyor ya da yanlış öğretiyor,
**P2** gerçekçiliği bozuyor, **P3** biçim.

### Model (AğLab topoloji modeli; kayıt ve dışa aktarma)

Labber çalıştırıyor ama `toAglab` yazamıyor; komut yazılınca arayüz uyarı veriyor, senaryo kurulamıyor.

| Öncelik | Eksik | Etkilenen ders |
| --- | --- | --- |
| P1 | EtherChannel: Port-channel, `channel-group` (mod) | #14 (senaryolar bekliyor) |
| P1 | OSPF arayüz ayarları (`ip ospf cost/hello/dead/priority/network`), `passive-interface`, `default-information originate` | #15 (Hello/Dead senaryosu kâğıt üstünde) |
| P1 | STP: PortFast, BPDU Guard (`portfast bpduguard default` dahil) | #13 |
| P2 | Port security sticky | #21 |
| P2 | NAT: statik NAT, port yönlendirme, havuz (`ip nat pool`, `… pool NAME`) | #20 |
| P2 | ACL satırında ICMP türü (`echo` vb.) ve ardışık olmayan wildcard | #19 |
| P2 | Arayüz `description`, `speed`/`duplex` | #4 |

### Motor (Labber)

| Öncelik | Bulgu | Ders |
| --- | --- | --- |
| P1 | Statik rota çözümü: bir statik rota aynı önekteki başka bir statik rota üzerinden çözülüyor; floating static gösterimi yanlış | #8 |
| P1 | Port security dinamik öğrenilen güvenli adresleri saymıyor: maksimum 1'li porttan iki MAC geçiyor, `Total MAC Addresses: 0`; IOS'ta ikincisi ihlal | #21 |
| P1 | HSRP/VRRP yok (`standby`, `vrrp`, `track`, `show standby [brief]`) | #18 (okuma dersi) |
| P1 | IPv6 yok (adres, link-local, NDP, SLAAC, `ipv6 route`, `show ipv6 …`, VPCS IPv6) | #16 (okuma dersi) |
| P2 | Döngüde router `traceroute` her atlamada aynı adresi gösteriyor, 16. atlamadan sonra yıldız; ping `&`/TTL expired yerine `.`/timeout | #24 |
| P2 | ACL'nin düşürdüğü pakete ICMP tip 3 kod 1 dönüyor; IOS kod 13 (administratively prohibited) | #19 |
| P2 | Aynı OSPF router ID algılanmıyor (`%OSPF-4-DUP_RTRID`) | #15 |
| P2 | NATIVE_VLAN_MISMATCH ve DUPADDR uyarıları yalnız durum değişince; başlangıçta ve periyodik olmalı | #3, #5–6, #12 |
| P2 | Eksik show komutları: `show cdp`, `show cdp entry`, `show cdp neighbors <port>`, `show cdp traffic`, `show lldp`, `show interfaces description`, `show mac address-table dynamic`, `show interfaces counters errors` | #4, #12 |
| P2 | CDP yetenek kodu (2960: S I; LLDP: B), CDP detail'de Native VLAN/VTP yok, sürüm `show version` ile tutarsız | #12 |
| P2 | VPCS'te adla ping yok; DNS kayıtları yalnız cihaz adları; büyük harfli adlar kimliğe çevriliyor | #10 |
| P2 | Hazır DHCP kiraları sunucunun binding tablosunda yok | #9 |
| P2 | DHCP snooping, DAI, storm control, Root Guard, `errdisable recovery` yok | #13, #21 |
| P3 | PortFast kapalıyken erişim portları `show spanning-tree`'de "P2p Edge" | #13 |
| P3 | `show ip route`'ta tek /24 rotasının üstüne "is subnetted, 1 subnets" başlığı | #15 |
| P3 | Trunk'ın varsayılan "allowed vlan" değeri running-config'te görünüyor | #5–6 |

### Senaryo sorgu listesi (`SHARED_QUERY_FNS`)

Dersler için eklenenler: `dhcpLease`, `dnsLookup`, `http`, `ospfAdjacent`. Model desteği gelince
`etherchannel` eklenmeli; CDP/LLDP için LabQuery sorgusu yok; `routeFor` listede değil.
