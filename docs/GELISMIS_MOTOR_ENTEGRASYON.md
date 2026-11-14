# Gelişmiş motor entegrasyonu — 6 Kasım 2026

## Seçim ve kaynak incelemesi

- **NetForge**: master `cad4ac90358ac5ef748483de7e78d8086405d1e8` yeniden kontrol
  edildi; kök/engine lisans dosyası ve package.json lisansı hâlâ yok. VLAN, STP,
  OSPF ve capture kodunun varlığı kullanım hakkı yerine geçmez. Kod alınmadı.
- **Michael Borck NetSim**: `c3075e7fe65b7e17515d802eaef625bab751af58`, MIT.
  Özgün 10 TS dosyası ve LICENSE hashleri korunur. Switch receiveFrame/vlanOf/
  flood API'leri access VLAN ve MAC öğrenimi sağlar; 802.1Q/PVID trunk ve STP
  bu upstream sürümde yok. Protokol taklidi ekleyip entegrasyon adı verilmedi.
- **Linux kernel bridge + iproute2** seçildi: mevcut Containerlab/FRR imajında
  kullanılan hazır Linux ağ yığını; `ip link`, `bridge vlan/link/fdb` API'leri.
  Kaynakta `net/bridge/br_vlan.c` ve `br_stp.c` incelendi. Gerçek VLAN ve STP
  kodu kernelde çalışır; HTML'ye kernel kodu kopyalanmaz.
- **mstpd**: GPLv2 metni ve mstp.c durum makineleri incelendi. RSTP/MSTP için
  ayrı userspace daemon/bridge kontrolü gerekir. Bu tur kurulu veya test edilmiş
  sayılmaz; kernel klasik STP ile karıştırılmaz.
- **FRRouting**: var olan `real-lab/` yolu yeniden kullanıldı. FRR 10.7.1
  ospf_vty/ospf_neighbor/BGP FSM ve resmi CLI belgeleri esas alındı. Ayrı
  topolojide gerçek ospfd/bgpd ve Linux FIB ile doğrulama var; yeni JS OSPF/BGP
  protokolü yazılmadı.

Birincil kaynaklar:

- [NetForge engine](https://github.com/FediMechergui/netforge/tree/cad4ac90358ac5ef748483de7e78d8086405d1e8/packages/engine)
- [MIT NetSim kaynakları ve lisansı](https://github.com/michael-borck/netsim/tree/c3075e7fe65b7e17515d802eaef625bab751af58)
- [Linux bridge kaynakları](https://github.com/torvalds/linux/tree/v6.8/net/bridge), [kernel bridge API belgesi](https://docs.kernel.org/networking/bridge.html)
- [iproute2 bridge API](https://man7.org/linux/man-pages/man8/bridge.8.html), [ip link API](https://man7.org/linux/man-pages/man8/ip-link.8.html)
- [mstpd](https://github.com/mstpd/mstpd), [lisans](https://github.com/mstpd/mstpd/blob/master/LICENSE)
- [Containerlab FRR kind](https://containerlab.dev/manual/kinds/frr/), [FRR kaynakları](https://github.com/FRRouting/frr/tree/frr-10.7.1), [OSPF](https://docs.frrouting.org/en/latest/ospfd.html), [BGP](https://docs.frrouting.org/en/latest/bgp.html)

## Lisans ve sürüm sınırı

Yeni üçüncü taraf JS kaynak kopyası yoktur; mevcut MIT telif/izin metni HTML ve
ZIP'te kalır. Kernel bridge dosyaları GPL-2.0-or-later başlığı taşır; iproute2 ve
mstpd GPL ailesindedir. Bunlar tarayıcıya bağlanmadı veya ZIP içinde binary
olarak yeniden dağıtılmadı. FRR COPYING dosyası dosya başlıklarına göre lisans
ve birleşik binary için GPLv2+ görüşünü açıklar; mevcut ayrı container yaklaşımı
korunur. Kullanılan komutlar AğLab'ın kendi admin test adaptörüdür.

Native imaj `quay.io/frrouting/frr:containerlab-10.7.1`, PC imajı `alpine:3.20`.
Koşu raporu kernel sürümü ve kullanılan FRR image ID'sini kaydeder. Hosted CI
kernel'i sabit commit'e kilitli değildir; incelenen v6.8 kaynak örneğinin koşan
kernel'in birebir kaynağı olduğu iddia edilmez. Upstream runtime sürümleri ve
bu pinleme sınırı raporda görünür tutulur.

## Ortak motor yöneticisi

> **L7b notu:** `engine-manager*`, borck-netsim ve AğLab JS motoru kaldırıldı; ürünün tek
> simülasyon motoru Labber'dır (UYUMLULUK_MATRISI "L7b"). Bu bölüm tarihsel kayıttır; Gerçek Lab
> (Linux bridge / FRR) aşağıdaki gibi ayrı kalır. Operatör dışa aktarımı Paket Dedektifi altındaki
> "Gerçek Lab için topolojiyi indir" bölümündedir.

`engine-manager.js` özellik gereksinimlerini (trunk, döngü/STP, OSPF, BGP,
DHCP/helper, routing, NAT, ACL) tanımlar. Açık seçim: `aglab-js`, `borck`,
`linux-bridge`, `frr`. Varsayılan AğLab JS kalır. MIT yolundaki kapsam denetimi
mevcut borck-adapter'ı kullanır. Destek yoksa deneme reddedilir; sessiz fallback,
aynı ağın iki motorda parçalı yürütülmesi veya otomatik motor değişimi yoktur.

FRR ve Linux bridge **separate-lab** olarak tanımlıdır: tarayıcı topolojisi
kurulmuş/senkronize olmuş sayılmaz ve motor yöneticisi Docker/HTTP admin
eylemi çalıştırmaz. Öğrenci arayüzündeki tanı servisi salt okunur kalır.

UI: Lab → Paket Dedektifi → Motorlar ve destek kapsamı. Mevcut CLI yeniden
yazılmadı; gerçek ortak config sonraki MIT karşılaştırmasına aktarılır. Native
admin testleri aynı CLI stringlerini birebir IOS saymaz. Örneğin FRR'nin normal
ospfd süreci `router ospf` kullanır; `router ospf 1` ayrı daemon instance ister.

## Gerçek L2 laboratuvarı

`advanced_smoke.py l2 --execute`: üç switch namespace/container'ı, iki PC,
üçgen trunk ağ ve MAC taşınma testi için PC2'nin yedek fiziksel portu.

Denetlenen davranışlar: VLAN10/20 izolasyonu, allowed VLAN kaldırma/onarım,
native PVID/untagged eşleşme/uyuşmazlık, gerçek FDB öğrenimi, MAC taşınması,
port down sonrası FDB temizliği, s1 root seçimi, tam bir blocked redundant
port ve forwarding yolunda gerçek ICMP. Doğrudan trunk kapanınca önceki
blocked portun forwarding olması ve alternatif yoldan ICMP ayrı ayrı gerekir.

STP kernel 802.1D'dir; PVST/RSTP değildir. Netlink timer birimi saniye yerine
USER_HZ/centisecond olduğundan test değerleri forward_delay=400,
hello_time=100, max_age=600 kullanır (4/1/6 saniye). Gerçek BPDU/timer kodu
kernelde yürür; JS deterministik ağaç ile birleştirilmez. Broadcast/unknown
unicast ve port seçimi mevcut tarayıcı frame testleriyle ayrıca korunur;
native PCAP yakalama bu sürümde yoktur.

## Gerçek yönlendirme laboratuvarı

`advanced_smoke.py routing --execute`: üç FRR router, üçgen bağlantı ve iki
Linux PC. OSPF ve BGP aynı testte **ardışık** çalışır; BGP denetiminden önce
OSPF kaldırılır. Statik yedek rota konularak dinamik başarı taklit edilmez.

OSPF: Full komşuluk + AD110 + beklenen next-hop, gerçek ICMP, yanlış area,
onarım, izole ikili ağda router-ID çakışması, onarım, kablo kopunca alternate
next-hop/ICMP, hedef ağ ilanını çekince rota yokluğu ve restorasyon.

BGP: üç ayrı AS, karşılıklı eBGP, AD20 ve doğrudan kısa yol, gerçek ICMP,
yanlış remote-AS ile session kaybı, r2 üzerinden alternatif rota/ICMP,
AS onarımında kısa yolun yeniden seçimi, network withdrawal sonrası rota
yokluğu ve yeniden ilan. Assertions native FRR JSON ve gerçek ping çıkış
kodunu okur. Yeni sürümün `neighbors` JSON zarfı ayrıca regresyon testindedir.

Pozitif sonuç tek örnek yeterli olabilir; negatif kontroller önce timer
süresini bekler ve üç örnekte şartın korunduğunu doğrular. Sınırlandırılmış
polling, önceden var olan labı reddetme ve hata sonrası cleanup vardır. Lab
isimleri eski `aglab-real-mvp` ile çakışmaz. Yeni öğrenci shell/API erişimi yok.

## Paket Dedektifi ve kanıt türleri

1. AğLab simülasyon motorunun frame/forward olayları.
2. MIT upstream onWireTransfer bildirimleri (alıcıya ulaşma/ham PDU değildir).
3. Ping kontrolünden türetilen **adaptör tanısı**: örneğin VLAN preflight
   paket üretmeden durduysa gerçek nedeni gösterir; paket yakalaması diye sunmaz.
4. Ayrı native lab raporu: `lab-evidence.js` veri-only/2 MB/sınırlı şema
   denetiminden geçer. Adım + gerçek komut snapshot'ı okunur. Bu bir canlı
   protokol olay kaydı/PCAP değildir. İmza ve dosya kaynağı doğrulanmaz; UI
   açıkça “imzası doğrulanmadı” der ve tarayıcı topolojisine cihaz/paket eklemez.

`advanced-*-results.json` dosyaları CI artifact'inden veya operatör koşusundan
alınıp Lab → Paket Dedektifi → Ayrı Gerçek Lab raporunu incele alanında açılır.
Dosya metni yalnız textContent ile gösterilir. Hatalı/ek alanlı/aşırı büyük
rapor reddedilir. Güvenilmeyen raporun meta verisi başarı kanıtı diye kabul edilmez.

## Tarayıcı testi ve performans

`test_aglab_advanced_engines.py` gerçek Chromium UI kontrolleriyle boşaltma,
iki PC/iki switch ekleme, kablo bağlama, CLI IP/VLAN/trunk, başarılı ping,
yanlış allowed VLAN, başarısız ping ve açık adaptör tanısı, onarım, kayıt,
download/export, reload/import ve aynı sonucu denetler. MIT trunk ret ve FRR
ayrı-lab kapıları, veri-only rapor/XSS/şema reddi de sınanır. Bu otomatik
tarayıcı testidir; gerçek insan katılımcıyla kullanıcı araştırması yapılmadı.

`test_aglab_browser_benchmark.py`: aynı Chromium süreci, taze context'ler,
aynı iki access switch + PC topolojisi; 10/50/100/250 cihaz. Bir ısınma + üç
örnek medyanı. App yükleme, ortak topoloji import, adaptör kurulumu, ilk/ikinci
core ping, tablo okuma, GC sonrası bütün page heap'i/ek state ve UI'nin iki
animation-frame sonrası yanıtı raporlanır. Node VM baseline kullanılmaz.
Trunk/STP desteklemeyen MIT ile o özelliklerde hız karşılaştırılmaz.

Başlangıç sınırı aynı değildir: JS zaten app içindedir, MIT ek session kurar.
Heap ölçümü bare engine belleği değildir; ikisi de aynı HTML'de yüklüdür.
Log ayrıntısı/sınırı farklıdır; 0 ms ölçüm timer çözünürlüğünü ifade edebilir.
Bu entegrasyon maliyeti ölçümüdür; genel hız üstünlüğü iddiası yapılmaz.

## Test ve teslim kapıları

```sh
npm ci --ignore-scripts
npm run build:engine
python run_pipeline.py
# Yalnız yetkili Linux/Docker hostunda:
sudo python3 real-lab/advanced_smoke.py l2 --execute
sudo python3 real-lab/advanced_smoke.py routing --execute
```

Genel CI tüm browser/Node/unit testlerini, 40 kaynak hash'ini, MIT kaynağını,
öğrenci/öğretmen ayrımını ve offline ZIP'i kontrol eder. Live CI eski salt
okunur öğrenci yalıtımı/zinciri yanında iki yeni native labı çalıştırır.
Native protokol başarısı mock unit sonuçlarından çıkarılmaz. Koşu raporları
başarı/başarısızlık, cleanup ve kanıt snapshot'larını saklar.

Kök hazır HTML güncel motor seçimi, NetSim ve kanıt modüllerini içerir.
`run_pipeline.py` HTML'yi testlerden önce yeniden üretir. CI, depodaki HTML ile
kaynaklardan üretilen çıktının eşitliğini zorunlu tutar; güncel CI ZIP'i ayrıca
commit ve modül hash'lerini içeren manifest sunar. Release
doğrulaması gömülü modüllerin paket kaynaklarıyla eşitliğini denetler. Adaptör
blokları her üretimde aynı sıraya yerleştirilir. `test_build_simulator.py`,
önceki HTML'deki blokları ters çevirip tekrar derleyerek byte eşitliğini sınar;
yalnız art arda aynı girdiyi derlemekle yetinmez.

[Uyumluluk matrisi](UYUMLULUK_MATRISI.md). Tüm 40 lab native motorlara taşınmadı;
sınırlı ortak JSON → Linux bridge aktarımı ve çok alanlı OSPF/IPv6 native
senaryoları artık [ortak Gerçek Lab](ORTAK_GERCEK_LAB.md) kapsamında bulunur.
Genel router dönüştürücüsü, tarayıcı/FRR runtime senkronizasyonu, RSTP,
native PCAP ve ileri BGP politika testleri sonraki önceliklerdir.
Gelecek ürün fikirleri ve şube senaryoları bu görevde uygulanmadı.
