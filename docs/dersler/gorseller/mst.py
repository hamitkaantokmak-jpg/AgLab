"""MST ve ileri STP dersi şemaları (docs/dersler/mst.md)."""

from figures import Fig


def g1():
    f = Fig(880, 270, "Neden MST? VLAN başına ağaç pahalıdır", "PVST+ 500 VLAN için 500 ayrı ağaç hesaplar ve 500 ayrı BPDU gönderir. Oysa ağda yalnız iki farklı yol vardır. MST VLAN'ları birkaç örneğe (instance) toplar.")
    f.box(30, 30, 390, 150, "PVST+ / Rapid PVST+", "warn", sub="500 VLAN = 500 ağaç, 500 × BPDU, 500 × CPU işi", size=15)
    f.box(460, 30, 390, 150, "MST", "ok", sub="500 VLAN → 2 örnek: 2 ağaç, aynı yük paylaşımı", size=15)
    f.text(440, 220, "Benzetme: 500 öğrenciyi tek tek okula taşımak yerine iki servis otobüsüne bindirmek", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 290, "MST bölgesi: üç şey aynı olmalı", "Bölge adı, revizyon numarası ve VLAN–örnek eşlemesi aynı olan switch'ler aynı bölgededir. Tek bir fark switch'i ayrı bir bölge yapar.")
    f.table(30, 20, ["Ayar", "SW1", "SW2", "SW3"], [
        ["name", "KAMPUS", "KAMPUS", "KAMPUS"],
        ["revision", "1", "1", "1"],
        ["instance 1", "VLAN 10-19", "VLAN 10-19", "VLAN 10-19"],
        ["instance 2", "VLAN 20-29", "VLAN 20-29", "VLAN 20-30"],
    ], [180, 200, 200, 200], tones={3: "err"}, mono_cols=(1, 2, 3))
    f.note(30, 170, 820, "SW3'te VLAN 30 fazladan instance 2'de: eşleme özeti (digest) farklı → SW3 ayrı bölge, SW2–SW3 arası bölge sınırı olur ve yük paylaşımı bozulur.", tone="err", size=12)
    f.text(440, 262, "Benzetme: aynı apartman yönetimine üye olmak için aynı adres, aynı yönetmelik, aynı daire listesi", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 300, "Örnekler ve kökler", "MST0 (IST) bölgenin ana ağacıdır ve BPDU'ları taşır. Her örneğin kökü ayrı seçilir: örnek 1'in kökü CORE1, örnek 2'nin kökü CORE2 yapılarak iki yol da kullanılır.")
    f.zone(20, 30, 410, 250, "Instance 1 · VLAN 10-19", "v1")
    f.zone(450, 30, 410, 250, "Instance 2 · VLAN 20-29", "v2")
    for ox, root in ((0, 1), (430, 2)):
        c1 = f.device(120 + ox, 90, "switch", "CORE1", "KÖK" if root == 1 else "", tone="ok" if root == 1 else "card")
        c2 = f.device(330 + ox, 90, "switch", "CORE2", "KÖK" if root == 2 else "", tone="ok" if root == 2 else "card")
        a = f.device(225 + ox, 220, "switch", "ACC1")
        f.link(c1, c2)
        f.link(c1, a, tone="accent" if root == 1 else "err", dash=root != 1)
        f.link(c2, a, tone="accent" if root == 2 else "err", dash=root != 2)
    return f


def g4():
    f = Fig(880, 270, "MST yapılandırması", "Bölge ayarları spanning-tree mst configuration altında yazılır; kök önceliği örnek başına verilir.")
    rows = [
        ("spanning-tree mode mst", "MST'yi aç"),
        ("spanning-tree mst configuration", "bölge ayarlarına gir"),
        (" name KAMPUS / revision 1", "bölge kimliği"),
        (" instance 1 vlan 10-19 / instance 2 vlan 20-29", "VLAN eşlemesi"),
        ("spanning-tree mst 1 priority 24576", "CORE1: örnek 1 kökü"),
    ]
    for i, (cmd, why) in enumerate(rows):
        y = 14 + i * 48
        f.rect(30, y, 520, 40, "soft", r=6)
        f.text(42, y + 25, cmd.replace(" ", " "), size=12, mono=True, anchor="start", bold=True)
        f.text(570, y + 25, why, size=12, anchor="start", tone="m")
    return f


def g5():
    f = Fig(880, 280, "Yolu ayarlamak: maliyet ve port önceliği", "Kök seçildikten sonra yolu iki ayar değiştirir: port maliyeti (köke uzak switch'te, kök port seçimini) ve port önceliği (köke yakın switch'te, karşı tarafın seçimini).")
    r = f.device(440, 50, "switch", "KÖK", tone="ok")
    a = f.device(200, 200, "switch", "SW-A")
    b = f.device(680, 200, "switch", "SW-B")
    f.link(r, a, la="", lb="cost 4")
    f.link(r, b)
    f.link(a, b, la="cost 4", lb="")
    f.note(20, 20, 300, "spanning-tree mst 1 cost 2000 (SW-A'da): bu porttan köke gitmek pahalılaşır", tone="accent", size=12)
    f.note(550, 20, 310, "spanning-tree mst 1 port-priority 64 (kökte): karşıdaki switch bu portu tercih eder", tone="v2", size=12)
    return f


def g6():
    f = Fig(880, 270, "Loop Guard ve UDLD", "Tek yönlü bir fiber arızasında bloklu port BPDU almayı keser ve 'kök yok' diyerek açılır: döngü. Loop Guard BPDU kesilen portu açmak yerine loop-inconsistent yapar; UDLD tek yönlü bağlantıyı yakalar.")
    a = f.device(150, 120, "switch", "SW1", "BPDU gönderiyor")
    b = f.device(730, 120, "switch", "SW2", "bloklu port")
    f.arrow(210, 100, 670, 100, "SW1 → SW2 yönü kopuk (tek yönlü)", tone="err")
    f.arrow(670, 145, 210, 145, "SW2 → SW1 çalışıyor", tone="ok", above=False)
    f.box(30, 190, 400, 60, "Loop Guard: BPDU gelmezse açma, bekle", "ok", size=13)
    f.box(450, 190, 400, 60, "UDLD aggressive: tek yönlüyse err-disable", "ok", size=13)
    return f


def g7():
    f = Fig(880, 260, "Bölge sınırı ve diğer STP türleri", "MST bölgesi dışarıya tek bir köprü gibi görünür. Sınırdaki port (boundary) PVST+ komşusuyla CST/PVST simülasyonu üzerinden konuşur; sınırda tutarsızlık portu bloklayabilir.")
    f.zone(20, 30, 520, 190, "MST bölgesi KAMPUS", "v1")
    for x in (120, 280, 440):
        f.device(x, 130, "switch", "MST", w=100)
    p = f.device(760, 130, "switch", "Eski switch", "Rapid PVST+", tone="warn", w=150)
    f.line(490, 130, 685, 130, "warn", 2.5)
    f.text(590, 118, "boundary port", size=12, tone="warn", bold=True)
    f.text(440, 248, "Kural: bölgeyi tek parça tut; PVST+ adalarını en aza indir, kökü MST bölgesinde tut", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
