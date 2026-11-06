/* Michael Borck NetSim — MIT, copyright (c) 2026 Michael Borck.
MIT License

Copyright (c) 2026 Michael Borck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var AgLabBorckEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);

  // simulator/borck-adapter.ts
  var borck_adapter_exports = {};
  __export(borck_adapter_exports, {
    createSession: () => createSession,
    identity: () => identity,
    prefix: () => prefix,
    run: () => run,
    support: () => support
  });

  // third_party/borck-netsim/engine/scheduler.ts
  var Scheduler = class {
    constructor() {
      __publicField(this, "now", 0);
      __publicField(this, "seq", 0);
      __publicField(this, "queue", []);
    }
    schedule(delay, fn) {
      const ev = { t: this.now + Math.max(0, delay), seq: this.seq++, fn };
      let lo = 0;
      let hi = this.queue.length;
      while (lo < hi) {
        const mid = lo + hi >> 1;
        const e = this.queue[mid];
        if (e.t < ev.t || e.t === ev.t && e.seq < ev.seq) lo = mid + 1;
        else hi = mid;
      }
      this.queue.splice(lo, 0, ev);
      return ev;
    }
    cancel(ev) {
      const i = this.queue.indexOf(ev);
      if (i >= 0) this.queue.splice(i, 1);
    }
    advanceTo(t) {
      while (this.queue.length && this.queue[0].t <= t) {
        const ev = this.queue.shift();
        this.now = ev.t;
        ev.fn();
      }
      if (t > this.now) this.now = t;
    }
    get pending() {
      return this.queue.length;
    }
  };

  // third_party/borck-netsim/engine/device.ts
  var NetInterface = class {
    constructor(device, name, mac) {
      this.device = device;
      this.name = name;
      this.mac = mac;
      __publicField(this, "link", null);
      __publicField(this, "up", true);
      __publicField(this, "ip", null);
    }
    send(frame) {
      if (this.up && this.link) this.link.transmit(this, frame);
    }
  };
  var Device = class {
    constructor(network, id, name) {
      this.network = network;
      this.id = id;
      this.name = name;
      __publicField(this, "interfaces", []);
    }
    addInterfaces(prefix2, count) {
      for (let i = 0; i < count; i++) {
        this.interfaces.push(new NetInterface(this, `${prefix2}${i}`, this.network.nextMac()));
      }
    }
    getInterface(name) {
      return this.interfaces.find((i) => i.name === name) ?? null;
    }
    freeInterface() {
      return this.interfaces.find((i) => !i.link) ?? null;
    }
  };
  var Link = class {
    constructor(network, id, a, b, latency = 80) {
      this.network = network;
      this.id = id;
      this.a = a;
      this.b = b;
      this.latency = latency;
      a.link = this;
      b.link = this;
    }
    other(i) {
      return i === this.a ? this.b : this.a;
    }
    transmit(from, frame) {
      const to = this.other(from);
      this.network.emitWire(this, from.device, to.device, frame);
      this.network.scheduler.schedule(this.latency, () => {
        if (to.up) to.device.receiveFrame(to, frame);
      });
    }
    detach() {
      this.a.link = null;
      this.b.link = null;
    }
  };

  // third_party/borck-netsim/engine/network.ts
  var NAME_PREFIX = {
    host: "pc",
    switch: "sw",
    router: "r",
    firewall: "fw",
    server: "srv",
    ap: "ap"
  };
  var Network = class {
    constructor() {
      __publicField(this, "scheduler", new Scheduler());
      __publicField(this, "devices", /* @__PURE__ */ new Map());
      __publicField(this, "links", /* @__PURE__ */ new Map());
      __publicField(this, "onWireTransfer", null);
      // Fired when a declared firewall chain drops or rejects a packet — the UI
      // flashes the device so students see *where* traffic died.
      __publicField(this, "onFwDrop", null);
      __publicField(this, "macCounter", 0);
      __publicField(this, "wireCounter", 0);
      __publicField(this, "idCounter", 0);
    }
    get now() {
      return this.scheduler.now;
    }
    nextMac() {
      const n = ++this.macCounter;
      const b1 = (n >> 8 & 255).toString(16).padStart(2, "0");
      const b0 = (n & 255).toString(16).padStart(2, "0");
      return `02:00:00:00:${b1}:${b0}`;
    }
    allocId(prefix2) {
      let id;
      do {
        id = `${prefix2}${++this.idCounter}`;
      } while (this.devices.has(id) || this.links.has(id));
      return id;
    }
    allocName(kind) {
      const used = new Set([...this.devices.values()].map((d) => d.name));
      let n = 0;
      let name;
      do {
        name = `${NAME_PREFIX[kind]}${++n}`;
      } while (used.has(name));
      return name;
    }
    register(device) {
      this.devices.set(device.id, device);
    }
    removeDevice(id) {
      const d = this.devices.get(id);
      if (!d) return [];
      const removedLinks = [];
      for (const iface of d.interfaces) {
        if (iface.link) {
          removedLinks.push(iface.link.id);
          this.disconnect(iface.link.id);
        }
      }
      this.devices.delete(id);
      return removedLinks;
    }
    connect(aId, bId, opts = {}) {
      const a = this.devices.get(aId);
      const b = this.devices.get(bId);
      if (!a || !b) throw new Error("unknown device");
      if (aId === bId) throw new Error("cannot connect a device to itself");
      const ia = opts.aIface ? a.getInterface(opts.aIface) : a.freeInterface();
      const ib = opts.bIface ? b.getInterface(opts.bIface) : b.freeInterface();
      if (!ia) throw new Error(`${a.name}: no free interface`);
      if (!ib) throw new Error(`${b.name}: no free interface`);
      if (ia.link || ib.link) throw new Error("interface already connected");
      const link = new Link(this, opts.id ?? this.allocId("link-"), ia, ib);
      this.links.set(link.id, link);
      return link;
    }
    disconnect(linkId) {
      const l = this.links.get(linkId);
      if (!l) return;
      l.detach();
      this.links.delete(linkId);
    }
    interfaceOwner(iface) {
      return iface.device;
    }
    emitWire(link, from, to, frame) {
      if (!this.onWireTransfer) return;
      this.onWireTransfer({
        id: ++this.wireCounter,
        linkId: link.id,
        fromDeviceId: from.id,
        toDeviceId: to.id,
        kind: frame.payload.kind === "arp" ? "arp" : frame.payload.l4.kind,
        start: this.scheduler.now,
        end: this.scheduler.now + link.latency
      });
    }
  };

  // third_party/borck-netsim/engine/ip.ts
  var BROADCAST_MAC = "ff:ff:ff:ff:ff:ff";
  var BROADCAST_IP = 4294967295;
  function parseIp(s) {
    const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const parts = m.slice(1).map(Number);
    if (parts.some((p) => p > 255)) return null;
    return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
  }
  function ipToString(ip) {
    return [ip >>> 24, ip >>> 16 & 255, ip >>> 8 & 255, ip & 255].join(".");
  }
  function maskOf(prefix2) {
    return prefix2 === 0 ? 0 : 4294967295 << 32 - prefix2 >>> 0;
  }
  function networkOf(addr, prefix2) {
    return (addr & maskOf(prefix2)) >>> 0;
  }
  function cidrToString(addr, prefix2) {
    return `${ipToString(addr)}/${prefix2}`;
  }

  // third_party/borck-netsim/engine/firewall.ts
  function pktProto(pkt) {
    return pkt.l4.kind === "icmp" ? "icmp" : pkt.l4.kind;
  }
  function pktPorts(pkt) {
    const l4 = pkt.l4;
    if (l4.kind === "tcp" || l4.kind === "udp") return { sport: l4.srcPort, dport: l4.dstPort };
    return { sport: null, dport: null };
  }
  function inRange(p, r) {
    return p !== null && p >= r.from && p <= r.to;
  }
  function matchesRule(m, pkt, ctx) {
    if (m.srcNet && networkOf(pkt.src, m.srcNet.prefix) !== networkOf(m.srcNet.addr, m.srcNet.prefix))
      return false;
    if (m.dstNet && networkOf(pkt.dst, m.dstNet.prefix) !== networkOf(m.dstNet.addr, m.dstNet.prefix))
      return false;
    if (m.proto && pktProto(pkt) !== m.proto) return false;
    const ports = pktPorts(pkt);
    if (m.sport && !inRange(ports.sport, m.sport)) return false;
    if (m.dport && !inRange(ports.dport, m.dport)) return false;
    if (m.icmpType) {
      if (pkt.l4.kind !== "icmp" || pkt.l4.msg.type !== m.icmpType) return false;
    }
    if (m.ctStates && !m.ctStates.includes(ctx.ctState)) return false;
    if (m.iif && m.iif !== ctx.iif) return false;
    if (m.oif && m.oif !== ctx.oif) return false;
    return true;
  }
  function emptyFilterChain(name) {
    return { declared: false, name, policy: "accept", rules: [] };
  }
  function emptyNatChain(name) {
    return { declared: false, name, rules: [] };
  }
  var FirewallModel = class {
    constructor() {
      __publicField(this, "handleSeq", 0);
      __publicField(this, "tables", { filter: false, nat: false });
      __publicField(this, "filter", {
        input: emptyFilterChain("input"),
        forward: emptyFilterChain("forward"),
        output: emptyFilterChain("output")
      });
      __publicField(this, "nat", {
        prerouting: emptyNatChain("prerouting"),
        postrouting: emptyNatChain("postrouting")
      });
    }
    active() {
      return Object.values(this.filter).some((c) => c.declared) || Object.values(this.nat).some((c) => c.declared);
    }
    declareFilter(hook, name, policy) {
      const c = this.filter[hook];
      c.declared = true;
      c.name = name;
      if (policy) c.policy = policy;
    }
    declareNat(hook, name) {
      const c = this.nat[hook];
      c.declared = true;
      c.name = name;
    }
    // Real iptables always has its built-in chains; the first iptables command
    // touching a table brings our model in line with that.
    ensureIptablesTable(table) {
      this.tables[table] = true;
      if (table === "filter") {
        for (const hook of ["input", "forward", "output"]) {
          if (!this.filter[hook].declared) this.declareFilter(hook, hook);
        }
      } else {
        for (const hook of ["prerouting", "postrouting"]) {
          if (!this.nat[hook].declared) this.declareNat(hook, hook);
        }
      }
    }
    chainByName(table, name) {
      const lower = name.toLowerCase();
      if (table === "filter") {
        for (const hook of Object.keys(this.filter)) {
          if (this.filter[hook].declared && this.filter[hook].name.toLowerCase() === lower)
            return { kind: "filter", hook };
        }
      } else {
        for (const hook of Object.keys(this.nat)) {
          if (this.nat[hook].declared && this.nat[hook].name.toLowerCase() === lower)
            return { kind: "nat", hook };
        }
      }
      return null;
    }
    addFilterRule(hook, match, verdict, atHead = false) {
      const rule = { handle: ++this.handleSeq, match, verdict };
      const rules = this.filter[hook].rules;
      if (atHead) rules.unshift(rule);
      else rules.push(rule);
      return rule.handle;
    }
    addNatRule(hook, match, action, atHead = false) {
      const rule = { handle: ++this.handleSeq, match, action };
      const rules = this.nat[hook].rules;
      if (atHead) rules.unshift(rule);
      else rules.push(rule);
      return rule.handle;
    }
    deleteHandle(handle) {
      for (const c of Object.values(this.filter)) {
        const i = c.rules.findIndex((r) => r.handle === handle);
        if (i >= 0) {
          c.rules.splice(i, 1);
          return true;
        }
      }
      for (const c of Object.values(this.nat)) {
        const i = c.rules.findIndex((r) => r.handle === handle);
        if (i >= 0) {
          c.rules.splice(i, 1);
          return true;
        }
      }
      return false;
    }
    flush() {
      this.tables = { filter: false, nat: false };
      this.filter = {
        input: emptyFilterChain("input"),
        forward: emptyFilterChain("forward"),
        output: emptyFilterChain("output")
      };
      this.nat = { prerouting: emptyNatChain("prerouting"), postrouting: emptyNatChain("postrouting") };
    }
    evaluate(hook, pkt, ctx) {
      const c = this.filter[hook];
      if (!c.declared) return { verdict: "accept", rule: null, policy: false, filtered: false, hook };
      for (const r of c.rules) {
        if (matchesRule(r.match, pkt, ctx)) return { verdict: r.verdict, rule: r, policy: false, filtered: true, hook };
      }
      return { verdict: c.policy, rule: null, policy: true, filtered: true, hook };
    }
    evalNat(hook, pkt, ctx) {
      const c = this.nat[hook];
      if (!c.declared) return null;
      for (const r of c.rules) {
        if (matchesRule(r.match, pkt, ctx)) return r;
      }
      return null;
    }
  };

  // third_party/borck-netsim/engine/conntrack.ts
  var TIMEOUT_MS = 12e4;
  function tupleOf(pkt) {
    const l4 = pkt.l4;
    if (l4.kind === "tcp" || l4.kind === "udp")
      return { proto: l4.kind, srcIp: pkt.src, srcPort: l4.srcPort, dstIp: pkt.dst, dstPort: l4.dstPort };
    if (l4.msg.type === "echo-request" || l4.msg.type === "echo-reply")
      return { proto: "icmp", srcIp: pkt.src, srcPort: l4.msg.id, dstIp: pkt.dst, dstPort: l4.msg.id };
    return null;
  }
  function reverseTuple(t) {
    return { proto: t.proto, srcIp: t.dstIp, srcPort: t.dstPort, dstIp: t.srcIp, dstPort: t.srcPort };
  }
  function key(t) {
    return `${t.proto}|${t.srcIp}|${t.srcPort}|${t.dstIp}|${t.dstPort}`;
  }
  function rewriteTo(pkt, t) {
    const l4 = pkt.l4;
    if (l4.kind === "tcp" || l4.kind === "udp") {
      return { ...pkt, src: t.srcIp, dst: t.dstIp, l4: { ...l4, srcPort: t.srcPort, dstPort: t.dstPort } };
    }
    return { ...pkt, src: t.srcIp, dst: t.dstIp };
  }
  var ConnTrack = class {
    constructor() {
      __publicField(this, "byOrig", /* @__PURE__ */ new Map());
      __publicField(this, "byReply", /* @__PURE__ */ new Map());
    }
    process(pkt, now) {
      const l4 = pkt.l4;
      if (l4.kind === "icmp" && (l4.msg.type === "time-exceeded" || l4.msg.type === "dest-unreachable")) {
        const o = l4.msg.original;
        const ot = {
          proto: o.proto,
          srcIp: o.src,
          srcPort: o.srcPort ?? o.icmpId ?? 0,
          dstIp: o.dst,
          dstPort: o.dstPort ?? o.icmpId ?? 0
        };
        const e = this.lookup(this.byOrig, ot, now) ?? this.lookup(this.byReply, ot, now);
        return { pkt, state: e ? "related" : "new", entry: e, dir: "none" };
      }
      const t = tupleOf(pkt);
      if (!t) return { pkt, state: "new", entry: null, dir: "none" };
      const icmpReply = l4.kind === "icmp" && l4.msg.type === "echo-reply";
      const icmpRequest = l4.kind === "icmp" && l4.msg.type === "echo-request";
      const orig = icmpReply ? null : this.lookup(this.byOrig, t, now);
      if (orig) {
        orig.lastSeen = now;
        return {
          pkt: rewriteTo(pkt, orig.trans),
          state: orig.state === "established" ? "established" : "new",
          entry: orig,
          dir: "orig"
        };
      }
      const reply = icmpRequest ? null : this.lookup(this.byReply, t, now);
      if (reply) {
        reply.lastSeen = now;
        reply.state = "established";
        return { pkt: rewriteTo(pkt, reverseTuple(reply.orig)), state: "established", entry: reply, dir: "reply" };
      }
      return { pkt, state: "new", entry: null, dir: "none" };
    }
    confirm(orig, trans, now) {
      const existing = this.byOrig.get(key(orig));
      if (existing) {
        existing.lastSeen = now;
        return;
      }
      const entry = { orig, trans, state: "new", lastSeen: now };
      this.byOrig.set(key(orig), entry);
      this.byReply.set(key(reverseTuple(trans)), entry);
    }
    list(now) {
      const out = [];
      for (const [k, e] of this.byOrig) {
        if (now - e.lastSeen > TIMEOUT_MS) {
          this.byOrig.delete(k);
          this.byReply.delete(key(reverseTuple(e.trans)));
          continue;
        }
        out.push(e);
      }
      return out;
    }
    lookup(map, t, now) {
      const e = map.get(key(t));
      if (!e) return null;
      if (now - e.lastSeen > TIMEOUT_MS) {
        this.byOrig.delete(key(e.orig));
        this.byReply.delete(key(reverseTuple(e.trans)));
        return null;
      }
      return e;
    }
  };

  // third_party/borck-netsim/engine/firewall-fmt.ts
  function portText(r) {
    return r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`;
  }
  function matchToNft(m) {
    const parts = [];
    if (m.iif) parts.push(`iifname "${m.iif}"`);
    if (m.oif) parts.push(`oifname "${m.oif}"`);
    if (m.srcNet)
      parts.push(`ip saddr ${m.srcNet.prefix === 32 ? ipToString(m.srcNet.addr) : cidrToString(m.srcNet.addr, m.srcNet.prefix)}`);
    if (m.dstNet)
      parts.push(`ip daddr ${m.dstNet.prefix === 32 ? ipToString(m.dstNet.addr) : cidrToString(m.dstNet.addr, m.dstNet.prefix)}`);
    if (m.icmpType) parts.push(`icmp type ${m.icmpType}`);
    if (m.sport) parts.push(`${m.proto ?? "tcp"} sport ${portText(m.sport)}`);
    if (m.dport) parts.push(`${m.proto ?? "tcp"} dport ${portText(m.dport)}`);
    if (m.proto && !m.sport && !m.dport && !m.icmpType) parts.push(`ip protocol ${m.proto}`);
    if (m.ctStates) parts.push(`ct state ${m.ctStates.join(",")}`);
    return parts.join(" ");
  }
  function filterRuleText(r) {
    const m = matchToNft(r.match);
    return m ? `${m} ${r.verdict}` : r.verdict;
  }

  // third_party/borck-netsim/engine/ipdevice.ts
  var DEFAULT_TTL = 64;
  var ARP_RETRY_MS = 500;
  var ARP_MAX_TRIES = 3;
  var FW_LOG_MAX = 80;
  var DNS_TIMEOUT_MS = 2500;
  var RIP_INTERVAL_MS = 1e4;
  var RIP_TIMEOUT_MS = 45e3;
  var RIP_INFINITY = 16;
  function normalizeName(name) {
    return name.toLowerCase().replace(/\.$/, "");
  }
  function refOf(pkt) {
    const l4 = pkt.l4;
    if (l4.kind === "tcp" || l4.kind === "udp") {
      return {
        src: pkt.src,
        dst: pkt.dst,
        proto: l4.kind,
        icmpId: null,
        icmpSeq: null,
        srcPort: l4.srcPort,
        dstPort: l4.dstPort
      };
    }
    const msg = l4.msg;
    const hasIds = msg.type === "echo-request" || msg.type === "echo-reply";
    return {
      src: pkt.src,
      dst: pkt.dst,
      proto: "icmp",
      icmpId: hasIds ? msg.id : null,
      icmpSeq: hasIds ? msg.seq : null,
      srcPort: null,
      dstPort: null
    };
  }
  function isIcmpError(pkt) {
    return pkt.l4.kind === "icmp" && (pkt.l4.msg.type === "time-exceeded" || pkt.l4.msg.type === "dest-unreachable");
  }
  function summarizePacket(pkt) {
    const l4 = pkt.l4;
    if (l4.kind === "tcp") {
      const flags = [l4.syn && "SYN", l4.ack && "ACK", l4.rst && "RST", l4.fin && "FIN"].filter(Boolean).join(",");
      return `tcp ${ipToString(pkt.src)}:${l4.srcPort} > ${ipToString(pkt.dst)}:${l4.dstPort}${flags ? ` [${flags}]` : ""}`;
    }
    if (l4.kind === "udp")
      return `udp ${ipToString(pkt.src)}:${l4.srcPort} > ${ipToString(pkt.dst)}:${l4.dstPort}`;
    return `icmp ${l4.msg.type} ${ipToString(pkt.src)} > ${ipToString(pkt.dst)}`;
  }
  var IpDevice = class extends Device {
    constructor() {
      super(...arguments);
      __publicField(this, "forwarding", false);
      __publicField(this, "arpTable", /* @__PURE__ */ new Map());
      __publicField(this, "staticRoutes", []);
      __publicField(this, "fw", new FirewallModel());
      __publicField(this, "ct", new ConnTrack());
      __publicField(this, "fwLog", []);
      // "Services" are persistent open ports (lab targets); nc -l adds live listeners.
      __publicField(this, "services", { tcp: /* @__PURE__ */ new Set(), udp: /* @__PURE__ */ new Set() });
      __publicField(this, "ncTcp", /* @__PURE__ */ new Map());
      __publicField(this, "ncUdp", /* @__PURE__ */ new Map());
      // Phase-3 services and client settings.
      __publicField(this, "nameserver", null);
      __publicField(this, "dhcpServer", null);
      __publicField(this, "dnsServer", null);
      __publicField(this, "httpServer", null);
      // DHCP client sessions (dhclient) register here to hear offers/acks.
      __publicField(this, "dhcpListeners", /* @__PURE__ */ new Set());
      __publicField(this, "ripEnabled", false);
      __publicField(this, "ripRoutes", []);
      __publicField(this, "ripScheduled", false);
      __publicField(this, "pendingArp", /* @__PURE__ */ new Map());
      __publicField(this, "icmpListeners", /* @__PURE__ */ new Map());
      __publicField(this, "icmpIdSeq", 0);
      __publicField(this, "tcpSessions", /* @__PURE__ */ new Map());
      __publicField(this, "udpSessions", /* @__PURE__ */ new Map());
      __publicField(this, "dnsPending", /* @__PURE__ */ new Map());
      __publicField(this, "ephemeralPort", 39999);
      __publicField(this, "dnsQidSeq", 0);
      __publicField(this, "dhcpXidSeq", 0);
    }
    allocIcmpId() {
      return ++this.icmpIdSeq;
    }
    nextDhcpXid() {
      return ++this.dhcpXidSeq;
    }
    onIcmp(id, fn) {
      this.icmpListeners.set(id, fn);
    }
    offIcmp(id) {
      this.icmpListeners.delete(id);
    }
    myIps() {
      return this.interfaces.filter((i) => i.ip).map((i) => i.ip.addr);
    }
    hasIp(ip) {
      return this.interfaces.some((i) => i.ip && i.ip.addr === ip);
    }
    routes() {
      const rs = [];
      for (const i of this.interfaces) {
        if (i.up && i.ip) {
          rs.push({
            dest: networkOf(i.ip.addr, i.ip.prefix),
            prefix: i.ip.prefix,
            via: null,
            ifaceName: i.name,
            kind: "connected"
          });
        }
      }
      rs.push(...this.staticRoutes);
      for (const r of this.freshRipRoutes()) {
        rs.push({ dest: r.dest, prefix: r.prefix, via: r.via, ifaceName: r.ifaceName, kind: "rip", metric: r.metric });
      }
      return rs;
    }
    freshRipRoutes() {
      const now = this.network.now;
      this.ripRoutes = this.ripRoutes.filter((r) => now - r.learnedAt < RIP_TIMEOUT_MS);
      return this.ripRoutes;
    }
    // ---------- RIP ----------
    enableRip(on) {
      this.ripEnabled = on;
      if (on && !this.ripScheduled) this.ripTick();
      if (!on) this.ripRoutes = [];
    }
    ripTick() {
      if (!this.ripEnabled) {
        this.ripScheduled = false;
        return;
      }
      this.ripScheduled = true;
      for (const iface of this.interfaces) {
        if (iface.up && iface.link && iface.ip) this.advertiseRip(iface);
      }
      this.network.scheduler.schedule(RIP_INTERVAL_MS, () => this.ripTick());
    }
    advertiseRip(iface) {
      const entries = [];
      for (const i of this.interfaces) {
        if (i === iface || !i.up || !i.ip) continue;
        entries.push({ dest: networkOf(i.ip.addr, i.ip.prefix), prefix: i.ip.prefix, metric: 1 });
      }
      for (const r of this.freshRipRoutes()) {
        if (r.ifaceName === iface.name) continue;
        entries.push({ dest: r.dest, prefix: r.prefix, metric: r.metric });
      }
      if (!entries.length) return;
      this.sendBroadcastUdp(iface, iface.ip.addr, 520, 520, { kind: "rip", routes: entries });
    }
    handleRip(app, iif, from) {
      const now = this.network.now;
      for (const e of app.routes) {
        const metric = Math.min(e.metric + 1, RIP_INFINITY);
        const isConnected = this.interfaces.some(
          (i) => i.up && i.ip && networkOf(i.ip.addr, i.ip.prefix) === e.dest && i.ip.prefix === e.prefix
        );
        const isStatic = this.staticRoutes.some((r) => r.dest === e.dest && r.prefix === e.prefix);
        if (isConnected || isStatic) continue;
        const existing = this.freshRipRoutes().find((r) => r.dest === e.dest && r.prefix === e.prefix);
        if (metric >= RIP_INFINITY) {
          if (existing && existing.via === from) {
            this.ripRoutes = this.ripRoutes.filter((r) => r !== existing);
          }
          continue;
        }
        if (!existing) {
          this.ripRoutes.push({ dest: e.dest, prefix: e.prefix, via: from, ifaceName: iif, metric, learnedAt: now });
        } else if (existing.via === from || metric < existing.metric) {
          existing.via = from;
          existing.ifaceName = iif;
          existing.metric = metric;
          existing.learnedAt = now;
        }
      }
    }
    lookupRoute(dst) {
      let best = null;
      for (const r of this.routes()) {
        if (networkOf(dst, r.prefix) !== r.dest) continue;
        const iface = this.getInterface(r.ifaceName);
        if (!iface || !iface.up || !iface.link) continue;
        if (!best || r.prefix > best.prefix) best = r;
      }
      return best;
    }
    addIp(ifaceName, addr, prefix2) {
      const iface = this.getInterface(ifaceName);
      if (!iface) return `Cannot find device "${ifaceName}"`;
      if (iface.ip && iface.ip.addr === addr && iface.ip.prefix === prefix2)
        return "RTNETLINK answers: File exists";
      if (iface.ip)
        return `netsim: one address per interface in phase 1 — "ip address del ${ifaceName}'s current address" first`;
      iface.ip = { addr, prefix: prefix2 };
      return null;
    }
    delIp(ifaceName, addr, prefix2) {
      const iface = this.getInterface(ifaceName);
      if (!iface) return `Cannot find device "${ifaceName}"`;
      if (!iface.ip || iface.ip.addr !== addr || iface.ip.prefix !== prefix2)
        return "RTNETLINK answers: Cannot assign requested address";
      iface.ip = null;
      return null;
    }
    addRoute(dest, prefix2, via, dev) {
      let ifaceName = dev ?? null;
      if (ifaceName && !this.getInterface(ifaceName)) return `Cannot find device "${ifaceName}"`;
      if (!ifaceName) {
        if (via === null) return 'Error: either "via" or "dev" is required.';
        const r = this.lookupRoute(via);
        if (!r || r.kind !== "connected") return "Error: Nexthop has invalid gateway.";
        ifaceName = r.ifaceName;
      }
      if (this.staticRoutes.some((r) => r.dest === dest && r.prefix === prefix2))
        return "RTNETLINK answers: File exists";
      this.staticRoutes.push({ dest: networkOf(dest, prefix2), prefix: prefix2, via, ifaceName, kind: "static" });
      return null;
    }
    delRoute(dest, prefix2) {
      const i = this.staticRoutes.findIndex(
        (r) => r.dest === networkOf(dest, prefix2) && r.prefix === prefix2
      );
      if (i < 0) return "RTNETLINK answers: No such process";
      this.staticRoutes.splice(i, 1);
      return null;
    }
    // ---------- sending (local origin) ----------
    sendEcho(dst, id, seq, ttl = DEFAULT_TTL) {
      return this.sendL4(dst, { kind: "icmp", msg: { type: "echo-request", id, seq } }, { ttl });
    }
    sendIcmp(dst, msg, opts = {}) {
      return this.sendL4(dst, { kind: "icmp", msg }, opts);
    }
    sendL4(dst, l4, opts = {}) {
      if (this.hasIp(dst)) {
        const pkt2 = {
          kind: "ipv4",
          src: opts.srcOverride ?? dst,
          dst,
          ttl: opts.ttl ?? DEFAULT_TTL,
          l4
        };
        this.network.scheduler.schedule(1, () => this.deliverLocal(pkt2));
        return null;
      }
      const route = this.lookupRoute(dst);
      if (!route) return "Network is unreachable";
      const iface = this.getInterface(route.ifaceName);
      const src = opts.srcOverride ?? iface.ip?.addr;
      if (src === void 0) return "Network is unreachable";
      let pkt = { kind: "ipv4", src, dst, ttl: opts.ttl ?? DEFAULT_TTL, l4 };
      const now = this.network.now;
      const proc = this.ct.process(pkt, now);
      pkt = proc.pkt;
      const res = this.fw.evaluate("output", pkt, { oif: route.ifaceName, ctState: proc.state });
      this.logFw(res, pkt);
      if (res.verdict !== "accept") return "Operation not permitted";
      if (proc.dir === "none" && proc.state === "new") {
        const origTuple = tupleOf(pkt);
        const nr = this.fw.evalNat("postrouting", pkt, { oif: route.ifaceName, ctState: "new" });
        if (nr) pkt = this.applySnat(pkt, nr.action, iface);
        const trans = tupleOf(pkt);
        if (origTuple && trans) this.ct.confirm(origTuple, trans, now);
      }
      this.routePacket(pkt, route);
      return null;
    }
    // DHCP and RIP speak as raw L2 broadcasts, bypassing routing (but still
    // subject to the OUTPUT chain).
    sendBroadcastUdp(iface, srcIp, srcPort, dstPort, app) {
      if (!iface.up || !iface.link) return false;
      const pkt = {
        kind: "ipv4",
        src: srcIp,
        dst: BROADCAST_IP,
        ttl: DEFAULT_TTL,
        l4: { kind: "udp", srcPort, dstPort, app }
      };
      const res = this.fw.evaluate("output", pkt, { oif: iface.name, ctState: "new" });
      this.logFw(res, pkt);
      if (res.verdict !== "accept") return false;
      iface.send({ srcMac: iface.mac, dstMac: BROADCAST_MAC, payload: pkt });
      return true;
    }
    sendDhcpClient(iface, app) {
      return this.sendBroadcastUdp(iface, 0, 68, 67, app);
    }
    // ---------- TCP / UDP sockets ----------
    tcpListening(port) {
      return this.services.tcp.has(port) || this.ncTcp.has(port) || this.httpServer?.enabled === true && this.httpServer.port === port;
    }
    udpListening(port) {
      return this.services.udp.has(port) || this.ncUdp.has(port) || port === 53 && this.dnsServer?.enabled === true || port === 520 && this.ripEnabled;
    }
    openTcp(dst, port, onEvent) {
      const srcPort = ++this.ephemeralPort;
      const key2 = `${srcPort}|${dst}|${port}`;
      this.tcpSessions.set(key2, onEvent);
      const close = () => this.tcpSessions.delete(key2);
      const err = this.sendL4(dst, {
        kind: "tcp",
        srcPort,
        dstPort: port,
        syn: true,
        ack: false,
        rst: false,
        fin: false
      });
      if (err) {
        close();
        return { srcPort, close, error: err };
      }
      return { srcPort, close, error: null };
    }
    connectTcp(dst, port, timeoutMs, cb) {
      let finished = false;
      const finish = (r) => {
        if (finished) return;
        finished = true;
        conn.close();
        cb(r);
      };
      const conn = this.openTcp(dst, port, (ev) => {
        if (ev.type === "open") finish("open");
        else if (ev.type === "refused") finish("refused");
        else if (ev.type === "unreachable") finish("unreachable");
      });
      if (conn.error) return conn.error;
      this.network.scheduler.schedule(timeoutMs, () => finish("timeout"));
      return null;
    }
    probeUdp(dst, port, timeoutMs, cb) {
      const srcPort = ++this.ephemeralPort;
      const key2 = `${srcPort}|${dst}|${port}`;
      let finished = false;
      const finish = (r) => {
        if (finished) return;
        finished = true;
        this.udpSessions.delete(key2);
        cb(r);
      };
      this.udpSessions.set(key2, finish);
      const err = this.sendL4(dst, { kind: "udp", srcPort, dstPort: port });
      if (err) {
        this.udpSessions.delete(key2);
        return err;
      }
      this.network.scheduler.schedule(timeoutMs, () => finish("open"));
      return null;
    }
    httpGet(dst, port, path, host, timeoutMs, cb, onConnect) {
      let finished = false;
      let connected = false;
      const finish = (res) => {
        if (finished) return;
        finished = true;
        conn.close();
        cb(res);
      };
      const conn = this.openTcp(dst, port, (ev) => {
        if (ev.type === "open") {
          connected = true;
          onConnect?.();
          this.sendL4(dst, {
            kind: "tcp",
            srcPort: conn.srcPort,
            dstPort: port,
            syn: false,
            ack: true,
            rst: false,
            fin: false,
            app: { kind: "http-request", method: "GET", path, host }
          });
        } else if (ev.type === "data" && ev.app.kind === "http-response") {
          finish({ ok: true, status: ev.app.status, reason: ev.app.reason, body: ev.app.body });
        } else if (ev.type === "refused") {
          finish({ ok: false, error: "refused" });
        } else if (ev.type === "unreachable") {
          finish({ ok: false, error: "unreachable" });
        }
      });
      if (conn.error) return conn.error;
      this.network.scheduler.schedule(
        timeoutMs,
        () => finish({ ok: false, error: connected ? "empty" : "timeout" })
      );
      return null;
    }
    resolveDns(name, server, cb) {
      const qid = ++this.dnsQidSeq;
      const srcPort = ++this.ephemeralPort;
      const sessKey = `${srcPort}|${server}|53`;
      let finished = false;
      const finish = (r) => {
        if (finished) return;
        finished = true;
        this.dnsPending.delete(qid);
        this.udpSessions.delete(sessKey);
        cb(r);
      };
      this.dnsPending.set(qid, { finish });
      this.udpSessions.set(sessKey, (r) => finish(r === "refused" ? "refused" : "timeout"));
      const err = this.sendL4(server, {
        kind: "udp",
        srcPort,
        dstPort: 53,
        app: { kind: "dns-query", qid, qname: normalizeName(name) }
      });
      if (err) {
        finish("timeout");
        return;
      }
      this.network.scheduler.schedule(DNS_TIMEOUT_MS, () => finish("timeout"));
    }
    // ---------- receive path ----------
    receiveFrame(iface, frame) {
      if (frame.payload.kind === "arp") {
        this.handleArp(iface, frame.payload);
        return;
      }
      if (frame.dstMac !== iface.mac && frame.dstMac !== BROADCAST_MAC) return;
      this.handleIp(frame.payload, iface.name);
    }
    handleIp(pktIn, iif) {
      if (pktIn.dst === BROADCAST_IP) {
        const res2 = this.fw.evaluate("input", pktIn, { iif, ctState: "new" });
        this.logFw(res2, pktIn);
        if (res2.verdict !== "accept") return;
        this.deliverBroadcast(pktIn, iif);
        return;
      }
      const now = this.network.now;
      const proc = this.ct.process(pktIn, now);
      let pkt = proc.pkt;
      const ctState = proc.state;
      const origTuple = proc.dir === "none" ? tupleOf(pkt) : null;
      if (proc.dir === "none" && ctState === "new") {
        const nr = this.fw.evalNat("prerouting", pkt, { iif, ctState });
        if (nr && nr.action.type === "dnat") pkt = this.applyDnat(pkt, nr.action.addr, nr.action.port);
      }
      if (this.hasIp(pkt.dst)) {
        const res2 = this.fw.evaluate("input", pkt, { iif, ctState });
        this.logFw(res2, pkt);
        if (res2.verdict === "drop") return;
        if (res2.verdict === "reject") {
          this.rejectPacket(pkt);
          return;
        }
        if (origTuple) {
          const t = tupleOf(pkt);
          if (t) this.ct.confirm(origTuple, t, now);
        }
        this.deliverLocal(pkt);
        return;
      }
      if (!this.forwarding) return;
      const ttl = pkt.ttl - 1;
      if (ttl <= 0) {
        if (!isIcmpError(pkt)) this.sendIcmp(pkt.src, { type: "time-exceeded", original: refOf(pkt) });
        return;
      }
      pkt = { ...pkt, ttl };
      const route = this.lookupRoute(pkt.dst);
      if (!route) {
        if (!isIcmpError(pkt))
          this.sendIcmp(pkt.src, { type: "dest-unreachable", code: "net", original: refOf(pkt) });
        return;
      }
      const res = this.fw.evaluate("forward", pkt, { iif, oif: route.ifaceName, ctState });
      this.logFw(res, pkt);
      if (res.verdict === "drop") return;
      if (res.verdict === "reject") {
        this.rejectPacket(pkt);
        return;
      }
      if (proc.dir === "none" && ctState === "new") {
        const nr = this.fw.evalNat("postrouting", pkt, { iif, oif: route.ifaceName, ctState });
        if (nr) pkt = this.applySnat(pkt, nr.action, this.getInterface(route.ifaceName));
        const trans = tupleOf(pkt);
        if (origTuple && trans) this.ct.confirm(origTuple, trans, now);
      }
      this.routePacket(pkt, route);
    }
    deliverBroadcast(pkt, iif) {
      const l4 = pkt.l4;
      if (l4.kind !== "udp" || !l4.app) return;
      if (l4.app.kind === "dhcp") {
        if (l4.dstPort === 67) this.handleDhcpServer(l4.app, iif);
        else if (l4.dstPort === 68) for (const h of [...this.dhcpListeners]) h(l4.app);
        return;
      }
      if (l4.app.kind === "rip" && l4.dstPort === 520 && this.ripEnabled) {
        this.handleRip(l4.app, iif, pkt.src);
      }
    }
    handleDhcpServer(app, iif) {
      const cfg = this.dhcpServer;
      if (!cfg?.enabled) return;
      const iface = this.getInterface(iif);
      if (!iface?.ip) return;
      if (app.op === "discover") {
        const lease = this.allocLease(cfg, app.clientMac);
        if (lease === null) return;
        this.sendBroadcastUdp(iface, iface.ip.addr, 67, 68, {
          kind: "dhcp",
          op: "offer",
          xid: app.xid,
          clientMac: app.clientMac,
          yourIp: lease,
          prefix: iface.ip.prefix,
          router: cfg.router,
          dns: cfg.dns,
          serverIp: iface.ip.addr
        });
      } else if (app.op === "request" && app.yourIp !== void 0) {
        cfg.leases.set(app.clientMac, app.yourIp);
        this.sendBroadcastUdp(iface, iface.ip.addr, 67, 68, {
          kind: "dhcp",
          op: "ack",
          xid: app.xid,
          clientMac: app.clientMac,
          yourIp: app.yourIp,
          prefix: iface.ip.prefix,
          router: cfg.router,
          dns: cfg.dns,
          serverIp: iface.ip.addr
        });
      }
    }
    allocLease(cfg, mac) {
      const existing = cfg.leases.get(mac);
      if (existing !== void 0) return existing;
      const taken = /* @__PURE__ */ new Set([...cfg.leases.values(), ...this.myIps()]);
      for (let ip = cfg.rangeStart; ip <= cfg.rangeEnd; ip++) {
        if (!taken.has(ip >>> 0)) return ip >>> 0;
      }
      return null;
    }
    applyDnat(pkt, addr, port) {
      const l4 = pkt.l4;
      if ((l4.kind === "tcp" || l4.kind === "udp") && port !== void 0) {
        return { ...pkt, dst: addr, l4: { ...l4, dstPort: port } };
      }
      return { ...pkt, dst: addr };
    }
    applySnat(pkt, action, oiface) {
      if (action.type === "dnat") return pkt;
      const newSrc = action.type === "masquerade" ? oiface.ip?.addr : action.addr;
      if (newSrc === void 0) return pkt;
      return { ...pkt, src: newSrc };
    }
    rejectPacket(pkt) {
      if (isIcmpError(pkt)) return;
      this.sendIcmp(pkt.src, { type: "dest-unreachable", code: "port", original: refOf(pkt) });
    }
    logFw(res, pkt) {
      if (!res.filtered) return;
      this.fwLog.unshift({
        t: this.network.now,
        hook: res.hook,
        verdict: res.verdict,
        rule: res.rule ? filterRuleText(res.rule) : `policy ${res.verdict}`,
        pkt: summarizePacket(pkt)
      });
      if (this.fwLog.length > FW_LOG_MAX) this.fwLog.length = FW_LOG_MAX;
      if (res.verdict !== "accept") this.network.onFwDrop?.(this.id);
    }
    // ---------- ARP ----------
    routePacket(pkt, route) {
      const iface = this.getInterface(route.ifaceName);
      const nextHop = route.via ?? pkt.dst;
      this.resolveAndSend(iface, nextHop, pkt);
    }
    resolveAndSend(iface, nextHop, pkt) {
      const cached = this.arpTable.get(nextHop);
      if (cached) {
        iface.send({ srcMac: iface.mac, dstMac: cached.mac, payload: pkt });
        return;
      }
      const pending = this.pendingArp.get(nextHop);
      if (pending) {
        pending.queue.push(pkt);
        return;
      }
      const entry = { iface, queue: [pkt], tries: 1, timer: null };
      this.pendingArp.set(nextHop, entry);
      this.sendArpRequest(iface, nextHop);
      entry.timer = this.network.scheduler.schedule(ARP_RETRY_MS, () => this.arpRetry(nextHop, entry));
    }
    arpRetry(nextHop, entry) {
      if (entry.tries >= ARP_MAX_TRIES) {
        this.pendingArp.delete(nextHop);
        for (const pkt of entry.queue) this.failDelivery(pkt);
        return;
      }
      entry.tries++;
      this.sendArpRequest(entry.iface, nextHop);
      entry.timer = this.network.scheduler.schedule(ARP_RETRY_MS, () => this.arpRetry(nextHop, entry));
    }
    failDelivery(pkt) {
      if (this.hasIp(pkt.src)) {
        const ref = refOf(pkt);
        if (ref.icmpId !== null) {
          this.icmpListeners.get(ref.icmpId)?.({
            type: "send-error",
            seq: ref.icmpSeq,
            message: "Destination Host Unreachable"
          });
        } else if (ref.proto === "tcp" || ref.proto === "udp") {
          this.notifySocket(ref, "unreachable");
        }
      } else if (!isIcmpError(pkt)) {
        this.sendIcmp(pkt.src, { type: "dest-unreachable", code: "host", original: refOf(pkt) });
      }
    }
    sendArpRequest(iface, targetIp) {
      if (!iface.ip) return;
      iface.send({
        srcMac: iface.mac,
        dstMac: BROADCAST_MAC,
        payload: {
          kind: "arp",
          op: "request",
          senderIp: iface.ip.addr,
          senderMac: iface.mac,
          targetIp,
          targetMac: null
        }
      });
    }
    handleArp(iface, arp) {
      if (arp.op === "request") {
        if (iface.ip && arp.targetIp === iface.ip.addr) {
          this.arpTable.set(arp.senderIp, { mac: arp.senderMac, ifaceName: iface.name, at: this.network.now });
          iface.send({
            srcMac: iface.mac,
            dstMac: arp.senderMac,
            payload: {
              kind: "arp",
              op: "reply",
              senderIp: iface.ip.addr,
              senderMac: iface.mac,
              targetIp: arp.senderIp,
              targetMac: arp.senderMac
            }
          });
        }
        return;
      }
      this.arpTable.set(arp.senderIp, { mac: arp.senderMac, ifaceName: iface.name, at: this.network.now });
      const pending = this.pendingArp.get(arp.senderIp);
      if (pending) {
        if (pending.timer) this.network.scheduler.cancel(pending.timer);
        this.pendingArp.delete(arp.senderIp);
        for (const pkt of pending.queue) {
          pending.iface.send({ srcMac: pending.iface.mac, dstMac: arp.senderMac, payload: pkt });
        }
      }
    }
    // ---------- local delivery ----------
    deliverLocal(pkt) {
      const l4 = pkt.l4;
      if (l4.kind === "tcp") {
        this.handleTcp(pkt, l4);
        return;
      }
      if (l4.kind === "udp") {
        this.handleUdp(pkt, l4);
        return;
      }
      const msg = l4.msg;
      switch (msg.type) {
        case "echo-request":
          this.sendIcmp(
            pkt.src,
            { type: "echo-reply", id: msg.id, seq: msg.seq },
            { srcOverride: this.hasIp(pkt.dst) ? pkt.dst : void 0 }
          );
          break;
        case "echo-reply":
          this.icmpListeners.get(msg.id)?.({ type: "reply", from: pkt.src, seq: msg.seq, ttl: pkt.ttl });
          break;
        case "time-exceeded":
          if (msg.original.icmpId !== null) {
            this.icmpListeners.get(msg.original.icmpId)?.({
              type: "time-exceeded",
              from: pkt.src,
              seq: msg.original.icmpSeq
            });
          }
          break;
        case "dest-unreachable":
          if (msg.original.proto === "icmp" && msg.original.icmpId !== null) {
            this.icmpListeners.get(msg.original.icmpId)?.({
              type: "unreachable",
              from: pkt.src,
              seq: msg.original.icmpSeq,
              code: msg.code
            });
          } else if (msg.original.proto === "tcp" || msg.original.proto === "udp") {
            this.notifySocket(msg.original, msg.code === "port" ? "refused" : "unreachable");
          }
          break;
      }
    }
    handleUdp(pkt, dgram) {
      const app = dgram.app;
      if (app?.kind === "dns-query" && dgram.dstPort === 53 && this.dnsServer?.enabled) {
        const addr = this.dnsServer.records.get(normalizeName(app.qname)) ?? null;
        this.sendL4(
          pkt.src,
          {
            kind: "udp",
            srcPort: 53,
            dstPort: dgram.srcPort,
            app: { kind: "dns-answer", qid: app.qid, qname: app.qname, addr }
          },
          { srcOverride: this.hasIp(pkt.dst) ? pkt.dst : void 0 }
        );
        return;
      }
      if (app?.kind === "dns-answer") {
        const pending = this.dnsPending.get(app.qid);
        if (pending) {
          pending.finish(app.addr);
          return;
        }
      }
      if (this.udpListening(dgram.dstPort)) {
        this.ncUdp.get(dgram.dstPort)?.(
          `Received UDP datagram from ${ipToString(pkt.src)}:${dgram.srcPort}`
        );
        return;
      }
      this.sendIcmp(pkt.src, { type: "dest-unreachable", code: "port", original: refOf(pkt) });
    }
    handleTcp(pkt, seg) {
      const sessionKey = `${seg.dstPort}|${pkt.src}|${seg.srcPort}`;
      if (seg.app) {
        const session = this.tcpSessions.get(sessionKey);
        if (session) {
          session({ type: "data", app: seg.app });
          return;
        }
        this.handleServerTcpData(pkt, seg);
        return;
      }
      const reply = (flags) => {
        this.sendL4(
          pkt.src,
          {
            kind: "tcp",
            srcPort: seg.dstPort,
            dstPort: seg.srcPort,
            syn: false,
            ack: false,
            rst: false,
            fin: false,
            ...flags
          },
          { srcOverride: this.hasIp(pkt.dst) ? pkt.dst : void 0 }
        );
      };
      if (seg.syn && !seg.ack) {
        if (this.tcpListening(seg.dstPort)) {
          this.ncTcp.get(seg.dstPort)?.(
            `Connection received from ${ipToString(pkt.src)}:${seg.srcPort}`
          );
          reply({ syn: true, ack: true });
        } else {
          reply({ rst: true, ack: true });
        }
        return;
      }
      if (seg.syn && seg.ack) {
        reply({ ack: true });
        this.tcpSessions.get(sessionKey)?.({ type: "open" });
        return;
      }
      if (seg.rst) {
        this.tcpSessions.get(sessionKey)?.({ type: "refused" });
      }
    }
    handleServerTcpData(pkt, seg) {
      const app = seg.app;
      if (app.kind === "http-request" && this.httpServer?.enabled && seg.dstPort === this.httpServer.port) {
        this.sendL4(
          pkt.src,
          {
            kind: "tcp",
            srcPort: seg.dstPort,
            dstPort: seg.srcPort,
            syn: false,
            ack: true,
            rst: false,
            fin: false,
            app: { kind: "http-response", status: 200, reason: "OK", body: this.httpServer.body }
          },
          { srcOverride: this.hasIp(pkt.dst) ? pkt.dst : void 0 }
        );
      }
    }
    notifySocket(ref, result) {
      if (ref.srcPort === null || ref.dstPort === null) return;
      const key2 = `${ref.srcPort}|${ref.dst}|${ref.dstPort}`;
      if (ref.proto === "tcp") {
        this.tcpSessions.get(key2)?.(result === "refused" ? { type: "refused" } : { type: "unreachable" });
      } else {
        this.udpSessions.get(key2)?.(result);
      }
    }
  };
  var Host = class extends IpDevice {
    constructor(network, id, name) {
      super(network, id, name);
      __publicField(this, "kind", "host");
      this.addInterfaces("eth", 1);
    }
  };

  // third_party/borck-netsim/engine/switch.ts
  var SwitchDevice = class extends Device {
    constructor(network, id, name, kind = "switch", ports = 8) {
      super(network, id, name);
      __publicField(this, "kind");
      // MAC table keys are "vlan|mac" so identical MACs stay separated per VLAN.
      __publicField(this, "macTable", /* @__PURE__ */ new Map());
      __publicField(this, "vlans", /* @__PURE__ */ new Map());
      this.kind = kind;
      this.addInterfaces("eth", ports);
    }
    vlanOf(portName) {
      return this.vlans.get(portName) ?? 1;
    }
    receiveFrame(iface, frame) {
      const vlan = this.vlanOf(iface.name);
      this.macTable.set(`${vlan}|${frame.srcMac}`, iface);
      if (frame.dstMac === BROADCAST_MAC) {
        this.flood(vlan, iface, frame);
        return;
      }
      const out = this.macTable.get(`${vlan}|${frame.dstMac}`);
      if (out && this.vlanOf(out.name) === vlan) {
        if (out !== iface) out.send(frame);
      } else {
        this.flood(vlan, iface, frame);
      }
    }
    flood(vlan, except, frame) {
      for (const p of this.interfaces) {
        if (p !== except && p.link && this.vlanOf(p.name) === vlan) p.send(frame);
      }
    }
  };

  // simulator/borck-adapter.ts
  var identity = Object.freeze({ name: "Michael Borck NetSim", commit: "c3075e7fe65b7e17515d802eaef625bab751af58", license: "MIT" });
  function prefix(mask) {
    const n = parseIp(mask);
    if (n === null) throw Error("Invalid IPv4 mask");
    const bits = n.toString(2).padStart(32, "0");
    if (!/^1*0*$/.test(bits)) throw Error("Noncontiguous IPv4 mask");
    return bits.indexOf("0") < 0 ? 32 : bits.indexOf("0");
  }
  function support(topology) {
    const reasons = /* @__PURE__ */ new Set(), ids = /* @__PURE__ */ new Set(), macs = /* @__PURE__ */ new Set(), used = /* @__PURE__ */ new Set(), parent = /* @__PURE__ */ new Map();
    if (!Array.isArray(topology?.devices) || !Array.isArray(topology?.links)) return { ok: false, reasons: ["Invalid topology"] };
    if (topology.devices.length > 250) reasons.add("At most 250 devices");
    const find = (id) => {
      const p = parent.get(id);
      return p === id ? id : find(p);
    };
    for (const d of topology.devices) {
      if (!d || typeof d !== "object") {
        reasons.add("Invalid device record");
        continue;
      }
      if (!Array.isArray(d.ports) || !d.ports.length || new Set(d.ports).size !== d.ports.length) reasons.add("Invalid physical port inventory");
      if (typeof d.id !== "string" || ids.has(d.id)) reasons.add("Missing or duplicate device ID");
      ids.add(d.id);
      parent.set(d.id, d.id);
      if (!["PC", "Switch"].includes(d.type)) reasons.add("Only PC and access Switch devices in this integration");
      if (d.type === "PC") {
        try {
          if (parseIp(d.ip) === null) throw Error();
          prefix(d.mask || "255.255.255.0");
        } catch {
          reasons.add("Every PC needs a valid IPv4 address and mask");
        }
        if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(d.mac || "") || d.mac === "00:00:00:00:00:00" || parseInt(d.mac?.slice(0, 2) || "1", 16) & 1 || macs.has(d.mac?.toLowerCase())) reasons.add("PC MACs must be unique unicast colon addresses");
        macs.add(d.mac?.toLowerCase());
        if (d.gateway && parseIp(d.gateway) === null) reasons.add("Invalid gateway");
        if (d.ports?.length !== 1) reasons.add("Only single-interface PCs");
      }
      if (d.ospf || d.bgp || d.natOverload || d.acls?.length || d.staticRoutes?.length || d.route) reasons.add("Routing, NAT and ACL mappings are not enabled");
      for (const [name, p] of Object.entries(d.interfaces || {})) {
        if (p.mode === "trunk") reasons.add("802.1Q trunk is unsupported by upstream");
        if (d.type === "Switch" && p.mode !== "access") reasons.add("Only access switchports");
        if (name.includes(".") || /^vlan/i.test(name)) reasons.add("Subinterfaces and SVI are unsupported");
        if (p.portSecurity?.enabled || p.errdisabled) reasons.add("Port-security is unsupported");
        if (p.ip || p.helperAddress) reasons.add("Interface IP/helper configuration is unsupported");
        if (p.mode && p.mode !== "access") reasons.add("Only access switchports");
        if (d.type === "Switch" && p.vlan !== void 0 && (!Number.isInteger(p.vlan) || p.vlan < 1 || p.vlan > 4094)) reasons.add("Invalid access VLAN");
        if (d.type === "Switch" && p.mode === "access" && !d.vlans?.includes(Number(p.vlan ?? 1))) reasons.add("Switchport VLAN is not defined");
      }
    }
    const byId = new Map(topology.devices.map((d) => [d.id, d]));
    for (const l of topology.links) {
      const a = byId.get(l.a), b = byId.get(l.b);
      if (!a || !b || a === b) {
        reasons.add("Invalid cable endpoint");
        continue;
      }
      for (const [d, p] of [[a, l.portA], [b, l.portB]]) {
        const key2 = d.id + "|" + p;
        if (!d.ports?.includes(p) || used.has(key2)) reasons.add("Missing or multiply connected physical port");
        used.add(key2);
      }
      if (a.type === "Switch" && b.type === "Switch" && Number(a.interfaces?.[l.portA]?.vlan ?? 1) !== Number(b.interfaces?.[l.portB]?.vlan ?? 1)) reasons.add("Access VLAN translation across switches is not mapped");
      if (l.up !== false && a.enabled !== false && b.enabled !== false && a.interfaces?.[l.portA]?.enabled !== false && b.interfaces?.[l.portB]?.enabled !== false) {
        const ra = find(a.id), rb = find(b.id);
        if (ra === rb) reasons.add("L2 loops require STP; upstream has no STP");
        else parent.set(ra, rb);
      }
    }
    return { ok: reasons.size === 0, reasons: [...reasons] };
  }
  function createSession(topology) {
    const checked = support(topology);
    if (!checked.ok) throw Error("Unsupported topology: " + checked.reasons.join("; "));
    const net = new Network(), maps = /* @__PURE__ */ new Map();
    let events = [], overflow = 0, icmpId = 0;
    const emit = (e) => {
      if (events.length < 4096) events.push(e);
      else overflow++;
    };
    for (const d of topology.devices) {
      const dev = d.type === "Switch" ? new SwitchDevice(net, d.id, d.name || d.id, "switch", d.ports.length) : new Host(net, d.id, d.name || d.id);
      net.register(dev);
      const ports = /* @__PURE__ */ new Map();
      maps.set(d.id, ports);
      d.ports.forEach((p, i) => {
        const iface = dev.interfaces[i];
        ports.set(p, iface.name);
        iface.up = d.enabled !== false && d.interfaces?.[p]?.enabled !== false;
        if (d.type === "Switch") dev.vlans.set(iface.name, Number(d.interfaces?.[p]?.vlan ?? 1));
      });
      if (d.type === "PC") {
        dev.interfaces[0].mac = d.mac.toLowerCase();
        dev.interfaces[0].ip = { addr: parseIp(d.ip), prefix: prefix(d.mask || "255.255.255.0") };
      }
    }
    for (const l of topology.links) {
      const a = net.devices.get(l.a), b = net.devices.get(l.b);
      if (l.up === false) continue;
      net.connect(a.id, b.id, { id: l.id || "link-" + net.links.size, aIface: maps.get(a.id).get(l.portA), bIface: maps.get(b.id).get(l.portB) });
    }
    for (const d of topology.devices) if (d.type === "PC" && d.gateway) {
      const dev = net.devices.get(d.id);
      const error = dev.addRoute(0, 0, parseIp(d.gateway));
      if (error) throw Error(d.id + ": " + error);
    }
    net.onWireTransfer = (e) => emit({ ...e, origin: identity.name });
    function snapshot() {
      return { arp: Object.fromEntries([...net.devices].filter(([, d]) => d.arpTable).map(([id, d]) => [id, [...d.arpTable].map(([ip, v]) => ({ ip: ipToString(ip), mac: v.mac, port: v.ifaceName }))])), mac: Object.fromEntries([...net.devices].filter(([, d]) => d.macTable).map(([id, d]) => [id, [...d.macTable].map(([key2, p]) => ({ key: key2, port: p.name }))])) };
    }
    return { net, snapshot, ping(source, targetIp, { includeTables = true } = {}) {
      events = [];
      overflow = 0;
      const src = net.devices.get(source), dst = parseIp(targetIp);
      if (!src?.sendEcho || dst === null) throw Error("Invalid ping endpoints");
      const id = ++icmpId, replies = [];
      src.onIcmp(id, (e) => replies.push(e));
      const error = src.sendEcho(dst, id, 1);
      net.scheduler.advanceTo(net.now + 1e4);
      src.offIcmp(id);
      return { engine: identity, ok: replies.some((e) => e.type === "reply"), error: error || null, replies, events: events.slice(), overflow, ...includeTables ? snapshot() : {} };
    } };
  }
  function run(topology, source, targetIp) {
    return createSession(topology).ping(source, targetIp);
  }
  return __toCommonJS(borck_adapter_exports);
})();
if(typeof module==="object" && module.exports)module.exports=AgLabBorckEngine;
