# İlk uyarlama grubu ve kaynak denetimi

30 Ekim 2026, main faef51b temel alınmıştır. Kaynak paket önceki yerel
çalışmanın outputs/AgLab_Akademi_Ilk_40_TR.zip ve açılmış
aglab-akademi-ilk-40 dizininde bulundu. Bu paket için hazırlanmış Türkçe
içeriktir; Cisco tarafından doğrulanmış laboratuvar paketi değildir.

AGL-006–040 özgün JSON dosyaları baytları değiştirilmeden source/ içine
alındı. SHA256.json tüm 40 kaynağın özetini içerir. Her dosyanın 100 puanlık
rubriği, cevap anahtarı, hedef durum yolları ve ayrı başlangıç/çözüm
topolojileri karşılaştırıldı; tutarsızlık bulunmadı. Bu içerik denetimi,
çalıştırılmamış laboratuvarların motor desteğini kanıtlamaz.

## İlk grup: AGL-006–010

- 006: üç uçlu yıldız; bağlantı ekleme ve arıza kapsamı.
- 007: çift yönlü ping; ICMP ve HTTP ayrımı.
- 008: yerel teslim ve ARP kavramsal soruları.
- 009: aynı fiziksel ağdaki yanlış IPv4 adresini düzeltme.
- 010: kablo ve adres arızası olan yerel ağ mini projesi.

Görevler, topolojiler, cevaplar ve rubrikler özgün kaynaktan aktarılmıştır.
Yeni cevap kontrollerinde soru metnine uygun seçenekler sunulur; beklenen
değerler özgün cevap anahtarından gelir. Öğrenci/öğretmen ayrımı korunur.
ARP soruları kavramsaldır; gerçek ARP paket yakalama görevi eklenmemiştir.
ICMP önceki sürümdeki deterministik beş deneme uyarlamasını kullanır;
gerçek zamanlı icmp-5-v1 uygunluğu iddia edilmez.

## İkinci grup: AGL-011–020

IPv4 /24–/30, host aralığı, maske uyuşmazlığı ve VLSM görevleri özgün
kaynaklarından öğrenci/öğretmen şemasına aktarılmıştır. Rubrikler değişmez.
Sayı cevapları JSON tamsayısı olarak saklanır. IPv4 cevaplarında ondalık
oktetler, CIDR cevaplarında ağ öneği kanonik karşılaştırılır; örneğin
192.168.19.65/27, 192.168.19.64/27 ağıdır. Hatalı maske/oktet ve kesirli
host sayıları puan kazandırmaz. Hatalı taslak cevap da kaydedilip geri açılır.
Chromium testi 20 görevin başlangıç/çözüm/bozuk erişim/sıfırlamasını,
AGL-013'ün öğrenci CLI çözümünü ve sayı/IP/CIDR cevaplarının kalıcılığını kapsar.

## Üçüncü grup: AGL-021–030

MAC/IP ayrımı, access VLAN, 802.1Q trunk, allowed listesi, arıza kapsamı,
native VLAN ve VLAN mini projesi özgün rubrikleri değiştirilmeden eklendi.
VLAN ve allowed listeleri sırasız, benzersiz tamsayı kümeleridir.

023/026/027/030 için ayrı probe_health planı özgün hedefin bağlantı ve
adres/VLAN/trunk alanlarından türetilir; puan ve rubrik değişmez. Bu tutucu
önkoşul tüm planlanan kabloları, açık cihaz/portları, uç IP/maskelerini,
VLAN veritabanını ve bağlı portların VLAN/trunk ayarlarını doğrular.
Varsa aynı VLAN'daki uç çiftleri iki yönde pozitif ping ile kontrol edilir.
023'te aynı VLAN'da ikinci uç yoktur; fiziksel ve yapılandırma kontrolleri
kullanılır. Sağlık geçmezse negatif ölçüt error, toplam incomplete olur;
kablo koparmak veya port kapatmak yalıtım puanı kazandırmaz.

Sağlık geçtikten sonra beş güncel simüle ping'in tümü başarısızsa negatif
ölçüt geçer. Bu yalnız mevcut deterministik L2 eğitim ağı içindir. ARP
yakınsaması ve gerçek zamanlı paket kaybı modellenmez. Plan kullanıcıya
açıktır; öğretmen çözümü probe için yüklenmez. Muhafazakâr plan kontrolü,
eşdeğer farklı topoloji tasarımlarını kabul eden genel ağ doğrulaması değildir.

Chromium kapsamı 30 görev, sırası değiştirilmiş VLAN/allowed listeleri,
yalıtımda bozuk kablo/cihaz/port/IP/VLAN/trunk saldırıları, AGL-024 trunk
ve AGL-023 yalıtım CLI çözümü ile yenileme sonrası puanlamayı içerir.
Node sağlık kapısı testi CI'da ayrıca çalışır.

## Sonraki grup

Her laboratuvarın sonucu adaptation-audit.json dosyasında ayrı yer alır.

1. AGL-031–040: arayüz nesnelerinde türetilmiş alanların ve rota kümelerinin
   semantik karşılaştırması; statik/çok atlamalı routing testleri.
   033 açık source_interface ve destination_ip probe bağdaştırıcısı
   olmadan engellidir.

Bekleyen/engelli içerikler öğrenci listesine eklenmez. Bu gruplar henüz
çalıştırılmadı; OSPF/BGP/ACL/NAT/DHCP içeriği uydurulmadı.
