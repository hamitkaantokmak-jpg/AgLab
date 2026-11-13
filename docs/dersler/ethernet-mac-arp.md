# AğLab Konu #3: Ethernet, MAC ve ARP

> Kaynak: AğLab Konu #3 doc (8 Kasım 2026). Uygulamadaki `ethernet` dersi bu belgeden üretildi.

Bu konu bittiğinde öğrenci bir switch'in MAC adreslerini nasıl öğrendiğini ve çerçeveleri nasıl ilettiğini, bir PC'nin ARP ile komşusunun MAC adresini nasıl bulduğunu açıklar; MAC tablosu ve ARP önbelleğinden "aynı ağdayım ama ulaşamıyorum" arızalarını teşhis eder. Seviye 1, süre yaklaşık 75 dakika (ders 15, lab 25, senaryolar 25, sınav 10).

## 1. Neden önemli

IP adresi bir paketin **nereye** gideceğini söyler, ama kablodaki her çerçeve bir **MAC adresine** gönderilir. PC, aynı ağdaki yazıcıya bir paket göndermeden önce "192.168.10.50'nin MAC adresi ne?" diye sormak zorundadır; bu sorunun adı ARP'tir. Switch ise kimin hangi portta olduğunu MAC tablosundan bilir.

Sahada bu katman genelde şu cümleyle gelir: "İkisi de aynı ağda, IP'ler doğru, ama ping gitmiyor" ya da "Bazen gidiyor bazen gitmiyor." İkinci cümlenin arkasında çoğu zaman aynı IP'yi kullanan iki cihaz vardır; ARP önbelleğinde aynı IP'nin MAC'i bir gidip bir gelir.

## 2. Kavram

**Ethernet çerçevesi** hedef MAC, kaynak MAC ve içeriğin türünü (EtherType: IPv4 0x0800, ARP 0x0806, 802.1Q 0x8100) taşır. **MAC adresi** 48 bittir, ağ kartına üreticide yazılır ve Cisco'da `0050.7966.6800` gibi üç grupta gösterilir. `ffff.ffff.ffff` "herkese" (broadcast) demektir.

**Switch MAC adreslerini kendisi öğrenir.** Bir çerçeve geldiğinde **kaynak** MAC'i, geldiği portla birlikte MAC tablosuna yazar. Sonra **hedef** MAC'e bakar:

- Tabloda varsa çerçeveyi yalnız o porta gönderir.
- Tabloda yoksa (bilinmeyen unicast) ya da hedef broadcast ise, geldiği port dışında aynı VLAN'daki tüm portlara gönderir (**flood**).
- Dinamik kayıtlar 300 saniye trafik gelmezse silinir (aging).

**ARP**, aynı ağdaki bir IP adresinin MAC adresini bulur. PC önce ARP önbelleğine bakar; yoksa broadcast bir istek gönderir, IP'nin sahibi unicast yanıt verir, sonuç önbelleğe yazılır. Cisco cihazlarda ARP kaydı 4 saat saklanır.

*(Etkileşimli şema: aynı VLAN'da üç PC, tek switch: ARP ve MAC öğrenme.)*

PC, başka bir ağdaki hedef için o hedefin değil, **gateway'in** MAC adresini sorar; ARP yalnız aynı broadcast alanı (aynı VLAN) içinde çalışır. Bu yüzden "ARP çözülüyor mu?" sorusu, katman 2 yolunun sağlam olup olmadığının en hızlı testidir.

**İki uyarı işareti:** Aynı MAC'in iki porttan sürekli öğrenilmesi (`%SW_MATM-4-MACFLAP`) neredeyse her zaman bir L2 döngüsüne işaret eder. Aynı IP'nin iki farklı MAC'ten yanıt vermesi (`%IP-4-DUPADDR`) ise IP çakışmasıdır.

## 3. Çıktı okuma

Bu katmanda üç tablo okunur: switch'in MAC tablosu, router/L3 switch'in ARP tablosu ve PC'nin ARP önbelleği. Üçü birlikte "çerçeve nereye gidiyor ve kime gidiyor" sorusunu cevaplar.

### show mac address-table — kim hangi portta?

```
SW1#show mac address-table dynamic
          Mac Address Table
-------------------------------------------

Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
  10    0050.7966.6801    DYNAMIC     Fa0/1
  10    0050.7966.6802    DYNAMIC     Fa0/2
  10    0050.7966.6803    DYNAMIC     Fa0/3
  10    5254.0010.0201    DYNAMIC     Gi0/1
Total Mac Addresses for this criterion: 4
```

- Her satır "bu VLAN'da bu MAC, bu porttan geldi" der. Bir PC'nin MAC'i burada yoksa, switch o PC'den henüz hiç çerçeve almamıştır: kablo, port ya da PC kapalıdır.
- **Aynı MAC'in yanlış VLAN'da görünmesi**, portun yanlış VLAN'a atandığını gösterir.
- **Tek porttan çok sayıda MAC** (Gi0/1 gibi) normaldir: o port başka bir switch'e ya da router'a gider.
- Belirli bir PC'yi aramak için: `show mac address-table address 0050.7966.6802`.

### show ip arp — IP hangi MAC'e eşlendi?

```
SW1#show ip arp
Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  192.168.10.1            -   5254.0010.0164  ARPA   Vlan10
Internet  192.168.10.11           3   0050.7966.6801  ARPA   Vlan10
Internet  192.168.10.12           0   0050.7966.6802  ARPA   Vlan10
Internet  192.168.10.13           -   Incomplete      ARPA
```

- **Age `-`** cihazın kendi adresidir (burada SVI'nın kendisi).
- **Incomplete**: ARP isteği gönderildi ama yanıt gelmedi. Hedef kapalı, yanlış VLAN'da ya da L2 yolu kopuk. "IP doğru ama ulaşamıyorum" arızasının en net kanıtıdır.
- Aynı IP'nin MAC'i her bakışta değişiyorsa iki cihaz aynı IP'yi kullanıyordur.

### PC'de ARP önbelleği

```
PC-A> show arp
00:50:79:66:68:02  192.168.10.12 expires in 117 seconds
```

Windows'ta aynı bilgi `arp -a` ile görülür. PC başka ağdaki bir hedefe ulaşmaya çalışıyorsa önbellekte o hedefi değil, **gateway'in** IP ve MAC'ini görmek gerekir. Gateway burada yoksa ya da Incomplete ise sorun daha hedefe gelmeden, PC'nin kendi ağındadır.

## 4. Yönlendirmeli lab

Tek switch, üç PC, hepsi VLAN 10'da. Bu labda yapılandırma neredeyse yok; amaç switch'in ve PC'lerin tablolarının nasıl dolduğunu kendi gözünle izlemek.

| Cihaz | Port | IP / maske | MAC |
| --- | --- | --- | --- |
| PC-A | SW1 Fa0/1 | 192.168.10.11/24 | 0050.7966.6801 |
| PC-B | SW1 Fa0/2 | 192.168.10.12/24 | 0050.7966.6802 |
| PC-C | SW1 Fa0/3 | 192.168.10.13/24 | 0050.7966.6803 |

1. **Tabloyu boşalt.** SW1'de `clear mac address-table dynamic`, ardından `show mac address-table dynamic`. Tablo boş olmalı. *Neden:* Neyin ne zaman öğrenildiğini görebilmek için temiz başlıyoruz.
2. **PC-A'dan PC-B'ye ping at** (`ping 192.168.10.12`). Ardından PC-A'nın ARP önbelleğine bak. Yalnız PC-B görünmeli. *Neden:* PC-A yalnız konuşmak istediği adresi sorar; PC-C'yi sormadı.
3. **MAC tablosuna tekrar bak.** PC-A (Fa0/1) ve PC-B (Fa0/2) var, PC-C yok. *Neden:* Switch yalnız kendisine çerçeve gönderen cihazları öğrenir. PC-C ARP isteğini almıştı ama hiç yanıt vermediği için tabloya girmedi.
4. **PC-C'den PC-A'ya ping at.** MAC tablosunda artık üç PC de var.
5. **Olmayan bir adrese ping at:** PC-A'dan `ping 192.168.10.99`. Ping başarısız olur, MAC tablosuna yeni kayıt eklenmez. *Neden:* Kimse ARP isteğine yanıt vermedi; gerçek bir router'da bu adres `show ip arp`'ta Incomplete görünürdü.
6. **Kabloyu taşı.** PC-B'nin kablosunu Fa0/2'den Fa0/5'e tak, PC-B'den PC-A'ya ping at, MAC tablosuna bak. PC-B'nin MAC'i artık Fa0/5'te. *Neden:* Switch, bir MAC'i yeni bir porttan duyduğu anda kaydı günceller. Bu, ofiste masası değişen birinin neden ayar gerektirmeden çalışmaya devam ettiğini açıklar.
7. **Belirli bir cihazı bul.** `show mac address-table address 0050.7966.6802` ile PC-B'nin hangi portta olduğunu tek satırda gör.

**Lab'ın otomatik değerlendirmesi** (motordan bağımsız yazım):

- `q.macPort('SW1', '0050.7966.6802') === 'Fa0/5'`: PC-B yeni porttan öğrenilmiş.
- `q.macTable('SW1', 10).length === 3`: üç PC de VLAN 10'da öğrenilmiş.
- `q.ping('PC-A', '192.168.10.12').ok` ve `q.ping('PC-C', '192.168.10.11').ok`: başarılı.
- `!q.ping('PC-A', '192.168.10.99').ok`: olmayan adrese erişim başarısız.

## 5. Sık hatalar

Bu konunun hataları "IP doğru, aynı ağdayız, yine de olmuyor" ailesindendir. Teşhisin anahtarı: hedefin MAC'i ARP'ta çözülmüş mü, switch o MAC'i nerede görüyor?

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | IP çakışması | Erişim aralıklı: bazen gidiyor, bazen gitmiyor; bazen yanlış cihaz yanıt veriyor | `show ip arp`'ta aynı IP'nin MAC'i değişiyor; gerçek cihazda `%IP-4-DUPADDR` | Cihazlardan birinin IP'sini değiştir |
| E2 | Yanlış maske | İki PC aynı kabloda ama biri diğerini "başka ağda" sanıyor; ARP yerine gateway'e gönderiyor | PC'de `show ip` / `ipconfig`: maske farklı | Maskeyi ağın maskesiyle eşitle |
| E3 | Port kapalı ya da kablo kopuk | PC hiçbir yere ulaşamıyor | MAC tablosunda PC'nin MAC'i yok; `show interfaces status`: `disabled` / `notconnect` | `no shutdown` ya da kablo |
| E4 | Port yanlış VLAN'da | ARP yanıtsız, PC kimseye ulaşamıyor | MAC tablosunda PC'nin MAC'i **yanlış VLAN** satırında | `switchport access vlan <doğru>` (Konu #5) |
| E5 | L2 döngüsü | Ağ bir anda yavaşlar ya da tamamen durur, ışıklar sürekli yanıp söner | Aynı MAC hızla porttan porta geçiyor; `%SW_MATM-4-MACFLAP` logu | Fazladan kabloyu çıkar, STP'yi kontrol et (Konu #13) |

E4'ü VLAN konusundan ayıran nokta kanıttır: burada sorun MAC tablosundan bulunur. Aynı belirtiye iki farklı yoldan ulaşmayı öğrenmek, sahadaki teşhisi hızlandırır.

## 6. Arıza senaryoları

> **Uygulamada (PR F):** S1–S5 Sorun Çöz'de `eth-printer-port`, `eth-wrong-mask`,
> `eth-duplicate-ip`, `eth-moved-cable-vlan`, `eth-two-switch-vlan` kimlikleriyle Labber'da
> çalışır (`simulator/network-scenarios.json`, `verify.kind: "query"`). Hedefteki ping'ler
> değerlendirmede gerçek trafik gibi çalışır, böylece `macPort`/`macVlan` o trafikle
> öğrenilen MAC'e bakar. `macPort` IOS'un tam port adını döndürür (`FastEthernet0/4`);
> aşağıdaki `'Fa0/4'` yazımı kısaltmadır.

Hedefler motordan bağımsız, Labber'ın `LabQuery` yaklaşımıyla yazıldı: yapılandırma metnine değil, ağın gerçek davranışına bakar. Hangi motor seçilirse seçilsin doğrudan lab tanımına çevrilebilir. Temel topoloji laptakiyle aynıdır: SW1, VLAN 10, PC-A .11, PC-B .12, PC-C .13; gerektiğinde yazıcı PRN .50 eklenir.

### S1 · Başlangıç · Yeni yazıcı kimseye görünmüyor (E3)

- **Başlangıç:** PRN (192.168.10.50) SW1 Fa0/4'e bağlı; Fa0/4 `shutdown`.
- **Belirti:** Yazıcı kuruldu, IP ayarlandı, ama hiçbir PC ona ping atamıyor.
- **İpuçları:** (1) Switch yazıcıyı tanıyor mu? (2) MAC tablosunda yazıcının MAC'ini ara. (3) Yoksa portun durumuna bak: `show interfaces status`.
- **Çözüm:** SW1 → `interface fa0/4` → `no shutdown`
- **Hedefler:** `q.ping('PC-A', '192.168.10.50').ok`; `q.macPort('SW1', PRN_MAC) === 'Fa0/4'`

### S2 · Başlangıç · PC-C kendi ağındakilere ulaşamıyor (E2)

- **Başlangıç:** PC-C 192.168.10.130 **/25** ile yapılandırılmış; diğerleri /24. Gateway tanımlı değil.
- **Belirti:** PC-C'nin IP'si "doğru ağda" görünüyor ama PC-A'ya ve PC-B'ye ping gitmiyor; onlar da PC-C'ye ulaşamıyor.
- **İpuçları:** (1) IP'ye bakmak yetmez, maske de aynı mı? (2) /25 ile 192.168.10.130, .11'i aynı ağda sayar mı? (3) PC-C'de `show ip`.
- **Çözüm:** PC-C → `ip 192.168.10.130/24`
- **Hedefler:** `q.ping('PC-C', '192.168.10.11').ok` ve `q.ping('PC-A', '192.168.10.130').ok`

### S3 · Orta · Muhasebe PC'sine bazen ulaşılıyor, bazen ulaşılamıyor (E1)

- **Başlangıç:** Yeni bir dizüstü (LAPTOP, Fa0/6) yanlışlıkla 192.168.10.12 ile yapılandırılmış; bu adres PC-B'nin.
- **Belirti:** PC-A, PC-B'deki paylaşıma bazen ulaşıyor bazen ulaşamıyor. Sorun yeni bir dizüstü gelince başladı.
- **İpuçları:** (1) "Aralıklı" sorunlarda aynı adresi kullanan iki cihazı düşün. (2) PC-A'nın ARP önbelleğinde .12'nin MAC'i PC-B'nin MAC'i mi? (3) MAC tablosunda o MAC hangi portta?
- **Çözüm:** LAPTOP → `ip 192.168.10.14/24`
- **Hedefler:** `q.ipUnique('192.168.10.12')`; `q.ping('PC-A', '192.168.10.12').replier === 'PC-B'`

### S4 · Orta · Masası değişen çalışan ağa giremiyor (E4)

- **Başlangıç:** PC-B'nin kablosu Fa0/7'ye taşınmış; Fa0/7 misafir ağı için VLAN 20'de.
- **Belirti:** PC-B yeni masasına geçti, IP ayarları aynı, ama artık hiçbir yere ulaşamıyor.
- **İpuçları:** (1) Değişen tek şey port. (2) MAC tablosunda PC-B'nin MAC'i hangi VLAN satırında? (3) `show mac address-table address <PC-B MAC>`.
- **Çözüm:** SW1 → `interface fa0/7` → `switchport access vlan 10`
- **Hedefler:** `q.ping('PC-B', '192.168.10.11').ok`; `q.macVlan('SW1', PCB_MAC) === 10`

### S5 · İleri · Yeni switch'e bağlananlar ofise ulaşamıyor (E4, iki switch)

- **Başlangıç:** SW2 eklenmiş, SW1 Fa0/8'e bağlı. SW2'nin tüm portları VLAN 10'da; SW1 Fa0/8 ise varsayılan VLAN 1'de bırakılmış. SW2'ye PC-D (.21) ve PC-E (.22) bağlı.
- **Belirti:** PC-D ile PC-E birbirine ulaşıyor. İkisi de SW1'deki PC'lere ulaşamıyor.
- **İpuçları:** (1) Sorun yalnız iki switch arasında: ortak nokta bağlantı portu. (2) SW1'in MAC tablosunda PC-D'nin MAC'i hangi portta ve hangi VLAN'da? (3) SW1 Fa0/8'in VLAN'ını SW2'nin portlarıyla karşılaştır.
- **Çözüm:** SW1 → `interface fa0/8` → `switchport access vlan 10` (tek VLAN varsa yeterli; birden çok VLAN taşınacaksa trunk, Konu #6)
- **Hedefler:** `q.ping('PC-D', '192.168.10.11').ok`; `q.ping('PC-E', '192.168.10.12').ok`; `q.macVlan('SW1', PCD_MAC) === 10` ve `q.macPort('SW1', PCD_MAC) === 'Fa0/8'`

### Ek · L6'dan gelen iki gözlem senaryosu

Eski Sorun Çöz'ün "MAC ve ARP tabloları boş" ve "bilinmeyen unicast" metin senaryoları motor
kullanmıyordu. Arıza içermeyen iki gözlem senaryosuna çevrildi; başlangıçta tablolar boş olduğu
için hedef başarısızdır, trafik üretilince başarılı olur:

- `eth-mac-learning` · S1 topolojisi (yazıcı portu açık). PC-A → PC-B ping'inden sonra SW1
  PC-A'yı Fa0/1'de, PC-B'yi (yanıttan) Fa0/2'de öğrenir.
- `eth-unknown-unicast` · S5 topolojisi (SW1 Fa0/8 VLAN 10'da). PC-A → PC-D ping'inden sonra SW2
  PC-A'yı uplink'te (Fa0/3), SW1 PC-D'yi uplink'te (Fa0/8) öğrenir; hiç göndermeyen PC-E hiçbir
  tabloda yoktur. Taşırma (flood) Labber'da ayrı bir olay olarak gösterilmez; öğrenme sonucu sınanır.

## 7. Kısa sınav

Beş soru, hepsi çıktı okuma. Geçme ölçütü 4/5.

1. Switch, hedef MAC'i tablosunda bulamadığı bir çerçeveyi ne yapar?
   - A) Düşürür
   - B) Geldiği port hariç aynı VLAN'daki tüm portlara gönderir
   - C) Tüm VLAN'lardaki tüm portlara gönderir
   - D) Gateway'e gönderir

   **Cevap: B.** Bilinmeyen unicast, broadcast gibi yalnız kendi VLAN'ı içinde flood edilir.
2. `show ip arp` çıktısında 192.168.10.13 için Hardware Addr sütununda `Incomplete` yazıyor. Bu ne anlama gelir?
   - A) Cihazın MAC adresi bozuk
   - B) ARP isteği gönderildi ama yanıt gelmedi
   - C) Cihaz başka bir VLAN'ın gateway'i
   - D) Kayıt statik girilmiş

   **Cevap: B.** Hedef kapalı, yanlış VLAN'da ya da L2 yolu kopuk olabilir.
3. `show mac address-table` çıktısında Gi0/1 portunda 14 farklı MAC görünüyor. En olası açıklama nedir?
   - A) Gi0/1'e başka bir switch ya da router bağlı
   - B) MAC flooding saldırısı kesin
   - C) Port yanlış VLAN'da
   - D) Tablo bozulmuş

   **Cevap: A.** Başka bir switch'in arkasındaki tüm cihazlar o porttan öğrenilir. Binlerce MAC ve log uyarıları varsa saldırı akla gelir.
4. PC-A başka ağdaki 8.8.8.8'e ping atıyor. ARP önbelleğinde hangi IP'nin kaydını görmeyi beklersin?
   - A) 8.8.8.8
   - B) Gateway'in IP'si
   - C) DNS sunucusunun IP'si
   - D) Hiçbir kayıt, ARP uzak ağlarda kullanılmaz

   **Cevap: B.** ARP yalnız kendi ağında çalışır; uzak hedef için çerçeve gateway'in MAC'ine gönderilir.
5. Ağa bir dizüstü eklendikten sonra PC-B'ye erişim aralıklı hale geldi. PC-A'nın ARP önbelleğinde .12'nin MAC'i her bakışta değişiyor. Sorun nedir?
   - A) Kablo gevşek
   - B) Switch'in MAC tablosu dolu
   - C) Dizüstü ile PC-B aynı IP'yi kullanıyor
   - D) PC-B yanlış VLAN'da

   **Cevap: C.** İki cihaz aynı IP için ARP yanıtı verir; önbellek son gelen yanıta göre değişir.

## 8. Doğrulama notları

Kaynak: Layer8 Bölüm 1.2.5 (ARP) ve Bölüm 2 (Ethernet ve Switching). Bölüm 2 büyük ölçüde CCNP düzeyinde (CAM/TCAM, ASIC hattı, SDM şablonları, hata sayaçları); Seviye 1 için yalnız MAC öğrenme, flood ve ARP alındı. Ders metni özgün yazıldı; kaynakta hata bulunmadı.

**Kontrol edilen iddialar**

| İddia | Sonuç |
| --- | --- |
| EtherType: IPv4 0x0800, ARP 0x0806, IPv6 0x86DD, 802.1Q 0x8100 | Doğru |
| Dinamik MAC kaydı varsayılan 300 saniyede yaşlanır | Doğru |
| IOS'ta ARP kaydı varsayılan 4 saat (14400 sn) saklanır | Doğru |
| Bilinmeyen unicast ve broadcast yalnız kendi VLAN'ında, geldiği port hariç flood edilir | Doğru |
| `%SW_MATM-4-MACFLAP` L2 döngüsünün tipik işaretidir; `%IP-4-DUPADDR` IP çakışmasını bildirir | Doğru |
| MAC aging (5 dk) ile ARP timeout (4 sa) farkı unicast flooding'e yol açabilir; `mac address-table aging-time 14400` önerisi | Doğru ama asimetrik yönlendirme gibi özel durumlar için. Seviye 1'e alınmadı; Konu #13/CCNP'de anılabilir |

**Motor gereksinimleri** (Labber motorunda denendi; öğrencinin göreceği her şey için)

- [x] `show mac address-table` gerçek IOS biçiminde, CPU/STATIC satırlarıyla
- [x] `show ip arp` gerçek biçimde, kendi adresi için Age `-`
- [x] `clear mac address-table dynamic` (komut listesinde var)
- [x] `show mac address-table address <mac>` (lab adım 7, S4) — L2-C
- [x] PC'de `show arp` (VPCS'teki gibi; lab adım 2, S3) — L2-C
- [x] `show ip arp`'ta yanıtsız hedef için `Incomplete` satırı — L2-C
- [x] Aynı IP'yi kullanan iki cihazın modellenmesi ve `%IP-4-DUPADDR` syslog'u (S3) — L2-C; yanıtlayan: yayın alanında lab tanım sırasındaki ilk cihaz
- [x] Kablonun başka porta taşınması (lab adım 6, S4) — L2-C `LabRuntime.moveCable`; ürün arayüzüne bağlanması L2-D
- [x] Yeni `LabQuery` yardımcıları: `macPort`, `macVlan`, `macTable`, `ipUnique`, `ping().replier` (+ `duplicates`) — L2-C
- [ ] L2 döngüsü ve MAC flap: modellenmiyor; derste okuma olarak kalır
