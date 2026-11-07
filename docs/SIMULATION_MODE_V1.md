# AğLab 2.0 — Simulation Mode V1

Simulation Mode, mevcut AğLab JS motorunun kaydettiği son işlemin **salt okunur yeniden oynatımıdır**. Realtime aynı ağ/CLI motorunu kullanır. Oynatma ping göndermez, rota hesaplamaz, ARP/FDB veya öğrenci topolojisini değiştirmez. Yeni harici bağımlılık yoktur; tek çevrimdışı HTML ve mevcut SVG kullanılır.

## Kullanım

1. Realtime’da cihazları ekle, kablola ve CLI’den ping/Ethernet testi yap.
2. Topoloji üstündeki **Simulation · İncele** düğmesini seç. **Kaydı al**, mevcut son motor kaydını kopyalar; yeni trafik oluşturmaz. Simulation açıkken yeni CLI ping’i kaydı otomatik yeniler.
3. **İleri** tek olayı seçer/canlandırır. **Oynat**, **Duraklat**, **Başa dön** ve 0.5/1/2/4x hız kayıt üzerinde çalışır; hız gerçek ağ gecikmesi değildir.
4. Olay listesinden bir kayıt seç; ayrıntılarda motorun kaydettiği alanları gör. Liste en fazla 25 satırdır, diğer kayıtlar sayfalanır. ARP/ICMP/tanı filtreleri aynı kaydı süzer.
5. **Paket Dedektifi’nde açıkla** ile aynı kayıt kimliğine geç; Dedektifte **Simulation’da incele** ters yönde çalışır. Başka/eski bir neslin kaydı güncel gibi eşlenmez.

Olaylar tarayıcı belleğinde son işlem için tutulur; JSON dışa aktarmaya ve öğrenci ilerlemesine yazılmaz. Yenileme geçmişi temizler; mevcut Akademi açılış/grading kontrolleri gerçek yeni motor olayları oluşturabilir. Realtime varsayılan açılış modudur.

## Kaynak ve veri sözleşmesi

`ethernet-forwarding.js` eski `ethernetEvents` metin günlüğünü ve 256 sınırını aynen korur. Yanına en fazla **512** zengin gözlem kaydı ekler. `ethernetTraceEvent` yalnız gerçekleşmiş işlemin gözlemidir: gerçek queue çıkışında tel/bağlantı aktarımı; gerçek switch öğrenmesinden sonra öğrenme; mevcut frame/receive/forward/TTL/discard kayıtları. Kaynak alanları nesnelerden kopyalanır; öğrenci/cihaz nesnelerine referans verilmez.

Her kayıt nesil/sıra kimliği, mevcut metin, tür ve mümkünse frame kimliği/başlık bağlamını taşır. `wire` kaydı gerçek gönderen, alıcı ve iki fiziksel portu içerir. Switch iletiminde frame Source MAC değişmez; router yeni Ethernet segmenti üretir. `routed-ethernet.js` motorun kullandığı gerçek IP/TTL/ARP komşu bağlamını gözleme aktarır. `icmp.js` mevcut hata tür/code değerlerini taşır.

`packet-events.js/fromEvidence`, `readEthernetTrace()` ve `aglabEngines.trace()` aynı kopyalanmış/normalize edilmiş kaynağı sunar. Paket Dedektifi ile Simulation bu kaynağı kullanır. Eski normalizer API’si ve metin komutları korunur. Akademi’nin mevcut paket inceleme kanıtı için aynı eski metin izi gönderilir; rubrik veya 40 laboratuvar kaynağı değiştirilmez.

`simulation-playback.js` yalnız immutable kayıt/cursor/hız ve kesin port eşleşmesi sunar. `simulation-ui.js` liste, açıklama ve SVG katmanıdır. Ağ motoru veya CLI yerine geçmez.

## Destek ve dürüst sınırlar

| Alan | V1 davranışı |
|---|---|
| ARP | Gerçek model request/reply ve VLAN/FDB bağlamı; sender/target IP/MAC kaydedildiği kadar |
| ICMP / IPv4 | Gerçek echo request/reply, router TTL azaltması, mevcut Time Exceeded/Unreachable kayıtları |
| Ethernet | Model Source/Destination MAC, mantıksal VLAN, gerçek fiziksel çıkış/giriş portu ve bağlantı aktarımı |
| Başlık alanları | EtherType/ARP operation/ICMP türü modelin gerçekleştirdiği bilinen işlemi tanımlar; ham byte/PCAP serileştirmesi değildir |
| Eksik alan | Açıkça “Motor bu alanı kaydetmedi”; örneğin yerel Echo Reply TTL değeri uydurulmaz |
| Preflight hata | Motor tanısı metin olarak gösterilir; gerçek düşme noktası veya tel hareketi uydurulmaz |
| Kesin discard / TTL expiry | Motorun bildirdiği cihazda kırmızı ×; renk yanında metin durumu bulunur |
| TCP/UDP/DHCP/OSPF/BGP kontrol paketleri | Gerçek wire olayları üretilmediği için canlandırılmaz. Eğitim route modeli olması kontrol paketi desteği değildir |
| MIT NetSim | Mevcut ayrı bildirim kaynağı korunur; bu V1 katmanına aktarılmaz |
| Gerçek Lab | Mevcut imzası doğrulanmayan ayrı JSON raporu korunur; SVG’ye canlı paket gibi eşlenmez |

Çerçeve aktarımı kaydı tek başına hedef IP’ye teslim garantisi değildir. Alıcı/discard/sonuç kayıtları ayrıca okunmalıdır. Olay sırası mantıksal motor sırasıdır; zaman damgası/gerçek kablo gecikmesi ölçümü değildir. Broadcast dalları yalnız kaydedilen gerçek çıkışlara göre tek tek gösterilir; eşzamanlı fiziksel trafik iddiası yoktur.

## Görselleştirme ve tutarlılık

Tek SVG overlay, mevcut `line.pt-edge` geometrisini kullanır; BFS/route sonucu üzerinden yeni yol çıkarmaz. Ters yönlü aktarımda aynı çizginin yönü ters çevrilir. Model konumları/zoom/viewBox değiştiğinde aynı SVG koordinat sistemi kullanılır; mevcut topoloji çizimi her karede yenilenmez. Katman pointer-events:none kalır. Yalnız duraklatılmış tel aktarımında, tüm cihaz kutularından uzakta olan 44px paket seçim hedefi açılır; cihazların üzerinde ve oynatma sırasında bu hedef etkinleşmez. Simgeye tıklama veya Enter/Space ayrıntılara götürür; liste seçimi her zaman kullanılabilir.

Topoloji/port/yapılandırma değişirse eski kayıt durdurulur ve açık uyarı görünür. Cihazın yalnız x/y/boyut geometrisinin değişmesi kaydı geçersiz kılmaz; çizgi yeniden okunur. Yeniden adlandırma gibi konservatif olarak izlenen değişiklikler de yeni kayıt gerektirebilir. Görünüm dışındaki SVG koordinatları zorla ekrana taşınmaz; olay metin olarak incelenebilir. Yeni bir pan/zoom sistemi eklenmemiştir.

Arka plan sekmede veya görünmeyen çalışma alanında RAF durdurulur. Azaltılmış hareket tercihi ve Animasyon anahtarı, metin/olay seçimiyle incelemeyi korur. Mobilde liste açılır/kapanır, ayrıntılar altta, tablo kendi içinde kaydırılır. Tam WCAG veya fiziksel telefon/ekran okuyucu doğrulaması iddia edilmez.

SVG etiketinin metni yalnız değiştiğinde güncellenir. Böylece mevcut isteğe bağlı ilk-ağ rehberinin subtree gözlemcisi her animasyon karesinde gereksiz yere yeniden çizim yapmaz. Bu durum açık rehberli Chromium regresyonuyla ölçülür. Paket açıklaması ve kontrol ipuçları, ayrı bir teşhis motoru yerine ortak `packet-events.js` açıklama/teşhis katmanından gelir; TTL dolması tek başına döngü kanıtı olarak sunulmaz.

## Derleme ve doğrulama

```sh
python build_simulator.py
python build_academy.py
node tests/node/test_simulation_playback.cjs
python tests/test_aglab_simulation_mode.py
python run_pipeline.py
```

Değişiklik sonrası sabit `html-build.sha256` gerçek derleme çıktısından güncellenmelidir; CI iki derleme/cmp ve sabit hash’i denetler. Paket manifesti yeni modülleri ve değişen Ethernet/routed/ICMP gözlem kaynaklarını kapsar. Güncel tek dosya, tüm kapıları geçen CI artifact’inden alınır; eski raw taban HTML son modülleri garanti etmez.

Yeni Chromium testi gerçek add/cable/CLI, başarılı/başarısız ping, VLAN, bir/iki router, TTL, gerçek çizgi geometrisi, sürükleme ve tarayıcı yakınlaştırması, Dedektif bağlantıları, iki Akademi görevi, kayıt/yenileme, 390px dokunma ve reduced-motion akışlarını kapsar. Ağ erişimi kapalı tarayıcı bağlamında çalışır. Performans, mevcut büyük topoloji fixture’ı kullanılarak 10/50/100/250 cihazda ve dört küçük topolojide Realtime/Simulation karşılaştırmasıyla kaydedilir. Tek örnekli süreler tanısaldır; ölçülmeyen FPS veya genel hızlanma yüzdesi iddiası yapılmaz. Gerçek son sonuçlar CI/`simulation-mode-results.json` dosyasındadır; test dosyasının varlığı başarı değildir.
