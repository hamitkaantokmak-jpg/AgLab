# Devir notu — Labber entegrasyonu (I-1 → FHRP → L6 → L7) ve arayüz yenilemesi

Bu not, oturum bağlamı dolmak üzereyken bırakılan durumu ve kalan işleri anlatır.
Plan: [YENIDEN_YAPILANMA.md](YENIDEN_YAPILANMA.md) (L3 tablosu, L4 "Aşamalar", L5).
Motor kararları: [LAB_MOTOR_HARITASI.md](LAB_MOTOR_HARITASI.md). Kararlar ve bilinen
farklar: [UYUMLULUK_MATRISI.md](UYUMLULUK_MATRISI.md) (sonundaki "Labber" bölümü).

## Arayüz yenilemesi (L7'den sonra)

Referans taslak: `docs/arayuz/` (dal `claude/arayuz-taslak`; README, dolu-1..4.png, wire/dolu.html).
Plan: `SONRAKI_ISLER.md` "Arayüz yenilemesi", "Adlandırma", "Öğrenci/öğretmen ayrımı kalkar".
Her adım ayrı PR, bir öncekinin dalı üstüne; birleştirilmez.

| Adım | Dal | Durum |
|---|---|---|
| PR 1 iskelet, adlandırma, tek paket | #91 | birleşti |
| PR 2 Simülatör çalışma alanı, çözüm kilidi | #92 | birleşti |
| PR 2b Simülatör artıkları | #93, `claude/arayuz-2b-simulator` (taban `main`) | açık |
| PR 3 Sorun Çöz | — | sırada (#93 dalından) |
| PR 4 Müfredat haritası ve ders | — | sırada |

PR 1:
- `src/index.html`: üst bar (`#agTop`: logo, `#areaTabs` dört bölüm, `#agSearch`, `#agTopTools`
  tema düğmesi), sol ikon şeridi (`#agRail`, `data-rail`), `main.ag-main`; yeni bölümler
  `#area-live` (Canlı Lab: rapor + operatör dışa aktarımı, `lab-evidence-ui.js`) ve
  `#area-advanced` (Gelişmiş: regresyon denetimi). Eski başlık/hero ve "1·Öğren 2·Uygula"
  yön çubuğu kaldırıldı; senaryo ilerlemesi (`#progressText`) Sorun Çöz'de.
- `src/app/shell.js`: şerit, adres çubuğu (#mufredat, #simulator, #sorun-coz, #canli-lab,
  #gelismis) ve eski bağlantı yönlendirmesi (#lab, #area-lab, #gercek-lab, #real-lab …), arama
  (müfredat konu araması). `src/styles/08-shell.css`: taslak renkleri (açık) ve koyu karşılığı.
- Müfredat bloğundaki sabit koyu renkler token'a bağlandı (açık temada okunmuyordu; main'de de).
- Adlandırma: ürün metinlerinde "Lab" (bölüm) → Simülatör, "Gerçek Lab" → Canlı Lab; "lab"
  yalnız alıştırma anlamında (Akademi labı, yönlendirmeli lab). Kayıt anahtarları aynı.
- Tek paket: `run_pipeline.py`, `verify_packages.py` (tek argüman), CI'daki öğretmen ZIP adımı
  kaldırıldı; çözümler ve kaynaklar aynı ZIP'te, HTML'e yalnız öğrenci alanları gömülür.
- Test: yeni `test_aglab_shell.py`; `network_features` (Gelişmiş), `advanced_engines` (Canlı Lab)
  gezinmesi.

PR 2 (dal `claude/arayuz-2-simulator`):
- `src/app/sim-workspace.js` + `src/styles/09-simulator.css`: `#ptWorkbench` taslaktaki ekran 3 olur
  (üst çubuk `#agSimHead`, görev `#agSimTask` + canlı hedefler `#agSimGoals`, tuval `#agSimStage`,
  inceleme `#agSimInspect` Port/Cihaz/Olaylar, alt şerit `#agSimDock` terminal + Simulation Mode
  zaman çizelgesi); görev seçimi altta `#agSimCatalog`. Mevcut denetimler yeniden oluşturulmaz,
  taşınır (kimlikler aynı). Bağlam: Akademi > Labber labı > ortak senaryo > serbest
  (`aglabSimWorkspace.context()`); bağlam geçişi anında, canlı hedefler/hızlı show 120 ms sonra.
- Hızlı show: `aglabLabberSession.peek(dev, 'show …')` geçici oturumda (durum değişmez).
- Cihaza tıklamak yüzen `#ptDeviceCliDialog` açmaz; terminal sekmesi + komut satırı odağı.
- Çözüm kilidi (kullanıcı kararı uygulandı): `tools/build_academy_solutions.py` →
  `academy/solution-data.js` (`.prettierignore`'da, `run_pipeline` `--check`); kilit 3 başarısız
  kontrol ya da bütün ipuçları (`aglab-solution-lock-v1`); çözüm yalnız düğmeyle DOM'a eklenir.
  `verify_packages.py` yasak yerine gömülü çözüm = öğretmen JSON denetimi. Labber labının
  `#labberLabSolution` kutusu kaldırıldı. **Ortak senaryoların ipucu/çözüm kutusu PR 3'te aynı
  kilide bağlanmalı** (`test_aglab_scenario_cause` o kutuyu bekliyor; PR 3'te uyarlanır).
- Simülatör açıkken `scroll-behavior: auto` (üst çubuk ⇄ katalog arası yumuşak kaydırma testleri
  ~3 kat yavaşlatıyordu). Akademi "değiştir" onayı basılan düğmenin yanında açılır.
- Test: yeni `test_aglab_sim_workspace.py`; uyarlananlar PR açıklamasında. Tam hat 89 PASS.
- Kullanıcı testi düzeltmeleri (aynı PR): 1024 px üst bar/sütunlar, palet ayrı sütun, tuval üstü
  araç çubuğu yok (kablo işlemleri paletteki kablo aracında `#agSimCablePanel`; testler
  `open_cable_tool`), zaman çizelgesi etiketleri + ayrıntı satırı, Olaylar sekmesi kendiliğinden
  güncellenir, show çıktısı satır kırar, istem ve `.tag` kontrastı, şerit zemini, görev kartında
  hedefler üstte, bağlantı etiketleri port adları. Labber lab ipuçları kademeli
  (`src/labs/hint-tiers.ts`: neye bak → kavram → komut).
- PR 3'e not: Sorun Çöz "LABBER MOTORU" rozetinin açık tema kontrastı ortak `.tag` kuralıyla
  düzeldi; Sorun Çöz ekranının kendisi ve ortak senaryo ipuçlarının kademesi/çözüm kilidi PR 3'te.

PR 2b (dal `claude/arayuz-2b-simulator`, main'den):
- Görev kataloğu: üç kart = eski paneller (`#academyPanel`, `#labberLabsPanel`, `#sharedScenarioPanel`,
  kimlikler korunur); satırlar `#agSimCatList-{academy|labber|shared} .ag-cat-row` (ad, seviye,
  durum). Durum: `aglab-academy-progress-v1`, yeni `aglab-labber-progress-v1`
  (labber-labs-ui.js, bütün hedefler sağlanınca), `aglab-shared-engine-progress-v1`. Uzun
  metinler `#agSimCatalogOthers` ("Diğer araçlar") altında. `academy.catalog()`,
  `academy.searchMatches()`.
- İpucu yalnız sağlanmamış hedefleri dolaşır; bitince "İpuçları açık".
- Kap ≤ 1100 px: Görev 220 px | tuval; İnceleme tuvalin altında. ≤ 760 px: yerleşim sıfırlanır.
  Çakışan tuval etiketleri `ag-label-hidden` (üzerine gelince görünür). Terminal sekme okları.
  ≤ 520 px: palet tek satır, tuval yüksekliği ≥ ekran genişliği.
- Tema: kayıtlı seçim yoksa `prefers-color-scheme`, yoksa açık; düğme eylemi söyler + aria-label.
- PC/sunucu hızlı show: `show ip`, `show arp` (+ sunucuda `show services`).

Kalan (PR 3–4; PR 3 → `claude/arayuz-2b-simulator` dalından), bir öncekinin dalı üstüne (PR 2 → `claude/arayuz-1-iskelet`):

- **PR 2 Simülatör çalışma alanı** (taslak `dolu-3.png`): üstte başlık + motor rozeti + Sıfırla /
  İpucu / Kontrol et; solda görev ve canlı hedef listesi (Akademi ölçütleri `academy.evaluate`,
  Labber labı `aglabLabberLabs.objectives()`, ortak senaryo `sharedQueryGoal` — sağlandıkça
  işaretlenir); ortada tuval (`#ptCanvas`); sağda inceleme paneli (Port/Cihaz/Olaylar sekmeleri,
  `#ptDeviceInfo` verisi, hızlı show çıktısı Labber oturumundan); altta cihaz sekmeli terminal
  (`#ptTerminal`, `#ptCliDevice`, `#ptCliInput`) ve yanında Simulation Mode zaman çizelgesi
  (`simulation-ui.js`). "Çözümü göster": birkaç başarısız Kontrol et ya da bütün ipuçlarından sonra
  **Kullanıcı kararı (PR 2'de uygulanacak): öğretmen çözümleri HTML'e gömülür.**
  `verify_packages.py`'deki "Teacher fields embedded in HTML" yasağı PR 2'de gerekçesiyle
  kaldırılır — gerekçe: öğrenci/öğretmen ayrımı kalktı (`SONRAKI_ISLER.md`), uygulama kendi kendine
  öğrenme içindir, Sorun Çöz senaryolarının çözümleri (`network-scenarios.json` `solution`) zaten
  gömülüdür. Yasağın yerine gelecek denetimler (test + paket doğrulaması):
  1. Çözüm yalnız "Çözümü göster" kilidi açılınca görünür: kilit açılana kadar çözüm DOM'da
     **oluşturulmaz** (gizli öğe olarak da bulunmaz).
  2. Kilit birkaç başarısız "Kontrol et"ten ya da bütün ipuçları kullanıldıktan sonra açılır.
  3. Çözümler tek pakettedir (`academy/teacher/` ZIP'te) ve her labın öğretmen çözümüyle 100/100
     kontrolleri sürer.
- **PR 3 Arıza senaryosu ekranı** (`dolu-4.png`): belirti kartı; Belirti → Teşhis → Kanıt →
  Düzeltme; düzeltmeden önce katman seçici (L1, L2, L3, servis, uygulama); terminalden iğnelenen
  kanıt defteri; kök neden çözülene kadar gizli (#86, `sharedCauseReveal`). Değerlendirme: bağlantı
  (mevcut hedefler), doğru kök neden (seçilen katman/teşhis ⇄ `cause`; gerekirse tariflere yalnız
  ekleme olarak `layer`), gereksiz değişiklik (başlangıç/bitiş running-config farkı ⇄ çözümün
  farkı; fazlası uyarı). "Çözümü göster" (ipuçlarının son basamağı; tarifte `solution` var).
  Kavramsal BGP aynı ekranda "motor yok" rozetiyle (`TROUBLESHOOT_TASKS` `bgp`).
- **PR 4 Müfredat haritası ve ders** (`dolu-1.png`, `dolu-2.png`): seviye başına konu kartları
  (durum, pratik türü etiketi Simülatör/Canlı Lab/Okuma), kaldığın yerden devam, son arıza
  senaryoları; ders ekranında yedi parçalı adım çubuğu, çıktı okuma bloğunda satır vurgusu ve yan
  açıklama, konunun senaryolarına geçiş (`docs/MUFREDAT.md` eşlemesi, `student-flow.js` kurs →
  ayrıntı eşlemesi). İçerik verisine dokunulmaz.

Uygulama notları (PR 1'de öğrenilenler):
- `simulator/network-scenarios.js` `accessibilityStyle` bütün `button,input,select`'e
  `background-color: var(--panel2) !important` ve `color: var(--text) !important` verir; taslak
  düğme biçimleri için daha özgül seçiciyle `!important` gerekir (bkz. `08-shell.css`).
- `01-base.css`'teki genel `.active { background: #1b355a }` kuralı her `.active` öğeyi boyar.
- Eski stil dosyalarında (03–07) sabit koyu renkler vardı; PR 1 bunları token'a bağladı
  (`--panel`, `--panel2`, `--line`, `--text`, `--muted`, `--accent`, `--accent-soft`,
  `--accent-text`). Yeni ekranlar yalnız token kullanmalı.
- `data-area` yalnız `#areaTabs`'ta olmalı (testler `[data-area="lab"]` tıklar; ikinci eşleşme
  Playwright strict mode hatası verir). Şerit `data-rail` kullanır.
- Ekran görüntüleri: 1280 px, `localStorage aglab-theme` ile tema; taslakla yan yana görüntü
  PIL ile (`docs/arayuz/pr1/`). PR açıklamasında raw.githubusercontent bağlantıları.

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
| L4 Router, AD, özyinelemeli statik rota; Akademi M4 + routing senaryoları | #64 | birleşti |
| AGL-036 öğretmen çözümü (`no ip route`), öğretmen CLI testi gerçek başlangıçtan | #65 | birleşti |
| L5-a router alt arayüzü / 802.1Q; `subif-missing` + `roas-*` | #66 | birleşti |
| CI tetikleme: push yalnız main, dal başına `concurrency` | #67 | birleşti |
| L5-b DHCP/DNS; `relay-trunk` | #68 | birleşti (aynı işi yapan #69 kapatıldı) |
| L5-f CDP/LLDP | #70 | birleşti |
| L5-e port security; `port-security` | #72 | birleşti |
| L5-c ACL | #73 | birleşti |
| L5-d NAT/PAT; `nat-pat` | #74 | birleşti |
| Plan: L7 sonrası işler (`SONRAKI_ISLER.md`) | #71 | birleşti |
| L5-g sunucu HTTP servisi (TCP 80, `curl`) | #75 (main'den) | birleşti |
| L5-h PKT IOS metin yolu (hoşgörülü mod) | #76 (#75'in dalından) | birleşti |
| L5-i TTL, Time Exceeded, traceroute, extended ping | #77 (#76'nın dalından) | birleşti |
| EtherChannel AğLab modelinde (paralel iş) | #80 (main'den) | birleşti |
| I-1 içe aktarma ve düzenleyici Labber'a | #81 (main'den, dal `claude/i1-workspace-labber`) | birleşti |
| FHRP (HSRP + VRRP) Labber'da | #82 (#81'in dalından) | birleşti |
| Seviye 1/2 dersleri (paralel iş) | #78, #79 | birleşti |
| L6 motor kullanmayan eski içerik | #84 (main'den, dal `claude/l6-legacy-content`) | birleşti |
| Ortak senaryo kök nedeni gizli | #86 | birleşti |
| L7a içerik (bgp-as, 3 switching senaryosu) + oracle kararı | #87 (main'den, dal `claude/l7a-icerik-oracle`) | açık |
| L7b+c eski motorların kaldırılması + kalıcılık v24 | #88, dal `claude/l7b-eski-motor-kaldirma` (L7a dalından; PR tabanı L7a dalı) | açık |

**Durum:** #75–#86 birleşti. **L7a (#87)** ve **L7b+c** açık; birleştirilmedi. L7b ve L7c tek PR:
eski `startupConfig` kaydını yalnız eski motor işliyordu; v24 olmadan eski motoru kaldırmak kayıtlı
çalışmaları "simüle edilemiyor"a düşürür ve `test_aglab_switch_svi` D'yi bozardı. #87 birleşince
L7b+c PR'ının tabanı `main`'e çevrilmeli. Arayüz yenilemesine başlanmadı.

### L7b+c özeti

- Tek motor Labber. Kaldırılanlar: eski çekirdek motor (`main.js` ping/yol bulucu/eski CLI ~1600
  satır; `simulator/` icmp, traceroute, routing-path, routed-ethernet, mac-learning, ethernet
  iletimi), borck-netsim (`third_party/`, `borck-*`, `tools/build_borck_engine.cjs`, CI adımı),
  `engine-manager*`, `engine-adapter-prototype.cjs`, köprünün `engineDecision`'ı
  (`report.expressible`). `src/engine` ürüne gömülmez (oracle); yeni `src/engine/portsec.js`.
- Yeni: `simulator/aglab-model.js` (modelin saf yardımcıları, motor değil), `simulator/packet-trace.js`
  (yalnız Labber izi). İfade edilemeyen topoloji "Simüle edilemiyor" oturumu (labber-session).
- Köprü düzeltmesi: boş topoloji artık ifade edilebilir.
- Kalıcılık v24: `aglab-topology-v24` + `labber.state`; v23 ve öncesi taşınır (eski anahtar
  kalır), taşınamayan kayıt uyarı + indirme. Ayrıntı UYUMLULUK_MATRISI "L7b", "L7c".
- HTML: 3 013 168 (L7a) → 2 766 358 bayt (−246 810); main'e göre 3 007 015 → 2 766 358.
- Testler: silinen `test_aglab_borck_engine`, `test_aglab_browser_benchmark`, node
  `test_borck_engine`, `benchmark_borck_engine`, `test_engine_manager`,
  `test_engine_adapter_parity`, `test_engine_adapter_prototype`; uyarlananlar PR açıklamasında.
- Bilinen Labber farkları (düzeltilmedi): başarısız ARP kaynak MAC öğrenimi, `show arp`,
  `copy startup-config running-config`, bayat FDB.

### L7a özeti

- `bgp-as` kaldırıldı (BGP kapsam dışı; kavramsal alıştırmalar L6'da). Ürün içeriğinin hepsi
  Labber kararında (`LAB_MOTOR_HARITASI.md`).
- `access-vlan`, `trunk-allowed`, `native-vlan` kodla kurulumdan tarife (`topology` + `query`);
  `loadSharedSwitchScenario` silindi. Başlıklar belirti, kök neden gizli (#86).
- `test_aglab_sim_parity` emekliye ayrıldı (oracle ürüne gömülü eski motordu); vitest
  `parity.test.ts` `src/engine`'i ürün dışından oracle olarak kullanmaya devam eder.
- Test değişiklikleri (gerekçe UYUMLULUK_MATRISI "L7a"): `test_aglab_network_features` test_04
  (BGP) silindi, test_06'dan `bgp-as` çıktı; `test_aglab_labber_terminal`
  `test_legacy_content_keeps_legacy_terminal` silindi; `test_aglab_engine_choice` eski motor
  senaryosu testi "her ortak senaryo Labber" testiyle değişti; `test_aglab_sim_embedded` eski motor
  bloğu çıktı.
- L7b'ye kalanlar L7b+c'de yapıldı (yukarıda).

### L6 (#84) özeti

- Sorun Çöz'ün 25 eski metin senaryosu kaldırıldı; `TROUBLESHOOT_TASKS` (aynı kimlik ve sıra)
  her görevi Labber karşılığına açar, `bgp` kavramsal alıştırmadır. İlerleme: `aglab-passed-final`
  (eski kimlikler) + Labber karşılığının tamamlanması.
- "Hazır deneyler" mini lab'ı (`labRun`) kaldırıldı; dokuz deney Labber senaryolarına açılır.
- Rota atölyesi: AD/LPM/varsayılan rota → senaryo; metric ve ECMP → Labber görünümü
  (`WORKSHOP_LAB`, `workshopView`: gerçek `show ip route` + `LabQuery.routeFor`). Uçtan uca
  teşhis kontrol listesi kavramsal. Protokol atölyesi: OSPF area → senaryo; OSPF passive → Labber
  görünümü; BGP (3) kavramsal.
- Yeni senaryolar (yalnız ekleme): `dhcp-client-static`, `dhcp-service-down`,
  `eth-mac-learning`, `eth-unknown-unicast`, `acl-http-blocked`.
- Yol tablosu `LAB_MOTOR_HARITASI.md` "L6" (üründen üretilir), gerekçeler UYUMLULUK_MATRISI "L6".
- Test: `test_aglab_l6_legacy_content.py`; `test_aglab_ui` ve `test_aglab_network_features`
  uyarlandı.

### I-1 (#81) özeti

- Çalışma alanı (içe aktarma, kayıt, `reset`, Serbest Çalışma) `workspaceDecideEngine` ile köprü
  kararını alır; Akademi labı, Labber labı ve Sorun Çöz senaryosu yüklenirken atlanır
  (senaryonun kendi kararı; tek çalışma zamanı).
- PKT IOS metin yolu yalnız metin güncelse (fark yok, hostname = ad, AğLab görünümü = JSON).
- Kayıt kaybı (3. sınıf) düzeldi: `dynamic auto` → AğLab `access` gösterimi.
- Motor ve ürün bulguları: [MOTOR_BULGULARI.md](MOTOR_BULGULARI.md). Kararlar:
  UYUMLULUK_MATRISI "I-1".
- 34 test Labber çıktısına gerekçeyle uyarlandı. `test_aglab_frame_forwarding` ve
  `test_aglab_routed_frames`'in bayat FDB/"Paket adımı" bölümü eski motor kararındaki topolojide
  (`tests/aglab_test_support.py` `legacy_engine`); L7'de eski motorla silinir.
- `test_aglab_simulation_mode`: `freeze()` `pause_at` yarışı giderildi; 5 seri + yük altında 5
  paralel koşu geçti.
- Yerel: `python run_pipeline.py` 91/91, vitest 566/566, `tsc`, Prettier, black, Python 3.11
  derlemesi temiz.

### FHRP (#82) özeti

Dal `claude/fhrp-hsrp-vrrp`, I-1 dalından (Playwright testi içe aktarılan topolojinin Labber'da
açılmasına dayanır); PR tabanı `claude/i1-workspace-labber`. #81 birleşince taban `main`'e çevrilmeli.
- Motor `src/sim/fhrp.ts`: üyeler (yayın alanı + protokol + grup + VIP), seçim, preempt geçmişi
  (`LabRuntime.fhrpActive`; lab başlangıcı/kayıttan açılışta sıfırlanır, düzenleyici uzlaştırmasında
  `labber-session.js` taşır), track, sanal MAC; `net.ts arpResolve/owns` VIP'yi Active/Master'a verir.
- IOS: `standby …`, `vrrp …`, `track N interface <if> line-protocol` (`(config-track)#`),
  `show standby [brief]`, `show vrrp [brief]`, `show track`; running-config satırları; STATECHANGE syslog'u.
- Köprü: router arayüzü/alt arayüzü `hsrp`, `vrrp`; router `tracks`. Gidiş-dönüş birebir.
- Ürün: `validateTopologyData` alanları kabul eder; `SHARED_QUERY_FNS` += `fhrpActive`; eski motor
  kararında rozet "HSRP/VRRP eski motorda modellenmez".
- Testler: `tests/sim/fhrp.test.ts` (22), `tests/test_aglab_fhrp.py` (7 bölüm). Doğrulanmayanlar
  UYUMLULUK_MATRISI "FHRP"de (syslog ara durumları, VIP alt ağ denetimi). Aynı grup + farklı VIP: HSRP tek
  seçim + `%HSRP-4-DIFFVIP1`, VRRP iki Master (kullanıcı düzeltmesi).


Kalan PR'ların kapsamı (kullanıcı talimatı):
- **L5-c ACL:** standart ve genişletilmiş, numaralı ve isimli ACL; `ip access-group in/out`;
  `show access-lists` (eşleşme sayaçlarıyla). Testler: örtük deny, sıra numarası, yön hatası.
  Oracle: `src/engine/acl.js` (`aclEvaluate`, `aclPathDecision`) + `tests/node/test_engine_stp_acl.cjs`.
- **L5-d NAT/PAT:** `ip nat inside/outside`, statik NAT, `overload` ile PAT,
  `show ip nat translations`; `nat-pat` senaryosu Labber'a geçer (sunucusunda HTTP servisi
  açık: ya servis kapatılır ya da HTTP modellenir). Oracle: `src/engine/nat.js` +
  `tests/node/test_engine_nat_dhcp.cjs`.
- **L5-e Port security:** `switchport port-security` (maximum, mac-address sticky, violation
  shutdown/restrict/protect), err-disabled ve `shutdown`/`no shutdown` ile kurtarma,
  `show port-security interface`; `port-security` senaryosu Labber'a geçer. Oracle:
  `simulator/port-security.js` + `tests/node/test_port_security.cjs`; Labber'ın err-disable
  altyapısı (`rt.errdis`) yeniden kullanılır.
- **L5-f CDP/LLDP:** yapıldı (aşağıdaki bölüm).

CI (`aglab-ci.yml`): `push` yalnız `main`'de tetiklenir, PR'lar `pull_request` ile koşar;
`concurrency` aynı dalın süren eski koşusunu iptal eder. `real-lab-live.yml` değişmedi.

**Yerel araç notu (bu oturum):** oturumda paket kurulumu kapalıydı; `esbuild 0.25.12` ve
`vitest` yerelde yoktu. `src/sim.generated.js` yerelde esbuild 0.28.2 ile üretilip sabit
sürümün çıktı biçimine çevrildi (fark yalnız `__commonJS` yardımcı işlevi ve yapıcı parametre
özellikleriydi; main'in dosyası birebir yeniden üretildi) ve CI'ın tekrar üretim kontrolüyle
doğrulandı. Yeni TypeScript kodunda yapıcı parametre özelliği (`constructor(public x)`)
kullanılmadı. `tests/sim` yerelde küçük bir vitest uyumluluk koşucusuyla, kesin sonuç CI'da
vitest ile alındı.

Not: birleşen dallar (`claude/e-labber-labs`, `claude/l3b-simulation-adapter`,
`claude/l4-router-routing`) oturumdan silinemedi (GitHub proxy'si dal silmeyi reddediyor);
depo arayüzünden silinmeli.

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
  `tests/test_aglab_sim_parity.py` `KNOWN_DIFFS` (birebir eşleşme; L7a'da emekliye ayrıldı).

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

## L4 — Router, AD, özyinelemeli statik rota (#64, birleşti)

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

## L5-a — router alt arayüzü / 802.1Q (#66, birleşti)

- **Labber** (`src/sim`):
  - `SwitchConfig.subifs` (yalnız router): `{parent, vlan, native, shutdown, description,
    ip, l3?}`, anahtar tam ad (`GigabitEthernet0/0.10`).
  - Veri yolu (`net.ts`): routed port segmenti etiket başına ayrı düğüm
    (`routedNode(d, dev, port, tag)`, `vlan = -(tag*1000 + port + 1)`; etiket 0 = etiketsiz
    fiziksel/native). Router→switch: etiketli çerçeve switch portunda `ingress(…, 't', tag)`;
    switch→router: `egress` 'u' → etiket 0, 't' → VLAN etiketi. Alt arayüz üst port açık ve
    bağlıyken L3 arayüzüdür (üst portun MAC'i). `routedTagOf`, `nodeVlan` yardımcıları;
    Simulation Mode izi (`events.ts`) etiketi gösterir.
  - CLI: `interface Gi0/0.N` (yalnız router, var olan fiziksel port), `encapsulation dot1Q N
    [native]` (aynı portta aynı VID / ikinci native reddedilir), `ip address` (önce
    encapsulation; IOS mesajı), `shutdown`, `description`, `no interface Gi0/0.N`;
    running-config ve `show ip interface brief` alt arayüzü gösterir. Parser `ifnum` `.N`
    kabul eder (yer kararı oturumda).
- **Köprü**: AğLab `g0/0.N{ip, mask, enabled, parent, vlan, encapsulation}` iki yönde; eski
  CLI'nin `encapsulation: ''` (yapılandırılmamış) biçimi korunur, CLI ile silinen alt arayüz
  görünümden de çıkar. Native, açıklama, alt arayüz OSPF ayarı → `BridgeError`. Geçersiz port,
  uyuşmayan `parent`, ISL, geçersiz VLAN, yinelenen VID, encapsulation'sız IP → `rejected`.
- **Ürün**: kodla kurulan senaryolar yüklenirken önceki Labber oturumu kapatılır
  (`loadSharedScenarioContent` → `aglabLabber.stop()`); `roas-pc-gateway` ve
  `roas-two-faults` çözümündeki PC-02 komutu VPCS sözdizimine çevrildi (yalnız o satırlar).
  `aglabSharedEngine.reach` bilerek eski motor ping'i kalır (tarayıcı paritesinin oracle'ı).
- **Testler**: `tests/sim/subif.test.ts` (eksik/yanlış etiket, üst port kapalı, access port,
  native, IOS kuralları, silme, Simulation Mode izi), `bridge.test.ts` "alt arayüz (L5-a)",
  `parity.test.ts` dot1q oracle vakaları, `routing-acceptance.test.ts` next_hop alt arayüz
  adımı Labber'da; Playwright: `test_aglab_inter_vlan_lesson` Labber kararı + hedefi,
  eski motor örnekleri `nat-pat`'a taşındı.
- **Açık içerik notları** (UYUMLULUK_MATRISI "L5-a"): `roas-switch-port-access` belirti metni
  ("VLAN 10 PC'leri gateway'e ulaşıyor") eski motora göre; Labber'da access port etiketli
  çerçeveyi düşürür. roas ipuçlarındaki `ipconfig` VPCS'te `show ip`. Tarif satırlarına
  dokunma kuralı nedeniyle düzeltilmedi.

## L5-b — DHCP/DNS (yapıldı, PR açık)

- **Labber çekirdeği** (`src/sim`):
  - `dhcp.ts`: `dhcpDiscover(d, pc, bindings)` (yerel sunucu → relay; başarısızlık nedeni
    `nolink | noserver | relay-unreachable | relay-noserver | nopool | exhausted`),
    `poolFor`, `poolRange`, `helpersOf`, `apipaFor`, `isApipa`, `dnsLookup`, `dnsRecords`.
  - `types.ts`: `SwitchConfig.dhcpPools{ad: {net, defaultRouter, dns}}`, `dhcpExcluded[{lo, hi}]`;
    `L3Opts.helpers[]` (routed port, alt arayüz, SVI); `PcConfig.dhcp/dns/services{dhcp, dns}`;
    `PcDef.name/server`; `DhcpBinding`.
  - `runtime.ts`: kiralar `rt.dhcp` (RAM; `save/load` taşır, reload ve `dhcpClear` siler),
    `dhcpRequest(pc)`, `dhcpRelease(pc)`, `dhcpLeaseOf(pc)`. Sunucu yanıt vermezse PC'nin
    link-local adresi korunur, yoksa `169.254.x.y/16` atanır.
  - CLI: `ip dhcp pool` kipi (`(dhcp-config)#`: `network A.B.C.D mask|/n`, `default-router`,
    `dns-server`), `ip dhcp excluded-address`, arayüzde `ip helper-address`,
    `show ip dhcp binding|pool`, `clear ip dhcp binding *|A.B.C.D`; running-config.
    PC (VPCS): `ip dhcp [-r|-x]`, `ip dns`, `nslookup`; sunucu: `service dhcp|dns on|off`,
    `show services`, `show ip dhcp binding`, `show dns`.
  - `query.ts`: `dhcpLease(pc)`, `dhcpBindings(dev)`, `dnsLookup(pc, ad)`.
- **Köprü**: Router `dhcpPools`, `dhcpExcluded`, arayüz/alt arayüz `helperAddress`; Server
  `services.dhcp/dns` (açık `http` → `unsupported`); PC `dhcpLease`, `dns`. AğLab modelinde
  olmayan durum (ikinci helper, SVI helper, switch üzerinde havuz) `BridgeError`.
- **Ürün**: `main.js` cihaz alanı doğrulaması `dns`, `dhcpPools`, `dhcpExcluded` kabul eder;
  `relay-trunk` sunucusunda yalnız DHCP servisi açık; tarif çözümü ve görev metni `ip dhcp`.
  `network-scenarios.js`: Labber'da `verify.kind: "dhcp"` (görünümde `dhcpLease`),
  `SHARED_QUERY_FNS` += `dhcpLease`, `dnsLookup`. `labber-session.js lineKind`: DHCP/nslookup
  hata satırları.
- **Testler**: `tests/sim/dhcp.test.ts` (havuz, dışlama, tükenme, relay yok, yanlış helper,
  dönüş yolu, servis, DNS, reload); `bridge.test.ts` "köprü: DHCP/DNS (L5-b)" (oracle
  `allocateLease` ile aynı adres); `tests/test_aglab_dhcp_dns.py` (senaryo Labber'da, başarısız
  ve başarılı durumlar, eski motorla parite fark 0, kayıt).
- **Kararlar / doğrulanmayanlar**: `UYUMLULUK_MATRISI.md` "L5-b" (çakışma denetimi, kira
  süresi, `show ip dhcp pool` ayrıntıları, hata metinleri "doğrulanmadı").

## L5-f — CDP/LLDP (yapıldı, PR açık)

- **Labber**: `src/sim/discovery.ts` — komşular türetilmiş durumdan anında: fiziksel link up
  (kablo, güç, shutdown, err-disable), karşı uç PC değil, CDP için iki cihazda `cdp run` ve iki
  portta `cdp enable`; LLDP için iki cihazda `lldp run`, karşı portta `lldp transmit`, yerel
  portta `lldp receive`. Ayarlar: `SwitchConfig.cdpRun` (undefined = açık), `lldpRun`
  (undefined = kapalı), `PhysIfConfig.cdp/lldpTx/lldpRx` (undefined = açık). running-config
  yalnız varsayılandan farkı yazar (`no cdp run`, `lldp run`, ` no cdp enable`, …).
  `show cdp neighbors [detail]`, `show cdp interface [<if>]`, `show lldp neighbors [detail]`;
  Holdtime sabit (CDP 180, LLDP 120). `%CDP-4-NATIVE_VLAN_MISMATCH` yalnız iki uçta CDP
  açıkken yazılır (`cdpBetween`).
- **Köprü**: AğLab modelinde karşılığı yok; `toAglab` bu alanları yok sayar (BridgeError değil).
  Düzenleyici değişikliğinde (`reconcile`) eski çalışma zamanından taşınır; sayfa yenilenince
  kayıtlı AğLab JSON'undan başlanır ve varsayılana döner (UYUMLULUK_MATRISI "L5-f").
- **Testler**: `tests/sim/discovery.test.ts` (IOS sütunları, detail, kablo/güç/shutdown ile
  düşme, `no cdp enable`, `no cdp run`, native VLAN syslog'u, LLDP kapalı/tek uç/iki uç,
  transmit/receive yönü); `test_aglab_labber_terminal` terminalden `show cdp neighbors`.
  Eski motorda CDP/LLDP yok: parite karşılaştırması yok (fark 0).

## L5-e — Port security (yapıldı, PR açık)

- **Labber**: `src/sim/portsec.ts`. Kabul kararı yapılandırmadan (`psAdmits`, `net.ts pcNode`):
  kaynak MAC yapılandırılmış/sticky listede ya da güvenli adres sayısı `maximum`'un altında
  değilse uç ağa çıkamaz (üç modda da). Yan etkiler uç trafik gönderdiğinde
  (`LabRuntime.hostSends`: VPCS `ping`, `trace`, `ip dhcp`): öğrenme (sticky → config, değilse
  `rt.psDynamic`), ihlal (shutdown → `rt.errdis` + `errCause` `psecure-violation` + syslog;
  restrict → sayaç + syslog; protect → sessiz). Dinamik adresler port düşünce silinir.
  bpduguard kurtarma döngüsü yalnız `bpduguard` nedenli portları kurtarır. CLI: `switchport
  port-security [maximum | violation | mac-address [sticky] H.H.H | mac-address sticky]`,
  `no` biçimleri, dinamik/trunk portta IOS ret metni; `show port-security [address |
  interface X]`, `show interfaces status [err-disabled]` (neden sütunu). running-config IOS
  sırasıyla.
- **Köprü**: `portSecurity` ⇄ yapılandırılmış adresler (özgün MAC yazımı korunur),
  `errdisabled` ⇄ `rt.errdis` (`BridgeResult.errdis`); sticky → `BridgeError`.
- **Ürün**: `$SOURCE_MAC` IOS yazımı (H.H.H); `aglabSharedEngine.probe()` Labber içeriğinde
  kaynak PC'nin gerçek trafiği (`aglabLabber.hostSends`).
- **Testler**: `tests/sim/portsec.test.ts`, `bridge.test.ts` "port security (L5-e)",
  `parity.test.ts` 200 rastgele yapılandırmada `port-security.js` ile; Playwright
  `test_aglab_network_features` test_05/06 (Labber).

## L5-c — ACL (yapıldı, PR açık)

- **Labber**: `src/sim/acl.ts` — tipler `Acl/AclEntry/AclAddr/AclPort` (types.ts),
  `SwitchConfig.acls`, `L3Opts.aclIn/aclOut`. `parseEntry` (standart: kaynak; genişletilmiş:
  `ip|icmp|tcp|udp`, `host/any/A W`, `eq|neq|gt|lt|range`, ICMP türü), `aclDecide` (ilk eşleşme,
  örtük deny, tanımsız/boş liste izin verir). `net.ts deliver(d, from, dst, spec)` paket
  (`Packet`) taşır; her routing cihazında giriş arayüzünün `aclIn`'i ve çıkışın `aclOut`'u
  (kaynak cihazın kendi trafiği hariç) uygulanır; ret → `unreach` + `filtered`. `ping` geri
  dönüşü `echo-reply`/`unreachable` paketiyle; `PingResult.back`. Sayaçlar
  `LabRuntime.countAcl(paket, …)` (VPCS/IOS ping ×5, traceroute ×1), `aclHits`.
- **CLI**: `access-list <1-199> …`, `no access-list N`, `ip access-list standard|extended NAME`
  kipi (`[seq] permit|deny …`, `no seq`), `ip access-group X in|out` (`l3OptPatterns`),
  `show access-lists [X]`, `show ip access-lists [X]`, `show ip interface [<if>]`,
  `clear access-list counters`; traceroute `!A`. running-config numaralı ve isimli listeler.
- **Köprü**: router `acls[]` ⇄ listeler (türü çıkarılır), `aclIn/aclOut` ⇄ L3Opts (router portu
  ve alt arayüz). Kaynak portu, `eq` dışı işleç, ICMP türü → `BridgeError`.
- **Testler**: `tests/sim/acl.test.ts` (örtük deny, yanlış yön, yanlış wildcard, sıra hatası,
  genişletilmiş, isimli, traceroute `!A`, geçersiz satırlar, router trafiği, tanımsız liste),
  `bridge.test.ts` "ACL (L5-c)", `parity.test.ts` `acl.js` ile, `routing-acceptance` next_hop
  ACL adımı; Playwright `test_aglab_labber_terminal` terminalden ACL.

## L5-d — NAT/PAT (yapıldı, PR açık)

- **Labber**: `src/sim/nat.ts` — tipler `NatConfig/NatStatic/NatRule` (types.ts),
  `SwitchConfig.nat`, `L3Opts.nat`. `natOutbound` (inside→outside, yönlendirmeden sonra,
  çıkış ACL'inden önce: statik, bilinen akış, kurallar — ACL'in açık `permit` satırı; arayüz
  ya da havuz; overload'da port/ICMP kimliği, çakışırsa bir sonraki; havuz tükenirse düşer),
  `natInbound` (outside→inside, yönlendirmeden önce), `natAliases` (global adresler için ARP).
  `net.ts deliver`: `Hop.inIf/src/dst`, `Delivery.pkt/nat/natMiss/natted`,
  `PacketSpec.natPending`; `ping` dönüşü çevrilmiş kaynağa gider ve geri çevrilir.
  `LabRuntime.natTable/natHits/natMisses`, `recordNat` (yalnız CLI ping/traceroute),
  kayıt/yükleme; `Derived.natTable` (runtime ile aynı dizi).
- **CLI** (yalnız router): arayüz/alt arayüzde `ip nat inside|outside`; `ip nat inside source
  static [tcp|udp] …`, `ip nat pool … netmask …`, `ip nat inside source list ACL pool|interface
  … [overload]`, `no` biçimleri (çeviri varken onay sorusu); `show ip nat translations`,
  `show ip nat statistics`, `clear ip nat translation *`; running-config.
- **Köprü**: `natRole` ⇄ `L3Opts.nat`, `natOverload` ⇄ tek kural, `natTranslations` ⇄
  `BridgeResult.nat` → runtime. Statik/havuz/overload'suz/birden çok eşleme → `BridgeError`.
  Yan düzeltme: ACL kimliğinin AğLab türü (`"1"`/`1`) geri yazımda korunur.
- **Senaryo**: `nat-pat` Labber'da; `WEB-PUBLIC` servissiz ve ağ geçitsiz (genel adres
  alanındaki sunucunun özel ağa rotası yok).
- **Testler**: `tests/sim/nat.test.ts` (PAT, TCP/UDP, ters roller, ACL eşleşmiyor/tanımsız,
  havuz tükendi, statik, IOS hata iletileri, onay sorusu, kayıt/yükleme, Simulation Mode izi),
  `nat-parity.test.ts` (`nat.js`), `bridge.test.ts` "NAT (L5-d)"; Playwright
  `test_aglab_labber_terminal` `nat-pat` terminalden; eski motor örneği `bgp-as`.

## L5-g — Sunucu HTTP servisi (yapıldı, PR açık)

- **Labber**: `src/sim/http.ts` — `httpGet(d, from, dst, port)`: TCP SYN (49153 → port)
  `deliver` ile (ACL, NAT dahil); ulaşılan cihaz HTTP dinliyorsa (sunucu, `services.http`,
  port 80) yanıt, dinlemiyorsa RST; yanıt dönmezse zaman aşımı; router ICMP unreachable →
  `unreach`. `LabQuery.http`. `PcConfig.services.http`.
- **CLI (VPCS)**: PC'de `curl [http://]host[:port][/path]` (Labber eki; ad DNS ile), sunucuda
  `service http on|off`, `show services`. ACL sayacı ve NAT tablosu `curl` ile güncellenir.
- **Köprü**: `services.http` iki yönde; açık HTTP artık `unsupported` değil.
- **Senaryo**: `nat-pat`'ta `WEB-PUBLIC` yeniden HTTP servisli.
- **Testler**: `tests/sim/http.test.ts`, `http-parity.test.ts` (KNOWN_DIFFS:
  `legacy-http-needs-icmp`, `outside-acl-sees-translated-source`), `bridge.test.ts`
  "HTTP (L5-g)"; Playwright `test_aglab_labber_terminal.test_http_from_terminal`.

## L5-h — PKT IOS metin yolu (yapıldı, PR açık)

- **Labber**: `src/sim/config-text.ts` `applyConfigText` (hoşgörülü mod; satır sınıfları
  applied/ignored/unmodeled; durum dökümü anlamı: metindeki arayüz `shutdown` yazmıyorsa açık;
  `!` bölüm sınırı; `end` sonrası uygulanmaz; reddedilen kip bloğu önceki kipe uygulanmaz;
  zararsız satır listesi). `createLab(def, { lenient: true })` → `rt.configReport`.
- **Köprü**: `src/sim-bridge/cli-import.ts` `cliImport(topology)` → yapısal sonuç, CLI yoluyla
  kurulmuş çalışma zamanı, satırlar, `diffs` (sessiz fark), `extended` (açık fark);
  `modeledProjection`, `importReportWithCli`. `AgLabSim` dışa aktarır.
- **Ürün**: içe aktarmada ve kayıtlı çalışma açılışında terminalde "IOS METİN YOLU (Labber CLI)"
  özeti; `aglabImportCli.report()`. Kayda yazılmaz. **Motor kararı değişmedi**: içe aktarılan
  topoloji hâlâ eski motorda (I-1'in işi).
- **Dönüştürücü ve Labber düzeltmeleri**: UYUMLULUK_MATRISI "L5-h" (trunk `except`, port-security
  access/H.H.H, access VLAN oluşturma, range tam ad bitişi, port-security maximum 1–1024).
- **Testler**: `tests/sim/cli-import.test.ts`; Python kabul testleri her dönüşümde
  `assert_cli_path_matches` (Node: `tests/sim_node_runner.cjs`); `pkt-sample-matrix.json`
  yeni vaka `synthetic-port-security-dynamic-port`.

## L5-i — TTL, Time Exceeded, traceroute, extended ping (yapıldı, PR açık)

- **Labber**: `deliver` `PacketSpec.ttl` → `Delivery.kind 'expired'` (transit router, giriş
  ACL'inden sonra); `ping(d, from, dst, { ttl, src })` Time Exceeded dönüşüyle (`reason
  'expired'`, `expiredFrom`); `traceProbe` (TTL'li UDP sondası; hop/dest/unreach/none).
- **CLI**: IOS `traceroute` (TTL döngüsü, 30 atlama, `!H`/`!A`/`*`), `ping` seçenekleri ve
  etkileşimli extended ping (`&` kodu), VPCS `ping -T/-c` ve `trace` (8 atlama).
- **Simulation Mode**: `pingTrace(..., { ttl })` `ttl-expired`, `icmp-time-exceeded` kayıtları;
  ürün `ping … -T N`'yi izde uygular.
- **Testler**: `tests/sim/ttl-trace.test.ts`; `test_aglab_labber_terminal`
  `test_ttl_traceroute_extended_ping`; `acl.test.ts`/`nat.test.ts` traceroute beklentileri
  TTL'li sondaya göre (gerekçeli).

## EtherChannel AğLab modelinde (yapıldı, PR açık; main'den)

- Köprü: switch arayüzünde `channelGroup {id, mode}`, `po<N>` Port-channel arayüzü; iki yönde.
  Grupta protokol uyuşmazlığı, 1-48 dışı numara reddedilir; Port-channel kaydı yoksa ilk üyeden.
- Ürün: `validateTopologyData` alanları kabul eder; `SHARED_QUERY_FNS` `etherchannel`.
- Testler: `tests/sim/etherchannel-bridge.test.ts` (LACP kanalı, askıya alınan üye, passive–passive,
  JSON'dan kanal, geçersiz alanlar; toAglab → toLabber sonrası summary aynı);
  `test_aglab_labber_terminal.test_etherchannel_from_terminal`.
- #79'daki EtherChannel okuma dersi (`docs/dersler/etherchannel.md`) artık senaryoya çevrilebilir.

## Kurallar hatırlatması

- Sayıları sabit yazma (lab/senaryo sayısı) — ilgili JSON'dan türet (#56 bu yüzden üç testi
  düzeltti).
- `roas-*` senaryolarına ve `src/data/courses.json` / `course-details.json`'a dokunma (#56).
- `simulator/network-scenarios.json` Prettier ile biçimlendirilmez (#56 ile çakışma riski);
  yalnız hedef satırı düzenle.
- Kapsam dışı: BGP (`bgp-as` L7a'da kaldırıldı; kavramsal alıştırma), PKT IOS metin yolu, içe aktarmanın Labber'a
  geçmesi, arayüz değişikliği, Canlı Lab; eski metin senaryoları (L6), kalıcılık ve eski
  motorun kaldırılması (L7).
- `src/sim` içinde yapıcı parametre özelliği (`constructor(public x)`) ekleme: yerel esbuild
  sürümü ile sabit sürüm bu kalıbı farklı derler (bkz. yerel araç notu).

### Arayüz PR 3–4 için kullanıcı talimatı (son tur)

PR 3 — Sorun Çöz (dolu-4.png): belirti kartı; Belirti → Teşhis → Kanıt → Düzelt → Doğrula adım
çubuğu; senaryo listesi solda taslağın kartlarıyla. Ortak senaryoların ipucu/çözüm kutusu
Simülatör'deki aynı kilide bağlanır (3 başarısız doğrulama ya da sağlanmamış her basamağın komut
ipucu); ipuçları kademeli (neye bak → kavram → komut). `network-scenarios.json` `hints` sırası
buna uymuyorsa ne kadarının uymadığını **raporla, içeriği değiştirme** (kullanıcı düzeltecek).
Kök neden seçimi ve "kök neden çözülene kadar gizli" (#86, `test_aglab_scenario_cause`) korunur.
Açık temada bütün rozet ve ikincil metinlerin kontrastı (WCAG AA) test edilir.

PR 4 — Müfredat haritası ve ders (dolu-1/2.png): seviye başına konu kartları (başlanmadı/sürüyor/
tamam, puan), arama kutusu konulara bağlı; ders ekranında yedi parçalı adım çubuğu; "Simülatör'de
aç" ve "Sorun Çöz'de aç" doğru görevi yükler; senaryosuz okuma derslerinde bu adımlar gizlenir
ya da "bu konuda alıştırma yok" der.

Her PR: testleri gevşetme; değişen seçiciler tablosu; 1280 ve 1024 px, iki temada önce/sonra
görüntüleri; taslaktan sapmalar gerekçesiyle.
