"""Erişim güvenliği (SSH/AAA) dersi şemaları (docs/dersler/erisim-guvenligi.md)."""

from figures import Fig


def g1():
    f = Fig(880, 260, "AAA: üç soru", "Authentication: sen kimsin? Authorization: ne yapabilirsin? Accounting: ne yaptın? Üçü ayrı sorulardır ve ayrı ayarlanabilir.")
    items = [("Authentication", "Kimsin?", "otel resepsiyonunda kimlik kontrolü", "v1"),
             ("Authorization", "Ne yapabilirsin?", "kartın hangi katları ve odayı açtığı", "v2"),
             ("Accounting", "Ne yaptın?", "kapıların giriş-çıkış kaydı", "v3")]
    for i, (t, q, b, tone) in enumerate(items):
        x = 30 + i * 280
        f.rect(x, 30, 260, 150, tone)
        f.text(x + 130, 66, t, size=16, bold=True)
        f.text(x + 130, 98, q, size=15, tone="t")
        f.text(x + 130, 140, b, size=11, tone="m")
    f.text(440, 226, "Benzetme: otel. Kimliğini gösterirsin, kartın yalnız kendi katını açar, her kapı geçişi kaydedilir", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 300, "Yerel kullanıcı mı, merkezi sunucu mu?", "Yerel kullanıcılar her cihazda ayrı tutulur; çalışan ayrılınca 50 cihazda silmek gerekir. Merkezi AAA sunucusunda tek yerden yönetilir, kayıtlar da tek yerde toplanır.")
    f.zone(20, 30, 380, 240, "Yerel (username … secret)", "warn")
    for i in range(3):
        d = f.device(90 + i * 120, 120, "switch", f"SW{i + 1}", "3 kullanıcı", w=100)
    f.text(210, 220, "her cihazda ayrı liste: unutulan hesap kalır", size=11, tone="warn")
    f.zone(480, 30, 380, 240, "Merkezi (RADIUS / TACACS+)", "ok")
    srv = f.device(670, 90, "server", "AAA sunucusu", "ISE / FreeRADIUS", w=160)
    for i in range(3):
        d = f.device(560 + i * 110, 210, "switch", f"SW{i + 1}", w=90)
        f.link(d, srv, tone="ok")
    return f


def g3():
    f = Fig(880, 250, "RADIUS ile TACACS+", "RADIUS UDP kullanır, yalnız parolayı şifreler, kimlik doğrulama ve yetkiyi birleştirir; ağ erişiminde (802.1X, VPN) yaygındır. TACACS+ TCP 49 kullanır, bütün paketi şifreler, üç A'yı ayırır ve komut yetkilendirmesi yapar; cihaz yönetiminde yaygındır.")
    f.table(30, 20, ["", "RADIUS", "TACACS+"], [
        ["Taşıma", "UDP 1812 / 1813", "TCP 49"],
        ["Şifreleme", "yalnız parola", "bütün içerik"],
        ["AAA", "authn + authz birlikte", "üçü ayrı"],
        ["Komut yetkisi", "sınırlı", "komut komut"],
        ["Tipik kullanım", "ağ erişimi: 802.1X, VPN, Wi-Fi", "cihaz yönetimi: SSH ile giriş"],
        ["Kimin", "açık standart", "Cisco kökenli, açık belge"],
    ], [180, 320, 320])
    return f


def g4():
    f = Fig(880, 290, "Yöntem listesi ve yedek (fallback)", "aaa authentication login default group tacacs+ local: önce sunucu sorulur. Sunucuya ULAŞILAMAZSA yerel kullanıcıya düşülür. Sunucu \"hayır\" derse yerel denenmez.")
    f.box(330, 14, 220, 50, "Giriş denemesi", "accent", size=14)
    f.arrow(440, 64, 440, 94)
    f.box(300, 94, 280, 54, "TACACS+ sunucusu", "v2", size=14)
    f.arrow(360, 148, 160, 196, "yanıt yok (erişilemez)", tone="warn", above=False)
    f.arrow(440, 148, 440, 196, "\"hayır\"", tone="err")
    f.arrow(520, 148, 720, 196, "\"evet\"", tone="ok")
    f.box(30, 198, 260, 60, "local: yerel kullanıcıya düş", "warn", size=13)
    f.box(320, 198, 240, 60, "REDDEDİLDİ", "err", size=14)
    f.box(600, 198, 250, 60, "Giriş", "ok", size=14)
    return f


def g5():
    f = Fig(880, 270, "Parolalar nasıl saklanır?", "Type 0 düz metin, type 7 kolayca çözülen gizleme. Type 5 MD5 karma, type 8 ve 9 güçlü karma. Ekrana bakan biri bile type 7'yi saniyede çözer.")
    f.table(30, 20, ["Tür", "Örnek komut", "Güç"], [
        ["0", "enable password Sube123", "düz metin"],
        ["7", "service password-encryption", "zayıf gizleme, çözülür"],
        ["5", "enable secret (eski IOS)", "MD5 karma: orta"],
        ["8", "enable algorithm-type sha256 secret …", "PBKDF2: güçlü"],
        ["9", "enable algorithm-type scrypt secret …", "scrypt: güçlü"],
    ], [80, 460, 280], tones={0: "err", 1: "warn", 3: "ok", 4: "ok"}, mono_cols=(1,))
    f.text(440, 230, "Benzetme: type 7, kasanın şifresini kâğıda ters yazmak; type 9, kasayı gerçekten kilitlemek", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 300, "Uzaktan girişi kat kat kapat", "Yalnız SSH, yalnız yönetim ağından (access-class), boşta kalan oturumu kapat (exec-timeout), art arda yanlış denemede girişi dondur (login block-for).")
    layers = [
        ("transport input ssh", "Telnet kapalı, yalnız SSH", "v1"),
        ("access-class YONETIM in", "yalnız yönetim ağından bağlanılabilir", "v2"),
        ("login local / aaa", "kullanıcı adı ve parola sorulur", "v3"),
        ("exec-timeout 10 0", "10 dk boşta kalan oturum kapanır", "v4"),
        ("login block-for 120 attempts 3 within 60", "parola tahminine karşı bekletme", "warn"),
    ]
    for i, (cmd, why, tone) in enumerate(layers):
        y = 14 + i * 52
        f.rect(30 + i * 14, y, 460 - i * 28, 42, tone, r=8)
        f.text(44 + i * 14, y + 26, cmd, size=12, mono=True, anchor="start", bold=True)
        f.text(520, y + 26, why, size=12, anchor="start", tone="m")
    return f


def g7():
    f = Fig(880, 250, "Yetki seviyeleri", "Seviye 1 kullanıcı modudur (>), seviye 15 tam yetkidir (#). Arada özel seviyeler tanımlanıp yalnız belli komutlara izin verilebilir.")
    f.box(30, 40, 250, 120, "Seviye 0", "soft", sub="birkaç temel komut (logout, enable)", size=15)
    f.box(315, 40, 250, 120, "Seviye 1 · R1>", "v1", sub="show komutlarının çoğu, değişiklik yok", size=15)
    f.box(600, 40, 250, 120, "Seviye 15 · R1#", "err", sub="her şey: configure terminal, reload", size=15)
    f.text(440, 200, "username stajyer privilege 1 secret … · username admin privilege 15 secret …", size=12, mono=True)
    f.text(440, 228, "Benzetme: misafir kartı, çalışan kartı, master anahtar", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
