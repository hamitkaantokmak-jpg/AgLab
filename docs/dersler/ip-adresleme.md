# AğLab Konu #2: IP adresleme ve subnetting

> Uygulamadaki `ip` dersi (kısa kart) ve `ipv4` ayrıntılı dersi bu belgeye göre yeniden
> yazıldı; `subnet` ayrıntılı dersi (alt ağlara bölme, VLSM) olduğu gibi kaldı ve bu konunun
> ikinci parçasıdır. Senaryolar Sorun Çöz'de `ip-*` kimlikleriyle Labber'da çalışır.

Bu konu bittiğinde öğrenci bir adres ve maskeden ağ adresini, yayın adresini ve kullanılabilir aralığı bulur. İki cihazın aynı ağda olup olmadığına karar verir. Yanlış maske, yanlış ağ ve adres çakışması arızalarını cihaz ayarlarından teşhis eder. Seviye 1, süre yaklaşık 75 dakika (ders 20, lab 20, senaryolar 25, sınav 10; alt ağlara bölme `subnet` dersinde ayrıca).

## 1. Neden önemli

Bir cihazın ağdaki kimliği üç değerden oluşur: adres, maske ve gateway. Üçünden biri yanlışsa cihaz ya hiç konuşamaz ya da bazılarıyla konuşup bazılarıyla konuşamaz. İkinci durum daha kafa karıştırıcıdır, çünkü "kablo sağlam, bir şeyler çalışıyor" izlenimi verir.

Sahada bu hatalar çoğu zaman yeni bir cihaz kurulurken ya da bir firma "adresi biz ayarladık" dedikten sonra ortaya çıkar. Teşhis hesap gerektirir: 192.168.10.130/25 ile 192.168.10.1 aynı ağda mı? Bu soruyu kafadan hızlıca cevaplayabilmek bu konunun asıl hedefidir.

## 2. Kavram

**IPv4 adresi** 32 bittir ve dört sekizlik (oktet) olarak yazılır: `192.168.10.25`. **Maske** bu 32 bitin kaçının **ağı**, kaçının **cihazı** gösterdiğini söyler. `255.255.255.0` ile `/24` aynı şeydir: ilk 24 bit ağdır.

**Ağ adresi, yayın adresi, kullanılabilir aralık:**

- **Ağ adresi:** Cihaz bitlerinin hepsi 0. Bir cihaza verilmez.
- **Yayın adresi:** Cihaz bitlerinin hepsi 1. Bir cihaza verilmez.
- **Kullanılabilir aralık:** İkisinin arasındaki adresler. Sayısı 2^(cihaz bitleri) − 2'dir.

| Önek | Maske | Blok | Kullanılabilir | Örnek: 192.168.10.130 |
| --- | --- | --- | --- | --- |
| /24 | 255.255.255.0 | 256 | 254 | ağ .0, yayın .255 |
| /25 | 255.255.255.128 | 128 | 126 | ağ .128, yayın .255 |
| /26 | 255.255.255.192 | 64 | 62 | ağ .128, yayın .191 |
| /27 | 255.255.255.224 | 32 | 30 | ağ .128, yayın .159 |
| /30 | 255.255.255.252 | 4 | 2 | ağ .128, yayın .131 |

**Kısa yol:** Son oktet için blok büyüklüğü 256 − (maskenin son okteti)'dir. /25'te 256 − 128 = 128. Ağlar blok büyüklüğünün katlarından başlar: .0, .128. Adresin hangi bloğa düştüğünü bulursan ağ adresini de yayın adresini de bulmuş olursun.

**Aynı ağda mı?** İki cihaz, **kendi maskeleriyle** hesaplanan ağ adresleri aynıysa aynı ağdadır. PC her paket için bu hesabı yapar: aynı ağdaysa doğrudan gönderir, değilse gateway'e (Konu #8). Bu yüzden:

- **Maske yanlışsa** PC bazı komşularını yanlışlıkla "başka ağda" sanar. Gateway bile kendi ağının dışında kalırsa PC hiçbir yere çıkamaz.
- **Ağ yanlışsa** (ör. 192.168.11.50) cihaz aynı kabloda olsa bile kimseyle konuşamaz.
- **Router arayüzünün maskesi yanlışsa** router bazı PC'leri kendi ağında görmez ve onlara yanıt gönderemez.

**Özel adresler:**

| Aralık | Anlamı |
| --- | --- |
| 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 | Özel (RFC 1918) adresler; kurum içinde kullanılır, internete NAT ile çıkar (Konu #20) |
| 127.0.0.0/8 | Cihazın kendisi (loopback) |
| 169.254.0.0/16 | DHCP'den yanıt alamayan istemcinin kendine verdiği adres (Konu #9) |
| 0.0.0.0 | "Adres yok" ya da varsayılan rota (Konu #8) |

**Çakışma:** Aynı adresi iki cihaz kullanırsa ARP sorgusuna ikisi de yanıt verir ve trafik yanlış cihaza gidebilir. En zararlısı gateway adresinin çakışmasıdır: bütün kullanıcıların dışarı giden trafiği yanlış cihaza akar.

*(Etkileşimli şema: 192.168.10.0/24'ü /25 ile ikiye bölen çizgi; PC-13 .130'un hangi yarıda kaldığı.)*

## 3. Çıktı okuma

### PC'de: show ip / ipconfig

```
PC-13> show ip
IP/MASK     : 192.168.10.130/25
GATEWAY     : 192.168.10.1
```

Okuma sırası: 1) Adres ve maske → ağ 192.168.10.128, yayın .255. 2) Gateway bu aralıkta mı? **Değil.** 3) Sonuç: PC gateway'ine ulaşamaz, dışarı çıkamaz; 192.168.10.0–127 aralığındaki komşularına da gateway üzerinden gitmeye çalışır.

### Router'da: show ip interface brief ve arayüz maskesi

```
R1#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     192.168.10.1    YES manual up                    up
GigabitEthernet0/1     192.168.100.1   YES manual up                    up

R1#show running-config interface g0/0
interface GigabitEthernet0/0
 ip address 192.168.10.1 255.255.255.128
```

`show ip interface brief` maskeyi göstermez. Maskeyi görmek için `show running-config interface`, `show ip interface` ya da `show ip route`'taki `C` satırına (`192.168.10.0/25 is directly connected`) bakılır. Router'ın maskesi kullanıcılarınkinden kısaysa bazı kullanıcılar router'a göre "başka ağda" kalır.

### Çakışmanın izi: ARP ve TTL

```
PC-11> ping 192.168.10.1
84 bytes from 192.168.10.1 icmp_seq=1 ttl=64 time=1.100 ms
PC-11> show arp
02:00:00:00:00:01  192.168.10.1 expires in 120 seconds
```

- Gateway yanıt veriyor ama **TTL 64**: Cisco router'lar 255 ile yanıt verir. 64 bir PC'nin ya da dizüstünün yanıtıdır.
- ARP'taki MAC, R1'in Gi0/0 MAC'iyle (`show interfaces g0/0`: "address is 0200.0000.0201") aynı değil. Gateway adresini başka bir cihaz kullanıyor.

## 4. Yönlendirmeli lab

Topoloji: R1 Gi0/0 kullanıcı ağı 192.168.10.0/24 (.1), Gi0/1 sunucu ağı 192.168.100.0/24 (SRV .10). SW1'e bağlı PC-11 (.11), PC-12 (.12), PC-13 (.130) ve YAZICI (.50).

1. **Hesapla, sonra doğrula.** Kâğıtta: 192.168.10.130/24'ün ağı, yayını, aralığı. PC-13'te `show ip` ile karşılaştır; PC-13'ten `ping 192.168.100.10`: başarılı.
2. **Maskeyi daralt.** PC-13'te `ip 192.168.10.130 255.255.255.128 192.168.10.1`. Kâğıtta yeni ağı hesapla: 192.168.10.128/25. *Neden:* Gateway .1 bu aralıkta değil.
3. **Sonucu gör.** PC-13'ten sunucuya ve PC-11'e ping: ikisi de başarısız. PC-11'den PC-13'e ping: o da başarısız. *Neden:* Kablo aynı, switch aynı, ama PC-13 artık komşularını başka ağda sanıyor ve paketleri ulaşamadığı bir gateway'e göndermeye çalışıyor.
4. **Geri al.** Maskeyi /24 yap; ping'ler döner.
5. **Router tarafı.** R1'de `show ip route connected` (ya da `show ip route`): `192.168.10.0/24 is directly connected`. *Neden:* Router'ın kendi ağını bildiği satır budur; maske burada da görünür.
6. **Yanlış ağ.** YAZICI'da `ip 192.168.11.50 255.255.255.0 192.168.10.1` yazmayı dene. PC-11'den yazıcıya ping: başarısız. *Neden:* 192.168.11.0/24 başka bir ağ; aynı switch'e takılı olması bir şey değiştirmez. Adresi 192.168.10.50 yap.
7. **Sınırı bul.** /26 ile 192.168.10.0/24'ü dörde böl: .0, .64, .128, .192. PC-13 (.130) hangi bloğa düşer, yayın adresi ne? (Cevap: .128 bloğu, yayın .191.) Bölmenin ayrıntısı `subnet` dersinde.

**Lab'ın otomatik değerlendirmesi:** `q.ping('PC-13', '192.168.100.10').ok`; `q.ping('PC-11', '192.168.10.50').ok`; `q.ipUnique('192.168.10.1')`.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | PC'de yanlış maske | PC bazı komşularına ya da hiçbir yere ulaşamıyor; gateway'i kendi ağının dışında kalıyor olabilir | `show ip` / `ipconfig`: maske ağınkinden farklı; hesaplanan ağ gateway'i kapsamıyor | Maskeyi ağın maskesiyle eşitle |
| E2 | Adres çakışması | Aralıklı ya da toplu erişim kaybı; gateway çakışıyorsa bütün ağ dışarı çıkamaz | ARP'ta adresin MAC'i değişiyor ya da yanlış; TTL beklenenden farklı; gerçek cihazda `%IP-4-DUPADDR` | Yanlış cihaza boş bir adres ver |
| E3 | Yanlış ağdan adres | Cihaz aynı kabloda ama kimseyle konuşamıyor | Adresin ağ kısmı (ör. 192.168.11) diğerlerinden farklı | Doğru ağdan, kullanılmayan bir adres ver |
| E4 | Router arayüzünde yanlış maske | Aynı ağdaki PC'lerin bir kısmı dışarı çıkıyor, bir kısmı çıkamıyor | Etkilenen PC'ler bir maske sınırının öbür yanında; router'ın `C` satırı daha kısa önek gösteriyor | Router arayüzünün maskesini düzelt |
| E5 | Ağ ya da yayın adresini cihaza vermek | Cihaz ağda görünmüyor ya da adres reddediliyor | Adres bloğun ilk ya da son adresi (ör. /24'te .0 ya da .255) | Aralıktan bir adres ver |

E1 ile E4 aynı hatanın iki ucudur: biri PC'de, öteki router'da. Ayırmak için etkilenenlere bak: tek PC ise PC'nin ayarı, adres aralığının bir yarısı ise router'ın maskesi.

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `ip-gw-outside-subnet`, `ip-duplicate-gateway`,
> `ip-wrong-network`, `ip-router-mask`, `ip-two-faults` kimlikleriyle Labber'da çalışır.

### S1 · Başlangıç · Yeni PC kimseye, kimse ona ulaşamıyor (E1)

- **Başlangıç:** PC-13 192.168.10.130 **/25**, gateway .1.
- **Belirti:** PC-13 ne gateway'e ne sunucuya ulaşıyor; PC-11 de PC-13'e ping atamıyor.
- **İpuçları:** (1) 192.168.10.130/25'in ağı ve yayını ne? (2) 192.168.10.1 o aralıkta mı? (3) Maskeyi ağın geri kalanıyla aynı yap.
- **Çözüm:** PC-13 → `ip 192.168.10.130 255.255.255.0 192.168.10.1`
- **Hedefler:** `q.ping('PC-13', '192.168.100.10').ok`; `q.ping('PC-11', '192.168.10.130').ok`

### S2 · Başlangıç · Dizüstü bağlandı, bütün kat dışarı çıkamıyor (E2)

- **Başlangıç:** LAPTOP'a elle 192.168.10.1 yazılmış.
- **Belirti:** Ziyaretçi dizüstüsünü taktığından beri kimse sunucuya ulaşamıyor; birbirlerine ulaşıyorlar.
- **İpuçları:** (1) Herkesin ortak kullandığı adres hangisi? (2) `ping 192.168.10.1` ve `show arp`: MAC R1'inki mi, TTL kaç? (3) Yanlış cihaza boş bir adres ver.
- **Çözüm:** LAPTOP → `ip 192.168.10.30 255.255.255.0 192.168.10.1`
- **Hedefler:** `q.ipUnique('192.168.10.1')`; `q.ping('PC-11', '192.168.100.10').ok`

### S3 · Orta · Yeni yazıcıya kimse yazdıramıyor (E3)

- **Başlangıç:** YAZICI 192.168.11.50/24.
- **Belirti:** Firma yazıcıyı kurdu; kattaki hiçbir bilgisayar yazıcıya ulaşamıyor.
- **İpuçları:** (1) Aynı switch'e takılı olmak aynı ağda olmak değildir. (2) /24'te ilk üç oktet ağdır: 192.168.11 ile 192.168.10 aynı mı? (3) Kattaki ağdan boş bir adres ver.
- **Çözüm:** YAZICI → `ip 192.168.10.50 255.255.255.0 192.168.10.1`
- **Hedefler:** `q.ping('PC-11', '192.168.10.50').ok`

### S4 · Orta · Aynı kattaki bazı PC'ler sunucuya ulaşıyor, bazıları ulaşamıyor (E4)

- **Başlangıç:** R1 Gi0/0 192.168.10.1 **255.255.255.128**.
- **Belirti:** PC-11 ve PC-12 sunucuya ulaşıyor; PC-13 (.130) ulaşamıyor ama PC-11'e ulaşıyor. PC'lerin ayarları aynı.
- **İpuçları:** (1) Etkilenen ve etkilenmeyen adresleri yan yana koy: hangi sınırın iki yanındalar? (2) PC'ler doğruysa karşı uca bak: R1'in maskesi. (3) Router'ın maskesini /24 yap.
- **Çözüm:** R1 → `interface g0/0` → `ip address 192.168.10.1 255.255.255.0`
- **Hedefler:** `q.ping('PC-13', '192.168.100.10').ok`; `q.ping('PC-11', '192.168.100.10').ok`

### S5 · İleri · Hem yazıcı hem bir PC dışarıda kaldı (E3 + E4)

- **Başlangıç:** S3 ve S4 birlikte.
- **Belirti:** Yazıcıya kimse yazdıramıyor; ayrıca PC-13 sunucuya ulaşamıyor.
- **İpuçları:** (1) Her belirtide "bu cihaz hangi ağda olduğunu sanıyor?" diye sor. (2) Yazıcının ağını PC'lerinkiyle, R1'in maskesini PC'lerinkiyle karşılaştır. (3) İki düzeltmeden sonra iki testi de yap.
- **Çözüm:** S3'ün ve S4'ün çözümü.
- **Hedefler:** `q.ping('PC-11', '192.168.10.50').ok`; `q.ping('PC-13', '192.168.100.10').ok`

## 7. Kısa sınav

1. 192.168.10.130/25 adresinin ağ adresi ve yayın adresi nedir?
   - A) .0 ve .255
   - B) .128 ve .255
   - C) .128 ve .191
   - D) .130 ve .255

   **Cevap: B.** /25'te bloklar .0 ve .128'den başlar; .130 ikinci blokta.
2. PC 192.168.10.130/25, gateway 192.168.10.1. Ne olur?
   - A) Sorunsuz çalışır
   - B) Gateway PC'nin ağının dışında; PC dışarı çıkamaz
   - C) Yalnız DNS çalışmaz
   - D) PC 169.254 alır

   **Cevap: B.** Gateway, PC ile aynı ağda olmalıdır.
3. /26 ağında kaç kullanılabilir adres vardır?
   - A) 64
   - B) 62
   - C) 30
   - D) 126

   **Cevap: B.** 2^6 − 2 = 62.
4. Bir PC gateway'e ping atıyor ve yanıtın TTL'i 64. Gateway bir Cisco router. Bu neye işaret eder?
   - A) Router yavaş
   - B) Yanıtı router değil başka bir cihaz veriyor; adres çakışması olabilir
   - C) Kablo kalitesiz
   - D) Normal

   **Cevap: B.** Cisco router'lar ICMP yanıtını TTL 255 ile gönderir; 64 tipik bir PC değeridir.
5. Aynı kattaki .1–.127 aralığındaki PC'ler dışarı çıkıyor, .128–.254 aralığındakiler çıkamıyor. PC'lerin ayarları doğru. En olası neden?
   - A) Kablo
   - B) DNS
   - C) Router arayüzünün maskesi /25
   - D) Switch'in VLAN'ı

   **Cevap: C.** Router ağın yalnız bir yarısını kendi ağı sayıyor.

## 8. Doğrulama notları

Kaynaklar: RFC 791 (IPv4), RFC 1918 (özel adresler), RFC 3927 (169.254 link-local), RFC 950 (alt ağlar); CCNA 200-301 sınav konuları (1.6 IPv4 adresleme ve alt ağlar, 1.7 özel adresler). Eski `ip` ve `ipv4` dersleri Kavram için kaynak oldu; metin yeniden yazıldı. `subnet` dersi değişmedi.

**Kontrol edilen iddialar**

| İddia | Sonuç |
| --- | --- |
| Kullanılabilir adres sayısı 2^(32 − önek) − 2 (/31 ve /32 hariç) | Doğru |
| Özel aralıklar 10/8, 172.16/12, 192.168/16 | Doğru (RFC 1918) |
| 169.254.0.0/16 link-local; 127.0.0.0/8 loopback | Doğru |
| Cisco IOS ICMP echo-reply'yi TTL 255 ile gönderir; Windows 128, Linux/VPCS 64 | Doğru (varsayılan değerler) |
| `show ip interface brief` maske göstermez | Doğru |

**Motor gereksinimleri** (Labber'da denendi)

- [x] VPCS `ip <adres> <maske> <gateway>`, `show ip`, `show arp`, ping TTL'i
- [x] Router arayüz maskesi, `show ip interface brief`, `show running-config interface`, `show interfaces` (MAC)
- [x] Aynı adresi kullanan iki cihazda ARP'a ilk tanımlı cihazın yanıt vermesi; `ipUnique` — L2-C
- [x] Beş senaryo başta başarısız, terminalden çözümle başarılı
- [ ] Senaryo başında var olan çakışma için `%IP-4-DUPADDR` yazılmıyor (yalnız durum değişince)
