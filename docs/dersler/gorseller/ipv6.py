"""IPv6 dersi şemaları (docs/dersler/ipv6.md)."""

from figures import Fig


def g1():
    f = Fig(880, 230, "IPv6 adresinin anatomisi", "128 bit, 16'şar bitlik 8 grup, onaltılık yazılır. LAN'larda ilk 64 bit ağ öneki, son 64 bit arayüz kimliğidir.")
    groups = ["2001", "0db8", "0010", "0000", "0000", "0000", "0000", "0005"]
    for i, g in enumerate(groups):
        x = 40 + i * 100
        f.box(x, 60, 92, 50, g, "v1" if i < 4 else "v2", size=15)
        if i < 7:
            f.text(x + 96, 92, ":", size=16, bold=True)
    f.rect(40, 124, 392, 8, "v1", r=4)
    f.rect(440, 124, 392, 8, "v2", r=4)
    f.text(236, 156, "ağ öneki /64 (adresin \"sokağı\")", size=13, tone="v1", bold=True)
    f.text(636, 156, "arayüz kimliği 64 bit (\"kapı numarası\")", size=13, tone="v2", bold=True)
    f.text(440, 200, "IPv4: 32 bit, ~4,3 milyar adres · IPv6: 128 bit, her LAN'a 2^64 adres", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 260, "Kısaltma: iki kural", "Her grupta baştaki sıfırlar atılır; art arda gelen sıfır gruplarından yalnız bir dizi :: olur.")
    f.text(40, 50, "2001:0db8:0000:0000:0000:0000:0000:0010", size=16, mono=True, anchor="start", bold=True)
    f.arrow(440, 64, 440, 94, "1: baştaki sıfırları at", tone="accent")
    f.text(40, 120, "2001:db8:0:0:0:0:0:10", size=16, mono=True, anchor="start", bold=True)
    f.arrow(440, 134, 440, 164, "2: en uzun sıfır dizisini :: yap", tone="accent")
    f.text(40, 190, "2001:db8::10", size=18, mono=True, anchor="start", bold=True, tone="ok")
    f.note(560, 160, 290, "Dikkat: :: yalnız bir kez. 2001::1::5 geçersizdir: kaç sıfır grubu nereye gider, belli olmaz.", tone="warn", size=12)
    return f


def g3():
    f = Fig(880, 260, "Adres türleri", "Global unicast internette yönlendirilir. Link-local her arayüzde kendiliğinden oluşur ve yalnız o kabloda geçerlidir. Unique local özel adrestir. Broadcast yoktur, multicast vardır.")
    f.table(30, 20, ["Tür", "Aralık", "Benzetme / not"], [
        ["Global unicast", "2000::/3", "posta adresi: dünyanın her yerinden ulaşılır"],
        ["Link-local", "fe80::/10", "dahili telefon: yalnız o kabloda; gateway budur"],
        ["Unique local", "fc00::/7 (fd..)", "şirket içi adres: internete çıkmaz"],
        ["Multicast", "ff00::/8", "anons: ff02::1 herkes, ff02::2 router'lar"],
    ], [180, 190, 450], tones={1: "accent"}, mono_cols=(1,))
    f.note(30, 180, 820, "Belgelerde ve örneklerde 2001:db8::/32 kullanılır (gerçek ağlarda yönlendirilmez).", tone="ok", size=12)
    return f


def g4():
    f = Fig(880, 310, "NDP: ARP'nin ve router aramanın yerini alır", "RS ile istemci router'ı arar, RA ile router öneki duyurur. NS/NA ile komşunun MAC'i sorulur (ARP'nin yerine). DAD adres çakışmasını denetler.")
    pc = f.device(130, 70, "pc", "PC-10")
    r1 = f.device(750, 70, "router", "R1", "fe80::1")
    f.arrow(180, 50, 700, 50, "RS: \"burada router var mı?\" → ff02::2", tone="v1")
    f.arrow(700, 90, 180, 90, "RA: \"önek 2001:db8:10::/64, gateway benim\"", tone="ok", above=False)
    pc2 = f.device(130, 220, "pc", "PC-10")
    pc3 = f.device(750, 220, "pc", "PC-11")
    f.arrow(180, 200, 700, 200, "NS: \"2001:db8:10::11 kimde?\" (solicited-node multicast)", tone="v2")
    f.arrow(700, 240, 180, 240, "NA: \"bende, MAC 0200.0000.0011\"", tone="ok", above=False)
    f.text(440, 296, "ICMPv6 bu yüzden tamamen engellenemez: NDP de ICMPv6'dır", size=12, tone="err", bold=True)
    return f


def g5():
    f = Fig(880, 270, "Adres almanın üç yolu", "SLAAC: adres RA'daki önek + istemcinin ürettiği kimlik. Stateless DHCPv6: adres SLAAC'tan, DNS DHCPv6'dan. Stateful DHCPv6: adres de DHCPv6'dan.")
    f.box(30, 30, 260, 150, "SLAAC", "ok", sub="önek RA'dan, kimliği PC üretir", size=16)
    f.box(310, 30, 260, 150, "Stateless DHCPv6", "v3", sub="adres SLAAC · DNS DHCPv6 (O bayrağı)", size=15)
    f.box(590, 30, 260, 150, "Stateful DHCPv6", "v2", sub="adres de DHCPv6'dan (M bayrağı)", size=15)
    f.note(30, 200, 820, "Üçünde de varsayılan ağ geçidi, RA'yı gönderen router'ın LINK-LOCAL adresidir (fe80::1), global adresi değil.", tone="accent", size=12)
    return f


def g6():
    f = Fig(880, 290, "EUI-64: MAC'ten arayüz kimliği", "48 bitlik MAC ortadan ikiye bölünür, araya fffe girer, baştan 7. bit ters çevrilir.")
    f.text(40, 40, "MAC", size=13, bold=True, anchor="start")
    f.box(120, 20, 170, 40, "02:00:00", "v1", size=14)
    f.box(300, 20, 170, 40, "00:00:05", "v2", size=14)
    f.arrow(380, 64, 380, 90, "1: ortadan böl, araya fffe", tone="accent")
    f.box(120, 96, 170, 40, "0200:00", "v1", size=14)
    f.box(296, 96, 110, 40, "ff:fe", "warn", size=14)
    f.box(412, 96, 170, 40, "00:0005", "v2", size=14)
    f.arrow(380, 140, 380, 166, "2: 7. bit ters (02 → 00)", tone="accent")
    f.box(120, 172, 462, 44, "0000:00ff:fe00:0005", "ok", size=15)
    f.text(120, 250, "Sonuç: 2001:db8:10::ff:fe00:5 ve link-local fe80::ff:fe00:5", size=13, mono=True, anchor="start", bold=True)
    f.note(620, 40, 230, "Gizlilik için günümüz işletim sistemleri çoğu zaman rastgele kimlik üretir; EUI-64 router'larda ve sınavda sık görülür.", tone="accent", size=12)
    return f


def g7():
    f = Fig(880, 300, "Router'da IPv6: üç adım ve link-local tuzağı", "ipv6 unicast-routing olmadan router yönlendirmez ve RA göndermez. Link-local next-hop yalnız bir kabloda anlamlıdır; çıkış arayüzü de yazılmalıdır.")
    r1 = f.device(150, 70, "router", "R1", "Gi0/1 fe80::1")
    r2 = f.device(730, 70, "router", "R2", "Gi0/0 fe80::2")
    f.link(r1, r2, "2001:db8:12::/64", tone="accent")
    rows = [
        ("ipv6 unicast-routing", "yönlendirmeyi ve RA'yı aç", "ok"),
        ("ipv6 address 2001:db8:10::1/64", "global adres (link-local kendiliğinden)", "ok"),
        ("ipv6 route 2001:db8:30::/64 2001:db8:12::2", "global next-hop: tamam", "ok"),
        ("ipv6 route 2001:db8:30::/64 fe80::2", "hangi kablodaki fe80::2? belirsiz", "err"),
        ("ipv6 route 2001:db8:30::/64 g0/1 fe80::2", "arayüz + link-local: tamam", "ok"),
    ]
    for i, (cmd, why, t) in enumerate(rows):
        y = 124 + i * 34
        f.rect(30, y, 470, 28, t, r=5)
        f.text(42, y + 19, cmd, size=12, mono=True, anchor="start", bold=True)
        f.text(520, y + 19, why, size=12, anchor="start", tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
