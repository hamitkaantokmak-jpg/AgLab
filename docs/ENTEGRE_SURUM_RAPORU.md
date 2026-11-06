# AğLab Unified RC1 — entegrasyon raporu

Bu dosya sürüm adayı hazırlığıdır; git etiketi veya resmî release değildir.
`main` dalına birleştirme kullanıcı onayı gerektirir. Entegrasyon PR’ı taslak kalır.

## Kaynak ve geçmiş

| Kaynak | Sabit commit |
|---|---|
| `main` başlangıcı | `606e2e5dd30229bdc1bc8ae3ece571ca8cf3aa71` |
| PR #37 — Codex | `524f80951643ce257d267deb0646d7b861553155` |
| PR #38 — Akademi/UX | `0f4a89111e14ccf2145631901ba500a65938ab62` |
| İki geliştirme dalının ortak atası | `476613ca685c57ac8530ce533e6fe6f341da8014` |
| PR #38 UI regresyon düzeltmesi | `939d72a1c1a248267a9e54b9229ff2e605e218fe` |

`integration/aglab-unified-release-candidate` güncel main’den ayrı worktree’de
oluşturuldu. Codex geçmişi gerçek `--no-ff` merge (`e344a66`), UX geçmişi ve onun
ayrı çalışma kopyasında doğrulanan test düzeltmesi ikinci gerçek merge (`0700161`)
ile korundu. Cherry-pick, force-push veya kaynak dal silme yapılmadı. Kaynak PR’lar
ve main değiştirilmedi. Kaynak PR #38’in eski CI sonucu ayrıca düzeltilmiş sayılmaz;
düzeltme entegrasyon geçmişindedir.

Ortak atadan sonraki tek ortak değişen dosya `simulator/packet-detective-ui.js` idi.
Git iki tarafı otomatik birleştirdi; metinsel conflict marker oluşmadı. Aşağıdaki
davranış ve derleme çakışmaları ayrıca gerçek Chromium testleriyle düzeltildi.

## Hatalar ve güvenli düzeltmeler

1. **PR #38 CI hatası:** [42206955028](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42206955028)
   içindeki `test_aglab_ui.py`, boş teknik `<pre>` için görünür yükseklik bekliyordu.
   Yerelde aynı hata yeniden üretildi. Boş durum korunur; görünümün `hidden` özelliği
   ayrıca sınanır. Gerçek simülatör pingi ve olay yenileme sonrası teknik içerik
   görünür olmalıdır; basit/teknik geçişte aynı kaydın korunduğu kontrol edilir.
2. **Rehber cihazları görmüyordu:** motor `PC/Switch`, rehber `pc/switch` karşılaştırıyordu.
   Yeni öğrenci Chromium testi önce ilk PC adımında başarısız oldu; türler düzeltildi.
3. **Eski ping kanıtı:** arayüz shutdown, port/VLAN ve cihaz güç durumu eski fingerprint’te
   yoktu. Ağ durumunun canonical fingerprint’i kullanılır; gerçek ping ilgili PC çiftiyle
   saklanır. Arayüz değiştiğinde açık rehber yeniden hesaplanır; eski başarı kalmaz.
4. **Olay inceleme:** yalnız olay bulunması artık inceleme sayılmaz. Öğrenci mevcut
   Dedektif’te rehber pinginin aynı simülasyon kaydını açmalıdır. NetSim ve native rapor
   kaynakları ayrıdır; rehberin JS ping adımı yerine kullanılamaz.
5. **Yedek doğrulama:** indirme düğmesine basılması diske yazma kanıtı sayılmaz. Öğrenci
   indirdiği JSON’u rehberde salt okunur doğrular; mevcut çalışma değiştirilmez. Dosya
   mevcut topoloji, oturum ve varsa özgün PKT arşiviyle eşleşmelidir; şema dışı alanlar
   kabul edilmez. Bu sınır için önce başarısız olan ek dosya testi düzeltildi. Hatalı dosya reddedilir, rehber kapanıp açılınca
   geçerli oturum kanıtı korunur. Sayfa yenilendiğinde ağ yüklenir; ping/inceleme kanıtı
   uydurulmaz, yeniden yapılır. Dosya üst sınırı 2 MB’dir; büyük dosya yedeği silinmez.
6. **Offline HTML:** birleşen kaynaklar yeniden derlendi. Codex motor/rapor modülleri
   ve UX/Rehber/Dedektif aynı offline çıktıda bulunur; CI byte eşitliği kapısı korunur.
7. **Motor kapsamı:** Akademi seçimi yalnız seçimdir. Salt okunur kapsam notu tüm
   görevleri tarayıcı simülasyonu olarak tanımlar; AGL-024 için Linux bridge, AGL-034/035
   için FRR native arıza/onarım kanıtını ayırır. Diğer görevlerin tamamına native başarı
   atfedilmez. ACL/NAT ayrı operatör örnekleridir. Yeni native komut/API yetkisi eklenmedi.

## Test kapsamı ve sürüm kapısı

- Korunan Python/Node/Chromium, PKT, grading, JSON persistence, motor ve paket testleri.
- Yeni `test_aglab_unified_rc.py`: gerçek ekleme/kablolama/CLI; eksik bağlantı,
  aynı IP, farklı subnet, shutdown ve onarım; olay inceleme; gerçek indirme, dosya
  okuma, hatalı yedek, reload/import; kapsam notunun topolojiyi değiştirmemesi.
- Korunan Akademi testi 40 özgün görevde başlangıç/çözüm/bozuk iletim/reset ve grading
  kontrollerini çalıştırır. Öğrenci journey testi ipucu, cevap, not ve başarı geçmişini
  yeni browser process’inde sürdürür; reset başarı geçmişini silmez. İptal ve JSON
  yedek alma mevcut çalışmayı korur.
- Rehber, input etiketleri ve klavye odağı 390/1280 genişlik ve %200 CSS zoom ile;
  mevcut senaryo testleri iki tema, erişilebilir isimler, odak ve kritik kontrastla
  sınanır. Bunlar otomatik kontrollerdir; tam WCAG 2.2 AA veya screen-reader kullanıcı
  araştırması iddiası değildir. Browser menüsünden zoom ve insan NVDA/VoiceOver testi
  ayrıca yapılmadı; performans ölçümündeki pinch zoom ile CSS reflow testi ayrıdır.
- Native zorunlu işler: Linux L2, ortak VLAN/AGL-024, statik router/AGL-034/035,
  OSPF/BGP policy, IPv6/multi-area, nftables ACL, SNAT/PAT ve öğrenci Docker yalıtımı.
  Kaynak dosyasının varlığı başarı değildir; entegrasyon PR’ının gerçek CI JSON/log
  sonuçlarıyla ayrıca doğrulanır. Native deneysel özetleme başarılı koşuya eklenmez.

**Doğrulama kaydı:** `10ecfbd161af4a1781649d28078910ca2c48e82f` entegrasyonunda
[genel CI 67/67](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42211253122)
ve [native CI sekiz iş](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42211253214)
başarılıdır. Yerel tam pipeline da 67/67 geçti. Sonraki yedek şeması/PKT arşivi
sınır düzeltmesi önce başarısız, sonra başarılı gerçek Chromium testiyle doğrulandı.
Klavye ile Akademi başlatma/iptal ve odağın geri dönüşü de sınanır.

Sürüm adayı **AgLab-Unified-RC1** olarak hazırlanır. Son başın zorunlu genel/native
CI kapıları ve indirilen paket doğrulaması ayrıca teslimde esas alınır; ilk başarılı
commit, sonraki değişikliklerin otomatik doğrulandığı anlamına gelmez. Güncel başın
kontrolleri [taslak entegrasyon PR #39](https://github.com/hamitkaantokmak-jpg/AgLab/pull/39)
üzerindedir. Release/tag/main merge yapılmadı.

## Performans tanı ölçümü

`test_aglab_unified_performance.py` 10/50/100/250 cihaz için gerçek UI ekleme, sürükleme,
kablo ekleme, CLI, panel, Dedektif ve heap ölçer. İlk yerel Chromium 156.0.8078.4
ölçümü aşağıdadır (ms, yaklaşık; her boyutta tek örnek):

| Cihaz | Açılış | Import | Cihaz ekle | Sürükle | Kablo ekle | CLI aç | Panel turu | Dedektif | Heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 247 | 117 | 88 | 143 | 62 | 120 | 225 | 949 | 4.36 |
| 50 | 226 | 106 | 106 | 178 | 83 | 135 | 213 | 946 | 4.54 |
| 100 | 226 | 93 | 123 | 205 | 83 | 142 | 262 | 950 | 4.64 |
| 250 | 213 | 169 | 148 | 397 | 121 | 214 | 251 | 954 | 4.84 |

Duvar saati UI ölçümleri Playwright, kaydırma ve iki animation frame maliyetini içerir;
çıplak render/engine CPU ölçümü değildir. Heap tüm sayfanın GC sonrası retained heap’idir.
Browser pinch zoom 2x çalıştı; uygulamaya canvas zoom özelliği eklenmedi. Farklı
makine/koşular karşılaştırılmadı; performans kazanımı veya istatistiksel üstünlük
iddiası yoktur. Güncel ham ölçüm `unified-rc-performance.json` CI artefaktında ve
öğrenci ZIP’indedir. İlk fixture’de eksik VLAN1 port tanımı nedeniyle gerçek ping
başarısız oldu; fixture explicit access VLAN1 ile düzeltildi, motor gevşetilmedi.

## Dağıtım, güvenlik ve bilinen sınırlar

Öğrenci ZIP’i offline HTML, öğrenciye açık 40 görev, kullanım belgeleri, test/ölçüm
kanıtları ve kamuya açık sentetik native örneklerini içerir. Öğretmen `academy/source`
ve `academy/teacher` dosyaları yalnız ayrı öğretmen ZIP’indedir. Gerçek anahtar,
operatöre özel host mount/config veya yönetici/Docker erişim bilgisi pakete eklenmez.
Bu rapor iki pakete de konur. SHA256/CRC, manifest, HTML/modül byte eşitliği ve 40
kaynak hash’i paket kapısında doğrulanır. Paketler yalnız zorunlu testlerden sonra
RC olarak kabul edilebilir; CI’dan indirilen dosyalar ayrıca doğrulanmalıdır.

Gerçek Lab ayrı Linux ortamıdır; browser içinde FRR/kernel çalıştırılmaz. Salt okunur
öğrenci tanı servisi korunur. Raporlar güvenilmeyen metin/veridir, PCAP veya kimliği
kanıtlanmış kayıt sayılmaz. JS, MIT NetSim, adaptör tanısı ve native Lab kaynakları
ayrı etiketlenir. Sıfır olayda paket uydurulmaz.

DHCP/relay, DNS native entegrasyonu, RSTP/LACP ve yeni ileri BGP kapsamı tamamlanmış
sayılmaz. Önceki OSPF özetleme SIGSEGV deneyi korunur; mevcut FRR imajı ve varsayılan
motor değiştirilmedi. Bu tur yeni ağ protokolü eklemedi.
