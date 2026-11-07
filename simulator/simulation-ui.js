// Simulation Mode V1: replay an immutable observation of the existing engine.
// Never calls ping, routeLookup, forwarding, saveTopology, or a native Lab API.
(function () {
  'use strict';
  const canvas = document.getElementById('ptCanvas'),
    work = document.getElementById('ptWorkbench');
  if (!canvas || !work) return;
  const model = AgLabSimulationPlayback.createTimeline(),
    motion = matchMedia('(prefers-reduced-motion: reduce)');
  const make = (tag, id, text) => {
    const n = document.createElement(tag);
    if (id) n.id = id;
    if (text) n.textContent = text;
    return n;
  };
  const bar = make('div', 'simulationModeBar');
  bar.className = 'simulation-controls';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Laboratuvar çalışma modu');
  const realtime = make('button', 'simulationRealtime', 'Realtime · Çalış'),
    simulation = make('button', 'simulationMode', 'Simulation · İncele');
  bar.append(realtime, simulation);
  canvas.before(bar);
  const panel = make('section', 'simulationPanel');
  panel.setAttribute('aria-labelledby', 'simulationTitle');
  panel.hidden = true;
  panel.append(make('h3', 'simulationTitle', 'Simulation Mode · motor kaydını yeniden oynat'));
  panel.append(
    make(
      'p',
      null,
      'Kaynak: AğLab JS · ARP/ICMP eğitim modeli. Kayıt oynatımı yeni paket göndermez; gerçek Lab veya PCAP değildir. Geçmiş bu sayfada tutulur, yenilemede silinir.',
    ),
  );
  const limits = make('details');
  limits.append(
    make('summary', null, 'Destek ve kayıt sınırları'),
    make(
      'p',
      null,
      'Hız yalnız görselleştirme süresidir, ağ gecikmesi değildir. TCP/UDP ve gerçek Lab/NetSim kayıtları burada canlandırılmaz. Bir aktarım kaydı tek başına hedef IP’ye teslim garantisi vermez.',
    ),
  );
  panel.append(limits);
  const controls = make('div', 'simulationPlaybackControls');
  controls.className = 'simulation-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Simulation oynatma');
  controls.hidden = true;
  const capture = make('button', 'simulationCapture', 'Kaydı al'),
    forward = make('button', 'simulationForward', 'İleri →'),
    play = make('button', 'simulationPlay', 'Oynat'),
    pause = make('button', 'simulationPause', 'Duraklat'),
    reset = make('button', 'simulationReset', 'Başa dön');
  const speedLabel = make('label', null, 'Hız '),
    speed = make('select', 'simulationSpeed');
  for (const v of [0.5, 1, 2, 4]) {
    const o = make('option', null, v + 'x');
    o.value = v;
    speed.append(o);
  }
  speed.value = '1';
  speedLabel.append(speed);
  const animationLabel = make('label'),
    animation = make('input', 'simulationAnimation');
  animation.type = 'checkbox';
  animation.checked = !motion.matches;
  animation.disabled = motion.matches;
  animationLabel.append(animation, document.createTextNode(' Animasyon'));
  const filterLabel = make('label', null, 'Olaylar '),
    filter = make('select', 'simulationFilter');
  for (const [v, label] of [
    ['all', 'Tümü'],
    ['ARP', 'ARP'],
    ['ICMP', 'ICMP'],
    ['diagnostic', 'Tanı / ret'],
  ]) {
    const o = make('option', null, label);
    o.value = v;
    filter.append(o);
  }
  filterLabel.append(filter);
  controls.append(capture, forward, play, pause, reset, speedLabel, animationLabel, filterLabel);
  panel.append(controls);
  const status = make('p', 'simulationStatus');
  status.setAttribute('role', 'status');
  panel.append(status);
  bar.after(controls);
  controls.after(status);
  status.hidden = true;
  const columns = make('div');
  columns.className = 'simulation-columns';
  const eventsBox = make('details', 'simulationEvents');
  eventsBox.open = innerWidth > 700;
  eventsBox.append(make('summary', null, 'Olay listesi · seçmek için satıra dokun / Enter'));
  const table = make('table');
  table.append(make('caption', null, 'Motor sırası korunur. Liste en fazla 25 satır gösterir.'));
  const header = make('thead'),
    heading = make('tr');
  for (const s of ['Sıra', 'Kaynak', 'Hedef', 'Protokol', 'Durum'])
    heading.append(make('th', null, s));
  header.append(heading);
  table.append(header);
  const rows = make('tbody', 'simulationRows');
  table.append(rows);
  const scroll = make('div');
  scroll.className = 'simulation-table';
  scroll.append(table);
  eventsBox.append(scroll);
  const paging = make('div');
  paging.className = 'simulation-controls';
  const prevPage = make('button', 'simulationPreviousPage', '← Önceki sayfa'),
    nextPage = make('button', 'simulationNextPage', 'Sonraki sayfa →'),
    pageText = make('span', 'simulationPage');
  paging.append(prevPage, pageText, nextPage);
  eventsBox.append(paging);
  const details = make('section', 'simulationDetails');
  details.setAttribute('aria-labelledby', 'simulationDetailsTitle');
  details.append(make('h4', 'simulationDetailsTitle', 'Paket ayrıntıları'));
  const explanation = make('p', 'simulationExplanation'),
    fields = make('dl', 'simulationFields'),
    raw = make('pre', 'simulationRaw');
  raw.style.whiteSpace = 'pre-wrap';
  const hint = make('p', 'simulationHint');
  hint.setAttribute('role', 'note');
  const explain = make('button', 'simulationExplain', 'Paket Dedektifi’nde açıkla');
  explain.disabled = true;
  const rawBox = make('details');
  rawBox.append(make('summary', null, 'Motor kaydı (ayrıntılı)'), raw);
  details.append(
    explanation,
    hint,
    fields,
    make(
      'p',
      null,
      'Model alanlarıdır; ham paket değildir. Boş değerler tahmin edilmez. VLAN mantıksal bağlamdır, tel üzerindeki 802.1Q etiketi değildir.',
    ),
    rawBox,
    explain,
  );
  columns.append(eventsBox, details);
  panel.append(columns);
  work.querySelector('.pt-workgrid').after(panel);
  const style = make('style');
  style.textContent = `
 #simulationPanel{margin-top:14px;padding:14px;border:1px solid var(--line,#3b5277);border-radius:12px;min-width:0;overflow-wrap:anywhere}
 #simulationPanel[hidden],.simulation-controls[hidden],#simulationStatus[hidden]{display:none!important}.simulation-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0}.simulation-controls button{width:auto;min-height:44px}
 #simulationModeBar button[aria-pressed=true]{outline:2px solid var(--cyan,#63e1d0);outline-offset:2px}
 .simulation-controls label{display:flex;align-items:center;gap:5px;min-height:44px;max-width:100%}.simulation-controls select{width:auto;max-width:100%}.simulation-controls input[type=checkbox]{width:20px;height:20px;min-width:20px}.simulation-columns{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px}.simulation-columns>*{min-width:0}
 .simulation-table{max-height:350px;overflow:auto}#simulationPanel table{border-collapse:collapse;width:100%;font-size:12px}#simulationPanel th,#simulationPanel td{padding:6px;border-bottom:1px solid var(--line,#3b5277);overflow-wrap:anywhere;text-align:left}
 #simulationPanel caption{text-align:left;padding:6px}#simulationPanel tr[aria-selected=true]{outline:2px solid var(--cyan,#63e1d0);outline-offset:-2px}#simulationPanel td button{min-height:44px;width:auto}
 #simulationFields{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,2fr);gap:5px;font-size:12px}#simulationFields dd{margin:0;overflow-wrap:anywhere}#simulationRaw{max-height:150px;overflow:auto;overflow-wrap:anywhere}
 body.aglab-simulation-mode #ptPacketStep,body.aglab-simulation-mode #ptCanvas .pt-packet-dot,body.aglab-simulation-mode #ptCanvas .pt-packet-label,body.aglab-simulation-mode .pt-side>.pt-cli-card{display:none}
 @media(max-width:700px){.simulation-columns{display:block}#simulationDetails{margin-top:14px}.simulation-table{max-height:250px}#simulationPanel{padding:10px}}
 `;
  document.head.append(style);
  let active = false,
    captured = { origin: 'aglab-js', events: [], legacy: [] },
    raf = 0,
    lastTime = 0,
    progress = 1,
    page = 0,
    rowsKey = '',
    version = 0,
    stale = false,
    overlay = null,
    dot = null,
    label = null,
    packetHit = null,
    motionRunning = false;
  let canvasVisible = true;
  new IntersectionObserver((entries) => {
    canvasVisible = entries[0].isIntersecting;
    if (!canvasVisible && raf) {
      stop();
      render();
    }
  }).observe(canvas);
  const protocol = (e) =>
    e?.frame?.protocol ||
    (e?.kind === 'ttl'
      ? 'IPv4'
      : e?.raw?.includes('icmp-')
        ? 'ICMP'
        : e?.raw?.includes('arp-')
          ? 'ARP'
          : '—');
  const name = (id) => get(id)?.name || id || '—';
  const result = (e) =>
    e.kind === 'diagnostic'
      ? 'Motor tanısı'
      : e.kind === 'discard'
        ? 'Reddedildi'
        : e.kind === 'icmp-undelivered'
          ? 'ICMP yanıtı ulaşmadı'
          : e.kind === 'icmp-delivered'
            ? 'ICMP teslim edildi'
            : e.kind === 'wire'
              ? 'Çerçeve aktarımı'
              : e.kind === 'receive'
                ? 'Alındı'
                : e.kind === 'frame'
                  ? 'Oluşturuldu'
                  : e.kind === 'forward'
                    ? 'L2 karar'
                    : e.kind === 'learn'
                      ? 'MAC öğrenme'
                      : e.kind === 'ttl'
                        ? 'TTL azaltıldı'
                        : 'Motor kaydı';
  function stop() {
    model.pause();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
    motionRunning = false;
    pause.disabled = true;
  }
  function unchanged() {
    stale = !!captured.events.length && captured.topologyKey !== ethernetTopologyFingerprint();
    if (stale) {
      stop();
      hide();
    }
    return !stale;
  }
  function hide() {
    if (overlay) overlay.setAttribute('display', 'none');
  }
  function ensureOverlay() {
    if (overlay && canvas.contains(overlay)) return;
    const ns = 'http://www.w3.org/2000/svg';
    overlay = document.createElementNS(ns, 'g');
    overlay.id = 'simulationOverlay';
    overlay.setAttribute('pointer-events', 'none');
    dot = document.createElementNS(ns, 'circle');
    dot.id = 'simulationPacket';
    dot.setAttribute('r', '8');
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '2');
    label = document.createElementNS(ns, 'text');
    label.setAttribute('fill', '#fff');
    label.setAttribute('stroke', '#0b1726');
    label.setAttribute('stroke-width', '3');
    label.setAttribute('paint-order', 'stroke');
    label.setAttribute('font-size', '12');
    packetHit = document.createElementNS(ns, 'circle');
    packetHit.id = 'simulationPacketHit';
    packetHit.setAttribute('r', '22');
    packetHit.setAttribute('fill', 'transparent');
    packetHit.setAttribute('role', 'button');
    const inspect = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (packetHit.getAttribute('aria-disabled') === 'true') return;
      stop();
      render();
      details.scrollIntoView({ block: 'nearest' });
      const h = document.getElementById('simulationDetailsTitle');
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    };
    packetHit.addEventListener('click', inspect);
    packetHit.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') inspect(event);
    });
    overlay.append(dot, label, packetHit);
    canvas.append(overlay);
  }
  function paint(value) {
    const e = model.state().event;
    if (!active || !e || stale) {
      hide();
      return;
    }
    if (!animation.checked || motion.matches) value = 1;
    let point = null;
    if (e.kind === 'wire') {
      const visible = links.filter((l) => get(l.a) && get(l.b)),
        i = AgLabSimulationPlayback.matchWire(e, visible),
        line = i >= 0 ? canvas.querySelectorAll('line.pt-edge')[i] : null;
      if (line) {
        let p = {
          x1: +line.getAttribute('x1'),
          y1: +line.getAttribute('y1'),
          x2: +line.getAttribute('x2'),
          y2: +line.getAttribute('y2'),
        };
        if (visible[i].a !== e.edge.a) p = { x1: p.x2, y1: p.y2, x2: p.x1, y2: p.y1 };
        point = AgLabSimulationPlayback.interpolate(p, value);
      }
    } else if (['frame', 'receive', 'discard', 'learn', 'ttl'].includes(e.kind) && get(e.device)) {
      const d = get(e.device);
      point = { x: d.x, y: d.y };
    }
    if (!point) {
      hide();
      return;
    }
    const box = canvas.viewBox.baseVal;
    if (
      point.x < box.x ||
      point.x > box.x + box.width ||
      point.y < box.y ||
      point.y > box.y + box.height
    ) {
      hide();
      return;
    }
    ensureOverlay();
    overlay.removeAttribute('display');
    overlay.setAttribute('data-event-id', e.eventId);
    dot.setAttribute('cx', point.x);
    dot.setAttribute('cy', point.y);
    dot.setAttribute(
      'fill',
      e.kind === 'discard'
        ? '#b91c1c'
        : protocol(e) === 'ARP'
          ? '#d97706'
          : protocol(e) === 'ICMP'
            ? '#2563eb'
            : '#475569',
    );
    label.setAttribute('x', point.x + 12);
    label.setAttribute('y', point.y - 10);
    // The Academy guide observes SVG childList mutations. Updating identical text
    // each RAF would make that unrelated guide rebuild at animation frequency.
    const caption = (e.kind === 'discard' ? '× ' : protocol(e) + ' · ') + result(e);
    if (label.textContent !== caption) label.textContent = caption;
    const safe =
      e.kind === 'wire' &&
      !motionRunning &&
      !model.state().playing &&
      !devices.some(
        (d) => Math.abs(point.x - d.x) <= d.w / 2 + 24 && Math.abs(point.y - d.y) <= d.h / 2 + 24,
      );
    packetHit.setAttribute('cx', point.x);
    packetHit.setAttribute('cy', point.y);
    packetHit.setAttribute('pointer-events', safe ? 'fill' : 'none');
    packetHit.setAttribute('tabindex', safe ? '0' : '-1');
    packetHit.setAttribute('aria-disabled', String(!safe));
    packetHit.setAttribute('aria-label', protocol(e) + ' paket ayrıntılarını aç');
    packetHit.style.cursor = safe ? 'pointer' : 'default';
  }
  function renderRows() {
    const events = model.events(),
      key = version + ':' + page;
    if (rowsKey !== key) {
      rowsKey = key;
      rows.replaceChildren();
      for (let i = page * 25; i < Math.min(events.length, (page + 1) * 25); i++) {
        const e = events[i],
          r = make('tr');
        r.dataset.pos = i;
        r.setAttribute('aria-selected', 'false');
        const first = make('td'),
          button = make('button', null, String(e.sequence));
        button.setAttribute(
          'aria-label',
          'Motor olayı ' + e.sequence + ': ' + protocol(e) + ' ' + result(e),
        );
        first.append(button);
        r.append(first);
        for (const value of [name(e.edge?.a || e.device), name(e.edge?.b), protocol(e), result(e)])
          r.append(make('td', null, value));
        r.onclick = () => select(i, false);
        rows.append(r);
      }
    }
    for (const row of rows.children)
      row.setAttribute(
        'aria-selected',
        Number(row.dataset.pos) === model.state().cursor ? 'true' : 'false',
      );
    prevPage.disabled = page === 0;
    nextPage.disabled = (page + 1) * 25 >= events.length;
    pageText.textContent = events.length
      ? page + 1 + ' / ' + Math.ceil(events.length / 25)
      : '0 / 0';
  }
  function renderDetails() {
    const e = model.state().event;
    fields.replaceChildren();
    explain.disabled = !e;
    raw.textContent = e?.raw || '';
    explanation.textContent = e
      ? AgLabPacketEvents.explain(e)
      : 'Önce CLI ile ping/Ethernet testi yap, kaydı al ve bir olay seç.';
    hint.textContent = e ? AgLabPacketEvents.diagnose({ events: [e] }).issues[0]?.hint || '' : '';
    hint.hidden = !hint.textContent;
    if (!e) return;
    const f = e.frame || {},
      ip = f.ipv4 || e.ipv4 || {},
      arp = f.arp || {},
      icmp = f.icmp || {};
    const values = [
      ['Motor sırası', e.sequence],
      ['Kayıt kimliği', e.eventId],
      ['Protokol', protocol(e)],
      ['Durum', result(e)],
    ];
    if (e.frame)
      values.push(
        ['Source MAC', f.sourceMac],
        ['Destination MAC', f.destinationMac],
        ['EtherType (model)', f.etherType],
        ['Mantıksal VLAN', f.vlan],
      );
    if (e.edge || e.ingressPort || e.detail?.ingress || e.detail?.port)
      values.push([
        e.edge ? 'Alıcı giriş portu' : 'Giriş portu',
        e.edge?.portB || e.ingressPort || e.detail?.ingress || e.detail?.port,
      ]);
    if (e.edge || Array.isArray(e.detail?.egress))
      values.push([
        e.edge ? 'Gönderen çıkış portu' : 'Çıkış portu',
        e.edge?.portA || e.detail.egress.join(', ') || 'Yok (motor çıkış seçmedi).',
      ]);
    if (f.ipv4 || e.ipv4)
      values.push(
        ['Source IP', ip.sourceIp],
        ['Destination IP', ip.destinationIp],
        ['TTL', ip.ttl],
        ['IP Protocol', ip.protocol],
      );
    if (f.arp)
      values.push(
        ['ARP Operation', arp.operation],
        ['ARP Sender IP', arp.senderIp],
        ['ARP Sender MAC', arp.senderMac],
        ['ARP Target IP', arp.targetIp],
        ['ARP Target MAC', arp.targetMac],
      );
    if (f.icmp)
      values.push(['ICMP Type', icmp.type], ['ICMP Code', icmp.code], ['ICMP türü', f.kind]);
    if (e.kind === 'discard' || e.kind === 'diagnostic') values.push(['Neden', e.detail?.reason]);
    for (const [key, value] of values) {
      fields.append(
        make('dt', null, key),
        make(
          'dd',
          null,
          value === undefined || value === null || value === ''
            ? 'Motor bu alanı kaydetmedi.'
            : String(value),
        ),
      );
    }
  }
  function render() {
    const s = model.state();
    realtime.setAttribute('aria-pressed', String(!active));
    simulation.setAttribute('aria-pressed', String(active));
    forward.disabled = !active || s.cursor + 1 >= s.total;
    play.disabled = !active || !s.total;
    reset.disabled = !active || !s.total;
    pause.disabled = !raf && !s.playing;
    status.textContent = stale
      ? 'Topoloji/yapılandırma değişti. Eski kayıt canlandırılmaz; CLI testini yeniden çalıştır ve kaydı al.'
      : s.total
        ? 'AğLab JS · ' +
          (s.cursor < 0 ? 'Hazır' : 'Görüntülenen ' + (s.cursor + 1)) +
          ' / ' +
          s.total +
          ' olay' +
          (captured.overflow
            ? ' · Kayıt sınırı: ' + captured.overflow + ' ek olay gösterilemiyor.'
            : '')
        : captured.events.length
          ? 'Bu filtreye uygun olay yok; filtreyi değiştir.'
          : 'Henüz motor olayı yok. Önce CLI ile test yap.';
    renderRows();
    renderDetails();
  }
  function notify() {
    const e = model.state().event;
    if (e)
      document.dispatchEvent(
        new CustomEvent('aglab:packet-event-viewed', {
          detail: { origin: 'aglab-js', raw: e.raw, trace: captured.legacy || [] },
        }),
      );
  }
  function select(index, animate = false, keepPlaying = false) {
    if (!keepPlaying) stop();
    model.seek(index);
    page = Math.floor(index / 25);
    progress =
      animate && canvasVisible && (keepPlaying || (animation.checked && !motion.matches)) ? 0 : 1;
    lastTime = 0;
    unchanged();
    render();
    paint(animation.checked && !motion.matches ? progress : 1);
    notify();
    if (!stale && (progress < 1 || model.state().playing)) schedule();
  }
  function schedule() {
    if (!raf) {
      motionRunning = true;
      pause.disabled = false;
      raf = requestAnimationFrame(tick);
    }
  }
  function tick(time) {
    raf = 0;
    if (!active || stale || !canvasVisible || document.hidden || !panel.getClientRects().length) {
      stop();
      return;
    }
    const state = model.state(),
      moving = state.event?.kind === 'wire' && animation.checked && !motion.matches,
      duration = (moving ? 650 : 220) / state.speed;
    if (lastTime) progress = Math.min(1, progress + (time - lastTime) / duration);
    lastTime = time;
    if (moving) paint(progress);
    if (progress >= 1) {
      lastTime = 0;
      if (state.playing && state.cursor + 1 < state.total) {
        if (!unchanged()) {
          render();
          return;
        }
        select(state.cursor + 1, true, true);
        return;
      }
      stop();
      render();
      return;
    }
    schedule();
  }
  function applyFilter() {
    stop();
    const events = captured.events.filter((e) =>
      filter.value === 'all' || filter.value === 'diagnostic'
        ? filter.value === 'all' || ['discard', 'diagnostic', 'icmp-undelivered'].includes(e.kind)
        : protocol(e) === filter.value,
    );
    model.load({ ...captured, events });
    version++;
    page = 0;
    progress = 1;
    hide();
    unchanged();
    render();
  }
  function captureTrace() {
    stop();
    captured = readEthernetTrace();
    applyFilter();
  }
  function mode(value) {
    stop();
    active = value;
    panel.hidden = !value;
    controls.hidden = !value;
    status.hidden = !value;
    document.body.classList.toggle('aglab-simulation-mode', value);
    if (value) captureTrace();
    else hide();
    render();
  }
  realtime.onclick = () => mode(false);
  simulation.onclick = () => mode(true);
  capture.onclick = captureTrace;
  forward.onclick = () => {
    const s = model.state();
    if (s.cursor + 1 < s.total) select(s.cursor + 1, true);
  };
  play.onclick = () => {
    if (!unchanged()) {
      render();
      return;
    }
    let s = model.state();
    if (!s.total) return;
    if (!canvasVisible) {
      canvas.scrollIntoView({ block: 'center' });
      canvasVisible = true;
    }
    if (s.cursor < 0 || (s.cursor === s.total - 1 && progress >= 1)) {
      model.reset();
      model.play();
      select(0, true, true);
    } else {
      model.play();
      if (progress >= 1) select(s.cursor + 1, true, true);
      else schedule();
    }
    render();
  };
  pause.onclick = () => {
    stop();
    render();
    paint(progress);
  };
  reset.onclick = () => {
    stop();
    model.reset();
    page = 0;
    progress = 1;
    hide();
    render();
  };
  speed.onchange = () => model.speed(Number(speed.value));
  filter.onchange = applyFilter;
  animation.onchange = () => {
    if (!animation.checked) {
      progress = 1;
      paint(1);
    }
  };
  motion.addEventListener('change', () => {
    animation.disabled = motion.matches;
    if (motion.matches) {
      animation.checked = false;
      progress = 1;
      paint(1);
    }
  });
  prevPage.onclick = () => {
    page = Math.max(0, page - 1);
    renderRows();
  };
  nextPage.onclick = () => {
    if ((page + 1) * 25 < model.events().length) {
      page++;
      renderRows();
    }
  };
  rows.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const next = Math.max(
      0,
      Math.min(
        model.state().total - 1,
        model.state().cursor + (event.key === 'ArrowDown' ? 1 : -1),
      ),
    );
    if (next >= 0) {
      select(next, false);
      rows.querySelector('[data-pos="' + next + '"] button')?.focus();
    }
  });
  explain.onclick = () => {
    const e = model.state().event;
    if (e)
      document.dispatchEvent(
        new CustomEvent('aglab:detective-select', {
          detail: { eventId: e.eventId, generation: captured.generation },
        }),
      );
  };
  document.addEventListener('aglab:simulation-select', (event) => {
    const r = event.detail;
    if (!r || typeof r.eventId !== 'string') return;
    mode(true);
    if (r.generation !== captured.generation) {
      status.textContent = 'Dedektifteki kayıt güncel izden farklı; önce son olayları yenile.';
      return;
    }
    filter.value = 'all';
    applyFilter();
    const i = model.events().findIndex((e) => e.eventId === r.eventId);
    if (i >= 0) {
      select(i, false);
      panel.scrollIntoView({ block: 'nearest' });
    }
  });
  document.addEventListener('aglab:trace-ready', () => {
    if (active) captureTrace();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
      render();
    }
  });
  new MutationObserver(() => {
    if (active && captured.events.length) {
      unchanged();
      if (!stale) paint(progress);
      else render();
    }
  }).observe(canvas, { childList: true });
  document.addEventListener('submit', () => {
    if (active) {
      unchanged();
      render();
    }
  });
  globalThis.aglabSimulation = Object.freeze({
    state: () => ({ ...model.state(), active, progress, stale, rafPending: !!raf }),
    trace: () => JSON.parse(JSON.stringify(captured)),
  });
  render();
})();
