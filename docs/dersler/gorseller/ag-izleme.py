"""Ağ izleme dersi şemaları (docs/dersler/ag-izleme.md)."""

from figures import Fig


def g1():
    f = Fig(880, 215, "Hangi soruya hangi araç?", "Her izleme aracı başka bir soruyu cevaplar. Doğru aracı seçmek, gereksiz veri yığınından kurtarır.")
    f.table(30, 20, ["Soru", "Araç"], [
        ["Hat şu an iyi mi? Gecikme, kayıp?", "IP SLA"],
        ["Bu iki cihaz arasında tam olarak hangi paketler gidiyor?", "SPAN / RSPAN / ERSPAN + yakalama"],
        ["Kim, kiminle, ne kadar konuşuyor?", "NetFlow / Flexible NetFlow"],
        ["Cihaz içinde ne oluyor, neden?", "debug (koşullu), syslog"],
        ["Sayaçları sürekli ve hızlı görmek", "Model tabanlı telemetri (push)"],
    ], [500, 320])
    return f


def g2():
    f = Fig(880, 290, "IP SLA: sürekli deneme", "Router belirli aralıklarla sentetik test trafiği üretir (ICMP echo, UDP jitter, HTTP) ve sonucu kaydeder. track ile birleşince bir statik rota ya da HSRP önceliği hat kalitesine bağlanabilir.")
    r = f.device(140, 120, "router", "R1", "IP SLA 10")
    t = f.device(740, 120, "server", "8.8.8.8 / merkez", w=170)
    f.arrow(200, 100, 660, 100, "her 10 sn: icmp-echo", tone="v1")
    f.arrow(660, 140, 200, 140, "yanıt: RTT, kayıp", tone="ok", above=False)
    f.note(30, 200, 820, "ip sla 10 → icmp-echo 8.8.8.8 source-interface g0/1 → frequency 10 · ip sla schedule 10 start-time now life forever · track 1 ip sla 10 reachability · ip route 0.0.0.0 0.0.0.0 203.0.113.1 track 1", tone="accent", size=11)
    return f


def g3():
    f = Fig(880, 300, "SPAN: trafiğin kopyasını çıkarmak", "SPAN bir porttan ya da VLAN'dan geçen trafiğin kopyasını analiz bilgisayarının bağlı olduğu porta gönderir. RSPAN kopyayı özel bir VLAN ile başka switch'e, ERSPAN GRE ile başka bir ağa taşır.")
    sw = f.device(440, 80, "switch", "SW1", "monitor session 1")
    srv = f.device(180, 220, "server", "Sunucu", "Gi1/0/1 (kaynak)")
    pc = f.device(700, 220, "laptop", "Wireshark", "Gi1/0/24 (hedef)", w=150)
    f.link(sw, srv, tone="v1")
    f.link(sw, pc, "kopya", tone="ok", dash=True)
    f.note(20, 20, 280, "Benzetme: güvenlik kamerasının kaydı; olayı durdurmaz, yalnız izler", tone="accent", size=12)
    f.note(600, 20, 270, "Hedef port normal trafik taşımaz; kopya fazla gelirse kayıp olur", tone="warn", size=12)
    return f


def g4():
    f = Fig(880, 245, "NetFlow: kim kiminle ne kadar?", "Router her akışı (kaynak/hedef IP, port, protokol, arayüz, ToS) bir kayıt olarak tutar ve süre dolunca bir toplayıcıya gönderir. Paketin içeriğini değil, konuşmanın özetini verir.")
    f.table(30, 20, ["Kaynak", "Hedef", "Prot/Port", "Bayt", "Paket"], [
        ["10.1.5.20", "10.2.0.50", "TCP/445", "4,2 GB", "3,1 M"],
        ["10.1.7.11", "142.250.x.x", "TCP/443", "180 MB", "140 K"],
        ["10.1.5.33", "10.2.0.9", "UDP/16384", "12 MB", "60 K"],
    ], [160, 160, 160, 160, 160], tones={0: "warn"}, mono_cols=(0, 1, 2))
    f.text(440, 150, "→ WAN'ı dolduran: 10.1.5.20'den dosya sunucusuna SMB yedeklemesi", size=12, tone="err", bold=True)
    f.text(440, 186, "Benzetme: telefon faturasının arama dökümü; konuşmaların içeriğini değil, kim kimi ne kadar aradı", size=12, tone="m")
    f.text(440, 220, "Flexible NetFlow: flow record (anahtar alanlar) → flow exporter (toplayıcı) → flow monitor (arayüze)", size=12, tone="accent", bold=True)
    return f


def g5():
    f = Fig(880, 230, "debug: güçlü ama tehlikeli", "debug CPU'da çalışır ve yoğun bir cihazı kilitleyebilir. Koşullu debug (debug condition) çıktıyı tek bir arayüze ya da komşuya daraltır. İş bitince undebug all.")
    steps = [("logging buffered", "çıktı belleğe"), ("no logging console", "konsol boğulmasın"), ("debug condition …", "yalnız ilgili komşu"), ("debug ip ospf adj", "kısa süre"), ("undebug all", "hemen kapat")]
    for i, (c, s) in enumerate(steps):
        x = 20 + i * 172
        f.box(x, 40, 156, 80, c, "soft" if i < 4 else "ok", sub=s, size=12)
        if i < 4:
            f.arrow(x + 156, 80, x + 172, 80)
    f.text(440, 170, "Benzetme: ameliyat sırasında her sinire sonda takmak; gerektiği kadar, kısa süre", size=12, tone="m")
    f.text(440, 206, "Önce show, sonra gerekirse koşullu debug", size=12, tone="accent", bold=True)
    return f


def g6():
    f = Fig(880, 270, "SNMP sorgusu ve model tabanlı telemetri", "SNMP'de yönetici dakikada bir sorar (pull). Telemetride cihaz kendisi, abone olunan verileri saniyeler içinde gönderir (push); veri YANG modelleriyle yapılandırılmıştır.")
    f.box(30, 30, 390, 150, "SNMP (pull)", "warn", sub="NMS 5 dakikada bir sorar · kısa sıçramalar kaybolur · MIB", size=15)
    f.box(460, 30, 390, 150, "Telemetri (push)", "ok", sub="cihaz periyodik ya da değişince gönderir · YANG · gRPC/NETCONF", size=15)
    f.text(440, 220, "Benzetme: müdürün her saat başı arayıp sorması ile şubenin canlı yayın açması", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 240, "Telemetri abonelik türleri", "Periyodik abonelik veriyi sabit aralıkla gönderir (sayaçlar için). Değişiklikte (on-change) abonelik yalnız değer değişince gönderir (arayüz durumu, komşu durumu için).")
    f.box(30, 30, 390, 140, "Periyodik", "v1", sub="ör. arayüz sayaçları her 10 sn", size=15)
    f.box(460, 30, 390, 140, "Değişiklikte (on-change)", "v2", sub="ör. OSPF komşusu düştü / kalktı", size=15)
    f.text(440, 210, "Dial-in: toplayıcı bağlanıp abone olur · Dial-out: cihaz toplayıcıya bağlanır (yapılandırmada)", size=12, tone="accent", bold=True)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
