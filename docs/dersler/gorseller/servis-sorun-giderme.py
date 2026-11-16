"""Altyapı servisleri sorun giderme dersi şemaları (docs/dersler/servis-sorun-giderme.md)."""

from figures import Fig


def g1():
    f = Fig(880, 250, "Altyapı servisleri ve portları", "Bu servislerin çoğu UDP kullanır: bir ACL ya da firewall paketleri sessizce düşürür ve hata mesajı gelmez. Arızada önce paketin gidip gitmediğine, yanıtın gelip gelmediğine bakılır.")
    f.table(30, 20, ["Servis", "Port", "İlk kanıt"], [
        ["DHCP", "UDP 67 / 68", "show ip dhcp server statistics"],
        ["NTP", "UDP 123", "show ntp associations"],
        ["SNMP sorgu / trap", "UDP 161 / 162", "show snmp"],
        ["Syslog", "UDP 514", "show logging"],
        ["IP SLA (ICMP yoklama)", "ICMP", "show ip sla statistics · show track"],
    ], [240, 180, 400], mono_cols=(2,))
    f.text(440, 225, "Benzetme: apartmanın görünmeyen hizmetleri: su, saat, sayaç okuma, olay defteri", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 300, "DHCP: DORA'nın koptuğu yer", "İstemcinin Discover'ı relay ile sunucuya ulaşmalı; sunucunun Offer'ı switch'teki snooping'ten geçip istemciye dönmeli; havuzda boş adres olmalı. Her kopma noktasının kendi kanıtı vardır.")
    pc = f.device(90, 110, "laptop", "İstemci", "169.254.x.x")
    sw = f.device(330, 110, "switch", "SW1", "snooping", w=150)
    gw = f.device(560, 110, "l3switch", "SVI 20", "ip helper-address", w=170)
    s = f.device(790, 110, "server", "DHCP", "havuz")
    f.link(pc, sw)
    f.link(sw, gw)
    f.link(gw, s)
    for x, t in [(330, "trust yok / opt 82"), (560, "helper yok"), (790, "havuz dolu")]:
        f.badge(x, 175, "!", tone="err")
        f.text(x, 205, t, size=12, tone="err", bold=True)
    f.text(440, 250, "D → O → R → A: hangi mesajın sayacı artmıyorsa yol oradan kopuk", size=12, tone="accent", bold=True)
    f.text(440, 280, "Benzetme: daire numarası isteyen yeni kiracı, kapıcı (relay) ve güvenlik görevlisi (snooping)", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 280, "NTP: stratum ve senkron olmama nedenleri", "Stratum saat kaynağına uzaklıktır. Senkron olmayan bir sunucudan senkron olunmaz; stratum 16 'senkron değil' demektir. Erişim, sunucunun durumu ve kimlik doğrulama sırayla kontrol edilir.")
    for i, (t, sub, tone) in enumerate([("Stratum 1", "GPS / atom saati", "ok"), ("Stratum 2", "merkez NTP 10.0.100.1", "v2"), ("Stratum 3", "R1, R2 …", "v1")]):
        f.box(40 + i * 200, 40, 170, 80, t, tone, sub=sub, size=14)
        if i < 2:
            f.arrow(210 + i * 200, 80, 240 + i * 200, 80)
    f.box(650, 40, 200, 80, "Stratum 16", "err", sub="senkron değil", size=14)
    f.table(40, 150, ["Kanıt (associations)", "Neden"], [
        ["reach 0", "UDP 123 engelli / yol yok / sunucu kapalı"],
        ["reach artıyor, st 16", "sunucunun kendisi senkron değil"],
        ["reach artıyor, * yok, auth açık", "trusted-key eksik ya da anahtar farklı"],
    ], [300, 500])
    return f


def g4():
    f = Fig(880, 260, "SNMPv3: kullanıcı → grup → görünüm", "NMS bir kullanıcı adı ve güvenlik seviyesiyle sorgular. Kullanıcı bir gruba, grup bir görünüme ve erişim ACL'ine bağlıdır. Zincirin bir halkası tutmazsa yanıt gelmez ya da boş gelir.")
    items = [("NMS", "authPriv · sha · aes", "v3"), ("Kullanıcı", "nms", "v1"), ("Grup", "IZLEME · v3 priv", "v2"), ("Görünüm", "TUMU (iso)", "accent"), ("ACL", "10.0.100.50", "warn")]
    for i, (t, s, tone) in enumerate(items):
        x = 20 + i * 172
        f.box(x, 40, 152, 90, t, tone, sub=s, size=14)
        if i < len(items) - 1:
            f.arrow(x + 152, 85, x + 172, 85)
    f.text(440, 170, "Grup priv ister, NMS authNoPriv sorar → reddedilir", size=12, tone="err", bold=True)
    f.text(440, 200, "Kullanıcılar running-config'te görünmez: show snmp user", size=12, tone="accent", bold=True)
    f.text(440, 235, "Benzetme: kartlı giriş; kart (kullanıcı), yetki grubu, açabildiği kapılar (görünüm), bina girişi (ACL)", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 240, "Syslog: mesaj nerede kayboldu?", "Mesaj önce seviye filtresinden geçer, sonra seçilen kaynak adresle UDP 514 üzerinden sunucuya gider. Zaman damgası NTP'ye dayanır; yanlış saat log'ları karşılaştırılamaz yapar.")
    items = [("Olay", "LINEPROTO-5", "v1"), ("Seviye filtresi", "logging trap", "warn"), ("Kaynak adres", "source-interface", "v2"), ("UDP 514", "kayıp geri istenmez", "v3"), ("Sunucu", "zaman = NTP", "ok")]
    for i, (t, s, tone) in enumerate(items):
        x = 20 + i * 172
        f.box(x, 40, 152, 90, t, tone, sub=s, size=13)
        if i < len(items) - 1:
            f.arrow(x + 152, 85, x + 172, 85)
    f.text(440, 175, "trap warnings (4) → seviye 5 mesajları sunucuya gitmez", size=12, tone="err", bold=True)
    f.text(440, 210, "0 emergencies · 1 alerts · 2 critical · 3 errors · 4 warnings · 5 notifications · 6 info · 7 debug", size=11, mono=True)
    return f


def g6():
    f = Fig(880, 300, "IP SLA + track ile statik rota yedekleme", "Birincil varsayılan rota bir track nesnesine bağlanır. IP SLA hattın ötesini yoklar; yoklama başarısız olunca rota tablodan çıkar ve AD'si yüksek yedek rota (floating static) devreye girer.")
    r = f.device(150, 140, "router", "R1", "IP SLA 1 → 8.8.8.8", tone="accent", w=190)
    a = f.device(520, 70, "cloud", "ISP-A", "203.0.113.1 · track 1")
    b = f.device(520, 210, "cloud", "ISP-B", "198.51.100.1 · AD 250")
    i = f.device(790, 140, "server", "8.8.8.8", "yoklama hedefi")
    f.link(r, a, tone="ok", label="birincil")
    f.link(r, b, tone="v1", dash=True, label="yedek")
    f.link(a, i, tone="ok")
    f.link(b, i, tone="ln", dash=True)
    f.text(440, 275, "Yoklama source-interface ile birincilden gitmeli; yoksa yedekten dolaşıp başarılı olur → dalgalanma", size=12, tone="warn", bold=True)
    return f


def g7():
    f = Fig(880, 220, "Servis arızasında yöntem", "Servisin kendi sayaçlarını sıfırla, istemciye bir deneme yaptır, sayaçlara tekrar bak. Artmayan sayaç arızanın yönünü gösterir; sonra ACL, rota ve yapılandırma kontrol edilir.")
    steps = [("Sayaçları sıfırla", "clear … statistics"), ("Deneme yaptır", "istemci / NMS"), ("Ne arttı?", "gönderilen / alınan"), ("Yolu kontrol et", "ACL · rota · UDP"), ("Yapılandırma", "seviye · anahtar")]
    for i, (t, s) in enumerate(steps):
        x = 20 + i * 172
        f.box(x, 40, 152, 90, t, "accent" if i % 2 == 0 else "v2", sub=s, size=13)
        if i < len(steps) - 1:
            f.arrow(x + 152, 85, x + 172, 85)
    f.text(440, 180, "Benzetme: su sayacına bakıp hangi borudan kaçak olduğunu bulmak", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
