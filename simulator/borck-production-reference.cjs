// Same real production Ethernet and MAC-learning modules. Only their outer app
// dependencies are supplied here, restricted to loop-free, access-only fixtures.
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const scripts = ['mac-learning.js', 'ethernet-forwarding.js'].map(
  (f) => new vm.Script(fs.readFileSync(path.join(__dirname, f), 'utf8')),
);
function session(topology) {
  const devices = new Map(topology.devices.map((d) => [d.id, d])),
    arpTables = new Map();
  const portState = (d, p) => d.interfaces?.[p] || {};
  const linkUp = (l) =>
    l.up !== false &&
    [devices.get(l.a), devices.get(l.b)].every((d) => d.enabled !== false) &&
    portState(devices.get(l.a), l.portA).enabled !== false &&
    portState(devices.get(l.b), l.portB).enabled !== false;
  const context = {
    Map,
    Set,
    Number,
    Date,
    console,
    devices: topology.devices,
    links: topology.links,
    arpTables,
    macTables: new Map(),
    get: (id) => devices.get(id),
    macOf: (d) => d.mac,
    linkUp,
    portState,
    linkPort: (l, id) => (l.a === id ? l.portA : l.portB),
    endpointVlan: (id) => {
      const l = topology.links.find((l) => l.a === id || l.b === id);
      if (!l) return 10;
      const other = devices.get(l.a === id ? l.b : l.a);
      return other.type === 'Switch'
        ? portState(other, l.a === other.id ? l.portA : l.portB).vlan
        : 10;
    },
    linkCarriesVlan: (l, vlan) => ({
      ok:
        linkUp(l) &&
        [
          [l.a, l.portA],
          [l.b, l.portB],
        ].every(
          ([id, p]) =>
            devices.get(id).type !== 'Switch' ||
            Number(portState(devices.get(id), p).vlan ?? 1) === vlan,
        ),
    }),
    stpIsBlocked: () => false,
    portSecurityAllows: () => true,
    activeSwitchSvis: () => [],
  };
  vm.createContext(context);
  scripts.forEach((s) => s.runInContext(context));
  return {
    ping(source = 'p0', target = 'p1') {
      context.src = devices.get(source);
      context.dst = devices.get(target);
      const result = vm.runInContext('localEthernetPing(src,dst,endpointVlan(src.id))', context);
      return {
        ok: result.ok,
        events: Array.from(vm.runInContext('ethernetEvents', context)),
        arp: arpTables,
      };
    },
  };
}
module.exports = { session };
