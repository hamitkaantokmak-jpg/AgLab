# AğLab Gerçek Lab MVP – iki FRR router + iki PC

Bu klasör mevcut çevrimdışı AğLab simülatöründen **bağımsızdır**. İlk gerçek lab, Linux sunucusunda Docker ve Containerlab ile dört kapsayıcı çalıştırır; web arayüzü ve çok kullanıcılı sunucu henüz yoktur.

## Gereksinimler

- Linux makine/VM, Docker Engine ve Containerlab (FRR `kind: frr` destekleyen sürüm)
- Docker socket / Containerlab kurulum yetkileri; **yalnızca güvenilen yönetici makinesinde çalıştırın**.
- İlk kurulumda `quay.io/frrouting/frr:containerlab-10.7.1` ve `alpine:3.20` imajlarını indirmek için internet.

## Çalıştırma

Depo kökünden:

```sh
containerlab deploy -t real-lab/topology.clab.yml
docker exec clab-aglab-real-mvp-pc1 ping -c 3 -W 2 192.168.20.10
docker exec clab-aglab-real-mvp-r1 vtysh -c "show ip route"
containerlab destroy -t real-lab/topology.clab.yml
```

Beklenen: PC1 → R1 → R2 → PC2 yönünde gerçek ICMP, statik rota `192.168.20.0/24`; dönüş için R2 üzerinde `192.168.10.0/24`. PC'lerde hedef ağlara varsayılan yol yerine açık statik rota eklenmiştir.

Topoloji: `pc1 (192.168.10.10/24) -- r1 (192.168.10.1/24; 10.0.12.1/30) -- r2 (10.0.12.2/30; 192.168.20.1/24) -- pc2 (192.168.20.10/24)`.

### Sorun giderme

- `containerlab inspect -t real-lab/topology.clab.yml` ile düğümlerin durumunu görün.
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
