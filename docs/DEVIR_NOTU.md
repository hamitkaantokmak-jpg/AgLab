# Devir notu — Labber entegrasyonu (L3)

Bu not, oturum bağlamı dolmak üzereyken bırakılan durumu ve kalan işleri anlatır.
Plan: [YENIDEN_YAPILANMA.md](YENIDEN_YAPILANMA.md) (L3 tablosu, L4 "Aşamalar", L5).
Motor kararları: [LAB_MOTOR_HARITASI.md](LAB_MOTOR_HARITASI.md). Kararlar ve bilinen
farklar: [UYUMLULUK_MATRISI.md](UYUMLULUK_MATRISI.md) (sonundaki "Labber" bölümü).

## Birleşen ve açık işler

| Aşama | PR | Durum |
|---|---|---|
| L2-A Simulation Mode testi | #52 | birleşti |
| L2-B kablo durumu / cihaz gücü | #53 | birleşti |
| L2-C MAC/ARP (L3 tablosu 10–14) | #54 | birleşti |
| L2-D1 ortak senaryolar Labber'da | #55 | birleşti |
| L2-D2 Akademi M1–M3 Labber'da | #57 | birleşti |
| L3-a terminal → IosSession/VpcsSession, tek kalıcı LabRuntime | dal `claude/l3a-labber-terminal` | PR açık (birleşmeyi bekliyor) |
| F bekleyen ders senaryoları (Konu #11, Konu #3) → Sorun Çöz | dal `claude/f-ders-senaryolari` (L3-a'nın üstünde) | PR açık (birleşmeyi bekliyor) |
| E Labber'ın 13 labı | — | başlanmadı (F'den sonra) |
| L3-b Simulation Mode olay adaptörü | — | başlanmadı (E'den sonra) |

## Bugünkü mimari (kısaca)

- `simulator/engine-choice.js` (`aglabEngineChoice`): içerik yüklenirken köprü kararı
  (`AgLabSim.toLabber(t).report`), rozet metni, Labber ping/STP/görünüm (`labberPing`,
  `labberStpRoot`, `labberView`).
- `simulator/labber-session.js` (`aglabLabber`, L3-a): Labber kararındaki içerik
  (Sorun Çöz senaryosu `sharedScenarioDecideEngine`, Akademi `academyRestoreSession`)
  yüklenince **tek kalıcı** `LabRuntime` kurulur; `importTopology`/`reset` oturumu bitirir.
  - Terminal (`main.js` `labberCommand`) cihaz başına `createSession` ile açılan
    `IosSession`/`VpcsSession`'a gider; istem, `?`, Tab, onay soruları (reload
    `Save? [yes/no]` → `[confirm]`, `copy run start` hedef sorusu) IOS'un kendisinin.
    Syslog satırları (`rt.logs`) o cihazın konsoluna yazılır.
  - Kaynak gerçek çalışma zamanıdır: her komuttan sonra `toAglab(rt, güncel topoloji)` ile
    AğLab `devices/links` yeniden yazılır (çizim, denetçi, kayıt). `toAglab` ifade
    edemezse (`BridgeError`: portfast, OSPF, statik rota…) görünüm güncellenmez ve
    terminalde açık hata yazılır.
  - `device power on|off` → `rt.setPower` (açılış reload'dur). `aglabLabberSession.setLink`
    / `moveCable` API'si hazır (F senaryoları için). Düzenleyicinin diğer topoloji
    değişiklikleri (kablo sök/bağla, cihaz ekle/sil, ad) `saveTopology` → `reconcile`
    ile algılanır; çalışma zamanı yeni topolojiden yeniden kurulur, startup-config,
    err-disable, öğrenilmiş MAC/ARP ve syslog taşınır. Yeni topoloji Labber'da ifade
    edilemiyorsa oturum "bozuk" olur; her komut/değerlendirme "Motor değiştirilmez" hatası.
  - `engine-choice.js runtime()` oturum varken kalıcı çalışma zamanını döndürür; yoksa
    (karar anı, eski motor içeriği) eskisi gibi yeni kurar.
  - "İki motor uyuşmazlığı" denetimleri (`recordSharedPing`, `acProbe`, `state.equals`)
    Labber içeriğinde kaldırıldı (tek motor). Eski motor içeriğinde terminal değişmedi.
  - Kalıcılık: tarayıcı kaydı yalnız AğLab JSON'udur; sayfa yenilenince Labber içeriği
    kayıtlı JSON'dan yeniden başlar (running = startup). running/startup ayrımının
    kaydı L7'de.
- Akademi: `ACADEMY_CAPABILITIES` (labber: `state_adapter`, `icmp_probe`, `answer_input`);
  eksik yetenek → `on_unavailable` (`not_evaluated`).
- `tests/test_aglab_sim_embedded.py`: ürünün AgLabSim'e hangi API ile dokunduğunu her akışta
  tam küme olarak denetler (L3-a: `createSession`, `VpcsSession`/`IosSession` eklendi;
  içerik başına tek `createRuntime`).
- `tests/test_aglab_labber_terminal.py`: L3-a kabul testi.

## F — ders senaryoları (yapıldı)

- `simulator/network-scenarios.json`'a 10 tarif: `mgmt-*` (Konu #11 S1–S5) ve `eth-*`
  (Konu #3 S1–S5). Hepsi Labber kararında.
- Yeni tarif alanları (yalnız Labber):
  - `pending`: içerik yüklendikten sonra kaydedilmeden uygulanan komut blokları
    (`aglabLabber.applyPending`); başlangıçta running ≠ startup.
  - `verify.kind: "query"`: `checks: [{fn, args, field?, expected, label}]`, izinli
    fonksiyonlar `SHARED_QUERY_FNS` (network-scenarios.js). Argümanda cihaz adı → kimlik,
    `$MAC:<ad>` → MAC. Değerlendirme öğrencinin çalışma zamanının **kopyasında**
    (`aglabLabber.cloneRuntime`); PC kaynaklı `ping` hedefleri kopyada gerçek trafik
    gibi çalışır (MAC öğrenilir).
  - `verify.survivesReload: true`: kopyada bütün switch'ler kapatılıp açılır, hedefler
    yeniden denenir; kaydedilmeyen çözüm geçmez.
  - `verify.source` / `verify.target`: senaryonun hedef ping'i (varsayılan PC-01 → PC-02).
- Terminalden hedef ping'i başarılı ama `query` hedefi eksikse durum "Ping başarılı ama
  senaryo hedefi tamamlanmadı: …" (neden: eksik hedef ya da kaydedilmemiş çözüm).
- Parite: `eth-wrong-mask` ve `eth-duplicate-ip` başlangıcında eski motor ile Labber
  ayrışır (eski motor dönüş yolunu kurmuyor). Karar Labber; `UYUMLULUK_MATRISI.md` ve
  `tests/test_aglab_sim_parity.py` `KNOWN_DIFFS` (birebir eşleşme).

## L2-E — Labber'ın 13 labı

Kaynak: kullanıcının Labber deposundaki `labs/*.ts` (13 lab + `index.ts`; vlan-basics,
trunk-troubleshoot, trunk-hardening, campus-l2-l3, stp-load-balancing,
etherchannel-troubleshoot, l3-static-routing, mgmt-vlan, ospf-single-area, ospf-multiarea,
ospf-troubleshoot, routed-access, bpdu-guard) ve `tests/labs.test.ts`. `pdfs/` ve PDF
alıntıları **alınmaz**.

Önerilen yol:
1. `src/sim/labs/` altına taşı (README'de köken notu: kullanıcının kendi içeriği). Labların
   `objectives[].check(q)` fonksiyonları TypeScript'tir; Akademi JSON'una çevrilmez, kendi
   kimlikleriyle (`labber-*`) ayrı grup olur. Akademi kaynak SHA256 kayıtlarına karışmaz.
2. `src/sim-bridge/index.ts`'den `LABBER_LABS` (id, title, level, tags, brief) dışa aktar;
   `tests/test_aglab_sim_embedded.py` API listesini güncelle.
3. Kabul testi: Labber `labs.test.ts` desenini `tests/sim/labber-labs.test.ts` olarak al
   (başlangıçta en az bir hedef başarısız; `solution` CLI hatasız bütün hedefleri geçirir).
   Lab sayısını sabit yazma; `LABBER_LABS.length`'ten türet.
4. Motor tablosuna ayrı bölüm: `tools/build_lab_engine_map.py` → "Labber labları" (hepsi
   Labber; köprü kullanılmaz, LabDef doğrudan).
5. **Arayüz bağımlılığı:** bu labların çoğu OSPF/EtherChannel/routed port içerir; AğLab
   JSON'u ve eski CLI bunları ifade edemez. Öğrencinin labı arayüzde çözebilmesi için
   terminalin Labber `IosSession`'ına bağlı olması gerekir (L3-a). Öneri: **önce L3-a**,
   sonra E'nin arayüzü (E'nin içerik + test kısmı L3-a'dan bağımsız yapılabilir).

## L3-a — Cihaz CLI'si Labber'a bağlanır

Yalnız Labber kararındaki içerikte. Önerilen yol:
1. Kaynak gerçeği değiştir: Labber kararındaki içerik yüklenince **tek bir kalıcı**
   `LabRuntime` kurulur (`createRuntime(toLabber(t))`) ve oturum boyunca tutulur.
   Topoloji görünümü ve kayıt `toAglab(rt, original)` ile bu çalışma zamanından türetilir.
2. Terminal (`src/app/main.js` `command()` / cihaz seçimi): Labber içeriğinde komut
   `createSession(rt, dev)` ile açılan `IosSession`/`VpcsSession`'a gider (`exec`, `prompt`,
   `complete`, `help`). Cihaz başına oturum saklanır. Eski motor içeriğinde CLI aynen kalır.
3. Düzenleyicideki kablo/güç işlemleri `rt.setLink/setPower/setNic/moveCable`'a gider
   (L2-B/C'de hazır); syslog'lar (`rt.logs`) terminale yansıtılır.
4. `engine-choice.js` `runtime()` artık her seferinde yeni çalışma zamanı kurmaz; kalıcı
   olanı kullanır. Rozetteki "CLI eski motorda" notu ve CLI/Labber uyuşmazlık denetimi
   (`recordSharedPing`, `acProbe`) Labber içeriğinde kalkar (tek motor).
5. `toAglab` ifade edemediği Labber durumu için `BridgeError` atar (Port-channel, OSPF,
   statik rota, portfast …): Labber CLI'sinde bu komutlar kullanılınca kayıt/geri yazım
   açık hata vermeli, sessiz kayıp olmamalı.
6. Testler: `test_aglab_device_cli`, `test_aglab_vlan_lesson`, `test_aglab_ethernet_lesson`,
   `test_aglab_cli_vlan`. IOS biçimli çıktı yüzünden beklenti değişirse davranış değişikliği
   olarak gerekçesiyle güncelle; mümkünse metin yerine `LabQuery` ile türetilmiş durumu sor.

## L3-b — Simulation Mode olay adaptörü

`net.ts` `deliver()` atlamaları (`Hop[]`: cihaz, IP, çıkış arayüzü) ve `l2Domain()` BFS yolu
(`via.out/in` portları) → `simulator/packet-events.js` olay biçimi. ARP/Ethernet çerçeve
olayları üretilemiyorsa animasyon yalnız L3 atlamalarını gösterir ve bu UI'da yazılır.
Testler: `test_aglab_simulation_mode`, `test_aglab_frame_forwarding`, `test_packet_events`.
Not: `test_aglab_simulation_mode` donmuş saat pencerelerinde düğmelere klavyeyle basar
(`press()`); yük altında fare tıklaması sayfayı kaydırıp tuvali görüş dışına taşıyordu.

## Kurallar hatırlatması

- Sayıları sabit yazma (lab/senaryo sayısı) — ilgili JSON'dan türet (#56 bu yüzden üç testi
  düzeltti).
- `roas-*` senaryolarına ve `src/data/courses.json` / `course-details.json`'a dokunma (#56).
- `simulator/network-scenarios.json` Prettier ile biçimlendirilmez (#56 ile çakışma riski);
  yalnız hedef satırı düzenle.
- Kapsam dışı: Router/AD/özyineleme (L4), alt arayüz/DHCP/ACL/NAT/port security (L5), eski
  metin senaryoları (L6), kalıcılık ve eski motorun kaldırılması (L7).
