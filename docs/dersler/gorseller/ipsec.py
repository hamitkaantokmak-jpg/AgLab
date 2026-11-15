"""IPsec site-to-site dersi şemaları (docs/dersler/ipsec.md)."""

from figures import Fig


def g1():
    f = Fig(880, 240, "IPsec ne sağlar?", "İnternet üzerinden giden şube trafiği okunabilir ve değiştirilebilir. IPsec gizlilik (şifreleme), bütünlük (değiştirilmedi), kimlik doğrulama (karşı taraf gerçekten o) ve tekrar saldırısına karşı koruma sağlar.")
    items = [("Gizlilik", "AES ile şifreleme", "v1"), ("Bütünlük", "SHA ile özet", "v2"), ("Kimlik", "ön paylaşımlı anahtar ya da sertifika", "v3"), ("Tekrar koruması", "sıra numarası", "v4")]
    for i, (t, s, tone) in enumerate(items):
        x = 24 + i * 214
        f.box(x, 30, 196, 120, t, tone, sub=s, size=15)
    f.text(440, 200, "Benzetme: zırhlı araç (gizlilik), mühürlü çanta (bütünlük), kimlik kontrolü (kimlik), seri numaralı makbuz (tekrar)", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 300, "İki aşama: önce güvenli kanal, sonra tünel", "IKE önce iki router arasında yönetim kanalı kurar (faz 1 / IKE SA). Bu kanal üzerinden veriyi şifreleyecek IPsec SA'ları pazarlık edilir (faz 2). Her yön için ayrı bir IPsec SA vardır.")
    a = f.device(120, 140, "router", "R-A")
    b = f.device(760, 140, "router", "R-B")
    f.rect(200, 60, 480, 50, "v2", r=25)
    f.text(440, 90, "Faz 1 · IKE SA: kimlik doğrula, anahtar üret (UDP 500)", size=12, bold=True)
    f.rect(200, 170, 480, 50, "v1", r=25)
    f.text(440, 200, "Faz 2 · IPsec SA'lar: veri şifreleme (ESP)", size=12, bold=True)
    f.text(440, 260, "Benzetme: önce iki şirket müdürü güvenli bir odada görüşür (faz 1), sonra kuryelerin kullanacağı kilit şifrelerini belirler (faz 2)", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 230, "Faz 1 ve faz 2'de iki ucun uyması gerekenler", "Pazarlık iki ucun öneri listelerinin kesişiminden yapılır; ortak bir öneri yoksa SA kurulmaz.")
    f.table(30, 20, ["Aşama", "Uyuşması gereken", "Örnek"], [
        ["Faz 1 (IKE)", "şifreleme, özet, kimlik yöntemi, DH grubu, ömür", "AES-256, SHA-256, PSK, grup 14"],
        ["", "ön paylaşımlı anahtar (iki uçta aynı)", "key <gizli>"],
        ["Faz 2 (IPsec)", "transform set: ESP şifreleme + özet", "esp-aes 256 esp-sha256-hmac"],
        ["", "korunacak trafik (proxy ID / ACL) ayna görüntüsü", "A: 10.1→10.2  B: 10.2→10.1"],
        ["", "PFS (kullanılıyorsa) DH grubu", "group 14"],
    ], [160, 380, 280], tones={0: "v2", 1: "v2", 2: "v1", 3: "v1", 4: "v1"})
    return f


def g4():
    f = Fig(880, 245, "ESP tünel modu", "Site-to-site VPN'de ESP tünel modu kullanılır: özgün IP paketinin tamamı şifrelenir ve yeni bir IP başlığı eklenir. İnternette yalnız iki router'ın dış adresleri görünür.")
    f.frame(30, 60, [("Yeni IP", 150, "v2", "203.0.113.1 → 198.51.100.1"), ("ESP", 80, "warn", "SPI, sıra"), ("Özgün IP + veri", 380, "v1", "ŞİFRELİ"), ("ESP iz + ICV", 140, "soft", "bütünlük")], h=64, title="IP protokol 50 (NAT varsa UDP 4500)")
    f.note(30, 160, 820, "AH (protokol 51) şifrelemez ve NAT'tan geçemez; günümüzde site-to-site için ESP kullanılır. Transport modu yalnız uç cihazlar arası (ör. GRE over IPsec'te GRE paketini korumak) kullanılır.", tone="accent", size=12)
    return f


def g5():
    f = Fig(880, 290, "Kripto harita ve VTI", "Kripto haritada hangi trafiğin şifreleneceğini bir ACL belirler ve dış arayüze uygulanır. VTI'de tünel bir arayüzdür: tünele yönlendirilen her şey şifrelenir, içinde yönlendirme protokolü çalışabilir.")
    f.box(30, 30, 390, 170, "Kripto harita (policy-based)", "warn", sub="ACL: 10.1.0.0/16 → 10.2.0.0/16 şifrele · dış arayüze crypto map · çok noktada karmaşık", size=14)
    f.box(460, 30, 390, 170, "VTI (route-based)", "ok", sub="interface tunnel0 · tunnel mode ipsec ipv4 · tunnel protection · OSPF tünel içinde", size=14)
    f.text(440, 240, "Benzetme: kripto harita, kapıdaki listeye göre çantaları kilitlemek; VTI, kilitli bir koridordan geçen her şeyin otomatik kilitlenmesi", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 255, "NAT ile çakışma: şifrelenecek trafik çevrilmesin", "Router önce NAT yapar, sonra kripto haritaya bakar. Şube trafiği önce genel adrese çevrilirse kripto ACL'ye (özel → özel) uymaz ve şifrelenmeden internete gider. NAT ACL'sinde VPN trafiği hariç tutulur.")
    f.table(30, 20, ["NAT ACL satırı", "Sonuç"], [
        ["deny ip 10.1.0.0 0.0.255.255 10.2.0.0 0.0.255.255", "şubeye giden trafik NAT'sız → kripto ACL'ye uyar"],
        ["permit ip 10.1.0.0 0.0.255.255 any", "geri kalan her şey internete NAT'lı"],
    ], [440, 380], tones={0: "ok"}, mono_cols=(0,))
    f.note(30, 120, 820, "Belirti: tünel kurulmuyor ya da kuruluyor ama karşı şubeye giden paketler genel adresle internete çıkıyor; `show crypto ipsec sa` encaps sayacı 0.", tone="err", size=12)
    f.text(440, 230, "Benzetme: iç yazışmayı kargoya vermeden önce dış adres etiketi yapıştırırsan güvenli çantaya konmaz", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 290, "Teşhis sırası", "Önce faz 1, sonra faz 2, sonra sayaçlar. Encaps artıyor decaps artmıyorsa paket gidiyor ama dönmüyor; ikisi de 0 ise trafik kripto ACL'ye hiç uymuyor.")
    steps = [("show crypto isakmp sa", "QM_IDLE / READY = faz 1 tamam"), ("show crypto ipsec sa", "faz 2 SA'lar, SPI'ler"), ("#pkts encaps / decaps", "giden ve gelen şifreli paket sayısı"), ("debug crypto isakmp", "pazarlık neden başarısız")]
    for i, (cmd, why) in enumerate(steps):
        y = 14 + i * 56
        f.badge(36, y + 22, i + 1)
        f.rect(60, y, 340, 44, "soft", r=6)
        f.text(74, y + 27, cmd, size=12, mono=True, anchor="start", bold=True)
        f.text(420, y + 27, why, size=12, anchor="start", tone="m")
    f.text(440, 268, "Faz 1 yok → anahtar, öneri, UDP 500/4500 · faz 2 yok → transform set, ACL ayna görüntüsü", size=12, tone="accent", bold=True)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
