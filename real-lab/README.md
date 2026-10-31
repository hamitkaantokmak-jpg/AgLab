# AğLab Gerçek Lab MVP – iki FRR router + iki PC

Bu klasör mevcut çevrimdışı AğLab simülatöründen **bağımsızdır**. İlk gerçek lab, Linux sunucusunda Docker ve Containerlab ile dört kapsayıcı çalıştırır; web arayüzü ve çok kullanıcılı sunucu henüz yoktur.

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

YAML ve dosyalar kod incelemesine açıktır. CI yalnızca statik kontroller yapabilir; Docker/Containerlab ortamında gerçek ping testi ayrı çalıştırılmadan **canlı lab doğrulandı** denemez.

## Yönetici yaşam döngüsü komutları

`python real-lab/manage.py start` yalnızca bir dry-run gösterir. Yetkili Linux sunucusunda gerçek işlemler için `python real-lab/manage.py start --execute`, `python real-lab/manage.py status --execute` ve `python real-lab/manage.py stop --execute` kullanılır. Komutlar yalnızca depoya eklenmiş sabit topolojiyi kabul eder; serbest komut / dosya yolu veya HTTP uç noktası yoktur.

## Canlı uçtan uca test

**Yalnızca ayrılmış Linux lab makinesinde** `python real-lab/live_smoke.py --execute` çalıştırın. Bu komut Containerlab laboratuvarını kurar, PC1'den PC2'ye gerçek ICMP gönderir ve başarılı/başarısız durumda kaynakları kapatmaya çalışır. Çalıştırılmadan önce aynı isimli başka bir laboratuvar bulunmamalıdır. `--execute` olmadan hiçbir konteyner başlatılmaz. CI'da bu işlem otomatik çalışmaz; CI yalnızca statik doğrulama yapar. Gerçek Docker testi henüz bu ortamda çalıştırılmamıştır.

## GitHub üzerinde canlı doğrulama

`.github/workflows/real-lab-live.yml` adlı **elle başlatılan** iş akışı Linux GitHub runner üzerinde Docker ve Containerlab kullanıp laboratuvarı gerçekten başlatmayı, PC1'den PC2'ye ping göndermeyi ve ortamı temizlemeyi dener. GitHub Actions → **Gerçek Lab canlı doğrulama (isteğe bağlı)** → **Run workflow**. GitHub, `workflow_dispatch` iş akışının varsayılan dalda bulunmasını gerektirebilir; bu nedenle PR üzerindeyken buton görünmeyebilir. Gerçek canlı doğrulama başarıyla bitmeden doğrulanmış canlı lab olduğunu iddia etmeyin. Kurulum betiği ağdan indirildiği için bu koşuyu yalnızca güvenilen repoda ve gerekli izinlerle başlatın.

## Yerel API prototipi (henüz web arayüzü yok)

Yalnızca güvenilen Linux lab sunucusunda:

```bash
export AGLAB_LAB_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(36))')"
python3 real-lab/api.py
curl -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab
curl -X POST -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab/start
curl -X POST -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab/status
curl -X POST -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/lab/stop
```

API yalnızca 127.0.0.1 üzerinde açılır, tek laboratuvarı yönetir, JSON gövdesi/serbest komut kabul etmez ve en az 32 karakterli token ister. Bu **üretim servisi değildir**: eşzamanlı çağrı kontrolü, kullanıcı bazlı izolasyon, HTTPS proxy, log redaksiyonu ve yetki seviyesi henüz yoktur. Sunucuyu internete açmayın veya Docker yetkilerini tarayıcıya iletmeyin. Tarayıcı arayüzü ve terminal erişimi sonraki aşamalardır.

## Yerel yönetim ekranı

API çalışırken **aynı Linux makinesindeki** tarayıcıdan `http://127.0.0.1:8765/` adresini açın. `AGLAB_LAB_TOKEN` ortam değişkenindeki yönetici anahtarını girin. Cihazları görüntüleme, durumu sorgulama, başlatma ve durdurma kontrolleri bulunur. İstekler aynı origin'e gider; anahtar localStorage veya cookie'ye yazılmaz. **Bu ekran halka açık web sitesi veya öğrenciler için güvenli çok kullanıcılı panel değildir.** Henüz terminal, HTTPS proxy ve kullanıcı oturumları yoktur.


## Salt okunur yönlendirici tanılama

Yerel yönetici panelindeki **Tanıyı göster** düğmesi veya kimliği doğrulanmış GET istekleriyle yalnızca `r1` ve `r2` için `routes`, `interfaces` ve `neighbors` görünümleri alınabilir:

```sh
curl -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/diagnostics/r1/routes
curl -H "Authorization: Bearer $AGLAB_LAB_TOKEN" http://127.0.0.1:8765/api/diagnostics/r2/interfaces
```

İsteklerde serbest komut veya kullanıcıdan gelen shell ifadesi kullanılmaz. Başarısız Docker/FRR tanılaması `502`, kimlik doğrulaması eksikse `401`, izin verilmeyen cihaz/görünüm `404` döndürür. Tanılar Docker konteynerlerini gerektirir; testler HTTP ve mock kapsamındadır, canlı Docker doğrulaması değildir. Bu API yalnızca güvenilen yerel yönetici içindir; öğrenciye veya internete açık sunucu olarak yayınlanmamalıdır.
