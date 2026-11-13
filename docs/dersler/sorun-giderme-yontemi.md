# AğLab Konu #1: Sorun giderme yöntemi

> Uygulamadaki `method` dersi bu belgeden üretildi ve listede en başta durur. Eski "Ağ teşhis
> komutları" dersi (`commands`) araç dersi olarak kaldı (müfredatta #24). Senaryolar Sorun Çöz'de
> `method-*` kimlikleriyle Labber'da çalışır. Bu konu Seviye 1'in diğer konularını bağlar;
> en iyi, onlardan birkaçı görüldükten sonra tekrar okunur.

Bu konu bittiğinde öğrenci bir şikâyeti ölçülebilir bir soruna çevirir: kim, ne, ne zamandan beri, ne değişti? Etki alanından başlayıp katman katman ilerler ve her adımda bir komutla bir soruyu cevaplar. Bir değişikliği ancak kanıtla ve öncesinde yedek alarak yapar; düzeltmeden sonra ilk belirtiyi yeniden test eder. Seviye 1, süre yaklaşık 60 dakika (ders 15, lab 15, senaryolar 25, sınav 5).

## 1. Neden önemli

"İnternet yok" bir teşhis değil, bir şikâyettir. Aynı cümlenin arkasında kopuk bir kablo, yanlış bir VLAN, eksik bir rota, duran bir DNS servisi ya da kapalı bir web servisi olabilir. Yöntemsiz çalışan biri aklına gelen ilk şeyi değiştirir: switch'i yeniden başlatır, IP'yi elle yazar, kabloyu değiştirir. Bazen sorun geçer ama neden geçtiği bilinmez; çoğu zaman yeni bir sorun eklenir.

Yöntem bunun tersidir: önce bak, sonra dokun. AğLab'daki her arıza senaryosu da bu yüzden üç şeyle değerlendirilir: bağlantı geri geldi mi, kök neden doğru bulundu mu, gereksiz değişiklik yapıldı mı?

## 2. Kavram

### Altı adım

1. **Tanımla.** Kim etkileniyor, tam olarak ne çalışmıyor, ne zamandan beri, **ne değişti?** "İnternet yok" yerine "PC-12 sabahtan beri ERP'nin sayfasını açamıyor; PC-11 açabiliyor; PC-12'nin kabloları sabah düzenlenmiş."
2. **Etki alanını daralt.** Tek kullanıcı mı, bir kat mı, herkes mi? Tek bir uygulama mı, her şey mi? Etki alanı sorunun **nerede** olduğunu söyler: tek kullanıcı → o kullanıcının cihazı, kablosu, portu; bir kat → o katın switch'i ya da uplink'i; herkes → ortak bir nokta (router, sunucu, servis).
3. **Hipotez kur.** Belirtiyi açıklayabilecek birkaç olası neden say ve en olası olandan başla.
4. **Kanıt topla.** Her komut tek bir soruyu cevaplasın. "Port açık mı?" → `show interfaces status`. "Gateway'e ulaşıyor mu?" → `ping`. Kanıt hipotezi ya doğrular ya eler.
5. **Tek değişiklik yap.** Önce mevcut yapılandırmanın yedeğini al (`show running-config`'i kaydet, kaydedilmiş hâlin farkında ol). Sonra kanıtın gösterdiği **tek** şeyi değiştir. Birden fazla şeyi aynı anda değiştirirsen hangisinin işe yaradığını bilemezsin.
6. **Doğrula ve belgele.** İlk belirtiyi **aynı testle** yeniden dene. Düzeldiyse kaydet (`copy running-config startup-config`) ve ne yaptığını yaz. Düzelmediyse değişikliği geri al ve 3. adıma dön. Bir hata bulmak, tek hata olduğu anlamına gelmez.

### Katmanlar: nereye bakılır?

| Katman | Tipik arızalar | İlk komutlar | Ayrıntı |
| --- | --- | --- | --- |
| 1 Fiziksel | Kapalı port, kopuk kablo, kapalı cihaz | `show interfaces status`, `show interfaces` | Konu #4 |
| 2 Veri bağı | Yanlış VLAN, trunk, MAC/ARP | `show vlan brief`, `show interfaces trunk`, `show mac address-table`, `show arp` | Konu #3, #5, #6 |
| 3 Ağ | Yanlış adres/maske/gateway, eksik rota | `show ip`, `ping`, `traceroute`, `show ip route` | Konu #2, #8 |
| Servisler | DHCP, DNS | `ip dhcp` / `ipconfig /renew`, `nslookup` | Konu #9, #10 |
| Uygulama | Servis kapalı, port engelli | `curl`, tarayıcı, `show services` | Konu #23 |

### Üç yaklaşım

- **Aşağıdan yukarı (bottom-up):** Katman 1'den başla. Tek bir kullanıcı, "hiçbir şey çalışmıyor" ya da yeni bir kablolama söz konusuysa doğru başlangıçtır.
- **Yukarıdan aşağı (top-down):** Uygulamadan başla. Ağın büyük kısmı çalışıyor, yalnız bir uygulama çalışmıyorsa zaman kazandırır. Ping çalışıyorsa alt katmanları tek tek kontrol etmeye gerek yoktur.
- **Böl ve yönet (divide and conquer):** Yolun ortasından test et, genellikle gateway'den. Gateway'e ping gidiyorsa sorun gateway'in ötesindedir; gitmiyorsa kullanıcı ile gateway arasındadır. Her testte arama alanı yarıya iner.

İki yardımcı alışkanlık:

- **Çalışanla karşılaştır:** Yan masadaki sağlam bilgisayarın ayarı (adres, gateway, DNS, port, VLAN) arızalıdakiyle yan yana konur. Fark çoğu zaman cevaptır.
- **"Ne değişti?"** Dün çalışan bir şey bugün çalışmıyorsa bir şey değişmiştir. Kaydedilmemiş bir değişiklik `show running-config` ile `show startup-config` farkında görünür (Konu #11).

*(Etkileşimli şema: altı adımlık döngü; 6. adımdan "düzelmedi" okuyla 3. adıma dönüş.)*

## 3. Çıktı okuma

Bu konunun çıktısı tek bir komut değil, bir **kanıt zinciridir**. Aşağıdaki örnekte PC-12 "ERP açılmıyor" diyor; her satır bir soruyu cevaplıyor.

```
! Soru 1: Kendi ağımda mıyım?            → Katman 3, yerel
PC-12> ping 192.168.10.11
host (192.168.10.11) not reachable

! Soru 2: Bağlantım var mı?               → Katman 1
SW1#show interfaces status
Fa0/2                        connected    20         a-full  a-100 10/100BaseTX

! Soru 3: Doğru VLAN'da mıyım?            → Katman 2
!   Fa0/2 VLAN 20'de; kattaki diğer portlar VLAN 10'da.  ← kök neden
SW1(config)#interface fa0/2
SW1(config-if)#switchport access vlan 10

! Doğrula: ilk belirtiyi aynı testle dene
PC-12> ping 192.168.10.11
84 bytes from 192.168.10.11 icmp_seq=1 ttl=64
PC-12> ping 192.168.100.20
84 bytes from 192.168.100.20 icmp_seq=1 ttl=63
```

Her satırda **cevabı değiştiren** tek bir komut var; hiçbir şey tahminle değiştirilmedi. Kanıt zincirini bir arıza kaydına aynen yazmak, bir sonraki kişinin işini de kolaylaştırır.

Hata mesajlarının dili de kanıttır:

| Mesaj | Söylediği |
| --- | --- |
| `host (x) not reachable` (VPCS) | Hedefin ya da gateway'in MAC'i bulunamadı (ARP yanıtsız): yerel yol sorunu |
| `Destination host unreachable` (router'dan) | Router o hedefe giden yolu bilmiyor |
| `timeout` | Paket gitti ama yanıt gelmedi: hedef, dönüş yolu ya da filtre |
| `Connection refused` | Hedef ayakta ama o portta servis yok (uygulama) |
| `Non-existent domain` / `timed out` (nslookup) | DNS sunucusu yanıt verdi ama kayıt yok / hiç yanıt yok |

## 4. Yönlendirmeli lab

Topoloji: SW1'de PC-11 (Fa0/1) ve PC-12 (Fa0/2), VLAN 10, gateway R1 (192.168.10.1). Sunucu odasında DNS sunucusu SRV (.10) ve ERP (.20, web servisi). Bu lab'da arıza yok; amaç sağlam bir ağın **referans kanıtlarını** toplamak. Arıza anında karşılaştıracağın şey bunlardır.

1. **Tanım kartı.** Bir kâğıda dört başlık aç: kim, ne, ne zamandan beri, ne değişti. Senaryolarda her seferinde önce bunu doldur.
2. **Katman 1.** SW1'de `show interfaces status`: PC'lerin portları connected. Hangi portun hangi VLAN'da olduğunu yaz.
3. **Katman 2.** `show vlan brief`; PC-11'de `ping 192.168.10.12`, sonra `show arp`. *Neden:* Aynı ağdaki komşuya ulaşmak katman 1–2'nin sağlam olduğunu gösterir.
4. **Katman 3.** PC-11'de `show ip` (adres, maske, gateway, DNS), `ping 192.168.10.1`, `ping 192.168.100.20`, `trace 192.168.100.20`.
5. **Servisler.** `nslookup ERP`.
6. **Uygulama.** `curl http://ERP`: sayfa geliyor.
7. **Yolu ikiye böl.** Gateway'e ping'in, kullanıcı ile sunucu arasındaki yolu nasıl ikiye ayırdığını kendi cümlenle yaz.
8. **Değişiklikten önce.** SW1'de `show running-config` ve `show startup-config`: ikisi aynı mı? *Neden:* "Ne değişti?" sorusunun cevabı arıza anında bu karşılaştırmadan çıkar. Değişiklik yapmadan önce bu çıktıyı saklamak yedek almaktır.

**Lab'ın otomatik değerlendirmesi:** `q.ping('PC-12', '192.168.100.20').ok`; `q.http('PC-11', '192.168.100.20').ok`; `q.saved('SW1')`.

## 5. Sık hatalar

Bu konunun hataları ağın değil, sorun gidericinin hatalarıdır.

| Kod | Hata | Belirti | Kanıt | Doğrusu |
| --- | --- | --- | --- | --- |
| E1 | Tanımlamadan başlamak | Saatlerce yanlış yerde arama | Etki alanı hiç sorulmamış | Önce kim, ne, ne zamandan beri, ne değişti |
| E2 | Yanlış yönden başlamak | Uygulama arızasında kablo, tek kullanıcı arızasında sunucu kurcalanıyor | Ping çalışırken kablo değiştirilmiş | Etki alanına ve belirtiye göre aşağıdan, yukarıdan ya da ortadan başla |
| E3 | Kanıtsız ve toplu değişiklik | Sorun geçti ama nedeni bilinmiyor; ya da yeni sorun çıktı | Aynı anda birkaç ayar değiştirilmiş, yedek yok | Kanıtın gösterdiği tek şeyi değiştir; önce yedek |
| E4 | "Ne değişti?" sorusunu atlamak | Dün çalışan şey için sıfırdan teşhis | running ve startup farkına bakılmamış | Önce değişiklikleri bul, gerekirse geri al |
| E5 | İlk hatada durmak | "Düzelttim" denmiş ama kullanıcı hâlâ şikâyetçi | Düzeltmeden sonra ilk belirti yeniden test edilmemiş | Her düzeltmeden sonra aynı testi tekrarla; kalan belirti başka bir hatadır |

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `method-one-pc-bottom-up`, `method-app-top-down`,
> `method-divide-at-gateway`, `method-what-changed`, `method-two-layers` kimlikleriyle
> Labber'da çalışır. Her senaryo bir yaklaşımı öne çıkarır; hataların kendisi önceki konulardan
> tanıdıktır.

### S1 · Başlangıç · "İnternet yok" diyen tek kullanıcı (aşağıdan yukarı)

- **Başlangıç:** SW1 Fa0/2 (PC-12) VLAN 20'de.
- **Belirti:** PC-12 "internet yok, ERP açılmıyor" diyor; PC-11'de her şey çalışıyor. Kullanıcı sabah kablolarını düzenlemiş.
- **İpuçları:** (1) Etki alanı tek bilgisayar: aşağıdan başla. (2) Katman 1 sağlam mı, port hangi VLAN'da, gateway'e ulaşılıyor mu? (3) Portu diğer PC'lerin VLAN'ına al.
- **Çözüm:** SW1 → `interface fa0/2` → `switchport access vlan 10`
- **Hedefler:** `q.ping('PC-12', '192.168.10.1').ok`; `q.ping('PC-12', '192.168.100.20').ok`

### S2 · Başlangıç · Ağ sağlam görünüyor, ERP sayfası açılmıyor (yukarıdan aşağı)

- **Başlangıç:** ERP'de web servisi kapalı.
- **Belirti:** Herkes ERP sayfasını açamıyor; ERP'nin adresine ping gidiyor, `nslookup ERP` doğru adresi veriyor.
- **İpuçları:** (1) Ping ve nslookup çalışıyorsa alt katmanlar sağlam; yukarıdan başla. (2) `curl http://ERP`: "Connection refused" mı, "timed out" mı? (3) Reddediliyorsa servis dinlemiyor: ERP'de `show services`.
- **Çözüm:** ERP → `service http on`
- **Hedefler:** `q.http('PC-11', '192.168.100.20').ok`; `q.http('PC-12', '192.168.100.20').ok`

### S3 · Orta · Kimse sunuculara ulaşamıyor (böl ve yönet)

- **Başlangıç:** R1 Gi0/1 (sunucu ağı) `shutdown`.
- **Belirti:** Hiçbir kullanıcı ERP'ye ve sunucu odasına ulaşamıyor; kullanıcılar birbirine ulaşıyor.
- **İpuçları:** (1) Yolu ikiye böl: gateway'e ping at. (2) Gateway yanıt veriyorsa R1'de `show ip interface brief`. (3) Kapalı arayüzü aç.
- **Çözüm:** R1 → `interface g0/1` → `no shutdown`
- **Hedefler:** `q.ping('PC-11', '192.168.100.20').ok`; `q.ping('PC-12', '192.168.100.10').ok`

### S4 · Orta · Gece bakımından sonra bütün kat kopuk ("ne değişti?")

- **Başlangıç:** SW1 Gi0/1 (R1'e giden) **kaydedilmeden** VLAN 20'ye alınmış.
- **Belirti:** Bakımı yapan izinde; sabah kattaki hiçbir bilgisayar gateway'e ulaşamıyor. Değişiklikler kaydedilmemiş.
- **İpuçları:** (1) Kaydedilmemiş değişiklik varsa running ve startup farklıdır. (2) İkisini karşılaştır: hangi port? (3) Portu düzelt ya da `reload` ile "Save?" sorusuna `no` deyip kaydedilmiş hâle dön.
- **Çözüm:** SW1 → `reload` → `no` → onay (ya da Gi0/1'i `switchport access vlan 10` yapıp kaydetmek)
- **Hedefler:** `q.ping('PC-11', '192.168.100.20').ok`; `q.saved('SW1')`; güç döngüsünden sonra da

### S5 · İleri · Bir hatayı bulunca durma (iki katman)

- **Başlangıç:** SW1 Fa0/2 VLAN 20'de ve PC-12'nin gateway'i 192.168.10.254.
- **Belirti:** Teknisyen VLAN'ı düzeltip "tamam" demiş; PC-12 PC-11'e ulaşıyor ama hâlâ ERP'ye ulaşamıyor.
- **İpuçları:** (1) Her düzeltmeden sonra belirtiyi yeniden test et. (2) Katman 2 tamamsa bir üst katmana geç: `show ip`. (3) Gateway'i diğer PC'lerinkiyle aynı yap.
- **Çözüm:** SW1 → `interface fa0/2` → `switchport access vlan 10`; PC-12 → `ip 192.168.10.12 255.255.255.0 192.168.10.1`
- **Hedefler:** `q.ping('PC-12', '192.168.10.11').ok`; `q.ping('PC-12', '192.168.100.20').ok`

## 7. Kısa sınav

1. "İnternet yok" şikâyetinde ilk yapılacak iş hangisi?
   - A) Switch'i yeniden başlatmak
   - B) Kim etkileniyor, ne çalışmıyor, ne zamandan beri, ne değişti sorularını sormak
   - C) Kabloyu değiştirmek
   - D) DNS'i değiştirmek

   **Cevap: B.** Etki alanı ve değişiklik bilgisi nereye bakılacağını söyler.
2. Ping ve nslookup çalışıyor, yalnız bir web uygulaması açılmıyor. Hangi yaklaşım zaman kazandırır?
   - A) Aşağıdan yukarı
   - B) Yukarıdan aşağı
   - C) Bütün kabloları kontrol etmek
   - D) Router'ı yeniden başlatmak

   **Cevap: B.** Alt katmanların sağlam olduğu zaten kanıtlanmış.
3. Kullanıcı gateway'e ping atabiliyor ama sunucuya atamıyor. Bu test ne söyler?
   - A) Sorun kullanıcı ile gateway arasında
   - B) Sorun gateway ve ötesinde
   - C) DNS bozuk
   - D) Kablo bozuk

   **Cevap: B.** Böl ve yönet: yol ikiye bölündü.
4. Bir değişiklikten önce neden yedek alınır?
   - A) Hız için
   - B) Değişiklik işe yaramaz ya da yeni sorun çıkarırsa geri dönebilmek için
   - C) Lisans gereği
   - D) Cihaz bunu ister

   **Cevap: B.** Geri dönüş yolu olmayan değişiklik riski büyütür.
5. Bir hatayı düzelttin, `show` çıktısı doğru görünüyor. Sonraki adım?
   - A) Kaydı kapatmak
   - B) İlk belirtiyi aynı testle yeniden denemek
   - C) Başka bir ayarı da değiştirmek
   - D) Cihazı yeniden başlatmak

   **Cevap: B.** Kalan belirti başka bir hata olabilir.

## 8. Doğrulama notları

Kaynaklar: Cisco sorun giderme yöntemleri (aşağıdan yukarı, yukarıdan aşağı, böl ve yönet, yolu izle, karşılaştır; CCNA ve ENARSI sorun giderme bölümleri), CCNA 200-301 sınav konusu "sorun giderme" (bütün alanlara yayılmış). Eski "Ağ teşhis komutları" ve "İleri sorun giderme ve ağ tasarımı" derslerinin yöntem kısımları kaynak oldu; araç ayrıntıları `commands` dersinde kaldı.

**Kontrol edilen iddialar**

| İddia | Sonuç |
| --- | --- |
| Yaygın yaklaşımlar: aşağıdan yukarı, yukarıdan aşağı, böl ve yönet, yolu izle, karşılaştır | Doğru (Cisco sorun giderme modeli) |
| "Connection refused": hedef ayakta, portta dinleyen servis yok (TCP RST) | Doğru |
| Router'dan "Destination host unreachable": router o hedef için rota bilmiyor (ICMP tip 3) | Doğru |
| Kaydedilmemiş değişiklik running-config ile startup-config farkında görünür | Doğru |

**Motor gereksinimleri** (Labber'da denendi)

- [x] Önceki konuların bütün komutları; VPCS `curl` (Connection refused) ve sunucuda `service http on|off` — L5-g
- [x] Kaydedilmemiş başlangıç değişikliği (`pending`) ve güç döngüsünden sonra doğrulama (`survivesReload`) — Konu #11 altyapısı
- [x] Senaryo sorgu listesine `http` eklendi (`simulator/network-scenarios.js` `SHARED_QUERY_FNS`)
- [x] Beş senaryo başta başarısız, terminalden çözümle başarılı
- [ ] Değerlendirmenin "doğru kök neden" ve "gereksiz değişiklik yok" ölçütleri henüz otomatik değil; bugün yalnız bağlantı ve kayıt durumu ölçülüyor. Gereksiz değişiklik, başlangıç ile bitiş yapılandırması arasındaki farkın çözümün farkıyla karşılaştırılmasıyla ölçülebilir (motor/arayüz işi).
