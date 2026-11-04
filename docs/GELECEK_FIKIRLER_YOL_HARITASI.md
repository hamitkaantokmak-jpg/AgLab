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
