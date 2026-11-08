# AğLab otomatik test ve sürüm altyapısı

`python run_pipeline.py` komutu mevcut regresyon testlerini Chromium üzerinde çalıştırır, JSON/Markdown raporlarını üretir ve **yalnızca tüm testler geçerse** doğrulanmış ZIP paketi oluşturur. Test başarısızsa eski doğrulanmış ZIP silinir ve komut başarısız kodla çıkar.

## Yerel kurulum

Python 3.11+, Chromium ve `pip install playwright` gerekir. `python run_pipeline.py` komutunu proje kökünde çalıştırın. Sonuçlar `dist/` klasörüne kaydedilir. Tekrar çalıştırmak için ek soru veya manuel ZIP hazırlama gerekmez.

## Test düzeni

- `tests/test_*.py` – Python/Playwright regresyonları; `tests/node/*.cjs` – Node testleri ve kıyaslamalar; `real-lab/test_*.py` – Gerçek Lab testleri.
- `tests/sim/*.test.ts` – Labber motor testleri (TypeScript, vitest). Pipeline'da tek grup olarak `tests/sim` adıyla koşar (`npm run test:sim`); önce `npm ci --ignore-scripts` gerekir, vitest yoksa grup **FAIL** olur (atlanmaz).
- `run_pipeline.py` bu dizinleri **keşfeder** (`collect_checks`); yeni bir test için yalnızca dosyayı uygun dizine `test_` önekiyle eklemek yeterlidir. Test listesi elle tutulmaz.
- Testler ortak `tests/aglab_test_support.py` yardımcısını kullanır (`ROOT`, `HTML`, `artifact_dir()`, `work_dir()`, `decoded_source_xml()`, `launch_chromium()`). Sabit `/mnt/data` veya `/usr/bin/chromium` yolu yoktur; tek bir test doğrudan çalıştırılabilir: `python tests/test_aglab_import.py`, `node tests/node/test_packet_events.cjs`.
- `AGLAB_CHROMIUM` belirli bir Chromium ikilisini seçer; boşsa Playwright'ın Chromium'u kullanılır. `AGLAB_TEST_ARTIFACT_DIR` kanıt dosyalarının dizinidir (varsayılan `dist/`).

## Kaynak biçimi

JavaScript kaynakları Prettier (`npm run format`, `npm run format:check`), test/araç Python dosyaları Black (`black .`) ile biçimlenir; CI her ikisini de denetler. Tek satırlık gömülü veri (`academy/student-data.js`), derlenmiş üçüncü taraf motor ve CSS bilinçli olarak biçimlenmez (bkz. `.prettierignore`). Biçim değişikliğinin davranışı değiştirmediği `node tools/js_equivalence.cjs <eski-kök> <yeni-kök> <dosyalar…>` ile kanıtlanır: esbuild ile boşlukları atılmış çıktılar bayt bayt karşılaştırılır.

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
