// Labber değerlendirmesi (Labber entegrasyonu; L7b'den beri ürünün tek simülasyon motoru).
//
// İçerik yüklenirken köprü (AgLabSim.toLabber) topolojinin bütün alanlarını Labber'a
// eşleyebiliyor mu diye bakılır. Eşleyemiyorsa içerik başka bir motorda AÇILMAZ: topoloji
// çizimde kalır (düzenlenebilir, kaydedilir, dışa aktarılır) ama terminal, ping ve
// değerlendirme gerekçeyi söyleyen açık bir hata verir; rozet "Simüle edilemiyor" der.
// Terminal ve değerlendirme aynı kalıcı LabRuntime'ı kullanır (labber-session.js); Simulation
// Mode'un ping izi Labber olay adaptöründen gelir (AgLabSim.pingTrace).
const aglabEngineChoice = (() => {
  const REASON_TR = {
    noip: 'Kaynak cihazda geçerli IPv4 adresi yok.',
    noroute: 'Kaynakta hedef için yol yok (aynı alt ağda değil ve ağ geçidi yok/erişilemez).',
    timeout:
      'Yanıt gelmedi: hedefe veya dönüşte kaynağa katman 2 yolu yok (kablo, VLAN, trunk, STP).',
    unreach: 'Hedef ağa ulaşılamıyor.',
    off: 'Kaynak cihaz kapalı.',
  };
  function snapshot() {
    return { app: 'AgLab', version: 23, devices: clone(devices), links: clone(links) };
  }
  /** İçerik Labber'da ifade edilebilir mi: { expressible, reasons }. */
  function decide(topology) {
    const report = AgLabSim.toLabber(topology).report;
    return { expressible: report.expressible, reasons: report.reasons.slice() };
  }
  function badgeText(decision) {
    return decision.expressible
      ? 'Motor: Labber — terminal, değerlendirme ve Simulation Mode Labber motorunda.'
      : 'Simüle edilemiyor — Labber bu topolojiyi ifade edemiyor: ' +
          decision.reasons.join('; ') +
          '. Topoloji düzenlenebilir ve kaydedilir; terminal ve değerlendirme çalışmaz.';
  }
  function renderBadge(el, decision) {
    // I-1: çalışma alanı rozeti her zaman geçerli içeriğin durumunu gösterir
    const ws = typeof document !== 'undefined' ? document.getElementById('workspaceEngine') : null;
    for (const x of [el, ws]) {
      if (!x) continue;
      x.textContent = badgeText(decision);
      x.dataset.engine = decision.expressible ? 'labber' : 'unsupported';
    }
  }
  /**
   * Labber çalışma zamanı: içerik oturumu varsa onun kalıcı çalışma zamanı (terminal ile
   * aynı), yoksa mevcut topolojiden yeni bir tane. İfade edilemiyorsa açık hata.
   */
  function runtime() {
    if (aglabLabber.active()) return aglabLabber.runtime();
    const r = AgLabSim.toLabber(snapshot());
    if (!r.report.expressible) throw new Error(aglabLabber.unsupportedMessage(r.report.reasons));
    return AgLabSim.createRuntime(r);
  }
  /** Güncel içeriğin LabQuery'si (rota tablosu vb.); ifade edilemiyorsa istisna atar. */
  function runtimeQuery() {
    return runtime().query();
  }
  /** Labber ping: { ok, why, replier? }. Hata durumunda istisna atar. */
  function labberPing(sourceId, ip) {
    const r = runtime().query().ping(sourceId, ip);
    const who = r.replier ? get(r.replier)?.name || r.replier : null;
    const why = r.ok
      ? 'Labber: yanıt ' + (who || ip) + ' cihazından geldi.'
      : 'Labber: ' +
        (REASON_TR[r.reason] || 'Ping başarısız.') +
        (r.reason === 'unreach' && r.unreachFrom ? ' (' + r.unreachFrom + ' yanıt verdi)' : '');
    return { ok: r.ok, why, replier: r.replier || null, reason: r.reason || null };
  }
  /**
   * L4: Akademi kaynak arayüzlü ICMP ölçütü (`icmp_source_interface`). Eski motorla aynı kural
   * (AgLabRoutingGrading.sourceBinding): kaynak router, arayüz açık ve adresli, hedefin rotası
   * o arayüzden doğrudan bağlı. Arayüz durumu Labber görünümünden, rota Labber tablosundan
   * gelir. Bağlama yoksa null; desteklenmeyen istek istisna atar (ölçüt "hata" olur).
   */
  function labberSourceBinding(sourceId, name, ip) {
    const src = labberView().devices.find((d) => d.id === sourceId);
    const route = runtime().query().routeFor(sourceId, ip);
    // Labber arayüz adı kanoniktir; AğLab görünümündeki yazımıyla eşlenir.
    const aglabName = (canon) =>
      Object.keys(src?.interfaces || {}).find((n) => AgLabSim.canonPort(n) === canon) || canon;
    const lookup = route
      ? {
          ok: true,
          route: {
            type: route.code === 'C' ? 'connected' : route.code === 'S' ? 'static' : 'ospf',
            iface: aglabName(route.ifname),
          },
        }
      : { ok: false };
    return AgLabRoutingGrading.sourceBinding(src, name, lookup);
  }
  /**
   * Durumun Labber üzerinden AğLab görünümü: toAglab(çalışma zamanı, t).
   * Akademi `state_adapter` yeteneği; ifade edilemeyen durum açık hata verir.
   */
  function labberView() {
    if (aglabLabber.active()) return aglabLabber.view();
    const snap = snapshot();
    return AgLabSim.toAglab(runtime(), snap);
  }
  /** Labber STP kökü (cihaz adı) veya null. */
  function labberStpRoot(vlan) {
    const id = runtime().query().stpRoot(vlan);
    return id ? get(id)?.name || id : null;
  }
  return {
    decide,
    badgeText,
    renderBadge,
    labberPing,
    labberSourceBinding,
    labberStpRoot,
    labberView,
    runtimeQuery,
    snapshot,
    REASON_TR,
  };
})();
window.aglabEngineChoice = {
  decide: (t) => aglabEngineChoice.decide(t),
  badgeText: (d) => aglabEngineChoice.badgeText(d),
};
