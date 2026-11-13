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
/** Lab tanımındaki tam port adının çizimdeki kısa yazımı: FastEthernet0/1 → fa0/1. */
function labShortPort(p) {
  const m = /^(FastEthernet|GigabitEthernet|TenGigabitEthernet|Ethernet)(.*)$/.exec(p);
  if (!m) return p.toLowerCase();
  return (
    { FastEthernet: 'fa', GigabitEthernet: 'gi', TenGigabitEthernet: 'te', Ethernet: 'e' }[m[1]] +
    m[2]
  );
}
/** Lab tanımından (LabDef) yalnız çizim için AğLab topolojisi; köprü kullanılmaz. */
function labTopology(def) {
  const W = def.view?.w || 800,
    H = def.view?.h || 420,
    sx = (x) => Math.round(70 + (Math.max(0, Math.min(W, x)) * 710) / W),
    sy = (y) => Math.round(55 + (Math.max(0, Math.min(H, y)) * 320) / H);
  const devices = def.devices.map((d) => {
    const base = { id: d.id, name: d.id, x: sx(d.x), y: sy(d.y), enabled: !d.off };
    if (d.kind === 'switch')
      return {
        ...base,
        type: 'Switch',
        w: 112,
        h: 72,
        ports: d.ports.map(labShortPort),
        vlans: [1],
        interfaces: {},
        config: { labberModel: d.model },
      };
    const pc = def.initialPcs?.[d.id];
    const mask = pc?.ip
      ? [24, 16, 8, 0].map((s) => (((0xffffffff << (32 - pc.prefix)) >>> 0) >>> s) & 255).join('.')
      : '';
    return {
      ...base,
      type: 'PC',
      w: 104,
      h: 72,
      ip: pc?.ip || '',
      mask,
      gateway: pc?.gw || '',
      ports: ['eth0'],
      interfaces: { eth0: { enabled: !d.nicDown } },
    };
  });
  const links = def.links.map((l) => ({
    a: l.a[0],
    portA: labShortPort(l.a[1]),
    b: l.b[0],
    portB: labShortPort(l.b[1]),
    up: l.up !== false,
  }));
  return { app: 'AgLab', version: 23, devices, links, labberLab: { id: def.id } };
}
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
  /**
   * Labber kararındaki içerik yüklendi: güncel AğLab topolojisinden kalıcı çalışma zamanı.
   * I-1: `prebuilt` verilirse (PKT içe aktarımı: runningConfig'ten IOS metin yoluyla kurulmuş
   * çalışma zamanı, L5-h) o kullanılır; motor kararı yine köprüden.
   */
  function start(prebuilt) {
    const r = AgLabSim.toLabber(topology());
    if (r.report.engineDecision !== 'labber') throw new Error(brokenMessage(r.report.reasons));
    state = {
      rt: prebuilt || AgLabSim.createRuntime(r),
      sessions: {},
      logSeq: {},
      key: key(),
      broken: null,
      writeError: null,
    };
    // I-1: IOS metin yolundan kurulan durum AğLab görünümüne yazılır (kayıt, denetçi)
    if (prebuilt) {
      writeBack();
      if (state.writeError) say(state.writeError, 'outerr');
    }
  }
  /**
   * Labber labı (src/labs, E): lab tanımı (LabDef) köprü kullanılmadan doğrudan
   * createLab ile kurulur. AğLab topolojisi yalnız çizim içindir (labTopology); geri
   * yazım toAglab yerine labViewWrite ile yapılır (ad, PC adresi, güç, kablo), çünkü
   * lablar AğLab modelinin ifade edemediği özellikler (OSPF, EtherChannel…) içerir.
   */
  function startLab(def) {
    state = {
      rt: AgLabSim.createLab(def),
      lab: def,
      sessions: {},
      logSeq: {},
      key: key(),
      broken: null,
      writeError: null,
    };
    labViewWrite();
    state.key = key();
  }
  function lab() {
    return state?.lab || null;
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
    if (state.lab) {
      state.broken =
        'Labber labının topolojisi düzenleyiciyle değiştirilemez (lab tanımı sabittir). Labı yeniden başlat.';
      return;
    }
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
    // L5-f: CDP/LLDP ayarlarının AğLab modelinde karşılığı yok; çalışma zamanı durumu olarak
    // yeni çalışma zamanına taşınır (BridgeError değildir).
    for (const [id, cfg] of Object.entries(rt.running)) {
      const prev = old.running[id];
      if (!prev) continue;
      for (const key of ['cdpRun', 'lldpRun']) if (key in prev) cfg[key] = prev[key];
      for (const [port, c] of Object.entries(cfg.ifaces))
        for (const key of ['cdp', 'lldpTx', 'lldpRx'])
          if (prev.ifaces[port] && key in prev.ifaces[port]) c[key] = prev.ifaces[port][key];
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
    if (state.lab) {
      labViewWrite();
      state.key = key();
      return;
    }
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
  /** Lab kipinde çizimdeki durum: switch adı (hostname), PC adresi, güç, kablo. */
  function labViewWrite() {
    const rt = state.rt;
    for (const d of devices) {
      const def = rt.topo.devices[d.id];
      if (!def) continue;
      d.enabled = rt.powered(d.id);
      if (def.kind === 'switch') d.name = rt.hostname(d.id);
      else {
        const pc = rt.pcs[d.id];
        d.ip = pc?.ip || '';
        d.mask = pc?.ip ? prefixMask(pc.prefix) : '';
        d.gateway = pc?.gw || '';
      }
    }
    for (const l of links) {
      const a = labPort(l.a, l.portA),
        b = labPort(l.b, l.portB);
      l.up = rt.cableIntact(l.a, a) && rt.cableIntact(l.b, b);
    }
  }
  function prefixMask(p) {
    const n = p ? (0xffffffff << (32 - p)) >>> 0 : 0;
    return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
  }
  /** Çizimdeki kısa port adı (fa0/1) → lab tanımındaki tam ad (FastEthernet0/1). */
  function labPort(dev, port) {
    const def = state.rt.topo.devices[dev];
    if (!def || def.kind === 'pc') return port;
    return def.ports.find((p) => labShortPort(p) === port) || port;
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
    // L5-i: TTL bitti, traceroute'ta yanıtsız atlama, !H/!A
    if (
      / icmp_seq=\d+ timeout$|Destination host unreachable|not reachable$|TTL expired in transit|administratively prohibited/.test(
        text,
      )
    )
      return 'outerr';
    if (
      /^(Bad command|Invalid (address|netmask|gateway|options)|Cannot resolve|No gateway found)/.test(
        text,
      )
    )
      return 'outerr';
    // L5-b: DHCP istemcisi ve nslookup başarısızlıkları
    if (
      /^(Can't find dhcp server|DNS request timed out\.|\*\*\* (Default servers are not available|Request to .* timed-out|.* can't find ))/.test(
        text,
      )
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
  /** L5-e: PC trafik gönderir (port security öğrenmesi / ihlali); görünüm güncellenir. */
  function hostSends(dev) {
    runtime().hostSends(dev);
    changed();
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
  /**
   * Öğrencinin çalışma zamanının bağımsız kopyası (running, startup, PC'ler, öğrenilmiş
   * MAC/ARP, donanım durumu). Değerlendirme kopyada trafik üretir ve güç döngüsü dener;
   * öğrencinin durumu değişmez.
   */
  function cloneRuntime() {
    const rt = runtime(),
      copy = AgLabSim.createLab(rt.def);
    if (!copy.load(rt.save())) throw new Error('Labber çalışma zamanı kopyalanamadı.');
    return copy;
  }
  /**
   * Senaryo başlangıcının kaydedilmemiş değişiklikleri: komutlar kullanıcı modundan
   * çalışır, startup-config'e yazılmaz. IOS hatası senaryo hatasıdır.
   */
  function applyPending(blocks) {
    for (const block of blocks) {
      const d = devices.find((x) => x.name === block.device || x.id === block.device);
      if (!d) throw new Error('Bekleyen değişiklik: cihaz bulunamadı: ' + block.device);
      const s = session(d.id);
      if (!s) throw new Error('Bekleyen değişiklik: cihaz kapalı: ' + block.device);
      resetMode(d.id);
      for (const line of block.commands) {
        const bad = s.exec(line).filter((t) => lineKind(t) === 'outerr');
        if (bad.length) throw new Error('Bekleyen değişiklik ' + line + ': ' + bad.join(' '));
      }
      resetMode(d.id);
    }
    newLogsAll();
    writeBack();
  }
  /** Senaryo başlangıcında üretilen syslog konsolda gösterilmez. */
  function newLogsAll() {
    const last = state.rt.logs.at(-1)?.seq || 0;
    for (const dev of Object.keys(state.logSeq)) state.logSeq[dev] = last;
  }
  /** Geçici içerik değişimleri (senaryo doğrulaması) için oturumun kendisi. */
  function capture() {
    return state;
  }
  function restore(s) {
    state = s;
  }
  return {
    hostSends,
    start,
    startLab,
    lab,
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
    cloneRuntime,
    applyPending,
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
  // Testler: kalıcı çalışma zamanının türetilmiş durumu (LabQuery; L4 OSPF/rota denetimleri).
  query: () => aglabLabber.runtime().query(),
  prompt: (dev) => aglabLabber.prompt(dev),
  setPower: (dev, on) => aglabLabber.setPower(dev, on),
  setLink: (dev, port, up) => aglabLabber.setLink(dev, port, up),
  moveCable: (a, pa, b, pb) => aglabLabber.moveCable(a, pa, b, pb),
  // L3-b: son ping'in Simulation Mode izi (Labber içeriğinde köken 'labber').
  trace: () => readEthernetTrace(),
};
