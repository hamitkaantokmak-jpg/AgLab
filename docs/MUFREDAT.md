# AğLab Müfredatı: Şube, CCNA ve CCNP

> Kaynak: AğLab Müfredatı doc (8 Kasım 2026). Bu dosya o belgenin depodaki kopyasıdır; içerik değişiklikleri önce burada yapılır.

## Amaç ve kapsam

AğLab üç seviyeli bir müfredata geçer: **Şube temel** (12 konu), **CCNA** (+14 konu) ve **CCNP Enterprise** (ENCOR + ENARSI, +23 konu). Her seviye bir öncekinin üzerine kurulur; konu sırası öğrenme sırasıdır.

- **Kimler için:** Şubede ağ işlerine bakan çalışanlar (Seviye 1), CCNA'ya hazırlananlar (Seviye 1–2), CCNP Enterprise'a hazırlananlar (Seviye 1–3).
- **İlke:** Önce derinlik. Bir konu ders, lab, arıza senaryosu ve sınavıyla tamamlanmadan bir sonrakine geçilmez.
- **Dürüstlük:** Motorun çalıştıramadığı konu pratik varmış gibi sunulmaz; "okuma" olarak açıkça işaretlenir.

**Sınav sürümleri (doğrulanacak):** CCNA 200-301 v1.1 2 Şubat 2027'ye kadar geçerli; 3 Şubat 2027'den itibaren yalnız v2.0 var ve beş alana yeniden düzenlenip yapay zekâ konuları ekleniyor. İçerik üretimi aylar süreceği için **doğrudan v2.0 hedeflenir.** ENCOR'un 2026'da v1.2'ye geçip kablosuz içeriği çıkardığı yalnız düşük güvenilirlikli bir kaynakta geçiyor; başlamadan önce Cisco'nun resmî sınav konuları sayfasından teyit edilmeli.

**Resmî değildir:** AğLab "CCNA/CCNP'ye hazırlık" sunar; Cisco materyali, resmî sınav veya Cisco ile ilişki iddiası taşımaz. Cisco IOS komut sözdizimi eğitim amaçlı taklit edilir.

## Pratik türleri

Her konu üç pratik türünden birine atanır; tür, konunun ne kadar uygulamalı öğretilebileceğini ve motordan ne istendiğini belirler.

| Tür | Nerede çalışır | Neyi sağlar | Sınırı |
| --- | --- | --- | --- |
| **Motor** | Tarayıcı, çevrimdışı tek HTML | Topoloji, IOS-benzeri CLI, ping/traceroute, arıza senaryosu, otomatik değerlendirme | Yalnız motorun modellediği protokoller; gerçek IOS değil |
| **Gerçek Lab** | Linux/Docker sunucusu, FRR + containerlab | Gerçek protokol davranışı: OSPF, BGP, VRF, PBR, IS-IS; EIGRP sınırlı | Sunucu gerekir, çevrimdışı değil; FRR komutları IOS'tan farklı |
| **Okuma** | Tarayıcı | Kavram anlatımı, gerçek çıktı okuma, şema, sınav soruları | Uygulama yok; "okuma" etiketiyle açıkça gösterilir |

Bir konu motorda çalışamazken Gerçek Lab'da çalışabiliyorsa iki yol birlikte sunulur: motorda kavram ve basit lab, Gerçek Lab'da ileri senaryo. FRR, motor için aynı zamanda **referans**tır: aynı topoloji iki tarafta çalıştırılıp sonuçlar karşılaştırılır.

## Konu şablonu

Her konu aynı yedi parçadan oluşur; öğrenci her konuda neyle karşılaşacağını bilir, içerik yazan da boşluk doldurur.

1. **Neden önemli:** Gerçek bir durumdan 2–3 cümle (ör. "Muhasebe ile satış aynı ağda olursa?").
2. **Kavram:** Kısa anlatım ve tek şema. Okuma süresi 10 dakikayı geçmez.
3. **Çıktı okuma:** Bir `show` çıktısının satır satır açıklaması. CCNA v2.0'ın sorun giderme ağırlığı bu parçayı zorunlu kılar.
4. **Yönlendirmeli lab:** Adım adım, her adımda "neden".
5. **Sık hatalar:** Konunun 3–5 klasik hatası (hata kataloğu). Her hata bir arıza senaryosunun tohumudur.
6. **Arıza senaryosu:** Belirti verilir, öğrenci teşhis koyar (hangi katman), kanıt toplar, düzeltir. Değerlendirme: bağlantı + doğru kök neden + gereksiz değişiklik yok.
7. **Kısa sınav:** 5 soru; ezber değil, "bu çıktıda sorun ne?" tipi.

Senaryo verisi mevcut `network-scenarios.json` alanlarını kullanır: `symptom`, `cause`, `hints`, `topology`, `solution`, `verify`. Hata katalogundaki iki hata birleştirilerek orta/ileri seviye senaryo üretilir.

## Seviye 1 — Şube temel (12 konu)

Bu 12 konu şubedeki günlük ağ işinin büyük kısmını karşılar ve CCNA'nın temelidir; tümü motorda pratik edilebilir olmalı. Motor durumu, kodda konuyla ilgili davranışın bulunup bulunmadığına göre; "kısmi" ve "doğrulanacak" satırlar testle teyit edilmeli.

| # | Konu | Öğrenci sonunda ne yapar | Pratik | Motor durumu | Mevcut içerik | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Sorun giderme yöntemi | Katman katman ilerler, kanıtla teşhis koyar, değişiklik öncesi yedek alır | Motor | Var (senaryo altyapısı) | "İleri sorun giderme" başlığı (en sonda) | P0 |
| 2 | IP adresleme ve subnetting | Adres, maske, ağ/yayın adresini hesaplar; aynı ağ mı kararını verir | Motor | Var | Detaylı ders var | P0 |
| 3 | Ethernet, MAC ve ARP | MAC tablosunu ve ARP önbelleğini okur, "aynı ağdayım ama ulaşamıyorum"u çözer | Motor | Var (MAC öğrenme, ARP, `show mac address-table`) | Detaylı ders var (`docs/dersler/ethernet-mac-arp.md`) | P0 |
| 4 | Fiziksel bağlantı ve kablolama | Port durumunu yorumlar, kopuk kablo/kapalı portu bulur; patch panel, PoE, etiketleme | Motor + okuma | Var (link up/down, shutdown) | Detaylı ders var | P0 |
| 5 | VLAN | Access port atar, `show vlan brief` okur | Motor | Var | Detaylı ders var (VLAN+trunk birlikte) | P0 |
| 6 | Trunk | 802.1Q trunk kurar; izinli VLAN ve native VLAN hatalarını bulur; DTP ve VTP'nin etkisini bilir | Motor | Var | VLAN dersiyle birlikte | P0 |
| 7 | VLAN'lar arası yönlendirme | Router-on-a-stick ve L3 switch SVI kurar | Motor | Router-on-a-stick var; SVI ile yönlendirme yalnız Labber'da | Detaylı ders ve 5 senaryo var (`roas-*`) | P0 |
| 8 | Gateway ve statik routing | Varsayılan ağ geçidi ve statik rota kurar; LPM ve AD ile rota seçimini açıklar | Motor | Var | Detaylı ders var | P0 |
| 9 | DHCP | Havuz kurar, relay (`ip helper-address`) ile başka ağa hizmet verir, 169.254'ü teşhis eder | Motor | Labber'da var (L5-b: havuz, dışlama, relay, 169.254) | Detaylı ders ve 5 senaryo var (`docs/dersler/dhcp.md`, `dhcp-*`) | P0 |
| 10 | DNS | İsim çözümleme hatasını IP bağlantı hatasından ayırır | Motor + okuma | Labber'da var (L5-b: `nslookup`, DNS servisi; kayıtlar cihaz adları) | Detaylı ders ve 5 senaryo var (`docs/dersler/dns.md`, `dns-*`) | P1 |
| 11 | Cihaz yönetimi ve yedekleme | Running/startup config farkı, `write memory`, SSH, parola, yedek/geri yükleme | Motor | Labber'da var (kaydetme, `reload`, güç döngüsü); SSH/parola yok | Detaylı ders var; 5 senaryo Labber testinde (`tests/sim/device-management.test.ts`) | P1 |
| 12 | CDP/LLDP ile komşu keşfi | `show cdp neighbors` ile belgelenmemiş ağı çıkarır | Motor | Labber'da var (L5-f: CDP/LLDP komşu tabloları) | Detaylı ders ve 5 senaryo var (`docs/dersler/cdp-lldp.md`, `cdp-*`) | P1 |

## Seviye 2 — CCNA (+14 konu)

CCNA v2.0 beş alana sahip: Ağ altyapısı ve bağlantı %25, Switching ve ağ erişimi %25, IP routing %20, Ağ servisleri ve güvenlik %20, Yapay zekâ ve ağ operasyonları %10. v2.0 sorun giderme hedeflerini artırıyor; OSPFv3, HSRP/VRRP durumu, storm control, RA guard, extended ping ve paket yakalama çıktısı ekleniyor. Kablosuz mimariler, QoS PHB, NTP ve SDN/REST/JSON ayrı hedef olmaktan çıkıyor ama temel bilgi olarak kalıyor ([kaynak](https://www.edoxi.com/studyhub/ccna-exam-guide)).

| # | Konu | CCNA v2.0 alanı | Pratik | Motor durumu | Öncelik |
| --- | --- | --- | --- | --- | --- |
| 13 | STP/RSTP, PortFast, BPDU/root guard | Switching | Motor | Kısmi (root seçimi var, guard'lar yok) | P1 |
| 14 | EtherChannel (LACP) | Switching | Motor | Doğrulanacak | P1 |
| 15 | OSPFv2 tek alan | IP routing | Motor + Gerçek Lab | Kısmi (komşuluk ve rota var; SPF/LSDB, timer yok) | P1 |
| 16 | IPv6 adresleme, SLAAC, NDP, statik rota | Altyapı / routing | Motor | Doğrulanacak | P1 |
| 17 | OSPFv3 (IPv6) | IP routing | Gerçek Lab önce, sonra motor | Yok | P2 |
| 18 | FHRP: HSRP/VRRP durum okuma | IP routing | Motor | Doğrulanacak | P1 |
| 19 | ACL (standart, genişletilmiş) | Güvenlik | Motor | Kısmi, doğrulanacak | P1 |
| 20 | NAT/PAT | Servisler | Motor | Kısmi, doğrulanacak | P1 |
| 21 | L2 güvenlik: port security, DHCP snooping, DAI, storm control, RA guard | Switching / güvenlik | Motor | Port security var; diğerleri yok | P1 |
| 22 | Cihaz erişim güvenliği: SSH, AAA, SFTP/SCP | Güvenlik | Motor + okuma | Yok | P2 |
| 23 | Ağ servisleri: DNS kayıt türleri, NTP, Syslog, SNMP | Servisler / operasyon | Okuma + motor (Syslog) | Kısmi | P2 |
| 24 | Teşhis araçları: extended ping, traceroute, paket yakalama | Operasyon | Motor | Traceroute ve Paket Dedektifi var; extended ping yok | P1 |
| 25 | Kablosuz ağ temelleri | Altyapı | Okuma | Yok (motor kapsamı dışı) | P2 |
| 26 | Otomasyon ve yapay zekâ: IaC, Ansible, ajan tabanlı yapay zekâ, prompt seçimi | Yapay zekâ ve operasyon | Okuma | Yok | P2 |

## Seviye 3 — CCNP Enterprise (+23 konu)

CCNP Enterprise, ENCOR (350-401) ve bir uzmanlık sınavından oluşur; burada uzmanlık olarak routing odaklı ENARSI (300-410) seçildi. Bu seviyede motorun tek başına yetmediği yer çoktur; routing ağırlıklı konuların pratik yükünü Gerçek Lab taşır. ENCOR konu listesi, güncel sürüm resmî sayfadan teyit edildikten sonra kesinleştirilmeli.

### ENCOR

| # | Konu | Pratik | Motor / Gerçek Lab durumu | Öncelik |
| --- | --- | --- | --- | --- |
| 27 | Kampüs ve kurumsal tasarım (hiyerarşik model, yüksek erişilebilirlik) | Okuma | — | P2 |
| 28 | L2/L3 iletim mekanizmaları (CEF, FIB, adjacency) | Okuma + motor (Paket Dedektifi) | Kısmi | P2 |
| 29 | İleri STP: MST, RSTP ayarı | Motor | Yok | P2 |
| 30 | İleri EtherChannel sorun giderme | Motor | 14. konuya bağlı | P2 |
| 31 | OSPF çok alan, LSA ve alan türleri | Gerçek Lab + motor | FRR destekler; motor yok | P2 |
| 32 | eBGP ve yol seçimi | Gerçek Lab | FRR destekler; motorda basit eBGP var | P2 |
| 33 | VRF ve GRE tünelleri | Gerçek Lab | FRR/Linux destekler; motor yok | P2 |
| 34 | IPsec site-to-site | Okuma | Yok | P3 |
| 35 | VXLAN, LISP, SD-Access, SD-WAN mimarileri | Okuma | Kapsam dışı | P3 |
| 36 | QoS uygulaması (sınıflandırma, işaretleme, kuyruk) | Okuma | Yok | P3 |
| 37 | Ağ izleme: IP SLA, SPAN, NetFlow, Syslog, debug | Okuma + motor | Paket Dedektifi kısmen karşılar | P2 |
| 38 | Altyapı güvenliği: CoPP, 802.1X, cihaz erişim ACL'leri | Okuma + motor | ACL'ye bağlı | P3 |
| 39 | Otomasyon: Python, NETCONF/RESTCONF, YANG, REST API | Gerçek Lab (sandbox) | Yok; ileride Automation Studio | P3 |
| 40 | Kablosuz (sürüm teyidine bağlı) | Okuma | Kapsam dışı | P3 |

Kaynak karşılaştırmasıyla eklenen: **#49 Multicast** (IGMP, PIM, RP kavramları) — Okuma + Gerçek Lab (FRR pimd), P3.

### ENARSI

| # | Konu | Pratik | Motor / Gerçek Lab durumu | Öncelik |
| --- | --- | --- | --- | --- |
| 41 | EIGRP (named mode, metrik, stub; ENCOR v1.0'da da var) | Okuma, ileride motor | Motor yok; FRR desteği sınırlı | P3 |
| 42 | İleri OSPF sorun giderme | Gerçek Lab | FRR destekler | P2 |
| 43 | İleri BGP: iBGP, attribute'lar, route-map | Gerçek Lab | FRR destekler | P2 |
| 44 | Redistribution ve rota filtreleme (prefix-list, route-map) | Gerçek Lab | FRR destekler | P2 |
| 45 | PBR ve VRF-lite | Gerçek Lab | FRR destekler | P2 |
| 46 | DMVPN | Okuma | Yok | P3 |
| 47 | IPv6 ileri ve first-hop security | Motor + okuma | 16. konuya bağlı | P3 |
| 48 | Altyapı servisleri sorun giderme: DHCP, NTP, SNMP, Syslog, IP SLA | Motor + okuma | DHCP var; diğerleri yok | P2 |

Bu seviyede 23 konunun 8'i Gerçek Lab'a, yaklaşık yarısı ağırlıkla okumaya dayanıyor. CCNP hedefi ciddiyse Gerçek Lab'ı çok kullanıcılı ve kolay kurulur hale getirmek motor geliştirmesi kadar önemlidir.

## Motor yol haritası

Müfredattan çıkan motor işi altı faza ayrılır; sıra, en çok öğrenciye en erken pratik kazandıracak şekildedir. Tüm fazlar, yeniden yapılanmanın 3. adımına (motorun `src/engine/` altında saf modüllere ayrılması) bağlıdır; her özellik önce başarısız olan bir testle eklenir.

1. **Faz A — Seviye 1'i tamamla:** DNS davranışını doğrula, running/startup config ayrımı ve `write memory`, CDP/LLDP komşu tablosu, extended ping.
2. **Faz B — CCNA switching:** PortFast, BPDU guard, root guard; EtherChannel (LACP); DHCP snooping, DAI, storm control.
3. **Faz C — CCNA routing:** Tek alan OSPF'i gerçek SPF/LSDB ile tamamla; HSRP/VRRP; IPv6 (SLAAC, NDP, statik rota); ACL ve NAT'ı test kapsamıyla doğrula.
4. **Faz D — CCNA servis ve güvenlik:** SSH/AAA erişim modeli, Syslog ve NTP'nin asgari modeli, SNMP okuma.
5. **Faz E — CCNP için Gerçek Lab:** Çok kullanıcılı, kolay kurulan Gerçek Lab; OSPF çok alan, BGP, redistribution, PBR ve VRF senaryoları; motor–FRR fark testleri.
6. **Faz F — CCNP motor genişlemesi:** MST, OSPF çok alan ve OSPFv3, ileride EIGRP.

Kablosuz, SD-WAN, SD-Access, VXLAN/LISP, QoS uygulaması ve DMVPN motor kapsamı dışında tutulur; bunlar okuma olarak kalır.

## Mevcut içeriğin eşlenmesi

Mevcut 33 başlığın hiçbiri silinmez: 29'u bir müfredat konusuna yerleşir, 4'ü "Kariyer okumaları" bölümüne taşınır. Bunlara ek olarak 4 konu sıfırdan yazılır: #3 Ethernet/MAC/ARP, #7 VLAN'lar arası yönlendirme, #11 Cihaz yönetimi ve #12 CDP/LLDP. 20 detaylı ders, eşlendikleri konunun "Kavram" parçasına kaynak olur.

| Mevcut başlık | Yeni yeri |
| --- | --- |
| IP adresi ve subnetting | #2 |
| Fiziksel bağlantı ve arayüz | #4 |
| Switching ve VLAN | #5 ve #6 olarak ikiye bölünür |
| Gateway ve routing | #8 |
| Routing kararları: LPM, AD ve metric | #8 ile birleşir |
| DHCP | #9 |
| DNS ve isim çözümleme | #10 |
| Ağ teşhis komutları | #1 (yöntem) ve #24 (araçlar) |
| İleri sorun giderme ve ağ tasarımı | Yöntem #1'e (en başa), tasarım #27'ye |
| STP ve Layer 2 döngüler | #13 |
| EtherChannel ve LACP | #14 |
| OSPF dinamik yönlendirme | #15 (tek alan), #31 (çok alan) |
| IPv6 adresleme ve yönlendirme | #16 |
| Yedeklilik ve yüksek erişilebilirlik | #18 (FHRP), #27 (tasarım) |
| Firewall, ACL ve temel güvenlik | #19 |
| ACL tasarımı ve trafik akışı | #19 ile birleşir |
| NAT ve PAT | #20 |
| AAA ve RADIUS/TACACS+ | #22 |
| Ağ servisleri ve portlar | #23 |
| Kurumsal Wi‑Fi ve 802.11 | #25 (temel), #40 (ileri) |
| Ağ otomasyonu ve API | #26 (CCNA), #39 (CCNP) |
| BGP ve politika tabanlı rota seçimi | #32 (eBGP), #43 (ileri) |
| VPN türleri ve uzaktan erişim | #34 |
| IPsec ve IKE temelleri | #34 ile birleşir |
| SD-WAN mimarisi | #35 |
| QoS ve trafik önceliklendirme | #36 |
| Ağ gözlemlenebilirliği ve telemetri | #37 |
| Network Access Control (NAC) | #38 |
| 802.1X ve EAP-TLS | #38 ile birleşir |
| WAN ve bağlantı modelleri | Kariyer okumaları |
| MPLS ve kurumsal WAN | Kariyer okumaları |
| Zero Trust ve segmentasyon | Kariyer okumaları |
| Bulut ağları ve hibrit bağlantı | Kariyer okumaları |

Mevcut 40 Akademi labı ve 17 arıza senaryosu da aynı numaralarla etiketlenip ilgili konunun lab ve senaryo parçasına bağlanır; bu eşleme ayrı bir çalışma olarak yapılmalı.

## Uygulama planı

İlk somut çıktı, VLAN ve trunk konularının (#5–#6) şablonla eksiksiz yazılmasıdır; bu örnek onaylanınca diğer konular aynı kalıpla üretilir.

1. **Örnek konu:** #5–#6 için ders, çıktı okuma, lab, 5 hatalık katalog, 5 senaryo ve sınav. Şablon bu örnekle son halini alır.
2. **Seviye 1 içeriği:** Kalan 10 konu; Faz A motor işleriyle paralel. Yeni yazılacak dört konu (#3, #7, #11, #12) öncelikli.
3. **Mevcut lab ve senaryoların eşlenmesi:** 40 Akademi labı ve 17 senaryo konu numaralarıyla etiketlenir; boş kalan konular listelenir.
4. **Seviye 2 (CCNA v2.0):** Faz B–D motor işleriyle birlikte; motoru hazır olmayan konular önce okuma + sınav olarak yayınlanır, pratik geldikçe eklenir.
5. **Seviye 3 (CCNP):** Faz E (Gerçek Lab) hazır olunca routing ağırlıklı konular; okuma konuları her an yazılabilir.

**Açık sorular**

- [ ] ENCOR'un güncel sürümü ve kablosuzun kapsamda olup olmadığı resmî sayfadan teyit edilecek.
- [ ] Şube çalışanları için Seviye 1 sonunda bir "yeterlilik" sınavı isteniyor mu?
- [ ] Gerçek Lab hangi sunucuda, kaç eş zamanlı kullanıcıyla çalışacak?

## Kaynak dokümanlar

İki doküman müfredatın kapsamını doğrulamak için kullanıldı; karşılaştırma sonucu Multicast eklendi (#49), trunk konusuna DTP/VTP girdi, EIGRP'nin ENCOR v1.0'da da yer aldığı not edildi.

| Doküman | İçerik | Müfredatta kullanımı |
| --- | --- | --- |
| Layer8 — CCIE Enterprise Infrastructure Türkçe Master Guide (693 sayfa, 30 bölüm) | TCP/IP'den otomasyona; her bölümde tarihçe, teori, packet walk, IOS-XE yapılandırma, show/debug, Wireshark, sorun giderme, saha kullanımı | Bölüm yapısı konu şablonuyla örtüşüyor. Yapay zekâyla üretilmiş, üçüncü kişiye ait. Seviye 2–3 için ana başvuru kaynağı: konu kapsamı, sıra, olgular ve örnek senaryolar alınır; AğLab metni özgün yazılır, birebir aktarılmaz. Teknik iddialar resmî doküman, FRR veya motor testiyle doğrulanır |
| CCNP Enterprise: Core Networking (ENCOR v1.0) eğitmen slaytları (1.344 sayfa, 29 bölüm) | Cisco Networking Academy eğitmen materyali; ENCOR v1.0 kapsamı | Yalnız kapsam kontrol listesi. Metin, şema veya soru AğLab'a kopyalanmaz. v1.0, güncel sürümden eski; kablosuz 5 bölüm, EIGRP ve Multicast içeriyor |

**Bölüm eşlemesi**

| Layer8 bölümü | ENCOR v1.0 bölümü | Müfredat konusu |
| --- | --- | --- |
| 01 TCP/IP ve paket işleme | 1 Packet Forwarding | #1, #2, #28 |
| 02 Ethernet ve switching | 1 | #3 |
| 03 VLAN, trunk, DTP, VTP | 5 VLAN Trunks and EtherChannel | #5, #6, #7 |
| 04 Spanning Tree ailesi | 2–4 STP, Advanced STP, MST | #13, #29 |
| 05 EtherChannel | 5 | #14, #30 |
| 06 Katman 2 güvenliği | 26 Device Access / Infra Security | #21 |
| 07 IPv4 adresleme ve yönlendirme | 6 IP Routing Essentials | #2, #8 |
| 08 IPv6 | 10 OSPFv3 (kısmen) | #16, #47 |
| 09 EIGRP | 7 EIGRP | #41 |
| 10 OSPFv2 | 8–9 OSPF, Advanced OSPF | #15, #31, #42 |
| 11 OSPFv3 | 10 | #17 |
| 12 IS-IS | — | CCIE okuması |
| 13 Redistribution ve filtreleme | — | #44 |
| 14–16 BGP, path selection, route reflector | 11–12 BGP, Advanced BGP | #32, #43 |
| 17–18 MPLS, L3VPN | — | Kariyer/CCIE okuması |
| 19 VXLAN / BGP EVPN | 23 Fabric Technologies | #35 |
| 20 DHCP, DNS, NAT, NTP | 15 IP Services | #9, #10, #20, #23 |
| 21 FHRP | 15 | #18 |
| 22 Yüksek erişilebilirlik | 22 Enterprise Network Architecture | #27 |
| 23 QoS | 14 QoS | #36 |
| 24 Multicast | 13 Multicast | #49 (yeni) |
| 25 Güvenlik ve kontrol düzlemi | 26 | #38 |
| 26 AAA, 802.1X, ISE | 25 Secure Network Access Control | #22, #38 |
| 27 Wireless | 17–21 Wireless | #25, #40 |
| 28 SD-Access ve Catalyst Center | 23 | #35 |
| 29 SD-WAN | 23 | #35 |
| 30 Ağ otomasyonu | 28–29 Programmability, Automation Tools | #26, #39 |
| — | 16 Overlay Tunnels | #33, #34 |
| — | 24 Network Assurance | #37 |
| — | 27 Virtualization | #33 |

Layer8; IS-IS, MPLS L3VPN, VXLAN EVPN ve route reflector gibi CCIE düzeyi konuları da kapsıyor. FRR bunların çoğunu çalıştırabildiği için ileride Gerçek Lab üzerinde bir "Seviye 4 — CCIE hazırlık" eklenebilir.

## Kaynaklar

- [CCNA 200-301 sınav rehberi: v1.1 ve v2.0 alanları, eklenen/çıkarılan konular, geçiş tarihleri](https://www.edoxi.com/studyhub/ccna-exam-guide) (Edoxi)
- [CCNA sınav konuları sayfası](https://learningnetwork.cisco.com/s/ccna-exam-topics) (Cisco Learning Network; teyit için resmî kaynak)
- AğLab deposu: `src/app/main.js`, `simulator/`, `docs/ORTAK_MOTOR.md` (motor durumu sütunları)
