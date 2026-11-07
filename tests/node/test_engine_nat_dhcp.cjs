// src/engine nat.js, dhcp.js ve yol üzerindeki ACL kararı için birim testleri (tarayıcısız).
'use strict';
const assert = require('node:assert/strict');
const topology = require('../../src/engine/topology.js');
const acl = require('../../src/engine/acl.js');
const nat = require('../../src/engine/nat.js');
const dhcp = require('../../src/engine/dhcp.js');

// PC (10.0.0.5) — R1 g0/0 (inside) | R1 g0/1 (outside, 203.0.113.1) — Server (8.8.8.8)
function natLab() {
  const R1 = {
    id: 'r1',
    name: 'R1',
    type: 'Router',
    enabled: true,
    interfaces: {
      'g0/0': { ip: '10.0.0.1', mask: '255.255.255.0', natRole: 'inside', enabled: true },
      'g0/1': { ip: '203.0.113.1', mask: '255.255.255.0', natRole: 'outside', enabled: true },
    },
    acls: [
      {
        id: 1,
        action: 'permit',
        protocol: 'ip',
        srcType: 'network',
        src: '10.0.0.0',
        wildcard: '0.0.0.255',
        dstType: 'any',
      },
    ],
    natOverload: { aclId: 1, outsideInterface: 'g0/1' },
  };
  const devices = [
    { id: 'pc', name: 'PC1', type: 'PC', ip: '10.0.0.5' },
    R1,
    { id: 'srv', type: 'Server', ip: '8.8.8.8' },
  ];
  const path = [
    { a: 'pc', portA: 'eth0', b: 'r1', portB: 'g0/0', up: true },
    { a: 'r1', portA: 'g0/1', b: 'srv', portB: 'eth0', up: true },
  ];
  return { R1, topo: { devices, links: path }, path };
}

{
  const { topo, path } = natLab();
  assert.deepEqual(
    topology.orderedPathNodes(topo, 'pc', path).map((d) => d.id),
    ['pc', 'r1', 'srv'],
  );
  assert.deepEqual(
    topology.orderedPathNodes(topo, 'srv', [...path].reverse()).map((d) => d.id),
    ['srv', 'r1', 'pc'],
    'yol ters yönden de izlenir',
  );
  console.log('PASS ordered path nodes');
}

// --- NAT ---
{
  const { R1, topo, path } = natLab();
  const before = JSON.stringify(topo);
  const r = nat.natPathCheck(topo, path, 'pc', 'srv', '10.0.0.5', '8.8.8.8', 'icmp');
  assert.equal(r.ok, true);
  assert.equal(r.translated, true);
  assert.equal(r.router, 'R1');
  assert.deepEqual(r.entry, {
    key: '10.0.0.5|8.8.8.8|icmp',
    protocol: 'icmp',
    insideLocal: '10.0.0.5',
    insideGlobal: '203.0.113.1',
    outsideLocal: '8.8.8.8',
  });
  assert.equal(JSON.stringify(topo), before, 'natPathCheck tabloyu değiştirmez');
  nat.recordNatTranslation(R1, r.entry);
  nat.recordNatTranslation(R1, r.entry);
  assert.equal(R1.natTranslations.length, 1, 'aynı akış ikinci kez kaydedilmez');
  console.log('PASS NAT overload translation and explicit recording');
}
{
  const { topo, path } = natLab();
  const reverse = [...path].reverse();
  assert.deepEqual(
    nat.natPathCheck(topo, reverse, 'srv', 'pc', '8.8.8.8', '10.0.0.5', 'icmp'),
    { ok: true, translated: false },
    'outside → inside yönü çeviri başlatmaz',
  );
  console.log('PASS NAT only on inside → outside');
}
{
  const check = (mutate) => {
    const lab = natLab();
    mutate(lab.R1);
    return nat.natPathCheck(lab.topo, lab.path, 'pc', 'srv', '10.0.0.5', '8.8.8.8', 'icmp');
  };
  assert.match(check((r) => delete r.natOverload).why, /NAT overload yapılandırılmamış/);
  assert.match(check((r) => (r.natOverload.outsideInterface = 'g0/2')).why, /yanlış outside/);
  assert.match(
    check((r) => (r.interfaces['g0/1'].enabled = false)).why,
    /outside arayüzü g0\/1 kapalı/,
  );
  assert.match(
    check((r) => (r.interfaces['g0/0'].enabled = false)).why,
    /inside arayüzü g0\/0 kapalı/,
  );
  assert.match(check((r) => (r.interfaces['g0/1'].ip = '')).why, /etkin ve IP adresli/);
  assert.match(check((r) => (r.acls[0].action = 'deny')).why, /NAT ACL 1 iç kaynak/);
  assert.match(
    check((r) => (r.natOverload.aclId = 7)).why,
    /izin vermiyor/,
    'tanımsız ACL örtük deny',
  );
  assert.deepEqual(
    check((r) => (r.enabled = false)),
    { ok: true, translated: false },
    'kapalı yönlendirici NAT denetimine girmez',
  );
  console.log('PASS NAT misconfigurations are rejected');
}

// --- ACL yol kararı ---
{
  const { R1, topo, path } = natLab();
  R1.acls.push({ id: 100, action: 'deny', protocol: 'icmp', srcType: 'any', dstType: 'any' });
  R1.acls.push({ id: 100, action: 'permit', protocol: 'ip', srcType: 'any', dstType: 'any' });
  const run = (p, s, d, si, di, proto, port) =>
    acl.aclPathDecision(topo, p, s, d, si, di, proto, port);
  assert.deepEqual(run(path, 'pc', 'srv', '10.0.0.5', '8.8.8.8', 'icmp', null), { ok: true });
  R1.interfaces['g0/1'].aclOut = 100;
  const blocked = run(path, 'pc', 'srv', '10.0.0.5', '8.8.8.8', 'icmp', null);
  assert.equal(blocked.ok, false);
  assert.match(blocked.why, /ACL 100 out yönünde R1 g0\/1 .*ICMP.*eşleşen deny/);
  assert.deepEqual(run(path, 'pc', 'srv', '10.0.0.5', '8.8.8.8', 'tcp', 80), { ok: true });
  R1.interfaces['g0/0'].aclIn = 'WEB';
  const implicit = run(path, 'pc', 'srv', '10.0.0.5', '8.8.8.8', 'tcp', 80);
  assert.match(implicit.why, /ACL WEB in yönünde .*TCP \/ 80.*varsayılan deny/);
  const back = run([...path].reverse(), 'srv', 'pc', '8.8.8.8', '10.0.0.5', 'tcp', 80);
  assert.equal(back.ok, true, 'dönüş yönünde g0/1 giriş, g0/0 çıkış: ACL bağlı değil');
  console.log('PASS ACL decision per direction along a path');
}

// --- DHCP ---
function dhcpLab() {
  const R1 = {
    id: 'r1',
    name: 'R1',
    type: 'Router',
    enabled: true,
    interfaces: {
      'g0/0': {
        ip: '192.168.10.1',
        mask: '255.255.255.0',
        helperAddress: '10.0.0.10',
        enabled: true,
      },
      'g0/1': { ip: '10.0.0.1', mask: '255.255.255.0', enabled: true },
    },
  };
  const pc = { id: 'pc', type: 'PC' };
  const srv = { id: 'srv', type: 'Server', ip: '10.0.0.10', mask: '255.255.255.0' };
  const sw = { id: 'sw', type: 'Switch' };
  const path = [
    { a: 'pc', portA: 'eth0', b: 'sw', portB: 'fa0/1' },
    { a: 'sw', portA: 'g0/1', b: 'r1', portB: 'g0/0' },
    { a: 'r1', portA: 'g0/1', b: 'srv', portB: 'eth0' },
  ];
  return { R1, pc, srv, path, topo: { devices: [pc, sw, R1, srv], links: path } };
}
{
  const { R1, path, topo } = dhcpLab();
  const relay = dhcp.findRelayOnPath(topo, 'pc', path, '10.0.0.10');
  assert.equal(relay.router, R1);
  assert.equal(relay.iface, R1.interfaces['g0/0']);
  assert.equal(dhcp.findRelayOnPath(topo, 'pc', path, '10.0.0.99'), null, 'yanlış helper adresi');
  R1.interfaces['g0/0'].enabled = false;
  assert.equal(dhcp.findRelayOnPath(topo, 'pc', path, '10.0.0.10'), null, 'kapalı relay arayüzü');
  console.log('PASS DHCP relay lookup');
}
{
  const { pc, topo } = dhcpLab();
  const lease = (o) => dhcp.allocateLease(topo, pc, o);
  assert.deepEqual(
    lease({
      network: '192.168.10.0',
      mask: '255.255.255.0',
      gateway: '192.168.10.1',
      serverIp: '10.0.0.10',
    }),
    { ok: true, ip: '192.168.10.100' },
    'havuz .100 adresinden başlar',
  );
  topo.devices.push({ id: 'pc2', type: 'PC', ip: '192.168.10.100' });
  assert.equal(
    lease({ network: '192.168.10.0', mask: '255.255.255.0', gateway: '192.168.10.1' }).ip,
    '192.168.10.101',
    'kullanılan adres atlanır',
  );
  pc.ip = '192.168.10.102';
  assert.equal(
    lease({ network: '192.168.10.0', mask: '255.255.255.0' }).ip,
    '192.168.10.101',
    'istemcinin kendi eski adresi dolu sayılmaz ama sıra korunur',
  );
  assert.deepEqual(
    lease({ network: '192.168.20.0', mask: '255.255.255.248', gateway: '192.168.20.1' }),
    { ok: true, ip: '192.168.20.6' },
    '.100 yoksa son kullanılabilir adresten başlar',
  );
  topo.devices.push({ id: 'pc3', type: 'PC', ip: '192.168.20.6' });
  assert.equal(
    lease({ network: '192.168.20.0', mask: '255.255.255.248', gateway: '192.168.20.1' }).ip,
    '192.168.20.2',
    'sonra baştaki adreslere döner; ağ geçidi atlanır',
  );
  assert.deepEqual(lease({ network: '10.1.1.0', mask: '255.255.255.254' }), {
    ok: false,
    reason: 'invalid-subnet',
  });
  assert.deepEqual(lease({ network: '', mask: '255.255.255.0' }), {
    ok: false,
    reason: 'invalid-subnet',
  });
  for (let h = 1; h <= 6; h++) topo.devices.push({ id: 'h' + h, ip: '10.9.9.' + h });
  assert.deepEqual(lease({ network: '10.9.9.0', mask: '255.255.255.248' }), {
    ok: false,
    reason: 'pool-exhausted',
  });
  console.log('PASS DHCP lease allocation: start offset, conflicts, small and invalid subnets');
}
