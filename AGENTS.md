# AğLab — Kodlama ajanı çalışma kuralları

## Ana hedef
Güncel plan `docs/SONRAKI_ISLER.md` (iş sırası), `docs/YENIDEN_YAPILANMA.md` (mimari: Labber tek ağ motoru), `docs/DEVIR_NOTU.md` (motor entegrasyonunun durumu) ve `docs/MUFREDAT.md` (konu ve seviye sırası) belgelerindedir; çelişkide bunlar esastır. Packet Tracer `.pkt` içe aktarma doğruluğu korunur ama tek öncelik değildir. Küçük kozmetik değişiklikler yerine birbiriyle ilişkili işlevsel düzeltmeleri grupla. Desteklenmeyen Cisco/PT özelliklerini kesinlikle çalışıyormuş gibi sunma: modellenmeyen davranış ders, lab ve belgede açıkça yazılır.

## İş döngüsü
1. Görevi kullanıcının verdiği plandan ya da yukarıdaki belgelerden al (dar kapsamlı tut); mevcut kodu ve ilgili testleri oku.
2. Hatanın yeniden üretilebildiği bir otomatik test ekle; testin önceden başarısız olduğunu doğrula.
3. Labber motoru (`src/sim`) / dönüştürücü / HTML simülatörü / CLI için en küçük güvenilir düzeltmeyi uygula.
4. `python tools/run_pipeline.py` çalıştır (Playwright Chromium kurulmuş olmalı).
5. Bütün mevcut regresyonlar geçmeden PR'ı tamamlanmış sayma. CI'da doğrulanmış ZIP üretimini kontrol et.
6. Pull request açıklamasında değişen senaryoları, testleri, desteklenmeyen davranışları ve doğrulanamayanları belirt.
7. Varsayılan `main` dalını doğrudan değiştirmek yerine ayrı dal ve PR kullan; test hatasında birleştirme yapma.

## Motor ve pratik PR'ları
- Motor işi (`motor/<konu>`) ve pratik işi (`pratik/<konu>`: lab, arıza senaryosu, ipucu) ayrı PR'lardır. Motor PR'ı `src/labs`'a lab eklemez; pratik PR'ı motoru değiştirmez.
- Motora yeni özellik eklenince aynı iş kapsamında ilgili ders (`docs/dersler/`), `docs/MUFREDAT.md`, `docs/UYUMLULUK_MATRISI.md` ve `docs/LAB_MOTOR_HARITASI.md` birlikte güncellenir; "motorda yok" diyen eski ifade bırakılmaz.
- Modellenmeyen davranış (ör. zamanlayıcılar, sorgu/yanıt, sabit show alanları) belgede ve PR açıklamasında açıkça yazılır.
- Lab brief'inde ve ipuçlarında anılan her belirti lab başlangıcında gerçekten görülebilmeli. Lab açılışında günlük (`rt.logs`) temizlenir ve `show logging` yoktur: yalnız bir geçişte üretilen log'a dayanan belirti yazılmaz ya da nasıl üretileceği söylenir; bunu bir testle doğrula.

## Kaynak kuralı
- `AgLab_Final_PKT_Import.html` derleme çıktısıdır; doğrudan düzenleme. Değişikliği `src/`, `simulator/` veya `academy/` altında yap, sonra `python tools/build_html.py` çalıştırıp HTML ve `html-build.sha256` dosyasını birlikte commit et.
- Derleyiciye metin değiştirme (string replace) yaması ekleme; kaynağın kendisini düzelt.

## Kapsam ve kabul kriterleri
- Cihaz, arayüz, kablo, IP/mask, varsayılan ağ geçidi ve statik rotaları koru.
- VLAN, trunk, STP, alt arayüz ve ağ bağlantısı semantiğinde kanıtlanmış olanı uygula.
- `.pkt` ayrıştırmasının sınırlarını örnek bazında belgele; sessiz veri kaybını raporla.
- İçe aktarılan özgün `.pkt` verisini geri yükleme mekanizmasını bozma.
- Testlerde hem başarılı hem başarısız paket iletim senaryoları olsun.
- Test raporları ve ZIP yalnızca gerçekte geçen testlere dayanmalı.

## Çalıştırma
```bash
python -m pip install playwright
python -m playwright install --with-deps chromium
python tools/run_pipeline.py
```

## Güvenlik
Hiçbir kimlik bilgisi, erişim belirteci veya kullanıcıya özel gizli veri repoya eklenmemeli. Gerçek `.pkt` örneklerini ancak izinli ve kişisel veri içermeyen kaynaklardan kullan. Kullanıcının onayı olmadan otomatik PR birleştirme veya yayınlama yapma.
