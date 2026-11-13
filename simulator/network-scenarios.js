// Data-defined scenario recipes. Nothing here labels them as actual branch incidents.
function sharedScenarioRecipe(id) {
  return sharedNetworkScenarios.find((row) => row.id === id);
}
function sharedEngineCommandBlock(name, commands) {
  const d = devices.find((d) => d.name === name || d.id === name);
  if (!d) throw new Error('Cihaz bulunamadı: ' + name);
  selected = d.id;
  $p('ptCliDevice').value = d.id;
  cliMode = 'user';
  currentInterface = '';
  if (aglabLabber.active()) aglabLabber.resetMode(d.id);
  updateInspector();
  for (const raw of commands) {
    const before = $p('ptTerminal').childElementCount;
    // IOS MAC yazımı (H.H.H); eski motor da kabul eder
    command(raw.replaceAll('$SOURCE_MAC', macFmt(macOf(get(sharedScenario.sourceId)))));
    const errors = [...$p('ptTerminal').children]
      .slice(before)
      .filter((e) => e.classList.contains('outerr'));
    if (errors.length) throw new Error(raw + ': ' + errors.map((e) => e.textContent).join(' '));
  }
}
function loadNetworkScenario(key) {
  const row = sharedScenarioRecipe(key);
  if (!row?.topology) return false;
  academyClearSession();
  importTopology(clone(row.topology));
  // Hedef ping'i: tarifte verilmişse verify.source/target, yoksa PC-01 → PC-02.
  const source = devices.find((d) => d.name === (row.verify.source || 'PC-01')),
    target = row.verify.target || devices.find((d) => d.name === 'PC-02').ip;
  sharedScenario = { active: true, key, sourceId: source.id, target };
  const panel = $p('sharedScenarioInstructions');
  panel.replaceChildren();
  for (const text of [
    row.symptom,
    'Kök neden: ' + row.cause,
    'Model: Cisco benzeri sınırlı eğitim komutları; gerçek IOS/OSPF/BGP paketleri veya zamanlayıcıları çalıştırılmaz.',
    ...(row.verify.survivesReload
      ? [
          'Doğrulama: hedef, switch kapatılıp açıldıktan sonra da sağlanmalı; kaydedilmemiş çözüm geçmez.',
        ]
      : []),
  ]) {
    const p = document.createElement('p');
    p.textContent = text;
    panel.append(p);
  }
  const hints = document.createElement('details'),
    summary = document.createElement('summary');
  summary.textContent = 'İpuçları ve çözüm komutları';
  hints.append(summary);
  for (const hint of row.hints || []) {
    const p = document.createElement('p');
    p.textContent = hint;
    hints.append(p);
  }
  for (const block of row.solution) {
    const pre = document.createElement('pre');
    pre.textContent =
      block.device +
      '\n' +
      block.commands.map((c) => c.replaceAll('$SOURCE_MAC', macFmt(macOf(source)))).join('\n');
    hints.append(pre);
  }
  panel.append(hints);
  sharedStatus(
    row.title + ' yüklendi. İlk erişim başarısız olmalı; tanı komutlarıyla nedeni incele.',
  );
  saveTopology(true);
  return true;
}
function sharedScenarioDecideEngine() {
  sharedScenario.engine = aglabEngineChoice.decide(aglabEngineChoice.snapshot());
  aglabEngineChoice.renderBadge($p('sharedScenarioEngine'), sharedScenario.engine);
  // L3-a: Labber kararındaki senaryo boyunca tek kalıcı çalışma zamanı (terminal + hedef).
  aglabLabber.stop();
  const row = sharedScenarioRecipe(sharedScenario.key);
  if (sharedScenario.engine.engine === 'labber') {
    aglabLabber.start();
    // Başlangıçta kaydedilmemiş değişiklik (ör. biri port ayarını değiştirdi, kaydetmedi).
    if (row?.pending) {
      aglabLabber.applyPending(row.pending);
      render();
      updateInspector();
    }
    updatePrompt();
  } else if (row?.pending)
    throw new Error(
      row.id + ': kaydedilmemiş başlangıç değişikliği yalnız Labber motorunda kurulabilir.',
    );
}
// Labber `query` hedefleri: izinli LabQuery fonksiyonları (docs/YENIDEN_YAPILANMA.md L5.3).
const SHARED_QUERY_FNS = new Set([
  'ping',
  'macPort',
  'macVlan',
  'ipUnique',
  'saved',
  'sviUp',
  'vlanExists',
  'pcVlan',
  'trunkCarries',
  'isTrunk',
  'errDisabled',
  'stpRoot',
  'powered',
  'linkUp',
  // L5-b
  'dhcpLease',
  'dnsLookup',
  // FHRP: router arayüzü grupta HSRP Active / VRRP Master mı
  'fhrpActive',
]);
/**
 * Bir hedef satırı: { fn, args, field?, expected, label? }. Bağımsız değişkenlerde cihaz
 * adları kimliğe, `$MAC:<ad>` o cihazın MAC'ine çevrilir; sonuçtaki kimlik ada çevrilir.
 * PC kaynaklı `ping` kopyada gerçek trafik gibi çalışır (switch'ler MAC öğrenir), böylece
 * sonraki macPort/macVlan hedefleri o trafiği görür.
 */
function sharedQueryCheck(rt, check) {
  if (!SHARED_QUERY_FNS.has(check.fn)) throw new Error('İzin verilmeyen sorgu: ' + check.fn);
  const idOf = (x) => (typeof x === 'string' ? devices.find((d) => d.name === x)?.id || x : x);
  const args = check.args.map((a) =>
    typeof a === 'string' && a.startsWith('$MAC:')
      ? rt.topo.devices[idOf(a.slice(5))]?.mac
      : idOf(a),
  );
  if (check.fn === 'ping' && rt.topo.devices[args[0]]?.kind === 'pc' && rt.powered(args[0]))
    AgLabSim.createSession(rt, args[0]).exec('ping ' + args[1]);
  let value = rt.query()[check.fn](...args);
  if (check.field) value = value?.[check.field];
  if (typeof value === 'string' && get(value)) value = get(value).name;
  if (value === undefined) value = null;
  const ok = JSON.stringify(value) === JSON.stringify(check.expected);
  return {
    ok,
    why: ok
      ? ''
      : (check.label || check.fn + '(' + check.args.join(', ') + ')') +
        ': beklenen ' +
        JSON.stringify(check.expected) +
        ', şu an ' +
        JSON.stringify(value) +
        '.',
  };
}
/** Labber `query` hedefi: { ok, why }. survivesReload: kopyada güç döngüsünden sonra da. */
function sharedQueryGoal(row) {
  const v = row.verify,
    run = (rt) => {
      for (const c of v.checks) {
        const r = sharedQueryCheck(rt, c);
        if (!r.ok) return r;
      }
      return { ok: true, why: '' };
    };
  const now = run(aglabLabber.cloneRuntime());
  if (!now.ok) return now;
  if (v.survivesReload) {
    const rt = aglabLabber.cloneRuntime();
    for (const sw of rt.topo.switches) {
      rt.setPower(sw.id, false);
      rt.setPower(sw.id, true);
    }
    const after = run(rt);
    if (!after.ok)
      return {
        ok: false,
        why:
          'Hedef şu an sağlanıyor ama switch kapatılıp açılınca kayboluyor: çözüm kaydedilmemiş (copy running-config startup-config). ' +
          after.why,
      };
  }
  return {
    ok: true,
    why:
      'Bütün hedefler sağlandı' +
      (v.survivesReload ? ' ve switch kapatılıp açıldıktan sonra da korunuyor.' : '.'),
  };
}
function sharedRecipeGoal(row) {
  if (sharedScenario.engine?.engine === 'labber') {
    const reached = () =>
      aglabEngineChoice.labberPing(sharedScenario.sourceId, sharedScenario.target).ok;
    if (row.verify.kind === 'stp-root')
      return aglabEngineChoice.labberStpRoot(row.verify.vlan) === row.verify.root && reached();
    if (row.verify.kind === 'ping') return reached();
    if (row.verify.kind === 'query') return sharedQueryGoal(row).ok;
    // L5-b: kaynak PC'nin adresi DHCP'den (link-local değil); AğLab görünümünde dhcpLease.
    if (row.verify.kind === 'dhcp')
      return !!aglabEngineChoice.labberView().devices.find((d) => d.id === sharedScenario.sourceId)
        ?.dhcpLease;
    throw new Error('Labber bu doğrulama türünü desteklemiyor: ' + row.verify.kind);
  }
  if (row.verify.kind === 'query')
    throw new Error('Sorgu hedefleri yalnız Labber motorunda değerlendirilir: ' + row.id);
  if (row.verify.kind === 'dhcp') return !!get(sharedScenario.sourceId)?.dhcpLease;
  if (row.verify.kind === 'stp-root')
    return (
      stpRootForVlan(row.verify.vlan)?.name === row.verify.root &&
      ping(sharedScenario.sourceId, sharedScenario.target).ok
    );
  return ping(sharedScenario.sourceId, sharedScenario.target).ok;
}
function validateSharedScenarios() {
  const snapshot = {
    app: 'AgLab',
    version: 23,
    devices: clone(devices),
    links: clone(links),
    nextId,
    selected,
    ...academySessionFields(),
  };
  if (sourceArchiveData) snapshot.sourceArchive = clone(sourceArchiveData);
  if (importReportData) snapshot.importReport = clone(importReportData);
  const savedScenario = clone(sharedScenario),
    instructions = $p('sharedScenarioInstructions').innerHTML,
    status = $p('sharedScenarioStatus').textContent;
  const terminal = [...$p('ptTerminal').childNodes].map((n) => n.cloneNode(true)),
    oldMode = cliMode,
    oldInterface = currentInterface,
    oldInput = $p('ptCliInput').value;
  const oldMacs = [...macTables].map(([id, rows]) => [
      id,
      new Map([...rows].map(([key, value]) => [key, { ...value }])),
    ]),
    oldArps = [...arpTables].map(([id, rows]) => [id, new Map(rows)]);
  const storage = localStorage.getItem('aglab-topology-v23'),
    labberSession = aglabLabber.capture(),
    results = [];
  try {
    for (const row of sharedNetworkScenarios) {
      try {
        loadSharedScenario(row.id);
        const initial = sharedRecipeGoal(row);
        for (const block of row.solution) sharedEngineCommandBlock(block.device, block.commands);
        const solved = sharedRecipeGoal(row);
        results.push({
          id: row.id,
          engine: sharedScenario.engine?.engine || null,
          initial,
          solved,
          ok: !initial && solved,
          detail:
            row.verify.kind === 'query'
              ? sharedQueryGoal(row).why
              : row.verify.kind === 'stp-root'
                ? 'Başlangıçta hedef root değil; CLI sonrası ' +
                  row.verify.root +
                  ' VLAN ' +
                  row.verify.vlan +
                  ' root ve ping başarılı.'
                : 'Başlangıç ' +
                  (initial ? 'başarılı' : 'başarısız') +
                  ' / çözüm sonrası ' +
                  (solved ? 'başarılı' : 'başarısız'),
        });
      } catch (error) {
        results.push({ id: row.id, ok: false, detail: String(error.message || error) });
      }
    }
  } finally {
    importTopology(snapshot);
    sharedScenario = savedScenario;
    aglabLabber.restore(labberSession);
    $p('sharedScenarioInstructions').innerHTML = instructions;
    $p('sharedScenarioStatus').textContent = status;
    macTables.clear();
    oldMacs.forEach(([id, rows]) => macTables.set(id, rows));
    arpTables.clear();
    oldArps.forEach(([id, rows]) => arpTables.set(id, rows));
    cliMode = oldMode;
    currentInterface = oldInterface;
    $p('ptCliInput').value = oldInput;
    $p('ptTerminal').replaceChildren(...terminal);
    updatePrompt();
    if (storage === null) localStorage.removeItem('aglab-topology-v23');
    else localStorage.setItem('aglab-topology-v23', storage);
  }
  return results;
}
window.aglabSharedEngine = {
  load: loadSharedScenario,
  recipes: () => clone(sharedNetworkScenarios),
  validateScenarios: validateSharedScenarios,
  commandBlock: sharedEngineCommandBlock,
  // Senaryo hedefi ping'i yüklü içeriğin motorunda (L4: Labber içeriğinde Labber ping'i).
  // L5-e: Labber içeriğinde kaynak PC gerçekten gönderir (öğrencinin ping'i gibi): port
  // security öğrenir ya da ihlali uygular; sonuç Labber ping'idir.
  probe: () => {
    if (sharedScenario.engine?.engine !== 'labber')
      return ping(sharedScenario.sourceId, sharedScenario.target);
    if (get(sharedScenario.sourceId)?.type === 'PC') aglabLabber.hostSends(sharedScenario.sourceId);
    return aglabEngineChoice.labberPing(sharedScenario.sourceId, sharedScenario.target);
  },
  // Yüklü senaryonun motor kararı ({engine, reasons}) ve senaryo hedefinin o motordaki sonucu.
  engine: () => clone(sharedScenario.engine || null),
  target: () => sharedScenario.target,
  goal: () => sharedRecipeGoal(sharedScenarioRecipe(sharedScenario.key)),
  // Labber kararındaki içeriğin AğLab görünümü (toAglab; terminalle aynı çalışma zamanı).
  view: () => aglabEngineChoice.labberView(),
  // Ad ile iki cihaz arası erişim; başarılı ve başarısız iletim testleri için.
  reach: (source, target) => {
    const src = devices.find((d) => d.name === source),
      dst = devices.find((d) => d.name === target);
    // Eski motorun ping'i (görünüm üzerinde); tests/test_aglab_sim_parity.py bunu Labber'la
    // karşılaştıran oracle olarak kullanır.
    return !!(src && dst && ping(src.id, dst.ip).ok);
  },
  routes: (id) => clone(dynamicRoutes(get(id) || devices.find((d) => d.name === id))),
  peers: (kind) =>
    protocolPeers(kind).map((e) => ({ a: e.a.name, b: e.b.name, ok: e.ok, reason: e.reason })),
  strictPath: (a, b, vlan, ip) =>
    findPath(a, b, vlan, ip, true)?.map((l) => ({ a: l.a, b: l.b })) || null,
};
for (const row of sharedNetworkScenarios)
  if (row.topology) {
    const option = document.createElement('option');
    option.value = row.id;
    option.textContent = row.title;
    $p('sharedScenarioSelect').append(option);
  }
const sharedPanel = $p('sharedScenarioPanel');
$p('ptWorkbench').querySelector('.pt-toolbar').after(sharedPanel);
const oldDisclosure = $p('uxLabScenarios');
if (oldDisclosure) oldDisclosure.remove();
const sharedBridge = document.createElement('button');
sharedBridge.type = 'button';
sharedBridge.id = 'sharedScenarioTroubleLink';
sharedBridge.textContent = 'Ortak motor senaryolarına geç';
sharedBridge.onclick = () => {
  showArea('lab');
  sharedPanel.scrollIntoView({ block: 'start' });
  $p('sharedScenarioSelect').focus();
};
$p('scenarioList').before(sharedBridge);
sharedPanel.setAttribute('role', 'region');
sharedPanel.setAttribute('aria-labelledby', 'sharedScenarioTitle');
$p('sharedScenarioStatus').setAttribute('aria-live', 'polite');
for (const [topic, note] of Object.entries({
  ospf: 'Ortak motorda: router ospf, router-id, network wildcard area, show ip ospf neighbor ve O rotaları. Tek area bileşenleri/anlık eğitim modeli; passive-interface, timer, LSDB, redistribution ve policy desteklenmez.',
  bgp: 'Ortak motorda: router bgp, karşılıklı neighbor remote-as, bağlı ağ için network mask, show ip bgp summary ve B rotaları. Doğrudan eBGP eğitim modeli; iBGP, prefix-list, route-map ve path policy desteklenmez.',
})) {
  if (typeof learningDeep !== 'undefined' && learningDeep[topic])
    learningDeep[topic].commands += ' <br><b>Simülatör kapsamı:</b> ' + note;
}
if (typeof scenarios !== 'undefined') {
  for (const [id, title] of Object.entries({
    bgp: 'BGP remote-AS uyuşmazlığı',
    ospf: 'OSPF area uyuşmazlığı',
    portsec: 'Port-security ihlali · ortak motor',
    subif: 'Eksik alt arayüz · ortak motor',
  })) {
    const row = scenarios.find((s) => s.id === id);
    if (row) row.title = title;
  }
  if (typeof renderList === 'function') renderList();
}
// Meaningful names for existing controls whose context used to be visual only.
for (const [id, label] of Object.entries({
  ptCliDevice: 'CLI cihazı',
  ptCliInput: 'Cihaz komutu',
  ptRenameInput: 'Seçili cihazın yeni adı',
  ptSource: 'Kaynak cihaz',
  ptTarget: 'Hedef cihaz',
})) {
  const el = $p(id);
  if (el) el.setAttribute('aria-label', label);
}
const accessibilityStyle = document.createElement('style');
accessibilityStyle.textContent = `
 :focus-visible{outline:3px solid #8b3c00;outline-offset:3px}
 html[data-theme="dark"] :focus-visible{outline-color:#ffe08a}
 #sharedScenarioPanel{background:var(--panel)!important;color:var(--text)!important;border-color:var(--line)!important}
 #sharedScenarioPanel p,#sharedScenarioStatus,#regressionAuditSummary,#regressionAuditResults{color:var(--text)!important}
 #sharedScenarioPanel input,#sharedScenarioPanel select,#sharedScenarioPanel button{background:var(--panel2);color:var(--text)}
 html[data-theme="light"] a{color:#16489a}html[data-theme="dark"] a{color:#a5d5ff}
 #sharedScenarioPanel pre{white-space:pre-wrap;overflow-wrap:anywhere}
 button,input,select,textarea{color:var(--text)!important;background-color:var(--panel2)!important;background-image:none!important}
`;
document.head.append(accessibilityStyle);
const areaNavigation = [...document.querySelectorAll('button[data-area]')];
const announceArea = () =>
  areaNavigation.forEach((button) =>
    button.setAttribute('aria-pressed', String(button.classList.contains('active'))),
  );
const areaObserver = new MutationObserver(announceArea);
areaNavigation.forEach((button) =>
  areaObserver.observe(button, { attributes: true, attributeFilter: ['class'] }),
);
announceArea();
