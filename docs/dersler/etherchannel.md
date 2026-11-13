# AğLab Konu #14: EtherChannel (LACP)

> Uygulamadaki `etherchannel` dersi bu belgeden üretildi. **Okuma dersi:** Labber EtherChannel'ı
> (`channel-group`, LACP/PAgP/on, `show etherchannel summary`) çalıştırıyor, ama AğLab topoloji modeli
> Port-channel'ı kaydedemiyor; bu yüzden Sorun Çöz senaryoları model desteği gelince eklenecek.
> Aşağıdaki vakalar kâğıt üstünde, beklenen çıktılarla çözülür. Ön koşul: VLAN ve trunk (Konu #5–6),
> STP (Konu #13).

Bu konu bittiğinde öğrenci birden çok fiziksel bağlantıyı neden tek mantıksal bağlantıda topladığımızı açıklar. LACP ile EtherChannel kurar ve hangi mod çiftlerinin kanal oluşturduğunu bilir. Üyelerin hangi ayarlarda aynı olması gerektiğini sayar. `show etherchannel summary` bayraklarından askıya alınmış, tek başına kalmış ve paketlenmiş portları ayırır. Seviye 2 (CCNA), süre yaklaşık 45 dakika.

## 1. Neden önemli

İki switch arasına ikinci bir kablo çekmek tek başına bant genişliğini artırmaz. STP döngüyü önlemek için ikinci kabloyu bloklar. EtherChannel iki (en çok sekiz) bağlantıyı tek mantıksal bağlantı (Port-channel) yapar: STP onu tek link görür, trafik üyelere dağıtılır ve bir üye kopunca kanal kesintisiz devam eder. Arızaları sinsidir: kanal "up" görünür ama bir üye askıdadır; bağlantı çalışır ama yedeksizdir ve yarı hızdadır.

## 2. Kavram

- **Kanal kurma modları:**

| Bir uç | Öbür uç | Sonuç |
| --- | --- | --- |
| LACP `active` | `active` ya da `passive` | Kanal kurulur |
| LACP `passive` | `passive` | **Kurulmaz** (ikisi de bekler) |
| PAgP `desirable` | `desirable` ya da `auto` | Kurulur (Cisco'ya özel) |
| PAgP `auto` | `auto` | **Kurulmaz** |
| `on` | `on` | Pazarlıksız kurulur |
| `on` | LACP/PAgP | **Kurulmaz**; `on` hiç pazarlık paketi göndermez |

LACP (IEEE 802.3ad/802.1AX) standarttır ve tercih edilir. `on` pazarlık yapmadığı için yanlış kablolamayı fark etmez; döngü riski taşır.
- **Üyelerin tutarlılığı:** Bütün üyelerde hız, duplex, switchport modu (access/trunk), access VLAN'ı ya da trunk izinli listesi ve native VLAN aynı olmalı. Farklı olan üye **askıya alınır** (`s`) ve kanala girmez. Ayar Port-channel arayüzüne yazılır, üyelere yayılır.
- **Yük dağıtımı:** Her akış bir karma (hash) ile tek bir üyeye gider (`port-channel load-balance src-dst-ip`). Tek bir büyük dosya aktarımı tek üyenin hızını aşamaz; dağıtım akışlar arasındadır.
- **Sınırlar:** En çok 8 etkin üye (LACP 8'i daha yedekte tutabilir). Üye sayısının 2, 4 ya da 8 olması karma dağılımını dengeler.

*(Etkileşimli şema: SW1–SW2 arasında iki kablo; STP'siz döngü, STP ile bloklu bir kablo, EtherChannel ile ikisi birden açık tek Po1.)*

## 3. Çıktı okuma

```
SW1#show etherchannel summary
Flags:  D - down        P - bundled in port-channel
        I - stand-alone s - suspended
        S - Layer2      U - in use
Group  Port-channel  Protocol    Ports
------+-------------+-----------+-----------------------------------------------
1      Po1(SU)         LACP      Gi0/1(P)    Gi0/2(s)
                                              ← Gi0/2 askıda: ayarı Gi0/1'den farklı

SW1#show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Po1         on           802.1q         trunking      1
                                              ← trunk Po1 üzerinde, üyeler ayrıca listelenmez
```

| Bayrak | Anlamı | Bakılacak |
| --- | --- | --- |
| `(P)` | Kanalda, çalışıyor | — |
| `(s)` | Askıda: üye ayarı uyumsuz | Üyenin hız/duplex/VLAN/trunk ayarı |
| `(I)` | Tek başına: karşı taraf kanal pazarlığına girmiyor | Karşı ucun modu |
| `(D)` | Port kapalı | Kablo, `shutdown` |
| `Po1(SD)` | Kanal down: hiç üye yok | Mod çifti |

## 4. Yönlendirmeli lab (Labber'da; kayda yazılmaz)

Topoloji: SW1 Gi0/1–Gi0/2 ↔ SW2 Gi0/1–Gi0/2; her iki switch'te VLAN 10 PC'si. Bu lab Labber terminalinde çalışır; arayüz değişikliğin AğLab kaydına yazılamadığı uyarısını verir.

1. **Kanalsız:** `show spanning-tree vlan 10`: iki bağlantıdan biri bloklu.
2. **LACP:** iki switch'te `interface range gi0/1 - 2` → `channel-group 1 mode active`.
3. **Port-channel:** `interface port-channel 1` → `switchport mode trunk`.
4. **Oku:** `show etherchannel summary` (P bayrakları), `show spanning-tree vlan 10` (artık tek port: Po1).
5. **Uyumsuz üye:** SW2'de Gi0/2'yi `shutdown`; kanal Gi0/1 ile devam eder. Geri aç.
6. **Mod deneyi:** SW2'de modu `passive` yap (kurulur), iki uçta `passive` (kurulmaz).

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | İki uç passive (ya da auto) | Kanal yok, bir bağlantı STP'de bloklu | summary'de `(I)`, Po1 `SD` | Bir ucu `active` yap |
| E2 | Bir uç `on`, öbürü LACP | Kanal yok | `on` tarafında Po var ama karşıda `(I)` | İki ucu da LACP yap |
| E3 | Üye ayarı farklı (izinli VLAN, native, mod) | Kanal up ama bir üye yok, bant yarıda | Üye `(s)` | Ayarı Port-channel'a yaz, üyeleri eşitle |
| E4 | Hız/duplex farklı üye | Üye askıda | `(s)`; `show interfaces` hız farkı | Üyeleri aynı hız/duplex'e getir |
| E5 | "Kanal var, hız iki katı" beklemek | Tek aktarım hızlanmıyor | Bütün üyeler `(P)` | Normal: dağıtım akış bazlı |

## 6. Arıza senaryoları (kâğıt üstü; Sorun Çöz'e model desteği gelince eklenecek)

### S1 · Başlangıç · Kanal hiç kurulmadı (E1)

- **Belirti:** Katlar arası iki kablo var, `show spanning-tree`'de biri bloklu.
- **Kanıt:** iki switch'te `show etherchannel summary`: `Po1(SD)`, üyeler `(I)`; `show run`: iki uçta `channel-group 1 mode passive`.
- **Çözüm:** bir uçta `channel-group 1 mode active`.

### S2 · Orta · Bir uç on, öbürü active (E2)

- **Kanıt:** SW1'de `mode on`, SW2'de `mode active`; SW2 üyeleri `(I)`.
- **Çözüm:** SW1'de `no channel-group` → `channel-group 1 mode active`.

### S3 · Orta · Kanal up, bir üye askıda (E3)

- **Kanıt:** `Gi0/1(P) Gi0/2(s)`; Gi0/2'de `switchport trunk allowed vlan 10`, Gi0/1'de `10,20`.
- **Çözüm:** izinli listeyi `interface port-channel 1` altında yaz; üyeler eşitlenir.

### S4 · Orta · Yeni takılan kablo kanala girmiyor (E4)

- **Kanıt:** üçüncü üye `(s)`; `show interfaces gi0/3`: 100 Mb/s, diğerleri 1000 Mb/s (hız elle sabitlenmiş).
- **Çözüm:** `no speed` / `speed auto` ile üyeleri eşitle.

### S5 · İleri · İki hata

- **Kanıt:** iki uç passive (E1); kurulunca bir üye askıda (E3).
- **Çözüm:** modu active yap, ardından üye ayarını eşitle.

## 7. Kısa sınav

1. LACP passive–passive kanal kurar mı? **Hayır.**
2. Hangi bayrak üyenin ayar uyumsuzluğu yüzünden kanala alınmadığını gösterir? **(s) suspended.**
3. `on` ile `active` eşleşirse? **Kanal kurulmaz; `on` pazarlık paketi göndermez.**
4. Tek bir dosya aktarımı iki üyeli kanalda iki kat hızlanır mı? **Hayır; akış tek üyeye gider.**
5. STP iki üyeli bir kanalı nasıl görür? **Tek bağlantı (Po1).**

## 8. Doğrulama notları

Kaynaklar: IEEE 802.1AX (LACP), Cisco Catalyst EtherChannel yapılandırma kılavuzu (modlar, uyumluluk şartları, `show etherchannel summary` bayrakları, yük dağıtımı), CCNA 200-301 2.4 (L2/L3 LACP).

| İddia | Sonuç |
| --- | --- |
| active–passive kurar, passive–passive kurmaz; desirable–auto kurar, auto–auto kurmaz | Doğru |
| `on` LACP/PAgP göndermez; karşı taraf pazarlık bekliyorsa kurulmaz | Doğru |
| Üyelerde hız, duplex, mod, VLAN/izinli liste, native VLAN aynı olmalı | Doğru |
| En çok 8 etkin üye | Doğru |

**Motor gereksinimleri**

- [x] Labber: `channel-group` (on, active, passive, desirable, auto), Port-channel, `show etherchannel summary`, LabQuery `etherchannel(dev, id)`
- [ ] **AğLab modeli Port-channel ve `channel-group`'u kaydedemiyor**; senaryo başlangıcı ve çözümü kayda yazılamıyor (model işi). Model desteği gelince S1–S5 `ec-*` kimlikleriyle Sorun Çöz'e eklenir; sorgu listesine `etherchannel` eklenmeli
