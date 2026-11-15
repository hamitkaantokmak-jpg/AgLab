"""VRF ve GRE dersi şemaları (docs/dersler/vrf-gre.md)."""

from figures import Fig


def g1():
    f = Fig(880, 270, "VRF: bir router içinde birden çok router", "Her VRF'nin kendi rota tablosu ve kendi arayüzleri vardır. Tablolar birbirini görmez; aynı IP bloğu iki VRF'de çakışmadan kullanılabilir.")
    f.rect(260, 30, 360, 190, "soft", r=12)
    f.text(440, 56, "R1", size=15, bold=True)
    f.box(280, 76, 150, 120, "VRF MISAFIR", "v1", sub="tablo: 10.0.0.0/24 …", size=13)
    f.box(450, 76, 150, 120, "VRF PERSONEL", "v2", sub="tablo: 10.0.0.0/24 …", size=13)
    a = f.device(110, 100, "switch", "Misafir LAN", tone="v1", w=140)
    b = f.device(770, 100, "switch", "Personel LAN", tone="v2", w=140)
    f.line(180, 100, 280, 120, "v1", 2)
    f.line(700, 100, 600, 120, "v2", 2)
    f.text(440, 250, "Benzetme: tek binada iki ayrı şirket; aynı oda numaraları var ama koridorlar ayrı, kapılar birbirine açılmıyor", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 280, "VRF-lite yapılandırması", "VRF tanımlanır, arayüz VRF'ye alınır, sonra IP adresi verilir. Arayüzü VRF'ye almak mevcut IP adresini SİLER.")
    rows = [
        ("vrf definition MISAFIR", "VRF'yi oluştur"),
        (" address-family ipv4", "IPv4 için aç"),
        ("interface g0/1", ""),
        (" vrf forwarding MISAFIR", "arayüzü VRF'ye al (IP silinir!)"),
        (" ip address 10.0.0.1 255.255.255.0", "adresi yeniden ver"),
    ]
    for i, (cmd, why) in enumerate(rows):
        y = 14 + i * 48
        f.rect(30, y, 470, 40, "warn" if "IP silinir" in why else "soft", r=6)
        f.text(42, y + 25, cmd.replace(" ", " "), size=12, mono=True, anchor="start", bold=True)
        f.text(520, y + 25, why, size=12, anchor="start", tone="m")
    f.text(440, 268, "Doğrulama: show ip route vrf MISAFIR · ping vrf MISAFIR 10.0.0.10", size=12, mono=True, bold=True)
    return f


def g3():
    f = Fig(880, 240, "VRF'ler arası ayrım uçtan uca", "VRF-lite'ta ayrım her router'da ayrı yapılır: router'lar arasında her VRF için ayrı bir alt arayüz (VLAN) ve VRF başına yönlendirme protokolü süreci gerekir.")
    r1 = f.device(180, 90, "router", "R1")
    r2 = f.device(700, 90, "router", "R2")
    f.line(240, 70, 640, 70, "v1", 3)
    f.line(240, 110, 640, 110, "v2", 3)
    f.text(440, 58, "g0/0.10 · VRF MISAFIR · OSPF 10", size=12, tone="v1", bold=True)
    f.text(440, 136, "g0/0.20 · VRF PERSONEL · OSPF 20", size=12, tone="v2", bold=True)
    f.note(30, 170, 820, "Benzetme: aynı otoyolda ayrı şeritler; şeritler arasında beton bariyer var, araç şerit değiştiremez.", tone="accent", size=12)
    return f


def g4():
    f = Fig(880, 280, "GRE tüneli: paketi paketin içine koymak", "GRE özgün IP paketini yeni bir IP başlığının içine koyar. İnternetteki router'lar yalnız dış başlığı görür; özel adresler tünelin içinde taşınır.")
    f.frame(30, 60, [("Dış IP", 150, "v2", "203.0.113.1 → 198.51.100.1"), ("GRE", 80, "warn", "4 bayt"), ("İç IP", 150, "v1", "10.1.0.5 → 10.2.0.9"), ("Veri", 300, "soft", "")], h=64, title="GRE paketi (24 bayt ek)")
    f.note(30, 160, 820, "Benzetme: bir mektubu başka bir zarfın içine koyup kargoya vermek. Kargo şirketi yalnız dış zarfı okur; içteki adres karşı ofiste açılınca okunur.", tone="accent", size=12)
    f.text(440, 248, "GRE şifrelemez: gizlilik için IPsec ile birlikte kullanılır (Konu #34)", size=12, tone="err", bold=True)
    return f


def g5():
    f = Fig(880, 300, "Tünel yapılandırması", "Tünel arayüzünün kendi IP adresi vardır (tünel içi ağ). tunnel source ve tunnel destination dış adreslerdir ve birbirine internetten ulaşabilmelidir.")
    a = f.device(150, 100, "router", "R-A", "dış 203.0.113.1", w=160)
    b = f.device(730, 100, "router", "R-B", "dış 198.51.100.1", w=160)
    f.device(440, 100, "cloud", "İnternet", w=150)
    f.path("M 230 80 C 330 40, 550 40, 650 80", tone="accent", width=3, dash=True)
    f.text(440, 40, "Tunnel0 · 172.16.0.0/30", size=12, tone="accent", bold=True)
    f.text(40, 190, "interface tunnel0", size=12, mono=True, anchor="start", bold=True)
    f.text(40, 212, " ip address 172.16.0.1 255.255.255.252", size=12, mono=True, anchor="start", bold=True)
    f.text(40, 234, " tunnel source g0/1", size=12, mono=True, anchor="start", bold=True)
    f.text(40, 256, " tunnel destination 198.51.100.1", size=12, mono=True, anchor="start", bold=True)
    f.note(500, 190, 350, "Tünel up/up için: kaynak arayüz up ve hedefe rota var. Karşı uç kapalı olsa bile up kalabilir (keepalive yoksa).", tone="warn", size=12)
    return f


def g6():
    f = Fig(880, 240, "MTU: tünelin bedeli", "GRE 24 bayt ekler. 1500 baytlık bir paket tünele girince 1524 olur ve bölünmesi gerekir. Tünel MTU'su 1476, TCP MSS 1436 yapılır.")
    f.box(30, 40, 250, 90, "Özgün paket", "v1", sub="1500 bayt", size=15)
    f.arrow(280, 85, 330, 85)
    f.box(330, 40, 250, 90, "GRE ile", "err", sub="1500 + 24 = 1524 > 1500", size=15)
    f.arrow(580, 85, 630, 85)
    f.box(630, 40, 220, 90, "Çözüm", "ok", sub="ip mtu 1476 · ip tcp adjust-mss 1436", size=13)
    f.text(440, 180, "Belirti: ping çalışır, küçük sayfalar açılır; büyük dosya ve bazı web siteleri takılır", size=12, tone="err", bold=True)
    f.text(440, 210, "Benzetme: zarfı başka bir zarfa koyunca kalınlaşır; posta kutusunun ağzından geçmeyebilir", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 270, "Özyinelemeli yönlendirme: tünel kendini kapatır", "Tünelin hedef adresine giden rota yanlışlıkla tünelin içinden öğrenilirse router dış paketi de tünele göndermeye çalışır. IOS bunu yakalar ve tüneli kapatır (recursive routing).")
    f.box(30, 30, 380, 120, "Yanlış", "err", sub="OSPF tünel içinden 198.51.100.0/24'ü öğreniyor → hedefe yol = tünel", size=14)
    f.box(470, 30, 380, 120, "Doğru", "ok", sub="dış adreslere rota fiziksel arayüzden (statik ya da ayrı süreç); tünel içinde yalnız iç ağlar", size=14)
    f.text(440, 190, "%TUN-5-RECURDOWN: Tunnel0 temporarily disabled due to recursive routing", size=12, mono=True, tone="err", bold=True)
    f.text(440, 228, "Benzetme: kargonun adresini sorduğunda \"kargonun içine bak\" demek", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
