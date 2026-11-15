"""Kampüs ve kurumsal tasarım dersi şemaları (docs/dersler/kampus-tasarim.md)."""

from figures import Fig


def g1():
    f = Fig(880, 330, "Hiyerarşik model: erişim, dağıtım, çekirdek", "Erişim katmanı kullanıcıları bağlar, dağıtım katmanı erişimleri toplar ve politikaları uygular, çekirdek dağıtımları en hızlı biçimde birbirine bağlar.")
    c1 = f.device(330, 50, "l3switch", "CORE1", tone="v3")
    c2 = f.device(550, 50, "l3switch", "CORE2", tone="v3")
    f.link(c1, c2, width=3)
    ds = []
    for i, x in enumerate((180, 340, 540, 700)):
        d = f.device(x, 160, "l3switch", f"DIST{i + 1}", tone="v2")
        ds.append(d)
        f.link(d, c1 if i < 2 else c2)
        f.link(d, c2 if i < 2 else c1, dash=True)
    for i, x in enumerate((110, 250, 470, 610, 770)):
        a = f.device(x, 270, "switch", f"ACC{i + 1}", tone="v1", w=90)
        f.link(a, ds[min(i, 3) if i < 2 else min(i - 1, 3)] if i else ds[0])
    f.text(20, 54, "Çekirdek", size=12, bold=True, anchor="start", tone="v3")
    f.text(20, 164, "Dağıtım", size=12, bold=True, anchor="start", tone="v2")
    f.text(20, 274, "Erişim", size=12, bold=True, anchor="start", tone="v1")
    return f


def g2():
    f = Fig(880, 210, "Benzetme: sokak, cadde, otoyol", "Her katmanın görevi farklıdır; otoyolda kavşak ve trafik ışığı istenmez, sokakta da 120 ile gidilmez.")
    f.table(30, 20, ["Katman", "Benzetme", "Görev", "Yapılmayan"], [
        ["Erişim", "sokak", "kullanıcıyı bağla, PoE, port güvenliği", "yoğun yönlendirme"],
        ["Dağıtım", "cadde", "topla, VLAN'lar arası yönlendirme, ACL, FHRP", "kullanıcı bağlamak"],
        ["Çekirdek", "otoyol", "hızlı ve kesintisiz taşı", "ACL, karmaşık politika"],
    ], [130, 120, 340, 230], tones={0: "v1", 1: "v2", 2: "v3"})
    f.note(30, 150, 820, "Çekirdekte ne kadar az özellik varsa o kadar az şey bozulur: çekirdek \"sıkıcı\" olmalıdır.", tone="accent", size=12)
    return f


def g3():
    f = Fig(880, 290, "İki katmanlı (daraltılmış çekirdek) ve üç katmanlı", "Tek binalık ya da küçük kampüslerde dağıtım ve çekirdek aynı cihazlarda birleşir. Bina sayısı arttıkça ayrı bir çekirdek, dağıtımlar arası tam örgü kablo ihtiyacını ortadan kaldırır.")
    f.zone(20, 30, 400, 240, "İki katman (collapsed core)", "v2")
    c1 = f.device(140, 90, "l3switch", "CORE/DIST1", w=130)
    c2 = f.device(300, 90, "l3switch", "CORE/DIST2", w=130)
    f.link(c1, c2)
    for x in (90, 220, 350):
        a = f.device(x, 210, "switch", "ACC", w=80)
        f.link(a, c1)
        f.link(a, c2, dash=True)
    f.zone(460, 30, 400, 240, "Üç katman", "v3")
    k1 = f.device(590, 70, "l3switch", "CORE1", w=100)
    k2 = f.device(730, 70, "l3switch", "CORE2", w=100)
    f.link(k1, k2)
    for x in (540, 660, 780):
        d = f.device(x, 150, "l3switch", "DIST", w=80)
        f.link(d, k1)
        f.link(d, k2, dash=True)
        a = f.device(x, 230, "switch", "ACC", w=80)
        f.link(a, d)
    return f


def g4():
    f = Fig(880, 300, "Katman 2 erişim ve yönlendirilmiş erişim", "Katman 2 erişimde VLAN'lar dağıtıma trunk ile taşınır, STP bir bağlantıyı bloklar, gateway FHRP ile dağıtımdadır. Yönlendirilmiş erişimde erişim switch'i gateway'dir, bağlantılar L3'tür, STP döngüsü yoktur ve iki yol da kullanılır (ECMP).")
    f.zone(20, 30, 400, 250, "L2 erişim", "warn")
    d1 = f.device(130, 80, "l3switch", "DIST1", "HSRP Active", w=120)
    d2 = f.device(310, 80, "l3switch", "DIST2", "Standby", w=120)
    f.link(d1, d2, "trunk")
    a = f.device(220, 220, "switch", "ACC1", "VLAN 10")
    f.link(a, d1, "trunk")
    f.link(a, d2, "STP bloklu", tone="err", dash=True)
    f.zone(460, 30, 400, 250, "Yönlendirilmiş erişim", "ok")
    e1 = f.device(570, 80, "l3switch", "DIST1", w=120)
    e2 = f.device(750, 80, "l3switch", "DIST2", w=120)
    b = f.device(660, 220, "l3switch", "ACC1", "gateway burada", w=130)
    f.link(b, e1, "L3 · OSPF", tone="ok")
    f.link(b, e2, "L3 · OSPF", tone="ok")
    return f


def g5():
    f = Fig(880, 270, "Hata alanı: arıza nereye kadar yayılır?", "Bir VLAN bütün kampüse yayılırsa bir döngü ya da broadcast fırtınası bütün binaları vurur. VLAN'ı tek erişim switch'iyle sınırlamak arızayı o kata hapseder.")
    f.box(30, 30, 400, 150, "Kampüs çapında VLAN 10", "err", sub="bir katta döngü → bütün binalarda kesinti", size=15)
    f.box(450, 30, 400, 150, "Kat başına VLAN", "ok", sub="döngü → yalnız o kat; diğerleri etkilenmez", size=15)
    f.text(440, 220, "Benzetme: binada yangın kapıları; yangın çıkan kat kapatılır, bütün bina yanmaz", size=12, tone="m")
    return f


def g6():
    f = Fig(880, 270, "Aşırı abonelik (oversubscription)", "Kullanıcıların hepsi aynı anda tam hızda göndermez; yukarı bağlantılar toplam erişim hızından küçük seçilir. Yaygın kural: erişimden dağıtıma en fazla 20:1, dağıtımdan çekirdeğe 4:1.")
    f.box(30, 30, 380, 110, "48 × 1 Gbps erişim portu", "v1", sub="toplam 48 Gbps", size=15)
    f.arrow(410, 85, 470, 85)
    f.box(470, 30, 380, 110, "2 × 10 Gbps yukarı bağlantı", "v2", sub="toplam 20 Gbps → 48:20 = 2,4:1", size=15)
    f.note(30, 170, 820, "Benzetme: apartmandaki 48 dairenin hepsi aynı anda asansöre binmez; 2 asansör yeter. Ama bir video konferans salonu her gün aynı saatte dolarsa hesap değişir.", tone="accent", size=12)
    return f


def g7():
    f = Fig(880, 270, "Yüksek erişilebilirlik: cihaz içi ve cihazlar arası", "Yedek denetçi kart (SSO) ve NSF bir kart arızasında iletimi sürdürür. StackWise ya da StackWise Virtual iki switch'i tek mantıksal switch yapar; aşağıdaki cihazlar iki fiziksel kutuya tek bir EtherChannel ile bağlanır.")
    f.box(30, 30, 260, 150, "SSO / NSF", "v1", sub="aktif denetçi düşerse yedeği devralır, komşular rotaları tutar", size=15)
    f.box(310, 30, 260, 150, "StackWise", "v2", sub="kasadaki switch'ler tek yönetim, tek yapılandırma", size=15)
    f.box(590, 30, 260, 150, "StackWise Virtual", "v3", sub="iki dağıtım switch'i tek mantıksal switch; STP bloku yok", size=15)
    f.text(440, 220, "Amaç: tek bir kutunun, kartın ya da kablonun arızası kullanıcıya yansımasın", size=12, tone="m")
    return f


FIGURES = {"g1": g1, "g2": g2, "g3": g3, "g4": g4, "g5": g5, "g6": g6, "g7": g7}
