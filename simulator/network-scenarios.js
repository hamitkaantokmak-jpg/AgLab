// Data-defined scenario recipes. Nothing here labels them as actual branch incidents.
function sharedScenarioRecipe(id) {
  return sharedNetworkScenarios.find((row) => row.id === id);
}
function sharedEngineCommandBlock(name, commands) {
  const d = devices.find((d) => d.name === name || d.id === name);
  if (!d) throw new Error('Cihaz bulunamadı: ' + name);
  selected = d.id;
  $p('ptCliDevice').value = d.id;
  aglabLabber.resetMode(d.id);
  updateInspector();
  for (const raw of commands) {
    const before = $p('ptTerminal').childElementCount;
    // IOS MAC yazımı (H.H.H)
    command(raw.replaceAll('$SOURCE_MAC', macFmt(macOf(get(sharedScenario.sourceId)))));
    const errors = [...$p('ptTerminal').children]
      .slice(before)
      .filter((e) => e.classList.contains('outerr'));
    if (errors.length) throw new Error(raw + ': ' + errors.map((e) => e.textContent).join(' '));
  }
}
/** Önceki senaryonun (çözülünce durum satırının yanına taşınmış) kök neden kutusunu kaldırır. */
function sharedCauseClear() {
  document.getElementById('sharedScenarioCause')?.remove();
}
/** Senaryo çözüldü: kök neden açılır ve "BAŞARILI" durumunun yanında görünür. */
function sharedCauseReveal() {
  const cause = document.getElementById('sharedScenarioCause');
  if (!cause) return;
  cause.open = true;
  $p('sharedScenarioStatus').after(cause);
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
  // Arayüz PR 3: ipuçları ve çözüm komutları panelde değil. İpuçları Simülatör üst çubuğundaki
  // "İpucu" ile kademeli açılır; çözüm komutları "Çözümü göster" kilidinin arkasındadır ve kilit
  // açılmadan DOM'a eklenmez (sim-workspace.js).
  // Kök neden alıştırmanın cevabıdır: görev metninin altında ayrı ve kapalı durur; senaryo
  // çözülünce (hedefler sağlanınca) kendiliğinden açılır ve durum satırının yanına taşınır.
  const cause = document.createElement('details'),
    causeSummary = document.createElement('summary'),
    causeText = document.createElement('p');
  cause.id = 'sharedScenarioCause';
  causeSummary.textContent = 'Kök nedeni göster';
  causeText.textContent = 'Kök neden: ' + row.cause;
  cause.append(causeSummary, causeText);
  panel.append(cause);
  sharedStatus(
    row.title + ' yüklendi. İlk erişim başarısız olmalı; tanı komutlarıyla nedeni incele.',
  );
  saveTopology(true);
  return true;
}
function sharedScenarioStartSession() {
  sharedScenario.engine = aglabEngineChoice.decide(aglabEngineChoice.snapshot());
  aglabEngineChoice.renderBadge($p('sharedScenarioEngine'), sharedScenario.engine);
  // L3-a: senaryo boyunca tek kalıcı çalışma zamanı (terminal + hedef). İfade edilemeyen
  // topoloji (L7b: eski motor yok) "simüle edilemiyor" oturumunda açılır; hedefler hata verir.
  aglabLabber.stop();
  aglabLabber.start();
  const row = sharedScenarioRecipe(sharedScenario.key);
  // Başlangıçta kaydedilmemiş değişiklik (ör. biri port ayarını değiştirdi, kaydetmedi).
  if (row?.pending) {
    if (aglabLabber.broken()) throw new Error(row.id + ': ' + aglabLabber.broken());
    aglabLabber.applyPending(row.pending);
    render();
    updateInspector();
  }
  updatePrompt();
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
  // L5-g (Konu #1 yöntem senaryosu: uygulama katmanı)
  'http',
  // Konu #15: OSPF komşuluğu (iki uçta FULL)
  'ospfAdjacent',
  // EtherChannel: Port-channel durumu (up, protocol, bundled) — show etherchannel summary
  'etherchannel',
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
/** Kaynak MAC yer tutucusu çözülmüş çözüm blokları ([{device, commands}]). */
function sharedSolutionBlocks(row) {
  const source = get(sharedScenario.sourceId);
  return row.solution.map((block) => ({
    device: block.device,
    commands: block.commands.map((c) =>
      source ? c.replaceAll('$SOURCE_MAC', macFmt(macOf(source))) : c,
    ),
  }));
}
/**
 * Arayüz PR 3: Simülatör üst çubuğundaki "Kontrol et". Senaryo hedefi (sharedRecipeGoal) şu an
 * sağlanıyor mu: sağlanıyorsa ilerleme kaydedilir ve kök neden açılır (hedef ping'iyle aynı
 * sonuç); değilse durum satırı nedenini söyler. { ok, why } ya da yüklü senaryo yoksa null.
 */
function sharedCheck() {
  if (!sharedScenario.active) return null;
  const row = sharedScenarioRecipe(sharedScenario.key);
  if (!row) return null;
  let ok = false,
    why = '';
  try {
    ok = sharedRecipeGoal(row);
    if (row.verify.kind === 'query') why = sharedQueryGoal(row).why;
    else if (!ok)
      why =
        row.verify.kind === 'dhcp'
          ? 'Kaynak bilgisayar DHCP sunucusundan adres almadı.'
          : row.verify.kind === 'stp-root' &&
              aglabEngineChoice.labberStpRoot(row.verify.vlan) !== row.verify.root
            ? 'VLAN ' + row.verify.vlan + ' kök köprüsü henüz ' + row.verify.root + ' değil.'
            : aglabEngineChoice.labberPing(sharedScenario.sourceId, sharedScenario.target).why;
  } catch (error) {
    sharedStatus('Değerlendirme hatası: ' + error.message, false);
    return { ok: false, why: error.message };
  }
  if (ok) {
    sharedSaveProgress(sharedScenario.key);
    sharedStatus(
      'BAŞARILI: senaryo hedefi sağlandı. Senaryo tamamlandı ve ilerleme bu tarayıcıya kaydedildi.',
      true,
    );
    sharedCauseReveal();
  } else sharedStatus('Henüz çözülmedi: ' + why, false);
  return { ok, why };
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
    // çözülmüş senaryonun kök neden kutusu durum satırının yanındadır; denetim onu korur
    revealedCause = $p('sharedScenarioInstructions').querySelector('#sharedScenarioCause')
      ? null
      : document.getElementById('sharedScenarioCause'),
    status = $p('sharedScenarioStatus').textContent;
  const terminal = [...$p('ptTerminal').childNodes].map((n) => n.cloneNode(true)),
    oldInput = $p('ptCliInput').value;
  const storage = localStorage.getItem(TOPOLOGY_KEY),
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
          expressible: sharedScenario.engine?.expressible ?? null,
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
    sharedCauseClear();
    $p('sharedScenarioInstructions').innerHTML = instructions;
    $p('sharedScenarioStatus').textContent = status;
    if (revealedCause) $p('sharedScenarioStatus').after(revealedCause);
    $p('ptCliInput').value = oldInput;
    $p('ptTerminal').replaceChildren(...terminal);
    updatePrompt();
    if (storage === null) localStorage.removeItem(TOPOLOGY_KEY);
    else localStorage.setItem(TOPOLOGY_KEY, storage);
  }
  return results;
}
window.aglabSharedEngine = {
  load: loadSharedScenario,
  recipes: () => clone(sharedNetworkScenarios),
  validateScenarios: validateSharedScenarios,
  commandBlock: sharedEngineCommandBlock,
  // Senaryo hedefi ping'i (Labber). L5-e: kaynak PC gerçekten gönderir (öğrencinin ping'i
  // gibi): port security öğrenir ya da ihlali uygular; sonuç Labber ping'idir.
  probe: () => {
    if (get(sharedScenario.sourceId)?.type === 'PC') aglabLabber.hostSends(sharedScenario.sourceId);
    return aglabEngineChoice.labberPing(sharedScenario.sourceId, sharedScenario.target);
  },
  // Yüklü senaryonun Labber'da ifade edilebilirliği ({expressible, reasons}).
  engine: () => clone(sharedScenario.engine || null),
  target: () => sharedScenario.target,
  // Arayüz PR 2: Simülatör görev kartı için yüklü senaryo (yoksa null).
  active: () => {
    if (!sharedScenario.active) return null;
    const row = sharedScenarioRecipe(sharedScenario.key);
    const option = [...$p('sharedScenarioSelect').options].find(
      (o) => o.value === sharedScenario.key,
    );
    return {
      id: sharedScenario.key,
      // Seçim listesindeki ad (tarifin `title` alanı bazı senaryolarda kimliğin kendisidir).
      title: option?.textContent || row?.title || sharedScenario.key,
    };
  },
  goal: () => sharedRecipeGoal(sharedScenarioRecipe(sharedScenario.key)),
  // Arayüz PR 3: üst çubuk Kontrol et / İpucu / Çözümü göster (yüklü senaryo yoksa null).
  check: sharedCheck,
  hints: () =>
    sharedScenario.active ? [...(sharedScenarioRecipe(sharedScenario.key)?.hints || [])] : null,
  solution: () => {
    const row = sharedScenario.active && sharedScenarioRecipe(sharedScenario.key);
    return row ? { cause: row.cause || '', blocks: sharedSolutionBlocks(row) } : null;
  },
  // İçeriğin AğLab görünümü (toAglab; terminalle aynı çalışma zamanı).
  view: () => aglabEngineChoice.labberView(),
  // Ad ile iki cihaz arası erişim (Labber ping'i; L7b: eski motor ping'i kaldırıldı); başarılı
  // ve başarısız iletim testleri için.
  reach: (source, target) => {
    const src = devices.find((d) => d.name === source),
      dst = devices.find((d) => d.name === target);
    return !!(src && dst && aglabEngineChoice.labberPing(src.id, dst.ip).ok);
  },
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
  ospf: 'Labber motorunda: router ospf, router-id, network wildcard area, passive-interface, ip ospf cost, show ip ospf neighbor ve O / O IA rotaları. Zamanlayıcılar ve LSDB ayrıntısı modellenmez.',
  bgp: 'BGP simülatörde modellenmez (kapsam dışı); Sorun Çöz ve protokol atölyesindeki BGP alıştırmaları kavramsaldır (motor yok).',
})) {
  if (typeof learningDeep !== 'undefined' && learningDeep[topic])
    learningDeep[topic].commands += ' <br><b>Simülatör kapsamı:</b> ' + note;
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
