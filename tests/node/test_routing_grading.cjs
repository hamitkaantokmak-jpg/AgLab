const assert = require('node:assert/strict');
const { sameRoutes, interfaceState, sourceBinding } = require('../../academy/routing-grading.js');
const routes = [
  { network: '192.168.20.0', mask: '255.255.255.0', nextHop: '10.0.12.2', distance: 1 },
  { network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.12.2', distance: 1 },
];
assert(
  sameRoutes(routes, [
    { ...routes[1], metric: 10 },
    { ...routes[0], network: '192.168.20.33', distance: '1', installed: true },
  ]),
);
assert(!sameRoutes(routes, [{ ...routes[0], nextHop: '10.0.12.3' }, routes[1]]));
assert(!sameRoutes(routes, [...routes, routes[0]]));
assert(!sameRoutes(routes, [{ ...routes[0], mask: '255.0.255.0' }, routes[1]]));
assert(!sameRoutes(routes, [{ ...routes[0], distance: 0 }, routes[1]]));
assert(!sameRoutes(routes, [{ ...routes[0], distance: true }, routes[1]]));
const iface = { enabled: true, ip: '10.0.12.1', mask: '255.255.255.252' };
assert.deepEqual(
  interfaceState({ ...iface, packets: 99, operStatus: 'up' }),
  interfaceState(iface),
);
assert.notDeepEqual(interfaceState({ ...iface, enabled: false }), interfaceState(iface));
assert.notDeepEqual(interfaceState({ ...iface, vlan: 10 }), interfaceState(iface));
const router = { type: 'Router', enabled: true, interfaces: { 'g0/1': iface } };
assert.equal(
  sourceBinding(router, 'g0/1', { ok: true, route: { type: 'connected', iface: 'g0/1' } }).ip,
  '10.0.12.1',
);
assert.equal(
  sourceBinding(router, 'missing', { ok: true, route: { type: 'connected', iface: 'g0/1' } }),
  null,
);
assert.equal(
  sourceBinding({ ...router, enabled: false }, 'g0/1', {
    ok: true,
    route: { type: 'connected', iface: 'g0/1' },
  }),
  null,
);
assert.throws(() =>
  sourceBinding(router, 'g0/1', { ok: true, route: { type: 'connected', iface: 'g0/0' } }),
);
assert.throws(() =>
  sourceBinding(router, 'g0/1', { ok: true, route: { type: 'static', iface: 'g0/1' } }),
);
console.log('PASS route-set, interface semantics and connected source-interface binding');
