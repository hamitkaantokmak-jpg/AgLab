// Shared Ethernet delivery. Routers terminate each frame; routed execution starts a new segment.
let ethernetEvents = [],
  ethernetEventOverflow = 0;
let ethernetTraceEvents = [],
  ethernetTraceOverflow = 0,
  ethernetTraceGeneration = 0,
  ethernetFrameNumber = 0,
  ethernetTraceTopology = '',
  // L3-b: Labber içeriğinde ping izi Labber olay adaptöründen gelir (labberSimulationTrace).
  ethernetLabberTrace = null;
function ethernetTopologyFingerprint() {
  // Narrow production-module harnesses supply adjacency/get without the UI's
  // complete topology arrays. Observation must not become a new engine dependency.
  if (typeof devices === 'undefined' || typeof links === 'undefined') return '';
  return JSON.stringify({ devices: devices.map(({ x, y, w, h, ...d }) => d), links });
}
function beginEthernetEvents() {
  ethernetLabberTrace = null;
  ethernetEvents = [];
  ethernetEventOverflow = 0;
  ethernetTraceEvents = [];
  ethernetTraceOverflow = 0;
  ethernetFrameNumber = 0;
  ethernetTraceGeneration++;
  ethernetTraceTopology = ethernetTopologyFingerprint();
}
function ethernetTraceEvent(raw, evidence = {}) {
  if (ethernetTraceEvents.length < 512)
    ethernetTraceEvents.push({
      raw,
      eventId: ethernetTraceGeneration + ':' + (ethernetTraceEvents.length + 1),
      ...JSON.parse(JSON.stringify(evidence)),
    });
  else ethernetTraceOverflow++;
}
function ethernetEvent(text, evidence = {}) {
  if (ethernetEvents.length < 256) ethernetEvents.push(text);
  else ethernetEventOverflow++;
  ethernetTraceEvent(text, evidence);
}
function finishEthernetTrace() {
  ethernetTraceTopology = ethernetTopologyFingerprint();
}
function readEthernetTrace() {
  if (ethernetLabberTrace)
    return AgLabPacketEvents.fromLabber(ethernetLabberTrace, {
      generation: ethernetTraceGeneration,
      topologyKey: ethernetTraceTopology,
      legacy: [],
    });
  return AgLabPacketEvents.fromEvidence(ethernetTraceEvents, ethernetTraceOverflow, {
    generation: ethernetTraceGeneration,
    topologyKey: ethernetTraceTopology,
    legacy: ethernetEvents.slice(),
  });
}
function ethernetContext() {
  const adjacency = new Map(),
    trees = new Map();
  for (const link of links)
    for (const id of [link.a, link.b]) {
      if (!adjacency.has(id)) adjacency.set(id, []);
      adjacency.get(id).push(link);
    }
  return { adjacency, trees };
}
function ethernetLinkEligible(link, vlan, context) {
  if (!linkCarriesVlan(link, vlan).ok || stpIsBlocked(link, vlan, context.trees)) return false;
  const a = get(link.a),
    b = get(link.b),
    pa = portState(a, link.portA),
    pb = portState(b, link.portB);
  // An untagged access/endpoint edge can only enter a trunk's native VLAN.
  for (const [d, p, other, op] of [
    [a, pa, b, pb],
    [b, pb, a, pa],
  ])
    if (
      d?.type === 'Switch' &&
      p?.mode === 'trunk' &&
      (other?.type === 'PC' ||
        other?.type === 'Server' ||
        (other?.type === 'Switch' && op?.mode === 'access')) &&
      Number(p.nativeVlan ?? 1) !== Number(vlan)
    )
      return false;
  return true;
}
function transmitEthernet(source, destinationMac, vlan, kind, context, options = {}) {
  const delivered = new Set(),
    seen = new Set(),
    queue = [{ device: source, ingress: null }],
    broadcast = destinationMac === 'ff:ff:ff:ff:ff:ff';
  const arp = ['arp-request', 'arp-reply'].includes(kind),
    icmp = [
      'icmp-request',
      'icmp-reply',
      'icmp-time-exceeded',
      'icmp-destination-unreachable',
    ].includes(kind);
  const frame = {
    protocol: arp ? 'ARP' : icmp ? 'ICMP' : 'Ethernet',
    kind,
    sourceMac: macOf(source),
    destinationMac,
    vlan,
    etherType: arp ? '0x0806' : icmp ? '0x0800' : null,
    arp: arp
      ? {
          operation: kind === 'arp-request' ? 1 : 2,
          senderIp: options.arp?.senderIp ?? null,
          senderMac: macOf(source),
          targetIp: options.arp?.targetIp ?? null,
          targetMac: kind === 'arp-reply' ? destinationMac : null,
        }
      : null,
    ipv4:
      icmp && options.packet
        ? {
            sourceIp: options.packet.sourceIp,
            destinationIp: options.packet.destinationIp,
            ttl: options.packet.ttl ?? null,
            protocol: 1,
          }
        : null,
    icmp: icmp
      ? {
          type:
            options.packet?.icmpType ??
            (kind === 'icmp-request'
              ? 8
              : kind === 'icmp-reply'
                ? 0
                : kind === 'icmp-time-exceeded'
                  ? 11
                  : 3),
          code:
            options.packet?.icmpCode ??
            (kind === 'icmp-request' || kind === 'icmp-reply' || kind === 'icmp-time-exceeded'
              ? 0
              : null),
        }
      : null,
  };
  const frameId = ethernetTraceGeneration + ':f' + ++ethernetFrameNumber;
  const evidence = { frameId, frame };
  ethernetEvent(
    'frame ' + kind + ' src ' + source.id + ' dst ' + destinationMac + ' vlan ' + vlan,
    evidence,
  );
  for (let index = 0; index < queue.length; index++) {
    const { device, ingress } = queue[index];
    if (!device || device.enabled === false || seen.has(device.id)) continue;
    seen.add(device.id);
    if (ingress && device.type !== 'Switch') {
      ethernetEvent('receive ' + device.id + ' ' + kind + ' vlan ' + vlan, {
        ...evidence,
        ingressPort: linkPort(ingress, device.id),
      });
      if (
        options.targetId === device.id &&
        options.targetPort &&
        linkPort(ingress, device.id) !== options.targetPort
      ) {
        ethernetEvent('discard ' + device.id + ' ingress-port', evidence);
        continue;
      }
      if (broadcast || macOf(device) === destinationMac) delivered.add(device.id);
      else ethernetEvent('discard ' + device.id + ' destination-mac', evidence);
      continue; // Endpoints and routers do not bridge Ethernet frames.
    }
    if (ingress && device.type === 'Switch') {
      if (!portSecurityAllows(device, linkPort(ingress, device.id), source)) continue;
      learnSwitchMac(device, source, vlan, linkPort(ingress, device.id));
      ethernetTraceEvent('learn ' + device.id, {
        ...evidence,
        kind: 'learn',
        device: device.id,
        ingressPort: linkPort(ingress, device.id),
      });
      if (
        activeSwitchSvis(device).some(([, iface]) => Number(iface.vlan) === Number(vlan)) &&
        (broadcast || macOf(device) === destinationMac)
      ) {
        delivered.add(device.id);
        ethernetEvent('receive ' + device.id + ' ' + kind + ' svi vlan ' + vlan, evidence);
        if (!broadcast) continue;
      }
    }
    const candidates = (context.adjacency.get(device.id) || []).filter(
      (link) =>
        (ingress || !options.sourcePort || linkPort(link, device.id) === options.sourcePort) &&
        ethernetLinkEligible(link, vlan, context),
    );
    let outputs = candidates.filter((link) => link !== ingress),
      reason = broadcast ? 'broadcast' : 'unknown-unicast';
    if (device.type === 'Switch' && !broadcast) {
      const table = switchMacTable(device),
        key = switchMacKey(vlan, destinationMac),
        known = table.get(key);
      if (known) {
        const edge = candidates.find((link) => linkPort(link, device.id) === known.port);
        if (edge === ingress) {
          outputs = [];
          reason = 'filter';
        } else if (edge) {
          outputs = [edge];
          reason = 'unicast';
        } else table.delete(key); // Link/VLAN/STP change invalidates an unusable FDB egress.
      }
    }
    if (device.type === 'Switch')
      ethernetEvent(
        reason +
          ' ' +
          device.id +
          ' ingress ' +
          (ingress ? linkPort(ingress, device.id) : 'local') +
          ' egress ' +
          (outputs.map((link) => linkPort(link, device.id)).join(',') || '-') +
          ' vlan ' +
          vlan,
        evidence,
      );
    for (const edge of outputs) {
      const destination = get(edge.a === device.id ? edge.b : edge.a);
      if (destination)
        ethernetTraceEvent('wire ' + kind + ' ' + device.id + ' -> ' + destination.id, {
          ...evidence,
          kind: 'wire',
          device: device.id,
          edge: {
            a: device.id,
            portA: linkPort(edge, device.id),
            b: destination.id,
            portB: linkPort(edge, destination.id),
          },
        });
      queue.push({ device: destination, ingress: edge });
    }
  }
  return delivered;
}
function localEthernetPing(source, target, vlan, ttl = 64) {
  beginEthernetEvents();
  const context = ethernetContext(),
    sourceArp = arpTables.get(source.id) || new Map(),
    targetArp = arpTables.get(target.id) || new Map();
  if (sourceArp.get(target.ip) !== macOf(target)) {
    const request = transmitEthernet(source, 'ff:ff:ff:ff:ff:ff', vlan, 'arp-request', context, {
      arp: { senderIp: source.ip, targetIp: target.ip },
    });
    if (!request.has(target.id))
      return {
        ok: false,
        why: 'ARP broadcast hedefe ulaşmadı; VLAN, port ve STP durumunu kontrol et.',
      };
    targetArp.set(source.ip, macOf(source));
    arpTables.set(target.id, targetArp);
    const reply = transmitEthernet(target, macOf(source), vlan, 'arp-reply', context, {
      arp: { senderIp: target.ip, targetIp: source.ip },
    });
    if (!reply.has(source.id)) return { ok: false, why: 'ARP yanıtı kaynağa ulaşmadı.' };
    sourceArp.set(target.ip, macOf(target));
    arpTables.set(source.id, sourceArp);
  }
  ethernetEvent('packet icmp-request ip ' + source.ip + ' -> ' + target.ip + ' ttl ' + ttl);
  const request = transmitEthernet(
    source,
    sourceArp.get(target.ip),
    vlan,
    'icmp-request',
    context,
    { packet: { sourceIp: source.ip, destinationIp: target.ip, ttl } },
  );
  if (!request.has(target.id))
    return {
      ok: false,
      why: 'Ethernet ICMP frame hedefe ulaşmadı; MAC tablosu ve VLAN çıkışlarını kontrol et.',
    };
  const reply = transmitEthernet(target, macOf(source), vlan, 'icmp-reply', context, {
    packet: { sourceIp: target.ip, destinationIp: source.ip },
  });
  if (!reply.has(source.id)) return { ok: false, why: 'Ethernet ICMP yanıtı kaynağa ulaşmadı.' };
  return {
    ok: true,
    why: 'Yerel ARP ve Ethernet ICMP gidiş/dönüş iletimi başarılı; MAC tablosuna göre VLAN içi iletim doğrulandı.',
  };
}
function ethernetCommand(d, p, out) {
  if (p[0] === 'show' && p[1] === 'ethernet' && p[2] === 'events') {
    if (p.length !== 3) {
      out('Kullanım: show ethernet events', 'outerr');
      return true;
    }
    out('Son Ethernet işlemi (en çok 256 olay):');
    if (!ethernetEvents.length) out('Henüz Ethernet olayı yok.');
    ethernetEvents.forEach((line) => out(line));
    if (ethernetEventOverflow) out('Ek olay sayısı: ' + ethernetEventOverflow);
    return true;
  }
  if (p[0] !== 'test' || p[1] !== 'ethernet') return false;
  if (!['PC', 'Server'].includes(d.type) || d.enabled === false) {
    out('Ethernet testi etkin PC/Server üzerinde desteklenir.', 'outerr');
    return true;
  }
  const token = p[2] || '',
    mac = token === 'broadcast' ? 'ff:ff:ff:ff:ff:ff' : token.replace(/[.:-]/g, '');
  if (
    p.length !== 3 ||
    (mac !== 'ff:ff:ff:ff:ff:ff' &&
      (!/^[0-9a-f]{12}$/.test(mac) ||
        mac === '000000000000' ||
        parseInt(mac.slice(0, 2), 16) % 2 !== 0))
  ) {
    out(
      'Geçersiz veya desteklenmeyen hedef MAC. Kullanım: test ethernet <MAC|broadcast>',
      'outerr',
    );
    return true;
  }
  const address = mac.includes(':') ? mac : mac.match(/../g).join(':'),
    vlan = endpointVlan(d.id);
  beginEthernetEvents();
  transmitEthernet(d, address, vlan, 'diagnostic', ethernetContext());
  finishEthernetTrace();
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('aglab:trace-ready'));
  out(
    'Eğitim Ethernet frame testi tamamlandı. show ethernet events ile gerçek çıkışları incele.',
    'outok',
  );
  return true;
}
