"""DNS dersi şemaları (docs/dersler/dns.md)."""

from figures import Fig


def g1():
    f = Fig(860, 220, "DNS: ağın telefon rehberi", "Kullanıcı adı bilir (erp), ağ adresi ister (192.168.100.20); DNS rehberde adı bulup numarayı söyler.")
    f.box(40, 70, 170, 64, "\"erp\"", "v1", sub="kullanıcının bildiği", size=18)
    f.arrow(210, 102, 330, 102, "kimin numarası?", tone="ln")
    f.rect(330, 40, 210, 124, "soft", r=12)
    f.text(435, 64, "DNS sunucusu", size=14, bold=True)
    f.text(435, 84, "(rehber)", size=12, tone="m")
    f.table(350, 96, ["Ad", "Adres"], [["erp", "192.168.100.20"], ["srv", "192.168.100.10"]], [60, 130], tones={0: "ok"}, row_h=22, size=11, mono_cols=(1,))
    f.arrow(540, 102, 650, 102, "numarası bu", tone="ok")
    f.box(650, 70, 180, 64, "192.168.100.20", "ok", sub="ağın kullandığı", size=16)
    f.text(430, 205, "Benzetme: arkadaşının adını bilirsin, numarasını rehberden bulursun; arama yine numarayla yapılır", size=11, tone="m")
    return f


def g2():
    f = Fig(880, 250, "Sorgunun yolu: DNS sunucusu genelde başka ağda", "PC sorguyu gateway üzerinden sunucu odasındaki DNS sunucusuna (UDP 53) gönderir; gateway yoksa doğru DNS adresi bile işe yaramaz.")
    pc = f.device(80, 110, "pc", "PC-11", "DNS 192.168.100.10")
    r1 = f.device(340, 110, "router", "R1", "gateway")
    srv = f.device(600, 60, "server", "SRV (DNS)", "192.168.100.10")
    erp = f.device(600, 180, "server", "ERP", "192.168.100.20")
    f.link(pc, r1)
    f.link(r1, srv)
    f.link(r1, erp)
    f.badge(172, 76, 1)
    f.packet(262, 76, "erp kim? UDP 53", "accent")
    f.badge(760, 60, 2, "ok")
    f.text(780, 66, "erp = .100.20", size=12, anchor="start", tone="ok", bold=True)
    f.badge(172, 168, 3, "v2")
    f.packet(268, 168, "asıl trafik → .100.20", "v2")
    f.text(440, 244, "1 ad sorulur · 2 adres döner · 3 asıl bağlantı adresle kurulur", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 270, "İki test: adresle mi, adla mı?", "Adresle ping gidiyor ama adla gidilmiyorsa sorun DNS'tedir; adresle de gidilmiyorsa sorun DNS'ten öncedir.")
    f.text(170, 30, "ping 192.168.100.20", size=13, mono=True, bold=True)
    f.text(390, 30, "nslookup erp", size=13, mono=True, bold=True)
    f.text(680, 30, "Sonuç", size=13, bold=True)
    rows = [
        ("başarılı", "başarılı", "Ağ ve DNS sağlam; sorun uygulamada", "ok"),
        ("başarılı", "başarısız", "Sorun DNS'te: ayar, servis ya da kayıt", "warn"),
        ("başarısız", "—", "Sorun DNS'ten önce: adres, gateway, yol", "err"),
    ]
    for i, (p_, n, mean, tone) in enumerate(rows):
        y = 46 + i * 70
        f.box(90, y, 160, 54, p_, "ok" if p_ == "başarılı" else "err", size=13)
        f.box(310, y, 160, 54, n, "ok" if n == "başarılı" else "err" if n == "başarısız" else "soft", size=13)
        f.arrow(470, y + 27, 510, y + 27)
        f.box(514, y, 336, 54, mean, tone, size=12)
    return f


def g4():
    f = Fig(880, 300, "nslookup'ın üç sonucu", "Yanıt geldi; sunucu 'böyle bir ad yok' dedi; ya da hiç yanıt gelmedi. Her biri farklı bir yere işaret eder.")
    rows = [
        ("Name: erp · Address: 192.168.100.20", "Çözüldü", "DNS sağlam; sorun başka yerde", "ok"),
        ("*** can't find erpp: Non-existent domain", "Sunucu cevap verdi: ad yok", "Yazım hatası, kayıt eksik, yanlış alan adı", "warn"),
        ("DNS request timed out", "Hiç cevap yok", "Sunucuya ping: yoksa yol/adres; varsa servis ya da filtre", "err"),
    ]
    for i, (out, what, next_, tone) in enumerate(rows):
        y = 20 + i * 90
        f.rect(30, y, 380, 70, "soft", r=8)
        f.text(46, y + 40, out, size=12, mono=True, anchor="start", bold=True)
        f.arrow(410, y + 35, 450, y + 35)
        f.box(454, y, 180, 70, what, tone, size=13)
        f.box(650, y, 200, 70, next_, "card", size=11, bold=False)
    return f


def g5():
    f = Fig(880, 210, "Kayıt türleri", "A IPv4 adresi, AAAA IPv6 adresi, CNAME takma ad, MX e-posta sunucusu, PTR adresten ad döndürür.")
    cards = [
        ("A", "erp → 192.168.100.20", "v1"),
        ("AAAA", "erp → 2001:db8::20", "v2"),
        ("CNAME", "muhasebe → erp", "v3"),
        ("MX", "sube.local → posta", "v4"),
        ("PTR", "192.168.100.20 → erp", "accent"),
    ]
    for i, (t, ex, tone) in enumerate(cards):
        x = 20 + i * 170
        f.rect(x, 40, 156, 120, tone, r=12)
        f.text(x + 78, 82, t, size=24, bold=True, mono=True)
        f.text(x + 78, 122, ex, size=11, mono=True)
    f.text(440, 196, "Benzetme: rehberde bir kişinin ev numarası (A), takma adı (CNAME), mektup adresi (MX) ve numaradan kim olduğu (PTR)", size=11, tone="m")
    return f


def g6():
    f = Fig(880, 230, "Önbellek ve TTL: düzeltme hemen yansımaz", "İstemci yanıtı TTL süresince saklar; sunucuda kayıt değişse bile süre dolana ya da önbellek boşaltılana kadar eski adresi kullanır.")
    x, w, y = 60, 760, 80
    f.rect(x, y, w * 0.7, 40, "v1", r=6)
    f.text(x + w * 0.35, y + 26, "önbellekte: erp → .100.20 (TTL süresince)", size=12, bold=True)
    f.rect(x + w * 0.7, y, w * 0.3, 40, "soft", r=6, dash=True)
    f.text(x + w * 0.85, y + 26, "TTL doldu: yeniden sor", size=12, tone="m")
    f.line(x + w * 0.4, y - 16, x + w * 0.4, y + 56, tone="warn", width=2.5)
    f.text(x + w * 0.4, y - 22, "sunucuda kayıt .100.30 yapıldı", size=12, tone="warn", bold=True)
    f.note(60, 150, 760, "İstemci hâlâ eski adrese gider. Windows'ta ipconfig /displaydns önbelleği gösterir, ipconfig /flushdns boşaltır.", tone="warn", size=12)
    return f


def g7():
    f = Fig(880, 300, "DNS teşhis haritası", "Kim etkileniyor ve sunucuya ping gidiyor mu: beş durum, beş yer.")
    rows = [
        ("Tek PC adla giremiyor, adresle giriyor", "O PC'nin DNS ayarı (elle yanlış)", "v1"),
        ("Bütün bir kat adla giremiyor", "DHCP havuzundaki dns-server", "v3"),
        ("Herkes; sunucuya ping gidiyor", "DNS servisi durmuş", "warn"),
        ("DNS doğru yazılı ama timed out, sunucuya ping yok", "Gateway / yol / filtre (UDP 53)", "err"),
        ("Tek bir ad çözülmüyor ya da eski adres", "Kayıt eksik/eski · önbellek (TTL)", "v4"),
    ]
    for i, (sym, where, tone) in enumerate(rows):
        y = 16 + i * 56
        f.box(30, y, 420, 46, sym, tone, size=12)
        f.arrow(450, y + 23, 490, y + 23)
        f.box(494, y, 356, 46, where, "soft", size=12, bold=False)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
