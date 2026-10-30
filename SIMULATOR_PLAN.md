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
| Router static/default route | Connected/LPM/recursive lookup mevcut | Gerçek next-hop yoluna sadakat ve dönüş yolu audit bulguları Aşama 3'te çözülmeli |
| ARP/MAC | Başarılı trafik sonrası öğrenme | Tam frame flooding/aging değildir; Aşama 2 kapsamı |
| ACL/PAT | Sınırlı CLI/model ve trafik kontrolü mevcut | Tüm wildcard, yön, sayaç ve translation semantiği tamamlanmış sayılmaz |
| DHCP/DNS/HTTP | Sınırlı eğitim servis davranışları | Tam protokol/mesaj modeli değildir |
| OSPF/BGP | Bağımsız eğitim panelleri | Ortak topoloji motorunda dinamik rota kurulumu değildir |
| Traceroute/Paket adımı | Önceki sınırlı yol gösterimi | Yeni SVI için CLI traceroute açıkça desteklenmiyor; tam TTL/olay kaydı Aşama 5 önceliği |

## Sonraki aşamalar: yalnız plan

1. Aşama 1 doğrulanıp incelemeye sunulduktan sonra L2: VLAN/802.1Q/native doğruluğu, frame forwarding, MAC aging ve flooding. Önceki VLAN 10 legacy ping audit bulgusu tüm cihaz akışlarında giderilmeli.
2. Routing: seçili gerçek next-hop'u izleyen hop-by-hop kararlar, dönüş yolu, ARP, TTL/ICMP/traceroute. Yanlış başarılı ping audit bulgusu kapatılmalı.
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

Doğrulama: `test_aglab_switch_svi.py` CLI/model/ağ/kalıcılık katmanlarını; `test_aglab_svi_import.py` sentetik PT XML aktarımını ve canlı ping'i sınar. Tam pipeline 22 test grubunu çalıştırır.
