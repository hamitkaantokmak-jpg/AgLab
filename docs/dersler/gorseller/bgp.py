"""BGP dersi şemaları (docs/dersler/bgp.md)."""

from figures import Fig


def g1():
    f = Fig(880, 280, "BGP: kurumlar arası yönlendirme", "OSPF bir kurumun içini, BGP kurumları (otonom sistemleri) birbirine bağlar. Her AS'nin bir numarası vardır; BGP en kısa yolu değil, politikaya uygun yolu seçer.")
    f.zone(20, 40, 250, 200, "AS 65010 · Şirket", "v1")
    f.zone(320, 40, 240, 200, "AS 64500 · ISP-A", "v2")
    f.zone(610, 40, 250, 200, "AS 64600 · ISP-B", "v3")
    r1 = f.device(145, 140, "router", "R1")
    a = f.device(440, 140, "router", "ISP-A")
    b = f.device(735, 140, "router", "ISP-B")
    f.link(r1, a, "eBGP", tone="accent")
    f.link(a, b, "eBGP", tone="accent")
    f.text(440, 268, "Benzetme: ülkeler arası anlaşmalar; hangi sınır kapısından geçileceğini mesafe değil anlaşmalar belirler", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 240, "Komşuluk TCP 179 üzerinden, elle tanımlanır", "BGP komşularını kendisi bulmaz; her komşu adresi ve AS numarasıyla yazılır. Oturum TCP 179 üzerinden kurulur. eBGP farklı AS, iBGP aynı AS içindedir.")
    r1 = f.device(150, 90, "router", "R1", "AS 65010 · 203.0.113.2", w=180)
    a = f.device(730, 90, "router", "ISP-A", "AS 64500 · 203.0.113.1", w=180)
    f.link(r1, a, "TCP 179", tone="accent")
    f.text(40, 170, "router bgp 65010", size=13, mono=True, anchor="start", bold=True)
    f.text(40, 196, " neighbor 203.0.113.1 remote-as 64500", size=13, mono=True, anchor="start", bold=True)
    f.note(500, 160, 350, "remote-as yerel AS'den farklı → eBGP; aynı → iBGP", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 210, "Komşu durumları", "Idle → Connect/Active → OpenSent → OpenConfirm → Established. Established dışındaki her durum oturumun kurulamadığını gösterir; Active 'karşıya ulaşamıyorum' demektir.")
    st = [("Idle", "err"), ("Connect", "warn"), ("Active", "warn"), ("OpenSent", "soft"), ("OpenConfirm", "soft"), ("Established", "ok")]
    for i, (s, t) in enumerate(st):
        x = 20 + i * 142
        f.box(x, 40, 128, 50, s, t, size=13)
        if i < 5:
            f.arrow(x + 128, 65, x + 142, 65)
    f.note(20, 120, 840, "show ip bgp summary'de State/PfxRcd sütununda sayı görüyorsan oturum Established'dır; durum adı görüyorsan değildir. Active çoğu zaman yanlış adres, yanlış AS, ACL ya da ulaşılamayan komşudur.", tone="accent", size=12)
    return f


def g4():
    f = Fig(880, 280, "Önek duyurmak: network komutu", "BGP'de network komutu arayüz seçmez; rota tablosunda TAM olarak bulunan bir öneki BGP'ye koyar. Önek ve maske tabloda birebir yoksa duyurulmaz.")
    f.table(30, 20, ["network satırı", "RIB'de", "Sonuç"], [
        ["network 198.51.100.0 mask 255.255.255.0", "198.51.100.0/24 var", "duyurulur"],
        ["network 198.51.100.0 mask 255.255.254.0", "/23 yok", "DUYURULMAZ"],
        ["network 198.51.100.0 mask 255.255.254.0 + ip route … Null0", "/23 Null0", "duyurulur"],
    ], [440, 180, 200], tones={0: "ok", 1: "err", 2: "ok"}, mono_cols=(0,))
    f.note(30, 150, 820, "Benzetme: BGP yalnız elinde tapusu olan araziyi satışa çıkarır; tapu (RIB'de tam önek) yoksa ilan veremez.", tone="accent", size=12)
    f.note(30, 210, 820, "OSPF'teki network komutuyla karıştırma: orada wildcard ile arayüz seçilir; burada tam önek ve mask.", tone="warn", size=12)
    return f


def g5():
    f = Fig(880, 230, "AS_PATH: döngü önleme ve yol uzunluğu", "Her AS rotayı duyururken kendi numarasını AS_PATH'in başına ekler. Bir router kendi AS'sini yolda görürse rotayı reddeder. Diğer şartlar eşitse kısa AS_PATH tercih edilir.")
    nodes = [("AS 65010", 110), ("AS 64500", 330), ("AS 64600", 550), ("AS 64700", 770)]
    for n, x in nodes:
        f.box(x - 90, 40, 180, 50, n, "soft", size=13)
    paths = ["65010", "64500 65010", "64600 64500 65010"]
    for i, p in enumerate(paths):
        x1 = nodes[i][1] + 90
        x2 = nodes[i + 1][1] - 90
        f.arrow(x1, 65, x2, 65)
    for i, p in enumerate(paths):
        f.text(nodes[i + 1][1], 112, p, size=12, mono=True, bold=True, tone="accent")
    f.note(30, 150, 820, "Benzetme: pasaporttaki giriş damgaları. Kendi ülkenin damgasını taşıyan bir rota sana geri dönmüş demektir; kabul edilmez.", tone="accent", size=12)
    return f


def g6():
    f = Fig(880, 330, "En iyi yol seçimi (sırayla)", "BGP adayları sırayla karşılaştırır; ilk farkı bulduğu adımda karar verir. Aşağıdaki sıra Cisco'nun sırasının en çok kullanılan kısmıdır.")
    rows = [
        ["1", "Weight", "yüksek", "yalnız bu router (Cisco)"],
        ["2", "Local Preference", "yüksek", "AS içinde, çıkış seçimi"],
        ["3", "Yerel üretilmiş", "kendisi", "network / aggregate"],
        ["4", "AS_PATH", "kısa", "AS sayısı"],
        ["5", "Origin", "IGP < EGP < ?", "rotanın kaynağı"],
        ["6", "MED", "düşük", "komşu AS'ye giriş önerisi"],
        ["7", "eBGP > iBGP", "eBGP", "dış komşu tercih"],
        ["8", "IGP metriği", "düşük", "next-hop'a en yakın"],
    ]
    f.table(30, 14, ["#", "Özellik", "Tercih", "Not"], rows, [60, 220, 200, 340], tones={0: "v1", 1: "v1", 3: "v2", 5: "v3"}, row_h=28)
    f.text(440, 300, "Ezber: \"We Love Oranges AS Oranges Mean Pure Refreshment\" (Weight, LP, Originate, AS_PATH, Origin, MED, Paths, RID)", size=11, tone="m")
    return f


def g7():
    f = Fig(880, 300, "İki ISP: çıkışı ve girişi yönetmek", "Çıkan trafiği Local Preference (AS içinde) ya da Weight (tek router) yönetir. Gelen trafiği etkilemek için AS_PATH prepend ya da MED kullanılır; karar karşı AS'nindir.")
    r1 = f.device(150, 150, "router", "R1", "AS 65010")
    a = f.device(560, 70, "router", "ISP-A", "birincil")
    b = f.device(560, 230, "router", "ISP-B", "yedek")
    net = f.device(770, 150, "cloud", "İnternet", w=130)
    f.link(r1, a, "LP 200 → çıkış", tone="ok")
    f.link(r1, b, "prepend 65010 65010", tone="warn")
    f.link(a, net)
    f.link(b, net)
    f.note(20, 30, 260, "Çıkış: R1 → ISP-A (LP 200 > 100)", tone="ok", size=12)
    f.note(20, 240, 260, "Giriş: ISP-B yolu uzun görünür, internet ISP-A'yı tercih eder", tone="warn", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
