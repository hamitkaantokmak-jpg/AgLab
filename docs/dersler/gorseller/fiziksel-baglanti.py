"""Fiziksel bağlantı dersi şemaları (docs/dersler/fiziksel-baglanti.md)."""

from figures import Fig


def g1():
    f = Fig(880, 300, "Port durumları: dört renk", "connected, notconnect, disabled ve err-disabled; her biri farklı bir nedene ve farklı bir çözüme işaret eder.")
    rows = [
        ("connected", "ok", "Port açık, karşıda canlı bir cihaz var", "Katman 1 sağlam; üst katmana geç"),
        ("notconnect", "soft", "Port açık ama karşıda kimse yok", "Kablo, karşı port ya da karşı cihaz"),
        ("disabled", "warn", "Port shutdown ile elle kapatılmış", "no shutdown"),
        ("err-disabled", "err", "Switch portu kendisi kapatmış", "Güvenlik/koruma kuralı (Konu #13, #21)"),
    ]
    f.text(130, 24, "Durum", size=12, bold=True, tone="m")
    f.text(420, 24, "Ne demek", size=12, bold=True, tone="m")
    f.text(720, 24, "Ne yapılır", size=12, bold=True, tone="m")
    for i, (st, tone, mean, todo) in enumerate(rows):
        y = 36 + i * 64
        f.circle(48, y + 26, 11, tone)
        f.box(68, y, 160, 52, st, tone, size=14)
        f.box(244, y, 340, 52, mean, "soft", size=12, bold=False)
        f.box(600, y, 250, 52, todo, "card", size=12, bold=False)
    return f


def g2():
    f = Fig(880, 230, "İki uç kuralı: bir bağlantının iki ucu vardır", "SW1 Gi0/1 kapatılırsa SW1'de disabled, SW2'de notconnect görünür. SW2'ye bakan 'kablo bozuk' sanır; kablo sağlamdır.")
    s1 = f.device(150, 90, "switch", "SW1", "Gi0/1: disabled", tone="warn")
    s2 = f.device(720, 90, "switch", "SW2", "Gi0/1: notconnect", tone="soft")
    f.link(s1, s2, "kablo sağlam", la="Gi0/1", lb="Gi0/1", dash=True)
    f.note(40, 150, 380, "Sorun burada: port elle kapatılmış (shutdown).", tone="warn", size=12)
    f.note(460, 150, 380, "Bu uç yalnız 'karşıda kimse yok' der; nedenini bilmez.", tone="soft", size=12)
    return f


def g3():
    f = Fig(880, 250, "Masadan switch'e: yapısal kablolama", "Masadaki priz duvar içinden kablo dolabındaki patch panele gider; panelden kısa bir kabloyla switch portuna bağlanır. Her nokta etiketli olmalıdır.")
    f.zone(355, 40, 420, 150, "Kablo dolabı", "v4")
    pc = f.device(70, 120, "pc", "PC-2")
    f.box(170, 92, 110, 56, "Duvar prizi", "soft", sub="etiket: K2-14", size=12)
    f.box(380, 92, 130, 56, "Patch panel", "soft", sub="port 14", size=12)
    sw = f.device(700, 120, "switch", "SW1", "Fa0/2 · description PC-2")
    f.line(117, 120, 170, 120, width=3)
    f.line(280, 120, 380, 120, width=3, dash=True)
    f.text(330, 110, "duvar içi", size=11, tone="m")
    f.text(330, 140, "(≤ 90 m)", size=11, tone="m")
    f.line(510, 120, 628, 120, width=3)
    f.text(568, 110, "patch kablo", size=11, tone="m")
    f.note(40, 200, 800, "Etiket yoksa 'masası değişen çalışan' gibi basit bir iş kablo takibine döner. Switch portundaki description, etiketin yazılımdaki karşılığıdır.", tone="accent", size=12)
    return f


def g4():
    f = Fig(880, 230, "Kablo türü ve mesafe", "Bakır UTP 100 metreye kadar; çok modlu fiber yüzlerce metre; tek modlu fiber kilometrelerce taşır.")
    rows = [
        ("Bakır UTP (Cat5e/6/6A)", "v1", 100, "100 m · Cat6A 10 Gbps"),
        ("Çok modlu fiber (multimode)", "v2", 400, "yüzlerce metre · bina içi omurga"),
        ("Tek modlu fiber (single-mode)", "v3", 520, "kilometrelerce · binalar arası"),
    ]
    for i, (name, tone, w, sub) in enumerate(rows):
        y = 30 + i * 62
        f.text(40, y + 26, name, size=13, bold=True, anchor="start")
        f.rect(290, y + 6, w * 0.7, 30, tone, r=6)
        f.text(300 + w * 0.7, y + 26, sub, size=12, anchor="start", tone="m")
    f.text(440, 220, "Çubuklar ölçekli değildir; sıralamayı gösterir. Fiber switch'e SFP modülüyle takılır; iki ucun modülü ve fiber türü uyumlu olmalıdır.", size=11, tone="m")
    return f


def g5():
    f = Fig(880, 260, "PoE güç bütçesi (örnek değerler)", "Switch'in toplam PoE bütçesi dolarsa yeni takılan cihaza güç verilmez; port bağlı görünür ama cihaz açılmaz.")
    f.text(40, 30, "Örnek switch: toplam PoE bütçesi 120 W", size=14, bold=True, anchor="start")
    x, y, scale = 40, 50, 6.5
    used = [("Kamera 15,4 W", 15.4, "v1"), ("Kamera 15,4 W", 15.4, "v1"), ("Telefon 15,4 W", 15.4, "v2"), ("AP 30 W", 30, "v4"), ("AP 30 W", 30, "v4")]
    cx = x
    for name, w, tone in used:
        f.rect(cx, y, w * scale, 44, tone, r=4)
        f.text(cx + w * scale / 2, y + 27, name, size=11, bold=True)
        cx += w * scale
    f.rect(cx, y, (120 - sum(u[1] for u in used)) * scale, 44, "soft", r=4, dash=True)
    f.text(cx + (120 - sum(u[1] for u in used)) * scale / 2, y + 27, "kalan 13,8 W", size=11, tone="m")
    f.box(40, 130, 300, 56, "Yeni AP takıldı: 30 W istiyor", "err", sub="kalan 13,8 W yetmez → AP açılmaz", size=13)
    f.note(380, 130, 460, "Standartlar (uçta en fazla): 802.3af 15,4 W · 802.3at (PoE+) 30 W · 802.3bt 60–90 W. Port connected görünse bile güç verilmemiş olabilir.", tone="warn", size=12)
    return f


def g6():
    f = Fig(880, 220, "Duplex uyuşmazlığı: bağlantı var ama yavaş", "Bir uç full duplex'e sabitlenip öbürü otomatikte kalırsa otomatik uç half duplex'e düşer; çakışma ve CRC sayaçları artar, kullanıcı 'çok yavaş' der.")
    s1 = f.device(150, 80, "switch", "SW1", "duplex full (elle)", tone="warn")
    s2 = f.device(720, 80, "pc", "PC-1", "auto → half duplex", tone="warn")
    f.link(s1, s2, "çalışıyor ama yavaş", la="Fa0/1")
    f.note(40, 140, 800, "İz: show interfaces sayaçlarında late collision ve CRC artışı. Çözüm: iki ucu da auto bırak ya da ikisini aynı değere sabitle. Yalnız artan sayaç sorun gösterir: clear counters, bekle, tekrar oku.", tone="warn", size=12)
    return f


def g7():
    f = Fig(880, 300, "Fiziksel arıza teşhis akışı", "show interfaces status'taki duruma göre dallan: disabled → aç; notconnect → karşı uç, kablo, güç; err-disabled → koruma kuralı; connected ama yavaş → sayaçlar.")
    f.box(330, 14, 220, 50, "show interfaces status", "accent", size=14)
    outs = [
        (20, "disabled", "warn", "no shutdown\n(nedenini sor: kim kapattı?)"),
        (240, "notconnect", "soft", "karşı uca bak · kablo/priz · karşı cihaz açık mı"),
        (460, "err-disabled", "err", "hangi kural? port security / BPDU Guard"),
        (680, "connected ama yavaş", "ok", "sayaçlar: CRC, late collision · duplex"),
    ]
    for x, st, tone, todo in outs:
        f.arrow(440, 64, x + 90, 110, tone="ln")
        f.box(x, 112, 180, 46, st, tone, size=13)
        f.arrow(x + 90, 158, x + 90, 186)
        f.box(x, 188, 180, 92, todo, "card", size=12, bold=False)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
