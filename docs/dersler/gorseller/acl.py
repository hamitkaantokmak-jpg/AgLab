"""ACL dersi şemaları (docs/dersler/acl.md)."""

from figures import Fig


def g1():
    f = Fig(880, 300, "ACL: kapıdaki görevlinin listesi", "Paket listeyi yukarıdan aşağı okur; ilk eşleşen satır kazanır ve gerisine bakılmaz. Hiçbir satıra uymayan paket sondaki görünmez deny any ile düşer.")
    f.packet(92, 60, "PC-20 → SRV :80", tone="v1")
    rows = [("10", "permit tcp 192.168.20.0 0.0.0.255 host SRV eq www", "ok", "EŞLEŞTİ → geçer, dur"),
            ("20", "permit icmp 192.168.20.0 0.0.0.255 host SRV", "soft", "bakılmaz"),
            ("30", "deny ip any any", "soft", "bakılmaz"),
            ("", "(örtük) deny any", "err", "hiçbirine uymayan buraya")]
    for i, (n, r, t, why) in enumerate(rows):
        y = 40 + i * 50
        f.rect(200, y, 460, 40, t, r=6, dash=(n == ""))
        f.text(214, y + 25, n, size=12, bold=True, anchor="start", tone="m")
        f.text(244, y + 25, r, size=12, mono=True, anchor="start")
        f.text(676, y + 25, why, size=12, anchor="start", tone="ok" if i == 0 else "m", bold=i == 0)
    f.arrow(166, 60, 200, 60, tone="v1")
    f.text(440, 268, "Benzetme: kapıdaki görevli listeyi baştan okur; adını ilk bulduğu satıra göre karar verir", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 240, "Sıra her şeydir", "Genel bir deny özel bir permit'in üstündeyse permit'e hiç sıra gelmez. Özel satırlar üstte, genel satırlar altta olmalı.")
    f.text(220, 34, "Yanlış", size=14, bold=True, tone="err")
    f.rect(30, 50, 380, 36, "err", r=6)
    f.text(42, 73, "10 deny ip 192.168.20.0 0.0.0.255 any", size=12, mono=True, anchor="start")
    f.rect(30, 92, 380, 36, "soft", r=6)
    f.text(42, 115, "20 permit tcp ... host SRV eq www", size=12, mono=True, anchor="start", tone="m")
    f.text(220, 150, "web isteği 10'da düşer; 20'ye hiç ulaşılmaz", size=12, tone="err")
    f.text(660, 34, "Doğru", size=14, bold=True, tone="ok")
    f.rect(470, 50, 380, 36, "ok", r=6)
    f.text(482, 73, "10 permit tcp ... host SRV eq www", size=12, mono=True, anchor="start")
    f.rect(470, 92, 380, 36, "warn", r=6)
    f.text(482, 115, "20 deny ip 192.168.20.0 0.0.0.255 any", size=12, mono=True, anchor="start")
    f.text(660, 150, "özel izin önce, genel yasak sonra", size=12, tone="ok")
    f.note(30, 180, 820, "Düzeltme: ip access-list extended MISAFIR → no 10 (satırı sil) ya da 5 permit ... (araya, üste ekle). Sıra numaraları bunun için vardır.", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 290, "Wildcard: maskenin tersi", "0 bit = bu bit eşleşmeli, 1 bit = önemli değil. Hızlı hesap: 255.255.255.255 eksi maske.")
    f.table(30, 20, ["Önek", "Maske", "Wildcard", "Kısaltma"], [
        ["/24", "255.255.255.0", "0.0.0.255", ""],
        ["/26", "255.255.255.192", "0.0.0.63", ""],
        ["/30", "255.255.255.252", "0.0.0.3", ""],
        ["/32", "255.255.255.255", "0.0.0.0", "host 10.1.1.1"],
        ["hepsi", "0.0.0.0", "255.255.255.255", "any"],
    ], [120, 240, 240, 220], mono_cols=(1, 2, 3))
    f.note(30, 200, 820, "Tuzak: wildcard yerine maske yazmak. access-list 10 permit 192.168.10.0 255.255.255.0, IOS'ta 0.0.0.0, wildcard bits 255.255.255.0 olur: \"son okteti 0 olan her adres\". Muhasebe eşleşmez.", tone="err", size=12)
    return f


def g4():
    f = Fig(880, 280, "Standart mı genişletilmiş mi, nereye?", "Standart ACL yalnız kaynağa bakar: hedefe yakın uygulanır. Genişletilmiş ACL protokol, kaynak, hedef ve port eşler: kaynağa yakın uygulanır.")
    pc = f.device(100, 120, "pc", "Misafir", "192.168.20.0/24", tone="v1")
    r1 = f.device(440, 120, "router", "R1")
    srv = f.device(780, 60, "server", "SRV", "192.168.100.10")
    mu = f.device(780, 190, "pc", "Muhasebe", "192.168.10.0/24", tone="v2")
    f.link(pc, r1, lb="g0/1")
    f.link(r1, srv, la="g0/2")
    f.link(r1, mu, la="g0/0")
    f.note(30, 210, 360, "Genişletilmiş: g0/1 in (kaynağa yakın). İstenmeyen paket yola hiç çıkmaz.", tone="ok", size=12)
    f.note(440, 20, 230, "Standart: g0/2 out (hedefe yakın)", tone="accent", size=12)
    return f


def g5():
    f = Fig(880, 290, "in ve out: router'ın gözünden", "Yön, router'ın bakış açısındandır. Misafirden gelen paket misafir arayüzüne girer: in. Aynı arayüzde out, router'dan misafire giden paketleri süzer.")
    pc = f.device(110, 120, "pc", "PC-20", "misafir")
    r1 = f.device(500, 120, "router", "R1", "", w=200)
    f.link(pc, r1, lb="g0/1")
    f.arrow(170, 90, 390, 90, "in: PC'den router'a giren", tone="ok", width=2.5)
    f.arrow(390, 150, 170, 150, "out: router'dan PC'ye çıkan", tone="warn", width=2.5, above=False)
    f.note(630, 60, 230, "Her arayüzde, her yönde, her protokol için tek ACL.", tone="accent", size=12)
    f.note(30, 210, 820, "ACL durum tutmaz: yanlış yöndeki liste dönen yanıtları da keser, çünkü yanıtın kaynağı sunucudur ve hiçbir satıra uymaz.", tone="err", size=12)
    return f


def g6():
    f = Fig(880, 270, "Sayaçlar: hangi satır yakalıyor?", "show access-lists her satırın kaç pakete uyduğunu gösterir. Sayacı artan satır suçludur; hiç artmayan satıra ulaşılmıyordur. Örtük deny'in sayacı görünmez.")
    f.table(30, 20, ["Satır", "Sayaç"], [
        ["10 deny ip 192.168.20.0 0.0.0.255 any", "(2 matches)"],
        ["20 permit tcp ... host 192.168.100.10 eq www", ""],
        ["30 permit icmp ... host 192.168.100.10", ""],
    ], [560, 260], tones={0: "err"}, mono_cols=(0, 1))
    steps = ["clear access-list counters", "testi tekrarla (ping / curl)", "show access-lists"]
    for i, s in enumerate(steps):
        x = 30 + i * 280
        f.box(x, 150, 260, 50, s, "soft", size=12)
        if i < 2:
            f.arrow(x + 260, 175, x + 280, 175)
    f.text(440, 240, "Sondaki açık deny ip any any, örtük deny'e takılan paketleri sayaçla görünür kılar", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 260, "Ping geçiyor, web açılmıyor", "ACL katman 4'e göre süzer: ICMP'ye izin verip TCP 80'i engelleyebilir. Ping'in geçmesi uygulamanın geçtiğini kanıtlamaz.")
    pc = f.device(110, 110, "pc", "PC-20")
    srv = f.device(770, 110, "server", "SRV")
    f.arrow(170, 80, 710, 80, "ICMP echo: permit ip any any → geçer", tone="ok", width=2.5)
    f.arrow(170, 140, 710, 140, "TCP 80: 10 deny tcp ... eq www → düşer", tone="err", width=2.5, above=False)
    f.note(30, 190, 820, "Test ederken kullanıcının gerçek uygulamasıyla test et: curl / http, sadece ping değil.", tone="accent", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
