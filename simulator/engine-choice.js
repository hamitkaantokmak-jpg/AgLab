// Motor seçimi (Labber entegrasyonu L2, docs/YENIDEN_YAPILANMA.md "L4. Geçiş sırası").
//
// Karar içerikten gelir: köprü (AgLabSim.toLabber) topolojinin bütün alanlarını Labber'a
// eşleyebiliyorsa içerik Labber'da değerlendirilir; eşleyemiyorsa eski motorda açılır ve
// ekranda gerekçesiyle "Eski motor" rozeti görünür. Karar içerik yüklenirken bir kez
// verilir; çalışma sırasında motorlar arasında geçiş yapılmaz. Labber'da açılmış içerik
// sonradan Labber'ın ifade edemediği bir duruma gelirse (ör. topolojiye router eklenirse)
// sonuç eski motordan alınmaz: değerlendirme hata olarak gösterilir.
//
// L3-a: Labber kararındaki içerikte terminal ve değerlendirme aynı kalıcı LabRuntime'ı
// kullanır (labber-session.js); iki motor karşılaştırması yoktur. L3-b: Simulation Mode'un
// ping izi de Labber olay adaptöründen gelir (AgLabSim.pingTrace).
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
  /** İçerik için motor kararı: { engine: 'labber' | 'legacy', reasons: [] }. */
  function decide(topology) {
    const report = AgLabSim.toLabber(topology).report;
    return { engine: report.engineDecision, reasons: report.reasons.slice() };
  }
  function badgeText(decision) {
    return decision.engine === 'labber'
      ? 'Motor: Labber — terminal, değerlendirme ve Simulation Mode Labber motorunda.'
      : 'Eski motor — nedeni: ' + decision.reasons.join('; ');
  }
  function renderBadge(el, decision) {
    if (!el) return;
    el.textContent = badgeText(decision);
    el.dataset.engine = decision.engine;
  }
  /**
   * Labber çalışma zamanı: içerik oturumu varsa onun kalıcı çalışma zamanı (terminal ile
   * aynı), yoksa mevcut topolojiden yeni bir tane. İfade edilemiyorsa açık hata.
   */
  function runtime() {
    if (aglabLabber.active()) return aglabLabber.runtime();
    const r = AgLabSim.toLabber(snapshot());
    if (r.report.engineDecision !== 'labber')
      throw new Error(
        'Bu içerik Labber motorunda açıldı ama topoloji artık Labber’ın desteklemediği öğeler içeriyor (' +
          r.report.reasons.join('; ') +
          '). Motor değiştirilmez; değerlendirme yapılamadı.',
      );
    return AgLabSim.createRuntime(r);
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
  /** L5-b: PC'nin adresi Labber'da DHCP'den mi geldi. */
  function labberDhcpLease(sourceId) {
    return !!runtime().pcs[sourceId]?.dhcp;
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
    labberDhcpLease,
    labberStpRoot,
    labberView,
    snapshot,
    REASON_TR,
  };
})();
window.aglabEngineChoice = {
  decide: (t) => aglabEngineChoice.decide(t),
  badgeText: (d) => aglabEngineChoice.badgeText(d),
};
