"""NAT/PAT dersi şemaları (docs/dersler/nat-pat.md)."""

from figures import Fig


def g1():
    f = Fig(880, 290, "Özel adresle internete çıkılmaz", "Özel kaynaklı paket hedefe ulaşabilir ama yanıt geri dönemez: internetteki hiçbir router 192.168.x.x'e giden yolu bilmez.")
    pc = f.device(90, 110, "pc", "PC-11", "192.168.10.11")
    r1 = f.device(300, 110, "router", "R1", "NAT yok")
    isp = f.device(530, 110, "cloud", "İnternet", w=150)
    web = f.device(780, 110, "server", "WEB", "198.51.100.10")
    f.link(pc, r1)
    f.link(r1, isp)
    f.link(isp, web)
    f.arrow(150, 60, 740, 60, "kaynak 192.168.10.11 → gider", tone="ok")
    f.arrow(740, 170, 360, 170, "yanıt 192.168.10.11'e → yol yok, düşer", tone="err", above=False)
    f.note(30, 210, 820, "Benzetme: zarfa iade adresi olarak \"3. kat, 12 numara\" yazmak. Postane hangi binanın 3. katı olduğunu bilemez; mektup geri dönmez.", tone="warn", size=12)
    return f


def g2():
    f = Fig(880, 270, "Dört adres terimi", "Inside local PC'nin gerçek (özel) adresi, inside global internette görünen adresidir. Outside local ve global karşı tarafın adresidir; şubede genelde aynıdır.")
    f.zone(20, 30, 300, 200, "İÇERİ (inside)", "v1")
    f.zone(560, 30, 300, 200, "DIŞARI (outside)", "v2")
    pc = f.device(170, 130, "pc", "PC-11", "inside local 192.168.10.11", w=230)
    r1 = f.device(440, 130, "router", "R1", "çevirir")
    web = f.device(710, 130, "server", "WEB", "outside global 198.51.100.10", w=240)
    f.link(pc, r1)
    f.link(r1, web)
    f.note(340, 190, 200, "inside global 203.0.113.2", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 280, "PAT: tek adres, çok kullanıcı", "Bütün iç adresler tek genel adresi paylaşır; dönüşte kimin olduğunu port numarası ayırır.")
    f.table(30, 20, ["Inside local", "Inside global", "Outside"], [
        ["192.168.10.11:51000", "203.0.113.2:51000", "198.51.100.10:80"],
        ["192.168.10.12:51000", "203.0.113.2:51001", "198.51.100.10:80"],
        ["192.168.10.12:51002", "203.0.113.2:51002", "198.51.100.10:443"],
    ], [270, 270, 280], mono_cols=(0, 1, 2))
    f.note(30, 150, 820, "Benzetme: apartmanın tek posta adresi var; zarfın üstündeki daire numarası (port) mektubu doğru kişiye ulaştırır.", tone="accent", size=12)
    f.note(30, 210, 820, "Port çakışırsa (iki PC aynı kaynak portu) router birine yeni port verir: 51000 → 51001.", tone="ok", size=12)
    return f


def g4():
    f = Fig(880, 300, "PAT'ın üç parçası", "Roller (inside/outside), çevrilecek trafiği seçen ACL ve ikisini bağlayan kural. Biri eksikse çeviri olmaz; varsayılan rota da gerekir.")
    parts = [
        ("1 · Roller", "ip nat inside (LAN)\nip nat outside (WAN)", "v1"),
        ("2 · ACL", "access-list 1 permit\n192.168.10.0 0.0.0.255", "v2"),
        ("3 · Kural", "ip nat inside source list 1\ninterface g0/1 overload", "v3"),
    ]
    for i, (t, cmd, tone) in enumerate(parts):
        x = 30 + i * 280
        f.rect(x, 30, 260, 130, tone)
        f.text(x + 130, 60, t, size=15, bold=True)
        f.lines(x + 130, 96, cmd.split("\n"), size=12, mono=True)
    f.note(30, 186, 820, "+ ip route 0.0.0.0 0.0.0.0 <ISP>: NAT yönlendirmenin yerini tutmaz.", tone="warn", size=12)
    f.note(30, 236, 820, "Benzetme: tercüman (kural), kimin konuşacağını gösteren liste (ACL) ve hangi kapının içeri, hangisinin dışarı olduğu (roller).", tone="accent", size=12)
    return f


def g5():
    f = Fig(880, 250, "Çeviri ne zaman olur?", "Çeviri yalnız paket inside arayüzden girip outside arayüzden çıkarken yapılır. Roller ters yazılırsa çeviri tetiklenmez.")
    pc = f.device(100, 110, "pc", "PC-11")
    r1 = f.device(440, 110, "router", "R1", "", w=180)
    isp = f.device(780, 110, "router", "ISP")
    f.link(pc, r1, lb="g0/0 inside", tone="v1")
    f.link(r1, isp, la="g0/1 outside", tone="v2")
    f.packet(250, 70, "src 192.168.10.11", tone="v1")
    f.packet(630, 70, "src 203.0.113.2", tone="v2")
    f.note(30, 180, 820, "ACL'ye uymayan kaynak çevrilmeden iletilir: hata yok, uyarı yok, paket sessizce kaybolur. Yeni bir LAN eklenince ACL'yi güncellemek unutulur.", tone="err", size=12)
    return f


def g6():
    f = Fig(880, 250, "Statik NAT ve port yönlendirme", "Statik NAT bir iç adresi bir genel adrese kalıcı eşler; port yönlendirme yalnız bir portu eşler. İçerideki sunucuya dışarıdan erişim içindir.")
    f.box(30, 30, 400, 110, "Statik NAT", "v1", sub="192.168.10.20 ↔ 203.0.113.5 (bütün portlar)", size=15)
    f.box(450, 30, 400, 110, "Port yönlendirme", "v2", sub="203.0.113.2:80 → 192.168.10.20:80", size=15)
    f.text(230, 170, "ip nat inside source static 192.168.10.20 203.0.113.5", size=11, mono=True)
    f.text(650, 170, "ip nat inside source static tcp", size=11, mono=True)
    f.text(650, 188, "192.168.10.20 80 203.0.113.2 80", size=11, mono=True)
    f.text(440, 230, "Dinamik NAT: havuzdan (ip nat pool) sırayla adres; havuz biterse yeni kullanıcı çıkamaz", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 300, "Teşhis: tablo boş mu, dolu mu?", "Dinamik ve PAT girdileri yalnız trafik geçtikçe oluşur. Tablo boşsa çeviri hiç tetiklenmemiştir: rol, ACL ya da kural eksik.")
    f.box(330, 14, 220, 50, "show ip nat translations", "accent", size=12)
    f.arrow(390, 64, 220, 110, "BOŞ", tone="err", above=False)
    f.arrow(490, 64, 660, 110, "DOLU", tone="ok")
    f.box(30, 112, 380, 120, "Çeviri tetiklenmiyor", "err", sub="show ip nat statistics: roller, kural; ACL kaynağı kapsıyor mu?", size=14)
    f.box(470, 112, 380, 120, "Çeviri var, yine çalışmıyor", "warn", sub="varsayılan rota, ISP, dönüş yolu; trace ile bak", size=14)
    f.text(440, 270, "Router'dan ping gidiyor, PC'den gitmiyor: klasik NAT izi", size=12, tone="m", bold=True)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
