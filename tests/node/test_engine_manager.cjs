'use strict';
const assert = require('node:assert/strict');
const { createManager, requirements } = require('../../simulator/engine-manager.js');
const manager = createManager();
assert.equal(manager.defaultEngine, 'aglab-js');
assert.equal(manager.describe('borck').capabilities.trunk, 'unsupported');
assert.equal(manager.describe('frr').scope, 'separate-lab');
assert.throws(() => manager.run('unknown', {}, {}), /Unknown engine/);
const topology = {
  devices: [
    { id: 's1', type: 'Switch', interfaces: { a: { mode: 'trunk', allowed: [10] } } },
    { id: 'p1', type: 'PC' },
  ],
  links: [],
};
assert.ok(requirements(topology).includes('trunk'));
assert.equal(manager.check('borck', topology).ok, false);
assert.equal(manager.check('frr', topology).ok, false);
assert.throws(() => manager.run('frr', topology, {}), /separate|supported/i);
let calls = 0;
manager.register('aglab-js', {
  check: () => ({ ok: true, reasons: [] }),
  run: () => {
    calls++;
    return { ok: true, events: [] };
  },
});
assert.equal(manager.run('aglab-js', topology, {}).ok, true);
assert.equal(calls, 1);
assert.equal(manager.describe('aglab-js').id, 'aglab-js');
assert.throws(() => manager.register('unknown', {}), /Unknown engine/);
assert.throws(() => manager.check('aglab-js', { devices: [null], links: [] }), /Invalid topology/);
console.log('PASS explicit single-engine capability gate; no fallback or FRR admin execution');
