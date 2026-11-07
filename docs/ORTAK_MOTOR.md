# Ortak motor: protokol ve port güvenliği kapsamı

Şube olayı veya marka/model hikâyesi eklenmez. Senaryolar genel eğitim örnekleridir;
komutlar mevcut Cisco-benzeri CLI dilindedir. Gerçek IOS veya protokol paketleri
çalıştırılmaz. Derslerdeki ileri örnekler için destek sınırı ayrıca görünür yazılır.

## Motor

- `findPath(..., strict, options)` mevcut beşinci konumsal parametreyi korur.
  Strict arama VLAN'ı taşımayan bağlantıları atlar. Farklı alt ağ ping'i önce
  strict yolu, bulunamazsa açıklayıcı mevcut hata yolunu dener. Aynı switch'teki
  iki VLAN arasında router'a giden ve switch'e farklı VLAN'da dönen yol sınanır.
- Switch fiziksel arayüzünde `portSecurity {enabled,max,violation,macs}` ve
  `errdisabled` kayıtları vardır. Secure MAC tablosu boşsa maksimuma kadar öğrenir.
  İhlalde `shutdown` modu portu err-disable yapar; `restrict` ve `protect` frame'i
  düşürür ama portu kapatmaz. Toparlanmak için izinli MAC'ı düzeltip `shutdown`,
  ardından `no shutdown` gerekir. Sadece `no shutdown` ihlali sıfırlamaz.
- OSPF alanları: `{pid,routerId,networks:[{network,wildcard,area}]}`. Komşuların
  aynı L2 segmentte, aynı IPv4 subnet/mask ve area'da olması gerekir. Process ID
  yereldir; iki cihazda farklı olabilir. İlan edilen bağlı ağlar aynı-area bağlı
  bileşeninde birim hop maliyetiyle öğrenilir, AD 110 / `O` olarak seçime girer.
  Gerçek SPF/LSDB, ABR, timer, passive-interface, authentication yoktur.
- BGP alanları: `{asn,neighbors:[{ip,remoteAs}],networks:[{network,mask}]}`.
  Doğrudan erişilen eBGP komşuları karşılıklı tanımlanmalı ve remote-AS değerleri
  eşleşmelidir. Yalnız etkin bağlı ağın tam prefix'i ilan edilir. AS döngüsü
  önlenir; deterministik hop modeliyle AD 20 / `B` rotaları oluşur. Gerçek TCP/179,
  iBGP, policy, route-map, prefix-list ve redistribution yoktur.
- Rotalar her tanı/iletimde güncel yapılandırmadan hesaplanır. Komşu/bağlantı
  bozulunca öğrenilen rota kullanılmaz. LPM, AD, statik ve bağlı rota öncelikleri
  ortak `routeLookup` içinde korunur; protokol için ayrı ping başarı bayrağı yoktur.
- JSON kaydet/yeniden aç/içe aktar yeni alanları taşır. Tanımsız iç alanlar reddedilir.
  Özgün Packet Tracer arşiv mekanizması ve 40 labın kaynak dosyaları değiştirilmez.
- DHCP Discover, henüz IP/gateway almamış istemciden normal IP rotasıyla aranmaz:
  VLAN içi L2 yol önce yerel sunucuya veya doğru helper arayüzüne gider; relay'den
  sunucuya devam eden yol ortak yönlendirme motorunda doğrulanır.

## Senaryo verisi ve sürüm kapısı

`simulator/network-scenarios.json` yeni dört topolojiyi ve mevcut ortak motor
görevlerinin çözüm tariflerini içerir. Genel yeni örnek için bir kaydı kopyalayıp
`id`, `title`, `symptom`, `cause`, `hints`, `topology`, `solution` ve `verify`
alanlarını doldurmak yeterlidir; JavaScript çözüm kodu yazılmaz. `solution` cihaz
adı ve gerçek CLI komutlarından oluşur. `$SOURCE_MAC` yalnızca kaynak cihazın MAC
adresiyle değiştirilir; veri JavaScript olarak çalıştırılmaz. HTML'yi tekrar
üretmek için `python build_simulator.py` ve `python build_academy.py` çalıştırılır.
Ping şablonlarında kaynak `PC-01`, hedef `PC-02` adları kullanılır; IP, VLAN ve
ara cihazlar veri dosyasında değiştirilebilir. Denetim kayıt sayısını dosyadan
okur; yeni genel örnek eklemek için test betiğine kimlik veya sayı eklenmez.

Yerleşik regresyon düğmesi ve `python tests/test_aglab_network_features.py` aynı 17
tarifi ortak motorda yürütür: başlangıç hedefi sağlanmamalı, çözüm komutları sonrası
sağlanmalıdır. STP halka görevi bir erişim arızası değildir; başlangıçta hedef
root SW-03 değildir, çözüm sonrası SW-03 root olmalı ve ping sürmelidir. DHCP
görevinde başarılı lease alınması kontrol edilir. Bunlar yanlış biçimde ilk ping
başarısız diye raporlanmaz. Denetim sonunda kullanıcı topolojisi ve Akademi oturumu
geri yüklenir. Betik ve yerleşik denetim sürüm CI'ında zorunludur; sonuçlar
`network-scenario-results.json` ve `network-audit.md` dosyalarına yazılır.

## Erişilebilirlik bulguları ve doğrulama

- Ortak senaryo paneli iki kapalı details içindeydi: Lab'da görünür bölgeye taşındı.
- Sorun Çöz'den doğrudan erişim eksikti: klavyeyle çalışan geçiş düğmesi ve dört
  eski görev için ortak motora yönlendirme eklendi.
- CLI cihazı/komutu, yeniden adlandırma, kaynak/hedef kontrollerinin görsel
  bağlamına bağımlılığı azaltıldı: açık erişilebilir adlar eklendi.
- Odak göstergesi, açık temada koyu düğme zemini/koyu metin ve sabit koyu CLI
  pencere renkleri düzeltildi; iki tema için değişkenlerle tutarlı renkler kullanılır.
- Senaryo sonucu `role=status` / `aria-live=polite` ile duyurulur. Panel adlandırılmış
  region'dır. Çözüm metinleri HTML olarak yorumlanmaz.
- Chromium denetimi görünür Lab form etiketlerini, klavyeyle Sorun Çöz→Lab→yükle
  akışını, cihaz CLI'sini ve kritik kontrollerin iki temada en az 4.5:1 metin
  kontrastını raporlar. Tam ekran okuyucu konuşması (NVDA/VoiceOver), tüm ders
  resimlerinin alternatif metinleri ve ileri araçların tüm kombinasyonları elle
  sınanmış sayılmaz; otomatik rapor bu sınırı açıkça belirtir.
