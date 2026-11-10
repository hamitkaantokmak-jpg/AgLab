const assert = require('node:assert/strict');
const { normalize } = require('../../simulator/packet-events.js');
const input = [
  'frame arp-request src d3 dst ff:ff:ff:ff:ff:ff vlan 10',
  'broadcast d1 ingress fa0/1 egress fa0/2,gi0/1 vlan 10',
  'receive d4 arp-request vlan 10',
  'ttl-forward R1 2 -> 1',
  'discard d8 destination-mac',
  'icmp-undelivered d3 no-route',
  'unknown legacy event',
];
const x = normalize(input, 3);
assert.equal(x.truncated, true);
assert.equal(x.overflow, 3);
assert.equal(x.events.length, 7);
assert.deepEqual(
  x.events.map((e) => e.kind),
  ['frame', 'forward', 'receive', 'ttl', 'discard', 'icmp-undelivered', 'other'],
);
assert.deepEqual(x.events[1].detail.egress, ['fa0/2', 'gi0/1']);
assert.equal(x.events[3].detail.after, 1);
assert.equal(x.events[6].raw, 'unknown legacy event');
assert.deepEqual(
  normalize(['filter SW1 ingress fa0/1 egress - vlan 10']).events[0].detail.egress,
  [],
);
assert.throws(() => normalize(['a'], -1));
assert.throws(() => normalize([null]));
console.log('PASS packet detective event normalization');

const { at, explain } = require('../../simulator/packet-events.js');
const first = at(x, 0),
  last = at(x, 6);
assert.equal(first.hasPrevious, false);
assert.equal(first.hasNext, true);
assert.equal(last.hasNext, false);
assert.equal(last.hasPrevious, true);
assert.equal(last.logTruncated, true);
assert.equal(at(x, 7), null);
assert.equal(at(x, -1), null);
assert.match(explain(x.events[1]), /fa0\/2/);
assert.match(explain(x.events[3]), /TTL/);
assert.equal(explain(x.events[6]), 'unknown legacy event');

const inputLines = ['frame icmp-request src PC1 dst 02:00:00:00:00:02 vlan 1'];
const snapshot = normalize(inputLines);
inputLines.push('discard SW1 blocked');
assert.equal(snapshot.events.length, 1, 'event list must be a snapshot');
assert.equal(at(snapshot, 0).raw, 'frame icmp-request src PC1 dst 02:00:00:00:00:02 vlan 1');
assert.equal(at(snapshot, 0).explanation.includes('PC1'), true);
const receiveSvi = normalize(['receive SW1 arp-request vlan 10 svi vlan 10']);
assert.equal(receiveSvi.events[0].detail.svi, true);
assert.equal(receiveSvi.events[0].device, 'SW1');
const legacy = normalize(['future-protocol packet detail']).events[0];
assert.equal(legacy.kind, 'other');
assert.equal(explain(legacy), 'future-protocol packet detail');

const { diagnose } = require('../../simulator/packet-events.js');
const report = diagnose(normalize(['discard d8 ingress-port', 'icmp-undelivered d3 no-route'], 2));
assert.equal(report.issues.length, 2);
assert.equal(report.issues[0].device, 'd8');
assert.match(report.issues[0].hint, /port/);
assert.match(report.issues[1].hint, /kesin nedeni/);
assert.equal(report.truncated, true);
assert.equal(diagnose(normalize(['receive d4 arp-request vlan 10'])).issues.length, 0);
assert.equal(diagnose(normalize([])).hasEvidence, false);
const { fromEvidence } = require('../../simulator/packet-events.js');
const observed = fromEvidence(
  [
    {
      eventId: '1:1',
      raw: 'frame arp-request src pc dst ff:ff:ff:ff:ff:ff vlan 10',
      frame: { protocol: 'ARP' },
    },
    {
      eventId: '1:2',
      raw: 'wire arp-request pc -> sw',
      kind: 'wire',
      device: 'pc',
      edge: { a: 'pc', portA: 'eth0', b: 'sw', portB: 'fa0/1' },
      frame: { protocol: 'ARP', kind: 'arp-request' },
    },
  ],
  0,
  { generation: 1 },
);
assert.equal(observed.events[1].sequence, 2);
assert.equal(observed.events[1].origin, 'aglab-js');
assert.match(explain(observed.events[1]), /eth0/);
assert.equal(at({ ...observed, events: [observed.events[1]] }, 0).position, 0);
assert.equal(at({ ...observed, events: [observed.events[1]] }, 0).index, 1);
assert.equal(normalize(['ttl-expired R1 quote 10.0.0.1 -> 10.0.1.2']).events[0].kind, 'discard');
assert.match(
  explain(normalize(['frame arp-request src PC1 dst ff:ff:ff:ff:ff:ff vlan 10']).events[0]),
  /MAC adresini çözmek/,
);
assert.match(
  diagnose(normalize(['ttl-expired R1 quote 10.0.0.1 -> 10.0.1.2'])).issues[0].hint,
  /tek başına döngü kanıtı değildir/,
);

// L3-b: Labber olay adaptörü kayıtları (köken 'labber'); L2 yolu yoksa yalnız L3 notu.
{
  const { fromLabber, explain: why } = require('../../simulator/packet-events.js');
  const { matchWire, createTimeline } = require('../../simulator/simulation-playback.js');
  const frame = { protocol: 'ICMP', kind: 'icmp-request', ipv4: { ttl: 64 } };
  const edge = { a: 'd1', portA: 'eth0', b: 'd3', portB: 'fa0/1' };
  const trace = {
    ok: true,
    l2: true,
    records: [
      { raw: 'frame icmp-request src d1 dst 02:00:00:00:00:05 vlan 10', frameId: 'lf1', frame },
      {
        raw: 'wire icmp-request d1 -> d3',
        frameId: 'lf1',
        frame,
        kind: 'wire',
        device: 'd1',
        edge,
      },
      { raw: 'unicast d3 ingress fa0/1 egress gi0/24 vlan 10', frameId: 'lf1', frame },
      { raw: 'receive d5 icmp-request vlan 10', frameId: 'lf1', frame },
      { raw: 'icmp-delivered d1 from d5' },
    ],
  };
  const t = fromLabber(trace, { generation: 7, topologyKey: 'k' });
  assert.equal(t.origin, 'labber');
  assert.equal(t.l2, true);
  assert.match(t.note, /ARP çerçeveleri gösterilmez/);
  assert.deepEqual(
    t.events.map((e) => e.kind),
    ['frame', 'wire', 'forward', 'receive', 'icmp-delivered'],
  );
  assert.ok(t.events.every((e) => e.origin === 'labber'));
  assert.equal(t.events[1].eventId, '7:l2');
  assert.match(why(t.events[1]), /Labber motorunun hesapladığı yol/);
  assert.equal(matchWire(t.events[1], [{ a: 'd3', b: 'd1', portA: 'fa0/1', portB: 'eth0' }]), 0);
  const tl = createTimeline();
  tl.load(t);
  assert.equal(tl.state().total, 5);
  const l3 = fromLabber({
    ok: false,
    l2: false,
    records: [{ raw: 'icmp-undelivered d1 timeout' }],
  });
  assert.match(l3.note, /yalnız L3 atlamaları/);
  assert.throws(() => fromLabber({ records: [] }));
  console.log('PASS Labber trace normalization and replay');
}
