// AğLab motoru — VLAN başına basitleştirilmiş Spanning Tree (PVST benzeri) hesaplaması.
// Saf fonksiyonlar: topoloji `{ devices, links }` parametre olarak verilir. Dönen
// kümeler topolojideki bağlantı nesnelerinin kendisini içerir.
// Model: kök, en düşük köprü önceliği + cihaz kimliğiyle seçilir; ağaç, kökten
// deterministik sıralı genişlik öncelikli aramayla kurulur. Port maliyeti, BPDU
// zamanlaması, RSTP rolleri modellenmez.
const AgLabEngineStp = ((topology) => {
  const { getDevice, portState, linkUp } = topology;
  const empty = () => ({
    root: null,
    selected: new Set(),
    parentLink: new Map(),
    parent: new Map(),
  });

  function stpPriorityForVlan(d, vlan) {
    return Number(d?.stpPriorities?.[Number(vlan)] ?? d?.stpPriority ?? 32768);
  }
  function stpVlanSwitches(topo, vlan) {
    return topo.devices.filter(
      (d) =>
        d.type === 'Switch' &&
        d.enabled !== false &&
        (d.vlans || [1]).map(Number).includes(Number(vlan)),
    );
  }
  function stpRootForVlan(topo, vlan, candidateIds = null) {
    const ids = candidateIds ? new Set(candidateIds) : null;
    const sw = stpVlanSwitches(topo, vlan).filter((d) => !ids || ids.has(d.id));
    return (
      sw.sort(
        (a, b) =>
          stpPriorityForVlan(a, vlan) - stpPriorityForVlan(b, vlan) ||
          String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
      )[0] || null
    );
  }
  // İki switch arasındaki çalışan bağlantı, iki uçta da VLAN'ı taşıyorsa STP'ye katılır.
  function stpLinkEligible(topo, l, vlan) {
    const a = getDevice(topo, l.a),
      b = getDevice(topo, l.b),
      pa = portState(a, l.portA),
      pb = portState(b, l.portB);
    if (!linkUp(topo, l) || a?.type !== 'Switch' || b?.type !== 'Switch' || !pa || !pb)
      return false;
    if (
      !(a.vlans || [1]).map(Number).includes(Number(vlan)) ||
      !(b.vlans || [1]).map(Number).includes(Number(vlan))
    )
      return false;
    const carries = (p) =>
      p.mode === 'trunk'
        ? (p.allowed || []).map(Number).includes(Number(vlan))
        : p.mode === 'access' && Number(p.vlan) === Number(vlan);
    return carries(pa) && carries(pb);
  }
  function stpComponentIds(topo, vlan, startId) {
    const seen = new Set(),
      queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      for (const l of topo.links.filter(
        (x) => (x.a === id || x.b === id) && stpLinkEligible(topo, x, vlan),
      )) {
        const next = l.a === id ? l.b : l.a;
        if (!seen.has(next)) queue.push(next);
      }
    }
    return seen;
  }
  function stpTreeInfo(topo, vlan, anchorId = null) {
    const all = stpVlanSwitches(topo, vlan);
    if (!all.length) return empty();
    const anchor =
      anchorId && all.some((d) => d.id === anchorId) ? anchorId : stpRootForVlan(topo, vlan)?.id;
    if (!anchor) return empty();
    const component = stpComponentIds(topo, vlan, anchor),
      root = stpRootForVlan(topo, vlan, component);
    if (!root) return empty();
    const selected = new Set(),
      seen = new Set([root.id]),
      queue = [root.id],
      parentLink = new Map(),
      parent = new Map();
    while (queue.length) {
      const id = queue.shift();
      const candidates = topo.links
        .filter((l) => (l.a === id || l.b === id) && stpLinkEligible(topo, l, vlan))
        .sort((x, y) =>
          String(x.a + '|' + x.b + '|' + x.portA + '|' + x.portB).localeCompare(
            String(y.a + '|' + y.b + '|' + y.portA + '|' + y.portB),
          ),
        );
      for (const l of candidates) {
        const next = l.a === id ? l.b : l.a;
        if (component.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
          selected.add(l);
          parentLink.set(next, l);
          parent.set(next, id);
        }
      }
    }
    return { root, selected, parentLink, parent, component };
  }
  // VLAN'daki her bağlı bileşen için ayrı ağaç; iletim yapan bağlantıların birleşimi.
  function stpForwardingTree(topo, vlan) {
    const selected = new Set(),
      visited = new Set();
    for (const sw of stpVlanSwitches(topo, vlan)) {
      if (visited.has(sw.id)) continue;
      const info = stpTreeInfo(topo, vlan, sw.id);
      for (const l of info.selected) selected.add(l);
      for (const id of info.component || []) visited.add(id);
    }
    return selected;
  }
  // `trees` verilirse VLAN başına ağaç önbelleği olarak kullanılır (çağıranın Map'i).
  function stpIsBlocked(topo, l, vlan = 10, trees = null) {
    const a = getDevice(topo, l.a),
      b = getDevice(topo, l.b);
    if (a?.type !== 'Switch' || b?.type !== 'Switch') return false;
    const id = Number(vlan) || 10;
    if (!trees) return !stpForwardingTree(topo, id).has(l);
    if (!trees.has(id)) trees.set(id, stpForwardingTree(topo, id));
    return !trees.get(id).has(l);
  }
  return {
    stpPriorityForVlan,
    stpVlanSwitches,
    stpRootForVlan,
    stpLinkEligible,
    stpComponentIds,
    stpTreeInfo,
    stpForwardingTree,
    stpIsBlocked,
  };
})(typeof AgLabEngineTopology !== 'undefined' ? AgLabEngineTopology : require('./topology.js'));
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineStp;
