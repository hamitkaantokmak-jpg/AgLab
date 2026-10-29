# AğLab otomatik test ve sürüm altyapısı

`python run_pipeline.py` komutu on mevcut regresyon testini Chromium üzerinde çalıştırır, JSON/Markdown raporlarını üretir ve **yalnızca tüm testler geçerse** doğrulanmış ZIP paketi oluşturur. Test başarısızsa eski doğrulanmış ZIP silinir ve komut başarısız kodla çıkar.

## Yerel kurulum

Python 3.11+, Chromium ve `pip install playwright` gerekir. `python run_pipeline.py` komutunu proje kökünde çalıştırın. Sonuçlar `dist/` klasörüne kaydedilir. Tekrar çalıştırmak için ek soru veya manuel ZIP hazırlama gerekmez.

## GitHub Actions

Projeyi GitHub deposuna yükleyin. `.github/workflows/aglab-ci.yml` her push, pull request ve manuel tetiklemede testleri çalıştırır. Raporlar her durumda Actions artifacts bölümünde; doğrulanmış ZIP yalnızca başarı durumunda görünür. Depo bağlama/yükleme işlemi kullanıcı hesabında yetki gerektirir; bu paket kendi başına GitHub'da çalışma başlatmaz.

## Kapsam sınırı

Bu altyapı otomatik test, raporlama ve paketlemeyi sağlar; kendi başına yeni ağ özellikleri **yazmaz**. Mevcut on test grubunun geçmesi Packet Tracer'ın tüm `.pkt` formatlarını, OSPF/RIP, ACL/NAT veya tarayıcı yeniden açılışında kalıcılığı doğrulamaz. Yeni özellikler için yeni testler eklenmeli. Tarayıcı kalıcılığı şu an kalite kapısına dahil değildir.

## Windows düzeltmesi (2026-10-29)
`run_pipeline.py` artık Windows'ta Playwright'ın kurduğu Chromium'u da bulur; sistemde `chromium` komutunun PATH üzerinde olması gerekmez.

CMD'de proje klasöründe sırasıyla:
```
python -m pip install playwright
python -m playwright install chromium
python run_pipeline.py
```

Başarılıysa `dist/AgLab_Otomatik_Dogrulanmis_Paket.zip` oluşur. Testlerin ayrıntılı hata kayıtları `dist/test-results.json` dosyasındadır. `--skip-browser` kullanımı testleri geçirmiş saymaz.
