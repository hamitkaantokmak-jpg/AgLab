# AğLab Konu #7: VLAN'lar arası yönlendirme

> Uygulamadaki `intervlan` dersi bu belgeyle uyumludur. Senaryolar Sorun Çöz'de `roas-*`
> kimlikleriyle Labber'da çalışır (`verify.kind: "query"`). Ön koşul: Konu #5–6 (VLAN ve trunk),
> varsayılan ağ geçidi (Konu #8).

Bu konu bittiğinde öğrenci VLAN'ların neden bir yönlendirici olmadan haberleşemediğini açıklar. Router-on-a-stick'i alt arayüz ve 802.1Q trunk ile kurar; L3 switch'te SVI ve `ip routing` ile yönlendirmenin nasıl çalıştığını açıklar. Yanlış etiket, trunk olmayan port, yanlış gateway ve kapalı fiziksel arayüz arızalarını kanıtla ayırır. Seviye 1, süre yaklaşık 80 dakika.

## 1. Neden önemli

VLAN'lar ağı bilerek böler. Ama muhasebe yine de satıştaki yazıcıya, herkes sunucuya ulaşmak zorundadır. Bu yüzden şubelerin neredeyse hepsinde VLAN'lar arası yönlendirme vardır. Tipik şikâyet "kendi bölümüme ulaşıyorum, diğerine ulaşamıyorum"dur. Bu belirti sorunu hemen daraltır: katman 2 o VLAN içinde sağlam, sorun gateway ile router arasındaki yolda.

## 2. Kavram

- **Her VLAN ayrı bir ağdır.** Muhasebe VLAN 10 (192.168.10.0/24), satış VLAN 20 (192.168.20.0/24). PC başka ağdaki hedefe paketi doğrudan göndermez, kendi VLAN'ındaki gateway'e gönderir. Her VLAN'ın o VLAN'da duran bir gateway adresi olmalıdır.
- **Router-on-a-stick:** Router'ın tek fiziksel portu switch'e trunk olarak bağlanır. Fiziksel porta IP verilmez, yalnız `no shutdown` yapılır. Her VLAN için bir alt arayüz açılır:
  `interface g0/0.10` → `encapsulation dot1Q 10` → `ip address 192.168.10.1 255.255.255.0`.
  Router VLAN 10 etiketli çerçeveyi .10 alt arayüzüne alır, yönlendirir ve VLAN 20 etiketiyle aynı kablodan geri gönderir. Encapsulation satırı IP'den önce gelir; IOS etiketi olmayan LAN alt arayüzüne adres vermez.
- **Üç kural:**
  1. Alt arayüzün numarası yalnız bir addır; VLAN'ı `encapsulation dot1Q` belirler.
  2. Fiziksel arayüz kapalıysa bütün alt arayüzler düşer.
  3. Router'a giden switch portu trunk değilse (ya da VLAN izinli değilse) router'a yalnız o VLAN ulaşır.
- **L3 switch ve SVI:** Her VLAN için `interface vlan 10` açılıp gateway adresi verilir; yönlendirme `ip routing` ile açılır (Catalyst'te varsayılan kapalı). `ip routing` yoksa switch SVI adreslerine yanıt verir ama VLAN'lar arasında paket taşımaz. SVI'nın up/up olması için VLAN switch'te olmalı, o VLAN'da forwarding bir port bulunmalı ve SVI `no shutdown` olmalı. Router-on-a-stick ucuz ve basittir ama VLAN'lar arası trafik tek kablodan iki kez geçer; L3 switch bunu donanımda yapar.

*(Etkileşimli şema: PC-01'den PC-02'ye paket: VLAN 10 etiketiyle trunk'tan R1'e, .10 alt arayüzü, yönlendirme, .20 alt arayüzü, VLAN 20 etiketiyle geri.)*

## 3. Çıktı okuma

```
R1#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     unassigned      YES unset  up                    up
GigabitEthernet0/0.10  192.168.10.1    YES manual up                    up
GigabitEthernet0/0.20  192.168.20.1    YES manual up                    up
        ← G0/0 "administratively down" olsaydı alt arayüzler de down olurdu

R1#show running-config interface g0/0.20
interface GigabitEthernet0/0.20
 encapsulation dot1Q 30                  ← adı .20 ama VLAN 30'u bekliyor
 ip address 192.168.20.1 255.255.255.0

R1#show ip route connected
C        192.168.10.0/24 is directly connected, GigabitEthernet0/0.10
C        192.168.20.0/24 is directly connected, GigabitEthernet0/0.20

SW1#show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Gi0/1       on           802.1q         trunking      1
Port        Vlans allowed on trunk
Gi0/1       10,20                        ← router'a giden trunk iki VLAN'ı da taşıyor
```

| Belirti | İlk bakılacak |
| --- | --- |
| Tek PC başka VLAN'a ulaşamıyor, kendi VLAN'ına ulaşıyor | PC'nin gateway'i |
| Bir VLAN kendi gateway'ine bile ulaşamıyor | Alt arayüzün etiketi, trunk izinli listesi |
| Yalnız bir VLAN dışarı çıkıyor | Router'a giden switch portu trunk mı? |
| Hiçbir VLAN gateway'ine ulaşamıyor | Fiziksel arayüz, kablo |

## 4. Yönlendirmeli lab

Topoloji: R1 G0/0 ─ SW1 Gi0/1; SW1'de PC-01 ve PC-03 VLAN 10, PC-02 VLAN 20.

1. **Switch tarafı:** SW1 → `interface gi0/1` → `switchport mode trunk` → `switchport trunk allowed vlan 10,20`.
2. **Router fiziksel arayüz:** R1 → `interface g0/0` → `no shutdown` (IP yok).
3. **Alt arayüzler:** `interface g0/0.10` → `encapsulation dot1Q 10` → `ip address 192.168.10.1 255.255.255.0`; aynısı .20 için. *Neden:* Encapsulation önce gelir; etiketsiz LAN alt arayüzüne IP verilemez.
4. **Doğrula:** `show ip interface brief`, `show ip route connected`, SW1'de `show interfaces trunk`.
5. **PC'ler:** gateway'leri kendi VLAN'larındaki alt arayüz adresi olmalı (`show ip`).
6. **Test:** PC-01 → 192.168.10.1, PC-01 → PC-02, `trace` ile gateway'in yolda göründüğünü gör.
7. Kaydet.

**Lab'ın otomatik değerlendirmesi:** `q.ping('PC-01', '192.168.20.12').ok`; `q.ping('PC-02', '192.168.10.11').ok`.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | Alt arayüzde yanlış etiket | Bir VLAN gateway'ine ulaşamıyor, diğerleri çalışıyor | running-config'te `encapsulation dot1Q 30` | Doğru etiket |
| E2 | Router'a giden port trunk değil | Yalnız portun access VLAN'ı çıkabiliyor | `show interfaces trunk`'ta port yok | `switchport mode trunk` + izinli liste |
| E3 | PC'de yanlış gateway | Tek PC; kendi VLAN'ı çalışıyor | PC'nin gateway'i alt arayüz adresinden farklı | Doğru gateway |
| E4 | Fiziksel arayüz kapalı | Hiçbir VLAN gateway'ine ulaşamıyor | G0/0 administratively down | Fiziksel arayüzde `no shutdown` |
| E5 | L3 switch'te `ip routing` yok | SVI'lar up, gateway'e ping var, VLAN'lar arası yok | `show ip route` tablo göstermiyor | `ip routing` |

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `roas-wrong-tag`, `roas-switch-port-access`, `roas-pc-gateway`,
> `roas-physical-shutdown`, `roas-two-faults` kimlikleriyle Labber'da çalışır.

### S1 · Başlangıç · Muhasebe satışa ulaşamıyor (E1)

- **Belirti:** PC-01 (VLAN 10) kendi VLAN'ına ve gateway'ine ulaşıyor, PC-02'ye (VLAN 20) ulaşamıyor.
- **Neden:** R1 g0/0.20'de `encapsulation dot1Q 30`.
- **Çözüm:** R1 → `interface g0/0.20` → `encapsulation dot1q 20`
- **Hedef:** PC-01 → PC-02

### S2 · Başlangıç · Yalnız bir VLAN dışarı çıkabiliyor (E2)

- **Belirti:** VLAN 10 gateway'ine ulaşıyor; VLAN 20'deki PC-02 kendi gateway'ine bile ulaşamıyor.
- **Neden:** SW1 Gi0/1 VLAN 10'da access port.
- **Çözüm:** SW1 → `interface gi0/1` → `switchport mode trunk` → `switchport trunk allowed vlan 10,20`
- **Hedef:** PC-02 → PC-01

### S3 · Orta · Yeni PC yalnız kendi bölümünü görüyor (E3)

- **Belirti:** PC-02 yeni kuruldu; satışa ulaşıyor, muhasebeye ulaşamıyor. Diğer satış PC'leri ulaşıyor.
- **Neden:** PC-02'nin gateway'i 192.168.20.254; R1'in adresi .1.
- **Çözüm:** PC-02 → `ip 192.168.20.12 255.255.255.0 192.168.20.1`
- **Hedefler:** PC-02 → PC-01, PC-02 → PC-03

### S4 · Orta · Alt arayüzler doğru ama hiçbiri çalışmıyor (E4)

- **Belirti:** Bakımdan sonra hiçbir VLAN diğerine, PC'ler gateway'lerine bile ulaşamıyor.
- **Neden:** R1 g0/0 `shutdown`.
- **Çözüm:** R1 → `interface g0/0` → `no shutdown`
- **Hedefler:** PC-01 → PC-02, PC-03 → PC-02

### S5 · İleri · İki hata birden (izinli liste + E3)

- **Belirti:** Muhasebe satışa ulaşamıyor; bir hatayı düzeltince de erişim gelmiyor.
- **Neden:** SW1 Gi0/1 trunk'ında VLAN 20 izinli değil **ve** PC-02'nin gateway'i yanlış.
- **Çözüm:** SW1 → `switchport trunk allowed vlan add 20`; PC-02 → `ip 192.168.20.12 255.255.255.0 192.168.20.1`
- **Hedef:** PC-01 → PC-02

## 7. Kısa sınav

1. g0/0.20 alt arayüzünün hangi VLAN'ı alacağını ne belirler? **`encapsulation dot1Q` satırı.**
2. Fiziksel G0/0 kapalıysa alt arayüzler? **Hepsi düşer.**
3. Router-on-a-stick'te switch'in router'a bakan portu hangi modda? **Trunk.**
4. L3 switch'te SVI'lar up ama VLAN'lar arası trafik yok. Olası eksik? **`ip routing`.**
5. Tek PC başka VLAN'a ulaşamıyor, aynı VLAN'daki diğer PC'ler ulaşıyor. İlk bakılacak? **O PC'nin gateway'i.**

## 8. Doğrulama notları

Kaynaklar: Cisco IOS alt arayüz ve 802.1Q yapılandırması (`encapsulation dot1Q`), Catalyst L3 switch `ip routing` ve SVI durumu; CCNA 200-301 3.0 (inter-VLAN routing), 2.2.

| İddia | Sonuç |
| --- | --- |
| LAN alt arayüzüne encapsulation olmadan IP verilemez | Doğru (IOS uyarı verir) |
| Fiziksel arayüz kapalıysa alt arayüzler de down | Doğru |
| Catalyst L3 switch'lerde `ip routing` varsayılan kapalı | Doğru (çoğu model) |
| SVI up/up için VLAN var olmalı ve o VLAN'da en az bir forwarding port olmalı | Doğru (autostate) |

**Motor gereksinimleri** (Labber'da denendi)

- [x] Alt arayüz, `encapsulation dot1q`, trunk, PC gateway; beş senaryo `query` doğrulamasıyla başta başarısız, çözümle başarılı
- [ ] SVI ile VLAN'lar arası yönlendirme ve `ip routing`: Labber'da SVI şimdilik yönetim adresi; L3 switch senaryosu yeni motor işiyle gelecek
