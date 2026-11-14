"""CDP/LLDP komşu keşfi dersi şemaları (docs/dersler/cdp-lldp.md)."""

from figures import Fig


def g1():
    f = Fig(880, 330, "Komşu keşfi: apartmanda kapı komşuları", "Her cihaz her porttan yalnız doğrudan komşusuna 'ben buyum' der. Duyuru bir sonraki cihaza aktarılmaz; PC'ler duyuru göndermez.")
    r1 = f.device(440, 50, "router", "R1", "CISCO2911")
    core = f.device(440, 200, "switch", "SW-CORE", "merkez")
    k1 = f.device(180, 290, "switch", "SW-KAT1")
    k2 = f.device(700, 290, "switch", "SW-KAT2")
    f.link(r1, core, la="Gi0/0", lb="Gi0/1", tone="accent")
    f.link(core, k1, la="Gi0/2", lb="Gi0/1", tone="accent")
    f.link(core, k2, la="Gi0/3", lb="Gi0/1", tone="accent")
    f.packet(560, 50, "CDP: ben R1, Gi0/0", tone="ok")
    f.note(20, 20, 250, "SW-CORE üç komşuyu görür. SW-KAT1, R1'i görmez: arada SW-CORE var.", tone="accent", size=12)
    return f


def g2():
    f = Fig(880, 250, "CDP duyurusunun içinde ne var?", "Her 60 saniyede bir gönderilen küçük bir kartvizit: ad, model, yazılım sürümü, IP adresi ve duyurunun çıktığı port. Komşu bunu 180 saniye saklar.")
    f.frame(30, 60, [
        ("Device ID", 140, "v1", "ad (hostname)"),
        ("Platform", 140, "v2", "model"),
        ("Version", 150, "v3", "IOS sürümü"),
        ("Address", 150, "v4", "IP adresi"),
        ("Port ID", 120, "accent", "çıkış portu"),
        ("Capability", 120, "soft", "R / S / P"),
    ], h=58, title="CDP duyurusu (katman 2 çerçevesi, IP gerekmez)")
    f.box(30, 150, 390, 64, "Her 60 sn yeni kartvizit", "ok", sub="zamanlayıcı: duyuru aralığı", size=14)
    f.box(450, 150, 400, 64, "180 sn haber gelmezse kayıt silinir", "warn", sub="holdtime: tabloda kalma süresi", size=14)
    return f


def g3():
    f = Fig(880, 260, "Local Intrfce ile Port ID: en sık okuma hatası", "Local Intrfce senin cihazındaki port, Port ID komşunun portudur. Çizime ikisi de girer.")
    core = f.device(200, 120, "switch", "SW-CORE", "komutu yazdığın cihaz", tone="v1", w=200)
    k2 = f.device(680, 120, "switch", "SW-KAT2", "komşu", tone="v2")
    f.link(core, k2, la="Gi0/3", lb="Gi0/1", tone="accent", width=3)
    f.table(110, 182, ["Device ID", "Local Intrfce", "Port ID"], [["SW-KAT2", "Gig 0/3  (benim)", "Gig 0/1  (onun)"]], [180, 240, 240], mono_cols=(1, 2))
    f.text(320, 60, "Local = burası", size=12, tone="v1", bold=True)
    f.text(560, 60, "Port ID = orası", size=12, tone="v2", bold=True)
    return f


def g4():
    f = Fig(880, 280, "CDP komşusu teşhisin yarısını yapar", "Komşu görünüyorsa katman 1 ve 2 sağlamdır, sorun yukarıdadır. Komşu yoksa sorun aşağıdadır: kablo, port ya da cihaz.")
    f.box(330, 14, 220, 54, "show cdp neighbors", "accent", size=14)
    f.arrow(380, 68, 210, 120, "komşu VAR (taze)", tone="ok", above=False)
    f.arrow(500, 68, 670, 120, "komşu YOK", tone="err")
    f.box(40, 122, 360, 120, "Katman 1-2 çalışıyor", "ok", sub="IP, maske, gateway, VLAN, ACL'ye bak (Konu #2, #8)", size=15)
    f.box(480, 122, 360, 120, "Sorun aşağıda", "err", sub="kablo, shutdown, err-disabled, CDP kapalı (Konu #4)", size=15)
    f.text(440, 268, "Dikkat: holdtime azalıp yenilenmiyorsa kayıt eskidir; bağlantı şu an çalışmıyor olabilir", size=11, tone="m")
    return f


def g5():
    f = Fig(880, 290, "Bilinmeyen ağı çizmek: komşudan komşuya", "Bildiğin tek cihazdan başla, komşu tablosunu oku, detail ile adresleri al, bir sonraki cihaza geç ve tekrarla.")
    steps = [
        ("1", "R1'de show cdp neighbors", "tek komşu: SW-CORE"),
        ("2", "SW-CORE'a geç", "üç komşu, iki uçtaki portlar"),
        ("3", "show cdp neighbors detail", "her komşunun IP adresi"),
        ("4", "kat switch'lerine bağlan", "aynı adımları tekrarla"),
    ]
    for i, (n, a, b) in enumerate(steps):
        x = 24 + i * 214
        f.box(x, 40, 196, 92, a, "card", sub=b, size=13)
        f.badge(x + 16, 40, int(n))
        if i < 3:
            f.arrow(x + 196, 86, x + 214, 86)
    f.note(24, 160, 832, "PC'ler komşu tablosunda görünmez: CDP göndermezler. Bir PC'nin hangi portta olduğu MAC adres tablosundan bulunur (show mac address-table, Konu #3).", tone="accent", size=12)
    f.note(24, 222, 832, "Sonuç: kâğıtta her bağlantının iki ucunda port adı ve her cihazın yönetim adresi olan güncel bir çizim.", tone="ok", size=12)
    return f


def g6():
    f = Fig(880, 290, "CDP ile LLDP", "CDP Cisco'ya özeldir ve varsayılan açıktır. LLDP açık standarttır (IEEE 802.1AB), Cisco'da varsayılan kapalıdır ve iki uçta da açılmalıdır.")
    f.table(40, 20, ["", "CDP", "LLDP"], [
        ["Tanım", "Cisco'ya özel", "IEEE 802.1AB"],
        ["Cisco'da varsayılan", "açık", "kapalı (lldp run)"],
        ["Aralık / holdtime", "60 / 180 sn", "30 / 120 sn"],
        ["Tümüyle kapat", "no cdp run", "no lldp run"],
        ["Tek portta kapat", "no cdp enable", "no lldp transmit / receive"],
    ], [220, 260, 320], mono_cols=())
    cs = f.device(160, 240, "switch", "Cisco switch", "lldp run", tone="v1")
    fw = f.device(720, 240, "firewall", "Başka marka FW", "LLDP açık", tone="v3")
    f.link(cs, fw, "yalnız LLDP ile görünür", tone="accent")
    return f


def g7():
    f = Fig(880, 260, "Güvenlik: kartvizitini herkese dağıtma", "CDP model, sürüm ve IP adresini açıkça yayınlar. Şirket dışına bakan portta kapatılır; iç ağda sorun giderme için açık kalır.")
    lan = f.device(130, 120, "switch", "İç ağ", "CDP açık", tone="ok")
    r1 = f.device(440, 120, "router", "R1")
    isp = f.device(760, 120, "cloud", "Servis sağlayıcı", "internet", tone="err", w=170)
    f.link(lan, r1, la="", lb="Gi0/0", tone="ok")
    f.link(r1, isp, la="Gi0/1", tone="err", blocked=True)
    f.note(500, 180, 360, "interface g0/1 → no cdp enable: dışarıya model ve sürüm gitmez", tone="ok", size=12)
    f.note(20, 180, 400, "Saldırgan için sürüm bilgisi: hangi açığı deneyeceğinin listesi", tone="warn", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
