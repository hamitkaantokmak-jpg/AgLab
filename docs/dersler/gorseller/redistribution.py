"""Redistribution ve rota filtreleme dersi şemaları (docs/dersler/redistribution.md)."""

from figures import Fig


def g1():
    f = Fig(880, 270, "Redistribution: iki protokol arasında tercüman", "Bir router iki yönlendirme alanının sınırında durur ve birinden öğrendiği rotaları diğerine aktarır. Şirket birleşmeleri, protokol göçleri ve statik rotaların dağıtılması için gerekir.")
    f.zone(20, 40, 340, 180, "OSPF alanı", "v1")
    f.zone(520, 40, 340, 180, "EIGRP 100 alanı", "v2")
    a = f.device(150, 130, "router", "R-O")
    r = f.device(440, 130, "router", "ASBR", "iki protokolü de çalıştırır", tone="accent", w=170)
    b = f.device(730, 130, "router", "R-E")
    f.link(a, r, tone="v1")
    f.link(r, b, tone="v2")
    f.text(440, 248, "Benzetme: iki farklı dili konuşan iki köy arasındaki tercüman; her köye diğerinin haberlerini kendi dilinde aktarır", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 260, "Tohum metrik (seed metric)", "Bir protokolün metriği diğerine çevrilemez; aktarılan rotaya başlangıç metriği verilir. OSPF varsayılan 20 (E2) verir. EIGRP ve RIP metriksiz aktarılan rotayı sonsuz sayar ve KULLANMAZ.")
    f.table(30, 20, ["Hedef protokol", "Metrik verilmezse", "Ne yapılmalı"], [
        ["OSPF", "20, tip E2 (BGP'den 1)", "gerekirse metric / metric-type"],
        ["EIGRP", "sonsuz → rota görünmez", "metric 100000 100 255 1 1500 (bant, gecikme, güv., yük, MTU)"],
        ["RIP", "sonsuz → görünmez", "metric 1–15"],
        ["BGP", "IGP metriği MED olur", "gerekirse route-map ile"],
    ], [180, 260, 380], tones={1: "err", 2: "err"})
    f.text(440, 200, "Benzetme: farklı para birimleri; kur belirtilmezse karşı taraf parayı kabul etmez", size=12, tone="m")
    f.text(440, 232, "Varsayılanı süreç altında da verebilirsin: default-metric …", size=12, tone="accent", bold=True)
    return f


def g3():
    f = Fig(880, 300, "İki noktadan karşılıklı aktarım: geri besleme döngüsü", "Rotalar A'dan B'ye bir ASBR'den aktarılır, B içinde dolaşır, diğer ASBR'den A'ya geri döner. AD ve metrik farkları yüzünden router kendi alanındaki ağa dış yoldan gitmeye başlayabilir.")
    f.zone(20, 40, 300, 220, "OSPF", "v1")
    f.zone(560, 40, 300, 220, "EIGRP", "v2")
    a1 = f.device(440, 90, "router", "ASBR-1", tone="accent")
    a2 = f.device(440, 210, "router", "ASBR-2", tone="accent")
    o = f.device(160, 150, "server", "10.1.0.0/16", "OSPF içi")
    e = f.device(720, 150, "router", "R-E")
    f.link(o, a1, tone="v1")
    f.link(o, a2, tone="v1")
    f.link(a1, e, tone="v2")
    f.link(a2, e, tone="v2")
    f.path("M 500 90 C 700 40, 760 250, 500 215", tone="err", width=2, arrow=True, dash=True)
    f.text(440, 288, "10.1.0.0 OSPF'e E2 olarak geri döner", size=12, tone="err", bold=True)
    return f


def g4():
    f = Fig(880, 245, "Çözüm: etiketle ve geri almayı engelle", "Bir yönde aktarılan rotalara etiket (tag) konur; ters yönde aktarırken o etiketi taşıyan rotalar reddedilir. Böylece bir rota çıktığı alana geri dönemez.")
    f.box(30, 40, 390, 140, "OSPF → EIGRP", "v1", sub="set tag 110 · (OSPF kökenli işaretle)", size=15)
    f.box(460, 40, 390, 140, "EIGRP → OSPF", "v2", sub="match tag 110 → deny · geri kalanı permit + set tag 90", size=15)
    f.text(440, 220, "Benzetme: ihraç edilen ürüne ülke etiketi koymak; aynı ürün geri ithal edilmeye çalışılınca gümrükte reddedilir", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 270, "Prefix-list: önek ve uzunluk eşleştirme", "Prefix-list ağ adresini ve maske uzunluğunu birlikte eşler. ge ve le uzunluk aralığı verir. Sona örtük deny vardır; satırlar sıra numarasıyla okunur.")
    f.table(30, 20, ["Satır", "Eşleşir", "Eşleşmez"], [
        ["permit 10.1.0.0/16", "yalnız 10.1.0.0/16", "10.1.5.0/24"],
        ["permit 10.1.0.0/16 le 24", "10.1.0.0/16 … 10.1.x.0/24", "10.1.5.128/25"],
        ["permit 10.1.0.0/16 ge 24 le 24", "yalnız 10.1.x.0/24'ler", "10.1.0.0/16"],
        ["permit 0.0.0.0/0", "yalnız varsayılan rota", "diğer her şey"],
        ["permit 0.0.0.0/0 le 32", "her şey", "—"],
    ], [300, 280, 240], mono_cols=(0, 1, 2))
    f.text(440, 210, "ip prefix-list SUBE seq 10 permit 10.1.0.0/16 le 24", size=13, mono=True, bold=True)
    f.text(440, 244, "ACL'den farkı: maske uzunluğunu da eşler; rota filtrelemede tercih edilir", size=12, tone="accent", bold=True)
    return f


def g6():
    f = Fig(880, 300, "Route-map: eğer … ise … yap", "Route-map sıra numaralı bloklardan oluşur. Her blok match koşullarına bakar; eşleşirse permit ise set uygulanır ve rota alınır, deny ise rota reddedilir. Hiçbir bloka uymayan rota örtük deny ile atılır.")
    blocks = [("10 deny", "match tag 110", "geri dönen rotayı reddet", "err"), ("20 permit", "match ip address prefix-list SUBE", "set metric 50 · set tag 90", "ok"), ("(örtük) deny", "kalan her şey", "reddedilir!", "soft")]
    for i, (t, m, s, tone) in enumerate(blocks):
        y = 20 + i * 70
        f.rect(30, y, 820, 60, tone, r=8)
        f.text(50, y + 36, t, size=14, bold=True, anchor="start")
        f.text(230, y + 26, m, size=12, mono=True, anchor="start")
        f.text(230, y + 46, s, size=12, anchor="start", tone="m")
    f.text(440, 250, "Sona permit bloku koymayı unutmak: yalnız istediğini değil, her şeyi keser", size=12, tone="err", bold=True)
    f.text(440, 280, "Benzetme: güvenlik görevlisinin talimat listesi; listede olmayan kimse giremez", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 190, "Nerede filtrelenir?", "Aktarımda route-map hangi rotaların diğer protokole geçeceğini seçer. distribute-list bir protokolün rota tablosuna giren ya da komşuya giden rotaları süzer. BGP'de komşu başına route-map/prefix-list kullanılır.")
    f.table(30, 20, ["Yer", "Araç", "Örnek"], [
        ["Aktarım sırasında", "redistribute … route-map", "redistribute eigrp 100 subnets route-map E2O"],
        ["IGP'de rota tablosuna girerken", "distribute-list … in", "distribute-list prefix SUBE in g0/1"],
        ["IGP'de komşuya giderken", "distribute-list … out", "(EIGRP/RIP; OSPF'te alan içinde değil)"],
        ["BGP komşusu", "neighbor … route-map / prefix-list", "neighbor 203.0.113.1 prefix-list OUT out"],
    ], [220, 260, 340], mono_cols=(2,))
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
