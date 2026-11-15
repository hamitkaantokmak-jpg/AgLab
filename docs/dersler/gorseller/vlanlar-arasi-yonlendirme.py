"""VLAN'lar arası yönlendirme dersi şemaları (docs/dersler/vlanlar-arasi-yonlendirme.md)."""

from figures import Fig


def g1():
    f = Fig(860, 250, "Ayrı odalar arasında kapı gerekir", "VLAN 10 ile VLAN 20 katman 2'de birbirini görmez; aralarında konuşmak için bir router (ya da L3 switch) gerekir.")
    f.zone(30, 40, 300, 170, "VLAN 10 · 192.168.10.0/24", "v1")
    f.zone(530, 40, 300, 170, "VLAN 20 · 192.168.20.0/24", "v2")
    a = f.device(110, 130, "pc", "PC-01", ".10.11", tone="v1")
    b = f.device(250, 130, "pc", "PC-03", ".10.13", tone="v1")
    c = f.device(610, 130, "pc", "PC-02", ".20.12", tone="v2")
    d = f.device(750, 130, "printer", "YAZICI", ".20.50", tone="v2")
    r = f.device(430, 130, "router", "R1", "kapı (gateway)", tone="accent")
    f.arrow(330, 130, 384, 130, tone="v1", width=3)
    f.arrow(476, 130, 530, 130, tone="v2", width=3)
    f.text(430, 230, "Router olmadan duvar; router ile iki odanın ortak kapısı", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 290, "Router-on-a-stick: tek kablo, iki alt arayüz", "Router'ın tek fiziksel portu switch'e trunk ile bağlanır; her VLAN için bir alt arayüz (mantıksal kapı) açılır.")
    r = f.device(440, 60, "router", "R1", "Gi0/0 (IP yok, no shutdown)", w=230)
    f.line(400, 87, 340, 112, dash=True, width=1.5)
    f.line(480, 87, 540, 112, dash=True, width=1.5)
    f.box(260, 112, 160, 46, "Gi0/0.10", "v1", sub="dot1Q 10 · 192.168.10.1", size=12)
    f.box(460, 112, 160, 46, "Gi0/0.20", "v2", sub="dot1Q 20 · 192.168.20.1", size=12)
    sw = f.device(440, 220, "switch", "SW1")
    f.line(440, 158, 440, 193, width=4)
    f.text(450, 180, "trunk (10, 20)", size=11, tone="m", anchor="start", bold=True)
    a = f.device(140, 220, "pc", "PC-01", "VLAN 10 · gw .10.1", tone="v1")
    b = f.device(740, 220, "pc", "PC-02", "VLAN 20 · gw .20.1", tone="v2")
    f.link(a, sw, tone="v1", lb="Fa0/1")
    f.link(sw, b, tone="v2", la="Fa0/2")
    f.text(440, 284, "Her VLAN'ın gateway'i kendi alt arayüzünün adresidir", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 300, "Bir paketin yolculuğu: VLAN 10'dan VLAN 20'ye", "PC-01'in paketi VLAN 10 etiketiyle router'a çıkar, router yönlendirir, aynı kablodan VLAN 20 etiketiyle geri iner.")
    a = f.device(90, 230, "pc", "PC-01", "VLAN 10", tone="v1")
    sw = f.device(440, 230, "switch", "SW1")
    b = f.device(790, 230, "pc", "PC-02", "VLAN 20", tone="v2")
    r = f.device(440, 60, "router", "R1", ".10 ↔ .20 yönlendirme")
    f.link(a, sw, tone="v1")
    f.link(sw, b, tone="v2")
    f.path("M420 200 L420 90", tone="v1", width=3, arrow=True)
    f.path("M460 90 L460 200", tone="v2", width=3, arrow=True)
    f.badge(240, 210, 1, "v1")
    f.text(240, 192, "etiketsiz", size=11, tone="m")
    f.badge(400, 150, 2, "v1")
    f.packet(350, 128, "[10]", "v1", w=46)
    f.badge(440, 22, 3)
    f.badge(480, 150, 4, "v2")
    f.packet(530, 128, "[20]", "v2", w=46)
    f.badge(640, 210, 5, "v2")
    f.text(640, 192, "etiketsiz", size=11, tone="m")
    f.text(440, 292, "1 PC gateway'e verir · 2 trunk'ta VLAN 10 etiketi · 3 router yönlendirir · 4 VLAN 20 etiketiyle iner · 5 teslim", size=11, tone="m")
    return f


def g4():
    f = Fig(860, 250, "Alt arayüzün anatomisi", "Alt arayüzün numarası yalnız bir addır; hangi VLAN'ı alacağını encapsulation dot1Q satırı belirler.")
    f.raw("")
    lines = [
        ("interface GigabitEthernet0/0.20", "ad: .20 yalnız bir etiket, istediğin sayı olabilir", "soft"),
        (" encapsulation dot1Q 20", "VLAN'ı BU satır belirler; önce yazılır", "accent"),
        (" ip address 192.168.20.1 255.255.255.0", "VLAN 20'deki PC'lerin gateway'i", "v2"),
    ]
    for i, (code, why, tone) in enumerate(lines):
        y = 30 + i * 60
        f.rect(40, y, 400, 44, tone, r=6)
        f.text(56, y + 27, code, size=13, mono=True, anchor="start", bold=True)
        f.arrow(440, y + 22, 480, y + 22)
        f.text(490, y + 27, why, size=13, anchor="start")
    f.note(40, 206, 780, "Dikkat: .20 adlı alt arayüze dot1Q 30 yazılırsa router VLAN 30'u bekler; VLAN 20 kapısız kalır.", tone="warn", size=12)
    return f


def g5():
    f = Fig(880, 290, "Router-on-a-stick ile L3 switch karşılaştırması", "Router-on-a-stick'te VLAN'lar arası trafik tek kablodan iki kez geçer; L3 switch'te SVI'lar arasında switch'in içinde yönlendirilir.")
    f.text(220, 24, "Router-on-a-stick", size=14, bold=True)
    r = f.device(220, 70, "router", "R1")
    s = f.device(220, 190, "switch", "SW1")
    f.path("M205 165 L205 98", tone="v1", width=3, arrow=True)
    f.path("M235 98 L235 165", tone="v2", width=3, arrow=True)
    f.text(220, 250, "Ucuz, basit; kablo darboğaz olabilir", size=12, tone="m")
    f.line(440, 20, 440, 270, dash=True)
    f.text(660, 24, "L3 switch (SVI)", size=14, bold=True)
    f.rect(520, 50, 280, 170, "soft", r=14)
    f.text(660, 72, "L3 switch · ip routing", size=13, bold=True)
    f.box(545, 90, 105, 50, "interface vlan 10", "v1", sub="192.168.10.1", size=11)
    f.box(670, 90, 105, 50, "interface vlan 20", "v2", sub="192.168.20.1", size=11)
    f.arrow(650, 115, 670, 115, both=True)
    f.text(660, 170, "yönlendirme switch'in içinde,", size=12, tone="m")
    f.text(660, 188, "donanımda", size=12, tone="m")
    f.text(660, 250, "ip routing yoksa SVI'lar cevap verir ama yönlendirmez", size=12, tone="warn", bold=True)
    return f


def g6():
    f = Fig(860, 240, "Fiziksel arayüz kapalıysa bütün alt arayüzler düşer", "Gi0/0 shutdown olunca Gi0/0.10 ve Gi0/0.20 de down olur; hiçbir VLAN gateway'ine ulaşamaz.")
    f.box(330, 30, 200, 54, "Gi0/0 · shutdown", "err", sub="administratively down", size=14)
    f.box(160, 150, 200, 54, "Gi0/0.10 · down", "err", sub="VLAN 10 gateway'siz", size=13)
    f.box(500, 150, 200, 54, "Gi0/0.20 · down", "err", sub="VLAN 20 gateway'siz", size=13)
    f.arrow(400, 84, 280, 150, tone="err")
    f.arrow(460, 84, 580, 150, tone="err")
    f.text(430, 230, "Alt arayüzler fiziksel arayüzün üstünde yaşar: temel çökerse hepsi çöker", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 300, "Belirtiye göre ilk bakılacak yer", "Tek PC mi, tek VLAN mı, bütün VLAN'lar mı etkileniyor: etki alanı arızanın yerini gösterir.")
    rows = [
        ("Tek PC başka VLAN'a ulaşamıyor, kendi VLAN'ına ulaşıyor", "PC'nin gateway'i (show ip)", "v1"),
        ("Bir VLAN kendi gateway'ine bile ulaşamıyor", "Alt arayüzün dot1Q etiketi · trunk izinli listesi", "v3"),
        ("Yalnız bir VLAN dışarı çıkıyor", "Router'a giden switch portu trunk mı?", "warn"),
        ("Hiçbir VLAN gateway'ine ulaşamıyor", "Fiziksel arayüz (shutdown?) · kablo", "err"),
    ]
    for i, (sym, look, tone) in enumerate(rows):
        y = 20 + i * 68
        f.box(30, y, 440, 54, sym, tone, size=12)
        f.arrow(470, y + 27, 510, y + 27)
        f.box(514, y, 336, 54, look, "soft", size=12, bold=False)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
