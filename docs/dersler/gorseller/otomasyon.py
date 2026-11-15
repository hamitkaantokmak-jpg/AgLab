"""Ağ otomasyonu dersi şemaları (docs/dersler/otomasyon.md)."""

from figures import Fig


def g1():
    f = Fig(880, 280, "Elle mi, kodla mı?", "50 switch'e aynı NTP satırını elle yazmak saatler sürer ve bir cihazda yazım hatası kalır. Otomasyon aynı değişikliği her cihaza aynı biçimde uygular ve sonucu doğrular.")
    f.rect(30, 30, 390, 180, "warn")
    f.text(225, 62, "Elle", size=16, bold=True)
    f.lines(225, 100, ["50 × SSH, 50 × yapıştır", "SW37'de bir rakam yanlış", "kim, ne zaman? belirsiz"], size=12)
    f.rect(460, 30, 390, 180, "ok")
    f.text(655, 62, "Otomasyon", size=16, bold=True)
    f.lines(655, 100, ["tek şablon, 50 cihaz", "her cihazda aynı satır", "kayıt ve doğrulama otomatik"], size=12)
    f.text(440, 250, "Benzetme: 50 davetiyeyi elle yazmak ile adres listesini yazıcıya vermek", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 270, "Üç düzlem", "Veri düzlemi paketleri iletir, kontrol düzlemi nereye iletileceğine karar verir (OSPF, STP, ARP), yönetim düzlemi cihazın yönetilmesini sağlar (SSH, SNMP, API).")
    rows = [("Yönetim düzlemi", "SSH, SNMP, API: cihazı yönet", "v3"), ("Kontrol düzlemi", "OSPF, STP, ARP: kararları ver, tabloları kur", "v2"), ("Veri düzlemi", "tablolara bakıp paketi ilet", "v1")]
    for i, (t, s, tone) in enumerate(rows):
        y = 20 + i * 66
        f.rect(30, y, 820, 56, tone, r=8)
        f.text(60, y + 34, t, size=15, bold=True, anchor="start")
        f.text(300, y + 34, s, size=13, anchor="start", tone="m")
    f.text(440, 240, "Benzetme: müdür (yönetim), trafik planlamacısı (kontrol), şoför (veri)", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 340, "Kontrolcü tabanlı ağ", "Kontrolcü ağın tamamını tek yerden görür. Uygulamalar ve betikler kontrolcüyle kuzey yönlü API (REST) üzerinden, kontrolcü cihazlarla güney yönlü protokoller (NETCONF, RESTCONF, SSH, OpenFlow) üzerinden konuşur.")
    f.box(250, 14, 380, 50, "Uygulamalar · betikler · ITSM", "v1", size=13)
    f.arrow(440, 64, 440, 110, "kuzey yönlü (northbound) REST API", tone="v1")
    f.box(250, 110, 380, 60, "Kontrolcü (ör. Catalyst Center)", "accent", size=14)
    for i, x in enumerate((180, 440, 700)):
        d = f.device(x, 270, "switch", f"SW{i + 1}")
        f.arrow(440, 170, x, 244, tone="v2")
    f.text(440, 326, "güney yönlü (southbound): NETCONF, RESTCONF, SSH", size=12, tone="v2", bold=True)
    return f


def g4():
    f = Fig(880, 300, "REST API: istek ve yanıt", "İstemci bir URI'ye HTTP fiiliyle istek gönderir; sunucu durum kodu ve genelde JSON gövdeyle yanıt verir. Fiiller veritabanındaki CRUD işlemlerine karşılık gelir.")
    f.table(30, 20, ["HTTP fiili", "CRUD", "Örnek"], [
        ["GET", "Read", "cihaz listesini oku"],
        ["POST", "Create", "yeni VLAN oluştur"],
        ["PUT / PATCH", "Update", "arayüz açıklamasını değiştir"],
        ["DELETE", "Delete", "VLAN'ı sil"],
    ], [180, 160, 480], mono_cols=(0,))
    f.table(30, 170, ["Kod", "Anlamı"], [["200 / 201", "tamam / oluşturuldu"], ["401 / 403", "kimlik yok / yetki yok"], ["404", "böyle kaynak yok"], ["500", "sunucu hatası"]], [180, 640], tones={0: "ok", 1: "warn", 2: "warn", 3: "err"}, mono_cols=(0,), row_h=24, size=11)
    return f


def g5():
    f = Fig(880, 300, "JSON: verinin ortak dili", "JSON anahtar-değer çiftlerinden oluşur. Süslü parantez bir nesne, köşeli parantez bir liste. Metin tırnak içinde, sayı ve true/false tırnaksız.")
    lines = ['{', '  "hostname": "SW1",', '  "vlans": [', '    {"id": 10, "name": "MUHASEBE"},', '    {"id": 20, "name": "SATIS"}', '  ],', '  "ssh_enabled": true', '}']
    f.rect(30, 20, 420, 250, "soft", r=8)
    for i, l in enumerate(lines):
        f.text(50, 50 + i * 27, l.replace(' ', '\u00a0'), size=13, mono=True, anchor="start", bold=True)
    notes = [(80, "nesne { }: anahtar-değer çiftleri", "v1"), (130, "liste [ ]: sıralı öğeler", "v2"), (190, "değer: metin, sayı, true/false", "v3")]
    for y, t, tone in notes:
        f.note(480, y - 20, 370, t, tone=tone, size=12)
    f.text(665, 250, "YAML aynı veriyi girintiyle yazar (Ansible)", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 230, "Yapılandırma yönetimi araçları", "Ansible ajan istemez, SSH/API ile iter (push) ve YAML playbook kullanır. Puppet ve Chef cihazda ajan çalıştırır, ajan merkezden çeker (pull).")
    f.table(30, 20, ["Araç", "Ajan", "Model", "Dil"], [
        ["Ansible", "yok (SSH / API)", "push", "YAML playbook"],
        ["Puppet", "var", "pull", "Puppet DSL manifest"],
        ["Chef", "var", "pull", "Ruby recipe / cookbook"],
    ], [160, 220, 140, 300], tones={0: "ok"})
    f.text(440, 160, "İdempotent: aynı playbook ikinci kez çalışınca değişiklik yapmaz, \"zaten istenen durumda\" der", size=12, tone="accent", bold=True)
    f.text(440, 200, "Benzetme: tarif kitabı (playbook); aşçı (Ansible) mutfağa gidip uygular, kimse mutfakta beklemez", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 280, "Güvenli otomasyon akışı", "Otomasyon hatayı da 50 cihaza aynı hızla yayar. Önce yedek, sonra kuru çalıştırma (değişikliği göster ama uygulama), küçük bir grupta deneme, uygulama, doğrulama ve gerekirse geri dönüş.")
    steps = [("Yedek", "running-config'i al", "soft"), ("Kuru çalıştır", "--check / diff", "v1"), ("Pilot", "2 cihazda dene", "warn"), ("Uygula", "kalan 48 cihaz", "accent"), ("Doğrula", "show / API ile kontrol", "ok")]
    for i, (t, s, tone) in enumerate(steps):
        x = 20 + i * 172
        f.box(x, 40, 156, 90, t, tone, sub=s, size=14)
        if i < 4:
            f.arrow(x + 156, 85, x + 172, 85)
    f.path("M 794 130 C 794 210, 98 210, 98 130", tone="err", width=2, arrow=True, dash=True)
    f.text(440, 214, "doğrulama başarısızsa: yedekten geri dön", size=12, tone="err", bold=True)
    f.text(440, 256, "Benzetme: yeni ilacı önce küçük bir grupta denemek", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
