"""OSPFv3 dersi şemaları (docs/dersler/ospfv3.md)."""

from figures import Fig


def g1():
    f = Fig(880, 290, "OSPFv2 ile OSPFv3: aynı aile, yeni ev", "Komşuluk, alan, DR/BDR, maliyet ve SPF aynıdır. Değişenler: arayüz altında açılır, komşular link-local adreslerle konuşur, multicast adresleri IPv6'dır.")
    f.table(30, 20, ["", "OSPFv2 (IPv4)", "OSPFv3 (IPv6)"], [
        ["Açma", "network … area (süreç altında)", "ipv6 ospf 1 area 0 (arayüz altında)"],
        ["Router ID", "IPv4 adresten otomatik", "32 bit; IPv4 yoksa elle şart"],
        ["Komşu / next-hop", "arayüzün IPv4 adresi", "link-local (FE80::)"],
        ["Multicast", "224.0.0.5 / .6", "FF02::5 / FF02::6"],
        ["Kimlik doğrulama", "OSPF içinde", "IPsec ya da auth trailer"],
        ["Ortak", "alan, DR/BDR, maliyet, SPF, AD 110", "aynısı"],
    ], [180, 310, 330], tones={5: "ok"})
    f.text(440, 266, "Benzetme: aynı aile yeni bir şehre taşınmış; alışkanlıklar aynı, adresler ve kapı zilleri farklı", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 280, "Ağ satırı yok, arayüz satırı var", "OSPFv3'te network komutu yoktur. Hangi arayüzün OSPF'e katılacağı arayüzün altında söylenir; o arayüzün bütün IPv6 önekleri ilan edilir.")
    f.rect(30, 30, 400, 170, "soft")
    f.text(230, 62, "OSPFv2", size=16, bold=True)
    f.lines(56, 100, ["router ospf 1", "  network 10.0.12.0 0.0.0.3 area 0", "  network 192.168.10.0 0.0.0.255 area 0"], size=12, mono=True, anchor="start")
    f.rect(450, 30, 400, 170, "ok")
    f.text(650, 62, "OSPFv3", size=16, bold=True)
    f.lines(476, 100, ["ipv6 router ospf 1", "  router-id 1.1.1.1", "interface g0/1", "  ipv6 ospf 1 area 0"], size=12, mono=True, anchor="start")
    f.text(440, 236, "Wildcard hesabı yok: hata payı azalır ama unutulan bir arayüz satırı o LAN'ı ilan etmez", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 260, "Router ID: kimlik kartı şart", "OSPFv3 IPv6 konuşsa da Router ID 32 bitlik, IPv4 biçimli bir sayıdır. Router'da hiç IPv4 adresi yoksa elle verilmezse süreç başlamaz.")
    f.box(30, 40, 380, 120, "IPv4 adresi var", "ok", sub="Router ID ondan seçilir (yine de elle vermek iyi uygulama)", size=14)
    f.box(470, 40, 380, 120, "Yalnız IPv6 var", "err", sub="router-id yazılmazsa: süreç başlamaz, komşu yok", size=14)
    f.text(440, 200, "ipv6 router ospf 1 → router-id 1.1.1.1", size=14, mono=True, bold=True)
    f.text(440, 232, "Benzetme: ülkeyi değiştirsen de pasaport numaran olmadan sınırdan geçemezsin", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 300, "Komşular link-local ile konuşur", "Hello'lar ve LSA'lar link-local kaynaktan gider. Rota tablosunda next-hop da komşunun link-local adresidir ve yanında çıkış arayüzü yazar.")
    r1 = f.device(180, 80, "router", "R1", "Gi0/1 FE80::1", w=150)
    r2 = f.device(700, 80, "router", "R2", "Gi0/0 FE80::2", w=150)
    f.link(r1, r2, "2001:db8:12::/64", tone="accent")
    f.packet(440, 40, "Hello FE80::1 → FF02::5", tone="v1")
    f.text(40, 190, "O   2001:DB8:30::/64 [110/2]", size=13, mono=True, anchor="start", bold=True)
    f.text(40, 214, "     via FE80::2, GigabitEthernet0/1", size=13, mono=True, anchor="start", bold=True)
    f.note(40, 236, 800, "Global adresi 2001:db8:12::2 görmeyi beklerken FE80::2 görmek normaldir; arayüz adı hangi kablodaki FE80::2 olduğunu söyler.", tone="accent", size=12)
    return f


def g5():
    f = Fig(880, 240, "İki multicast adresi", "FF02::5 bütün OSPF router'larına, FF02::6 DR ve BDR'ye gider. IPv4'teki 224.0.0.5 ve 224.0.0.6'nın karşılığıdır.")
    f.box(30, 40, 390, 110, "FF02::5", "v1", sub="AllSPFRouters: Hello'lar, herkese", size=18)
    f.box(460, 40, 390, 110, "FF02::6", "v2", sub="AllDRouters: DROTHER'dan DR/BDR'ye güncelleme", size=18)
    f.text(440, 196, "Bir ACL ya da güvenlik duvarı bu adresleri ve IPv6 protokol 89'u engellerse komşuluk kurulmaz", size=12, tone="err")
    return f


def g6():
    f = Fig(880, 230, "Adres bilgisi LSA'lardan ayrıldı", "OSPFv3'te Router ve Network LSA'ları yalnız topolojiyi taşır; önekler ayrı LSA'larda gelir. Adres değişince bütün haritanın yeniden hesaplanması gerekmez.")
    f.box(30, 40, 260, 110, "Router / Network LSA", "v1", sub="kim kime bağlı (topoloji)", size=14)
    f.box(310, 40, 260, 110, "Link LSA (tip 8)", "v3", sub="link-local adres, o bağlantının önekleri", size=14)
    f.box(590, 40, 260, 110, "Intra-Area Prefix (tip 9)", "v2", sub="alan içindeki IPv6 önekleri", size=14)
    f.text(440, 196, "Benzetme: yol haritası ile sokak isimleri ayrı kâğıtlarda; sokak adı değişince haritayı yeniden çizmen gerekmez", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 270, "Teşhis sırası", "OSPFv2'deki sıra aynen geçerlidir: önce süreç ve Router ID, sonra komşu, sonra arayüz, sonra rota.")
    steps = [
        ("ipv6 unicast-routing", "olmadan hiçbiri"),
        ("show ipv6 protocols", "Router ID var mı"),
        ("show ipv6 ospf neighbor", "komşu FULL mü"),
        ("show ipv6 ospf interface brief", "arayüz ve alan"),
        ("show ipv6 route ospf", "önek ve next-hop"),
    ]
    for i, (cmd, why) in enumerate(steps):
        y = 14 + i * 50
        f.badge(36, y + 20, i + 1)
        f.rect(60, y, 420, 40, "soft", r=6)
        f.text(74, y + 25, cmd, size=12, mono=True, anchor="start", bold=True)
        f.text(500, y + 25, why, size=12, anchor="start", tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
