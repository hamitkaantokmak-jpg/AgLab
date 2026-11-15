"""Programlanabilirlik (Python, YANG, NETCONF/RESTCONF, EEM) dersi şemaları."""

from figures import Fig


def _code(f, x, y, lines, w=420, tone="soft"):
    f.rect(x, y, w, 26 * len(lines) + 20, tone, r=8)
    for i, l in enumerate(lines):
        f.text(x + 16, y + 28 + i * 26, l.replace(" ", " "), size=12, mono=True, anchor="start", bold=True)


def g1():
    f = Fig(880, 255, "Python'da ağ verisi: sözlük ve liste", "API'den gelen JSON Python'da sözlük (dict) ve listeye (list) dönüşür. Anahtar ile değere, sıra numarası ile liste öğesine ulaşılır.")
    _code(f, 30, 20, ['veri = {', '  "hostname": "SW1",', '  "vlans": [10, 20, 30],', '  "up": True', '}', 'print(veri["hostname"])   # SW1', 'print(veri["vlans"][1])   # 20'], w=470)
    f.note(530, 30, 320, "dict: { anahtar: değer }", tone="v1", size=12)
    f.note(530, 90, 320, "list: [ sıralı öğeler ], sıra 0'dan başlar", tone="v2", size=12)
    f.note(530, 150, 320, "True/False, sayı, metin: JSON'daki karşılıkları true/false, sayı, \"metin\"", tone="v3", size=12)
    return f


def g2():
    f = Fig(880, 300, "Bir REST API çağrısı Python'da", "requests kütüphanesi HTTP isteği gönderir; yanıtın durum kodu kontrol edilir, gövde json() ile sözlüğe çevrilir ve döngüyle işlenir.")
    _code(f, 30, 20, ['import requests', 'r = requests.get(URL, headers=H, verify=True)', 'if r.status_code == 200:', '    for d in r.json()["response"]:', '        print(d["hostname"], d["managementIpAddress"])', 'else:', '    print("Hata:", r.status_code)'], w=640)
    f.note(690, 30, 170, "Parolayı koda yazma: ortam değişkeni ya da kasa", tone="warn", size=12)
    f.note(690, 130, 170, "verify=False sertifika denetimini kapatır: yalnız laboratuvarda", tone="err", size=12)
    return f


def g3():
    f = Fig(880, 260, "YANG: verinin şeması", "YANG cihaz verisinin yapısını tanımlar: hangi alanlar var, türleri ne, hangileri yapılandırılabilir. NETCONF ve RESTCONF bu modele göre veri alıp gönderir.")
    _code(f, 30, 20, ['module: ietf-interfaces', '  +--rw interfaces', '     +--rw interface* [name]', '        +--rw name          string', '        +--rw description?  string', '        +--rw enabled?      boolean', '        +--ro oper-status   enumeration'], w=520)
    f.note(580, 30, 280, "rw: yapılandırılabilir, ro: yalnız okunur (durum)", tone="v1", size=12)
    f.note(580, 100, 280, "* liste, [name] anahtar, ? isteğe bağlı", tone="v2", size=12)
    f.note(580, 170, 280, "Benzetme: bir formun boş şablonu; hangi kutuya ne yazılacağını söyler", tone="accent", size=12)
    return f


def g4():
    f = Fig(880, 215, "NETCONF ve RESTCONF", "NETCONF SSH (TCP 830) üzerinde XML ile çalışır, işlemleri (get-config, edit-config, commit) ve veri depolarını (running, candidate) destekler. RESTCONF aynı YANG verisini HTTPS üzerinden REST tarzında (GET, PUT, PATCH, DELETE) sunar.")
    f.table(30, 20, ["", "NETCONF", "RESTCONF"], [
        ["Taşıma", "SSH, TCP 830", "HTTPS"],
        ["Kodlama", "XML", "JSON ya da XML"],
        ["İşlemler", "get, get-config, edit-config, lock, commit", "GET, POST, PUT, PATCH, DELETE"],
        ["Veri deposu", "running, candidate, startup", "tek mantıksal görünüm"],
        ["Güçlü yanı", "işlem (transaction), kilit, geri alma", "basit, tarayıcı/curl ile"],
    ], [160, 340, 320])
    return f


def g5():
    f = Fig(880, 205, "RESTCONF adresinin parçaları", "URL bir YANG modelindeki yolu gösterir. Liste anahtarındaki özel karakterler kodlanır (Gi1/0/1 → GigabitEthernet1%2F0%2F1).")
    f.text(30, 70, "https://sw1/restconf/data/ietf-interfaces:interfaces/interface=GigabitEthernet1%2F0%2F1", size=12, mono=True, anchor="start", bold=True)
    parts = [(30, 78, "cihaz", "v1"), (110, 107, "kök", "v2"), (219, 186, "modül:kapsayıcı", "v3"), (407, 253, "liste anahtarı", "warn")]
    for x, w, t, tone in parts:
        f.rect(x, 84, w, 8, tone, r=4)
        f.text(x + w / 2, 112, t, size=12, tone=tone, bold=True)
    f.note(30, 150, 820, "Accept: application/yang-data+json · GET okur, PATCH birleştirir, PUT yerine koyar, DELETE siler", tone="accent", size=12)
    return f


def g6():
    f = Fig(880, 235, "Veri depoları: running ve candidate", "NETCONF'ta değişiklik önce candidate deposunda hazırlanır, doğrulanır, sonra commit ile running'e alınır. Hata olursa candidate atılır; running hiç bozulmaz.")
    f.box(30, 60, 240, 100, "candidate", "v1", sub="taslak: edit-config buraya", size=15)
    f.arrow(270, 110, 330, 110, "validate", tone="accent")
    f.box(330, 60, 220, 100, "commit", "ok", size=15)
    f.arrow(550, 110, 610, 110)
    f.box(610, 60, 240, 100, "running", "v2", sub="çalışan yapılandırma", size=15)
    f.text(440, 210, "Benzetme: belgeyi taslakta düzenleyip yazım denetiminden geçirdikten sonra yayınlamak", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 245, "EEM: cihazın içinde küçük otomasyon", "Embedded Event Manager bir olayı (syslog mesajı, arayüz durumu, track, zaman) bekler ve tetiklenince komut dizisini çalıştırır. Harici sunucu gerekmez.")
    f.box(30, 40, 240, 100, "Olay", "warn", sub="syslog: Gi0/1 down", size=15)
    f.arrow(270, 90, 330, 90)
    f.box(330, 40, 220, 100, "Applet", "v1", sub="event … action …", size=15)
    f.arrow(550, 90, 610, 90)
    f.box(610, 40, 240, 100, "Eylem", "ok", sub="show çıktısı kaydet, e-posta, komut", size=15)
    f.text(440, 186, "event manager applet WAN-DUSTU · event syslog pattern \"Gi0/1.*down\" · action 1.0 cli command \"enable\" …", size=11, mono=True)
    f.text(440, 222, "Benzetme: \"kapı açılırsa ışığı yak ve fotoğraf çek\" kuralı olan akıllı ev", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
