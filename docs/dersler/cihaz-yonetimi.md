# AğLab Konu #11: Cihaz yönetimi ve yedekleme

> Uygulamadaki `devicemgmt` dersi bu belgeyle uyumludur. Senaryolar Sorun Çöz'de `mgmt-*`
> kimlikleriyle Labber'da çalışır (`verify.kind: "query"`, kayıt durumu ve güç döngüsü dahil).

Bu konu bittiğinde öğrenci running-config ile startup-config farkını açıklar ve değişikliği kaydeder. Kaydedilmemiş hatalı bir değişikliği `reload` ile geri alır ve "Save?" sorusunu doğru cevaplar. Switch'e yönetim SVI'si ve gerekirse `ip default-gateway` ile adres verir. SSH'ın adımlarını ve parolaların nasıl saklandığını açıklar, yapılandırmayı yedekler. Seviye 1, süre yaklaşık 75 dakika.

## 1. Neden önemli

"Dün çalışıyordu, bugün çalışmıyor" şikâyetlerinin önemli bir kısmı yapılandırma yönetiminden gelir. Kaydedilmemiş bir ayar gece kesintisinde kaybolur. Aceleyle "yes" denmiş bir reload hatayı kalıcı yapar. Yönetim adresi olmayan bir switch'e de uzaktan ulaşılamaz. Yedeği olmayan bir cihaz arızalanınca ayarları sıfırdan yazmak gerekir.

## 2. Kavram

- **İki yapılandırma:** running-config RAM'dedir; her komut anında buraya yazılır. startup-config NVRAM'dedir ve açılışta yüklenir. Kaydetmek running'i startup'a kopyalamaktır: `copy running-config startup-config` ya da `write memory`. Kaydedilmeyen değişiklik kesintide ve reload'da kaybolur. `erase startup-config` ve ardından `reload` cihazı fabrika ayarına döndürür.
- **reload ve "Save?":** Kaydedilmemiş değişiklik varken `reload`, "System configuration has been modified. Save? [yes/no]" diye sorar, ardından onay ister. `yes` şu anki hali (hata varsa onu da) kalıcı yapar; `no` son kaydedilen hale döner. Kaydedilmemiş bir hatadan kurtulmanın en hızlı yolu reload ve `no`'dur. Hata kaydedilmişse reload işe yaramaz: satır düzeltilip yeniden kaydedilir.
- **Yönetim adresi:** Katman 2 switch'in portlarının IP'si yoktur. Ağdan ulaşmak için bir SVI'ya adres verilir: `interface vlan 99` → `ip address 192.168.99.2 255.255.255.0` → `no shutdown`. SVI yalnız kendi VLAN'ındaki cihazlara yanıt verir ve o VLAN'da en az bir aktif port olmalıdır. Başka ağdan yönetim için `ip default-gateway`. Yönetimi kullanıcı VLAN'larından ve VLAN 1'den ayırmak iyi uygulamadır.
- **Parolalar ve SSH:** `enable secret` parolayı karma olarak saklar ve `enable password`'ün önüne geçer; `service password-encryption` yalnız zayıf type 7 gizlemesi yapar. Telnet düz metindir, SSH şifreler. SSH için: varsayılan olmayan hostname ve `ip domain-name`, `crypto key generate rsa modulus 2048`, `ip ssh version 2`, `username admin secret …`, `line vty 0 15` altında `login local` ve `transport input ssh`.
- **Yedek:** `copy running-config tftp:` ile dışarı alınır. `copy tftp: running-config` mevcut ayarla **birleştirir**; tam geri dönüş için yedek startup-config'e kopyalanıp reload yapılır ya da `configure replace` kullanılır.

(Labber'da SSH, parola ve TFTP şimdilik okuma konusudur.)

## 3. Çıktı okuma

```
SW1#show running-config | section interface FastEthernet0/2
interface FastEthernet0/2
 switchport access vlan 20               ← çalışan hal
SW1#show startup-config | section interface FastEthernet0/2
interface FastEthernet0/2
 switchport access vlan 10               ← kaydedilmiş hal: fark kaydedilmemiş değişikliktir

SW1#reload
System configuration has been modified. Save? [yes/no]: no
Proceed with reload? [confirm]

SW1#show ip interface brief | include Vlan
Vlan1                  unassigned      YES unset  administratively down down
Vlan99                 192.168.99.2    YES manual up                    up
        ← "administratively down" olsaydı: no shutdown eksik
```

| Soru | Komut |
| --- | --- |
| Kaydedilmemiş değişiklik var mı? | `show running-config` ile `show startup-config` karşılaştır |
| Yönetim adresi hangi SVI'da, açık mı? | `show ip interface brief` |
| Başka ağdan yönetim mümkün mü? | `show running-config | include default-gateway` |
| SSH açık mı? | `show ip ssh` |

## 4. Yönlendirmeli lab

Topoloji: SW1'de PC-01, PC-02 (VLAN 10) ve ADMIN (VLAN 99, 192.168.99.10).

1. **Yönetim SVI'si:** `interface vlan 99` → `ip address 192.168.99.2 255.255.255.0` → `no shutdown`. ADMIN'den `ping 192.168.99.2`.
2. **Farkı gör:** `show running-config` ve `show startup-config`; Vlan99 yalnız birinde.
3. **Kaydet:** `copy running-config startup-config`; tekrar karşılaştır.
4. **Hatalı değişiklik:** `interface fa0/2` → `switchport access vlan 20`; PC-01 → PC-02 kopar.
5. **Geri al:** `reload` → `no` → onay. PC-01 → PC-02 geri gelir. *Neden:* Kaydedilmemiş hata yalnız running'teydi.
6. **Kaydedilmiş hata:** aynı değişikliği yap, bu kez kaydet ve reload et; hata kalır. Düzelt ve kaydet.
7. **Okuma:** SSH adımlarını bir kâğıda sırayla yaz; `enable secret` ile `enable password` farkını açıkla.

**Lab'ın otomatik değerlendirmesi:** `q.ping('ADMIN', '192.168.99.2').ok`; `q.ping('PC-01', <PC-02>).ok`; `q.saved('SW1')`; güç döngüsünden sonra da.

## 5. Sık hatalar

| Kod | Hata | Belirti | Kanıt | Düzeltme |
| --- | --- | --- | --- | --- |
| E1 | Kaydetmeyi unutmak | Kesinti ya da reload sonrası ayar eski haline döner | startup-config'te satırlar yok | Ayarı yeniden yap, kaydet |
| E2 | Hatalı değişiklikle "Save? yes" | Hata kalıcı olur, reload düzeltmez | running ile startup aynı, ikisinde de hata | Satırı düzelt, kaydet |
| E3 | Yönetim SVI'si kapalı | Kullanıcılar çalışır, switch'e ping yok | Vlan99 administratively down | `no shutdown` |
| E4 | Adres yanlış SVI'da ya da default-gateway yok | Yönetici VLAN'ından ya da başka ağdan erişim yok | Adres Vlan1'de; `ip default-gateway` yok | Adresi doğru SVI'ya taşı; default-gateway ekle |
| E5 | SSH çalışmıyor | Bağlantı reddediliyor | `show ip ssh` Disabled; `login local` ya da kullanıcı yok | RSA anahtarı, kullanıcı, `login local`, `transport input ssh` |

## 6. Arıza senaryoları

> **Uygulamada:** S1–S5 Sorun Çöz'de `mgmt-unsaved-lost`, `mgmt-reload-revert`, `mgmt-saved-fault`,
> `mgmt-svi-down`, `mgmt-wrong-vlan` kimlikleriyle Labber'da çalışır. Hepsinde son hedef
> `q.saved('SW1')`: çözüm kaydedilmeden senaryo bitmez.

### S1 · Başlangıç · Gece kesintiden sonra switch'e ulaşılamıyor (E1)

- **Belirti:** Dün Vlan99'a yönetim adresi verildi, ADMIN ping atabiliyordu. Gece elektrik kesildi; sabah ulaşılamıyor.
- **Neden:** Yönetim ayarı kaydedilmemişti.
- **Çözüm:** SW1 → `interface vlan 99` → `ip address 192.168.99.2 255.255.255.0` → `no shutdown` → `copy running-config startup-config`
- **Hedefler:** ADMIN → 192.168.99.2; SW1 kayıtlı.

### S2 · Başlangıç · Kaydedilmemiş hatalı değişikliği geri al (reload / no)

- **Belirti:** Biri bir port ayarını değiştirdi, PC-02 düştü; ne yapıldığı bilinmiyor, kaydedilmemiş.
- **Neden:** SW1 Fa0/2 kaydedilmeden VLAN 20'ye alındı.
- **Çözüm:** SW1 → `reload` → `no` → onay
- **Hedefler:** PC-01 → PC-02; SW1 kayıtlı.

### S3 · Orta · Yeniden başlatma hatayı düzeltmiyor (E2)

- **Belirti:** PC-02 ulaşamıyor; switch yeniden başlatıldı, sorun sürüyor.
- **Neden:** Fa0/2 kapatılmış ve kaydedilmiş.
- **Çözüm:** SW1 → `interface fa0/2` → `no shutdown` → kaydet
- **Hedefler:** PC-01 → PC-02; SW1 kayıtlı.

### S4 · Orta · Kullanıcılar çalışıyor, switch yönetilemiyor (E3)

- **Belirti:** PC'ler sorunsuz; ADMIN 192.168.99.2'ye ping atamıyor.
- **Neden:** Vlan99 administratively down.
- **Çözüm:** SW1 → `interface vlan 99` → `no shutdown` → kaydet
- **Hedefler:** ADMIN → 192.168.99.2; PC-01 → PC-02; SW1 kayıtlı.

### S5 · İleri · Yönetim adresi yanlış VLAN arayüzünde (E4)

- **Belirti:** Adres 192.168.99.2, arayüz up görünüyor ama VLAN 99'daki ADMIN ulaşamıyor.
- **Neden:** Adres Vlan1'de.
- **Çözüm:** SW1 → `interface vlan 1` → `no ip address` → `shutdown`; `interface vlan 99` → `ip address 192.168.99.2 255.255.255.0` → `no shutdown` → kaydet
- **Hedefler:** ADMIN → 192.168.99.2; SW1 kayıtlı.

## 7. Kısa sınav

1. running-config nerede durur, startup-config nerede? **RAM; NVRAM.**
2. Kaydedilmemiş hatalı değişiklikten en hızlı dönüş? **`reload`, "Save?" sorusuna `no`.**
3. Kaydedilmiş bir hata reload ile düzelir mi? **Hayır; düzeltip yeniden kaydetmek gerekir.**
4. Katman 2 switch'e ağdan ulaşmak için adres nereye verilir? **Bir SVI'ya (ör. `interface vlan 99`).**
5. `enable secret` ile `enable password` farkı? **secret karma olarak saklanır ve önceliklidir.**

## 8. Doğrulama notları

Kaynaklar: Cisco IOS yapılandırma dosyası yönetimi (running/startup, `copy`, `configure replace`), Catalyst yönetim SVI'si ve `ip default-gateway`, IOS SSH yapılandırma kılavuzu; CCNA 200-301 4.8 (SSH), 5.3 (parolalar).

| İddia | Sonuç |
| --- | --- |
| `copy tftp: running-config` birleştirir, değiştirmez | Doğru |
| reload kaydedilmemiş değişiklikte "Save? [yes/no]" sorar | Doğru |
| SSH için RSA anahtarı ve domain-name gerekir | Doğru |
| `service password-encryption` type 7, kolay çözülür | Doğru |

**Motor gereksinimleri** (Labber'da denendi)

- [x] running/startup, `copy running-config startup-config`, `reload` ve "Save?", güç döngüsü, yönetim SVI'si
- [x] Beş senaryo `query` doğrulamasıyla, `q.saved` dahil
- [ ] SSH, parola, TFTP, `configure replace` yok (okuma)
