"""Kablosuz ağlar dersi şemaları (docs/dersler/kablosuz.md)."""

from figures import Fig


def g1():
    f = Fig(880, 280, "Hava ortak bir kablodur", "Kablosuzda aynı kanaldaki herkes aynı ortamı paylaşır ve aynı anda yalnız biri konuşabilir (yarı çift yönlü). Çakışmayı önlemek için önce dinlenir, sonra gönderilir (CSMA/CA).")
    ap = f.device(440, 70, "ap", "AP", "kanal 6")
    for i, (x, n) in enumerate([(160, "Laptop"), (340, "Telefon"), (540, "Tablet"), (720, "Laptop 2")]):
        d = f.device(x, 210, "laptop", n, w=110)
        f.link(ap, d, tone="accent", dash=True)
    f.note(20, 20, 290, "Benzetme: telsiz. Aynı kanaldaki herkes duyar; biri konuşurken diğerleri bekler.", tone="accent", size=12)
    f.text(440, 268, "Kullanıcı arttıkça herkesin payı küçülür: kablosuz hızı paylaşılır", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 320, "Bantlar ve kanallar", "2.4 GHz uzağa gider ama yalnız 3 çakışmayan kanalı vardır (1, 6, 11). 5 GHz ve 6 GHz daha çok kanal ve hız sunar, menzili daha kısadır.")
    xs = {1, 6, 11}
    for ch in range(1, 12):
        x = 140 + (ch - 1) * 60
        tone = "ok" if ch in xs else "soft"
        f.path(f"M {x - 100} 160 Q {x} 40 {x + 100} 160", tone="accent" if ch in xs else "ln", width=2.5 if ch in xs else 1)
        f.text(x, 182, str(ch), size=12, bold=ch in xs, tone="accent" if ch in xs else "m")
    f.text(440, 210, "2.4 GHz: kanallar 5 MHz aralıklı, her biri ~20 MHz geniş → yalnız 1, 6, 11 çakışmaz", size=12, tone="t", bold=True)
    f.table(80, 236, ["Bant", "Menzil", "Kanal / hız"], [["2.4 GHz", "uzun", "3 çakışmayan, kalabalık"], ["5 / 6 GHz", "kısa", "çok kanal, yüksek hız"]], [180, 180, 360], row_h=22, size=11)
    return f


def g3():
    f = Fig(880, 280, "SSID, BSSID, BSS ve ESS", "SSID kablosuz ağın adıdır. BSSID bir AP radyosunun MAC adresidir. Bir AP ve istemcileri BSS'dir; aynı SSID'yi yayan birden çok AP bir ESS oluşturur ve istemci aralarında dolaşır (roaming).")
    f.zone(30, 30, 820, 200, "ESS · SSID \"SUBE-KURUMSAL\"", "v1")
    f.zone(60, 60, 340, 150, "BSS 1", "v2")
    f.zone(480, 60, 340, 150, "BSS 2", "v3")
    a1 = f.device(230, 110, "ap", "AP-1", "BSSID …:a1")
    a2 = f.device(650, 110, "ap", "AP-2", "BSSID …:b2")
    f.device(230, 180, "laptop", "Laptop", w=100)
    f.arrow(300, 180, 580, 180, "roaming: aynı SSID, başka BSSID", tone="ok")
    f.text(440, 258, "Benzetme: SSID zincir mağazanın adı; BSSID her şubenin kendi adresi", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 290, "Bağımsız AP ve WLC ile yönetilen AP", "Bağımsız (autonomous) AP her şeyi kendi üzerinde yapılandırır. Lightweight AP'ler bir kontrolcüye (WLC) CAPWAP tüneliyle bağlanır; yapılandırma ve kanal/güç ayarı merkezden yapılır.")
    f.zone(20, 30, 340, 240, "Bağımsız", "warn")
    for i in range(3):
        f.device(80 + i * 110, 140, "ap", f"AP{i + 1}", "ayrı ayar", w=96)
    f.text(190, 230, "50 AP = 50 ayrı yapılandırma", size=11, tone="warn")
    f.zone(400, 30, 460, 245, "Merkezi (WLC)", "ok")
    wlc = f.device(630, 80, "wlc", "WLC", "tek yerden yönetim")
    for i in range(3):
        d = f.device(480 + i * 150, 210, "ap", f"LAP{i + 1}", w=96)
        f.link(wlc, d, tone="ok", dash=True)
    f.text(630, 256, "CAPWAP: UDP 5246 kontrol · 5247 veri", size=11, tone="ok", bold=True)
    return f


def g5():
    f = Fig(880, 280, "Güvenlik: WEP'ten WPA3'e", "WEP ve WPA kırılmıştır. WPA2 AES kullanır; WPA3 daha güçlü el sıkışma (SAE) getirir. Personal tek ortak parola, Enterprise kullanıcı başına 802.1X ile RADIUS üzerinden kimlik doğrular.")
    gens = [("WEP", "kırık", "err"), ("WPA (TKIP)", "kırık", "err"), ("WPA2 (AES)", "yaygın", "ok"), ("WPA3 (SAE)", "önerilen", "ok")]
    for i, (t, s, tone) in enumerate(gens):
        x = 24 + i * 214
        f.box(x, 30, 196, 70, t, tone, sub=s, size=14)
        if i < 3:
            f.arrow(x + 196, 65, x + 214, 65)
    f.box(24, 130, 400, 110, "Personal (PSK / SAE)", "v1", sub="herkes aynı parola · ev ve küçük ofis · ayrılan çalışan parolayı bilir", size=14)
    f.box(456, 130, 400, 110, "Enterprise (802.1X)", "v2", sub="kullanıcı başına kimlik · RADIUS · hesap kapatılınca erişim biter", size=14)
    return f


def g6():
    f = Fig(880, 330, "Kanal planı: komşu hücreler farklı kanalda", "Yan yana AP'ler aynı kanaldaysa birbirini bekler (eş kanal girişimi). 2.4 GHz'de 1, 6, 11 dönüşümlü dağıtılır; güç, hücreler biraz örtüşecek kadar ayarlanır.")
    cells = [(180, 90, 1), (400, 90, 6), (620, 90, 11), (290, 210, 11), (510, 210, 1), (730, 210, 6)]
    tones = {1: "v1", 6: "v2", 11: "v3"}
    for x, y, ch in cells:
        f.circle(x, y, 78, tones[ch])
    for x, y, ch in cells:
        f.text(x, y - 4, "AP", size=12, bold=True)
        f.text(x, y + 14, f"kanal {ch}", size=12, bold=True)
    f.text(60, 320, "Benzetme: yan yana sınıflarda aynı anda ders anlatılır; komşu sınıflar farklı ses tonunda olursa birbirini bastırmaz", size=11, tone="m", anchor="start")
    return f


def g7():
    f = Fig(880, 290, "WLC'de bir WLAN tanımlamak", "SSID oluşturulur, kablolu taraftaki VLAN'a (dinamik arayüz) bağlanır, güvenlik seçilir, gerekirse QoS profili atanır ve WLAN etkinleştirilir.")
    steps = [
        ("WLAN oluştur", "Profil adı + SSID"),
        ("Arayüz / VLAN", "SSID → VLAN 20 (dinamik arayüz)"),
        ("Güvenlik", "WPA2/WPA3 · PSK ya da 802.1X + RADIUS"),
        ("QoS", "ses için Platinum, misafir için Bronze"),
        ("Etkinleştir", "Status: Enabled, AP'ler yayına başlar"),
    ]
    for i, (t, s) in enumerate(steps):
        y = 14 + i * 52
        f.badge(36, y + 20, i + 1)
        f.rect(60, y, 220, 40, "soft", r=6)
        f.text(170, y + 25, t, size=13, bold=True)
        f.text(300, y + 25, s, size=12, anchor="start", tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
