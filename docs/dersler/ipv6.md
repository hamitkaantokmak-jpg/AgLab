# AğLab Konu #16: IPv6 adresleme, SLAAC, NDP ve statik rota

> Uygulamadaki `ipv6` dersi bu belgeden üretildi. **Okuma dersi:** IPv6 Labber'da henüz yok; Sorun Çöz
> senaryoları motor desteği gelince eklenecek. Aşağıdaki vakalar kâğıt üstünde, beklenen çıktılarla
> çözülür. Ön koşul: IP adresleme (Konu #2), statik routing (Konu #8).

Bu konu bittiğinde öğrenci IPv6 adresini kısaltıp açar ve adres türlerini (global, link-local, unique local, multicast) tanır. NDP'nin ARP'nin ve router keşfinin yerini nasıl aldığını açıklar. SLAAC ile bir istemcinin adresini nasıl oluşturduğunu, EUI-64'ü ve DHCPv6 seçeneklerini bilir. Router'da IPv6 adresi ve statik rota yazar. `show ipv6 interface brief`, `show ipv6 route` ve `show ipv6 neighbors` çıktılarını okur. Seviye 2 (CCNA), süre yaklaşık 70 dakika.

## 1. Neden önemli

Operatörler, bulut hizmetleri ve telefonlar artık IPv6 konuşuyor; şube ağları çoğunlukla çift yığın (dual stack) çalışıyor. IPv6'nın mantığı IPv4'e benzer ama ayrıntıları farklıdır: broadcast ve ARP yoktur, adresi istemci kendisi üretir, gateway'in adresi link-local'dir. Bu farkları bilmeyen biri "IPv4 çalışıyor, IPv6 neden çalışmıyor?" sorusunda yanlış yerde arar.

## 2. Kavram

- **Yazım:** 128 bit, 16 bitlik 8 grup, onaltılık. Her grupta baştaki sıfırlar atılır; art arda sıfır gruplarından **bir** dizi `::` olur. `2001:0db8:0000:0000:0000:0000:0000:0010` → `2001:db8::10`.
- **Önek:** LAN'larda /64 kullanılır (ilk 64 bit ağ, son 64 bit arayüz kimliği). SLAAC /64 ister.
- **Adres türleri:**

| Tür | Aralık | Not |
| --- | --- | --- |
| Global unicast | `2000::/3` | İnternette yönlendirilir; belgelerde `2001:db8::/32` |
| Link-local | `fe80::/10` | Her arayüzde kendiliğinden; yalnız o bağlantıda geçerli; gateway olarak kullanılır |
| Unique local | `fc00::/7` (pratikte `fd00::/8`) | Özel adres; internete çıkmaz |
| Multicast | `ff00::/8` | `ff02::1` bütün düğümler, `ff02::2` bütün router'lar |

Broadcast yoktur; onun yerine multicast kullanılır.
- **NDP (ICMPv6):** Router Solicitation/Advertisement (RS/RA): istemci router'ı ve öneki öğrenir. Neighbor Solicitation/Advertisement (NS/NA): ARP'nin yerini alır, solicited-node multicast adresine (`ff02::1:ffXX:XXXX`) sorulur. DAD (Duplicate Address Detection) adres kullanılmadan önce çakışmayı denetler. Bu yüzden ICMPv6 tamamen engellenemez.
- **Adresi almak:**
  - *SLAAC:* RA'daki /64 önek + istemcinin ürettiği arayüz kimliği (EUI-64 ya da rastgele).
  - *Stateless DHCPv6:* adres SLAAC'tan, DNS gibi bilgiler DHCPv6'dan (RA'da O bayrağı).
  - *Stateful DHCPv6:* adres DHCPv6'dan (M bayrağı).
  - İstemcinin varsayılan ağ geçidi RA'yı gönderen router'ın **link-local** adresidir.
- **EUI-64:** 48 bitlik MAC ortadan ikiye bölünür, araya `fffe` girer, baştan 7. bit ters çevrilir. `0200.0000.0005` → `0000:00ff:fe00:0005`.
- **Router'da:**
  - `ipv6 unicast-routing`: bu olmadan router IPv6 paketi yönlendirmez ve RA göndermez.
  - `ipv6 address 2001:db8:10::1/64` (link-local kendiliğinden oluşur).
  - Statik rota: `ipv6 route 2001:db8:30::/64 2001:db8:12::2`. Next-hop link-local ise çıkış arayüzü de yazılmalıdır: `ipv6 route ::/0 g0/1 fe80::2`.
- **Yol MTU:** IPv6'da router'lar paket parçalamaz; büyük paket için kaynağa ICMPv6 "Packet Too Big" döner. Bu mesajları engellemek bazı bağlantıları sessizce bozar.

*(Etkileşimli şema: PC RS gönderir, R1 RA ile 2001:db8:10::/64 duyurur; PC EUI-64 ile adres üretir, DAD yapar, gateway'i fe80::1 olur.)*

## 3. Çıktı okuma

```
R1#show ipv6 interface brief
GigabitEthernet0/0     [up/up]
    FE80::1
    2001:DB8:10::1
GigabitEthernet0/1     [up/up]
    FE80::1
    2001:DB8:12::1

R1#show ipv6 route
C   2001:DB8:10::/64 [0/0]
     via GigabitEthernet0/0, directly connected
L   2001:DB8:10::1/128 [0/0]
     via GigabitEthernet0/0, receive
S   2001:DB8:30::/64 [1/0]
     via 2001:DB8:12::2

R1#show ipv6 neighbors
IPv6 Address                              Age Link-layer Addr State Interface
FE80::FF:FE00:5                             0 0200.0000.0005  REACH Gi0/0
```

| Soru | Komut |
| --- | --- |
| Arayüzde hangi adresler var? | `show ipv6 interface brief` |
| Router yönlendiriyor ve RA gönderiyor mu? | `show running-config | include unicast-routing`; `show ipv6 interface g0/0` |
| Hedefe rota var mı? | `show ipv6 route` |
| Komşunun MAC'i çözülmüş mü? | `show ipv6 neighbors` |

## 4. Yönlendirmeli lab (motor desteği gelince Labber'da)

Topoloji: PC-10 ─ R1 ─ 2001:db8:12::/64 ─ R2 ─ PC-30; LAN'lar 2001:db8:10::/64 ve 2001:db8:30::/64.

1. R1 ve R2: `ipv6 unicast-routing`.
2. Adresler: R1 g0/0 `2001:db8:10::1/64`, g0/1 `2001:db8:12::1/64`; R2 karşılıkları.
3. `show ipv6 interface brief`: global ve link-local adresler.
4. PC'lerde SLAAC (`ip auto` gibi); PC'nin adresini EUI-64'le elle hesapla ve karşılaştır.
5. Statik rotalar: R1 `ipv6 route 2001:db8:30::/64 2001:db8:12::2`, R2 dönüşü.
6. Test: `ping 2001:db8:30::...`, `show ipv6 neighbors`.
7. Link-local next-hop: R1'deki rotayı `ipv6 route 2001:db8:30::/64 g0/1 fe80::2` ile yeniden yaz; arayüzsüz yazınca neden reddedildiğini açıkla.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | `ipv6 unicast-routing` yok | PC'ler yalnız link-local alıyor, ağlar arası IPv6 yok | RA yok; running-config'te satır yok | `ipv6 unicast-routing` |
| E2 | LAN öneki /64 değil | SLAAC adres üretmiyor | Arayüzde /56 ya da /80 | LAN'da /64 |
| E3 | Link-local next-hop'u arayüzsüz yazmak | Rota kabul edilmiyor ya da çalışmıyor | `ipv6 route … fe80::2` | Çıkış arayüzünü ekle |
| E4 | Dönüş rotası eksik | Gidiş var, yanıt yok (IPv4'teki gibi) | Karşı router'da `show ipv6 route` | Dönüş rotası |
| E5 | ICMPv6'yı tamamen engellemek | Komşu bulunamıyor, bazı siteler açılmıyor | ACL'de `deny icmp any any` | NDP ve Packet Too Big'e izin ver |

## 6. Arıza senaryoları (kâğıt üstü; Sorun Çöz'e motor desteği gelince eklenecek)

### S1 · Başlangıç · PC'ler yalnız fe80 adresi alıyor (E1)

- **Kanıt:** PC'de yalnız link-local; R1'de `ipv6 unicast-routing` yok.
- **Çözüm:** R1'de `ipv6 unicast-routing`.

### S2 · Orta · SLAAC adres üretmiyor (E2)

- **Kanıt:** R1 g0/0 `2001:db8:10::1/80`.
- **Çözüm:** `no ipv6 address 2001:db8:10::1/80` → `ipv6 address 2001:db8:10::1/64`.

### S3 · Orta · Rota yazıldı, trafik gitmiyor (E3)

- **Kanıt:** `ipv6 route 2001:db8:30::/64 fe80::2` (arayüzsüz).
- **Çözüm:** `ipv6 route 2001:db8:30::/64 g0/1 fe80::2`.

### S4 · Orta · Gidiş var, dönüş yok (E4)

- **Kanıt:** R2'de 2001:db8:10::/64 için rota yok.
- **Çözüm:** R2'de `ipv6 route 2001:db8:10::/64 2001:db8:12::1`.

### S5 · İleri · İki hata

- **Kanıt:** R2'de `ipv6 unicast-routing` yok (E1) ve dönüş rotası eksik (E4).
- **Çözüm:** ikisini de ekle.

## 7. Kısa sınav

1. `2001:0db8:0000:0000:0000:0000:0000:0010` kısaltılmış hâli? **2001:db8::10.**
2. Her arayüzde kendiliğinden oluşan, yalnız o bağlantıda geçerli adres türü? **Link-local (fe80::/10).**
3. IPv6'da ARP'nin yerini ne alır? **NDP (Neighbor Solicitation/Advertisement).**
4. SLAAC için LAN öneki kaç bit olmalı? **/64.**
5. Router IPv6 yönlendirmiyor ve RA göndermiyor; eksik komut? **`ipv6 unicast-routing`.**

## 8. Doğrulama notları

Kaynaklar: RFC 4291 (adres mimarisi, türler, yazım), RFC 5952 (önerilen kısaltma), RFC 4861 (NDP), RFC 4862 (SLAAC), RFC 8200 (IPv6; router'da parçalama yok), Cisco IOS IPv6 yapılandırma kılavuzu (`ipv6 unicast-routing`, link-local next-hop'ta arayüz), CCNA 200-301 1.8–1.9 ve 3.3 (IPv6 adresleme ve statik rota).

| İddia | Sonuç |
| --- | --- |
| `::` adreste yalnız bir kez kullanılır | Doğru |
| EUI-64: araya fffe, 7. bit ters | Doğru |
| IPv6'da broadcast yok | Doğru |
| `ipv6 unicast-routing` olmadan IOS RA göndermez ve IPv6 yönlendirmez | Doğru |
| Link-local next-hop'lu statik rotada çıkış arayüzü gerekir | Doğru |

**Motor gereksinimleri**

- [ ] IPv6 Labber'da yok: adresleme, link-local, NDP, SLAAC, `ipv6 route`, `show ipv6 …`, VPCS IPv6 (motor işi). AğLab modeline de alan gerekir. Hazır olunca S1–S5 `v6-*` kimlikleriyle Sorun Çöz'e eklenir
