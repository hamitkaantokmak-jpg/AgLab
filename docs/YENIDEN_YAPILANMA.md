# AğLab yeniden yapılanma planı

> **Durum (2026-11-08):**
>
> - 1. adım (#43) ve 2. adım (#44) birleşti.
> - 3. adımın L2'den bağımsız dilimleri (#45) davranış değiştirmeyen haliyle
>   birleşir; `src/engine` oracle olarak kalır. L2/MAC/ARP çıkarımı iptal.
> - **Karar:** Labber (`faarik-network/labber`) simülatörünün `sim/` motoru AğLab'ın
>   tek ağ motoru olacak.
> - Bu plan kullanıcı tarafından onaylandı (#47). Her aşama ayrı PR'dır ve bir
>   sonraki aşamaya kullanıcı onayı olmadan geçilmez.

## Neden

İnceleme sırasında görülen yapısal sorunlar:

1. **Çekirdek motor yalnızca HTML'nin içindeydi.** `findPath`, `routeLookup`, CLI,
   çizim ve kalıcılık (~1.300 satır, ~390 KB JS) hiçbir kaynak dosyada yoktu.
   *(1. adımda giderildi.)*
2. **HTML aynı anda derlemenin girdisi ve çıktısıydı.** *(1. adımda giderildi.)*
3. **Aynı kavramları farklı modellerle çözen birden çok motor var.** Her yeni
   özellikte "doğrunun kaynağı hangisi?" sorusu doğuyor. Envanter:
   - Topoloji/CLI çekirdeği: `src/app/main.js` içindeki IIFE.
   - Sorun Çöz'ün eski metin senaryo modeli: `main.js` başındaki `scenarios`,
     `execute()` ve `ping()`.
   - Lab deneyleri modeli: `labRun()`.
   - borck-netsim.
   - FRR Gerçek Lab.
4. Kod tek satıra sıkıştırılmıştı. *(2. adımda Prettier/Black ile giderildi.)*

## Hedef mimari

```
src/
  sim/                 Labber motoru (TypeScript) — AğLab'ın TEK ağ motoru
  sim-bridge/          AğLab JSON ⇄ Labber LabDef/SwitchConfig köprüsü, değerlendirme adaptörü
  sim.generated.js     sim/ + sim-bridge/ → tek IIFE (derleme çıktısı, commit edilir)
  app/ styles/ data/   ürün katmanı: Akademi, dersler, Sorun Çöz, PKT içe aktarma,
                       simülasyon/paket animasyonu, Gerçek Lab arayüzü
  engine/              (#45) eski motordan çıkarılmış saf modüller → yalnızca
                       ŞARTNAME/ORACLE olarak testlerde kullanılır, ürüne gömülmez
tools/build_html.py    tek derleyici → AgLab_Final_PKT_Import.html (çevrimdışı, tek dosya)
real-lab/              FRR referans laboratuvarı ("kâhin")
```

Korunacaklar (değişmez):

- 40 Akademi laboratuvarı ve kaynak SHA256 kayıtları.
- `.pkt` içe aktarma ve özgün arşivi geri yükleme.
- Tek dosya, çevrimdışı HTML.
- `html-build.sha256` ve CI'daki tekrar üretim kontrolü.
- "Desteklenmeyeni çalışıyormuş gibi gösterme" ilkesi.

## Adımlar

1. **Kaynağı HTML'den çıkar:** *tamamlandı (#43).*
2. **Okunabilirlik ve test düzeni:** *tamamlandı (#44).* `tests/`, ortak fixture,
   keşif tabanlı manifest, Prettier/Black, `tools/js_equivalence.cjs`.
3. **Motor API'si:** *askıda (#45, taslak).*
   - Çıkarılmış ve parite ile kanıtlanmış modüller: `src/engine/ipv4`, `topology`,
     `routing`, `stp`, `acl`, `nat`, `dhcp`.
   - Bunlar artık ürün motoru olmayacak; Labber'a özellik taşırken **şartname ve
     oracle** olacaklar (bkz. L2.3).
   - L2/MAC/ARP ve ping yolu çıkarımı iptal; bu alanı Labber karşılıyor.
   - #45 bu haliyle (davranış değiştirmeyen, testli) birleştirilir; oracle main'de
     durur.
4. **Labber'ı tek motor olarak entegre et:** *(eski "borck-netsim'i emme" adımının
   yerini alır).* Aşağıdaki alt planın L0–L7 aşamaları; her aşama ayrı PR.
5. **Arayüz yenilemesi:** motor geçişi (4. adımın L7 aşaması) **bitmeden başlamaz**.
   Kapsam:
   - Üç ekran: **Öğren**, **Sorun Çöz**, **Serbest Lab**.
   - Sağ tık menüleri: cihaz, kablo ve tuval için ayrı bağlam menüleri.
   - Sekmeli CLI: her cihaz için ayrı sekme.
   - CLI'de `Tab` ile tamamlama ve `?` ile yardım (Labber `cli/parser.ts` trie'si
     ve `cli/help.ts` üzerinden).
   - Ping animasyonu: Simulation Mode olay adaptörü (L4 L3 aşaması) üzerinden.
   - Mevcut Playwright UI testleri bu adımda yeni ekranlara taşınır; silinmez veya
     gevşetilmez.
6. **FRR fark testleri:** kapsam aynı, karşılaştırılan taraf artık Labber motoru.
7. **Belge sadeleştirme:** tek mimari belgesi ve tek uyumluluk matrisi. Matris
   Labber + köprü kapsamını gösterir.

---

## Labber entegrasyon planı

### Kaynak ve inceleme notları

- **İncelenen kaynak:** kullanıcının yüklediği arşiv; git başı `74a0925`.
  - `sim/`: ~4.700 satır TypeScript.
  - `labs/`: 13 lab.
  - `tests/`: vitest ile yazılmış `sim.test.ts` ve `labs.test.ts`.
  - `app/`: Nuxt 4 / Vue arayüzü.
- **Arşivde olmayanlar:** `LICENSE` dosyası ve `pdfs/` klasörü. `pdfs/` zaten
  git'te yok sayılıyor (`.gitignore`).
- **Mimari (Labber `CLAUDE.md`):** yapılandırma düz JSON (`SwitchConfig`). Her şey
  bu yapılandırmadan *türetiliyor*:
  - `engine.ts` `derive()`
  - `ospf.ts` `computeState()`
  - `net.ts`: ARP, rota tablosu, paket yürüyüşü, ping
  - `runtime.ts`: running/startup, err-disable, syslog
  - `cli/`: IOS oturumu
  - `query.ts`: `LabQuery`
- **Dış bağımlılık:** `sim/` içinde yok. Yalnızca kendi göreli importları var; DOM,
  `window`, `localStorage` kullanmıyor.
- **Determinizm:** `runtime.ts` syslog zaman damgası için yalnızca `Date.now()`
  kullanıyor. Bu çalışma zamanına ait; derleme çıktısını etkilemiyor.

### L1. Paketleme: `sim/` → tek IIFE → HTML

1. **Kaynak yeri:**
   - Labber'ın `sim/` klasörü `src/sim/` altına kopyalanır.
   - `third_party/` altına **değil**; AğLab'ın kendi kaynağı olarak.
   - Köken notu README'de "Motor kaynağı ve köken" başlığı altında yazılır: proje
     adı, kaynak depo, alınan commit (`74a0925`), tarih, "kendi kaynağımız" ifadesi.
   - `labs/` (13 lab) içeriği kullanıcıya ait ve dağıtım hakkı kullanıcıda. Bu
     içerik L2 aşamasında ayrı bir içerik grubu olarak alınır (bkz. L4).
   - `app/` ve `nuxt.config.ts` alınmaz; AğLab'ın kendi arayüzü kullanılır.
   - `pdfs/` ve PDF'lerden alıntı **hiçbir zaman** alınmaz (bkz. L6).
2. **Derleyici:** sabit sürümlü **esbuild**.
   - Depoda `esbuild 0.25.12` zaten kilitli (`package-lock.json`).
   - `tsc` IIFE paketleme yapmadığı için yalnızca tür denetimi için kullanılır.
   - Komut (`tools/build_sim.cjs`):
     `esbuild src/sim-bridge/index.ts --bundle --format=iife --global-name=AgLabSim --platform=browser --target=es2020 --charset=utf8 --legal-comments=none`
   - Çıktı `src/sim.generated.js` dosyasına yazılır ve commit edilir; bugünkü
     `borck-engine.generated.js` ile aynı desen.
   - Kaynak haritası ve zaman damgası yok, girdi sırası sabit. Bu yüzden çıktı
     deterministik.
3. **Gömme:**
   - `tools/build_html.py` `MODULES` tablosuna `"SIM": ["src/sim.generated.js"]` eklenir.
   - `src/app/main.js` içinde `//@@module SIM@@` yer tutucusu bulunur.
   - Global ad yalnızca `AgLabSim` olur.
   - `html-build.sha256` ve `build_html.py --check` olduğu gibi kalır.
4. **CI'a eklenecek adımlar:**
   - `npm ci` → `npm run build:sim` → `git diff --exit-code -- src/sim.generated.js`
     (tekrar üretim kontrolü).
   - `build_html.py` iki kez çalıştırılıp çıktılar `cmp` ile karşılaştırılır (mevcut).
   - Tür denetimi: sıkı bir `tsconfig.sim.json` (`strict`, `noUncheckedIndexedAccess`,
     `moduleResolution: bundler`) ve sabit sürümlü `typescript`.
   - Labber `CLAUDE.md` uyarısı: tsc 7, hata olsa bile 0 ile çıkıyor. CI adımı bu
     yüzden çıktıda `error TS` geçerse başarısız olur.
   - Labber `package.json` sürümleri `^` ile veriyor; AğLab'a tam sürümle alınır.
5. **Motor testleri:**
   - Labber'ın `sim.test.ts` testleri vitest'e bağlı. İki seçenek:
     - `vitest` tam sürümle devDependency olarak alınır ve pipeline'a ayrı bir
       Node grubu eklenir.
     - Testler `node:test`'e çevrilir.
   - Önerim birincisi: Labber'dan gelecek güncellemelerle fark küçük kalır.
   - `labs.test.ts` Labber lablarına bağlı. Labs alınmadığı için yerini köprü/senaryo
     testleri alır (L4).
6. **Bütçe:**
   - Derlenmiş motorun boyutu (tahmin ~150–200 KB) ve 300 cihazlık
     `test_aglab_large_topology` süresi L0'da ölçülür.
   - `derive()` her değişiklikte tüm durumu yeniden hesaplıyor; performans riski
     orada ölçülür (bkz. L6).
   - Bütçe aşılırsa bir sonraki aşamaya geçilmez.

### L2. Veri modeli köprüsü (`src/sim-bridge/`)

**AğLab topoloji JSON'u** (v23; `convert_pkt_to_aglab.py` ve kayıtlı topolojiler):

- `devices[]`: `{id, name, type: PC|Server|Router|Switch, x, y, enabled, ip, mask, gateway, vlan, vlans[], stpPriorities, interfaces{fa0/1: {mode, vlan, allowed[], nativeVlan, enabled, errdisabled, ip, mask, parent, encapsulation, aclIn/aclOut, natRole, helperAddress, portSecurity…}}, staticRoutes[], route, acls[], natOverload, services, config.runningConfig}`
- `links[]`: `{a, portA, b, portB, up}`
- `sourceArchive`

**Labber modeli:**

- `LabDef.devices`:
  - `SwitchDef{id, kind:'switch', model, mac, ports[] (kanonik adlar), l3, needsEncap, x, y}`
  - `PcDef{id, kind:'pc', mac, x, y}`
- `LabDef.links`: `{a:[dev,port], b:[dev,port]}`
- Çalışma durumu: `SwitchConfig` (her switch için), `PcConfig{ip, prefix, gw}`, startup.

**Dönüşüm kuralları (yapısal yol, `toLabber(aglabJson) → {def, running, pcs, report}`):**

| AğLab | Labber | Not |
|---|---|---|
| `id` | cihaz `id` | Kimlik korunur; `name` → `hostname` |
| `x, y` | `x, y` | — |
| Port adı `fa0/1`, `g0/0`, `gi0/1`… | `canonIf` → `FastEthernet0/1` | Bilinmeyen ad **reddedilir ve raporlanır**; sessiz düşürme yok |
| `type: Switch` | `SwitchDef`, `l3` = arayüzde IP veya `ip routing` varsa | `model` sabit bir 2960/3560 eşlemesi |
| `type: PC` | `PcDef` + `PcConfig{ip, prefix: maske→önek, gw}` | Geçersiz maske raporlanır |
| `type: Server` | **Var (L4; servisler L5-b)**: `PcDef{server: true, name}` (uç) | `services.dhcp`/`services.dns` → `PcConfig.services`; `services.http` → `PcConfig.services.http` (L5-g) |
| `type: Router` | **Var (L4)**: `SwitchDef{router: true, l3: true}`, routed portlar | L3 tablosu sıra 2 — tamamlandı; alt arayüz/ACL/NAT/relay L5 |
| `vlans[]` | `vlans{id: ad}` | — |
| `interfaces.*.mode/vlan/allowed/nativeVlan` | `L2IfConfig.mode/accessVlan/allowed/nativeVlan` | AğLab'da `allowed` listesi yok ↔ Labber'da `null` = tümü |
| `interfaces.*.enabled:false` | `shutdown: true` | — |
| `stpPriorities{vlan: p}` | `stpPriority{vlan: p}` | Labber VLAN kimliğini eklemeden saklıyor; sys-id-ext dönüşümü testle sabitlenir |
| `staticRoutes[]`, `route` | `routes[]` (`ad`); `route` = listede varsayılan rota yoksa AD 1 varsayılan rota | **Var (L4)**: AD ve özyinelemeli next-hop — L3 tablosu sıra 3 tamamlandı |
| Router `ospf{pid, routerId, networks}` | `OspfConfig` | **Var (L4)**; diğer OSPF ayarları geri yazılamaz → `BridgeError` |
| MAC | `AgLabMacAddress.resolve` | Labber benzersiz MAC istiyor; mevcut çözücü kullanılır |
| `links[].up:false`, `device.enabled:false`, PC `eth0.enabled:false` | **Var (L2-B)**: `LinkDef.up`, `off`, `nicDown`; çalışırken `setLink`/`setPower`/`setNic` | L3 tablosu sıra 1 — tamamlandı |
| `sourceArchive`, `config.runningConfig` | köprüden **olduğu gibi geçer** | Özgün `.pkt` geri yükleme etkilenmez |

**Ters yön (`toAglab(runtime) → aglabJson`):**

- Kalıcılık (localStorage v23 → v24), dışa aktarma ve Akademi `state.equals`
  değerlendirmesi için gerekli.
- Özellik testi: desteklenen alanlarda `toAglab(toLabber(x)) == x`.
- Desteklenmeyen alanlar opak olarak taşınır ve rapora "modellenmedi" diye yazılır.

**PKT için IOS metin yolu (değerlendirme; L5-h'de uygulandı — `src/sim/config-text.ts`, `src/sim-bridge/cli-import.ts`, UYUMLULUK_MATRISI "L5-h"):**

PKT dönüştürücüsü cihaz başına `config.runningConfig` satırlarını zaten saklıyor. Bu
satırlar doğrudan Labber CLI'sine verilebilir (`IosSession` global config modunda,
`createLab` `initialConfig` gibi).

- Artıları:
  - Tek ayrıştırıcı olur; Cisco anlamı Labber'ın IOS tablolarında kalır.
  - `% Invalid`/`% Incomplete` dönen her satır **görünür biçimde** raporlanabilir.
    Bu, AGENTS.md'deki "sessiz veri kaybını raporla" ilkesiyle örtüşüyor.
  - Bugün Python dönüştürücüsünde yeniden yazılan IOS alt kümesi tekrar
    yazılmamış olur.
- Eksileri:
  - `createLab` ilk geçersiz satırda istisna atıyor. Satır satır kabul/ret
    raporu üreten **hoşgörülü bir mod** gerekir.
  - PC/Server ve JSON kaynaklı topolojilerde (Akademi `initial_topology`, Sorun
    Çöz senaryoları, kayıtlı çalışmalar) IOS metni yok; yapısal yol yine gerekli.
  - Router yapılandırmaları Router türü gelene kadar uygulanamaz.
- **Öneri:** iki yol birlikte kullanılır.
  - JSON kaynaklı her şey için yapısal yol esastır.
  - PKT içe aktarımında `runningConfig`, hoşgörülü modda Labber CLI'sine verilir.
  - Yapısal dönüşümle CLI uygulamasının sonucu, modellenen alanlarda
    **karşılaştırılır**. Fark CI'da test hatasıdır; kabul edilmeyen satırlar içe
    aktarma raporuna eklenir.
  - Ölçüt `pkt-sample-matrix.json`'daki gerçek/sentetik örnekler ve
    `tests/test_aglab_pkt_*.py`'dir.

### L3. Özellik farkı ve Labber'a taşıma sırası

AğLab'da olup Labber'da olmayanlar. Her biri Labber'ın türetilmiş mimarisine aynı
sırayla eklenir:

1. `types.ts` yapılandırma alanı
2. `engine.ts`/`net.ts` türetme adımı
3. `query.ts` sorgusu
4. `cli/ios.ts` + `show.ts` (running-config) + `help.ts`
5. Birim testi (başarılı **ve** başarısız durum)

Oracle, eski AğLab davranışıdır: #45'teki `src/engine/*` modülleri ve parite/birim
testleri ile mevcut Playwright testleri. **Fark çıkarsa sessizce eşitlenmez:** ya
Labber (Cisco'ya daha yakınsa) doğru kabul edilip uyumluluk matrisine yazılır, ya
oracle'a uyulur. Karar PR'da belirtilir.

| Sıra | Özellik | AğLab'da şu an | Labber'da | Oracle / kabul testleri | Gerekçe |
|---|---|---|---|---|---|
| 1 | Bağlantı durumu (`link.up`), cihaz gücü (`enabled`) | Var | **Var (L2-B)** | `topology.linkUp` + `test_engine_routing`; Akademi AGL-003/004/005/010/028/031/033/040 | M1 labları buna bağlı |
| 2 | **Router cihaz tipi** — **tamamlandı (L4)** | Var (Router, varsayılan routed portlar, `ip routing` gerekmez) | L4: `SwitchDef.router` (routed portlar, `ip routing` açık, switch komutları yok) | `routing.js` + `test_engine_routing`; Akademi M4 (AGL-031…040, 10 lab) | 10 Akademi labı ve tüm routing senaryoları |
| 3 | Statik rotada AD (floating static) ve özyinelemeli next-hop — **tamamlandı (L4)** | Var | L4: `StaticRoute.ad`; next-hop oracle kuralıyla özyinelemeli çözülür, çözülemeyen rota kurulmaz | `routing.js` LPM/AD/özyineleme testleri; `floating-static`, `unresolved-next-hop`, `lpm-next-hop` senaryoları | Sorun Çöz routing görevleri |
| 4 | Alt arayüz / router-on-a-stick (dot1q) — **tamamlandı (L5-a)** | Var | L5-a: `SwitchConfig.subifs`, `encapsulation dot1Q N [native]`, routed port üzerinde etiketli segment | `routing.activeRouterInterfaces` alt arayüz kuralları; `test_aglab_subinterfaces`, `test_aglab_pkt_dot1q`, `test_aglab_l2_router_trunk`; `subif-missing` | PKT örneklerinde yaygın |
| 5 | DHCP server + relay (`ip helper-address`), Server cihazı ve servisleri (DHCP/DNS/HTTP) — **tamamlandı (L5-b; HTTP L5-g)** | Var | L5-b: IOS `ip dhcp pool`/`excluded-address`, relay, PC istemcisi (başarısızsa 169.254), sunucuda DHCP/DNS servisi, `nslookup` | `dhcp.js` + `test_engine_nat_dhcp`; `test_aglab_pkt_dhcp_relay`; `relay-trunk` | — |
| 6 | ACL (standard/extended, in/out, örtük deny) — **tamamlandı (L5-c)** | Var | Yok (ROADMAP PDF 13) | `acl.js` (`aclEvaluate`, `aclPathDecision`) + `test_engine_stp_acl` | — |
| 7 | NAT/PAT (overload, çeviri tablosu) — **tamamlandı (L5-d, PR açık)** | Var | L5-d: `ip nat inside/outside`, statik NAT (adres ve TCP/UDP port), dinamik havuz, PAT (arayüz ya da havuz `overload`), `show ip nat translations/statistics`, `clear ip nat translation *` | `nat.js` + `test_engine_nat_dhcp`; `nat-pat` | — |
| 8 | Port security (sticky/max/violation, err-disable) — **tamamlandı (L5-e)** | Var | Yok; err-disable altyapısı BPDU Guard ile var | `simulator/port-security.js` + `tests/node/test_port_security.cjs`; `test_aglab_pkt_port_security`; `port-security` | Labber err-disable altyapısı yeniden kullanılır |
| 9 | BGP | Asgari (AS uyumu senaryosu) | Yok (ROADMAP PDF 6) | `network-protocols.js` `bgp-as` | AğLab modeli zaten sığ |
| — | Paket animasyonu için L2 çerçeve olayları | Var (ARP/Ethernet olayları, `packet-events.js`) | `deliver()` yalnızca L3 atlamaları veriyor | `test_aglab_simulation_mode`, `test_aglab_frame_forwarding`, `test_packet_events` | Simulation Mode için gerekli (bkz. L4) |

**Konu #3 dersinden çıkan Labber eksikleri** (aynı kalıpla eklenir; sıra L2
aşamasının gereksinimine göre):

| Sıra | Eksik | Kapsam | Kabul testi |
|---|---|---|---|
| 10 | `show mac address-table address <mac>` — **tamamlandı (L2-C)** | `cli/ios.ts` deseni, `show.ts` çıktısı, `help.ts` | MAC tablosunda olan/olmayan adres; IOS biçiminde çıktı |
| 11 | PC'de `show arp` — **tamamlandı (L2-C)** | `cli/vpcs.ts` | Ping öncesi boş, ping sonrası dolu; başka alt ağdaki hedef için ağ geçidinin MAC'i |
| 12 | Aynı IP'yi kullanan iki cihaz — **tamamlandı (L2-C)** | Türetme adımı: çakışan adreslerin tespiti; `%IP-4-DUPADDR` syslog'u (`runtime.ts` `diffLogs`); ping'in hangi cihazın yanıtladığını belirtmesi | Çakışma varken syslog üretilir ve yanıtlayan cihaz belirlidir (deterministik); çakışma kalkınca syslog kesilir |
| 13 | Topoloji düzenlemede kablonun başka porta taşınması — **tamamlandı (L2-C)** | Köprü + runtime: bağlantı uç noktası değişince yeniden türetme; eski portun MAC/ARP girişlerinin temizlenmesi | Taşımadan önce/sonra ping ve MAC tablosu; eski porttaki giriş kalmaz |
| 14 | `LabQuery` eklemeleri: `macPort`, `macVlan`, `macTable`, `ipUnique`, `ping().replier` — **tamamlandı (L2-C)** | `query.ts`; L5'teki `query.*` beyaz listesine eklenir | Her sorgu için başarılı ve başarısız durum |
| 15 | CDP/LLDP — **tamamlandı (L5-f)** | `discovery.ts`: komşu tablosu türetilmiş durumdan; `cdp run`/`lldp run`, arayüzde `cdp enable`, `lldp transmit/receive`; `show cdp neighbors [detail]`, `show cdp interface`, `show lldp neighbors [detail]` | Kablo/güç/shutdown ile komşu düşer; `no cdp enable` portunda komşu yok; LLDP açılmadan tablo boş |

Labber'ın AğLab'dan **güçlü** olduğu alanlar olduğu gibi alınır: DTP, EtherChannel
(LACP/PAgP), PVST+/Rapid-PVST, PortFast, BPDU Guard, err-disable kurtarma, OSPF
(DR/BDR, çok alan, stub, ECMP, maliyet), syslog, IOS biçiminde `show` çıktıları.

**Sıra 9 (BGP) için:** *(L7a: `bgp-as` kaldırıldı; BGP kapsam dışı, kavramsal alıştırma.)* Taşınana kadar `bgp-as` senaryosu açıkça "eski motorda"
çalışır (L4). Taşınmazsa uyumluluk matrisinde "desteklenmiyor" diye geçer.

### L4. Geçiş sırası ve eski motorun devrede kalması

**İlke (AGENTS.md):** sessiz fallback yok, desteklenmeyen çalışıyormuş gibi
gösterilmez. Geçiş boyunca:

- **Motor seçimi içerikten belirlenir ve ekranda görünür:**
  - Köprü `toLabber` her topoloji için desteklenmeyen özelliklerin listesini döndürür.
  - Liste boşsa içerik Labber motorunda açılır.
  - Doluysa **eski motorda** açılır ve arayüzde "Eski motor — nedeni: NAT, ACL"
    gibi bir rozet görünür.
  - Çalışma sırasında bir motor hata verince diğerine geçilmez; hata hata olarak
    gösterilir.
- **İçerik bazında sabitleme:**
  - Her Akademi labı ve Sorun Çöz senaryosu için beklenen motor
    `docs/LAB_MOTOR_HARITASI.md`'de (üretilen tablo) kayıtlıdır.
  - CI, köprünün verdiği kararın bu tabloyla eşleştiğini doğrular.
  - Bir içeriğin yeni motora geçmesi tablodaki satırın değişmesiyle, yani
    gözden geçirilebilir bir diff ile olur.
- **Akademi'deki mevcut mekanizma kullanılır:** `required_capabilities` /
  `on_unavailable: "not_evaluated"`. Labber'da değerlendirilemeyen ölçüt "geçti"
  sayılmaz; "değerlendirilemedi" olarak raporlanır.

**Aşamalar (her biri ayrı PR, her birinde tam pipeline yeşil):**

| Aşama | İçerik | Kabul ölçütü |
|---|---|---|
| L0 | `src/sim/` + `src/sim-bridge/` iskeleti, derleme, gömme, CI tekrar üretim kontrolü, tür denetimi, Labber motor testleri. Ürün davranışı değişmez. | HTML'de `AgLabSim` var ama kullanılmıyor; mevcut tüm testler aynı. Boyut/performans ölçümü raporlanır. |
| L1 *(PR açık)* | Köprü (yapısal yol, iki yön). Desteklenmeyen özellik raporu. | Gidiş-dönüş özellik testleri; `src/engine` oracle'ı ile L2/STP/routing paritesi; L4 motor seçim tablosu ilk kez üretilir. |
| L2 | Sıra 1 (bağlantı/güç) ve 10–14 (MAC/ARP sorguları, yinelenen IP, kablo taşıma, LabQuery eklemeleri). **Akademi M1–M3 (AGL-001…030)** ve L2 senaryoları (`access-vlan`, `trunk-allowed`, `native-vlan`, `stp-loop` ve #46'nın beş VLAN/trunk senaryosu: `vlan-wrong-access`, `vlan-uplink-not-trunk`, `vlan-allowed-overwritten`, `vlan-missing-on-switch`, `vlan-two-faults`) Labber'a geçer. **Labber'ın 13 labı** ayrı bir içerik grubu olarak alınır (kendi kimlikleri, kendi objective'leri; Akademi kaynak SHA256 kayıtlarına karışmaz). | Her içerik için: başlangıçta hedefler başarısız, öğretmen/referans çözümü hepsini geçirir, CLI hatası yok (Labber `labs.test.ts` deseni). |
| L3 | *(tamam: L3-a #59, F #60, E ve L3-b PR'ları)* Cihaz CLI'si `IosSession`/`VpcsSession`'a bağlanır (Labber'da çalışan içerik için). Simulation Mode için olay adaptörü: Labber `deliver()` atlamaları + `l2Domain` yolu → `packet-events` biçimi. | `test_aglab_device_cli`, `test_aglab_simulation_mode`, `test_aglab_frame_forwarding`, `test_packet_events` Labber içeriğiyle geçer. |
| L4 *(PR açık)* | Sıra 2–3 (Router, AD, özyineleme). **Akademi M4 (AGL-031…040)** ve routing senaryoları (`return-route`, `forward-route`, `default-route`, `wrong-prefix`, `unresolved-next-hop`, `lpm-next-hop`, `floating-static`, `ospf-area`). | `test_aglab_v11…v17`, `test_aglab_next_hop`, `test_aglab_traceroute`, `test_aglab_icmp_*`, `test_aglab_routed_frames`; `tests/node/test_engine_routing.cjs` oracle paritesi. |
| L5 *(L5-a ve L5-b birleşti: sıra 4–5, `subif-missing`, `roas-*`, `relay-trunk`. L5-f CDP/LLDP, L5-e port security, L5-c ACL ve L5-d NAT/PAT (`port-security`, `nat-pat`) ayrı PR'lar, açık. Kalan: PKT IOS metin yolu; `bgp-as` kapsam dışı)* | Sıra 4–8 (alt arayüz, DHCP/Server, ACL, NAT, port security) ve bunlara bağlı senaryolar (`subif-missing`, `relay-trunk`, `nat-pat`, `port-security`). PKT IOS metin yolu (hoşgörülü mod). | PKT testleri (`test_aglab_import`, `test_aglab_pkt_*`, `test_aglab_svi_import`), `test_aglab_network_features`; oracle birim testleri Labber'a karşı. |
| L6 *(PR açık)* | **Sorun Çöz'ün 25 eski metin senaryosu** (`gateway`, `dns`, `duplicate`, `mask`, `dhcp`, `link`, …, `routechoice`) ve `labRun()` deneyleri. Bunlar topoloji motoru kullanmıyor, kendi oyuncak modelleri var. Her biri ya gerçek bir topoloji senaryosuna dönüştürülür, ya da açıkça "kavramsal alıştırma (motor yok)" olarak etiketlenir. | Her senaryo için başlangıçta başarısız / çözümle başarılı testi. Etiketlenenler UI'da motorlu gibi görünmez. |
| L7 *(L7a: içerik + oracle PR'ı açık. L7b+c: eski motorların kaldırılması ve kalıcılık v24 tek PR (L7a dalından), açık; ikisi ayrılamadı: eski `startupConfig` kaydını yalnız eski motor işliyordu, v24 olmadan kaldırmak kayıtlı çalışmaları "simüle edilemiyor"a düşürürdü. BGP kapsam dışı (matris "L7a"))* | Kalıcılık v24 (running + startup), eski kayıtların taşınması. Eski çekirdek motorun, borck-netsim'in ve engine-manager'ın kaldırılması. `src/engine` yalnız test oracle'ı olarak kalır veya kaldırılır. | Tüm içerik Labber'da (BGP hariç tutulduysa matriste belirtilir); `test_aglab_persistence`, `test_aglab_student_journey`, `test_aglab_unified_rc`; ZIP ve `verify_packages.py` yeşil. |

**Senaryo envanteri:**

- **27 ortak motor senaryosu** (`simulator/network-scenarios.json`): önceki 17
  senaryoya #46 ile beş VLAN/trunk senaryosu eklendi; bu beşi L2 aşamasına girer.
  Konu #7 beş router-on-a-stick senaryosu (`roas-*`) daha ekledi; Router ve alt
  arayüz gerektirdikleri için L4–L5 aşamalarına kadar eski motorda kalırlar.
- **25 eski metin senaryosu** (`main.js` `scenarios`): L6'da kaldırıldı; her biri Labber karşılığına ya da kavramsal alıştırmaya açılır (`LAB_MOTOR_HARITASI.md` "L6").
- **13 Labber labı:** L2 aşamasında ayrı içerik grubu.

Kesin sayım L1'de üretilen motor seçim tablosunda tutulur ve CI'da doğrulanır.

**Python testleri (`tests/test_*.py`, 43 dosya; 39'u Playwright kullanıyor):**

- Hiçbiri silinmez veya gevşetilmez.
- Her biri yukarıdaki aşamalardan birine bağlıdır ve o aşamada yeni motorla geçmek
  zorundadır.
- Labber IOS biçimli çıktı ürettiği için beklenen metin değişebilir (ör. ping
  çıktısı, `show` tabloları). Böyle her değişiklik **davranış değişikliği** sayılır;
  test o PR'da gerekçesiyle güncellenir. Mümkün olan yerde metin yerine türetilmiş
  durum sorgulanır (L5).
- UI'ya ait testler (`test_aglab_ui`, tema, erişilebilirlik) motordan bağımsızdır;
  her aşamada değişmeden geçmelidir.

### L5. LabQuery'nin Akademi ve Sorun Çöz değerlendirmesine uyarlanması

**Bugün:**

- Akademi ölçütleri **JSON veri** ve kaynak SHA256 kayıtları ile korunuyor. Bu
  yüzden Labber'daki gibi TypeScript `check(q)` fonksiyonu olamazlar.
- Ölçüt türleri:
  - `state.equals` (100): AğLab JSON yolu, ör. `devices.SW1.interfaces.fa0/2.enabled`.
  - `probe.icmp` (64).
  - `answer.equals` (54): motordan bağımsız.
- Puanlama sözleşmesi `academy/grading-verdict.js`.
- Sorun Çöz senaryoları `verify` alanıyla tanımlanıyor.

**Uyarlama:**

1. **`probe.icmp` → `LabQuery.ping(from, ip)`.**
   - `ok` doğrudan kullanılır.
   - Başarısızlıkta `reason` (`noip`, `noroute`, `timeout`, `unreach`) Türkçe
     açıklamaya çevrilir.
   - Gidiş ve dönüş yolu Labber'da zaten denetleniyor.
2. **`state.equals` → köprünün ters yönü.**
   - `toAglab(runtime)` AğLab JSON görünümünü üretir; mevcut yol ifadeleri olduğu
     gibi çalışır. Bu, Akademi'deki `state_adapter` yeteneğidir.
   - Var olan **40 labın kaynak JSON'u ve SHA256 kayıtları değişmez.**
3. **Yeni, türetilmiş ölçüt türü `query.*`:** Labber felsefesinde hedefler yapılandırma
   metnini değil türetilmiş davranışı denetler. Bunun için beyaz listeli, JSON ile
   ifade edilen bir tür eklenir:
   - Örnek: `{"kind": "query", "fn": "trunkCarries", "args": ["SW1", "Gi0/1", 10], "expected": true}`.
   - İzin verilen fonksiyonlar: `ping`, `trunkCarries`, `trunkAllows`, `isTrunk`,
     `pcVlan`, `stpRoot`, `stpState`, `bridgePriority`, `route`, `ospfAdjacent`,
     `sviUp`, `errDisabled`, `etherchannel`, `vlanExists`, `saved`. Yeni özellikler
     (ACL/NAT/DHCP/port security) için sorgular L3 sırasıyla eklenir.
   - Listede olmayan fonksiyon adı **içerik doğrulamasında reddedilir**.
   - Yalnızca yeni veya bilerek revize edilen içerikte kullanılır. Revizyon, kaynak
     SHA256 kaydının bilinçli güncellenmesiyle olur.
4. **Labber'ın lab değişmezi bütün içeriğe uygulanır:**
   - Başlangıçta en az bir hedef başarısız.
   - Referans çözüm (Akademi'de öğretmen JSON'undaki `teacher_solution`, Sorun
     Çöz'de `solution`) bütün hedefleri CLI hatası olmadan geçirir.
   - Bu, CI'da içerik başına otomatik test olur.
5. **Değerlendirilemeyen ölçüt:** gereken yetenek motor/köprüde yoksa sonuç
   `not_evaluated` olur. Puan "geçti" diye hesaplanmaz ve öğrenciye açıkça
   gösterilir (mevcut `grading-verdict` sözleşmesi).

### L6. Riskler ve bilinen sınırlar

- **Lisans ve köken:**
  - Arşivde `LICENSE` yok. Labber kodu kullanıcının kararıyla AğLab'ın kendi
    kaynağı olarak alınır; README'deki köken notu bunu kaydeder.
  - Labber `labs/` içeriği kullanıcıya ait; dağıtım hakkı kullanıcıda (karar,
    #47). L2'de alınırken lab metinleri PDF'lerden alıntı içermemeli; alıntı
    görülen metin alınmaz, yeniden yazılır.
  - `pdfs/` ve dağıtılamayan materyal hiçbir aşamada alınmaz; CI'da `pdfs/` ve
    `*.pdf` için bir engel kontrolü eklenir.
- **Araç zinciri:**
  - TypeScript 7'nin hatada 0 ile çıkması (Labber notu) → CI çıktıyı ayrıştırır.
  - Labber `^` sürümlerle geliyor → tam sürüme sabitlenir.
  - vitest yeni bir devDependency olur (çevrimdışı HTML'yi etkilemez).
- **Davranış farkları:**
  - Labber IOS'a sadık çıktı ve Cisco varsayılanları kullanıyor: Vlan1 SVI kapalı
    gelir, trunk için `encapsulation dot1q` gerekebilir, `dynamic-auto`.
  - AğLab'ın bazı basitleştirmeleri (ör. DHCP havuzunun ağın 100. adresinden
    başlaması, PAT'ta port çevirisi olmaması) Cisco değil, AğLab kararı.
  - Her fark uyumluluk matrisinde ve ilgili PR'da açıkça kararlaştırılır.
- **Zamanlama yok:** STP ve OSPF anında yakınsıyor (Labber sınırı). Simulation
  Mode zaten kayıtları yeniden oynatıyor; zamanlayıcı öğreten içerik
  "desteklenmiyor" olarak işaretlenir.
- **Performans:** `derive()` + `computeState()` her değişiklikte tüm durumu yeniden
  hesaplıyor. 300 cihazlık test ve `test_aglab_unified_performance` bütçeleri
  L0'da ölçülür. Aşılırsa artımlı hesap ya da önbellek L1'den önce çözülür.
- **Çift motor dönemi:** L2–L6 boyunca iki motor yan yana çalışır. Karmaşıklık ve
  HTML boyutu artar; her aşamada içerik tablosuyla sınırlanır ve L7'de eski motor
  kaldırılır.
- **Port adları ve PKT:**
  - Packet Tracer arayüz adları ve modelleri (ör. `GigabitEthernet0/0/0`, seri
    arayüzler) Labber `IF_TYPES` listesinde yok (`FastEthernet`,
    `GigabitEthernet`, `Port-channel`, `Vlan`, `Loopback`).
  - Seri arayüz, `Serial`, `Ethernet` vb. genişletilmeden bu bağlantılar
    reddedilir ve raporlanır.
- **Kalıcılık:** öğrencilerin tarayıcıda kayıtlı v21/v23 çalışmaları v24'e
  taşınmalı; taşınamayan alanlar raporlanır, silinmez.
- **Simulation Mode:** Labber L3 atlama veriyor. Çerçeve düzeyi animasyon için L2
  yolunun ayrıca hesaplanması gerekiyor (L4 L3 aşaması). Sağlanamazsa animasyon
  yalnızca L3 atlamalarını gösterir ve bu UI'da belirtilir.
- **#45:** `src/engine` modülleri main'de oracle olarak durur. Yeni motorla birlikte
  ürün motoru olmaktan çıkar; ürüne gömülmeleri L7'de kaldırılır, testlerde
  oracle olarak kalırlar.
- **Arayüz yenilemesi (5. adım):** motor geçişi bitmeden başlamaz; aksi halde UI
  testleri iki motor ve iki arayüz arasında aynı anda kayar.
