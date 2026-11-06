# AğLab / Packet Tracer hedefi için uyumluluk matrisi

6 Kasım 2026. Bu tablo **AğLab'da bağlanan ve test edilen yolu** sınıflandırır;
upstream projelerin bütün özelliklerini AğLab'ın desteği gibi saymaz.

## Ortak aktarım ve yeni native senaryolar (6 Kasım)

| Özellik | AğLab JS | MIT NetSim | Linux bridge | FRRouting | Gerçek test / öğrenciye sunum | Sınır |
|---|---|---|---|---|---|---|
| Ortak v23 JSON → VLAN/trunk | Mevcut biçim; JSON indirme | Access LAN karşılaştırması korunur | Sınırlı operatör dönüştürücüsü entegre | Sınırlı ayrı router dönüştürücüsü | shared_smoke CI raporu; öğrenci yalnız JSON/rapor kullanır | 2–4 PC, 1–2 switch, döngüsüz; gateway/security reddedilir |
| AGL-024 arıza/onarım | Özgün görev değişmedi | Trunk desteklenmez | Gerçek dört PC/iki switch, VLAN10/20 | Gerekmez | Başlangıç ping kaybı, trunk onarımı ve iki VLAN ICMP | Yalnız bu temsilî Akademi görevi native test edildi |
| Ortak v23 JSON → statik FRR | Mevcut JSON/CLI | Routing kapsam dışı | İsteğe bağlı VLAN1 köprü | PC/router/static-route verisi entegre | routed_smoke: 2/3 router, AGL-034/035 arıza/onarım; kesin başarı native CI raporunda | 2–4 PC, 1–3 router, 0–2 access bridge; IPv4/private/default route, AD; advanced alanlar reddedilir |
| IPv6 statik rota / ND / ICMPv6 | Yeni tarayıcı IPv6 yok | Entegre değil | L2 altyapı; bu senaryo routing | Sınırlı native senaryo entegre | extended_routing CI: pozitif, transit rota kaybı, onarım; rapor inceleme | SLAAC/DHCPv6/OSPFv3 yok |
| Multi-area / ABR / passive | Mevcut basit eğitim OSPF'si | Yok | Gerekmez | Native area0/1/2 senaryosu entegre | FRR N IA + gerçek trafik, passive arızası/onarımı | Authentication/iBGP yok; dar BGP policy ayrı native senaryoya bağlı |
| ABR özetleme | Entegre değil | Yok | Gerekmez | Kaynakta var; deneysel test yazıldı | Önceki CI: /23 yok; yeni yerel native deney: ABR timer içinde ospfd SIGSEGV; sunulmadı | `--experimental-summary` yalnız yeniden üretim; tamamlanmadı |
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
| ACL | Sınırlı eğitim modeli | Desteklenmiyor | Doğrulanmadı | Mevcut routed frame/grading denetimleri | Gerçek FRR ACL/policy karşılaştırması yok |
| NAT | Sınırlı eğitim modeli: PAT | Desteklenmiyor | Doğrulanmadı | Ortak nat-pat senaryosu | Native NAT/many-to-many/tüm protokol çeşitleri yok |
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
başarılıdır. Native DHCP/ACL/NAT, RSTP ve tabloda eksik gösterilen geniş
özellikler bu başarıdan destek kazanmış sayılmaz. En güncel build/test koşusu
teslim raporunda ayrıca belirtilir.

Kaynak ve test ayrıntısı: [Gelişmiş motor entegrasyonu](GELISMIS_MOTOR_ENTEGRASYON.md).
