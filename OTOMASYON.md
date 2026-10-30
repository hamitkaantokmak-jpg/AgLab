# AğLab otomatik test ve sürüm altyapısı

`python run_pipeline.py` komutu mevcut regresyon testlerini Chromium üzerinde çalıştırır, JSON/Markdown raporlarını üretir ve **yalnızca tüm testler geçerse** doğrulanmış ZIP paketi oluşturur. Test başarısızsa eski doğrulanmış ZIP silinir ve komut başarısız kodla çıkar.

## Yerel kurulum

Python 3.11+, Chromium ve `pip install playwright` gerekir. `python run_pipeline.py` komutunu proje kökünde çalıştırın. Sonuçlar `dist/` klasörüne kaydedilir. Tekrar çalıştırmak için ek soru veya manuel ZIP hazırlama gerekmez.

## GitHub Actions

Projeyi GitHub deposuna yükleyin. `.github/workflows/aglab-ci.yml` her push, pull request ve manuel tetiklemede testleri çalıştırır. Raporlar her durumda Actions artifacts bölümünde; doğrulanmış ZIP yalnızca başarı durumunda görünür. Depo bağlama/yükleme işlemi kullanıcı hesabında yetki gerektirir; bu paket kendi başına GitHub'da çalışma başlatmaz.

## Kapsam sınırı

Bu altyapı otomatik test, raporlama ve paketlemeyi sağlar; kendi başına yeni ağ özellikleri **yazmaz**. Mevcut test gruplarının geçmesi Packet Tracer'ın tüm `.pkt` formatlarını, OSPF/RIP, ACL/NAT veya tüm büyük topolojiler için performans garantisi vermez. Yeni özellikler için yeni testler eklenmeli. Tarayıcı kalıcılığı `test_aglab_persistence.py` ile kalite kapısına dahildir: gerçek HTTP origin, diskte saklanan tarayıcı profili, sayfa yenileme, yeni Chromium süreci, VLAN/port yapılandırması, kaynak arşivi ve aktarım raporu, geçersiz JSON reddi ve depolama kotası hatasında dışa aktarım kontrol edilir. Bu, farklı tarayıcılar veya gizli gezinme oturumları arasında otomatik veri aktarımı sağlamaz.

## Windows düzeltmesi (2026-10-29)
`run_pipeline.py` artık Windows'ta Playwright'ın kurduğu Chromium'u da bulur; sistemde `chromium` komutunun PATH üzerinde olması gerekmez.

CMD'de proje klasöründe sırasıyla:
```
python -m pip install playwright
python -m playwright install chromium
python run_pipeline.py
```

Başarılıysa `dist/AgLab_Otomatik_Dogrulanmis_Paket.zip` oluşur. Testlerin ayrıntılı hata kayıtları `dist/test-results.json` dosyasındadır. `--skip-browser` kullanımı testleri geçirmiş saymaz.

## Birleşik kalite kapısı

`run_pipeline.py` trunk aktarımı/varsayılanları, dot1Q ve CLI tutarlılığı, tarayıcı kalıcılığı, 300 cihazlık STP yükü ve PKT örnek matrisini mevcut testlerle birlikte çalıştırır. Her test dosyası bir kez kayıtlıdır. Gerçek/sentetik örnek ayrımı ve performans bütçesi `PKT_ORNEK_MATRISI.md` içinde açıklanır. Ölçümler ilgili koşunun `dist/test-results.json` dosyasında bulunur. Başarılı ZIP, tüm kayıtlı testleri ve örnek matrisi belgelerini içerir.
