# Motor bulguları

Testlerin ortaya çıkardığı, Labber motorunun gerçek IOS/VPCS'ten farklı davrandığı ve motorda
düzeltilen noktalar. Her satırda bulgu, gerçek davranış, düzeltme ve bunu sınayan test.

## I-1 (içe aktarma ve düzenleyici Labber'a)

| Bulgu | Gerçek davranış | Düzeltme | Test |
|---|---|---|---|
| Dinamik MAC girdileri yaşlanmıyordu | IOS `mac address-table aging-time` varsayılanı 300 s: son çerçeveden 300 s sonra girdi düşer, trafik tazeler | `src/sim/runtime.ts` `AgingSet` (öğrenme zamanı), okurken (`show mac address-table`, değerlendirme) süresi dolan girdiler silinir | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| Access VLAN değişince eski MAC girdisi yeni VLAN'da görünüyordu | IOS portun VLAN'ı/kipi değişince o portta öğrenilmiş dinamik girdileri siler; adres yeni VLAN'da yeniden trafik gönderince öğrenilir | `LabRuntime.flushRevlannedPorts` (commit'te port imzası: kip/access/native VLAN) | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| `clear mac address-table dynamic` bütün switch'lerin tablosunu siliyordu | IOS yalnız komutun çalıştığı switch'in tablosunu temizler | `LabRuntime.clearMacs`/`seenOn` (switch başına gizleme; adres yeni trafikte yeniden görünür; **doğrulanmadı:** trafiğin o switch'ten geçip geçmediği ayrımı yok) | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| STP kök vektörü en çok 64 turda yayılıyordu | 802.1D'de kök bilgisi her köprüden geçer; döngüsüz zincirde tek kök ve bloklu port yok | `computeStp` tur sayısı köprü sayısı + 1 (**doğrulanmadı:** IOS max-age/mesaj yaşı 802.1D çapını sınırlar; Labber zamanlayıcı modellemez) | `tests/sim/large_topology.test.ts`, `test_aglab_large_topology` |
| Ayrıcalık kipi testlerde ortak sanılıyordu | IOS: kip cihaz başına oturumdur | — (motor doğru; test uyarlandı) | `test_aglab_trunk_defaults` |
| "allowed vlan all" AğLab'a yazılamıyordu (kayıt/dışa aktarma eksik) | AğLab "hepsi"ni 1-4094 listesiyle ifade eder (PKT dönüştürücüsü de) | `toAglab` null → 1-4094 | `tests/sim/bridge.test.ts`, `test_aglab_trunk_defaults` |
| PKT IOS metin yoluyla kurulan durum AğLab görünümüne yazılamıyordu (kayıt kaybı) | — (köprü hatası) | `toAglab`: IOS `dynamic auto` port AğLab `access` gösterimiyle; metin yolu yalnız metin cihazı hâlâ tarif ediyorsa | `test_aglab_persistence` |
