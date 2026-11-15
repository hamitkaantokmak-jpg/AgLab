"""Ağ servisleri (NTP, Syslog, SNMP) dersi şemaları (docs/dersler/ag-servisleri.md)."""

from figures import Fig


def g1():
    f = Fig(880, 270, "Saatler farklıysa olayların sırası kaybolur", "Üç cihazın kayıtları aynı olayı anlatıyor ama saatleri farklı. Hangisinin önce olduğunu söylemek imkânsızlaşır. NTP bütün saatleri aynı kaynağa bağlar.")
    f.table(30, 20, ["Cihaz", "Saati", "Kayıt"], [
        ["SW-KAT1", "09:14:02", "Gi0/1 down"],
        ["SW-CORE", "11:47:55", "Gi0/2 down"],
        ["R1", "*Mar 1 00:03:11", "OSPF komşu düştü"],
    ], [180, 220, 420], tones={2: "err"}, mono_cols=(1,))
    f.note(30, 150, 820, "Hangisi önce oldu? Kablo mu koptu, router mı yeniden başladı? Saatler eşit değilse bu soru cevapsız kalır. \"*Mar 1 00:0…\" saati hiç ayarlanmamış cihazın izidir.", tone="warn", size=12)
    f.text(440, 238, "Benzetme: üç tanık farklı saat takıyorsa kazanın nasıl olduğunu kimse sıralayamaz", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 300, "NTP hiyerarşisi: stratum", "Stratum 0 atom saati ya da GPS'tir. Ona doğrudan bağlı sunucu stratum 1, ondan alan stratum 2 olur. Sayı büyüdükçe kaynaktan uzaklaşılır; 16 senkron değil demektir.")
    s0 = f.box(350, 14, 180, 46, "Stratum 0 · GPS / atom", "accent", size=12)
    s1 = f.device(440, 110, "server", "Stratum 1", "kamu NTP sunucusu", w=170)
    r1 = f.device(440, 200, "router", "R1 · stratum 2", "ntp server …", w=170)
    a = f.device(200, 270, "switch", "SW1 · stratum 3", w=150)
    b = f.device(680, 270, "switch", "SW2 · stratum 3", w=150)
    f.arrow(440, 60, 440, 78)
    f.link(s1, r1, tone="accent")
    f.link(r1, a)
    f.link(r1, b)
    f.note(20, 90, 250, "Benzetme: saatini radyodaki saat ayarından alan saatçi, diğer herkes saatçiden", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 260, "NTP'yi kurmak ve doğrulamak", "Router dışarıdaki bir NTP sunucusundan saat alır; şubedeki switch'ler router'dan alır. show ntp status 'synchronized' demelidir.")
    rows = [
        ("R1(config)#ntp server 203.0.113.123", "dışarıdan saat al"),
        ("SW1(config)#ntp server 192.168.99.1", "router'dan saat al"),
        ("R1(config)#clock timezone TRT 3", "yerel saat dilimi"),
        ("show ntp status", "Clock is synchronized, stratum 2"),
        ("show ntp associations", "* ile işaretli: seçilen kaynak"),
    ]
    for i, (cmd, why) in enumerate(rows):
        y = 14 + i * 44
        f.rect(30, y, 470, 36, "soft" if i < 3 else "ok", r=6)
        f.text(42, y + 23, cmd, size=12, mono=True, anchor="start", bold=True)
        f.text(520, y + 23, why, size=12, anchor="start", tone="m")
    return f


def g4():
    f = Fig(880, 330, "Syslog önem seviyeleri", "0 en acil, 7 en ayrıntılı. Bir seviye seçildiğinde o seviye ve ondan acil olanların hepsi gönderilir: logging trap 4 → 0–4.")
    rows = [
        ["0", "Emergency", "sistem kullanılamaz"],
        ["1", "Alert", "hemen müdahale"],
        ["2", "Critical", "kritik durum"],
        ["3", "Error", "hata"],
        ["4", "Warning", "uyarı"],
        ["5", "Notification", "olağan ama önemli (ör. arayüz up/down)"],
        ["6", "Informational", "bilgi"],
        ["7", "Debugging", "debug çıktısı"],
    ]
    f.table(30, 14, ["Seviye", "Ad", "Anlam"], rows, [110, 200, 510], tones={0: "err", 1: "err", 2: "err", 3: "warn", 4: "warn"}, mono_cols=(0,), row_h=30)
    f.text(440, 304, "Ezber cümlesi: \"Every Awesome Cisco Engineer Will Need Ice cream Daily\" (E-A-C-E-W-N-I-D)", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 320, "Kayıtlar nereye gider?", "Konsol, terminal oturumu, cihazın belleği (buffer) ve uzak syslog sunucusu ayrı ayrı ayarlanır. Cihaz yeniden başlarsa bellekteki kayıtlar gider; sunucudakiler kalır.")
    f.device(130, 110, "router", "R1", "kayıt üretir")
    dests = [("Konsol", "logging console 5", 20), ("Bellek", "logging buffered 6", 90), ("SSH oturumu", "terminal monitor", 160)]
    for name, cmd, y in dests:
        f.box(380, y, 200, 50, name, "soft", sub=cmd, size=12)
        f.arrow(180, 110, 380, y + 25, tone="ln")
    f.device(760, 250, "server", "Syslog sunucusu", "UDP 514", w=160)
    f.path("M 130 142 L 130 250 L 680 250", tone="ok", width=2.5, arrow=True)
    f.text(400, 240, "logging host 192.168.99.60 · logging trap 5", size=11, mono=True)
    f.text(440, 300, "Bir kayıt: %LINK-3-UPDOWN: Interface Gi0/1, changed state to down  (tesis-seviye-anahtar: metin)", size=11, tone="m")
    return f


def g6():
    f = Fig(880, 300, "SNMP: yönetici ve ajanlar", "Yönetici (NMS) ajanlardan değer okur (get), değer yazar (set). Ajan önemli bir olay olunca kendiliğinden haber verir (trap / inform). Değerler MIB'de, OID'lerle adlandırılır.")
    nms = f.device(150, 140, "server", "NMS", "izleme sunucusu")
    sw = f.device(700, 70, "switch", "SW1", "ajan · MIB")
    r1 = f.device(700, 210, "router", "R1", "ajan · MIB")
    f.arrow(210, 125, 640, 75, tone="v1")
    f.text(470, 80, "get / set → UDP 161", size=12, tone="v1", bold=True)
    f.arrow(640, 210, 210, 165, tone="warn")
    f.text(450, 218, "trap / inform → UDP 162", size=12, tone="warn", bold=True)
    f.note(260, 240, 330, "OID örneği: arayüz giriş sayacı 1.3.6.1.2.1.2.2.1.10", tone="accent", size=11)
    f.note(20, 20, 260, "Benzetme: müdür (NMS) şubeleri arayıp rapor ister; şube acil bir durumda kendisi arar (trap).", tone="accent", size=12)
    return f


def g7():
    f = Fig(880, 250, "SNMP sürümleri", "v1 ve v2c düz metin topluluk adıyla çalışır; topluluk adı bir parola gibi ama ağda açık gider. v3 kullanıcı, kimlik doğrulama ve şifreleme ekler.")
    f.table(30, 20, ["Sürüm", "Kimlik", "Şifreleme", "Not"], [
        ["v1", "topluluk adı (düz)", "yok", "eski"],
        ["v2c", "topluluk adı (düz)", "yok", "toplu okuma (getbulk), inform"],
        ["v3", "kullanıcı + kimlik doğrulama", "var (priv)", "authPriv önerilir"],
    ], [110, 280, 160, 270], tones={2: "ok"})
    f.note(30, 150, 820, "public / private gibi varsayılan topluluk adları ve RW (yazma) yetkisi en sık güvenlik açığıdır. Okuma yeterliyse yalnız RO; ACL ile yalnız NMS'e izin ver.", tone="warn", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
