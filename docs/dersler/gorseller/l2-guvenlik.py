"""L2 güvenlik dersi şemaları (docs/dersler/l2-guvenlik.md)."""

from figures import Fig


def g1():
    f = Fig(880, 290, "Port security: prizdeki kapı görevlisi", "Port yalnız tanınan MAC adres(ler)ine izin verir. Maksimum doluyken yabancı bir MAC gelirse ihlal olur.")
    sw = f.device(440, 70, "switch", "SW1", "Fa0/2 · maximum 1")
    ok = f.device(220, 220, "pc", "PC-2", "0200.0000.0005 (tanınıyor)", tone="ok", w=220)
    bad = f.device(660, 220, "laptop", "Misafir laptop", "0200.0000.0099", tone="err", w=200)
    f.link(sw, ok, tone="ok")
    f.link(sw, bad, tone="err", blocked=True)
    f.note(20, 20, 280, "Benzetme: site girişindeki görevli; listede adın yoksa kapıdan geçemezsin.", tone="accent", size=12)
    return f


def g2():
    f = Fig(880, 250, "Güvenli MAC nereden gelir?", "Statik adres elle yazılır ve kalıcıdır. Dinamik adres öğrenilir, port düşünce silinir. Sticky öğrenilen adresi yapılandırmaya yazar; kaydedilirse kalıcı olur.")
    f.box(30, 30, 260, 130, "Statik", "v1", sub="mac-address 0200.0000.0005 · kalıcı", size=16)
    f.box(310, 30, 260, 130, "Dinamik", "soft", sub="ilk çerçeveden öğrenilir · port düşünce silinir", size=16)
    f.box(590, 30, 260, 130, "Sticky", "v2", sub="öğrenilir ve config'e yazılır · kaydet!", size=16)
    f.text(440, 200, "Bilgisayar yenilendiğinde eski MAC statik ya da sticky olarak kalmışsa yeni PC ihlal üretir", size=12, tone="warn", bold=True)
    return f


def g3():
    f = Fig(880, 270, "İhlal modları", "shutdown portu err-disabled yapar (varsayılan). restrict çerçeveyi düşürür, sayaç ve syslog üretir, port açık kalır. protect sessizce düşürür: ne sayaç ne log.")
    f.table(30, 20, ["Mod", "Çerçeve", "Sayaç / syslog", "Port"], [
        ["shutdown (varsayılan)", "düşer", "artar / yazılır", "err-disabled"],
        ["restrict", "düşer", "artar / yazılır", "açık kalır"],
        ["protect", "düşer", "YOK", "açık kalır, sessiz"],
    ], [250, 160, 210, 200], tones={0: "err", 1: "warn", 2: "soft"})
    f.note(30, 150, 820, "Benzetme: shutdown kapıyı kilitleyip alarm çalar; restrict yabancıyı geri çevirip deftere yazar; protect yabancıyı sessizce geri çevirir, kimseye söylemez.", tone="accent", size=12)
    f.text(440, 236, "protect en sinsi olanıdır: yazıcı \"sessizce kaybolur\", hiçbir iz yoktur", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 250, "err-disabled'dan çıkış: önce neden", "Port kendiliğinden açılmaz. Önce neden giderilir (yabancı cihaz sökülür ya da izin listesi düzeltilir), sonra shutdown / no shutdown. Neden giderilmeden açılan port ilk yabancı çerçevede yeniden kapanır.")
    steps = [("Nedeni bul", "show port-security interface", "accent"), ("Nedeni gider", "cihazı sök ya da MAC'i düzelt", "warn"), ("Portu aç", "shutdown → no shutdown", "ok"), ("Doğrula", "Secure-up, ping", "ok")]
    for i, (t, s, tone) in enumerate(steps):
        x = 24 + i * 214
        f.box(x, 40, 196, 90, t, tone, sub=s, size=14)
        if i < 3:
            f.arrow(x + 196, 85, x + 214, 85)
    f.note(24, 160, 832, "Sahada: errdisable recovery cause psecure-violation ile otomatik açılma süresi verilebilir; ama neden kalırsa port kapanıp açılmaya devam eder.", tone="accent", size=12)
    return f


def g5():
    f = Fig(880, 290, "DHCP snooping: sahte DHCP sunucusunu sustur", "Portlar güvenilir (sunucuya ya da uplink'e bakan) ve güvenilmez (kullanıcı) olarak ayrılır. Güvenilmez porttan gelen DHCP sunucu yanıtları düşer.")
    sw = f.device(440, 140, "switch", "SW1", "ip dhcp snooping")
    srv = f.device(440, 40, "server", "Gerçek DHCP", "uplink: trust", tone="ok")
    pc = f.device(160, 240, "pc", "PC", "untrusted")
    modem = f.device(720, 240, "router", "Evden gelen modem", "OFFER gönderiyor", tone="err", w=200)
    f.link(srv, sw, tone="ok")
    f.link(sw, pc)
    f.link(sw, modem, tone="err", blocked=True)
    f.note(20, 30, 290, "Benzetme: binada yalnız resepsiyon oda anahtarı dağıtabilir; koridorda anahtar dağıtan yabancı durdurulur.", tone="accent", size=12)
    return f


def g6():
    f = Fig(880, 280, "DAI: sahte ARP'ye karşı", "Saldırgan \"gateway benim\" diye sahte ARP yanıtı gönderir ve trafiği üzerinden geçirir (ortadaki adam). DAI ARP yanıtlarını DHCP snooping bağlama tablosuyla karşılaştırır, uymayanları düşürür.")
    pc = f.device(130, 120, "pc", "PC", "gw 192.168.10.1")
    sw = f.device(440, 120, "switch", "SW1", "ip arp inspection")
    gw = f.device(750, 120, "router", "Gateway", ".1 · MAC …01")
    atk = f.device(440, 240, "laptop", "Saldırgan", "\".1 benim, MAC …66\"", tone="err", w=200)
    f.link(pc, sw)
    f.link(sw, gw, tone="ok")
    f.link(atk, sw, tone="err", blocked=True)
    f.table(560, 200, ["Bağlama tablosu", ""], [["192.168.10.1", "…01"]], [160, 140], mono_cols=(0, 1))
    return f


def g7():
    f = Fig(880, 260, "Storm control ve RA guard", "Storm control bir porttaki broadcast trafiği eşiği aşınca onu düşürür ya da portu kapatır. RA guard kullanıcı portlarından gelen sahte IPv6 Router Advertisement'larını engeller.")
    f.box(30, 30, 400, 150, "Storm control", "warn", sub="storm-control broadcast level 5 · döngüye ya da bozuk karta karşı", size=16)
    f.box(450, 30, 400, 150, "RA guard", "v3", sub="IPv6'da sahte \"gateway benim\" duyurusuna karşı (Konu #16)", size=16)
    f.text(440, 220, "Benzetme: storm control taşan küvete otomatik vana; RA guard sahte \"çıkış bu taraf\" tabelasını söken görevli", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
