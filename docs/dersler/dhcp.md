# AğLab Konu #9: DHCP

> Uygulamadaki `dhcp` dersi bu belgeye göre yeniden yazıldı. Senaryolar Sorun Çöz'de `dhcp-*`
> kimlikleriyle Labber'da çalışır.

Bu konu bittiğinde öğrenci bir Cisco router'da DHCP havuzu kurar, başka ağdaki sunucuya relay (`ip helper-address`) ile istek taşır ve "169.254 aldı" şikâyetini adım adım teşhis eder: sunucuya ulaşılamıyor mu, havuz yanlış mı, havuz dolu mu? Seviye 1, süre yaklaşık 70 dakika (ders 15, lab 25, senaryolar 20, sınav 10).

## 1. Neden önemli

Şubede kimse bilgisayarlara tek tek IP yazmaz; adresi DHCP verir. Bu yüzden DHCP bozulduğunda belirti genelde "internet yok" diye gelir, oysa bilgisayarın elinde kullanılabilir bir adres bile yoktur. Ekranda 169.254 ile başlayan bir adres görürsün.

İkinci yaygın durum daha sinsidir: bilgisayar adres alır, kendi ağında herkese ulaşır, ama dışarı çıkamaz. Adres doğrudur, yanlış olan DHCP'nin adresle birlikte verdiği gateway'dir. DHCP yalnız adres değil, cihazın bütün ağ ayarını dağıtır.

## 2. Kavram

**DHCP**, istemciye IP adresi, maske, varsayılan ağ geçidi (gateway) ve DNS sunucusunu otomatik verir. Bu bilgiler bir süreliğine kiralanır (**lease**). Cisco router'da süre belirtilmezse kira 1 gündür. İstemci UDP 68'den, sunucu UDP 67'den konuşur.

**DORA:** Adres dört mesajla alınır:

1. **Discover:** İstemci "DHCP sunucusu var mı?" diye **yayın** (broadcast) gönderir; henüz adresi yoktur.
2. **Offer:** Sunucu bir adres teklif eder.
3. **Request:** İstemci teklifi ister.
4. **Ack:** Sunucu onaylar; adres artık istemcinindir.

**Havuz (pool):** Router'da hangi ağa hangi adreslerin dağıtılacağını tanımlar:

```
ip dhcp excluded-address 192.168.10.1 192.168.10.20
ip dhcp pool KAT1
 network 192.168.10.0 255.255.255.0
 default-router 192.168.10.1
 dns-server 192.168.100.10
```

`excluded-address` havuzun dağıtmayacağı adreslerdir: gateway, yazıcılar, sunucular. Havuz bu adresleri atlar. Dışlama yapılmazsa DHCP, elle verilmiş bir adresi başka bir bilgisayara da verip çakışma yaratabilir.

**Relay:** DHCP isteği bir yayındır ve router yayınları başka ağa geçirmez. DHCP sunucusu başka bir ağdaysa, istemcinin ağına bakan router arayüzüne **`ip helper-address <sunucu>`** yazılır. Router yayını yakalar ve sunucuya tek hedefli (unicast) paket olarak iletir. Pakete isteğin geldiği arayüzün adresini (**giaddr**) koyar; sunucu bu adrese bakarak hangi ağın havuzundan adres vereceğine karar verir.

*(Etkileşimli şema: 1. kat R1'in kendi havuzundan, 2. kat relay üzerinden sunucu odasındaki SRV'den adres alıyor.)*

**169.254.x.x (APIPA):** DHCP'den yanıt alamayan istemci kendine 169.254.0.0/16 aralığından bir adres verir. Bu adresle yalnız aynı kablodaki başka 169.254'lü cihazlarla konuşulabilir. 169.254 bir **belirtidir**, neden değil. Nedeni şunlardan biridir: istek sunucuya ulaşmıyor (kablo, VLAN, relay), sunucu yanıt vermiyor (servis kapalı) ya da sunucunun verecek adresi yok (havuz yanlış ya da dolu).

## 3. Çıktı okuma

### İstemcide: show ip (VPCS) / ipconfig /all (Windows)

```
PC-21> show ip
IP/MASK     : 192.168.20.100/24
GATEWAY     : 192.168.20.1
DNS         : 192.168.100.10
DHCP SERVER : 192.168.100.10
```

- **IP/MASK 169.254.x.x/16** ise DHCP'den yanıt gelmemiştir.
- **GATEWAY:** DHCP'nin verdiği gateway. Adres doğru ama dışarı çıkılamıyorsa ilk bakılacak satır budur.
- **DHCP SERVER:** Adresi veren sunucu. Relay'le gelen istemcide burada uzaktaki sunucu görünür.
- Windows'ta `ipconfig /all`: "DHCP Enabled", "DHCP Server" ve "Lease Obtained/Expires" satırları aynı bilgiyi verir. `ipconfig /renew` yeniden ister.

### Router'da: show ip dhcp binding

```
R1#show ip dhcp binding
Bindings from all pools not associated with VRF:
IP address          Client-ID/              Lease expiration        Type
                    Hardware address/
                    User name
192.168.10.21       0102.0000.0000.06       Mar 02 2026 01:02 AM    Automatic
192.168.10.22       0102.0000.0000.07       Mar 02 2026 01:05 AM    Automatic
```

- Her satır bir kiralamadır: hangi adres, hangi istemciye (Client-ID'de MAC), ne zamana kadar.
- Bir bilgisayar 169.254 alıyor ve burada satırı yoksa istek router'a hiç ulaşmamıştır ya da router verecek adres bulamamıştır.

### Router'da: show ip dhcp pool

```
R1#show ip dhcp pool
Pool KAT1 :
 Total addresses                : 254
 Leased addresses               : 2
 Current index        IP address range                    Leased addresses
 192.168.10.23        192.168.10.1     - 192.168.10.254    2
```

- **Leased addresses:** Kiralanmış adres sayısı.
- **Current index:** Sıradaki verilecek adres. **0.0.0.0** görünüyorsa havuzda verilecek adres kalmamıştır: ya gerçekten dolmuştur ya da dışlama bütün havuzu kapsıyordur.
- Toplam adres sayısına dışlanan adresler de dahildir; dışlamayı kontrol etmek için `show running-config | include excluded`.

## 4. Yönlendirmeli lab

Topoloji: R1'in üç arayüzü var. Gi0/0 1. kata (192.168.10.0/24), Gi0/1 2. kata (192.168.20.0/24), Gi0/2 sunucu odasına (192.168.100.0/24) bakıyor. Sunucu odasında SRV (192.168.100.10) DHCP ve DNS sunucusu. Başlangıçta R1'de havuz ve relay yok; PC'lerin hepsi DHCP istemcisi.

1. **Sunucusuz dene.** PC-11'de `ip dhcp`. Çıktı: `Can't find dhcp server`, adres 169.254.x.x. *Neden:* 1. katta DHCP veren kimse yok; istemci kendine link-local adres verdi.
2. **Dışlamayı yaz.** R1'de `ip dhcp excluded-address 192.168.10.1 192.168.10.20`. *Neden:* Gateway ve ileride yazıcılara verilecek adresler dağıtılmasın. Dışlamayı havuzdan **önce** yazmak, havuz açılır açılmaz birinin bu adresleri almasını önler.
3. **Havuzu kur.** `ip dhcp pool KAT1` → `network 192.168.10.0 255.255.255.0` → `default-router 192.168.10.1` → `dns-server 192.168.100.10`.
4. **Yeniden iste.** PC-11'de `ip dhcp`: `DDORA IP 192.168.10.21/24 GW 192.168.10.1`. *Neden:* "DDORA" dört mesajın gittiğini gösterir; ilk boş adres dışlanan aralıktan sonraki .21'dir.
5. **Kiralamayı gör.** R1'de `show ip dhcp binding` ve `show ip dhcp pool`. PC-11'in adresi ve MAC'i listede; havuzda 1 kiralama var.
6. **2. kattan dene.** PC-21'de `ip dhcp`: yine 169.254. *Neden:* SRV başka ağda; PC-21'in yayını R1'de duruyor.
7. **Relay ekle.** R1'de `interface g0/1` → `ip helper-address 192.168.100.10`. PC-21'de tekrar `ip dhcp`: adres 192.168.20.x, gateway 192.168.20.1. `show ip`'te **DHCP SERVER 192.168.100.10**. *Neden:* Relay isteği giaddr 192.168.20.1 ile sunucuya taşıdı; sunucu 192.168.20.0/24 için adres verdi.
8. **Uçtan uca kontrol.** PC-21'den `ping 192.168.10.21` ve `nslookup SRV`. İkisi de çalışır: DHCP gateway'i ve DNS sunucusunu da doğru vermiştir.

**Lab'ın otomatik değerlendirmesi** (motordan bağımsız yazım):

- `q.dhcpLease('PC-11').server === 'R1'` ve `q.dhcpLease('PC-21').server === 'SRV'`
- `q.ping('PC-21', '192.168.10.21').ok`
- `q.dnsLookup('PC-21', 'SRV').ok`

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | Relay yok | Sunucunun bulunmadığı ağdaki herkes 169.254 alıyor; sunucunun kendi ağı çalışıyor | İstemci arayüzünde `ip helper-address` yok (`show running-config interface`) | İstemcinin ağına bakan arayüze `ip helper-address <sunucu>` |
| E2 | Relay yanlış adrese | Relay tanımlı ama yine 169.254 | Helper adresine ping yok ya da o adreste DHCP servisi yok | Doğru sunucu adresini yaz, yanlışını `no ip helper-address` ile kaldır |
| E3 | Havuzda yanlış gateway | Adres alınıyor, aynı ağ çalışıyor, dışarı çıkış yok | İstemcide GATEWAY yanlış; havuzda `default-router` yanlış | Havuzda `default-router`'ı düzelt, istemcide yenile |
| E4 | Havuzda adres kalmadı | Eski cihazlar çalışıyor, **yeni** gelen 169.254 alıyor | `show ip dhcp pool`'da Current index 0.0.0.0; dışlama havuzun tamamını kapsıyor ya da havuz gerçekten dolu | Dışlamayı daralt, havuzu büyüt ya da kira süresini kısalt |
| E5 | Dışlama unutulmuş | Ağda aralıklı "IP çakışması" uyarıları | Gateway ya da yazıcı adresi `show ip dhcp binding`'de bir PC'ye verilmiş | Statik adresleri `excluded-address` ile dışla |

E3 ile E1'i ayıran şey 169.254'tür: E1'de istemcinin adresi yoktur, E3'te adresi vardır ama yanlış gateway'i vardır. E4'ün ayırt edici izi, sorunun yalnız **yeni** cihazlarda görülmesidir; eski cihazlar kiraları bitene kadar çalışmaya devam eder.

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `dhcp-no-helper`, `dhcp-wrong-helper`, `dhcp-pool-gateway`,
> `dhcp-excluded-all`, `dhcp-two-faults` kimlikleriyle Labber'da çalışır. Hedefler
> `dhcpLease` (adres hangi sunucudan alındı) ve `ping` ile yazıldı. Düzeltmeden sonra
> istemcide `ip dhcp` ile yeniden istemek gerekir: gerçek bilgisayar da kirası yenilenene ya da
> `ipconfig /renew` yapılana kadar eski ayarla kalır.

Temel topoloji lab'ın bitmiş hâlidir: R1'de KAT1 havuzu (.1–.20 dışlanmış), Gi0/1'de relay, SRV'de DHCP ve DNS.

### S1 · Başlangıç · Yeni açılan 2. kat 169.254 alıyor (E1)

- **Başlangıç:** R1 Gi0/1'de `ip helper-address` yok.
- **Belirti:** 2. kat yeni devreye alındı; oradaki bilgisayarlar 169.254.x.x alıyor. 1. kat sorunsuz.
- **İpuçları:** (1) 169.254 "sunucudan cevap gelmedi" demektir. Sunucu ile istemci aynı ağda mı? (2) Router yayınları geçirmez; isteği kim taşıyacak? (3) R1'de `show running-config interface g0/1`.
- **Çözüm:** R1 → `interface g0/1` → `ip helper-address 192.168.100.10`; PC-21 → `ip dhcp`
- **Hedefler:** `q.dhcpLease('PC-21').server === 'SRV'`; `q.ping('PC-21', '192.168.100.10').ok`

### S2 · Başlangıç · Relay var ama 2. kat yine adres alamıyor (E2)

- **Başlangıç:** Helper adresi 192.168.100.10 yerine 192.168.100.100 yazılmış.
- **Belirti:** 2. kat 169.254 alıyor; yönetici "relay'i dün ekledim" diyor.
- **İpuçları:** (1) Relay tanımlı olması yetmez; istek doğru sunucuya mı gidiyor? (2) Helper adresini oku ve o adrese ping at. (3) Yanlış satırı `no ip helper-address` ile kaldır.
- **Çözüm:** R1 → `interface g0/1` → `no ip helper-address 192.168.100.100` → `ip helper-address 192.168.100.10`; PC-21 → `ip dhcp`
- **Hedefler:** `q.dhcpLease('PC-21').server === 'SRV'`; `q.ping('PC-21', '192.168.100.10').ok`

### S3 · Orta · Adres var, dışarı çıkış yok (E3)

- **Başlangıç:** KAT1 havuzunda `default-router 192.168.10.254`.
- **Belirti:** 1. kat adres alıyor, birbirine ulaşıyor; sunucu odasına ve 2. kata ulaşamıyor.
- **İpuçları:** (1) Adres alınıyorsa DHCP çalışıyor; ama DHCP gateway'i de dağıtır. (2) PC-11'de `show ip`: GATEWAY ne? (3) Havuzu düzelt, sonra istemcide yenile.
- **Çözüm:** R1 → `ip dhcp pool KAT1` → `default-router 192.168.10.1`; PC-11 → `ip dhcp`
- **Hedefler:** `q.dhcpLease('PC-11').server === 'R1'`; `q.ping('PC-11', '192.168.100.10').ok`

### S4 · Orta · Eski bilgisayarlar çalışıyor, yeni gelen adres alamıyor (E4)

- **Başlangıç:** `ip dhcp excluded-address 192.168.10.1 192.168.10.254`: bütün havuz dışlanmış. PC-11'in eski kirası var, yeni PC-12 169.254'te.
- **Belirti:** Yeni bilgisayar 169.254 aldı; eski bilgisayar sorunsuz. Sabah "yazıcılar için birkaç adres ayırdım" denmişti.
- **İpuçları:** (1) Eski bilgisayar çalışıyorsa sunucu ve yol sağlam. (2) `show ip dhcp pool` ve `show running-config | include excluded`. (3) Yalnız gereken aralığı dışla.
- **Çözüm:** R1 → `no ip dhcp excluded-address 192.168.10.1 192.168.10.254` → `ip dhcp excluded-address 192.168.10.1 192.168.10.20`; PC-12 → `ip dhcp`
- **Hedefler:** `q.dhcpLease('PC-12').server === 'R1'`; `q.ping('PC-12', '192.168.100.10').ok`; `q.ping('PC-11', '192.168.100.10').ok`

### S5 · İleri · İki kat, iki farklı belirti (E1 + E3)

- **Başlangıç:** S1 ve S3 birlikte.
- **Belirti:** 2. kat 169.254 alıyor; 1. kat adres alıyor ama sunucu odasına ulaşamıyor.
- **İpuçları:** (1) Biri adres hiç alamıyor, öteki adres alıp dışarı çıkamıyor; tek hata ikisini açıklar mı? (2) 2. kat için relay'e, 1. kat için gateway'e bak. (3) İki kattan da birer PC'de yenile.
- **Çözüm:** S1'in ve S3'ün çözümü; PC-21 ve PC-11'de `ip dhcp`
- **Hedefler:** `q.dhcpLease('PC-21').server === 'SRV'`; `q.ping('PC-21', '192.168.100.10').ok`; `q.ping('PC-11', '192.168.100.10').ok`

### Ek · L6'dan gelen iki senaryo

Eski Sorun Çöz metin senaryosu ve eski "Hazır deneyler" mini lab'ı motor kullanmıyordu; Labber
karşılığı yoktu. Aynı öğretim gerçek topolojiye çevrildi (lab topolojisi S3 ile aynı; R1 havuzunun
`default-router`'ı doğru):

- `dhcp-client-static` · **Bilgisayar 169.254 adresinde kalmış (E1).** PC-11 DHCP istemcisi değil;
  kartında elle yazılmış link-local adres var. Havuz sağlam. Çözüm: PC-11'de `ip dhcp`. Hedef:
  kira R1'den, PC-11 → SRV ping.
- `dhcp-service-down` · **Sunucu ayakta ama 2. kat adres alamıyor (E3).** Relay doğru; SRV'de DHCP
  servisi kapalı. Çözüm: SRV'de `service dhcp on`, PC-21'de `ip dhcp`. Hedef: kira SRV'den
  (relay ile), PC-21 → SRV ping.

## 7. Kısa sınav

1. Bir bilgisayar 169.254.20.8/16 adresine sahip. Bu ne anlama gelir?
   - A) DNS sunucusu yanlış
   - B) DHCP'den yanıt alınamadı
   - C) Gateway yanlış
   - D) IP çakışması var

   **Cevap: B.** 169.254 yanıt alamayan istemcinin kendine verdiği adrestir; neden ayrıca aranır.
2. Sunucu 192.168.100.10, istemciler 192.168.20.0/24'te. `ip helper-address` nereye yazılır?
   - A) R1'in sunucuya bakan arayüzüne
   - B) R1'in 192.168.20.0/24'e bakan arayüzüne
   - C) Sunucuya
   - D) Switch'in trunk portuna

   **Cevap: B.** Relay, yayının geldiği arayüzde, yani istemcinin ağına bakan arayüzde yapılır.
3. PC'ler adres alıyor ve birbirine ulaşıyor, dışarı çıkamıyor. `show ip`'te GATEWAY 192.168.10.254. Sorun nerede?
   - A) Relay eksik
   - B) Havuzun `default-router` satırı
   - C) DNS sunucusu
   - D) Kablo

   **Cevap: B.** DHCP adresle birlikte gateway'i de dağıtır.
4. `show ip dhcp pool`'da Current index `0.0.0.0` görünüyor ve yeni cihazlar 169.254 alıyor. En olası neden?
   - A) Relay yanlış
   - B) Havuzda verilecek adres kalmamış
   - C) Sunucu kapalı
   - D) DNS yanlış

   **Cevap: B.** Havuz dolmuş ya da dışlama bütün aralığı kapsıyor.
5. DORA'da istemcinin ilk mesajı neden yayındır?
   - A) Hız için
   - B) İstemcinin henüz adresi yok ve sunucunun adresini bilmiyor
   - C) Güvenlik için
   - D) Switch'ler yalnız yayını iletir

   **Cevap: B.** Bu yüzden ilk mesaj router'dan geçmez ve relay gerekir.

## 8. Doğrulama notları

Kaynaklar: Cisco IOS DHCP Server ve DHCP Relay Agent yapılandırma kılavuzları; CCNA 200-301 sınav konuları (4.3 DHCP istemci/relay, 4.6 DHCP). Eski `dhcp` dersi Kavram parçasına kaynak oldu; metin yeniden yazıldı.

**Kontrol edilen iddialar**

| İddia | Sonuç |
| --- | --- |
| DORA sırası Discover, Offer, Request, Ack; ilk mesaj yayın | Doğru |
| Sunucu UDP 67, istemci UDP 68 | Doğru |
| IOS havuzunda `lease` belirtilmezse kira 1 gün | Doğru (Cisco IOS komut başvurusu: "Command Default 1 day") |
| Relay, isteği unicast olarak iletir ve giaddr'a gelen arayüzün adresini yazar; sunucu havuzu giaddr'a göre seçer | Doğru |
| `ip helper-address` DHCP dışında birkaç UDP servisini de (DNS, TFTP, Time, NetBIOS, TACACS) iletir | Doğru; Seviye 1'e alınmadı, CCNA'da anılabilir |
| Yanıt alamayan istemci 169.254.0.0/16'dan adres verir | Doğru (Windows ve VPCS) |

**Motor gereksinimleri** (Labber'da denendi)

- [x] `ip dhcp pool`, `network`, `default-router`, `dns-server`, `ip dhcp excluded-address` ve `no` biçimleri — L5-b
- [x] `ip helper-address` ve `no ip helper-address` — L5-b
- [x] VPCS `ip dhcp` (DDORA çıktısı, sunucu yoksa 169.254), `show ip`'te DHCP SERVER satırı
- [x] `show ip dhcp binding`, `show ip dhcp pool` (havuz tükenince Current index 0.0.0.0)
- [x] Beş senaryo başta başarısız, terminalden çözümle başarılı
- [ ] Senaryonun başında hazır kirası olan PC'ler router'ın `show ip dhcp binding` tablosunda görünmüyor (köprü kiralamayı tohumlamıyor); S4'te PC-11 için tutarsız görünür
- [ ] `lease` komutu ve kira süresinin dolması modellenmiyor (okuma)
