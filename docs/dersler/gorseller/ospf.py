"""OSPFv2 tek alan dersi şemaları (docs/dersler/ospf.md)."""

from figures import Fig


def _topo(f, y=120, tone="ln"):
    r1 = f.device(150, y, "router", "R1", "1.1.1.1")
    r2 = f.device(440, y, "router", "R2", "2.2.2.2")
    r3 = f.device(730, y, "router", "R3", "3.3.3.3")
    f.link(r1, r2, la="", lb="", label="10.0.12.0/30", tone=tone)
    f.link(r2, r3, label="10.0.23.0/30", tone=tone)
    return r1, r2, r3


def g1():
    f = Fig(880, 280, "Statik mi OSPF mi?", "Statik rota her router'a elle yazılır ve hat düşünce kendiliğinden yol değiştirmez. OSPF'te router'lar ağlarını birbirine kendisi duyurur.")
    f.rect(40, 30, 380, 190, "warn")
    f.text(230, 66, "Statik", size=16, bold=True)
    f.lines(230, 120, ["Her yeni ağ = her router'a yeni satır", "Hat düşerse trafik kör kalır", "Küçük, değişmeyen ağlar için"], size=12, tone="t")
    f.rect(460, 30, 380, 190, "ok")
    f.text(650, 66, "OSPF", size=16, bold=True)
    f.lines(650, 120, ["Router'lar ağlarını kendisi duyurur", "Hat düşerse yeni yol hesaplanır", "Büyüyen, yedekli ağlar için"], size=12, tone="t")
    f.text(440, 256, "Benzetme: statik = kâğıt harita; OSPF = trafiği anlık gösteren navigasyon", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 300, "Link-state: herkes aynı haritayı tutar", "Router'lar Hello ile tanışır, bağlantı bilgilerini (LSA) paylaşır; alandaki her router aynı haritayı (LSDB) tutar ve en kısa yolu SPF ile kendisi hesaplar.")
    r1, r2, r3 = _topo(f, 80)
    f.packet(295, 40, "Hello 224.0.0.5", tone="v1")
    f.packet(585, 40, "LSA", tone="v2")
    for x in (150, 440, 730):
        f.box(x - 100, 160, 200, 70, "LSDB", "soft", sub="R1–R2–R3 haritası (aynı)", size=13)
    f.text(440, 270, "Benzetme: her şubede aynı şehir haritası asılı; herkes kendi rotasını kendi çizer", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 280, "network satırı arayüzü seçer", "network komutu bir ağı değil, adresi bu aralığa düşen arayüzleri OSPF'e katar. 0.0.0.0 wildcard yalnız tek adresi eşler.")
    f.table(30, 20, ["network satırı", "Gi0/1 = 192.168.30.1", "Sonuç"], [
        ["192.168.30.0 0.0.0.255 area 0", "aralıkta", "OSPF'e girer, ilan edilir"],
        ["192.168.30.0 0.0.0.0 area 0", "aralıkta değil (yalnız .0)", "DIŞARIDA kalır"],
        ["192.168.30.1 0.0.0.0 area 0", "tam eşleşme", "OSPF'e girer"],
    ], [310, 250, 260], tones={0: "ok", 1: "err", 2: "ok"}, mono_cols=(0,))
    f.note(30, 150, 820, "Wildcard, maskenin tersidir: 0 = bu bit aynı olmalı, 1 = önemli değil. /24 için 0.0.0.255, /30 için 0.0.0.3 (Konu #19).", tone="accent", size=12)
    f.note(30, 210, 820, "Arayüz OSPF'e girince iki şey olur: o arayüzden Hello gönderilir ve arayüzün ağı ilan edilir.", tone="ok", size=12)
    return f


def g4():
    f = Fig(880, 300, "Komşuluk şartları: iki ucun aynı dili konuşması", "Komşuluk için iki uçta alt ağ ve maske, alan, Hello/Dead süreleri, kimlik doğrulama ve stub bayrağı aynı olmalı; Router ID'ler farklı olmalı. FULL için MTU da uyuşmalı.")
    a = f.device(130, 60, "router", "R2")
    b = f.device(750, 60, "router", "R3")
    f.link(a, b, "Hello", tone="accent")
    f.table(140, 110, ["Alan", "R2", "R3", ""], [
        ["alt ağ / maske", "10.0.23.0/30", "10.0.23.0/30", "aynı"],
        ["alan (area)", "0", "1", "FARKLI"],
        ["Hello / Dead", "10 / 40", "10 / 40", "aynı"],
        ["Router ID", "2.2.2.2", "3.3.3.3", "farklı olmalı"],
    ], [180, 170, 170, 120], tones={1: "err"}, mono_cols=(1, 2))
    f.text(440, 286, "Tek bir fark komşuluğu kurdurmaz: bütün rotalar gider", size=12, tone="err", bold=True)
    return f


def g5():
    f = Fig(880, 200, "Komşu durumları: tanışmadan arkadaşlığa", "Down'dan FULL'e: Hello görülür (Init), karşılıklı tanınır (2-Way), veritabanları karşılaştırılır (ExStart, Exchange, Loading) ve FULL olur.")
    st = [("Down", "err"), ("Init", "warn"), ("2-Way", "warn"), ("ExStart", "soft"), ("Exchange", "soft"), ("Loading", "soft"), ("FULL", "ok")]
    for i, (s, t) in enumerate(st):
        x = 20 + i * 122
        f.box(x, 40, 110, 50, s, t, size=13)
        if i < 6:
            f.arrow(x + 110, 65, x + 122, 65)
    f.note(20, 120, 840, "Ethernet'te bir DR ve BDR seçilir. DROTHER'lar birbiriyle 2-WAY'de kalır: bu normaldir, arıza değildir. ExStart/Exchange'de takılma çoğu zaman MTU farkıdır.", tone="accent", size=12)
    return f


def g6():
    f = Fig(880, 290, "Maliyet ve [AD/metrik]", "Yolun maliyeti çıkış arayüzlerinin maliyetlerinin toplamıdır. Varsayılan referans 100 Mbps olduğu için FastE ve GigE ikisi de 1 maliyetlidir.")
    r1, r2, r3 = _topo(f, 70, tone="accent")
    lan = f.device(730, 190, "switch", "192.168.30.0/24", "B şubesi LAN", w=170)
    f.link(r3, lan, tone="accent")
    f.badge(295, 104, 1)
    f.badge(585, 104, 1)
    f.badge(745, 135, 1)
    f.note(30, 150, 520, "R1'den 192.168.30.0'a: 1 + 1 + 1 = 3", tone="ok", size=13)
    f.text(30, 230, "O   192.168.30.0/24 [110/3] via 10.0.12.2", size=13, mono=True, anchor="start", bold=True)
    f.text(30, 262, "[110/3]: AD 110 (kaynak OSPF), metrik 3 (toplam maliyet)", size=12, anchor="start", tone="m")
    return f


def g7():
    f = Fig(880, 300, "AD: aynı hedefe iki kaynak varsa", "Tabloya en düşük AD'li kaynak girer: connected 0, static 1, OSPF 110. Unutulmuş bir statik rota OSPF'in bildiği iyi yolu gölgeler.")
    f.table(40, 20, ["Kaynak", "AD"], [["Connected", "0"], ["Static", "1"], ["eBGP", "20"], ["EIGRP", "90"], ["OSPF", "110"], ["RIP", "120"]], [160, 80], tones={1: "warn", 4: "ok"}, mono_cols=(1,))
    f.box(330, 40, 510, 70, "ip route 192.168.20.0 … 10.0.99.2", "warn", sub="AD 1 · eski kiralık hat, artık yok", size=13)
    f.box(330, 130, 510, 70, "O 192.168.20.0/24 [110/2] via 10.0.12.2", "ok", sub="AD 110 · doğru yol", size=13)
    f.arrow(585, 110, 585, 130, tone="err")
    f.note(330, 220, 510, "Sonuç: statik kazanır, trafik ölü hatta gider. Çözüm: eski satırı sil.", tone="err", size=12)
    f.text(160, 236, "Benzetme: patronun eski", size=11, tone="m")
    f.text(160, 252, "notu, güncel navigasyonu ezer", size=11, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
