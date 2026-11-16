"""İleri BGP dersi şemaları (docs/dersler/bgp-ileri.md)."""

from figures import Fig


def g1():
    f = Fig(880, 270, "BGP: AS dışında eBGP, AS içinde iBGP", "Sınır router'lar dış AS'larla eBGP konuşur. Öğrendiklerini AS içindeki diğer router'lara iBGP ile dağıtırlar. iBGP oturumları genelde loopback'ler arasında kurulur; loopback'lere yolu IGP (OSPF) sağlar.")
    f.zone(200, 30, 480, 200, "AS 65001 (iBGP + OSPF)", "v1")
    r1 = f.device(300, 90, "router", "R1", "sınır")
    r2 = f.device(580, 90, "router", "R2", "sınır")
    r3 = f.device(440, 185, "router", "R3", "iç")
    a = f.device(80, 90, "cloud", "ISP-A", "AS 65200")
    b = f.device(800, 90, "cloud", "ISP-B", "AS 65100")
    f.link(a, r1, label="eBGP", tone="v3")
    f.link(r2, b, label="eBGP", tone="v3")
    f.link(r1, r3, label="iBGP", tone="v1", dash=True)
    f.link(r2, r3, label="iBGP", tone="v1", dash=True)
    f.text(440, 258, "Benzetme: dış ilişkiler birimi (eBGP) ve şirket içi duyuru (iBGP)", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 260, "iBGP split horizon", "iBGP'den öğrenilen rota başka bir iBGP komşusuna iletilmez. AS_PATH AS içinde değişmediği için döngüyü bu kural önler. Sonuç: R1'in öğrendiği rota R3'e ulaşır ama R3 onu R4'e vermez.")
    r1 = f.device(110, 110, "router", "R1", "eBGP'den aldı", tone="ok")
    r3 = f.device(440, 110, "router", "R3", "iBGP'den aldı")
    r4 = f.device(770, 110, "router", "R4", "rota yok", tone="err")
    f.link(r1, r3, label="iBGP ✓", tone="ok")
    f.link(r3, r4, label="iletmez ✗", tone="err", dash=True)
    f.text(440, 195, "Çözüm: tam örgü (n(n−1)/2 oturum) ya da route reflector", size=13, tone="accent", bold=True)
    f.text(440, 228, "10 router tam örgü = 45 oturum", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 270, "iBGP next-hop'u değiştirmez", "R1, ISP'den öğrendiği rotayı R4'e next-hop 203.0.113.1 ile verir. R4 bu adresi bilmiyorsa rota geçersizdir: tabloda * görünür ama > (en iyi) olmaz. next-hop-self ile R1 kendi loopback'ini yazar.")
    isp = f.device(90, 100, "cloud", "ISP", "203.0.113.1")
    r1 = f.device(370, 100, "router", "R1", "Lo0 10.255.0.1", tone="accent")
    r4 = f.device(720, 100, "router", "R4", "203.0.113.1'i bilmiyor", w=200)
    f.link(isp, r1, tone="v3")
    f.link(r1, r4, tone="v1", dash=True)
    f.box(40, 170, 380, 56, "Önce: next-hop 203.0.113.1 → geçersiz", "err", size=13)
    f.box(460, 170, 380, 56, "next-hop-self: 10.255.0.1 → geçerli ✓", "ok", size=13)
    f.text(440, 252, "Ayrıca: update-source Loopback0 · loopback'lere IGP ile yol", size=12, tone="accent", bold=True)
    return f


def g4():
    f = Fig(880, 300, "Route reflector", "RR, istemcilerinden aldığını diğer istemcilere ve istemci olmayanlara; istemci olmayandan aldığını yalnız istemcilere yansıtır. Döngüye karşı ORIGINATOR_ID ve CLUSTER_LIST ekler. Yapılandırma yalnız RR'dadır.")
    rr = f.device(440, 70, "router", "RR (R3)", "route-reflector-client", tone="accent", w=200)
    c1 = f.device(150, 200, "router", "R1", "istemci")
    c2 = f.device(350, 200, "router", "R2", "istemci")
    c4 = f.device(550, 200, "router", "R4", "istemci")
    n = f.device(760, 200, "router", "R6", "istemci değil", tone="soft")
    for c in (c1, c2, c4):
        f.link(rr, c, tone="v1")
    f.link(rr, n, tone="ln", dash=True)
    f.text(440, 280, "5 router: RR ile 4 oturum yeter (tam örgüde 10). RR next-hop'u değiştirmez.", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 330, "Yol seçimi sırası", "Önce rota geçerli olmalı: next-hop'a ulaşılmalı, AS_PATH'te kendi AS'ın olmamalı. Sonra kriterler sırayla karşılaştırılır; ilk farklı olan kazananı belirler.")
    rows = [
        ("1", "Weight", "yüksek", "yalnız bu router"),
        ("2", "Local Preference", "yüksek", "AS içinde (varsayılan 100)"),
        ("3", "Yerel kaynaklı", "network / aggregate", ""),
        ("4", "AS_PATH", "kısa", "prepend ile uzatılır"),
        ("5", "Origin", "IGP < EGP < ?", ""),
        ("6", "MED", "düşük", "aynı komşu AS'tan gelenler arasında"),
        ("7", "eBGP > iBGP", "dış yol", ""),
        ("8", "IGP metriği", "next-hop'a yakın", "sonra: en eski, düşük router-id"),
    ]
    f.table(30, 20, ["#", "Kriter", "Kazanan", "Not"], [list(r) for r in rows], [50, 230, 220, 320], tones={0: "accent", 1: "accent", 3: "v3"})
    f.text(440, 310, "Benzetme: teklif seçerken önce müdürün tercihi, sonra şirket politikası, sonra en az aracı", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 280, "Giden ve gelen trafiği yönlendirmek", "Giden trafiği kendi tercihlerin belirler: Local Preference ve Weight. Gelen trafiği ise başkaları seçer; sen yalnız öneride bulunursun: AS_PATH prepend, MED, community, daha spesifik önek.")
    f.box(30, 30, 390, 150, "Giden (sen karar verirsin)", "v2", sub="LP 200 → ISP-A · Weight (tek router)", size=15)
    f.box(460, 30, 390, 150, "Gelen (sen önerirsin)", "v3", sub="prepend → ISP-B · MED · community · /24", size=15)
    f.text(225, 205, "route-map … in  (komşudan gelenlere)", size=12, mono=True)
    f.text(655, 205, "route-map … out (komşuya gidenlere)", size=12, mono=True)
    f.text(440, 240, "ISP'ye çıkışta her zaman yalnız kendi öneklerini izin ver: yoksa geçiş AS'ı olursun", size=12, tone="err", bold=True)
    f.text(440, 266, "Benzetme: hangi kapıdan çıkacağına sen karar verirsin; misafirler hangi kapıdan gireceğini kendileri seçer", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 230, "Politikayı uygulamak: soft reset", "Route-map değişikliği eldeki rotalara kendiliğinden uygulanmaz. Sert reset oturumu düşürür; soft reset oturum açıkken rotaları yeniden değerlendirir.")
    f.table(30, 20, ["Komut", "Ne olur", "Kesinti"], [
        ["clear ip bgp 203.0.113.1", "oturum kapanır, yeniden kurulur", "VAR"],
        ["clear ip bgp 203.0.113.1 soft in", "komşudan yenileme istenir, gelenler yeniden süzülür", "yok"],
        ["clear ip bgp 203.0.113.1 soft out", "duyurular yeniden gönderilir", "yok"],
    ], [300, 400, 120], tones={0: "err"}, mono_cols=(0,))
    f.text(440, 160, "Doğrula: show ip bgp summary → Up/Down süresi sıfırlanmamış olmalı", size=12, tone="accent", bold=True)
    f.text(440, 195, "Benzetme: kuralı değiştirince dükkânı kapatıp açmak yerine raftaki ürünlere yeni etiketi yapıştırmak", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
