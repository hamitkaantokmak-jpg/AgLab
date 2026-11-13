# Ders yazarken görülen motor ve model bulguları

Seviye 1 ve Seviye 2 derslerini yazarken Labber'da (src/sim) ve AğLab topoloji modelinde (src/sim-bridge)
görülen eksikler. Her satırın ayrıntısı ilgili dersin "Doğrulama notları" bölümündedir
(`docs/dersler/<konu>.md`). Öncelik: **P1** ders senaryosunu engelliyor ya da yanlış öğretiyor,
**P2** gerçekçiliği bozuyor, **P3** biçim.

## Model (AğLab topoloji modeli; kayıt ve dışa aktarma)

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

## Motor (Labber)

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

## Senaryo sorgu listesi (`SHARED_QUERY_FNS`)

Dersler için eklenenler: `dhcpLease`, `dnsLookup`, `http`, `ospfAdjacent`. Model desteği gelince
`etherchannel` eklenmeli; CDP/LLDP için LabQuery sorgusu yok; `routeFor` listede değil.
