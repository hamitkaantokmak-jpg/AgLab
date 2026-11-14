# AğLab — Açık kaynak entegrasyon başlangıç çalışması

Durum: **araştırma / entegrasyon tasarımı**, henüz kod aktarımı veya işlevsel değişiklik yok. Tarih: 2026-10-30.

## Karar

Mevcut tek HTML çevrimdışı dağıtımı ve JS simülasyon motorunu koru. İlk entegrasyon hedefi **laboratuvar otomatik değerlendirme (grader) sözleşmesi** olsun. Başka bir projenin tüm simülatörünü AğLab içine gömmek veya WebAssembly'ye topluca geçmek şu aşamada gereksiz risk yaratır. Özellikle mevcut kullanıcı akışları, PKT dönüşümü ve ağ motoru regresyonları korunmalı.

## İncelenen alternatifler (kaynak/lisans)

| Proje | Depo | Lisans dosyasında doğrulanan | Nasıl yararlanacağız |
|---|---|---|---|
| joxorsayan NetSim | https://github.com/joxorsayan/netsim | MIT | Öğretim senaryosu ve değerlendirme tasarımını karşılaştır; doğrudan Python/FastAPI motorunu kopyalama. |
| michael-borck NetSim | https://github.com/michael-borck/netsim | MIT | Tarayıcı içi lab dosyası ve gerçek simülasyonla değerlendirme yaklaşımını incele. |
| netsim-labs NetSim | https://github.com/netsim-labs/netsim | AGPL-3.0 | Rust/Wasm mimarisini referans al; lisans incelemesi olmadan kod taşıma/bağlama yapma. |

MIT kodundan alıntı/kopya halinde copyright ve lisans bildirimleri korunmalı. Bu PR **harici kod içermez**; yalnızca bağımsız uyum tasarımı içerir.

## İlk uygulanacak dikey dilim: değerlendirme kontratı

Laboratuvar tanımı ile simülatör durumunu ayır:

- `lab.id`, `lab.version`, `lab.title`, `initialTopology`, `objectives[]`.
- Amaç tipleri, en az: `device-exists`, `interface-up`, `vlan-membership`, `ip-address`, `static-route`, `reachability`.
- Her amaç: `id`, `type`, `target`, `expected`, `points`; yalnızca simülatörün doğrulanmış verileri kullanılır.
- Sonuç: `objectiveId`, `passed`, `earnedPoints`, `maxPoints`, `reason`, `evidence`.
- Başarısız topolojide yanlış pozitif üretmemek için reachability kontrolü mevcut **gerçek paket/ICMP** motoruna dayanmalı; yalnızca geometrik yol veya beklenen config karşılaştırılmamalı.
- Başlangıç topolojisi ve özgün PKT arşivi değişmeden kalmalı; değerlendirme motoru simülasyon durumunu mutasyona uğratmamalı.
- Bilinmeyen amaç tipi: sessiz başarı değil `unsupported`/açık hata.

## Doğrulama kriterleri (bir sonraki kod PR'ı)

1. Çalışan iki-router statik rota fixture'ı geçer; statik rota kaldırılınca aynı reachability hedefi başarısız olur.
2. VLAN/trunk kapatılınca daha önce başarılı hedef başarısız olur; düzeltmeyle tekrar geçer.
3. Aynı girdiler için skor deterministiktir, değerlendirme cihaz konfigürasyonunu ve mevcut .pkt/JSON kaynak arşivini değiştirmez.
4. Geçersiz lab şeması ve tanınmayan hedefler açıkça hata verir.
5. Öğrenci akışı, import/kayıt ve tüm mevcut 30 regresyon grubu `python run_pipeline.py` ile PASS; CI sonucu gözlenmeden merge edilmez.
6. Öğrencinin terminalden yaptığı değişiklikler yeniden değerlendirilebilir; yalnızca UI üzerinden yapılmış değişikliklere bağımlı değildir.

## Uygulama sınırları

- İlk aşamada yeni OSPF/NAT/IOS davranışı **yok**.
- Tam Packet Tracer uyumluluğu, gerçek cihaz imajı veya sunucu gereksinimi **yok**.
- Mevcut `academy/` veri şemasını otomatik değiştirme; önce uyum katmanını tasarla.
- `main` dalına doğrudan yazma ve test başarısızken birleştirme yapma.
- Belirsiz lisanslı veya telif hakkı kısıtlı Cisco imajı/konfigürasyonu ekleme.

## Sonraki uygulama dilimi

`academy` için bağımsız ve salt-okunur evaluator modülü + olumsuz/olumlu Chromium regresyonu. Önce başarısız testi gör, ardından en küçük motor bağlantısını yap. Dokümantasyon PR'ı testlerin geçtiği iddiasını içermez.
