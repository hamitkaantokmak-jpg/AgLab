"""OSPF çok alan dersi şemaları (docs/dersler/ospf-ileri.md)."""

from figures import Fig


def g1():
    f = Fig(880, 300, "Çok alanlı OSPF: omurga ve diğer alanlar", "Bütün alanlar alan 0'a (omurga) bağlanır. İki alanı birleştiren router ABR, dışarıdan rota getiren router ASBR'dir.")
    f.zone(300, 20, 280, 130, "Alan 0 (omurga)", "v3")
    f.zone(20, 160, 300, 120, "Alan 1", "v1")
    f.zone(560, 160, 300, 120, "Alan 2", "v2")
    r1 = f.device(370, 90, "router", "ABR1", tone="accent")
    r2 = f.device(510, 90, "router", "ABR2", tone="accent")
    a = f.device(170, 230, "router", "R-A1")
    b = f.device(710, 230, "router", "R-B1")
    x = f.device(790, 60, "cloud", "İnternet", w=120)
    asbr = f.device(660, 60, "router", "ASBR", tone="warn", w=90)
    f.link(r1, r2)
    f.link(r1, a)
    f.link(r2, b)
    f.link(asbr, r2)
    f.link(asbr, x)
    f.note(20, 30, 250, "Benzetme: ülke (alan 0) ve iller; iller arası trafik başkentten geçer", tone="accent", size=12)
    return f


def g2():
    f = Fig(880, 250, "Neden alanlara bölmek?", "Tek alanda her router bütün haritayı tutar ve her değişiklikte SPF'i yeniden hesaplar. Alanlara bölünce harita küçülür, değişiklik alan içinde kalır, ABR'de özetleme yapılabilir.")
    f.box(30, 30, 390, 140, "Tek alan, 200 router", "warn", sub="dev LSDB · her kopmada herkes SPF", size=15)
    f.box(460, 30, 390, 140, "4 alan + omurga", "ok", sub="küçük LSDB · değişiklik alanda kalır · özet", size=15)
    f.text(440, 210, "Benzetme: bütün dünyanın sokak haritasını cebinde taşımak yerine kendi şehrinin haritası + diğer şehirlere giden yol tabelaları", size=12, tone="m")
    return f


def g3():
    f = Fig(880, 290, "LSA türleri", "Tip 1 ve 2 alanın içini anlatır. Tip 3 ABR'nin diğer alanlara duyurduğu özetlerdir. Tip 4 ASBR'nin yerini, tip 5 dış rotaları, tip 7 NSSA içindeki dış rotaları taşır.")
    f.table(30, 14, ["Tip", "Ad", "Kim üretir", "Nereye yayılır"], [
        ["1", "Router", "her router", "kendi alanı"],
        ["2", "Network", "DR", "kendi alanı"],
        ["3", "Summary", "ABR", "diğer alanlar"],
        ["4", "ASBR Summary", "ABR", "diğer alanlar (ASBR nerede)"],
        ["5", "External", "ASBR", "bütün normal alanlar"],
        ["7", "NSSA External", "NSSA'daki ASBR", "yalnız NSSA; ABR tip 5'e çevirir"],
    ], [80, 200, 220, 320], tones={0: "v1", 1: "v1", 2: "v2", 3: "v2", 4: "warn", 5: "warn"}, mono_cols=(0,))
    f.text(440, 274, "Rota tablosunda: O (alan içi, 1/2), O IA (alanlar arası, 3), O E1/E2 (dış, 5), O N1/N2 (NSSA, 7)", size=12, tone="m")
    return f


def g4():
    f = Fig(880, 270, "Alan türleri: ne içeri girer?", "Stub alan dış rotaları (tip 5) almaz, yerine varsayılan rota alır. Totally stubby alanlararası rotaları da (tip 3) almaz. NSSA dış rota üretebilen stub'dır.")
    f.table(30, 20, ["Alan türü", "Tip 3", "Tip 5", "Tip 7", "Varsayılan rota"], [
        ["Normal", "evet", "evet", "—", "isteğe bağlı"],
        ["Stub", "evet", "hayır", "—", "ABR'den"],
        ["Totally stubby", "hayır (yalnız varsayılan)", "hayır", "—", "ABR'den"],
        ["NSSA", "evet", "hayır", "evet", "isteğe bağlı"],
        ["Totally NSSA", "hayır", "hayır", "evet", "ABR'den"],
    ], [180, 200, 110, 100, 230])
    f.text(440, 220, "Benzetme: köy yolları; köye uzak ülkelerin haritası gerekmez, \"şehre giden yol\" tabelası yeter", size=12, tone="m")
    f.text(440, 248, "Stub bayrağı alanın bütün router'larında aynı olmalı: farklıysa komşuluk kurulmaz", size=12, tone="err", bold=True)
    return f


def g5():
    f = Fig(880, 250, "Özetleme: ABR'de ve ASBR'de", "ABR alanın rotalarını tek bir özetle duyurur (area range); ASBR dış rotaları özetler (summary-address). Özet içindeki bir alt ağın kopması diğer alanlara duyurulmaz.")
    f.table(30, 20, ["Alan 1 içi", ""], [["10.1.0.0/24", ""], ["10.1.1.0/24", ""], ["10.1.2.0/24", ""], ["10.1.3.0/24", ""]], [200, 20], mono_cols=(0,))
    f.arrow(270, 90, 400, 90, tone="accent")
    f.text(510, 142, "area 1 range 10.1.0.0 255.255.252.0", size=12, mono=True, bold=True, tone="accent")
    f.box(400, 60, 220, 60, "10.1.0.0/22", "ok", sub="omurgaya tek tip 3", size=15)
    f.note(640, 40, 220, "ABR özet için Null0 rotası kurar: döngüyü önler", tone="accent", size=12)
    f.note(30, 180, 820, "Dikkat: özetlenen aralık başka alandaki bir ağla çakışırsa trafik yanlış yöne çekilir; özet yalnız alana ait bloğu kapsamalı.", tone="warn", size=12)
    return f


def g6():
    f = Fig(880, 280, "Omurgaya bağlı olmayan alan", "Her alan alan 0'a dokunmalı. Alan 3 yalnız alan 1 üzerinden bağlıysa rotaları omurgaya ulaşmaz. Kalıcı çözüm yeniden tasarım; geçici çözüm alan 1 üzerinden sanal bağlantı (virtual-link).")
    f.zone(20, 40, 240, 180, "Alan 3", "err")
    f.zone(300, 40, 260, 180, "Alan 1 (transit)", "v1")
    f.zone(600, 40, 260, 180, "Alan 0", "v3")
    a = f.device(140, 130, "router", "R3")
    b = f.device(370, 130, "router", "ABR-13", w=110)
    c = f.device(500, 130, "router", "ABR-10", w=110)
    d = f.device(730, 130, "router", "CORE")
    f.link(a, b)
    f.link(b, c)
    f.link(c, d)
    f.path("M 370 100 C 400 40, 470 40, 500 100", tone="accent", width=2, dash=True)
    f.text(435, 34, "virtual-link", size=12, tone="accent", bold=True)
    f.text(440, 260, "area 1 virtual-link <karşı ABR'nin Router ID'si> (iki ABR'de)", size=12, mono=True, bold=True)
    return f


def g7():
    f = Fig(880, 240, "Rota seçim sırası ve dış metrik", "OSPF metrikten önce rota türüne bakar: alan içi, alanlar arası, E1/N1, E2/N2. E2 dış metriği sabit taşır (varsayılan 20); E1 iç maliyeti de ekler.")
    st = [("O", "alan içi", "ok"), ("O IA", "alanlar arası", "v1"), ("O E1 / N1", "dış + iç maliyet", "v2"), ("O E2 / N2", "dış, sabit metrik", "warn")]
    for i, (t, s, tone) in enumerate(st):
        x = 24 + i * 214
        f.box(x, 30, 196, 80, t, tone, sub=s, size=15)
        if i < 3:
            f.text(x + 205, 74, ">", size=18, bold=True)
    f.note(24, 140, 832, "Aynı önek hem O IA hem O E2 olarak gelirse O IA seçilir; metriği daha yüksek olsa bile. Önce tür, sonra metrik.", tone="accent", size=12)
    f.text(440, 214, "Benzetme: önce şehir içi yollar, sonra şehirlerarası, en son yurt dışı; fiyat ikinci ölçüt", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
