# Motor bulguları

Testlerin ortaya çıkardığı, Labber motorunun gerçek IOS/VPCS'ten farklı davrandığı ve motorda
düzeltilen noktalar. Her satırda bulgu, gerçek davranış, düzeltme ve bunu sınayan test.

## I-1 (içe aktarma ve düzenleyici Labber'a)

| Bulgu | Gerçek davranış | Düzeltme | Test |
|---|---|---|---|
| Dinamik MAC girdileri yaşlanmıyordu | IOS `mac address-table aging-time` varsayılanı 300 s: son çerçeveden 300 s sonra girdi düşer, trafik tazeler | `src/sim/runtime.ts` `AgingSet` (öğrenme zamanı), okurken (`show mac address-table`, değerlendirme) süresi dolan girdiler silinir | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| Access VLAN değişince eski MAC girdisi yeni VLAN'da görünüyordu | IOS portun VLAN'ı/kipi değişince o portta öğrenilmiş dinamik girdileri siler; adres yeni VLAN'da yeniden trafik gönderince öğrenilir | `LabRuntime.flushRevlannedPorts` (commit'te port imzası: kip/access/native VLAN) | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| `clear mac address-table dynamic` bütün switch'lerin tablosunu siliyordu | IOS yalnız komutun çalıştığı switch'in tablosunu temizler | `LabRuntime.clearMacs`/`seenOn` (switch başına gizleme; adres yeni trafikte yeniden görünür; **doğrulanmadı:** trafiğin o switch'ten geçip geçmediği ayrımı yok) | `tests/sim/macarp.test.ts`, `test_aglab_mac_learning` |
| PKT IOS metin yoluyla kurulan durum AğLab görünümüne yazılamıyordu (kayıt kaybı) | — (köprü hatası) | `toAglab`: IOS `dynamic auto` port AğLab `access` gösterimiyle; metin yolu yalnız metin cihazı hâlâ tarif ediyorsa | `test_aglab_persistence` |
