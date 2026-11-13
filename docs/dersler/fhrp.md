# AğLab Konu #18: FHRP: HSRP ve VRRP

> Uygulamadaki `fhrp` dersi bu belgeden üretildi. **Okuma dersi:** HSRP ve VRRP Labber'da henüz yok;
> Sorun Çöz senaryoları motor desteği gelince eklenecek. Aşağıdaki vakalar kâğıt üstünde, beklenen
> çıktılarla çözülür. Ön koşul: gateway ve statik routing (Konu #8), VLAN'lar arası yönlendirme
> (Konu #7).

Bu konu bittiğinde öğrenci tek bir varsayılan ağ geçidinin neden tek hata noktası olduğunu açıklar. HSRP ile iki router'ı tek bir sanal gateway arkasında çalıştırır: sanal IP ve MAC, öncelik, preempt, izleme. `show standby brief` çıktısından aktif ve yedek router'ı okur. HSRP ile VRRP'nin farklarını bilir. Seviye 2 (CCNA), süre yaklaşık 45 dakika.

## 1. Neden önemli

PC'lerin varsayılan ağ geçidi tek bir adrestir. O router kapanırsa yanında yedek bir router dursa bile PC'ler onu kullanamaz, çünkü gateway adresi elle ya da DHCP ile verilmiştir ve değişmez. FHRP (First Hop Redundancy Protocol) iki router'ın ortak bir **sanal** IP ve MAC'i paylaşmasını sağlar; PC'ler sanal adresi gateway olarak kullanır, arıza anında yedek router devralır. Tipik arızalar devralmanın olmaması ("yedek var ama çalışmadı") ya da yanlış router'ın aktif kalmasıdır ("WAN koptu ama trafik hâlâ ona gidiyor").

## 2. Kavram

- **Sanal gateway:** İki router aynı LAN'da gerçek adresleriyle (192.168.10.2, .3) durur ve bir sanal IP'yi (192.168.10.1) paylaşır. PC'lerin gateway'i **sanal IP**'dir. Sanal IP'nin ARP yanıtı sanal MAC'tir; devralmada MAC değişmez, PC'nin ARP tablosu geçerli kalır.
- **HSRP (Cisco):**
  - Aktif router trafiği taşır, yedek (standby) bekler; diğerleri dinler.
  - Öncelik varsayılan 100; yüksek olan aktif olur, eşitse yüksek IP kazanır.
  - **Preempt varsayılan kapalıdır:** yüksek öncelikli router geri döndüğünde preempt yoksa aktifliği geri almaz.
  - Hello 3 sn, hold 10 sn. Sanal MAC v1'de `0000.0c07.acXX` (XX = grup), v2'de `0000.0c9f.fXXX`.
  - Komutlar: `standby 1 ip 192.168.10.1`, `standby 1 priority 110`, `standby 1 preempt`.
  - **İzleme:** WAN arayüzü düşünce öncelik düşürülür ve preempt'li yedek devralır (`track 1 interface g0/1 line-protocol` + `standby 1 track 1 decrement 20`).
- **VRRP (standart, RFC 5798):** Master/backup. Öncelik varsayılan 100. **Preempt varsayılan açık.** Sanal MAC `0000.5e00.01XX`. Sanal IP router'lardan birinin gerçek adresi olabilir (o router "sahip"tir, öncelik 255). Komut: `vrrp 1 ip 192.168.10.1`.
- **GLBP:** Cisco'ya özel; birden çok router'ı aynı anda kullanarak yük paylaştırır (okuma).
- **Uyuşması gerekenler:** grup numarası, sanal IP, sürüm, (varsa) kimlik doğrulama. Uyuşmazsa iki router da kendini aktif sanır.

*(Etkileşimli şema: R1 aktif, R2 yedek, PC'ler 192.168.10.1'e gönderir; R1 düşer, R2 aktif olur, PC'nin ARP'deki sanal MAC'i aynı kalır.)*

## 3. Çıktı okuma

```
R1#show standby brief
                     P indicates configured to preempt.
                     |
Interface   Grp  Pri P State   Active          Standby         Virtual IP
Gi0/0       1    110 P Active  local           192.168.10.3    192.168.10.1
R2#show standby brief
Gi0/0       1    100   Standby 192.168.10.2    local           192.168.10.1
                     ← P yok: R2'de preempt kapalı (yedekte sorun değil)

! Arıza izi: iki taraf da Active
R1#show standby brief
Gi0/0       1    110 P Active  local           unknown         192.168.10.1
R2#show standby brief
Gi0/0       2    100   Active  local           unknown         192.168.10.1
                     ← grup numaraları farklı (1 ve 2): birbirlerini görmüyorlar
```

| Soru | Nereye bakılır |
| --- | --- |
| Kim aktif? | `show standby brief` State/Active sütunu |
| Neden geri almıyor? | P sütunu (preempt) |
| WAN düşünce devrediyor mu? | `show standby` → Track, öncelik düşüşü |
| PC doğru gateway'i mi kullanıyor? | PC'de gateway = sanal IP mi? |

## 4. Yönlendirmeli lab (motor desteği gelince Labber'da)

Topoloji: R1 (192.168.10.2) ve R2 (192.168.10.3) aynı LAN'da; PC'lerin gateway'i 192.168.10.1; iki router da WAN üzerinden merkeze bağlı.

1. R1: `interface g0/0` → `standby 1 ip 192.168.10.1` → `standby 1 priority 110` → `standby 1 preempt`.
2. R2: `standby 1 ip 192.168.10.1`.
3. `show standby brief`: R1 Active, R2 Standby.
4. PC'de gateway 192.168.10.1; `show arp`'ta sanal MAC.
5. R1'i kapat: R2 Active olur, PC'nin ping'i birkaç paket kayıpla devam eder.
6. R1'i aç: preempt sayesinde R1 geri aktif olur. Preempt'i kaldırıp tekrarla.
7. İzleme: R1'de WAN arayüzünü izle, öncelik 20 düşsün; WAN'ı kapat, R2'nin devraldığını gör.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | PC'nin gateway'i gerçek IP | R1 kapanınca o PC kopuyor, diğerleri çalışıyor | PC gateway 192.168.10.2 | Gateway'i sanal IP yap (DHCP'de de) |
| E2 | Grup numarası ya da sanal IP farklı | İki router da Active | brief'te iki Active, Standby `unknown` | Grup ve sanal IP'yi eşitle |
| E3 | Preempt yok | R1 döndü ama R2 aktif kalıyor | R1'de P yok | `standby 1 preempt` |
| E4 | İzleme yok | WAN koptu, trafik hâlâ R1'e gidip düşüyor | R1 Active, WAN down | `track` + `standby 1 track … decrement` |
| E5 | Öncelik eşit, beklenmeyen aktif | Yüksek IP'li router aktif | İki tarafta Pri 100 | Tasarımdaki aktife yüksek öncelik |

## 6. Arıza senaryoları (kâğıt üstü; Sorun Çöz'e motor desteği gelince eklenecek)

### S1 · Başlangıç · R1 kapanınca bir PC kopuyor (E1)

- **Kanıt:** HSRP çalışıyor (R2 Active); kopan PC'nin gateway'i 192.168.10.2.
- **Çözüm:** PC'nin gateway'ini 192.168.10.1 yap; DHCP havuzunda `default-router 192.168.10.1`.

### S2 · Orta · İki router da aktif (E2)

- **Kanıt:** R1 grup 1, R2 grup 2; ikisi de Active, Standby `unknown`.
- **Çözüm:** R2'de `no standby 2 ip 192.168.10.1` → `standby 1 ip 192.168.10.1`.

### S3 · Orta · Bakımdan dönen R1 aktif olmuyor (E3)

- **Kanıt:** R1 Pri 110 ama State Standby; P sütunu boş.
- **Çözüm:** R1'de `standby 1 preempt`.

### S4 · Orta · WAN koptu, şube merkeze gidemiyor (E4)

- **Kanıt:** R1 Active, R1'in WAN'ı down; R2'nin WAN'ı up.
- **Çözüm:** `track 1 interface g0/1 line-protocol`, `standby 1 track 1 decrement 20`; R2'de preempt.

### S5 · İleri · İki hata

- **Kanıt:** E2 (grup farkı) düzeltilince R1 geri dönünce aktifliği almıyor (E3).
- **Çözüm:** grubu eşitle, R1'e preempt.

## 7. Kısa sınav

1. PC'lerin gateway'i hangi adres olmalı? **Sanal IP.**
2. HSRP'de preempt varsayılan olarak? **Kapalı** (VRRP'de açık).
3. İki router da Active görünüyorsa ilk şüphe? **Grup numarası ya da sanal IP uyuşmazlığı.**
4. HSRP v1 grup 1'in sanal MAC'i? **0000.0c07.ac01.**
5. WAN kopunca yedeğin devralması için? **İzleme (track) ile öncelik düşürmek + yedekte preempt.**

## 8. Doğrulama notları

Kaynaklar: RFC 2281 (HSRP), RFC 5798 (VRRPv3), Cisco IOS First Hop Redundancy Protocols yapılandırma kılavuzu (öncelik, preempt, track, sanal MAC biçimleri, `show standby brief`), CCNA 200-301 3.5 (FHRP'nin amacı).

| İddia | Sonuç |
| --- | --- |
| HSRP öncelik varsayılan 100, eşitlikte yüksek IP | Doğru |
| HSRP preempt varsayılan kapalı, VRRP'de açık | Doğru |
| HSRP v1 sanal MAC 0000.0c07.acXX, v2 0000.0c9f.fXXX; VRRP 0000.5e00.01XX | Doğru |
| HSRP hello 3 sn / hold 10 sn | Doğru |

**Motor gereksinimleri**

- [ ] HSRP/VRRP Labber'da yok: sanal IP/MAC, öncelik, preempt, track, `show standby [brief]`, `show vrrp brief` (motor işi). AğLab modeline de alan gerekir. Hazır olunca S1–S5 `fhrp-*` kimlikleriyle Sorun Çöz'e eklenir
