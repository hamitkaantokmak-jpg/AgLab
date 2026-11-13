# AğLab Konu #4: Fiziksel bağlantı ve kablolama

> Uygulamadaki `physical` dersi bu belgeye göre yeniden yazıldı. Senaryolar Sorun Çöz'de
> `phy-*` kimlikleriyle Labber'da çalışır. Pratik türü: Motor + okuma (kablo türleri, PoE,
> hız/duplex ve hata sayaçları okuma).

Bu konu bittiğinde öğrenci bir portun durumunu (connected, notconnect, disabled, err-disabled) ve `show interfaces` satırlarını yorumlar. Kapalı portu, kopuk kabloyu, yanlış porta takılmış kabloyu ve kapalı cihazı birbirinden ayırır. Bir bağlantının iki ucunu birlikte kontrol etmeyi alışkanlık edinir. Kablo türlerini, PoE'yi ve etiketlemenin neden önemli olduğunu bilir. Seviye 1, süre yaklaşık 60 dakika (ders 15, lab 15, senaryolar 20, sınav 10).

## 1. Neden önemli

Şubede gelen arızaların büyük kısmı fizikseldir: çıkmış bir kablo, yanlış prize takılmış bir bilgisayar, kesintiden sonra açılmamış bir switch, "kullanılmayan" diye kapatılmış ama aslında kullanılan bir port. Bu arızalar basittir ama yanlış katmanda aranırsa saatler kaybettirir. IP ayarlarıyla uğraşırken sorun kablodaysa hiçbir şey ilerlemez.

Sorun gidermenin ilk kuralı bu yüzden aşağıdan başlamaktır: ışık yanıyor mu, port ne diyor? Bu konunun komutları her teşhisin ilk adımıdır.

## 2. Kavram

**Port durumunu iki soru belirler:** Port açık mı (yönetimsel olarak) ve karşı uçla bağlantı kurulmuş mu?

| `show interfaces status` | `show interfaces` | Anlamı |
| --- | --- | --- |
| connected | up, line protocol is up | Port açık, bağlantı kurulmuş |
| notconnect | down, line protocol is down | Port açık ama karşıda bir şey yok: kablo çıkmış, kopuk, karşı cihaz kapalı ya da karşı port kapalı |
| disabled | administratively down | Port `shutdown` ile elle kapatılmış |
| err-disabled | down (err-disabled) | Switch portu bir güvenlik ya da hata kuralı yüzünden kendisi kapatmış: port security ihlali (Konu #21), BPDU Guard (Konu #13) |

**Bir bağlantının iki ucu vardır.** Bir uçta port `shutdown` ise o uç **disabled**, karşı uç **notconnect** görünür. Karşı uca bakan teknisyen "notconnect, kablo bozuk" diyebilir; oysa kablo sağlamdır. Teşhis her zaman iki ucun birlikte okunmasıyla yapılır.

**Kablolar:**

- **Bakır (UTP):** Cat5e ve Cat6 1 Gbps'e kadar, en fazla **100 metre**. Cat6A 10 Gbps'i 100 metrede taşır.
- **Düz ve çapraz kablo:** Eskiden aynı tür cihazlar (switch–switch) çapraz kabloyla bağlanırdı. Bugünkü cihazların çoğunda **Auto-MDIX** vardır ve kablo türünü kendileri ayarlar.
- **Fiber:** Uzun mesafe ve binalar arası bağlantı için. Switch'e SFP modülüyle takılır. Çok modlu (multimode) fiber yüzlerce metre, tek modlu (single-mode) kilometrelerce taşır. İki ucun modülü ve fiber türü uyumlu olmalıdır.

**Patch panel ve etiketleme:** Duvardaki priz, dolaptaki patch panele gider; panelden kısa bir kabloyla switch portuna bağlanır. Priz, panel portu ve switch portu etiketli değilse "masası değişen çalışan" gibi sıradan bir iş, kablo takibine dönüşür. Switch portuna `description` yazmak etiketin yazılım tarafındaki karşılığıdır.

**PoE (Power over Ethernet):** IP telefon, erişim noktası ve kamera gibi cihazlar gücü ağ kablosundan alır. 802.3af portu en fazla 15,4 W, 802.3at (PoE+) 30 W, 802.3bt 60–90 W verir. Switch'in toplam bir **güç bütçesi** vardır; bütçe dolarsa yeni takılan cihaz açılmaz, ama port bağlantıda görünür.

**Hız ve duplex:** İki uç hızı ve duplex'i otomatik anlaşır (`a-full`, `a-1000`). Bir uç elle sabitlenip öteki otomatikte bırakılırsa **duplex uyuşmazlığı** olur: bağlantı çalışır ama yavaştır, `show interfaces`'ta CRC ve late collision sayaçları artar.

*(Etkileşimli şema: priz → patch panel → switch portu; bir bağlantının iki ucunda durumların eşleşmesi.)*

## 3. Çıktı okuma

### show interfaces status

```
SW1#show interfaces status
Port      Name               Status       Vlan       Duplex  Speed Type
Gi0/1     Uplink SW2         disabled     1          auto     auto 10/100/1000BaseTX
Fa0/1     PC-1               connected    1          a-full  a-100 10/100BaseTX
Fa0/2                        notconnect   1          auto     auto 10/100BaseTX
Fa0/5                        disabled     1          auto     auto 10/100BaseTX
```

- **Name:** Port açıklaması (`description`). Boşsa port belgelenmemiştir.
- **Status:** Tablodaki dört durum. Önce bu sütuna bakılır.
- **Duplex / Speed:** `a-` öneki otomatik anlaşma demektir. `a-full a-100` sağlıklı bir bağlantıdır. Bağlantı yoksa `auto` görünür.
- Bu çıktıda üç ipucu var: Gi0/1 (uplink) elle kapatılmış; Fa0/2'de cihaz yok; Fa0/5 kapalı. Bir PC "ağa bağlanmıyor" diyorsa önce hangisine bağlı olduğunu bul.

### show interfaces <port>

```
SW1#show interfaces fa0/2
FastEthernet0/2 is down, line protocol is down (notconnect)
  Hardware is Fast Ethernet, address is 0200.0000.0103
  ...
     0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
     0 output errors, 0 collisions, 0 interface resets
     0 late collision, 0 deferred
```

- **İlk satır:** Katman 1 ("is down") ve katman 2 ("line protocol is down") durumu, parantez içinde nedeni.
- **Hata sayaçları** (gerçek cihazda): CRC ve input errors artıyorsa kablo ya da konnektör bozuktur, ya da duplex uyuşmazlığı vardır. **late collision**, duplex uyuşmazlığının tipik izidir. Sayaçlar `clear counters` ile sıfırlanıp bir süre sonra tekrar okunur; yalnız **artan** sayaç bir sorun gösterir.

## 4. Yönlendirmeli lab

Topoloji: SW1'e PC-1 (Fa0/1) ve PC-2 (Fa0/2) bağlı. SW2 (yazıcı ve PC-3) SW1'e Gi0/1 ile bağlı. Fa0/3–Fa0/5 boş; Fa0/5 kapalı.

1. **Durum tablosu.** SW1'de `show interfaces status`. connected, notconnect ve disabled portları ayır. *Neden:* Her teşhis bu tabloyla başlar.
2. **Port kapat.** `interface fa0/2` → `shutdown`. Tabloda Fa0/2 **disabled**. PC-2'den `ping 192.168.10.11`: başarısız. PC-2'de bağlantı yok (gerçek cihazda kartın ışığı söner).
3. **İki ucu oku.** SW1'de `interface gi0/1` → `shutdown`. SW1'de Gi0/1 **disabled**; SW2'de `show interfaces status`: Gi0/1 **notconnect**. *Neden:* Bir uç kapatılınca karşı uç bağlantıyı kaybeder ama nedenini bilmez. İki portu da `no shutdown` ile aç.
4. **Belgele (okuma).** Gerçek bir switch'te `interface fa0/1` → `description PC-1` yazınca tablodaki Name sütunu dolar; bir sonraki arızada "bu port kimin?" sorusu tek bakışta cevaplanır. AğLab'da açıklama komutu çalışır ama kayda geçmez; bu adımı okuma olarak geç.
5. **Cihazı kapat.** SW2'yi seç ve `device power off`. SW1'de Gi0/1 **notconnect**; SW2'nin yönetim adresine (192.168.10.3) ping yok. `device power on` ile aç. *Neden:* Karşı cihazın kapalı olması da bu uçta notconnect olarak görünür; ayırmak için karşı cihaza başka yoldan (konsol, yönetim adresi) bakılır.
6. **Ayrıntılı çıktı.** `show interfaces fa0/1`: ilk satır ve sayaçlar.

**Lab'ın otomatik değerlendirmesi:** `q.linkUp('PC-2')`; `q.ping('PC-1', '192.168.10.50').ok`; `q.powered('SW2')`.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | Port elle kapatılmış | Tek cihaz ağa bağlanmıyor, kart ışığı yanmıyor | `show interfaces status`: disabled; `show interfaces`: administratively down | `no shutdown` |
| E2 | Bağlantının öbür ucu kapalı | Bir switch'in tamamı kopuk; bu uçta notconnect | Karşı uçta disabled | Karşı ucu aç; iki ucu birlikte oku |
| E3 | Kablo yanlış porta takılmış | Taşınan cihaz bağlanmıyor; belgedeki port notconnect | Belgedeki port notconnect, başka bir port disabled ya da yanlış VLAN'da | Doğru portu yapılandır ya da kabloyu taşı; `description` güncelle |
| E4 | Cihaz kapalı | Bir switch'e bağlı her şey birden gitti | Uplink notconnect; cihazın yönetim adresine ping yok; güç ışığı sönük | Gücü kontrol et, cihazı aç |
| E5 | Bozuk kablo ya da duplex uyuşmazlığı | Bağlantı var ama yavaş ya da kesik kesik | CRC, input errors, late collision sayaçları artıyor; bir uç sabit, öbürü auto | Kabloyu değiştir; iki ucu da auto ya da ikisini de aynı değere sabitle |

E1 ile E2'yi ayıran şey hangi uca baktığındır. E3'te kablo sağlamdır, yanlış yerdedir. E5 bağlantıyı koparmaz, bozar; bu yüzden ping "çalışıyor" ama kullanıcı "çok yavaş" der.

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `phy-port-shutdown`, `phy-uplink-one-side`,
> `phy-wrong-port`, `phy-power-off`, `phy-two-faults` kimlikleriyle Labber'da çalışır.
> Cihaz gücü AğLab terminalinde `device power on|off` ile değişir; gerçekte bu adım dolaba gidip
> prizi ve güç ışığını kontrol etmektir.

### S1 · Başlangıç · Kullanılmayan portlar kapatılınca bir PC gitti (E1)

- **Başlangıç:** SW1 Fa0/2 (PC-2) `shutdown`.
- **Belirti:** Dün kullanılmayan portlar kapatıldı; bu sabah PC-2 hiçbir yere ulaşamıyor, kart ışığı yanmıyor.
- **İpuçları:** (1) Işık yoksa katman 1. Switch tarafı ne diyor? (2) `show interfaces status`: disabled mı notconnect mi? (3) disabled → `no shutdown`.
- **Çözüm:** SW1 → `interface fa0/2` → `no shutdown`
- **Hedefler:** `q.linkUp('PC-2')`; `q.ping('PC-2', '192.168.10.11').ok`

### S2 · Başlangıç · 2. switch'teki herkes kopuk, ışıklar yanmıyor (E2)

- **Başlangıç:** SW1 Gi0/1 `shutdown`; SW2 tarafı açık.
- **Belirti:** SW2'deki cihazlar SW1'dekilere ulaşamıyor. Teknisyen SW2'nin portuna bakıp "notconnect, kablo bozuk" demiş.
- **İpuçları:** (1) SW2'nin notconnect demesi sorunun SW2'de olduğunu kanıtlar mı? (2) Kablonun öbür ucu: SW1'de `show interfaces status`. (3) disabled olan ucu aç.
- **Çözüm:** SW1 → `interface gi0/1` → `no shutdown`
- **Hedefler:** `q.ping('PC-3', '192.168.10.11').ok`; `q.ping('PC-1', '192.168.10.50').ok`

### S3 · Orta · Masası değişen çalışanın bilgisayarı ağa bağlanmıyor (E3)

- **Başlangıç:** PC-2'nin kablosu artık SW1 Fa0/5'te; Fa0/5 kullanılmayan port olarak kapalı.
- **Belirti:** Belgede PC-2'nin portu Fa0/2; teknisyen "Fa0/2 açık ama notconnect" diyor.
- **İpuçları:** (1) Belgedeki port notconnect ise cihaz orada değil. (2) Tabloda disabled duran ama bağlı olması gereken port hangisi? (3) O portu aç; gerçek ağda belgeyi de güncelle.
- **Çözüm:** SW1 → `interface fa0/5` → `no shutdown` (gerçek ağda ardından `description PC-2`)
- **Hedefler:** `q.linkUp('PC-2')`; `q.ping('PC-2', '192.168.10.11').ok`

### S4 · Orta · Sabah 2. switch'e bağlı her şey yok (E4)

- **Başlangıç:** SW2 kapalı.
- **Belirti:** Gece elektrik kesintisi oldu; PC-3 ve yazıcıya kimse ulaşamıyor, SW2'ye uzaktan bağlanılamıyor.
- **İpuçları:** (1) Bir switch'e bağlı her şey birden gittiyse switch'in kendisini düşün. (2) SW1'de Gi0/1 ne diyor? SW2'nin yönetim adresine ping at. (3) SW2'yi seç ve `device power on`.
- **Çözüm:** SW2 → `device power on`
- **Hedefler:** `q.powered('SW2')`; `q.ping('PC-1', '192.168.10.50').ok`

### S5 · İleri · Kesintiden sonra iki ayrı sorun (E4 + E1)

- **Başlangıç:** SW2 kapalı ve SW1 Fa0/2 `shutdown`.
- **Belirti:** 2. switch'e bağlı her şey yok; ayrıca PC-2, SW1'deki PC-1'e bile ulaşamıyor.
- **İpuçları:** (1) Bir switch'in tamamı ve tek bir PC: hangisi hangi sorun? (2) SW1'de Gi0/1 ve Fa0/2'nin durumu. (3) Önce switch, sonra port.
- **Çözüm:** SW2 → `device power on`; SW1 → `interface fa0/2` → `no shutdown`
- **Hedefler:** `q.ping('PC-1', '192.168.10.50').ok`; `q.ping('PC-2', '192.168.10.11').ok`

## 7. Kısa sınav

1. `show interfaces status`'ta bir port **disabled**. Bu ne anlama gelir?
   - A) Kablo takılı değil
   - B) Port `shutdown` ile elle kapatılmış
   - C) Port güvenlik ihlali yüzünden kapandı
   - D) Karşı cihaz kapalı

   **Cevap: B.** Kablo yoksa notconnect, güvenlik ihlalinde err-disabled görünür.
2. SW2'nin uplink portu notconnect; SW1'deki karşı port disabled. Sorun nerede?
   - A) SW2'de
   - B) Kabloda
   - C) SW1'deki portun kapatılmasında
   - D) SW2 kapalı

   **Cevap: C.** Bir uç kapatılınca karşı uç notconnect görünür; iki uç birlikte okunur.
3. Bakır Ethernet (Cat5e/Cat6) kablonun standart en uzun mesafesi nedir?
   - A) 10 m
   - B) 100 m
   - C) 500 m
   - D) 2 km

   **Cevap: B.** Daha uzun mesafeler için fiber kullanılır.
4. Bağlantı çalışıyor ama çok yavaş; `show interfaces`'ta late collision ve CRC sayaçları artıyor. En olası neden?
   - A) VLAN yanlış
   - B) Duplex uyuşmazlığı ya da bozuk kablo
   - C) Port kapalı
   - D) PoE bütçesi doldu

   **Cevap: B.** Late collision duplex uyuşmazlığının tipik izidir.
5. Yeni bir erişim noktası takıldı; port connected ama cihaz açılmıyor. Switch'e daha önce birkaç PoE kamera eklenmişti. İlk kontrol?
   - A) Kablonun türü
   - B) Switch'in PoE güç bütçesi
   - C) VLAN
   - D) DNS

   **Cevap: B.** Bütçe dolduysa yeni cihaza güç verilmez.

## 8. Doğrulama notları

Kaynaklar: Cisco Catalyst arayüz yapılandırma kılavuzu (`show interfaces status` durumları), IEEE 802.3 (100 m bakır sınırı, 802.3af/at/bt PoE güçleri); CCNA 200-301 sınav konuları (1.3 fiziksel arayüz ve kablo türleri, 1.4 arayüz ve kablo sorunları: çakışma, hatalar, duplex/hız uyuşmazlığı). Eski `physical` dersi Kavram için kaynak oldu; metin yeniden yazıldı.

**Kontrol edilen iddialar**

| İddia | Sonuç |
| --- | --- |
| UTP Ethernet kanal uzunluğu en fazla 100 m | Doğru |
| PoE: 802.3af 15,4 W, 802.3at 30 W, 802.3bt 60–90 W (PSE çıkışı) | Doğru |
| Bir uç `shutdown` iken karşı uç notconnect görünür | Doğru |
| Late collision duplex uyuşmazlığının tipik göstergesidir | Doğru |
| Auto-MDIX kablo türünü (düz/çapraz) otomatik ayarlar | Doğru |

**Motor gereksinimleri** (Labber'da denendi)

- [x] `show interfaces status` (connected / notconnect / disabled, Name sütunu), `show interfaces <port>` ilk satırı
- [x] `shutdown` / `no shutdown`; bir uç kapalıyken karşı uçta notconnect
- [ ] `description` Labber'da çalışıyor ama AğLab modeline yazılamıyor ("Labber durumu AğLab görünümüne yazılamadı" uyarısı); kayıt ve dışa aktarma içermiyor
- [x] Cihaz gücü (`device power on|off`), kablo durumu — L2-B
- [x] Beş senaryo başta başarısız, terminalden çözümle başarılı
- [ ] `speed` / `duplex` komutları yok; duplex uyuşmazlığı ve hata sayaçları modellenmiyor (okuma)
- [ ] `show interfaces counters errors` ve `clear counters` yok
- [ ] Kablo türü (düz/çapraz/fiber), PoE ve güç bütçesi modellenmiyor (okuma)
