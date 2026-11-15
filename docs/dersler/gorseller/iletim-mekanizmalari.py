"""L2/L3 iletim mekanizmaları dersi şemaları (docs/dersler/iletim-mekanizmalari.md)."""

from figures import Fig


def g1():
    f = Fig(880, 265, "Karar ve iletim ayrıdır", "Kontrol düzlemi (OSPF, ARP) tabloları kurar. Veri düzlemi her paket için yalnız bu tablolara bakar. Hızlı iletim, karar işinin paket yolundan çıkarılmasıdır.")
    f.box(30, 30, 380, 160, "Kontrol düzlemi (CPU)", "v2", sub="OSPF, BGP, ARP, STP → RIB, ARP tablosu", size=15)
    f.arrow(410, 110, 470, 110, tone="accent")
    f.text(440, 210, "tablolar CPU'dan ASIC'e indirilir", size=12, tone="accent", bold=True)
    f.box(470, 30, 380, 160, "Veri düzlemi (ASIC)", "v1", sub="FIB + adjacency, MAC tablosu → paketi ilet", size=15)
    f.text(440, 240, "Benzetme: belediye yol haritasını çizer (kontrol); şoför her kavşakta yalnız tabelaya bakar (veri)", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 260, "Üç iletim yöntemi", "Process switching her paketi CPU'ya gönderir. Fast switching ilk paketi CPU'da çözüp sonucu önbelleğe yazar. CEF tabloları önceden kurar: ilk paket bile önbellek beklemez.")
    rows = [("Process switching", "her paket CPU'da", "err"), ("Fast switching", "ilk paket CPU, sonra önbellek", "warn"), ("CEF", "FIB + adjacency önceden hazır", "ok")]
    for i, (t, s, tone) in enumerate(rows):
        x = 24 + i * 284
        f.box(x, 30, 264, 120, t, tone, sub=s, size=15)
    f.text(440, 190, "Benzetme: her müşteriye tarifi baştan okumak / ilk siparişten sonra not almak / menüyü önceden ezberlemek", size=12, tone="m")
    f.text(440, 222, "Cisco'da varsayılan CEF'tir: ip cef", size=12, tone="accent", bold=True)
    return f


def g3():
    f = Fig(880, 250, "RIB'den FIB'e", "RIB (show ip route) protokollerden gelen en iyi rotaları tutar. FIB aynı bilgiyi özyinelemesi çözülmüş biçimde, doğrudan çıkış arayüzü ve sonraki adımla tutar.")
    f.table(30, 20, ["RIB", ""], [["10.30.0.0/16", "via 10.0.12.2"], ["10.0.12.0/30", "connected Gi0/1"]], [220, 180], mono_cols=(0, 1))
    f.arrow(440, 60, 480, 60, tone="accent")
    f.table(480, 20, ["FIB", ""], [["10.30.0.0/16", "10.0.12.2 · Gi0/1"], ["10.0.12.2/32", "attached Gi0/1"]], [180, 190], mono_cols=(0, 1))
    f.arrow(665, 110, 665, 160, tone="accent")
    f.table(480, 160, ["Adjacency", ""], [["10.0.12.2 · Gi0/1", "hazır L2 başlığı (MAC'ler)"]], [180, 190], mono_cols=(0,))
    f.note(30, 120, 400, "Özyineleme: \"10.30.0.0'a 10.0.12.2 üzerinden\" → \"10.0.12.2 nerede?\" sorusu RIB'de çözülür; FIB'de çözülmüş halde durur.", tone="accent", size=12)
    return f


def g4():
    f = Fig(880, 270, "Adjacency tablosu: hazır zarf", "Her sonraki adım için Ethernet başlığı (hedef MAC, kaynak MAC, tür) önceden yazılmıştır. Paket gelince yalnız başlık değiştirilir, TTL azaltılır, sağlama toplamı güncellenir.")
    f.frame(30, 50, [("Hedef MAC", 170, "v1", "next-hop'un MAC'i"), ("Kaynak MAC", 170, "v2", "çıkış arayüzü"), ("Tür", 90, "soft", "0800"), ("IP paketi", 360, "accent", "TTL−1, checksum")], h=60, title="Adjacency'den hazır başlık + paket")
    f.note(30, 150, 820, "Adjacency yoksa (ARP çözülmemiş) giriş \"glean\" olur: ilk paket CPU'ya gider, ARP sorulur, adjacency tamamlanınca paketler ASIC'te akar.", tone="warn", size=12)
    f.text(440, 236, "Benzetme: düzenli gönderdiğin adreslere önceden yazılmış zarflar; mektubu koyup postalarsın", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 240, "Switch'te MAC ve TCAM", "Katman 2'de CAM (MAC) tablosu tam eşleşme yapar: MAC + VLAN → port. TCAM 'önemli değil' bitleriyle en uzun önek, ACL ve QoS eşleşmesini tek döngüde yapar.")
    f.box(30, 30, 390, 140, "CAM (MAC tablosu)", "v1", sub="tam eşleşme: VLAN 10 + 0200.0000.0011 → Gi1/0/5", size=14)
    f.box(460, 30, 390, 140, "TCAM", "v2", sub="değer + maske: 10.30.0.0/16, ACL satırları, QoS sınıfları", size=14)
    f.text(440, 210, "TCAM dolarsa girişler yazılamaz ve trafik yazılımda (CPU) işlenir: yüksek CPU, yavaşlık", size=12, tone="err", bold=True)
    return f


def g6():
    f = Fig(880, 270, "Punt: CPU'ya giden paketler", "Bazı paketleri donanım iletemez: router'ın kendisine gelenler, TTL'i bitenler, IP seçenekli olanlar, adjacency'si eksikler. Bunlar CPU'ya gönderilir (punt). Çoğalırsa CPU dolar.")
    f.device(160, 120, "l3switch", "ASIC", "çoğu paket burada", w=160)
    f.box(560, 60, 290, 120, "CPU", "warn", sub="routing protokolleri, ARP, SSH, punt edilen paketler", size=15)
    f.arrow(240, 110, 560, 110, "punt: TTL=1, kendine gelen, glean, IP seçenekli", tone="err")
    f.text(440, 230, "Belirti: show processes cpu yüksek, IP Input süreci üstte → neyin CPU'ya gittiğini bul (CoPP, Konu #38)", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 280, "CEF yük paylaşımı", "Eşit maliyetli birden çok yol varsa CEF varsayılan olarak akış başına dağıtır: aynı kaynak-hedef çifti hep aynı yoldan gider, paketler sıra değiştirmez.")
    r = f.device(130, 130, "router", "R1")
    a = f.device(500, 60, "router", "R2")
    b = f.device(500, 200, "router", "R3")
    d = f.device(780, 130, "server", "10.30.0.0/16")
    f.link(r, a, "eşit maliyet", tone="ok")
    f.link(r, b, "eşit maliyet", tone="ok")
    f.link(a, d)
    f.link(b, d)
    f.note(20, 220, 300, "Paket başına dağıtım sıra bozulmasına yol açar; varsayılan değildir.", tone="warn", size=12)
    f.text(640, 262, "show ip cef exact-route <kaynak> <hedef>", size=12, mono=True, bold=True)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
