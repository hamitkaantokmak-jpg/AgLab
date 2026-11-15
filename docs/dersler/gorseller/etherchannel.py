"""EtherChannel dersi şemaları (docs/dersler/etherchannel.md)."""

from figures import Fig


def _pair(f, y, tone_a, tone_b, label_a, label_b, dash_b=False, blocked_b=False):
    a = f.device(150, y, "switch", "SW1")
    b = f.device(730, y, "switch", "SW2")
    f.line(197, y - 12, 683, y - 12, tone=tone_a, width=3)
    f.line(197, y + 12, 683, y + 12, tone=tone_b, width=3, dash=dash_b)
    f.text(440, y - 20, label_a, size=11, tone="m")
    f.text(440, y + 32, label_b, size=11, tone="m")
    if blocked_b:
        f.circle(250, y + 12, 9, "err")
        f.line(245, y + 7, 255, y + 17, "err", 2.2)
        f.line(245, y + 17, 255, y + 7, "err", 2.2)
    return a, b


def g1():
    f = Fig(880, 300, "İki kablo, ama biri boşta", "Yalnız ikinci kablo çekmek hızı artırmaz: STP döngüyü önlemek için onu bloklar. EtherChannel iki kabloyu tek mantıksal bağlantı yapar; ikisi de çalışır.")
    f.text(30, 40, "Kanalsız", size=13, bold=True, anchor="start")
    _pair(f, 90, "ok", "err", "Gi0/1 · çalışıyor", "Gi0/2 · STP bloklu", dash_b=True, blocked_b=True)
    f.text(30, 180, "EtherChannel", size=13, bold=True, anchor="start")
    _pair(f, 230, "ok", "ok", "Gi0/1", "Gi0/2")
    f.rect(400, 200, 80, 60, "accent", r=30, dash=True, width=1.5)
    f.text(440, 236, "Po1", size=13, bold=True)
    return f


def g2():
    f = Fig(880, 250, "Benzetme: çok şeritli otoyol", "Port-channel tek bir otoyoldur, üyeler şeritleridir. Bir şerit kapanınca yol açık kalır; ama tek bir araba aynı anda iki şeritte gidemez.")
    for i in range(3):
        y = 50 + i * 50
        f.rect(80, y, 720, 40, "soft", r=4)
        f.text(60, y + 25, f"Gi0/{i + 1}", size=11, tone="m", anchor="end")
    f.packet(200, 70, "akış A", tone="v1")
    f.packet(420, 120, "akış B", tone="v2")
    f.packet(620, 170, "akış C", tone="v3")
    f.packet(320, 70, "akış A", tone="v1")
    f.text(440, 226, "Her akış karma (hash) ile tek şeride gider: dağıtım akışlar arasıdır, paket paket değil", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 300, "Mod çiftleri: kim kiminle kanal kurar?", "LACP'de en az bir uç active olmalıdır. on pazarlık yapmaz; yalnız on ile eşleşir. passive-passive ve auto-auto kurulmaz.")
    rows = [
        ["active", "active / passive", "Kurulur"],
        ["passive", "passive", "KURULMAZ: ikisi de bekler"],
        ["desirable (PAgP)", "desirable / auto", "Kurulur"],
        ["auto (PAgP)", "auto", "KURULMAZ"],
        ["on", "on", "Pazarlıksız kurulur"],
        ["on", "active / passive", "KURULMAZ"],
    ]
    f.table(60, 20, ["Bir uç", "Öbür uç", "Sonuç"], rows, [220, 240, 300], tones={0: "ok", 1: "err", 2: "ok", 3: "err", 4: "ok", 5: "err"}, mono_cols=(0, 1))
    f.text(440, 240, "Benzetme: iki kişi de \"sen ara\" derse (passive-passive) telefon hiç çalmaz", size=12, tone="m")
    f.text(440, 268, "LACP standarttır (IEEE 802.1AX) ve tercih edilir", size=12, tone="accent", bold=True)
    return f


def g4():
    f = Fig(880, 240, "Üyeler ikiz olmalı", "Hız, duplex, switchport modu, access VLAN ya da trunk izinli listesi ve native VLAN bütün üyelerde aynı olmalıdır. Farklı olan üye askıya alınır (s).")
    f.table(40, 20, ["Ayar", "Gi0/1", "Gi0/2"], [
        ["hız / duplex", "1000 / full", "1000 / full"],
        ["mod", "trunk", "trunk"],
        ["izinli VLAN", "1,10,20", "1,10"],
        ["native VLAN", "1", "1"],
    ], [220, 200, 200], tones={2: "err"}, mono_cols=(1, 2))
    f.box(680, 40, 170, 110, "Gi0/2 (s)", "err", sub="askıda, kanala girmez", size=15)
    f.note(40, 180, 800, "Kural: ayarı Port-channel arayüzüne yaz; oradan üyelere yayılır. Üyeleri tek tek değiştirmek uyumsuzluk üretir.", tone="ok", size=12)
    return f


def g5():
    f = Fig(880, 210, "show etherchannel summary bayrakları", "P kanalda, s askıda (ayar farkı), I tek başına (karşı taraf pazarlığa girmiyor), D kapalı. Po1(SU) kanalın çalıştığını, (SD) çalışmadığını gösterir.")
    f.table(40, 20, ["Bayrak", "Anlamı", "Nereye bak"], [
        ["(P)", "kanalda, çalışıyor", "—"],
        ["(s)", "askıda: üye ayarı farklı", "hız, duplex, VLAN, trunk"],
        ["(I)", "tek başına: pazarlık yok", "karşı ucun modu"],
        ["(D)", "port kapalı", "kablo, shutdown"],
        ["Po1(SD)", "kanal down", "mod çifti"],
    ], [140, 330, 330], tones={0: "ok", 1: "warn", 2: "warn", 3: "err", 4: "err"}, mono_cols=(0,))
    return f


def g6():
    f = Fig(880, 230, "STP kanalı tek bağlantı görür", "Kanal kurulunca STP'nin gözünde iki kablo yoktur, tek Po1 vardır; bloklanacak bir şey kalmaz. Bir üye kopunca Po1 kesintisiz devam eder.")
    a = f.device(150, 110, "switch", "SW1", "STP: Po1 Desg FWD", w=180)
    b = f.device(730, 110, "switch", "SW2", "STP: Po1 Root FWD", w=180)
    f.link(a, b, "Po1 · 2 × 1G", tone="ok", width=5)
    f.note(250, 160, 380, "Gi0/2 koparsa: Po1 Gi0/1 ile devam eder, STP yeniden hesaplamaz.", tone="accent", size=12)
    return f


def g7():
    f = Fig(880, 300, "Kurulum sırası", "Üyeleri aynı kanal grubuna, uygun modla al; ardından ayarı Port-channel arayüzüne yaz ve bayraklarla doğrula.")
    steps = [
        ("interface range gi0/1 - 2", "üyeleri seç"),
        ("channel-group 1 mode active", "LACP ile kanala al (iki uçta)"),
        ("interface port-channel 1", "mantıksal arayüze geç"),
        ("switchport mode trunk", "ayar buraya yazılır, üyelere yayılır"),
        ("show etherchannel summary", "Po1(SU), üyeler (P)"),
    ]
    for i, (cmd, why) in enumerate(steps):
        y = 20 + i * 54
        f.badge(36, y + 20, i + 1)
        f.rect(60, y, 420, 40, "soft", r=6)
        f.text(74, y + 25, cmd, size=12, mono=True, anchor="start", bold=True)
        f.text(500, y + 25, why, size=12, anchor="start", tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
