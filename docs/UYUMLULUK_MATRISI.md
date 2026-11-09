# AğLab / Packet Tracer hedefi için uyumluluk matrisi

6 Kasım 2026. Bu tablo **AğLab'da bağlanan ve test edilen yolu** sınıflandırır;
upstream projelerin bütün özelliklerini AğLab'ın desteği gibi saymaz.

## Ortak aktarım ve yeni native senaryolar (6 Kasım)

| Özellik | AğLab JS | MIT NetSim | Linux bridge | FRRouting | Gerçek test / öğrenciye sunum | Sınır |
|---|---|---|---|---|---|---|
| Ortak v23 JSON → VLAN/trunk | Mevcut biçim; JSON indirme | Access LAN karşılaştırması korunur | Sınırlı operatör dönüştürücüsü entegre | Sınırlı ayrı router dönüştürücüsü | shared_smoke CI raporu; öğrenci yalnız JSON/rapor kullanır | 2–4 PC, 1–2 switch, döngüsüz; gateway/security reddedilir |
| AGL-024 arıza/onarım | Özgün görev değişmedi | Trunk desteklenmez | Gerçek dört PC/iki switch, VLAN10/20 | Gerekmez | Başlangıç ping kaybı, trunk onarımı ve iki VLAN ICMP | Yalnız bu temsilî Akademi görevi native test edildi |
| Ortak v23 JSON → statik FRR | Mevcut JSON/CLI | Routing kapsam dışı | İsteğe bağlı VLAN1 köprü | PC/router/static-route verisi entegre | routed_smoke: 2/3 router, AGL-034/035 arıza/onarım geçti; CI 42192382258 / a1d6382 | 2–4 PC, 1–3 router, 0–2 access bridge; IPv4/private/default route, AD; advanced alanlar reddedilir |
| IPv6 statik rota / ND / ICMPv6 | Yeni tarayıcı IPv6 yok | Entegre değil | L2 altyapı; bu senaryo routing | Sınırlı native senaryo entegre | extended_routing CI: pozitif, transit rota kaybı, onarım; rapor inceleme | SLAAC/DHCPv6/OSPFv3 yok |
| Multi-area / ABR / passive | Mevcut basit eğitim OSPF'si | Yok | Gerekmez | Native area0/1/2 senaryosu entegre | FRR N IA + gerçek trafik, passive arızası/onarımı | Authentication/iBGP yok; dar BGP policy ayrı native senaryoya bağlı |
| ABR özetleme | Entegre değil | Yok | Gerekmez | Kaynakta var; deneysel test yazıldı | Önceki CI: /23 yok; yeni yerel native deney: ABR timer içinde ospfd SIGSEGV; sunulmadı | `--experimental-summary` yalnız yeniden üretim; tamamlanmadı |
| Native ACL / TCP / UDP | Eğitim modeli korunur | Yok | Gerekmez | FRR yerine kernel nftables | security_smoke acl: 28 native kontrol geçti; CI 42205155584 / 6f651fe | Ayrı operatör örneği; Akademi ACL görevleri otomatik aktarılmaz |
| Native SNAT / PAT | Eğitim modeli korunur | Yok | Gerekmez | Kernel nftables + conntrack | security_smoke nat: 21 native kontrol geçti; iki istemci, peer IP/port, conntrack; CI 42205155584 | İnternetsiz; sınırlı sabit IPv4 senaryosu; genel NAT dönüştürücüsü yok |
| RSTP / LACP | Gerçek protokol yok | Entegre değil | mstpd/bonding kaynakta mümkün; entegre edilmedi | Kapsam dışı | Çalıştırılmadı; öğrenciye sunulmadı | Kaynak yeteneği başarı sayılmaz |

Gerçek koşunun **başarı** durumu dağıtımla verilen CI/JSON kanıtından okunmalıdır. Yukarıdaki “entegre” ifadesi dosya/senaryo bağlandığını belirtir; test sayısı bir uyumluluk yüzdesi değildir. Ayrıntı: [ortak Gerçek Lab](ORTAK_GERCEK_LAB.md), [40 görev haritası](LAB_MOTOR_HARITASI.md). Mevcut klasik STP14 ve temel FRR16 denetimleri korunur.

Durumlar: **Tam destek**, **Sınırlı eğitim modeli**, **Deneysel**,
**Desteklenmiyor**, **Doğrulanmadı**. Bu sürümde hiçbir satır için tüm Cisco
IOS/Packet Tracer davranışlarını kapsayan “Tam destek” iddiası yapılmıyor.
“Deneysel / gerçek” gerçek Linux/FRR kodunun çalıştığını, entegrasyonun belirli
lab ve kabul senaryolarıyla sınırlandığını anlatır. Son koşunun başarısı ayrıca
CI/JSON sonuç raporundan kontrol edilmelidir; test dosyasının varlığı başarı değildir.

| Özellik | Mevcut AğLab | MIT NetSim entegrasyonu | Gerçek Lab | Test durumu / kapsamı | Eksik |
|---|---|---|---|---|---|
| Ethernet switching | Sınırlı eğitim modeli | Deneysel: access switch | Deneysel: Linux kernel bridge | frame_forwarding; borck_engine; advanced_smoke l2 | Fiziksel ASIC/hat kodlama/kayıp modeli eşdeğerliği yok |
| VLAN | Sınırlı eğitim modeli | Deneysel: access üyeliği | Deneysel: bridge VLAN filtering | VLAN10/20 izolasyonu ve CLI onarımı; gerçek kernel PVID | Tüm platform/VLAN türleri yok |
| 802.1Q trunk | Sınırlı eğitim modeli | Desteklenmiyor; açık ret | Deneysel: Linux bridge | Allowed listeden çıkarma/onarım, native VLAN eşleşme/uyuşmazlık | DTP/ISL/tüm Cisco native politikaları yok |
| STP | Sınırlı eğitim modeli: deterministik ağaç, iletimi etkiler | Desteklenmiyor; döngü ret | Deneysel: kernel 802.1D | 3 switch, root, bir blocked port, kablo kopması ve alternatif gerçek ICMP | Tarayıcıda gerçek BPDU/timer yok; native yol PVST/MSTP/RSTP değil |
| ARP | Sınırlı eğitim modeli | Deneysel: gerçek upstream ARP/cache | Deneysel: Linux ağ yığını | İlk/ikinci ping, tablolar, izolasyon | Her ARP saldırısı/edge case test edilmedi |
| ICMP | Sınırlı eğitim modeli; TTL/unreachable/traceroute testleri var | Deneysel: echo; bu entegrasyonda sınırlı alanlar | Deneysel: gerçek Linux ICMP | Browser pozitif/negatif ping; gerçek lab ping | Tüm ICMP türleri ve PMTU matrisi yok |
| DHCP/relay | Sınırlı eğitim modeli | Desteklenmiyor (upstream kodunun varlığı yeterli değil) | Doğrulanmadı | Mevcut pkt_dhcp_relay ve ortak relay senaryosu | Bu gerçek lablarda DHCP/relay testi yok |
| Routing/statik | Sınırlı eğitim modeli: LPM/AD/return path | Desteklenmiyor (host default gateway dar eşleme dışında) | Deneysel: FRR + Linux FIB | Eski gerçek statik topoloji; yeni dinamik next-hop denetimleri | Tüm route policy/VRF/MPLS yok |
| OSPF | Sınırlı eğitim modeli: AD110; gerçek paket/FSM değil | Desteklenmiyor | Deneysel: gerçek ospfd | Komşuluk, area uyuşmazlığı, router-ID çakışması, yedek yol, withdrawal ve AD110; advanced_smoke routing | Multi-area/ABR ayrı native senaryoda; authentication ve tüm LSA çeşitleri kapsam dışı |
| BGP | Sınırlı eğitim modeli: eBGP/AD20 | Desteklenmiyor | Deneysel: gerçek bgpd | Karşılıklı eBGP, remote-AS hatası, kısa/alternatif yol, withdrawal ve AD20 | iBGP/RR/MED/community ve geniş AFI-SAFI kapsamı yok; dar prefix-list/route-map/local-pref testi native CI kanıtında |
| ACL | Sınırlı eğitim modeli | Desteklenmiyor | Dar native nftables operatör senaryosu | Gerçek TCP/UDP/ICMP ve sayaçlar, kaynak/hedef/port/sıra/onarım | Cisco ACL sözdizimi/genel JSON aktarımı ve FRR ACL karşılaştırması yok |
| NAT | Sınırlı eğitim modeli: PAT | Desteklenmiyor | Dar native nftables SNAT/PAT senaryosu | İki gerçek istemci, TCP/UDP, hedef peer IP/port ve conntrack; arıza/onarım | Genel JSON aktarımı, DNAT/hairpin/many-to-many/IPv6 NAT yok |
| IPv6 | Desteklenmiyor | Desteklenmiyor | Sınırlı native statik senaryo | extended_routing: ND, ICMPv6, rota kaldırma/onarım | SLAAC/DHCPv6/OSPFv3/MP-BGP aktarımı yok |
| CLI | Sınırlı eğitim modeli: Cisco benzeri mevcut katman | Deneysel: ortak yapılandırma API eşlemesi; yeni parser yok | Deneysel: operatör vtysh/ip/bridge | UI CLI trunk/VLAN/shutdown/save/import; gerçek native config komutları | Aynı Cisco komutu birebir FRR/Linux komutu değildir; öğrenciye shell yok |
| PKT import | Sınırlı eğitim modeli; kaynak arşivi korunur | Deneysel: kabul edilen ortak JSON alt kümesi | Desteklenmiyor: seçili PKT otomatik kurulmaz | Mevcut context/MAC/helper/matris/restore testleri | Tüm PT sürümleri/cihazları/seçenekleri desteklenmez |
| Paket animasyonu / Dedektif | Sınırlı eğitim modeli; gerçek motorun simülasyon olayları | Deneysel: upstream wire notification, ham PDU değil | Deneysel: ayrı lab doğrulama raporu; PCAP değil | Gerçek kayıt oynatma, kaynak etiketi, veri-only rapor/XSS/limit ret | Native paket yakalama/animasyon ve tam ARP op/ICMP type henüz yok |
| Öğrenci laboratuvarları | Sınırlı eğitim modeli: 40 kaynak görev korunur | Deneysel: karşılaştırma alt kümesi | Deneysel: önceden tanımlı ayrı topolojiler | 40 kaynak hash'i/paket ayrımı; 17 ortak senaryo; UI öğrenci akışı | 40 lab yeni motora veya gerçek cihazlara taşınmış sayılmaz |
| Kaydet/yükle | Sınırlı eğitim modeli; topoloji/config/oturum | Deneysel: tekrar ortak JSON'dan kurulur | Desteklenmiyor: tarayıcı oturumuyla native durum senkronizasyonu yok | Gerçek UI export/import ve kalıcılık testleri | NetSim runtime ARP/FDB ve FRR runtime tarayıcı dosyasında birleşmez |

L2 real-lab başarısı, JavaScript veya MIT motoruna trunk/STP desteği eklenmiş
olduğu anlamına gelmez. Seçili motor bütün denemeyi tek başına yürütür.
FRR/Linux bridge çalışmaları Docker/Linux ve operatör yetkisi gerektirir;
çevrimdışı HTML bu daemonları çalıştırmaz. Öğrenci tanı servisi salt okunurdur.

6 Kasım doğrulaması: [native CI](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42117504225)
Linux bridge **14/14**, FRR **16/16** başarılıdır. Trunk/native/allowed, STP
root/block/failover, FDB/MAC move, OSPF area/router-ID/withdrawal ve BGP
remote-AS/alternate/withdrawal satırlarındaki belirtilen native testler geçti.
JS/MIT ve paket regresyonları [genel CI'da](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42117504238)
başarılıdır. ACL/NAT için daha sonraki ayrı native kanıt üst tablodadır. Native DHCP, RSTP ve tabloda eksik gösterilen geniş
özellikler bu başarıdan destek kazanmış sayılmaz. En güncel build/test koşusu
teslim raporunda ayrıca belirtilir.

Kaynak ve test ayrıntısı: [Gelişmiş motor entegrasyonu](GELISMIS_MOTOR_ENTEGRASYON.md).

## Labber motoru ile eski motor arasındaki bilinen farklar (L2 kararları)

Labber'da açılan içerikte (motor kararı: köprü raporu, `docs/LAB_MOTOR_HARITASI.md`)
değerlendirme Labber'dan gelir. Aşağıdaki farklar oracle (`src/engine`) paritesinde
ölçüldü (`tests/sim/parity.test.ts`, `sim-parity-node.json`). **Gerçek içerikte
(40 Akademi labı başlangıç/hedef, 22 ortak senaryo) hiçbiri görülmüyor**; yalnız
sentetik topolojilerde ortaya çıkıyor. Tarayıcı ping paritesi (124 durum) 0 fark.

| Fark | Eski motor | Labber | Karar |
|---|---|---|---|
| `vlan-carry-unconfigured-port`: arayüz kaydı olmayan switch portu | Trafik taşımaz | Cisco varsayılanı: access VLAN 1 | **Labber.** Gerçek switch davranışı. İçerikte her port kayıtlı olduğundan etki yok. |
| `vlan-carry-trunk-access-mismatch`: bir uç trunk, diğer uç access | Access VLAN trunk'ın izinli listesindeyse taşır | Yalnız native VLAN geçer; etiketli çerçeve access ucunda düşer | **Labber.** 802.1Q davranışı. |
| `vlan-carry-native-mismatch`: native VLAN uyuşmazlığı | STP uygunluk kuralı native'i yok sayar | Native VLAN trafiği geçmez, `%CDP-4-NATIVE_VLAN_MISMATCH` ve PVID_Inc | **Labber.** Eski motorun ping yolu (`linkCarriesVlan`) zaten Labber gibi davranıyor. |
| `stp-blocked-link-choice`: aynı sayıda ama farklı bağlantı bloklanıyor | BFS sırasıyla | Gerçek STP (kök maliyeti, köprü/port kimliği) | **Labber.** STP sonucunu soran ölçüt (`stp-loop`) kök switch'i denetler; bloklanan port seçimine bağlı değil. |
| `route-recursive-next-hop`: özyinelemeli statik next-hop | Destekler | Yalnız doğrudan bağlı next-hop | **Ertelendi (L4).** Router içeriği Labber'a geçmeden eklenecek; o zamana kadar bu içerik eski motorda. |
| Statik rota AD (`ip route … <AD>`) | Destekler | Söz dizimi reddedilir | **Ertelendi (L4).** Aynı gerekçe. |
| `return-path-own-mask` (PR F, `eth-wrong-mask`): kaynakla hedefin maskeleri farklı (/24 ↔ /25), ağ geçidi yok | Gidiş yolunu bulunca erişimi başarılı sayar | Hedef yanıtı kendi maskesine göre gönderir; .11/.12 kendi ağı dışında kalır, yanıt dönmez (timeout) | **Labber.** Gerçek IPv4 davranışı; dersin öğrettiği arıza budur. Senaryo Labber'da değerlendirilir. |
| `return-path-duplicate-ip` (PR F, `eth-duplicate-ip`): aynı IP iki cihazda | Hedefin kimliğini adresten bulur, yanıtı doğru cihazdan sayar | ARP'yi yayın alanında tanım sırasında önce gelen cihaz kazanır (LAPTOP); PC-B'nin kaynağına yanıt dönmez | **Labber.** Gerçek ARP davranışı (`%IP-4-DUPADDR`). |
| Eksik `links[].up` / `device.enabled` alanı | Oracle `linkUp` kapalı sayar; `engine-manager.js` ve borck açık sayar | Açık sayılır (yalnız açık `false` kapalı) | **Labber = ürün davranışı.** İçerikte alanlar her zaman yazılı (0 eksik). |
| Kapalı switch'in açılması | Running-config korunur | IOS `reload`: startup-config yüklenir | **Labber.** Köprülenen içerikte startup = başlangıç yapılandırması; fark yalnız kaydedilmemiş CLI değişikliğinde. |
| Yinelenen IP | Ayrı model yok | Yayın alanında ilk sahip ARP'yi yanıtlar; switch adresi çakışırsa `%IP-4-DUPADDR` | **Labber.** Belirli seçim testlenebilirlik için; gerçekte yarış. |

**Çalışma sırasında motor değişmez.** Labber'da açılan içerik sonradan köprünün
ifade edemediği bir duruma gelirse (ör. topolojiye router eklenirse) sonuç eski
motordan alınmaz; "Değerlendirme hatası" gösterilir. Labber ile CLI'nin (L3'e kadar
eski motor) ping sonucu farklıysa "Motor uyuşmazlığı" gösterilir ve sonuç kabul
edilmez (`tests/test_aglab_engine_choice.py`).

**Akademi (L2-D2).** Labber kararındaki labda (AGL-001…030) ölçütlerin
`required_capabilities` alanı motorun yetenekleriyle eşleştirilir. Labber yetenekleri:
`state_adapter` (`toAglab` görünümü), `icmp_probe` (`LabQuery.ping`) ve `answer_input`.
Kaynak arayüz seçimli probe (`icmp_source_interface`) Labber köprüsünde yok (L4).
Eksik yetenek isteyen ölçüt `on_unavailable` (`not_evaluated`) olur ve geçti sayılmaz.
Labber ping'i deterministik olduğundan beş denemelik `icmp-5-v1` politikasında tek
sonuç beş denemeyi temsil eder. Kaynak JSON'lar ve SHA256 kayıtları değişmedi.
