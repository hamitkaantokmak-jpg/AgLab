"""EIGRP dersi şemaları (docs/dersler/eigrp.md)."""

from figures import Fig


def g1():
    f = Fig(880, 260, "EIGRP: gelişmiş uzaklık vektörü", "EIGRP komşularından 'bu ağa benim maliyetim şu' bilgisini alır, haritanın tamamını tutmaz. DUAL algoritması döngüsüz yolu ve yedeğini önceden hesaplar; değişiklikte yalnız değişen bilgi gönderilir.")
    f.table(30, 20, ["", "OSPF", "EIGRP"], [
        ["Tür", "link-state (harita)", "gelişmiş uzaklık vektörü"],
        ["Algoritma", "SPF (Dijkstra)", "DUAL"],
        ["Metrik", "maliyet (bant)", "bant genişliği + gecikme"],
        ["AD", "110", "90 (iç), 170 (dış)"],
        ["Yedek yol", "yeniden hesap", "feasible successor hazır"],
    ], [180, 300, 340])
    f.text(440, 236, "Benzetme: OSPF herkese şehir haritası verir; EIGRP komşulara 'oraya benden şu kadar sürede gidilir' diye sorar", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 290, "Komşuluk şartları", "Aynı AS numarası, aynı K değerleri, aynı alt ağ ve (varsa) aynı kimlik doğrulama gerekir. Hello 5 sn, hold 15 sn (yavaş bağlantılarda 60/180). Zamanlayıcıların aynı olması gerekmez.")
    a = f.device(150, 80, "router", "R1", "router eigrp 100")
    b = f.device(730, 80, "router", "R2", "router eigrp 100")
    f.link(a, b, "Hello 224.0.0.10", tone="accent")
    f.table(140, 140, ["Şart", "Durum"], [["AS numarası", "aynı olmalı"], ["K değerleri", "aynı olmalı"], ["Alt ağ", "aynı olmalı"], ["Hello/hold", "farklı olabilir"]], [300, 300], tones={3: "ok"})
    return f


def g3():
    f = Fig(880, 300, "Metrik: bant genişliği ve gecikme", "Varsayılan K değerleriyle metrik, yoldaki EN DÜŞÜK bant genişliği ile yoldaki gecikmelerin TOPLAMINDAN hesaplanır. Klasik formül: 256 × (10^7 / en düşük bant [kbps] + toplam gecikme [10 µs]).")
    a = f.device(110, 120, "router", "R1")
    b = f.device(380, 120, "router", "R2")
    c = f.device(650, 120, "router", "R3")
    d = f.device(810, 120, "switch", "LAN", w=80)
    f.link(a, b, "1 Gbps · 10 µs", tone="ok")
    f.link(b, c, "10 Mbps · 1000 µs", tone="warn")
    f.link(c, d, "1 Gbps · 10 µs", tone="ok")
    f.note(30, 190, 820, "En düşük bant 10 Mbps (dar boğaz) → 10^7/10000 = 1000; toplam gecikme 1020 µs → 102 · metrik = 256 × (1000 + 102) = 282 112", tone="accent", size=12)
    f.text(440, 270, "Benzetme: yolculuk süresi en dar köprünün genişliğine ve yol boyunca bütün trafik ışıklarındaki beklemeye bağlıdır", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 310, "Successor, feasible successor ve yapılabilirlik şartı", "FD: bu router'ın hedefe toplam metriği. RD (AD): komşunun hedefe bildirdiği metrik. En iyi yol successor'dır. Bir komşunun RD'si successor'ın FD'sinden KÜÇÜKSE o komşu feasible successor (hazır yedek) olur.")
    r = f.device(120, 150, "router", "R1")
    a = f.device(440, 60, "router", "R2", "RD 2000")
    b = f.device(440, 150, "router", "R3", "RD 2500")
    c = f.device(440, 240, "router", "R4", "RD 4000")
    n = f.device(780, 150, "server", "10.9.0.0/24")
    f.link(r, a, "+1000 → FD 3000", tone="ok")
    f.link(r, b, "+1000 → 3500", tone="v1")
    f.link(r, c, "+500 → 4500", tone="err", dash=True)
    for x in (a, b, c):
        f.link(x, n, tone="ln")
    f.note(560, 20, 300, "Successor: R2 (FD 3000)", tone="ok", size=12)
    f.note(540, 262, 330, "R3: 2500 < 3000 → FS · R4: 4000 ≥ 3000 → değil", tone="accent", size=12)
    return f


def g5():
    f = Fig(880, 230, "Yedek yoksa: active durum ve sorgu", "Successor düşünce feasible successor varsa anında geçilir. Yoksa rota 'active' olur ve komşulara sorgu (query) gönderilir; yanıt gelmeyen komşu varsa 'stuck in active' oluşabilir.")
    f.box(30, 40, 390, 120, "FS var", "ok", sub="anında geçiş · milisaniyeler · sorgu yok", size=16)
    f.box(460, 40, 390, 120, "FS yok", "warn", sub="active → query → reply bekle · sorgu alanı büyükse yavaş", size=16)
    f.text(440, 200, "Benzetme: yedek anahtar cebindeyse kapıyı hemen açarsın; değilse komşuları tek tek arayıp sorarsın", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 280, "Stub: sorgu alanını küçült", "Şube router'ı 'stub' ilan edilirse merkez ona sorgu göndermez ve şube transit yol olarak kullanılmaz. Sorgu alanı küçülür, stuck-in-active riski azalır.")
    hq = f.device(440, 60, "router", "Merkez", "query gönderilmez", w=150)
    for i, x in enumerate((160, 440, 720)):
        s = f.device(x, 200, "router", f"Şube {i + 1}", "eigrp stub connected", tone="v1", w=160)
        f.link(hq, s)
    f.text(440, 268, "eigrp stub connected summary (varsayılan) · receive-only · leak-map", size=12, mono=True, bold=True)
    return f


def g7():
    f = Fig(880, 270, "Eşit olmayan yük paylaşımı: variance", "EIGRP feasible successor'lar arasında eşit olmayan yük paylaşımı yapabilir. variance 2 → metriği en iyinin 2 katından küçük olan FS'ler de kullanılır; trafik metrikle ters orantılı dağıtılır.")
    r = f.device(140, 130, "router", "R1")
    a = f.device(560, 60, "router", "R2", "FD 3000 (successor)")
    b = f.device(560, 200, "router", "R3", "FD 5000 (FS)")
    f.link(r, a, "trafiğin ~%62'si", tone="ok")
    f.link(r, b, "trafiğin ~%38'i", tone="v1")
    f.note(660, 110, 210, "variance 2: 5000 < 2 × 3000 → R3 de kullanılır", tone="accent", size=12)
    f.text(440, 258, "Yalnız feasible successor'lar variance ile kullanılabilir: döngü riski yok", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
