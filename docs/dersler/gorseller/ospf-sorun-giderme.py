"""İleri OSPF sorun giderme dersi şemaları (docs/dersler/ospf-sorun-giderme.md)."""

from figures import Fig


def g1():
    f = Fig(880, 250, "OSPF arızası iki katmanlıdır", "Önce komşuluk kurulmuş mu ona bak; kurulmamışsa sorun hello ve veritabanı değişimindedir. Komşuluk FULL ise sorun LSA'ların veritabanına girmesinde, SPF'te ya da rota tablosundadır.")
    f.box(30, 30, 390, 150, "1. Komşuluk", "v1", sub="hello eşleşiyor mu? DBD değişiliyor mu?", size=16)
    f.box(460, 30, 390, 150, "2. Rota", "v2", sub="LSA LSDB'de mi? SPF sonucu tabloya girdi mi?", size=16)
    f.arrow(420, 105, 460, 105, tone="accent", width=2.5)
    f.text(225, 160, "show ip ospf neighbor · interface", size=12, mono=True)
    f.text(655, 160, "show ip ospf database · show ip route", size=12, mono=True)
    f.text(440, 228, "Benzetme: önce postacı sokağa giriyor mu, sonra mektubun adresi doğru mu", size=12, tone="m")
    return f


def g2():
    f = Fig(880, 300, "Komşuluk durumları ve takıldığı yer", "Her durum bir sonraki adımın neden atılamadığını söyler. Takılan durum, arızanın hangi pakette olduğunu gösterir: hello, DBD ya da LSA isteği.")
    states = [("DOWN", "soft", ""), ("INIT", "warn", "tek yönlü"), ("2-WAY", "ok", "DROTHER'da normal"), ("EXSTART", "err", "MTU / çift RID"), ("EXCHANGE", "err", "MTU"), ("LOADING", "warn", "LSA isteği"), ("FULL", "ok", "tamam")]
    for i, (name, tone, sub) in enumerate(states):
        x = 20 + i * 122
        f.box(x, 50, 108, 70, name, tone, size=13)
        if sub:
            f.text(x + 54, 145, sub, size=11, tone="m")
        if i < len(states) - 1:
            f.arrow(x + 108, 85, x + 122, 85)
    f.rect(20, 175, 840, 2, "soft", r=0, width=0)
    f.text(140, 210, "hello", size=13, bold=True, tone="v1")
    f.text(140, 232, "alan · maske · zamanlayıcı · auth", size=11, tone="m")
    f.text(485, 210, "DBD (veritabanı özeti)", size=13, bold=True, tone="v2")
    f.text(485, 232, "MTU · master/slave (router-id)", size=11, tone="m")
    f.text(760, 210, "LSR / LSU", size=13, bold=True, tone="v3")
    f.text(760, 232, "LSA istek ve gönderim", size=11, tone="m")
    f.text(440, 280, "Benzetme: tanışma (hello), defter karşılaştırma (DBD), eksik sayfaları isteme (LSR)", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 270, "Hello'da eşleşmesi gerekenler", "Hello alındığında bu alanlar router'ın kendi değerleriyle karşılaştırılır. Biri tutmazsa hello sessizce atılır: komşu listede hiç görünmez. MTU hello'da yoktur.")
    f.table(30, 20, ["Alan", "R1", "R2", "Sonuç"], [
        ["Alan (area) ve stub bayrağı", "0", "0", "eşit ✓"],
        ["Alt ağ / maske", "10.0.12.0/24", "10.0.12.0/24", "eşit ✓"],
        ["Hello / Dead", "10 / 40", "30 / 120", "FARKLI ✗"],
        ["Kimlik doğrulama", "MD5 anahtar 1", "MD5 anahtar 1", "eşit ✓"],
    ], [260, 190, 190, 180], tones={2: "err"}, mono_cols=(1, 2))
    f.text(440, 185, "debug ip ospf hello → Mismatched hello parameters from 10.0.12.1", size=12, mono=True, bold=True)
    f.text(440, 220, "Router-id ve priority eşit olmak zorunda değil; router-id benzersiz olmalı", size=12, tone="accent", bold=True)
    f.text(440, 250, "Benzetme: aynı dili konuşmayan iki kişi el sıkışmaz", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 260, "Ağ tipi uyuşmazlığı", "Bir taraf broadcast, diğeri point-to-point ise hello aralıkları aynı olduğu için komşuluk FULL olabilir. Ama iki router bağlantıyı LSDB'de farklı anlatır; SPF iki yönlü bağı doğrulayamaz ve rota kurulmaz.")
    a = f.device(150, 100, "router", "R2", "broadcast · DR bekler", w=190)
    b = f.device(730, 100, "router", "R3", "point-to-point · DR yok", w=190)
    f.link(a, b, label="FULL", tone="ok")
    f.box(40, 160, 360, 60, "Type 2 Network LSA ile anlatır", "v1", size=13)
    f.box(480, 160, 360, 60, "Type 1 içinde P2P bağ olarak anlatır", "v3", size=13)
    f.text(440, 245, "Sonuç: komşu FULL ama rota yok ya da tek yönlü. Çözüm: iki tarafta aynı ip ospf network", size=12, tone="err", bold=True)
    return f


def g5():
    f = Fig(880, 300, "Komşuluk tamam, rota yok: eleme sırası", "LSA'nın hiç gelmediği durumla geldiği ama tabloya girmediği durum farklı nedenlere işaret eder. LSDB'ye bakmak bu ikisini ayırır.")
    steps = [
        ("1. LSA LSDB'de yok", "kaynakta duyurulmuyor · ABR'de filter-list / range not-advertise · alan türü (stub) Type 5'i kesiyor", "warn"),
        ("2. LSA var, tabloda yok", "distribute-list in · forwarding address'e yol yok · ABR/ASBR'ye yol yok · daha iyi AD", "err"),
        ("3. Tabloda var, yanlış", "maliyet / referans bant genişliği · özet uzun öneki gizliyor · E1-E2", "v3"),
    ]
    for i, (t, s, tone) in enumerate(steps):
        y = 20 + i * 80
        f.rect(30, y, 820, 66, tone, r=8)
        f.text(50, y + 28, t, size=14, bold=True, anchor="start")
        f.text(50, y + 50, s, size=12, anchor="start", tone="m")
    f.text(440, 285, "show ip ospf database <tip> <önek> → show ip protocols → show ip route <önek>", size=12, mono=True, bold=True)
    return f


def g6():
    f = Fig(880, 270, "Çift router-id", "Aynı router-id'yi taşıyan iki router aynı Type 1 LSA'yı kendi bilgisiyle sürekli yeniden üretir. LSDB'de sıra numarası durmadan artar, SPF tekrar tekrar çalışır, rotalar gelip gider.")
    a = f.device(160, 110, "router", "Merkez-R3", "router-id 3.3.3.3", tone="err", w=180)
    b = f.device(720, 110, "router", "Şube-R9", "router-id 3.3.3.3", tone="err", w=180)
    m = f.device(440, 110, "router", "R4")
    f.link(a, m)
    f.link(m, b)
    f.text(440, 195, "LSA 3.3.3.3 seq 0x80000231 → 0x80000232 → 0x80000233 …", size=12, mono=True, bold=True)
    f.text(440, 225, "%OSPF-4-FLOOD_WAR · doğrudan komşularsa %OSPF-4-DUP_RTRID_NBR", size=12, mono=True, tone="err")
    f.text(440, 255, "Benzetme: aynı kimlik numaralı iki kişi; nüfus kaydı her gün birinin adresini diğerininkiyle değiştirir", size=12, tone="m")
    return f


def g7():
    f = Fig(880, 230, "Yöntem: kanıttan nedene", "Her komut bir sonrakini seçer. Rastgele clear ip ospf process yazmak sorunu geçici olarak gizleyebilir ama nedeni öğretmez.")
    boxes = [("Komşu var mı?", "neighbor"), ("Hangi durumda?", "state"), ("Arayüz / hello", "interface · debug"), ("LSA var mı?", "database"), ("Tabloda mı?", "route · protocols")]
    for i, (t, s) in enumerate(boxes):
        x = 20 + i * 172
        f.box(x, 40, 152, 90, t, "accent" if i % 2 == 0 else "v2", sub=s, size=13)
        if i < len(boxes) - 1:
            f.arrow(x + 152, 85, x + 172, 85)
    f.text(440, 175, "Komşuluk FULL değilse rota bölümüne geçme", size=13, tone="accent", bold=True)
    f.text(440, 205, "Benzetme: doktor önce ateşe, sonra kana, sonra filme bakar", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
