# İlk uyarlama grubu ve kaynak denetimi

30 Ekim 2026, main faef51b temel alınmıştır. Kaynak paket önceki yerel
çalışmanın outputs/AgLab_Akademi_Ilk_40_TR.zip ve açılmış
aglab-akademi-ilk-40 dizininde bulundu. Bu paket için hazırlanmış Türkçe
içeriktir; Cisco tarafından doğrulanmış laboratuvar paketi değildir.

AGL-006–040 özgün JSON dosyaları baytları değiştirilmeden source/ içine
alındı. SHA256.json tüm 40 kaynağın özetini içerir. Her dosyanın 100 puanlık
rubriği, cevap anahtarı, hedef durum yolları ve ayrı başlangıç/çözüm
topolojileri karşılaştırıldı; tutarsızlık bulunmadı. Bu içerik denetimi,
çalıştırılmamış laboratuvarların motor desteğini kanıtlamaz.

## İlk grup: AGL-006–010

- 006: üç uçlu yıldız; bağlantı ekleme ve arıza kapsamı.
- 007: çift yönlü ping; ICMP ve HTTP ayrımı.
- 008: yerel teslim ve ARP kavramsal soruları.
- 009: aynı fiziksel ağdaki yanlış IPv4 adresini düzeltme.
- 010: kablo ve adres arızası olan yerel ağ mini projesi.

Görevler, topolojiler, cevaplar ve rubrikler özgün kaynaktan aktarılmıştır.
Yeni cevap kontrollerinde soru metnine uygun seçenekler sunulur; beklenen
değerler özgün cevap anahtarından gelir. Öğrenci/öğretmen ayrımı korunur.
ARP soruları kavramsaldır; gerçek ARP paket yakalama görevi eklenmemiştir.
ICMP önceki sürümdeki deterministik beş deneme uyarlamasını kullanır;
gerçek zamanlı icmp-5-v1 uygunluğu iddia edilmez.

## Sonraki gruplar

Her laboratuvarın sonucu adaptation-audit.json dosyasında ayrı yer alır.

1. AGL-011–020: sayı, IPv4 ve CIDR cevap girişleri/normalizasyonu;
   alt ağ hesaplarını ve öğrenci çözümünü Chromium ile doğrulama.
2. AGL-021–030: MAC/VLAN/trunk soruları; vlans ve allowed için sıra
   bağımsız küme karşılaştırması. 023, 026, 027, 030 negatif ICMP sağlık
   önkoşulları desteklenene kadar engellidir. Kabloyu koparmak yalıtım
   başarısı sayılamaz.
3. AGL-031–040: arayüz nesnelerinde türetilmiş alanların ve rota kümelerinin
   semantik karşılaştırması; statik/çok atlamalı routing testleri.
   033 açık source_interface ve destination_ip probe bağdaştırıcısı
   olmadan engellidir.

Bekleyen/engelli içerikler öğrenci listesine eklenmez. Bu gruplar henüz
çalıştırılmadı; OSPF/BGP/ACL/NAT/DHCP içeriği uydurulmadı.
