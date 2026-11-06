# AğLab motorlarını açık kaynakla hızlandırma kararı (4 Kasım 2026)

> 5 Kasım güncellemesi: Aşağıdaki bağımsız prototip geçmişi korunur. Artık
> Michael Borck NetSim'in özgün MIT motoru gerçekten çalıştırılıyor; güncel
> seçim, kaynak incelemesi, lisans, kapsam ve testler için
> [Hazır motor entegrasyonu](HAZIR_MOTOR_ENTEGRASYON.md) belgesini esas alın.
> Bağımsız prototip üçüncü taraf entegrasyonu olarak sunulmaz.

## Amaç ve değişmez koşullar
AğLab'ın öğrenci arayüzü, çevrimdışı tek HTML dağıtımı, 40 Akademi görevi, rubrik puanlaması, PKT import ve Paket Dedektifi korunur. Motoru tek seferde değiştirmek yerine her protokol için ölçülebilir, geri alınabilir bir uyarlama yapılır.

## İncelenen adaylar (kaynak belgelerindeki iddialar; AğLab entegrasyonu henüz test edilmedi)

| Aday | Temel artısı | Sınır / risk | Karar |
| --- | --- | --- | --- |
| netsim-labs/netsim | Rust+WASM; Cisco/Huawei CLI; README'de VLAN/STP/OSPF ve BGP motoru anlatılıyor | AGPL-3.0 ve ticari lisans beyanı; kod/API uyum ve gerçek destek kapsamı doğrulanmalı | Doğrudan almayalım; önce salt araştırma/ayrı lisans değerlendirmesi |
| michael-borck/netsim | MIT; browser tabanlı deterministik TS motor, ARP/IPv4/ICMP, animasyon, NAT, DHCP/DNS/HTTP, Containerlab export | Cisco CLI yerine Linux iproute2; OSPF ve 802.1Q trunk README'de gelecek iş; doğrudan motor değiştirmeye uygun değil | Öncelikli düşük riskli algoritma/test yapısı referansı |
| FediMechergui/netforge | TS ayrık olay motoru, ARP/ICMP/TCP/DHCP/DNS; otomatik puanlama yaklaşımı | Lisans ve ayrı API uyumluluğu doğrulanmadan kod alınamaz | İkinci referans adayı |
| Containerlab + FRRouting | Gerçek OSPF/BGP ve Linux paketleri, AğLab Gerçek Lab'de zaten mevcut | Docker/Linux gerektirir; tarayıcıda çevrimdışı çalışmaz | Gerçek davranış doğrulaması için tut |

Kaynaklar:
- https://github.com/netsim-labs/netsim
- https://github.com/michael-borck/netsim
- https://github.com/FediMechergui/netforge
- https://containerlab.dev/
- https://docs.frrouting.org/en/latest/

## Önerilen küçük, geri alınabilir deneme
1. Mevcut AğLab motorunu **referans** olarak dondur: 40 görev, kablo/VLAN, ARP-ping, routing, OSPF/eBGP ve port-security regresyonları zorunlu kalsın.
2. Kaynak kodu kopyalamadan önce MIT adayın ayrık olay ve paket izleme veri modelini incele; uygun lisans/NOTICE kayıtlarını belgeleyerek **bağımsız** bir `engine-adapter` prototipi kur.
3. İlk prototipte yalnız **ARP + ICMP paket olayları** ve `Topology JSON -> event list -> AğLab Packet Detective` eşlemesini dene. Mevcut simülasyon motoruna veya Akademi puanlamasına bağlama.
4. Aynı sabit topolojilerde hedefe ulaşma, VLAN izolasyonu, TTL/time-exceeded, yanlış gateway ve kayıp nedenleri için eski/yeni sonuçları karşılaştır. Eski motorla aynı sonuç çıkmıyorsa otomatik devreye alma.
5. 10/50/100 cihazda olay sayısı, gecikme ve bellek ölç; tarayıcı offline dosya açma, import/export, puan ve UI regresyonu geçmeden geçiş yapma.
6. Karşılaştırma başarılıysa yalnızca seçili olay üretimini feature flag ile devreye al; tek tıklamayla eski motora dönüş mümkün olsun. OSPF/BGP'nin ileri davranışları için FRR gerçek labı referans tut.

## Kabul / red kapısı
- Orijinal 40 kaynak JSON'un SHA256 değerleri aynı.
- Öğrenci/öğretmen dağıtımları ve PKT import değişmedi.
- ARP/ICMP ve izolasyon sonuçları deterministik ve mevcut kabul senaryolarıyla uyumlu.
- Offline HTML için yeni CDN/sunucu bağımlılığı yok.
- Kullanılan herhangi bir üçüncü taraf kodun lisansı ve atfı incelendi.
- CI ve tarayıcı testleri yeşil; performans iyileşmesi ölçüldü. **Henüz bu prototip veya ölçüm yapılmadı.**

Karar: AğLab JS motorunu şimdi topluca silme veya NetSim WASM'i doğrudan gömme. Önce MIT/TS yaklaşımıyla dar kapsamlı event adapter deneyi, gelişmiş protokollerde mevcut FRR altyapısını kullan.


## İlk çalışan prototip (deneysel)

`simulator/engine-adapter-prototype.cjs` yalnızca tek VLAN üzerindeki host/switch bağlantıları için **bağımsız ve çok sınırlı** ARP isteği/yanıtı ile ICMP echo gidiş/dönüş olaylarını üretir. Olaylar mevcut `packet-events.js` normalleştiricisine aktarılır. `simulator/test_engine_adapter_prototype.cjs` iki uç arasında teslimi, farklı VLAN'ı, kopuk bağlantıyı, hatalı MAC'i ve tekrarlanabilir sonuçları sınar; 10/50/100 uç için 20'şer koşuluk mikro ölçüm verir. Prototip gerçek MAC öğrenmesi/FDB, trunk, STP, router/TTL, ARP cache veya zamanlamalı Ethernet modelinin yerine **geçmez**. AğLab arayüzüne ve Akademi puanlamasına bağlanmadı; normal `build_simulator.py` çıktısına eklenmez.

Bu kod başka bir simülatörün kaynak kodunu kopyalamaz, yeni kütüphane/lisans bağımlılığı yaratmaz. Mikro ölçüm sonuçları yalnızca bu küçük modelin çalışma süresidir; **eski AğLab motoruyla veya NetSim'le hız karşılaştırması değildir**. Dış motorla eşdeğerlik ve 40 lab uyumluluğu henüz kanıtlanmadı. CI sonucu, prototipin sınırlı sözleşmesini doğrular; motor geçiş onayı değildir.


## Gerçek motor ile dar kapsamlı karşılaştırma

`simulator/test_engine_adapter_parity.cjs`, üretimde kullanılan `ethernet-forwarding.js` modülünü bağımlılıklarının küçük, denetlenebilir taklitleriyle ayrı bir Node VM içinde çalıştırır ve **aynı host/switch erişim topolojilerinde** bağımsız prototip ile başarı/başarısızlık sonuçlarını karşılaştırır. Üç durum: aynı access VLAN'da başarılı ICMP; ayrılmış VLAN'da başarısızlık; kopuk hedefte başarısızlık. Test `run_pipeline.py` Node listesine ve dağıtım dosya kümesine eklenmiştir.

Bu bir **sonuç eşdeğerliği duman testidir**, tam trafik izi/ARP önbelleği/MAC FDB/TTL/trunk/STP veya üretim tarayıcısı davranışlarının eşdeğerliğini kanıtlamaz. Bağımlılık taklitleri gerçek motor çalışmasını kısmen soyutlar. Olay sayısı/dizisi aynı olmak zorunda değildir. Test başarılı olsa bile otomatik motor değişimi yapılmaz; sonraki iş daha kapsamlı browser fixture ve gerçek ölçüm testleridir.

### Çerçeve sırası eşdeğerliği (ek kontrol)

Karşılaştırma artık gerçek `ethernet-forwarding.js` olay günlüğünü de yakalar; aynı VLAN'da başarılı iletim ve kopuk hedef senaryosunda çerçeve türlerinin sırasını alternatif adaptörün çıktısıyla karşılaştırır. VLAN ayrımındaki önceki fark kapatıldı: prototip artık başarısız ARP broadcast denemesini de kaydediyor. Üç dar kapsamlı senaryoda gerçek motor ve prototip çerçeve **tür sırasını** karşılaştırıyor; tam iletim/FDB olay dizisi eşdeğerliği henüz sağlanmadı.

### Deneysel VLAN bazlı MAC öğrenimi

Prototip artık her switch için VLAN+MAC → giriş portu tablosu tutar. ARP Request yayın olarak yayılır; ARP Reply ve sonraki ICMP çerçeveleri öğrenilen hedef portuna unicast yönlendirilir. `test_engine_adapter_parity.cjs` üç erişim VLAN senaryosunda gerçek AğLab Ethernet motoruyla **switch forward kararını, ingress/egress portlarını ve VLAN bilgisini** de karşılaştırır. Bu yalnızca basit tek-switch/access VLAN modelidir; öğrenmenin yaşlanması, MAC taşınması, trunk/STP, port-security, yönlendirme ve gerçek paketin alanları hâlâ kapsam dışındadır. En son CI sonucu doğrulanana kadar testler geçildi sayılmaz.

### Deneysel ARP oturum önbelleği

`createSession()` ile isteğe bağlı, yalnızca prototip içinde kullanılan ARP önbelleği eklendi. İlk başarılı ping ARP+ICMP olayları üretir; aynı topoloji ve hedefle ikinci ping yalnız ICMP üretir. Topoloji JSON'u değiştiğinde önbellek silinir; kopan kablo için eski ARP kaydı kullanılamaz. Varsayılan `simulate()` çağrısı durumsuz kaldığı için mevcut karşılaştırma/ölçek testlerinin davranışı değişmez. Bu kaba topoloji imzası ve ARP TTL bulunmayan öğretim prototipidir; üretim motoruna bağlanmadı.

### VM karşılaştırması ve taşınabilir paket kapısı

Üretim motorundan Node VM sınırında alınan olay satırları `Array.from` ile testin
kendi bağlamına kopyalanır. Böylece `deepStrictEqual` aynı içerikteki dizileri farklı
realm prototipleri nedeniyle reddetmez; çerçeve sırası ve switch kararlarının sıkı
eşitlik kontrolleri korunur. Önceki CI hatası ve yerel tekrar bu ayrımdan kaynaklandı.
Deneysel motorun üretim varsayılanı veya tarayıcıya bağlantısı değiştirilmedi.

Çevrimdışı ZIP, karşılaştırma ve prototip testlerinin gerektirdiği
`engine-adapter-prototype.cjs` modülünü de içerir. Paket doğrulayıcısı modülü,
normalleştiriciyi, üretim Ethernet modülünü ve iki Node testini zorunlu tutar;
eksik bağımlılıklı arşiv doğrulanmış dağıtım olarak kabul edilmez.
