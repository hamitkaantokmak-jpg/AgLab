"""DHCP dersi şemaları (docs/dersler/dhcp.md)."""

from figures import Fig


def g1():
    f = Fig(880, 250, "DHCP: otel resepsiyonu gibi", "Yeni gelen bilgisayar 'yeni geldim' der; DHCP sunucusu ona adres, maske, gateway ve DNS'ten oluşan bir kart ve bir kira süresi verir.")
    pc = f.device(90, 110, "pc", "Yeni PC", "adresim yok")
    srv = f.device(350, 110, "server", "DHCP sunucusu", "resepsiyon")
    f.arrow(140, 92, 296, 92, "Merhaba, yeni geldim", tone="warn")
    f.arrow(296, 130, 140, 130, "Al, kartın bu", tone="ok", above=False)
    f.rect(480, 30, 370, 190, "ok", r=12)
    f.text(665, 56, "Kiralanan ayarlar (lease)", size=14, bold=True)
    items = [("IP adresi", "192.168.10.21"), ("Maske", "255.255.255.0"), ("Gateway", "192.168.10.1"), ("DNS", "192.168.100.10"), ("Süre", "1 gün (IOS varsayılanı)")]
    for i, (k, v) in enumerate(items):
        y = 84 + i * 26
        f.text(500, y, k, size=13, anchor="start", bold=True)
        f.text(620, y, v, size=13, anchor="start", mono=True)
    f.text(440, 242, "Benzetme: otel oda numarası, kahvaltı saatini ve wifi şifresini verir; oda çıkış gününe kadar senindir", size=11, tone="m")
    return f


def g2():
    f = Fig(860, 320, "DORA: dört mesajda adres", "Discover (yayın) → Offer → Request → Ack. İlk mesaj yayındır çünkü istemcinin henüz adresi yok ve sunucuyu tanımıyor.")
    f.device(140, 40, "pc", "İstemci", "UDP 68")
    f.device(720, 40, "server", "Sunucu", "UDP 67")
    f.line(140, 70, 140, 300, dash=True)
    f.line(720, 70, 720, 300, dash=True)
    msgs = [
        (1, "Discover", "Sunucu var mı? (yayın, kaynak 0.0.0.0)", True, "warn"),
        (2, "Offer", "192.168.10.21'i teklif ediyorum", False, "accent"),
        (3, "Request", "O adresi istiyorum", True, "accent"),
        (4, "Ack", "Tamam, senindir; süre 1 gün", False, "ok"),
    ]
    for i, (n, name, txt, right, tone) in enumerate(msgs):
        y = 110 + i * 50
        x1, x2 = (150, 710) if right else (710, 150)
        f.arrow(x1, y, x2, y, tone=tone, width=2.5)
        f.badge(430, y - 14, n, tone)
        f.text(460, y - 9, name, size=13, bold=True, anchor="start", tone=tone)
        f.text(430, y + 16, txt, size=11, tone="m")
    return f


def g3():
    f = Fig(880, 230, "Havuz ve dışlanan adresler", "excluded-address ile ayrılan adresler (gateway, yazıcılar) dağıtılmaz; havuz ilk boş adresten başlar. Bütün aralık dışlanırsa verilecek adres kalmaz.")
    x, w, y = 50, 780, 80
    f.text(440, 30, "ip dhcp pool KAT1 · network 192.168.10.0 /24", size=14, mono=True, bold=True)
    ex = w * 20 / 254
    f.rect(x, y, ex, 44, "warn", r=6)
    f.text(x + ex / 2, y + 27, ".1–.20", size=12, bold=True)
    f.rect(x + ex, y, w - ex, 44, "ok", r=6)
    f.text(x + ex + (w - ex) / 2, y + 27, "dağıtılan aralık .21 – .254", size=13, bold=True)
    f.text(x + ex / 2, y + 62, "dışlanan", size=11, tone="warn", bold=True)
    f.text(x + ex / 2, y + 78, "gw .1, yazıcılar", size=11, tone="m")
    f.arrow(x + ex + 6, y - 20, x + ex + 6, y - 2, tone="accent")
    f.text(x + ex + 14, y - 22, "Current index: .21 (sıradaki)", size=12, anchor="start", tone="accent", bold=True)
    f.note(50, 170, 780, "Dışlama unutulursa DHCP gateway ya da yazıcı adresini bir PC'ye verebilir (çakışma). Bütün aralık dışlanırsa Current index 0.0.0.0 olur: yeni gelen cihazlar 169.254 alır.", tone="warn", size=12)
    return f


def g4():
    f = Fig(880, 280, "Relay: yayını başka ağdaki sunucuya taşımak", "Router yayını geçirmez; ip helper-address isteği unicast olarak sunucuya iletir ve giaddr'a isteğin geldiği arayüzün adresini yazar.")
    pc = f.device(80, 120, "pc", "PC-21", "2. kat, adresi yok")
    r1 = f.device(390, 120, "router", "R1", "Gi0/1 192.168.20.1 · helper")
    srv = f.device(780, 120, "server", "SRV", "192.168.100.10")
    f.link(pc, r1, lb="Gi0/1")
    f.link(r1, srv, la="Gi0/2")
    f.packet(190, 70, "Discover · yayın", "warn")
    f.packet(600, 70, "Discover · unicast → .100.10", "accent")
    f.box(520, 170, 330, 56, "giaddr = 192.168.20.1", "v2", sub="SRV: 'bu istek 20 ağından; o havuzdan ver'", size=13)
    f.note(40, 196, 440, "ip helper-address istemcinin ağına bakan arayüze (Gi0/1) yazılır, sunucuya bakana değil.", tone="warn", size=12)
    return f


def g5():
    f = Fig(880, 270, "169.254 bir belirtidir, neden değil", "169.254.x.x 'sunucudan cevap gelmedi' demektir; nedeni isteğin ulaşmaması, sunucunun cevap vermemesi ya da verecek adresinin olmamasıdır.")
    f.box(320, 20, 240, 56, "PC: 169.254.20.8", "err", sub="DHCP'den yanıt gelmedi", size=14)
    causes = [
        (40, "İstek sunucuya ulaşmıyor", "kablo · VLAN · relay yok/yanlış"),
        (330, "Sunucu cevap vermiyor", "DHCP servisi kapalı"),
        (620, "Verecek adres yok", "havuz yanlış · dolu · hepsi dışlanmış"),
    ]
    for x, t, s in causes:
        f.arrow(440, 76, x + 110, 130, tone="err")
        f.box(x, 132, 220, 70, t, "warn", sub=s, size=13)
    f.text(440, 236, "Benzetme: \"telefonuma kimse dönmedi\" — numara yanlış mı, karşı taraf meşgul mü, yer mi kalmadı?", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 340, "DHCP teşhis haritası", "Kim etkileniyor ve elinde adres var mı: beş belirti, beş farklı yer.")
    rows = [
        ("Bir kattaki herkes 169.254", "Relay yok / yanlış helper adresi", "warn"),
        ("Relay doğru, sunucuya ping var, yine 169.254", "Sunucuda DHCP servisi kapalı", "warn"),
        ("Eski cihazlar çalışıyor, yeni gelen 169.254", "Havuz dolu ya da dışlama her şeyi kapsıyor", "v3"),
        ("Adres var, kendi ağı çalışıyor, dışarı çıkış yok", "Havuzda default-router yanlış", "v1"),
        ("Yalnız bir PC, yanındakiler sorunsuz", "PC DHCP'de değil (elle eski adres)", "v4"),
    ]
    for i, (sym, where, tone) in enumerate(rows):
        y = 20 + i * 62
        f.box(30, y, 420, 50, sym, tone, size=12)
        f.arrow(450, y + 25, 490, y + 25)
        f.box(494, y, 356, 50, where, "soft", size=12, bold=False)
    return f


def g7():
    f = Fig(860, 200, "Kira süresi ve yenileme", "İstemci kiranın yarısında aynı sunucudan yenilemeyi dener (T1); kira bitene kadar adresi kullanır. Bu yüzden havuz bozulsa bile eski cihazlar bir süre çalışır.")
    x, w, y = 50, 760, 70
    f.rect(x, y, w, 40, "ok", r=6)
    f.text(x + 8, y - 10, "Ack", size=12, anchor="start", bold=True)
    f.text(x + w, y - 10, "kira biter", size=12, anchor="end", bold=True, tone="err")
    f.line(x + w * 0.5, y - 6, x + w * 0.5, y + 46, tone="accent", width=2.5)
    f.text(x + w * 0.5, y - 12, "%50 · T1: yenileme dene", size=12, tone="accent", bold=True)
    f.line(x + w * 0.875, y - 6, x + w * 0.875, y + 46, tone="warn", width=2.5)
    f.text(x + w * 0.875, y + 64, "%87,5 · T2: herhangi bir sunucuya sor", size=12, tone="warn", bold=True)
    f.text(430, 170, "ipconfig /renew (Windows) · ip dhcp (VPCS): beklemeden yeniden ister", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
