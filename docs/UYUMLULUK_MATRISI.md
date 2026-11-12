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
| `route-recursive-next-hop`: özyinelemeli statik next-hop | Destekler | **L4: destekler** (oracle ile aynı kural) | **Kapandı (L4).** Parite birebir; fark türü bilinen farklardan çıkarıldı. |
| Statik rota AD (`ip route … <AD>`) | Destekler | **L4: destekler** (`StaticRoute.ad`) | **Kapandı (L4).** Floating static ve OSPF (110) ile karşılaştırma oracle ile aynı. |
| `return-path-own-mask` (PR F, `eth-wrong-mask`): kaynakla hedefin maskeleri farklı (/24 ↔ /25), ağ geçidi yok | Gidiş yolunu bulunca erişimi başarılı sayar | Hedef yanıtı kendi maskesine göre gönderir; .11/.12 kendi ağı dışında kalır, yanıt dönmez (timeout) | **Labber.** Gerçek IPv4 davranışı; dersin öğrettiği arıza budur. Senaryo Labber'da değerlendirilir. |
| `return-path-duplicate-ip` (PR F, `eth-duplicate-ip`): aynı IP iki cihazda | Hedefin kimliğini adresten bulur, yanıtı doğru cihazdan sayar | ARP'yi yayın alanında tanım sırasında önce gelen cihaz kazanır (LAPTOP); PC-B'nin kaynağına yanıt dönmez | **Labber.** Gerçek ARP davranışı (`%IP-4-DUPADDR`). |
| Eksik `links[].up` / `device.enabled` alanı | Oracle `linkUp` kapalı sayar; `engine-manager.js` ve borck açık sayar | Açık sayılır (yalnız açık `false` kapalı) | **Labber = ürün davranışı.** İçerikte alanlar her zaman yazılı (0 eksik). |
| Kapalı switch'in açılması | Running-config korunur | IOS `reload`: startup-config yüklenir | **Labber.** Köprülenen içerikte startup = başlangıç yapılandırması; fark yalnız kaydedilmemiş CLI değişikliğinde. |
| Yinelenen IP | Ayrı model yok | Yayın alanında ilk sahip ARP'yi yanıtlar; switch adresi çakışırsa `%IP-4-DUPADDR` | **Labber.** Belirli seçim testlenebilirlik için; gerçekte yarış. |

**Çalışma sırasında motor değişmez.** Labber'da açılan içerik sonradan köprünün
ifade edemediği bir duruma gelirse (ör. topolojiye servisleri açık bir sunucu eklenirse; L4 öncesinde router eklemek de bu durumdu) sonuç eski
motordan alınmaz; "Değerlendirme hatası" gösterilir. Labber ile CLI'nin (L3'e kadar
eski motor) ping sonucu farklıysa "Motor uyuşmazlığı" gösterilir ve sonuç kabul
edilmez (`tests/test_aglab_engine_choice.py`).

**Akademi (L2-D2, L4).** Labber kararındaki labda ölçütlerin
`required_capabilities` alanı motorun yetenekleriyle eşleştirilir. Labber yetenekleri:
`state_adapter` (`toAglab` görünümü), `icmp_probe` (`LabQuery.ping`), `answer_input` ve
L4'ten beri `icmp_source_interface` (kaynak arayüzlü ICMP; eski motorla aynı kural:
kaynak router, arayüz açık ve adresli, hedefin rotası o arayüzden doğrudan bağlı).
Eksik yetenek isteyen ölçüt `on_unavailable` (`not_evaluated`) olur ve geçti sayılmaz.
Labber ping'i deterministik olduğundan beş denemelik `icmp-5-v1` politikasında tek
sonuç beş denemeyi temsil eder. Kaynak JSON'lar ve SHA256 kayıtları değişmedi.

## L4: Router, yönetimsel uzaklık ve özyinelemeli statik rota (Labber kararları)

Akademi M4 (AGL-031…040) ve routing senaryoları (`return-route`, `forward-route`,
`default-route`, `wrong-prefix`, `unresolved-next-hop`, `lpm-next-hop`, `floating-static`,
`ospf-area`) Labber kararındadır. Rota seçimi oracle (`src/engine/routing.js`) ile birebir:
rastgele router zincirleri ve `tests/node/test_engine_routing.cjs` senaryoları
`tests/sim/parity.test.ts`'de, kabul testlerinin topolojileri (`test_aglab_next_hop`, v11,
v13, traceroute, icmp) `tests/sim/routing-acceptance.test.ts`'de karşılaştırılır.

| Konu | Eski motor | Labber | Karar |
|---|---|---|---|
| Router modeli | `type: Router`, arayüz IP/maske/açık, `staticRoutes`, `route`, `ospf` | `SwitchDef.router`: bütün portlar routed, `ip routing` açık; VLAN/STP/switchport komutları yok | **Labber.** Köprü alanları birebir eşler ve geri yazar (`toAglab`). |
| AğLab'da kaydı olmayan router portu | Açık sayılır (`enabled !== false`) | Köprü açık eşler; Labber'ın kendi router'ı (lab tanımı) IOS gibi `shutdown` başlar | **Eski motor davranışı korunur** (içerik verisi). |
| Aynı ağ + next-hop farklı AD ile yeniden girilir | İkinci satır eklenir | IOS gibi AD güncellenir, tek satır kalır | **Labber (IOS).** İçerikte yinelenen satır yok; köprü yineleneni reddeder (eski motor). |
| `no ip route <ağ> <maske>` (next-hop'suz) | Desteklenmez | Prefix'in bütün rotalarını siler (IOS) | **Labber.** |
| AD 0 ya da 255'ten büyük AD | Oracle sessizce yok sayar | CLI sözdizimi reddeder; köprü reddeder → eski motor | **Labber.** Sessiz yok sayma yerine açık ret. |
| Maskeyle hizasız statik rota ağı (ör. 10.20.1.5/24) | Maskelenip kullanılır | IOS `%Inconsistent address and mask`; köprü reddeder → eski motor | **Labber.** İçerikte yok. |
| Eşit AD'li iki statik rota | İlk satır kullanılır | İlk satır kurulur (oracle ile aynı) | **Oracle'a uyuldu.** Gerçek IOS'taki ECMP yük paylaşımı modellenmedi. |
| Olmayan hosta ping (son router ARP alamaz) | ICMP Host Unreachable (code 1), traceroute `!H` | Paket düşer: zaman aşımı | **Labber.** Fark yalnız içe aktarılan (eski motor) topolojilerde görülür; routing içeriğinde hedefler vardır. |
| Rota yokken dönen ICMP | Network Unreachable (code 0), traceroute `!N` | IOS gibi `U`; traceroute `!H` | **Labber (IOS).** |
| `ping … ttl N` / Time Exceeded, `show ethernet events` | Var | **Desteklenmiyor** | İçe aktarılan topolojiler eski motorda kaldığı için bu araçlar orada çalışır (`test_aglab_icmp_ttl`, `test_aglab_traceroute`). Labber içeriğinde IOS `ping`/`traceroute` vardır. |
| OSPF teşhis metni (`ospf-area`) | Türkçe neden satırı ("area uyuşmazlığı", "maskesi uyuşmazlığı") | Komşuluk kurulmaz; `%OSPF-4-ERRRCV … mismatched area ID` ve `%OSPF-5-ADJCHG … FULL to DOWN` syslog'u; türetilmiş uyuşmazlık türü (`area`, `subnet`) | **Labber (IOS).** `test_aglab_network_features` türetilmiş durumu sorar. |
| AğLab OSPF alanları | `pid`, `routerId`, `networks` | Aynı alanlar eşlenir; `passive-interface`, `auto-cost`, stub, `default-information`, arayüz OSPF ayarları ve loopback Labber'da yapılabilir ama AğLab modeline geri yazılamaz | **Açık hata** (`BridgeError`): kayıt/geri yazım sessiz kayıp yerine hata verir. |
| Routing senaryolarındaki sunucu (`SRV-01`) | Şablonla DHCP/DNS/HTTP servisleri açık | Servissiz sunucu bir uçtur; servisli sunucu L5'e kadar eski motorda | **Senaryoda servisler kapatıldı** (yalnız ICMP hedefi; servisler senaryoda kullanılmıyordu). |
| Alt arayüz (router-on-a-stick: `subif-missing`, `roas-*`) | Var | **L5-a: destekleniyor** | Labber kararında; aşağıdaki "L5-a" bölümü. |
| DHCP sunucusu/relay/istemci, DNS (`relay-trunk`) | Var | **L5-b: destekleniyor** | Labber kararında; aşağıdaki "L5-b" bölümü. |
| Router'da ACL, NAT, BGP; sunucuda HTTP | Var | **Desteklenmiyor (L5)** | Eski motorda kalır (`nat-pat`, `bgp-as`). |

## L5-a: router alt arayüzü / 802.1Q (Labber kararları)

`subif-missing` ve router-on-a-stick senaryoları (`roas-*`) Labber kararındadır. Oracle
paritesi: `tests/node/test_engine_routing.cjs` dot1q vakaları `tests/sim/parity.test.ts`'de
birebir; tarayıcı ping paritesi (`test_aglab_sim_parity`) bu içerikte de fark göstermez;
`test_aglab_next_hop`'un rastgele alt arayüz numaralı adımı `routing-acceptance.test.ts`'de
Labber'da aynı sonucu verir.

| Konu | Eski motor | Labber | Karar |
|---|---|---|---|
| Model | `interfaces["g0/0.N"]{ip, mask, enabled, parent, vlan, encapsulation: "dot1q"}` | `SwitchConfig.subifs["GigabitEthernet0/0.N"]{parent, vlan, native, shutdown, ip}`; routed port üzerinde etiket başına ayrı segment | **Köprü iki yönde birebir.** Eski CLI'nin boş `encapsulation: ''` (yapılandırılmamış) biçimi korunur. |
| `encapsulation dot1Q N native` | Yok ("Native VLAN bu modelde desteklenmiyor") | Var: alt arayüz etiketsiz çerçeveyi alır/gönderir | **Labber.** AğLab modelinde ifade edilemez: `toAglab` `BridgeError` verir (kayıt sessiz kaybolmaz). |
| `encapsulation` olmadan IP'li alt arayüz | Sessizce etkisiz | CLI IOS gibi reddeder; köprü içeriği reddeder → eski motor | **Labber (IOS).** İçerikte yok. |
| Aynı fiziksel portta aynı VLAN iki alt arayüzde | Denetlenmez | IOS gibi reddedilir (CLI ve köprü) | **Labber (IOS).** |
| Üst arayüzün kaydı yok / `enabled` alanı yazılmamış | Alt arayüz etkin değil | Kaydı olmayan router portu açık (L4 kuralı) → alt arayüz etkin | **Bilinen fark.** İçerikte üst arayüz kaydı hep `enabled` ile yazılı (0 örnek). |
| Access porta etiketli çerçeve (`roas-switch-port-access`) | Router'ın VLAN 10 çerçevesi access VLAN 10 portundan geçer; senaryo metni "VLAN 10 PC'leri gateway'e ulaşıyor" der | 802.1Q: access port etiketli çerçeveyi düşürür; VLAN 10 PC'leri de gateway'e ulaşamaz | **Labber.** Senaryonun ölçütü (PC-01 → PC-02, aynı VLAN erişimi PC-01 → PC-03) etkilenmez; belirti metni eski motora göre yazılmış (tarif satırına dokunulmadı, ayrı içerik düzeltmesi). |
| Alt arayüzde OSPF / açıklama | — | Labber'da yapılabilir | AğLab modelinde yok → `BridgeError`. Alt arayüzler OSPF'e katılmaz (modellenmedi). |
| `show interfaces Gi0/0.N` | — | **Desteklenmiyor** (`show ip interface brief` ve running-config alt arayüzü gösterir) | — |
| PC çözüm komutu (`roas-pc-gateway`, `roas-two-faults`) | `ip default-gateway 192.168.20.1` (AğLab PC komutu) | PC terminali VPCS: `ip 192.168.20.12 255.255.255.0 192.168.20.1` | **Tarif çözüm satırı VPCS sözdizimine çevrildi** (Labber kararıyla PC terminali VPCS olduğu için zorunlu; L3-a'daki AGL-013 değişikliğiyle aynı). İpucu metinlerindeki `ipconfig` VPCS'te `show ip`'tir (içerik düzeltmesi ayrıca). |

## L5-b: DHCP ve DNS (Labber kararları)

`relay-trunk` senaryosu Labber kararındadır. Parite: `tests/test_aglab_dhcp_dns.py` aynı
topolojiyi eski motorda (içe aktarılan topoloji) ve Labber'da aynı çözümle çalıştırır; başlangıç
(kira yok, durum değişmez) ve çözüm (adres, maske, ağ geçidi, `dhcpLease`) **fark 0**.
`tests/sim/bridge.test.ts` Labber'ın verdiği adresi `src/engine/dhcp.js allocateLease` oracle'ı
ile karşılaştırır. Akademi lablarının hiçbiri DHCP/DNS kullanmaz (40 lab zaten Labber'da).

| Konu | Eski motor | Labber | Karar |
|---|---|---|---|
| IOS DHCP sunucusu (`ip dhcp pool`, `network`, `default-router`, `dns-server`, `ip dhcp excluded-address`) | Yok (yalnız sunucu servisi) | Var: router ve switch CLI'sinde; `show ip dhcp binding`, `show ip dhcp pool [ad]`, `clear ip dhcp binding *\|A.B.C.D` | **Labber (IOS).** AğLab modeline yeni Router alanları: `dhcpPools[{name, network, mask, defaultRouter?, dnsServer?}]`, `dhcpExcluded[{start, end}]` (köprü iki yönde). Switch üzerinde havuz AğLab modelinde yok → `BridgeError`. |
| Havuz seçimi ve adres | — | İsteğin geldiği arayüzün (relay'de giaddr) adresini kapsayan havuz; dışlanan aralıklar atlanır; aynı istemci aynı adresi alır; yoksa en düşük boş adres | **Labber (IOS).** |
| Çakışma denetimi | Topolojideki bütün yapılandırılmış adresler dolu sayılır | Aynı kural (IOS havuzu ve sunucu servisi) | **Oracle'a uyuldu.** Gerçek IOS adresi vermeden önce ping atar (yalnız yanıt veren adres atlanır); kapalı cihazın adresi de dolu sayılır — **doğrulanmadı** (IOS ile birebir değil). |
| `ip helper-address` (relay) | Router arayüzünde tek adres (`helperAddress`); sunucuya rota aranır | Routed port, alt arayüz ve SVI'da birden çok adres; relay sunucuya ulaşabilmeli **ve** sunucu yanıtı relay arayüzüne (giaddr) döndürebilmeli | **Labber (IOS).** AğLab modeli arayüz başına tek helper tutar: ikinci helper ve SVI'daki helper `BridgeError`. Eski motor dönüş yolunu denetlemiyordu (içerikte fark yok). |
| Sunucu servisi (`services.dhcp`) | Tek örtük havuz: yerelde sunucunun alt ağı (ağ geçidi = sunucunun ağ geçidi), relay'de relay arayüzünün alt ağı (ağ geçidi = relay adresi); ağın 100. adresinden başlar | Aynı kural (`src/engine/dhcp.js`) | **Oracle'a uyuldu.** Bu bir AğLab kararıdır, gerçek bir DHCP sunucusunun kapsam (scope) yapılandırması modellenmez. |
| DNS servisi açık sunucunun kirası | DNS adresi verilmez | DNS sunucusu olarak kendi adresini verir | **Labber.** `relay-trunk` sunucusunda DNS kapalı (fark yok). |
| Kira süresi | Yok | Süre işlemez; `show ip dhcp binding` son kullanma olarak lab saatine göre ertesi günü (`Mar 02 1993 …`) yazar | **Zamanlama modellenmez.** Yenileme/süre dolması yok. Sütun genişlikleri ve `Client-ID` biçimi (01 + MAC) IOS 15 çıktısına göre — **doğrulanmadı**. |
| `show ip dhcp pool` | Yok | `Total addresses` ağdaki kullanılabilir adres sayısı; `Current index` dışlanmamış ve kiralanmamış ilk adres | **Doğrulanmadı:** gerçek IOS'ta `Current index` sıradaki adaydır (dışlananları atlamadan ilerleyebilir); `Utilization mark`/`Subnet size` satırları sabit yazılır. |
| Havuz kipi hata metinleri | — | Aynı ağ için ikinci havuz: `% A pool already exists for network …`; ters aralık: `% Invalid range of IP addresses`; olmayan havuz: `% Pool X not found`; geçersiz maske: `% Invalid input` | **Doğrulanmadı** (metinler IOS'a yakın yazıldı; birebir karşılaştırılmadı). `% Range [a, b] is not in the database.` IOS metnidir. |
| `lease`, `domain-name`, `option`, `host`/`hardware-address`, `service dhcp`, `ip dhcp snooping`, DHCP istemci arayüzü (`ip address dhcp`) | Yok | **Desteklenmiyor** (`% Invalid input`) | — |
| Kiralar (binding) | PC'nin `dhcpLease` alanı | Çalışma zamanı durumu (RAM): sunucu yeniden başlayınca, `clear ip dhcp binding` ile ve havuz/servis kapatılınca silinir | **Labber (IOS).** Tarayıcı kaydında yalnız PC'nin `dhcpLease`, adresi ve `dns` alanı saklanır; sayfa yenilenince sunucunun binding tablosu boş başlar (kalıcılık L7). |
| PC istemcisi | `ip dhcp` / `ipconfig /renew` | VPCS: `ip dhcp` (`-r` yenile, `-x` bırak), `dhcp`; `show ip` DNS ve DHCP sunucusunu gösterir | **Tarif çözüm satırı VPCS sözdizimine çevrildi:** `relay-trunk` PC-01 `ipconfig /renew` → `ip dhcp` (PC terminali VPCS olduğu için zorunlu). |
| Sunucu yanıt vermezse | PC'nin adresi değişmez | Link-local adresi olan PC'nin durumu değişmez; olmayan PC kendine MAC'ten türetilen `169.254.x.y/16` atar, ağ geçidi boşalır, önceki kirası düşer | **Labber (Windows APIPA davranışı).** Gerçek VPCS link-local adres atamaz; çıktıdaki `Autoconfiguration IPv4 address …` satırı AğLab'a özgüdür. Başarısız yenilemede eski kiranın hemen düşmesi sadeleştirmedir (gerçekte süre dolana kadar kalır). |
| `nslookup <ad>` | Topolojideki herhangi bir DNS sunucusunu kullanır; bilinmeyen ad için `93.184.216.34` döndürür | PC'nin DNS sunucusu (`ip dns A.B.C.D` ya da kiradan) erişilebilir ve DNS servisi açık olmalı; adlar lab cihazlarının adlarıdır; bilinmeyen ad `Non-existent domain` | **Labber.** Eski motorun sabit yanıtı "desteklenmeyeni çalışıyormuş gibi gösterme" ilkesine aykırıydı. Çıktı Windows `nslookup` biçimindedir; kayıt türleri, özyineleme ve elle DNS kaydı modellenmez. |
| Sunucu terminali | `service dhcp\|dns\|http on\|off`, `show services`, `show ip dhcp binding` | Aynı komutlar (HTTP hariç) + `show dns` | **HTTP servisi Labber'da yok:** açık HTTP servisi olan sunucu eski motor kararıdır (`nat-pat`; L5-d'de ele alınır). `relay-trunk` sunucusunda yalnız DHCP açık bırakıldı (şablonun DNS/HTTP servisleri senaryoda kullanılmıyordu). |

## L5-f: CDP ve LLDP (Labber)

Eski motorda CDP/LLDP yoktur; karşılaştırılacak eski davranış yok. Sorun Çöz/Akademi
içeriğinin motor kararı değişmez.

| Konu | Labber | Not |
|---|---|---|
| Varsayılanlar | CDP açık (`cdp run`), LLDP kapalı; arayüzde CDP ve LLDP gönderme/alma açık | IOS varsayılanı. |
| Komşu tablosu | Kablo, güç, shutdown, err-disable ve cdp/lldp ayarı değişince **anında** güncellenir | **Holdtime simüle edilmez**: gerçek IOS'ta komşu holdtime (CDP 180 s, LLDP 120 s) dolana kadar tabloda kalır. `Holdtme`/`Hold-time` sütunu yapılandırılmış süreyi gösterir, geri saymaz. |
| PC'ler | CDP/LLDP göndermez | VPCS davranışı. |
| `no cdp enable` | Port CDP göndermez ve almaz; komşu iki yönde de görünmez | IOS. |
| `no lldp transmit` / `no lldp receive` | Yönlü: göndermeyen portun karşısı onu görmez; almayan port komşuyu görmez | IOS. |
| `%CDP-4-NATIVE_VLAN_MISMATCH` | Yalnız iki uçta CDP açıkken | IOS'ta bu ileti CDP'den gelir; uyuşmazlık trafiği yine keser. |
| Yetenek ve platform | Switch `S I`, L3 switch `R S I`, router `R I`; LLDP `B`, `B,R`, `R` | **Doğrulanmadı**: platforma göre gerçek yetenek listesi (ör. ISR'lerde `R B S I`). |
| `show cdp neighbors detail` | Device ID, IP adresi (routed portun adresi, yoksa ilk SVI), platform, arayüzler, holdtime, IOS sürümü, duplex | **Doğrulanmadı**: `Native VLAN`, `VTP Management Domain`, `Peer Source_Port` gibi platforma bağlı satırlar yok; sürüm metni simüle. |
| `show lldp neighbors detail` | Chassis id, Port id, System Name/Description, capabilities, yönetim adresi | **Doğrulanmadı**: TLV ayrıntıları (Auto Negotiation, Vlan ID, Media Attachment) kısaltılmış. |
| Kalıcılık | Ayarlar çalışma zamanı durumudur; AğLab JSON'unda alan yok | Düzenleyici değişikliğinde taşınır; sayfa yenilenince varsayılana döner (BridgeError verilmez). |
| **Desteklenmiyor** | `show cdp`, `show cdp entry`, `show cdp traffic`, `cdp timer`, `cdp holdtime`, `lldp timer`, `lldp holdtime`, `show lldp`, `show lldp interface`, `show lldp traffic` | Komut `% Invalid input` verir. |

## L5-e: Port security (Labber kararları)

`port-security` senaryosu Labber kararındadır. Oracle paritesi: `tests/sim/parity.test.ts`
200 rastgele yapılandırmada (maximum, yapılandırılmış MAC'ler, ihlal modu, kaynak MAC) ilk
çerçeve kararını ve err-disable sonucunu `simulator/port-security.js` `portSecurityAllows` ile
karşılaştırır (fark 0; sayaç için aşağıdaki karar).

| Konu | Eski motor | Labber | Karar |
|---|---|---|---|
| Model | `portSecurity {enabled, max, violation, macs}`, `errdisabled` | `PhysIfConfig.portSecurity {enabled, max, violation, sticky, macs, stickyMacs}`; err-disable `rt.errdis` (neden `psecure-violation`) | **Köprü iki yönde.** AğLab `macs` → yapılandırılmış (SecureConfigured) adresler; özgün MAC yazımı korunur. |
| Öğrenilen adresler | Kalıcı olarak `macs` listesine yazılır | IOS: dinamik güvenli adres (SecureDynamic) yalnız çalışma zamanında; port düşünce silinir; `mac-address sticky` ile running-config'e yazılır | **Labber (IOS).** Dinamik adresler AğLab JSON'una yazılmaz. |
| `sticky` | Yok | Var | AğLab modelinde yok → `toAglab` `BridgeError` (kayıt sessiz kaybolmaz). |
| İhlal | İlk çerçevede: shutdown → err-disabled, restrict/protect → düşür | Aynı; shutdown ve restrict `%PORT_SECURITY-2-PSECURE_VIOLATION` (+ shutdown'da `%PM-4-ERR_DISABLE`) | **Labber (IOS).** |
| İhlal sayacı | protect dahil her ihlalde artar | IOS: protect saymaz; restrict her denemede (gönderim komutu başına; IOS çerçeve başına sayar), shutdown bir kez | **Labber (IOS).** Parite testinde beklenen değer IOS'a göre. |
| İhlalin tetiklenmesi | Her ping hesabı (değerlendirme dahil) | Uç trafik gönderdiğinde (VPCS `ping`, `trace`, `ip dhcp`); değerlendirme ping'i (LabQuery) salt okunurdur ama ihlaldeki uç ağa çıkamaz | **Labber.** Senaryo testi `probe()` Labber'da öğrencinin ping'i gibi gerçek trafik üretir. |
| Err-disabled portta tek `no shutdown` | Hata satırı ("önce shutdown") | IOS: hata yok, port err-disabled kalır; `shutdown` → `no shutdown` kurtarır | **Labber (IOS).** `test_aglab_network_features` test_05 buna göre. |
| Dinamik/trunk portta `switchport port-security …` | — | `Command rejected: Fa0/1 is a dynamic port.` / `… is a trunk port.` | IOS metni. |
| `maximum` aralığı | 1–1024 | CLI `<1-8192>`; köprü eski sınırı (1–1024) uygular | **Doğrulanmadı:** platforma göre üst sınır. |
| Port güvenliği açıkken porta trunk yapmak | — | Kabul edilir, güvenlik etkisiz olur (yalnız access portta uygulanır) | **Doğrulanmadı:** bazı IOS sürümleri reddeder. |
| Arkasında switch olan güvenli port | Bütün kaynak MAC'ler sayılır | Yalnız doğrudan bağlı uç denetlenir | **Sınır.** İçerikte güvenli port hep uca bağlı. |
| **Desteklenmiyor** | — | `switchport port-security aging …`, `errdisable recovery cause psecure-violation`, `show port-security interface X address`, `clear port-security` | Komut `% Invalid input` verir. |

## L5-c: IPv4 ACL (Labber kararları)

Oracle paritesi: `tests/sim/parity.test.ts` 300 rastgele liste × 6 pakette Labber kararını
`src/engine/acl.js` `aclEvaluate` ile karşılaştırır (fark 0); `test_aglab_next_hop`'un ACL
adımı (yalnız dönüş yolundaki router'da) `routing-acceptance.test.ts`'de Labber'da aynı sonuç.
Bu PR'la senaryo motor kararı değişmez: `nat-pat` NAT ve HTTP servisi için eski motorda kalır.

| Konu | Eski motor | Labber | Karar |
|---|---|---|---|
| Model | Router `acls[]` `{id, action, protocol, srcType, src, wildcard, dstType, dst, dstWildcard, port}`, arayüz `aclIn`/`aclOut` | `SwitchConfig.acls` (standart/genişletilmiş, sıra numaralı satırlar), `L3Opts.aclIn/aclOut` (router portu, alt arayüz, SVI) | **Köprü iki yönde.** |
| Liste türü | Yok | 1–99 standart, 100–199 genişletilmiş; isimli listenin türü (AğLab'da alan yok) kurallardan çıkarılır: hepsi `ip` + hedef `any` ise standart | **Sınır.** İsimli genişletilmiş bir liste yalnız `permit ip any any` türü satırlardan oluşuyorsa yeniden yüklemede standart görünür (eşleşme aynı). |
| Sıra numaraları | Yok (dizi sırası) | IOS gibi 10'ar; isimli listede `N permit …`, `no N` | AğLab'a yalnız sıra yazılır; yeniden yüklemede numaralar 10, 20, … olur (eşleşme sırası korunur). |
| Tanımsız (ya da boş) liste uygulanmış | Her şeyi engeller | IOS: her şeye izin verir | **Labber (IOS).** Bilinen fark; parite testinde ayrıca sabitlenir. |
| Router'ın kendi trafiği | — | Giden ACL'e takılmaz (IOS); gelen ACL uygulanır | **Labber (IOS).** |
| Engellenen paket | Yol kararında "ACL engelliyor" | Süzen router ICMP unreachable döner: ping `U`, traceroute `!A` | **Labber (IOS).** ICMP kodu (13, administratively prohibited) ayrıca modellenmez. |
| Eşleşme sayaçları | Yok | `show access-lists` paket başına (ping 5 paket); `clear access-list counters` | **Doğrulanmadı:** traceroute sondası başına sayım (1), yanıt paketlerinin sayılması. Değerlendirme ping'leri (LabQuery) saymaz. |
| Port adları | — | `www, telnet, ftp, smtp, domain, pop3, bootps, bootpc, tftp, snmp` kabul edilir ve gösterilir | **Doğrulanmadı:** IOS'un tam ad listesi; diğerleri sayı. |
| Traceroute paketi | — | UDP 33434 (IOS ve VPCS) | **Doğrulanmadı:** VPCS'nin hedef port aralığı. |
| AğLab'da ifade edilemeyen | — | Kaynak portu, `eq` dışı port işleci, ICMP türü | `toAglab` `BridgeError`. |
| **Desteklenmiyor** | — | `remark`, `log`/`log-input`, `established`, ICMP türü listesi dışındakiler (`echo`, `echo-reply`, `unreachable`, `time-exceeded` var), `ip access-list resequence`, zaman tabanlı ACL, `access-class` (vty), IPv6 ACL, switch portu (PACL) ve VLAN ACL | Komut `% Invalid input` verir. |

