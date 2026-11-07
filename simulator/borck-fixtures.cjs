'use strict';
function fixture(count = 4) {
  const pcs = Array.from({ length: count - 2 }, (_, i) => ({
    id: 'p' + i,
    name: 'PC' + i,
    type: 'PC',
    enabled: true,
    ip: '10.0.0.' + (i + 1),
    mask: '255.255.255.0',
    gateway: '',
    mac:
      '02:00:00:00:' +
      ((i >> 8) & 255).toString(16).padStart(2, '0') +
      ':' +
      (i & 255).toString(16).padStart(2, '0'),
    vlan: 10,
    ports: ['eth0'],
    interfaces: { eth0: { enabled: true } },
  }));
  const switches = [0, 1].map((i) => ({
    id: 's' + i,
    name: 'SW' + i,
    type: 'Switch',
    enabled: true,
    vlans: [1, 10, 20],
    ports: ['uplink'],
    interfaces: { uplink: { enabled: true, mode: 'access', vlan: 10 } },
  }));
  const links = [{ a: 's0', portA: 'uplink', b: 's1', portB: 'uplink', up: true }];
  pcs.forEach((p, i) => {
    const sw = switches[i % 2],
      port = 'fa0/' + (i + 1);
    sw.ports.push(port);
    sw.interfaces[port] = { mode: 'access', vlan: 10, enabled: true };
    links.push({ a: p.id, portA: 'eth0', b: sw.id, portB: port, up: true });
  });
  return { devices: [...pcs, ...switches], links };
}
module.exports = { fixture };
