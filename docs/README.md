# AğLab belgeleri — içindekiler

Güncel plan ve kararlar için önce ilk tablodaki belgeler okunur; çelişkide bunlar esastır
(bkz. `AGENTS.md`). `arsiv/` altındakiler geçmiş kayıttır, güncel davranışı anlatmaz.

## Plan ve durum (güncel)

| Belge | Ne için |
|---|---|
| [SONRAKI_ISLER.md](SONRAKI_ISLER.md) | İş sırası: L7 sonrası onaylanmış işler |
| [DEVIR_NOTU.md](DEVIR_NOTU.md) | Labber entegrasyonunun ve arayüz yenilemesinin durumu, birleşen/açık işler |
| [YENIDEN_YAPILANMA.md](YENIDEN_YAPILANMA.md) | Mimari plan: Labber tek ağ motoru (L1–L7) |
| [MUFREDAT.md](MUFREDAT.md) | Üç seviyeli müfredat, konu sırası, motor yol haritası |
| [EGITIM_VIZYONU.md](EGITIM_VIZYONU.md) | Eğitim yaklaşımı: simülatör araç, amaç öğretmek |
| [GELECEK_FIKIRLER_YOL_HARITASI.md](GELECEK_FIKIRLER_YOL_HARITASI.md) | Fikir havuzu (4 Kasım 2026); yazanlar uygulanmış özellik sayılmaz |

## Motor, uyumluluk ve içerik (güncel başvuru)

| Belge | Ne için |
|---|---|
| [UYUMLULUK_MATRISI.md](UYUMLULUK_MATRISI.md) | Neyin modellendiği / modellenmediği; Labber kararları ve bilinen farklar |
| [LAB_MOTOR_HARITASI.md](LAB_MOTOR_HARITASI.md) | Akademi labları ve senaryoların motor eşlemesi (`tools/build_lab_engine_map.py` üretir) |
| [MOTOR_BULGULARI.md](MOTOR_BULGULARI.md) | Testlerin bulduğu motor farkları ve ders yazarken görülen açık eksikler |
| [SIMULATION_MODE_V1.md](SIMULATION_MODE_V1.md) | Simulation Mode: son işlemin salt okunur yeniden oynatımı |
| [ORTAK_MOTOR.md](ORTAK_MOTOR.md) | Ortak motor senaryolarının protokol ve port güvenliği kapsamı |
| [ORTAK_GERCEK_LAB.md](ORTAK_GERCEK_LAB.md) | Ortak topolojiden operatör kontrollü Gerçek Lab |
| [GELISMIS_MOTOR_ENTEGRASYON.md](GELISMIS_MOTOR_ENTEGRASYON.md) | Gerçek Lab (Linux bridge / FRR) L2 ve yönlendirme testleri. "Ortak motor yöneticisi" bölümü tarihseldir (L7b notu içinde) |
| [AKADEMI.md](AKADEMI.md) | Akademi AGL-001–040 görevleri |
| [dersler/](dersler/) | Konu dersleri (müfredat sırasıyla) |
| [arayuz/](arayuz/) | Arayüz yenilemesi taslağı (README, taslak görüntüleri ve HTML) |

## Araçlar, test ve içe aktarma

| Belge | Ne için |
|---|---|
| [OTOMASYON.md](OTOMASYON.md) | `python tools/run_pipeline.py`, test düzeni, CI ve biçim kuralları |
| [AgLab_PKT_Import_Kullanim.md](AgLab_PKT_Import_Kullanim.md) | `.pkt` → AğLab JSON dönüştürücüsü ve özgün `.pkt`'yi geri yükleme |
| [PKT_ORNEK_MATRISI.md](PKT_ORNEK_MATRISI.md) | PKT örnek ve doğrulama matrisi (`tests/fixtures/pkt/pkt-sample-matrix.json`) |
| [SIMULATOR_PLAN.md](SIMULATOR_PLAN.md) | Eski tarayıcı simülatörü geliştirme planı. Labber öncesine aittir; güncelliği ayrıca doğrulanmadı |

## Arşiv (geçmiş kayıt)

Her belgenin başında taşınma tarihi ve neden eski olduğu yazar.

| Belge | Ne için |
|---|---|
| [arsiv/ENTEGRE_SURUM_RAPORU.md](arsiv/ENTEGRE_SURUM_RAPORU.md) | Unified RC1 sürüm adayı raporu (9 Kasım 2026); doğrulanmış ZIP'e hâlâ eklenir |
| [arsiv/HAZIR_MOTOR_ENTEGRASYON.md](arsiv/HAZIR_MOTOR_ENTEGRASYON.md) | NetSim entegrasyonu (5 Kasım 2026); L7b'de kaldırıldı |
| [arsiv/MOTOR_ACIK_KAYNAK_KARSILASTIRMA.md](arsiv/MOTOR_ACIK_KAYNAK_KARSILASTIRMA.md) | Açık kaynakla hızlandırma kararı (4 Kasım 2026) |
| [arsiv/ACIK_KAYNAK_LAB_ENTEGRASYON_PLANI.md](arsiv/ACIK_KAYNAK_LAB_ENTEGRASYON_PLANI.md) | Açık kaynak araştırma notu (30 Ekim 2026) |
