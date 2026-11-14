// Kademeli ipuçları (AğLab arayüz PR 2, kullanıcı testi): her hedefin ipucu üç basamaktır.
//   1. Neye bak  — gözlenecek belirti ya da çıktı; komut adı vermez.
//   2. Kavram    — arkasındaki kural ya da kavram; komutu yazmaz.
//   3. Komut     — labın kendi `hint` alanı (Labber içeriği, değiştirilmedi).
// Burada yalnız 1. ve 2. basamak durur: lab kimliği → hedef kimliği → [neye bak, kavram].
// tests/test_aglab_sim_workspace.py her hedefin iki basamağının olduğunu ve ilk basamağın komut
// içermediğini denetler.
export const HINT_TIERS: Record<string, Record<string, [string, string]>> = {
  'vlan-temelleri': {
    hostname: [
      'Komut satırının başındaki ad, cihazın kendi adıdır; şu an görevdeki ad mı?',
      'Cihaz adı genel yapılandırmanın bir parçasıdır; ayrıcalıklı moddan yapılandırma moduna geçmek gerekir.',
    ],
    vlans: [
      "Switch'in VLAN listesinde hangi numaralar ve adlar var? İstenen iki VLAN listede görünüyor mu?",
      "Bir VLAN önce veritabanında tanımlanır, sonra adı verilir; port atamak VLAN'ı adlandırmaz.",
    ],
    access: [
      "Her PC'nin bağlı olduğu portun hangi VLAN'da olduğuna bak: dört port da aynı VLAN'da mı?",
      'Uç cihaz portu tek bir VLAN taşıyan erişim (access) portudur; mod ve VLAN numarası ayrı ayrı verilir.',
    ],
    unused: [
      'Kablo takılı olmayan portların durumu ne? Kullanılmayan bir port açık bekliyor mu?',
      'Kullanılmayan portu yönetimsel olarak kapatmak, izinsiz bağlantıya karşı temel önlemdir.',
    ],
    same: [
      'Aynı VLAN’daki iki PC birbirine ulaşabiliyor mu? Ulaşamıyorsa önceki hedeflere dön.',
      'Aynı VLAN aynı yayın alanıdır: aynı subnet’teki iki uç doğrudan ARP ile birbirini bulur.',
    ],
    isolated: [
      'Farklı VLAN’daki iki PC aynı subnet’te olduğu halde ping cevap veriyor mu?',
      'VLAN, yayın alanını böler: ARP isteği başka VLAN’a geçmez; arada router yoksa iletişim olmaz.',
    ],
  },
  'ariza-trunk': {
    vlans: [
      'İki switch’in VLAN listelerini yan yana koy: birinde olan bir VLAN öbüründe eksik mi?',
      "Port, var olmayan bir VLAN'a atanırsa trafik taşımaz; VLAN her switch'te ayrı tanımlanır.",
    ],
    access: [
      "PC portlarının hangi VLAN'a atandığına bak; plana uymayan port var mı?",
      'Aynı VLAN’daki iki PC’nin portları iki switch’te de aynı VLAN numarasında olmalı.',
    ],
    native: [
      'Switch’lerin uyarı kayıtlarında (syslog) native VLAN ile ilgili bir mesaj var mı?',
      'Trunk’ın iki ucunda etiketsiz trafik aynı VLAN’a düşmeli; native VLAN iki uçta eşit olmalı.',
    ],
    allowed: [
      "Trunk'ın taşımasına izin verilen VLAN listesine iki uçta bak: biri eksik ya da fazla mı?",
      'Trunk yalnız izinli listesindeki VLAN’ları taşır; liste iki uçta aynı olmalı.',
    ],
    ping: [
      'Ping hâlâ başarısızsa hangi hedef işaretlenmedi? Önce onlara dön.',
      'Uçtan uca erişim, VLAN, erişim portu ve trunk ayarlarının hepsi doğru olunca sağlanır.',
    ],
  },
  'trunk-guvenligi': {
    vlans: [
      "İki switch'in VLAN listesinde üç VLAN da istenen adlarla görünüyor mu?",
      'Park VLAN’ı ve native VLAN da sıradan VLAN gibi her switch’te tanımlanmalıdır.',
    ],
    'static-trunk': [
      'Uplink portunun trunk olup olmadığına ve trunk pazarlığının (negotiation) açık olup olmadığına bak.',
      'DTP trunk’ı kendiliğinden kurmaya çalışır; güvenli tasarımda trunk elle verilir ve pazarlık kapatılır.',
    ],
    native: [
      'Trunk’ın native VLAN’ı ve izinli listesi iki uçta ne gösteriyor?',
      'Native VLAN’ı kullanılmayan bir VLAN’a taşımak VLAN atlama saldırısını zorlaştırır; izinli liste en azda tutulur.',
    ],
    access: [
      'PC portları erişim modunda mı, yoksa trunk pazarlığına açık mı? Açılışta beklemeleri var mı?',
      'Uç portlar sabit access olmalı; PortFast, STP beklemesini atlayıp portu hemen iletime alır.',
    ],
    parked: [
      'Kullanılmayan portlar hangi VLAN’da ve açık mı?',
      'Kullanılmayan portu hem işe yaramayan bir “park” VLAN’ına almak hem de kapatmak iki ayrı önlemdir.',
    ],
    ping: [
      'Hangi PC çifti cevap vermiyor? Trafiğin geçtiği trunk VLAN 10’u taşıyor mu?',
      'Farklı switch’lerdeki aynı VLAN uçları, trunk o VLAN’ı taşıdığında konuşur.',
    ],
  },
  'kampus-vlan-trunk-stp': {
    vlans: [
      "Üç switch'in VLAN listelerini karşılaştır: üç VLAN da her birinde adıyla var mı?",
      'VLAN tanımı switch’ler arasında kendiliğinden yayılmaz (VTP yok); her switch’te ayrı yapılır.',
    ],
    access: [
      'PC portlarının VLAN sütununa bak; PC’ler plandaki VLAN’larda mı?',
      'Uç cihaz portu access moddadır ve tek VLAN taşır.',
    ],
    trunks: [
      'Switch’ler arası linkler trunk mı, ve hangi VLAN’ları taşıyorlar?',
      'Trunk birden çok VLAN’ı etiketleyerek taşır; izinli liste gereksiz VLAN’ları dışarıda bırakır. Bazı switch’ler önce kapsülleme türünü ister.',
    ],
    native: [
      'Native VLAN uyuşmazlığı uyarısı (syslog) var mı? Port-channel arayüzünü de unutma.',
      'Native VLAN her trunk’ın iki ucunda aynı olmalı; port-channel üzerindeki ayar üyelerle tutarlı olmalı.',
    ],
    po1: [
      'SW1–SW2 arasındaki iki link tek bir mantıksal bağlantı olarak görünüyor mu?',
      'LACP iki fiziksel linki tek port-channel’da birleştirir; en az bir uç etkin (active) pazarlık yapmalı.',
    ],
    root: [
      'VLAN 10 ve 20 için root bridge hangi switch? Bridge ID’leri karşılaştır.',
      'Root, en düşük bridge ID’ye (önce priority, eşitse MAC) sahip switch’tir; priority düşürülerek seçilir.',
    ],
    ping10: [
      'VLAN 10’daki iki PC birbirine ulaşıyor mu? Ulaşmıyorsa önceki hedeflere bak.',
      'Aynı VLAN’daki iki uç, aradaki trunk’lar o VLAN’ı taşıdıkça konuşur.',
    ],
    ping20: [
      'VLAN 20’deki iki PC birbirine ulaşıyor mu?',
      'Her VLAN ayrı bir yayın alanıdır; trunk izinli listesinde olmalıdır.',
    ],
    intervlan: [
      'Farklı VLAN’daki PC’ler konuşabiliyor mu? Bir switch yönlendirme yapıyor mu, ağ geçidi adresleri var mı?',
      'VLAN’lar arası trafik L3 gerektirir: L3 switch’te yönlendirme açılır ve her VLAN’a bir SVI (ağ geçidi) verilir.',
    ],
  },
  'stp-yuk-dengeleme': {
    mode: [
      'STP çıktısında switch’lerin hangi STP sürümünü çalıştırdığı yazıyor; dördü de aynı mı?',
      'Rapid PVST+ her VLAN için ayrı ve hızlı yakınsayan bir STP örneği çalıştırır.',
    ],
    roots: [
      'VLAN 10 ve VLAN 20 için root bridge hangi switch?',
      'VLAN başına ayrı root seçmek, trafiği iki dağıtım switch’ine paylaştırmanın yoludur.',
    ],
    secondary: [
      'Root devre dışı kalsa yerine hangi switch geçerdi? Priority değerlerine bak.',
      'Yedek root, root’tan yüksek ama erişim switch’lerinden düşük bir priority ile belirlenir.',
    ],
    balance: [
      'Erişim switch’inde her VLAN için hangi uplink iletimde (FWD), hangisi bloklu?',
      'Root’a giden en ucuz yol root portu olur; VLAN başına farklı root, farklı uplink’i kullandırır.',
    ],
    portfast: [
      'PC portları açılışta iletime geçmek için bekliyor mu?',
      'PortFast, yalnız uç cihaz portlarında STP dinleme/öğrenme beklemesini atlar.',
    ],
    ping: [
      'STP değişikliğinden sonra hangi PC çifti cevap vermiyor?',
      'STP döngüyü kırar ama bağlantıyı koparmamalı; her VLAN için bir yol iletimde kalmalı.',
    ],
  },
  'etherchannel-ariza': {
    po1: [
      'SW1–SW2 port-channel’ının üyeleri hangi durumda? İki uç hangi LACP kipinde?',
      'LACP’de iki pasif uç pazarlığı hiç başlatmaz; en az bir uç etkin olmalı.',
    ],
    po2: [
      'SW1–SW3 iki ucunda aynı EtherChannel protokolü mü kullanılıyor? Üye portların ayarları aynı mı?',
      'LACP ile PAgP birbiriyle konuşmaz; bir bundle’daki üyelerin VLAN/trunk ayarları birebir aynı olmalı.',
    ],
    nostray: [
      'EtherChannel özetinde askıda (s) ya da tek başına (I) bir üye var mı?',
      'Uyumsuz ayarlı üye bundle’a alınmaz ve askıda kalır; bütün üyeler (P) olmalı.',
    ],
    stp: [
      'STP, switch’ler arası uplink’lerden birini bloklu gösteriyor mu?',
      'Bundle kurulunca paralel linkler STP için tek mantıksal port olur, döngü sayılmaz.',
    ],
    ping: [
      'Hangi VLAN’daki PC çifti ulaşamıyor? Trafik hangi port-channel’lardan geçiyor?',
      'Uçtan uca yol iki bundle’dan geçer; ikisi de kurulu olmalı.',
    ],
  },
  'l3-statik-route': {
    routing: [
      'Switch’lerin yönlendirme tablosu var mı, yoksa yalnız kendi arayüzlerine mi cevap veriyorlar?',
      'L3 switch’te IP yönlendirme varsayılan olarak kapalıdır; açılmadan VLAN’lar arası iletim yapılmaz.',
    ],
    svis: [
      'Her SVI’ın adresi ve durumu ne? up/up olmayan var mı?',
      'Bir SVI’ın up olması için VLAN’ın var olması ve o VLAN’da etkin bir portun bulunması gerekir.',
    ],
    transit: [
      'Transit linkin iki ucu aynı VLAN’da mı? SW1 karşı uca ulaşabiliyor mu?',
      'İki L3 switch’i bağlayan transit ağ, iki uçta aynı VLAN’daki SVI’larla kurulur.',
    ],
    default: [
      'Her switch’in yönlendirme tablosunda karşı tarafın ağına giden bir rota var mı?',
      'Statik rota hedef ağı ve sonraki adımı (next-hop) söyler; varsayılan rota bilinmeyen her hedefi karşılar.',
    ],
    local: [
      'SW2 üzerindeki iki VLAN’ın PC’leri birbirine ulaşıyor mu?',
      'Aynı switch’teki iki SVI arası iletim, yönlendirme açıkken doğrudan bağlı ağlar üzerinden olur.',
    ],
    e2e: [
      'Paket gidiyor ama cevap dönmüyor mu? Yolu adım adım izle.',
      'Uçtan uca erişim için gidiş ve dönüş rotası birlikte gerekir.',
    ],
  },
  'yonetim-vlan': {
    hostname: [
      'Komut satırındaki cihaz adları plana uyuyor mu?',
      'Cihaz adı genel yapılandırmada verilir; yönetimde cihazı tanımayı kolaylaştırır.',
    ],
    vlan99: [
      "Erişim switch'lerinin VLAN listesinde yönetim VLAN'ı adıyla var mı?",
      'Yönetim SVI’ı, VLAN’ın kendisi tanımlı değilse hiçbir zaman up olmaz.',
    ],
    svi: [
      'Yönetim arayüzlerinin adresi ve durumu ne?',
      'L2 switch’in yönetim adresi bir SVI’a verilir; SVI’ın up olması için VLAN ve etkin port gerekir.',
    ],
    local: [
      'CORE, aynı VLAN’daki yönetim adreslerine ulaşabiliyor mu? Aradaki trunk o VLAN’ı taşıyor mu?',
      'Aynı VLAN’daki adreslere ağ geçidi olmadan ulaşılır; trunk VLAN’ı taşımalıdır.',
    ],
    gateway: [
      'Başka VLAN’daki PC switch’e ulaşabiliyor mu? Switch cevabı nereye göndereceğini biliyor mu?',
      'L2 switch kendi trafiği için yönlendirme yapmaz; başka ağa cevap için varsayılan ağ geçidine ihtiyaç duyar.',
    ],
    saved: [
      'Çalışan yapılandırma ile kayıtlı yapılandırma aynı mı?',
      'Yeniden başlatmada yalnız kayıtlı (startup) yapılandırma yüklenir; değişiklik kaydedilmeden kalıcı olmaz.',
    ],
  },
  'ospf-tek-alan': {
    links: [
      'Router’lar arası linklerin adresi var mı ve komşu adresine ulaşılabiliyor mu?',
      'Switch portu L3 bağlantı için routed porta çevrilir; /30 iki uçlu bağlantıya yetecek iki adres verir.',
    ],
    rid: [
      'Her router’ın OSPF router ID’si ne? Planla aynı mı?',
      'Router ID OSPF süreci başlarken seçilir; sonradan değişirse süreç yeniden başlatılmadan geçerli olmaz.',
    ],
    adj: [
      'OSPF komşuluk listesinde kaç komşu var ve hangi durumdalar?',
      'Bir arayüz OSPF’e ancak bir network ifadesiyle (ya da arayüz ayarıyla) alınınca hello gönderir ve komşuluk kurar.',
    ],
    passive: [
      'LAN arayüzleri OSPF hello gönderiyor mu? LAN ağı yine de ilan ediliyor mu?',
      'Passive arayüz hello göndermez, komşuluk kurmaz ama ağı ilan edilmeye devam eder.',
    ],
    loop: [
      'R1’in yönlendirme tablosunda diğer router’ların loopback adresleri /32 olarak var mı?',
      'Loopback’in ilan edilmesi için o da OSPF’e alınmalıdır.',
    ],
    e2e: [
      'Her LAN diğer router’ların tablosunda OSPF rotası olarak görünüyor mu?',
      'Uçtan uca erişim, her LAN’ın OSPF ile bütün router’lara yayılmasıyla sağlanır.',
    ],
  },
  'routed-erisim-blogu': {
    routed: [
      'Bloktaki linklerden hâlâ L2 (trunk ya da erişim portu) olarak kalan var mı?',
      'Routed erişim tasarımında bütün linkler L3 noktadan noktaya bağlantıdır; L2 dağıtıma taşınmaz.',
    ],
    novlan: [
      'VLAN 10/20 dağıtım switch’lerinde hâlâ tanımlı mı? Ağ geçitleri hangi switch’te?',
      'L3 erişimde VLAN’lar erişim switch’inde biter; ağ geçidi (SVI) de oradadır.',
    ],
    nostp: [
      'STP herhangi bir portu bloklu gösteriyor mu?',
      'Routed portlar STP’ye katılmaz; döngüsüzlüğü L3’te yönlendirme protokolü sağlar.',
    ],
    p2p: [
      'OSPF komşuluklarında DR/BDR seçimi görünüyor mu? Kaç komşuluk FULL?',
      'İki uçlu bir linkte DR/BDR seçimi gereksizdir; ağ türü noktadan noktaya yapılabilir.',
    ],
    rid: [
      'Router ID’ler plandaki adreslerle aynı mı?',
      'Router ID OSPF süreci başlarken belirlenir; sonradan değişiklik için süreç yeniden başlatılır.',
    ],
    ecmp: [
      'Erişim switch’inin karşı LAN’a giden rotasında kaç yol (via) var?',
      'Eşit maliyetli iki yol varsa OSPF ikisini de tabloya koyar (ECMP); uplink maliyetleri eşit olmalı.',
    ],
    e2e: [
      'PC LAN’ları diğer switch’lerin tablosunda görünüyor mu?',
      'LAN’lar OSPF’e alınmalı ve komşuluk kurulmasın diye passive olmalı.',
    ],
  },
  'bpdu-guard': {
    edge: [
      'Erişim switch’inin uç portlarında PortFast ve BPDU Guard açık mı?',
      'BPDU Guard, uç port BPDU alırsa portu kapatır; uç portlara sonradan bağlanan switch’e karşı korur.',
    ],
    rogue: [
      'Yabancı switch’in bağlı olduğu port hangi durumda?',
      'BPDU Guard açık port BPDU alınca err-disabled duruma düşer.',
    ],
    root: [
      'VLAN 10’un root bridge’i şu an hangi switch? Yabancı switch root’u ele geçirdi mi?',
      'En düşük bridge ID root olur; yabancı switch ağdan ayrılınca planlanan switch yeniden root olur.',
    ],
    uplink: [
      'Switch’ler arası uplink portunda uç port ayarları var mı? Port up ve trunk mı?',
      'PortFast ve BPDU Guard yalnız uç portlarda olur; switch’ler arası port BPDU almak zorundadır.',
    ],
    recovery: [
      'Err-disabled port kendiliğinden geri geliyor mu? Kurtarma nedenleri ve süresi ne?',
      'Err-disable otomatik kurtarma, belirli nedenlerde portu süre sonunda yeniden açar; neden sürerse port yine kapanır.',
    ],
    ping: [
      'PC’ler ağ geçidine ulaşabiliyor mu? Kendi portları err-disabled mı?',
      'PC’ler BPDU göndermez; uç portları açık kalmalıdır.',
    ],
  },
  'ospf-ariza': {
    r1r2: [
      'R1–R2 arayüzlerinin OSPF zamanlayıcılarını karşılaştır.',
      'Komşuluk için hello ve dead aralıkları iki uçta aynı olmalıdır.',
    ],
    r2r3: [
      'R2–R3 linki iki uçta hangi OSPF alanında?',
      'Komşular aynı linkte aynı alan numarasını kullanmalıdır.',
    ],
    r1r3: [
      'R1–R3 komşuluğu hangi durumda takılıyor? Arayüzlerin MTU değerleri aynı mı?',
      'EXSTART/EXCHANGE’de takılma çoğunlukla MTU uyuşmazlığıdır: veritabanı paketleri kabul edilmez.',
    ],
    refbw: [
      'Router’ların referans bant genişliği aynı mı? Link maliyetleri tutarlı mı?',
      'OSPF maliyeti referans bant genişliği / arayüz hızıdır; değer bütün router’larda aynı olmalıdır.',
    ],
    path: [
      'R1’in 192.168.3.0/24 rotası hangi komşu üzerinden gidiyor? Toplam maliyetler ne?',
      'OSPF en düşük toplam maliyetli yolu seçer; maliyetler referans bant genişliğiyle hesaplanır.',
    ],
    e2e: [
      'PC1’den PC3’e paket hangi atlamalardan geçiyor?',
      'Komşuluklar ve maliyetler düzelince yol beklenen router’lar üzerinden geçer.',
    ],
  },
  'ospf-cok-alan': {
    area1: [
      'R1–R2 komşuluğu hangi alanda? R2 kendini alan sınır router’ı olarak görüyor mu?',
      'İki alana bağlı router ABR’dir; area 0 dışındaki alanlar ABR üzerinden omurgaya bağlanır.',
    ],
    lan1: [
      'R3’ün tablosunda R1’in LAN’ı hangi rota türüyle görünüyor?',
      'Başka alandan gelen ağlar ABR’nin ürettiği özet LSA ile gelir ve alanlar arası (IA) rota olur.',
    ],
    asbr: [
      'R2’nin tablosunda dış kaynaklı bir varsayılan rota var mı? R3’ün kendisinde statik varsayılan rota var mı?',
      'Dış rotayı OSPF’e dağıtan router ASBR’dir; varsayılan rota ancak router’ın kendisinde varsa ilan edilir.',
    ],
    stub: [
      'R1’in tablosunda hangi OSPF rota türleri var? Dış (E2) rotalar görünüyor mu?',
      'Totally stubby alan dış ve alanlar arası rotaları almaz; yalnız ABR’nin verdiği varsayılan rotayı alır.',
    ],
    e2e: [
      'PC1’in paketleri internete hangi atlamalardan çıkıyor?',
      'Her alan varsayılan rotayla bir sonraki adıma, ASBR de dış ağa gider.',
    ],
  },
}
