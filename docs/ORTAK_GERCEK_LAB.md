# Ortak topolojiden operatör kontrollü Gerçek Lab

Mevcut AğLab `app: AgLab, version: 23` topoloji biçimi korunur. Öğrenci tarayıcısı yalnız JSON indirir; Docker, shell veya yönetici API çağrısı yapmaz. Yetkili operatör Linux üzerinde Containerlab/Docker kurulu ayrı bir ortam kullanır. Gerçek sonuç raporu, mevcut Paket Dedektifi rapor alanında açılır; dosya imzası doğrulanmaz ve rapor canlı paket yakalaması değildir.

## Dışa aktarma ve çalıştırma

```sh
python3 real-lab/shared_topology.py real-lab/examples/shared-vlan10.aglab.json --out /tmp/aglab-export
# Yalnız veri dosyaları üretilir; henüz hiçbir konteyner başlamaz.
sudo python3 real-lab/shared_smoke.py --execute
sudo python3 real-lab/extended_routing.py --execute
sudo python3 real-lab/shared_smoke.py --topology aglab-operator-topology.json --source pc1 --target pc2 --expect success --execute
```

İlk komut, mevcut JSON'dan `lab.clab.yml` ve incelenebilir `plan.json` oluşturur. Çalıştırma betiği plan dosyasını komut olarak kabul etmez; kaynak topolojiyi yeniden doğrular. Hazır suite iki temsilî girdi kullanır: 2 PC/2 switch VLAN10 örneği ve özgün AGL-024 başlangıç topolojisi. Operatör kendi dışa aktarılan JSON'unu aşağıdaki seçenekle aynı doğrulama sınırları içinde çalıştırabilir. Genel bir öğrenciden komut çalıştırma servisi yoktur.

## Kesin dönüşüm sınırı

2–4 tek arayüzlü PC, 1–2 switch, en fazla 8 bağlantı, döngüsüz topoloji. IPv4 RFC1918 host adresleri; switch access/trunk VLAN ve native/allowed VLAN bilgileri. Router, yönlendirme/gateway, port-security, bilinmeyen alanlar, döngüler, rastgele imaj/exec/bind alanları reddedilir. Fiziksel portlar sabit `ethN` adlarına eşlenir. Kaynakta PC MAC'i yoksa yerel MAC üretilir ve rapora yazılır. Dönüştürücü özgün JSON'u değiştirmez. Orman desteği STP gerektirmez; bu aktarım klasik STP veya RSTP doğrulaması değildir.

Varsayılan suite sağlıklı örnekte pozitif ICMP, yanlış access VLAN, onarım, trunk allowed VLAN kaldırılması ve onarım denetler. AGL-024'te dört PC/iki switch ile VLAN10 başlangıç başarısızlığı, uplink trunk onarımı ve VLAN10/20 pozitif ICMP doğrulanır. Başarısız olması beklenen ping testinin geçmesi, ağın çalıştığı anlamına gelmez: rapordaki `expected_success` ve gerçek çıkış kodu birlikte okunmalıdır.

## İleri FRR ve IPv6 senaryosu

`extended_routing.py` mevcut üç router/iki PC altyapısını kullanır. Doğrudan r1–r3 bağlantısı kapatılır; r1 LAN area1, r1–r2 area0, r2–r3 ve hedef LAN area2 olur. O IA rota, ABR r2 üzerinden gerçek ICMP, passive transit arızası/onarımı ve area2 `/23` özetinin `/24` yerine kullanılması sınanır. Yalnız show çıktısına dayanılmaz.

IPv6 ayrı ULA adresleri, üç router üzerinden statik rotalar, gerçek ND komşu MAC öğrenmesi ve ICMPv6 kullanır. r2 hedef rotası kaldırıldığında veri iletimi kesilmeli, geri konunca düzelmelidir. SLAAC, DHCPv6, OSPFv3, IPv6 tarayıcı CLI'si uygulanmamıştır. Bu görevler 40 özgün Akademi labının dışında operatör senaryolarıdır.

## Sonraki protokol seçimleri

| Alan | Tarayıcı / hazır MIT motor | Gerçek altyapı ve tercih | Bu teslimat |
|---|---|---|---|
| IPv6 | Mevcut motorlar IPv4 ağırlıklı; upstream desteği entegrasyon sayılmaz | Linux ND/ICMPv6, FRR statik IPv6 | Sınırlı native senaryo |
| DHCP/relay | Eğitim modeli mevcut; MIT kapsamı dışı | İzole dnsmasq/relay, lisans ve servis yapılandırması ayrıca incelenmeli | Yeni native entegrasyon yok |
| ACL | AğLab eğitim modeli; MIT kapsamı dışı | Linux nftables pozitif/negatif forwarding testi | Ertelendi |
| NAT/PAT | AğLab eğitim modeli; MIT kapsamı dışı | İzole namespace/nftables; gerçek internet gerekmez | Ertelendi |
| DNS/TCP/UDP | Gerçek soket/servis davranışı yok | Ayrı istemci/sunucu, UDP/TCP ve timeout kanıtları | Ertelendi |
| RSTP | Tarayıcı STP modeli RSTP değildir | mstpd gerçek daemon, kernel bridge kullanıcı alanı entegrasyonu gerekir | İnceleme; daemon kurulmadı |
| LACP | Tarayıcıda gerçek LACP yok | Linux bonding 802.3ad, üye durumları ve tek link kaybı testi gerekir | İnceleme; entegre değil |
| Port-security / snooping | Eğitim port-security; gerçek karşılık doğrulanmadı | Linux bridge tek başına Cisco politikası değildir; ayrı kontrol katmanı gerekir | Tamamlandı denmez |

Kaynaklar: [FRR OSPF](https://docs.frrouting.org/en/latest/ospfd.html), [FRR IPv6](https://docs.frrouting.org/en/latest/ipv6.html), [Linux bonding](https://docs.kernel.org/networking/bonding.html), [mstpd](https://github.com/mstpd/mstpd), [Cisco CCNA](https://www.cisco.com/site/us/en/learn/training-certifications/exams/ccna.html). CCNA ağ erişimi/IP bağlantısı/IP servisleri kapsamı ve mevcut 40 görevden bağımsız eksik IPv6 nedeniyle bu turda öncelik statik IPv6 ve tekrar kullanılabilir ortak VLAN aktarımıdır. Yeni üçüncü taraf kod eklenmemiştir; mevcut FRR/Linux çalışma ortamı kullanılır. mstpd kaynakları kopyalanmamıştır.

## Dağıtım ve kanıt

Kök HTML eski kaynak tabanıdır. Kullanılacak sürüm başarılı genel CI'nın öğrenci ZIP'indeki derlenmiş HTML'dir. `html-build-manifest.json` HTML ve gömülü modül SHA256'larına ek olarak `source_commit` içerir. Yerel kaynaksız derlemede commit `null`, kimlik `unverified local build` olur; kimlik uydurulmaz. Commit kimliği dosya imzası değildir. Native raporları ayrı workflow artifact'lerinden alınır; genel ZIP başarısı yeni native job başarısı yerine geçmez.

Özgün 40 görev ve öğrenci/öğretmen ayrımı değiştirilmemiştir. `LAB_MOTOR_HARITASI.md`, öğrenci dosyalarının gerçek içeriği ve hash'lerinden yeniden üretilebilir. UX/Akademi planlama dalına değişiklik yapılmaz. PR taslak kalır.
