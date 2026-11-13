# AğLab Konu #5–6: VLAN ve trunk

> Uygulamadaki `vlan` dersi (kısa ders ve ayrıntılı ders) bu belgeyle uyumludur. Senaryolar Sorun Çöz'de
> `vlan-*` kimlikleriyle Labber'da çalışır (`verify.kind: "query"`). Ayrıca `access-vlan`,
> `trunk-allowed` ve `native-vlan` tek adımlı senaryoları vardır. VLAN'lar arası yönlendirme
> Konu #7'dir.

Bu konu bittiğinde öğrenci bir switch'te VLAN oluşturur ve portları VLAN'lara atar. İki switch'i 802.1Q trunk ile bağlar, izinli VLAN listesini ve native VLAN'ı ayarlar. `show interfaces status`, `show vlan brief` ve `show interfaces trunk` çıktılarını okuyarak en sık beş VLAN/trunk arızasını kanıtla ayırır. Seviye 1, süre yaklaşık 60 dakika (ders 15, lab 15, senaryolar 25, sınav 5).

## 1. Neden önemli

Şubede muhasebe, satış ve misafir cihazları aynı switch'lere bağlıdır. VLAN olmasaydı misafir telefonundan atılan her broadcast muhasebe bilgisayarlarına da ulaşır, misafir ağı muhasebe sunucusunu doğrudan görürdü. Sahada VLAN sorunu çoğunlukla tek cümleyle gelir: "Kablo takılı, ışık yanıyor, IP doğru ama hiçbir yere ulaşamıyorum." Bu cümlenin arkasında çoğu zaman yanlış VLAN'daki bir port ya da bir VLAN'ı taşımayan bir trunk vardır.

## 2. Kavram

- **VLAN:** Bir switch'in portlarını ayrı mantıksal ağlara böler. Her VLAN ayrı bir broadcast alanıdır ve genelde ayrı bir IP ağı kullanır (VLAN 10 = 192.168.10.0/24).
- **Access port:** Tek bir VLAN'a aittir; PC, yazıcı gibi uç cihazlar bağlanır. Trafik etiketsizdir. PC hangi VLAN'da olduğunu bilmez, bunu switch portu belirler. Bu yüzden IP ayarları kusursuz bir PC yanlış VLAN'daki porta takılınca kimseye ulaşamaz.
- **Trunk ve 802.1Q:** Trunk birden çok VLAN'ı tek kabloda taşır (switch–switch, switch–router). Switch çerçeveye 4 baytlık 802.1Q etiketi ekler; etiketteki VLAN numarası 12 bittir, kullanılabilir VLAN'lar 1–4094. Etiket yalnız trunk üzerinde vardır; access porttan PC'ye çıkarken kaldırılır.
- **Trunk'ın üç ayarı:**
  1. *İzinli VLAN listesi* (`switchport trunk allowed vlan`): listede olmayan VLAN o kablodan geçmez. Çalışan trunk'a VLAN eklerken **`add`** kullanılır; `switchport trunk allowed vlan 30` listeyi yalnız 30 yapar ve diğerlerini anında düşürür.
  2. *Native VLAN* (`switchport trunk native vlan`): trunk'ta etiketsiz taşınan tek VLAN; varsayılanı 1, iki uçta aynı olmalı. Uyuşmazsa bir uçtaki VLAN'ın trafiği karşıda başka VLAN'a düşer.
  3. *VLAN'ın kendisi:* Her switch'te `vlan <numara>` ile oluşturulmuş olmalı. İzinli listede olmak tek başına yetmez.
- **Sahada DTP ve VTP:** DTP, portun trunk mı access mi olacağını pazarlık eder; iki uç `dynamic auto` ise port access kalır. Doğru uygulama portu `switchport mode access` ya da `switchport mode trunk` ile sabitlemek ve `switchport nonegotiate` eklemektir. VTP VLAN listesini dağıtır; daha yüksek revizyonlu bir switch ağa takılınca VLAN'ları silebildiği için şubelerde genelde `vtp mode transparent` kullanılır. (Labber'da DTP ve VTP modellenmez; okuma konusudur.)
- **VLAN'lar arası iletişim** için router ya da L3 switch gerekir (Konu #7). VLAN tek başına güvenlik duvarı değildir; VLAN'lar arası trafiği süzmek ACL işidir (Konu #19).

*(Etkileşimli şema: iki switch, dört PC; bir çerçevenin access porttan etiketsiz girip trunk'ta etiketlenmesi ve karşı switch'te etiketinin kaldırılması.)*

## 3. Çıktı okuma

```
SW1#show interfaces status
Port      Name               Status       Vlan       Duplex  Speed Type
Fa0/1                        connected    20         a-full  a-100 10/100BaseTX   ← PC-01 burada
Fa0/2                        connected    10         a-full  a-100 10/100BaseTX
Gi0/24                       connected    trunk      a-full a-1000 10/100/1000BaseTX

SW1#show vlan brief
VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active
10   MUHASEBE                         active    Fa0/2
20   SATIS                            active    Fa0/1
                                                ← Gi0/24 burada yok: trunk portlar listelenmez

SW1#show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Gi0/24      on           802.1q         trunking      1
Port        Vlans allowed on trunk
Gi0/24      30                          ← add unutulmuş: yalnız 30 geçiyor
Port        Vlans allowed and active in management domain
Gi0/24      30                          ← izinli VE bu switch'te oluşturulmuş
```

| Ne arıyorsun | Nereye bakarsın |
| --- | --- |
| Port hangi VLAN'da? | `show interfaces status` → Vlan sütunu |
| VLAN bu switch'te var mı? | `show vlan brief` |
| Port trunk mı? | `show interfaces trunk` (portu listede ara) ya da status'ta "trunk" |
| Trunk hangi VLAN'ları taşıyor? | "Vlans allowed on trunk" |
| İzinli ama switch'te yok mu? | "allowed" ile "allowed and active" farkı |
| Native VLAN iki uçta aynı mı? | İki switch'te "Native vlan" sütunu |

## 4. Yönlendirmeli lab

Topoloji: SW1 ve SW2, aralarında Gi0/24 bağlantısı. Her switch'te bir muhasebe (VLAN 10) ve bir satış (VLAN 20) PC'si.

1. **VLAN oluştur (iki switch'te):** `vlan 10` → `name MUHASEBE`; `vlan 20` → `name SATIS`. `show vlan brief` ile gör.
2. **Access portlar:** `interface fa0/1` → `switchport mode access` → `switchport access vlan 10`; satış PC'sinin portu için 20. *Neden:* `mode access` portu sabitler, DTP pazarlığını kapatır.
3. **Trunk:** iki uçta `interface gi0/24` → `switchport mode trunk` → `switchport trunk allowed vlan 10,20`.
4. **Doğrula, sırayla:** `show interfaces status` (port ve VLAN), `show vlan brief`, `show interfaces trunk`.
5. **Test:** muhasebe PC'leri katlar arası ping atabilir; muhasebeden satışa ping **gitmemeli** (router yok).
6. **VLAN ekle, bozmadan:** `vlan 30` oluştur, trunk'a `switchport trunk allowed vlan add 30`. Önce ve sonra `show interfaces trunk` karşılaştır. *Neden:* `add` olmadan liste yalnız 30 olurdu.
7. Kaydet: `copy running-config startup-config`.

**Lab'ın otomatik değerlendirmesi:** `q.ping('PC-01', <PC-02>).ok` ve `q.ping('PC-03', <PC-04>).ok` doğru; farklı VLAN'lar arası `q.ping` yanlış.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | Yanlış access VLAN | IP doğru, aynı ağdaki kimseye ulaşamıyor | `show interfaces status` Vlan sütunu | `switchport access vlan <doğru>` |
| E2 | Ara bağlantı trunk değil | Katlar arası hiçbir VLAN geçmiyor (ya da yalnız biri) | `show interfaces trunk`'ta port yok | İki uçta `switchport mode trunk` |
| E3 | İzinli listede eksik VLAN (`add` unutulmuş) | Bir VLAN dışında her şey çalışıyor; çoğu zaman yeni VLAN eklendikten sonra | "Vlans allowed on trunk" | `switchport trunk allowed vlan add <n>` |
| E4 | VLAN karşı switch'te yok | Aynı switch'tekiler konuşuyor, öbür uçtakilere ulaşılmıyor | Karşı switch'te `show vlan brief`; "allowed and active" bloğunda yok | `vlan <n>` |
| E5 | Native VLAN uyuşmazlığı | Etiketsiz trafik yanlış VLAN'a düşer; gerçek switch'te `%CDP-4-NATIVE_VLAN_MISMATCH` | İki uçta "Native vlan" farklı | İki uçta aynı native VLAN |

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `vlan-wrong-access`, `vlan-uplink-not-trunk`,
> `vlan-allowed-overwritten`, `vlan-missing-on-switch`, `vlan-two-faults` kimlikleriyle Labber'da çalışır.
> Native VLAN uyuşmazlığı ayrı `native-vlan` senaryosundadır.

### S1 · Başlangıç · Yeni muhasebe PC'si kimseyi görmüyor (E1)

- **Belirti:** PC-01 yeni bağlandı; IP doğru, ışık yanıyor ama aynı VLAN'daki PC-02'ye ping gitmiyor.
- **Neden:** SW1 Fa0/1 VLAN 20'de; VLAN 10 olmalı.
- **Çözüm:** SW1 → `interface fa0/1` → `switchport access vlan 10`
- **Hedefler:** PC-01 → PC-02 başarılı; PC-01 → PC-03 (VLAN 20) başarısız kalır.

### S2 · Başlangıç · Katlar arası hiçbir şey çalışmıyor (E2)

- **Belirti:** Aynı kattakiler sorunsuz; ne muhasebe ne satış diğer kata ulaşıyor.
- **Neden:** SW2 Gi0/24 access portu olarak kalmış.
- **Çözüm:** SW2 → `interface gi0/24` → `switchport mode trunk` → `switchport trunk allowed vlan 10,20`
- **Hedefler:** PC-01 → PC-02 ve PC-03 → PC-04 başarılı.

### S3 · Orta · Misafir ağı eklendi, muhasebe koptu (E3)

- **Belirti:** Dün akşam VLAN 30 (MISAFIR) eklendi; bu sabah muhasebe katlar arası ulaşamıyor.
- **Neden:** SW1 Gi0/24'te `switchport trunk allowed vlan 30` yazılmış; liste yalnız 30.
- **Çözüm:** SW1 → `interface gi0/24` → `switchport trunk allowed vlan add 10,20`
- **Hedefler:** iki VLAN da katlar arası çalışıyor.

### S4 · Orta · Satış diğer kattaki satışçılara ulaşamıyor (E4)

- **Belirti:** VLAN 20 katlar arası çalışmıyor; SW1'de izinli listede 20 var.
- **Neden:** VLAN 20, SW2'de oluşturulmamış.
- **Çözüm:** SW2 → `vlan 20` → `name SATIS`
- **Hedefler:** iki VLAN da katlar arası çalışıyor.

### S5 · İleri · İki hata birden (E3 + E1)

- **Belirti:** PC-01 (VLAN 20) diğer kattaki PC-02'ye ulaşamıyor; bir hatayı düzeltince sorun geçmiyor.
- **Neden:** SW1 Gi0/24 izinli listesinde 20 yok **ve** SW2 Fa0/1 yanlış VLAN'da (10).
- **Çözüm:** SW1 → `switchport trunk allowed vlan add 20`; SW2 → `interface fa0/1` → `switchport access vlan 20`
- **Hedefler:** PC-01 → PC-02 ve PC-03 → PC-04 başarılı; VLAN'lar arası başarısız kalır.

## 7. Kısa sınav

1. `show vlan brief`'te Gi0/24 hiçbir VLAN'da görünmüyor, port connected. Olası açıklama? **Port trunk; trunk portlar bu tabloda listelenmez.**
2. "Vlans allowed on trunk: 1,10,30". Hangi VLAN geçemez: 10, 20, 30? **20.**
3. "allowed: 1,10,20", "allowed and active: 1,10". Anlamı? **VLAN 20 izinli ama bu switch'te oluşturulmamış.**
4. Çalışan trunk'a VLAN 40'ı diğerlerini kesmeden ekleyen komut? **`switchport trunk allowed vlan add 40`.**
5. VLAN 10 ile VLAN 20 arasında IP erişimi için ne gerekir? **Router ya da L3 switch (Konu #7).**

## 8. Doğrulama notları

Kaynaklar: IEEE 802.1Q (etiket 4 bayt, VID 12 bit, 0 ve 4095 ayrılmış); Cisco Catalyst VLAN ve trunk yapılandırma kılavuzları (`switchport trunk allowed vlan add`, `show interfaces trunk` blokları, DTP modları, VTP transparent); CCNA 200-301 2.1–2.2.

| İddia | Sonuç |
| --- | --- |
| Kullanılabilir VLAN'lar 1–4094 (0 ve 4095 ayrılmış) | Doğru |
| `allowed vlan <liste>` mevcut listeyi değiştirir, `add` ekler | Doğru |
| Trunk portlar `show vlan brief` Ports sütununda listelenmez | Doğru |
| İki uç `dynamic auto` → access | Doğru |
| Native VLAN uyuşmazlığında CDP `%CDP-4-NATIVE_VLAN_MISMATCH` logu | Doğru |

**Motor gereksinimleri** (Labber'da denendi)

- [x] VLAN, access, trunk, izinli liste (`add`, `remove`), native VLAN, `show interfaces status|trunk`, `show vlan brief`
- [x] Beş senaryo `query` doğrulamasıyla: başta başarısız, terminalden çözümle başarılı; VLAN'lar arası yalıtım da sınanıyor
- [ ] DTP ve VTP yok (okuma)
- [ ] `NATIVE_VLAN_MISMATCH` uyarısı yalnız durum değişince yazılıyor; başlangıçta ve periyodik olmalı (motor işi)
- [ ] Trunk'ın varsayılan "allowed vlan" değeri running-config'te görünüyor; gerçek IOS'ta varsayılan (all) yazılmaz
