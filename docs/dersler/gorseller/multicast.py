"""Multicast dersi şemaları (docs/dersler/multicast.md)."""

from figures import Fig


def g1():
    f = Fig(880, 290, "Unicast, broadcast, multicast", "Unicast her alıcıya ayrı kopya gönderir; broadcast ağdaki herkese gönderir. Multicast tek kopya gönderir; ağ, kopyayı yalnız isteyenlerin olduğu yöne çoğaltır.")
    titles = [("Unicast", "3 alıcı = 3 kopya", "warn"), ("Broadcast", "herkese, istemeyene de", "err"), ("Multicast", "tek kopya, yalnız isteyenlere", "ok")]
    for i, (t, s, tone) in enumerate(titles):
        x = 24 + i * 284
        f.box(x, 30, 264, 150, t, tone, sub=s, size=16)
    f.text(440, 220, "Benzetme: her eve ayrı mektup (unicast), mahalle hoparlöründen anons (broadcast), yalnız abonelere radyo yayını (multicast)", size=12, tone="m")
    f.text(440, 254, "Kullanım: IPTV, kamera akışları, borsa verisi, yazılım dağıtımı, yönlendirme protokolleri (224.0.0.5 gibi)", size=12, tone="accent", bold=True)
    return f


def g2():
    f = Fig(880, 230, "Multicast adresleri", "IPv4 multicast aralığı 224.0.0.0/4'tür. 224.0.0.0/24 yerel ağ denetimi içindir ve router'dan geçmez. 232.0.0.0/8 SSM, 239.0.0.0/8 kurum içi (özel) kullanım içindir.")
    f.table(30, 20, ["Aralık", "Kullanım", "Örnek"], [
        ["224.0.0.0/24", "yerel bağlantı, TTL 1, yönlendirilmez", "224.0.0.5 OSPF, 224.0.0.10 EIGRP"],
        ["224.0.1.0 – 238.255.255.255", "genel (global) gruplar", "internet çapı yayınlar"],
        ["232.0.0.0/8", "Source-Specific Multicast (SSM)", "kaynağı bilinen yayın"],
        ["239.0.0.0/8", "kurum içi (administratively scoped)", "239.1.1.1 kamera akışı"],
    ], [260, 320, 240], mono_cols=(0,))
    f.text(440, 200, "MAC karşılığı 01:00:5e + IP'nin son 23 biti: 32 IP adresi aynı MAC'e düşer", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 290, "IGMP: alıcı 'ben de istiyorum' der", "Alıcı bilgisayar yerel router'a IGMP Join (Membership Report) gönderir. Router periyodik olarak 'hâlâ isteyen var mı?' diye sorar (Query). IGMPv2 Leave ile ayrılır; IGMPv3 kaynak belirtebilir.")
    pc = f.device(140, 140, "pc", "Alıcı", "239.1.1.1 izlemek istiyor", w=170)
    sw = f.device(440, 140, "switch", "Switch", "IGMP snooping", w=150)
    r = f.device(740, 140, "router", "Router", "IGMP querier", w=150)
    f.arrow(215, 120, 365, 120, "Join 239.1.1.1", tone="ok")
    f.arrow(515, 120, 665, 120, "Join", tone="ok")
    f.arrow(665, 165, 515, 165, "Query (60 sn)", tone="v1", above=False)
    f.note(20, 220, 840, "IGMP snooping: switch Join'leri dinler ve grup trafiğini yalnız isteyen portlara gönderir; yoksa multicast bütün VLAN'a broadcast gibi yayılır.", tone="accent", size=12)
    return f


def g4():
    f = Fig(880, 300, "PIM: router'lar arası dağıtım ağacı", "IGMP alıcı ile ilk router arasındadır; router'lar arasında ağacı PIM kurar. PIM kendi rota tablosu tutmaz, var olan unicast tabloyu kullanır (protokolden bağımsız).")
    src = f.device(110, 60, "server", "Kaynak", "10.1.1.10 → 239.1.1.1", w=170)
    r1 = f.device(330, 150, "router", "R1")
    r2 = f.device(560, 90, "router", "R2")
    r3 = f.device(560, 220, "router", "R3")
    a = f.device(790, 90, "pc", "Alıcı A")
    b = f.device(790, 220, "pc", "(alıcı yok)", tone="soft")
    f.link(src, r1, tone="ok", width=3)
    f.link(r1, r2, tone="ok", width=3)
    f.link(r1, r3, tone="ln", dash=True)
    f.link(r2, a, tone="ok", width=3)
    f.link(r3, b, tone="ln", dash=True)
    f.text(560, 290, "Kalın yol: dağıtım ağacı · kesikli: alıcı olmadığı için budanmış (prune)", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 270, "Yoğun mod ve seyrek mod", "PIM-DM önce her yere yayar, istemeyen budanır (flood and prune); küçük ve alıcının yoğun olduğu ağlar için. PIM-SM yalnız isteyen yere gönderir; ortak bir buluşma noktası (RP) kullanır; kurumlarda kullanılan budur.")
    f.box(30, 30, 390, 150, "PIM Dense Mode", "warn", sub="her yere yay, sonra buda · periyodik yeniden yayma", size=15)
    f.box(460, 30, 390, 150, "PIM Sparse Mode", "ok", sub="yalnız Join gelen yere · RP üzerinden buluşma", size=15)
    f.text(440, 220, "Benzetme: bütün eve broşür atıp istemeyenin iade etmesi (dense) ile yalnız abone olanlara dergi göndermek (sparse)", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 290, "RP: buluşma noktası", "Seyrek modda alıcılar ve kaynaklar önce RP'de buluşur: alıcının router'ı RP'ye doğru (*,G) Join gönderir, kaynağın router'ı kaynağı RP'ye kaydeder. Trafik başlayınca genellikle kaynağa doğrudan en kısa yol ağacına (S,G) geçilir.")
    rp = f.device(440, 60, "router", "RP", "10.255.0.100", tone="accent")
    sr = f.device(140, 200, "router", "Kaynak router'ı", w=160)
    rr = f.device(740, 200, "router", "Alıcı router'ı", w=160)
    f.arrow(200, 175, 385, 85, "Register", tone="v2")
    f.arrow(680, 175, 495, 85, "(*,G) Join", tone="v1", above=False)
    f.arrow(220, 225, 660, 225, "SPT'ye geçiş (S,G)", tone="ok")
    f.text(440, 280, "RP adresi her router'da aynı olmalı: statik (ip pim rp-address), Auto-RP ya da BSR ile dağıtılır", size=12, tone="accent", bold=True)
    return f


def g7():
    f = Fig(880, 260, "RPF: döngü önleme", "Router multicast paketini, kaynağa giden unicast rotanın çıkış arayüzünden gelmişse kabul eder (Reverse Path Forwarding). Başka arayüzden gelen kopya atılır. Unicast rota tablosu yanlışsa multicast da bozulur.")
    r = f.device(440, 120, "router", "R1", "kaynak 10.1.1.10'a rota: Gi0/1", w=200)
    f.arrow(40, 120, 340, 120, tone="ok", width=2.5)
    f.text(190, 104, "Gi0/1'den geldi: KABUL", size=12, tone="ok", bold=True)
    f.arrow(840, 120, 540, 120, tone="err", width=2.5)
    f.text(690, 104, "Gi0/2'den geldi: AT (RPF hatası)", size=12, tone="err", bold=True)
    f.text(440, 210, "Benzetme: mektup yalnız gönderenin şehrinden gelen posta arabasıyla gelirse kabul edilir; başka yoldan dolaşıp gelen kopya imha edilir", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
