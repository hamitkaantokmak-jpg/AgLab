// Student-side read-only event playback. Uses the actual latest Ethernet event trace.
(function () {
  'use strict';
  const host = document.getElementById('area-lab');
  if (!host || !globalThis.AgLabPacketEvents) return;
  const panel = document.createElement('section');
  panel.id = 'packetDetectivePanel';
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = 'Paket Dedektifi';
  panel.append(title);
  const help = document.createElement('p');
  help.textContent =
    'Önce CLI üzerinden ping veya Ethernet testi çalıştır. Motor kayıtlarını adım adım incele; burada yeni paket gönderilmez. Kaynak etiketine bak: adaptör tanısı ve Canlı Lab raporu paket yakalaması değildir.';
  panel.append(help);
  const controls = document.createElement('div');
  const refresh = document.createElement('button');
  refresh.id = 'packetDetectiveRefresh';
  refresh.textContent = 'Son olayları göster';
  const previous = document.createElement('button');
  previous.id = 'packetDetectivePrevious';
  previous.textContent = '← Önceki';
  previous.disabled = true;
  const next = document.createElement('button');
  next.id = 'packetDetectiveNext';
  next.textContent = 'Sonraki →';
  next.disabled = true;
  const filter = document.createElement('select');
  filter.id = 'packetDetectiveFilter';
  filter.setAttribute('aria-label', 'Paket olay türü');
  for (const [value, label] of [
    ['all', 'Tüm olaylar'],
    ['arp', 'ARP'],
    ['icmp', 'ICMP'],
    ['forward', 'İletim'],
    ['discard', 'Kayıp / reddedilen'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    filter.append(option);
  }
  const viewMode = document.createElement('select');
  viewMode.id = 'packetDetectiveViewMode';
  viewMode.setAttribute('aria-label', 'Paket açıklama görünümü');
  for (const [value, label] of [
    ['technical', 'Teknik görünüm'],
    ['simple', 'Basit görünüm'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    viewMode.append(option);
  }
  controls.append(refresh, filter, previous, next, viewMode);
  panel.append(controls);
  const simulate = document.createElement('button');
  simulate.id = 'packetDetectiveSimulate';
  simulate.textContent = 'Simulation’da incele';
  simulate.disabled = true;
  controls.append(simulate);
  const status = document.createElement('p');
  status.id = 'packetDetectiveStatus';
  status.setAttribute('role', 'status');
  panel.append(status);
  const emptyGuide = document.createElement('div');
  emptyGuide.id = 'packetDetectiveEmptyGuide';
  emptyGuide.setAttribute('role', 'note');
  const guideText = document.createElement('p');
  guideText.textContent =
    'İlk paketini görmek için: (1) Bir PC seç, (2) CLI üzerinden diğer PC’ye ping gönder, (3) Son olayları göster düğmesine bas.';
  const guideCli = document.createElement('button');
  guideCli.type = 'button';
  guideCli.id = 'packetDetectiveOpenCli';
  guideCli.textContent = 'CLI alanına git';
  guideCli.onclick = () => {
    const selector = document.getElementById('ptCliDevice');
    const input = document.getElementById('ptCliInput');
    if (globalThis.aglabSimulation?.state().active && selector) {
      openDeviceCli(selector.value);
      return;
    }
    (selector || input)?.scrollIntoView({ block: 'nearest' });
    if (input && !input.disabled) input.focus();
    else if (selector) selector.focus();
  };
  emptyGuide.append(guideText, guideCli);
  panel.append(emptyGuide);
  const explanation = document.createElement('p');
  explanation.id = 'packetDetectiveExplanation';
  panel.append(explanation);
  const raw = document.createElement('pre');
  raw.id = 'packetDetectiveRaw';
  raw.style.whiteSpace = 'pre-wrap';
  raw.style.overflowWrap = 'anywhere';
  panel.append(raw);
  viewMode.onchange = () => {
    raw.hidden = viewMode.value === 'simple';
  };
  const diagnosis = document.createElement('p');
  diagnosis.id = 'packetDetectiveDiagnosis';
  diagnosis.setAttribute('role', 'status');
  panel.append(diagnosis);
  const go = document.createElement('button');
  go.id = 'packetDetectiveGoToDevice';
  go.textContent = 'Sorunlu cihaza git';
  go.disabled = true;
  panel.append(go);
  host.append(panel);
  let allEvents = { events: [], overflow: 0, truncated: false },
    snapshot = allEvents,
    index = 0;
  let eventOrigin = 'Labber motoru',
    eventSource = 'labber';
  document.addEventListener('aglab:external-lab-evidence', (event) => {
    const r = event.detail;
    if (r?.scope !== 'separate-lab' || !Array.isArray(r.events)) return;
    eventSource = 'native-report';
    eventOrigin = r.engine + ' · Canlı Lab raporu, imzası doğrulanmadı';
    allEvents = { events: r.events, overflow: 0, truncated: false };
    filter.value = 'all';
    snapshot = filtered();
    index = 0;
    render();
  });
  function filtered() {
    const mode = filter.value;
    if (mode === 'all') return allEvents;
    const events = allEvents.events.filter((event) =>
      mode === 'forward'
        ? event.kind === 'forward'
        : mode === 'discard'
          ? event.kind === 'discard' ||
            event.kind === 'icmp-undelivered' ||
            event.kind === 'diagnostic' ||
            (event.kind === 'lab-check' && !event.detail.ok)
          : mode === 'arp'
            ? event.raw.toLowerCase().includes('arp-')
            : event.raw.toLowerCase().includes('icmp-'),
    );
    return { ...allEvents, events };
  }
  let marked = null,
    markedEdge = null;
  function clearEdge() {
    if (markedEdge) {
      markedEdge.removeAttribute('stroke');
      markedEdge.removeAttribute('stroke-width');
      markedEdge = null;
    }
  }
  function markDevice(id) {
    clearEdge();
    if (marked) {
      marked.removeAttribute('stroke');
      marked.removeAttribute('stroke-width');
      marked = null;
    }
    if (!id) return;
    const canvas = document.getElementById('ptCanvas');
    if (!canvas) return;
    const group = [...canvas.querySelectorAll('g[data-id]')].find(
      (node) => node.getAttribute('data-id') === id,
    );
    const outline = group?.querySelector('rect');
    if (outline) {
      outline.setAttribute('stroke', '#ffcb38');
      outline.setAttribute('stroke-width', '4');
      marked = outline;
    }
  }
  function markForwardEdge(step) {
    if (step?.kind !== 'forward' || step.detail?.egress?.length !== 1) return;
    const port = step.detail.egress[0],
      id = step.device;
    const matches = links.filter(
      (l) => (l.a === id && l.portA === port) || (l.b === id && l.portB === port),
    );
    if (matches.length !== 1) return; // Do not invent an edge for ambiguous/missing ports.
    const visible = links.filter((l) => get(l.a) && get(l.b));
    const position = visible.indexOf(matches[0]);
    const edges = document.querySelectorAll('#ptCanvas line.pt-edge');
    const line = edges[position];
    if (!line) return;
    line.setAttribute('stroke', '#ffcb38');
    line.setAttribute('stroke-width', '6');
    markedEdge = line;
  }
  function targetDevice() {
    const result = AgLabPacketEvents.diagnose(allEvents);
    return result.issues.find((issue) => issue.device && get(issue.device))?.device || null;
  }
  function render(reviewed = false) {
    simulate.disabled = true;
    const target = targetDevice();
    go.disabled = !target;
    const result = AgLabPacketEvents.diagnose(allEvents);
    diagnosis.textContent = !result.hasEvidence
      ? 'Tanılama için önce ağ testi çalıştır.'
      : result.issues.length
        ? result.issues.length +
          ' olası sorun kaydı var. ' +
          result.issues[0].summary +
          ' Öneri: ' +
          result.issues[0].hint
        : 'Bu kayıtlarda açık bir paket reddi veya ICMP ulaşamama olayı yok.' +
          (result.truncated ? ' Olay kaydı sınırlı; sonuç kesin değil.' : '');
    const step = AgLabPacketEvents.at(snapshot, index);
    previous.disabled = !step?.hasPrevious;
    next.disabled = !step?.hasNext;
    if (!step) {
      emptyGuide.hidden = allEvents.events.length > 0;
      status.textContent = allEvents.events.length
        ? 'Bu filtreye uygun ağ olayı yok.'
        : 'Henüz görüntülenecek ağ olayı yok.';
      explanation.textContent = '';
      raw.textContent = '';
      markDevice(null);
      return;
    }
    emptyGuide.hidden = true;
    status.textContent =
      'Adım ' +
      (step.position + 1) +
      ' / ' +
      step.total +
      ' · ' +
      eventOrigin +
      (snapshot.truncated
        ? ' · Kayıt sınırı aşıldı; ' + snapshot.overflow + ' olay gösterilemiyor.'
        : '');
    explanation.textContent = step.explanation;
    raw.textContent = step.raw;
    markDevice(step.device);
    markForwardEdge(step);
    simulate.disabled = !engineSource() || !step.eventId;
    if (reviewed)
      document.dispatchEvent(
        new CustomEvent('aglab:packet-event-viewed', {
          detail: {
            origin: eventSource,
            raw: step.raw,
            trace: allEvents.events.map((e) => e.raw),
          },
        }),
      );
  }
  go.onclick = () => {
    const id = targetDevice();
    if (!id) return;
    selected = id;
    const selector = document.getElementById('ptCliDevice');
    if (selector) selector.value = id;
    updateInspector();
    render();
    const node = [...document.querySelectorAll('#ptCanvas g[data-id]')].find(
      (el) => el.getAttribute('data-id') === id,
    );
    if (node) {
      node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      node.setAttribute('aria-label', 'Sorun kaydıyla ilişkili seçili cihaz');
    }
  };
  // Simülatörün kendi izi Labber olay adaptöründendir (L7b: tek motor).
  function useEngineTrace(trace) {
    allEvents = trace;
    eventSource = 'labber';
    eventOrigin = 'Labber motoru';
  }
  const engineSource = () => eventSource === 'labber';
  refresh.onclick = () => {
    useEngineTrace(readEthernetTrace());
    snapshot = filtered();
    index = 0;
    render(true);
  };
  filter.onchange = () => {
    snapshot = filtered();
    index = 0;
    render(true);
  };
  previous.onclick = () => {
    if (index > 0) {
      index--;
      render(true);
    }
  };
  next.onclick = () => {
    if (index + 1 < snapshot.events.length) {
      index++;
      render(true);
    }
  };
  simulate.onclick = () => {
    const step = AgLabPacketEvents.at(snapshot, index);
    if (!simulate.disabled && step)
      document.dispatchEvent(
        new CustomEvent('aglab:simulation-select', {
          detail: { eventId: step.eventId, generation: allEvents.generation },
        }),
      );
  };
  document.addEventListener('aglab:detective-select', (event) => {
    const request = event.detail;
    if (!request || typeof request.eventId !== 'string') return;
    if (!engineSource() || allEvents.generation !== request.generation) {
      const current = readEthernetTrace();
      if (current.generation !== request.generation) return;
      useEngineTrace(current);
    }
    filter.value = 'all';
    snapshot = allEvents;
    const found = snapshot.events.findIndex((e) => e.eventId === request.eventId);
    if (found < 0) return;
    index = found;
    render(true);
    panel.scrollIntoView({ block: 'nearest' });
  });
  render();
})();
