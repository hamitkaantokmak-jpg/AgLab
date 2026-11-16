"""Kurumsal kablosuz dersi şemaları (docs/dersler/kablosuz-ileri.md)."""

from figures import Fig


def g1():
    f = Fig(880, 280, "Kurumsal kablosuz mimari", "AP'ler istemcilere radyo ile hizmet verir; yönetim ve çoğu zaman trafik CAPWAP tüneliyle denetleyiciye (WLC) gider. WLC kimlik doğrulama için RADIUS'a, istemci adresleri için DHCP'ye dayanır.")
    c = f.device(90, 200, "laptop", "İstemci")
    ap = f.device(280, 200, "ap", "AP", "local / FlexConnect")
    sw = f.device(470, 200, "switch", "Erişim switch'i", w=170)
    wlc = f.device(700, 90, "wlc", "WLC", "CAPWAP 5246/5247", tone="accent", w=180)
    rad = f.device(700, 210, "server", "RADIUS · DHCP", w=180)
    f.link(c, ap, label="RF", tone="v3", dash=True)
    f.link(ap, sw)
    f.link(sw, wlc, label="CAPWAP", tone="v1")
    f.link(wlc, rad, tone="v2")
    f.text(280, 70, "Üç katman:", size=13, bold=True)
    f.text(280, 92, "RF → kimlik doğrulama → IP", size=13, tone="accent", bold=True)
    return f


def g2():
    f = Fig(880, 280, "dB ve dBm", "dB iki güç arasındaki orandır, dBm ise 1 mW'a göre mutlak güçtür. Logaritmik ölçek sayesinde kazançlar ve kayıplar toplanıp çıkarılarak hesaplanır.")
    f.table(30, 20, ["mW", "dBm"], [["1", "0"], ["2", "3"], ["10", "10"], ["100", "20"]], [140, 140])
    f.table(340, 20, ["Değişim", "dB"], [["iki katı", "+3"], ["yarısı", "−3"], ["on katı", "+10"], ["onda biri", "−10"]], [160, 100])
    f.box(640, 20, 210, 140, "EIRP", "accent", sub="Tx + anten − kablo", size=16)
    f.text(440, 200, "20 dBm + 4 dBi − 2 dB = 22 dBm EIRP → havada −80 dB → −58 dBm", size=12, mono=True, bold=True)
    f.text(440, 230, "SNR = −58 − (−92) = 34 dB (ses/video için ≥ 25 dB)", size=12, mono=True, tone="ok", bold=True)
    f.text(440, 262, "Benzetme: sesin 'iki kat yüksek' olması ve 'şu kadar desibel' olması", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 250, "Antenler: kazanç enerjiyi toplar", "Omni anten her yöne yayın yapar, kazancı düşüktür. Yönlü anten enerjiyi dar bir demete toplar; kazanç yüksektir ama arkası ve yanları zayıftır. Kazanç enerji yaratmaz, yönlendirir.")
    f.circle(220, 115, 70, "v1")
    f.text(220, 120, "Omni · 2–6 dBi", size=13, bold=True)
    f.path("M 520 115 L 820 55 Q 860 115 820 175 Z", tone="v3", width=2)
    f.circle(520, 115, 14, "accent")
    f.text(700, 120, "Yönlü · 8–14+ dBi", size=13, bold=True)
    f.text(220, 215, "açık ofis, koridor ortası", size=12, tone="m")
    f.text(680, 215, "uzun koridor, depo, binalar arası", size=12, tone="m")
    f.text(440, 240, "Yüksek kazançlı anten yasal EIRP sınırını aşabilir", size=12, tone="warn", bold=True)
    return f


def g4():
    f = Fig(880, 250, "AP modları", "Aynı donanım farklı görevlere atanabilir. Local mod varsayılandır; FlexConnect şubeler için, monitor ve sniffer hizmet vermeden izlemek için, bridge kablosuz omurga için kullanılır.")
    modes = [("Local", "hizmet + tarama · trafik WLC'ye", "v1"), ("FlexConnect", "şube · yerel anahtarlama", "v2"), ("Monitor", "yalnız tarama · IDS · konum", "warn"), ("Sniffer", "paket yakalama", "v3"), ("Bridge", "AP'ler arası omurga", "v4")]
    for i, (t, s, tone) in enumerate(modes):
        x = 20 + i * 172
        f.box(x, 40, 152, 100, t, tone, sub=s, size=14)
    f.text(440, 180, "WLC modelleri: merkezi · FlexConnect · gömülü (switch içinde) · bulut", size=12, tone="accent", bold=True)
    f.text(440, 215, "Benzetme: aynı çalışanın resepsiyonda, şubede, güvenlik kamerasında ya da kurye olarak görevlendirilmesi", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 260, "AP'nin denetleyiciye katılması", "AP önce IP adresi alır, sonra WLC'yi keşfeder, seçer, DTLS ile şifreli kontrol kanalı kurar ve gerekirse yeni yazılımı indirip yeniden başlar. Takıldığı adım nedeni söyler.")
    steps = [("1. IP", "DHCP / statik"), ("2. Keşif", "yayın · option 43 · DNS"), ("3. Seçim", "birincil / en az yük"), ("4. Katılım", "DTLS · UDP 5246"), ("5. İmaj + ayar", "indir · yeniden başla")]
    for i, (t, s) in enumerate(steps):
        x = 20 + i * 172
        f.box(x, 40, 152, 90, t, "accent" if i % 2 == 0 else "v2", sub=s, size=13)
        if i < len(steps) - 1:
            f.arrow(x + 152, 85, x + 172, 85)
    f.text(440, 170, "DNS adı: CISCO-CAPWAP-CONTROLLER.<alan adı>", size=12, mono=True, bold=True)
    f.text(440, 200, "Takıldığı yer: keşif → option 43/DNS · katılım → portlar, saat (sertifika)", size=12, tone="warn", bold=True)
    f.text(440, 232, "Benzetme: yeni çalışanın önce adres alması, sonra müdürü bulması, kimliğini göstermesi, sonra talimatları alması", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 300, "Dolaşım: istemci IP'sini nasıl korur?", "Aynı WLC'de dolaşım yalnız AP değiştirir. Farklı WLC ve farklı alt ağda istemci eski IP'sini korur: ilk WLC anchor olur, yeni WLC (foreign) trafiği mobility tüneliyle anchor'a taşır.")
    f.zone(20, 40, 400, 190, "Bina A · VLAN 30 · 10.30.0.0/24", "v1")
    f.zone(460, 40, 400, 190, "Bina B · VLAN 40 · 10.40.0.0/24", "v2")
    w1 = f.device(260, 110, "wlc", "WLC-A", "anchor", tone="accent")
    w2 = f.device(620, 110, "wlc", "WLC-B", "foreign")
    a1 = f.device(120, 190, "ap", "AP-A")
    a2 = f.device(760, 190, "ap", "AP-B")
    f.link(w1, w2, label="mobility tüneli", tone="v4", dash=True)
    f.link(w1, a1)
    f.link(w2, a2)
    f.arrow(180, 200, 700, 200, label="istemci yürür · IP 10.30.0.57 kalır", tone="accent", width=2.5)
    f.text(440, 265, "Gerekenler: aynı mobility group, tünel portları açık · ses için 802.11r", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 230, "İstemci bağlanamıyor: üç katman", "Önce istemci yeterli sinyal ve SNR ile AP'yi duyuyor mu, sonra ilişkilenme ve kimlik doğrulama başarılı mı, sonra IP adresi, geçit ve DNS alıyor mu?")
    layers = [("RF", "RSSI · SNR · kanal kullanımı", "v3"), ("Kimlik doğrulama", "Associated → Authenticating", "v1"), ("IP", "IP Learn → Run", "v2")]
    for i, (t, s, tone) in enumerate(layers):
        x = 30 + i * 280
        f.box(x, 40, 260, 100, t, tone, sub=s, size=15)
        if i < 2:
            f.arrow(x + 260, 90, x + 280, 90)
    f.text(440, 180, "show wireless client mac-address <mac> detail → Policy Manager State", size=12, mono=True, bold=True)
    f.text(440, 210, "'Run' görmeden IP katmanına bakmak boşuna", size=12, tone="accent", bold=True)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
