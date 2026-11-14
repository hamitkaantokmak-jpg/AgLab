"""Ethernet, MAC ve ARP dersi şemaları (docs/dersler/ethernet-mac-arp.md)."""

from figures import Fig


def g1():
    f = Fig(880, 270, "Mektup ve zarf: IP paketi Ethernet çerçevesinin içinde", "IP adresi mektubun son alıcısıdır ve yol boyunca değişmez; MAC adresi zarfın üstündeki bir sonraki el, her bağlantıda yeniden yazılır.")
    f.text(440, 26, "Ethernet çerçevesi (zarf)", size=14, bold=True)
    f.frame(40, 44, [("Hedef MAC", 130, "v3", "bir sonraki el"), ("Kaynak MAC", 130, "v3", "gönderen kart"), ("Tür", 80, "card", "0x0800 = IPv4"), ("IP paketi (mektup)", 340, "v1", ""), ("FCS", 80, "card", "hata denetimi")], h=60)
    f.rect(390, 116, 340, 56, "v1", r=6, dash=True)
    f.text(475, 140, "Kaynak IP", size=12, bold=True)
    f.text(475, 158, "192.168.10.11", size=11, mono=True, tone="m")
    f.text(645, 140, "Hedef IP", size=12, bold=True)
    f.text(645, 158, "192.168.100.20", size=11, mono=True, tone="m")
    f.line(560, 104, 560, 116, dash=True)
    f.note(40, 190, 380, "MAC: yerel teslimat. Her bağlantıda (her switch'ten router'a, router'dan router'a) değişir.", tone="v3", size=12, title="Zarf")
    f.note(450, 190, 390, "IP: son alıcı. Paket yol boyunca aynı kaynak ve hedef IP ile gider (NAT hariç).", tone="v1", size=12, title="Mektup")
    return f


def g2():
    f = Fig(860, 200, "MAC adresinin anatomisi", "48 bit: ilk yarısı üretici kodu (OUI), ikinci yarısı kartın seri numarası. ffff.ffff.ffff herkese demektir.")
    f.text(430, 40, "0050.7966.6801", size=30, mono=True, bold=True)
    f.rect(285, 56, 140, 10, "v4", r=3)
    f.rect(435, 56, 140, 10, "v2", r=3)
    f.text(355, 90, "Üretici (OUI) · 24 bit", size=13, tone="v4", bold=True)
    f.text(505, 90, "Kartın seri no · 24 bit", size=13, tone="v2", bold=True)
    f.box(60, 120, 340, 56, "ffff.ffff.ffff", "err", sub="broadcast: aynı VLAN'daki herkes", size=14)
    f.box(460, 120, 340, 56, "Cisco yazımı: 3 grup", "soft", sub="Windows 00-50-79-66-68-01 · Linux 00:50:79:66:68:01", size=13)
    return f


def g3():
    f = Fig(880, 300, "Switch MAC adreslerini kendi öğrenir", "Çerçeve gelince switch kaynak MAC'i geldiği portla tabloya yazar; hedef MAC'e bakıp nereye göndereceğine karar verir.")
    sw = f.device(300, 150, "switch", "SW1")
    a = f.device(90, 60, "pc", "PC-A", "..6801 · Fa0/1")
    b = f.device(90, 240, "pc", "PC-B", "..6802 · Fa0/2")
    c = f.device(510, 60, "pc", "PC-C", "..6803 · Fa0/3")
    f.link(a, sw, lb="Fa0/1", tone="accent", width=3)
    f.link(b, sw, lb="Fa0/2")
    f.link(c, sw, lb="Fa0/3")
    f.packet(170, 92, "kaynak ..6801", "accent")
    f.badge(130, 130, 1)
    f.text(600, 140, "MAC tablosu", size=13, bold=True, anchor="start")
    f.table(600, 150, ["VLAN", "MAC", "Port"], [["10", "0050.7966.6801", "Fa0/1"]], [50, 140, 60], tones={0: "ok"}, mono_cols=(1,))
    f.text(600, 230, "1 PC-A bir çerçeve gönderdi:", size=12, anchor="start", tone="m")
    f.text(600, 248, "switch \"..6801 Fa0/1'de\" diye not aldı.", size=12, anchor="start", tone="m")
    f.text(600, 268, "PC-B ve PC-C henüz göndermedi: tabloda yok.", size=12, anchor="start", tone="m")
    return f


def g4():
    f = Fig(880, 260, "İletme kararı: biliyorsa tek porta, bilmiyorsa herkese", "Hedef MAC tabloda varsa çerçeve yalnız o porta gider; yoksa ya da broadcast ise geldiği port hariç aynı VLAN'daki bütün portlara taşırılır.")
    for i, (title, tone, known) in enumerate([("Hedef tabloda var", "ok", True), ("Hedef tabloda yok / broadcast", "warn", False)]):
        ox = 30 + i * 430
        f.text(ox + 190, 26, title, size=14, bold=True, tone=tone)
        sw = f.device(ox + 190, 130, "switch", "SW1")
        a = f.device(ox + 60, 60, "pc", "PC-A")
        b = f.device(ox + 320, 60, "pc", "PC-B")
        c = f.device(ox + 60, 210, "pc", "PC-C")
        d = f.device(ox + 320, 210, "pc", "PC-D")
        f.link(a, sw, tone="accent", width=3)
        f.link(b, sw, tone=tone, width=3)
        f.link(c, sw, tone=tone if not known else "ln", width=3 if not known else 2, dash=known)
        f.link(d, sw, tone=tone if not known else "ln", width=3 if not known else 2, dash=known)
    f.text(220, 254, "yalnız PC-B'ye", size=12, tone="ok")
    f.text(650, 254, "PC-B, PC-C, PC-D'ye (flood, aynı VLAN)", size=12, tone="warn")
    return f


def g5():
    f = Fig(880, 320, "ARP: 'Bu IP kimin?' sorusu", "PC-A, .12'nin MAC'ini bilmiyorsa herkese sorar; yalnız .12 sahibi PC-B kendi MAC'iyle yanıt verir; PC-A cevabı önbelleğe yazar.")
    a = f.device(90, 70, "pc", "PC-A", ".11 · ..6801")
    sw = f.device(440, 70, "switch", "SW1")
    b = f.device(790, 70, "pc", "PC-B", ".12 · ..6802", tone="ok")
    c = f.device(440, 200, "pc", "PC-C", ".13 · ..6803")
    f.link(a, sw)
    f.link(sw, b)
    f.link(sw, c)
    f.badge(40, 160, 1, "warn")
    f.box(60, 140, 280, 44, "Kim 192.168.10.12? Söyle .11'e", "warn", sub="hedef MAC ffff.ffff.ffff (herkese)", size=12)
    f.badge(560, 160, 2, "ok")
    f.box(580, 140, 270, 44, "Ben .12, MAC'im ..6802", "ok", sub="yalnız PC-A'ya (unicast)", size=12)
    f.text(440, 268, "PC-C soruyu duydu ama .12 değil: sessiz kalır.", size=12, tone="m")
    f.badge(40, 298, 3)
    f.text(60, 303, "PC-A önbelleği:  192.168.10.12 → 0050.7966.6802  (bir süre saklanır)", size=13, anchor="start", mono=True)
    return f


def g6():
    f = Fig(880, 240, "Uzak hedef için ARP: hedefi değil gateway'i sor", "PC-A 192.168.100.20'ye gidecekse ARP ile gateway'in (.1) MAC'ini sorar; çerçeve gateway'e, paket sunucuya gider.")
    a = f.device(80, 90, "pc", "PC-A", "192.168.10.11")
    sw = f.device(280, 90, "switch", "SW1")
    r = f.device(500, 90, "router", "R1", "gateway .1 · ..0201")
    s = f.device(780, 90, "server", "SRV", "192.168.100.20")
    f.link(a, sw)
    f.link(sw, r)
    f.link(r, s)
    f.packet(180, 50, "Hedef MAC: ..0201 (R1)", "v3")
    f.packet(650, 50, "Hedef MAC: SRV", "v3")
    f.packet(380, 140, "Hedef IP: 192.168.100.20 (değişmez)", "v1")
    f.note(40, 176, 800, "ARP yalnız kendi yayın alanında (VLAN) çalışır. PC'nin ARP önbelleğinde uzak sunucuyu değil, gateway'i görürsün. Gateway orada Incomplete ise sorun daha hedefe gelmeden, PC'nin kendi ağındadır.", tone="accent", size=12)
    return f


def g7():
    f = Fig(880, 330, "\"Aynı ağdayız ama ulaşamıyorum\": hangi tabloya bakılır", "Hedefin MAC'i ARP'ta çözülmüş mü, switch o MAC'i nerede ve hangi VLAN'da görüyor: dört belirti, dört kanıt.")
    rows = [
        ("ARP'ta Incomplete", "show ip arp / show arp", "Hedef kapalı, yanlış VLAN'da ya da L2 yolu kopuk", "err"),
        ("MAC tabloda hiç yok", "show mac address-table", "Cihaz hiç çerçeve göndermemiş: kablo, kapalı port", "err"),
        ("MAC yanlış VLAN satırında", "show mac address-table address <mac>", "Port yanlış VLAN'da", "warn"),
        ("Aynı IP'nin MAC'i değişiyor", "show ip arp (tekrar tekrar)", "IP çakışması: iki cihaz aynı adresi kullanıyor", "warn"),
        ("Aynı MAC porttan porta zıplıyor", "log: %SW_MATM-4-MACFLAP", "L2 döngüsü (Konu #13)", "err"),
    ]
    f.text(130, 22, "Belirti", size=12, bold=True, tone="m")
    f.text(400, 22, "Kanıt", size=12, bold=True, tone="m")
    f.text(700, 22, "Anlamı", size=12, bold=True, tone="m")
    for i, (sym, cmd, mean, tone) in enumerate(rows):
        y = 32 + i * 58
        f.box(30, y, 200, 48, sym, "accent", size=12)
        f.box(250, y, 300, 48, cmd, "soft", size=12)
        f.box(570, y, 280, 48, mean, tone, size=11, bold=False)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
