# Akademi laboratuvar–motor haritası

Bu tablo gerçek öğrenci JSON içeriklerinden üretilir. Yapısal adaylık, aktarım veya başarılı native test anlamına gelmez. AğLab JS mevcut görev/grading motorudur. MIT yalnız access LAN karşılaştırmasıdır. Linux bridge dönüştürücüsü sınırlı PC/switch ormanlarını kabul eder. FRR dönüştürücüsü sınırlı PC/router ve VLAN1 access-köprü şemasını ayrı doğrular; şema kabulü native test başarısı değildir.

| Lab | Gerçek konu | Cihaz/bağ | AğLab JS | Labber köprüsü (L1) | MIT NetSim | Linux bridge | FRR | Öğrenci JSON SHA256 |
|---|---|---|---|---|---|---|---|---|
| AGL-001 | İlk yerel ağ: iki PC ve switch | 3/0 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Each PC needs a physical data link; missing-cable labs unsupported; onarım sonrası yeniden değerlendir | Gerekmez | `00afca5af204fdb234bd7752fdbe392769d44d2b0dacdb6c044617e8175cbb73` |
| AGL-002 | Cihaz rolleri ve uç IP ayarı | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `4b8ce3b44456415b6ee60cfecf303d96ac9681eee625e0af650993db41788d3f` |
| AGL-003 | Fiziksel bağlantı kesintisi | 3/2 | Mevcut | Eski motor: Kopuk/çıkarılmış kablo (up:false) Labber'da modellenmiyor (L2) | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `4e9ea298b744c628acc120c63492a0f2e2ec99df28eea7e19f7c4f677cc97ba7` |
| AGL-004 | Kapalı cihazı teşhis etme | 3/2 | Mevcut | Eski motor: Kapalı cihaz (güç) Labber'da modellenmiyor (L2) | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Routing/configuration/disabled device unsupported; onarım sonrası yeniden değerlendir | Gerekmez | `f79ee4414a8f0b623d244a2ed3552e5160d3da454dc17449fd968b1cb90e26d1` |
| AGL-005 | Yönetimsel olarak kapalı port | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `00e69cdbddd09e3f1070be5f4305edff69ff3bba319120457937ff0ad3c28552` |
| AGL-006 | Üç uçlu yıldız topoloji | 4/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Each PC needs a physical data link; missing-cable labs unsupported; onarım sonrası yeniden değerlendir | Gerekmez | `5ac27bb57328bad34e5438e99bd841b6bc0d95f1a54f8a245aacd243f90b1fb8` |
| AGL-007 | Ping sonucunu doğru yorumlama | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `deea6d0c0f012aeb39eb44be8989c9e87ee4265d72c5c15fbdecdbf759d2f832` |
| AGL-008 | Yerel teslim ve ARP kavramı | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `56b896b531d8f483594af28a1702b394d364cba9c7ce46d637a48b1ad3348fae` |
| AGL-009 | Aynı kablo ağı, farklı IP ağı | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `b25da3087d3860446497eee48916e683d04b0d9237c1509ca5e69ab9d74b7508` |
| AGL-010 | Yerel ağ mini projesi: iki hatayı düzelt | 4/3 | Mevcut | Eski motor: Kopuk/çıkarılmış kablo (up:false) Labber'da modellenmiyor (L2) | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `00f0cac2e0ebf80df32f0f73dbe5f627de2b7f8f90e0e7c7880b593302e136b1` |
| AGL-011 | IPv4 ve /24 maskesi | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `5feebb3a5b15033bdd38d3ff845dfb3ee5900a84c700db9885bfaf65050b4677` |
| AGL-012 | Ağ, ilk host ve son host | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `8942c0d52d6c7c1a5451e5d72e05aa124f9aecb0a08591ea81eacf3534db3d46` |
| AGL-013 | /25 ile iki eşit alt ağ | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `dc62635d7cac8f2365fcf1430cb81eb15f581e36d9adb8c1b00da93d029b2e57` |
| AGL-014 | /26 ile dört alt ağ | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `fabf837810553fe8279cf372472d12abc186bf7d571039004ab53119f5c5564f` |
| AGL-015 | /27 ve host kapasitesi | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `920b2b6e5114191cce3714e2a997adb9ec6631df999e7cb30007441629b9f80c` |
| AGL-016 | /28 küçük ofis planı | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `da0d83f078056e3915bab37016e33e6219cc241bce4ad98188710c933510c9ef` |
| AGL-017 | /30 transit ağını tanıma | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `d2377470a4c808872bf8e066c6ca570e8b77a69f5573a47d0f8c74bd1b55b442` |
| AGL-018 | Maske uyuşmazlığını giderme | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `103297c547327ef95e5588b602bd2e54f4b96d4251c98229954a6bfb6b5ec8f5` |
| AGL-019 | VLSM: farklı büyüklükte ağları ayırma | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `13c9406bc7d39efc1870ef927179c56f9c7ecca8130e4af885bd8c88ec726391` |
| AGL-020 | Subnetting mini projesi: 60 hostluk şube | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç reddedilir: Invalid IPv4/mask; onarım sonrası yeniden değerlendir | Gerekmez | `9d95360eecc00cabbd313d713ac912f9e2dfd0de7619a00fe4ab8e56540a2eda` |
| AGL-021 | Switch iletiminde MAC ve IP ayrımı | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `543a07b2799c818da825748787b914ff7a83ed966fb601f69388f9f884633472` |
| AGL-022 | İlk VLAN: access portlarını VLAN 10’a taşı | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `6617e0dc4cf0a3da3fa5f882942d78a2a9c3ebd0a41183b7d757b799d55e4663` |
| AGL-023 | Aynı IP ağı olsa da farklı VLAN yalıtımı | 3/2 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `dafbb621e7838ef4c8c00c6e687fddb6464c81d9ea51c701eb3cda0b7c68c372` |
| AGL-024 | İki switch arasında 802.1Q trunk | 6/5 | Mevcut | **Labber** | Access LAN adayı; görev/CLI aktarılmaz | Native arıza/onarım senaryosu; sonuç CI kanıtında | Gerekmez | `e1221a7fda2726b837a5b50420243067fdf2a24de8a2a8d7b5bbffb2242bcd77` |
| AGL-025 | Trunk allowed VLAN eksikliğini giderme | 6/5 | Mevcut | **Labber** | Sınırlı aday; unused trunk portları da reddedilir | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `2a07e6e9e246c400517ffd2055060a052e09fad1c681ed1fc9750c72b2972381` |
| AGL-026 | Yanlış access VLAN üyeliği | 6/5 | Mevcut | **Labber** | Sınırlı aday; unused trunk portları da reddedilir | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `aa64f6a85a08016c563be88caefff01901e90068faa08f127be48a14838141c5` |
| AGL-027 | VLAN ve IPv4 alt ağını birlikte planlama | 6/5 | Mevcut | **Labber** | Sınırlı aday; unused trunk portları da reddedilir | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `6d10f0a94b2f3d06d5be9526af1cc0f18d7828ea948551b67a440bb8e352328b` |
| AGL-028 | Tek trunk kesintisinin etki alanı | 6/5 | Mevcut | Eski motor: Kopuk/çıkarılmış kablo (up:false) Labber'da modellenmiyor (L2) | Sınırlı aday; unused trunk portları da reddedilir | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `fdcf2e3db673eaac5031ca060cfcee3dc46b078e94bfc2ef1d46003e0a863369` |
| AGL-029 | Yayın alanları ve native VLAN farkındalığı | 6/5 | Mevcut | **Labber** | Sınırlı aday; unused trunk portları da reddedilir | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `a2376624e1064ba58023f45209efec12b6d9a532cdc11868f3bcd6e51a697f42` |
| AGL-030 | VLAN mini projesi: iki bölümlü ofis | 6/5 | Mevcut | **Labber** | Sınırlı aday; unused trunk portları da reddedilir | Başlangıç şeması kabul edilir; native görev testi yok | Gerekmez | `6d36e30ff2ce99fc2c0b12679e905073f024f5db5b74317fd2f888d68d53e6d4` |
| AGL-031 | Router ile iki doğrudan bağlı ağı birleştirme | 5/4 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `a69e3d1b0f1a79abc2785c77cc5c7ab0bd4fd0058b5aad654a753f6b9ace0039` |
| AGL-032 | Varsayılan ağ geçidi hatalarını düzeltme | 5/4 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `9d437f3674c8bd108c173c35f6a00d78a550166becaa14b970e09624950704f0` |
| AGL-033 | İki router arasında /30 transit bağlantısı | 6/5 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `442a6ba1f9f1466e71f3306d952a0153663855546fc8b220e424b3fae73b7aaf` |
| AGL-034 | İlk çift yönlü statik rota | 6/5 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç/çözüm native CI geçti (a1d6382; kanıt aşağıda) | `bc6918b6f4e7aeb58dbd3ce1216c59899623b8aee0cc79899702460c26dc1e93` |
| AGL-035 | Eksik dönüş rotasını bulma | 6/5 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç/çözüm native CI geçti (a1d6382; kanıt aşağıda) | `c4ceabce947230e958186d3ca082b4818b784681e8bab6b8b77543b24a7f6725` |
| AGL-036 | Yanlış sonraki atlamayı düzeltme | 6/5 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `8a6f8334a5e01cf724172794acfb20b7efb55541d93868a5b139a4fad8272828` |
| AGL-037 | Varsayılan statik rota: şube çıkışı | 6/5 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `1fae02e246bf24574c7e562c061c18e993c5ef5a261c0633da0f1cc4aa8001e6` |
| AGL-038 | En uzun önek eşleşmesini okuma | 6/5 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `acfea8e43de40c1e0a2a74ec566d6b0155cbac8794651c42bb4c750152580571` |
| AGL-039 | Üç routerla temel çok atlamalı statik routing | 7/6 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `e2e2c268fce97c32d6ef641cbab7673d55f6b11efac0a78dd56ebfbcadf2569b` |
| AGL-040 | Bitirme laboratuvarı: iki şube, üç bağımsız hata | 7/6 | Mevcut | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) | Yok (routing) | L2 dönüştürücü değil; FRR yoluna bakınız | Başlangıç şeması kabul; native görev testi yok | `1fcdeb4db6775ccb3db7fe2f512e056d6910f5289f7cb5b4f4bbdecf9e75c3a8` |

## Ortak motor senaryoları (Sorun Çöz)

Senaryo yüklendikten sonraki başlangıç topolojisi köprüye verilir.

| Senaryo | Başlık | Labber köprüsü (L1) |
|---|---|---|
| `subif-missing` | Alt arayüz eksik · router-on-a-stick | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |
| `ospf-area` | OSPF area uyuşmazlığı | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |
| `bgp-as` | BGP remote-AS uyuşmazlığı | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |
| `port-security` | Port-security ihlali | Eski motor: Port security Labber'da yok (L5) |
| `return-route` | return-route | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `forward-route` | forward-route | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `default-route` | default-route | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `wrong-prefix` | wrong-prefix | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `unresolved-next-hop` | unresolved-next-hop | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `lpm-next-hop` | lpm-next-hop | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `floating-static` | floating-static | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `access-vlan` | access-vlan | **Labber** |
| `trunk-allowed` | trunk-allowed | **Labber** |
| `native-vlan` | native-vlan | **Labber** |
| `nat-pat` | nat-pat | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `relay-trunk` | relay-trunk | Eski motor: DHCP istemci kirası Labber'da yok (L5); Router cihaz tipi Labber köprüsünde yok (L4); Server cihaz tipi Labber köprüsünde yok (L5) |
| `stp-loop` | stp-loop | **Labber** |
| `vlan-wrong-access` | VLAN · Yeni muhasebe PC'si kimseyi görmüyor | **Labber** |
| `vlan-uplink-not-trunk` | Trunk · Katlar arası hiçbir şey çalışmıyor | **Labber** |
| `vlan-allowed-overwritten` | Trunk · Misafir ağı eklendi, muhasebe koptu | **Labber** |
| `vlan-missing-on-switch` | VLAN · Satış diğer kattaki satışçılara ulaşamıyor | **Labber** |
| `vlan-two-faults` | VLAN + trunk · İki hata birden | **Labber** |
| `roas-wrong-tag` | Router-on-a-stick · Satış yazıcıya ulaşamıyor | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |
| `roas-switch-port-access` | Router-on-a-stick · Yalnız bir VLAN dışarı çıkabiliyor | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |
| `roas-pc-gateway` | Gateway · Yeni PC yalnız kendi bölümünü görüyor | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |
| `roas-physical-shutdown` | Router-on-a-stick · Alt arayüzler yapılandırılmış ama hiçbiri çalışmıyor | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |
| `roas-two-faults` | Router-on-a-stick · İki hata birden | Eski motor: Router cihaz tipi Labber köprüsünde yok (L4) |

## Labber köprüsü özeti (L1)

Karar yalnızca köprünün yapısal sonucudur: `labber`, içeriğin bütün alanlarının
Labber'a eşlendiği anlamına gelir; içeriğin yeni motorda çalıştırıldığı anlamına
gelmez (geçiş L2 aşamasında). Eski motor kararı, aşağıdaki gerekçelerden en az
birine dayanır.

| Grup | Labber | Eski motor | Toplam |
|---|---|---|---|
| Akademi labları | 26 | 14 | 40 |
| Ortak senaryolar | 9 | 18 | 27 |
| Toplam | 35 | 32 | 67 |

| Eski motor gerekçesi | İçerik sayısı |
|---|---|
| Router cihaz tipi Labber köprüsünde yok (L4) | 27 |
| Server cihaz tipi Labber köprüsünde yok (L5) | 9 |
| Kopuk/çıkarılmış kablo (up:false) Labber'da modellenmiyor (L2) | 3 |
| DHCP istemci kirası Labber'da yok (L5) | 1 |
| Kapalı cihaz (güç) Labber'da modellenmiyor (L2) | 1 |
| Port security Labber'da yok (L5) | 1 |

ACL/NAT için security_smoke ayrı native operatör örnekleridir; mevcut 40 görevin ACL/NAT alanlarını dönüştürdüğü veya native doğruladığı iddia edilmez. ACL 28 ve SNAT/PAT 21 native kontrolü [CI 42205155584 / 6f651fe](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42205155584) güvenlik işlerinde geçti; görev aktarımı sayılmaz.

AGL-034/035 native kanıtı: [42192382258, a1d6382](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42192382258), `aglab-integration-routed_smoke` artefaktı. Diğer labların dönüştürücü kabulü native başarı iddiası değildir.

AGL-024 gerçekte dört PC, iki switch, VLAN10 ve VLAN20 içerir; örnek görev tablosundan varsayım yapılmamıştır. Native test ilk VLAN10 başarısızlığını, uplink trunk onarımını ve iki VLAN’ın gerçek ICMP trafiğini denetler. AGL-034/035 özgün başlangıç/çözüm topolojileri değiştirilmeden FRR kabul takımına bağlandı; başlangıç arızası, CLI rota onarımı, ICMP, RIB/FIB ve shutdown/no shutdown native CI’da geçti. Yeni IPv6/multi-area ve bağımsız iki/üç router örnekleri özgün 40 lab dışında operatör senaryolarıdır.
