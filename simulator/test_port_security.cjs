// Isolated regression for port-security's invalid source MAC fail-closed behavior.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const events = [];
let saves = 0;
const context = {
  WeakMap, WeakSet, Set, Object, Number, String, parseInt,
  macOf: source => source.mac,
  saveTopology: () => { saves++; },
  ethernetEvent: text => events.push(text),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'port-security.js'), 'utf8'), context);
const allow = (sw, source) => vm.runInContext('portSecurityAllows(switchUnderTest, "fa0/1", sourceUnderTest)', Object.assign(context, {switchUnderTest: sw, sourceUnderTest: source}));
const makeSwitch = () => ({
  id: 'sw1', interfaces: {'fa0/1': {portSecurity: {enabled: true, max: 2, violation: 'shutdown', macs: []}}}
});
const sw = makeSwitch();
for (const mac of [undefined, null, '', 'garbage', '01:00:5e:00:00:01', '00:00:00:00:00:00']) {
  assert.equal(allow(sw, {mac}), false, String(mac));
  assert.deepEqual(sw.interfaces['fa0/1'].portSecurity.macs, []);
  assert.equal(sw.interfaces['fa0/1'].errdisabled, undefined);
}
assert.equal(saves, 0);
assert.equal(events.length, 6);
assert.ok(events.every(e => e.includes('invalid-mac')));
assert.equal(allow(sw, {mac: '02:00:00:00:00:01'}), true);
assert.deepEqual(Array.from(sw.interfaces['fa0/1'].portSecurity.macs), ['02:00:00:00:00:01']);
assert.equal(saves, 1);
console.log('PASS: invalid MAC rejected without learning or shutdown');
