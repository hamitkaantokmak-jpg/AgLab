# Şube sürümü 1.0 — kontrol listesi ve sürüm notu

`SONRAKI_ISLER.md` 5. adım: Seviye 1 eksiksiz ve yeni arayüzle şubede kullanıma başlanır;
geri bildirim CCNA önceliklerini belirler. Bu belge 1.0'ın neyi içerdiğini, nasıl
doğrulandığını ve neyin bilerek dışarıda kaldığını yazar. Durum: 22 Kasım 2026, #113 ve #114
sonrası.

## Kapsam: Seviye 1 (12 konu, 11 ders kartı)

Konu şablonu `MUFREDAT.md`'dedir. "Kurulum" adım adım yönlendirmeli görev, "arıza" belirtiden
kök nedene giden görevdir (Akademi labı, Labber labı ya da hazır senaryo). Sayılar uygulamanın
kendi görev listesinden alınmıştır (`aglabSimWorkspace.tasksFor`); asgari değerleri
`test_aglab_flow_tasks.py::test_level1_topics_have_setup_and_fault_tasks` denetler.

| # | Konu | Ders | Sınav | Kurulum görevi | Arıza görevi | Not |
|---|---|---|---|---|---|---|
| 1 | Sorun giderme yöntemi | ✓ | 10 soru | — | 6 | Yönlendirmeli labı sağlam ağda kanıt toplamaktır; pratiği arıza senaryoları |
| 2 | IP adresleme ve subnetting | ✓ | 10 | 11 | 6 | |
| 3 | Ethernet, MAC ve ARP | ✓ | 10 | 4 | 7 | |
| 4 | Fiziksel bağlantı | ✓ | 10 | 1 (`fiziksel-kontrol`) | 8 | |
| 5–6 | VLAN ve trunk | ✓ (tek ders) | 10 | 7 | 12 | |
| 7 | VLAN'lar arası yönlendirme | ✓ | 10 | 1 (`roas-kurulum`) | 6 | |
| 8 | Gateway ve statik routing | ✓ | 10 | 7 | 16 | |
| 9 | DHCP | ✓ | 10 | 1 (`dhcp-kurulum`) | 8 | |
| 10 | DNS | ✓ | 10 | 1 (`dns-kurulum`) | 5 | |
| 11 | Cihaz yönetimi ve yedekleme | ✓ | 10 | 1 (`yonetim-vlan`) | 5 | |
| 12 | CDP/LLDP | ✓ | 10 | 1 (`cdp-kesif`) | 5 | |

Her ders `docs/dersler/` altında yedi parçalı (Neden önemli → Kısa sınav) ve şemalıdır;
uygulamada Öğren → Test → Pratik akışıyla açılır.

## Doğrulama

- **Otomatik:** `python tools/run_pipeline.py` (95 denetim) ve CI; her Labber labı başta
  çözülmemiş, referans çözümle çözülmüş (`tests/sim/labs.test.ts`, tarayıcıda
  `test_aglab_labber_labs.py`); Seviye 1 lablarının brief belirtileri açılışta görülür
  (`tests/sim/level1-labs.test.ts`); ders senaryoları başta başarısız, çözümle başarılı
  (`test_aglab_lesson_scenarios.py`).
- **Temiz tarayıcı profili (1280×800):** 11 ders kartının her birinde Öğren, Test ve Pratik
  açıldı; Pratik'ten ilk görev başlatıldı. Sayfa hatası ve konsol hatası yok.
- **Paket:** CI'ın doğruladığı `AgLab_Otomatik_Dogrulanmis_Paket.zip` açıldı; içindeki
  `AgLab_Final_PKT_Import.html` depodakiyle aynı ve çevrimdışı çalışıyor (ağ isteği yok, 25
  Labber labı listeleniyor, lab başlatılıyor).

## Kullanım

Tek dosya: `AgLab_Final_PKT_Import.html` bir tarayıcıda açılır; kurulum, sunucu ya da internet
gerekmez. İlerleme o tarayıcının yerel kaydında tutulur; başka bilgisayara taşımak için
ders ekranındaki "İlerlememi yedekle veya geri yükle" kullanılır. Chromium tabanlı tarayıcıda test edildi.

## Seviye 1'de modellenmeyenler

Bunlar derslerde ve `UYUMLULUK_MATRISI.md`'de yazılıdır; uygulama bunları çalışıyormuş gibi
sunmaz.

- Port hızı/duplex ve hata sayaçları (#4) modellenmez; bağlantı, `shutdown`, güç ve açıklama vardır.
- SSH, kullanıcı/parola ve AAA (#11): komutlar modellenmedi; ders okuma olarak anlatır.
- DNS kayıtları (#10): DNS sunucusu ağdaki cihazları kendi adlarıyla tanır; elle kayıt, kayıt
  türleri ve alan adları yok.
- Günlük: lab açılışında temizlenir, `show logging` yok; belirtiler show çıktısı, ping ve
  istemci komutlarıyla görülür.
- Simülatör gerçek IOS değildir: komut sözdizimi eğitim amaçlı taklittir, çıktıların bazı
  alanları sabittir.

## Personel gözüyle gezinme ve düzeltilenler

Uygulama, ağa arada bir bakan ve CLI'yi az bilen bir şube çalışanı gözüyle 1366×768'de baştan
dolaşıldı. Yanıltıcı ya da engelleyici bulunanlar 1.0'dan önce düzeltildi
(`test_aglab_sube_ui.py`):

- Labber labında inceleme paneli port durumunu lab açılışındaki çizimden okuyordu: kapalı port
  "up / up" görünüyordu. Artık çalışma zamanından gelir (`show interfaces status` ile aynı).
- Router'lar tuvalde ve terminal listesinde "L2 switch" / "Switch" görünüyordu; router portunda
  panel "access, VLAN 1" ve hata veren `switchport` komutu öneriyordu. Artık router olarak,
  adresiyle görünür; L3 switch routed port adresini, adresi olmayan PC "IP yok" gösterir.
- Öğrencinin yolundaki geliştirici dili sadeleşti ("Motor: Labber — … köprü kullanılmaz",
  "IOS/VPCS", "Realtime / Simulation"): ürün metninde motorun adı Simülatör (`SONRAKI_ISLER.md`
  "Adlandırma"), adım adım paket izleme "Adım adım · İncele". Gelişmiş bölümündeki atölyeler
  değişmedi.
- Seviye 1 dersleri IOS kiplerini (`R1>`, `enable`, `configure terminal`) anlatmıyor; terminal
  kullanıcı kipinde açılıyor. Lab ve senaryo açılınca terminal kısa bir "ilk adımlar" satırı
  yazar. Derse ayrı bir CLI bölümü eklemek açık iş (aşağıda).

## Eğitici katman (ipuçları)

Uygulama ilk kez kullanan için kendini anlatır (`src/app/coach.js`, `test_aglab_coach.py`):

- **İlk açılış turu** (4 adım): bölümler, Öğren → Test → Pratik, Simülatör, ipucu ayarı.
- **Simülatörde ilk görev turu** (4 adım): görev ve hedefler, ağ çizimi, terminal, İpucu ve
  Kontrol et.
- **Bağlamsal ipuçları**, ilk karşılaşmada bir kez: ilk Kontrol et, ilk İpucu,
  `% Invalid input` / `% Incomplete command` / `% Ambiguous command`, 169.254 adresi,
  başarısız ping, bulunamayan ad.
- **Terminal kip satırı**: komut satırının altında; istemden kipi (kullanıcı, ayrıcalıklı, genel
  ayar, arayüz, VLAN, DHCP havuzu…, PC/sunucu) ve oradan nasıl çıkılacağını söyler.
- **Komut açıklaması**: 57 IOS ve 10 PC komutu ilk kez yazılınca tek cümleyle açıklanır;
  kısaltmalar tanınır (`sh ip int br`, `conf t`, `no shut`, `do …`).

Her balon "Anladım" (ya da Esc) ile kapanır ve bir daha çıkmaz. Üst çubuktaki 💡 menüsü
ipuçlarını kapatır/açar, turu yeniden başlatır ve gösterilenleri sıfırlar. Durum o tarayıcıda
`aglab-coach-v1` kaydında tutulur. Otomasyon altında (Playwright) katman kapalıdır; testler
`aglab-coach-force` ile açar.

## Bilinen gözlemler (1.0'ı engellemez)

- Seviye 1'de CLI temelleri bir ders parçası olarak yok (kipler, `?`, Tab, `do show`, `end`).
  Terminaldeki ilk adımlar satırı, kip satırı ve komut açıklamaları bunu pratikte karşılıyor;
  ayrı bir ders yine de düşünülebilir.
- Simülatör ekranı 1366×768 dizüstünde kalabalık: görev, tuval, inceleme, terminal ve zaman
  çizelgesi aynı anda açık; görev açıklaması aşağıda kalıyor (geniş çalışma alanı Alt+Shift+F
  yan şeritleri daraltır).
- Pratik adımında konu başına 6–23 görev listeleniyor; hangisinin "önerilen" olduğu
  işaretlenmiyor. Şube için "1 kurulum + 2 arıza" gibi bir öneri işareti düşünülebilir.
- Konu başına süre yaklaşık 60 dakika (12 konu ≈ 12 saat); iş arasında çalışan için kısa yol yok.

- Akademi labı başlatılınca, çalışma alanı boş olsa bile "Yeni laboratuvar açık çalışma
  alanının üzerine yazacak" onayı çıkar ve sayfa alttaki kataloğa kayar. İlk kullanımda
  kafa karıştırabilir; geri bildirime göre ele alınır.
- Planlanan ama yapılmayan arayüz parçaları (`DEVIR_NOTU.md` "Güncel durum"): Sorun Çöz
  ekranının belirti kartı, katman seçici ve kanıt defteri; müfredat haritasının konu kartları.
  Bugünkü akış (konu listesi, Öğren → Test → Pratik, Simülatör görev listesi) bunlar olmadan
  çalışır.

## Açık kararlar (kullanıcı)

- [ ] Yukarıdaki iki arayüz parçası 1.0 için gerekli mi, yoksa şube geri bildirimine mi kalır?
- [ ] Seviye 1 sonunda bir "yeterlilik" sınavı isteniyor mu? (`MUFREDAT.md` açık sorusu)
- [ ] Dağıtım: dosya şubeye nasıl ulaştırılacak (paylaşılan klasör, e-posta, intranet)?
- [ ] Geri bildirim nasıl toplanacak (ör. konu başına kısa form; hangi lab zorladı, hangi
  ders eksik kaldı)?
