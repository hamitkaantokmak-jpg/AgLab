# AğLab simülasyon geliştirme planı — A seçeneği

Dağıtım tarayıcıda, çevrimdışı ve tek HTML olarak korunur. Cisco IOS imajı, VM veya QEMU kullanılmaz. Her destek iddiası CLI → model → gerçek simüle davranış → doğrulama zincirine dayanır.

Bu dalın başlangıcındaki main: `7bd05b59edabb3bba6ee11dd9bb3d829da4e4d9e`. PR #6 main'e birleştirilmiştir; trunk düzeltmeleri yeniden yazılmadan korunur. Güncel başlangıç regresyonu 20 grup PASS. Depoda 33 değil **20 ders**, 25 Sorun Çöz senaryosu ve 5 Akademi laboratuvarı vardır; tarayıcıdan sayılmıştır. Ders kaynakları değiştirilmemiştir. 40 laboratuvarın tamamı veya dinamik routing entegrasyonu mevcutmuş gibi sunulmaz.

## Aşama 1: bu çalışmanın kapsamı

- VLAN 1–4094 oluşturma, isim, silme (VLAN 1 korunur); `(config-vlan)#` modu.
- Mevcut access/trunk/native/allowed yapılandırması korunur. Yönetim paketinde native/etiket ayrımı sıkı denetlenir; VLAN 10 için ayrıcalık uygulanmaz.
- `interface vlan X` / `interface vlanX`, IP/maske, shutdown/no shutdown, no ip address. SVI fiziksel port listesine girmez ve başka VLAN'lar arasında transit routing sağlamaz.
- SVI autostate: switch/arayüz admin durumu, VLAN'ın veritabanında bulunması ve VLAN'ı taşıyan bağlı/forwarding port. Ayrıntı `show interfaces vlan X` ile görünür.
- `ip default-gateway` / `no ip default-gateway`. Kaynak SVI hedef subnetine göre, uzak hedefte yerel gateway subnetine göre seçilir. Aynı subnet için gateway gerekmez; uzak hedefte doğru gateway ve dönüş erişimi gerekir.
- Switch yönetim ping'i ve PC/router'dan SVI'ye erişim aynı ping, VLAN, STP, routing ve ARP/MAC modelini kullanır; sahte başarılı sonuç üretmek için geçici cihaz/IP eklenmez.
- `show vlan brief`, `show interfaces status/trunk`, `show ip interface brief`, `show running-config`, `show interfaces vlan X`, `show mac address-table`, `show arp` gerçek modelden okunur.
- `copy running-config startup-config`, `show startup-config`, `copy startup-config running-config`: switch için ayrı startup snapshot'ı. Tarayıcı tekrar açıldığında çalışma kaydı geri gelir; yeniden başlatma otomatik olarak running-config'i startup-config ile değiştirmez. IOS boot/reload henüz modellenmez.
- JSON, tarayıcı kaydı ve yeni tarayıcı süreci desteklenir; mantıksal SVI ve startup alanları şema doğrulamasına tabidir.
- PT XML switch SVI, isim ve default-gateway alanları bu modele aktarılır; `ip routing` gibi L3 switch komutları model dışı raporlanır. Yeni gerçek PKT örneği eklenmez.

## Komut envanteri ve gerçek kapsam

| Komut grubu | Mevcut davranış | Kanıt/kapsam |
|---|---|---|
| VLAN/access/trunk/shutdown | Port/VLAN ve erişimi etkiler | Önceki regresyonlar + yeni yönetim negatifleri |
| Switch SVI/gateway/ping | Bu çalışmada uçtan uca yönetim endpoint'i | CLI/model/ağ/kalıcılık ve XML aktarım testleri |
| Router static/default route | Connected/LPM/recursive lookup mevcut | Seçili wire next-hop ve gerçek asimetrik dönüş yolu takip PR'ında doğrulandı; NAT dışı router/SVI frame entegrasyonu takip çalışmasında eklendi; TTL entegrasyonu açık |
| ARP/MAC | MAC: giriş portu, VLAN anahtarı, router sınırı, 300 sn aging; ARP komşu bazında ping ile öğrenilir | Ortak yerel/router/SVI frame iletimi (NAT dışı); ARP aging hâlâ açık |
| ACL/PAT | Sınırlı CLI/model ve trafik kontrolü mevcut | Tüm wildcard, yön, sayaç ve translation semantiği tamamlanmış sayılmaz |
| DHCP/DNS/HTTP | Sınırlı eğitim servis davranışları | Tam protokol/mesaj modeli değildir |
| OSPF/BGP | Bağımsız eğitim panelleri | Ortak topoloji motorunda dinamik rota kurulumu değildir |
| Traceroute/Paket adımı | Önceki sınırlı yol gösterimi | Yeni SVI için CLI traceroute açıkça desteklenmiyor; tam TTL/olay kaydı Aşama 5 önceliği |

## Sonraki aşamalar: yalnız plan

1. Aşama 1 doğrulanıp incelemeye sunulduktan sonra L2: VLAN/802.1Q/native doğruluğu, frame forwarding, MAC aging ve flooding. VLAN 10 legacy ping istisnası takip eden L2 düzeltmesinde kaldırıldı; frame forwarding/aging hâlâ açıktır.
2. Routing: seçili gerçek next-hop'u izleyen hop-by-hop kararlar, dönüş yolu, ARP, TTL/ICMP/traceroute. Paylaşılan LAN seçili next-hop yanlış başarılı ping bulgusu takip routing PR'ında giderildi; frame/TTL entegrasyonu sürmeli.
3. Ortak forwarding olay kaydı; Paket Dedektifi gerçek kararları tüketmeli.
4. ACL, NAT/PAT; ardından STP/RSTP, EtherChannel/LACP.
5. OSPF; sonra DHCP/DNS, IPv6 ve ayrı RIP/BGP kapsamları.

Bu sırada kayıt kurtarma ve belirsiz PT cihaz kimliği audit bulguları da bağımsız güvenilirlik işleri olarak açık kalır. Bu PR bu bulguları çözmüş gibi sunulmaz. Aşama 1 bitmeden sonraki protokoller eklenmez.

## Kaynak ve derleme

`simulator/switch-management.js` switch yönetim CLI/model/operasyon kurallarını içerir. `build_simulator.py` bu kaynağı mevcut motor closure'ı içine gömer. Mevcut genel CLI ve motorun geri kalanı henüz tek HTML'dedir; kademeli modülerleştirme yapılır. `academy/` kaynakları ve Öğren/Test/Sorun Çöz akışları korunur.

```bash
python build_simulator.py
python build_academy.py
python run_pipeline.py
```

SVI testi gömülü kaynağın modülle aynı olduğunu doğrular. Nihai HTML harici JS veya sunucu gerektirmez. Açıklanan STP autostate deterministik mevcut ağaç modelidir; BPDU timer/RSTP yakınsaması veya donanıma özgü IOS davranışı garantisi verilmez.

## Yönetim SVI örneği

Switch'in router'a ve PC'ye bağlı portlarını access VLAN 10'a al. Router portuna `192.168.10.1/24`, PC'ye `192.168.10.3/24` ver. Switch CLI:

```text
enable
configure terminal
vlan 10
name Yonetim
exit
interface vlan 10
ip address 192.168.10.2 255.255.255.0
no shutdown
exit
ip default-gateway 192.168.10.1
end
show interfaces vlan 10
ping 192.168.10.1
copy running-config startup-config
```

Router portu kapandığında router ping'i başarısız olmalıdır. PC portu VLAN 10'da bağlı kaldığı sürece SVI up kalabilir; VLAN'ı taşıyan son forwarding port kapanırsa line protocol down olur. Port geri açılınca ping yeniden başarılı olur. Uzak hedef ARP kaydında uzak cihaz yerine yerel gateway bulunur. Startup kaydı depolama kotası nedeniyle yazılamazsa başarı mesajı verilmez ve önceki startup snapshot'ı korunur.

Doğrulama: `test_aglab_switch_svi.py` CLI/model/ağ/kalıcılık katmanlarını; `test_aglab_svi_import.py` sentetik PT XML aktarımını ve canlı ping'i sınar. SVI çalışmasının pipeline sonucu 22/22 başarılıdır; takip eden L2 regresyonuyla toplam 23 grup vardır.

## L2 takip düzeltmesi: router–switch trunk sınırı

VLAN 10'a özel etiketsiz geçiş istisnası kaldırıldı. Router fiziksel arayüzünden çıkan paket, switch trunk native VLAN'ına eşlenir; rastgele ilk alt arayüzün VLAN'ı seçilmez. Native VLAN trafiği etkin fiziksel IP arayüzü; native olmayan VLAN ise aynı fiziksel porta bağlı, etkin ve doğru dot1Q VLAN'ına sahip alt arayüz gerektirir. `encapsulation dot1q ... native` hâlâ desteklenmez; native VLAN için yalnız etiketli alt arayüz yapılandırılmışsa çift yönlü ping başarılı gösterilmez. PC ve SVI yönetimi ortak bağlantı kontrolünü kullanır.

`test_aglab_l2_router_trunk.py`: VLAN 10/77/333 üzerinde 18 sentetik PT XML örneği, her iki yönde ping, yanlış native VLAN, eksik/kapalı alt arayüz, allowed none ve CLI ile native VLAN hata/düzelme döngüsü. Özgün XML arşivi korunur. Bu düzeltme tam frame motoru, flooding, MAC aging veya next-hop audit çözümü olarak sunulmaz.

## L2 takip çalışması: dinamik MAC öğrenme

`simulator/mac-learning.js` kaynak MAC'i çıkış portu yerine gerçek giriş portunda öğrenir. Ping gidiş ve yanıt yolları ayrı işlenir; router çıkışında kaynak MAC router'ın modeldeki MAC'i olur. Paket adımı yalnız gerçekten geçilen giriş portunu öğrenir; yanıt gelmeden hedef MAC öğrenilmiş gibi gösterilmez. Router MAC'i cihaz başına model adresidir, fiziksel arayüze ayrı MAC üretimi bu kapsamda değildir.

Anahtar VLAN + MAC'tir; aynı router MAC'i birden fazla VLAN'da ayrı satırlar oluşturabilir. `show mac address-table` dinamik satırları gösterir. 300 saniye kaynak trafik alınmazsa kayıt yaşlanır; okuma veya yeni öğrenmede tembel temizleme yapılır. Kapalı/kopuk port, silinen VLAN ve değişen access/allowed üyeliği de eski satırları temizler. `enable` modunda `clear mac address-table dynamic` yalnız seçili switch'in tablosunu siler. Operasyonel MAC tabloları JSON/startup'a yazılmaz; yeniden açılışta trafikle öğrenilir.

Yeni tarayıcı regresyonu giriş portlarını iki switch üzerinde; Paket adımı ara durumunu; 300 saniye sınırını, yeniden öğrenmeyi, port/VLAN değişimini, clear komutu/yetkisini, aynı MAC'in iki VLAN'ını ve router sınırını doğrular. Tam pipeline toplam 24 gruptur. Frame hedef seçimi hâlâ mevcut yol motorundadır: bu çalışma MAC tablosunun forwarding kararını yönettiği veya flooding uygulandığı iddiası taşımaz. Gerçek frame iletimi ve unknown/broadcast flood sıradaki önceliktir; routing audit bulgusu açık kalır.

## L2 takip çalışması: yerel frame forwarding

`simulator/ethernet-forwarding.js` aynı subnet ve router içermeyen yerel PC/Server ping'ini gerçek frame yayılımıyla doğrular. Boş ARP cache'te ARP broadcast, hedefin unicast ARP yanıtı, ardından ICMP request/reply gönderilir. Sonraki ping cache'i kullanır. Dinamik FDB egress kararını belirler: bilinmeyen unicast ve broadcast yalnız aynı VLAN'ın bağlı, allowed ve STP forwarding portlarına; bilinen hedef tek porta gider. Giriş portu çıkış olarak seçilirse frame filtrelenir. NIC hedefi uyuşmayan uç frame'i alabilir ama kabul etmez. Access/trunk etiketsiz trafiğinde native VLAN eşleşmesi zorunludur.

Aktif ama yanlış porta işaret eden stale MAC kaydı ping'i gerçekten başarısız kılabilir; motor BFS ile başarıya zorlamaz. Hedef yeniden trafik ürettiğinde source learning kaydı düzeltir. Link/VLAN/STP nedeniyle kullanılamayan egress temizlenip unknown-unicast flood'a geçilir. Router'lar broadcast veya unknown-unicast frame'lerini başka LAN'a bridge etmez.

Eğitim amaçlı özel tanı komutları (IOS uyumluluğu iddiası değildir):

```text
test ethernet 0200.0000.0004
test ethernet broadcast
show ethernet events
```

Tanı frame'leri yalnız etkin PC/Server'dan gönderilir; MAC öğrenmeyi gerçekten etkiler. Olay listesi son yerel işleme aittir, en çok 256 olayı tutar ve sığmayan olay sayısını açıklar; iletim kırpılmaz. Topoloji yükleme/sıfırlama ve yeni ping eski olay listesini temizler. Multicast/IGMP bu kapsamda yoktur; multicast tanı hedefleri reddedilir. ARP cache aging, 5 ayrı zamanlanmış ICMP paketi, kayıp/gecikme, ortak router/SVI forwarding ve Paket Dedektifi'nin yeni olayları tüketmesi açık kalır. Var olan CLI 5/5 eğitim özeti korunur.

Yeni browser testi flood/learned unicast, VLAN izolasyonu, ARP cache, FDB aging, MAC taşınması, gerçek stale-FDB ping hatası, native/access sınırı, üçgen STP ve router broadcast sınırını doğrular. Toplam pipeline 25 gruptur. Önceki MAC çalışmasındaki “frame forwarding açık” notu o PR'ın tarihsel kapsamıdır; bu takip çalışması yalnız belirtilen yerel akışları tamamlar. L3 routing next-hop audit bulgusu hâlâ açıktır.

## Routing takip çalışması: seçili next-hop ve gerçek dönüş yolu

`simulator/routing-path.js` rota kararını L2 aramadan önce belirli bir wire komşusuna bağlar. Kaynak gateway, router çıkış arayüzü ve LPM/AD ile seçilen statik next-hop gerçekten izlenir; aynı transit LAN'daki başka router'a topolojik kısayol uygulanmaz. Recursive rotada son doğrudan wire komşusu kullanılır. Hedefe bağlı rota yalnız hedef IP'nin gerçek sahibiyle sonlanır. Komşunun fiziksel giriş portu ve dot1Q VLAN metadata'sı kontrol edilir; alt arayüz numarası VLAN ID sayılmaz.

Aynı switch'e başka router üzerinden geri dönen geçerli hairpin yolları desteklemek için arama durumu beklenen next-hop kimliğini içerir. Aynı durum tekrar ziyaret edilmez; route loop araması sonlanır. Bu koruma gerçek TTL/ICMP Time Exceeded modellemesi değildir. Router kaynaklı ping çıkış arayüzünün IP adresini kullanır. Gateway olmayan veya yerel subnet dışında gateway tanımlanmış uçların uzak router ping'i de başarılı gösterilmez.

Dönüş, gidişin ters çevrilmesiyle varsayılmaz: hedefin kendi gateway/rota/next-hop kararlarıyla ayrı hesaplanır. Dönüşe özel router ACL'si ve MAC öğrenmesi gerçek dönüş yoluna uygulanır. Gidişte bulunan ama dönüşte kullanılmayan router'da dönüş rotası zorunlu tutulmaz. NAT/PAT çevrilmiş cevaplar mevcut eski çeviri modeliyle ters yolu kullanmaya devam eder; tam NAT frame/dönüş motoru bu kapsamda değildir.

Yeni browser regresyonu seçili fakat hedef rotası olmayan next-hop; doğru komşu; aynı LAN hairpin; recursive next-hop; geçerli/geçersiz asimetrik dönüş; yalnız dönüşte kullanılan router ACL'si/MAC öğrenmesi; farklı gateway kullanan asimetrik SVI ve gateway MAC portu; AD/LPM ve sessiz alternatif router/floating route kullanmama; loop sonlanması; kaynak gateway; bağımsız alt arayüz numarası; CLI ile rota düzeltmesini sınar. Tam pipeline 26 gruptur. Router/SVI akışları henüz ortak frame motorunda değildir; ARP/NAT/TTL ve Paket Dedektifi olay entegrasyonu açık kalır. Kayıt kurtarma ve belirsiz PT kimliği audit işleri bu çalışmada çözülmez.

## Ortak frame motoru: router ve SVI entegrasyonu

`simulator/routed-ethernet.js` seçili gidiş/dönüş yolunu router sınırlarında L2 bölümlerine ayırır. Her bölümde, seçilmiş mantıksal arayüzün kaynak IP'siyle gerçek ARP request/reply ve Ethernet ICMP teslimi çalışır. Router frame'i yalnız seçili fiziksel çıkıştan gönderir; alıcı router'ın gerçek giriş portu da denetlenir. Router yeni L2 bölümünde kendi model MAC'ini kullanır; uçtan uca paket IP adresleri değişmez.

Uç ARP tablosuna uzak host yerine gateway, router tablosuna kendi doğrudan L2 komşusu yazılır. Sıcak cache tekrar ARP üretmez; FDB'nin geçerli ama yanlış çıkışı gerçek yönlendirilmiş ping'i durdurur. Hedef kaynak trafik üretip yeni port öğrenildiğinde erişim düzelir. ARP cache yaşlandırması/scope anahtarı ve arayüz başına donanım MAC'leri henüz eklenmez.

Etkin SVI, kendi VLAN'ında switch'in yerel MAC'ine gelen frame'i kabul eder ve IP uç noktası olarak yanıtlar; yeni fiziksel port veya transit L3 switch yeteneği eklenmez. Broadcast bridge olarak diğer uygun portlara da yayılır. SVI shutdown/autostate mevcut modelden okunur. Paket Adımı tamamlandığında eski sentetik ARP/öğrenme tekrar uygulanmaz; gerçek ping tesliminin ürettiği kayıtlar korunur. Paket Adımı'nın ara gösterimi henüz ortak frame olay oynatıcısı değildir.

Yeni test: çok atlamalı gerçek ARP/ICMP; değişmeyen uç IP'ler; seçilmiş router fiziksel portundan yayın; sıcak unicast; stale-FDB nedeniyle başarısız routed ping ve yeniden öğrenmeyle düzelme; yerel/uzak SVI, gateway ARP, shutdown ve toparlanma; Paket Adımı'nın ARP'yi bozmaması. Önceki recursive/asimetrik routing, dot1Q, gerçek PKT/XML, Akademi, kayıt ve büyük topoloji testleri korunur. Toplam pipeline 27 gruptur.

**Sınır:** NAT/PAT çevirili akışlar eski çeviri modelinde kalır ve `show ethernet events` bunu `legacy-nat` olarak açıklar; frame teslimi doğrulanmış sayılmaz. Yeni motor NAT dışı ping akışlarını kapsar. TTL/Time Exceeded, zamanlanmış beş ICMP paketi, gecikme/kayıp, ARP aging ve tam Paket Dedektifi oynatıcısı sonraki önceliktir. Geçmiş PR bölümlerindeki açık frame entegrasyonu notları o çalışmanın tarihsel kapsamıdır.
