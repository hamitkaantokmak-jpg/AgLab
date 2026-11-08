// src/engine/stp.js ve acl.js birim testleri (tarayıcısız).
'use strict';
const assert = require('node:assert/strict');
const stp = require('../../src/engine/stp.js');
const acl = require('../../src/engine/acl.js');

// Üç switch'lik halka: SW1—SW2, SW2—SW3, SW3—SW1 (hepsi VLAN 1,10 taşıyan trunk).
function ring() {
  const trunk = () => ({ mode: 'trunk', allowed: [1, 10], enabled: true });
  const sw = (id, extra = {}) => ({
    id,
    name: id.toUpperCase(),
    type: 'Switch',
    enabled: true,
    vlans: [1, 10],
    interfaces: { 'g0/1': trunk(), 'g0/2': trunk() },
    ...extra,
  });
  const devices = [sw('sw1'), sw('sw2'), sw('sw3')];
  const links = [
    { a: 'sw1', portA: 'g0/1', b: 'sw2', portB: 'g0/1', up: true },
    { a: 'sw2', portA: 'g0/2', b: 'sw3', portB: 'g0/1', up: true },
    { a: 'sw3', portA: 'g0/2', b: 'sw1', portB: 'g0/2', up: true },
  ];
  return { devices, links };
}
const blocked = (topo, vlan) => topo.links.filter((l) => stp.stpIsBlocked(topo, l, vlan));

{
  const topo = ring();
  assert.equal(stp.stpRootForVlan(topo, 10).id, 'sw1', 'eşit öncelikte en küçük kimlik kök olur');
  assert.deepEqual(blocked(topo, 10), [topo.links[1]], 'halkada kökten en uzak bağlantı bloklanır');
  assert.equal(stp.stpForwardingTree(topo, 10).size, 2);
  console.log('PASS ring: root election and one blocked link');
}
{
  const topo = ring();
  topo.devices[2].stpPriorities = { 10: 4096 };
  assert.equal(stp.stpRootForVlan(topo, 10).id, 'sw3', 'VLAN önceliği kökü değiştirir');
  assert.equal(stp.stpRootForVlan(topo, 1).id, 'sw1', 'diğer VLAN etkilenmez');
  assert.deepEqual(blocked(topo, 10), [topo.links[0]]);
  assert.deepEqual(blocked(topo, 1), [topo.links[1]]);
  console.log('PASS per-VLAN priority changes root and blocked link');
}
{
  const topo = ring();
  topo.links[0].up = false;
  assert.deepEqual(blocked(topo, 10), [topo.links[0]], 'düşen bağlantı ağaçta yer almaz');
  assert.ok(!stp.stpIsBlocked(topo, topo.links[1], 10), 'yedek yol açılır');
  topo.devices[1].interfaces['g0/2'].allowed = [1];
  assert.equal(
    stp.stpLinkEligible(topo, topo.links[1], 10),
    false,
    'VLAN taşımayan trunk STP dışı',
  );
  console.log('PASS link failure and VLAN pruning');
}
{
  const topo = ring();
  topo.devices.push({ id: 'r1', type: 'Router', enabled: true, interfaces: {} });
  const routerLink = { a: 'sw1', portA: 'g0/3', b: 'r1', portB: 'g0/0', up: true };
  topo.links.push(routerLink);
  assert.equal(stp.stpIsBlocked(topo, routerLink, 10), false, 'switch dışı uç hiç bloklanmaz');
  const cache = new Map();
  assert.equal(stp.stpIsBlocked(topo, topo.links[1], 10, cache), true);
  assert.ok(cache.has(10), 'önbellek VLAN başına doldurulur');
  assert.deepEqual(stp.stpTreeInfo({ devices: [], links: [] }, 10).root, null);
  console.log('PASS non-switch links, cache and empty VLAN');
}

// --- ACL ---
const router = {
  acls: [
    {
      id: 100,
      action: 'deny',
      protocol: 'tcp',
      srcType: 'host',
      src: '10.0.0.5',
      dstType: 'any',
      port: 23,
    },
    {
      id: 100,
      action: 'permit',
      protocol: 'ip',
      srcType: 'network',
      src: '10.0.0.0',
      wildcard: '0.0.0.255',
      dstType: 'any',
    },
    {
      id: 'WEB',
      action: 'permit',
      protocol: 'tcp',
      srcType: 'any',
      dstType: 'host',
      dst: '192.168.1.10',
      port: 80,
    },
  ],
};
{
  const ev = (...a) => acl.aclEvaluate(router, ...a);
  assert.equal(
    ev(100, '10.0.0.5', '1.1.1.1', 'tcp', 23).action,
    'deny',
    'ilk eşleşen kural uygulanır',
  );
  assert.equal(ev(100, '10.0.0.5', '1.1.1.1', 'tcp', 80).action, 'permit');
  assert.equal(
    ev('100', '10.0.0.9', '1.1.1.1', 'icmp').action,
    'permit',
    '"ip" her protokolü kapsar',
  );
  const implicit = ev(100, '10.0.1.9', '1.1.1.1', 'icmp');
  assert.deepEqual(implicit, { action: 'deny', rule: null }, 'eşleşme yoksa örtük deny');
  assert.equal(ev('WEB', '8.8.8.8', '192.168.1.10', 'tcp', 80).action, 'permit');
  assert.equal(
    ev('WEB', '8.8.8.8', '192.168.1.10', 'tcp', 443).rule,
    null,
    'port uyuşmazsa eşleşmez',
  );
  assert.equal(
    ev('WEB', '8.8.8.8', '192.168.1.10', 'udp', 80).action,
    'deny',
    'protokol uyuşmazsa',
  );
  assert.equal(ev(999, '10.0.0.9', '1.1.1.1', 'icmp').action, 'deny', 'tanımsız liste');
  assert.equal(acl.aclEvaluate({}, 100, '10.0.0.9', '1.1.1.1', 'icmp').action, 'deny');
  console.log('PASS ACL: first match, protocols, ports, wildcard, implicit deny');
}
