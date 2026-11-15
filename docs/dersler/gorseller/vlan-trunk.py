"""VLAN ve trunk dersi şemaları (docs/dersler/vlan-trunk.md)."""

from figures import Fig


def g1():
    f = Fig(860, 330, "VLAN yokken ve varken broadcast", "Solda tek switch'te herkes her broadcast'i duyar; sağda VLAN'lar broadcast'i kendi grubunda tutar.")
    # Sol panel
    f.text(205, 26, "VLAN yok: tek büyük oda", size=15, bold=True)
    sw = f.device(205, 150, "switch", "SW1")
    pcs = [f.device(x, y, "pc", n, s) for x, y, n, s in [(70, 70, "Muhasebe-1", ""), (340, 70, "Muhasebe-2", ""), (70, 240, "Misafir-1", ""), (340, 240, "Misafir-2", "")]]
    for p in pcs:
        f.link(sw, p)
    f.packet(205, 95, "Broadcast", "err")
    f.text(205, 300, "Misafirin her broadcast'i muhasebeye de gider", size=12, tone="err")
    # Ayırıcı
    f.line(430, 20, 430, 310, dash=True)
    # Sağ panel
    f.text(645, 26, "VLAN var: ayrı odalar", size=15, bold=True)
    f.zone(450, 40, 390, 92, "VLAN 10 · Muhasebe", "v1")
    f.zone(450, 205, 390, 92, "VLAN 20 · Misafir", "v2", label_pos="bl")
    sw2 = f.device(645, 168, "switch", "SW1")
    a = [f.device(530, 86, "pc", "Muhasebe-1", tone="v1"), f.device(760, 86, "pc", "Muhasebe-2", tone="v1")]
    b = [f.device(530, 250, "pc", "Misafir-1", tone="v2"), f.device(760, 250, "pc", "Misafir-2", tone="v2")]
    for p in a:
        f.link(sw2, p, tone="v1")
    for p in b:
        f.link(sw2, p, tone="v2")
    f.packet(600, 228, "Broadcast", "v2")
    f.text(645, 318, "Misafirin broadcast'i yalnız VLAN 20'de dolaşır", size=12, tone="ok")
    return f


def g2():
    f = Fig(860, 250, "Access port: PC hangi VLAN'da olduğunu bilmez", "PC etiketsiz çerçeve gönderir; switch portun ayarına bakıp çerçeveyi VLAN 10'a koyar.")
    pc = f.device(90, 120, "pc", "PC-Muhasebe", "192.168.10.11")
    sw = f.device(470, 120, "switch", "SW1", "Fa0/1: access VLAN 10")
    f.link(pc, sw, la="eth0", lb="Fa0/1")
    f.packet(250, 92, "Çerçeve (etiketsiz)")
    f.arrow(200, 150, 320, 150, "PC hiçbir etiket eklemez")
    f.zone(600, 60, 230, 120, "VLAN 10 · Muhasebe", "v1")
    f.box(625, 100, 180, 56, "Switch çerçeveyi VLAN 10'a koyar", "v1", size=12)
    f.arrow(525, 120, 620, 128, tone="v1")
    f.note(40, 196, 780, "VLAN'ı belirleyen PC değil, PC'nin takıldığı switch portudur. IP ayarı kusursuz bir PC yanlış porta takılırsa yanlış odaya girmiş olur.", tone="key" if False else "accent", size=12)
    return f


def g3():
    f = Fig(860, 290, "802.1Q etiketi çerçevenin neresine girer", "Trunk'ta switch, kaynak MAC ile Tür alanı arasına 4 baytlık etiket ekler; etiketin 12 bitlik VID alanı VLAN numarasıdır.")
    f.text(40, 30, "Normal Ethernet çerçevesi", size=13, tone="m", anchor="start", bold=True)
    f.frame(40, 42, [("Hedef MAC", 130, "card", "6 bayt"), ("Kaynak MAC", 130, "card", "6 bayt"), ("Tür", 80, "card", "2 bayt"), ("Veri (IP paketi)", 300, "soft", "46–1500 bayt"), ("FCS", 80, "card", "4 bayt")])
    f.text(40, 130, "Trunk'tan geçerken: 802.1Q etiketli çerçeve", size=13, tone="m", anchor="start", bold=True)
    f.frame(40, 142, [("Hedef MAC", 120, "card", "6 bayt"), ("Kaynak MAC", 120, "card", "6 bayt"), ("802.1Q etiketi", 130, "accent", "4 bayt"), ("Tür", 70, "card", "2 bayt"), ("Veri", 210, "soft", ""), ("FCS", 70, "card", "yeniden")])
    # Etiket ayrıntısı
    f.line(280, 188, 190, 222, dash=True)
    f.line(410, 188, 640, 222, dash=True)
    f.frame(190, 222, [("TPID 0x8100", 170, "accent", "16 bit · 'etiketliyim'"), ("PRI", 60, "warn", "3 bit"), ("DEI", 50, "card", "1 bit"), ("VID", 170, "v1", "12 bit · VLAN no")], h=44, size=11)
    f.text(700, 248, "12 bit → 0–4095", size=12, anchor="start", bold=True)
    f.text(700, 266, "Kullanılabilir: 1–4094", size=12, anchor="start", tone="m")
    return f


def g4():
    f = Fig(880, 300, "Trunk yolculuğu: etiket yalnız switch'ler arasında", "PC1'in çerçevesi access porttan etiketsiz girer, trunk'ta VLAN 10 etiketi taşır, karşı switch'te etiket kaldırılıp PC3'e etiketsiz teslim edilir.")
    pc1 = f.device(70, 90, "pc", "PC1", "VLAN 10", tone="v1")
    pc2 = f.device(70, 220, "pc", "PC2", "VLAN 20", tone="v2")
    sw1 = f.device(270, 155, "switch", "SW1")
    sw2 = f.device(610, 155, "switch", "SW2")
    pc3 = f.device(810, 90, "pc", "PC3", "VLAN 10", tone="v1")
    pc4 = f.device(810, 220, "pc", "PC4", "VLAN 20", tone="v2")
    f.link(pc1, sw1, tone="v1", la="", lb="Fa0/1")
    f.link(pc2, sw1, tone="v2", lb="Fa0/2")
    f.link(sw1, sw2, "TRUNK", la="Gi0/1", lb="Gi0/1", width=4)
    f.link(sw2, pc3, tone="v1", la="Fa0/1")
    f.link(sw2, pc4, tone="v2", la="Fa0/2")
    f.packet(170, 108, "etiketsiz", "v1")
    f.packet(395, 128, "[10]", "v1", w=46)
    f.packet(485, 182, "[20]", "v2", w=46)
    f.packet(712, 108, "etiketsiz", "v1")
    f.badge(170, 70, 1)
    f.badge(395, 98, 2)
    f.badge(712, 70, 3)
    f.text(440, 268, "1 access port: etiket yok · 2 trunk: switch VLAN numarasını yazar · 3 access port: etiket kaldırılır", size=12, tone="m")
    return f


def g5():
    f = Fig(860, 230, "İzinli VLAN listesi: listede olmayan geçemez", "Trunk'ın izinli listesi 10,20 ise VLAN 30 çerçevesi trunk'a girmez.")
    sw1 = f.device(150, 110, "switch", "SW1")
    sw2 = f.device(710, 110, "switch", "SW2")
    f.link(sw1, sw2, "allowed vlan 10,20", la="Gi0/1", lb="Gi0/1", width=4)
    f.packet(300, 60, "[10] geçer", "ok")
    f.packet(300, 160, "[30] düşer", "err")
    f.arrow(345, 60, 560, 60, tone="ok")
    f.line(345, 160, 400, 160, "err", 2)
    f.circle(412, 160, 10, "err")
    f.line(406, 154, 418, 166, "err", 2.2)
    f.line(406, 166, 418, 154, "err", 2.2)
    f.note(470, 140, 360, "switchport trunk allowed vlan 30 listeyi YALNIZ 30 yapar; eklemek için: allowed vlan add 30", tone="warn", size=12)
    return f


def g6():
    f = Fig(860, 250, "Native VLAN uyuşmazlığı", "SW1'de native VLAN 1, SW2'de 99: SW1'in VLAN 1 trafiği etiketsiz gider ve SW2'de VLAN 99'a düşer.")
    sw1 = f.device(150, 100, "switch", "SW1", "native vlan 1")
    sw2 = f.device(710, 100, "switch", "SW2", "native vlan 99")
    f.link(sw1, sw2, "trunk", la="Gi0/1", lb="Gi0/1", width=3)
    f.packet(320, 70, "etiketsiz (VLAN 1)", "v1")
    f.arrow(405, 70, 560, 70, tone="v1")
    f.zone(600, 150, 230, 70, "Karşıda: VLAN 99", "err")
    f.text(715, 200, "Çerçeve yanlış VLAN'a düştü", size=12, tone="err")
    f.note(40, 160, 520, "Etiketsiz giden tek VLAN native VLAN'dır. İki uç farklı native VLAN kullanırsa trafik karşıda başka VLAN'a karışır; switch CDP ile %CDP-4-NATIVE_VLAN_MISMATCH uyarısı verir.", tone="warn", size=12)
    return f


def g7():
    f = Fig(880, 360, "VLAN arızası teşhis sırası", "Port bağlı mı, doğru VLAN'da mı, trunk VLAN'ı taşıyor mu, native eşleşiyor mu: dört soru, dört komut.")
    steps = [
        ("Port bağlı mı?", "show interfaces status", "connected değilse: kablo/shutdown (Konu #4)"),
        ("Port doğru VLAN'da mı?", "show vlan brief", "Ports sütununda port yanlış VLAN'da"),
        ("VLAN switch'te var mı?", "show vlan brief", "VLAN satırı hiç yok"),
        ("Trunk VLAN'ı taşıyor mu?", "show interfaces trunk", "allowed / allowed and active listesinde yok"),
        ("Native eşleşiyor mu?", "show interfaces trunk", "iki uçta Native vlan farklı"),
    ]
    y = 30
    for i, (q, cmd, bad) in enumerate(steps, 1):
        f.badge(40, y + 24, i)
        f.box(64, y, 250, 48, q, "accent", size=13)
        f.box(330, y, 220, 48, cmd, "soft", size=12)
        f.arrow(550, y + 24, 590, y + 24, tone="err")
        f.box(594, y, 260, 48, bad, "err", size=11, bold=False)
        if i < len(steps):
            f.arrow(189, y + 48, 189, y + 66, tone="ok")
        y += 66
    f.text(189, 352, "evet → sıradaki soru", size=11, tone="ok")
    f.text(724, 352, "hayır → arıza burada", size=11, tone="err")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
