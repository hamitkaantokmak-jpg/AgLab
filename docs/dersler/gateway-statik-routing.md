# AğLab Konu #8: Gateway ve statik routing

> Uygulamadaki `routing` dersi bu belgeye göre yeniden yazıldı; eski "Routing kararları:
> LPM, AD ve metric" konusu da buraya katıldı. Senaryolar Sorun Çöz'de `gw-*` kimlikleriyle
> Labber'da çalışır.

Bu konu bittiğinde öğrenci bir PC'nin başka ağa giden paketi neden gateway'e gönderdiğini açıklar. Router'da statik rota ve varsayılan rota yazar. Bir paket için tablodan hangi rotanın seçileceğini en uzun önek (LPM) ve yönetimsel uzaklık (AD) kurallarıyla bulur. Yedek hat için floating static kurar. Arıza ararken gidiş ve dönüş yolunu ayrı ayrı kontrol eder. Seviye 1, süre yaklaşık 80 dakika (ders 18, lab 25, senaryolar 25, sınav 12).

## 1. Neden önemli

Şube ile merkez arasındaki trafiğin tamamı birkaç satırlık rotaya dayanır. Bir satır eksikse ya da yanlışsa şube merkezdeki sunuculara ulaşamaz. Üstelik en sık görülen hata yarımdır: gidiş yolu vardır, dönüş yolu yoktur. Paket hedefe ulaşır ama yanıt geri dönemez; belirti "ping gitmiyor" olur.

Kullanıcı tarafında da durum benzerdir. PC'nin gateway'i yanlışsa yan masadaki bilgisayara ulaşır ama başka hiçbir yere ulaşamaz. "Bir şeyler çalışıyor, bir şeyler çalışmıyor" şikâyetlerinin çoğu bu konudan gelir.

## 2. Kavram

**PC'nin kararı:** PC hedef adresi kendi adresi ve maskesiyle karşılaştırır. Hedef **aynı ağdaysa** paketi doğrudan gönderir (ARP ile hedefin MAC'ini bulur, Konu #3). **Başka ağdaysa** paketi **varsayılan ağ geçidine** (gateway) gönderir. Gateway, PC ile aynı ağda olan router arayüzüdür. Gateway yanlışsa PC kendi ağı dışına çıkamaz.

**Router'ın kararı:** Router her paket için yönlendirme tablosuna bakar. Tablodaki satırlar üç kaynaktan gelir:

- **C (connected) ve L (local):** Router'ın adres verilmiş ve ayakta olan arayüzleri. Arayüz düşerse bu satırlar tablodan çıkar.
- **S (static):** Elle yazılan rotalar: `ip route <ağ> <maske> <next-hop> [AD]`. Next-hop'a ulaşılamıyorsa rota tabloya girmez.
- **Dinamik:** OSPF gibi protokollerin öğrendikleri (Konu #15).

**Seçim kuralları,** sırayla:

1. **En uzun önek (LPM):** Hedefle eşleşen satırlardan maskesi en uzun olan seçilir. 192.168.100.10 için hem `0.0.0.0/0` hem `192.168.100.0/24` eşleşiyorsa /24 seçilir. Varsayılan rota yalnız daha özgül bir satır yoksa kullanılır.
2. **Yönetimsel uzaklık (AD):** Aynı ağ ve maske için birden fazla kaynak varsa AD'si düşük olan tabloya girer. AD, "bu kaynağa ne kadar güveniyorum" demektir.
3. **Metric:** Aynı protokolün aynı ağ için iki yolu varsa (ör. OSPF cost) düşük metric seçilir.

| Kaynak | AD |
| --- | --- |
| Connected | 0 |
| Static | 1 |
| eBGP | 20 |
| EIGRP (iç) | 90 |
| OSPF | 110 |
| RIP | 120 |
| iBGP | 200 |

**Floating static:** AD'si yüksek yazılmış (ör. 200) yedek statik rota. Ana rota tablodayken AD'si yüksek olduğu için tabloya girmez, "yüzer". Ana hat düşüp ana rota tablodan çıkınca devreye girer; ana hat dönünce yine kenara çekilir.

**Gidiş ve dönüş:** Her bağlantı iki yönlüdür. Şubeden merkeze giden paket için şube router'ında, yanıt için merkez router'ında rota gerekir. Bir router'da rota olması bağlantının çalıştığını göstermez.

*(Etkileşimli şema: PC-11 → R1 → ana hat → R2 → SRV; yanıt ters yönden; yedek hat kesik çizgiyle.)*

## 3. Çıktı okuma

### show ip route

```
R1#show ip route
...
Gateway of last resort is 10.0.12.2 to network 0.0.0.0

S*    0.0.0.0/0 [1/0] via 10.0.12.2
      10.0.0.0/8 is variably subnetted, 4 subnets, 3 masks
C        10.0.12.0/30 is directly connected, GigabitEthernet0/1
L        10.0.12.1/32 is directly connected, GigabitEthernet0/1
C        10.0.21.0/29 is directly connected, GigabitEthernet0/2
L        10.0.21.1/32 is directly connected, GigabitEthernet0/2
      192.168.10.0/24 is variably subnetted, 2 subnets, 2 masks
C        192.168.10.0/24 is directly connected, GigabitEthernet0/0
L        192.168.10.1/32 is directly connected, GigabitEthernet0/0
      192.168.100.0/24 is subnetted, 1 subnets
S        192.168.100.0/24 [1/0] via 10.0.21.5
```

- **Kod sütunu:** `C` bağlı ağ, `L` router'ın kendi adresi (/32), `S` statik, `S*` varsayılan rota adayı.
- **[1/0]:** `[AD/metric]`. Statik rotada AD 1'dir; floating static'te yazdığın değer görünür (ör. `[200/0]`).
- **via:** Next-hop. Paket bu adrese gönderilir; adres bir bağlı ağda olmalıdır.
- **Gateway of last resort:** Varsayılan rotanın next-hop'u. "not set" yazıyorsa varsayılan rota yok demektir.
- **Bu çıktıda hata var:** 192.168.100.0/24 için daha özgül bir satır var ve eski bir cihaza (10.0.21.5) gidiyor. LPM gereği sunucu trafiği varsayılan rotayı değil bu satırı kullanır.

### show ip route <adres> — bu paket hangi satırı kullanır?

```
R1#show ip route 192.168.100.10
Routing entry for 192.168.100.0/24
  Known via "static", distance 1, metric 0
  Routing Descriptor Blocks:
  * 10.0.21.5
```

LPM'yi kafadan yapmak yerine router'a sorarsın: seçilen satır, kaynağı, AD'si ve next-hop'u. Sonra next-hop'a ping atarak orada gerçekten bir cihaz olup olmadığını görürsün.

### traceroute — paket nerede kayboluyor?

```
PC-11> trace 192.168.100.10
 1   192.168.10.1   0.600 ms
 2   10.0.12.2   1.100 ms
 3   *192.168.100.10   1.700 ms
```

Her satır yoldaki bir router'dır. Yanıt veren son satır, paketin ulaştığı son yerdir. Satırlar `* * *` ile kesiliyorsa sorun o noktadan sonradır: ya ileri yön (sonraki router'da rota yok), ya da yanıtların dönüş yolu. Router'da `traceroute`, PC'de (VPCS) `trace`, Windows'ta `tracert`.

## 4. Yönlendirmeli lab

Topoloji: Şube router'ı R1 (LAN 192.168.10.0/24) ile merkez router'ı R2 (sunucu ağı 192.168.100.0/24, SRV .10) arasında iki hat var. Ana hat Gi0/1 (10.0.12.0/30), yedek hat Gi0/2 (10.0.21.0/29). Başlangıçta iki router'da da statik rota yok.

1. **Bağlı ağları gör.** R1'de `show ip route`: yalnız C ve L satırları; "Gateway of last resort is not set". *Neden:* Router yalnız kendi arayüzlerinin ağlarını bilir.
2. **Ping'i dene.** PC-11'den `ping 192.168.100.10`: "Destination host unreachable", yanıtı 192.168.10.1 veriyor. *Neden:* Paket gateway'e kadar geldi; R1'in bu ağ için rotası olmadığı için R1 "ulaşılamıyor" yanıtı döndü.
3. **Gidiş rotası.** R1'de `ip route 192.168.100.0 255.255.255.0 10.0.12.2`. PC-11'den tekrar ping: bu kez **timeout**. *Neden:* Paket SRV'ye ulaştı, ama R2 yanıtı 192.168.10.0/24'e nasıl göndereceğini bilmiyor. Hata mesajının değişmesi, sorunun bir adım ilerlediğini gösterir.
4. **Dönüş rotası.** R2'de `ip route 192.168.10.0 255.255.255.0 10.0.12.1`. Ping başarılı. `trace 192.168.100.10`: 192.168.10.1 → 10.0.12.2 → SRV.
5. **Varsayılan rotaya geç.** R1'de özgül rotayı kaldır (`no ip route 192.168.100.0 255.255.255.0 10.0.12.2`) ve `ip route 0.0.0.0 0.0.0.0 10.0.12.2` yaz. `show ip route`: `S*` ve "Gateway of last resort is 10.0.12.2". *Neden:* Şube router'ı için "bilmediğin her şeyi merkeze gönder" yeterlidir.
6. **Yedek hat için floating static.** R1'de `ip route 0.0.0.0 0.0.0.0 10.0.21.2 200`; R2'de `ip route 192.168.10.0 255.255.255.0 10.0.21.1 200`. `show ip route`: yedek rotalar **görünmez**. *Neden:* Aynı ağ için AD 1'lik rota tabloda; AD 200'lük rota bekler.
7. **Ana hattı düşür.** R1'de `interface g0/1` → `shutdown`. `show ip route`: varsayılan rota artık `[200/0] via 10.0.21.2`. PC-11'den ping yine başarılı. *Neden:* Ana rotanın next-hop'una ulaşılamadığı için tablodan çıktı; floating static devreye girdi.
8. **Ana hattı geri aç.** `no shutdown`: tablo yine `[1/0] via 10.0.12.2`. *Neden:* Floating static ana hat dönünce kendiliğinden kenara çekilir.

**Lab'ın otomatik değerlendirmesi:** `q.ping('PC-11', '192.168.100.10').ok`; `q.routeFor('R1', '192.168.100.10').nh === '10.0.12.2'` (ana hat ayaktayken).

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | PC'nin gateway'i yanlış ya da boş | PC kendi ağına ulaşıyor, başka ağlara ulaşamıyor | `show ip` / `ipconfig`: GATEWAY yanlış; gateway adresine ping yok | Gateway'i router'ın o ağdaki arayüz adresi yap |
| E2 | Dönüş rotası yok | Gidiş rotası var ama ping timeout; karşı router bu ağı bilmiyor | Karşı router'da `show ip route`'ta kaynak ağ yok | Karşı router'a dönüş rotası |
| E3 | Daha özgül, yanlış bir rota (LPM) | Varsayılan rota doğru ama belirli bir ağa gidilemiyor | `show ip route <hedef>` beklenmeyen bir satırı ve next-hop'u gösteriyor | Yanlış rotayı `no ip route` ile kaldır ya da düzelt |
| E4 | Yedek yol için rota yok ya da AD yanlış | Ana hat düşünce bağlantı tamamen kesiliyor; ya da ana hat varken trafik yedekten akıyor | Yedek hat ayakta ama tabloda rota yok; ya da yedek rota AD 1 | İki yönde floating static (yüksek AD) |
| E5 | Next-hop yanlış (yazım, maske, ulaşılamayan adres) | Rota yazılı ama tabloda yok ya da trafik kayboluyor | `show ip route`'ta rota görünmüyor; next-hop bağlı bir ağda değil | Next-hop'u bağlı ağdaki komşu adresiyle yaz |

E1'i ötekilerden ayıran şey etki alanıdır: tek bir PC mi, bütün ağ mı? E2'nin en net izi, ping'in "unreachable"dan "timeout"a dönmesidir: gidiş tamam, dönüş yok.

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `gw-pc-wrong-gateway`, `gw-missing-return`,
> `gw-lpm-leftover`, `gw-backup-floating`, `gw-two-faults` kimlikleriyle Labber'da çalışır.
> Temel topoloji lab'ın 5. adımdaki hâlidir: R1'de varsayılan rota, R2'de şubeye dönüş rotası.

### S1 · Başlangıç · Yan masaya gidiyor, sunucuya gitmiyor (E1)

- **Başlangıç:** PC-11'in gateway'i 192.168.10.254.
- **Belirti:** PC-11 yan masadaki PC-12'ye ulaşıyor ama merkezdeki sunucuya ulaşamıyor; PC-12 sunucuya ulaşıyor.
- **İpuçları:** (1) Başka ağa giden paketi kim taşıyor? (2) `show ip`: GATEWAY ne? O adrese ping at. (3) PC-12'ninkiyle aynı gateway'i yaz.
- **Çözüm:** PC-11 → `ip 192.168.10.11 255.255.255.0 192.168.10.1`
- **Hedefler:** `q.ping('PC-11', '192.168.100.10').ok`; `q.ping('PC-11', '192.168.10.12').ok`

### S2 · Başlangıç · Ping gidiyor ama geri gelmiyor (E2)

- **Başlangıç:** R2'de şube için eski numaralandırmanın rotası (192.168.1.0/24) kalmış; 192.168.10.0/24 için rota yok.
- **Belirti:** Şube ağı yeniden numaralandırıldı. Şubeden sunucuya hiçbir şey ulaşmıyor; R1'in tablosunda merkeze giden yol duruyor.
- **İpuçları:** (1) Yanıtın geri dönmesi için karşı taraf neyi bilmeli? (2) R2'de `show ip route`. (3) Dönüş rotasını yaz, eskisini kaldır.
- **Çözüm:** R2 → `no ip route 192.168.1.0 255.255.255.0 10.0.12.1` → `ip route 192.168.10.0 255.255.255.0 10.0.12.1`
- **Hedefler:** `q.ping('PC-11', '192.168.100.10').ok`; `q.ping('PC-12', '192.168.100.10').ok`

### S3 · Orta · Varsayılan rota var, sunucuya yine gidilmiyor (E3)

- **Başlangıç:** R1'de varsayılan rotanın yanında eskiden kalma `ip route 192.168.100.0 255.255.255.0 10.0.21.5` var; 10.0.21.5'te artık cihaz yok.
- **Belirti:** Şubeden merkezdeki her şeye ulaşılıyor, yalnız sunucu ağına ulaşılamıyor.
- **İpuçları:** (1) Varsayılan rota yalnız daha özgül bir rota yoksa kullanılır. (2) `show ip route 192.168.100.10`: hangi satır, hangi next-hop? Ona ping at. (3) Geçersiz rotayı kaldır.
- **Çözüm:** R1 → `no ip route 192.168.100.0 255.255.255.0 10.0.21.5`
- **Hedefler:** `q.ping('PC-11', '192.168.100.10').ok`

### S4 · Orta · Ana hat koptu, yedek hat boşta duruyor (E4)

- **Başlangıç:** Ana hat (Gi0/1) kopuk; yedek hat ayakta ama rota yok.
- **Belirti:** Operatör ana hattı onarana kadar şube merkeze ulaşamıyor.
- **İpuçları:** (1) Ana hat düşünce o hattaki next-hop'u kullanan rotalara ne olur? `show ip route`. (2) Yedek hattan iki yönde rota gerekir. (3) Ana hat dönünce devreden çıkacak şekilde AD 200 ile yaz.
- **Çözüm:** R1 → `ip route 0.0.0.0 0.0.0.0 10.0.21.2 200`; R2 → `ip route 192.168.10.0 255.255.255.0 10.0.21.1 200`
- **Hedefler:** `q.ping('PC-11', '192.168.100.10').ok`

AD yazmadan eklenen yedek rota da bu senaryoyu çözer. Ama ana hat döndüğünde iki AD 1'lik rota yarışır ve trafik yedek hattan akmaya devam edebilir. Doğru çözüm floating static'tir.

### S5 · İleri · İki hata birden (E2 + E1)

- **Başlangıç:** R2'de dönüş rotası yok ve PC-11'in gateway'i yanlış.
- **Belirti:** Şubeden kimse sunucuya ulaşamıyor; bir düzeltmeden sonra PC-11 hâlâ ulaşamıyor.
- **İpuçları:** (1) Herkesi etkileyen hatayla başla. (2) R2'de `show ip route`. (3) Sonra yalnız PC-11'i etkileyene bak.
- **Çözüm:** R2 → `ip route 192.168.10.0 255.255.255.0 10.0.12.1`; PC-11 → `ip 192.168.10.11 255.255.255.0 192.168.10.1`
- **Hedefler:** `q.ping('PC-12', '192.168.100.10').ok`; `q.ping('PC-11', '192.168.100.10').ok`

## 7. Kısa sınav

1. R1'de iki rota var: `0.0.0.0/0 via 10.0.12.2` ve `192.168.100.0/24 via 10.0.21.5`. 192.168.100.10'a giden paket hangisini kullanır?
   - A) Varsayılan rotayı, çünkü önce yazıldı
   - B) /24 rotayı, çünkü daha özgül
   - C) İkisini sırayla
   - D) AD'si düşük olanı

   **Cevap: B.** Önce en uzun önek; AD yalnız aynı ağ ve maske için karşılaştırılır.
2. Aynı ağ için OSPF'ten (AD 110) ve statik rotadan (AD 1) birer rota var. Tabloya hangisi girer?
   - A) OSPF, çünkü dinamik
   - B) Statik
   - C) İkisi de
   - D) Metric'i düşük olan

   **Cevap: B.** Aynı önekte düşük AD kazanır.
3. PC'den ping'in yanıtı önce "Destination host unreachable" iken, R1'e rota eklenince "timeout" oldu. Bu ne gösterir?
   - A) Durum kötüleşti
   - B) Gidiş yolu tamamlandı; yanıtın dönüş yolu eksik
   - C) Kablo koptu
   - D) Gateway yanlış

   **Cevap: B.** Artık hata mesajı dönmüyor; paket hedefe ulaşıyor ama yanıt gelmiyor.
4. `ip route 0.0.0.0 0.0.0.0 10.0.21.2 200` ne yapar?
   - A) Ana varsayılan rotayı siler
   - B) Ana rota tablodan çıkana kadar bekleyen yedek varsayılan rota tanımlar
   - C) Trafiği iki hatta böler
   - D) 200 paket sonra devreye girer

   **Cevap: B.** Floating static.
5. Bir PC kendi ağındaki herkese ulaşıyor, başka hiçbir ağa ulaşamıyor; diğer PC'ler sorunsuz. İlk kontrol?
   - A) Router'ın rotaları
   - B) PC'nin gateway'i
   - C) Switch'in MAC tablosu
   - D) DNS

   **Cevap: B.** Tek PC etkileniyorsa sorun o PC'nin ayarındadır.

## 8. Doğrulama notları

Kaynaklar: Cisco IOS IP Routing yapılandırma kılavuzu (statik rotalar, yönetimsel uzaklık), CCNA 200-301 sınav konuları (3.1 yönlendirme tablosunu yorumlama, 3.2 yönlendirme kararı: LPM, AD, metric; 3.3 IPv4 statik rota, varsayılan rota, floating static). Eski `routing` ve `routechoice` dersleri Kavram için kaynak oldu; metin yeniden yazıldı.

**Kontrol edilen iddialar**

| İddia | Sonuç |
| --- | --- |
| Seçim sırası: önce en uzun önek, aynı önekte düşük AD, aynı kaynakta düşük metric | Doğru |
| Varsayılan AD'ler: connected 0, static 1, eBGP 20, EIGRP 90, OSPF 110, RIP 120, iBGP 200 | Doğru |
| Next-hop'u çözülemeyen statik rota tabloya girmez; arayüz düşünce o arayüzden çözülen rotalar çıkar | Doğru |
| Floating static: yüksek AD'li yedek rota, ana rota tablodan çıkınca devreye girer | Doğru |
| Router'da rota yokken PC'ye "Destination host unreachable" (ICMP tip 3) döner | Doğru (router ICMP unreachable üretir) |

**Motor gereksinimleri** (Labber'da denendi)

- [x] `ip route` / `no ip route`, AD'li statik rota, varsayılan rota, özyinelemeli next-hop çözümü — L4
- [x] `show ip route`, `show ip route <adres>`, `show ip route static`, router `traceroute`, VPCS `trace` — L4, L5-i
- [x] Router'da rota yokken PC'ye ICMP unreachable; dönüş yolu yokken timeout
- [x] Beş senaryo başta başarısız, terminalden çözümle başarılı
- [ ] **Hata (öncelikli):** Ana hat düşünce `0.0.0.0/0 via 10.0.12.2` rotası, next-hop'u aynı önekteki floating rota (`0.0.0.0/0 via 10.0.21.2 200`) üzerinden "çözülmüş" sayılıyor ve tabloda `[1/0]` olarak kalıyor. İletim doğru (yedek hattan) ama `show ip route` yanlış. Lab 7. adım bu yüzden gerçek IOS'taki çıktıyı göstermiyor. Bir rota aynı önekteki başka bir rota üzerinden çözülmemeli (`src/sim/net.ts` `routeTable` / `resolve`).
- [ ] LabQuery `routeFor` senaryo sorgu listesinde yok (`SHARED_QUERY_FNS`); lab'ın rota hedefi bu yüzden yalnız belgede
