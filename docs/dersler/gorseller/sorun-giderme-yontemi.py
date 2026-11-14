"""Sorun giderme yöntemi dersi şemaları (docs/dersler/sorun-giderme-yontemi.md)."""

from figures import Fig


def g1():
    f = Fig(860, 270, "Bir şikâyet, birçok olası neden", "'İnternet yok' cümlesinin arkasında kablo, VLAN, adres, rota, DNS ya da servis olabilir; yöntem hangisi olduğunu kanıtla bulur.")
    f.box(330, 100, 200, 64, "\"İnternet yok\"", "err", sub="şikâyet, teşhis değil", size=16)
    causes = [
        (90, 40, "Kopuk kablo / kapalı port", "Katman 1"),
        (90, 200, "Yanlış VLAN", "Katman 2"),
        (360, 210, "Yanlış maske / gateway", "Katman 3"),
        (640, 200, "Eksik rota", "Katman 3"),
        (640, 40, "DNS yanıt vermiyor", "Servis"),
        (360, 20, "Web servisi kapalı", "Uygulama"),
    ]
    for x, y, s, sub in causes:
        f.box(x - 60 if x < 300 else x - 30, y, 200, 46, s, "soft", sub=sub, size=12)
    for x2, y2 in [(150, 86), (150, 200), (430, 210), (700, 200), (700, 86), (430, 66)]:
        f.line(430, 132, x2, y2, dash=True, width=1.5)
    f.box(330, 100, 200, 64, "\"İnternet yok\"", "err", sub="şikâyet, teşhis değil", size=16)
    return f


def g2():
    f = Fig(860, 330, "Altı adımlık döngü", "Tanımla, daralt, hipotez kur, kanıt topla, tek değişiklik yap, doğrula. Düzelmediyse geri al ve 3. adıma dön.")
    steps = [
        (90, 50, "1 Tanımla", "kim, ne, ne zamandan beri, ne değişti"),
        (330, 50, "2 Daralt", "tek kişi mi, kat mı, herkes mi"),
        (570, 50, "3 Hipotez kur", "olası nedenleri sırala"),
        (570, 200, "4 Kanıt topla", "her komut tek soru"),
        (330, 200, "5 Tek değişiklik", "önce yedek"),
        (90, 200, "6 Doğrula ve belgele", "aynı testle yeniden dene"),
    ]
    for x, y, t, s in steps:
        f.box(x, y, 200, 72, t, "accent" if t[0] in "123" else "v2", sub=s, size=14)
    f.arrow(290, 86, 330, 86, tone="ln")
    f.arrow(530, 86, 570, 86, tone="ln")
    f.arrow(670, 122, 670, 200, tone="ln")
    f.arrow(570, 236, 530, 236, tone="ln")
    f.arrow(330, 236, 290, 236, tone="ln")
    f.path("M190 272 C 190 320, 760 320, 790 250 C 800 220, 800 120, 770 100", tone="err", width=2, dash=True, arrow=True)
    f.text(470, 316, "düzelmedi → değişikliği geri al, 3. adıma dön", size=12, tone="err", bold=True)
    f.text(190, 190, "düzeldi → kaydet, yaz", size=12, tone="ok", bold=True)
    return f


def g3():
    f = Fig(860, 250, "Etki alanı sorunun yerini söyler", "Tek kullanıcı etkileniyorsa onun cihazına, bir kat etkileniyorsa kat switch'ine, herkes etkileniyorsa ortak noktaya bak.")
    rows = [
        ("Tek kullanıcı", "v1", "Onun PC'si, kablosu, switch portu, VLAN'ı, adres ayarı"),
        ("Bir kat / bir VLAN", "v3", "Katın switch'i, uplink'i, trunk'ı, o VLAN'ın gateway'i"),
        ("Herkes", "err", "Ortak nokta: router, sunucu, DNS, uygulama servisi"),
    ]
    for i, (who, tone, where) in enumerate(rows):
        y = 26 + i * 72
        f.box(40, y, 220, 56, who, tone, size=14)
        f.arrow(260, y + 28, 320, y + 28)
        f.box(324, y, 496, 56, where, "soft", size=13, bold=False)
    return f


def g4():
    f = Fig(860, 330, "Katmanlar ve ilk komutlar", "Her katmanın tipik arızaları ve ilk bakılacak komutlar; alttan üste yığın.")
    layers = [
        ("Uygulama", "Servis kapalı, port engelli", "curl · tarayıcı · show services", "v4"),
        ("Servisler", "DHCP, DNS", "ip dhcp · nslookup", "v3"),
        ("3 · Ağ", "Adres, maske, gateway, rota", "show ip · ping · traceroute · show ip route", "v2"),
        ("2 · Veri bağı", "VLAN, trunk, MAC/ARP", "show vlan brief · show interfaces trunk · show arp", "v1"),
        ("1 · Fiziksel", "Kablo, kapalı port, güç", "show interfaces status · show interfaces", "accent"),
    ]
    for i, (name, bad, cmd, tone) in enumerate(layers):
        y = 18 + i * 60
        f.box(40, y, 160, 50, name, tone, size=14)
        f.box(204, y, 230, 50, bad, "soft", size=12, bold=False)
        f.box(438, y, 382, 50, cmd, "card", size=12, bold=False)
    return f


def g5():
    f = Fig(880, 310, "Üç yaklaşım", "Aşağıdan yukarı tek kullanıcıda, yukarıdan aşağı yalnız bir uygulama bozukken, böl ve yönet geniş arızada zaman kazandırır.")
    cols = [
        (40, "Aşağıdan yukarı", "Katman 1'den başla", "Tek kullanıcı · yeni kablolama · hiçbir şey çalışmıyor", "up", "v1"),
        (330, "Yukarıdan aşağı", "Uygulamadan başla", "Ping çalışıyor, yalnız bir uygulama açılmıyor", "down", "v3"),
        (620, "Böl ve yönet", "Yolun ortasından başla", "Geniş etki; önce gateway'e ping", "mid", "v2"),
    ]
    for x, title, how, when, d, tone in cols:
        f.text(x + 110, 26, title, size=15, bold=True)
        for k in range(5):
            f.rect(x + 50, 44 + k * 34, 120, 28, "soft", r=5)
            f.text(x + 110, 63 + k * 34, ["Uygulama", "Servis", "Ağ", "Veri bağı", "Fiziksel"][k], size=11, tone="m")
        if d == "up":
            f.arrow(x + 190, 210, x + 190, 50, tone=tone, width=3)
        elif d == "down":
            f.arrow(x + 190, 50, x + 190, 210, tone=tone, width=3)
        else:
            f.arrow(x + 190, 130, x + 190, 54, tone=tone, width=3)
            f.arrow(x + 190, 130, x + 190, 206, tone=tone, width=3)
            f.circle(x + 190, 130, 7, tone)
        f.text(x + 110, 236, how, size=12, bold=True, tone=tone)
        f.lines(x + 110, 256, [l for l in __import__("figures").wrap(when, 240, 11)], size=11, tone="m")
    return f


def g6():
    f = Fig(880, 250, "Böl ve yönet: yolu gateway'den ikiye böl", "Gateway'e ping gidiyorsa sorun gateway'in ötesinde, gitmiyorsa kullanıcı ile gateway arasındadır.")
    pc = f.device(70, 90, "pc", "PC-12")
    sw = f.device(250, 90, "switch", "SW1")
    r1 = f.device(450, 90, "router", "R1", "gateway .1")
    sw2 = f.device(640, 90, "switch", "SW-SRV")
    srv = f.device(810, 90, "server", "ERP")
    for a, b in [(pc, sw), (sw, r1), (r1, sw2), (sw2, srv)]:
        f.link(a, b)
    f.line(450, 30, 450, 160, tone="accent", width=2, dash=True)
    f.text(450, 22, "ping 192.168.10.1", size=12, tone="accent", bold=True, mono=True)
    f.box(40, 168, 360, 60, "Yanıt yok → sorun burada", "err", sub="PC, kablo, port, VLAN, adres", size=13)
    f.box(480, 168, 360, 60, "Yanıt var → sorun burada", "warn", sub="router'ın öbür bacağı, rota, sunucu, servis", size=13)
    return f


def g7():
    f = Fig(880, 300, "Kanıt zinciri", "Her soru tek komutla cevaplanır; cevap bir sonraki soruyu belirler. Hiçbir şey tahminle değiştirilmez.")
    chain = [
        ("Kendi ağımda mıyım?", "ping 192.168.10.11", "not reachable", "err"),
        ("Bağlantım var mı?", "show interfaces status", "Fa0/2 connected", "ok"),
        ("Doğru VLAN'da mıyım?", "show interfaces status", "Fa0/2 VLAN 20 ≠ 10", "err"),
        ("Düzelttim, aynı test?", "ping 192.168.10.11", "84 bytes from ...", "ok"),
    ]
    for i, (q, cmd, ans, tone) in enumerate(chain):
        y = 20 + i * 68
        f.badge(36, y + 26, i + 1)
        f.box(60, y, 230, 52, q, "accent", size=13)
        f.arrow(290, y + 26, 320, y + 26)
        f.box(324, y, 250, 52, cmd, "soft", size=12)
        f.arrow(574, y + 26, 604, y + 26)
        f.box(608, y, 240, 52, ans, tone, size=12, bold=False)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
