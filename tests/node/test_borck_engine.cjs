'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const engine = require('../../simulator/borck-engine.generated.js'),
  { fixture } = require('../../simulator/borck-fixtures.cjs'),
  reference = require('../../simulator/borck-production-reference.cjs');
const provenance = require('../../third_party/borck-netsim/provenance.json');
for (const [p, hash] of Object.entries(provenance.sha256))
  assert.equal(
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(__dirname, '../../third_party/borck-netsim', p)))
      .digest('hex'),
    hash,
  );
let tests = 0;
function test(name, fn) {
  fn();
  tests++;
  console.log('PASS ' + name);
}
test('real upstream identity and cold/warm ARP/ICMP across two switches', () => {
  const session = engine.createSession(fixture()),
    cold = session.ping('p0', '10.0.0.2');
  assert.equal(cold.engine.commit, provenance.commit);
  assert.equal(cold.ok, true);
  assert.equal(cold.events.filter((e) => e.kind === 'arp').length, 6);
  assert.equal(cold.events.filter((e) => e.kind === 'icmp').length, 6);
  assert.ok(cold.events.slice(0, 6).every((e) => e.kind === 'arp'));
  assert.equal(cold.arp.p0[0].ip, '10.0.0.2');
  assert.equal(cold.mac.s0.length, 2);
  assert.equal(cold.mac.s1.length, 2);
  const warm = session.ping('p0', '10.0.0.2');
  assert.equal(warm.ok, true);
  assert.ok(warm.events.every((e) => e.kind === 'icmp'));
});
for (const name of ['success', 'isolation', 'cable', 'port shutdown', 'device disabled'])
  test('production outcome parity: ' + name, () => {
    const t = fixture();
    if (name === 'isolation') t.devices.find((d) => d.id === 's1').interfaces['fa0/2'].vlan = 20;
    if (name === 'cable') t.links.pop();
    if (name === 'port shutdown') t.devices[1].interfaces.eth0.enabled = false;
    if (name === 'device disabled') t.devices[1].enabled = false;
    const a = engine.run(t, 'p0', '10.0.0.2'),
      b = reference.session(t).ping();
    assert.equal(a.ok, b.ok);
    assert.equal(a.ok, name === 'success');
    if (name === 'isolation')
      assert.equal(
        a.events.some((e) => e.kind === 'icmp'),
        false,
      );
  });
test('unsupported trunk, routing, port-security and loops fail explicitly', () => {
  for (const change of [
    (t) => {
      t.devices[2].interfaces.uplink.mode = 'trunk';
    },
    (t) => {
      t.devices[0].type = 'Router';
    },
    (t) => {
      t.devices[2].interfaces.uplink.portSecurity = { enabled: true };
    },
    (t) => {
      t.devices[2].ports.push('extra');
      t.devices[3].ports.push('extra');
      t.links.push({ a: 's0', b: 's1', portA: 'extra', portB: 'extra' });
    },
  ]) {
    const t = fixture();
    change(t);
    assert.equal(engine.support(t).ok, false);
    assert.throws(() => engine.createSession(t), /Unsupported topology/);
  }
});
test('wrong reachable-subnet gateway produces upstream ARP failure', () => {
  const t = fixture();
  t.devices[1].ip = '192.168.20.2';
  t.devices[0].gateway = '10.0.0.254';
  t.devices[1].gateway = '192.168.20.254';
  const r = engine.run(t, 'p0', '192.168.20.2');
  assert.equal(r.ok, false);
  assert.ok(r.replies.some((e) => e.type === 'send-error'));
  assert.ok(r.events.every((e) => e.kind === 'arp'));
});
test('off-subnet gateway is not silently discarded', () => {
  const t = fixture();
  t.devices[0].gateway = '172.16.1.1';
  assert.throws(() => engine.createSession(t), /invalid gateway/);
});
test('invalid input and topology immutability', () => {
  const t = fixture(),
    before = JSON.stringify(t);
  engine.run(t, 'p0', '10.0.0.2');
  assert.equal(JSON.stringify(t), before);
  for (const mutate of [
    (t) => (t.devices[1].mac = t.devices[0].mac),
    (t) => (t.devices[0].mask = '255.0.255.0'),
    (t) => t.devices[0].ports.push('eth1'),
  ]) {
    const t = fixture();
    mutate(t);
    assert.equal(engine.support(t).ok, false);
  }
});
console.log('PASS ' + tests + ' third-party engine contract groups');
