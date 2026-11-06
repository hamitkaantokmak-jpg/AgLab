# AğLab — Öğrenci Deneyimi ve Akademi İncelemesi (ilk tur)

**Tarih:** 6 Kasım 2026 · **İncelenen kaynak SHA:** `476613ca685c57ac8530ce533e6fe6f341da8014` · **Çalışma dalı:** `docs/ux-academy-audit-20261106`

> **Kanıt seviyesi:** Bu turda GitHub üzerinden kaynak/dokümantasyon incelemesi gerçekleştirildi. Gerçek tarayıcıda kullanıcı etkileşim testi yapılmadı. Aşağıdaki “risk” kayıtları gözlemlenmiş hata değildir; önerilen doğrulama görevleridir. Hiçbir motor/UI/Academy uygulama dosyası değiştirilmedi, yalnızca bu belge oluşturuldu. Codex'in PR #37 dalı ayrı tutuldu.

## 1. İncelenen kaynaklar ve mevcut güçlü taraflar

- `AKADEMI.md`: 40 laboratuvar, başlat/sıfırla uyarısı, JSON dışa aktarma, aynı tarayıcıda kaldığı yerden devam, puan yeniden hesaplama, ipuçları, öğrenci/öğretmen paket sınırları.
- `academy/academy.js`: laboratuvar seçimi, başlat, sıfırla, ilerleme, kavramsal cevaplar, kontrol, sıradaki ipucu; `role=status` ve `aria-live` bulunan sonuç alanı.
- `academy/ADAPTATION.md`: AGL-001–040 içerik uyarlamaları, 40 kaynak özetinin korunması, VLAN/trunk, IPv4, ARP, routing, negatif probe için tutucu sağlık kontrolü ve Chromium kapsamı.
- `simulator/device-cli.js`: cihaza tıklayarak açılan, klavye ile yönetilebilen ve Esc ile kapanan bağlamsal CLI; pencere boyutları ve odak geri dönüşü için önlemler.
- `simulator/packet-detective-ui.js`: son gerçek simülasyon olayları, ARP/ICMP/iletim/kayıp filtreleri, adım adım gezinme, olası sorun açıklaması, ilgili cihaza gitme, NetSim olayını ayrı kaynak etiketiyle gösterme.
- `docs/ORTAK_MOTOR.md`: erişilebilir etiket, odak, kontrast, görünür senaryo paneli ve sınırlı Chromium doğrulaması; tam ekran okuyucu testi yapılmadığı açık.
- `README.md`: depodaki önceden üretilmiş HTML güncel olmayabilir; güncel özellikler için CI paketinin veya kaynak derlemesinin kullanılması gerektiği belirtiliyor.

**Mevcut olanı eksik saymama kuralı:** Paket Dedektifi'nde filtre ve adımlama, Akademi'de ipucu ve ilerleme koruma, cihaz odaklı CLI ve temel erişilebilirlik iyileştirmeleri mevcuttur. Yeni öneriler bunların anlaşılabilirliği, keşfedilebilirliği ve öğrenci akışı üzerine kurulacaktır.

## 2. İlk 15 dakika — öğrenci yolculuğu denetim senaryosu

| Adım | Öğrenci amacı | Kontrol edilecek davranış | Kanıt durumu |
|---|---|---|---|
| 1 | Güncel sürümü aç | CI ZIP içindeki HTML'yi aç; sürüm/başlangıç ekranı anlaşılır mı | Tarayıcıda doğrulanmadı |
| 2 | Serbest labı bul | Ana Lab alanına erişim ve boş çalışma alanı | Tarayıcıda doğrulanmadı |
| 3 | 2 PC + 1 switch ekle | Cihaz kategorileri, ekleme, sürükleme ve adlandırma | Tarayıcıda doğrulanmadı |
| 4 | Portlardan bağla | Kablo modu, port seçimi ve yanlış bağlantı açıklaması | Dokümanda kablo modu var; UX doğrulanmadı |
| 5 | IP ver | PC yapılandırması ve alanların anlamlı etiketlenmesi | Tarayıcıda doğrulanmadı |
| 6 | Ping gönder | CLI penceresi veya mevcut test kontrolü üzerinden ping | Cihaz CLI akışı kaynakta mevcut; UX doğrulanmadı |
| 7 | Başarısızlığı anla | Hata mesajı, hangi cihazda sorun olduğu ve çözüm ipucu | Paket Dedektifi tanı metni kaynakta mevcut |
| 8 | Paketleri incele | Önce test, sonra yenile, filtre, ileri/geri, ilgili cihaza git | Paket Dedektifi kaynakta mevcut; keşfedilebilirlik doğrulanmadı |
| 9 | Kaydet/yükle | JSON dışa/içe aktarma, veri kaybı ve sürüm uyarısı | Akademi dokümanında aktarım mevcut |
| 10 | Akademi'ye geç | Laboratuvar seçme/başlatma, önceki topolojinin korunması | Başlat/sıfırla uyarısı ve JSON dışa aktarma mevcut |

**Gözlem taslağı:** Her işlem için başarı, hata sayısı, toplam tıklama, ilk başarılı sonuca süre, yanlış anlaşılmış etiket, yardım ihtiyacı, klavye ile tamamlama, 1366×768 / 1920×1080 ve %200 zoom sonuçları ayrı kaydedilmeli. Bu veriler henüz ölçülmedi.

## 3. Önceliklendirilmiş 10 UX riski / inceleme sorusu

Aşağıdaki kayıtlar **doğrulanacak hipotezdir; tespit edilmiş yazılım hatası değildir**.

| ID | Öncelik | Risk / soru | Mevcut kanıt | Önerilen çözüm | Maliyet | Kabul testi |
|---|---|---|---|---|---|---|
| UX-01 | P1 | İlk açılışta öğrenci nereden başlayacağını bilemeyebilir | README akış açıklıyor, uygulama başlangıcı görülmedi | “İlk laboratuvarını kur” isteğe bağlı rehber kartı | Orta | Yeni kullanıcı 2 PC+switch görevini yardımsız başlatır |
| UX-02 | P1 | Akademi “başlat” mevcut topolojiyi değiştirdiğinde uyarı yeterince fark edilmeyebilir | `AKADEMI.md` ve `academy.js` metinsel uyarı içeriyor | Veriyi koru / JSON dışa aktar / devam et karar ekranı | Düşük–Orta | Kaydedilmemiş çalışma açıkken yanlışlıkla silinmez |
| UX-03 | P1 | Paket Dedektifi boşken “önce ping, sonra Son olayları göster” ilişkisi atlanabilir | Kaynak yardım metni mevcut; keşfedilebilirlik belirsiz | Olay yok durumunda tek adımlı kılavuz ve CLI'ye odak bağlantısı | Düşük | İlk kullanıcı paket olayını kendi başına bulur |
| UX-04 | P1 | CLI modları, cihaz seçimi ve komut giriş yeri acemi kullanıcıya karışık gelebilir | Bağlamsal pencere ve klavye desteği var | Komut örnekleri, mod etiketi ve hata sonrası kısa yardım | Orta | İlk ping ve basit interface komutu anlaşılır |
| UX-05 | P1 | “Çözümümü kontrol et” sonucu neden puan alınmadığını yeterince eyleme dönüştürmeyebilir | Durum alanı var; gerçek sonuç ekranı görülmedi | Her başarısız ölçüte “ne kontrol etmeliyim?” ipucu bağlantısı | Orta | Öğrenci başarısız kriteri doğru cihazla eşler |
| UX-06 | P2 | 40 görevin uzun tek seçim kutusunda bulunabilirliği düşük olabilir | `academy.js`: `select` için 40 kayıt ekleniyor | Konu/zorluk/süre filtreleri, arama ve öğrenme yolu | Orta | Öğrenci hedef konuyu kısa sürede bulur |
| UX-07 | P2 | Cihaz/bağlantı kalabalığı büyük topolojide okunabilirliği azaltabilir | Büyük topoloji araçlarının tamamı incelenmedi | Önce mevcut zoom, grid, hizalama, mini harita envanteri; yalnız eksikleri tasarla | Orta–Yüksek | 50 cihazda hedef cihaz hızlı bulunur |
| UX-08 | P2 | Paket Dedektifi ham olay metni başlangıç seviyesini zorlayabilir | `pre` ham kayıt ve açıklama mevcut | “Basit / Ayrıntılı” katmanları; veri kaynağı korunur | Düşük–Orta | Başlangıç öğrencisi ARP–ICMP farkını açıklar |
| UX-09 | P2 | İlerleme kaydının aynı tarayıcı profiline bağımlılığı fark edilmeyebilir | `AKADEMI.md` yerel profil, JSON, puan geçmişi sınırını açıklıyor | İlk kayıtta “bu cihazda tutulur” bilgilendirmesi ve dışa aktar hatırlatıcısı | Düşük | Farklı tarayıcıda devam etme beklentisi yanlış oluşmaz |
| UX-10 | P2 | Ekran okuyucu/zoom ve klavye ile tam kullanım kapsamı sınırlı olabilir | `ORTAK_MOTOR.md` tam ekran okuyucu testi olmadığını belirtiyor | NVDA/VoiceOver, %200 zoom, odak/etiket senaryosu | Orta | Kritik akış klavye ve ekran okuyucuyla tamamlanır |

**P0 mevcut raporda saptanmadı.** Tarayıcı testi olmadan kritik arıza ilan etmek doğru olmaz.

## 4. İlk 5 iyileştirmenin uygulanabilir tasarımları

### D1 — Rehberli Başlangıç (UX-01)
- Başlangıç kartı: “Serbest Lab”, “İlk bağlantımı kur”, “Akademi'den devam et”.
- 9 adımlı isteğe bağlı akış: çalışma alanı → PC1 → switch → PC2 → kablo → IP → ping → Paket Dedektifi → kaydet.
- Rehber yalnız UI adımlarını izler; protokol motoruna müdahale etmez. Kullanıcı çıkabilir, ilerleme aynı cihazda hatırlanır.
- İlk sürüm kriteri: yeni öğrencinin ping sonucuna ulaşmasını ölç; doğrulanmadan otomatik başarılı rozet verme.

### D2 — Akademi güvenli başlat/sıfırla (UX-02)
- Aktif laboratuvar veya değiştirilmiş topoloji varsa karar: “Önce dışa aktar”, “İptal”, “Yeni göreve geç”.
- Mevcut uyarı metnini kaldırmadan, gerçek çalışma kaybı riski olan durumlarda daha belirgin hale getir.
- Sıfırlama yalnız etkin denemeyi temizler; geçmiş en iyi puan korunur. Mevcut davranışa regresyon testi.

### D3 — Paket Dedektifi ilk kullanım kartı (UX-03)
- Olay yok durumunda: “1. Cihazı seç → 2. CLI'den ping çalıştır → 3. Son olayları göster”.
- “CLI'yi aç” bağlamsal geçiş; cihaz seçilmemişse güvenli seçim ekranı.
- Motorun veri sağlamadığı alan için sahte paket üretme. NetSim “wire notification” gerçek PCAP değildir.

### D4 — CLI başlangıç yardımı (UX-04)
- Seçilen cihaz ve komut modu her zaman görünür; yardım düğmesinden birkaç örnek komut.
- Hatalı komutta mevcut motor hata çıktısını koru; açıklamayı ayrı bilgi kutusunda ver.
- Kullanıcının yazdığı komut cihaz değiştirince yanlış cihaza gönderilmez; mevcut koruma devam eder.

### D5 — Anlaşılır değerlendirme geri bildirimi (UX-05)
- Mevcut rubriği değiştirmeden üç satır: “Hedef”, “Bulunan durum”, “Önerilen kontrol”.
- Öğretmen çözümünü öğrenci paketine kopyalama; ipuçları önceden onaylı öğrenci verisi ve gerçek motor kanıtlarından türetilir.
- `incomplete/not_evaluated/error` durumlarını “0 puanlık yanlış cevap” gibi sunma; mevcut ayrım korunur.

## 5. Akademi — 40 laboratuvar kalite planı

Mevcut içerik grupları `academy/ADAPTATION.md` temel alınarak:

| Grup | Kapsam | Öğrenci kalite incelemesi |
|---|---|---|
| AGL-001–005 | İlk temel görevler | Açıklama netliği, ilk görev süresi, CLI başlangıcı, uyarılar |
| AGL-006–010 | Fiziksel bağ, ICMP, ARP ve yerel arızalar | Hata senaryosu açıklaması, kavram–paket olayı ayrımı |
| AGL-011–020 | IPv4, subnetting, VLSM | Cevap biçimi örnekleri, CIDR/host hesabı geri bildirimi |
| AGL-021–030 | MAC, VLAN, 802.1Q trunk | Native/allowed VLAN ayrımı, negatif probe için topoloji sağlık açıklaması |
| AGL-031–040 | Routing, dönüş yolu, next-hop, LPM, 3-router sorun giderme | Route kontrolü, kaynak arayüz sınırlamaları, statik rota geri bildirimi |

Her görev için kontrol formu: ID/başlık, hedef kazanım, önkoşul, tahmini süre, topoloji okunabilirliği, görev metni, kontrol komutları, başlangıç başarısızlığı, çözüm başarısı, yanlış konfigürasyon reddi, kaydet/geri yükle, ipucu sırası, puan/rubrik, öğretmen verisi sızıntısı, açıklanan motor sınırları.

**Gerçek kod/test bulgusu:** `academy/ADAPTATION.md` 40 görevin kapsamlı Chromium kontrollerini ve kaynak bütünlüğünü belgeliyor; bu, öğrenci görev metinlerinin pedagojik olarak kullanıcılarla doğrulandığı anlamına gelmiyor.

**İlk içerik sprint önerisi:** AGL-001, 007, 011, 024 ve 040 için 5 farklı zorluk türünde görev incelemesi. Ölçüt: öğrencinin görevi okuyup hedefi doğru tarif etmesi ve sonuç geri bildirimini yorumlayabilmesi.

## 6. CCNA / CCNP öğrenme yolları — ilk taslak

Bu taslak **resmî Cisco sınav alanlarıyla henüz doğrulanmış değildir**; yayına alınmadan önce güncel Cisco blueprint'iyle sürümlü eşleştirme gerekir.

1. **Başlangıç / Ağ Temelleri:** Cihazlar, OSI/TCP-IP, Ethernet, MAC, IPv4, subnetting, ARP, ICMP, CLI. Mevcut AGL-001–020 laboratuvarları başlangıç havuzu.
2. **CCNA Switching:** VLAN/access/trunk/native/allowed list, STP ve EtherChannel. Mevcut AGL-021–030 havuzu; STP ve EtherChannel laboratuvarı ancak motor yetenek testi sonrası.
3. **CCNA Routing & Services:** Static route, default route, OSPF temelleri, DHCP, NAT, ACL, IPv6/WLAN. Mevcut AGL-031–040 static routing havuzu; diğer protokoller için doğrulanmış senaryo gereklidir.
4. **CCNA Troubleshooting:** Arızalı topolojiler, komutla doğrulama, Paket Dedektifi olay kanıtı, kontrollü rubrik.
5. **CCNP Enterprise ileri seviye:** OSPF gelişmiş konular, BGP, redistribution, filtering, yüksek erişilebilirlik, otomasyon. Gerçek FRRouting/Containerlab laboratuvarlarıyla ayrı kapsam etiketi; çevrimdışı HTML'de tam protokol desteği varsayılmamalı.

**Öğrenme yolu ekran taslağı:** “Öğren → Uygula → Hata çöz → Kendini değerlendir”; her kartta süre, seviye, önkoşul, desteklenen motor, ilerleme ve son başarının kaynağı. Uygulama için öğrenci/öğretmen rol ayrımı korunmalı.

## 7. Öğretmen iş akışı — ilk taslak

Çevrimdışı ilk sürüm: öğretmen laboratuvar paketini hazırlar → öğrenci kendi bilgisayarında açar → öğrenci sonuç JSON'unu dışa aktarır → öğretmen kontrollü içe aktararak değerlendirme raporu üretir.

Mevcut öğrenci paketindeki `expected` rubrik değerleri geliştirici araçlarından görülebilir; bu nedenle çevrimdışı istemci **güvenli sınav** kabul edilmemelidir. Merkezi, güvenli sınav için ileride sunucu taraflı değerlendirme ve kimlik/rol altyapısı gerekir.

## 8. Erişilebilirlik ve performans doğrulama planı

- 1366×768 ve 1920×1080; %100/%200 zoom; dar pencerede CLI modalinin görünür olup olmadığı.
- Yalnız klavyeyle Lab → cihaz → CLI → ping → Paket Dedektifi → Akademi → kontrol.
- En az bir Windows NVDA ve macOS VoiceOver oturumu; sekme sırası, odak geri dönüşü, canlı duyurular, hata alanı adları.
- 10/50/100 cihazlı topolojide arayüz çizimi, tıklama gecikmesi, büyük CLI çıktısında kaydırma; mevcut motor mikro benchmark'ları tarayıcı UI hızını kanıtlamaz.
- Paket Dedektifi olay listesi uzunken okunabilirlik, filtre durumu ve son/önceki adım uyarıları.
- Kullanıcı akışları videolu/ekran görüntülü kanıtla raporlanmalı; bu turda böyle kanıt toplanmadı.

## 9. Uygulama sırası ve sınırlar

**Sprint UX-A (önce doğrulama):** 5 öğrenci görevi, AGL-001/007/011/024/040, küçük ekran, klavye, kayıt/geri yükleme, Paket Dedektifi ilk kullanım testi.

**Sprint UX-B (bağımsız UI):** D2, D3 ve D4 önerilerini; gerçek sorun doğrulanırsa ayrı UX dalında, yalnız arayüz/Academy dosyalarında, Codex dalıyla çakışmadan hayata geçir. Önce mevcut UI testlerini baz al.

**Sprint UX-C (eğitim):** D1 isteğe bağlı rehber, D5 rubrik geri bildirimi, konuyla filtrelenen Akademi liste tasarımı. Rubrik ve kaynak JSON'larını değiştirmeden ilerle.

**Sprint UX-D (içerik):** Beş temsili lab pedagojik denetimi, CCNA blueprint eşleştirmesi, CCNP/FRR yetenek haritası.

## 10. Kesinlikle yapılmayanlar

- Gerçek tarayıcı/ekran okuyucu testi **yapılmadı**.
- Motor, CLI yürütücüsü, FRR, HTML veya Akademi uygulama kodu **değiştirilmedi**.
- 40 laboratuvarın yeni baştan pedagojik olarak doğrulandığı **iddia edilmez**.
- PR #37 veya başka bir PR **birleştirilmedi**.
- Bu çalışma yalnızca kaynak kanıtına dayalı **ilk denetim ve uygulanabilir tasarım planıdır**.

---

## 11. 6 Kasım 2026 — İkinci kaynak denetimi: Akademi başlatma akışında veri kaybı riski

**Koddan doğrulanan bulgu UX-02 (P1, uygulamada yeniden doğrulanmalı):** `academy/academy.js` içindeki `academyStart()` seçili laboratuvarın `initial_topology` verisini doğrudan `importTopology(...)` ile yüklüyor; hemen ardından `saveTopology(true)` çağrısı yapıyor. Kaynakta bu fonksiyonun içinde ayrı bir kaydedilmemiş çalışma onayı, iptal veya önce dışa aktar eylemi yok. Kullanıcıya `academyNotice` içindeki metinsel uyarı gösteriliyor. Bu nedenle mevcut serbest çalışma alanının üzerine yazılabileceği kod düzeyinde doğrulanmıştır; gerçek tarayıcıda yanlışlıkla veri kaybı henüz gözlenmemiştir.

**İyileştirme sözleşmesi:** Akademi'ye geçmeden önce değiştirilecek topoloji/oturumun varlığı ve kaydedilmemiş düzenleme durumu mevcut veri modeliyle, yalnız gerçek riskte kontrol edilmeli. Öğrenciye iptal, JSON dışa aktar ve yeni laboratuvara geç seçenekleri sunulmalı. Varsayılan iptal hiçbir topoloji/oturum/puan verisini değiştirmemeli; dışa aktar sonrası tercih edilen laboratuvar yüklenebilmeli. Sıfırlama mevcut en iyi puanı silmemeli. Motor veya rubrik değişikliği gerektirmeyen ayrı UX dalında uygulanmalı.

**Açık test senaryoları:**
1. Serbest labda yeni cihaz ekle, Akademi başlatmayı dene; onay verilmeden serbest topoloji korunmalı.
2. İptal de, cihaz/bağlantı sayısı ve Akademi oturumu byte eşit kalmalı.
3. JSON dışa aktar, sonra başlat; dışa alınan çalışma tekrar içe aktarılabilmeli.
4. Etkin Akademi görevinde CLI komutuyla düzenleme yap, başka göreve geç; aynı koruma çalışmalı.
5. Boş veya değişikliksiz çalışma alanında gereksiz uyarı çıkmamalı.
6. Sıfırla, en iyi puanı koru; başlangıç topolojisine dön ve öğrenci/öğretmen paket ayrımı bozulmasın.

**Önemli teknik not:** Bu turda Playwright/Chromium çalıştırılabilecek repo yürütme ortamı kullanılmadığından koruma kodu değiştirilmedi. Kod değişikliğinin test edilmeden üretime yazılması, öğrencinin kaydetme/başlatma akışını bozabileceği için ertelendi.

**Ek kaynak doğrulamaları:** `simulator/packet-detective-ui.js` zaten filtreler, boş durum mesajı ve cihaz işaretleme sunuyor; bunlar eksik değildir. `academy/academy.js` hali hazırda 40 görevi select içine dolduruyor ve ilerleme durumlarını başlıklara ekliyor; arama/kategori filtreleri mevcut alanda görünmüyor. Akademi katalog iyileştirmesi ayrıca incelenmeli.
