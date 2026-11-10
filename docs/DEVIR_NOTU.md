# Devir notu — Labber entegrasyonu (L4 → L5)

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
| L3-a terminal → IosSession/VpcsSession, tek kalıcı LabRuntime | #59 | birleşti |
| F bekleyen ders senaryoları (Konu #11, Konu #3) → Sorun Çöz | #60 | birleşti |
| E Labber'ın 13 labı (kaynak #61) | #62 | birleşti |
| L3-b Simulation Mode olay adaptörü | #63 | birleşti |
| L4 Router, AD, özyinelemeli statik rota; Akademi M4 + routing senaryoları | dal `claude/l4-router-routing` | PR açık (birleşmeyi bekliyor) |

**L4 PR'ı açık, sıradaki: L5** (alt arayüz/router-on-a-stick, DHCP/Server servisleri,
ACL, NAT, port security; PKT IOS metin yolu). Plan: `YENIDEN_YAPILANMA.md` L3 tablosu
sıra 4–8 ve "Aşamalar" L5 satırı. Bugün eski motorda kalan içerik ve gerekçeleri
`LAB_MOTOR_HARITASI.md` özet tablosunda (hepsi L5).

Not: birleşen dallar (`claude/e-labber-labs`, `claude/l3b-simulation-adapter`) oturumdan
silinemedi (GitHub proxy'si dal silmeye izin vermiyor, 403); depo arayüzünden silinmeli.

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
- Akademi: `ACADEMY_CAPABILITIES` (labber: `state_adapter`, `icmp_probe`,
  `icmp_source_interface` (L4), `answer_input`); eksik yetenek → `on_unavailable`
  (`not_evaluated`). L4'ten beri 40 labın hepsi Labber kararında; eski motor değerlendirme
  yolu (`academy.evaluate(..., 'legacy')`) M4 paritesi için test edilir.
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

## E — Labber'ın 13 labı (yapıldı)

- Kaynak #61 ile depoda: `src/labs/*.ts` (değiştirilmeden), testi `tests/sim/labs.test.ts`.
- `src/sim-bridge/index.ts` `LABBER_LABS` (= `LABS`) dışa açar.
- `simulator/labber-labs-ui.js`: Lab alanında Sorun Çöz panelinin altında ayrı grup
  (`#labberLabsPanel`): seçim, başlat, rozet, brief, hedef listesi (`rt.objectives()`),
  "Hedefleri kontrol et", referans çözüm. Terminal komutundan sonra hedefler yenilenir.
- `aglabLabber.startLab(def)`: köprü kullanılmaz, `createLab(def)`. Tuval için
  `labTopology(def)` yalnız çizim topolojisi üretir; geri yazım `labViewWrite`
  (switch adı = hostname, PC adresi, güç, kablo). Düzenleyiciyle topoloji değişirse oturum
  bozulur ("Labber labının topolojisi düzenleyiciyle değiştirilemez").
- Kayıt: üst alan `labberLab: {id}` (doğrulanır); sayfa yenilenince lab baştan başlar.
- Simulation Mode Labber labında yok (L3-b'ye kadar; eski motor kaydı üretilmez).
- Motor tablosu: "Labber labları (E)" bölümü; özet tablosunda ayrı satır.

## L3-b — Simulation Mode olay adaptörü

`net.ts` `deliver()` atlamaları (`Hop[]`: cihaz, IP, çıkış arayüzü) ve `l2Domain()` BFS yolu
(`via.out/in` portları) → `simulator/packet-events.js` olay biçimi. ARP/Ethernet çerçeve
olayları üretilemiyorsa animasyon yalnız L3 atlamalarını gösterir ve bu UI'da yazılır.
Testler: `test_aglab_simulation_mode`, `test_aglab_frame_forwarding`, `test_packet_events`.

**Yapıldı (L3-b):**
- `src/sim-bridge/events.ts` `pingTrace(rt, from, ip, portName)`: `net.ping`/`deliver`
  atlamaları; her atlamanın L2 yolu `l2Domain` BFS ağacının `via.out/in` zincirinden,
  mantıksal port (Port-channel dahil) → aynı iki cihaz arasındaki fiziksel kablo.
  Kayıtlar: `frame`, `wire` (kenar + çerçeve), `unicast` ileri kararı, `receive`,
  `ttl-forward`, `discard`, `icmp-delivered/undelivered`. ICMP istek ve yanıt; TTL router
  geçişinde azalır. ARP çerçeveleri üretilmez.
- L2 yolu çıkarılamazsa `l2: false`: kayıt yalnız L3 atlamaları; arayüz notu yazar.
- `packet-events.js` `fromLabber` (köken `labber`, not alanı); `simulation-playback.js`
  `load`/`matchWire` `labber` kökenini kabul eder; Simulation Mode durum satırı
  "Labber · … · not".
- `main.js` `labberSimulationTrace`: eski motor ping'i kaldırıldı; iz `ethernetLabberTrace`
  (`readEthernetTrace` bunu döndürür). Port adları AğLab yazımına çevrilir (köprü
  `portNames`; lab kipinde `labShortPort`). Labber labları (E) da Simulation Mode'u kullanır.
- Testler: `tests/sim/events.test.ts` (13 labda iz = ping, başarılı ping'de L2 yolu lab
  kabloları), `test_packet_events.cjs` (fromLabber), `test_aglab_frame_forwarding`
  (Labber senaryosu: başarısız ve başarılı), `test_aglab_simulation_mode` (AGL-001/005
  yakalaması `labber` kökenli, kablolar tuvalde eşleşir).

## L4 — Router, AD, özyinelemeli statik rota (yapıldı, PR açık)

- **Labber çekirdeği** (`src/sim`):
  - `SwitchDef.router` (types.ts): bütün portlar routed, varsayılanı `shutdown` (IOS),
    `ip routing` açık, VLAN DB/SVI/STP yok (`config.ts defaultSwitchConfig`). `l3`
    denetimleri `l3 || router` (net.ts `isRouter`, ospf.ts, show.ts).
  - CLI (`cli/ios.ts`): router'da `vlan`/`spanning-tree`/`errdisable`, switchport arayüz
    komutları, `interface vlan|port-channel` ve L2 `show` komutları yok
    (`ROUTER_HIDDEN_*`); router arayüzü: `shutdown`, `description`, `ip address`, OSPF
    arayüz ayarları. `ip route … <1-255>` (AD; aynı ağ + next-hop AD'yi günceller),
    `no ip route ağ maske [nh [ad]]` (`%No matching route to delete`), kendi adresine
    next-hop reddedilir. running-config router biçiminde (`routerRunningConfig`), AD ≠ 1
    yazılır; `show ip route` `[AD/0]`, `show ip route A.B.C.D` "distance N".
  - `net.ts routeTable`: prefix başına en düşük AD kurulur (bağlı 0, statik `ad`, OSPF 110;
    eşitlikte statik, sonra yapılandırma sırası). Statik rota next-hop'u doğrudan bağlı
    değilse oracle kuralıyla özyinelemeli çözülür (en uzun eşleşme, çözülemeyen aday
    atlanır, rota kendisi üzerinden çözülmez); çözülemeyen rota kurulmaz. `RouteEntry.via`
    paketin verildiği doğrudan bağlı next-hop. `routeOut(d, dev, dst)` ve
    `LabQuery.routeFor(dev, dst)` rota seçimini (ARP'sız) döndürür.
- **Köprü** (`src/sim-bridge/bridge.ts`): `Router` → `router: true` (model PKT'den ya da
  `ISR4331`, port listesi yoksa AğLab şablonu `g0/0, g0/1` + arayüz adları); arayüz
  `ip/mask/enabled` (kaydı olmayan port açık, eski motor gibi); `staticRoutes`
  (`distance` → `ad`, geçersiz/hizasız/yinelenen/AD 0 reddedilir); `route` (listede
  varsayılan yoksa AD 1 varsayılan rota); `ospf{pid, routerId, networks}`. Alt arayüz,
  router ACL/NAT/relay ve diğer OSPF alanları `unsupported` (L5). `Server` servissizse PC gibi
  uç; açık servis `unsupported`. `toAglab` router'ı geri yazar (özgün rota nesnesi aynıysa
  aynen; yeni rota `distance` ile); geri yazılamayan durum (loopback, açıklama, arayüz OSPF
  ayarı, passive-interface, `no ip routing` …) `BridgeError`.
- **Ürün**: routing senaryolarında `SRV-01` servissiz (yalnız ICMP hedefi; `main.js`).
  `aglabSharedEngine.probe()` Labber içeriğinde Labber ping'i. Akademi kaynak arayüzlü
  ICMP (`engine-choice.js labberSourceBinding`, eski motorla aynı `sourceBinding` kuralı).
  `aglabLabberSession.query()` test kancası.
- **Testler**: `tests/sim/router.test.ts` (router, AD, LPM, özyineleme, döngü, `no ip route`,
  OSPF ile AD, area uyuşmazlığı); `parity.test.ts` statik rota paritesi gerçek Router
  üzerinden (fark 0; `route-recursive-next-hop` bilinen farklardan çıktı) ve
  `test_engine_routing.cjs` senaryoları; `routing-acceptance.test.ts` kabul testlerinin
  (next_hop, v11, v13, traceroute, icmp) topolojileri Labber'da aynı sonuç. Playwright:
  Akademi testleri bütün labları kapsar (`test_aglab_academy_engine` M4 eski motor/Labber
  ölçüt paritesi), `test_aglab_labber_terminal` router terminali, `test_aglab_network_features`
  ospf-area Labber durumundan.
- **Desteklenmeyen / farklı** (UYUMLULUK_MATRISI "L4"): `ping … ttl`/Time Exceeded ve
  `show ethernet events` Labber'da yok (içe aktarılan topolojiler eski motorda kaldığı için
  kabul testleri orada çalışır); olmayan hosta Host Unreachable yerine zaman aşımı; eşit
  AD'li statiklerde ECMP yok (oracle gibi ilk satır).
- **İçe aktarma** (`importTopology`) hâlâ eski motordadır: Labber oturumu yalnız Sorun Çöz
  senaryosu, Akademi labı ve Labber labında kurulur. İçe aktarılan topolojinin Labber'a
  alınması L5'teki PKT IOS metin yoluyla birlikte ele alınmalı.

## Kurallar hatırlatması

- Sayıları sabit yazma (lab/senaryo sayısı) — ilgili JSON'dan türet (#56 bu yüzden üç testi
  düzeltti).
- `roas-*` senaryolarına ve `src/data/courses.json` / `course-details.json`'a dokunma (#56).
- `simulator/network-scenarios.json` Prettier ile biçimlendirilmez (#56 ile çakışma riski);
  yalnız hedef satırı düzenle.
- Kapsam dışı (L4 sonrası): alt arayüz/DHCP/ACL/NAT/port security (L5), eski metin
  senaryoları (L6), kalıcılık ve eski motorun kaldırılması (L7).
