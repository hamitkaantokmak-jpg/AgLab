"""SD-Access, VXLAN, LISP ve SD-WAN dersi şemaları (docs/dersler/sdwan-sda.md)."""

from figures import Fig


def g1():
    f = Fig(880, 280, "Alt yapı (underlay) ve üst yapı (overlay)", "Underlay cihazları IP ile birbirine bağlayan fiziksel ağdır. Overlay onun üzerine tünellerle kurulan sanal ağdır; kullanıcılar overlay'i görür, underlay'in ayrıntısını bilmez.")
    f.rect(60, 40, 760, 70, "v1", r=12)
    f.text(440, 70, "Overlay: sanal ağlar (VN), kullanıcı ve uygulama segmentleri", size=14, bold=True)
    f.text(440, 92, "tüneller: VXLAN (kampüs), IPsec (WAN)", size=12, tone="m")
    for x in (200, 440, 680):
        f.line(x, 110, x, 160, "ln", 1.5, dash=True)
    f.rect(60, 160, 760, 70, "v2", r=12)
    f.text(440, 190, "Underlay: fiziksel bağlantılar, IP yönlendirme (IS-IS / OSPF / internet / MPLS)", size=14, bold=True)
    f.text(440, 212, "yalnız uç cihazların (loopback) birbirine ulaşması yeter", size=12, tone="m")
    f.text(440, 262, "Benzetme: karayolu (underlay) ve üzerinde çalışan kargo şirketlerinin güzergâhları (overlay)", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 220, "VXLAN: L2 çerçevesini UDP içinde taşımak", "VXLAN kullanıcının Ethernet çerçevesini VXLAN + UDP + IP başlığıyla sarar (yaklaşık 50 bayt). 24 bitlik VNI ile 16 milyon segment. Sarıp açan uçlara VTEP denir.")
    f.frame(30, 60, [("Dış IP", 120, "v2", "VTEP → VTEP"), ("UDP 4789", 110, "warn", ""), ("VXLAN", 110, "v3", "VNI 24 bit"), ("Özgün Ethernet çerçevesi", 460, "v1", "kullanıcının MAC'leri, VLAN, IP")], h=64, title="VXLAN paketi")
    f.note(30, 160, 820, "Underlay MTU'su en az 1550 olmalı; yoksa büyük çerçeveler bölünür ya da düşer. VLAN 4094 ile sınırlıyken VNI 16 milyondur.", tone="warn", size=12)
    return f


def g3():
    f = Fig(880, 290, "LISP: kim (EID) ile nerede (RLOC) ayrımı", "Bir cihazın kimliği (EID, ör. 10.1.5.20) ile bulunduğu yer (RLOC, bağlı olduğu switch'in loopback'i) ayrı tutulur. Eşleme sunucusu 'bu EID şu RLOC'ta' bilgisini verir; cihaz yer değiştirince yalnız eşleme güncellenir.")
    ms = f.device(440, 50, "server", "Map Server / Resolver", w=200)
    a = f.device(160, 200, "l3switch", "Edge-1", "RLOC 10.255.0.1", w=150)
    b = f.device(720, 200, "l3switch", "Edge-2", "RLOC 10.255.0.2", w=150)
    f.arrow(220, 175, 380, 80, "1: 10.1.5.20 nerede?", tone="v1")
    f.arrow(500, 80, 660, 175, "kayıt: 10.1.5.20 bende", tone="v2", above=False)
    f.arrow(220, 230, 660, 230, "2: tünel Edge-2'ye", tone="ok")
    f.text(440, 280, "Benzetme: cep telefonu numarası (EID) değişmez; operatör (map server) hangi baz istasyonunda (RLOC) olduğunu bilir", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 300, "SD-Access: üç düzlem ve roller", "Kontrol düzlemi LISP (kim nerede), veri düzlemi VXLAN (taşıma), politika düzlemi Cisco TrustSec (SGT ile grup tabanlı erişim). Catalyst Center tasarım, kurulum ve izlemeyi otomatikleştirir.")
    f.box(330, 14, 220, 50, "Catalyst Center", "accent", sub="otomasyon + izleme", size=13)
    cp = f.device(140, 110, "server", "Control Plane node", "LISP map server", w=170)
    bd = f.device(740, 110, "l3switch", "Border node", "dış ağlara çıkış", w=160)
    e1 = f.device(300, 230, "l3switch", "Edge node", "kullanıcılar burada", w=150)
    e2 = f.device(580, 230, "l3switch", "Edge node", w=150)
    f.link(e1, bd, tone="v2", dash=True)
    f.link(e2, bd, tone="v2", dash=True)
    f.link(e1, cp, tone="v1", dash=True)
    f.text(440, 290, "Underlay: IS-IS ile L3 (yönlendirilmiş erişim) · Overlay: VXLAN · Politika: SGT", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 270, "Makro ve mikro segmentasyon", "Sanal ağ (VN, aslında bir VRF) grupları tamamen ayırır: misafir ve personel birbirini hiç görmez. Aynı VN içinde SGT'ler kimin kimle konuşabileceğini belirler: kamera, yazıcıyla konuşamaz.")
    f.zone(20, 30, 520, 200, "VN PERSONEL (makro)", "v1")
    f.box(40, 70, 150, 60, "SGT Çalışan", "v3", size=12)
    f.box(210, 70, 150, 60, "SGT Yazıcı", "v3", size=12)
    f.box(380, 70, 140, 60, "SGT Kamera", "v3", size=12)
    f.text(280, 170, "Kamera → Yazıcı: DENY (mikro)", size=12, tone="err", bold=True)
    f.zone(580, 30, 280, 200, "VN MISAFIR", "v2")
    f.text(720, 130, "personeli hiç görmez", size=12, tone="m")
    f.text(440, 256, "Politika IP'ye değil gruba bağlı: kullanıcı nereden bağlanırsa bağlansın aynı kural", size=12, tone="accent", bold=True)
    return f


def g6():
    f = Fig(880, 310, "SD-WAN bileşenleri", "Manager (vManage) yönetim ve izleme, Controller (vSmart) rota ve politika dağıtımı (OMP), Validator (vBond) ilk kimlik doğrulama ve yönlendirme, WAN Edge şubedeki router'dır. Edge'ler arası veri IPsec tünelleriyle akar.")
    f.box(40, 20, 240, 60, "Manager (vManage)", "v1", sub="GUI, şablon, izleme", size=13)
    f.box(320, 20, 240, 60, "Controller (vSmart)", "v2", sub="OMP: rota ve politika", size=13)
    f.box(600, 20, 240, 60, "Validator (vBond)", "v3", sub="kimlik, NAT geçişi", size=13)
    a = f.device(200, 220, "router", "WAN Edge · Şube A", w=170)
    b = f.device(680, 220, "router", "WAN Edge · Şube B", w=170)
    f.line(270, 200, 610, 200, "ok", 2.5)
    f.line(270, 240, 610, 240, "accent", 2.5, dash=True)
    f.text(440, 192, "IPsec · internet", size=12, tone="ok", bold=True)
    f.text(440, 262, "IPsec · MPLS / LTE", size=12, tone="accent", bold=True)
    f.arrow(440, 80, 260, 190, tone="v2")
    f.arrow(440, 80, 620, 190, tone="v2")
    return f


def g7():
    f = Fig(880, 270, "Uygulama farkındalıklı yönlendirme", "SD-WAN her tünelin gecikme, kayıp ve titreşimini sürekli ölçer (BFD). Politika 'ses: gecikme < 150 ms, kayıp < %1' derse ses trafiği şartı sağlayan bağlantıya kaydırılır.")
    f.table(30, 20, ["Bağlantı", "Gecikme", "Kayıp", "Ses SLA'sı"], [
        ["İnternet", "180 ms", "%2,5", "SAĞLAMIYOR"],
        ["MPLS", "40 ms", "%0,1", "sağlıyor → ses buradan"],
        ["LTE", "90 ms", "%0,8", "yedek"],
    ], [200, 160, 160, 300], tones={0: "err", 1: "ok"})
    f.text(440, 160, "Benzetme: navigasyonun trafik yoğunluğunu görüp ambulansı en hızlı yola, kargoyu ucuz yola göndermesi", size=12, tone="m")
    f.note(30, 190, 820, "Transport bağımsızlığı: internet, MPLS ve LTE aynı yönetimle, aynı politikayla birlikte kullanılır; pahalı hatlar yalnız gereken trafiğe ayrılır.", tone="accent", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
