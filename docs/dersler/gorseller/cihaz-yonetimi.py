"""Cihaz yönetimi ve yedekleme dersi şemaları (docs/dersler/cihaz-yonetimi.md)."""

from figures import Fig


def g1():
    f = Fig(880, 260, "İki yapılandırma: kurşun kalem ve tükenmez kalem", "running-config RAM'dedir, her komut anında buraya yazılır; startup-config NVRAM'dedir ve açılışta yüklenir. Kaydetmek running'i startup'a kopyalamaktır.")
    f.box(60, 50, 300, 110, "running-config", "v1", sub="RAM · şu an çalışan · elektrik gidince silinir", size=16)
    f.box(520, 50, 300, 110, "startup-config", "v2", sub="NVRAM · kaydedilmiş · açılışta yüklenir", size=16)
    f.arrow(360, 90, 520, 90, "copy run start / write memory", tone="ok", width=3)
    f.arrow(520, 130, 360, 130, "açılış (boot)", tone="v2", width=2, above=False)
    f.text(210, 184, "kurşun kalemle karalama", size=12, tone="v1", bold=True)
    f.text(670, 184, "tükenmez kalemle temize çekilmiş", size=12, tone="v2", bold=True)
    f.text(440, 236, "Benzetme: karalama defterindeki her şey silgiyle (kesinti) gider; temize çektiğin sayfa kalır", size=11, tone="m")
    return f


def g2():
    f = Fig(860, 270, "reload ve \"Save?\" sorusu", "Kaydedilmemiş değişiklik varken reload sorar. yes: şu anki hali (hata dahil) kalıcı yapar; no: son kaydedilen hale döner.")
    f.box(300, 16, 260, 60, "reload", "accent", sub="System configuration has been modified. Save? [yes/no]", size=14)
    f.arrow(360, 76, 200, 130, "yes", tone="warn")
    f.arrow(500, 76, 660, 130, "no", tone="ok")
    f.box(40, 132, 340, 84, "Şu anki hal kaydedilir, sonra açılır", "warn", sub="hata varsa o da kalıcı olur", size=13)
    f.box(480, 132, 340, 84, "Son kaydedilen hal yüklenir", "ok", sub="kaydedilmemiş hatadan en hızlı kurtuluş", size=13)
    f.text(430, 250, "Hata kaydedilmişse reload işe yaramaz: satırı düzelt, yeniden kaydet", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 220, "Kaydedilmeyen değişikliğin hikâyesi", "Akşam yönetim adresi verildi ama kaydedilmedi; gece kesinti oldu; sabah switch eski kaydedilmiş haliyle açıldı ve adres yok.")
    steps = [("Akşam", "Vlan99'a adres verildi", "v1"), ("Akşam", "kaydedilmedi", "warn"), ("Gece", "elektrik kesintisi", "err"), ("Sabah", "startup yüklendi: adres yok", "err")]
    for i, (t, s, tone) in enumerate(steps):
        x = 30 + i * 210
        f.box(x, 50, 190, 74, t, tone, sub=s, size=14)
        if i < 3:
            f.arrow(x + 190, 87, x + 210, 87)
    f.note(30, 150, 820, "Her doğrulanmış düzeltmenin son adımı kaydetmektir. AğLab'ın senaryoları da çözüm kaydedilmeden (q.saved) bitmez.", tone="ok", size=12)
    return f


def g4():
    f = Fig(880, 270, "Yönetim adresi: switch'in kapısı", "Katman 2 switch'in portlarının IP'si yoktur; ağdan ulaşmak için bir SVI'ya (VLAN 99) adres verilir. Başka ağdan yönetim için ip default-gateway gerekir.")
    sw = f.device(440, 140, "switch", "SW1", "interface vlan 99 · 192.168.99.2", w=240)
    adm = f.device(130, 60, "pc", "ADMIN", "VLAN 99 · .99.10", tone="v4")
    pc = f.device(130, 220, "pc", "PC-01", "VLAN 10 (kullanıcı)", tone="v1")
    r1 = f.device(760, 140, "router", "R1", "192.168.99.1")
    f.link(adm, sw, tone="v4")
    f.link(pc, sw, tone="v1")
    f.link(sw, r1, "trunk")
    f.note(560, 200, 300, "ip default-gateway 192.168.99.1: başka ağlardan yönetim için", tone="accent", size=12)
    f.text(440, 262, "SVI yalnız kendi VLAN'ındaki cihazlara yanıt verir ve o VLAN'da en az bir aktif port olmalıdır", size=11, tone="m")
    return f


def g5():
    f = Fig(860, 220, "Telnet ile SSH: kartpostal ve kapalı zarf", "Telnet her şeyi, parola dahil, düz metin gönderir; SSH oturumu şifreler.")
    f.box(40, 40, 360, 120, "Telnet (TCP 23)", "err", sub="kartpostal: yolda herkes okur · username admin / password 1234 açıkta", size=15)
    f.box(460, 40, 360, 120, "SSH (TCP 22)", "ok", sub="kapalı zarf: içerik şifreli · parola ve komutlar görünmez", size=15)
    f.text(430, 200, "Yönetim için yalnız SSH: line vty altında transport input ssh", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 330, "SSH'ı açmanın adımları", "Varsayılan olmayan hostname ve domain adı, RSA anahtarı, SSH sürüm 2, yerel kullanıcı, vty satırlarında login local ve yalnız SSH.")
    steps = [
        ("hostname SW1", "anahtar adı için varsayılan olmayan ad"),
        ("ip domain-name sube.local", "anahtar adı = hostname + domain"),
        ("crypto key generate rsa modulus 2048", "şifreleme anahtarı"),
        ("ip ssh version 2", "eski sürümü kapat"),
        ("username admin secret ****", "yerel kullanıcı, karma parola"),
        ("line vty 0 15 · login local · transport input ssh", "uzaktan girişte kullanıcı sor, yalnız SSH"),
    ]
    for i, (cmd, why) in enumerate(steps):
        y = 14 + i * 52
        f.badge(36, y + 20, i + 1)
        f.rect(60, y, 440, 40, "soft", r=6)
        f.text(74, y + 25, cmd, size=12, mono=True, anchor="start", bold=True)
        f.text(520, y + 25, why, size=12, anchor="start", tone="m")
    return f


def g7():
    f = Fig(880, 250, "Yedekleme ve geri yükleme", "copy running-config tftp: dışarı yedek alır. copy tftp: running-config mevcut ayarla birleştirir; tam geri dönüş için yedek startup'a kopyalanıp reload yapılır.")
    sw = f.device(130, 110, "switch", "SW1")
    tftp = f.device(720, 110, "server", "TFTP sunucusu", "yedek dosyası")
    f.arrow(180, 80, 660, 80, "copy running-config tftp:  (yedek al)", tone="ok", width=2.5)
    f.arrow(660, 140, 180, 140, "copy tftp: running-config  (BİRLEŞTİRİR)", tone="warn", width=2.5, above=False)
    f.note(40, 180, 800, "Dikkat: birleştirme, yedekte olmayan ama şu an olan satırları silmez. Tam geri dönüş: copy tftp: startup-config + reload (ya da configure replace).", tone="warn", size=12)
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
