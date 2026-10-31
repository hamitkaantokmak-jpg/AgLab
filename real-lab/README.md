# AğLab Gerçek Lab MVP – iki FRR router + iki PC

## Yerel öğrenci tanılama ekranı

Öğrenci servisi çalışırken aynı makinede `http://127.0.0.1:8766/` adresini açın.
Öğretmenin verdiği **ayrı öğrenci anahtarıyla** bağlanın; yönetici anahtarını bu
ekrana girmeyin. Ekran yalnızca izin verilen router'ları ve üç sabit tanıyı gösterir.
`Tanıyı göster` mevcut görüntüyü okur; lab başlatmaz, komut çalıştırmaz veya
görüntü üretmez. Yenilemeyi operatör/exporter yapar. Bu ekran 40 çevrimdışı labın
arayüzünden ayrıdır; mevcut simülatör HTML'si değiştirilmez.

Anahtar yalnızca sayfa belleğinde tutulur; girişten sonra parola alanı temizlenir,
cookie veya tarayıcı depolamasına yazılmaz. `Bağlantıyı kapat` ya da sayfadan
ayrılma anahtarı ve sonucu temizler; devam eden isteğin geç yanıtı gösterilmez.
Tanı çıktıları HTML olarak yorumlanmaz. Başarısız, eksik veya 60 saniyeden eski
görüntüler gösterilmez; ekranda açık kalan sonuç da süresi dolunca kaldırılır.

Sayfa ve sabit JS/CSS dosyaları anahtar istemeden yüklenir; router kapsamı ve
tanılar kimlik doğrulaması gerektirir. İstekler yalnızca aynı öğrenci servisine
GET olarak gider. CSP dış kaynakları, satır içi betikleri, form gönderimini ve
başka sitelerde çerçeve içinde açılmayı engeller. Ekran bir kullanıcı/tenant oturum
sistemi değildir; `Bağlantıyı kapat` sunucudaki paylaşılan tokenı iptal etmez.
Uzak erişim için TLS ve uygun kimlik/tenant izolasyonu ayrıca gerekir.

`test_student_ui.py` gerçek Chromium ile yanlış anahtar, router kapsamı,
çıktının metin olarak gösterimi, tarayıcıda kalıcı anahtar bırakmama, hata/süre
dolumunda eski sonucu temizleme ve bekleyen istekte çıkış/yeniden bağlanmayı sınar.
CI test raporlarıyla birlikte `dist/student-ui.png` ekran görüntüsünü saklar.

## Yenilemede öğrenci okuma izinlerini koruma

Paylaşılan görüntü için `AGLAB_STUDENT_READER_GID` ortam değişkenine öğrenci
hesabının sayısal okuyucu grup kimliğini verin. Örnek, önceden hazırlanmış
`aglab-student` hesabı için **root yönetici oturumunda**:

```sh
export AGLAB_STUDENT_READER_GID="$(id -g aglab-student)"
install -d -o root -g "$AGLAB_STUDENT_READER_GID" -m 0750 /srv/aglab-share
export AGLAB_STUDENT_SNAPSHOT=/srv/aglab-share/snapshot.json
export AGLAB_STUDENT_ROUTERS=r1
python3 real-lab/export_student_snapshot.py
```

Exporter önce özel `0600` geçici dosyaya tam JSON yazar, sonra seçilen grubu ve
`0640` iznini ayarlar ve ancak bundan sonra atomik olarak yayımlar. Böylece ilk
export ve her yenileme öğrenciye yalnızca okuma verir; arada elle `chmod` gerekmez.
Eski dosyanın geniş veya yazılabilir izinleri kopyalanmaz. Grup/izin ayarı başarısız
olursa önceki görüntü korunur, geçici dosya silinir. Hedef dizin export işleminin
hesabına ait olmalı ve grup/diğer kullanıcılar tarafından yazılabilir olmamalıdır.

Bu ayar yalnızca POSIX dosya izinleri olan sistemlerde desteklenir. Grup seçilmezse
dosya güvenli varsayılan `0600` izninde kalır. Öğrenci hesabına yalnızca kendi
kapsamı için ayrılmış bir okuyucu grubu verin; Docker grubu vermeyin. Dizin başka
öğrencilerin görüntülerini içermemelidir. Exporter zaten bu grubu ayarlayabilecek
yetkiyle çalışmalıdır; başarısız olursa yetkileri genişletmek yerine kurulumu düzeltin.

`test_export_permissions.py` ilk yayın, yenileme, yayımdan önce izin ayarı,
güvensiz dizin reddi ve hata halinde önceki dosyanın korunmasını sınar. Canlı CI,
servis çalışırken ikinci export yapıp yetkisiz öğrencinin yeni görüntüyü
okuyabildiğini ve hâlâ yazamadığını/Docker'a erişemediğini doğrular.

## Canlı öğrenci zinciri testi

`sudo python3 real-lab/student_live_smoke.py --execute`, ayrılmış Linux runner'da
FRR topolojisini kurar, gerçek yönetici HTTP API'sini başlatır, üretim exporter'ıyla
yalnızca r1'in üç tanısını dosyaya aktarır ve öğrenci sunucusunu `nobody` hesabıyla
çalıştırır. Öğrenci HTTP çıktıları export edilen üç görünümle birebir karşılaştırılır;
rota çıktısında gerçek `192.168.20.0/24` ağı aranır. Öğrenci tokenının yönetici
API'sinde ve yönetici tokenının öğrenci API'sinde reddi de sınanır. Dosya/Docker
yetkileri, router kapsamı ve eski/eksik görüntü kontrolleri aynı zincirde çalışır.

CI bu testi zorunlu çalıştırır. `--execute` olmadan yalnızca dry-run gösterilir.
Mevcut aynı adlı lab bulunursa test onu değiştirmeden durur. Başlatılan yönetici
ve öğrenci süreçleri ile konteynerler hata halinde de kapatılmaya çalışılır; CI
ayrıca kalan konteynerleri denetler. Bu test TLS, çok kiracılı oturum, öğrenci UI'si
veya üretim dağıtımının tamamını doğrulamaz. Sentetik hesap yalıtım testi ayrıca
korunmuştur; canlı zincir doğrulaması için bu yeni testin başarılı sonucu gerekir.

## Linux hesap yalıtımı doğrulaması

`sudo python3 real-lab/student_isolation_smoke.py --execute` yalnızca ayrılmış
Linux test makinesinde çalıştırılır. `--execute` olmadan sadece yapılacak kontrolleri
yazar. Canlı CI bu kontrolü zorunlu çalıştırır: öğrenci sunucusu gerçekten `nobody`
UID/GID'siyle, ek gruplar ve yönetici ortamı olmadan başlatılır. Ayrı bir süreç aynı
kimlikle yönetici gizli dosyasını okuyamadığını, görüntü dosyasına/dizinine
yazamadığını ve gerçek Docker socket bağlantısının `EACCES` ile reddedildiğini
doğrular. Socket yoksa kontrol başarılı sayılmaz.

Gerçek HTTP üzerinden izinli okuma, yönetici tokenının reddi, router kapsamı,
yazma yöntemlerinin reddi, eski/eksik görüntüde kapalı kalma sınanır. Test verisi
sentetiktir; bu adım canlı FRR → exporter zincirini veya TLS/çok kiracılı dağıtımı
doğrulamaz. Mevcut canlı Containerlab/ICMP testi ayrı çalışır. Geçici dosyalar ve
öğrenci süreci hata durumunda da temizlenir; hesap/grup oluşturulmaz veya değiştirilmez.

## Ayrı salt okunur öğrenci servisi

`student_api.py`, yönetici API'sine bağlanmayan ve Docker/komut çalıştırmayan ayrı bir
işlemdir. Yalnızca operatörün hazırladığı JSON görüntüsünden izin verilen router'ın
`routes`, `interfaces`, `neighbors` çıktısını sunar. Bu bir canlı terminal veya çok
kiracılı öğrenci oturum sistemi değildir. Mevcut 40 çevrimdışı lab değişmez.

Güvenilen yönetici ortamında, mevcut yönetici API'si çalışırken:

```sh
export AGLAB_STUDENT_SNAPSHOT=/srv/aglab-share/snapshot.json
export AGLAB_STUDENT_ROUTERS=r1
python3 real-lab/export_student_snapshot.py
```

Exporter `AGLAB_LAB_TOKEN` kullanarak sabit loopback adresinden yalnızca açıkça
seçilen router'ların üçer tanısını alır; dosyaya kapsam dışı router yazmaz ve
yönetici API'sinin işlem kilidine uyar. Tümü başarılıysa yalnızca `ok` ve `output`
alanlarını zaman damgasıyla atomik olarak yazar. Hata durumunda önceki dosya kalır;
60 saniye dolunca öğrenci servisi bunu reddeder. Proxy ortamını kullanmaz ve
yönlendirmeleri takip etmez. Düzenli yenileme operatörün sorumluluğundadır; bu
istek aynı topoloji anının atomik görüntüsü değildir. Çıktılarda lab IP'leri ve
arayüz bilgileri bulunur; yalnızca o öğrenciye uygun veriyi paylaşın.

Öğrenci servisini **ayrı, yetkisiz bir işletim sistemi hesabında** başlatın:

```sh
unset AGLAB_LAB_TOKEN
export AGLAB_STUDENT_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(36))')"
export AGLAB_STUDENT_SNAPSHOT=/srv/aglab-share/snapshot.json
export AGLAB_STUDENT_ROUTERS=r1
python3 real-lab/student_api.py
```

Bu hesaba Docker grubu/socket erişimi, yönetici tokenı, yönetici servis ortamı veya
paylaşım dizinine yazma izni vermeyin. Yukarıdaki `AGLAB_STUDENT_READER_GID` ayarı
ilk export ve yenilemelerde salt okunur grup erişimini atomik olarak sağlar.
Dosya ve dizin öğrenci tarafından
değiştirilememelidir. Bunlar dağıtım gereksinimleridir; Python işlemi kendi başına
işletim sistemi yetkilerini düşürmez.

```sh
curl -H "Authorization: Bearer $AGLAB_STUDENT_TOKEN" http://127.0.0.1:8766/api/diagnostics/r1/routes
```

Yönetici tokenını öğrenci tokenı olarak tekrar kullanmayın. Servis, ortamında
`AGLAB_LAB_TOKEN` varsa başlamaz. İzin listesi boşsa veya bilinmeyen router içeriyorsa
başlamaz. Bir servis örneği tek öğrenci kapsamını temsil eder; kimlik/tenant seçimi
istekten alınmaz. Başka öğrenciler için ayrı kapsam, token, dosya ve süreç gerekir
(bu prototip sabit 8766 portunu kullanır; ayrı ağ alanı/makine kullanın).

Yanıtlar: eksik/yanlış token `401`, kapsam dışı router/yol `404`, yazma yöntemleri
`405`, eksik/bozuk/1 MB üstü/60 saniyeden eski görüntü veya başarısız tanı `503`.
Başarısız tanı çıktıları ve fazladan JSON alanları öğrenciye aktarılmaz. Çıktı üst
sınırı 12000 karakterdir. Sunucu yalnızca `127.0.0.1:8766` dinler, CORS izni vermez,
yanıtları önbelleğe aldırmaz ve tokenları loglamaz. Yönetici portunu öğrencilere
proxy etmeyin. Uzak erişim için TLS, oturum doğrulaması, hız sınırı ve öğrenci
başına süreç/ağ izolasyonu ayrıca gerekir; servis şu aşamada internete açılmaz.

Doğrulama: `python3 real-lab/test_student_api.py` gerçek yerel HTTP üzerinden
token/kapsam/yöntem kontrollerini, redaksiyonu, görüntü süresini ve exporter hata
durumunu test eder; Docker veya gerçek öğrenci dağıtımını test etmez. Pipeline bu
testi zorunlu çalıştırır ve öğrenci servisi/exporter/test dosyalarını pakete ekler.

Bu klasör mevcut çevrimdışı AğLab simülatöründen **bağımsızdır**. İlk gerçek lab, Linux sunucusunda Docker ve Containerlab ile dört kapsayıcı çalıştırır. Yerel yönetici paneli ve ayrı öğrenci okuma API'si prototip düzeyindedir; çok kullanıcılı üretim sunucusu değildir.

## Gereksinimler

- Linux makine/VM, Docker Engine ve Containerlab (FRR `kind: frr` destekleyen sürüm)
- Docker socket / Containerlab kurulum yetkileri; **yalnızca güvenilen yönetici makinesinde çalıştırın**.
- İlk kurulumda `quay.io/frrouting/frr:containerlab-10.7.1` ve `alpine:3.20` imajlarını indirmek için internet.

## Çalıştırma

`real-lab` klasöründen (göreli `startup-config` dosyalarının bulunması için):

```sh
cd real-lab
containerlab deploy -t topology.clab.yml
docker exec clab-aglab-real-mvp-pc1 ping -c 3 -W 2 192.168.20.10
docker exec clab-aglab-real-mvp-r1 vtysh -c "show ip route"
containerlab destroy -t topology.clab.yml
```

Beklenen: PC1 → R1 → R2 → PC2 yönünde gerçek ICMP, statik rota `192.168.20.0/24`; dönüş için R2 üzerinde `192.168.10.0/24`. PC'lerde hedef ağlara varsayılan yol yerine açık statik rota eklenmiştir.

Topoloji: `pc1 (192.168.10.10/24) -- r1 (192.168.10.1/24; 10.0.12.1/30) -- r2 (10.0.12.2/30; 192.168.20.1/24) -- pc2 (192.168.20.10/24)`.

### Sorun giderme

- `containerlab inspect -t topology.clab.yml` ile düğümlerin durumunu görün.
- `docker exec clab-aglab-real-mvp-r2 vtysh -c "show ip route"` ile dönüş rotasını doğrulayın.
- Docker / Containerlab erişimi olmadan bu laboratuvarı çalıştırmak mümkün değildir.
- Kapsayıcıları internete açık bir API ile doğrudan yönetmeyin; üretim için kimlik doğrulama, kullanıcı izolasyonu, kota ve sınırlı işlem kümesi gerekir.

## Güvenlik ve lisans

Cisco / LabHub imajları kullanılmıyor veya dağıtılmıyor. Üretime alınmadan önce seçilen FRR ve Alpine imajlarının sürüm ve lisansları ayrı doğrulanmalı; isteğe göre SHA256 digest ile sabitlenmelidir.

## Doğrulama durumu

Genel CI regresyonları ve paketleri doğrular. Ayrı canlı CI, Docker/Containerlab ile gerçek ICMP, öğrenci hesap yalıtımı ve tanılama zincirini sınar. Yalnızca ilgili commitin başarılı CI sonucu doğrulama kanıtıdır.

## Yönetici yaşam döngüsü komutları

`python real-lab/manage.py start` yalnızca bir dry-run gösterir. Yetkili Linux sunucusunda gerçek işlemler için `python real-lab/manage.py start --execute`, `python real-lab/manage.py status --execute` ve `python real-lab/manage.py stop --execute` kullanılır. Komutlar yalnızca depoya eklenmiş sabit topolojiyi kabul eder; serbest komut / dosya yolu veya HTTP uç noktası yoktur.

## Canlı uçtan uca test

**Yalnızca ayrılmış Linux lab makinesinde** `python real-lab/live_smoke.py --execute` çalıştırın. Bu komut Containerlab laboratuvarını kurar, PC1'den PC2'ye gerçek ICMP gönderir ve başarılı/başarısız durumda kaynakları kapatmaya çalışır. Çalıştırılmadan önce aynı isimli başka bir laboratuvar bulunmamalıdır. `--execute` olmadan hiçbir konteyner başlatılmaz. Canlı CI bu testi ilgili PR değişikliklerinde otomatik çalıştırır.

## GitHub üzerinde canlı doğrulama

`.github/workflows/real-lab-live.yml` ilgili `real-lab` ve iş akışı PR değişikliklerinde otomatik çalışır; elle de başlatılabilir. Linux runner üzerinde gerçek Containerlab/ICMP, hesap yalıtımı ve öğrenci tanılama zinciri sınanır. Elle çalıştırmak için GitHub Actions → **Gerçek Lab canlı doğrulama (isteğe bağlı)** → **Run workflow**. Buton için iş akışının varsayılan dalda bulunması gerekebilir. Başarıyı her commitin kendi koşusundan doğrulayın. Kurulum betiği ağdan indirildiği için bu koşuyu yalnızca güvenilen repoda başlatın.

## Yerel yönetici API prototipi

Yalnızca güvenilen Linux lab sunucusunda:

```bash
export AGLAB_LAB_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(36))')"
python3 real-lab/api.py
curl -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab
curl -X POST -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab/start
curl -X POST -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab/status
curl -X POST -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab/stop
```

API yalnızca 127.0.0.1 üzerinde açılır, tek laboratuvarı yönetir, JSON gövdesi/serbest komut kabul etmez ve en az 32 karakterli token ister. İşlemler ortak kilitle korunur; meşgul durumda 409 döner. Yerel yönetici tarayıcı paneli vardır, serbest terminal yoktur. Bu **üretim servisi değildir**: çok kiracılı oturum ve HTTPS proxy dahil değildir. Yönetici tokenını öğrenciye vermeyin; öğrenci okuma servisini ayrı hesap ve izinlerle çalıştırın.

## Yerel yönetim ekranı

API çalışırken **aynı Linux makinesindeki** tarayıcıdan `http://127.0.0.1:8765/` adresini açın. `AGLAB_LAB_TOKEN` ortam değişkenindeki yönetici anahtarını girin. Cihazları görüntüleme, durumu sorgulama, başlatma ve durdurma kontrolleri bulunur. İstekler aynı origin'e gider; anahtar localStorage veya cookie'ye yazılmaz. **Bu ekran halka açık web sitesi veya öğrenciler için güvenli çok kullanıcılı panel değildir.** Henüz terminal, HTTPS proxy ve kullanıcı oturumları yoktur.


## Salt okunur yönlendirici tanılama

Yerel yönetici panelindeki **Tanıyı göster** düğmesi veya kimliği doğrulanmış GET istekleriyle yalnızca `r1` ve `r2` için `routes`, `interfaces` ve `neighbors` görünümleri alınabilir:

```sh
curl -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/diagnostics/r1/routes
curl -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/diagnostics/r2/interfaces
```

İsteklerde serbest komut veya kullanıcıdan gelen shell ifadesi kullanılmaz. Başarısız Docker/FRR tanılaması `502`, kimlik doğrulaması eksikse `401`, izin verilmeyen cihaz/görünüm `404` döndürür. Tanılar Docker konteynerlerini gerektirir; testler HTTP ve mock kapsamındadır, canlı Docker doğrulaması değildir. Bu API yalnızca güvenilen yerel yönetici içindir; öğrenciye veya internete açık sunucu olarak yayınlanmamalıdır.
