# Sonraki işler — L7 sonrası plan

Bu belge, yeniden yapılanma (L1–L7) bittikten sonra yapılacak, kullanıcının onayladığı
işleri toplar. Motor entegrasyonunun güncel durumu için `DEVIR_NOTU.md`, müfredat için
`MUFREDAT.md` esastır.

## Sıra

1. **L5 kalanı** (motor): HTTP servisi, PKT IOS metin yolu.
2. **Seviye 1 dersleri** (içerik): kalan 7 konu (#1, #2, #4, #8, #9, #10, #12). Bu
   sırada motor işi bekler.
3. **İçe aktarmanın Labber'a geçmesi, L6, L7** (motor).
4. **Arayüz yenilemesi** (aşağıda).
5. **Şube sürümü 1.0:** Seviye 1 eksiksiz ve yeni arayüzle şubede kullanıma başlanır;
   geri bildirim CCNA önceliklerini belirler.
6. **CCNA** (Seviye 2): müfredatın istediği motor özellikleri ve dersler birlikte.
7. **CCNP** (Seviye 3): önce okuma konuları; routing konularında Labber mı Canlı Lab mı
   kararı o gün verilir.

## Arayüz yenilemesi

L7'den sonra, CCNA'dan önce yapılır. L7 iki motorlu kod yollarını sildiği için
öncesinde yapılırsa silinecek kod da taşınmış olur. `main.js` ve testlerin kullandığı
seçicilere dokunduğu için motor işiyle aynı anda yürütülmez. Testlerin seçicileri
korunur; korunamayan seçici PR'da gerekçelendirilir, test gevşetilmez.

Ortak düzen: üst gezinme (dört ana bölüm), sol ikon şeridi, ekran başına tek iş.

| Ekran | İçerik |
|---|---|
| Müfredat haritası | Seviye başına konu kartları; kartta ders/lab/senaryo/sınav durumu ve pratik türü etiketi (Simülatör, Canlı Lab, Okuma); kaldığın yerden devam; haftalık çalışma; son arıza senaryoları |
| Ders | Yedi parçalı şablon adım çubuğu olarak (Neden önemli → Kısa sınav); çıktı okuma bloğunda satır vurgusu ve yan açıklama balonları; kontrol soruları; konunun labına geçiş |
| Lab çalışma alanı | Üstte başlık, motor rozeti, sıfırla/ipucu/kontrol et; solda görev ve canlı hedef listesi; ortada topoloji tuvali; sağda inceleme paneli (port/cihaz özellikleri, hızlı show çıktısı); altta cihaz sekmeli terminal ve yanında Simulation Mode zaman çizelgesi |
| Arıza senaryosu | Belirti kartı; Belirti → Teşhis → Kanıt → Düzeltme adımları; düzeltmeden önce işaretlenen katman seçici; terminalden iğnelenen çıktılarla kanıt defteri; üç ölçütlü değerlendirme (bağlantı, doğru kök neden, gereksiz değişiklik yok) |

Uygulama küçük PR'larla: önce ortak iskelet, sonra lab çalışma alanı, arıza senaryosu,
en son müfredat haritası ve ders ekranı.

## Adlandırma

- **Simülatör:** tarayıcıdaki Labber motoru (bugünkü "Lab").
- **Canlı Lab:** FRR + containerlab (bugünkü "Gerçek Lab").
- "Lab" kelimesi yalnız alıştırma anlamında kalır (Akademi labı, yönlendirmeli lab).

Arayüz yenilemesiyle birlikte uygulanır.

## Öğrenci/öğretmen ayrımı kalkar

Uygulama şube içi kendi kendine öğrenme için; çözümü saklayıp notlandıran bir öğretmen
yok.

- Tek paket üretilir; `AgLab_Akademi_Ogretmen.zip` ayrımı kalkar (`run_pipeline.py`,
  `verify_packages.py`).
- Lab ve arıza senaryosunda **"Çözümü göster"** düğmesi olur. Hemen açık değildir:
  birkaç başarısız "Kontrol et" denemesinden ya da bütün ipuçları kullanıldıktan sonra
  açılır. İpuçlarının kademeli açılmasının son basamağıdır.
- Öğretmen çözümleriyle yapılan test kontrolleri (her lab çözümle 100/100) kalır;
  değişen yalnız paketleme ve gösterim.

Paketleme ve düğme arayüz yenilemesiyle birlikte yapılır.

## Canlı Lab

Şimdilik kalır, yatırım yapılmaz. CCNP routing konularına gelindiğinde gerekirse yalnız
üç iş: tek komutla yerel kurulum, tarayıcıdan canlı `vtysh` terminali, her CCNP routing
konusu için bir lab ve bir arıza senaryosu. Labber bu konuları karşılarsa öğrenciden
gizlenip yalnız test referansı (FRR çıktısı) olarak tutulabilir.
