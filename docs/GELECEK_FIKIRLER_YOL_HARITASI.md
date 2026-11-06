# AğLab – Gelecek Fikirleri ve Ürün Yol Haritası

> Kayıt: 4 Kasım 2026. **Fikir havuzu / planlama belgesi**; burada yazanlar uygulanmış özellik sayılmaz.
> İlk hedef: Packet Tracer'a mümkün olduğunca hızlı ve doğru yaklaşmak; sıfırdan motor yazmak yerine uygun lisanslı hazır bileşenleri/FRRouting'i değerlendirmek. Codex'in mevcut motor entegrasyonunu bölmeden ilerle.
> İkinci hedef: Aynı platformda hem CCNA/CCNP hazırlığı hem okul/öğretmen kullanımını desteklemek.

## Önceliklendirme ilkesi
- Öncelik 0: Güvenilir ağ motoru, Cisco benzeri CLI, simülasyon doğruluğu, mevcut 40 Akademi laboratuvarının korunması, çevrimdışı kullanım ve Gerçek Lab uyumu.
- Öncelik 1: Motor oturduğunda eğitim değerini hemen yükselten özellikler.
- Öncelik 2: Çok kullanıcılı sınıf/sertifika platformu.
- Öncelik 3: İleri seviye otomasyon, güvenlik ve profesyonel kullanım.
- Her yeni fikir için öğrenci değeri, motor bağımlılığı, lisans, güvenlik, performans ve test maliyeti ayrıca değerlendirilir.

## Fikir havuzu

### 1. AğLab Network Doctor – Kanıta dayalı arıza analizi (P1)
- Topoloji, port durumu, MAC/ARP tabloları, VLAN, trunk, gateway, routing ve paket olaylarından teşhis oluştur.
- Öğrenci seviyesine göre kademeli ipucu ver; sınav modunda kapatılabilir.
- Kesin tanı ile olası neden ayrımını yap; delil olmayan teşhis üretme.
- Başlangıç: mevcut Paket Dedektifi olaylarından açıklanabilir kural tabanlı teşhis.

### 2. AğLab Challenge – Sorun giderme görevleri (P1)
- Önceden bozuk şirket/şube ağları, düzeltme görevleri ve otomatik değerlendirme.
- Yalnız bağlantı sağlama değil doğru kök neden, minimum gereksiz değişiklik ve gerekçe değerlendirmesi.
- CCNA/CCNP ile okul etkinliklerine aynı senaryo motoruyla hizmet et.

### 3. AğLab Time Machine – Yapılandırma geçmişi (P1)
- Komut/topoloji değişimi için snapshot veya olay geçmişi, geri al/ileri al, iki sürüm arasında fark.
- “Hangi komut ağı bozdu?” analizi.
- Veri boyutu sınırı, hassas token/anahtarların kaydedilmemesi ve tutarlı geri yükleme zorunlu.

### 4. Gerçek dünya senaryo kütüphanesi (P1)
- Hastane (segmentasyon), üniversite (kampüs), banka şubeleri (VPN/routing), veri merkezi (yedeklilik/BGP), otel (misafir ağı), fabrika (segmentasyon), ISP (BGP/OSPF).
- Her senaryo: topoloji, görev, hata enjekte etme, öğrenci ipuçları, öğretmen çözümü, objektif rubrik.
- Mevcut 40 laboratuvarı silme/değiştirme.

### 5. AğLab Marketplace – Güvenli laboratuvar paylaşımı (P2)
- Öğretmen/topluluk laboratuvar paketleri, sürüm/lisans bilgisi, değerlendirme ve kürasyon.
- İçe alınan içerik yalnız veri formatı; keyfî JavaScript/sistem komutu çalıştırma yok.
- Kötü amaçlı veya aşırı büyük topoloji dosyalarına karşı doğrulama.

### 6. AğLab Automation Studio (P3)
- Python, Ansible, REST API, NETCONF/RESTCONF ile çoklu cihaz yapılandırma.
- Kontrollü sandbox, erişim sınırları ve dış ağa çıkış politikaları.
- CCNP ve profesyonel otomasyon eğitimleri.

### 7. AğLab Cyber Range (P3)
- İzole saldırı-savunma eğitimleri: ARP spoofing tespiti, DHCP snooping, ACL hata düzeltme, VLAN izolasyonu ve paket inceleme.
- İzolasyon, yetkilendirme, kaynak limitleri ve güvenli senaryo tanımları şart.

### 8. AğLab Certification Simulator (P2)
- Süreli CCNA/CCNP tarzı bağımsız pratik sınav: çoktan seçmeli, CLI, troubleshooting ve paket analizi.
- Konu bazlı geri bildirim ve eksiklerden yeni laboratuvar önerileri.
- Resmî Cisco sınavı/sertifikası veya Cisco ile ilişki iddiası yok; güncel sınav hedefleri ayrıca doğrulanır.

### 9. Network Digital Twin – Ağın dijital ikizi (P3 / araştırma)
- Yetkili gerçek ağdan topoloji/konfigürasyon içe alma; değişiklik öncesi etki analizi.
- Modelde desteklenmeyen cihaz/protokol davranışlarında kesin sonuç iddiası yok.
- Veri gizliliği, kimlik bilgilerini maskeleme, envanter ve doğruluk sınırları önemli.

## Daha önce konuşulan tamamlayıcı fikirler
- **Yapay zekâ destekli öğretmen:** Paket Dedektifi ve topoloji olaylarına dayalı açıklanabilir, kademeli ipuçları; sınav modunda devre dışı.
- **Wireshark benzeri paket başlığı inceleme:** Ethernet/IP/TCP/UDP/ICMP katmanlarını eğitim amaçlı görüntüleme, gerçek olay verisini temel alma.
- **Otomatik laboratuvar oluşturucu:** Öğretmenin metin isteğinden topoloji + görev + test + rubrik + çözüm oluşturma; yayın öncesi doğrulama.
- **Öğrenci gelişim analizi:** Konu bazlı başarı, zayıf alanlara öneri; öğretmen erişim izinleri ve gizlilik.
- **Öğrenme / Sınav modları:** İpucu açık ve kapalı modlar, ayrı puanlama/raporlama.
- **Öğretmen ve sınıf paneli:** Öğrenci ataması, ödev, durum ve not/puan takibi, çok kullanıcılı erişim.
- **Çoklu dağıtım:** AğLab Desktop (çevrimdışı), AğLab Web, AğLab School; mümkünse ortak motor/topoloji biçimi.
- **Çeşitli cihaz modelleri, gelişmiş IOS benzeri CLI, IPv6, ACL/NAT, kablosuz ağ, gerçek paket analizi:** Packet Tracer uyumluluk yolunda motor desteği doğrulandıktan sonra.
- **Gerçek Cisco cihazlarına bağlantı:** Cihaz imajı/yazılım lisansı, güvenli cihaz erişimi ve yetki sınırları gözetilerek araştırma.
- **Çok kullanıcılı izole Gerçek Lab:** Güvenli oturum ayrımı, kaynak kotası ve sınıf yönetimi.

## Önerilen sıralama
1. Packet Tracer'a yaklaşan doğrulanmış motor / hazır açık kaynak entegrasyonu; mevcut simülatör ve 40 laboratuvarı koru.
2. Network Doctor + gelişmiş Paket Dedektifi.
3. Challenge, gerçek dünya senaryoları, Time Machine.
4. Okul sınıf paneli, CCNA/CCNP deneme sınavları, laboratuvar üreticisi.
5. AI öğretmen, gelişim analizi ve paylaşım altyapısı.
6. Gelişmiş automation/cyber range/digital twin.

## Ürün ilkeleri
- Kullanım alanları: CCNA/CCNP hazırlığı **ve** okul/öğretmen platformu.
- Aynı topoloji ve değerlendirme modelini mümkün olduğunca paylaş.
- Öğrenme modu ile sınav modunu net ayır.
- Uygulanmadan önce prototip, güvenlik ve performans doğrulaması yap.
- Buradaki öncelikler bağlayıcı sprint taahhüdü değil; gelecekte karar vermek için saklanan taslaklardır.

---

# AYRINTILI ÖZELLİK TASARIMLARI — ÜRÜN FİKİRLERİ

Bu bölüm yalnızca başlıkları değil, **kullanıcı akışını, örnek senaryoyu, önerilen teknik tasarımı, ilk sürüm kapsamını, bağımlılıklarını ve kabul kriterlerini** saklar. Hiçbiri şu anda teslim edilmiş özellik olarak değerlendirilmemelidir.

## F01 — Network Doctor (kanıt temelli sorun giderme)

**Kullanıcı hikâyesi:** Öğrenci PC1'den Sunucu1'e ping gönderir; başarısız olunca “Neden çalışmadı?” düğmesine basar. Sistem topolojiyi, bağlantı durumunu, kaynak IP/mask/gateway bilgisini, VLAN ve trunk izinlerini, ARP/MAC tablolarını, rota seçimini ve Paket Dedektifi kayıtlarını inceler.

**Ekran:** Sol tarafta “iletişim zinciri” (PC1 → SW1 → R1 → SW2 → Sunucu1), her adımda doğrulandı / muhtemel sorun / bilgi yok durumları. Sağda “kanıt” bölmesi: olay saati, ilgili cihaz/port/konfigürasyon ve denemeyi tekrar çalıştır düğmesi. İpucu seviyesi 1 yalnız kontrol edilecek bölgeyi, seviye 2 muhtemel parametreyi söyler; seviye 3 ancak öğrenme modunda açık çözüm sunar.

**Örnek:** SW1 Gi0/1 trunk üzerinde VLAN 20 izinli değil. Motor, VLAN 20 çerçevesinin o linkten geçemediğini raporlar; Doctor “SW1 Gi0/1 üzerindeki izinli VLAN listesini kontrol et” der. Ortada kanıt yoksa “kesin olarak belirlenemedi” der.

**Teknik yaklaşım:** Önce kural tabanlı, deterministik analiz; girdiler normalize edilmiş `topology snapshot`, `packet events`, `route decisions`; çıktılar `{issueCode, confidence, evidenceIds, affectedPath, hintLevels}`. LLM daha sonra yalnız doğrulanmış bulguları öğrencinin seviyesine uygun açıklar. Kanıt olmadan config düzeltmez.

**MVP:** VLAN uyuşmazlığı, kapalı port, hatalı IP/mask/gateway, eksik statik rota ve ARP ulaşamama. **Kabul:** Her teşhisin tekrarlanabilir bir test topolojisi, kanıt referansı ve hatalı pozitif kontrolü olmalı. Sınav modunda ipuçları kapalı.

## F02 — Time Machine (topoloji ve komut geçmişi)

**Kullanıcı hikâyesi:** Öğrenci VLAN 10 kurdu, trunk açtı, sonra yanlışlıkla portu kapattı. Zaman çizelgesinden “port kapatılmadan önce” anına dönerek çalışan hâlle bozuk hâli yan yana karşılaştırır.

**Ekran:** Zaman çizgisi, anlamlı olay adları (“SW1 Fa0/2 access VLAN 20”, “R1 route eklendi”), iki revizyon arası diff; “bu sürümün kopyasını aç” ve “geri al” seçenekleri. Geri alma öncesi kaydedilmemiş değişiklik uyarısı.

**Teknik yaklaşım:** Tam snapshot + aradaki komut/değişiklik günlükleri; şema sürümü ve atomik restore. Tam belleği her pakette değil, **kullanıcı yapılandırması değiştiğinde** kaydet. Cihaz CLI gizli anahtarları, API token'ları ve Gerçek Lab kimlik bilgileri geçmişe asla yazılmaz. Saklama limiti/kota ve eski geçmişin budanması gerekir.

**MVP:** 20 son düzenleme, geri al/ileri al, önce/sonra JSON tabanlı fark. **Kabul:** Restore sonrası ping/CLI/puan sonuçları seçilen snapshot'la aynı; 40 Akademi görevinin başlangıç ve puanlama verisi bozulmaz. Gerçek Lab cihazlarına otomatik geri alma uygulanmaz.

## F03 — Challenge Mode (arıza avı ve senaryo görevleri)

**Kullanıcı hikâyesi:** “Şirketin Ankara şubesinde ERP sunucusu erişilemiyor; ağın geri kalanını bozmadan onar.” Öğrenci CLI, ping/traceroute ve Packet Detective kullanır; sistem gizli hataların tümünü açık etmeden çalışmayı puanlar.

**Görev paketi:** Başlangıç topolojisi, öğrenciye görünen problem, doğrulama testleri, gizli hata enjeksiyonu, izin verilen komutlar, öğretmen çözümü, rubrik, süre ve ipucu bütçesi. Örnek puan: erişim doğruluğu %60, yan etkisiz düzeltme %25, açıklama %15; bu oranlar taslak olup öğretmen tarafından değiştirilebilir.

**MVP:** VLAN/trunk, gateway, route ve port shutdown kaynaklı 5–10 görev. **Kabul:** Çözümü isimle/hileli parametreyle değil motorun gerçek ağ durumuyla ölç; yanlış çözümle amaç dışı VLAN erişimi açılmışsa tam puan verme.

## F04 — Gerçek dünya senaryo kütüphanesi

**Hastane:** Hasta kayıtları VLAN 10, medikal cihazlar VLAN 20, misafir VLAN 90. İstenen: misafir ağının hasta kayıtlarına erişmemesi; yetkili personelin erişmesi. **Kanıt:** ACL/segmentasyon testleri.

**Üniversite:** Yönetim, öğrenci laboratuvarı ve misafir segmentleri, katlar arası switch trunk, yedek uplink; bir bağlantı kesilince beklenen erişim.

**Banka şubeleri:** İki şube ve merkez, route/ACL ve yalnızca eğitim amaçlı VPN tasarımı; şube erişimleri kontrollü.

**Veri merkezi / ISP:** OSPF/BGP komşuluk ve alternatif yol; gelişmiş protokoller gerekiyorsa Gerçek Lab FRR. Simülasyon ve gerçek cihaz davranışı arasında destek farkı görünür olmalı.

**Otel / Fabrika:** Misafir izolasyonu ve OT/IT segmentasyonu; yalnız güvenli eğitim senaryoları.

**Paket şeması:** `scenario.json` (şema sürümü), topoloji, amaçlar, otomatik testler, çözüm ve öğretmen notu; içerikler motor yetenek etiketleriyle (`requires: ["vlan", "acl"]`) eşleşmeli. **Kabul:** Her senaryo başlangıçta hedefi karşılamaz, doğru çözümle karşılar, puanlanır ve tekrar yüklenebilir.

## F05 — Marketplace / Lab Hub

**Öğretmen akışı:** Laboratuvarı “yayınla” → uygulama JSON şemasını ve boyutları kontrol eder → önizleme + otomatik test sonucu → lisans, sürüm, kazanım, zorluk seviyesi belirlenir → kürasyon/moderasyon → paylaşım.

**Öğrenci akışı:** Konu/zorluk/sertifika/kazanç filtreleri, sürüm ve değerlendirmeleri görme, güvenli içe aktarma, çakışan cihaz/şema için uyarı.

**Güvenlik:** Yüklenen dosyalarda çalıştırılabilir JavaScript, HTML script, shell komutu, path traversal ve haricî URL yüklenmesine izin verme. İçeriğin kaynağını ve lisansını belirt; spam/telif bildirimi, sürümleme, geri çekme akışı tasarla.

**MVP:** Sunucusuz yerel “Lab Paketini Dışa Aktar / İçe Al” ve örnek kütüphane. Merkezi paylaşım ancak hesap/izin/moderasyon altyapısı sonrası.

## F06 — Automation Studio

**Öğrenci hikâyesi:** 15 switch'te VLAN 30 aç; önce tek tek CLI, sonra Ansible playbook ile yap. Çıktı cihaz bazında başarılı/başarısız olarak listelenir ve ağ durumu yeniden test edilir.

**Ekran:** Kod editörü, kontrollü çalıştırma, hedef cihaz kapsamı, dry-run diff, geri dönüş snapshot'ı, görev günlüğü. Öğrenme yolu: Python temel ağ komutları → Ansible → REST/NETCONF/RESTCONF.

**Mimari:** Tarayıcıda doğrudan sistem komutu çalıştırma yok. İzole iş çalıştırıcı, kaynak sınırları, komut/cihaz yetkisi, zaman aşımı, ağ çıkışı kısıtlaması; gerçek cihaz için ayrı açık onay. **MVP:** Önce sandbox içinde sanal cihazlar üzerinde güvenli ön tanımlı otomasyon tarifleri.

## F07 — Cyber Range

**Örnek laboratuvarlar:** ARP spoofing tespiti, DHCP snooping yapılandırması, port-security ihlali teşhisi, ACL yanlış kurallarını düzeltme, VLAN izolasyon kontrolü, kötü yapılandırılmış ağ trafiğini inceleme.

**Öğrenme ekranı:** Kontrollü trafik akışı, saldırı/olay zaman çizgisi, savunma konfigürasyonu ve doğrulama. İnternet erişimi veya gerçek kurum ağlarına yönlendirme yok.

**Güvenlik koşulu:** Tam izolasyon, kullanıcı başına sandbox, hız/kaynak kotası, yalnız eğitim hedeflerine erişim, temiz reset. **MVP:** Önce yalnız simüle olaylar üzerinden savunma ve troubleshooting görevleri; gerçek paket araçları ancak izole Gerçek Lab ile.

## F08 — Bağımsız CCNA/CCNP sınav ve hazırlık merkezi

**Akış:** Öğrenci konu/kapsam seçer → süreli deneme başlatır → çoktan seçmeli + simülasyon + CLI arıza giderme görevleri → süre bitince kilitleme → güçlü/zayıf konu analizi → tekrar laboratuvarları.

**Ekranlar:** Sınav öncesi bilgi, soru gezinme, süre, işaretleme, soru başına simülasyon, bitiş raporu. **Sınav modu:** AI ipucu, Network Doctor çözümleri ve hazır cevap kapatılır; öğretmen ancak tanımlı koşullarda görüntüleyebilir.

**İçerik:** Cisco'nun güncel sınav konu başlıkları ayrı versiyonlar olarak eşlenir; resmî sınav sorularını kopyalama, Cisco onayı veya sertifika verme iddiası yok.

**MVP:** 1 zamanlı mini sınav (ör. 10 soru + 2 laboratuvar) ve ayrıntılı rubrik. **Kabul:** Puan, tekrar denemelerde aynı yapılandırma için deterministik; öğrenci modunda çözüm sızmaz.

## F09 — Network Digital Twin (uzun vadeli araştırma)

**Kullanıcı hikâyesi:** Yetkili ağ yöneticisi mevcut switch/router konfigürasyonlarını içe aktarır; “Bu trunk'tan VLAN 30'u kaldırırsam neler etkilenir?” sorusunu gerçek sisteme dokunmadan simüle eder.

**Girdiler:** Cihaz envanteri, bağlantı bilgisi, konfigürasyon (sır/şifre temizlenmiş), desteklenen cihaz modeli ve sürüm. **Çıktılar:** Etki altındaki segmentler, erişim testi sonuçları, simülasyonun kapsayamadığı protokol/cihazlar için belirsizlik etiketi.

**Güvenlik:** Varsayılan salt-okunur içe aktarma; açık yetki, denetim kayıtları ve şifre maskeleme; gerçek ağa otomatik değişiklik gönderilmez. **MVP:** Tamamen sentetik şirket topolojisi üzerinde “önce/sonra” değişiklik etkisi. Bu özellik üretim ağında karar destek olarak sunulmadan önce bağımsız doğruluk incelemesi gerektirir.

## F10 — AI Öğretmen

**Hikâye:** Öğrenci “R1 ile R2 neden komşu değil?” der. Asistan cihazların kanıtlanmış durumu, OSPF area, interface/IP ve gerçek motor olaylarına bakarak önce ipucu verir. “Area uyuşmazlığı” kesin motor bulgusuysa açıkça söyler; veri eksikse tahminde bulunmaz.

**Uygulama:** Network Doctor'ın yapılandırılmış kanıt API'si → seviye/kazanım ve ipucu izinleri → doğal dil yanıtı. İstenirse tümü yerel kural tabanlı mod; internet/API bağımlılığı ayrıca belirtilir. Öğrenci verisini dış sağlayıcıya göndermeden önce öğretmen/okul politikası, gizlilik ve uygun onam.

**MVP:** Beş yaygın arızada 3 seviyeli Türkçe ipucu; test edilmiş dayanaklar dışında komut üretmez.

## F11 — Wireshark benzeri Paket İnceleme

**Arayüz:** Üstte paket listesi (sıra, kaynak, hedef, protokol), ortada Ethernet/IP/ARP/ICMP/TCP/UDP başlık ağacı, altta paket bit/alan görünümü; VLAN etiketi ve TTL değişimi vurgulanır.

**Kaynak doğruluğu:** Eğitim motoru gerçek byte üretiyorsa gerçek alanları göster; yalnız semantik olay varsa byte uydurmak yerine “eğitim temsili” olarak işaretle. Gerçek Lab pcap içe aktarması ileride ayrı yetki ve kaynak sınırlarıyla desteklenebilir.

**MVP:** ARP ve ICMP için olaylardan güvenilir alan görüntüleme, filtreleme ve paket adımlarıyla senkron animasyon.

## F12 — Otomatik Laboratuvar Oluşturucu

**Öğretmen hikâyesi:** “Üç router, iki switch, altı PC; OSPF sorunu olan orta düzey görev oluştur.” Sistem topoloji JSON'u, öğrenci görev metni, başlangıçta bozuk durumu, öğretmen çözümü, test ve rubrik taslağı üretir.

**İş akışı:** Taslak oluştur → şema/komut doğrula → simülatörde başlangıç başarısız + çözüm başarılı testleri → öğretmen onayı → yayınla. Desteklenmeyen protokol varsa öneriyi sadeleştir veya gerçek laboratuvara yönlendir.

**MVP:** AI'sız şablonlarla VLAN ve statik routing laboratuvarı üretimi; sonradan doğal dil arayüzü.

## F13 — Öğrenci gelişim analizi

**Ekran:** Konu haritası (VLAN, routing, OSPF, CLI, troubleshoot), tamamlanan görevler, deneme sayısı, zaman içindeki ilerleme, önerilen tekrar laboratuvarı.

**Öğretmen görünümü:** Sınıf genelinde anonimleştirilebilir istatistik; belirli öğrenci verisi için açık rol/erişim politikası. Puan haricinde hangi tanı sürecinde zorlanıldığı için hata kodu bazlı toplulaştırma.

**MVP:** Öğrencinin cihazında yerel konu bazlı ilerleme; merkezi hesap gerektirmeden çalışır. Merkezi okul raporlarında veri saklama süresi, silme ve dışa aktarma kontrolü gerekir.

## F14 — Öğrenme ve Sınav Modu

**Öğrenme:** Paket Dedektifi açıklamaları, Network Doctor ipuçları, zaman çizgisi karşılaştırması ve serbest deneme açık.

**Sınav:** Çözüm önerileri ve AI kapalı, öğretmen rubriği ve süre aktif, gereken olay/komut kanıtları yalnız değerlendiriciye sunulur. Sınavın değerlendirme mantığı istemcide açıkça gizli olarak saklanamaz; yüksek riskli sınav için sunucuda kontrol gerekir.

**MVP:** Tek labda iki görünüm, ipucu görünürlüğü ve ayrı rapor çıktısı. **Kabul:** Öğrenci istemcisine öğretmen çözümü istemeden sızmıyor.

## F15 — Okul / Sınıf Yönetimi

**Öğretmen akışı:** Sınıf aç → kod/davetle öğrenci ekle → laboratuvar ve bitiş tarihi ata → ilerleme/deneme/puanları gör → geri bildirim ver → sonuçları dışa aktar.

**Roller:** Okul yöneticisi, öğretmen, öğrenci; her sınıfın verisi ayrı; öğrenciler başkasının çalışmalarını göremez. Çok kullanıcılı Gerçek Lab için kullanıcı başına izole ortam ve kaynak kotası zorunludur.

**MVP:** Öğretmen paketinden çevrimdışı ödev tanımı ve öğrenci sonuç dosyası içe aktarma; merkezi kimlik ve senkronizasyon sonraki aşama.

## F16 — Dağıtım: Desktop / Web / School

**Desktop:** Tek makinede çevrimdışı laboratuvar, yerel kayıt ve mümkünse isteğe bağlı Gerçek Lab bağlantısı.
**Web:** Tarayıcı simülasyonu; paylaşılan topoloji şeması; güvenli hesaplar yalnız gerektiğinde.
**School:** Web çekirdeği + sınıf/ödev/puan/çok kullanıcılı laboratuvar yönetimi.

**İlke:** Üç ayrı protokol motoru geliştirme. Paylaşılan motor/adaptör sözleşmesi, ortak test senaryoları ve aynı laboratuvar veri biçimi.

## F17 — Packet Tracer uyumluluk yolundaki diğer fikirler

- **Geniş cihaz modelleri:** Model bazlı arayüz/port sayısı ve CLI yetenek profilleri; desteklenmeyen komut için açık hata.
- **Cisco benzeri CLI:** Modlar, yardım, config/show, kalıcılık ve yanlış komut teşhisi; gerçek cihaz sürüm farkları kapsama matrisi.
- **IPv6:** ND, ICMPv6, SLAAC, DHCPv6 ve routing; IPv4'ten ayrı test matrisi.
- **ACL/NAT:** Sıralı kural eşleme, paket düşme nedeni, NAT oturum bilgisi; Packet Detective kanıtı.
- **Kablosuz:** AP, SSID, güvenlik ve istemci roaming'in eğitim temsili; WPA gerçek kriptografisi ancak yetkin motorla.
- **Gerçek cihaz bağlantısı:** Yetkili erişim, imaj/lisans koşulları, ayrı güvenlik sınırları ve varsayılan salt-okunur önizleme.
- **Çok kullanıcılı gerçek lab:** Kullanıcı başına Containerlab/FRR oturumu, snapshot izolasyonu, CPU/RAM kotası, TTL, güvenli cleanup.

## Her fikir için standart kabul kontrol listesi

1. En az bir somut öğrenci/öğretmen kullanıcı hikâyesi ve arayüz akışı.
2. Desteklenen ağ motoru yeteneklerinin doğrulanması; simülasyon/gerçek lab ayrımı.
3. Başarılı ve başarısız örnek topoloji, otomatik regresyon ve deterministik rubrik.
4. Güvenlik ve kişisel veri etkisi, lisans ve üçüncü taraf bağımlılıkları.
5. Çevrimdışı sürüm üzerindeki etkisi, performans ve kaynak bütçesi.
6. 40 mevcut Akademi laboratuvarına ve Paket Dedektifi'ne regresyon yaratmaması.
7. Kullanıcı onayı olmadan PR merge yok; fikirlerin burada belgelenmesi otomatik geliştirme izni anlamına gelmez.
