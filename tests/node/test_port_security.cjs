// Isolated regression for port-security's invalid source MAC fail-closed behavior.
// L7b: oracle (src/engine/portsec.js; the product's port security runs in Labber).
const assert = require('node:assert/strict');

const events = [];
let saves = 0;
const { createPortSecurity } = require('../../src/engine/portsec.js');
const ps = createPortSecurity({
  macOf: (source) => source.mac,
  save: () => {
    saves++;
  },
  event: (text) => events.push(text),
});
const allow = (sw, source) => ps.allows(sw, 'fa0/1', source);
const makeSwitch = () => ({
  id: 'sw1',
  interfaces: {
    'fa0/1': { portSecurity: { enabled: true, max: 2, violation: 'shutdown', macs: [] } },
  },
});
const sw = makeSwitch();
for (const mac of [undefined, null, '', 'garbage', '01:00:5e:00:00:01', '00:00:00:00:00:00']) {
  assert.equal(allow(sw, { mac }), false, String(mac));
  assert.deepEqual(sw.interfaces['fa0/1'].portSecurity.macs, []);
  assert.equal(sw.interfaces['fa0/1'].errdisabled, undefined);
}
assert.equal(saves, 0);
assert.equal(events.length, 6);
assert.ok(events.every((e) => e.includes('invalid-mac')));
assert.equal(allow(sw, { mac: '02:00:00:00:00:01' }), true);
assert.deepEqual(Array.from(sw.interfaces['fa0/1'].portSecurity.macs), ['02:00:00:00:00:01']);
assert.equal(saves, 1);
console.log('PASS: invalid MAC rejected without learning or shutdown');
