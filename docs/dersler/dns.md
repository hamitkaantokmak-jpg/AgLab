# AğLab Konu #10: DNS

> Uygulamadaki `dns` dersi bu belgeye göre yeniden yazıldı. Senaryolar Sorun Çöz'de `dns-*`
> kimlikleriyle Labber'da çalışır. Pratik türü: Motor + okuma (kayıt türleri ve önbellek okuma).

Bu konu bittiğinde öğrenci "internet yok" şikâyetini iki soruya ayırır: adresle ulaşılabiliyor mu, adla ulaşılabiliyor mu? `nslookup` çıktısından sorunun DNS sunucusuna ulaşamamak mı, sunucunun yanıt vermemesi mi, yoksa kaydın olmaması mı olduğunu okur. İstemcinin DNS ayarının nereden geldiğini (elle ya da DHCP) bulur ve düzeltir. Seviye 1, süre yaklaşık 55 dakika (ders 12, lab 15, senaryolar 20, sınav 8).

## 1. Neden önemli

Kullanıcı "ERP açılmıyor" ya da "internet yok" dediğinde çoğu zaman ağ çalışıyordur; çalışmayan şey isimden adrese çeviridir. DNS bozulduğunda her şey bozulmuş gibi görünür, çünkü kullanıcı hiçbir sisteme adresle değil adla girer.

Bu yüzden ilk iş iki testi ayırmaktır. Adresle ping gidiyor ama adla açılmıyorsa sorun DNS'tedir; kabloyu, switch'i, gateway'i kurcalamaya gerek yoktur. Adresle de gitmiyorsa sorun DNS'ten öncedir.

## 2. Kavram

**DNS**, `erp.sube.local` gibi bir adı `192.168.100.20` gibi bir adrese çevirir. İstemci, ayarındaki **DNS sunucusuna** sorar. Sorgu çoğunlukla **UDP 53** ile gider; büyük yanıtlarda ve sunucular arası bölge aktarımında TCP 53 kullanılır.

İstemcinin DNS sunucusu iki yerden gelir:

- **DHCP'den:** Havuzdaki `dns-server` satırı (Konu #9). Yanlışsa bütün bir ağ etkilenir.
- **Elle:** Bilgisayara tek tek yazılır. Yanlışsa yalnız o bilgisayar etkilenir.

DNS sunucusu genellikle kullanıcılarla **aynı ağda değildir**; sunucu odasındadır. Bu yüzden sorgunun oraya gidebilmesi için istemcinin **gateway'i** de doğru olmalıdır. Gateway'i olmayan bir bilgisayar doğru DNS adresi yazılı olsa bile isim çözemez.

**Kayıt türleri** (okuma):

| Tür | Ne döndürür | Örnek |
| --- | --- | --- |
| A | IPv4 adresi | `erp → 192.168.100.20` |
| AAAA | IPv6 adresi | `erp → 2001:db8::20` |
| CNAME | Başka bir ad (takma ad) | `muhasebe → erp` |
| MX | E-posta sunucusu | `sube.local → posta.sube.local` |
| PTR | Adresten ad (ters sorgu) | `192.168.100.20 → erp` |

**Önbellek ve TTL:** Her yanıt, ne kadar süre saklanabileceğini söyleyen bir TTL ile gelir. İstemci yanıtı bu süre boyunca önbellekte tutar ve tekrar sormaz. Sunucudaki bir kaydı düzeltmek, istemcilerin önbelleğini hemen değiştirmez. Windows'ta önbelleği `ipconfig /displaydns` gösterir, `ipconfig /flushdns` boşaltır.

*(Etkileşimli şema: PC-11 → R1 → sunucu odasındaki SRV'ye UDP 53 sorgusu, yanıt geri.)*

## 3. Çıktı okuma

Bu konunun ana aracı `nslookup`'tır. Üç farklı sonucu birbirinden ayırmayı öğrenmek, DNS teşhisinin neredeyse tamamıdır.

### Başarılı yanıt

```
PC-11> nslookup ERP
Server:  UnKnown
Address:  192.168.100.10

Name:    ERP
Address:  192.168.100.20
```

- **Server / Address (üst kısım):** Sorulan DNS sunucusu. Beklediğin sunucu değilse istemcinin ayarı yanlıştır.
- **Server: UnKnown** bir arıza değildir. nslookup, DNS sunucusunun kendi adını da ters sorguyla (PTR) bulmaya çalışır; o kayıt yoksa "UnKnown" yazar. Yanıtın geri kalanı doğrudur.
- **Name / Address (alt kısım):** Asıl cevap.

### Kayıt yok: Non-existent domain

```
PC-11> nslookup ERPP
Server:  UnKnown
Address:  192.168.100.10

*** UnKnown can't find ERPP: Non-existent domain
```

Sunucu **yanıt verdi**: "böyle bir ad yok" (NXDOMAIN). Ağ sağlam, sunucu çalışıyor; sorun adın kendisinde: yazım hatası, kayıt eksik ya da yanlış alan adı.

### Yanıt yok: timed out

```
PC-12> nslookup ERP
DNS request timed out.
    timeout was 2 seconds.
*** Request to UnKnown timed-out
```

Sunucudan **hiç yanıt gelmedi.** Üç olasılık var:

1. Sorgu sunucuya ulaşmıyor: yanlış DNS adresi, gateway yok, yol kopuk.
2. Sunucu ayakta ama DNS servisi çalışmıyor.
3. Arada bir filtre UDP 53'ü engelliyor (Konu #19 ACL).

Ayırmak için DNS sunucusunun adresine **ping** at. Ping gitmiyorsa 1. maddeye, gidiyorsa 2. ya da 3. maddeye bak.

### İstemcinin ayarı

```
PC-11> show ip
IP/MASK     : 192.168.10.21/24
GATEWAY     : 192.168.10.1
DNS         : 192.168.100.10
```

Windows'ta `ipconfig /all` içinde "DNS Servers" satırı. Etkilenen bilgisayarın DNS satırını sağlam bir bilgisayarınkiyle karşılaştırmak, en hızlı teşhis yöntemidir.

## 4. Yönlendirmeli lab

Topoloji Konu #9'un bitmiş ağıdır: R1, iki kat, sunucu odasında DHCP ve DNS sunucusu SRV (192.168.100.10) ve ERP sunucusu (192.168.100.20). AğLab'ın DNS sunucusu, ağdaki her cihazı kendi adıyla tanır.

1. **Ayarı oku.** PC-11'de `show ip`: DNS 192.168.100.10. *Neden:* PC-11 bu adresi DHCP'den aldı; havuzda `dns-server` böyle yazılı.
2. **Başarılı sorgu.** `nslookup ERP`: 192.168.100.20. Sonra `ping 192.168.100.20`. *Neden:* Ad çözüldü ve adres erişilebilir; iki katman ayrı ayrı sağlam.
3. **Olmayan ad.** `nslookup ERPP`: "Non-existent domain". *Neden:* Sunucu yanıt verdi ama kayıt yok; sorun ağda değil, adda.
4. **Sunucunun kayıtları.** SRV'de `show dns`: sunucunun bildiği adlar ve adresler.
5. **Servisi durdur.** SRV'de `service dns off`. PC-11'de `nslookup ERP`: "timed out". Sonra `ping 192.168.100.10`: başarılı. *Neden:* Sunucu ayakta, yalnız servis yanıt vermiyor. "Ping gidiyor" demek "DNS çalışıyor" demek değildir. Servisi `service dns on` ile geri aç.
6. **DNS ayarını sil.** PC-11'de `ip dns 0.0.0.0`, sonra `nslookup ERP`: "Default servers are not available". Doğru adresi `ip dns 192.168.100.10` ile geri yaz. *Neden:* Bu üçüncü hata türü: istemcinin sorabileceği bir sunucu yok.
7. **Sonuçları tabloya yaz.** Üç çıktıyı (yanıt, NXDOMAIN, timed out) ve her birinin olası nedenini bir kenara not et; senaryolarda bu tabloyu kullanacaksın.

**Lab'ın otomatik değerlendirmesi:** `q.dnsLookup('PC-11', 'erp').ok`; `q.ping('PC-11', '192.168.100.20').ok`.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | İstemcide yanlış DNS sunucusu (elle) | Yalnız bir bilgisayar adla hiçbir yere giremiyor, adresle giriyor | `show ip` / `ipconfig /all`'da DNS farklı; nslookup timed out | Doğru DNS'i yaz ya da istemciyi DHCP'ye bırak |
| E2 | DHCP havuzunda yanlış DNS | Bütün bir ağ adla giremiyor; başka ağlar sorunsuz | O ağdaki her istemcide aynı yanlış DNS satırı | Havuzda `dns-server`'ı düzelt, istemcilerde yenile |
| E3 | DNS servisi durmuş | Her yerde isim çözülmüyor; sunucuya ping gidiyor | nslookup timed out, sunucuya ping başarılı | Servisi başlat |
| E4 | Sorgu sunucuya ulaşmıyor (gateway yok, yol kopuk, UDP 53 engelli) | DNS adresi doğru yazılı ama isim çözülmüyor | nslookup timed out; DNS sunucusuna ping yok; gateway boş ya da yanlış | Önce IP bağlantısını düzelt (Konu #8, #19) |
| E5 | Kayıt yok ya da eski | Tek bir ad çözülmüyor ya da eski adrese gidiyor | nslookup Non-existent domain; ya da yanıt eski adres (önbellek, TTL) | Kaydı ekle/düzelt; istemcide `ipconfig /flushdns` |

E1 ile E2'yi ayıran şey etki alanıdır: tek bilgisayar mı, bütün ağ mı? E3 ile E4'ü ayıran şey DNS sunucusuna ping'dir. E5, sunucunun yanıt vermesiyle diğerlerinden ayrılır.

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `dns-wrong-server-pc`, `dns-pool-wrong-server`,
> `dns-service-down`, `dns-no-gateway`, `dns-two-faults` kimlikleriyle Labber'da çalışır.
> Hedefler `dnsLookup` ile yazıldı: istemci `erp` adını kendi DNS sunucusuna sorup yanıt
> almalı. (Ad küçük harfle yazılır; DNS büyük/küçük harf ayırmaz, uygulama ise büyük harfli
> cihaz adlarını cihaz kimliğine çevirir.)

### S1 · Başlangıç · Yalnız benim bilgisayarım ERP'yi adıyla açamıyor (E1)

- **Başlangıç:** PC-11'e elle DNS 192.168.100.11 yazılmış.
- **Belirti:** PC-11'in kullanıcısı ERP'ye adıyla giremiyor, adresle giriyor; yan masada sorun yok.
- **İpuçları:** (1) Adresle gidiyor, adla gitmiyor: isim çözümleme bozuk. (2) Ayarı sağlam bir bilgisayarla karşılaştır: `show ip`, DNS satırı. (3) nslookup hangi sunucuyu soruyor? Doğrusunu `ip dns` ile yaz.
- **Çözüm:** PC-11 → `ip dns 192.168.100.10`
- **Hedefler:** `q.dnsLookup('PC-11', 'erp').ok`; `q.ping('PC-11', '192.168.100.20').ok`

### S2 · Başlangıç · 1. katta hiçbir isim çözülmüyor (E2)

- **Başlangıç:** KAT1 havuzunda `dns-server 192.168.100.11`.
- **Belirti:** 1. katta hiçbir sistem adıyla açılmıyor; adresle çalışıyor. 2. kat sorunsuz.
- **İpuçları:** (1) Bütün kat aynı ayarı DHCP'den alıyor; ortak kaynağa bak. (2) 1. ve 2. kattan birer PC'nin DNS satırını karşılaştır. (3) Havuzu düzelt, istemcide `ip dhcp`.
- **Çözüm:** R1 → `ip dhcp pool KAT1` → `dns-server 192.168.100.10`; PC-11 → `ip dhcp`
- **Hedefler:** `q.dhcpLease('PC-11').server === 'R1'`; `q.dnsLookup('PC-11', 'erp').ok`

### S3 · Orta · Sabahtan beri hiçbir yerde isim çözülmüyor (E3)

- **Başlangıç:** SRV'de DNS servisi kapalı.
- **Belirti:** İki katta da isimler çözülmüyor; adresle her şey çalışıyor, SRV'ye ping gidiyor.
- **İpuçları:** (1) Sunucuya ping gidiyorsa sunucu ayakta; ya servis? (2) nslookup "Non-existent domain" mi diyor, timed out mu? (3) SRV'de `show services`.
- **Çözüm:** SRV → `service dns on`
- **Hedefler:** `q.dnsLookup('PC-21', 'erp').ok`; `q.dnsLookup('PC-11', 'erp').ok`

### S4 · Orta · Yeni bilgisayarda DNS doğru ama isim çözülmüyor (E4)

- **Başlangıç:** PC-12'ye elle 192.168.10.12/24 ve DNS 192.168.100.10 yazılmış, gateway boş.
- **Belirti:** Yeni PC yan masadaki PC-11'e ulaşıyor ama hiçbir sistem adıyla açılmıyor. Kuran kişi "DNS'i doğru yazdım" diyor.
- **İpuçları:** (1) DNS sunucusu hangi ağda? Sorgu oraya gidebiliyor mu? (2) nslookup timed out mu? DNS sunucusuna ping at. (3) `show ip`: GATEWAY.
- **Çözüm:** PC-12 → `ip 192.168.10.12 255.255.255.0 192.168.10.1`
- **Hedefler:** `q.dnsLookup('PC-12', 'erp').ok`; `q.ping('PC-12', '192.168.100.20').ok`

### S5 · İleri · Hiçbir yerde isim yok, düzeltince yalnız 2. kat geldi (E3 + E2)

- **Başlangıç:** S3 ve S2 birlikte.
- **Belirti:** İki katta da isimler çözülmüyor. Gece hem SRV güncellendi hem havuz düzenlendi.
- **İpuçları:** (1) Önce iki katın ortak kaynağına bak. (2) Servis açılınca hâlâ çözemeyen kat kaldı mı? (3) O katın DNS ayarını nereden aldığını düşün.
- **Çözüm:** SRV → `service dns on`; R1 → havuzda `dns-server 192.168.100.10`; PC-11 → `ip dhcp`
- **Hedefler:** `q.dnsLookup('PC-21', 'erp').ok`; `q.dnsLookup('PC-11', 'erp').ok`; `q.dhcpLease('PC-11').server === 'R1'`

## 7. Kısa sınav

1. `ping 192.168.100.20` başarılı, `nslookup ERP` "timed out". Sorun hangi katmanda?
   - A) Kablo
   - B) İsim çözümleme: DNS sunucusuna ulaşılamıyor ya da servis yanıt vermiyor
   - C) Gateway
   - D) ERP sunucusu kapalı

   **Cevap: B.** Adresle erişim var; DNS yolu ayrıca incelenir.
2. `nslookup` "Non-existent domain" diyor. Bu ne anlama gelir?
   - A) DNS sunucusuna ulaşılamıyor
   - B) Sunucu yanıt verdi ama bu ad için kayıt yok
   - C) Gateway yanlış
   - D) DNS servisi kapalı

   **Cevap: B.** Ağ ve sunucu sağlam; ad yanlış ya da kayıt eksik.
3. nslookup çıktısında "Server: UnKnown" yazıyor ama ad doğru çözülüyor. Ne yapmalı?
   - A) DNS sunucusunu değiştirmek
   - B) Hiçbir şey; sunucunun kendi adresi için ters (PTR) kaydı yok
   - C) Önbelleği temizlemek
   - D) Gateway'i düzeltmek

   **Cevap: B.** Bu bir arıza değildir.
4. Yalnız 1. kattaki bilgisayarlar isim çözemiyor; hepsinin DNS satırı 192.168.100.11. Nereye bakılır?
   - A) Her bilgisayara tek tek
   - B) 1. katın DHCP havuzundaki `dns-server` satırına
   - C) DNS sunucusunun kayıtlarına
   - D) Switch'e

   **Cevap: B.** Bütün bir ağ aynı yanlış ayarı taşıyorsa kaynak DHCP'dir.
5. DNS kaydı düzeltildi ama bir bilgisayar hâlâ eski adrese gidiyor. Neden?
   - A) Kayıt kaydedilmedi
   - B) İstemci eski yanıtı TTL süresince önbellekte tutuyor
   - C) Gateway yanlış
   - D) DNS UDP kullandığı için

   **Cevap: B.** `ipconfig /flushdns` önbelleği boşaltır.

## 8. Doğrulama notları

Kaynaklar: RFC 1034/1035 (DNS kavramları ve kayıt türleri), Microsoft nslookup belgeleri; CCNA 200-301 sınav konuları (4.3 DNS'in işlevi). Eski `dns` dersi Kavram ve kayıt türleri için kaynak oldu; metin yeniden yazıldı. Recursive/authoritative ayrımı Seviye 1'den çıkarıldı (CCNA'da #23'te anılabilir).

**Kontrol edilen iddialar**

| İddia | Sonuç |
| --- | --- |
| DNS sorguları çoğunlukla UDP 53; büyük yanıt ve bölge aktarımı TCP 53 | Doğru |
| A IPv4, AAAA IPv6, CNAME takma ad, MX posta, PTR ters sorgu | Doğru |
| "Server: UnKnown", nslookup'ın DNS sunucusunun kendi adresini ters sorguyla bulamamasıdır | Doğru (DNS sunucusu için PTR kaydı yok) |
| Yanıtlar TTL süresince önbellekte tutulur; `ipconfig /flushdns` Windows önbelleğini boşaltır | Doğru |
| "Non-existent domain" sunucunun NXDOMAIN yanıtıdır; "timed out" yanıt gelmediğidir | Doğru |

**Motor gereksinimleri** (Labber'da denendi)

- [x] VPCS `nslookup` (yanıt, Non-existent domain, timed out, "Default servers are not available")
- [x] VPCS `ip dns <adres>`, DHCP ile DNS dağıtımı — L5-b
- [x] Sunucuda `service dns on|off`, `show services`, `show dns`
- [x] Beş senaryo başta başarısız, terminalden çözümle başarılı
- [ ] VPCS'te adla `ping ERP` "Cannot resolve" diyor; gerçek VPCS DNS sunucusu tanımlıysa adı çözer. Lab bu yüzden ad ile ping kullanmıyor.
- [ ] DNS kayıtları yalnız cihaz adlarından oluşuyor; elle A/CNAME kaydı, alan adı (`erp.sube.local`), PTR ve TTL/önbellek yok (okuma)
- [ ] Senaryo hedeflerinde büyük harfli bir ad cihaz kimliğine çevriliyor; `dnsLookup` için ad küçük harfle yazıldı (uygulamadaki `sharedQueryCheck`)
