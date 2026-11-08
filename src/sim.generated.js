// ÜRETİLMİŞ DOSYA — elle düzenlemeyin. Kaynak: src/sim (Labber), src/sim-bridge.
// Yeniden üretmek için: npm run build:sim
var AgLabSim = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // simulator/mac-address.js
  var require_mac_address = __commonJS({
    "simulator/mac-address.js"(exports, module) {
      var AgLabMacAddress2 = (() => {
        function validate(devices) {
          const seen = /* @__PURE__ */ new Set();
          for (const d of devices) {
            if (d.mac === void 0) continue;
            if (!["PC", "Server"].includes(d.type) || typeof d.mac !== "string" || !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(d.mac) || d.mac === "00:00:00:00:00:00" || parseInt(d.mac.slice(0, 2), 16) & 1 || seen.has(d.mac))
              throw new Error("Geçersiz veya yinelenen fiziksel endpoint MAC adresi: " + d.id);
            seen.add(d.mac);
          }
        }
        function createResolver() {
          let topology = null, count = -1, addresses = /* @__PURE__ */ new Map();
          return (device, devices) => {
            if (topology !== devices || count !== devices.length) {
              validate(devices);
              topology = devices;
              count = devices.length;
              addresses = /* @__PURE__ */ new Map();
              const occupied = new Set(devices.filter((d) => d.mac !== void 0).map((d) => d.mac));
              const explicitMacs = new Map(
                devices.filter((d) => d.mac !== void 0).map((d) => [String(d.id), d.mac])
              );
              for (const id of devices.map((d) => String(d.id)).sort()) {
                const explicit = explicitMacs.get(id);
                if (explicit !== void 0) {
                  addresses.set(id, explicit);
                  continue;
                }
                const match = /^d([1-9]\d*)$/.exec(id), legacy = match && Number(match[1]) <= 16777215;
                let n = legacy ? Number(match[1]) : 2166136261;
                if (!legacy)
                  for (let i = 0; i < id.length; i++) n = Math.imul(n ^ id.charCodeAt(i), 16777619) >>> 0;
                const address = () => legacy ? "02:00:00:" + [n >>> 16 & 255, n >>> 8 & 255, n & 255].map((v) => v.toString(16).padStart(2, "0")).join(":") : "02:01:" + [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255].map((v) => v.toString(16).padStart(2, "0")).join(":");
                while (occupied.has(address())) n = n + 1 >>> 0;
                const mac = address();
                occupied.add(mac);
                addresses.set(id, mac);
              }
            }
            const result = addresses.get(String(device.id));
            if (!result) throw new Error("MAC için cihaz topolojide bulunamadı.");
            return result;
          };
        }
        return { createResolver, resolve: createResolver(), validate };
      })();
      if (typeof module !== "undefined" && module.exports) module.exports = AgLabMacAddress2;
    }
  });

  // src/sim-bridge/index.ts
  var index_exports = {};
  __export(index_exports, {
    BridgeError: () => BridgeError,
    LabQuery: () => LabQuery,
    MODEL_L2: () => MODEL_L2,
    MODEL_L3: () => MODEL_L3,
    canonPort: () => canonPort,
    createLab: () => createLab,
    createRuntime: () => createRuntime,
    createSession: () => createSession,
    needsEncapFor: () => needsEncapFor,
    runScript: () => runScript,
    toAglab: () => toAglab,
    toLabber: () => toLabber
  });

  // src/sim/config.ts
  function defaultL2() {
    return {
      shutdown: false,
      description: "",
      mode: "dynamic-auto",
      accessVlan: 1,
      nativeVlan: 1,
      allowed: null,
      nonegotiate: false,
      encapDot1q: false,
      portfast: false
    };
  }
  function defaultPhys() {
    return { ...defaultL2(), channel: null };
  }
  function defaultSvi(vlan) {
    return { shutdown: vlan === 1, description: "", ip: null };
  }
  function defaultSwitchConfig(def) {
    const ifaces = {};
    for (const p of def.ports) ifaces[p] = defaultPhys();
    return {
      hostname: "Switch",
      vlans: {
        "1": "default",
        "1002": "fddi-default",
        "1003": "token-ring-default",
        "1004": "fddinet-default",
        "1005": "trnet-default"
      },
      ifaces,
      pos: {},
      svis: { "1": defaultSvi(1) },
      stpMode: "pvst",
      stpPriority: {},
      ipRouting: false,
      routes: [],
      defaultGateway: null
    };
  }
  var RESERVED_VLANS = [1, 1002, 1003, 1004, 1005];
  function defaultVlanName(id) {
    return "VLAN" + String(id).padStart(4, "0");
  }
  function l2Signature(c) {
    return JSON.stringify([c.mode, c.accessVlan, c.nativeVlan, c.allowed, c.nonegotiate]);
  }
  function pickL2(c) {
    return {
      shutdown: c.shutdown,
      description: c.description,
      mode: c.mode,
      accessVlan: c.accessVlan,
      nativeVlan: c.nativeVlan,
      allowed: c.allowed ? [...c.allowed] : null,
      nonegotiate: c.nonegotiate,
      encapDot1q: c.encapDot1q,
      portfast: c.portfast
    };
  }

  // src/sim/util.ts
  var IF_TYPES = [
    { full: "FastEthernet", short: "Fa", speed: 100 },
    { full: "GigabitEthernet", short: "Gi", speed: 1e3 },
    { full: "Port-channel", short: "Po" },
    { full: "Vlan", short: "Vl" },
    { full: "Loopback", short: "Lo" }
  ];
  function canonIf(typeTok, num) {
    const t = typeTok.toLowerCase();
    const matches = IF_TYPES.filter((x) => x.full.toLowerCase().startsWith(t));
    if (matches.length !== 1) return null;
    return matches[0].full + num;
  }
  function ifType(name) {
    return IF_TYPES.find((t) => name.startsWith(t.full));
  }
  function shortIf(name) {
    const t = ifType(name);
    return t ? t.short + name.slice(t.full.length) : name;
  }
  function ifNum(name) {
    const t = ifType(name);
    return t ? name.slice(t.full.length) : name;
  }
  function ports(...specs) {
    const out = [];
    for (const spec of specs) {
      const m = /^([A-Za-z-]+)(\d+\/)(\d+)(?:-(\d+))?$/.exec(spec);
      if (!m) throw new Error("bad port spec " + spec);
      const full = canonIf(m[1], "");
      const from = Number(m[3]);
      const to = m[4] ? Number(m[4]) : from;
      for (let i = from; i <= to; i++) out.push(full + m[2] + i);
    }
    return out;
  }
  function ipToInt(ip) {
    const p = ip.split(".");
    if (p.length !== 4) return null;
    let n = 0;
    for (const s of p) {
      if (!/^\d{1,3}$/.test(s)) return null;
      const v = Number(s);
      if (v > 255) return null;
      n = n * 256 + v;
    }
    return n >>> 0;
  }
  function intToIp(n) {
    return [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255].join(".");
  }
  function isIp(s) {
    return ipToInt(s) !== null;
  }
  function maskToPrefix(mask) {
    const n = ipToInt(mask);
    if (n === null) return null;
    let len = 0;
    let seenZero = false;
    for (let i = 31; i >= 0; i--) {
      const bit = n >>> i & 1;
      if (bit && seenZero) return null;
      if (bit) len++;
      else seenZero = true;
    }
    return len;
  }
  function prefixToMask(len) {
    return intToIp(len === 0 ? 0 : 4294967295 << 32 - len >>> 0);
  }
  function prefixMaskInt(len) {
    return len === 0 ? 0 : 4294967295 << 32 - len >>> 0;
  }
  function sameSubnet(a, b, len) {
    const m = prefixMaskInt(len);
    return (ipToInt(a) & m) >>> 0 === (ipToInt(b) & m) >>> 0;
  }
  function networkOf(ip, len) {
    return intToIp((ipToInt(ip) & prefixMaskInt(len)) >>> 0);
  }
  function parseVlanList(s, min = 1, max = 4094) {
    const out = /* @__PURE__ */ new Set();
    for (const part of s.split(",")) {
      const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
      if (!m) return null;
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      if (a < min || b > max || a > b) return null;
      for (let i = a; i <= b; i++) out.add(i);
    }
    return [...out].sort((x, y) => x - y);
  }
  function formatVlanList(v) {
    const s = [...v].sort((a, b) => a - b);
    const parts = [];
    let i = 0;
    while (i < s.length) {
      let j = i;
      while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      parts.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`);
      i = j + 1;
    }
    return parts.join(",");
  }
  function macAdd(mac, n) {
    const hex = mac.replace(/\./g, "");
    const v = (BigInt("0x" + hex) + BigInt(n)).toString(16).padStart(12, "0");
    return `${v.slice(0, 4)}.${v.slice(4, 8)}.${v.slice(8, 12)}`;
  }
  function macToColon(mac) {
    const hex = mac.replace(/\./g, "");
    return hex.match(/../g).join(":");
  }
  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }
  function pad(s, n) {
    const t = String(s);
    return t.length >= n ? t + " " : t + " ".repeat(n - t.length);
  }
  function padL(s, n) {
    const t = String(s);
    return t.length >= n ? t : " ".repeat(n - t.length) + t;
  }

  // src/sim/topology.ts
  var pk = (dev, port) => `${dev}|${port}`;
  function buildTopo(lab) {
    const devices = {};
    for (const d of lab.devices) devices[d.id] = d;
    const peer = {};
    for (const l of lab.links) {
      peer[pk(l.a[0], l.a[1])] = { dev: l.b[0], port: l.b[1] };
      peer[pk(l.b[0], l.b[1])] = { dev: l.a[0], port: l.a[1] };
    }
    const switches = lab.devices.filter((d) => d.kind === "switch");
    const pcs = lab.devices.filter((d) => d.kind === "pc");
    const pcAttach = {};
    for (const pc of pcs) pcAttach[pc.id] = peer[pk(pc.id, "eth0")] ?? null;
    return { lab, devices, switches, pcs, peer, pcAttach };
  }

  // src/sim/engine.ts
  var protoOf = (m) => m === "on" ? "-" : m === "active" || m === "passive" ? "LACP" : "PAgP";
  function negotiate(local, peer) {
    if (peer === null) return local === "on" ? "s" : "I";
    if (local === "on" && peer === "on") return "P";
    if (local === "on") return "s";
    if (peer === "on") return "I";
    if (protoOf(local) !== protoOf(peer)) return "I";
    if (protoOf(local) === "LACP") return local === "active" || peer === "active" ? "P" : "I";
    return local === "desirable" || peer === "desirable" ? "P" : "I";
  }
  function speedCost(mbps) {
    if (mbps >= 1e4) return 2;
    if (mbps >= 2e3) return 3;
    if (mbps >= 1e3) return 4;
    if (mbps >= 200) return 12;
    if (mbps >= 100) return 19;
    return 100;
  }
  function vlanExists(cfg, v) {
    return cfg.vlans[String(v)] !== void 0;
  }
  function allows(c, v) {
    return c.allowed === null || c.allowed.includes(v);
  }
  var isRoutedPort = (cfgs, dev, port) => !!cfgs[dev]?.ifaces[port]?.routed;
  function derive(topo, cfgs, pcs, errdis = /* @__PURE__ */ new Set()) {
    const phys = {};
    const adminDown = (dev, port) => {
      const c = cfgs[dev]?.ifaces[port];
      if (!c) return false;
      if (c.shutdown) return true;
      if (c.channel) {
        const po = cfgs[dev].pos[String(c.channel.id)];
        if (po?.shutdown) return true;
      }
      return false;
    };
    for (const sw of topo.switches) {
      for (const port of sw.ports) {
        const key = pk(sw.id, port);
        const peer = topo.peer[key] ?? null;
        const peerIsPc = !!peer && topo.devices[peer.dev]?.kind === "pc";
        const down = adminDown(sw.id, port);
        const err = errdis.has(key);
        const peerUp = !!peer && (peerIsPc || !adminDown(peer.dev, peer.port) && !errdis.has(pk(peer.dev, peer.port)));
        phys[key] = { dev: sw.id, port, peer, peerIsPc, adminDown: down, errDisabled: err, up: !down && !err && peerUp };
      }
    }
    const chanOf = (dev, port) => isRoutedPort(cfgs, dev, port) ? null : cfgs[dev]?.ifaces[port]?.channel ?? null;
    for (const ps of Object.values(phys)) {
      const ch = chanOf(ps.dev, ps.port);
      if (!ch) continue;
      let flag;
      if (!ps.up) flag = "D";
      else {
        const peerCh = ps.peer && !ps.peerIsPc ? chanOf(ps.peer.dev, ps.peer.port) : null;
        flag = negotiate(ch.mode, peerCh ? peerCh.mode : null);
      }
      ps.ec = { id: ch.id, mode: ch.mode, flag };
    }
    for (let iter = 0; iter < 6; iter++) {
      let changed = false;
      for (const sw of topo.switches) {
        const groups = /* @__PURE__ */ new Map();
        for (const port of sw.ports) {
          const ps = phys[pk(sw.id, port)];
          if (ps.ec) groups.set(ps.ec.id, [...groups.get(ps.ec.id) ?? [], ps]);
        }
        for (const [id, members] of groups) {
          const poCfg = cfgs[sw.id].pos[String(id)];
          const poSig = poCfg ? l2Signature(poCfg) : null;
          let ref = null;
          for (const m of members) {
            if (m.ec.flag !== "P") continue;
            const peerPs = phys[pk(m.peer.dev, m.peer.port)];
            const peerRef = peerPs?.ec ? `${m.peer.dev}#${peerPs.ec.id}` : null;
            const memberCfg = cfgs[sw.id].ifaces[m.port];
            let bad = false;
            if (!peerPs?.ec || peerPs.ec.flag !== "P") bad = true;
            if (poSig !== null && l2Signature(memberCfg) !== poSig) bad = true;
            if (ref === null && !bad) ref = peerRef;
            else if (peerRef !== ref) bad = true;
            if (bad) {
              m.ec.flag = "s";
              changed = true;
            }
          }
        }
      }
      if (!changed) break;
    }
    const lports = {};
    const lportByName = {};
    const lportOfPhys = {};
    const ec = {};
    const speedOf = (port) => ifType(port)?.speed ?? 100;
    const portIndex = (sw, port) => sw.ports.indexOf(port) + 1;
    for (const sw of topo.switches) {
      const cfg = cfgs[sw.id];
      const list = [];
      const groups = [];
      const ids = new Set(Object.keys(cfg.pos).map(Number));
      for (const port of sw.ports) {
        const ch = chanOf(sw.id, port);
        if (ch) ids.add(ch.id);
      }
      for (const id of [...ids].sort((a, b) => a - b)) {
        const members = sw.ports.filter((p) => chanOf(sw.id, p)?.id === id);
        const memberStates = members.map((p) => ({ port: p, flag: phys[pk(sw.id, p)].ec.flag }));
        const bundled = memberStates.filter((m) => m.flag === "P").map((m) => m.port);
        const firstMode = members.length ? cfg.ifaces[members[0]].channel.mode : "on";
        groups.push({ dev: sw.id, id, protocol: protoOf(firstMode), members: memberStates, up: bundled.length > 0 });
        const poCfg = cfg.pos[String(id)];
        if (!poCfg) continue;
        let peerDev = null;
        let peerPort = null;
        if (bundled.length) {
          const peer = phys[pk(sw.id, bundled[0])].peer;
          const peerEc = phys[pk(peer.dev, peer.port)].ec;
          peerDev = peer.dev;
          peerPort = "Port-channel" + peerEc.id;
        }
        const lp = {
          dev: sw.id,
          name: "Port-channel" + id,
          isPo: true,
          routed: false,
          members: bundled,
          cfg: poCfg,
          active: bundled.length > 0 && !poCfg.shutdown,
          peerDev,
          peerPort,
          peerIsPc: false,
          opMode: "access",
          inactive: false,
          cost: speedCost(bundled.reduce((s, p) => s + speedOf(p), 0)),
          portNum: 64 + id,
          status: poCfg.shutdown ? "disabled" : bundled.length ? "connected" : "notconnect"
        };
        list.push(lp);
        for (const p of bundled) lportOfPhys[pk(sw.id, p)] = lp;
      }
      for (const port of sw.ports) {
        const ps = phys[pk(sw.id, port)];
        if (ps.ec?.flag === "P") continue;
        const suspended = ps.ec?.flag === "s";
        const lp = {
          dev: sw.id,
          name: port,
          isPo: false,
          routed: !!cfg.ifaces[port].routed,
          members: [port],
          cfg: cfg.ifaces[port],
          active: ps.up && !suspended,
          peerDev: ps.peer?.dev ?? null,
          peerPort: ps.peer?.port ?? null,
          peerIsPc: ps.peerIsPc,
          opMode: "access",
          inactive: false,
          cost: speedCost(speedOf(port)),
          portNum: portIndex(sw, port),
          status: ps.adminDown ? "disabled" : ps.errDisabled ? "err-disabled" : suspended ? "suspended" : ps.up ? "connected" : "notconnect"
        };
        list.push(lp);
        lportOfPhys[pk(sw.id, port)] = lp;
      }
      for (const lp of list) lportByName[pk(sw.id, lp.name)] = lp;
      lports[sw.id] = list;
      ec[sw.id] = groups;
    }
    const peerLp = (lp) => lp.peerDev && !lp.peerIsPc ? lportByName[pk(lp.peerDev, lp.peerPort)] ?? null : null;
    for (const list of Object.values(lports)) {
      for (const lp of list) {
        if (lp.active && !lp.peerIsPc) {
          const p = peerLp(lp);
          if (!p || !p.active) lp.active = lp.active && !!p && p.active;
        }
      }
    }
    const sendsDtpTrunk = (p) => !p.routed && (p.cfg.mode === "trunk" && !p.cfg.nonegotiate || p.cfg.mode === "dynamic-desirable");
    for (const list of Object.values(lports)) {
      for (const lp of list) {
        const c = lp.cfg;
        if (lp.routed) lp.opMode = "access";
        else if (c.mode === "access") lp.opMode = "access";
        else if (c.mode === "trunk") lp.opMode = "trunk";
        else {
          const p = peerLp(lp);
          if (!p || !lp.active) lp.opMode = "access";
          else if (sendsDtpTrunk(p)) lp.opMode = "trunk";
          else if (c.mode === "dynamic-desirable" && p.cfg.mode === "dynamic-auto" && !p.routed) lp.opMode = "trunk";
          else lp.opMode = "access";
        }
        lp.inactive = !lp.routed && lp.opMode === "access" && !vlanExists(cfgs[lp.dev], c.accessVlan);
        if (lp.inactive && lp.status === "connected") lp.status = "inactive";
      }
    }
    const d = {
      topo,
      cfgs,
      pcs,
      phys,
      lports,
      lportByName,
      lportOfPhys,
      ec,
      stp: {},
      svis: {},
      nativeMismatch: [],
      errdis,
      ospf: {}
    };
    const allVlans = /* @__PURE__ */ new Set();
    for (const c of Object.values(cfgs))
      for (const v of Object.keys(c.vlans)) if (Number(v) < 1002 || Number(v) > 1005) allVlans.add(Number(v));
    for (const v of [...allVlans].sort((a, b) => a - b)) d.stp[v] = computeStp(d, v);
    for (const sw of topo.switches) {
      const cfg = cfgs[sw.id];
      const out = [];
      for (const [vs, svi] of Object.entries(cfg.svis)) {
        const v = Number(vs);
        const hasFwd = (d.lports[sw.id] ?? []).some((lp) => portForwards(d, sw.id, lp, v));
        const up = !svi.shutdown && vlanExists(cfg, v) && hasFwd;
        out.push({
          dev: sw.id,
          vlan: v,
          adminDown: svi.shutdown,
          up,
          status: svi.shutdown ? "administratively down" : vlanExists(cfg, v) ? "up" : "down",
          ip: svi.ip?.addr ?? null,
          mask: svi.ip?.mask ?? null,
          mac: macAdd(sw.mac, 64 + 0)
        });
      }
      out.sort((a, b) => a.vlan - b.vlan);
      d.svis[sw.id] = out;
    }
    const nativeOf = (lp) => lp.opMode === "trunk" ? lp.cfg.nativeVlan : lp.cfg.accessVlan;
    for (const ps of Object.values(phys)) {
      if (!ps.up || !ps.peer || ps.peerIsPc) continue;
      const a = lportOfPhys[pk(ps.dev, ps.port)];
      const b = lportOfPhys[pk(ps.peer.dev, ps.peer.port)];
      if (!a || !b || a.routed || b.routed) continue;
      const na = nativeOf(a);
      const nb = nativeOf(b);
      if (na !== nb)
        d.nativeMismatch.push({ dev: ps.dev, port: ps.port, native: na, peerDev: ps.peer.dev, peerPort: ps.peer.port, peerNative: nb });
    }
    return d;
  }
  function egress(d, lp, v) {
    if (!lp.active || lp.inactive || lp.routed) return null;
    if (!vlanExists(d.cfgs[lp.dev], v)) return null;
    if (lp.opMode === "access") return lp.cfg.accessVlan === v ? "u" : null;
    if (!allows(lp.cfg, v)) return null;
    return v === lp.cfg.nativeVlan ? "u" : "t";
  }
  function ingress(d, lp, tag, v) {
    if (!lp.active || lp.inactive || lp.routed) return null;
    const cfg = d.cfgs[lp.dev];
    if (lp.opMode === "access") {
      if (tag === "t") return null;
      return vlanExists(cfg, lp.cfg.accessVlan) ? lp.cfg.accessVlan : null;
    }
    const vin = tag === "u" ? lp.cfg.nativeVlan : v;
    return allows(lp.cfg, vin) && vlanExists(cfg, vin) ? vin : null;
  }
  function peerOf(d, lp) {
    if (!lp.peerDev || lp.peerIsPc) return null;
    return d.lportByName[pk(lp.peerDev, lp.peerPort)] ?? null;
  }
  function crossVlan(d, lp, v) {
    const p = peerOf(d, lp);
    if (!p) return null;
    const tag = egress(d, lp, v);
    if (!tag) return null;
    return ingress(d, p, tag, v);
  }
  function portForwards(d, dev, lp, v) {
    const st = d.stp[v]?.[dev]?.ports[lp.name];
    return !!st && st.state === "FWD";
  }
  function cmpVec(a, b) {
    return a.rootPrio - b.rootPrio || a.rootMac.localeCompare(b.rootMac) || a.cost - b.cost || a.sPrio - b.sPrio || a.sMac.localeCompare(b.sMac) || a.sPort - b.sPort;
  }
  function computeStp(d, v) {
    const bridges = {};
    const edges = {};
    for (const sw of d.topo.switches) {
      const cfg = d.cfgs[sw.id];
      if (!vlanExists(cfg, v)) continue;
      const prio = (cfg.stpPriority[String(v)] ?? 32768) + v;
      const mac = sw.mac;
      const b = { prio, mac, rootPrio: prio, rootMac: mac, rootCost: 0, rootPort: null, isRoot: true, ports: {} };
      edges[sw.id] = [];
      for (const lp of d.lports[sw.id] ?? []) {
        if (!egress(d, lp, v)) continue;
        const port = { role: "Desg", state: "FWD", cost: lp.cost, portNum: lp.portNum, edge: lp.peerIsPc };
        b.ports[lp.name] = port;
        const p = peerOf(d, lp);
        if (!p) continue;
        const there = crossVlan(d, lp, v);
        if (there === null) continue;
        if (there !== v || crossVlan(d, p, there) !== v) {
          port.state = "BKN";
          port.inconsistent = "PVID_Inc";
          continue;
        }
        edges[sw.id].push({ lp, peerDev: p.dev, peerLp: p });
      }
      bridges[sw.id] = b;
    }
    for (const [dev, b] of Object.entries(bridges)) {
      for (const e of edges[dev]) {
        const pb = bridges[e.peerDev];
        if (pb?.ports[e.peerLp.name]?.state === "BKN") {
          b.ports[e.lp.name].state = "BKN";
          b.ports[e.lp.name].inconsistent = "PVID_Inc";
        }
      }
      edges[dev] = edges[dev].filter((e) => b.ports[e.lp.name].state !== "BKN" && !!bridges[e.peerDev]);
    }
    const self = (b) => ({ rootPrio: b.prio, rootMac: b.mac, cost: 0, sPrio: b.prio, sMac: b.mac, sPort: 0 });
    const best = {};
    for (const [dev, b] of Object.entries(bridges)) best[dev] = { vec: self(b), via: null };
    for (let iter = 0; iter < 64; iter++) {
      let changed = false;
      const next = {};
      for (const [dev, b] of Object.entries(bridges)) {
        let cur = { vec: self(b), via: null };
        for (const e of edges[dev]) {
          const nb = best[e.peerDev].vec;
          const peerB = bridges[e.peerDev];
          const cand = {
            rootPrio: nb.rootPrio,
            rootMac: nb.rootMac,
            cost: nb.cost + e.lp.cost,
            sPrio: peerB.prio,
            sMac: peerB.mac,
            sPort: e.peerLp.portNum
          };
          if (cmpVec(cand, cur.vec) < 0) cur = { vec: cand, via: e.lp.name };
        }
        next[dev] = cur;
        if (cmpVec(cur.vec, best[dev].vec) !== 0 || cur.via !== best[dev].via) changed = true;
      }
      Object.assign(best, next);
      if (!changed) break;
    }
    for (const [dev, b] of Object.entries(bridges)) {
      const bv = best[dev];
      b.rootPrio = bv.vec.rootPrio;
      b.rootMac = bv.vec.rootMac;
      b.rootCost = bv.vec.cost;
      b.rootPort = bv.via;
      b.isRoot = bv.via === null;
    }
    for (const [dev, b] of Object.entries(bridges)) {
      for (const e of edges[dev]) {
        const port = b.ports[e.lp.name];
        if (e.lp.name === b.rootPort) {
          port.role = "Root";
          port.state = "FWD";
          continue;
        }
        const pb = bridges[e.peerDev];
        const mine = [b.rootCost, b.prio, b.mac, e.lp.portNum];
        const theirs = [pb.rootCost, pb.prio, pb.mac, e.peerLp.portNum];
        const cmp = mine[0] - theirs[0] || mine[1] - theirs[1] || mine[2].localeCompare(theirs[2]) || mine[3] - theirs[3];
        if (cmp < 0) {
          port.role = "Desg";
          port.state = "FWD";
        } else {
          port.role = "Altn";
          port.state = "BLK";
        }
      }
    }
    return bridges;
  }
  function bpduGuardOn(cfg, port) {
    const c = cfg.ifaces[port];
    if (!c || c.routed) return false;
    if (c.bpduguard !== void 0) return c.bpduguard;
    return !!cfg.bpduguardDefault && c.portfast;
  }
  function bpduViolations(d) {
    const out = [];
    for (const [key, ps] of Object.entries(d.phys)) {
      if (ps.adminDown || !ps.peer || ps.peerIsPc) continue;
      if (!bpduGuardOn(d.cfgs[ps.dev], ps.port)) continue;
      const peer = d.phys[pk(ps.peer.dev, ps.peer.port)];
      if (!peer || peer.adminDown || isRoutedPort(d.cfgs, ps.peer.dev, ps.peer.port)) continue;
      out.push(key);
    }
    return out;
  }

  // src/sim/net.ts
  var nk = (n) => `${n.dev}|${n.vlan}`;
  function routedNode(d, dev, port) {
    const sw = d.topo.devices[dev];
    return { dev, vlan: -(sw.ports.indexOf(port) + 1) };
  }
  function routedPortOf(d, n) {
    if (n.vlan >= 0) return null;
    return d.topo.devices[n.dev].ports[-n.vlan - 1] ?? null;
  }
  function l2Domain(d, start) {
    const nodes = /* @__PURE__ */ new Map();
    nodes.set(nk(start), { node: start, via: null });
    const queue = [start];
    const add = (next, from, out, inn) => {
      if (nodes.has(nk(next))) return;
      nodes.set(nk(next), { node: next, via: { from: nk(from), out, in: inn } });
      queue.push(next);
    };
    while (queue.length) {
      const n = queue.shift();
      const rport = routedPortOf(d, n);
      if (rport) {
        const lp = d.lportByName[pk(n.dev, rport)];
        const p = lp?.active ? peerOf(d, lp) : null;
        if (!p || !p.active) continue;
        if (p.routed) add(routedNode(d, p.dev, p.name), n, lp.name, p.name);
        else {
          const v2 = ingress(d, p, "u", 0);
          if (v2 !== null && portForwards(d, p.dev, p, v2)) add({ dev: p.dev, vlan: v2 }, n, lp.name, p.name);
        }
        continue;
      }
      for (const lp of d.lports[n.dev] ?? []) {
        if (!portForwards(d, n.dev, lp, n.vlan)) continue;
        const p = peerOf(d, lp);
        if (!p) continue;
        if (p.routed) {
          if (p.active && egress(d, lp, n.vlan) === "u") add(routedNode(d, p.dev, p.name), n, lp.name, p.name);
          continue;
        }
        const v2 = crossVlan(d, lp, n.vlan);
        if (v2 === null || !portForwards(d, p.dev, p, v2)) continue;
        const next = { dev: p.dev, vlan: v2 };
        if (nodes.has(nk(next))) continue;
        nodes.set(nk(next), { node: next, via: { from: nk(n), out: lp.name, in: p.name } });
        queue.push(next);
      }
    }
    return { nodes };
  }
  function pcNode(d, pc) {
    const at = d.topo.pcAttach[pc];
    if (!at) return null;
    const lp = d.lportOfPhys[pk(at.dev, at.port)];
    if (!lp || !lp.active) return null;
    if (lp.routed) return routedNode(d, at.dev, at.port);
    const v = ingress(d, lp, "u", 0);
    if (v === null || !portForwards(d, at.dev, lp, v)) return null;
    return { dev: at.dev, vlan: v };
  }
  function pcPort(d, pc) {
    const at = d.topo.pcAttach[pc];
    return at ? d.lportOfPhys[pk(at.dev, at.port)] ?? null : null;
  }
  function l3Ifs(d, dev) {
    const def = d.topo.devices[dev];
    if (def.kind === "pc") {
      const c = d.pcs[dev];
      if (!c?.ip) return [];
      return [{ dev, kind: "pc", name: "eth0", ip: c.ip, prefix: c.prefix, mac: def.mac, node: pcNode(d, dev) }];
    }
    const out = [];
    for (const s of d.svis[dev] ?? []) {
      if (!s.up || !s.ip || !s.mask) continue;
      out.push({ dev, kind: "svi", name: "Vlan" + s.vlan, ip: s.ip, prefix: maskToPrefix(s.mask), mac: s.mac, node: { dev, vlan: s.vlan } });
    }
    const cfg = d.cfgs[dev];
    const sw = def;
    for (const port of sw.ports) {
      const c = cfg.ifaces[port];
      if (!c.routed || !c.ip) continue;
      const lp = d.lportByName[pk(dev, port)];
      if (!lp?.active) continue;
      out.push({ dev, kind: "routed", name: port, ip: c.ip.addr, prefix: maskToPrefix(c.ip.mask), mac: macAdd(sw.mac, sw.ports.indexOf(port) + 1), node: routedNode(d, dev, port) });
    }
    for (const [n, l] of Object.entries(cfg.loopbacks ?? {})) {
      if (l.shutdown || !l.ip) continue;
      out.push({ dev, kind: "loop", name: "Loopback" + n, ip: l.ip.addr, prefix: maskToPrefix(l.ip.mask), mac: "0000.0000.0000", node: null });
    }
    return out;
  }
  function ifBandwidth(name, override) {
    if (override) return override;
    if (name.startsWith("Loopback")) return 8e6;
    if (name.startsWith("Vlan")) return 1e6;
    return (ifType(name)?.speed ?? 100) * 1e3;
  }
  function allL3Ifs(d) {
    return d.topo.lab.devices.flatMap((x) => l3Ifs(d, x.id));
  }
  function isRouter(d, dev) {
    const def = d.topo.devices[dev];
    return def.kind === "switch" && !!def.l3 && d.cfgs[dev].ipRouting;
  }
  var RANK = { L: 0, C: 0, S: 1, O: 2, "O IA": 2, "O E2": 2 };
  function routeTable(d, dev) {
    const ifs = l3Ifs(d, dev);
    const out = [];
    for (const i of ifs) {
      const m = prefixMaskInt(i.prefix);
      out.push({ code: "C", net: intTo((ipToInt(i.ip) & m) >>> 0), prefix: i.prefix, nh: null, ifname: i.name });
      if (i.prefix < 32) out.push({ code: "L", net: i.ip, prefix: 32, nh: null, ifname: i.name });
    }
    if (isRouter(d, dev)) {
      const have = (net, prefix) => out.some((e) => e.net === net && e.prefix === prefix);
      for (const r of d.cfgs[dev].routes) {
        const outIf = ifs.find((i) => i.node && sameSubnet(i.ip, r.nh, i.prefix));
        if (!outIf) continue;
        out.push({ code: "S", net: r.net, prefix: maskToPrefix(r.mask), nh: r.nh, ifname: outIf.name });
      }
      for (const r of d.ospf[dev]?.routes ?? []) {
        if (have(r.net, r.prefix) || !r.paths.length) continue;
        out.push({ code: r.code, net: r.net, prefix: r.prefix, nh: r.paths[0].nh, ifname: r.paths[0].ifname, metric: r.metric, paths: r.paths });
      }
    }
    return out;
  }
  var intTo = (n) => [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255].join(".");
  function lookup(d, dev, dst) {
    const ifs = l3Ifs(d, dev);
    const def = d.topo.devices[dev];
    if (def.kind === "pc") {
      const i = ifs[0];
      if (!i) return null;
      if (sameSubnet(i.ip, dst, i.prefix)) return { out: i, nh: dst };
      const gw = d.pcs[dev].gw;
      if (gw && sameSubnet(i.ip, gw, i.prefix)) return { out: i, nh: gw };
      return null;
    }
    if (!isRouter(d, dev)) {
      const c = ifs.find((i) => sameSubnet(i.ip, dst, i.prefix));
      if (c) return { out: c, nh: dst };
      const gw = d.cfgs[dev].defaultGateway;
      const gi = gw ? ifs.find((i) => sameSubnet(i.ip, gw, i.prefix)) : void 0;
      return gw && gi ? { out: gi, nh: gw } : null;
    }
    let best = null;
    const dn = ipToInt(dst);
    for (const e of routeTable(d, dev)) {
      if (e.code === "L") continue;
      const m = prefixMaskInt(e.prefix);
      if ((dn & m) >>> 0 !== (ipToInt(e.net) & m) >>> 0) continue;
      if (best && best.e.prefix > e.prefix) continue;
      if (best && best.e.prefix === e.prefix && RANK[best.e.code] <= RANK[e.code]) continue;
      const out = ifs.find((i) => i.name === e.ifname);
      best = { e, out };
    }
    if (!best) return null;
    return { out: best.out, nh: best.e.code === "C" ? dst : best.e.nh };
  }
  function owns(d, dev, ip) {
    return l3Ifs(d, dev).some((i) => i.ip === ip);
  }
  var domainCache = /* @__PURE__ */ new WeakMap();
  function domainOf(d, n) {
    let m = domainCache.get(d);
    if (!m) domainCache.set(d, m = /* @__PURE__ */ new Map());
    let dom = m.get(nk(n));
    if (!dom) m.set(nk(n), dom = l2Domain(d, n));
    return dom;
  }
  function arpResolve(d, from, ip) {
    if (!from.node) return null;
    const dom = domainOf(d, from.node);
    for (const i of allL3Ifs(d)) {
      if (i.ip !== ip || !i.node) continue;
      if (dom.nodes.has(nk(i.node))) return i;
    }
    return null;
  }
  function deliver(d, from, dst) {
    let cur = from;
    const hops = [];
    let routers = 0;
    if (!l3Ifs(d, from).length) return { kind: "noip", hops };
    for (let ttl = 0; ttl < 32; ttl++) {
      if (owns(d, cur, dst)) return { kind: "ok", hops, routersCrossed: routers };
      if (cur !== from && !isRouter(d, cur)) return { kind: "timeout", hops };
      const r = lookup(d, cur, dst);
      if (!r) {
        if (cur === from) return { kind: "noroute", hops };
        const at = hops[hops.length - 1];
        return { kind: "unreach", at: cur, atIp: at.ip, hops };
      }
      const target = arpResolve(d, r.out, r.nh);
      if (!target) return { kind: "timeout", hops };
      if (cur !== from) routers++;
      hops.push({ dev: target.dev, ip: target.ip, outIf: r.out });
      cur = target.dev;
    }
    return { kind: "timeout", hops };
  }
  function sourceIp(d, dev, dst) {
    return lookup(d, dev, dst)?.out.ip ?? null;
  }
  function ping(d, from, dst) {
    if (!isValidIp(dst)) return { ok: false, reason: "noroute" };
    const fwd = deliver(d, from, dst);
    const firstHopArp = fwd.hops[0] ? { dev: from, ip: fwd.hops[0].ip } : void 0;
    if (fwd.kind === "noip") return { ok: false, reason: "noip", forward: fwd };
    if (fwd.kind === "noroute") return { ok: false, reason: "noroute", forward: fwd };
    if (fwd.kind === "unreach") {
      const back2 = deliver(d, fwd.at, sourceIp(d, from, dst));
      return back2.kind === "ok" ? { ok: false, reason: "unreach", unreachFrom: fwd.atIp, forward: fwd, firstHopArp } : { ok: false, reason: "timeout", forward: fwd, firstHopArp };
    }
    if (fwd.kind !== "ok") return { ok: false, reason: "timeout", forward: fwd, firstHopArp };
    const src = sourceIp(d, from, dst);
    const owner = d.topo.lab.devices.find((x) => owns(d, x.id, dst)).id;
    const back = deliver(d, owner, src);
    if (back.kind !== "ok") return { ok: false, reason: "timeout", forward: fwd, firstHopArp };
    const base = d.topo.devices[owner].kind === "pc" ? 64 : 255;
    return { ok: true, ttl: base - back.routersCrossed, forward: fwd, firstHopArp };
  }
  function isValidIp(s) {
    return ipToInt(s) !== null;
  }
  function macTable(d, dev, seen) {
    const out = [];
    for (const i of allL3Ifs(d)) {
      if (!seen.has(i.mac) || !i.node || i.dev === dev) continue;
      const dom = domainOf(d, i.node);
      for (const [, entry] of dom.nodes) {
        if (entry.node.dev !== dev || entry.node.vlan < 0) continue;
        let port = null;
        if (entry.via) port = entry.via.in;
        else if (i.kind === "pc") {
          const lp = pcPort(d, i.dev);
          port = lp?.name ?? null;
        }
        if (port) out.push({ vlan: entry.node.vlan, mac: i.mac, port });
      }
    }
    return out.sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac));
  }

  // src/sim/cli/help.ts
  var HELP = {
    // exec
    enable: "Turn on privileged commands",
    disable: "Turn off privileged commands",
    exit: "Exit from the EXEC",
    logout: "Exit from the EXEC",
    end: "Exit from configure mode",
    show: "Show running system information",
    ping: "Send echo messages",
    traceroute: "Trace route to destination",
    configure: "Enter configuration mode",
    terminal: "Set terminal line parameters",
    write: "Write running configuration to memory, network, or terminal",
    memory: "Write to NV memory",
    copy: "Copy from one file to another",
    erase: "Erase a filesystem",
    reload: "Halt and perform a cold restart",
    clear: "Reset functions",
    do: "To run exec commands in config mode",
    "running-config": "Current operating configuration",
    "startup-config": "Contents of startup configuration",
    "mac": "MAC configuration",
    "address-table": "MAC forwarding table",
    dynamic: "dynamic entry type",
    length: "Set number of lines on a screen",
    // show
    version: "System hardware and software status",
    vlan: "VTP VLAN status",
    brief: "VTP all VLAN status in brief",
    interfaces: "Interface status and configuration",
    status: "Show interface line status",
    trunk: "Show interface trunk information",
    switchport: "Show interface switchport information",
    ip: "IP information",
    interface: "IP interface status and configuration",
    route: "IP routing table",
    "spanning-tree": "Spanning tree topology",
    etherchannel: "EtherChannel information",
    summary: "One-line summary per channel-group",
    cdp: "CDP information",
    neighbors: "CDP neighbor entries",
    arp: "ARP table",
    history: "Display the session command history",
    // config
    hostname: "Set system's network name",
    no: "Negate a command or set its defaults",
    range: "interface range command",
    name: "Ascii name of the VLAN",
    routing: "Enable IP routing",
    "default-gateway": "Specify default gateway (if not routing IP)",
    mode: "Spanning tree operating mode",
    pvst: "Per-Vlan spanning tree mode",
    "rapid-pvst": "Per-Vlan rapid spanning tree mode",
    priority: "Set the bridge priority for the spanning tree",
    root: "Configure switch as root",
    primary: "Configure this switch as primary root for this spanning tree",
    secondary: "Configure switch as secondary root",
    // interface
    shutdown: "Shutdown the selected interface",
    description: "Interface specific description",
    access: "Set access mode characteristics of the interface",
    "auto": "Enable PAgP only if a PAgP device is detected",
    desirable: "Enable PAgP unconditionally",
    native: "Set trunking native characteristics when interface is in trunking mode",
    allowed: "Set allowed VLAN characteristics when interface is in trunking mode",
    add: "add VLANs to the current list",
    remove: "remove VLANs from the current list",
    except: "all VLANs except the following",
    all: "all VLANs",
    none: "no VLANs",
    nonegotiate: "Device will not engage in negotiation protocol on this interface",
    encapsulation: "Set trunking encapsulation when interface is in trunking mode",
    dot1q: "Interface uses only 802.1q trunking encapsulation when trunking",
    "channel-group": "Etherchannel/port bundling configuration",
    active: "Enable LACP unconditionally",
    passive: "Enable LACP only if a LACP device is detected",
    on: "Enable Etherchannel only",
    address: "Set the IP address of an interface",
    portfast: "Portfast options for the interface",
    FastEthernet: "FastEthernet IEEE 802.3",
    GigabitEthernet: "GigabitEthernet IEEE 802.3z",
    "Port-channel": "Ethernet Channel of interfaces",
    Vlan: "Catalyst Vlans",
    // routing / OSPF
    router: "Enable a routing process",
    ospf: "Open Shortest Path First (OSPF)",
    "router-id": "router-id for this OSPF process",
    network: "Enable routing on an IP network",
    area: "OSPF area parameters",
    stub: "Specify a stub area",
    "no-summary": "Do not send summary LSA into stub area",
    "passive-interface": "Suppress routing updates on an interface",
    default: "Suppress routing updates on all interfaces",
    "auto-cost": "Calculate OSPF interface cost according to bandwidth",
    "reference-bandwidth": "Use reference bandwidth method to assign OSPF cost",
    "default-information": "Control distribution of default information",
    originate: "Distribute a default route",
    always: "Always advertise default route",
    cost: "Interface cost",
    "hello-interval": "Time between HELLO packets",
    "dead-interval": "Interval after which a neighbor is declared dead",
    "point-to-point": "Specify OSPF point-to-point network",
    broadcast: "Specify OSPF broadcast multi-access network",
    mtu: "Set IP Maximum Transmission Unit",
    bandwidth: "Set bandwidth informational parameter",
    neighbor: "Neighbor list",
    protocols: "IP routing protocol process parameters and statistics",
    process: "Reset OSPF process",
    static: "Static routes",
    connected: "Connected networks",
    Loopback: "Loopback interface",
    // STP protection / errdisable
    bpduguard: "Don't accept BPDUs on this interface",
    errdisable: "Error disable",
    recovery: "Error disable recovery",
    cause: "Enable error disable recovery for application",
    interval: "Error disable recovery timer value",
    "err-disabled": "Show interfaces in error-disabled state",
    // filters
    include: "Include lines that match",
    exclude: "Exclude lines that match",
    begin: "Begin with the line that matches",
    section: "Filter a section of output"
  };

  // src/sim/cli/parser.ts
  var newNode = () => ({ kws: /* @__PURE__ */ new Map(), params: [] });
  function parseParam(spec) {
    const [head, ...rest] = spec.slice(1, -1).split(":");
    const desc = rest.join(":");
    const m = /^(\d+)-(\d+)$/.exec(head);
    if (m) return { kind: "range", min: Number(m[1]), max: Number(m[2]), desc };
    if (head === "vlist") return { kind: "vlist", desc };
    if (head === "A.B.C.D") return { kind: "ip", desc };
    if (head === "WORD") return { kind: "word", desc };
    if (head === "LINE") return { kind: "line", desc };
    if (head === "ifnum") return { kind: "ifnum", desc };
    throw new Error("bad param " + spec);
  }
  var sameParam = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function buildTrie(patterns) {
    const root = newNode();
    for (const pat of patterns) {
      let node = root;
      for (const t of pat.p.match(/<[^>]*>|\S+/g)) {
        if (t === "<if>") {
          const types = pat.ifTypes ?? IF_TYPES.map((x) => x.full);
          let numNode;
          const shared = newNode();
          for (const ty of types) {
            let k = node.kws.get(ty);
            if (!k) node.kws.set(ty, k = newNode());
            k.ifTypes = true;
            let pn = k.params.find((x) => x.p.kind === "ifnum");
            if (!pn) k.params.push(pn = { p: { kind: "ifnum", desc: "" }, node: numNode ?? shared });
            numNode = pn.node;
          }
          node = numNode ?? shared;
          continue;
        }
        if (t.startsWith("<")) {
          const p = parseParam(t);
          let e = node.params.find((x) => sameParam(x.p, p));
          if (!e) node.params.push(e = { p, node: newNode() });
          node = e.node;
        } else {
          let k = node.kws.get(t);
          if (!k) node.kws.set(t, k = newNode());
          node = k;
        }
      }
      node.run = pat.run;
    }
    return root;
  }
  function tokenize(line) {
    const out = [];
    const re = /\S+/g;
    let m;
    while (m = re.exec(line)) out.push({ text: m[0], start: m.index });
    return out;
  }
  function paramOk(p, t) {
    switch (p.kind) {
      case "range":
        return /^\d+$/.test(t) && Number(t) >= p.min && Number(t) <= p.max;
      case "vlist":
        return parseVlanList(t) !== null;
      case "ip":
        return isIp(t);
      case "word":
      case "line":
        return true;
      case "ifnum":
        return /^\d+(\/\d+)*$/.test(t);
    }
  }
  function splitIf(node, toks, i) {
    const t = toks[i];
    const m = /^([A-Za-z][A-Za-z-]*?)(\d[\d/]*)$/.exec(t.text);
    if (!m) return;
    const hasIf = [...node.kws.entries()].some(([k, n]) => n.ifTypes && k.toLowerCase().startsWith(m[1].toLowerCase()));
    if (!hasIf) return;
    toks.splice(i, 1, { text: m[1], start: t.start }, { text: m[2], start: t.start + m[1].length });
  }
  function step(node, text) {
    const lower = text.toLowerCase();
    const kw = [...node.kws.keys()].filter((k) => k.toLowerCase().startsWith(lower));
    const exact = kw.find((k) => k.toLowerCase() === lower);
    if (exact) return { next: node.kws.get(exact), value: exact };
    if (kw.length === 1) return { next: node.kws.get(kw[0]), value: kw[0] };
    const prm = node.params.find((x) => x.p.kind !== "line" && paramOk(x.p, text));
    if (kw.length > 1 && !prm) return "ambiguous";
    if (prm) return { next: prm.node, value: text };
    return null;
  }
  function parse(root, line) {
    const toks = tokenize(line);
    if (!toks.length) return { ok: false, err: "empty" };
    let node = root;
    const args = [];
    const starts = [];
    for (let i = 0; i < toks.length; i++) {
      splitIf(node, toks, i);
      const t = toks[i];
      starts.push(t.start);
      const lineParam = node.params.find((x) => x.p.kind === "line");
      const r = step(node, t.text);
      if (r === "ambiguous") return { ok: false, err: "ambiguous" };
      if (!r) {
        if (lineParam) {
          args.push(line.slice(t.start).trim());
          node = lineParam.node;
          break;
        }
        return { ok: false, err: "invalid", at: t.start };
      }
      args.push(r.value);
      node = r.next;
    }
    if (!node.run) return { ok: false, err: "incomplete" };
    return { ok: true, node, args, starts };
  }
  function paramLabel(p) {
    switch (p.kind) {
      case "range":
        return `<${p.min}-${p.max}>`;
      case "vlist":
        return "WORD";
      case "ip":
        return "A.B.C.D";
      case "word":
        return "WORD";
      case "line":
        return "LINE";
      case "ifnum":
        return "<0-9>";
    }
  }
  var IFNUM_HELP = "Interface number";
  function walk(root, toks) {
    let node = root;
    for (let i = 0; i < toks.length; i++) {
      splitIf(node, toks, i);
      const r = step(node, toks[i].text);
      if (r === "ambiguous") return { ambiguous: true };
      if (!r) {
        if (node.params.some((x) => x.p.kind === "line")) return { line: true };
        return { invalidAt: toks[i].start };
      }
      node = r.next;
    }
    return { node };
  }
  function help(root, line) {
    const partial = !/\s$/.test(line) && line.length > 0;
    const toks = tokenize(line);
    const last = partial ? toks.pop() : null;
    const w = walk(root, toks);
    if ("ambiguous" in w) return [`% Ambiguous command: "${line.trim()}"`];
    if ("line" in w) return ["  LINE", ""];
    if ("invalidAt" in w) return w;
    const node = w.node;
    if (last) {
      const parts = [last];
      splitIf(node, parts, 0);
      if (parts.length > 1) {
        const r = step(node, parts[0].text);
        if (r && r !== "ambiguous") return ["  <0-9>".padEnd(16) + IFNUM_HELP, ""];
      }
      const lower = last.text.toLowerCase();
      const kws = [...node.kws.keys()].filter((k) => k.toLowerCase().startsWith(lower)).sort();
      if (kws.length) return [kws.join("  "), ""];
      const prm = node.params.find((x) => paramOk(x.p, last.text));
      if (prm) return [paramLabel(prm.p), ""];
      return { invalidAt: last.start };
    }
    const rows = [];
    for (const k of [...node.kws.keys()].sort()) rows.push([k, HELP[k] ?? ""]);
    for (const { p } of node.params) rows.push([paramLabel(p), p.desc || (p.kind === "ifnum" ? IFNUM_HELP : "")]);
    if (node.run) rows.push(["<cr>", ""]);
    const width = Math.max(14, ...rows.map((r) => r[0].length + 2));
    return [...rows.map(([a, b]) => ("  " + a.padEnd(width) + b).trimEnd()), ""];
  }
  function complete(root, line) {
    if (!line.trim() || /\s$/.test(line)) return null;
    const toks = tokenize(line);
    const last = toks.pop();
    const w = walk(root, toks);
    if (!("node" in w)) return null;
    const lower = last.text.toLowerCase();
    const kws = [...w.node.kws.keys()].filter((k) => k.toLowerCase().startsWith(lower));
    if (kws.length !== 1) return null;
    return line.slice(0, last.start) + kws[0] + " ";
  }

  // src/sim/cli/show.ts
  var sortIfs = (sw, names) => [...names].sort((a, b) => sw.ports.indexOf(a) - sw.ports.indexOf(b));
  var modeLine = (c) => c.mode === "access" ? "access" : c.mode === "trunk" ? "trunk" : c.mode === "dynamic-desirable" ? "dynamic desirable" : null;
  function l2Lines(c, needsEncap) {
    const out = [];
    if (c.description) out.push(" description " + c.description);
    if (c.accessVlan !== 1) out.push(" switchport access vlan " + c.accessVlan);
    if (c.allowed !== null) out.push(" switchport trunk allowed vlan " + (c.allowed.length ? formatVlanList(c.allowed) : "none"));
    if (needsEncap && c.encapDot1q) out.push(" switchport trunk encapsulation dot1q");
    if (c.nativeVlan !== 1) out.push(" switchport trunk native vlan " + c.nativeVlan);
    const m = modeLine(c);
    if (m) out.push(" switchport mode " + m);
    if (c.nonegotiate) out.push(" switchport nonegotiate");
    if (c.shutdown) out.push(" shutdown");
    if (c.portfast) out.push(" spanning-tree portfast");
    return out;
  }
  function l3Lines(ip, o, noIpLine) {
    const out = [];
    if (o?.bandwidth) out.push(" bandwidth " + o.bandwidth);
    if (ip) out.push(` ip address ${ip.addr} ${ip.mask}`);
    else if (noIpLine) out.push(" no ip address");
    if (o?.mtu) out.push(" ip mtu " + o.mtu);
    if (o?.ospfNet) out.push(" ip ospf network " + o.ospfNet);
    if (o?.ospfHello) out.push(" ip ospf hello-interval " + o.ospfHello);
    if (o?.ospfDead) out.push(" ip ospf dead-interval " + o.ospfDead);
    if (o?.ospfPrio !== void 0) out.push(" ip ospf priority " + o.ospfPrio);
    if (o?.ospfArea) out.push(` ip ospf ${o.ospfArea.pid} area ${o.ospfArea.area}`);
    if (o?.ospfCost) out.push(" ip ospf cost " + o.ospfCost);
    return out;
  }
  function runningConfig(sw, c) {
    const o = [];
    o.push("!", "version 15.2", "no service pad", "service timestamps debug datetime msec", "service timestamps log datetime msec", "no service password-encryption", "!");
    o.push("hostname " + c.hostname, "!", "boot-start-marker", "boot-end-marker", "!", "no aaa new-model");
    o.push("system mtu routing 1500");
    if (c.ipRouting) o.push("ip routing");
    o.push("!", "!", "vtp mode transparent", "!");
    o.push("spanning-tree mode " + c.stpMode, "spanning-tree extend system-id");
    const byPrio = /* @__PURE__ */ new Map();
    for (const [v, p] of Object.entries(c.stpPriority)) byPrio.set(p, [...byPrio.get(p) ?? [], Number(v)]);
    for (const [p, vs] of [...byPrio].sort((a, b) => a[1][0] - b[1][0])) o.push(`spanning-tree vlan ${formatVlanList(vs)} priority ${p}`);
    if (c.bpduguardDefault) o.push("spanning-tree portfast bpduguard default");
    if (c.errRecoveryBpdu) o.push("errdisable recovery cause bpduguard");
    if (c.errRecoveryInterval) o.push("errdisable recovery interval " + c.errRecoveryInterval);
    o.push("!", "vlan internal allocation policy ascending", "!");
    for (const v of Object.keys(c.vlans).map(Number).sort((a, b) => a - b)) {
      if (v === 1 || v >= 1002 && v <= 1005) continue;
      o.push("vlan " + v);
      if (c.vlans[String(v)] !== "VLAN" + String(v).padStart(4, "0")) o.push(" name " + c.vlans[String(v)]);
      o.push("!");
    }
    o.push("!");
    for (const n of Object.keys(c.loopbacks ?? {}).map(Number).sort((a, b) => a - b)) {
      const l = c.loopbacks[String(n)];
      o.push("interface Loopback" + n);
      if (l.description) o.push(" description " + l.description);
      o.push(...l3Lines(l.ip, l.l3, true));
      if (l.shutdown) o.push(" shutdown");
      o.push("!");
    }
    for (const id of Object.keys(c.pos).map(Number).sort((a, b) => a - b)) {
      o.push("interface Port-channel" + id, ...l2Lines(c.pos[String(id)], !!sw.needsEncap), "!");
    }
    for (const p of sw.ports) {
      const ic = c.ifaces[p];
      if (ic.routed) {
        o.push("interface " + p);
        if (ic.description) o.push(" description " + ic.description);
        o.push(" no switchport", ...l3Lines(ic.ip, ic.l3, true));
        if (ic.shutdown) o.push(" shutdown");
      } else {
        o.push("interface " + p, ...l2Lines(ic, !!sw.needsEncap));
        if (ic.bpduguard !== void 0) o.push(` spanning-tree bpduguard ${ic.bpduguard ? "enable" : "disable"}`);
        if (ic.channel) o.push(` channel-group ${ic.channel.id} mode ${ic.channel.mode}`);
      }
      o.push("!");
    }
    for (const v of Object.keys(c.svis).map(Number).sort((a, b) => a - b)) {
      const s = c.svis[String(v)];
      o.push("interface Vlan" + v);
      if (s.description) o.push(" description " + s.description);
      o.push(...l3Lines(s.ip, s.l3, true));
      if (s.shutdown) o.push(" shutdown");
      o.push("!");
    }
    if (c.ospf) {
      const r = c.ospf;
      o.push("router ospf " + r.pid);
      if (r.routerId) o.push(" router-id " + r.routerId);
      if (r.refBw !== 100) o.push(" auto-cost reference-bandwidth " + r.refBw);
      for (const [a, st] of Object.entries(r.stubs).sort((x, y) => Number(x[0]) - Number(y[0]))) o.push(` area ${a} stub${st.noSummary ? " no-summary" : ""}`);
      if (r.passiveDefault) o.push(" passive-interface default");
      for (const p of r.passive) o.push(`${r.passiveDefault ? " no" : ""} passive-interface ${p}`);
      for (const n of r.networks) o.push(` network ${n.addr} ${n.wildcard} area ${n.area}`);
      if (r.defaultOriginate) o.push(" default-information originate" + (r.defaultOriginate.always ? " always" : ""));
      o.push("!");
    }
    if (c.defaultGateway) o.push("ip default-gateway " + c.defaultGateway);
    o.push("ip forward-protocol nd", "no ip http server", "!");
    for (const r of c.routes) o.push(`ip route ${r.net} ${r.mask} ${r.nh}`);
    o.push("!", "line con 0", "line vty 0 4", " login", "line vty 5 15", " login", "!", "end");
    return o;
  }
  function showRun(rt, dev, which) {
    const sw = rt.topo.devices[dev];
    const c = which === "running" ? rt.running[dev] : rt.startup[dev];
    if (!c) return ["startup-config is not present"];
    const body = runningConfig(sw, c);
    const bytes = body.join("\n").length + 1;
    return which === "running" ? ["Building configuration...", "", `Current configuration : ${bytes} bytes`, ...body] : [`Using ${bytes} out of 524288 bytes`, ...body];
  }
  function showVlan(rt, dev, brief) {
    const d = rt.derived;
    const c = rt.running[dev];
    const sw = rt.topo.devices[dev];
    const o = ["", "VLAN Name                             Status    Ports", "---- -------------------------------- --------- -------------------------------"];
    const accessPorts = (v) => sortIfs(
      sw,
      (d.lports[dev] ?? []).filter((lp) => !lp.isPo && !lp.routed && lp.opMode === "access" && lp.cfg.accessVlan === v).map((lp) => lp.name)
    ).map(shortIf);
    for (const vs of Object.keys(c.vlans).map(Number).sort((a, b) => a - b)) {
      const ports2 = vs >= 1002 && vs <= 1005 ? [] : accessPorts(vs);
      const status = vs >= 1002 && vs <= 1005 ? "act/unsup" : "active";
      const chunks = [];
      for (let i = 0; i < ports2.length; i += 4) chunks.push(ports2.slice(i, i + 4).join(", "));
      o.push((pad(vs, 5) + pad(c.vlans[String(vs)], 33) + pad(status, 10) + (chunks[0] ?? "")).trimEnd());
      for (const ch of chunks.slice(1)) o.push(" ".repeat(48) + ch);
    }
    if (!brief) {
      o.push("", "VLAN Type  SAID       MTU   Parent RingNo BridgeNo Stp  BrdgMode Trans1 Trans2", "---- ----- ---------- ----- ------ ------ -------- ---- -------- ------ ------");
      for (const vs of Object.keys(c.vlans).map(Number).sort((a, b) => a - b)) {
        if (vs >= 1002) continue;
        o.push(`${pad(vs, 4)}enet  ${String(1e5 + vs).padEnd(10)} 1500  -      -      -        -    -        0      0`);
      }
    }
    return o;
  }
  function vlanCol(lp) {
    if (lp.opMode === "trunk") return "trunk";
    if (lp.inactive) return String(lp.cfg.accessVlan);
    return String(lp.cfg.accessVlan);
  }
  function showIntStatus(rt, dev) {
    const d = rt.derived;
    const sw = rt.topo.devices[dev];
    const o = ["", "Port      Name               Status       Vlan       Duplex  Speed Type"];
    const row = (name, desc, status, vlan, speed, type, up) => pad(shortIf(name), 10) + pad(desc.slice(0, 18), 19) + pad(status, 13) + pad(vlan, 11) + pad(up ? "a-full" : "auto", 8) + padL(up ? speed : "auto", 5) + " " + type;
    for (const p of sw.ports) {
      const ps = d.phys[pk(dev, p)];
      const lp = d.lportOfPhys[pk(dev, p)];
      const cfg = rt.running[dev].ifaces[p];
      let status = ps.adminDown ? "disabled" : ps.errDisabled ? "err-disabled" : ps.up ? "connected" : "notconnect";
      if (ps.ec?.flag === "s") status = "suspended";
      else if (lp && !lp.isPo && lp.status === "inactive") status = "inactive";
      const vlan = cfg.routed ? "routed" : lp && ps.up ? vlanCol(lp) : cfg.mode === "trunk" ? "trunk" : String(cfg.accessVlan);
      const fast = ifType(p)?.speed === 100;
      o.push(row(p, cfg.description, status, vlan, fast ? "a-100" : "a-1000", fast ? "10/100BaseTX" : "10/100/1000BaseTX", ps.up));
    }
    for (const lp of (d.lports[dev] ?? []).filter((x) => x.isPo)) {
      o.push(row(lp.name, lp.cfg.description, lp.status, lp.active ? vlanCol(lp) : "unassigned", lp.active ? "a-1000" : "auto", "", lp.active));
    }
    return o;
  }
  function trunkMode(c) {
    return c.mode === "trunk" ? "on" : c.mode === "dynamic-desirable" ? "desirable" : c.mode === "dynamic-auto" ? "auto" : "off";
  }
  function showIntTrunk(rt, dev) {
    const d = rt.derived;
    const trunks = (d.lports[dev] ?? []).filter((lp) => lp.active && lp.opMode === "trunk");
    if (!trunks.length) return [""];
    const c = rt.running[dev];
    const o = ["", "Port        Mode             Encapsulation  Status        Native vlan"];
    for (const lp of trunks)
      o.push(pad(shortIf(lp.name), 12) + pad(trunkMode(lp.cfg), 17) + pad("802.1q", 15) + pad("trunking", 14) + lp.cfg.nativeVlan);
    const allowedList = (lp) => lp.cfg.allowed === null ? "1-4094" : lp.cfg.allowed.length ? formatVlanList(lp.cfg.allowed) : "none";
    const active = (lp) => {
      const vs = Object.keys(c.vlans).map(Number).filter((v) => allows(lp.cfg, v) && vlanExists(c, v));
      return vs.length ? formatVlanList(vs) : "none";
    };
    const fwd = (lp) => {
      const vs = Object.keys(c.vlans).map(Number).filter((v) => egress(d, lp, v) && portForwards(d, dev, lp, v));
      return vs.length ? formatVlanList(vs) : "none";
    };
    o.push("", "Port        Vlans allowed on trunk");
    for (const lp of trunks) o.push(pad(shortIf(lp.name), 12) + allowedList(lp));
    o.push("", "Port        Vlans allowed and active in management domain");
    for (const lp of trunks) o.push(pad(shortIf(lp.name), 12) + active(lp));
    o.push("", "Port        Vlans in spanning tree forwarding state and not pruned");
    for (const lp of trunks) o.push(pad(shortIf(lp.name), 12) + fwd(lp));
    return o;
  }
  function showIntSwitchport(rt, dev, only) {
    const d = rt.derived;
    const sw = rt.topo.devices[dev];
    const c = rt.running[dev];
    const names = only ? [only] : [...sw.ports, ...Object.keys(c.pos).map((n) => "Port-channel" + n)];
    const o = [];
    for (const name of names) {
      const isPo = name.startsWith("Port-channel");
      const cfg = isPo ? c.pos[name.slice(12)] : c.ifaces[name];
      if (!cfg) continue;
      if (!isPo && c.ifaces[name].routed) {
        o.push(`Name: ${shortIf(name)}`, "Switchport: Disabled", "");
        continue;
      }
      const lp = d.lportByName[pk(dev, name)] ?? d.lportOfPhys[pk(dev, name)];
      const adminMode = cfg.mode === "access" ? "static access" : cfg.mode === "trunk" ? "trunk" : cfg.mode === "dynamic-auto" ? "dynamic auto" : "dynamic desirable";
      const up = !!lp?.active;
      const oper = !up ? "down" : lp.opMode === "trunk" ? "trunk" : "static access";
      const vname = (v) => vlanExists(c, v) ? c.vlans[String(v)] : "Inactive";
      o.push(
        `Name: ${shortIf(name)}`,
        "Switchport: Enabled",
        `Administrative Mode: ${adminMode}`,
        `Operational Mode: ${oper}`,
        "Administrative Trunking Encapsulation: " + (cfg.encapDot1q ? "dot1q" : rt.topo.devices[dev].needsEncap ? "negotiate" : "dot1q"),
        ...up && lp.opMode === "trunk" ? ["Operational Trunking Encapsulation: dot1q"] : [],
        `Negotiation of Trunking: ${cfg.nonegotiate ? "Off" : "On"}`,
        `Access Mode VLAN: ${cfg.accessVlan} (${vname(cfg.accessVlan)})`,
        `Trunking Native Mode VLAN: ${cfg.nativeVlan} (${vname(cfg.nativeVlan)})`,
        "Administrative Native VLAN tagging: enabled",
        "Voice VLAN: none",
        `Trunking VLANs Enabled: ${cfg.allowed === null ? "ALL" : cfg.allowed.length ? formatVlanList(cfg.allowed) : "NONE"}`,
        "Pruning VLANs Enabled: 2-1001",
        "Capture Mode Disabled",
        "Capture VLANs Allowed: ALL",
        "",
        "Protected: false",
        "Unknown unicast blocked: disabled",
        "Unknown multicast blocked: disabled",
        "Appliance trust: none",
        ""
      );
    }
    return o;
  }
  function showIpIntBrief(rt, dev) {
    const d = rt.derived;
    const sw = rt.topo.devices[dev];
    const c = rt.running[dev];
    const o = ["Interface              IP-Address      OK? Method Status                Protocol"];
    const row = (n, ip, status, proto) => pad(n, 23) + pad(ip, 16) + "YES " + pad(ip === "unassigned" ? "unset" : "manual", 7) + pad(status, 22) + proto;
    for (const s of d.svis[dev] ?? [])
      o.push(row("Vlan" + s.vlan, s.ip ?? "unassigned", s.status, s.up ? "up" : "down"));
    for (const p of sw.ports) {
      const ps = d.phys[pk(dev, p)];
      const proto = ps.up && ps.ec?.flag !== "s" ? "up" : "down";
      const ip = c.ifaces[p].routed ? c.ifaces[p].ip?.addr ?? "unassigned" : "unassigned";
      o.push(row(p, ip, ps.adminDown ? "administratively down" : ps.up ? "up" : "down", proto));
    }
    for (const [n, l] of Object.entries(c.loopbacks ?? {}).sort((a, b) => Number(a[0]) - Number(b[0])))
      o.push(row("Loopback" + n, l.ip?.addr ?? "unassigned", l.shutdown ? "administratively down" : "up", l.shutdown ? "down" : "up"));
    for (const id of Object.keys(c.pos)) {
      const lp = d.lportByName[pk(dev, "Port-channel" + id)];
      o.push(row("Port-channel" + id, "unassigned", lp.cfg.shutdown ? "administratively down" : lp.active ? "up" : "down", lp.active ? "up" : "down"));
    }
    return o;
  }
  function showIpRoute(rt, dev, only) {
    const d = rt.derived;
    const c = rt.running[dev];
    const sw = rt.topo.devices[dev];
    if (!sw.l3 || !c.ipRouting) {
      return [c.defaultGateway ? `Default gateway is ${c.defaultGateway}` : "Default gateway is not set", "", "Host               Gateway           Last Use    Total Uses  Interface", "ICMP redirect cache is empty"];
    }
    const o = [
      "Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP",
      "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area",
      "       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2",
      "       E1 - OSPF external type 1, E2 - OSPF external type 2",
      "       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2",
      "       ia - IS-IS inter area, * - candidate default, U - per-user static route",
      "       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP",
      "       + - replicated route, % - next hop override",
      ""
    ];
    const all = routeTable(d, dev);
    const def = all.find((e) => e.prefix === 0);
    o.push(def ? `Gateway of last resort is ${def.nh} to network 0.0.0.0` : "Gateway of last resort is not set", "");
    const keep = (e) => !only || (only === "C" ? e.code === "C" || e.code === "L" : e.code.startsWith(only));
    const line = (e, codeCol, width = 9) => {
      const head = `${codeCol.padEnd(width)}${e.net}/${e.prefix}`;
      if (e.code === "S") return [`${head} [1/0] via ${e.nh}`];
      if (e.code === "C" || e.code === "L") return [`${head} is directly connected, ${e.ifname}`];
      const paths = e.paths ?? [{ nh: e.nh, ifname: e.ifname }];
      const pad0 = " ".repeat(head.length + 1);
      return paths.map((p, i) => `${i === 0 ? head + " " : pad0}[110/${e.metric}] via ${p.nh}, 00:12:34, ${p.ifname}`);
    };
    if (def && keep(def)) o.push(...line(def, def.code === "S" ? "S*" : def.code === "O E2" ? "O*E2" : def.code === "O IA" ? "O*IA" : def.code + "*", 6));
    const sorted = all.filter((e) => e !== def && keep(e)).sort((a, b) => a.net.localeCompare(b.net, void 0, { numeric: true }) || a.prefix - b.prefix);
    const majors = /* @__PURE__ */ new Map();
    for (const e of sorted) {
      const parts = e.net.split(".");
      const first = Number(parts[0]);
      const cls = first < 128 ? `${parts[0]}.0.0.0/8` : first < 192 ? `${parts[0]}.${parts[1]}.0.0/16` : `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      majors.set(cls, [...majors.get(cls) ?? [], e]);
    }
    for (const [cls, list] of majors) {
      const masks = new Set(list.map((e) => e.prefix)).size;
      o.push(masks > 1 ? `      ${cls} is variably subnetted, ${list.length} subnets, ${masks} masks` : `      ${cls.split("/")[0]}/${list[0].prefix} is subnetted, ${list.length} subnets`);
      for (const e of list) o.push(...line(e, e.code));
    }
    return o;
  }
  function showIpRouteFor(rt, dev, ip) {
    const c = rt.running[dev];
    const sw = rt.topo.devices[dev];
    if (!sw.l3 || !c.ipRouting) return ["% Network not in table"];
    const dn = ipToInt(ip);
    let best = null;
    const rank = (e2) => e2.code === "C" || e2.code === "L" ? 0 : e2.code === "S" ? 1 : 2;
    for (const e2 of routeTable(rt.derived, dev)) {
      if (e2.code === "L") continue;
      const m = prefixMaskInt(e2.prefix);
      if ((dn & m) >>> 0 !== (ipToInt(e2.net) & m) >>> 0) continue;
      if (best && (best.prefix > e2.prefix || best.prefix === e2.prefix && rank(best) <= rank(e2))) continue;
      best = e2;
    }
    if (!best) return ["% Network not in table"];
    const e = best;
    const o = [`Routing entry for ${e.net}/${e.prefix}${e.prefix === 0 ? ", supernet" : ""}`];
    if (e.code === "C") {
      o.push('  Known via "connected", distance 0, metric 0 (connected, via interface)', "  Routing Descriptor Blocks:", `  * directly connected, via ${e.ifname}`, "      Route metric is 0, traffic share count is 1");
      return o;
    }
    if (e.code === "S") {
      o.push('  Known via "static", distance 1, metric 0' + (e.prefix === 0 ? ", candidate default path" : ""), "  Routing Descriptor Blocks:", `  * ${e.nh}`, "      Route metric is 0, traffic share count is 1");
      return o;
    }
    const type = e.code === "O" ? "intra area" : e.code === "O IA" ? "inter area" : "extern 2, forward metric 1";
    const pid = rt.derived.ospf[dev]?.pid ?? 1;
    o.push(`  Known via "ospf ${pid}", distance 110, metric ${e.metric}, type ${type}${e.prefix === 0 ? ", candidate default path" : ""}`);
    o.push(`  Last update from ${e.nh} on ${e.ifname}, 00:12:34 ago`, "  Routing Descriptor Blocks:");
    (e.paths ?? []).forEach((p, i) => o.push(`  ${i === 0 ? "*" : " "} ${p.nh}, 00:12:34 ago, via ${p.ifname}`, `      Route metric is ${e.metric}, traffic share count is 1`));
    return o;
  }
  var ospfOf = (rt, dev) => rt.derived.ospf[dev];
  var noOspf = ["%OSPF: Router process not running"];
  var roleShort = (r) => r === "DROTHER" ? "DROTH" : r;
  function showOspfNbr(rt, dev) {
    const s = ospfOf(rt, dev);
    if (!s) return [];
    const o = ["", "Neighbor ID     Pri   State           Dead Time   Address         Interface"];
    for (const n of s.nbrs) {
      const i = s.ifs.find((x) => x.name === n.ifname);
      const st = `${n.state}/${n.role === "-" ? " -" : n.role}`;
      o.push(pad(n.rid, 16) + padL(n.prio, 3) + "   " + pad(st, 16) + pad(`00:00:${String(Math.min(59, i.dead - 5)).padStart(2, "0")}`, 12) + pad(n.ip, 16) + n.ifname);
    }
    return o;
  }
  function showOspfIfBrief(rt, dev) {
    const s = ospfOf(rt, dev);
    if (!s) return noOspf;
    const o = ["Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C"];
    for (const i of s.ifs) {
      const nb = s.nbrs.filter((n) => n.ifname === i.name);
      const f = nb.filter((n) => n.state === "FULL").length;
      o.push(pad(shortIf(i.name), 13) + pad(s.pid, 6) + pad(i.area, 16) + pad(`${i.ip}/${i.prefix}`, 19) + pad(i.cost, 6) + pad(roleShort(i.role), 6) + `${f}/${nb.length}`);
    }
    return o;
  }
  function showOspfIf(rt, dev, only) {
    const s = ospfOf(rt, dev);
    if (!s) return noOspf;
    const c = rt.running[dev].ospf;
    const ifs = s.ifs.filter((i) => !only || i.name === only);
    if (only && !ifs.length) return [`%OSPF: OSPF not enabled on ${only}`];
    const o = [];
    for (const i of ifs) {
      const nb = s.nbrs.filter((n) => n.ifname === i.name);
      const full = nb.filter((n) => n.state === "FULL");
      const how = i.l3 && rt.running[dev].svis ? configuredArea(rt, dev, i.name) ? "Interface Config" : "Network Statement" : "Network Statement";
      o.push(
        `${i.name} is ${i.up ? "up" : "down"}, line protocol is ${i.up ? "up" : "down"} `,
        `  Internet Address ${i.ip}/${i.prefix}, Area ${i.area}, Attached via ${how}`,
        `  Process ID ${s.pid}, Router ID ${s.rid ?? "0.0.0.0"}, Network Type ${i.net === "point-to-point" ? "POINT_TO_POINT" : i.net === "loopback" ? "LOOPBACK" : "BROADCAST"}, Cost: ${i.cost}`
      );
      if (i.net === "loopback") {
        o.push("  Loopback interface is treated as a stub Host");
        continue;
      }
      if (!i.up) continue;
      o.push(`  Transmit Delay is 1 sec, State ${i.role === "P2P" ? "POINT_TO_POINT" : i.role}${i.net === "broadcast" ? `, Priority ${i.prio}` : ""}`);
      if (i.net === "broadcast") {
        if (i.dr) o.push(`  Designated Router (ID) ${i.dr.rid}, Interface address ${i.dr.ip}`);
        else o.push("  No designated router on this network");
        if (i.bdr) o.push(`  Backup Designated router (ID) ${i.bdr.rid}, Interface address ${i.bdr.ip}`);
        else o.push("  No backup designated router on this network");
      }
      o.push(`  Timer intervals configured, Hello ${i.hello}, Dead ${i.dead}, Wait ${i.dead}, Retransmit 5`);
      if (i.passive) {
        o.push("    No Hellos (Passive interface) ");
        continue;
      }
      o.push(`    Hello due in 00:00:0${Math.min(9, i.hello - 1)}`, `  Neighbor Count is ${nb.length}, Adjacent neighbor count is ${full.length} `);
      for (const n of full) o.push(`    Adjacent with neighbor ${n.rid}${n.role === "DR" ? "  (Designated Router)" : n.role === "BDR" ? "  (Backup Designated Router)" : ""}`);
      o.push("  Suppress hello for 0 neighbor(s)");
    }
    void c;
    return o;
  }
  function configuredArea(rt, dev, name) {
    const c = rt.running[dev];
    const opts = name.startsWith("Vlan") ? c.svis[name.slice(4)]?.l3 : name.startsWith("Loopback") ? c.loopbacks?.[name.slice(8)]?.l3 : c.ifaces[name]?.l3;
    return !!opts?.ospfArea;
  }
  function showIpOspf(rt, dev) {
    const s = ospfOf(rt, dev);
    if (!s) return noOspf;
    const c = rt.running[dev].ospf;
    if (!s.rid) return [`%OSPF-4-NORTRID: OSPF process ${s.pid} failed to allocate unique router-id and cannot start`];
    const o = [` Routing Process "ospf ${s.pid}" with ID ${s.rid}`, " Start time: 00:00:12.345, Time elapsed: 01:02:03.456", " Supports only single TOS(TOS0) routes", " Supports opaque LSA"];
    if (s.abr) o.push(" It is an area border router");
    if (s.asbr) o.push(" It is an autonomous system boundary router");
    o.push(" Router is not originating router-LSAs with maximum metric", ` Number of areas in this router is ${s.areas.length}. ${s.areas.filter((a) => !c.stubs[String(a)]).length} normal ${s.areas.filter((a) => c.stubs[String(a)]).length} stub 0 nssa`);
    o.push(` Reference bandwidth unit is ${c.refBw} mbps`);
    for (const a of s.areas) {
      const ifs = s.ifs.filter((i) => i.up && i.area === a);
      const loops = ifs.filter((i) => i.net === "loopback").length;
      o.push(`    Area ${a === 0 ? "BACKBONE(0)" : a}`, `        Number of interfaces in this area is ${ifs.length}${loops ? ` (${loops} loopback)` : ""}`);
      const st = c.stubs[String(a)];
      if (st) o.push(`        It is a stub area${st.noSummary ? ", no summary LSA in this area" : ""}`);
      if (st && s.abr) o.push("          generates stub default route with cost 1");
      o.push("        Area has no authentication");
    }
    return o;
  }
  function showIpProtocols(rt, dev) {
    const s = ospfOf(rt, dev);
    const c = rt.running[dev];
    if (!s || !c.ospf) return ["*** IP Routing is NSF aware ***", ""];
    const r = c.ospf;
    const o = ["*** IP Routing is NSF aware ***", "", `Routing Protocol is "ospf ${s.pid}"`, "  Outgoing update filter list for all interfaces is not set", "  Incoming update filter list for all interfaces is not set", `  Router ID ${s.rid ?? "0.0.0.0"}`];
    if (s.abr) o.push("  It is an area border router");
    if (s.asbr) o.push("  It is an autonomous system boundary router");
    o.push(`  Number of areas in this router is ${s.areas.length}. ${s.areas.filter((a) => !r.stubs[String(a)]).length} normal ${s.areas.filter((a) => r.stubs[String(a)]).length} stub 0 nssa`, "  Maximum path: 4", "  Routing for Networks:");
    for (const n of r.networks) o.push(`    ${n.addr} ${n.wildcard} area ${n.area}`);
    const explicit = s.ifs.filter((i) => configuredArea(rt, dev, i.name));
    if (explicit.length) {
      o.push("  Routing on Interfaces Configured Explicitly:");
      for (const i of explicit) o.push(`    ${i.name}`);
    }
    const passive = s.ifs.filter((i) => i.passive).map((i) => i.name);
    if (passive.length) {
      o.push("  Passive Interface(s):");
      for (const p of passive) o.push(`    ${p}`);
    }
    o.push("  Routing Information Sources:", "    Gateway         Distance      Last Update");
    const srcs = /* @__PURE__ */ new Set();
    for (const dv of Object.keys(rt.derived.ospf)) if (dv !== dev && rt.derived.ospf[dv].rid) srcs.add(rt.derived.ospf[dv].rid);
    const used = new Set(s.nbrs.filter((n) => n.state === "FULL").map((n) => n.rid));
    for (const rid of [...srcs].filter((x) => used.has(x) || s.routes.length).sort()) o.push(`    ${pad(rid, 16)}${padL(110, 8)}      00:12:34`);
    o.push("  Distance: (default is 110)", "");
    return o;
  }
  function showErrDisabled(rt, dev) {
    const d = rt.derived;
    const sw = rt.topo.devices[dev];
    const o = ["", "Port      Name               Status       Reason               Err-disabled Vlans"];
    for (const p of sw.ports) {
      if (!d.phys[pk(dev, p)]?.errDisabled) continue;
      o.push(pad(shortIf(p), 10) + pad(rt.running[dev].ifaces[p].description.slice(0, 18), 19) + pad("err-disabled", 13) + "bpduguard");
    }
    return o;
  }
  function showErrRecovery(rt, dev) {
    const c = rt.running[dev];
    const sw = rt.topo.devices[dev];
    const o = ["ErrDisable Reason            Timer Status", "-----------------            --------------"];
    for (const r of ["arp-inspection", "bpduguard", "channel-misconfig (STP)", "dhcp-rate-limit", "link-flap", "psecure-violation", "udld"])
      o.push(pad(r, 29) + (r === "bpduguard" && c.errRecoveryBpdu ? "Enabled" : "Disabled"));
    o.push("", `Timer interval: ${c.errRecoveryInterval ?? 300} seconds`, "", "Interfaces that will be enabled at the next timeout:", "");
    if (c.errRecoveryBpdu) {
      const ports2 = sw.ports.filter((p) => rt.derived.phys[pk(dev, p)]?.errDisabled);
      if (ports2.length) {
        o.push("Interface       Errdisable reason       Time left(sec)", "---------       -----------------       --------------");
        for (const p of ports2) o.push(pad(shortIf(p), 16) + pad("bpduguard", 24) + (c.errRecoveryInterval ?? 300));
      }
    }
    void bpduGuardOn;
    return o;
  }
  var fmtBid = (mac) => mac;
  function showSpanningTree(rt, dev, only) {
    const d = rt.derived;
    const c = rt.running[dev];
    const vlans = Object.keys(d.stp).map(Number).filter((v) => d.stp[v][dev] && (only === void 0 || v === only));
    if (only !== void 0 && !vlans.length) return [`Spanning tree instance(s) for vlan ${only} does not exist.`];
    if (!vlans.length) return ["No spanning tree instance exists."];
    const o = [];
    for (const v of vlans) {
      const b = d.stp[v][dev];
      const ports2 = Object.entries(b.ports);
      if (!ports2.length && only === void 0) continue;
      const sysPrio = b.prio;
      const rootPortLp = b.rootPort ? d.lportByName[pk(dev, b.rootPort)] : null;
      o.push("", `VLAN${String(v).padStart(4, "0")}`, `  Spanning tree enabled protocol ${c.stpMode === "rapid-pvst" ? "rstp" : "ieee"}`);
      o.push(`  Root ID    Priority    ${b.rootPrio}`, `             Address     ${fmtBid(b.rootMac)}`);
      if (b.isRoot) o.push("             This bridge is the root");
      else o.push(`             Cost        ${b.rootCost}`, `             Port        ${rootPortLp?.portNum ?? 0} (${b.rootPort})`);
      o.push("             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec", "");
      o.push(`  Bridge ID  Priority    ${sysPrio}  (priority ${sysPrio - v} sys-id-ext ${v})`, `             Address     ${b.mac}`);
      o.push("             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec", "             Aging Time  300 sec", "");
      o.push("Interface           Role Sts Cost      Prio.Nbr Type", "------------------- ---- --- --------- -------- --------------------------------");
      const sw = rt.topo.devices[dev];
      const order = (n) => n.startsWith("Port-channel") ? 1e3 + Number(n.slice(12)) : sw.ports.indexOf(n);
      for (const [name, p] of ports2.sort((a, b2) => order(a[0]) - order(b2[0]))) {
        const type = (p.edge ? "P2p Edge" : "P2p") + (p.inconsistent ? " *PVID_Inc" : "");
        o.push(pad(shortIf(name), 20) + pad(p.role, 5) + pad(p.state === "BKN" ? "BKN*" : p.state, 4) + pad(p.cost, 10) + pad("128." + p.portNum, 9) + type);
      }
    }
    return o;
  }
  function showEtherchannelSummary(rt, dev) {
    const groups = rt.derived.ec[dev] ?? [];
    const o = [
      "Flags:  D - down        P - bundled in port-channel",
      "        I - stand-alone s - suspended",
      "        H - Hot-standby (LACP only)",
      "        R - Layer3      S - Layer2",
      "        U - in use      f - failed to allocate aggregator",
      "",
      "        M - not in use, minimum links not met",
      "        u - unsuitable for bundling",
      "        w - waiting to be aggregated",
      "        d - default port",
      "",
      "",
      `Number of channel-groups in use: ${groups.length}`,
      `Number of aggregators:           ${groups.length}`,
      "",
      "Group  Port-channel  Protocol    Ports",
      "------+-------------+-----------+-----------------------------------------------"
    ];
    for (const g of groups) {
      const po = `Po${g.id}(S${g.up ? "U" : "D"})`;
      const members = g.members.map((m) => `${shortIf(m.port)}(${m.flag})`).join(" ");
      o.push(pad(g.id, 7) + pad(po, 14) + pad(g.protocol, 12) + members);
    }
    return o;
  }
  function showMac(rt, dev) {
    const d = rt.derived;
    const sw = rt.topo.devices[dev];
    const o = ["          Mac Address Table", "-------------------------------------------", "", "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----"];
    o.push(" All    0100.0ccc.cccc    STATIC      CPU", " All    0100.0ccc.cccd    STATIC      CPU", " All    0180.c200.0000    STATIC      CPU");
    const entries = macTable(d, dev, rt.seen);
    for (const e of entries) o.push(padL(e.vlan, 4) + "    " + pad(e.mac, 18) + pad("DYNAMIC", 12) + shortIf(e.port));
    o.push(`Total Mac Addresses for this criterion: ${entries.length + 3}`);
    void sw;
    return o;
  }
  function showCdp(rt, dev) {
    const d = rt.derived;
    const sw = rt.topo.devices[dev];
    const o = [
      "Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge",
      "                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone,",
      "                  D - Remote, C - CVTA, M - Two-port Mac Relay",
      "",
      "Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID"
    ];
    for (const p of sw.ports) {
      const ps = d.phys[pk(dev, p)];
      if (!ps.up || !ps.peer || ps.peerIsPc) continue;
      const peer = rt.topo.devices[ps.peer.dev];
      const caps = peer.l3 ? "R S I" : "S I";
      o.push(pad(rt.hostname(peer.id), 17) + pad(shortIf(p).replace(/^(\w\w)/, "$1 "), 18) + pad("163", 11) + pad(caps, 12) + pad(peer.model.split(" ")[0].slice(0, 9), 10) + shortIf(ps.peer.port).replace(/^(\w\w)/, "$1 "));
    }
    const n = o.length - 5;
    o.push("", `Total cdp entries displayed : ${n}`);
    return o;
  }
  function showVersion(rt, dev) {
    const sw = rt.topo.devices[dev];
    const fa = sw.ports.filter((p) => p.startsWith("Fast")).length;
    const gi = sw.ports.filter((p) => p.startsWith("Gigabit")).length;
    return [
      `Cisco IOS Software, ${sw.model} Software (Labber Simulated), Version 15.2(7)E, RELEASE SOFTWARE`,
      "Technical Support: http://www.cisco.com/techsupport",
      "",
      "ROM: Bootstrap program is simulated",
      "",
      `${rt.hostname(dev)} uptime is 1 hour, 2 minutes`,
      'System image file is "flash:labber-sim.bin"',
      "",
      `cisco ${sw.model} (simulated) processor with 524288K bytes of memory.`,
      ...fa ? [`${fa} FastEthernet interfaces`] : [],
      ...gi ? [`${gi} Gigabit Ethernet interfaces`] : [],
      "",
      `Base ethernet MAC Address       : ${sw.mac.replace(/\./g, "").match(/../g).join(":").toUpperCase()}`,
      `Model number                    : ${sw.model}`,
      "",
      "Configuration register is 0xF"
    ];
  }
  function showInterface(rt, dev, name) {
    const d = rt.derived;
    if (name.startsWith("Loopback")) {
      const l = rt.running[dev].loopbacks?.[name.slice(8)];
      if (!l) return [];
      const st = l.shutdown ? "administratively down" : "up";
      return [
        `${name} is ${st}, line protocol is ${l.shutdown ? "down" : "up"} `,
        "  Hardware is Loopback",
        ...l.description ? [`  Description: ${l.description}`] : [],
        ...l.ip ? [`  Internet address is ${l.ip.addr}/${maskToPrefix(l.ip.mask)}`] : [],
        "  MTU 1514 bytes, BW 8000000 Kbit/sec, DLY 5000 usec,",
        "  Encapsulation LOOPBACK, loopback not set"
      ];
    }
    if (name.startsWith("Vlan")) {
      const v = Number(name.slice(4));
      const s = d.svis[dev]?.find((x) => x.vlan === v);
      if (!s) return ["                                                   ^", "% Invalid input detected at '^' marker."];
      return [
        `${name} is ${s.status}, line protocol is ${s.up ? "up" : "down"}`,
        `  Hardware is EtherSVI, address is ${s.mac} (bia ${s.mac})`,
        ...s.ip ? [`  Internet address is ${s.ip}/${maskToPrefix(s.mask)}`] : [],
        "  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,",
        "  Encapsulation ARPA, loopback not set"
      ];
    }
    const lp = d.lportByName[pk(dev, name)];
    const ps = d.phys[pk(dev, name)];
    const isPo = name.startsWith("Port-channel");
    if (!lp && !ps) return [];
    const sw = rt.topo.devices[dev];
    const admin = isPo ? lp.cfg.shutdown : ps.adminDown;
    const up = isPo ? lp.active : ps.up;
    const proto = isPo ? lp.active : ps.up && ps.ec?.flag !== "s";
    const idx = isPo ? 60 + Number(name.slice(12)) : sw.ports.indexOf(name) + 1;
    const mac = macAdd(sw.mac, idx);
    const speed = isPo ? (lp.members.length * 1e3 || 1e3) * 1e3 : (ifType(name)?.speed ?? 100) * 1e3;
    const out = [
      `${name} is ${admin ? "administratively down" : up ? "up" : "down"}, line protocol is ${proto ? "up (connected)" : admin ? "down (disabled)" : ps?.errDisabled ? "down (err-disabled)" : ps?.ec?.flag === "s" ? "down (suspended)" : "down (notconnect)"}`,
      `  Hardware is ${isPo ? "EtherChannel" : ifType(name)?.speed === 100 ? "Fast Ethernet" : "Gigabit Ethernet"}, address is ${mac} (bia ${mac})`
    ];
    const desc = isPo ? lp.cfg.description : rt.running[dev].ifaces[name]?.description;
    if (desc) out.push(`  Description: ${desc}`);
    const rip = !isPo ? rt.running[dev].ifaces[name]?.ip : null;
    if (rip && rt.running[dev].ifaces[name]?.routed) out.push(`  Internet address is ${rip.addr}/${maskToPrefix(rip.mask)}`);
    out.push(`  MTU 1500 bytes, BW ${speed} Kbit/sec, DLY 100 usec,`, "     reliability 255/255, txload 1/255, rxload 1/255", "  Encapsulation ARPA, loopback not set");
    if (isPo) out.push(`  Members in this channel: ${lp.members.map(shortIf).join(" ") || "none"}`);
    else if (ps?.ec) out.push(`  Member of Port-channel${ps.ec.id} (${ps.ec.flag})`);
    return out;
  }

  // src/sim/cli/ios.ts
  var CliError = class {
    constructor(lines) {
      this.lines = lines;
    }
  };
  var InvalidAt = class {
    constructor(argIndex) {
      this.argIndex = argIndex;
    }
  };
  var ALL_VLANS = Array.from({ length: 4094 }, (_, i) => i + 1);
  var protoOf2 = (m) => m === "on" ? "on" : m === "active" || m === "passive" ? "LACP" : "PAgP";
  var showPatterns = (privOnly) => {
    const s = [
      { p: "show version", run: (x) => showVersion(x.rt, x.dev) },
      { p: "show vlan", run: (x) => showVlan(x.rt, x.dev, false) },
      { p: "show vlan brief", run: (x) => showVlan(x.rt, x.dev, true) },
      { p: "show interfaces", run: (x) => x.allInterfaces() },
      { p: "show interfaces status", run: (x) => showIntStatus(x.rt, x.dev) },
      { p: "show interfaces trunk", run: (x) => showIntTrunk(x.rt, x.dev) },
      { p: "show interfaces switchport", run: (x) => showIntSwitchport(x.rt, x.dev) },
      { p: "show interfaces <if>", run: (x, a) => x.showOneIf(a, false) },
      { p: "show interfaces <if> switchport", run: (x, a) => x.showOneIf(a, true), ifTypes: ["FastEthernet", "GigabitEthernet", "Port-channel"] },
      { p: "show ip interface brief", run: (x) => showIpIntBrief(x.rt, x.dev) },
      { p: "show ip route", run: (x) => showIpRoute(x.rt, x.dev) },
      { p: "show ip route ospf", run: (x) => showIpRoute(x.rt, x.dev, "O") },
      { p: "show ip route <A.B.C.D:Network to display information about or host>", run: (x, a) => showIpRouteFor(x.rt, x.dev, a[3]) },
      { p: "show ip route static", run: (x) => showIpRoute(x.rt, x.dev, "S") },
      { p: "show ip route connected", run: (x) => showIpRoute(x.rt, x.dev, "C") },
      { p: "show ip ospf", run: (x) => showIpOspf(x.rt, x.dev) },
      { p: "show ip ospf neighbor", run: (x) => showOspfNbr(x.rt, x.dev) },
      { p: "show ip ospf interface", run: (x) => showOspfIf(x.rt, x.dev) },
      { p: "show ip ospf interface brief", run: (x) => showOspfIfBrief(x.rt, x.dev) },
      { p: "show ip ospf interface <if>", run: (x, a) => showOspfIf(x.rt, x.dev, x.resolveName(a[4], a[5], 4)), ifTypes: ["FastEthernet", "GigabitEthernet", "Vlan", "Loopback"] },
      { p: "show ip protocols", run: (x) => showIpProtocols(x.rt, x.dev) },
      { p: "show interfaces status err-disabled", run: (x) => showErrDisabled(x.rt, x.dev) },
      { p: "show errdisable recovery", run: (x) => showErrRecovery(x.rt, x.dev) },
      { p: "show ip arp", run: (x) => x.showArp() },
      { p: "show spanning-tree", run: (x) => showSpanningTree(x.rt, x.dev) },
      { p: "show spanning-tree vlan <1-4094:VLAN Switch Spanning Trees>", run: (x, a) => showSpanningTree(x.rt, x.dev, Number(a[3])) },
      { p: "show etherchannel summary", run: (x) => showEtherchannelSummary(x.rt, x.dev) },
      { p: "show mac address-table", run: (x) => showMac(x.rt, x.dev) },
      { p: "show cdp neighbors", run: (x) => showCdp(x.rt, x.dev) },
      { p: "show history", run: (x) => x.history.slice(-20).map((h) => "  " + h) }
    ];
    if (privOnly) {
      s.push(
        { p: "show running-config", run: (x) => showRun(x.rt, x.dev, "running") },
        { p: "show running-config interface <if>", run: (x, a) => x.showRunIf(a) },
        { p: "show startup-config", run: (x) => showRun(x.rt, x.dev, "startup") }
      );
    }
    return s;
  };
  var userPatterns = [
    { p: "enable", run: (x) => void (x.mode = "priv") },
    { p: "exit", run: (x) => x.logout() },
    { p: "logout", run: (x) => x.logout() },
    { p: "ping <A.B.C.D:Ping destination address>", run: (x, a) => x.ping(a[1]) },
    { p: "traceroute <A.B.C.D:Trace route to destination address>", run: (x, a) => x.traceroute(a[1]) },
    { p: "terminal length <0-512:Number of lines on screen (0 for no pausing)>", run: () => {
    } },
    ...showPatterns(false)
  ];
  var privPatterns = [
    ...userPatterns.filter((p) => p.p !== "enable" && !p.p.startsWith("show")),
    { p: "enable", run: () => {
    } },
    { p: "disable", run: (x) => void (x.mode = "user") },
    { p: "configure terminal", run: (x) => x.enterConfig() },
    {
      p: "configure",
      run: (x) => x.ask(
        "Configuring from terminal, memory, or network [terminal]? ",
        (ans) => ans.trim() === "" || "terminal".startsWith(ans.trim().toLowerCase()) ? x.enterConfig() ?? [] : ['?Must be "terminal", "memory" or "network"']
      )
    },
    { p: "write", run: (x) => x.save() },
    { p: "write memory", run: (x) => x.save() },
    { p: "write erase", run: (x) => x.erase() },
    {
      p: "copy running-config startup-config",
      run: (x) => x.ask("Destination filename [startup-config]? ", () => x.save())
    },
    { p: "erase startup-config", run: (x) => x.erase() },
    { p: "reload", run: (x) => x.reload() },
    {
      p: "clear mac address-table dynamic",
      run: (x) => {
        x.rt.seen.clear();
        x.rt.emit();
      }
    },
    {
      p: "clear ip ospf process",
      run: (x) => x.clearOspf()
    },
    {
      p: "clear arp-cache",
      run: (x) => {
        for (const k of [...x.rt.arp]) if (k.startsWith(x.dev + ">")) x.rt.arp.delete(k);
      }
    },
    ...showPatterns(true)
  ];
  var commonSub = [
    { p: "exit", run: (x) => x.exitMode() },
    { p: "end", run: (x) => x.end() },
    { p: "do <LINE:Exec Command>", run: (x, a) => x.doCmd(a[1]) }
  ];
  var configPatterns = (def) => {
    const p = [
      ...commonSub,
      {
        p: "hostname <WORD:This system's network name>",
        run: (x, a) => {
          if (!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(a[1])) return ["% Hostname contains one or more illegal characters."];
          x.cfg.hostname = a[1];
        }
      },
      { p: "vlan <vlist:ISL VLAN IDs 1-4094>", run: (x, a) => x.enterVlan(a[1]) },
      { p: "no vlan <vlist:ISL VLAN IDs 1-4094>", run: (x, a) => x.deleteVlan(a[2]) },
      { p: "interface <if>", run: (x, a) => x.enterIf(a[1], a[2]) },
      { p: "interface range <LINE:Interface range, e.g. fa0/1 - 4, gi0/1>", run: (x, a) => x.enterRange(a[2]) },
      { p: "no interface <if>", run: (x, a) => x.deleteIf(a[2], a[3]), ifTypes: ["Port-channel", "Vlan", "Loopback"] },
      { p: "spanning-tree mode pvst", run: (x) => void (x.cfg.stpMode = "pvst") },
      { p: "spanning-tree mode rapid-pvst", run: (x) => void (x.cfg.stpMode = "rapid-pvst") },
      { p: "no spanning-tree mode", run: (x) => void (x.cfg.stpMode = "pvst") },
      { p: "spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> priority <0-61440:bridge priority in increments of 4096>", run: (x, a) => x.stpPriority(a[2], Number(a[4])) },
      { p: "spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> root primary", run: (x, a) => x.stpRoot(a[2], "primary") },
      { p: "spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> root secondary", run: (x, a) => x.stpRoot(a[2], "secondary") },
      { p: "no spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> priority", run: (x, a) => x.stpClear(a[3]) },
      { p: "no spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> priority <0-61440:bridge priority>", run: (x, a) => x.stpClear(a[3]) },
      { p: "no spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> root", run: (x, a) => x.stpClear(a[3]) },
      { p: "ip default-gateway <A.B.C.D:IP address of default gateway>", run: (x, a) => void (x.cfg.defaultGateway = a[2]) },
      { p: "no ip default-gateway", run: (x) => void (x.cfg.defaultGateway = null) },
      { p: "no ip domain-lookup", run: () => {
      } },
      { p: "ip domain-lookup", run: () => {
      } },
      { p: "spanning-tree portfast bpduguard default", run: (x) => void (x.cfg.bpduguardDefault = true) },
      { p: "no spanning-tree portfast bpduguard default", run: (x) => void (x.cfg.bpduguardDefault = false) },
      { p: "no spanning-tree portfast bpduguard", run: (x) => void (x.cfg.bpduguardDefault = false) },
      { p: "errdisable recovery cause bpduguard", run: (x) => void (x.cfg.errRecoveryBpdu = true) },
      { p: "no errdisable recovery cause bpduguard", run: (x) => void (x.cfg.errRecoveryBpdu = false) },
      { p: "errdisable recovery interval <30-86400:timer-interval(sec)>", run: (x, a) => void (x.cfg.errRecoveryInterval = Number(a[3])) },
      { p: "no errdisable recovery interval", run: (x) => void delete x.cfg.errRecoveryInterval }
    ];
    if (def.l3) {
      p.push(
        { p: "ip routing", run: (x) => void (x.cfg.ipRouting = true) },
        {
          p: "no ip routing",
          run: (x) => {
            x.cfg.ipRouting = false;
            x.cfg.ospf = null;
          }
        },
        { p: "router ospf <1-65535:Process ID>", run: (x, a) => x.enterOspf(Number(a[2])) },
        {
          p: "no router ospf <1-65535:Process ID>",
          run: (x, a) => {
            if (x.cfg.ospf?.pid === Number(a[3])) x.cfg.ospf = null;
          }
        },
        { p: "ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router's address>", run: (x, a) => x.addRoute(a[2], a[3], a[4]) },
        {
          p: "no ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router's address>",
          run: (x, a) => {
            x.cfg.routes = x.cfg.routes.filter((r) => !(r.net === a[3] && r.mask === a[4] && r.nh === a[5]));
          }
        }
      );
    }
    return p;
  };
  var l3OptPatterns = [
    { p: "ip ospf cost <1-65535:Cost>", run: (x, a) => x.eachL3((o) => void (o.ospfCost = Number(a[3]))) },
    { p: "no ip ospf cost", run: (x) => x.eachL3((o) => void delete o.ospfCost) },
    { p: "ip ospf hello-interval <1-65535:Seconds>", run: (x, a) => x.eachL3((o) => void (o.ospfHello = Number(a[3]))) },
    { p: "no ip ospf hello-interval", run: (x) => x.eachL3((o) => void delete o.ospfHello) },
    { p: "ip ospf dead-interval <1-65535:Seconds>", run: (x, a) => x.eachL3((o) => void (o.ospfDead = Number(a[3]))) },
    { p: "no ip ospf dead-interval", run: (x) => x.eachL3((o) => void delete o.ospfDead) },
    { p: "ip ospf priority <0-255:Priority>", run: (x, a) => x.eachL3((o) => void (o.ospfPrio = Number(a[3]))) },
    { p: "no ip ospf priority", run: (x) => x.eachL3((o) => void delete o.ospfPrio) },
    { p: "ip ospf network point-to-point", run: (x) => x.eachL3((o) => void (o.ospfNet = "point-to-point")) },
    { p: "ip ospf network broadcast", run: (x) => x.eachL3((o) => void (o.ospfNet = "broadcast")) },
    { p: "no ip ospf network", run: (x) => x.eachL3((o) => void delete o.ospfNet) },
    { p: "ip ospf <1-65535:Process ID> area <0-4294967295:OSPF area ID as a decimal value>", run: (x, a) => x.eachL3((o) => void (o.ospfArea = { pid: Number(a[2]), area: Number(a[4]) })) },
    { p: "no ip ospf <1-65535:Process ID> area <0-4294967295:OSPF area ID as a decimal value>", run: (x) => x.eachL3((o) => void delete o.ospfArea) },
    { p: "ip mtu <68-1500:MTU (bytes)>", run: (x, a) => x.eachL3((o) => void (o.mtu = Number(a[2]))) },
    { p: "no ip mtu", run: (x) => x.eachL3((o) => void delete o.mtu) },
    { p: "bandwidth <1-10000000:Bandwidth in kilobits>", run: (x, a) => x.eachL3((o) => void (o.bandwidth = Number(a[1]))) },
    { p: "no bandwidth", run: (x) => x.eachL3((o) => void delete o.bandwidth) }
  ];
  var routerPatterns = [
    ...[
      { p: "exit", run: (x) => x.exitMode() },
      { p: "end", run: (x) => x.end() },
      { p: "do <LINE:Exec Command>", run: (x, a) => x.doCmd(a[1]) }
    ],
    { p: "router-id <A.B.C.D:OSPF router-id in IP address format>", run: (x, a) => x.routerId(a[1]) },
    { p: "no router-id", run: (x) => x.routerId(null) },
    {
      p: "network <A.B.C.D:Network number> <A.B.C.D:OSPF wild card bits> area <0-4294967295:OSPF area ID as a decimal value>",
      run: (x, a) => {
        const o = x.ospf;
        const n = { addr: a[1], wildcard: a[2], area: Number(a[4]) };
        const same = o.networks.find((m) => m.addr === n.addr && m.wildcard === n.wildcard);
        if (same && same.area !== n.area) return [`% OSPF: "network ${n.addr} ${n.wildcard} area ${same.area}" is already configured`];
        if (!same) o.networks.push(n);
      }
    },
    {
      p: "no network <A.B.C.D:Network number> <A.B.C.D:OSPF wild card bits> area <0-4294967295:OSPF area ID as a decimal value>",
      run: (x, a) => {
        x.ospf.networks = x.ospf.networks.filter((m) => !(m.addr === a[2] && m.wildcard === a[3] && m.area === Number(a[5])));
      }
    },
    { p: "passive-interface default", run: (x) => void Object.assign(x.ospf, { passiveDefault: true, passive: [] }) },
    { p: "no passive-interface default", run: (x) => void Object.assign(x.ospf, { passiveDefault: false, passive: [] }) },
    { p: "passive-interface <if>", run: (x, a) => x.passive(x.resolveName(a[1], a[2], 1), true), ifTypes: ["FastEthernet", "GigabitEthernet", "Vlan", "Loopback"] },
    { p: "no passive-interface <if>", run: (x, a) => x.passive(x.resolveName(a[2], a[3], 2), false), ifTypes: ["FastEthernet", "GigabitEthernet", "Vlan", "Loopback"] },
    {
      p: "auto-cost reference-bandwidth <1-4294967:The reference bandwidth in terms of Mbits per second>",
      run: (x, a) => {
        x.ospf.refBw = Number(a[2]);
        return ["% OSPF: Reference bandwidth is changed.", "        Please ensure reference bandwidth is consistent across all routers."];
      }
    },
    { p: "no auto-cost reference-bandwidth", run: (x) => void (x.ospf.refBw = 100) },
    { p: "default-information originate", run: (x) => void (x.ospf.defaultOriginate = { always: false }) },
    { p: "default-information originate always", run: (x) => void (x.ospf.defaultOriginate = { always: true }) },
    { p: "no default-information originate", run: (x) => void (x.ospf.defaultOriginate = null) },
    { p: "area <0-4294967295:OSPF area ID as a decimal value> stub", run: (x, a) => x.stubArea(Number(a[1]), false) },
    { p: "area <0-4294967295:OSPF area ID as a decimal value> stub no-summary", run: (x, a) => x.stubArea(Number(a[1]), true) },
    {
      p: "no area <0-4294967295:OSPF area ID as a decimal value> stub",
      run: (x, a) => void delete x.ospf.stubs[a[2]]
    },
    {
      p: "no area <0-4294967295:OSPF area ID as a decimal value> stub no-summary",
      run: (x, a) => {
        const st = x.ospf.stubs[a[2]];
        if (st) st.noSummary = false;
      }
    }
  ];
  var l2IfPatterns = (def) => {
    const p = [
      ...commonSub,
      { p: "shutdown", run: (x) => x.eachL2((c) => void (c.shutdown = true)) },
      { p: "no shutdown", run: (x) => x.eachL2((c) => void (c.shutdown = false)) },
      { p: "description <LINE:Up to 240 characters describing this interface>", run: (x, a) => x.eachL2((c) => void (c.description = a[1].slice(0, 240)), false) },
      { p: "no description", run: (x) => x.eachL2((c) => void (c.description = ""), false) },
      { p: "switchport", run: (x) => x.setRouted(false) },
      { p: "spanning-tree bpduguard enable", run: (x) => x.eachPhys((c) => void (c.bpduguard = true)) },
      { p: "spanning-tree bpduguard disable", run: (x) => x.eachPhys((c) => void (c.bpduguard = false)) },
      { p: "no spanning-tree bpduguard", run: (x) => x.eachPhys((c) => void delete c.bpduguard) },
      { p: "switchport mode access", run: (x) => x.setMode("access") },
      { p: "switchport mode trunk", run: (x) => x.setMode("trunk") },
      { p: "switchport mode dynamic auto", run: (x) => x.setMode("dynamic-auto") },
      { p: "switchport mode dynamic desirable", run: (x) => x.setMode("dynamic-desirable") },
      { p: "no switchport mode", run: (x) => x.setMode("dynamic-auto") },
      { p: "switchport access vlan <1-4094:VLAN ID of the VLAN when this port is in access mode>", run: (x, a) => x.eachL2((c) => void (c.accessVlan = Number(a[3]))) },
      { p: "no switchport access vlan", run: (x) => x.eachL2((c) => void (c.accessVlan = 1)) },
      { p: "switchport trunk native vlan <1-4094:VLAN ID of the native VLAN when this port is in trunking mode>", run: (x, a) => x.eachL2((c) => void (c.nativeVlan = Number(a[4]))) },
      { p: "no switchport trunk native vlan", run: (x) => x.eachL2((c) => void (c.nativeVlan = 1)) },
      { p: "switchport trunk allowed vlan <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>", run: (x, a) => x.allowed("set", a[4]) },
      { p: "switchport trunk allowed vlan add <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>", run: (x, a) => x.allowed("add", a[5]) },
      { p: "switchport trunk allowed vlan remove <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>", run: (x, a) => x.allowed("remove", a[5]) },
      { p: "switchport trunk allowed vlan except <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>", run: (x, a) => x.allowed("except", a[5]) },
      { p: "switchport trunk allowed vlan all", run: (x) => x.allowed("all", "") },
      { p: "switchport trunk allowed vlan none", run: (x) => x.allowed("none", "") },
      { p: "no switchport trunk allowed vlan", run: (x) => x.allowed("all", "") },
      {
        p: "switchport nonegotiate",
        run: (x) => x.eachL2((c) => {
          if (c.mode.startsWith("dynamic")) throw new CliError(["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."]);
          c.nonegotiate = true;
        })
      },
      { p: "no switchport nonegotiate", run: (x) => x.eachL2((c) => void (c.nonegotiate = false)) },
      { p: "spanning-tree portfast", run: (x) => x.eachL2((c) => void (c.portfast = true), false) },
      { p: "no spanning-tree portfast", run: (x) => x.eachL2((c) => void (c.portfast = false), false) },
      { p: "channel-group <1-48:Channel group number> mode on", run: (x, a) => x.channelGroup(Number(a[1]), "on") },
      { p: "channel-group <1-48:Channel group number> mode active", run: (x, a) => x.channelGroup(Number(a[1]), "active") },
      { p: "channel-group <1-48:Channel group number> mode passive", run: (x, a) => x.channelGroup(Number(a[1]), "passive") },
      { p: "channel-group <1-48:Channel group number> mode desirable", run: (x, a) => x.channelGroup(Number(a[1]), "desirable") },
      { p: "channel-group <1-48:Channel group number> mode auto", run: (x, a) => x.channelGroup(Number(a[1]), "auto") },
      { p: "no channel-group", run: (x) => x.noChannelGroup() }
    ];
    if (def.l3) {
      p.push(
        { p: "no switchport", run: (x) => x.setRouted(true) },
        { p: "ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>", run: (x, a) => x.setIp(a[2], a[3]) },
        { p: "no ip address", run: (x) => x.eachPhys((c) => void (c.ip = null)) },
        ...l3OptPatterns
      );
    }
    if (def.needsEncap) {
      p.push(
        { p: "switchport trunk encapsulation dot1q", run: (x) => x.eachL2((c) => void (c.encapDot1q = true)) },
        {
          p: "no switchport trunk encapsulation",
          run: (x) => x.eachL2((c) => {
            if (c.mode === "trunk") throw new CliError(['Command rejected: An interface whose trunk encapsulation is "Auto" can not be configured to "trunk" mode.']);
            c.encapDot1q = false;
          })
        }
      );
    }
    return p;
  };
  var sviPatterns = [
    ...commonSub,
    { p: "shutdown", run: (x) => x.eachSvi((s) => void (s.shutdown = true)) },
    { p: "no shutdown", run: (x) => x.eachSvi((s) => void (s.shutdown = false)) },
    { p: "description <LINE:Up to 240 characters describing this interface>", run: (x, a) => x.eachSvi((s) => void (s.description = a[1])) },
    { p: "no description", run: (x) => x.eachSvi((s) => void (s.description = "")) },
    { p: "ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>", run: (x, a) => x.setIp(a[2], a[3]) },
    { p: "no ip address", run: (x) => x.eachSvi((s) => void (s.ip = null)) },
    ...l3OptPatterns
  ];
  var vlanPatterns = [
    ...commonSub,
    { p: "name <WORD:The ascii name for the VLAN>", run: (x, a) => x.vlanName(a[1]) },
    { p: "no name", run: (x) => x.vlanName(null) }
  ];
  var trieCache = /* @__PURE__ */ new WeakMap();
  function tries(def) {
    let t = trieCache.get(def);
    if (!t) {
      t = {
        user: buildTrie(userPatterns),
        priv: buildTrie(privPatterns),
        config: buildTrie(configPatterns(def)),
        if: buildTrie(l2IfPatterns(def)),
        svi: buildTrie(sviPatterns),
        vlan: buildTrie(vlanPatterns),
        router: buildTrie(routerPatterns)
      };
      trieCache.set(def, t);
    }
    return t;
  }
  var IosSession = class {
    constructor(rt, dev) {
      this.rt = rt;
      this.dev = dev;
      __publicField(this, "mode", "user");
      __publicField(this, "ifs", []);
      __publicField(this, "range", false);
      __publicField(this, "vlanIds", []);
      __publicField(this, "history", []);
      __publicField(this, "pending", null);
      __publicField(this, "starts", []);
    }
    get cfg() {
      return this.rt.running[this.dev];
    }
    get def() {
      return this.rt.topo.devices[this.dev];
    }
    prompt() {
      if (this.pending) return this.pending.prompt;
      const h = this.cfg.hostname;
      switch (this.mode) {
        case "user":
          return h + ">";
        case "priv":
          return h + "#";
        case "config":
          return h + "(config)#";
        case "if":
          return h + (this.range ? "(config-if-range)#" : "(config-if)#");
        case "vlan":
          return h + "(config-vlan)#";
        case "router":
          return h + "(config-router)#";
      }
    }
    get inConfig() {
      return this.mode === "config" || this.mode === "if" || this.mode === "vlan" || this.mode === "router";
    }
    trie() {
      const t = tries(this.def);
      if (this.mode === "if" && (this.ifs[0]?.startsWith("Vlan") || this.ifs[0]?.startsWith("Loopback"))) return t.svi;
      return t[this.mode];
    }
    /** Run one line; returns output lines. */
    exec(raw) {
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        const out2 = p.fn(raw) ?? [];
        this.rt.commit();
        return out2;
      }
      const line = raw.replace(/\s+$/, "");
      if (!line.trim() || line.trim().startsWith("!")) return [];
      if (line.endsWith("?")) return this.help(line.slice(0, -1));
      this.history.push(line.trim());
      if (this.history.length > 100) this.history.shift();
      let cmd = line;
      let filter = null;
      const bar = line.indexOf("|");
      if (bar >= 0) {
        cmd = line.slice(0, bar);
        const f = /^\s*(\S+)\s+(.+)$/.exec(line.slice(bar + 1));
        const kind = f && ["include", "exclude", "begin", "section"].filter((k) => k.startsWith(f[1].toLowerCase()));
        if (!f || !kind || kind.length !== 1) return this.caret(bar + 1 + (line.slice(bar + 1).length - line.slice(bar + 1).trimStart().length));
        let re;
        try {
          re = new RegExp(f[2].trim());
        } catch {
          re = new RegExp(f[2].trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        }
        filter = (ls) => applyFilter(kind[0], re, ls);
      }
      const out = this.run(cmd);
      return filter ? filter(out) : out;
    }
    run(cmd) {
      let r = parse(this.trie(), cmd);
      if (!r.ok && (this.mode === "if" || this.mode === "vlan" || this.mode === "router") && r.err !== "empty") {
        const g = parse(tries(this.def).config, cmd);
        if (g.ok) {
          this.mode = "config";
          this.ifs = [];
          this.vlanIds = [];
          r = g;
        }
      }
      if (!r.ok) {
        if (r.err === "ambiguous") return [`% Ambiguous command:  "${cmd.trim()}"`];
        if (r.err === "incomplete") return ["% Incomplete command.", ""];
        if (r.err === "invalid") {
          if (r.at === cmd.length - cmd.trimStart().length && !this.inConfig)
            return ['Translating "' + cmd.trim().split(/\s+/)[0] + '"', "% Unknown command or computer name, or unable to find computer address"];
          return this.caret(r.at);
        }
        return [];
      }
      this.starts = r.starts;
      const before = JSON.stringify([this.rt.running[this.dev], this.rt.startup[this.dev]]);
      let out = [];
      try {
        out = r.node.run(this, r.args) ?? [];
      } catch (e) {
        if (e instanceof CliError) out = e.lines;
        else if (e instanceof InvalidAt) out = this.caret(this.starts[e.argIndex] ?? 0);
        else throw e;
      }
      if (JSON.stringify([this.rt.running[this.dev], this.rt.startup[this.dev]]) !== before) this.rt.commit();
      return out;
    }
    caret(at) {
      return [" ".repeat(this.prompt().length + at) + "^", "% Invalid input detected at '^' marker.", ""];
    }
    help(line) {
      const h = help(this.trie(), line);
      if (Array.isArray(h)) return h;
      return this.caret(h.invalidAt);
    }
    complete(line) {
      return complete(this.trie(), line);
    }
    /** Ctrl+Z */
    ctrlZ() {
      if (this.inConfig) {
        this.end();
        this.rt.commit();
      }
      return [];
    }
    ask(prompt, fn) {
      this.pending = { prompt, fn };
    }
    get pendingPrompt() {
      return !!this.pending;
    }
    // ---- mode changes ----
    enterConfig() {
      this.mode = "config";
      return ["Enter configuration commands, one per line.  End with CNTL/Z."];
    }
    logout() {
      this.mode = "user";
      return ["", `${this.cfg.hostname} con0 is now available`, "", "", "", "", "", "Press RETURN to get started.", ""];
    }
    exitMode() {
      if (this.mode === "config") {
        this.mode = "priv";
        this.rt.log(this.dev, "%SYS-5-CONFIG_I: Configured from console by console");
      } else {
        this.mode = "config";
        this.ifs = [];
        this.vlanIds = [];
      }
    }
    end() {
      this.mode = "priv";
      this.ifs = [];
      this.vlanIds = [];
      this.rt.log(this.dev, "%SYS-5-CONFIG_I: Configured from console by console");
    }
    doCmd(line) {
      const shownPrompt = this.prompt().length + (this.starts[1] ?? 3);
      const saved = this.mode;
      const savedIfs = this.ifs;
      const savedV = this.vlanIds;
      const savedRange = this.range;
      this.mode = "priv";
      const shift = shownPrompt - this.prompt().length;
      let out;
      try {
        out = this.run(line);
      } finally {
        if (this.mode === "priv") {
          this.mode = saved;
          this.ifs = savedIfs;
          this.vlanIds = savedV;
          this.range = savedRange;
        }
      }
      return out.map((l) => l.endsWith("^") && !l.trim().slice(0, -1) ? " ".repeat(shift) + l : l);
    }
    // ---- vlans ----
    enterVlan(list) {
      const ids = parseVlanList(list);
      if (!ids) throw new InvalidAt(1);
      for (const v of ids) if (this.cfg.vlans[String(v)] === void 0) this.cfg.vlans[String(v)] = defaultVlanName(v);
      this.vlanIds = ids;
      this.mode = "vlan";
    }
    deleteVlan(list) {
      const ids = parseVlanList(list);
      if (!ids) throw new InvalidAt(2);
      const out = [];
      for (const v of ids) {
        if (RESERVED_VLANS.includes(v)) {
          out.push(`%Default VLAN ${v} may not be deleted.`);
          continue;
        }
        delete this.cfg.vlans[String(v)];
      }
      return out;
    }
    vlanName(name) {
      const out = [];
      for (const v of this.vlanIds) {
        if (RESERVED_VLANS.includes(v)) {
          out.push(`Default VLAN ${v} may not have its name changed.`);
          continue;
        }
        this.cfg.vlans[String(v)] = name ? name.slice(0, 32) : defaultVlanName(v);
      }
      return out;
    }
    // ---- interfaces ----
    resolveIf(type, num, argIndex, create) {
      var _a;
      const name = canonIf(type, num);
      if (!name) throw new InvalidAt(argIndex);
      if (name.startsWith("Vlan")) {
        const v = Number(num);
        if (!/^\d+$/.test(num) || v < 1 || v > 4094) throw new InvalidAt(argIndex + 1);
        if (create && !this.cfg.svis[String(v)]) this.cfg.svis[String(v)] = defaultSvi(v);
        return name;
      }
      if (name.startsWith("Loopback")) {
        const n = Number(num);
        if (!/^\d+$/.test(num) || n > 2147483647) throw new InvalidAt(argIndex + 1);
        const lbs = (_a = this.cfg).loopbacks ?? (_a.loopbacks = {});
        if (create && !lbs[String(n)]) lbs[String(n)] = { shutdown: false, description: "", ip: null };
        if (!create && !lbs[String(n)]) throw new InvalidAt(argIndex + 1);
        return "Loopback" + n;
      }
      if (name.startsWith("Port-channel")) {
        const n = Number(num);
        if (!/^\d+$/.test(num) || n < 1 || n > 48) throw new InvalidAt(argIndex + 1);
        if (create && !this.cfg.pos[String(n)]) this.cfg.pos[String(n)] = this.newPo();
        return name;
      }
      if (!this.cfg.ifaces[name]) throw new InvalidAt(argIndex + 1);
      return name;
    }
    newPo(from) {
      const base = from ? pickL2(from) : { shutdown: false, description: "", mode: "dynamic-auto", accessVlan: 1, nativeVlan: 1, allowed: null, nonegotiate: false, encapDot1q: false, portfast: false };
      base.shutdown = false;
      base.description = "";
      return base;
    }
    enterIf(type, num) {
      const name = this.resolveIf(type, num, 1, true);
      this.ifs = [name];
      this.range = false;
      this.mode = "if";
    }
    enterRange(spec) {
      const names = [];
      const cleaned = spec.replace(/\s*-\s*/g, "-").replace(/\s*,\s*/g, ",");
      for (const part of cleaned.split(",")) {
        const m = /^([A-Za-z-]+)\s*(\d+\/)?(\d+)(?:-(\d+))?$/.exec(part.trim());
        if (!m) throw new InvalidAt(2);
        const from = Number(m[3]);
        const to = m[4] ? Number(m[4]) : from;
        if (to < from) throw new InvalidAt(2);
        for (let i = from; i <= to; i++) {
          const name = canonIf(m[1], (m[2] ?? "") + i);
          if (!name || name.startsWith("Vlan") || name.startsWith("Port-channel") || !this.cfg.ifaces[name]) throw new InvalidAt(2);
          names.push(name);
        }
      }
      this.ifs = names;
      this.range = true;
      this.mode = "if";
    }
    deleteIf(type, num) {
      const name = this.resolveIf(type, num, 2, false);
      if (name.startsWith("Vlan")) {
        if (num === "1") return ["% Not allowed to remove Vlan1"];
        delete this.cfg.svis[num];
      } else if (name.startsWith("Loopback")) {
        delete this.cfg.loopbacks?.[ifNum(name)];
      } else {
        delete this.cfg.pos[num];
        for (const c of Object.values(this.cfg.ifaces)) if (c.channel?.id === Number(num)) c.channel = null;
      }
    }
    /** Apply to selected L2 interfaces; port-channel changes propagate to members. */
    eachL2(fn, propagate = true) {
      for (const name of this.ifs) {
        if (name.startsWith("Port-channel")) {
          const id = ifNum(name);
          fn(this.cfg.pos[id], name);
          if (propagate) {
            for (const [m, c] of Object.entries(this.cfg.ifaces)) if (c.channel?.id === Number(id)) fn(c, m);
          }
        } else fn(this.cfg.ifaces[name], name);
      }
    }
    /** SVI or loopback under the cursor (same shape). */
    eachSvi(fn) {
      for (const name of this.ifs) fn(name.startsWith("Loopback") ? this.cfg.loopbacks[ifNum(name)] : this.cfg.svis[ifNum(name)]);
    }
    /** Physical ports only (port-channels are skipped). */
    eachPhys(fn) {
      for (const name of this.ifs) {
        const c = this.cfg.ifaces[name];
        if (c) fn(c, name);
      }
    }
    /** L3 options of the selected interfaces; physical ports must be routed. */
    eachL3(fn) {
      for (const name of this.ifs) {
        if (name.startsWith("Vlan") || name.startsWith("Loopback")) {
          this.eachSvi((s) => fn(s.l3 ?? (s.l3 = {})));
          return;
        }
        const c = this.cfg.ifaces[name];
        if (!c) continue;
        if (!c.routed) throw new CliError(["% IP addresses may not be configured on L2 links."]);
        fn(c.l3 ?? (c.l3 = {}));
      }
    }
    setRouted(on) {
      for (const name of this.ifs) {
        if (name.startsWith("Port-channel")) return ["% Routed EtherChannel is not modelled in this lab."];
      }
      this.eachPhys((c) => {
        if (on && c.channel) throw new CliError(["% Remove the channel-group first (routed EtherChannel is not modelled)."]);
        if (on === !!c.routed) return;
        c.routed = on;
        c.ip = null;
        delete c.l3;
      });
    }
    resolveName(type, num, argIndex) {
      return this.resolveIf(type, num, argIndex, false);
    }
    setMode(mode) {
      this.eachL2((c) => {
        if (mode === "trunk" && this.def.needsEncap && !c.encapDot1q)
          throw new CliError(['Command rejected: An interface whose trunk encapsulation is "Auto" can not be configured to "trunk" mode.']);
        if (mode.startsWith("dynamic") && c.nonegotiate) throw new CliError(["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."]);
        c.mode = mode;
      });
    }
    allowed(op, list) {
      const ids = op === "all" || op === "none" ? [] : parseVlanList(list);
      if (!ids) throw new InvalidAt(op === "set" ? 4 : 5);
      this.eachL2((c) => {
        const cur = c.allowed ?? ALL_VLANS;
        let next;
        if (op === "set") next = ids;
        else if (op === "add") next = c.allowed === null ? null : [.../* @__PURE__ */ new Set([...cur, ...ids])].sort((a, b) => a - b);
        else if (op === "remove") next = cur.filter((v) => !ids.includes(v));
        else if (op === "except") next = ALL_VLANS.filter((v) => !ids.includes(v));
        else if (op === "all") next = null;
        else next = [];
        if (next && next.length === 4094) next = null;
        c.allowed = next;
      });
    }
    channelGroup(id, mode) {
      const out = [];
      for (const name of this.ifs) {
        if (!this.cfg.ifaces[name]) return this.caretAt(0);
        if (this.cfg.ifaces[name].routed) return ["% Routed EtherChannel is not modelled in this lab; use switchport first."];
        const others = Object.entries(this.cfg.ifaces).filter(([n, c2]) => n !== name && c2.channel?.id === id);
        if (others.length && protoOf2(others[0][1].channel.mode) !== protoOf2(mode)) {
          out.push(`Command rejected (Channel protocol mismatch for interface ${shortIf(name)} in group ${id}): the interface can not be added to the channel group`);
          continue;
        }
        const c = this.cfg.ifaces[name];
        if (!this.cfg.pos[String(id)]) {
          this.cfg.pos[String(id)] = this.newPo(c);
          out.push(`Creating a port-channel interface Port-channel ${id}`, "");
        }
        c.channel = { id, mode };
      }
      return out;
    }
    caretAt(i) {
      return this.caret(this.starts[i] ?? 0);
    }
    noChannelGroup() {
      for (const name of this.ifs) {
        const c = this.cfg.ifaces[name];
        if (c) c.channel = null;
      }
    }
    /** All configured IP interfaces of this switch: name -> address. */
    ipIfs() {
      const out = [];
      for (const [v, s] of Object.entries(this.cfg.svis)) if (s.ip) out.push(["Vlan" + v, s.ip]);
      for (const [p, c] of Object.entries(this.cfg.ifaces)) if (c.routed && c.ip) out.push([p, c.ip]);
      for (const [n, l] of Object.entries(this.cfg.loopbacks ?? {})) if (l.ip) out.push(["Loopback" + n, l.ip]);
      return out;
    }
    setIp(addr, mask) {
      const len = maskToPrefix(mask);
      const a = ipToInt(addr);
      if (len === null || len === 0) return [`Bad mask 0x${(ipToInt(mask) >>> 0).toString(16).toUpperCase()} for address ${addr}`];
      const host = (a & ~prefixMaskInt(len)) >>> 0;
      if (len < 31 && (host === 0 || host === ~prefixMaskInt(len) >>> 0)) return [`Bad mask /${len} for address ${addr}`];
      if (this.ifs.length > 1) return ["% IP address may not be configured on an interface range."];
      const name = this.ifs[0];
      for (const [other, ip] of this.ipIfs()) {
        if (other === name) continue;
        const l = Math.min(maskToPrefix(ip.mask), len);
        if (networkOf(ip.addr, l) === networkOf(addr, l)) return [`% ${networkOf(addr, len)} overlaps with ${other}`];
      }
      if (name.startsWith("Vlan") || name.startsWith("Loopback")) this.eachSvi((s) => void (s.ip = { addr, mask }));
      else {
        const c = this.cfg.ifaces[name];
        if (!c.routed) return ["% IP addresses may not be configured on L2 links."];
        c.ip = { addr, mask };
      }
    }
    // ---- OSPF ----
    get ospf() {
      return this.cfg.ospf;
    }
    enterOspf(pid) {
      if (!this.cfg.ipRouting) return ["% IP routing not enabled"];
      if (this.cfg.ospf && this.cfg.ospf.pid !== pid) return [`% Only one OSPF process is modelled; remove "router ospf ${this.cfg.ospf.pid}" first.`];
      if (!this.cfg.ospf)
        this.cfg.ospf = { pid, routerId: null, activeRid: null, networks: [], passiveDefault: false, passive: [], refBw: 100, defaultOriginate: null, stubs: {} };
      this.mode = "router";
    }
    hasNeighbors() {
      return (this.rt.derived.ospf[this.dev]?.nbrs.length ?? 0) > 0;
    }
    routerId(rid) {
      const o = this.ospf;
      o.routerId = rid;
      if (this.hasNeighbors()) {
        if ((rid ?? null) !== o.activeRid) return ['% OSPF: Reload or use "clear ip ospf process" command, for this to take effect'];
        return;
      }
      o.activeRid = rid;
    }
    passive(name, on) {
      const o = this.ospf;
      const set = new Set(o.passive);
      if (on !== o.passiveDefault) set.add(name);
      else set.delete(name);
      o.passive = [...set];
    }
    stubArea(area, noSummary) {
      if (area === 0) return ["% OSPF: Backbone can not be configured as stub area"];
      this.ospf.stubs[String(area)] = { noSummary };
    }
    clearOspf() {
      if (!this.cfg.ospf) return;
      return this.ask("Reset ALL OSPF processes? [no]: ", (ans) => {
        if (!/^y/i.test(ans.trim())) return [];
        this.cfg.ospf.activeRid = null;
        return [];
      });
    }
    addRoute(net, mask, nh) {
      const len = maskToPrefix(mask);
      if (len === null) return ["%Inconsistent address and mask"];
      if (networkOf(net, len) !== net) return ["%Inconsistent address and mask"];
      if (!this.cfg.routes.some((r) => r.net === net && r.mask === mask && r.nh === nh)) this.cfg.routes.push({ net, mask, nh });
    }
    // ---- spanning tree ----
    stpPriority(list, prio) {
      const ids = parseVlanList(list);
      if (!ids) throw new InvalidAt(2);
      if (prio % 4096 !== 0)
        return [
          "% Bridge Priority must be in increments of 4096.",
          "% Allowed values are:",
          "  0     4096  8192  12288 16384 20480 24576 28672",
          "  32768 36864 40960 45056 49152 53248 57344 61440"
        ];
      for (const v of ids) this.cfg.stpPriority[String(v)] = prio;
    }
    stpRoot(list, kind) {
      const ids = parseVlanList(list);
      if (!ids) throw new InvalidAt(2);
      for (const v of ids) {
        if (kind === "secondary") {
          this.cfg.stpPriority[String(v)] = 28672;
          continue;
        }
        const bridges = this.rt.derived.stp[v];
        const me = bridges?.[this.dev];
        let prio = 24576;
        if (me && !me.isRoot) {
          const rootPrio = me.rootPrio - v;
          if (rootPrio <= 24576) prio = rootPrio - 4096;
          if (prio < 0) return [`% Failed to make the bridge root for vlan ${v}`, "% It may be possible to make the bridge root by setting the priority", "% for some (or all) of these instances to zero."];
        } else if (me) prio = Math.min(24576, me.prio - v);
        this.cfg.stpPriority[String(v)] = prio;
      }
    }
    stpClear(list) {
      const ids = parseVlanList(list);
      if (!ids) throw new InvalidAt(3);
      for (const v of ids) delete this.cfg.stpPriority[String(v)];
    }
    // ---- exec ----
    save() {
      this.rt.startup[this.dev] = clone(this.cfg);
      return ["Building configuration...", "[OK]"];
    }
    erase() {
      return this.ask("Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]", (ans) => {
        if (ans.trim() && !/^y/i.test(ans.trim())) return [];
        this.rt.startup[this.dev] = null;
        return ["[OK]", "Erase of nvram: complete"];
      });
    }
    reload() {
      const proceed = () => this.ask("Proceed with reload? [confirm]", (ans) => {
        if (ans.trim() && !/^y/i.test(ans.trim())) return [];
        return this.doReload();
      });
      const modified = JSON.stringify(this.rt.startup[this.dev]) !== JSON.stringify(this.cfg);
      if (modified) {
        return this.ask("System configuration has been modified. Save? [yes/no]: ", (ans) => {
          const a = ans.trim().toLowerCase();
          if (a.startsWith("y")) {
            const o = this.save();
            proceed();
            return o;
          }
          if (a.startsWith("n")) return proceed() ?? [];
          return ["% Please answer 'yes' or 'no'."];
        });
      }
      return proceed();
    }
    doReload() {
      const start = this.rt.startup[this.dev];
      const fresh = defaultSwitchConfig(this.def);
      this.rt.running[this.dev] = start ? clone(start) : fresh;
      const o = this.rt.running[this.dev].ospf;
      if (o) o.activeRid = null;
      this.mode = "user";
      this.ifs = [];
      for (const k of [...this.rt.arp]) if (k.startsWith(this.dev + ">")) this.rt.arp.delete(k);
      return [
        "",
        "System Bootstrap, Version 15.2(7)E, RELEASE SOFTWARE (simulated)",
        'Loading "flash:labber-sim.bin"...@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ [OK]',
        "",
        start ? "" : "         --- System Configuration Dialog ---  (skipped)",
        "",
        "Press RETURN to get started!",
        ""
      ];
    }
    ping(ip) {
      const d = this.rt.derived;
      const r = ping(d, this.dev, ip);
      this.rt.markSeen(r.forward?.hops ?? [], this.dev);
      const head = ["Type escape sequence to abort.", `Sending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:`];
      if (r.reason === "noip" && !l3Ifs(d, this.dev).length) return [...head, ".....", "Success rate is 0 percent (0/5)"];
      let marks;
      let ok = 0;
      if (r.ok) {
        const key = `${this.dev}>${r.firstHopArp?.ip ?? ip}`;
        const cold = !this.rt.arp.has(key);
        this.rt.arp.add(key);
        marks = cold ? ".!!!!" : "!!!!!";
        ok = cold ? 4 : 5;
      } else {
        if (r.firstHopArp) this.rt.arp.add(`${this.dev}>${r.firstHopArp.ip}`);
        marks = r.reason === "unreach" ? "U.U.U" : ".....";
      }
      this.rt.emit();
      return [
        ...head,
        marks,
        `Success rate is ${ok * 20} percent (${ok}/5)` + (ok ? ", round-trip min/avg/max = 1/2/4 ms" : "")
      ];
    }
    traceroute(ip) {
      const d = this.rt.derived;
      const r = deliver(d, this.dev, ip);
      this.rt.markSeen(r.hops, this.dev);
      const out = ["Type escape sequence to abort.", `Tracing the route to ${ip}`, "VRF info: (vrf in name/id, vrf out name/id)"];
      r.hops.forEach((h, i) => out.push(`  ${i + 1} ${h.ip} ${1 + i} msec ${i} msec ${1 + i} msec`));
      if (r.kind === "ok") {
        if (!r.hops.length) out.push(`  1 ${ip} 0 msec 0 msec 0 msec`);
        return out;
      }
      if (r.kind === "unreach") {
        out.push(`  ${r.hops.length + 1} ${r.atIp} !H  !H  !H`);
        return out;
      }
      for (let i = r.hops.length + 1; i <= r.hops.length + 3; i++) out.push(`  ${i}  *  *  *`);
      return out;
    }
    // ---- show helpers ----
    allInterfaces() {
      const names = [
        ...this.def.ports,
        ...Object.keys(this.cfg.pos).map((n) => "Port-channel" + n),
        ...Object.keys(this.cfg.svis).map((v) => "Vlan" + v),
        ...Object.keys(this.cfg.loopbacks ?? {}).map((n) => "Loopback" + n)
      ];
      return names.flatMap((n) => [...showInterface(this.rt, this.dev, n)]);
    }
    showOneIf(a, sw) {
      const name = this.resolveIf(a[2], a[3], 2, false);
      if (name.startsWith("Port-channel") && !this.cfg.pos[ifNum(name)]) throw new InvalidAt(3);
      if (name.startsWith("Vlan") && !this.cfg.svis[ifNum(name)]) throw new InvalidAt(3);
      return sw ? showIntSwitchport(this.rt, this.dev, name) : showInterface(this.rt, this.dev, name);
    }
    showRunIf(a) {
      const name = this.resolveIf(a[3], a[4], 3, false);
      const all = showRun(this.rt, this.dev, "running");
      const i = all.indexOf("interface " + name);
      if (i < 0) throw new InvalidAt(4);
      const body = [all[i]];
      for (let j = i + 1; j < all.length && all[j].startsWith(" "); j++) body.push(all[j]);
      return ["Building configuration...", "", `Current configuration : ${body.join("\n").length + 1} bytes`, "!", ...body, "end", ""];
    }
    showArp() {
      const d = this.rt.derived;
      const out = ["Protocol  Address          Age (min)  Hardware Addr   Type   Interface"];
      for (const i of l3Ifs(d, this.dev)) out.push(`Internet  ${i.ip.padEnd(17)}-          ${i.mac}  ARPA   ${i.name}`);
      for (const k of this.rt.arp) {
        if (!k.startsWith(this.dev + ">")) continue;
        const ip = k.split(">")[1];
        const owner = d.topo.lab.devices.flatMap((x) => l3Ifs(d, x.id)).find((x) => x.ip === ip);
        const via = l3Ifs(d, this.dev).find((i) => owner && i.node && networkOf(i.ip, i.prefix) === networkOf(ip, i.prefix));
        if (owner && via) out.push(`Internet  ${ip.padEnd(17)}0          ${owner.mac}  ARPA   ${via.name}`);
      }
      return out;
    }
  };
  function applyFilter(kind, re, lines) {
    if (kind === "include") return lines.filter((l) => re.test(l));
    if (kind === "exclude") return lines.filter((l) => !re.test(l));
    if (kind === "begin") {
      const i = lines.findIndex((l) => re.test(l));
      return i < 0 ? [] : lines.slice(i);
    }
    const out = [];
    let inSec = false;
    for (const l of lines) {
      if (!l.startsWith(" ")) inSec = re.test(l);
      else if (!inSec && re.test(l)) {
        out.push(l);
        continue;
      }
      if (inSec) out.push(l);
    }
    return out;
  }

  // src/sim/cli/vpcs.ts
  var HELP2 = [
    "",
    "ip ARG ... [OPTION]      Configure the current VPC's IP settings",
    "  ip <address>/<len> [gateway]",
    "  ip <address> <mask> [gateway]",
    "clear ip                 Clear IP address, mask and gateway",
    "show [ip]                Print the information of the VPC",
    "ping <address>           Ping the network host",
    "trace <address>          Print the path packets take to network host",
    "help, ?                  Print help",
    ""
  ];
  var VpcsSession = class {
    constructor(rt, dev) {
      this.rt = rt;
      this.dev = dev;
      __publicField(this, "history", []);
    }
    get def() {
      return this.rt.topo.devices[this.dev];
    }
    prompt() {
      return this.dev + "> ";
    }
    complete(line) {
      const cmds = ["ip", "clear", "show", "ping", "trace", "help"];
      const t = line.trim();
      if (!t || t.includes(" ")) return null;
      const m = cmds.filter((c) => c.startsWith(t));
      return m.length === 1 ? m[0] + " " : null;
    }
    help() {
      return HELP2;
    }
    ctrlZ() {
      return [];
    }
    exec(raw) {
      const line = raw.trim();
      if (!line) return [];
      this.history.push(line);
      const [cmd, ...args] = line.split(/\s+/);
      const c = cmd.toLowerCase();
      if (c === "?" || c === "help") return HELP2;
      if (c === "ip") return this.ip(args);
      if (c === "clear" && args[0] === "ip") {
        this.rt.pcs[this.dev] = { ip: null, prefix: 24, gw: null };
        this.rt.commit();
        return ["IPv4 address/mask, gateway, DNS, and DHCP cleared"];
      }
      if (c === "show" && (!args[0] || args[0] === "ip")) return this.showIp();
      if (c === "ping" && args[0]) return this.ping(args[0]);
      if ((c === "trace" || c === "tracert" || c === "traceroute") && args[0]) return this.trace(args[0]);
      return ['Bad command: "' + line + '". Use ? for help.'];
    }
    ip(args) {
      if (!args.length) return ["Incomplete command."];
      let addr;
      let prefix;
      let gw = null;
      const slash = /^(\S+)\/(\d+)$/.exec(args[0]);
      if (slash) {
        addr = slash[1];
        prefix = Number(slash[2]);
        gw = args[1] ?? null;
      } else if (args[1] && isIp(args[1])) {
        const m = maskToPrefix(args[1]);
        if (m === null) return ["Invalid netmask"];
        addr = args[0];
        prefix = m;
        gw = args[2] ?? null;
      } else if (args[1] && /^\d+$/.test(args[1])) {
        addr = args[0];
        prefix = Number(args[1]);
        gw = args[2] ?? null;
      } else {
        addr = args[0];
        prefix = 24;
      }
      if (!isIp(addr) || prefix < 1 || prefix > 30) return ["Invalid address"];
      if (gw && !isIp(gw)) return ["Invalid gateway"];
      if (gw && !sameSubnet(addr, gw, prefix)) return ["Gateway is not in the same subnet"];
      this.rt.pcs[this.dev] = { ip: addr, prefix, gw };
      this.rt.commit();
      return ["Checking for duplicate address...", `${this.dev} : ${addr} ${prefixToMask(prefix)}${gw ? " gateway " + gw : ""}`, ""];
    }
    showIp() {
      const c = this.rt.pcs[this.dev];
      return [
        "",
        `NAME        : ${this.dev}[1]`,
        `IP/MASK     : ${c.ip ? `${c.ip}/${c.prefix}` : "0.0.0.0/0"}`,
        `GATEWAY     : ${c.gw ?? "0.0.0.0"}`,
        "DNS         : ",
        `MAC         : ${macToColon(this.def.mac)}`,
        "LPORT       : 20000",
        "RHOST:PORT  : 127.0.0.1:30000",
        "MTU         : 1500",
        ""
      ];
    }
    ping(dst) {
      if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`];
      const c = this.rt.pcs[this.dev];
      if (!c.ip) return ["No gateway found"];
      if (!sameSubnet(c.ip, dst, c.prefix) && !c.gw) return [`host (${dst}) not reachable`, ""];
      const d = this.rt.derived;
      const r = ping(d, this.dev, dst);
      this.rt.markSeen(r.forward?.hops ?? [], this.dev);
      this.rt.emit();
      const out = [];
      for (let i = 1; i <= 5; i++) {
        const t = (0.4 + i * 37 % 10 / 10 + (r.ttl && r.ttl < 64 ? 0.8 : 0)).toFixed(3);
        if (r.ok) out.push(`84 bytes from ${dst} icmp_seq=${i} ttl=${r.ttl} time=${t} ms`);
        else if (r.reason === "unreach") out.push(`*${r.unreachFrom} icmp_seq=${i} ttl=255 time=${t} ms (ICMP type:3, code:1, Destination host unreachable)`);
        else if (r.reason === "noroute" && !r.forward?.hops.length && c.gw && !sameSubnet(c.ip, dst, c.prefix)) out.push(`host (${c.gw}) not reachable`);
        else out.push(`${dst} icmp_seq=${i} timeout`);
        if (r.reason === "noroute" && out[out.length - 1].startsWith("host")) break;
      }
      return ["", ...out, ""];
    }
    trace(dst) {
      if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`];
      const c = this.rt.pcs[this.dev];
      if (!c.ip) return ["No gateway found"];
      const r = deliver(this.rt.derived, this.dev, dst);
      this.rt.markSeen(r.hops, this.dev);
      const out = [`trace to ${dst}, 8 hops max, press Ctrl+C to stop`];
      r.hops.forEach((h, i) => {
        const last = r.kind === "ok" && i === r.hops.length - 1;
        out.push(` ${i + 1}   ${last ? "*" : ""}${h.ip}   ${(0.5 + i).toFixed(3)} ms  ${(0.4 + i).toFixed(3)} ms  ${(0.6 + i).toFixed(3)} ms`);
      });
      if (r.kind === "unreach") out.push(` ${r.hops.length + 1}   *${r.atIp}   1.000 ms (ICMP type:3, code:1, Destination host unreachable)`);
      else if (r.kind !== "ok") for (let i = r.hops.length + 1; i <= Math.min(8, r.hops.length + 3); i++) out.push(` ${i}     *  *  *`);
      return [...out, ""];
    }
  };

  // src/sim/ospf.ts
  function computeState(topo, cfgs, pcs, errdis) {
    const d = derive(topo, cfgs, pcs, errdis);
    d.ospf = computeOspf(d);
    return d;
  }
  var ridInt = (r) => ipToInt(r) ?? 0;
  function candidateRid(d, dev) {
    const c = d.cfgs[dev].ospf;
    if (c?.routerId) return c.routerId;
    const ifs = l3Ifs(d, dev);
    const pick = (list) => list.length ? list.map((i) => i.ip).sort((a, b) => ridInt(b) - ridInt(a))[0] : null;
    return pick(ifs.filter((i) => i.kind === "loop")) ?? pick(ifs);
  }
  function ospfRunning(d, dev) {
    const def = d.topo.devices[dev];
    const c = d.cfgs[dev];
    return def?.kind === "switch" && !!def.l3 && !!c?.ipRouting && !!c.ospf;
  }
  function configuredL3(cfg, sw) {
    const out = [];
    for (const [v, s] of Object.entries(cfg.svis)) if (s.ip) out.push({ name: "Vlan" + v, ip: s.ip, l3: s.l3 ?? {} });
    for (const p of sw.ports) {
      const c = cfg.ifaces[p];
      if (c.routed && c.ip) out.push({ name: p, ip: c.ip, l3: c.l3 ?? {} });
    }
    for (const [n, l] of Object.entries(cfg.loopbacks ?? {})) if (l.ip) out.push({ name: "Loopback" + n, ip: l.ip, l3: l.l3 ?? {} });
    return out;
  }
  function areaFor(o, ip, l3) {
    if (l3.ospfArea && l3.ospfArea.pid === o.pid) return l3.ospfArea.area;
    const a = ipToInt(ip);
    let best = null;
    for (const n of o.networks) {
      const wc = ipToInt(n.wildcard);
      const care = ~wc >>> 0;
      if ((a & care) >>> 0 !== (ipToInt(n.addr) & care) >>> 0) continue;
      const bits = popcount(wc);
      if (!best || bits < best.bits) best = { bits, area: n.area };
    }
    return best?.area ?? null;
  }
  function popcount(n) {
    let c = 0;
    for (let x = n >>> 0; x; x >>>= 1) c += x & 1;
    return c;
  }
  function isPassive(o, name) {
    return o.passiveDefault ? !o.passive.includes(name) : o.passive.includes(name);
  }
  var isStub = (o, area) => !!o.stubs[String(area)];
  function computeOspf(d) {
    const out = {};
    const devs = d.topo.switches.filter((s) => ospfRunning(d, s.id));
    for (const sw of devs) {
      const cfg = d.cfgs[sw.id];
      const o = cfg.ospf;
      const rid = o.activeRid ?? null;
      const up = new Map(l3Ifs(d, sw.id).map((i) => [i.name, i]));
      const ifs = [];
      for (const c of configuredL3(cfg, sw)) {
        const area = areaFor(o, c.ip.addr, c.l3);
        if (area === null) continue;
        const isLoop = c.name.startsWith("Loopback");
        const net = c.l3.ospfNet ?? (isLoop ? "loopback" : "broadcast");
        const hello = c.l3.ospfHello ?? 10;
        const bw = ifBandwidth(c.name, c.l3.bandwidth);
        const l3 = up.get(c.name) ?? null;
        ifs.push({
          dev: sw.id,
          name: c.name,
          ip: c.ip.addr,
          prefix: maskToPrefix(c.ip.mask),
          area,
          cost: c.l3.ospfCost ?? Math.max(1, Math.floor(o.refBw * 1e3 / bw)),
          hello,
          dead: c.l3.ospfDead ?? hello * 4,
          prio: c.l3.ospfPrio ?? 1,
          net: isLoop && net === "broadcast" ? "loopback" : net,
          passive: isPassive(o, c.name),
          mtu: c.l3.mtu ?? 1500,
          up: !!l3 && !!rid,
          role: "DOWN",
          dr: null,
          bdr: null,
          l3
        });
      }
      const areas = [...new Set(ifs.filter((i) => i.up).map((i) => i.area))].sort((a, b) => a - b);
      out[sw.id] = { pid: o.pid, rid, ifs, nbrs: [], routes: [], areas, abr: areas.includes(0) && areas.length > 1, asbr: false, mismatches: [] };
    }
    const talkers = Object.values(out).flatMap((s) => s.ifs.filter((i) => i.up && !i.passive && i.net !== "loopback" && i.l3?.node));
    const domCache = /* @__PURE__ */ new Map();
    const domOf = (i) => {
      const key = `${i.dev}|${i.name}`;
      let s = domCache.get(key);
      if (!s) {
        s = /* @__PURE__ */ new Set([...l2Domain(d, i.l3.node).nodes.keys()]);
        domCache.set(key, s);
      }
      return s;
    };
    const nk2 = (i) => `${i.l3.node.dev}|${i.l3.node.vlan}`;
    const peersOf = /* @__PURE__ */ new Map();
    const compat = /* @__PURE__ */ new Map();
    for (const a of talkers) {
      const dom = domOf(a);
      const peers = talkers.filter((b) => b.dev !== a.dev && dom.has(nk2(b)));
      peersOf.set(a, peers);
      const ok = [];
      for (const b of peers) {
        const kind = mismatch(d, out, a, b);
        if (kind) out[a.dev].mismatches.push({ dev: a.dev, ifname: a.name, peerIp: b.ip, peerDev: b.dev, kind });
        else ok.push(b);
      }
      compat.set(a, ok);
    }
    for (const a of talkers) {
      if (a.net === "point-to-point") {
        a.role = "P2P";
        continue;
      }
      const cands = [a, ...compat.get(a)].filter((x) => x.net === "broadcast" && x.prio > 0);
      cands.sort((x, y) => y.prio - x.prio || ridInt(out[y.dev].rid) - ridInt(out[x.dev].rid));
      const dr = cands[0];
      const bdr = cands[1];
      a.dr = dr ? { rid: out[dr.dev].rid, ip: dr.ip } : null;
      a.bdr = bdr ? { rid: out[bdr.dev].rid, ip: bdr.ip } : null;
      a.role = dr === a ? "DR" : bdr === a ? "BDR" : "DROTHER";
    }
    for (const s of Object.values(out)) {
      for (const i of s.ifs) {
        if (!i.up) i.role = "DOWN";
        else if (i.net === "loopback") i.role = "LOOP";
        else if (i.role === "DOWN") i.role = i.net === "point-to-point" ? "P2P" : "DR";
      }
    }
    for (const a of talkers) {
      for (const b of compat.get(a)) {
        const bothP2p = a.net === "point-to-point" && b.net === "point-to-point";
        const sameType = a.net === b.net;
        let state;
        let role = "-";
        if (bothP2p || !sameType) state = "FULL";
        else {
          role = a.dr?.ip === b.ip ? "DR" : a.bdr?.ip === b.ip ? "BDR" : "DROTHER";
          const adj = a.role === "DR" || a.role === "BDR" || role === "DR" || role === "BDR";
          state = adj ? "FULL" : "2WAY";
        }
        if (state === "FULL" && a.mtu !== b.mtu) state = "EXSTART";
        out[a.dev].nbrs.push({
          rid: out[b.dev].rid,
          prio: b.prio,
          state,
          role,
          ip: b.ip,
          ifname: a.name,
          peerDev: b.dev,
          peerIf: b.name,
          spf: state === "FULL" && sameType
        });
      }
    }
    const ifsIn = (dev, area) => out[dev].ifs.filter((i) => i.up && i.area === area);
    const devsIn = (area) => Object.keys(out).filter((dev) => out[dev].areas.includes(area));
    const allAreas = [...new Set(Object.values(out).flatMap((s) => s.areas))];
    const edges = /* @__PURE__ */ new Map();
    const ekey = (dev, area) => `${dev}#${area}`;
    for (const area of allAreas) {
      for (const dev of devsIn(area)) {
        const list = [];
        for (const a of ifsIn(dev, area)) {
          if (!talkers.includes(a)) continue;
          const full = out[dev].nbrs.filter((n) => n.ifname === a.name && n.spf);
          if (a.net === "point-to-point") {
            for (const n of full) list.push({ to: n.peerDev, cost: a.cost, path: { nh: n.ip, ifname: a.name } });
            continue;
          }
          if (!a.dr) continue;
          const amAttached = a.role === "DR" ? full.length > 0 : full.some((n) => n.ip === a.dr.ip);
          if (!amAttached) continue;
          for (const b of peersOf.get(a)) {
            if (b.area !== area || !compat.get(a).includes(b) || b.net !== "broadcast") continue;
            const bFull = out[b.dev].nbrs.filter((n) => n.ifname === b.name && n.spf);
            const bAttached = b.role === "DR" ? bFull.length > 0 : bFull.some((n) => n.ip === a.dr.ip);
            if (bAttached) list.push({ to: b.dev, cost: a.cost, path: { nh: b.ip, ifname: a.name } });
          }
        }
        edges.set(ekey(dev, area), list);
      }
    }
    const spf = (root, area) => {
      const dist2 = /* @__PURE__ */ new Map([[root, { cost: 0, paths: [] }]]);
      const done = /* @__PURE__ */ new Set();
      for (; ; ) {
        let cur = null;
        for (const [k, v] of dist2) if (!done.has(k) && (cur === null || v.cost < dist2.get(cur).cost)) cur = k;
        if (cur === null) break;
        done.add(cur);
        const base = dist2.get(cur);
        for (const e of edges.get(ekey(cur, area)) ?? []) {
          if (done.has(e.to)) continue;
          const cost = base.cost + e.cost;
          const paths = cur === root ? [e.path] : base.paths;
          const prev = dist2.get(e.to);
          if (!prev || cost < prev.cost) dist2.set(e.to, { cost, paths: [...paths] });
          else if (cost === prev.cost) prev.paths = mergePaths(prev.paths, paths);
        }
      }
      return dist2;
    };
    const pkey = (net, prefix) => `${net}/${prefix}`;
    const asbrKey = (dev) => `asbr:${dev}`;
    const externals = /* @__PURE__ */ new Map();
    for (const dev of Object.keys(out)) {
      const o = d.cfgs[dev].ospf;
      if (!o.defaultOriginate || !out[dev].rid) continue;
      const hasDefault = routeTable(d, dev).some((e) => e.prefix === 0 && e.code === "S");
      if (!o.defaultOriginate.always && !hasDefault) continue;
      out[dev].asbr = true;
      externals.set(dev, [{ net: "0.0.0.0", prefix: 0, metric: 1 }]);
    }
    const dist = {};
    const intra = {};
    for (const dev of Object.keys(out)) {
      dist[dev] = {};
      intra[dev] = {};
      for (const area of out[dev].areas) {
        const dm = spf(dev, area);
        dist[dev][area] = dm;
        const pm = /* @__PURE__ */ new Map();
        for (const [x, r] of dm) {
          for (const i of ifsIn(x, area)) {
            const host = i.net === "loopback";
            const net = host ? i.ip : networkOf(i.ip, i.prefix);
            const prefix = host ? 32 : i.prefix;
            addReach(pm, pkey(net, prefix), { cost: r.cost + i.cost, paths: r.paths });
          }
          if (out[x].asbr) addReach(pm, asbrKey(x), { cost: r.cost, paths: r.paths });
        }
        intra[dev][area] = pm;
      }
    }
    const stubCfg = (dev, area) => d.cfgs[dev].ospf.stubs[String(area)];
    const summariesInto = (abr, area, backboneInter) => {
      const m = /* @__PURE__ */ new Map();
      const stub = stubCfg(abr, area);
      if (stub) m.set(pkey("0.0.0.0", 0), 1);
      if (stub?.noSummary) return m;
      const put = (k, c) => {
        if (stub && k.startsWith("asbr:")) return;
        if (k === pkey("0.0.0.0", 0)) return;
        if (!m.has(k) || m.get(k) > c) m.set(k, c);
      };
      for (const y of out[abr].areas) {
        if (y === area) continue;
        for (const [k, r] of intra[abr][y]) put(k, r.cost);
      }
      if (area !== 0 && backboneInter) for (const [k, r] of backboneInter) put(k, r.cost);
      return m;
    };
    const abrs = (area) => devsIn(area).filter((x) => out[x].abr);
    const interBB = {};
    for (const dev of devsIn(0)) {
      const m = /* @__PURE__ */ new Map();
      for (const b of abrs(0)) {
        if (b === dev) continue;
        const rb = dist[dev][0].get(b);
        if (!rb) continue;
        for (const [k, c] of summariesInto(b, 0, null)) addReach(m, k, { cost: rb.cost + c, paths: rb.paths });
      }
      interBB[dev] = m;
    }
    const interNB = {};
    for (const dev of Object.keys(out)) {
      if (out[dev].abr) continue;
      const m = /* @__PURE__ */ new Map();
      for (const area of out[dev].areas) {
        if (area === 0) continue;
        for (const b of abrs(area)) {
          const rb = dist[dev][area].get(b);
          if (!rb) continue;
          for (const [k, c] of summariesInto(b, area, interBB[b] ?? null)) addReach(m, k, { cost: rb.cost + c, paths: rb.paths });
        }
      }
      interNB[dev] = m;
    }
    for (const dev of Object.keys(out)) {
      const s = out[dev];
      if (!s.rid) continue;
      const connected = new Set(l3Ifs(d, dev).map((i) => pkey(networkOf(i.ip, i.prefix), i.prefix)));
      const best = /* @__PURE__ */ new Map();
      for (const area of s.areas) {
        for (const [k, r] of intra[dev][area]) {
          if (k.startsWith("asbr:") || !r.paths.length) continue;
          upsert(best, k, "O", r);
        }
      }
      const inter = /* @__PURE__ */ new Map();
      for (const [k, r] of interBB[dev] ?? []) addReach(inter, k, r);
      for (const [k, r] of interNB[dev] ?? []) addReach(inter, k, r);
      for (const [k, r] of inter) {
        if (k.startsWith("asbr:") || !r.paths.length) continue;
        if (best.get(k)?.code === "O") continue;
        upsert(best, k, "O IA", r);
      }
      const inNonStub = s.areas.some((a) => !stubCfg(dev, a));
      const ext = /* @__PURE__ */ new Map();
      if (inNonStub) {
        for (const [asbr, list] of externals) {
          if (asbr === dev) continue;
          let toAsbr;
          for (const area of s.areas) {
            if (stubCfg(dev, area)) continue;
            const r = intra[dev][area].get(asbrKey(asbr));
            if (r && (!toAsbr || r.cost < toAsbr.cost)) toAsbr = r;
          }
          if (!toAsbr) toAsbr = inter.get(asbrKey(asbr));
          if (!toAsbr || !toAsbr.paths.length) continue;
          for (const e of list) {
            const k = pkey(e.net, e.prefix);
            const prev = ext.get(k);
            if (!prev || e.metric < prev.metric || e.metric === prev.metric && toAsbr.cost < prev.fwd)
              ext.set(k, { metric: e.metric, fwd: toAsbr.cost, paths: [...toAsbr.paths] });
            else if (e.metric === prev.metric && toAsbr.cost === prev.fwd) prev.paths = mergePaths(prev.paths, toAsbr.paths);
          }
        }
      }
      for (const [k, e] of ext) if (!best.has(k)) best.set(k, { code: "O E2", r: { cost: e.metric, paths: e.paths } });
      for (const [k, { code, r }] of best) {
        if (connected.has(k)) continue;
        const [net, p] = k.split("/");
        s.routes.push({ code, net, prefix: Number(p), metric: r.cost, paths: r.paths });
      }
      s.routes.sort((a, b) => ridInt(a.net) - ridInt(b.net) || a.prefix - b.prefix);
    }
    return out;
  }
  function mismatch(d, out, a, b) {
    if (a.prefix !== b.prefix || !sameSubnet(a.ip, b.ip, a.prefix)) return "subnet";
    if (a.area !== b.area) return "area";
    if (a.hello !== b.hello) return "hello";
    if (a.dead !== b.dead) return "dead";
    if (isStub(d.cfgs[a.dev].ospf, a.area) !== isStub(d.cfgs[b.dev].ospf, b.area)) return "stub";
    if (out[a.dev].rid === out[b.dev].rid) return "rid";
    return null;
  }
  function mergePaths(a, b) {
    const m = [...a];
    for (const p of b) if (!m.some((x) => x.nh === p.nh && x.ifname === p.ifname)) m.push(p);
    return m.sort((x, y) => ridInt(x.nh) - ridInt(y.nh));
  }
  function addReach(m, k, r) {
    const prev = m.get(k);
    if (!prev || r.cost < prev.cost) m.set(k, { cost: r.cost, paths: [...r.paths] });
    else if (r.cost === prev.cost) prev.paths = mergePaths(prev.paths, r.paths);
  }
  function upsert(best, k, code, r) {
    const prev = best.get(k);
    if (prev && prev.code === "O" && code !== "O") return;
    if (!prev || prev.code !== code || r.cost < prev.r.cost) best.set(k, { code, r: { cost: r.cost, paths: [...r.paths] } });
    else if (r.cost === prev.r.cost) prev.r.paths = mergePaths(prev.r.paths, r.paths);
  }

  // src/sim/query.ts
  var LabQuery = class {
    constructor(d, startup = {}) {
      this.d = d;
      this.startup = startup;
    }
    /** Running config saved to NVRAM (startup matches running). */
    saved(dev) {
      const s = this.startup[dev];
      return !!s && JSON.stringify(s) === JSON.stringify(this.d.cfgs[dev]);
    }
    /** OSPF state of a router (process, interfaces, neighbours, routes) or undefined. */
    ospf(dev) {
      return this.d.ospf[dev];
    }
    /** OSPF neighbours in FULL state on this router. */
    ospfFull(dev) {
      return (this.d.ospf[dev]?.nbrs ?? []).filter((n) => n.state === "FULL");
    }
    /** FULL adjacency between two routers (seen from both ends). */
    ospfAdjacent(a, b) {
      return this.ospfFull(a).some((n) => n.peerDev === b) && this.ospfFull(b).some((n) => n.peerDev === a);
    }
    /** Installed routing table (C/L/S/O...). */
    routes(dev) {
      return routeTable(this.d, dev);
    }
    /** Installed route for exactly net/prefix. */
    route(dev, net, prefix) {
      return routeTable(this.d, dev).find((e) => e.net === net && e.prefix === prefix);
    }
    errDisabled(dev, port) {
      return !!this.d.phys[pk(dev, this.canon(port))]?.errDisabled;
    }
    canon(port) {
      const m = /^([A-Za-z-]+)\s*(\d.*)$/.exec(port);
      return m && canonIf(m[1], m[2]) || port;
    }
    vlanExists(dev, vlan) {
      return vlanExists(this.d.cfgs[dev], vlan);
    }
    vlanName(dev, vlan) {
      return this.d.cfgs[dev].vlans[String(vlan)];
    }
    /** Logical port that carries a physical port (Po for bundle members). */
    port(dev, port) {
      return this.d.lportOfPhys[pk(dev, this.canon(port))] ?? this.d.lportByName[pk(dev, this.canon(port))];
    }
    /** Operational trunk carrying the VLAN in forwarding state on this end. */
    trunkCarries(dev, port, vlan) {
      const lp = this.port(dev, port);
      if (!lp || lp.opMode !== "trunk") return false;
      return !!egress(this.d, lp, vlan) && portForwards(this.d, dev, lp, vlan);
    }
    /** Operational trunk that lets the VLAN through (ignores STP state). */
    trunkAllows(dev, port, vlan) {
      const lp = this.port(dev, port);
      return !!lp && lp.opMode === "trunk" && !!egress(this.d, lp, vlan);
    }
    isTrunk(dev, port) {
      const lp = this.port(dev, port);
      return !!lp && lp.active && lp.opMode === "trunk";
    }
    /** PC sits in this VLAN (through its access port). */
    pcVlan(pc) {
      return pcNode(this.d, pc)?.vlan ?? null;
    }
    ping(from, ip) {
      return ping(this.d, from, ip);
    }
    pcIp(pc) {
      return this.d.pcs[pc]?.ip ?? null;
    }
    stpRoot(vlan) {
      const bridges = this.d.stp[vlan];
      if (!bridges) return null;
      for (const [dev, b] of Object.entries(bridges)) if (b.isRoot) {
        if (Object.values(bridges).some((o) => o !== b && o.rootMac === b.mac)) return dev;
      }
      return null;
    }
    etherchannel(dev, id) {
      const g = this.d.ec[dev]?.find((x) => x.id === id);
      return g ? { up: g.up, protocol: g.protocol, bundled: g.members.filter((m) => m.flag === "P").length } : null;
    }
    nativeMismatches() {
      return this.d.nativeMismatch;
    }
    /** All operational trunks between switches. */
    trunks() {
      return Object.values(this.d.lports).flat().filter((lp) => lp.active && lp.opMode === "trunk" && !lp.peerIsPc);
    }
    /** Running config of a switch (read-only use). */
    cfg(dev) {
      return this.d.cfgs[dev];
    }
    hostname(dev) {
      return this.d.cfgs[dev].hostname;
    }
    /** Physical port state (admin down, link up, EtherChannel flag). */
    phys(dev, port) {
      return this.d.phys[pk(dev, this.canon(port))];
    }
    /** Physical port config (mode, access VLAN, portfast, nonegotiate...). */
    portCfg(dev, port) {
      return this.d.cfgs[dev].ifaces[this.canon(port)];
    }
    /** STP state of the port that carries this physical port: FWD, BLK, BKN or null when not in the VLAN. */
    stpState(dev, port, vlan) {
      const lp = this.port(dev, port);
      if (!lp) return null;
      return this.d.stp[vlan]?.[dev]?.ports[lp.name]?.state ?? null;
    }
    /** Bridge priority including the VLAN id (sys-id-ext), or null if the VLAN is not on this switch. */
    bridgePriority(dev, vlan) {
      return this.d.stp[vlan]?.[dev]?.prio ?? null;
    }
    sviUp(dev, vlan) {
      return !!this.d.svis[dev]?.find((s) => s.vlan === vlan && s.up);
    }
  };

  // src/sim/runtime.ts
  var LabRuntime = class {
    constructor(def, applyInitial) {
      this.def = def;
      this.applyInitial = applyInitial;
      __publicField(this, "topo");
      __publicField(this, "running", {});
      __publicField(this, "startup", {});
      __publicField(this, "pcs", {});
      __publicField(this, "derived");
      __publicField(this, "logs", []);
      __publicField(this, "seen", /* @__PURE__ */ new Set());
      __publicField(this, "arp", /* @__PURE__ */ new Set());
      /** err-disabled ports ('dev|port'); sticky until shutdown or errdisable recovery */
      __publicField(this, "errdis", /* @__PURE__ */ new Set());
      __publicField(this, "seq", 0);
      __publicField(this, "t0", Date.now());
      __publicField(this, "listeners", /* @__PURE__ */ new Set());
      this.topo = buildTopo(def);
      this.reset();
    }
    /** Factory defaults plus the lab's initial config; nothing saved. */
    reset() {
      for (const sw of this.topo.switches) {
        this.running[sw.id] = defaultSwitchConfig(sw);
        this.running[sw.id].hostname = sw.id;
      }
      for (const pc of this.topo.pcs) this.pcs[pc.id] = clone(this.def.initialPcs?.[pc.id] ?? { ip: null, prefix: 24, gw: null });
      this.errdis.clear();
      this.derived = computeState(this.topo, this.running, this.pcs, this.errdis);
      this.applyInitial(this);
      this.derived = this.recompute();
      for (const sw of this.topo.switches) this.startup[sw.id] = clone(this.running[sw.id]);
      this.seen.clear();
      this.arp.clear();
      this.logs = [];
      this.emit();
    }
    onChange(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }
    emit() {
      for (const fn of this.listeners) fn();
    }
    timestamp() {
      const ms = Date.now() - this.t0 + 3723e3;
      const h = Math.floor(ms / 36e5);
      const m = Math.floor(ms / 6e4) % 60;
      const s = Math.floor(ms / 1e3) % 60;
      const f = ms % 1e3;
      const two = (n) => String(n).padStart(2, "0");
      return `*Mar  1 ${two(h)}:${two(m)}:${two(s)}.${String(f).padStart(3, "0")}`;
    }
    log(dev, msg) {
      this.logs.push({ dev, text: `${this.timestamp()}: ${msg}`, seq: ++this.seq });
      if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400);
    }
    /** Recompute after a config change and log what changed. */
    commit() {
      const prev = this.derived;
      this.derived = this.recompute();
      this.diffLogs(prev, this.derived);
      this.emit();
    }
    /** Derive, then settle err-disable (BPDU guard) and OSPF router-id selection. */
    recompute() {
      let d = computeState(this.topo, this.running, this.pcs, this.errdis);
      for (let i = 0; i < 4; i++) {
        let changed = false;
        for (const k of [...this.errdis]) {
          if (d.phys[k]?.adminDown) {
            this.errdis.delete(k);
            changed = true;
          }
        }
        const viol = new Set(bpduViolations(d));
        for (const k of viol) {
          if (this.errdis.has(k)) continue;
          const [dev, port] = k.split("|");
          this.errdis.add(k);
          this.log(dev, `%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port ${port} with BPDU Guard enabled. Disabling port.`);
          this.log(dev, `%PM-4-ERR_DISABLE: bpduguard error detected on ${shortIf(port)}, putting ${shortIf(port)} in err-disable state`);
          changed = true;
        }
        for (const k of [...this.errdis]) {
          const [dev, port] = k.split("|");
          if (viol.has(k) || !this.running[dev]?.errRecoveryBpdu) continue;
          this.errdis.delete(k);
          this.log(dev, `%PM-4-ERR_RECOVER: Attempting to recover from bpduguard err-disable state on ${shortIf(port)}`);
          changed = true;
        }
        for (const sw of this.topo.switches) {
          const o = this.running[sw.id].ospf;
          if (!o || o.activeRid || !d.ospf[sw.id]) continue;
          const rid = candidateRid(d, sw.id);
          if (rid) {
            o.activeRid = rid;
            changed = true;
          }
        }
        if (!changed) break;
        d = computeState(this.topo, this.running, this.pcs, this.errdis);
      }
      return d;
    }
    /** Hosts that sent or answered traffic become visible in MAC tables. */
    markSeen(hops, from) {
      if (!hops.length) return;
      for (const h of hops) {
        this.seen.add(h.outIf.mac);
        const owner = l3Ifs(this.derived, h.dev).find((i) => i.ip === h.ip);
        if (owner) this.seen.add(owner.mac);
      }
      void from;
    }
    hostname(dev) {
      return this.running[dev]?.hostname ?? dev;
    }
    objectives() {
      const q = new LabQuery(this.derived, this.startup);
      return this.def.objectives.map((o) => {
        let r;
        try {
          r = o.check(q);
        } catch {
          r = false;
        }
        const res = typeof r === "boolean" ? { ok: r } : r;
        return { id: o.id, title: o.title, hint: o.hint, ok: res.ok, detail: res.detail };
      });
    }
    save() {
      return {
        v: 1,
        running: clone(this.running),
        startup: clone(this.startup),
        pcs: clone(this.pcs),
        seen: [...this.seen],
        arp: [...this.arp],
        errdis: [...this.errdis]
      };
    }
    load(s) {
      if (s?.v !== 1) return false;
      for (const sw of this.topo.switches) {
        if (!s.running[sw.id]) return false;
        for (const p of sw.ports) if (!s.running[sw.id].ifaces[p]) return false;
      }
      this.running = clone(s.running);
      this.startup = clone(s.startup);
      this.pcs = clone(s.pcs);
      this.seen = new Set(s.seen);
      this.arp = new Set(s.arp);
      this.errdis = new Set(s.errdis ?? []);
      this.derived = this.recompute();
      this.emit();
      return true;
    }
    diffLogs(a, b) {
      const updown = (dev, name, was, is, admin) => {
        if (was === is) return;
        if (!is && admin) this.log(dev, `%LINK-5-CHANGED: Interface ${name}, changed state to administratively down`);
        else this.log(dev, `%LINK-3-UPDOWN: Interface ${name}, changed state to ${is ? "up" : "down"}`);
        this.log(dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to ${is ? "up" : "down"}`);
      };
      for (const [key, ps] of Object.entries(b.phys)) {
        const old = a.phys[key];
        if (old) updown(ps.dev, ps.port, old.up, ps.up, ps.adminDown);
        const of = old?.ec?.flag;
        const nf = ps.ec?.flag;
        const po = ps.ec ? "Po" + ps.ec.id : old?.ec ? "Po" + old.ec.id : "";
        if (of !== "P" && nf === "P") this.log(ps.dev, `%EC-5-BUNDLE: Interface ${shortIf(ps.port)} joined port-channel ${po}`);
        if (of === "P" && nf !== "P" && nf !== "D") this.log(ps.dev, `%EC-5-UNBUNDLE: Interface ${shortIf(ps.port)} left the port-channel ${po}`);
        if (of !== "s" && nf === "s") this.log(ps.dev, `%EC-5-CANNOT_BUNDLE2: ${shortIf(ps.port)} is not compatible with ${po} and will be suspended`);
      }
      for (const [dev, list] of Object.entries(b.lports)) {
        for (const lp of list) {
          if (!lp.isPo) continue;
          const old = a.lportByName[pk(dev, lp.name)];
          updown(dev, lp.name, old?.active ?? false, lp.active, lp.cfg.shutdown);
        }
      }
      for (const [dev, list] of Object.entries(b.svis)) {
        for (const s of list) {
          const old = a.svis[dev]?.find((x) => x.vlan === s.vlan);
          const wasUp = old?.up ?? false;
          if (wasUp !== s.up || old && old.adminDown !== s.adminDown) {
            const name = "Vlan" + s.vlan;
            if (old && old.adminDown !== s.adminDown)
              this.log(dev, s.adminDown ? `%LINK-5-CHANGED: Interface ${name}, changed state to administratively down` : `%LINK-3-UPDOWN: Interface ${name}, changed state to up`);
            if (wasUp !== s.up) this.log(dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to ${s.up ? "up" : "down"}`);
          }
        }
      }
      const mm = (x) => `${x.dev}|${x.port}`;
      const oldMm = new Set(a.nativeMismatch.map(mm));
      for (const m of b.nativeMismatch) {
        if (oldMm.has(mm(m))) continue;
        this.log(
          m.dev,
          `%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on ${m.port} (${m.native}), with ${this.hostname(m.peerDev)} ${m.peerPort} (${m.peerNative}).`
        );
      }
      const nbrKey = (n) => `${n.ifname}|${n.rid}`;
      for (const dev of /* @__PURE__ */ new Set([...Object.keys(a.ospf), ...Object.keys(b.ospf)])) {
        const pid = b.ospf[dev]?.pid ?? a.ospf[dev]?.pid;
        const oldFull = new Map((a.ospf[dev]?.nbrs ?? []).filter((n) => n.state === "FULL").map((n) => [nbrKey(n), n]));
        const newFull = new Map((b.ospf[dev]?.nbrs ?? []).filter((n) => n.state === "FULL").map((n) => [nbrKey(n), n]));
        for (const [k, n] of newFull)
          if (!oldFull.has(k)) this.log(dev, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${n.rid} on ${n.ifname} from LOADING to FULL, Loading Done`);
        for (const [k, n] of oldFull) {
          if (newFull.has(k)) continue;
          const ifUp = b.ospf[dev]?.ifs.some((i) => i.name === n.ifname && i.up);
          this.log(dev, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${n.rid} on ${n.ifname} from FULL to DOWN, Neighbor Down: ${ifUp ? "Dead timer expired" : "Interface down or detached"}`);
        }
        const mk = (m) => `${m.ifname}|${m.peerIp}|${m.kind}`;
        const oldMm2 = new Set((a.ospf[dev]?.mismatches ?? []).map(mk));
        for (const m of b.ospf[dev]?.mismatches ?? []) {
          if (oldMm2.has(mk(m))) continue;
          if (m.kind === "area") this.log(dev, `%OSPF-4-ERRRCV: Received invalid packet: mismatched area ID from ${m.peerIp}, ${m.ifname}`);
          if (m.kind === "rid") this.log(dev, `%OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id ${b.ospf[dev].rid} from ${m.peerIp} on interface ${m.ifname}`);
        }
      }
      for (const [vs, bridges] of Object.entries(b.stp)) {
        for (const [dev, br] of Object.entries(bridges)) {
          for (const [port, st] of Object.entries(br.ports)) {
            const was = a.stp[Number(vs)]?.[dev]?.ports[port]?.inconsistent;
            if (st.inconsistent && !was)
              this.log(dev, `%SPANTREE-2-BLOCK_PVID_LOCAL: Blocking ${port} on VLAN${vs.padStart(4, "0")}. Inconsistent local vlan.`);
            if (!st.inconsistent && was)
              this.log(dev, `%SPANTREE-2-UNBLOCK_CONSIST_PORT: Unblocking ${port} on VLAN${vs.padStart(4, "0")}. Port consistency restored.`);
          }
        }
      }
    }
  };

  // src/sim/index.ts
  function createLab(def) {
    return new LabRuntime(def, (rt) => {
      for (const sw of rt.topo.switches) {
        const text = def.initialConfig?.[sw.id];
        if (!text) continue;
        const s = new IosSession(rt, sw.id);
        s.mode = "config";
        for (const line of text.split("\n")) {
          const out = s.exec(line);
          if (out.some((l) => l.startsWith("%") && /Invalid|Incomplete|Ambiguous/.test(l)))
            throw new Error(`initial config for ${sw.id} failed at "${line}": ${out.join(" ")}`);
        }
      }
    });
  }
  function createSession(rt, dev) {
    return rt.topo.devices[dev].kind === "pc" ? new VpcsSession(rt, dev) : new IosSession(rt, dev);
  }
  function runScript(rt, dev, script, session) {
    const s = session ?? new IosSession(rt, dev);
    if (s.mode === "user") s.mode = "priv";
    const out = [];
    for (const line of script.split("\n")) {
      out.push(s.prompt() + line);
      out.push(...s.exec(line));
    }
    return out;
  }

  // src/sim-bridge/bridge.ts
  var import_mac_address = __toESM(require_mac_address());
  var MODEL_L2 = "WS-C2960-24TT-L";
  var MODEL_L3 = "WS-C3650-24PS";
  var TEMPLATES = {
    [MODEL_L2]: ["Fa0/1-24", "Gi0/1-2"],
    [MODEL_L3]: ["Gi1/0/1-24", "Gi1/1/1-4"]
  };
  var TOP_OPAQUE = /* @__PURE__ */ new Set(["app", "version", "nextId", "selected", "importReport", "sourceArchive"]);
  var DEVICE_OPAQUE = /* @__PURE__ */ new Set(["id", "name", "type", "x", "y", "w", "h", "mode", "config", "selected"]);
  var PC_FIELDS = /* @__PURE__ */ new Set(["enabled", "ports", "interfaces", "ip", "mask", "gateway", "mac", "vlan"]);
  var SWITCH_FIELDS = /* @__PURE__ */ new Set([
    "enabled",
    "ports",
    "interfaces",
    "gateway",
    "vlans",
    "vlanNames",
    "stpPriority",
    "stpPriorities",
    "ip",
    "mask"
  ]);
  var PHYS_FIELDS = /* @__PURE__ */ new Set(["mode", "vlan", "allowed", "nativeVlan", "enabled"]);
  var SVI_FIELDS = /* @__PURE__ */ new Set(["ip", "mask", "enabled", "vlan"]);
  var FEATURE_REASON = {
    staticRoutes: "Statik rota (router) Labber köprüsünde henüz yok (L4)",
    route: "Varsayılan rota (router) Labber köprüsünde henüz yok (L4)",
    acls: "ACL Labber'da yok (L5)",
    natOverload: "NAT Labber'da yok (L5)",
    natTranslations: "NAT çeviri tablosu Labber'da yok (L5)",
    ospf: "AğLab OSPF modeli köprüde eşlenmiyor (L4)",
    bgp: "BGP Labber'da yok (L5)",
    services: "Sunucu servisleri (DHCP/DNS/HTTP) Labber'da yok (L5)",
    startupConfig: "Kaydedilmiş startup-config köprüde henüz eşlenmiyor (L7)",
    portSecurity: "Port security Labber'da yok (L5)",
    errdisabled: "Port security err-disable durumu Labber'da yok (L5)",
    encapsulation: "Alt arayüz / dot1q Labber'da yok (L5)",
    parent: "Alt arayüz Labber'da yok (L5)",
    aclIn: "ACL Labber'da yok (L5)",
    aclOut: "ACL Labber'da yok (L5)",
    natRole: "NAT Labber'da yok (L5)",
    helperAddress: "DHCP relay Labber'da yok (L5)",
    dhcpLease: "DHCP istemci kirası Labber'da yok (L5)"
  };
  var sortNum = (a, b) => a - b;
  function needsEncapFor(model) {
    return /3560/.test(model);
  }
  function canonPort(name) {
    const m = /^([A-Za-z-]+)\s*(\d+(?:\/\d+)*)$/.exec(name);
    if (!m) return null;
    const full = canonIf(m[1], m[2]);
    if (!full) return null;
    if (/^(Port-channel|Vlan|Loopback)/.test(full)) return null;
    return full;
  }
  function macToInt(mac) {
    return BigInt("0x" + mac.replace(/[:.]/g, ""));
  }
  function intToDotted(v) {
    const hex = v.toString(16).padStart(12, "0");
    return `${hex.slice(0, 4)}.${hex.slice(4, 8)}.${hex.slice(8, 12)}`;
  }
  function vlanId(v) {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 4094 ? n : null;
  }
  function toLabber(input) {
    const report = { unsupported: [], rejected: [], engineDecision: "labber", reasons: [], portNames: {} };
    const unsupported = (device, field, reason) => report.unsupported.push({ device, field, reason });
    const reject = (device, item, reason) => report.rejected.push({ device, item, reason });
    for (const key of Object.keys(input))
      if (!TOP_OPAQUE.has(key) && key !== "devices" && key !== "links")
        unsupported("*", key, "Tanınmayan üst düzey alan");
    const devices = Array.isArray(input.devices) ? input.devices : [];
    const links = Array.isArray(input.links) ? input.links : [];
    let resolveMac = null;
    try {
      const resolver = import_mac_address.default.createResolver();
      resolver(devices[0] ?? {}, devices);
      resolveMac = (d) => resolver(d, devices);
    } catch (error) {
      reject("*", "mac", "MAC adresi doğrulaması başarısız: " + String(error.message ?? error));
    }
    const def = {
      id: "aglab-bridge",
      title: "",
      summary: "",
      level: "Başlangıç",
      tags: [],
      brief: [],
      devices: [],
      links: [],
      objectives: [],
      solution: {},
      view: { w: 1e3, h: 700 }
    };
    const running = {};
    const pcs = {};
    const canonByDevice = {};
    const usedMacs = /* @__PURE__ */ new Map();
    const ids = /* @__PURE__ */ new Set();
    const claimMac = (dev, mac) => {
      const other = usedMacs.get(mac);
      if (other !== void 0) reject(dev, "mac", `MAC ${mac} ${other} ile çakışıyor`);
      else usedMacs.set(mac, dev);
    };
    for (const d of devices) {
      const id = String(d.id);
      if (ids.has(id)) {
        reject(id, "id", "Yinelenen cihaz kimliği");
        continue;
      }
      ids.add(id);
      const fields = d.type === "PC" ? PC_FIELDS : d.type === "Switch" ? SWITCH_FIELDS : null;
      if (!fields) {
        unsupported(id, "type", `${d.type} cihaz tipi Labber köprüsünde yok` + (d.type === "Router" ? " (L4)" : " (L5)"));
        continue;
      }
      for (const key of Object.keys(d))
        if (!DEVICE_OPAQUE.has(key) && !fields.has(key))
          unsupported(id, key, FEATURE_REASON[key] ?? "Labber'da karşılığı olmayan alan");
      if (d.enabled === false) unsupported(id, "enabled", "Kapalı cihaz (güç) Labber'da modellenmiyor (L2)");
      if (d.type === "PC") {
        const ports2 = d.ports ?? ["eth0"];
        if (ports2.length !== 1 || ports2[0] !== "eth0") reject(id, "ports", "PC yalnızca tek eth0 portuyla modellenir");
        for (const [name, iface] of Object.entries(d.interfaces ?? {})) {
          if (name !== "eth0") {
            reject(id, name, "PC arayüzü yalnızca eth0 olabilir");
            continue;
          }
          for (const key of Object.keys(iface))
            if (key !== "enabled") unsupported(id, `interfaces.eth0.${key}`, "Labber'da karşılığı olmayan PC arayüz alanı");
          if (iface.enabled === false) unsupported(id, "interfaces.eth0.enabled", "Kapalı PC NIC'i Labber'da modellenmiyor (L2)");
        }
        const ip = d.ip ?? "";
        const prefix = d.mask ? maskToPrefix(d.mask) : null;
        if (ip && !isIp(ip)) reject(id, "ip", "Geçersiz IPv4 adresi: " + ip);
        if (ip && prefix === null) reject(id, "mask", "Geçersiz alt ağ maskesi: " + d.mask);
        if (d.gateway && !isIp(d.gateway)) reject(id, "gateway", "Geçersiz ağ geçidi: " + d.gateway);
        pcs[id] = {
          ip: ip && isIp(ip) && prefix !== null ? ip : null,
          prefix: prefix ?? 24,
          gw: d.gateway && isIp(d.gateway) ? d.gateway : null
        };
        const mac = resolveMac ? intToDotted(macToInt(resolveMac(d))) : "0000.0000.0000";
        claimMac(id, mac);
        const pc = { id, kind: "pc", mac, x: Number(d.x ?? 0), y: Number(d.y ?? 0) };
        def.devices.push(pc);
        canonByDevice[id] = { eth0: "eth0" };
        report.portNames[id] = { eth0: "eth0" };
        continue;
      }
      if (d.ip || d.mask) unsupported(id, "ip", "Cihaz düzeyi switch IP adresi; yönetim adresi SVI üzerinden verilir");
      const ifaces = d.interfaces ?? {};
      const svis = Object.entries(ifaces).filter(([n]) => /^vlan\d+$/i.test(n));
      const l3 = svis.some(([, i]) => !!i.ip);
      const pktModel = typeof d.config?.packetTracerModel === "string" ? d.config.packetTracerModel : "";
      const model = pktModel || (l3 ? MODEL_L3 : MODEL_L2);
      const sourcePorts = d.ports ?? (TEMPLATES[model] ? ports(...TEMPLATES[model]).map((p) => p) : []);
      const portMap = {};
      const canonPorts = [];
      for (const p of sourcePorts) {
        const c = canonPort(p);
        if (!c) {
          reject(id, p, "Eşlenemeyen port adı");
          continue;
        }
        if (portMap[c] !== void 0) {
          reject(id, p, `Port ${c} iki kez tanımlı (${portMap[c]})`);
          continue;
        }
        portMap[c] = p;
        canonPorts.push(c);
      }
      if (!d.ports) {
        const used = [
          ...Object.keys(d.interfaces ?? {}),
          ...links.flatMap((l) => String(l.a) === id ? [String(l.portA)] : String(l.b) === id ? [String(l.portB)] : [])
        ];
        for (const name of used) {
          const c = canonPort(name);
          if (c && portMap[c] === c) portMap[c] = name;
        }
      }
      canonByDevice[id] = Object.fromEntries(Object.entries(portMap).map(([c, o]) => [o, c]));
      report.portNames[id] = portMap;
      const sw = {
        id,
        kind: "switch",
        model,
        mac: "0000.0000.0000",
        ports: canonPorts,
        x: Number(d.x ?? 0),
        y: Number(d.y ?? 0),
        ...l3 ? { l3: true } : {},
        ...needsEncapFor(model) ? { needsEncap: true } : {}
      };
      if (resolveMac) {
        const v = macToInt(resolveMac(d));
        sw.mac = intToDotted(0x02n << 40n | (v & 0xffffffffn) << 8n);
      }
      claimMac(id, sw.mac);
      def.devices.push(sw);
      const cfg = defaultSwitchConfig(sw);
      cfg.hostname = d.name || id;
      for (const v of d.vlans ?? [1]) {
        const n = vlanId(v);
        if (n === null) {
          reject(id, `vlans.${v}`, "Geçersiz VLAN kimliği");
          continue;
        }
        cfg.vlans[String(n)] = d.vlanNames?.[String(n)] ?? cfg.vlans[String(n)] ?? defaultVlanName(n);
      }
      for (const k of Object.keys(d.vlanNames ?? {}))
        if (!(d.vlans ?? [1]).map(Number).includes(Number(k))) reject(id, `vlanNames.${k}`, "Veritabanında olmayan VLAN için ad");
      if (d.gateway) {
        if (isIp(d.gateway)) cfg.defaultGateway = d.gateway;
        else reject(id, "gateway", "Geçersiz ağ geçidi: " + d.gateway);
      }
      const prio = (v, where) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 61440 || n % 4096 !== 0) {
          reject(id, where, "STP önceliği 0-61440 arasında 4096'nın katı olmalı: " + String(v));
          return null;
        }
        return n;
      };
      if (d.stpPriority !== void 0) {
        const g = prio(d.stpPriority, "stpPriority");
        if (g !== null) {
          for (const v of Object.keys(cfg.vlans)) if (!RESERVED_VLANS.includes(Number(v)) || v === "1") cfg.stpPriority[v] = g;
        }
      }
      for (const [v, p] of Object.entries(d.stpPriorities ?? {})) {
        const n = vlanId(v);
        const value = prio(p, `stpPriorities.${v}`);
        if (n === null) reject(id, `stpPriorities.${v}`, "Geçersiz VLAN kimliği");
        else if (value !== null) cfg.stpPriority[String(n)] = value;
      }
      for (const [name, iface] of Object.entries(ifaces)) {
        if (/^vlan\d+$/i.test(name)) {
          const v = vlanId(name.slice(4));
          if (v === null) {
            reject(id, name, "Geçersiz SVI adı");
            continue;
          }
          for (const key of Object.keys(iface))
            if (!SVI_FIELDS.has(key)) unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? "Labber'da karşılığı olmayan SVI alanı");
          const svi = cfg.svis[String(v)] ?? defaultSvi(v);
          svi.shutdown = iface.enabled === false;
          if (iface.ip) {
            const pre = iface.mask ? maskToPrefix(iface.mask) : null;
            if (!isIp(iface.ip) || pre === null) reject(id, name, "Geçersiz SVI IPv4 adresi/maskesi");
            else svi.ip = { addr: iface.ip, mask: iface.mask };
          }
          cfg.svis[String(v)] = svi;
          continue;
        }
        const c = canonPort(name);
        if (!c || portMap[c] === void 0) {
          reject(id, name, c ? "Arayüz cihazın port listesinde yok" : "Eşlenemeyen arayüz adı");
          continue;
        }
        for (const key of Object.keys(iface))
          if (!PHYS_FIELDS.has(key))
            unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? (key === "ip" || key === "mask" ? "Switch fiziksel portunda IP (routed port) köprüde henüz yok (L4)" : "Labber'da karşılığı olmayan arayüz alanı"));
        const phys = cfg.ifaces[c] ?? defaultPhys();
        const mode = iface.mode ?? "access";
        if (mode !== "access" && mode !== "trunk") {
          reject(id, `${name}.mode`, "Bilinmeyen port modu: " + mode);
          continue;
        }
        phys.mode = mode;
        phys.shutdown = iface.enabled === false;
        const access = vlanId(iface.vlan ?? 1);
        if (access === null) reject(id, `${name}.vlan`, "Geçersiz access VLAN");
        else phys.accessVlan = access;
        const native = vlanId(iface.nativeVlan ?? 1);
        if (native === null) reject(id, `${name}.nativeVlan`, "Geçersiz native VLAN");
        else phys.nativeVlan = native;
        const allowed = (iface.allowed ?? []).map(vlanId);
        if (allowed.some((x) => x === null)) reject(id, `${name}.allowed`, "Geçersiz izinli VLAN listesi");
        else phys.allowed = [...new Set(allowed)].sort(sortNum);
        if (mode === "trunk" && sw.needsEncap) phys.encapDot1q = true;
        cfg.ifaces[c] = phys;
      }
      for (const c of canonPorts)
        if (!Object.keys(ifaces).some((n) => canonPort(n) === c)) {
          const phys = cfg.ifaces[c] ?? defaultPhys();
          phys.mode = "access";
          phys.allowed = [];
          cfg.ifaces[c] = phys;
        }
      running[id] = cfg;
    }
    const usedPort = /* @__PURE__ */ new Map();
    links.forEach((l, index) => {
      const tag = `links[${index}]`;
      for (const key of Object.keys(l))
        if (!["a", "portA", "b", "portB", "up"].includes(key)) unsupported(tag, key, "Labber'da karşılığı olmayan bağlantı alanı");
      if (l.up === false) unsupported(tag, "up", "Kopuk/çıkarılmış kablo (up:false) Labber'da modellenmiyor (L2)");
      const end = (dev, port) => {
        if (!ids.has(dev)) {
          reject(tag, `${dev}:${port}`, "Bağlantı bilinmeyen cihaza gidiyor");
          return null;
        }
        const map = canonByDevice[dev];
        if (!map) return null;
        const c = map[port] ?? (port === "eth0" ? void 0 : (() => {
          const k = canonPort(port);
          return k && Object.values(map).includes(k) ? k : void 0;
        })());
        if (!c) {
          reject(tag, `${dev}:${port}`, "Bağlantı portu cihazda yok ya da eşlenemedi");
          return null;
        }
        const key = `${dev}|${c}`;
        if (usedPort.has(key)) {
          reject(tag, `${dev}:${port}`, "Port birden çok bağlantıda kullanılıyor");
          return null;
        }
        usedPort.set(key, tag);
        return [dev, c];
      };
      const a = end(String(l.a), String(l.portA));
      const b = end(String(l.b), String(l.portB));
      if (a && b) def.links.push({ a, b });
    });
    const reasons = /* @__PURE__ */ new Set();
    for (const u of report.unsupported) reasons.add(u.reason);
    for (const r of report.rejected) reasons.add("Reddedildi: " + r.reason);
    report.reasons = [...reasons].sort();
    report.engineDecision = report.unsupported.length || report.rejected.length ? "legacy" : "labber";
    return { def, running, pcs, report };
  }
  function createRuntime(result) {
    return new LabRuntime(result.def, (rt) => {
      for (const [id, cfg] of Object.entries(result.running)) rt.running[id] = clone(cfg);
      for (const [id, pc] of Object.entries(result.pcs)) rt.pcs[id] = clone(pc);
    });
  }
  var BridgeError = class extends Error {
  };
  function toAglab(rt, original) {
    const out = clone(original);
    const portNames = toLabber(original).report.portNames;
    for (const d of out.devices) {
      const id = String(d.id);
      if (d.type === "PC" && rt.pcs[id]) {
        const pc = rt.pcs[id];
        const ip = pc.ip ?? "";
        if (d.ip !== void 0 || ip) d.ip = ip;
        if (pc.ip !== null && (d.mask !== void 0 || pc.ip)) d.mask = prefixToMask(pc.prefix);
        const gw2 = pc.gw ?? "";
        if (d.gateway !== void 0 || gw2) d.gateway = gw2;
        continue;
      }
      if (d.type !== "Switch" || !rt.running[id]) continue;
      const cfg = rt.running[id];
      const fail = (what) => {
        throw new BridgeError(`${id}: ${what} AğLab modelinde ifade edilemiyor`);
      };
      if (cfg.hostname !== (d.name || id)) d.name = cfg.hostname;
      if (cfg.pos && Object.keys(cfg.pos).length) fail("Port-channel");
      if (cfg.loopbacks && Object.keys(cfg.loopbacks).length) fail("Loopback");
      if (cfg.ospf) fail("OSPF");
      if (cfg.routes.length) fail("statik rota");
      if (cfg.ipRouting) fail("ip routing");
      if (cfg.stpMode !== "pvst") fail("spanning-tree mode " + cfg.stpMode);
      if (cfg.bpduguardDefault) fail("spanning-tree portfast bpduguard default");
      if (cfg.errRecoveryBpdu || cfg.errRecoveryInterval !== void 0) fail("errdisable recovery");
      const gw = cfg.defaultGateway ?? "";
      if (d.gateway !== void 0 || gw) d.gateway = gw;
      const hadOne = (original.devices.find((x) => String(x.id) === id)?.vlans ?? [1]).map(Number).includes(1);
      const vlans = Object.keys(cfg.vlans).map(Number).filter((v) => !RESERVED_VLANS.slice(1).includes(v) && (v !== 1 || hadOne)).sort(sortNum);
      if (d.vlans !== void 0 || vlans.join() !== "1") d.vlans = vlans;
      const names = {};
      for (const v of vlans) {
        const n = cfg.vlans[String(v)];
        const keep = d.vlanNames !== void 0 && Object.prototype.hasOwnProperty.call(d.vlanNames, String(v));
        if (keep || n !== defaultVlanName(v) && !(v === 1 && n === "default")) names[String(v)] = n;
      }
      if (d.vlanNames !== void 0 || Object.keys(names).length) d.vlanNames = names;
      const prios = {};
      for (const [v, p] of Object.entries(cfg.stpPriority)) {
        const explicit = d.stpPriorities !== void 0 && Object.prototype.hasOwnProperty.call(d.stpPriorities, v);
        if (explicit || d.stpPriority === void 0 || p !== d.stpPriority) prios[v] = p;
      }
      if (d.stpPriorities !== void 0 || Object.keys(prios).length) d.stpPriorities = prios;
      const back = portNames[id] ?? {};
      d.interfaces = d.interfaces ?? {};
      for (const [canon, phys] of Object.entries(cfg.ifaces)) {
        const name = back[canon];
        if (!name) continue;
        if (phys.mode !== "access" && phys.mode !== "trunk") fail(`${canon} modu ${phys.mode}`);
        if (phys.channel) fail(`${canon} channel-group`);
        if (phys.routed) fail(`${canon} routed port`);
        if (phys.allowed === null) fail(`${canon} "allowed vlan all"`);
        if (phys.portfast) fail(`${canon} portfast`);
        if (phys.nonegotiate) fail(`${canon} nonegotiate`);
        if (phys.description) fail(`${canon} description`);
        if (phys.bpduguard !== void 0) fail(`${canon} bpduguard`);
        if (phys.l3 || phys.ip) fail(`${canon} L3 ayarı`);
        const prev = d.interfaces[name];
        const def = defaultPhys();
        const iface = prev ? { ...prev } : {};
        const put = (key, value, dflt) => {
          if (prev && key in prev) iface[key] = value;
          else if (JSON.stringify(value) !== JSON.stringify(dflt)) iface[key] = value;
        };
        put("mode", phys.mode, "access");
        put("vlan", phys.accessVlan, def.accessVlan);
        put("allowed", phys.allowed, []);
        put("nativeVlan", phys.nativeVlan, def.nativeVlan);
        put("enabled", !phys.shutdown, true);
        if (prev || Object.keys(iface).length) d.interfaces[name] = iface;
      }
      for (const [v, svi] of Object.entries(cfg.svis)) {
        const name = "vlan" + v;
        if (svi.description) fail(`Vlan${v} description`);
        if (svi.l3) fail(`Vlan${v} L3/OSPF ayarı`);
        const prev = d.interfaces[name];
        if (!prev && !svi.ip && JSON.stringify(svi) === JSON.stringify(defaultSvi(Number(v)))) continue;
        const iface = prev ? { ...prev } : { vlan: Number(v) };
        if (svi.ip) {
          iface.ip = svi.ip.addr;
          iface.mask = svi.ip.mask;
        } else {
          if (prev?.ip !== void 0) iface.ip = "";
          if (prev?.mask !== void 0) iface.mask = "";
        }
        if (prev?.enabled !== void 0 || svi.shutdown) iface.enabled = !svi.shutdown;
        d.interfaces[name] = iface;
      }
    }
    return out;
  }
  return __toCommonJS(index_exports);
})();
