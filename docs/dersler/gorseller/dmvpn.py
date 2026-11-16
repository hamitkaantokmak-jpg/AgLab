"""DMVPN dersi şemaları (docs/dersler/dmvpn.md)."""

from figures import Fig


def g1():
    f = Fig(880, 300, "DMVPN: dört parça", "Merkezde tek bir çok noktalı GRE tüneli bütün şubeleri karşılar. NHRP tünel adreslerini gerçek internet adreslerine çevirir, IPsec trafiği korur, bir yönlendirme protokolü LAN'ları duyurur.")
    hub = f.device(440, 60, "router", "Hub (NHS)", "NBMA 203.0.113.1 · tünel 10.0.0.1", tone="accent", w=250)
    net = f.device(440, 150, "cloud", "İnternet", w=150)
    s = [f.device(x, 240, "router", n, sub, w=170) for x, n, sub in [(150, "Spoke2", "10.0.0.2"), (440, "Spoke3", "10.0.0.3"), (730, "Spoke4", "10.0.0.4")]]
    f.link(hub, net, tone="v1")
    for x in s:
        f.link(net, x, tone="v1")
    f.text(150, 155, "mGRE + NHRP", size=13, bold=True, tone="v1")
    f.text(150, 175, "+ IPsec + EIGRP/OSPF/BGP", size=12, tone="m")
    f.text(730, 155, "Benzetme: santral ve", size=12, tone="m")
    f.text(730, 175, "telefon rehberi", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 270, "Noktadan noktaya GRE ve mGRE", "Klasik GRE'de her şube için ayrı bir tünel arayüzü ve tunnel destination yazılır. mGRE'de merkezde tek arayüz vardır, hedef yazılmaz; her paketin hedefi NHRP'den bulunur.")
    f.box(30, 30, 390, 160, "Klasik GRE", "err", sub="50 şube = merkezde 50 tünel · her biri tunnel destination", size=16)
    f.box(460, 30, 390, 160, "mGRE", "ok", sub="tek Tunnel0 · tunnel mode gre multipoint · hedef NHRP'den", size=16)
    f.text(225, 165, "yeni şube = merkezde değişiklik", size=12, tone="err")
    f.text(655, 165, "yeni şube = yalnız şubede yapılandırma", size=12, tone="ok")
    f.text(440, 235, "Benzetme: her şubeye ayrı telefon hattı yerine tek santral numarası", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 320, "NHRP: kayıt ve çözümleme", "Spoke açılışta hub'a kendini kaydeder: tünel adresi ve gerçek (NBMA) adresi. Başka bir spoke'a gitmek istediğinde hub'a sorar ve onun gerçek adresini öğrenir.")
    hub = f.device(440, 60, "router", "Hub", "NHRP tablosu", tone="accent", w=170)
    s2 = f.device(150, 210, "router", "Spoke2", "198.51.100.20", w=170)
    s3 = f.device(730, 210, "router", "Spoke3", "198.51.100.30", w=170)
    f.arrow(185, 175, 380, 95, label="1. kayıt: 10.0.0.2 = .20", tone="v1")
    f.arrow(690, 175, 500, 95, label="1. kayıt: 10.0.0.3 = .30", tone="v1")
    f.arrow(250, 220, 630, 220, label="3. doğrudan tünel", tone="ok", width=2.5)
    f.text(440, 270, "2. Spoke2: '10.0.0.3 kim?' → Hub: '198.51.100.30'", size=12, mono=True, bold=True)
    f.text(440, 302, "Benzetme: rehbere kendi numaranı yazdırıp başkasının numarasını rehberden sormak", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 290, "Üç aşama: şubeden şubeye trafik", "Aşama 1'de trafik hep hub'dan geçer. Aşama 2'de spoke'lar diğer spoke'u next-hop gördüğü için doğrudan tünel kurar. Aşama 3'te hub trafiği iletirken spoke'a 'doğrudan git' der (redirect), spoke kısayolu kurar (shortcut).")
    for i, (t, sub, tone) in enumerate([("Aşama 1", "hub üzerinden · hub darboğaz", "warn"), ("Aşama 2", "doğrudan · özet yok, next-hop korunur", "v2"), ("Aşama 3", "doğrudan · özet olabilir · redirect + shortcut", "ok")]):
        x = 30 + i * 280
        f.rect(x, 30, 260, 170, tone, r=10)
        f.text(x + 130, 58, t, size=15, bold=True)
        f.text(x + 130, 80, sub, size=11, tone="m")
        f.circle(x + 130, 110, 12, "accent")
        f.text(x + 130, 114, "H", size=11, bold=True)
        f.circle(x + 50, 175, 12, "v1")
        f.circle(x + 210, 175, 12, "v1")
        f.text(x + 50, 179, "S2", size=10, bold=True)
        f.text(x + 210, 179, "S3", size=10, bold=True)
        if i == 0:
            f.line(x + 60, 166, x + 120, 120, tone="err", width=2.5)
            f.line(x + 140, 120, x + 200, 166, tone="err", width=2.5)
        else:
            f.line(x + 62, 175, x + 198, 175, tone="ok", width=2.5)
            f.line(x + 60, 166, x + 120, 120, tone="ln", width=1.5, dash=True)
            f.line(x + 140, 120, x + 200, 166, tone="ln", width=1.5, dash=True)
    f.text(440, 235, "Aşama 3: Hub(config-if)# ip nhrp redirect · Spoke(config-if)# ip nhrp shortcut", size=12, mono=True, bold=True)
    f.text(440, 270, "İlk paket hub'dan geçer; sonrakiler doğrudan", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 215, "Yönlendirme protokolü ayarları", "Hub bütün spoke'larla aynı tünel arayüzünden konuşur. Bir spoke'tan öğrendiğini diğerlerine aynı arayüzden vermesi ve doğru next-hop'u koruması gerekir.")
    f.table(30, 20, ["Protokol", "Hub'da", "Not"], [
        ["EIGRP (Aşama 1–3)", "no ip split-horizon eigrp 100", "aynı arayüzden geri duyur"],
        ["EIGRP (Aşama 2)", "no ip next-hop-self eigrp 100", "next-hop diğer spoke kalsın"],
        ["OSPF", "ip ospf network broadcast (hub DR)", "spoke'larda priority 0; varsayılan P2P çalışmaz"],
        ["BGP (büyük ağ)", "hub route reflector", "spoke'lar istemci"],
    ], [200, 330, 290], mono_cols=(1,))
    f.text(440, 180, "Benzetme: santral bir aboneden aldığı mesajı aynı hattaki diğer abonelere de iletebilmeli", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 240, "IPsec profili ile korumak", "DMVPN'de kripto harita ve ilgilenilen trafik ACL'i yazılmaz; tünel arayüzüne bir IPsec profili bağlanır ve tünelden geçen her şey şifrelenir. Spoke'lar arası dinamik tünellerin IPsec'i de dinamik kurulur.")
    f.frame(60, 40, [("Yeni IP", 120, "v3", "NBMA"), ("ESP", 90, "err"), ("GRE", 90, "v2"), ("İç IP", 130, "v1", "tünel/LAN"), ("Veri", 200, "card"), ("ESP iz", 100, "err")], h=56, title="Paket")
    f.text(440, 140, "interface Tunnel0 · tunnel protection ipsec profile DMVPN-PROF", size=12, mono=True, bold=True)
    f.text(440, 175, "Başlıklar büyür: ip mtu 1400 · ip tcp adjust-mss 1360", size=12, tone="warn", bold=True)
    f.text(440, 210, "Spoke–spoke IKE: ortak anahtar (address 0.0.0.0) ya da sertifika", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 230, "DMVPN sorun giderme sırası", "Önce spoke kayıtlı mı, sonra yönlendirme komşuluğu kuruldu mu, sonra doğrudan tünel ve IPsec kuruldu mu. Her katman bir öncekine dayanır.")
    steps = [("1. NHRP kaydı", "show dmvpn · nhs detail"), ("2. Yönlendirme", "eigrp/ospf neighbor"), ("3. Doğrudan tünel", "show ip nhrp · traceroute"), ("4. IPsec", "show crypto ipsec sa"), ("5. MTU", "büyük ping, MSS")]
    for i, (t, s) in enumerate(steps):
        x = 20 + i * 172
        f.box(x, 40, 152, 90, t, "accent" if i % 2 == 0 else "v2", sub=s, size=13)
        if i < len(steps) - 1:
            f.arrow(x + 152, 85, x + 172, 85)
    f.text(440, 180, "Ping çalışıp büyük aktarım takılıyorsa: MTU", size=12, tone="accent", bold=True)
    f.text(440, 210, "Benzetme: önce rehberde kayıtlı mısın, sonra hat açılıyor mu, sonra konuşma şifreli mi", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
