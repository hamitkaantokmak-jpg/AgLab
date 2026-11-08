# AğLab

Tarayıcı tabanlı ağ simülatörü ve Packet Tracer `.pkt` aktarımı.

Simulation Mode V1, mevcut ARP/ICMP motor kayıtlarını adım adım ve SVG üzerinde yeniden oynatır; yeni trafik üretmez. Realtime, CLI, Akademi ve çevrimdışı kullanım korunur. Kapsam ve gerçek Lab ayrımı: [Simulation Mode V1](docs/SIMULATION_MODE_V1.md).

## Kaynak düzeni ve derleme

`AgLab_Final_PKT_Import.html` artık yalnızca **derleme çıktısıdır**; elle düzenlenmez. Kaynaklar:

- `src/index.html` – sayfa iskeleti; `@@include yol@@` yer tutucuları içerir
- `src/app/*.js` – uygulama kodu (`main.js` çekirdek simülatör/CLI/çizim)
- `src/styles/*.css`, `src/data/*.json` – stiller ve ders verisi
- `simulator/*.js`, `academy/*.js` – `//@@module BAŞLIK@@` satırlarıyla gömülen modüller

Derlemek için `python tools/build_html.py` (eski `build_simulator.py` / `build_academy.py` aynı işi yapar). `python tools/build_html.py --check` commit edilmiş HTML'nin kaynakla eşleştiğini doğrular; CI bu kontrolü zorunlu çalıştırır. Yeniden yapılanma planı: [docs/YENIDEN_YAPILANMA.md](docs/YENIDEN_YAPILANMA.md).

Güncel dağıtım için başarılı PR CI çalışmasının öğrenci ZIP'ini kullanın veya derleyiciyi çalıştırın. CI tekrar üretimde aynı HTML'yi doğrular. ZIP içindeki `html-build-manifest.json`, kaynak commit kimliğini ve cihaz CLI'si dahil HTML/modül SHA256'larını içerir. [Ortak JSON → gerçek Lab](docs/ORTAK_GERCEK_LAB.md) ve [40 laboratuvar–motor haritası](docs/LAB_MOTOR_HARITASI.md).

## Motor kaynağı ve köken

`src/sim/` altındaki ağ motoru **Labber** projesinden alınmıştır ve AğLab'ın **kendi
kaynağıdır** (üçüncü taraf bağımlılığı değildir; `third_party/` altında tutulmaz).

| Alan | Değer |
|---|---|
| Proje | Labber — tarayıcıda çalışan Cisco IOS benzeri switch/router lab simülatörü |
| Kaynak depo | `faarik-network/labber` |
| Alınan commit | `74a0925312a659f94fbdd7dc9f73d13f90c61f52` (2026-11-07) |
| Alınma tarihi | 2026-11-08 |
| Alınan kısım | `sim/` (birebir, değişiklik yok) → `src/sim/`; `tests/sim.test.ts` → `tests/sim/sim.test.ts` ve onun kullandığı iki lab tanımı → `tests/sim/fixtures/` (yalnızca test fixture'ı; içe aktarma yolları düzeltildi) |
| Alınmayan | `app/`, `nuxt.config.ts`, `labs/` (L2 aşamasında ayrı içerik grubu olarak gelecek), `pdfs/` ve PDF'lerden alıntı (hiçbir zaman) |
| Hak sahibi | Labber ve AğLab aynı sahibe aittir |

Motor `tools/build_sim.cjs` (sabit sürüm esbuild) ile `src/sim.generated.js` adlı tek bir
IIFE'ye (global ad `AgLabSim`) derlenir ve `tools/build_html.py` ile HTML'ye gömülür.
Geçiş planı: [docs/YENIDEN_YAPILANMA.md](docs/YENIDEN_YAPILANMA.md) ("Labber entegrasyon planı").
L0 aşamasında motor gömülüdür ancak hiçbir ürün ekranı onu çağırmaz.

## Otomatik kalite kapısı

`python -m pip install playwright` ve `python -m playwright install chromium` sonrasında `python run_pipeline.py` çalıştırın.

GitHub Actions her push ve pull request'te tüm regresyon gruplarını çalıştırır. Tüm testler başarılıysa doğrulanmış ZIP üretir, aksi durumda test raporunu saklar.

Testler `tests/` (Python/Playwright) ve `tests/node/` (Node) altındadır; pipeline bunları keşifle toplar. JS kaynakları Prettier, test/araç Python dosyaları Black ile biçimlenir. Detaylı kurulum, test düzeni ve biçim kuralları: `OTOMASYON.md`.

Deneysel gerçek üçüncü taraf motor karşılaştırması: [kapsam, lisans ve testler](docs/HAZIR_MOTOR_ENTEGRASYON.md).
HTML çevrimdışı çalışır; kaynak motoru yeniden derlemek için `npm ci --ignore-scripts` ve `npm run build:engine` kullanılır.
Yeni entegrasyonu içeren HTML, `python run_pipeline.py` tarafından kaynak modüllerden üretilir ve başarılı CI ZIP'ine eklenir. Depodaki hazır HTML de aynı modüllerle günceldir. CI hem iki ardışık derlemenin hem de kaydedilmiş HTML ile yeniden üretilen çıktının eşitliğini doğrular.

[Motor uyumluluk matrisi](docs/UYUMLULUK_MATRISI.md) · [Gerçek VLAN/STP ve FRR testleri, ortak motor yönetimi](docs/GELISMIS_MOTOR_ENTEGRASYON.md). ZIP içindeki `html-build-manifest.json` HTML/modül bütünlüğünü doğrular; native protokoller ayrı Linux/Docker lablarında çalışır.

**Sınır:** Testlerin geçmesi tüm Packet Tracer özelliklerinin desteklendiği anlamına gelmez. Yeni özellikler için ayrı regresyon testleri gereklidir.

