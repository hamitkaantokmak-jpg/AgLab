"""Gateway ve statik routing dersi şemaları (docs/dersler/gateway-statik-routing.md)."""

from figures import Fig


def g1():
    f = Fig(880, 250, "Başka ağa giden paket: PC → gateway → router'ın tablosu", "PC başka ağa giden paketi gateway'e verir; router tablosuna bakıp bir sonraki durağa (next-hop) iletir.")
    pc = f.device(80, 90, "pc", "PC-11", "gw 192.168.10.1")
    r1 = f.device(330, 90, "router", "R1", "şube")
    r2 = f.device(600, 90, "router", "R2", "merkez")
    srv = f.device(810, 90, "server", "SRV", "192.168.100.10")
    f.link(pc, r1, la="", lb=".1")
    f.link(r1, r2, "ana hat 10.0.12.0/30", la=".1", lb=".2")
    f.link(r2, srv)
    f.box(220, 150, 220, 70, "R1'in tablosu", "accent", sub="0.0.0.0/0 → 10.0.12.2", size=13)
    f.box(490, 150, 220, 70, "R2'nin tablosu", "accent", sub="192.168.10.0/24 → 10.0.12.1 (dönüş)", size=13)
    f.text(440, 244, "Benzetme: mektup mahalle postanesine (gateway), oradan şehirlerarası aktarmaya (next-hop) gider", size=11, tone="m")
    return f


def g2():
    f = Fig(880, 220, "Bir rota satırının anatomisi", "Kod, hedef ağ, [AD/metric], next-hop ve (bağlı ağlarda) arayüz.")
    parts = [("S", 40, "kaynak: S statik · C bağlı · O OSPF", "v4"), ("192.168.100.0/24", 110, "hedef ağ ve önek", "v1"), ("[1/0]", 340, "[AD / metric]", "warn"), ("via 10.0.12.2", 440, "next-hop: bir sonraki router", "v2")]
    f.rect(30, 40, 820, 56, "soft", r=8)
    f.text(60, 76, "S", size=22, mono=True, bold=True)
    f.text(220, 76, "192.168.100.0/24", size=22, mono=True, bold=True)
    f.text(390, 76, "[1/0]", size=22, mono=True, bold=True)
    f.text(570, 76, "via 10.0.12.2", size=22, mono=True, bold=True)
    for x, label, tone in [(60, "kaynak", "v4"), (220, "hedef ağ", "v1"), (390, "[AD/metric]", "warn"), (570, "next-hop", "v2")]:
        f.line(x, 96, x, 124, tone=tone, width=2)
        f.text(x, 142, label, size=13, tone=tone, bold=True)
    f.text(34, 164, "S statik, C bağlı, L kendi adresi", size=11, tone="m", anchor="start")
    f.text(34, 180, "S* varsayılan rota", size=11, tone="m", anchor="start")
    f.text(390, 164, "AD: kaynağa güven", size=11, tone="m")
    f.text(570, 164, "bağlı bir ağda olmalı", size=11, tone="m")
    f.text(570, 180, "ulaşılamazsa rota tabloya girmez", size=11, tone="m")
    return f


def g3():
    f = Fig(880, 270, "En uzun önek kuralı (LPM)", "Hedef birden çok satırla eşleşirse maskesi en uzun (en özgül) olan seçilir; varsayılan rota yalnız başka eşleşme yoksa kullanılır.")
    f.text(440, 26, "Hedef: 192.168.100.10", size=16, mono=True, bold=True)
    f.rect(60, 44, 760, 200, "soft", r=14)
    f.text(80, 66, "0.0.0.0/0 (her şey) → 10.0.12.2", size=13, anchor="start", mono=True)
    f.rect(200, 80, 560, 150, "v1", r=12)
    f.text(220, 102, "192.168.0.0/16 (varsa) → ...", size=13, anchor="start", mono=True, tone="m")
    f.rect(340, 116, 400, 100, "ok", r=10)
    f.text(360, 140, "192.168.100.0/24 → seçilir", size=14, anchor="start", mono=True, bold=True)
    f.text(360, 164, "en uzun önek: en dar kutu kazanır", size=12, anchor="start", tone="m")
    f.circle(560, 196, 8, "err")
    f.text(580, 200, "192.168.100.10", size=12, anchor="start", mono=True, tone="err", bold=True)
    f.text(440, 262, "Benzetme: adres ararken \"Türkiye\" değil \"Ankara, Çankaya, Atatürk Bulvarı\" bilgisi kullanılır", size=11, tone="m")
    return f


def g4():
    f = Fig(860, 260, "Yönetimsel uzaklık (AD): kaynağa ne kadar güvenilir", "Aynı ağ ve maske için birden çok kaynak varsa AD'si düşük olan tabloya girer.")
    rows = [("Connected", 0), ("Static", 1), ("eBGP", 20), ("EIGRP", 90), ("OSPF", 110), ("RIP", 120), ("iBGP", 200)]
    for i, (name, ad) in enumerate(rows):
        y = 24 + i * 30
        f.text(120, y + 18, name, size=13, anchor="end", bold=True)
        w = 20 + ad * 3
        f.rect(140, y + 4, w, 20, "ok" if ad <= 1 else "accent" if ad < 120 else "warn", r=4)
        f.text(150 + w, y + 19, str(ad), size=12, anchor="start", mono=True, bold=True)
    f.note(560, 40, 280, "Düşük AD = daha güvenilir. Statik (1), OSPF'ten (110) öğrenilen aynı ağı yener.", tone="ok", size=12)
    f.note(560, 130, 280, "AD yalnız aynı önek için karşılaştırılır. Önce LPM, sonra AD, sonra metric.", tone="warn", size=12)
    return f


def g5():
    f = Fig(880, 260, "Gidiş ve dönüş: iki yön, iki rota", "R1'de sunucuya gidiş rotası var ama R2 şube ağını bilmiyorsa paket sunucuya ulaşır, yanıt geri dönemez: belirti timeout.")
    pc = f.device(80, 110, "pc", "PC-11", "192.168.10.11")
    r1 = f.device(300, 110, "router", "R1", "gidiş rotası var")
    r2 = f.device(580, 110, "router", "R2", "dönüş rotası YOK", tone="err")
    srv = f.device(800, 110, "server", "SRV")
    for a, b in [(pc, r1), (r1, r2), (r2, srv)]:
        f.link(a, b)
    f.arrow(120, 60, 760, 60, "istek ulaşıyor", tone="ok", width=2.5)
    f.arrow(760, 170, 600, 170, "yanıt", tone="err", width=2.5)
    f.circle(586, 170, 10, "err")
    f.line(580, 164, 592, 176, "err", 2.2)
    f.line(580, 176, 592, 164, "err", 2.2)
    f.text(440, 210, "R2: \"192.168.10.11 nerede? Bilmiyorum.\" → yanıt düşer", size=12, tone="err", bold=True)
    f.text(440, 238, "Bir router'da rota olması bağlantının çalıştığını göstermez: iki yönü de kontrol et", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 300, "Floating static: yedek rota kenarda bekler", "Ana rota (AD 1) tablodayken AD 200'lük yedek rota tabloya girmez; ana hat düşünce devreye girer, dönünce kenara çekilir.")
    for i, (title, main_up) in enumerate([("Ana hat ayakta", True), ("Ana hat koptu", False)]):
        ox = 20 + i * 440
        f.text(ox + 200, 24, title, size=14, bold=True, tone="ok" if main_up else "err")
        r1 = f.device(ox + 60, 120, "router", "R1")
        r2 = f.device(ox + 340, 120, "router", "R2")
        f.path(f"M{ox + 106} 110 Q {ox + 200} 60 {ox + 294} 110", tone="ok" if main_up else "err", width=3, dash=not main_up)
        f.text(ox + 200, 70, "ana hat", size=11, tone="m")
        f.path(f"M{ox + 106} 132 Q {ox + 200} 182 {ox + 294} 132", tone="ln" if main_up else "warn", width=3, dash=main_up)
        f.text(ox + 200, 186, "yedek hat", size=11, tone="m")
        rows = [["S*", "0.0.0.0/0 [1/0] via 10.0.12.2"]] if main_up else [["S*", "0.0.0.0/0 [200/0] via 10.0.21.2"]]
        f.table(ox + 20, 206, ["Kod", "R1'in tablosu"], rows, [50, 330], tones={0: "ok" if main_up else "warn"}, mono_cols=(1,))
        f.text(ox + 200, 286, "yedek (AD 200) kenarda bekliyor" if main_up else "yedek devrede; ana dönünce kenara çekilir", size=11, tone="m")
    return f


def g7():
    f = Fig(880, 270, "Ping mesajı ne diyor?", "Mesajın değişmesi sorunun yer değiştirdiğini gösterir: unreachable → timeout → başarı.")
    rows = [
        ("Destination host unreachable (router .1'den)", "Router bu hedef için rota bilmiyor (gidiş eksik)", "err"),
        ("Request timed out / timeout", "Paket gitti, yanıt dönmüyor: dönüş rotası, hedef ya da filtre", "warn"),
        ("host (x) not reachable (VPCS)", "Gateway'in ya da hedefin MAC'i bulunamadı: yerel sorun (gateway?)", "v4"),
        ("84 bytes from ... ttl=62", "Başarılı; TTL'den kaç router geçildiği tahmin edilir", "ok"),
    ]
    for i, (msg, mean, tone) in enumerate(rows):
        y = 20 + i * 60
        f.box(30, y, 380, 48, msg, tone, size=12)
        f.arrow(410, y + 24, 450, y + 24)
        f.box(454, y, 396, 48, mean, "soft", size=12, bold=False)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
