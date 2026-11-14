"""FHRP dersi şemaları (docs/dersler/fhrp.md)."""

from figures import Fig


def _lan(f, y_r=70, a_tone="ok", b_tone="card", a_sub="Active · 110", b_sub="Standby · 100", a_down=False):
    r1 = f.device(260, y_r, "router", "R1", a_sub, tone="err" if a_down else a_tone)
    r2 = f.device(620, y_r, "router", "R2", b_sub, tone=b_tone)
    sw = f.device(440, y_r + 110, "switch", "SW")
    pc = f.device(440, y_r + 210, "pc", "PC-11", "gw 192.168.10.1")
    f.link(r1, sw, la=".2", tone="err" if a_down else "ok", dash=a_down)
    f.link(r2, sw, la=".3", tone="ok" if a_down else "ln")
    f.link(sw, pc)
    return r1, r2, sw, pc


def g1():
    f = Fig(880, 300, "Tek gateway, tek hata noktası", "PC'nin gateway'i tek bir router'ın adresiyse o router kapanınca, yanında yedek router dursa bile PC dışarı çıkamaz.")
    r1 = f.device(260, 60, "router", "R1", "192.168.10.1 · KAPALI", tone="err")
    r2 = f.device(620, 60, "router", "R2", "192.168.10.3 · boşta")
    sw = f.device(440, 170, "switch", "SW")
    pc = f.device(440, 260, "pc", "PC-11", "gw 192.168.10.1")
    f.link(r1, sw, tone="err", dash=True, blocked=True)
    f.link(r2, sw)
    f.link(sw, pc)
    f.note(20, 130, 250, "Benzetme: binanın tek kapısı kilitlenmiş; arka kapı var ama kimse yerini bilmiyor.", tone="warn", size=12)
    return f


def g2():
    f = Fig(880, 330, "Sanal gateway: iki router, tek adres", "R1 ve R2 gerçek adresleriyle durur ve sanal IP'yi (192.168.10.1) paylaşır. PC'lerin gateway'i sanal IP'dir; ARP yanıtı sanal MAC'tir.")
    _lan(f)
    f.rect(330, 20, 220, 50, "accent", r=25, dash=True)
    f.text(440, 42, "Sanal IP 192.168.10.1", size=12, bold=True)
    f.text(440, 60, "MAC 0000.0c07.ac01", size=11, tone="m", mono=True)
    f.note(640, 170, 220, "Benzetme: şirketin tek telefon numarası; hangi çalışanın masasında çaldığı fark etmez.", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 330, "Devralma: R1 düşer, R2 aktif olur", "Hello'lar kesilince (hold 10 sn) yedek aktif olur. Sanal IP ve MAC değişmediği için PC'nin ARP tablosu geçerli kalır; PC hiçbir şey fark etmez.")
    _lan(f, a_sub="kapalı", b_sub="Active (devraldı)", b_tone="ok", a_down=True)
    f.rect(330, 20, 220, 50, "accent", r=25, dash=True)
    f.text(440, 42, "Sanal IP 192.168.10.1", size=12, bold=True)
    f.text(440, 60, "aynı MAC, şimdi R2'de", size=11, tone="m")
    f.note(640, 230, 220, "%HSRP-5-STATECHANGE: Standby -> Active", tone="ok", size=12)
    return f


def g4():
    f = Fig(880, 290, "Öncelik ve preempt", "Yüksek öncelikli router aktif olur (eşitse yüksek IP). HSRP'de preempt varsayılan kapalıdır: R1 geri döndüğünde preempt yoksa aktifliği geri almaz.")
    f.table(30, 20, ["Durum", "R1 (110)", "R2 (100)"], [
        ["ilk açılış", "Active", "Standby"],
        ["R1 kapanır", "—", "Active"],
        ["R1 döner, preempt YOK", "Standby", "Active (kalır)"],
        ["R1 döner, preempt VAR", "Active (geri alır)", "Standby"],
    ], [300, 260, 260], tones={2: "warn", 3: "ok"})
    f.note(30, 180, 820, "Benzetme: tatilden dönen müdür, preempt yoksa koltuğunu vekilden geri istemez; vekil müdür olarak devam eder.", tone="accent", size=12)
    f.text(440, 262, "standby 1 priority 110 · standby 1 preempt", size=13, mono=True, bold=True)
    return f


def g5():
    f = Fig(880, 320, "İzleme (track): WAN koparsa da devret", "R1'in LAN'ı ayakta ama WAN'ı kopuksa R1 hâlâ aktiftir ve trafiği ölü hatta yollar. track WAN düşünce önceliği düşürür; preempt'li R2 devralır.")
    m = f.device(440, 40, "cloud", "MERKEZ", w=150)
    r1 = f.device(240, 140, "router", "R1", "110 − 20 = 90", tone="warn")
    r2 = f.device(640, 140, "router", "R2", "100 · preempt → Active", tone="ok")
    sw = f.device(440, 250, "switch", "LAN")
    f.link(r1, m, la="g0/1", tone="err", blocked=True)
    f.link(r2, m, tone="ok")
    f.link(r1, sw)
    f.link(r2, sw, tone="ok")
    f.note(20, 220, 300, "track 1 interface g0/1 line-protocol\nstandby 1 track 1 decrement 20", tone="accent", size=12)
    return f


def g6():
    f = Fig(880, 250, "HSRP, VRRP, GLBP", "HSRP Cisco'ya özel, preempt varsayılan kapalı. VRRP standart, preempt varsayılan açık. GLBP birden çok router'ı aynı anda kullanır.")
    f.table(30, 20, ["", "HSRP", "VRRP", "GLBP"], [
        ["Kimin", "Cisco", "standart (RFC 5798)", "Cisco"],
        ["Roller", "Active / Standby", "Master / Backup", "AVG / AVF"],
        ["Preempt", "kapalı", "açık", "kapalı"],
        ["Sanal MAC", "0000.0c07.acXX", "0000.5e00.01XX", "router başına"],
        ["Yük paylaşımı", "grup başına", "grup başına", "aynı grupta"],
        ["Komut", "standby 1 ip", "vrrp 1 ip", "glbp 1 ip"],
    ], [170, 220, 220, 210], tones={2: "accent"}, mono_cols=())
    return f


def g7():
    f = Fig(880, 270, "İki router da Active: birbirini görmüyorlar", "Grup numarası, sanal IP, sürüm ve kimlik doğrulama iki uçta aynı olmalıdır. Uyuşmazsa ikisi de kendini aktif sanır ve Standby sütunu unknown görünür.")
    f.table(30, 20, ["Router", "Grp", "State", "Standby", "Virtual IP"], [
        ["R1", "1", "Active", "unknown", "192.168.10.1"],
        ["R2", "2", "Active", "unknown", "192.168.10.1"],
    ], [140, 80, 140, 180, 200], tones={0: "warn", 1: "warn"}, mono_cols=(1, 4))
    f.note(30, 130, 740, "İpucu: Standby = unknown, \"karşı tarafın Hello'sunu duymuyorum\" demektir. Grup numaralarını karşılaştır.", tone="err", size=12)
    f.note(30, 190, 740, "PC tarafında sık hata: gateway sanal IP yerine bir router'ın gerçek adresine (192.168.10.2) yazılmış; o router kapanınca yalnız o PC kopar.", tone="warn", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
