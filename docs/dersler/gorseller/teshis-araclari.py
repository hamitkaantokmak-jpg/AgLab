"""Teşhis araçları dersi şemaları (docs/dersler/teshis-araclari.md)."""

from figures import Fig


def _chain(f, y=90, last_tone="card"):
    pc = f.device(90, y, "pc", "PC-11", "192.168.10.11")
    r1 = f.device(300, y, "router", "R1", "10.0.12.1")
    r2 = f.device(520, y, "router", "R2", "10.0.12.2")
    srv = f.device(770, y, "server", "SRV", "192.168.30.10", tone=last_tone)
    f.link(pc, r1)
    f.link(r1, r2)
    f.link(r2, srv)
    return pc, r1, r2, srv


def g1():
    f = Fig(880, 270, "Ping: kapıyı çalmak", "Yanıt gelirse (!) yol iki yönde de çalışıyor. Hiçbir şey gelmezse (.) paket ya gitmedi ya da yanıt dönemedi. Bir router \"yolum yok\" derse (U) sorunun yerini o router söyler.")
    f.table(30, 20, ["IOS", "VPCS / Windows", "Anlamı"], [
        ["!", "84 bytes from …", "yanıt geldi"],
        [".", "timeout", "hiçbir şey gelmedi (sessizlik)"],
        ["U", "Destination host unreachable", "yoldaki bir router \"yolum yok\" dedi"],
        ["&", "TTL expired in transit", "paket dolaşıp durdu (döngü)"],
        [".!!!!", "—", "ilk paket ARP'de düştü: normal"],
    ], [100, 320, 400], tones={0: "ok", 1: "warn", 2: "err", 3: "err"}, mono_cols=(0,))
    f.text(440, 238, "Benzetme: kapıyı çaldın; biri açtı (!), kimse açmadı (.), komşu \"burada öyle biri yok\" dedi (U)", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 260, "Kim haber verdi?", "Unreachable yanıtının kaynağı sorunun yeridir. Sessizlikte (timeout) kimse haber vermemiştir; çoğu zaman dönüş yolu yoktur.")
    _chain(f)
    f.arrow(500, 150, 110, 150, "U: 10.0.12.2'den \"192.168.30.10'a yolum yok\"", tone="err", above=False)
    f.note(30, 190, 820, "İşaret: yanıtı R2 verdi, sorun R2'de (R2'nin rota tablosu). R1'e ya da kabloya bakmak boşuna.", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 300, "Extended ping: kaynağı değiştir", "Router'ın ping'i çıktığı arayüzün adresiyle gider. Karşı taraf o adrese dönmeyi bilir ama kullanıcı ağına dönmeyi bilmeyebilir. source ile kullanıcı ağının adresinden ping at.")
    _chain(f, 70)
    f.arrow(320, 130, 750, 130, "ping 192.168.30.10 → kaynak 10.0.12.1 → !!!!!", tone="ok")
    f.arrow(320, 180, 750, 180, "ping 192.168.30.10 source g0/0 → kaynak 192.168.10.1 → .....", tone="err")
    f.note(30, 220, 820, "Sonuç: R2 ya da SRV tarafında 192.168.10.0/24'e dönüş yolu yok. Router'dan atılan başarılı ping \"ağ sağlam\" demek değildir.", tone="warn", size=12)
    return f


def g4():
    f = Fig(880, 320, "Traceroute: TTL ile adım adım", "Sonda paketleri TTL 1, 2, 3 ile gönderilir. TTL'i biten her router \"Time Exceeded\" ile kendini tanıtır; böylece yol sırayla ortaya çıkar.")
    _chain(f, 60)
    rows = [("TTL 1", 300, "R1: Time Exceeded → 1. atlama 10.0.12.1"),
            ("TTL 2", 520, "R2: Time Exceeded → 2. atlama 10.0.12.2"),
            ("TTL 3", 770, "SRV: yanıt → hedef")]
    for i, (t, x, s) in enumerate(rows):
        y = 140 + i * 50
        f.arrow(130, y, x - 40, y, t, tone="v1")
        f.text(x - 30, y + 5, s, size=11, tone="m", anchor="start") if x < 700 else f.text(130, y + 22, s, size=11, tone="m", anchor="start")
    return f


def g5():
    f = Fig(880, 300, "Traceroute izleri", "İz hedefte biterse yol sağlam. !H o router'ın yolu yok. Son router'dan sonra yıldızlar yanıtın dönmediğini, tekrar eden iki adres döngüyü gösterir.")
    f.table(30, 20, ["İz", "Anlamı"], [
        ["atlamalar ilerliyor, hedefte bitiyor", "yol sağlam"],
        ["bir atlamada !H / unreachable", "o router hedefe yol bilmiyor"],
        ["son router'dan sonra * * *", "hedef, hedefin gateway'i ya da dönüş yolu"],
        ["aynı iki adres sırayla tekrar", "YÖNLENDİRME DÖNGÜSÜ"],
        ["arada tek * * *, iz devam ediyor", "router ICMP sınırlıyor: sorun değil"],
    ], [400, 420], tones={1: "err", 2: "warn", 3: "err", 4: "ok"})
    f.text(30, 230, "  3 10.0.12.2   4 10.0.12.1   5 10.0.12.2   6 10.0.12.1 ...", size=12, mono=True, anchor="start", tone="err", bold=True)
    f.text(440, 270, "Benzetme: iki kişi birbirine \"o tarafa sor\" diyor; soru aralarında gidip geliyor", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 260, "Ping döngüyü & ile gösterir", "R1 hedefi R2'ye, R2 de R1'e gönderirse paket TTL'i bitene kadar ikisi arasında döner. Ping & (TTL expired), traceroute tekrar eden adresler gösterir.")
    r1 = f.device(260, 100, "router", "R1", "→ R2'ye")
    r2 = f.device(620, 100, "router", "R2", "→ R1'e")
    f.path("M 320 70 C 400 20, 480 20, 560 70", tone="err", width=2.5, arrow=True)
    f.path("M 560 130 C 480 180, 400 180, 320 130", tone="err", width=2.5, arrow=True)
    f.packet(440, 38, "TTL 64…63…62", tone="err")
    f.note(30, 200, 820, "Çözüm: döngüdeki iki router'ın rotalarına bak; biri yanlış next-hop'u gösteriyor (çoğu zaman eksik ya da yanlış statik rota).", tone="accent", size=12)
    return f


def g7():
    f = Fig(880, 270, "Paket yakalama: dolaylı değil doğrudan kanıt", "Ping ve traceroute dolaylı kanıttır. Paket yakalama asıl uygulamanın paketlerini gösterir: istek çıktı mı, yanıt geldi mi, TCP el sıkışması nerede kaldı?")
    pc = f.device(110, 100, "pc", "PC", "Wireshark")
    srv = f.device(770, 100, "server", "SRV", ":80")
    f.arrow(170, 70, 710, 70, "SYN →", tone="ok")
    f.arrow(710, 120, 170, 120, "← SYN-ACK (yok!)", tone="err", above=False)
    f.note(30, 170, 400, "SYN gidiyor, SYN-ACK yok: sunucu, ACL ya da dönüş yolu.", tone="warn", size=12)
    f.note(450, 170, 400, "AğLab: Lab ekranındaki Paket Dedektifi son testin olaylarını adım adım gösterir.", tone="accent", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
