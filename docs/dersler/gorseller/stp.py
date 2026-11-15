"""STP/RSTP dersi şemaları (docs/dersler/stp.md)."""

from figures import Fig


def g1():
    f = Fig(880, 290, "Döngü: çıkışı olmayan döner kavşak", "Ethernet çerçevesinde TTL yoktur. Yedek kablolar bir döngü oluşturursa broadcast sonsuza kadar döner, MAC tabloları sürekli değişir ve ağ durur.")
    a = f.device(440, 50, "switch", "SW1")
    b = f.device(200, 220, "switch", "SW2")
    c = f.device(680, 220, "switch", "SW3")
    f.link(a, b, tone="err", width=3)
    f.link(b, c, tone="err", width=3)
    f.link(c, a, tone="err", width=3)
    f.packet(300, 120, "broadcast", tone="err")
    f.packet(580, 120, "broadcast", tone="err")
    f.packet(440, 238, "broadcast", tone="err")
    f.path("M 400 160 a 50 40 0 1 1 80 0", tone="err", width=2, arrow=True)
    f.note(40, 20, 260, "Her switch broadcast'i gelen port dışındaki bütün portlara gönderir: kopya çoğalır.", tone="err", size=12)
    f.note(600, 20, 260, "STP'nin işi: bir kabloyu bloklayıp ağacı döngüsüz yapmak.", tone="ok", size=12)
    return f


def g2():
    f = Fig(880, 250, "Köprü kimliği (BID): kimin kök olacağını belirler", "BID = öncelik + MAC. Öncelik 4096'nın katıdır; PVST'de VLAN numarası (sys-id-ext) eklenir. En küçük BID kök olur.")
    f.frame(40, 60, [
        ("Öncelik", 200, "accent", "4 bit · 0–61440, 4096'nın katı"),
        ("sys-id-ext", 220, "v3", "12 bit · VLAN numarası"),
        ("MAC adresi", 360, "v2", "48 bit · eşitlikte bu karar verir"),
    ], h=62, title="Bridge ID")
    f.table(40, 150, ["Örnek", "Hesap", "Görünen öncelik"], [["VLAN 10, varsayılan", "32768 + 10", "32778"], ["VLAN 10, root primary", "24576 + 10", "24586"]], [260, 260, 260], mono_cols=(1, 2))
    return f


def g3():
    f = Fig(880, 340, "Seçim: kök, kök port, belirlenmiş port, bloklu", "Kökün bütün portları belirlenmiştir. Her switch köke en ucuz portunu kök port yapar. Her bağlantıda bir belirlenmiş uç vardır; kalan port bloklanır.")
    c1 = f.device(240, 60, "switch", "CORE1", "KÖK · 24576", tone="ok")
    c2 = f.device(640, 60, "switch", "CORE2", "28672")
    a = f.device(240, 270, "switch", "SW-A", "32768")
    b = f.device(640, 270, "switch", "SW-B", "32768")
    f.link(c1, c2, la="D", lb="R", tone="accent")
    f.link(c1, a, la="D", lb="R", tone="accent")
    f.link(c1, b, la="D", lb="R", tone="accent")
    f.link(c2, a, la="D", lb="ALT", tone="err", dash=True, blocked=False)
    f.link(c2, b, la="D", lb="ALT", tone="err", dash=True)
    f.note(20, 150, 170, "R: kök port\nD: belirlenmiş\nALT: bloklu (yedek)", tone="accent", size=12)
    f.note(700, 150, 170, "Kesikli çizgiler bloklu: CORE1 bağlantısı düşerse açılır.", tone="warn", size=12)
    return f


def g4():
    f = Fig(880, 270, "Maliyet: köke giden yolun ücreti", "Kök port, köke toplam maliyeti en düşük olan porttur. Kısa yöntemde 1 Gbps 4, 100 Mbps 19 maliyetlidir.")
    f.table(30, 20, ["Hız", "Maliyet"], [["10 Mbps", "100"], ["100 Mbps", "19"], ["1 Gbps", "4"], ["10 Gbps", "2"]], [120, 100], mono_cols=(1,))
    r = f.device(560, 40, "switch", "KÖK")
    x = f.device(420, 200, "switch", "SW-X")
    y = f.device(740, 200, "switch", "SW-Y")
    f.link(r, x, "1G · 4", tone="ok", width=3)
    f.link(r, y, "1G · 4", tone="ln")
    f.link(x, y, "100M · 19", tone="ln")
    f.note(30, 180, 300, "SW-X için: doğrudan 4; SW-Y üzerinden 19 + 4 = 23. Kök port doğrudan olan.", tone="ok", size=12)
    f.text(580, 262, "Benzetme: iki otoyol arasında ücreti düşük olanı seçmek", size=11, tone="m")
    return f


def g5():
    f = Fig(880, 240, "Klasik STP yavaş, RSTP hızlı", "802.1D'de bir port forwarding'e geçmeden önce Listening ve Learning'de 15'er saniye bekler. RSTP (rapid-pvst) öneri ve anlaşma ile saniyeler içinde yakınsar.")
    f.text(40, 40, "802.1D", size=13, bold=True, anchor="start")
    f.box(120, 20, 150, 40, "Blocking", "err", size=12)
    f.box(270, 20, 190, 40, "Listening 15 sn", "warn", size=12)
    f.box(460, 20, 190, 40, "Learning 15 sn", "warn", size=12)
    f.box(650, 20, 190, 40, "Forwarding", "ok", size=12)
    f.text(480, 84, "değişiklikte 30–50 saniye kesinti", size=12, tone="err")
    f.text(40, 140, "RSTP", size=13, bold=True, anchor="start")
    f.box(120, 120, 220, 40, "Discarding", "err", size=12)
    f.arrow(340, 140, 470, 140, "öneri / anlaşma", tone="ok")
    f.box(470, 120, 370, 40, "Forwarding (saniyeler)", "ok", size=12)
    f.note(40, 190, 800, "RSTP rolleri: Root, Designated, Alternate (yedek kök yolu), Backup. Cisco'da: spanning-tree mode rapid-pvst", tone="accent", size=12)
    return f


def g6():
    f = Fig(880, 280, "PVST+: her VLAN'ın kendi ağacı", "Cisco varsayılanı VLAN başına ayrı ağaçtır. Öncelik her VLAN için ayrı yazılır; bir VLAN'ı unutmak o VLAN'ın kökünü yanlış yerde bırakır.")
    f.zone(20, 20, 410, 240, "VLAN 10", "v1")
    f.zone(450, 20, 410, 240, "VLAN 20", "v2")
    for ox, root in ((0, "CORE1"), (430, "CORE2")):
        c1 = f.device(130 + ox, 80, "switch", "CORE1", "KÖK" if root == "CORE1" else "", tone="ok" if root == "CORE1" else "card")
        c2 = f.device(320 + ox, 80, "switch", "CORE2", "KÖK" if root == "CORE2" else "", tone="ok" if root == "CORE2" else "card")
        a = f.device(225 + ox, 210, "switch", "SW-A")
        f.link(c1, c2)
        f.link(c1, a, tone="accent" if root == "CORE1" else "err", dash=root != "CORE1")
        f.link(c2, a, tone="accent" if root == "CORE2" else "err", dash=root != "CORE2")
    return f


def g7():
    f = Fig(880, 300, "Koruma: PortFast, BPDU Guard, Root Guard nereye?", "PortFast ve BPDU Guard yalnız uç cihaz portlarına; Root Guard çekirdekten erişime bakan portlara yazılır.")
    core = f.device(440, 50, "switch", "CORE1", "kök")
    acc = f.device(440, 160, "switch", "SW-A", "erişim")
    pc = f.device(200, 260, "pc", "PC")
    rogue = f.device(680, 260, "switch", "Depodan gelen", "öncelik 4096", tone="err")
    f.link(core, acc, la="Root Guard", tone="accent")
    f.link(acc, pc, tone="ok")
    f.text(210, 205, "PortFast + BPDU Guard", size=11, tone="ok", bold=True)
    f.link(acc, rogue, tone="err", blocked=True)
    f.text(690, 205, "BPDU gelirse err-disabled", size=11, tone="err", bold=True)
    f.note(20, 20, 300, "PortFast: PC 30 sn beklemeden bağlanır. Trunk'a yazılmaz.", tone="ok", size=12)
    f.note(580, 20, 280, "Root Guard: aşağıdan daha iyi kök duyurusu gelirse portu bloklar.", tone="accent", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
