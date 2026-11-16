"""IPv6 ileri dersi şemaları (docs/dersler/ipv6-ileri.md)."""

from figures import Fig


def g1():
    f = Fig(880, 270, "IPv6 istemcisi bilgilerini nereden alır?", "Geçit her zaman router'ın RA mesajından gelir. Adres SLAAC ile kendi üretilebilir ya da DHCPv6'dan alınır. DNS, RA'dan (RDNSS) ya da DHCPv6'dan gelir. Hangisinin kullanılacağını RA'daki bayraklar söyler.")
    pc = f.device(130, 130, "laptop", "İstemci")
    r = f.device(500, 60, "router", "R1", "RA: A · M · O bayrakları", tone="accent", w=210)
    d = f.device(500, 200, "server", "DHCPv6", "adres ve/veya DNS", w=180)
    f.link(pc, r, label="geçit + önek", tone="v1")
    f.link(pc, d, label="M=1 adres · O=1 DNS", tone="v2")
    f.text(760, 110, "DHCPv6", size=13, bold=True, tone="err")
    f.text(760, 132, "geçit VERMEZ", size=13, bold=True, tone="err")
    f.text(440, 255, "Benzetme: apartman girişindeki duyuru panosu (RA) ve yönetim odası (DHCPv6)", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 250, "RA bayrakları", "A bayrağı istemciye adresini kendisinin üretmesini, M bayrağı adresi DHCPv6'dan almasını, O bayrağı DNS gibi diğer bilgileri DHCPv6'dan almasını söyler.")
    f.table(30, 20, ["A", "M", "O", "Adres", "DNS", "Ad"], [
        ["1", "0", "0", "SLAAC", "RA (RDNSS)", "yalnız SLAAC"],
        ["1", "0", "1", "SLAAC", "DHCPv6", "stateless DHCPv6"],
        ["0", "1", "1", "DHCPv6", "DHCPv6", "stateful DHCPv6"],
    ], [60, 60, 60, 160, 200, 280], tones={1: "v2", 2: "v3"})
    f.text(440, 160, "ipv6 nd other-config-flag → O · ipv6 nd managed-config-flag → M", size=12, mono=True, bold=True)
    f.text(440, 192, "ipv6 nd prefix 2001:db8:10::/64 no-autoconfig → A=0", size=12, mono=True)
    f.text(440, 228, "Üç durumda da geçit RA'dan gelir", size=12, tone="accent", bold=True)
    return f


def g3():
    f = Fig(880, 250, "DHCPv6 relay", "İstemci DHCPv6 isteğini ff02::1:2 adresine (bütün DHCPv6 sunucu ve relay'ler) gönderir. Relay, isteği uzaktaki sunucuya unicast iletir: IPv4'teki ip helper-address'in karşılığı.")
    pc = f.device(110, 110, "laptop", "İstemci", "UDP 546")
    r = f.device(440, 110, "router", "R1 (relay)", "ipv6 dhcp relay destination", tone="accent", w=230)
    s = f.device(770, 110, "server", "Sunucu", "2001:db8:100::547")
    f.link(pc, r, label="ff02::1:2", tone="v1")
    f.link(r, s, label="unicast → UDP 547", tone="v2")
    f.text(440, 195, "Relay komutu istemcinin bağlı olduğu arayüze yazılır", size=12, tone="accent", bold=True)
    f.text(440, 228, "Stateful kiralarda istemci kimliği DUID'dir, MAC değil", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 290, "IPv6 ACL'in görünmeyen sonu", "Her IPv6 ACL'in sonunda komşu keşfine (NS, NA) izin veren iki örtük satır ve ardından örtük deny vardır. Elle yazılan deny ipv6 any any bu izinlerin önüne geçer ve komşu keşfini bozar.")
    rows = [("10 permit tcp … eq 443", "card", "senin satırların"), ("20 deny ipv6 any any log", "err", "elle eklendi: NS/NA burada düşer ✗"), ("örtük permit icmp any any nd-na", "soft", "hiç işlenmez"), ("örtük permit icmp any any nd-ns", "soft", "hiç işlenmez"), ("örtük deny ipv6 any any", "soft", "")]
    for i, (t, tone, s) in enumerate(rows):
        y = 20 + i * 44
        f.rect(30, y, 820, 38, tone, r=6)
        f.text(50, y + 24, t, size=12, mono=True, anchor="start", bold=i < 2)
        f.text(830, y + 24, s, size=11, anchor="end", tone="err" if tone == "err" else "m")
    f.text(440, 255, "Elle deny yazacaksan önce: permit icmp any any nd-ns · permit icmp any any nd-na", size=12, tone="accent", bold=True)
    return f


def g5():
    f = Fig(880, 270, "Bir LAN'da IPv6 tehditleri", "IPv6'yı kullanmayan ağlarda bile işletim sistemleri IPv6'yı açık getirir. Sahte bir RA ya da DHCPv6 yanıtı, istemcilerin geçidini ve DNS'ini saldırgana çevirebilir.")
    pc = f.device(120, 120, "laptop", "İstemciler")
    sw = f.device(400, 120, "switch", "SW1")
    r = f.device(700, 60, "router", "R1", "gerçek geçit")
    a = f.device(700, 190, "laptop", "Saldırgan", "sahte RA · DHCPv6 · NA", tone="err", w=200)
    f.link(pc, sw)
    f.link(sw, r, tone="ok")
    f.link(sw, a, tone="err", dash=True)
    f.text(250, 220, "geçit = saldırganın link-local'i", size=12, tone="err", bold=True)
    f.text(440, 255, "Benzetme: apartman panosuna sahte 'çıkış bu yönde' levhası asmak", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 270, "Tehdit → first-hop security özelliği", "Switch, erişim portlarından gelmemesi gereken mesajları atar ve kimin hangi adresi kullandığını bir bağlama tablosunda tutar. Hepsi IPv4'teki L2 güvenlik özelliklerinin IPv6 karşılığıdır.")
    f.table(30, 20, ["Tehdit", "Özellik", "IPv4 karşılığı"], [
        ["Sahte RA", "RA Guard (host / router rolü)", "—"],
        ["Sahte DHCPv6 sunucusu", "DHCPv6 Guard", "DHCP snooping (güvenilmeyen port)"],
        ["ND sahteciliği", "IPv6 Snooping + ND denetimi", "DAI"],
        ["Kaynak adres sahteciliği", "IPv6 Source Guard", "IP Source Guard"],
        ["ND önbelleği doldurma", "Destination Guard", "—"],
    ], [240, 300, 280])
    f.text(440, 210, "Yeni Catalyst sürümlerinde: SISF / device-tracking policy", size=12, tone="accent", bold=True)
    f.text(440, 245, "Router'a giden uplink: RA Guard'da router rolü", size=12, tone="warn", bold=True)
    return f


def g7():
    f = Fig(880, 230, "IPv6 istemci sorunu: sorun giderme sırası", "Önce istemcinin hangi adresleri ve geçidi aldığına bak; sonra RA bayraklarına, sonra DHCPv6'ya, sonra komşu tablosuna ve ACL'lere.")
    steps = [("Adres / geçit", "istemci: ipconfig"), ("RA bayrakları", "show ipv6 interface"), ("DHCPv6", "dhcp interface · binding"), ("Komşular", "show ipv6 neighbors"), ("ACL / FHS", "access-list · binding")]
    for i, (t, s) in enumerate(steps):
        x = 20 + i * 172
        f.box(x, 40, 152, 90, t, "accent" if i % 2 == 0 else "v2", sub=s, size=13)
        if i < len(steps) - 1:
            f.arrow(x + 152, 85, x + 172, 85)
    f.text(440, 180, "Geçit yoksa RA'ya; DNS yoksa O bayrağına; komşu INCMP ise ACL'e bak", size=12, tone="accent", bold=True)
    f.text(440, 210, "Benzetme: önce kimliğine bak, sonra panoya, sonra yönetim odasına", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
