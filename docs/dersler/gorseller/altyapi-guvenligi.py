"""Altyapı güvenliği (802.1X, CoPP, ACL) dersi şemaları (docs/dersler/altyapi-guvenligi.md)."""

from figures import Fig


def g1():
    f = Fig(880, 255, "802.1X: üç rol", "Supplicant (kullanıcı cihazı) kimliğini sunar, authenticator (switch ya da WLC) aracılık eder, authentication server (RADIUS, ör. ISE) karar verir. Karar gelene kadar port yalnız EAP trafiğini geçirir.")
    pc = f.device(130, 130, "laptop", "Supplicant", "dizüstü", w=150)
    sw = f.device(440, 130, "switch", "Authenticator", "erişim switch'i", w=160)
    srv = f.device(750, 130, "server", "Auth server", "RADIUS / ISE", w=150)
    f.arrow(205, 110, 360, 110, "EAPoL", tone="v1")
    f.arrow(520, 110, 675, 110, "RADIUS (EAP içinde)", tone="v2")
    f.text(440, 230, "Benzetme: kapıdaki görevli (switch) kimliği kendisi kontrol etmez; merkeze sorar, merkez \"girebilir\" derse kapıyı açar", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 230, "Port durumu: önce kimlik, sonra trafik", "Doğrulanmamış port yalnız EAPoL'e izin verir (CDP/LLDP gibi bazıları hariç). RADIUS Access-Accept gelince port açılır; sunucu VLAN ve ACL de atayabilir.")
    st = [("Bağlandı", "soft"), ("EAP kimlik", "v1"), ("RADIUS sorgu", "v2"), ("Accept / Reject", "warn"), ("Port açık + VLAN/dACL", "ok")]
    for i, (s, t) in enumerate(st):
        x = 20 + i * 172
        f.box(x, 40, 156, 70, s, t, size=13)
        if i < 4:
            f.arrow(x + 156, 75, x + 172, 75)
    f.note(20, 150, 840, "Reject ya da yanıt yok: port kapalı kalır ya da (yapılandırılmışsa) misafir/kısıtlı VLAN'a alınır. Sunucuya ulaşılamazsa critical VLAN ile kullanıcılar çalışmaya devam edebilir.", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 270, "802.1X yapamayan cihazlar: MAB ve WebAuth", "Yazıcı, kamera, IP telefon gibi supplicant'ı olmayan cihazlar MAC adresiyle doğrulanır (MAB). Misafirler web sayfasından kimlik girer (WebAuth). Sıra: önce 802.1X dene, olmazsa MAB.")
    f.box(30, 30, 260, 150, "802.1X", "ok", sub="kullanıcı/sertifika · en güçlü", size=16)
    f.box(310, 30, 260, 150, "MAB", "warn", sub="MAC adresi kimlik · taklit edilebilir, profilleme ile güçlenir", size=16)
    f.box(590, 30, 260, 150, "WebAuth", "v1", sub="tarayıcı ile kullanıcı adı/parola · misafir", size=16)
    f.text(440, 220, "authentication order dot1x mab · authentication priority dot1x mab", size=12, mono=True, bold=True)
    f.text(440, 250, "Benzetme: personel kartıyla girer, kargo görevlisi plakasıyla, misafir resepsiyonda kayıt yaptırarak", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 270, "Kontrol düzlemi saldırıya açıktır", "Router'ın CPU'su yönlendirme protokollerini, SSH'ı, SNMP'yi ve CPU'ya gelen paketleri işler. Bir ping seli ya da ARP taraması CPU'yu doldurursa OSPF/BGP komşulukları düşer: ağ veri trafiği yüzünden değil, kontrol düzlemi boğulduğu için çöker.")
    f.device(160, 130, "laptop", "Saldırgan / döngü", "saniyede 50.000 ping", tone="err", w=200)
    f.box(440, 70, 200, 120, "CPU %100", "err", sub="OSPF Hello işlenemiyor", size=16)
    f.device(780, 130, "router", "Komşu", "Dead timer doldu", tone="warn", w=150)
    f.arrow(260, 130, 440, 130, tone="err", width=3)
    f.arrow(640, 130, 705, 130, tone="warn", dash=True)
    f.text(440, 240, "Benzetme: santral operatörüne gelen sahte çağrılar yüzünden gerçek acil çağrıların açılamaması", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 285, "CoPP: CPU'ya giden trafiğe hız sınırı", "Control Plane Policing, CPU'ya giden trafiği sınıflara ayırır ve her sınıfa bir sınır (policer) koyar: yönlendirme protokolleri bol, yönetim orta, ICMP az, gerisi en az.")
    f.table(30, 20, ["Sınıf", "Örnek", "Politika"], [
        ["Kritik", "OSPF, BGP, HSRP", "yüksek sınır ya da sınırsız"],
        ["Yönetim", "SSH, SNMP, NTP (yalnız yönetim ağından)", "orta sınır"],
        ["Normal", "ICMP echo", "düşük sınır (ör. 100 pps)"],
        ["Varsayılan", "geri kalan her şey", "en düşük"],
    ], [180, 380, 260], tones={0: "ok", 1: "v1", 2: "warn", 3: "soft"})
    f.text(440, 182, "control-plane → service-policy input COPP", size=13, mono=True, bold=True)
    f.note(30, 202, 820, "Dikkat: sınıflandırmada bir yönlendirme protokolünü unutmak onu varsayılan sınıfa (en düşük sınır) düşürür; CoPP'yi açınca komşulukların düşmesi en sık hatadır. Önce yalnız izle (transmit), sayaçlara bak, sonra sınırla.", tone="warn", size=12)
    return f


def g6():
    f = Fig(880, 270, "Altyapı ACL'si: router'ın kendisini koru", "Ağın kenarında, dışarıdan gelen ve doğrudan altyapı adreslerine (router loopback'leri, yönetim ağı) yönelen trafik engellenir; yalnız gerekli protokollere (ör. komşu BGP, IPsec) izin verilir. Geçen kullanıcı trafiği etkilenmez.")
    f.device(130, 120, "cloud", "İnternet", w=140)
    f.device(440, 120, "router", "Kenar router", "iACL girişte", w=150)
    f.device(750, 120, "switch", "İç ağ", w=130)
    f.line(200, 120, 365, 120, "ln", 2)
    f.line(515, 120, 685, 120, "ln", 2)
    f.note(30, 190, 400, "Engelle: dışarıdan → 10.255.0.0/16 (altyapı), yönetim portları, sahte iç kaynaklı paketler", tone="err", size=12)
    f.note(450, 190, 400, "İzin ver: ISP komşusundan BGP (TCP 179), IPsec (UDP 500/4500, ESP), kullanıcı trafiği", tone="ok", size=12)
    return f


def g7():
    f = Fig(880, 260, "Katmanlı savunma", "Tek bir önlem yeterli değildir: her katman bir öncekinin kaçırdığını yakalar.")
    layers = [("Fiziksel", "kilitli dolap, kullanılmayan portlar shutdown", "soft"), ("Erişim", "802.1X/MAB, port security, DHCP snooping, DAI", "v1"), ("Cihaz", "SSH, AAA, vty ACL, güçlü parola (Konu #22)", "v2"), ("Kontrol düzlemi", "CoPP, routing kimlik doğrulama", "v3"), ("Kenar", "altyapı ACL'si, uRPF, güvenlik duvarı", "warn")]
    for i, (t, s, tone) in enumerate(layers):
        y = 14 + i * 46
        f.rect(30 + i * 12, y, 820 - i * 24, 40, tone, r=8)
        f.text(50 + i * 12, y + 25, t, size=13, bold=True, anchor="start")
        f.text(260, y + 25, s, size=12, anchor="start", tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
