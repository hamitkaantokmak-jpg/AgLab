// Dynamic VLAN-scoped FDB shared by learning and local Ethernet forwarding.
const MAC_AGING_MS = 300000;
function switchMacKey(vlan, mac) {
  return Number(vlan) + '|' + mac;
}
function switchMacTable(d, now = Date.now()) {
  const table = macTables.get(d.id) || new Map();
  for (const [key, row] of table) {
    const port = portState(d, row.port),
      link = links.find(
        (l) => (l.a === d.id && l.portA === row.port) || (l.b === d.id && l.portB === row.port),
      );
    const carries =
      port &&
      (port.mode === 'access'
        ? Number(port.vlan) === Number(row.vlan)
        : port.mode === 'trunk' && (port.allowed || []).map(Number).includes(Number(row.vlan)));
    if (
      !Number.isFinite(row.lastSeen) ||
      now - row.lastSeen >= MAC_AGING_MS ||
      d.enabled === false ||
      !link ||
      !linkUp(link) ||
      !carries ||
      !(d.vlans || []).map(Number).includes(Number(row.vlan))
    )
      table.delete(key);
  }
  macTables.set(d.id, table);
  return table;
}
function learnSwitchMac(d, source, vlan, port) {
  if (d?.type !== 'Switch' || !source || d.id === source.id) return;
  // Prune before learning so an expired/stale row cannot be revived on another VLAN.
  const now = Date.now(),
    table = switchMacTable(d, now),
    mac = macOf(source);
  table.set(switchMacKey(vlan, mac), {
    mac,
    vlan: Number(vlan),
    port,
    device: source.name,
    lastSeen: now,
  });
}
function learnPathMacs(src, path, fallback) {
  let current = src,
    frameSource = src;
  for (let index = 0; index < path.length; index++) {
    const link = path[index],
      next = get(link.a === current.id ? link.b : link.a);
    if (!next) return;
    if (current.type === 'Router') frameSource = current;
    if (next.type === 'Switch')
      learnSwitchMac(next, frameSource, path.vlans?.[index] ?? fallback, linkPort(link, next.id));
    current = next;
  }
}
function macLearningCommand(d, p, out) {
  if (p[0] !== 'clear' || p[1] !== 'mac') return false;
  if (
    d.type !== 'Switch' ||
    cliMode !== 'priv' ||
    p.join(' ') !== 'clear mac address-table dynamic'
  ) {
    out('Switch enable modunda clear mac address-table dynamic kullan.', 'outerr');
    return true;
  }
  macTables.delete(d.id);
  out('Dinamik MAC tablosu temizlendi.', 'outok');
  return true;
}
