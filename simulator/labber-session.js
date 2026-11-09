// Labber oturumu (Labber entegrasyonu L3-a, docs/YENIDEN_YAPILANMA.md "L4. Aşamalar").
//
// Labber kararındaki içerik (Sorun Çöz senaryosu, Akademi labı) yüklenince içerik boyunca
// TEK bir kalıcı LabRuntime kurulur. Terminal komutları cihaz başına açılan
// IosSession/VpcsSession'a gider; değerlendirme (engine-choice.js) aynı çalışma zamanını
// kullanır. Kaynak gerçek çalışma zamanıdır: AğLab topolojisi (devices/links; çizim,
// denetçi, kayıt) her değişiklikten sonra toAglab ile ondan türetilir.
//
// Kablo/güç düzenleyicisi çalışma zamanına gider (setPower, setLink, moveCable). Diğer
// düzenleyici işlemleri (cihaz/kablo ekleme-silme, ad değiştirme) AğLab topolojisini
// değiştirir; bu fark kayıt sırasında görülür ve çalışma zamanı yeni topolojiden yeniden
// kurulur, kaydedilmiş yapılandırma (startup-config), err-disable, öğrenilmiş MAC/ARP ve
// syslog taşınır. Yeni topoloji Labber'da ifade edilemiyorsa motor değiştirilmez: oturum
// "bozuk" olur ve her değerlendirme/komut açık hata verir.
//
// Labber durumu AğLab modelinde ifade edilemiyorsa (ör. portfast, OSPF) toAglab
// BridgeError atar; bu durumda AğLab görünümü güncellenmez ve terminalde açıkça yazılır
// (sessiz veri kaybı yok). Kalıcılık (running/startup ayrımının tarayıcı kaydı) L7'dedir.
const aglabLabber = (() => {
  let state = null;
  // Yerleşim alanları çalışma zamanını etkilemez; sürüklemede yeniden kurulum yapılmaz.
  const LAYOUT = new Set(['x', 'y', 'w', 'h', 'selected']);
  function key() {
    return JSON.stringify({
      devices: devices.map((d) =>
        Object.fromEntries(Object.entries(d).filter(([k]) => !LAYOUT.has(k))),
      ),
      links,
    });
  }
  function topology() {
    return { app: 'AgLab', version: 23, devices: clone(devices), links: clone(links) };
  }
  function brokenMessage(reasons) {
    return (
      'Bu içerik Labber motorunda açıldı ama topoloji artık Labber’ın desteklemediği öğeler içeriyor (' +
      reasons.join('; ') +
      '). Motor değiştirilmez; değerlendirme yapılamadı.'
    );
  }
  /** Labber kararındaki içerik yüklendi: güncel AğLab topolojisinden kalıcı çalışma zamanı. */
  function start() {
    const r = AgLabSim.toLabber(topology());
    if (r.report.engineDecision !== 'labber') throw new Error(brokenMessage(r.report.reasons));
    state = {
      rt: AgLabSim.createRuntime(r),
      sessions: {},
      logSeq: {},
      key: key(),
      broken: null,
      writeError: null,
    };
  }
  function stop() {
    state = null;
  }
  function active() {
    return !!state;
  }
  /** Değerlendirme ve terminal için çalışma zamanı; oturum bozuksa açık hata. */
  function runtime() {
    reconcile();
    if (state.broken) throw new Error(state.broken);
    return state.rt;
  }
  /** Düzenleyici AğLab topolojisini değiştirdiyse çalışma zamanını yeniden kur. */
  function reconcile() {
    if (!state) return;
    const k = key();
    if (k === state.key) return;
    state.key = k;
    const r = AgLabSim.toLabber(topology());
    if (r.report.engineDecision !== 'labber') {
      state.broken = brokenMessage(r.report.reasons);
      return;
    }
    if (state.writeError)
      say(
        'Uyarı: Labber durumunun AğLab’da ifade edilemeyen kısmı (' +
          state.writeError +
          ') düzenleyici değişikliğiyle yeniden kurulan çalışma zamanına taşınamadı.',
        'outerr',
      );
    const old = state.rt,
      rt = AgLabSim.createRuntime(r);
    for (const id of Object.keys(rt.running)) {
      if (!old.running[id] || !(id in old.startup)) continue;
      const saved = old.startup[id];
      // Yeni portlar eklenmediyse kaydedilmiş yapılandırma aynen geçerlidir.
      const fits =
        !saved || Object.keys(rt.running[id].ifaces).every((p) => p in (saved.ifaces || {}));
      if (fits) rt.startup[id] = clone(saved);
    }
    for (const k2 of old.errdis) if (rt.topo.devices[k2.split('|')[0]]) rt.errdis.add(k2);
    for (const m of old.seen) rt.seen.add(m);
    for (const a of old.arp) if (rt.topo.devices[a.split('>')[0]]) rt.arp.add(a);
    rt.logs = old.logs.slice();
    rt.commit();
    for (const [dev, s] of Object.entries(state.sessions)) {
      if (rt.topo.devices[dev]) s.rt = rt;
      else delete state.sessions[dev];
    }
    state.rt = rt;
    state.broken = null;
  }
  /** Çalışma zamanından AğLab topolojisine geri yazım (görünüm, denetçi, kayıt). */
  function writeBack() {
    try {
      const view = AgLabSim.toAglab(state.rt, topology());
      devices = view.devices;
      links = view.links;
      state.writeError = null;
    } catch (e) {
      state.writeError =
        'Labber durumu AğLab görünümüne yazılamadı: ' +
        e.message +
        '. Kayıt ve dışa aktarma bu değişikliği içermez; değerlendirme Labber durumunu kullanır.';
    }
    state.key = key();
  }
  function view() {
    return AgLabSim.toAglab(runtime(), topology());
  }
  function session(dev) {
    const rt = runtime();
    if (!rt.topo.devices[dev]) throw new Error('Cihaz Labber çalışma zamanında yok: ' + dev);
    if (!rt.powered(dev)) return null;
    let s = state.sessions[dev];
    if (!s) {
      s = state.sessions[dev] = AgLabSim.createSession(rt, dev);
      state.logSeq[dev] = rt.logs.at(-1)?.seq || 0;
    }
    if (s instanceof AgLabSim.VpcsSession) s.name = get(dev)?.name || dev;
    return s;
  }
  /** Terminal istemi; kapalı cihazda ve bozuk oturumda null. */
  function prompt(dev) {
    if (!state || state.broken) return null;
    try {
      const s = session(dev);
      return s ? s.prompt() : null;
    } catch (e) {
      return null;
    }
  }
  /** Cihazın yeni syslog satırları (konsolda gösterilir). */
  function newLogs(dev) {
    const from = state.logSeq[dev] || 0,
      lines = state.rt.logs.filter((l) => l.dev === dev && l.seq > from).map((l) => l.text);
    state.logSeq[dev] = state.rt.logs.at(-1)?.seq || from;
    return lines;
  }
  /**
   * Bir terminal satırını çalıştırır: { prompt, lines: [{text, kind}] }.
   * kind: 'outerr' (IOS hata/başarısız ping), 'outinfo' (syslog), ''.
   */
  function exec(dev, line) {
    const s = session(dev);
    if (!s) return { lines: [{ text: '% Cihaz kapalı; konsol yanıt vermiyor.', kind: 'outerr' }] };
    const out = s.exec(line);
    const lines = out.map((text) => ({ text, kind: lineKind(text) }));
    for (const text of newLogs(dev)) lines.push({ text, kind: 'outinfo' });
    writeBack();
    if (state.writeError) lines.push({ text: state.writeError, kind: 'outerr' });
    return { lines, prompt: s.prompt() };
  }
  function lineKind(text) {
    if (/^\s*% ?(Invalid|Incomplete|Ambiguous|Unknown|Unrecognized|Bad|Please)/.test(text))
      return 'outerr';
    if (/^Success rate is 0 percent/.test(text)) return 'outerr';
    if (/ icmp_seq=\d+ timeout$|Destination host unreachable|not reachable$/.test(text))
      return 'outerr';
    if (
      /^(Bad command|Invalid (address|netmask|gateway)|Cannot resolve|No gateway found)/.test(text)
    )
      return 'outerr';
    return '';
  }
  function help(dev, line) {
    const s = session(dev);
    if (!s) return [];
    return s instanceof AgLabSim.VpcsSession ? s.help() : s.help(line);
  }
  function complete(dev, line) {
    const s = session(dev);
    return s ? s.complete(line) : null;
  }
  /** Komut bloğu (tarif/öğretmen çözümü) kullanıcı modundan başlar. */
  function resetMode(dev) {
    const s = state?.sessions[dev];
    if (s instanceof AgLabSim.IosSession) {
      if (s.pendingPrompt) s.exec('no');
      s.mode = 'user';
      s.ifs = [];
      s.vlanIds = [];
    }
  }
  function changed() {
    writeBack();
  }
  /** Cihaz gücü (açılış bir reload'dur: running-config startup'tan gelir). */
  function setPower(dev, on) {
    runtime().setPower(dev, on);
    if (!on) delete state.sessions[dev];
    changed();
  }
  function setLink(dev, port, up) {
    const canon = AgLabSim.canonPort(port) || port;
    const ok = runtime().setLink(dev, canon, up);
    changed();
    return ok;
  }
  function moveCable(fromDev, fromPort, toDev, toPort) {
    const c = (p) => (get(toDev)?.type === 'PC' && p === 'eth0' ? p : AgLabSim.canonPort(p) || p);
    const ok = runtime().moveCable(
      fromDev,
      get(fromDev)?.type === 'PC' ? fromPort : c(fromPort),
      toDev,
      c(toPort),
    );
    changed();
    return ok;
  }
  /** Geçici içerik değişimleri (senaryo doğrulaması) için oturumun kendisi. */
  function capture() {
    return state;
  }
  function restore(s) {
    state = s;
  }
  return {
    start,
    stop,
    active,
    runtime,
    reconcile,
    view,
    prompt,
    exec,
    help,
    complete,
    resetMode,
    setPower,
    setLink,
    moveCable,
    capture,
    restore,
    broken: () => state?.broken || null,
  };
})();
window.aglabLabberSession = {
  active: () => aglabLabber.active(),
  // Testler: terminal ve değerlendirme aynı çalışma zamanını mı kullanıyor?
  runtimeId: () => {
    const rt = aglabLabber.runtime();
    if (!rt.__aglabId) rt.__aglabId = Math.random().toString(36).slice(2);
    return rt.__aglabId;
  },
  prompt: (dev) => aglabLabber.prompt(dev),
  setPower: (dev, on) => aglabLabber.setPower(dev, on),
  setLink: (dev, port, up) => aglabLabber.setLink(dev, port, up),
  moveCable: (a, pa, b, pb) => aglabLabber.moveCable(a, pa, b, pb),
};
