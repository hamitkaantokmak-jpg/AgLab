"""IP adresleme dersi şemaları (docs/dersler/ip-adresleme.md)."""

from figures import Fig


def numberline(f, x, y, w, lo, hi, marks, label_every=None):
    """0–255 aralığında son oktet çizgisi; marks = [(değer, yazı, ton)]."""
    f.line(x, y, x + w, y, width=2)
    pos = lambda v: x + w * (v - lo) / (hi - lo)
    for v, s, tone in marks:
        px = pos(v)
        f.line(px, y - 7, px, y + 7, tone=tone if tone != "t" else "ln", width=2)
        f.text(px, y + 24, s, size=12, tone=tone if tone not in ("t",) else "t", bold=tone != "m")
    return pos


def g1():
    f = Fig(860, 250, "IP adresi: sokak adı ve kapı numarası", "Maske, adresin ne kadarının ağı (sokağı), ne kadarının cihazı (kapı numarasını) gösterdiğini söyler.")
    f.text(430, 30, "192.168.10.25 / 24", size=26, bold=True, mono=True)
    f.rect(195, 50, 330, 54, "v1", r=8)
    f.rect(525, 50, 140, 54, "v3", r=8)
    for i, (o, x) in enumerate([("192", 245), ("168", 330), ("10", 420)]):
        f.text(x + 30, 85, o, size=22, bold=True, mono=True)
    f.text(595, 85, "25", size=22, bold=True, mono=True)
    f.text(360, 128, "Ağ kısmı: ilk 24 bit", size=13, tone="v1", bold=True)
    f.text(595, 128, "Cihaz kısmı: 8 bit", size=13, tone="v3", bold=True)
    f.note(60, 150, 360, "Sokak adı: aynı sokaktaki evler birbirine doğrudan yürür. Aynı ağdaki cihazlar birbirine doğrudan gönderir.", tone="v1", size=12, title="Ağ = sokak")
    f.note(440, 150, 360, "Kapı numarası: sokakta her evin numarası tektir. Aynı ağda iki cihaz aynı numarayı alamaz.", tone="v3", size=12, title="Cihaz = kapı no")
    return f


def g2():
    f = Fig(880, 300, "Bit görünümü: 192.168.10.130 /25", "Maske 25 bit: son oktetin ilk biti de ağa aittir. Cihaz bitleri sıfırsa ağ adresi, birse yayın adresi çıkar.")
    bits = {"192": "11000000", "168": "10101000", "10": "00001010", "130": "10000010"}
    x0, y0, cw = 30, 50, 20
    rows = [("Adres", "130", None), ("Ağ adresi (cihaz bitleri 0)", "128", "10000000"), ("Yayın adresi (cihaz bitleri 1)", "255", "11111111")]
    for r, (name, last, override) in enumerate(rows):
        y = y0 + r * 74
        f.text(x0, y - 4, name, size=12, tone="m", anchor="start", bold=True)
        x = x0
        for oi, oc in enumerate(["192", "168", "10", "130"]):
            b = bits[oc] if not (oi == 3 and override) else override
            for bi, ch in enumerate(b):
                n = oi * 8 + bi
                tone = "v1" if n < 25 else "v3"
                f.rect(x, y, cw - 2, 30, tone, r=3, width=1)
                f.text(x + (cw - 2) / 2, y + 20, ch, size=13, mono=True, bold=True)
                x += cw
            x += 10
        dec = "192.168.10." + last
        f.text(x + 14, y + 20, dec, size=15, mono=True, bold=True, anchor="start")
    f.line(x0 + 25 * cw + 3 * 10 - 1, 40, x0 + 25 * cw + 3 * 10 - 1, 250, tone="err", width=2.5, dash=True)
    f.text(x0 + 25 * cw + 30, 270, "/25 sınırı", size=12, tone="err", bold=True)
    f.text(200, 270, "mavi: ağ bitleri", size=12, tone="v1", bold=True)
    f.text(560, 290, "turuncu: cihaz bitleri", size=12, tone="v3", bold=True)
    return f


def g3():
    f = Fig(880, 270, "Bloklar: /24, /25, /26 ve .130'un yeri", "Son oktet 0–255 bir cetvel gibi bölünür; blok büyüklüğü 256 − maskenin son okteti.")
    x, w = 70, 740
    for i, (pref, size, tone) in enumerate([("/24", 256, "v1"), ("/25", 128, "v2"), ("/26", 64, "v4")]):
        y = 40 + i * 62
        f.text(40, y + 22, pref, size=14, bold=True)
        n = 256 // size
        for k in range(n):
            bx = x + w * k * size / 256
            bw = w * size / 256
            hit = k * size <= 130 < (k + 1) * size
            f.rect(bx + 1, y, bw - 2, 34, tone if hit else "soft", r=5)
            f.text(bx + bw / 2, y + 22, f".{k * size} – .{(k + 1) * size - 1}", size=12, bold=hit)
    px = x + w * 130 / 256
    f.line(px, 30, px, 222, tone="err", width=2.5)
    f.packet(px, 240, ".130 burada", "err")
    f.text(440, 266, "Blok büyüklüğü: /24 → 256, /25 → 128, /26 → 64 (256 − 192)", size=12, tone="m")
    return f


def g4():
    f = Fig(860, 300, "PC'nin her pakette sorduğu soru", "Hedef kendi ağımdaysa doğrudan gönderirim; değilse ağ geçidine veririm.")
    f.box(300, 20, 260, 54, "Hedef benim ağımda mı?", "accent", sub="kendi adresim + kendi maskem", size=14)
    f.arrow(360, 74, 200, 120, "evet", tone="ok")
    f.arrow(500, 74, 660, 120, "hayır", tone="err")
    f.box(60, 124, 280, 70, "Doğrudan gönder", "ok", sub="ARP: 'Hedef IP kimin?' (aynı ağda yayın)")
    f.box(520, 124, 280, 70, "Ağ geçidine (gateway) ver", "warn", sub="ARP: 'Gateway kimin?'")
    f.note(60, 214, 740, "Benzetme: Aynı sokaktaki komşuya mektubu elden verirsin; başka şehre gidecek mektubu postaneye (gateway) bırakırsın. Maske yanlışsa PC, komşusunu başka şehirde sanır ya da postanenin kendi sokağında olmadığını düşünür.", tone="v4", size=12)
    return f


def g5():
    f = Fig(880, 230, "Yanlış maske: PC'nin dünyası daralır", "PC-13 .130/25 kendi ağını .128–.255 sanar; gateway .1 bu aralığın dışında kalır.")
    f.text(440, 26, "PC-13: 192.168.10.130 / 25   ·   gateway 192.168.10.1", size=14, bold=True, mono=True)
    x, w, y = 60, 760, 110
    f.rect(x + w * 128 / 256, y - 34, w * 128 / 256, 68, "v3", r=8, dash=True)
    f.text(x + w * 128 / 256 + 6, y - 14, ".128", size=11, tone="v3", anchor="start")
    f.text(x + w * 192 / 256, y - 42, "PC-13'ün sandığı ağ: .128 – .255", size=12, tone="v3", bold=True)
    numberline(f, x, y, w, 0, 256, [(1, "gateway .1", "err"), (64, "komşu .64", "m"), (130, "PC-13 .130", "v3"), (255, ".255", "m")])
    f.note(60, 160, 760, "Sonuç: PC-13 gateway'e ulaşamaz (\"ağımda değil\" der ama gateway'e de ulaşamaz). .1–.127 arasındaki komşularını da başka ağda sanır. Kablo, switch, VLAN aynı; sorun yalnız maskede.", tone="err", size=12)
    return f


def g6():
    f = Fig(880, 260, "Router'ın maskesi yanlış: bir yarı dışarıda kalır", "R1 Gi0/0 /25 olunca router yalnız .0–.127'yi kendi ağı sayar; .130'a yanıt göndermez.")
    r1 = f.device(130, 70, "router", "R1", "Gi0/0 192.168.10.1 /25")
    sw = f.device(430, 70, "switch", "SW1")
    srv = f.device(130, 190, "server", "SRV", "192.168.100.10")
    p11 = f.device(640, 40, "pc", "PC-11", ".11 /24", tone="ok")
    p13 = f.device(640, 140, "pc", "PC-13", ".130 /24", tone="err")
    f.link(r1, sw, la="Gi0/0")
    f.link(r1, srv, la="Gi0/1")
    f.link(sw, p11, tone="ok")
    f.link(sw, p13, tone="err")
    f.note(560, 190, 300, "R1: '.130 benim ağımda değil' der; PC-13'e giden yanıtı nereye göndereceğini bilemez.", tone="err", size=12)
    f.text(130, 250, "PC-11 dışarı çıkar, PC-13 çıkamaz: aynı switch, aynı ayar", size=12, tone="m", anchor="start")
    return f


def g7():
    f = Fig(880, 270, "Adres çakışması: gateway adresini başka cihaz almış", "Dizüstüye elle .1 yazılınca ARP yanıtını o verir; kat dışarı çıkamaz. TTL 64 ipucudur: Cisco router 255 ile yanıt verir.")
    r1 = f.device(150, 80, "router", "R1", "192.168.10.1 · MAC ..0201")
    lap = f.device(150, 200, "laptop", "LAPTOP", "192.168.10.1 · MAC ..0099", tone="err")
    sw = f.device(440, 140, "switch", "SW1")
    pc = f.device(730, 140, "pc", "PC-11", "192.168.10.11")
    f.link(r1, sw)
    f.link(lap, sw, tone="err")
    f.link(sw, pc)
    f.packet(600, 100, "ARP: .1 kimin?", "accent")
    f.packet(320, 230, "Ben! MAC ..0099", "err")
    f.text(730, 210, "ping .1 → ttl=64", size=13, mono=True, tone="err", bold=True)
    f.text(730, 230, "(router olsa 255 olurdu)", size=11, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
