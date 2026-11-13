# AğLab Konu #18: FHRP: HSRP ve VRRP

> Uygulamadaki `fhrp` dersi bu belgeden üretildi. Senaryolar Sorun Çöz'de `fhrp-*` kimlikleriyle Labber'da
> çalışır (HSRP v1 ve VRRP v2, #82; senaryolar HSRP üzerine). Ön koşul: gateway ve statik routing
> (Konu #8), VLAN'lar arası yönlendirme (Konu #7).

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

## 4. Yönlendirmeli lab

Topoloji: R1 (192.168.10.2) ve R2 (192.168.10.3) aynı LAN'da; PC'lerin gateway'i 192.168.10.1; iki router da kendi WAN hattıyla MERKEZ'e bağlı. MERKEZ'in şubeye dönüşü birincil olarak R1, yedek (AD 5) R2 üzerinden.

1. R1: `interface g0/0` → `standby 1 ip 192.168.10.1` → `standby 1 priority 110` → `standby 1 preempt`.
2. R2: `standby 1 ip 192.168.10.1`.
3. `show standby brief`: R1 Active, R2 Standby.
4. PC'de gateway 192.168.10.1; `show arp`'ta sanal MAC.
5. R1'i kapat (uygulama terminalinde `device power off`): R2 Active olur, PC'nin ping'i devam eder; R2'de `%HSRP-5-STATECHANGE` logu.
6. R1'i aç: preempt sayesinde R1 geri aktif olur. Preempt'i kaldırıp tekrarla.
7. İzleme: R1'de `track 1 interface g0/1 line-protocol`, `interface g0/0` → `standby 1 track 1 decrement 20`; R2'de `standby 1 preempt`. R1'in WAN'ını kapat (`interface g0/1` → `shutdown`): R1 90'a düşer, R2 devralır. `show track` ve `show standby`.
8. VRRP'yi dene: aynı yapıyı `vrrp 1 ip 192.168.10.1` ile kur; `show vrrp brief`. Preempt'in varsayılan açık olduğunu gör.

**Lab'ın otomatik değerlendirmesi:** `q.fhrpActive('R1', 'g0/0', 1)`; R1 kapalıyken `q.fhrpActive('R2', 'g0/0', 1)`; PC'lerden MERKEZ'deki sunucuya ping.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | PC'nin gateway'i gerçek IP | R1 kapanınca o PC kopuyor, diğerleri çalışıyor | PC gateway 192.168.10.2 | Gateway'i sanal IP yap (DHCP'de de) |
| E2 | Grup numarası ya da sanal IP farklı | İki router da Active | brief'te iki Active, Standby `unknown` | Grup ve sanal IP'yi eşitle |
| E3 | Preempt yok | R1 döndü ama R2 aktif kalıyor | R1'de P yok | `standby 1 preempt` |
| E4 | İzleme yok | WAN koptu, trafik hâlâ R1'e gidip düşüyor | R1 Active, WAN down | `track` + `standby 1 track … decrement` |
| E5 | Öncelik eşit, beklenmeyen aktif | Yüksek IP'li router aktif | İki tarafta Pri 100 | Tasarımdaki aktife yüksek öncelik |

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `fhrp-pc-real-gw`, `fhrp-group-mismatch`, `fhrp-no-preempt`, `fhrp-no-track`,
> `fhrp-two-faults` kimlikleriyle Labber'da çalışır. Hedefler `fhrpActive` sorgusuyla kimin aktif olduğunu
> ve PC'lerden merkezdeki sunucuya erişimi sınar.

### S1 · Başlangıç · R1 bakımda, bir bilgisayar kopuk (E1)

- **Belirti:** R1 kapalı, HSRP devretti, PC'ler çalışıyor; yalnız PC-12 sunucuya ulaşamıyor.
- **Neden:** PC-12'nin gateway'i 192.168.10.2 (R1'in gerçek adresi).
- **Çözüm:** PC-12 → `ip 192.168.10.12 255.255.255.0 192.168.10.1`
- **Hedefler:** PC-12 ve PC-11 → SRV; R2 Active

### S2 · Orta · İki router da aktif (E2)

- **Belirti:** İki router'da show standby brief Active, Standby `unknown`.
- **Neden:** R2 grup 2'de, R1 grup 1'de.
- **Çözüm:** R2 → `interface g0/0` → `no standby 2 ip 192.168.10.1` → `no standby 2 preempt` → `standby 1 ip 192.168.10.1` → `standby 1 preempt`
- **Hedefler:** R1 grup 1'de Active; R2 grup 2'de aktif değil ve grup 1'de Standby; PC-11 → SRV

### S3 · Orta · Bakımdan dönen R1 aktif olmuyor (E3)

- **Belirti:** R1 bakımda ve kapalı, R2 Active. R1 açılacak (`device power on`); tasarımda açıldıktan sonra aktif olmalı.
- **Neden:** R1'de preempt yok: açılınca Standby kalır.
- **Çözüm:** R1 → `device power on`; `interface g0/0` → `standby 1 preempt` (yalnız açmak yetmez)
- **Hedefler:** R1 Active; PC-11 → SRV

### S4 · Orta · WAN koptu, şube merkeze gidemiyor (E4)

- **Belirti:** R1'in WAN hattı operatör arızasıyla kopuk; R1 hâlâ Active, kimse merkeze ulaşamıyor.
- **Neden:** R1 WAN'ı izlemiyor.
- **Çözüm:** R1 → `track 1 interface g0/1 line-protocol` → `interface g0/0` → `standby 1 track 1 decrement 20`
- **Hedefler:** R2 Active; PC-11 ve PC-12 → SRV

### S5 · İleri · WAN koptu, yedek de devralmıyor (E4 + E3)

- **Belirti:** R1'in WAN'ı kopuk, R1 Active; R2'nin yapılandırması hiç kontrol edilmemiş.
- **Neden:** R1'de izleme yok ve R2'de preempt yok (izleme tek başına yetmez: R1 90'a düşer ama R2 aktifliği almaz).
- **Çözüm:** R1'de izleme ve decrement; R2 → `standby 1 preempt`
- **Hedefler:** S4 ile aynı

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

**Motor gereksinimleri** (Labber'da denendi)

- [x] HSRP v1 (`standby ip/priority/preempt/track`), VRRP v2, `track … interface … line-protocol`, `show standby [brief]`, `show vrrp brief`, `show track`; aynı grup + farklı VIP'te tek seçim ve `%HSRP-4-DIFFVIP1` (#82)
- [x] AğLab modeli: arayüzde `hsrp`/`vrrp`, router'da `tracks`; senaryo sorgusu `fhrpActive`
- [x] Beş senaryo başta başarısız, çözümle başarılı; yarım çözüm (S5'te yalnız izleme) başarısız kalıyor
- [ ] VPCS `trace`'in ilk atlamasında sanal IP (192.168.10.1) görünüyor; router Time Exceeded'i arayüzünün gerçek adresinden (192.168.10.2) göndermeli (motor işi)
- [ ] HSRP v2, zamanlayıcılar, kimlik doğrulama, `vrrp … track` modellenmiyor (#82 açıklaması)
