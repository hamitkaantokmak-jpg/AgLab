# AğLab — Kodlama ajanı çalışma kuralları

## Ana hedef
Öncelik Packet Tracer `.pkt` içe aktarma doğruluğudur. Kullanıcı adına küçük kozmetik değişiklikler yerine birbiriyle ilişkili işlevsel düzeltmeleri grupla. Desteklenmeyen Cisco/PT özelliklerini kesinlikle çalışıyormuş gibi sunma.

## İş döngüsü
1. GitHub Issues'daki dar kapsamlı görevi al, mevcut kodu ve ilgili testleri oku.
2. Hatanın yeniden üretilebildiği bir otomatik test ekle; testin önceden başarısız olduğunu doğrula.
3. Dönüştürücü / HTML simülatörü / CLI için en küçük güvenilir düzeltmeyi uygula.
4. `python run_pipeline.py` çalıştır (Playwright Chromium kurulmuş olmalı).
5. Bütün mevcut regresyonlar geçmeden PR'ı tamamlanmış sayma. CI'da doğrulanmış ZIP üretimini kontrol et.
6. Pull request açıklamasında değişen PKT senaryolarını, testleri ve desteklenmeyen davranışları belirt.
7. Varsayılan `main` dalını doğrudan değiştirmek yerine ayrı dal ve PR kullan; test hatasında birleştirme yapma.

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
python run_pipeline.py
```

## Güvenlik
Hiçbir kimlik bilgisi, erişim belirteci veya kullanıcıya özel gizli veri repoya eklenmemeli. Gerçek `.pkt` örneklerini ancak izinli ve kişisel veri içermeyen kaynaklardan kullan. Kullanıcının onayı olmadan otomatik PR birleştirme veya yayınlama yapma.
