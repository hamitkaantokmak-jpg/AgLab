"""PBR dersi şemaları (docs/dersler/pbr.md)."""

from figures import Fig


def g1():
    f = Fig(880, 280, "Normal yönlendirme ve PBR", "Normal yönlendirme yalnız hedef adrese bakar: aynı hedefe giden her paket aynı yoldan gider. PBR kaynak, protokol ya da port gibi başka ölçütlerle aynı hedef için farklı yol seçebilir.")
    p = f.device(90, 70, "pc", "Personel", "10.10.0.0/16")
    g = f.device(90, 190, "laptop", "Misafir", "10.20.0.0/16")
    r = f.device(400, 130, "router", "R1", "PBR", tone="accent")
    m = f.device(720, 70, "cloud", "MPLS", "203.0.113.1")
    i = f.device(720, 190, "cloud", "İnternet hattı", "192.0.2.1", w=170)
    f.link(p, r, tone="v1")
    f.link(g, r, tone="v3")
    f.link(r, m, tone="v1", label="personel")
    f.link(r, i, tone="v3", label="misafir")
    f.text(440, 262, "Hedef aynı (internet), yol farklı: rota tablosu bunu yapamaz", size=12, tone="accent", bold=True)
    return f


def g2():
    f = Fig(880, 250, "PBR'ın bakabildiği ölçütler", "Route-map'in match satırı ACL ile kaynak/hedef adres, protokol ve portu; match length ile paket boyunu eşleyebilir. set satırı yolu belirler.")
    f.table(30, 20, ["match", "Örnek", "set", "Örnek"], [
        ["ip address <ACL>", "kaynak 10.20.0.0/16", "ip next-hop", "192.0.2.1"],
        ["ip address <ACL>", "udp 5060 (ses)", "ip default next-hop", "203.0.113.1"],
        ["length min max", "1000–1500 bayt", "interface", "Tunnel0"],
        ["—", "—", "vrf", "MISAFIR"],
    ], [180, 230, 200, 210], mono_cols=(0, 2, 3))
    f.text(440, 180, "route-map CIKIS permit 10 · match ip address MISAFIR · set ip next-hop 192.0.2.1", size=12, mono=True, bold=True)
    f.text(440, 220, "Benzetme: kargo, alıcı adresinin yanında göndericiye ve paket türüne de bakıyor", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 260, "Nereye uygulanır?", "PBR paket router'a girerken karar verir; politika trafiğin GİRDİĞİ arayüze yazılır. Router'ın kendi ürettiği trafik bir arayüzden girmez: ip local policy gerekir.")
    g = f.device(100, 110, "laptop", "Misafir")
    r = f.device(440, 110, "router", "R1", w=150)
    i = f.device(780, 110, "cloud", "İnternet")
    f.link(g, r, la="", lb="Gi0/1", tone="ok", label="ip policy ✓")
    f.link(r, i, la="Gi0/3", tone="err", label="burada etkisiz ✗")
    f.text(440, 195, "Router kaynaklı (syslog, SNMP, ping): ip local policy route-map X", size=12, mono=True, bold=True)
    f.text(440, 232, "PBR tek yönlüdür: dönüş trafiğini ayrıca düşün (NAT, firewall)", size=12, tone="warn", bold=True)
    return f


def g4():
    f = Fig(880, 260, "PBR'da deny engellemek değildir", "ACL'de deny ya da route-map'te deny bloku paketi düşürmez; politikanın dışında bırakır ve paket normal rota tablosuyla iletilir. Hiçbir bloka uymayan paket de normal yönlendirilir.")
    f.box(30, 30, 260, 120, "permit + eşleşti", "ok", sub="set uygulanır (politika)", size=14)
    f.box(310, 30, 260, 120, "deny / eşleşmedi", "v1", sub="normal yönlendirme", size=14)
    f.box(590, 30, 260, 120, "Engellemek için", "err", sub="ip access-group … in", size=14)
    f.text(440, 190, "Redistribution'da örtük deny rotayı REDDEDER; PBR'da paketi NORMAL YOLA bırakır", size=12, tone="accent", bold=True)
    f.text(440, 228, "Benzetme: 'bu müşteriye ekspres kuralı uygulama' demek, müşteriyi kapıdan çevirmek demek değildir", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 270, "next-hop ile default next-hop", "set ip next-hop rota tablosuna bakmadan uygulanır: iç hedefler bile politika yoluna gider. set ip default next-hop önce tabloya bakar; hedef için açık bir rota yoksa (yalnız varsayılan varsa) politika devreye girer.")
    f.box(30, 30, 390, 160, "set ip next-hop", "v3", sub="önce politika, sonra tablo", size=16)
    f.box(460, 30, 390, 160, "set ip default next-hop", "v2", sub="önce tablo; açık rota yoksa politika", size=16)
    f.text(225, 150, "misafir → 10.10.9.20 (yazıcı): internete! ✗", size=12, tone="err")
    f.text(655, 150, "misafir → 10.10.9.20: iç rota kullanılır ✓", size=12, tone="ok")
    f.text(440, 230, "İç hedefleri korumanın diğer yolu: ACL'de permit'ten önce iç ağlar için deny", size=12, tone="accent", bold=True)
    return f


def g6():
    f = Fig(880, 290, "Next-hop öldüğünde: IP SLA ve track", "Arayüz açık ama karşı taraf ölüyse PBR bunu fark etmez ve trafiği kara deliğe gönderir. IP SLA next-hop'u yoklar, track sonucu taşır; verify-availability kapalı next-hop'u atlar.")
    r = f.device(150, 140, "router", "R1", "IP SLA 10 → 192.0.2.1", tone="accent", w=200)
    m = f.device(500, 70, "router", "Modem", "arkası kopuk", tone="err")
    i = f.device(780, 70, "cloud", "İnternet")
    b = f.device(640, 210, "cloud", "MPLS", "yedek next-hop")
    f.link(r, m, label="up/up", tone="ok")
    f.link(m, i, tone="err", dash=True, blocked=True)
    f.link(r, b, tone="v1", label="track 10 down → buradan")
    f.text(440, 275, "set ip next-hop verify-availability 192.0.2.1 10 track 10", size=12, mono=True, bold=True)
    return f


def g7():
    f = Fig(880, 230, "PBR'ı doğrulamak", "show ip route PBR kararını göstermez. Politikanın nerede olduğunu, eşleşme sayaçlarını ve next-hop durumunu ayrı komutlar gösterir.")
    f.table(30, 20, ["Soru", "Komut", "Ne arıyorsun"], [
        ["Politika nerede?", "show ip policy", "gelen arayüz mü"],
        ["Eşleşen paket var mı?", "show route-map CIKIS", "Policy routing matches > 0"],
        ["ACL isabet ediyor mu?", "show access-lists MISAFIR", "satır sayaçları"],
        ["Next-hop canlı mı?", "show track · show ip sla statistics", "Reachability Up"],
    ], [220, 320, 280], mono_cols=(1,))
    f.text(440, 205, "Sayaç 0: yanlış arayüz, ACL eşleşmiyor ya da trafik bu router'dan geçmiyor", size=12, tone="accent", bold=True)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
