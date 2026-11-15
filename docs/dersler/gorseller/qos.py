"""QoS dersi şemaları (docs/dersler/qos.md)."""

from figures import Fig


def g1():
    f = Fig(880, 240, "Neden QoS? Dar boğazda sıra", "Hızlı LAN'dan yavaş WAN'a geçerken paketler kuyrukta bekler. QoS kimin önce gideceğini ve kuyruk dolunca kimin atılacağını belirler; bant genişliği yaratmaz.")
    f.box(30, 60, 200, 90, "LAN 1 Gbps", "v1", size=15)
    f.box(650, 60, 200, 90, "WAN 50 Mbps", "warn", size=15)
    f.arrow(230, 105, 300, 105)
    for i in range(6):
        f.rect(300 + i * 52, 80, 46, 50, ["v2", "v1", "v3", "v1", "v2", "v1"][i], r=4)
    f.arrow(612, 105, 650, 105)
    f.text(456, 160, "kuyruk", size=12, tone="m")
    f.text(440, 210, "Benzetme: otoyoldan tek şeritli köprüye geçiş; ambulansa öncelik vermek yolu genişletmez ama hayat kurtarır", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 195, "Ses ve video ne ister?", "Etkileşimli ses tek yönde ~150 ms gecikme, ~30 ms titreşim ve %1 kayıp sınırını aşınca bozulur. Veri yeniden gönderilebilir; ses beklenemez.")
    f.table(30, 20, ["Trafik", "Gecikme", "Titreşim (jitter)", "Kayıp", "Bant"], [
        ["Ses", "≤ 150 ms (tek yön)", "≤ 30 ms", "≤ %1", "küçük, sabit"],
        ["Etkileşimli video", "≤ 150–200 ms", "≤ 30–50 ms", "≤ %0,1–1", "büyük, dalgalı"],
        ["Veri (web, dosya)", "esnek", "önemsiz", "TCP tekrar gönderir", "dalgalı"],
    ], [180, 180, 170, 160, 130], tones={0: "err", 1: "warn", 2: "ok"})
    f.text(440, 160, "Benzetme: telefon görüşmesi canlı yayındır, tekrar çekilemez; e-posta kargodur, geç gelse de olur", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 290, "İşaretleme: CoS ve DSCP", "L2'de 802.1Q etiketindeki 3 bitlik CoS (PCP), L3'te IP başlığındaki 6 bitlik DSCP kullanılır. DSCP router'lardan geçerken korunur; CoS yalnız trunk'ta vardır.")
    f.frame(30, 50, [("802.1Q etiketi", 260, "v1", "CoS / PCP: 3 bit (0–7)"), ("IP başlığı · ToS baytı", 540, "v2", "DSCP: 6 bit (0–63) + ECN 2 bit")], h=60, title="Nerede taşınır")
    f.table(30, 140, ["Sınıf", "DSCP", "Değer", "Tipik"], [
        ["EF", "101110", "46", "ses"],
        ["AF41", "100010", "34", "etkileşimli video"],
        ["CS3 / AF31", "011000 / 011010", "24 / 26", "çağrı sinyali / iş uygulaması"],
        ["CS0 (BE)", "000000", "0", "varsayılan"],
    ], [200, 220, 120, 280], tones={0: "err", 1: "warn"}, mono_cols=(1, 2), row_h=24, size=11)
    return f


def g4():
    f = Fig(880, 260, "Güven sınırı (trust boundary)", "İşaretleme kaynağa en yakın güvenilir noktada yapılır. IP telefonun işaretine güvenilir; PC'nin kendi koyduğu EF işaretine güvenilmez, sıfırlanır ya da yeniden işaretlenir.")
    pc = f.device(100, 140, "pc", "PC", "EF koydu?", tone="err")
    ph = f.device(310, 140, "phone", "IP telefon", "EF (güvenilir)", tone="ok")
    sw = f.device(560, 140, "switch", "Erişim switch'i", "güven sınırı", w=160)
    wan = f.device(790, 140, "router", "WAN")
    f.link(pc, ph)
    f.link(ph, sw, tone="ok")
    f.link(sw, wan)
    f.line(470, 60, 470, 220, "accent", 2.5, dash=True)
    f.text(470, 50, "güven sınırı", size=12, tone="accent", bold=True)
    f.text(440, 248, "Benzetme: acil servisin triyaj masası; hastanın \"ben acilim\" demesi değil, hemşirenin değerlendirmesi esastır", size=12, tone="m")
    return f


def g5():
    f = Fig(880, 300, "Kuyruklama: LLQ = öncelik + paylaşım", "CBWFQ her sınıfa en az bir bant payı ayırır. LLQ buna sıkı bir öncelik kuyruğu ekler: ses her zaman önce gider ama tavanla sınırlanır, diğerlerini aç bırakamaz.")
    f.box(30, 30, 260, 70, "Öncelik (LLQ) · ses", "err", sub="priority 10 Mbps · hep önce, tavanlı", size=13)
    f.box(30, 110, 260, 60, "Video · %30", "warn", size=13)
    f.box(30, 180, 260, 60, "İş uygulaması · %20", "v1", size=13)
    f.box(30, 250, 260, 40, "Diğer · kalan", "soft", size=12)
    for y in (65, 140, 210, 270):
        f.arrow(290, y, 560, 150, tone="ln")
    f.box(560, 110, 140, 80, "Zamanlayıcı", "accent", size=14)
    f.arrow(700, 150, 840, 150, "WAN", tone="accent")
    return f


def g6():
    f = Fig(880, 240, "Kuyruk dolarsa: tail drop ve WRED", "Kuyruk dolunca gelen her paket atılır (tail drop); bütün TCP oturumları aynı anda yavaşlar ve hızlanır (global senkronizasyon). WRED kuyruk dolmadan önce rastgele ve düşük öncelikli paketleri atarak bunu önler.")
    f.box(30, 30, 390, 140, "Tail drop", "err", sub="kuyruk %100 → herkes kayıp → herkes aynı anda yavaşlar", size=15)
    f.box(460, 30, 390, 140, "WRED", "ok", sub="kuyruk dolmaya başlayınca önce düşük öncelikliden rastgele atar", size=15)
    f.text(440, 210, "Benzetme: tıklım tıklım kapıda herkesi geri çevirmek yerine, sıra uzamaya başlayınca acelesi olmayanları başka saate yönlendirmek", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 290, "Policing ve shaping", "Policing sınırı aşan trafiği anında atar (ya da işaretini düşürür); fazlasını beklemez. Shaping fazlasını tampona alıp sonra gönderir; gecikme ekler ama atmaz. Servis sağlayıcı kiralanan hızın üstünü police eder; müşteri tarafı shape eder.")
    f.box(30, 30, 390, 150, "Policing", "warn", sub="sınır üstü: düşür ya da yeniden işaretle · tampon yok · giriş ve çıkışta", size=15)
    f.box(460, 30, 390, 150, "Shaping", "ok", sub="sınır üstü: tampona al, sonra gönder · gecikme ekler · yalnız çıkışta", size=15)
    f.text(440, 220, "Benzetme: policing kapıdaki fazla misafiri geri çevirir; shaping onları bekleme salonuna alır", size=12, tone="m")
    f.text(440, 254, "Tipik: 100 Mbps arayüz, 50 Mbps kiralık hız → müşteri router'ı 50 Mbps'e shape eder", size=12, tone="accent", bold=True)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
