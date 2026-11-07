// src/engine birim testleri: tarayıcı/DOM olmadan Node'da çalışır.
'use strict';
const assert = require('node:assert/strict');
const ipv4 = require('../../src/engine/ipv4.js');
const topology = require('../../src/engine/topology.js');
const routing = require('../../src/engine/routing.js');

assert.equal(typeof globalThis.document, 'undefined', 'motor testleri DOM olmadan koşmalı');

// --- IPv4 yardımcıları ---
assert.equal(ipv4.validIP('192.168.1.1'), true);
for (const bad of ['256.1.1.1', '1.2.3', '1.2.3.4.5', 'a.b.c.d', '', '1.2.3.-1'])
  assert.equal(ipv4.validIP(bad), false, bad);
assert.equal(ipv4.ipNum('10.0.0.1'), 167772161);
assert.equal(ipv4.ipNum('x'), null);
assert.equal(ipv4.prefixLen('255.255.255.0'), 24);
assert.equal(ipv4.prefixLen('0.0.0.0'), 0);
assert.equal(ipv4.prefixLen('255.0.255.0'), -1, 'ardışık olmayan maske');
assert.equal(ipv4.subnet('192.168.1.77', '255.255.255.192'), '192.168.1.64');
assert.equal(ipv4.subnet('192.168.1.77', '255.0.255.0'), '');
assert.equal(ipv4.inNetwork('10.1.2.3', '10.1.0.0', '255.255.0.0'), true);
assert.equal(ipv4.inNetwork('10.2.2.3', '10.1.0.0', '255.255.0.0'), false);
assert.equal(ipv4.inNetwork('200.1.1.1', '0.0.0.0', '0.0.0.0'), true, 'varsayılan rota');
assert.equal(
  ipv4.inNetwork('200.1.1.1', '200.1.1.1', '255.255.255.255'),
  true,
  '/32 (işaretli bit)',
);
assert.equal(ipv4.routePrefixText('255.255.255.252'), '/30');
assert.equal(ipv4.routePrefixText('bad'), '?');
assert.equal(ipv4.maskFromPrefix(0), '0.0.0.0');
assert.equal(ipv4.maskFromPrefix(20), '255.255.240.0');
assert.equal(ipv4.maskFromPrefix(33), '');
assert.equal(ipv4.maskFromWildcard('0.0.0.255'), '255.255.255.0');
assert.equal(ipv4.maskFromWildcard('bad'), '0.0.0.0');
console.log('PASS ipv4 helpers');

// --- Topoloji: R1 g0/0 — SW1, R1 g0/1 — R2 g0/1 ---
function lab() {
  const R1 = {
    id: 'r1',
    name: 'R1',
    type: 'Router',
    enabled: true,
    ports: ['g0/0', 'g0/1', 'g0/2'],
    interfaces: {
      'g0/0': { ip: '192.168.1.1', mask: '255.255.255.0', enabled: true },
      'g0/1': { ip: '10.0.0.1', mask: '255.255.255.252', enabled: true },
      'g0/2': { ip: '172.16.0.1', mask: '255.255.0.0', enabled: true },
    },
    staticRoutes: [],
  };
  const R2 = {
    id: 'r2',
    name: 'R2',
    type: 'Router',
    enabled: true,
    ports: ['g0/1'],
    interfaces: { 'g0/1': { ip: '10.0.0.2', mask: '255.255.255.252', enabled: true } },
  };
  const SW1 = { id: 's1', name: 'SW1', type: 'Switch', enabled: true, ports: ['fa0/1', 'fa0/2'] };
  return {
    R1,
    topo: {
      devices: [R1, R2, SW1],
      links: [
        { a: 'r1', portA: 'g0/0', b: 's1', portB: 'fa0/1', up: true },
        { a: 'r1', portA: 'g0/1', b: 'r2', portB: 'g0/1', up: true },
      ],
    },
  };
}

{
  const { R1, topo } = lab();
  assert.equal(topology.getDevice(topo, 'r2').name, 'R2');
  assert.equal(topology.linkUp(topo, topo.links[0]), true);
  assert.equal(topology.freePort(topo, R1), 'g0/2');
  assert.equal(topology.linkPort(topo.links[1], 'r2'), 'g0/1');
  R1.interfaces['g0/0'].errdisabled = true;
  assert.equal(topology.linkUp(topo, topo.links[0]), false, 'err-disabled port bağlantıyı düşürür');
  R1.interfaces['g0/0'].errdisabled = false;
  topo.devices[2].enabled = false;
  assert.equal(topology.linkUp(topo, topo.links[0]), false, 'kapalı cihaz bağlantıyı düşürür');
  console.log('PASS topology queries');
}

// --- Bağlı rotalar ---
{
  const { R1, topo } = lab();
  const nets = routing.connectedRoutes(topo, R1).map((r) => r.network + '/' + r.prefix);
  assert.deepEqual(nets, ['192.168.1.0/24', '10.0.0.0/30'], 'kablosuz g0/2 bağlı rota üretmez');
  topo.links[0].up = false;
  assert.deepEqual(
    routing.connectedRoutes(topo, R1).map((r) => r.iface),
    ['g0/1'],
    'düşen bağlantının ağı tablodan çıkar',
  );
  console.log('PASS connected routes follow link state');
}

// --- Alt arayüzler: dot1q ve VLAN zorunlu, üst arayüz açık olmalı ---
{
  const { R1, topo } = lab();
  R1.interfaces['g0/0.10'] = {
    ip: '10.10.0.1',
    mask: '255.255.255.0',
    parent: 'g0/0',
    encapsulation: 'dot1q',
    vlan: 10,
    enabled: true,
  };
  R1.interfaces['g0/0.20'] = { ip: '10.20.0.1', mask: '255.255.255.0', parent: 'g0/0' };
  const names = () => routing.activeRouterInterfaces(R1).map(([n]) => n);
  assert.ok(names().includes('g0/0.10'));
  assert.ok(!names().includes('g0/0.20'), 'encapsulation olmadan alt arayüz etkin değil');
  assert.equal(routing.routeLookup(topo, R1, '10.10.0.9').route.iface, 'g0/0.10');
  R1.interfaces['g0/0'].enabled = false;
  assert.ok(!names().includes('g0/0.10'), 'üst arayüz kapalıysa alt arayüz de kapalı');
  console.log('PASS dot1q subinterfaces');
}

// --- Statik rotalar, LPM, AD, özyineleme ---
{
  const { R1, topo } = lab();
  R1.staticRoutes = [
    { network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.0.2' },
    { network: '8.8.0.0', mask: '255.255.0.0', nextHop: '10.0.0.2', distance: 1 },
    { network: '8.8.8.0', mask: '255.255.255.0', nextHop: '192.168.1.254', distance: 1 },
    { network: '9.9.9.0', mask: '255.255.255.0', nextHop: '10.0.0.2', distance: 200 },
    { network: '9.9.9.0', mask: '255.255.255.0', nextHop: '192.168.1.254', distance: 5 },
    { network: '7.7.7.0', mask: '255.255.255.0', nextHop: '8.8.1.1' },
    { network: '6.6.6.0', mask: '255.255.255.0', nextHop: '10.0.0.2', distance: 0 },
  ];
  const look = (d) => routing.routeLookup(topo, R1, d);
  assert.equal(look('8.8.8.8').route.network, '8.8.8.0', 'en uzun önek kazanır');
  assert.equal(look('8.8.4.4').route.network, '8.8.0.0');
  assert.equal(look('9.9.9.9').route.nextHop, '192.168.1.254', 'düşük yönetimsel uzaklık kazanır');
  const rec = look('7.7.7.7').route;
  assert.equal(rec.resolvedVia, 'recursive');
  assert.equal(rec.iface, 'g0/1');
  assert.equal(rec.resolutionRoute, '8.8.0.0/16');
  assert.equal(
    look('6.6.6.6').route.network,
    '0.0.0.0',
    'AD 0 geçersiz; varsayılan rota kullanılır',
  );
  assert.equal(look('192.168.1.50').route.type, 'connected');
  assert.equal(look('300.1.1.1').ok, false);
  assert.match(look('300.1.1.1').why, /Geçersiz hedef/);
  console.log('PASS static routing: LPM, distance, recursion, default');
}

// --- Başarısız durumlar: çözülemeyen next-hop, döngü, rota yok ---
{
  const { R1, topo } = lab();
  R1.staticRoutes = [
    { network: '5.5.5.0', mask: '255.255.255.0', nextHop: '4.4.4.4' },
    { network: '4.4.4.0', mask: '255.255.255.0', nextHop: '5.5.5.5' },
  ];
  const loop = routing.routeLookup(topo, R1, '5.5.5.1');
  assert.equal(loop.ok, false, 'birbirine dayanan statik rotalar döngüye girmeden reddedilir');
  assert.match(loop.why, /çözümlenemedi/);
  const none = routing.routeLookup(topo, R1, '1.1.1.1');
  assert.equal(none.ok, false);
  assert.equal(none.why, 'R1 üzerinde 1.1.1.1 için eşleşen ve kullanılabilir rota yok.');
  // Daha uzun önek çözülemezse daha kısa aday denenir.
  R1.staticRoutes = [
    { network: '3.3.3.0', mask: '255.255.255.0', nextHop: '2.2.2.2' },
    { network: '3.3.0.0', mask: '255.255.0.0', nextHop: '10.0.0.2' },
  ];
  assert.equal(routing.routeLookup(topo, R1, '3.3.3.3').route.network, '3.3.0.0');
  // Bağlantı düşünce next-hop'u o ağda olan rota kullanılamaz.
  topo.links[1].up = false;
  assert.equal(routing.routeLookup(topo, R1, '3.3.3.3').ok, false);
  console.log('PASS unresolvable/looping/absent routes are rejected');
}

// --- Eski `route` alanı ve dinamik rota sağlayıcısı ---
{
  const { R1, topo } = lab();
  R1.route = '10.0.0.2';
  assert.equal(routing.staticRoutes(R1)[0].network, '0.0.0.0');
  const dynamicRoutes = () => [
    {
      network: '4.0.0.0',
      mask: '255.0.0.0',
      prefix: 8,
      nextHop: '10.0.0.2',
      distance: 110,
      metric: 20,
      type: 'ospf',
    },
  ];
  assert.equal(routing.routeLookup(topo, R1, '4.1.1.1', { dynamicRoutes }).route.type, 'ospf');
  assert.equal(routing.routeLookup(topo, R1, '4.1.1.1').route.network, '0.0.0.0');
  console.log('PASS legacy default route and injected dynamic routes');
}

// --- Saflık: girdiler değiştirilmez ---
{
  const { R1, topo } = lab();
  R1.staticRoutes = [{ network: '7.7.7.0', mask: '255.255.255.0', nextHop: '8.8.1.1' }];
  const before = JSON.stringify(topo);
  routing.routeLookup(topo, R1, '7.7.7.7');
  routing.connectedRoutes(topo, R1);
  assert.equal(JSON.stringify(topo), before, 'motor topolojiyi değiştirmemeli');
  console.log('PASS engine does not mutate its inputs');
}
