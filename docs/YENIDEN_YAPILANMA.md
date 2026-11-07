# AğLab yeniden yapılanma planı

> Durum: 1. adım birleşti (#43); 2. adım bu PR'da. Sonraki adımlar ayrı PR'lar
> olarak gelir; her biri kendi testleriyle doğrulanır ve kullanıcı onayıyla birleştirilir.

## Neden

İnceleme sırasında görülen yapısal sorunlar:

1. **Çekirdek motor yalnızca HTML'nin içindeydi.** `findPath`, `routeLookup`, CLI,
   çizim ve kalıcılık (~1.300 satır, ~390 KB JS) hiçbir kaynak dosyada yoktu.
   `simulator/` modülleri bunun etrafına enjekte ediliyordu.
2. **HTML aynı anda derlemenin girdisi ve çıktısıydı.** `build_simulator.py`
   dosyayı okuyup metin değiştirerek yamalıyor ve üzerine yazıyordu. Bu yüzden
   commit edilmiş HTML çoğu zaman derlenmiş sürümle eşleşmiyordu.
3. **Üç ayrı motor** (kendi simülatör, borck-netsim, FRR Gerçek Lab) aynı
   kavramları farklı modellerle çözüyor; her yeni özellikte "doğrunun kaynağı
   hangisi?" sorusu doğuyor.
4. Kod tek satıra sıkıştırılmış yazılmış; insan için okunması, diff incelemesi ve
   hata ayıklaması zor.

## Hedef mimari

```
src/
  index.html            sayfa iskeleti
  styles/ data/          CSS ve ders verisi
  engine/                (hedef) saf, DOM'suz tek ağ motoru
    topology  l2  arp  ip  routing  icmp  dhcp  acl/nat ...
  cli/                   (hedef) IOS-benzeri komut ayrıştırıcı → engine API
  ui/                    (hedef) çizim, paneller, Akademi arayüzü
tools/build_html.py      tek derleyici → AgLab_Final_PKT_Import.html
tests/                   (hedef) ortak fixture'lı Python/Playwright ve Node testleri
real-lab/                FRR referans laboratuvarı (motoru doğrulayan "kâhin")
```

### "Tek motor" ne demek

FRR gerçek Linux yönlendirme yazılımıdır ve tarayıcıda çalışamaz. Bu yüzden:

- **Tarayıcıda tek motor olacak:** mevcut AğLab motoru gövdedir. borck-netsim'in
  daha olgun olduğu parçalar (ör. conntrack/firewall modeli) parite testleriyle bu
  motora taşınır, ardından ikinci motor ve motor seçici kaldırılır.
- **FRR referans olarak kalır:** aynı ortak JSON topolojisi hem tarayıcı motorunda
  hem FRR/containerlab'da çalıştırılır; rota tabloları ve ping/traceroute sonuçları
  karşılaştırılır (fark testi). Fark çıkarsa motor düzeltilir veya sınır belgelenir.

## Adımlar (her biri ayrı PR)

1. **Kaynağı HTML'den çıkar** *(tamamlandı)*: tüm inline JS/CSS/JSON `src/` altında;
   `tools/build_html.py` tek derleyici; çıktı önceki derlemeyle bayt bayt aynı;
   metin-değiştirme yamaları kaynağa işlendi; CI `--check` ile bayat HTML'yi reddeder.
2. **Okunabilirlik ve test düzeni** *(bu PR)*: JS kaynakları Prettier, test/araç
   Python dosyaları Black ile biçimlendi; davranışın değişmediği
   `tools/js_equivalence.cjs` (esbuild ile AST eşdeğerliği) ve tüm testlerle
   kanıtlandı. Testler `tests/` ve `tests/node/` altında; sabit `/mnt/data` ve
   `/usr/bin/chromium` yolları yerine `tests/aglab_test_support.py`; test listesi
   `run_pipeline.py` içinde keşifle toplanıyor. CSS ve `academy/student-data.js`
   bilinçli olarak biçimlenmedi.
3. **Motor API'si** *(sürüyor)*: ilk dilimler hazır — `src/engine/ipv4.js`,
   `topology.js`, `routing.js` (LPM, AD, özyinelemeli next-hop), `stp.js`, `acl.js`;
   Node'da `tests/node/test_engine_*.cjs` ile tarayıcısız test ediliyor. Kalanlar:
   L2 iletim/MAC tablosu, ARP, ICMP/ping/traceroute yolu, NAT, DHCP, ardından
   simülatör durumunun (devices/links) motora taşınması.
   Hedef: `main.js` içindeki topoloji modeli, L2/ARP/IP/routing/ICMP
   mantığı DOM'dan ayrılıp `src/engine/` altına saf modüller olarak çıkarılır;
   Node'da tarayıcısız test edilebilir hale gelir. CLI bu API'yi çağırır.
4. **borck-netsim'in emilmesi:** mevcut parite testleri genişletilir; üstün
   parçalar motora taşınır; ikinci motor, motor yöneticisi ve ilgili UI kaldırılır.
5. **FRR fark testleri:** `real-lab/` ortak JSON → FRR çevirisi kullanılarak
   motor ile FRR sonuçları otomatik karşılaştırılır (CI'da ayrı, isteğe bağlı iş).
6. **Belge sadeleştirme:** `docs/` altındaki örtüşen raporlar tek mimari belgesi
   ve tek uyumluluk matrisi altında birleştirilir.

## Değişmeyecekler

- 40 Akademi laboratuvarı ve kaynak SHA256 kayıtları
- `.pkt` içe aktarma ve özgün arşivi geri yükleme mekanizması
- Tek dosya, çevrimdışı çalışan HTML dağıtımı
- "Desteklenmeyeni çalışıyormuş gibi gösterme" ilkesi
