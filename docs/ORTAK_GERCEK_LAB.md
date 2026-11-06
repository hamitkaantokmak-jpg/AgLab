# Ortak topolojiden operatör kontrollü Gerçek Lab

Mevcut AğLab `app: AgLab, version: 23` topoloji biçimi korunur. Öğrenci tarayıcısı yalnız JSON indirir; Docker, shell veya yönetici API çağrısı yapmaz. Yetkili operatör Linux üzerinde Containerlab/Docker kurulu ayrı bir ortam kullanır. Gerçek sonuç raporu, mevcut Paket Dedektifi rapor alanında açılır; dosya imzası doğrulanmaz ve rapor canlı paket yakalaması değildir.

## Dışa aktarma ve çalıştırma

```sh
python3 real-lab/shared_topology.py real-lab/examples/shared-vlan10.aglab.json --out /tmp/aglab-export
# Yalnız veri dosyaları üretilir; henüz hiçbir konteyner başlamaz.
sudo python3 real-lab/shared_smoke.py --execute
sudo python3 real-lab/extended_routing.py --execute
sudo python3 real-lab/shared_smoke.py --topology aglab-operator-topology.json --source pc1 --target pc2 --expect success --execute
```

İlk komut, mevcut JSON'dan `lab.clab.yml` ve incelenebilir `plan.json` oluşturur. Çalıştırma betiği plan dosyasını komut olarak kabul etmez; kaynak topolojiyi yeniden doğrular. Hazır suite iki temsilî girdi kullanır: 2 PC/2 switch VLAN10 örneği ve özgün AGL-024 başlangıç topolojisi. Operatör kendi dışa aktarılan JSON'unu aşağıdaki seçenekle aynı doğrulama sınırları içinde çalıştırabilir. Genel bir öğrenciden komut çalıştırma servisi yoktur.

## Linux bridge dönüştürücüsünün sınırı

PC'nin kablosu bulunmalı, referans verilen VLAN'lar switch VLAN veritabanında tanımlı olmalıdır. Eksik kablo/VLAN oluşturulmaz; bunları içeren başlangıç görevleri açıkça reddedilir. Harita her başlangıç topolojisini gerçek dönüştürücüden geçirir ve ret nedenini kaydeder.

PC gateway alanı boş olmalıdır; tarayıcıda IP değiştirmek eski gateway'i otomatik temizlemeyebilir. Dönüştürücü bu alanı sessizce atmaz, açıkça reddeder. Switch yönetim IP'si de bu sürümde reddedilir. Native PC'lerin yönetim `eth0` bağlantısı veri testi öncesinde kapatılır; Docker exec kontrolü bundan etkilenmez. Böylece veri adresi yönetim alt ağıyla çakışsa bile ping yönetim ağı üzerinden başarı kazanamaz.

2–4 tek arayüzlü PC, 1–2 switch, en fazla 8 bağlantı, döngüsüz topoloji. IPv4 RFC1918 host adresleri; switch access/trunk VLAN ve native/allowed VLAN bilgileri. Router, yönlendirme/gateway, port-security, bilinmeyen alanlar, döngüler, rastgele imaj/exec/bind alanları reddedilir. Fiziksel portlar sabit `ethN` adlarına eşlenir. Kaynakta PC MAC'i yoksa yerel MAC üretilir ve rapora yazılır. Dönüştürücü özgün JSON'u değiştirmez. Orman desteği STP gerektirmez; bu aktarım klasik STP veya RSTP doğrulaması değildir.

Varsayılan suite sağlıklı örnekte pozitif ICMP, yanlış access VLAN, onarım, trunk allowed VLAN kaldırılması ve onarım denetler. AGL-024'te dört PC/iki switch ile VLAN10 başlangıç başarısızlığı, uplink trunk onarımı ve VLAN10/20 pozitif ICMP doğrulanır. Başarısız olması beklenen ping testinin geçmesi, ağın çalıştığı anlamına gelmez: rapordaki `expected_success` ve gerçek çıkış kodu birlikte okunmalıdır.

## İleri FRR ve IPv6 senaryosu

`extended_routing.py` mevcut üç router/iki PC altyapısını kullanır. Doğrudan r1–r3 bağlantısı kapatılır; r1 LAN area1, r1–r2 area0, r2–r3 ve hedef LAN area2 olur. FRR'nin OSPF tablosunda `N IA` rota, ABR r2 üzerinden gerçek ICMP ve passive transit arızası/onarımı sınanır. Genel Zebra tablosu Cisco'nun `O IA` gösterimi yerine `O` basar; test bu ayrımı korur. Yalnız show çıktısına dayanılmaz.

**Özetleme tamamlanmadı:** 46cfb0c commit'inin gerçek CI denemesinde `area 2 range 192.168.20.0/23` running-config'e girdi, ancak r1'de beklenen `/23` rota oluşmadı; `/24` kaldı. Bu nedenle özetleme destek matrisinde başarılı değildir. Başarısız deney `--experimental-summary --execute` ile yeniden üretilebilir ve başarısız çıkış kodu verir; standart kabul suite'inin veya öğrenci desteğinin parçası değildir. OSPF authentication sonraki kapsamdır; dar BGP policy denetimi aşağıda ayrı olarak tanımlanır.

IPv6 ayrı ULA adresleri, üç router üzerinden statik rotalar, gerçek ND komşu MAC öğrenmesi ve ICMPv6 kullanır. r2 hedef rotası kaldırıldığında veri iletimi kesilmeli, geri konunca düzelmelidir. SLAAC, DHCPv6, OSPFv3, IPv6 tarayıcı CLI'si uygulanmamıştır. Bu görevler 40 özgün Akademi labının dışında operatör senaryolarıdır.

## Sonraki protokol seçimleri

| Alan | Tarayıcı / hazır MIT motor | Gerçek altyapı ve tercih | Bu teslimat |
|---|---|---|---|
| IPv6 | Mevcut motorlar IPv4 ağırlıklı; upstream desteği entegrasyon sayılmaz | Linux ND/ICMPv6, FRR statik IPv6 | Sınırlı native senaryo |
| DHCP/relay | Eğitim modeli mevcut; MIT kapsamı dışı | İzole dnsmasq/relay, lisans ve servis yapılandırması ayrıca incelenmeli | Yeni native entegrasyon yok |
| ACL | AğLab eğitim modeli; MIT kapsamı dışı | Linux nftables pozitif/negatif forwarding testi | Ertelendi |
| NAT/PAT | AğLab eğitim modeli; MIT kapsamı dışı | İzole namespace/nftables; gerçek internet gerekmez | Ertelendi |
| DNS/TCP/UDP | Gerçek soket/servis davranışı yok | Ayrı istemci/sunucu, UDP/TCP ve timeout kanıtları | Ertelendi |
| RSTP | Tarayıcı STP modeli RSTP değildir | mstpd gerçek daemon, kernel bridge kullanıcı alanı entegrasyonu gerekir | İnceleme; daemon kurulmadı |
| LACP | Tarayıcıda gerçek LACP yok | Linux bonding 802.3ad, üye durumları ve tek link kaybı testi gerekir | İnceleme; entegre değil |
| Port-security / snooping | Eğitim port-security; gerçek karşılık doğrulanmadı | Linux bridge tek başına Cisco politikası değildir; ayrı kontrol katmanı gerekir | Tamamlandı denmez |

Kaynaklar: [FRR OSPF](https://docs.frrouting.org/en/latest/ospfd.html), [FRR IPv6](https://docs.frrouting.org/en/latest/ipv6.html), [Linux bonding](https://docs.kernel.org/networking/bonding.html), [mstpd](https://github.com/mstpd/mstpd), [Cisco CCNA](https://www.cisco.com/site/us/en/learn/training-certifications/exams/ccna.html). CCNA ağ erişimi/IP bağlantısı/IP servisleri kapsamı ve mevcut 40 görevden bağımsız eksik IPv6 nedeniyle bu turda öncelik statik IPv6 ve tekrar kullanılabilir ortak VLAN aktarımıdır. Yeni üçüncü taraf kod eklenmemiştir; mevcut FRR/Linux çalışma ortamı kullanılır. mstpd kaynakları kopyalanmamıştır.

## Dağıtım ve kanıt

Pull request CI'da `source_commit`, GitHub'ın gerçekten checkout ettiği geçici birleştirme commit'i olabilir; bu, PR'ın main'e birleştirildiği anlamına gelmez. İlgili workflow'un `head_sha` alanı PR dalı commit'ini, manifest ise derlenen checkout kimliğini gösterir. Öğrenci ve öğretmen ZIP'leri aynı manifesti taşır.

Kök HTML kaynaklarla eşitlik kontrolünden geçer. Dağıtım için başarılı genel CI öğrenci ZIP'i ve içindeki manifest esas alınır. `html-build-manifest.json` HTML ve gömülü modül SHA256'larına ek olarak `source_commit` içerir. Yerel kaynaksız derlemede commit `null`, kimlik `unverified local build` olur; kimlik uydurulmaz. Commit kimliği dosya imzası değildir. Native raporları ayrı workflow artifact'lerinden alınır; genel ZIP başarısı yeni native job başarısı yerine geçmez.

Özgün 40 görev ve öğrenci/öğretmen ayrımı değiştirilmemiştir. `LAB_MOTOR_HARITASI.md`, öğrenci dosyalarının gerçek içeriği ve hash'lerinden yeniden üretilebilir. UX/Akademi planlama dalına değişiklik yapılmaz. PR taslak kalır.

## Router JSON → FRRouting (operatör yolu)

```sh
python3 real-lab/routed_topology.py real-lab/examples/routed-2-routers.aglab.json --out /tmp/aglab-frr-export
# Yalnız lab.clab.yml, plan.json ve rN.conf veri dosyaları; hiçbir süreç başlamaz.
sudo python3 real-lab/routed_smoke.py --execute
# Öğretmen kaynak paketi olmayan dağıtımda bağımsız iki/üç router örnekleri:
sudo python3 real-lab/routed_smoke.py --demo-only --execute
# Öğrenci JSON'unda beklenen arızayı gözle; ayrı, incelenmiş rota onarımını uygula:
sudo python3 real-lab/routed_smoke.py --topology aglab-operator-topology.json --expect failure --repair repaired-topology.json --source PC1 --target PC2 --execute
```

`routed_topology.py` mevcut v23 şemasını değiştirmez: 2–4 tek NIC PC, 1–3 router,
0–2 isteğe bağlı VLAN1 access bridge, en fazla 9 cihaz/12 kablo kabul edilir.
Bütün uç/arayüz adresleri RFC1918 host IPv4/mask; PC gateway on-link olmalıdır.
Statik private/default prefix, private next-hop, AD 1–255 ve shutdown/power/kablo
up alanları korunur. Yanlış ama sözdizimsel olarak geçerli next-hop düzeltilmez;
FRR/kernel'de başarısızlığının gözlenmesi gerekir. Orijinal portlar ethN'e,
cihaz kimlikleri pcN/rN/sN'e sabit eşlenir; özgün JSON değişmez ve SHA256 kaydedilir.

OSPF/BGP, ACL/NAT, helper, trunk, VLAN1 dışındaki switch ayarları, SVI/alt arayüz,
çoklu NIC, raw config, bilinmeyen exec/image/bind/host-path alanları reddedilir.
İmajlar sabittir. Kaynak isimleri FRR komutuna veya host dosya yoluna konmaz.
Export edilmiş plan değişirse yeniden kaynak doğrulaması yapılmadan yazılamaz;
çalıştırıcı planı shell olarak yüklemez. Yalnız yetkili operatör `--execute`
kullanır; tarayıcı, yönetici API'si veya öğrenci servisine yeni yetki eklenmedi.

Her native düğümün yönetim eth0 arayüzü kapatılır; PC varsayılan rotası yalnız
veri gateway'ine gider. Konteynerler sabit, ayrı lab adındadır; önceden var olan
lab reddedilir, kısmi deploy dâhil sahip olunan kaynakların temizliği doğrulanır.
Operatör raporu mevcut `routing/FRRouting` veri şemasıyla alınır; gerçek komut,
beklenen ve gözlenen ICMP, FRR RIB, kernel FIB ve seçilen gateway kanıtları saklanır.
Rapor dosyası imzalı veya PCAP değildir; mevcut Dedektif onu güvenilmeyen metin/veri
olarak gösterir. Onarım JSON'u yalnız statik rotaları değiştirebilir.

Bağımsız iki/üç router örnekleri sağlıklı trafik, eksik dönüş rotası, yanlış
next-hop ve interface shutdown/no shutdown aşamalarını çalıştırır. AGL-034/035
özgün başlangıç topolojisi başarısız, özgün target topolojisinin statik rotaları
CLI ile uygulandıktan sonra başarılı olmalıdır. Akademi source/teacher verileri
öğrenci ZIP'ine konmaz; bu iki doğrulama checkout/öğretmen paketi gerektirir.
Testlerin kodlanması başarı kanıtı değildir: kesin sonuç `routed-*-results.json`
ve ilgili native CI çalışmasından okunmalıdır. JSON doğrulama/unit testleri
Docker/FRR çalıştırıldığını iddia etmez.

## Dar BGP politika kabul senaryosu

Mevcut üç FRR routerlı `advanced_smoke.py routing` altyapısı yeniden kullanılır.
R1'de yalnız hedef /24'ü eşleyen prefix-list ve inbound route-map ile R2 yoluna
local-preference 200 verilir. Kabul testi daha uzun AS_PATH'e rağmen R2 next-hop'u,
gerçek kernel `ip -json route get` sonucu ve uçtan uca ICMP'yi birlikte zorunlu
tutar. Politika kaldırıldığında kısa R3 yolu geri gelmelidir.

Sonra hedef /24 iki komşudan da prefix-list/deny route-map ile filtrelenir:
BGP/RIB rotası ve kernel yolu kaybolmalı, gerçek ICMP başarısız olmalıdır.
Filtre kaldırıldıktan sonra next-hop ve trafik düzelmelidir. Bu bir iBGP,
route-reflector, MED/community veya tüm policy semantiği desteği değildir.
Kesin sonuç native routing CI raporudur; unit testte çağrıların varlığı protokol
başarısı sayılmaz. Tarayıcı/öğrenci yetkilerinde değişiklik yoktur.

## Özetleme hata incelemesi — 6 Kasım 2026

Aynı sabit `quay.io/frrouting/frr:containerlab-10.7.1` imajı, gerçek Docker/Linux
veri ağları ve mevcut `extended_topology`/`multi_area` koduyla yeniden sınandı.
İmaj digest’i `sha256:f7d98e4faa24333c1fdb638f72678111de07a7aef90566132655dbadceca86c7`;
`show version`: `FRRouting 10.7.1_git (fb7b13a821a9)`; host kernel `6.18.57`.
Bu yerel araştırma Containerlab CI koşusuyla aynı şey değildir.

Özetlemeden önce area0/area2 komşulukları, R1’de `N IA 192.168.20.0/24`,
R2’nin area0+area2 ABR yapılandırması, area0 LSDB’sindeki R2 kaynaklı /24 Type-3
LSA ve gerçek ICMP doğrulandı. Passive-interface arızası ve onarımı da geçti.
`area 2 range 192.168.20.0/23` running-config’e kabul edildi. Ardından gerçek
daemon logunda aşağıdaki hata görüldü:

```text
OSPF: Received signal 11 ... (si_addr 0x0 ...); aborting...
OSPF: in thread ospf_abr_task_timer scheduled from ospfd/ospf_abr.c:2189 ospf_schedule_abr_task()
ZEBRA: client 34 disconnected 2 ospf routes removed from the rib
```

Beklenen /23 oluşmadı; sonraki RIB’de OSPF rotaları yoktu. Bu yeniden üretimde
sorun komutun reddedilmesi veya yalnız yanlış prefix araması değildir: seçili
FRR imajındaki ABR görevi çökmesi somut olarak gözlendi. Çöken fonksiyonun içindeki
asıl kaynak hatası/backtrace henüz çözülmedi; eski CI başarısızlığının da aynı
çökmeden kaynaklandığına dair eski log kanıtı yoktur. FRR kaynak kodundaki
`ospf_area_range_set` ve ABR zamanlama yolu incelendi; üçüncü taraf kod kopyalanmadı.

`--experimental-summary` başarısızlık durumunda artık önce/sonra sürüm,
running-config, ABR durumu, ospfd route tablosu, summary LSDB ve daemon logunu
raporda saklar. Başarısız deney korunur ve varsayılan kabul testine alınmaz.
FRR sürümü değişimi veya startup-config ile alternatif özetleme ancak ayrı native
pozitif/negatif testlerden sonra destek sayılabilir; bu turda uygulanmadı.

## Tamamlanan kabul koşusu — a1d6382

[Genel CI](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42192382186)
ve [canlı CI’ın altı işi](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42192382258)
başarılıdır. Yerel tam pipeline da 64/64 kontrolü geçti. Genel CI öğrenci ve
öğretmen ZIP’lerini, 40 kaynak hash’ini, paket ayrımını ve HTML eşitliğini doğruladı.

`routed_smoke` iki/üç router örneklerinde ve özgün AGL-034/035’te gerçek ICMP,
FRR static RIB/AD, Linux next-hop, eksik dönüş rotası, yanlış next-hop, CLI onarımı
ve shutdown/no shutdown aşamalarını geçti. İki Akademi görevinin başlangıçta
başarısız, hedef rotalar uygulandıktan sonra başarılı olduğu doğrulandı.
`aglab-integration-routed_smoke` artefaktı dört gerçek JSON raporunu içerir.
Native routing işi prefix-list/route-map/local-preference, uzun yol seçimi,
filtreleme nedeniyle rota/trafik kaybı ve onarımı da geçti.

İlk koşularda BusyBox `ip -json` desteği olmadığı ve FRR’nin zararsız
`No changes found to be committed!` notunun hata sayıldığı görüldü; iki hata
regresyon testleriyle düzeltildi. Son native koşunun başarılı olması bu
hataların gizlendiği anlamına gelmez: shutdown’ın trafiği kestiği ayrıca sınanır.
Özetleme deneyi bu başarılı varsayılan koşuya dâhil değildir; yukarıdaki çökme
ve eksik /23 sonucu geçerlidir. ACL/NAT/PAT, DHCP/relay, RSTP ve LACP bu turda
uygulanmadı; sonraki işlerdir. Öncelik, özetleme için ayrı FRR sürüm/başlangıç
konfigürasyonu doğrulaması, ardından izole kernel ACL/NAT kabul senaryolarıdır.
