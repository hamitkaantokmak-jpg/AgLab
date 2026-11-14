// Arayüz yenilemesi PR 2: Simülatör çalışma alanı (docs/arayuz/dolu-3.png).
//
// Üstte başlık, motor rozeti ve Sıfırla / İpucu / Kontrol et; solda görev ve canlı hedef
// listesi; ortada tuval; sağda inceleme paneli (Port / Cihaz / Olaylar); altta cihaz sekmeli
// terminal ve Simulation Mode zaman çizelgesi. Görev seçimi (Akademi labları, Labber labları,
// hazır senaryolar) çalışma alanının altındaki "Görev seç" kartındadır.
//
// Mevcut denetimler (kimlikleri, olay dinleyicileri, testlerin seçicileri) yeniden
// oluşturulmaz; yalnız yerleri değişir. Bütün betikler yüklendikten sonra çalışır.
//
// "Çözümü göster": öğretmen çözümü (Akademi) ve referans çözüm (Labber labı) HTML'e gömülüdür
// (kullanıcı kararı; öğrenci/öğretmen ayrımı kalktı). Kilit, en az SOLUTION_FAILS başarısız
// "Kontrol et"ten ya da bütün ipuçları kullanıldıktan sonra açılır; çözüm DOM'a ancak kilit
// açıkken düğmeye basılınca eklenir (gizli öğe olarak önceden bulunmaz).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const area = $('area-lab'),
    work = $('ptWorkbench'),
    canvas = $('ptCanvas');
  if (!area || !work || !canvas) return;
  const SOLUTION_FAILS = 3;
  const LOCK_KEY = 'aglab-solution-lock-v1';
  const make = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...kids.filter(Boolean));
    return n;
  };
  const button = (id, text, cls = 'ag-btn') =>
    make('button', { type: 'button', id, class: cls, text });

  // ---------------------------------------------------------------- iskelet
  work.classList.add('ag-sim');
  const head = make('header', { class: 'ag-sim-head', id: 'agSimHead' });
  const title = make('b', { id: 'agSimTitle', text: 'Simülatör · Serbest çalışma' });
  const engineTag = make('span', { class: 'ag-tag', id: 'agSimEngine', role: 'status' });
  const meta = make('span', { class: 'muted small', id: 'agSimMeta' });
  const actions = make('div', { class: 'ag-sim-actions', id: 'agSimActions' });
  head.append(
    make('div', { class: 'ag-sim-title' }, title, engineTag, meta),
    make('div', { class: 'ag-sim-spacer' }),
    actions,
  );

  const body = make('div', { class: 'ag-sim-body' });
  const task = make('section', {
    class: 'card ag-sim-task',
    id: 'agSimTask',
    'aria-labelledby': 'agSimTaskTitle',
  });
  const taskText = make('div', { class: 'muted small ag-sim-task-text', id: 'agSimTaskText' });
  // Açıklama daraltılabilir; hedefler onun üstünde (1280×800'de ilk ekranda görünür).
  const taskAbout = make(
    'details',
    { class: 'ag-sim-about', id: 'agSimTaskAbout', open: true },
    make('summary', { text: 'Görev açıklaması' }),
    taskText,
  );
  const goals = make('ul', { class: 'ag-sim-goals', id: 'agSimGoals', 'aria-label': 'Hedefler' });
  const taskExtra = make('div', { class: 'ag-sim-task-extra', id: 'agSimTaskExtra' });
  const hintBox = make('div', { class: 'ag-sim-hint', id: 'agSimHintBox', 'aria-live': 'polite' });
  const solutionSlot = make('div', { id: 'agSimSolutionSlot' });
  task.append(
    make('h2', { id: 'agSimTaskTitle', text: 'Görev' }),
    goals,
    taskExtra,
    taskAbout,
    make('div', { class: 'ag-sim-fill' }),
    hintBox,
    solutionSlot,
  );

  const stage = make('section', {
    class: 'card ag-sim-stage',
    id: 'agSimStage',
    'aria-label': 'Topoloji tuvali',
  });
  // Taslakta tuvalin üstünde araç çubuğu yok: solda palet (cihazlar + kablo aracı), altta
  // durum satırı ile Kaydet / Ağı denetle / Diğer işlemler; kablo işlemleri kablo aracının
  // açtığı satırda.
  const stageFoot = make('div', { class: 'ag-sim-stagefoot small' });
  const stageStatus = make('div', { class: 'ag-sim-stagestatus' });
  const cablePanel = make('div', {
    class: 'ag-sim-cable',
    id: 'agSimCablePanel',
    role: 'group',
    'aria-label': 'Kablo işlemleri',
    hidden: true,
  });
  const cableTool = make('button', {
    type: 'button',
    id: 'agSimCableTool',
    class: 'ag-sim-tool',
    title: 'Kablo aracı',
    'aria-label': 'Kablo aracı',
    'aria-pressed': 'false',
    'aria-controls': 'agSimCablePanel',
    text: '🔌',
  });
  stageFoot.append(stageStatus);

  const inspect = make('section', {
    class: 'card ag-sim-inspect',
    id: 'agSimInspect',
    'aria-label': 'İnceleme paneli',
  });
  const tabs = make('div', { class: 'ag-sim-tabs', role: 'tablist', 'aria-label': 'İnceleme' });
  const panes = {};
  for (const [key, label] of [
    ['port', 'Port'],
    ['device', 'Cihaz'],
    ['events', 'Olaylar'],
  ]) {
    const tab = make('button', {
      type: 'button',
      role: 'tab',
      id: 'agSimTab-' + key,
      'data-sim-tab': key,
      'aria-controls': 'agSimPane-' + key,
      text: label,
    });
    tabs.append(tab);
    panes[key] = make('div', {
      role: 'tabpanel',
      id: 'agSimPane-' + key,
      class: 'ag-sim-pane',
      'aria-labelledby': 'agSimTab-' + key,
    });
  }
  inspect.append(tabs, panes.port, panes.device, panes.events);
  body.append(task, stage, inspect);

  const dock = make('div', { class: 'ag-sim-dock', id: 'agSimDock' });
  const termPane = make('section', { class: 'ag-sim-termpane', 'aria-label': 'Terminal' });
  const termBar = make('div', { class: 'ag-sim-termbar' });
  const termTabs = make('div', {
    class: 'ag-sim-termtabs',
    id: 'agSimTermTabs',
    role: 'group',
    'aria-label': 'Terminal cihazı',
  });
  termBar.append(termTabs);
  termPane.append(termBar);
  const simPane = make('section', {
    class: 'ag-sim-simpane',
    id: 'agSimSimPane',
    'aria-labelledby': 'agSimSimTitle',
  });
  const simHead = make('div', { class: 'ag-sim-simhead' });
  const simTitle = make('span', { id: 'agSimSimTitle', text: 'Simulation Mode' });
  const timeline = make('ol', {
    class: 'ag-sim-timeline',
    id: 'agSimTimeline',
    'aria-label': 'Olay zaman çizelgesi',
  });
  simHead.append(simTitle);
  simPane.append(simHead, timeline);
  dock.append(termPane, simPane);

  // ---------------------------------------------------------------- yerleştirme
  const legacyHead = work.querySelector('.pt-head');
  const headActions = work.querySelector('.pt-head-actions');
  const addGroup = work.querySelector('.pt-addgroup');
  const connectGroup = work.querySelector('.pt-connectgroup');
  const deviceCard = work.querySelector('.pt-device-card:not(.pt-cli-card)');
  const cliCard = work.querySelector('.pt-cli-card');

  // Kablo aracı satırı: tuvalde iki cihaz seçme kipi ve kaynak/hedef ile bağlama.
  const connectMode = $('ptConnectMode');
  if (connectMode) cablePanel.append(connectMode);
  if (connectGroup) cablePanel.append(connectGroup);
  cableTool.addEventListener('click', () => {
    const open = cablePanel.hidden;
    cablePanel.hidden = !open;
    cableTool.setAttribute('aria-pressed', String(open));
    if (open) (connectMode || cablePanel.querySelector('select'))?.focus();
  });
  if (headActions) {
    // Kaydet ve Ağı denetle görünür; v12 kuralı (#ptWorkbench.ux-simple-lab .pt-head-actions)
    // dışa/içe aktarma, silme ve sıfırlamayı "Diğer işlemler" açılınca gösterir.
    stageFoot.append(headActions);
  }
  if (addGroup) {
    addGroup.classList.add('ag-sim-palette');
    addGroup.setAttribute('role', 'group');
    addGroup.setAttribute('aria-label', 'Cihaz ekle');
    const icons = { PC: '🖥', Switch: '🔀', Router: '📡', Server: '🗄' };
    addGroup.querySelector('span')?.remove();
    for (const b of addGroup.querySelectorAll('[data-pt-add]')) {
      const kind = b.dataset.ptAdd;
      b.textContent = icons[kind] || '＋';
      b.title = kind + ' ekle';
      b.setAttribute('aria-label', kind + ' ekle');
    }
    addGroup.append(make('i', { class: 'ag-sim-toolsep', 'aria-hidden': 'true' }), cableTool);
    stage.append(addGroup);
  }
  // Palet ayrı sütundur; düğümlerin üstüne binmez.
  stage.append(make('div', { class: 'ag-sim-canvaswrap' }, canvas), cablePanel, stageFoot);
  const canvasStatus = $('ptCanvasStatus'),
    workspaceEngine = $('workspaceEngine');
  if (canvasStatus) stageStatus.append(canvasStatus);
  if (workspaceEngine) stageStatus.append(workspaceEngine);

  // Cihaz sekmesi: seçili cihaz kartı (bilgi, denetim odağı, adlandırma).
  if (deviceCard) panes.device.append(deviceCard);
  // Olaylar sekmesi: Paket Dedektifi.
  const detective = $('packetDetectivePanel');
  if (detective) panes.events.append(detective);

  // Terminal: cihaz sekmeleri + seçim kutusu (çok cihazda), terminal, komut satırı.
  if (cliCard) {
    const cliSelect = $('ptCliDevice'),
      clear = $('ptClearTerminal');
    if (cliSelect) {
      cliSelect.setAttribute('aria-label', 'Terminal cihazı');
      termBar.append(cliSelect);
    }
    if (clear) termBar.append(clear);
    for (const id of ['ptTerminal', 'ptCliForm', 'ux14CliMore']) {
      const n = $(id);
      if (n) termPane.append(n);
    }
    cliCard.remove();
  }
  // Simulation Mode: mod düğmeleri, oynatma, durum, zaman çizelgesi ve olay listesi.
  // Sıra (taslak): başlık + mod düğmeleri, zaman çizelgesi, seçili olayın ayrıntısı; sonra
  // oynatma denetimleri, durum ve olay listesi (kaydırılarak).
  const modeBar = $('simulationModeBar');
  if (modeBar) simHead.append(modeBar);
  simPane.append(timeline);
  for (const id of ['simulationPlaybackControls', 'simulationStatus']) {
    const n = $(id);
    if (n) simPane.append(n);
  }
  const simPanel = $('simulationPanel');
  if (simPanel) simPane.append(simPanel);

  // Çalışma alanı: #ptWorkbench başlık + gövde + alt şerit olur.
  work.prepend(head, body, dock);
  // Kullanılmayan eski kabuklar (içerikleri taşındı).
  for (const sel of ['.pt-workgrid', '.pt-toolbar', '.ux14-workflow', '.ux-lab-guide']) {
    const n = work.querySelector(sel);
    if (n && !n.querySelector('[id]')) n.remove();
  }
  if (legacyHead && !legacyHead.querySelector('button, input, select')) legacyHead.remove();

  // ---------------------------------------------------------------- görev seç kartı
  const catalog = make('section', {
    class: 'card ag-sim-catalog',
    id: 'agSimCatalog',
    'aria-labelledby': 'agSimCatalogTitle',
  });
  catalog.append(
    make(
      'div',
      { class: 'ag-sim-catalog-head' },
      make('h2', { id: 'agSimCatalogTitle', text: 'Görev seç' }),
      make('p', {
        class: 'muted small',
        text: 'Akademi labı, Labber labı ya da hazır arıza senaryosu yukarıdaki çalışma alanında açılır. Seçmek çalışmanı değiştirmez; başlatmak topolojiyi değiştirir.',
      }),
    ),
  );
  const catalogGrid = make('div', { class: 'ag-sim-catalog-grid' });
  catalog.append(catalogGrid);
  const modes = $('ux14LabModes'),
    academySlot = $('ux14AcademySlot');
  if (modes) catalog.insertBefore(modes, catalogGrid);
  if (academySlot) catalogGrid.append(academySlot);
  for (const id of ['labberLabsPanel', 'sharedScenarioPanel', 'labExperiments']) {
    const n = $(id);
    if (n) catalogGrid.append(n);
  }
  const more = $('ux14LabMore');
  if (more) {
    $('uxLabScenarios')?.remove();
    catalog.append(more);
  }
  work.after(catalog);
  const heading = area.querySelector(':scope > .lab-heading');
  heading?.remove();

  // ---------------------------------------------------------------- bağlam
  // Görev kartının bölümleri: her bağlamın kendi öğeleri tek kapta; yalnız etkin olan görünür.
  const ctxBox = {};
  for (const key of ['academy', 'labber', 'shared', 'free']) {
    ctxBox[key] = {
      text: make('div', { 'data-ctx': key }),
      extra: make('div', { 'data-ctx': key }),
    };
    taskText.append(ctxBox[key].text);
    taskExtra.append(ctxBox[key].extra);
  }
  const put = (key, part, id) => {
    const n = $(id);
    if (n) ctxBox[key][part].append(n);
  };
  put('academy', 'text', 'academyLesson');
  put('academy', 'extra', 'academyAnswers');
  put('academy', 'extra', 'academyResult');
  put('labber', 'text', 'labberLabBrief');
  put('labber', 'extra', 'labberLabObjectives');
  put('labber', 'extra', 'labberLabStatus');
  put('shared', 'text', 'sharedScenarioInstructions');
  put('shared', 'extra', 'sharedScenarioStatus');
  put('shared', 'extra', 'troubleSharedBridge');
  ctxBox.free.text.append(
    make('p', {
      text: 'Serbest çalışma: cihaz ekle, kablo bağla, terminalden yapılandır ve ağı denetle. Bir görev açmak için “Görev seç”.',
    }),
  );
  put('free', 'extra', 'aglabFirstNetworkGuide');
  const academyHints = $('academyHints');
  const labberHints = make('ol', { id: 'agSimLabberHints', class: 'ag-sim-hintlist' });
  const hintCtx = {
    academy: make('div', { 'data-ctx': 'academy' }),
    labber: make('div', { 'data-ctx': 'labber' }),
  };
  if (academyHints) hintCtx.academy.append(academyHints);
  hintCtx.labber.append(labberHints);
  hintBox.append(hintCtx.academy, hintCtx.labber);

  // Üst çubuk düğmeleri: etkin bağlamın gerçek denetimleri (kimlikleri aynı).
  const choose = button('agSimChoose', 'Görev seç');
  const actx = {
    academy: make('span', { class: 'ag-sim-ctxactions', 'data-ctx': 'academy' }),
    labber: make('span', { class: 'ag-sim-ctxactions', 'data-ctx': 'labber' }),
    shared: make('span', { class: 'ag-sim-ctxactions', 'data-ctx': 'shared' }),
  };
  const academyReset = $('academyReset'),
    academyHint = $('academyHint'),
    academyCheck = $('academyCheck'),
    labberCheck = $('labberLabCheck');
  const labberReset = button('agSimLabberReset', 'Sıfırla'),
    labberHint = button('agSimLabberHint', 'İpucu');
  const sharedReset = button('agSimSharedReset', 'Sıfırla');
  for (const [b, text] of [
    [academyReset, 'Sıfırla'],
    [academyHint, 'İpucu'],
    [academyCheck, 'Kontrol et'],
    [labberCheck, 'Kontrol et'],
  ])
    if (b) {
      b.textContent = text;
      b.classList.add('ag-btn');
    }
  academyCheck?.classList.add('ag-btn-primary');
  labberCheck?.classList.add('ag-btn-primary');
  actx.academy.append(...[academyReset, academyHint, academyCheck].filter(Boolean));
  actx.labber.append(labberReset, labberHint, ...(labberCheck ? [labberCheck] : []));
  actx.shared.append(sharedReset);
  const solutionBtn = button('agSimSolutionBtn', 'Çözümü göster');
  solutionBtn.setAttribute('aria-describedby', 'agSimSolutionLock');
  const lockNote = make('span', { id: 'agSimSolutionLock', class: 'ag-sim-sr' });
  actions.append(choose, actx.academy, actx.labber, actx.shared, solutionBtn, lockNote);

  choose.addEventListener('click', () => {
    catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const first = catalog.querySelector('button, select');
    first?.focus({ preventScroll: true });
  });
  // Akademi'nin "mevcut çalışmayı değiştir" onayı, basılan düğmenin yanında açılır: üst
  // çubuktaki "Sıfırla" için görev kartının başında, katalogdaki "Başlat" için orada.
  const replacePrompt = $('academyReplacePrompt'),
    academyStartBtn = $('academyStart');
  if (replacePrompt && academyStartBtn) {
    const promptHome = make('div', { hidden: true });
    academyStartBtn.after(promptHome);
    academyReset?.addEventListener(
      'click',
      () => task.insertBefore(replacePrompt, task.firstChild.nextSibling),
      true,
    );
    academyStartBtn.addEventListener('click', () => promptHome.before(replacePrompt), true);
    promptHome.before(replacePrompt);
  }
  labberReset.addEventListener('click', () => {
    const id = window.aglabLabberLabs?.active();
    if (!id) return;
    $('labberLabSelect').value = id;
    $('labberLabStart').click();
  });
  sharedReset.addEventListener('click', () => {
    const s = window.aglabSharedEngine?.active();
    if (!s) return;
    $('sharedScenarioSelect').value = s.id;
    $('sharedScenarioLoad').click();
  });

  // ---------------------------------------------------------------- çözüm kilidi
  const lockState = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (e) {
      return {};
    }
  })();
  const lockSave = () => {
    try {
      localStorage.setItem(LOCK_KEY, JSON.stringify(lockState));
    } catch (e) {}
  };
  // Labber labının tanımı sabittir: düzenleyiciyle topoloji değişirse değerlendirme hata verir
  // (labber-labs-ui.js); çalışma alanı o durumda hedefleri boş gösterir, hata fırlatmaz.
  const labberGoals = () => {
    try {
      return window.aglabLabberLabs.goals() || [];
    } catch (e) {
      return [];
    }
  };
  const lockEntry = (key) => (lockState[key] ||= { fails: 0, hints: [] });
  function current() {
    const a = window.academy?.active?.();
    if (a) return { kind: 'academy', id: a.id, key: 'academy:' + a.id, info: a };
    const l = window.aglabLabberLabs?.active?.();
    if (l)
      return { kind: 'labber', id: l, key: 'labber:' + l, info: window.aglabLabberLabs.info(l) };
    const s = window.aglabSharedEngine?.active?.();
    if (s) return { kind: 'shared', id: s.id, key: 'shared:' + s.id, info: s };
    return { kind: 'free', id: null, key: null, info: null };
  }
  /** {hasSolution, unlocked, fails, hintsUsed, hintsTotal} */
  function lockStatus(c) {
    if (c.kind === 'academy') {
      const e = lockEntry(c.key);
      const total = c.info.hints,
        used = c.info.hintIndex;
      return {
        hasSolution: !!window.academy.solution(c.id),
        fails: e.fails,
        hintsUsed: used,
        hintsTotal: total,
        unlocked: e.fails >= SOLUTION_FAILS || (total > 0 && used >= total),
      };
    }
    if (c.kind === 'labber') {
      const e = lockEntry(c.key);
      const total = labberGoals().length;
      return {
        hasSolution: true,
        fails: e.fails,
        hintsUsed: e.hints.length,
        hintsTotal: total,
        unlocked: e.fails >= SOLUTION_FAILS || (total > 0 && e.hints.length >= total),
      };
    }
    // Ortak senaryoların ipucu/çözüm/kök neden düzeni Sorun Çöz ekranında (PR 3).
    return { hasSolution: false, unlocked: false, fails: 0, hintsUsed: 0, hintsTotal: 0 };
  }
  function renderSolution(c) {
    solutionSlot.replaceChildren();
    const box = make('section', {
      class: 'ag-sim-solution',
      id: 'agSimSolution',
      'aria-labelledby': 'agSimSolutionTitle',
    });
    box.append(make('h3', { id: 'agSimSolutionTitle', text: 'Çözüm' }));
    if (c.kind === 'academy') {
      const sol = window.academy.solution(c.id);
      box.append(make('p', { text: sol.explanation }));
      for (const [dev, cmds] of Object.entries(sol.reference_commands || {}))
        box.append(make('pre', { class: 'ag-term', text: dev + '\n' + cmds.join('\n') }));
      if (sol.command_note) box.append(make('p', { class: 'muted small', text: sol.command_note }));
    } else if (c.kind === 'labber') {
      for (const [dev, script] of Object.entries(window.aglabLabberLabs.solution(c.id)))
        box.append(
          make('pre', { class: 'ag-term', text: dev + ' (ayrıcalıklı moddan)\n' + script }),
        );
    }
    solutionSlot.append(box);
    box.scrollIntoView({ block: 'nearest' });
  }
  solutionBtn.addEventListener('click', () => {
    const c = current();
    const st = lockStatus(c);
    if (!st.hasSolution || !st.unlocked) return;
    renderSolution(c);
    solutionBtn.disabled = true;
  });
  document.addEventListener('aglab:academy-checked', (e) => {
    const c = current();
    if (c.kind !== 'academy' || c.id !== e.detail.id) return;
    if (e.detail.points < 100) {
      lockEntry(c.key).fails++;
      lockSave();
    }
    schedule();
  });
  labberCheck?.addEventListener('click', () => {
    const c = current();
    if (c.kind !== 'labber') return;
    const rows = labberGoals();
    if (rows.some((o) => !o.ok)) {
      lockEntry(c.key).fails++;
      lockSave();
    }
    schedule();
  });
  labberHint.addEventListener('click', () => {
    const c = current();
    if (c.kind !== 'labber') return;
    const e = lockEntry(c.key),
      rows = labberGoals();
    // Sıradaki ipucu: henüz gösterilmemiş ilk sağlanmamış hedef; yoksa gösterilmemiş ilk hedef.
    const next =
      rows.find((o) => !o.ok && !e.hints.includes(o.id)) ||
      rows.find((o) => !e.hints.includes(o.id));
    if (!next) return;
    e.hints.push(next.id);
    lockSave();
    schedule();
  });

  // ---------------------------------------------------------------- inceleme: Port
  const portTitle = make('h3', { id: 'agSimPortTitle' });
  const portSelect = make('select', { id: 'agSimPortSelect', 'aria-label': 'Port' });
  const props = make('dl', { class: 'ag-sim-props', id: 'agSimPortProps' });
  const quick = make('div', {
    class: 'ag-sim-quick',
    id: 'agSimQuick',
    role: 'group',
    'aria-label': 'Hızlı show komutları',
  });
  const showOut = make('pre', {
    class: 'ag-term ag-sim-showout',
    id: 'agSimShowOut',
    'aria-live': 'polite',
  });
  panes.port.append(
    make('div', { class: 'ag-sim-porthead' }, portTitle, portSelect),
    props,
    quick,
    showOut,
  );
  let portChoice = { dev: null, port: null },
    showChoice = null;
  const shortPort = (p) =>
    String(p)
      .replace(/^gigabitethernet/i, 'Gi')
      .replace(/^fastethernet/i, 'Fa')
      .replace(/^gi(?=\d)/i, 'Gi')
      .replace(/^fa(?=\d)/i, 'Fa')
      .replace(/^g(?=\d)/i, 'Gi');
  const longPort = (p) =>
    String(p)
      .replace(/^gi?(?=\d)/i, 'GigabitEthernet')
      .replace(/^fa(?=\d)/i, 'FastEthernet');
  function snapshot() {
    try {
      return window.academyEngine.snapshot();
    } catch (e) {
      return { devices: [], links: [], selected: '' };
    }
  }
  function quickCommands(dev, port, iface) {
    if (dev.type === 'PC') return ['show ip'];
    if (dev.type === 'Switch')
      return [
        iface?.mode === 'trunk'
          ? 'show interfaces trunk'
          : 'show interfaces ' + port + ' switchport',
        'show vlan brief',
        'show mac address-table',
      ];
    return ['show ip interface brief', 'show ip route', 'show interfaces ' + port];
  }
  function runShow(dev, line) {
    showChoice = line;
    for (const b of quick.querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b.dataset.show === line));
    let lines;
    try {
      lines = window.aglabLabberSession.peek(dev.id, line);
    } catch (e) {
      lines = ['% ' + (e.message || e)];
    }
    showOut.textContent =
      (window.aglabLabberSession.prompt(dev.id) || dev.name + '#').replace(/>$/, '>') +
      line +
      '\n' +
      (lines ? lines.join('\n') : '% Cihaz kapalı; konsol yanıt vermiyor.');
  }
  function renderPort() {
    const snap = snapshot();
    const dev = snap.devices.find((d) => d.id === snap.selected) || snap.devices[0];
    if (!dev) {
      portTitle.textContent = 'Cihaz yok';
      portSelect.replaceChildren();
      props.replaceChildren();
      quick.replaceChildren();
      showOut.textContent = '';
      return;
    }
    const ports = dev.ports || [];
    if (portChoice.dev !== dev.id || !ports.includes(portChoice.port)) {
      const linked = ports.find((p) =>
        snap.links.some(
          (l) => (l.a === dev.id && l.portA === p) || (l.b === dev.id && l.portB === p),
        ),
      );
      portChoice = { dev: dev.id, port: linked || ports[0] || null };
      showChoice = null;
    }
    const port = portChoice.port;
    if (
      portSelect.options.length !== ports.length ||
      [...portSelect.options].some((o, i) => o.value !== ports[i])
    )
      portSelect.replaceChildren(
        ...ports.map((p) => make('option', { value: p, text: shortPort(p) })),
      );
    portSelect.value = port || '';
    portTitle.textContent = dev.name + (port ? ' · ' + longPort(port) : '');
    const iface = (dev.interfaces || {})[port] || {};
    const link = snap.links.find(
      (l) => (l.a === dev.id && l.portA === port) || (l.b === dev.id && l.portB === port),
    );
    const peerId = link ? (link.a === dev.id ? link.b : link.a) : null,
      peerPort = link ? (link.a === dev.id ? link.portB : link.portA) : null,
      peer = snap.devices.find((d) => d.id === peerId);
    const adminUp = iface.enabled !== false && dev.enabled !== false;
    const lineUp =
      adminUp &&
      !!link &&
      link.up !== false &&
      peer?.enabled !== false &&
      ((peer?.interfaces || {})[peerPort]?.enabled ?? true) !== false;
    const rows = [];
    if (dev.type === 'Switch') {
      rows.push(['Mod', iface.mode || 'access']);
      if (iface.mode === 'trunk') {
        rows.push(['Kapsülleme', '802.1Q']);
        rows.push(['Native VLAN', String(iface.native ?? 1)]);
        rows.push(['İzinli VLAN', (iface.allowed || []).join(', ') || 'tümü']);
      } else rows.push(['Access VLAN', String(iface.vlan ?? 1)]);
    } else if (dev.type === 'Router') {
      rows.push(['IP', iface.ip ? iface.ip + (iface.mask ? ' / ' + iface.mask : '') : 'atanmamış']);
    } else {
      rows.push(['IP', dev.ip ? dev.ip + (dev.mask ? ' / ' + dev.mask : '') : 'atanmamış']);
      rows.push(['Ağ geçidi', dev.gateway || '—']);
    }
    rows.push([
      'Durum',
      !adminUp ? 'administratively down' : lineUp ? 'up / up' : 'down / down',
      !adminUp || !lineUp ? 'bad' : 'ok',
    ]);
    rows.push(['Komşu', peer ? peer.name + ' ' + shortPort(peerPort) : '—']);
    props.replaceChildren(
      ...rows.flatMap(([k, v, cls]) => [
        make('dt', { text: k }),
        make('dd', { class: cls, text: v }),
      ]),
    );
    const cmds = quickCommands(dev, shortPort(port || ''), iface);
    quick.replaceChildren(
      ...cmds.map((c) => {
        const b = make('button', { type: 'button', class: 'ag-chip', 'data-show': c, text: c });
        b.addEventListener('click', () => runShow(dev, c));
        return b;
      }),
    );
    runShow(dev, cmds.includes(showChoice) ? showChoice : cmds[0]);
  }
  portSelect.addEventListener('change', () => {
    portChoice.port = portSelect.value;
    showChoice = null;
    renderPort();
  });

  // ---------------------------------------------------------------- sekmeler
  let activeTab = 'port';
  function selectTab(key, focus = false) {
    activeTab = key;
    for (const t of tabs.children) {
      const on = t.dataset.simTab === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== key;
    if (key === 'port') renderPort();
  }
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sim-tab]');
    if (t) selectTab(t.dataset.simTab);
  });
  tabs.addEventListener('keydown', (e) => {
    const keys = Object.keys(panes),
      i = keys.indexOf(activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      selectTab(keys[(i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length], true);
    }
  });
  // Olaylar sekmesi yeni ping izinde güncellenir: sekme açıksa hemen, değilse sekme açılınca
  // (öğrenci olayları bakınca görür; "Son olayları göster"e ayrıca basması gerekmez). Kapalı
  // sekmede gelen iz sekme düğmesinde "yeni" işaretiyle belirtilir.
  let traceUnseen = false;
  const eventsTab = tabs.querySelector('[data-sim-tab="events"]');
  const refreshDetective = () => {
    traceUnseen = false;
    eventsTab.removeAttribute('data-new');
    const r = $('packetDetectiveRefresh');
    if (r && !r.disabled) r.click();
  };
  document.addEventListener('aglab:trace-ready', () => {
    if (activeTab === 'events') refreshDetective();
    else {
      traceUnseen = true;
      eventsTab.setAttribute('data-new', 'true');
    }
  });
  eventsTab.addEventListener('click', () => {
    if (traceUnseen) refreshDetective();
  });
  // Paket Dedektifi'ne gönderilen olaylar (Simulation Mode'dan) Olaylar sekmesini açar.
  document.addEventListener('aglab:detective-select', () => selectTab('events'));

  // ---------------------------------------------------------------- terminal sekmeleri
  const cliSelect = $('ptCliDevice');
  function renderTermTabs() {
    if (!cliSelect) return;
    const opts = [...cliSelect.options];
    const sig = opts.map((o) => o.value + ':' + o.textContent).join('|') + '#' + cliSelect.value;
    if (termTabs.dataset.sig === sig) return;
    termTabs.dataset.sig = sig;
    termTabs.replaceChildren(
      ...opts.map((o) => {
        const b = make('button', {
          type: 'button',
          class: 'ag-sim-termtab',
          'data-dev': o.value,
          'aria-pressed': String(o.value === cliSelect.value),
          title: o.textContent,
          text: o.textContent.split(' · ')[0],
        });
        b.addEventListener('click', () => {
          cliSelect.value = o.value;
          cliSelect.dispatchEvent(new Event('change', { bubbles: true }));
          renderTermTabs();
          $('ptCliInput')?.focus();
        });
        return b;
      }),
    );
  }
  cliSelect?.addEventListener('change', () => renderTermTabs());

  // ---------------------------------------------------------------- zaman çizelgesi
  const simRows = $('simulationRows');
  // Satırlar değişince çizelge yeniden kurulur; yalnız seçili olay değişince (oynatma) noktalar
  // yerinde güncellenir (düğmeler yeniden oluşturulmaz). Etiketler taslaktaki gibi ARP/ICMP
  // Req/Rep; altında seçili olayın ayrıntı satırları (motor kaydının alanları, tahmin yok).
  const eventDetail = make('pre', {
    class: 'ag-sim-eventdetail',
    id: 'agSimEventDetail',
    'aria-live': 'polite',
  });
  timeline.after(eventDetail);
  const KIND_LABEL = {
    'icmp-request': ['ICMP Req', 'ICMP Echo Request'],
    'icmp-reply': ['ICMP Rep', 'ICMP Echo Reply'],
    'arp-request': ['ARP Req', 'ARP Request'],
    'arp-reply': ['ARP Rep', 'ARP Reply'],
  };
  const devName = (id) => snapshot().devices.find((d) => d.id === id)?.name || id || '—';
  function traceEvents() {
    try {
      const bySeq = new Map();
      for (const e of window.aglabSimulation.trace().events || []) bySeq.set(String(e.sequence), e);
      return bySeq;
    } catch (e) {
      return new Map();
    }
  }
  // Olay etiketi: çerçeve türü (ARP/ICMP Req/Rep); çerçevesiz sonuç olayları kendi adıyla.
  const RESULT_LABEL = {
    'icmp-delivered': 'Teslim',
    'icmp-undelivered': 'Ulaşmadı',
    discard: 'Atıldı',
    diagnostic: 'Tanı',
  };
  function eventLabel(e, fallback) {
    const f = e?.frame || {};
    let k = f.kind || e?.detail?.protocol;
    if (!KIND_LABEL[k] && f.icmp)
      k = f.icmp.type === 8 ? 'icmp-request' : f.icmp.type === 0 ? 'icmp-reply' : k;
    if (!KIND_LABEL[k] && f.arp) k = /req/i.test(f.arp.operation) ? 'arp-request' : 'arp-reply';
    return (KIND_LABEL[k] || [])[0] || RESULT_LABEL[e?.kind] || f.protocol || fallback || '—';
  }
  function eventDetailText(e, seq) {
    if (!e) return '';
    const f = e.frame || {},
      k = KIND_LABEL[f.kind];
    const where = e.edge
      ? devName(e.edge.a) +
        ' ' +
        shortPort(e.edge.portA || '') +
        ' → ' +
        devName(e.edge.b) +
        ' ' +
        shortPort(e.edge.portB || '')
      : devName(e.device);
    const pad = (t) => (t + '          ').slice(0, 10);
    const lines = [seq + '  ' + ((k && k[1]) || f.protocol || e.kind) + '   ' + where];
    if (f.sourceMac || f.destinationMac)
      lines.push(
        '   ' + pad('Ethernet') + (f.sourceMac || '?') + ' → ' + (f.destinationMac || '?'),
      );
    if (f.vlan !== undefined && f.vlan !== null) lines.push('   ' + pad('VLAN') + f.vlan);
    if (f.arp)
      lines.push(
        '   ' +
          pad('ARP') +
          (f.arp.operation || '') +
          ' ' +
          (f.arp.senderIp || '?') +
          ' → ' +
          (f.arp.targetIp || '?'),
      );
    if (f.ipv4)
      lines.push(
        '   ' +
          pad('IPv4') +
          f.ipv4.sourceIp +
          ' → ' +
          f.ipv4.destinationIp +
          (f.ipv4.ttl !== undefined ? '  TTL ' + f.ipv4.ttl : ''),
      );
    if (e.kind === 'discard' || e.kind === 'diagnostic')
      lines.push('   ' + pad('Neden') + (e.detail?.reason || '—'));
    return lines.join('\n');
  }
  function renderTimeline() {
    const hidden = !simPanel || simPanel.hidden;
    timeline.hidden = hidden;
    eventDetail.hidden = hidden;
    const rows = simRows ? [...simRows.children] : [];
    if (hidden || !rows.length) {
      timeline.replaceChildren();
      delete timeline.dataset.sig;
      eventDetail.textContent = '';
      simTitle.textContent = 'Simulation Mode';
      return;
    }
    const events = traceEvents();
    const sig = rows.map((r) => r.dataset.pos + ':' + r.textContent).join('|');
    if (timeline.dataset.sig !== sig) {
      timeline.dataset.sig = sig;
      timeline.replaceChildren(
        ...rows.map((r, i) => {
          const cells = r.querySelectorAll('td');
          const seq = cells[0]?.textContent || String(i + 1);
          const label = eventLabel(events.get(seq), cells[3]?.textContent);
          const b = make(
            'button',
            {
              type: 'button',
              class: 'ag-sim-tick',
              'aria-label': 'Olay ' + seq + ': ' + label,
            },
            make('i', { class: 'ag-sim-dot' }),
            make('span', { text: label }),
          );
          b.addEventListener('click', () => r.click());
          return make('li', {}, b);
        }),
      );
    }
    const cur = rows.findIndex((r) => r.getAttribute('aria-selected') === 'true');
    [...timeline.children].forEach((li, i) => {
      if (i === cur) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    const curSeq = cur >= 0 ? rows[cur].querySelector('td')?.textContent : null;
    eventDetail.textContent = curSeq
      ? eventDetailText(events.get(curSeq), curSeq)
      : 'Bir olay seç ya da İleri / Oynat ile kaydı izle.';
    const first = events.get(rows[0].querySelector('td')?.textContent || '');
    const ping =
      first?.frame?.ipv4 && first.device
        ? devName(first.device) + ' → ' + first.frame.ipv4.destinationIp + ' ping · '
        : '';
    simTitle.textContent =
      'Simulation Mode · ' + ping + 'olay ' + (cur >= 0 ? cur + 1 : 0) + ' / ' + rows.length;
    scrollTick(cur);
  }
  function scrollTick(cur) {
    const li = timeline.children[cur];
    if (!li) return;
    const l = li.offsetLeft - timeline.offsetLeft,
      r = l + li.offsetWidth;
    if (l < timeline.scrollLeft) timeline.scrollLeft = l;
    else if (r > timeline.scrollLeft + timeline.clientWidth)
      timeline.scrollLeft = r - timeline.clientWidth;
  }
  if (simRows)
    new MutationObserver(renderTimeline).observe(simRows, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
  if (simPanel)
    new MutationObserver(renderTimeline).observe(simPanel, {
      attributes: true,
      attributeFilter: ['hidden'],
    });

  // ---------------------------------------------------------------- görev kartı
  function renderGoals(c) {
    let rows = null;
    try {
      if (c.kind === 'academy') rows = window.academy.goals();
      else if (c.kind === 'labber')
        rows = labberGoals().map((o) => ({
          id: o.id,
          label: o.title,
          ok: o.ok,
        }));
    } catch (e) {
      rows = null;
    }
    goals.hidden = !rows || !rows.length;
    // Labber labında #labberLabObjectives ayrıntıyı taşır; canlı liste aynı hedeflerdir.
    goals.replaceChildren(
      ...(rows || []).map((r) =>
        make(
          'li',
          { 'data-ok': String(!!r.ok), 'data-goal': r.id },
          make('i', { class: 'ag-check', 'aria-hidden': 'true' }),
          make(
            'span',
            {},
            make('span', { class: 'ag-sim-sr', text: r.ok ? 'Sağlandı: ' : 'Sağlanmadı: ' }),
            r.label,
          ),
        ),
      ),
    );
  }
  function renderLabberHints(c) {
    if (c.kind !== 'labber') {
      labberHints.replaceChildren();
      return;
    }
    const e = lockEntry(c.key),
      rows = labberGoals();
    labberHints.replaceChildren(
      ...e.hints
        .map((id) => rows.find((o) => o.id === id))
        .filter(Boolean)
        .map((o) => make('li', {}, make('b', { text: o.title + ': ' }), o.hint)),
    );
  }
  function engineText(c) {
    const src =
      c.kind === 'academy'
        ? $('academyEngineBadge')
        : c.kind === 'labber'
          ? $('labberLabEngine')
          : c.kind === 'shared'
            ? $('sharedScenarioEngine')
            : workspaceEngine;
    const text = (src?.textContent || workspaceEngine?.textContent || '').trim();
    if (!text) return '';
    return text.split(/ — | \(|\. /)[0].replace(/\.$/, '');
  }
  let lastKey = null;
  /** Bağlam geçişi (hangi görevin öğeleri görünür) ucuzdur ve hemen yapılır. */
  function syncContext() {
    const c = current();
    if (c.key !== lastKey) {
      lastKey = c.key;
      solutionSlot.replaceChildren();
      solutionBtn.disabled = false;
    }
    if (work.dataset.ctx !== c.kind) {
      work.dataset.ctx = c.kind;
      for (const n of work.querySelectorAll('[data-ctx]')) n.hidden = n.dataset.ctx !== c.kind;
    }
    return c;
  }
  function refresh() {
    const c = syncContext();
    title.textContent =
      'Simülatör · ' +
      (c.kind === 'academy'
        ? c.id + ' ' + c.info.title
        : c.kind === 'labber'
          ? c.info?.title || c.id
          : c.kind === 'shared'
            ? c.info.title
            : 'Serbest çalışma');
    const eng = engineText(c);
    engineTag.textContent = eng;
    engineTag.hidden = !eng;
    engineTag.dataset.engine = /Labber/.test(eng) ? 'labber' : eng ? 'other' : '';
    const st = lockStatus(c);
    if (c.kind === 'academy') {
      const left = Math.max(0, st.hintsTotal - st.hintsUsed);
      academyHint.textContent = 'İpucu (' + left + ')';
    }
    if (c.kind === 'labber') {
      const left = Math.max(0, st.hintsTotal - st.hintsUsed);
      labberHint.textContent = 'İpucu (' + left + ')';
      labberHint.disabled = left === 0;
    }
    meta.textContent =
      c.kind === 'academy' || c.kind === 'labber'
        ? 'Başarısız kontrol: ' + st.fails + ' · ipucu ' + st.hintsUsed + '/' + st.hintsTotal
        : '';
    solutionBtn.hidden = !st.hasSolution;
    const shown = !!$('agSimSolution');
    solutionBtn.disabled = !st.unlocked || shown;
    solutionBtn.textContent = st.unlocked ? 'Çözümü göster' : '🔒 Çözümü göster';
    lockNote.textContent = st.unlocked
      ? 'Çözüm kilidi açık.'
      : 'Çözüm ' +
        SOLUTION_FAILS +
        ' başarısız kontrolden ya da bütün ipuçları kullanıldıktan sonra açılır.';
    solutionBtn.title = lockNote.textContent;
    hintBox.hidden = !(
      (c.kind === 'academy' && st.hintsUsed > 0) ||
      (c.kind === 'labber' && st.hintsUsed > 0)
    );
    renderGoals(c);
    renderLabberHints(c);
    renderTermTabs();
    if (activeTab === 'port') renderPort();
    renderTimeline();
  }
  // Art arda komutlar (yapıştırılan yapılandırma, hazır çözüm) tek yenilemeye toplanır: canlı
  // hedefler her ölçütü Labber'da sorgular; yazma durunca bir kez hesaplanır.
  let pending = 0;
  function schedule() {
    syncContext();
    clearTimeout(pending);
    pending = setTimeout(() => {
      pending = 0;
      refresh();
    }, 120);
  }
  // Topoloji, terminal ve görev panellerindeki değişiklikler (çizim yeniden yapılır, terminale
  // satır eklenir, ipucu listesi büyür) görev kartını ve inceleme panelini yeniler.
  const watch = (n, opts) => n && new MutationObserver(schedule).observe(n, opts);
  watch(canvas, { childList: true });
  watch($('ptTerminal'), { childList: true });
  watch(academyHints, { childList: true });
  watch($('academyNotice'), { childList: true, characterData: true, subtree: true });
  watch($('labberLabStatus'), { childList: true, characterData: true, subtree: true });
  watch($('sharedScenarioStatus'), { childList: true, characterData: true, subtree: true });
  watch(workspaceEngine, { childList: true, characterData: true, subtree: true });
  watch(cliSelect, { childList: true });
  academyHint?.addEventListener('click', schedule);
  selectTab('port');
  refresh();
  window.aglabSimWorkspace = {
    context: () => {
      const c = current();
      return { kind: c.kind, id: c.id };
    },
    lock: () => {
      const st = lockStatus(current());
      return { ...st, threshold: SOLUTION_FAILS };
    },
    tab: (key) => selectTab(key),
    refresh,
  };
})();
