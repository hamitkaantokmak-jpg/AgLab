// Explicit whole-run selection. Descriptors do not imply automatic interoperability.
(function (root) {
  'use strict';
  const features = [
    'arp',
    'icmp',
    'vlan',
    'trunk',
    'stp',
    'routing',
    'ospf',
    'bgp',
    'dhcp',
    'nat',
    'acl',
    'ipv6',
  ];
  const descriptors = [
    {
      id: 'aglab-js',
      name: 'AğLab JS',
      scope: 'browser',
      capabilities: Object.fromEntries(
        features.map((f) => [f, f === 'ipv6' ? 'unsupported' : 'education']),
      ),
    },
    {
      id: 'borck',
      name: 'MIT NetSim',
      scope: 'browser-comparison',
      capabilities: Object.fromEntries(
        features.map((f) => [
          f,
          ['arp', 'icmp', 'vlan'].includes(f) ? 'experimental' : 'unsupported',
        ]),
      ),
    },
    {
      id: 'linux-bridge',
      name: 'Linux bridge',
      scope: 'separate-lab',
      capabilities: Object.fromEntries(
        features.map((f) => [
          f,
          ['arp', 'icmp', 'vlan', 'trunk', 'stp'].includes(f) ? 'native-lab' : 'unsupported',
        ]),
      ),
    },
    {
      id: 'frr',
      name: 'FRRouting',
      scope: 'separate-lab',
      capabilities: Object.fromEntries(
        features.map((f) => [
          f,
          ['arp', 'icmp', 'routing', 'ospf', 'bgp'].includes(f) ? 'native-lab' : 'unverified',
        ]),
      ),
    },
  ];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function requirements(t) {
    if (
      !t ||
      !Array.isArray(t.devices) ||
      !Array.isArray(t.links) ||
      t.devices.some((d) => !d || typeof d !== 'object')
    )
      throw Error('Invalid topology');
    const need = new Set(['arp', 'icmp']);
    for (const d of t.devices) {
      if (d.type === 'Switch') need.add('vlan');
      if (d.type === 'Router' || d.staticRoutes?.length) need.add('routing');
      if (d.ospf) need.add('ospf');
      if (d.bgp) need.add('bgp');
      if (d.natOverload) need.add('nat');
      if (d.acls?.length) need.add('acl');
      if (d.services?.dhcp) need.add('dhcp');
      for (const p of Object.values(d.interfaces || {})) {
        if (p.mode === 'trunk') need.add('trunk');
        if (p.helperAddress) need.add('dhcp');
      }
    }
    const parents = new Map(t.devices.map((d) => [d.id, d.id])),
      find = (id) => {
        let seen = new Set();
        while (parents.has(id) && parents.get(id) !== id) {
          if (seen.has(id)) throw Error('Invalid topology');
          seen.add(id);
          id = parents.get(id);
        }
        return id;
      };
    for (const l of t.links) {
      if (!l || !parents.has(l.a) || !parents.has(l.b)) throw Error('Invalid topology');
      if (l.up === false) continue;
      const a = find(l.a),
        b = find(l.b);
      if (a === b) need.add('stp');
      else parents.set(a, b);
    }
    return [...need];
  }
  function createManager() {
    const adapters = new Map();
    const describe = (id) => {
      const d = descriptors.find((d) => d.id === id);
      if (!d) throw Error('Unknown engine: ' + id);
      return clone(d);
    };
    function check(id, t) {
      const d = describe(id),
        required = requirements(t),
        reasons = required
          .filter((f) => d.capabilities[f] === 'unsupported')
          .map((f) => 'Unsupported feature: ' + f);
      if (d.scope === 'separate-lab')
        reasons.push('Separate lab: selected browser topology is not deployed or synchronized');
      if (!reasons.length && adapters.has(id)) {
        const c = adapters.get(id).check?.(clone(t));
        if (c && !c.ok) reasons.push(...c.reasons);
      }
      return { ok: reasons.length === 0, reasons, required, engine: d };
    }
    return Object.freeze({
      defaultEngine: 'aglab-js',
      list: () => clone(descriptors),
      describe,
      requirements,
      check,
      register(id, adapter) {
        describe(id);
        if (typeof adapter?.run !== 'function') throw Error('Invalid adapter');
        adapters.set(id, adapter);
      },
      run(id, t, request) {
        const c = check(id, t);
        if (!c.ok) throw Error('Unsupported or separate lab: ' + c.reasons.join('; '));
        const adapter = adapters.get(id);
        if (!adapter) throw Error('Engine adapter is not connected');
        const result = adapter.run(clone(t), clone(request));
        return {
          ...result,
          engineId: id,
          executionScope: c.engine.scope,
          requirements: c.required,
        };
      },
    });
  }
  const api = { createManager, requirements };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AgLabEngineManager = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
