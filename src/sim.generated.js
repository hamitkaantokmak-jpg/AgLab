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
    IosSession: () => IosSession,
    LABBER_LABS: () => LABS,
    LabQuery: () => LabQuery,
    MODEL_L2: () => MODEL_L2,
    MODEL_L3: () => MODEL_L3,
    VpcsSession: () => VpcsSession,
    canonPort: () => canonPort,
    cliImport: () => cliImport,
    createLab: () => createLab,
    createRuntime: () => createRuntime,
    createSession: () => createSession,
    importReportWithCli: () => importReportWithCli,
    modeledDiffs: () => modeledDiffs,
    modeledProjection: () => modeledProjection,
    needsEncapFor: () => needsEncapFor,
    pingTrace: () => pingTrace,
    runScript: () => runScript,
    toAglab: () => toAglab,
    toLabber: () => toLabber
  });

  // src/sim/types.ts
  var noHardwareFaults = () => ({ cut: /* @__PURE__ */ new Set(), off: /* @__PURE__ */ new Set(), nicDown: /* @__PURE__ */ new Set() });

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
    if (def.router) {
      for (const p of def.ports) ifaces[p] = { ...defaultPhys(), routed: true, ip: null, shutdown: true };
      return {
        hostname: "Router",
        vlans: {},
        ifaces,
        pos: {},
        svis: {},
        stpMode: "pvst",
        stpPriority: {},
        ipRouting: true,
        routes: [],
        defaultGateway: null
      };
    }
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
  function ipToInt(ip2) {
    const p = ip2.split(".");
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
  function networkOf(ip2, len) {
    return intToIp((ipToInt(ip2) & prefixMaskInt(len)) >>> 0);
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
  function normalizeMac(s) {
    const t = s.trim().toLowerCase();
    let hex;
    const dotted = /^([0-9a-f]{1,4})\.([0-9a-f]{1,4})\.([0-9a-f]{1,4})$/.exec(t);
    if (dotted) hex = dotted.slice(1).map((g) => g.padStart(4, "0")).join("");
    else if (/^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/.test(t)) hex = t.replace(/[:-]/g, "");
    else if (/^[0-9a-f]{12}$/.test(t)) hex = t;
    else return null;
    return `${hex.slice(0, 4)}.${hex.slice(4, 8)}.${hex.slice(8, 12)}`;
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
  function buildTopo(lab14) {
    const devices = {};
    for (const d of lab14.devices) devices[d.id] = d;
    const peer = {};
    for (const l of lab14.links) {
      peer[pk(l.a[0], l.a[1])] = { dev: l.b[0], port: l.b[1] };
      peer[pk(l.b[0], l.b[1])] = { dev: l.a[0], port: l.a[1] };
    }
    const switches = lab14.devices.filter((d) => d.kind === "switch");
    const pcs = lab14.devices.filter((d) => d.kind === "pc");
    const pcAttach = {};
    for (const pc of pcs) pcAttach[pc.id] = peer[pk(pc.id, "eth0")] ?? null;
    return { lab: lab14, devices, switches, pcs, peer, pcAttach };
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
  function derive(topo, cfgs, pcs, errdis = /* @__PURE__ */ new Set(), hw = noHardwareFaults()) {
    const phys = {};
    const endPowered = (dev, port) => !hw.off.has(dev) && !hw.cut.has(pk(dev, port)) && !(topo.devices[dev]?.kind === "pc" && hw.nicDown.has(dev));
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
        const peerUp = !!peer && endPowered(peer.dev, peer.port) && (peerIsPc || !adminDown(peer.dev, peer.port) && !errdis.has(pk(peer.dev, peer.port)));
        const up = !down && !err && endPowered(sw.id, port) && peerUp;
        phys[key] = { dev: sw.id, port, peer, peerIsPc, adminDown: down, errDisabled: err, up };
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
      hw,
      ospf: {},
      dups: []
    };
    const allVlans = /* @__PURE__ */ new Set();
    for (const c of Object.values(cfgs))
      for (const v of Object.keys(c.vlans)) if (Number(v) < 1002 || Number(v) > 1005) allVlans.add(Number(v));
    for (const v of [...allVlans].sort((a, b) => a - b)) d.stp[v] = computeStp(d, v);
    for (const sw of topo.switches) {
      const cfg = cfgs[sw.id];
      const out = [];
      for (const [vs, svi2] of Object.entries(cfg.svis)) {
        const v = Number(vs);
        const hasFwd = (d.lports[sw.id] ?? []).some((lp) => portForwards(d, sw.id, lp, v));
        const up = !svi2.shutdown && vlanExists(cfg, v) && hasFwd && !hw.off.has(sw.id);
        out.push({
          dev: sw.id,
          vlan: v,
          adminDown: svi2.shutdown,
          up,
          status: svi2.shutdown ? "administratively down" : vlanExists(cfg, v) ? "up" : "down",
          ip: svi2.ip?.addr ?? null,
          mask: svi2.ip?.mask ?? null,
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
      if (!vlanExists(cfg, v) || d.hw.off.has(sw.id)) continue;
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
    const rounds = Object.keys(bridges).length + 1;
    for (let iter = 0; iter < rounds; iter++) {
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
      if (d.hw.cut.has(key) || d.hw.off.has(ps.dev) || d.hw.off.has(ps.peer.dev)) continue;
      if (!bpduGuardOn(d.cfgs[ps.dev], ps.port)) continue;
      const peer = d.phys[pk(ps.peer.dev, ps.peer.port)];
      if (!peer || peer.adminDown || isRoutedPort(d.cfgs, ps.peer.dev, ps.peer.port)) continue;
      out.push(key);
    }
    return out;
  }

  // src/sim/acl.ts
  var ANY = { addr: "0.0.0.0", wild: "255.255.255.255" };
  var hostAddr = (ip2) => ({ addr: ip2, wild: "0.0.0.0" });
  var TCP_NAMES = { ftp: 21, telnet: 23, smtp: 25, www: 80, pop3: 110 };
  var UDP_NAMES = { domain: 53, bootps: 67, bootpc: 68, tftp: 69, snmp: 161 };
  var BOTH = { domain: 53 };
  var ICMP_TYPES = ["echo", "echo-reply", "unreachable", "time-exceeded"];
  function aclKind(name) {
    if (!/^\d+$/.test(name)) return null;
    const n = Number(name);
    return n >= 1 && n <= 99 ? "standard" : n >= 100 && n <= 199 ? "extended" : null;
  }
  var u32 = (ip2) => ipToInt(ip2) >>> 0;
  function normAddr(addr, wild) {
    return { addr: intToIp2((u32(addr) & ~u32(wild)) >>> 0), wild };
  }
  function intToIp2(n) {
    return [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255].join(".");
  }
  function addrMatches(a, ip2) {
    const w = u32(a.wild);
    return (u32(ip2) & ~w) >>> 0 === (u32(a.addr) & ~w) >>> 0;
  }
  function portMatches(p, v) {
    if (!p) return true;
    if (v === void 0) return false;
    switch (p.op) {
      case "eq":
        return v === p.a;
      case "neq":
        return v !== p.a;
      case "gt":
        return v > p.a;
      case "lt":
        return v < p.a;
      case "range":
        return v >= p.a && v <= p.b;
    }
  }
  function entryMatches(e, pkt) {
    if (e.proto !== "ip" && e.proto !== pkt.proto) return false;
    if (!addrMatches(e.src, pkt.src)) return false;
    if (e.dst && !addrMatches(e.dst, pkt.dst)) return false;
    if (e.icmpType && e.icmpType !== pkt.icmpType) return false;
    if (!portMatches(e.srcPort, pkt.sport) || !portMatches(e.dstPort, pkt.dport)) return false;
    return true;
  }
  function aclDecide(acl, pkt) {
    if (!acl || !acl.entries.length) return { permit: true, seq: null };
    for (const e of acl.entries) if (entryMatches(e, pkt)) return { permit: e.action === "permit", seq: e.seq };
    return { permit: false, seq: null };
  }
  function l3OptsOf(cfg, ifname) {
    if (!cfg) return void 0;
    if (ifname.startsWith("Vlan")) return cfg.svis[ifname.slice(4)]?.l3;
    if (ifname.includes(".")) return cfg.subifs?.[ifname]?.l3;
    return cfg.ifaces[ifname]?.l3;
  }
  var AclSyntax = class {
    constructor(token) {
      this.token = token;
    }
  };
  function parseEntry(tok, type, seq) {
    let i = 0;
    const need = () => {
      if (i >= tok.length) throw new AclSyntax(-1);
      return tok[i++];
    };
    const action = need().toLowerCase();
    if (action !== "permit" && action !== "deny") throw new AclSyntax(0);
    const addr = (wildRequired) => {
      const t = need().toLowerCase();
      if (t === "any") return { ...ANY };
      if (t === "host") {
        const h = need();
        if (!isIp(h)) throw new AclSyntax(i - 1);
        return hostAddr(h);
      }
      if (!isIp(t)) throw new AclSyntax(i - 1);
      const w = tok[i];
      if (w && isIp(w)) {
        i++;
        return normAddr(t, w);
      }
      if (wildRequired) throw new AclSyntax(i);
      return hostAddr(t);
    };
    if (type === "standard") {
      const src2 = addr(false);
      if (i < tok.length) throw new AclSyntax(i);
      return { seq, action, proto: "ip", src: src2 };
    }
    const proto = need().toLowerCase();
    if (!["ip", "icmp", "tcp", "udp"].includes(proto)) throw new AclSyntax(i - 1);
    const port = () => {
      if (proto !== "tcp" && proto !== "udp") return void 0;
      const op = tok[i]?.toLowerCase();
      if (!op || !["eq", "neq", "gt", "lt", "range"].includes(op)) return void 0;
      i++;
      const num = () => {
        const t = need().toLowerCase();
        const names = proto === "tcp" ? { ...TCP_NAMES, ...BOTH } : UDP_NAMES;
        const v = /^\d+$/.test(t) ? Number(t) : names[t];
        if (v === void 0 || v < 0 || v > 65535) throw new AclSyntax(i - 1);
        return v;
      };
      const a = num();
      return op === "range" ? { op: "range", a, b: num() } : { op, a };
    };
    const src = addr(true);
    const srcPort = port();
    const dst = addr(true);
    const dstPort = port();
    let icmpType;
    if (proto === "icmp" && i < tok.length && ICMP_TYPES.includes(tok[i].toLowerCase())) icmpType = tok[i++].toLowerCase();
    if (i < tok.length) throw new AclSyntax(i);
    return {
      seq,
      action,
      proto,
      src,
      dst,
      ...srcPort ? { srcPort } : {},
      ...dstPort ? { dstPort } : {},
      ...icmpType ? { icmpType } : {}
    };
  }
  function nextSeq(acl) {
    return (acl.entries.at(-1)?.seq ?? 0) + 10;
  }
  function insertEntry(acl, e) {
    if (acl.entries.some((x) => x.seq === e.seq)) return [`% Duplicate sequence number`];
    acl.entries.push(e);
    acl.entries.sort((a, b) => a.seq - b.seq);
  }
  var PORT_NAME = { 21: "ftp", 23: "telnet", 25: "smtp", 53: "domain", 80: "www", 110: "pop3", 67: "bootps", 68: "bootpc", 69: "tftp", 161: "snmp" };
  function fmtPort(p, proto) {
    if (!p) return "";
    const n = (v) => proto === "udp" && v === 80 ? "80" : PORT_NAME[v] ?? String(v);
    return p.op === "range" ? ` range ${n(p.a)} ${n(p.b)}` : ` ${p.op} ${n(p.a)}`;
  }
  function fmtAddr(a, standardShow = false) {
    if (a.wild === "255.255.255.255") return "any";
    if (a.wild === "0.0.0.0") return standardShow ? a.addr : `host ${a.addr}`;
    return standardShow ? `${a.addr}, wildcard bits ${a.wild}` : `${a.addr} ${a.wild}`;
  }
  function entryText(e, type) {
    const act = e.action === "deny" ? "deny  " : "permit";
    if (type === "standard") {
      const src = e.src.wild === "255.255.255.255" ? "any" : e.src.wild === "0.0.0.0" ? e.src.addr : `${e.src.addr} ${e.src.wild}`;
      return `${act} ${src}`;
    }
    return `${act} ${e.proto} ${fmtAddr(e.src)}${fmtPort(e.srcPort, e.proto)} ${fmtAddr(e.dst)}${fmtPort(e.dstPort, e.proto)}${e.icmpType ? " " + e.icmpType : ""}`;
  }
  function aclConfigLines(cfg) {
    const o = [];
    const names = Object.keys(cfg.acls ?? {});
    const numbered = names.filter((n) => aclKind(n)).sort((a, b) => Number(a) - Number(b));
    for (const n of numbered) for (const e of cfg.acls[n].entries) o.push(`access-list ${n} ${entryText(e, cfg.acls[n].type)}`);
    for (const n of names.filter((x) => !aclKind(x)).sort()) {
      const acl = cfg.acls[n];
      o.push(`ip access-list ${acl.type} ${n}`, ...acl.entries.map((e) => " " + entryText(e, acl.type)));
    }
    return o.length ? ["!", ...o] : [];
  }
  function showAccessLists(cfg, dev, hits, only) {
    const o = [];
    const names = Object.keys(cfg.acls ?? {}).filter((n) => !only || n === only);
    names.sort((a, b) => aclKind(a) && aclKind(b) ? Number(a) - Number(b) : aclKind(a) ? -1 : aclKind(b) ? 1 : a.localeCompare(b));
    for (const n of names) {
      const acl = cfg.acls[n];
      o.push(`${acl.type === "standard" ? "Standard" : "Extended"} IP access list ${n}`);
      for (const e of acl.entries) {
        const c = hits.get(`${dev}|${n}|${e.seq}`) ?? 0;
        const body = acl.type === "standard" ? `${e.action === "deny" ? "deny  " : "permit"} ${fmtAddr(e.src, true)}` : entryText(e, "extended");
        o.push(`    ${e.seq} ${body}${c ? ` (${c} match${c === 1 ? "" : "es"})` : ""}`);
      }
    }
    return o;
  }

  // src/sim/nat.ts
  function emptyNat() {
    return { statics: [], pools: {}, rules: [] };
  }
  var u322 = (ip2) => ipToInt(ip2) >>> 0;
  var ip4 = (n) => [n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255].join(".");
  var role = (cfg, ifname) => l3OptsOf(cfg, ifname)?.nat;
  function poolAddrs(p) {
    const out = [];
    for (let n = u322(p.start); n <= u322(p.end) && out.length < 4096; n++) out.push(ip4(n));
    return out;
  }
  var sameFlow = (e, dev, pkt) => e.dev === dev && e.proto === pkt.proto && e.insideLocal === pkt.src && e.lport === pkt.sport && e.outsideLocal === pkt.dst;
  function natOutbound(d, dev, inIf, outIf, pkt, table) {
    const cfg = d.cfgs[dev];
    if (!cfg?.nat || role(cfg, inIf) !== "inside" || role(cfg, outIf) !== "outside") return null;
    for (const s of cfg.nat.statics) {
      if (s.proto ? s.proto === pkt.proto && s.local === pkt.src && s.lport === pkt.sport : s.local === pkt.src)
        return { pkt: { ...pkt, src: s.global, ...s.proto ? { sport: s.gport } : {} }, entries: [] };
    }
    const known = table.find((e) => sameFlow(e, dev, pkt));
    if (known) return { pkt: { ...pkt, src: known.insideGlobal, sport: known.gport }, entries: [] };
    for (const rule of cfg.nat.rules) {
      const acl = cfg.acls?.[rule.acl];
      const m = acl ? aclDecide(acl, pkt) : null;
      if (!m || !m.permit || m.seq === null) continue;
      const ifIp = rule.iface ? ifAddr(d, dev, rule.iface) : void 0;
      const pool = rule.pool ? cfg.nat.pools[rule.pool] : void 0;
      const addrs = rule.iface ? ifIp ? [ifIp] : [] : pool ? poolAddrs(pool) : [];
      if (!addrs.length) continue;
      let global;
      if (rule.overload) global = addrs[0];
      else {
        const mine = table.find((e) => e.dev === dev && e.proto === null && e.insideLocal === pkt.src);
        const used = new Set(table.filter((e) => e.dev === dev && e.proto === null).map((e) => e.insideGlobal));
        const free = mine?.insideGlobal ?? addrs.find((x) => !used.has(x));
        if (!free) return "drop";
        global = free;
      }
      let gport = pkt.sport;
      if (rule.overload) {
        const taken = (p) => table.some((e) => e.dev === dev && e.proto === pkt.proto && e.insideGlobal === global && e.gport === p && e.insideLocal !== pkt.src);
        while (taken(gport)) gport = (gport ?? 0) + 1;
      }
      const entries = [];
      if (!rule.overload && !table.some((e) => e.dev === dev && e.proto === null && e.insideLocal === pkt.src))
        entries.push({ dev, proto: null, insideLocal: pkt.src, insideGlobal: global });
      entries.push({ dev, proto: pkt.proto, insideLocal: pkt.src, insideGlobal: global, outsideLocal: pkt.dst, lport: pkt.sport, gport, oport: pkt.proto === "icmp" ? pkt.sport : pkt.dport });
      return { pkt: { ...pkt, src: global, sport: gport }, entries };
    }
    return null;
  }
  function natInbound(d, dev, inIf, pkt, table) {
    const cfg = d.cfgs[dev];
    if (!cfg?.nat || role(cfg, inIf) !== "outside") return null;
    for (const s of cfg.nat.statics) {
      if (s.proto ? s.proto === pkt.proto && s.global === pkt.dst && s.gport === pkt.dport : s.global === pkt.dst)
        return { ...pkt, dst: s.local, ...s.proto ? { dport: s.lport } : {} };
    }
    const icmpError = pkt.proto === "icmp" && (pkt.icmpType === "time-exceeded" || pkt.icmpType === "unreachable");
    const ext = table.find((e) => e.dev === dev && (icmpError ? e.proto !== null : e.proto === pkt.proto) && e.insideGlobal === pkt.dst && e.gport === pkt.dport);
    if (ext) return { ...pkt, dst: ext.insideLocal, dport: ext.lport };
    const simple = table.find((e) => e.dev === dev && e.proto === null && e.insideGlobal === pkt.dst);
    return simple ? { ...pkt, dst: simple.insideLocal } : null;
  }
  function natAliases(cfg) {
    if (!cfg?.nat) return [];
    return [...cfg.nat.statics.map((s) => s.global), ...Object.values(cfg.nat.pools).flatMap((p) => poolAddrs(p))];
  }
  function ifAddr(d, dev, ifname) {
    const c = d.cfgs[dev];
    if (ifname.includes(".")) return c.subifs?.[ifname]?.ip?.addr;
    return c.ifaces[ifname]?.ip?.addr;
  }
  var col = (ip2, port) => port === void 0 ? ip2 : `${ip2}:${port}`;
  function showNatTranslations(cfg, dev, table) {
    const row = (pro, ig, il, ol, og) => pad(pro, 5) + pad(ig, 22) + pad(il, 22) + pad(ol, 22) + og;
    const o = [row("Pro", "Inside global", "Inside local", "Outside local", "Outside global")];
    for (const s of cfg.nat?.statics ?? [])
      o.push(s.proto ? row(s.proto, col(s.global, s.gport), col(s.local, s.lport), "---", "---") : row("---", s.global, s.local, "---", "---"));
    for (const e of table.filter((x) => x.dev === dev)) {
      if (e.proto === null) o.push(row("---", e.insideGlobal, e.insideLocal, "---", "---"));
      else o.push(row(e.proto, col(e.insideGlobal, e.gport), col(e.insideLocal, e.lport), col(e.outsideLocal, e.oport), col(e.outsideLocal, e.oport)));
    }
    return o;
  }
  function showNatStatistics(cfg, dev, table, hits, misses, ifNames) {
    const mine = table.filter((e) => e.dev === dev);
    const statics = cfg.nat?.statics.length ?? 0;
    const o = [
      `Total active translations: ${statics + mine.length} (${statics} static, ${mine.length} dynamic; ${mine.filter((e) => e.proto !== null).length} extended)`,
      "Outside interfaces:",
      ...ifNames.outside.map((n) => "  " + n),
      "Inside interfaces:",
      ...ifNames.inside.map((n) => "  " + n),
      `Hits: ${hits}  Misses: ${misses}`,
      "Expired translations: 0",
      "Dynamic mappings:"
    ];
    if (cfg.nat?.rules.length) o.push("-- Inside Source");
    cfg.nat?.rules.forEach((r, i) => {
      const target = r.iface ? `interface ${r.iface}` : `pool ${r.pool}`;
      o.push(`[Id: ${i + 1}] access-list ${r.acl} ${target}${r.overload ? " overload" : ""} refcount ${mine.filter((e) => e.proto !== null).length}`);
      if (r.pool && cfg.nat.pools[r.pool]) {
        const p = cfg.nat.pools[r.pool];
        const total = poolAddrs(p).length;
        const alloc = new Set(mine.filter((e) => e.proto === null).map((e) => e.insideGlobal)).size;
        o.push(` pool ${r.pool}: netmask ${p.mask}`, `	start ${p.start} end ${p.end}`, `	type generic, total addresses ${total}, allocated ${alloc} (${Math.floor(alloc * 100 / total)}%), misses ${misses}`);
      }
    });
    return o;
  }
  function natConfigLines(cfg) {
    const n = cfg.nat;
    if (!n) return [];
    const o = [];
    for (const [name, p] of Object.entries(n.pools)) o.push(`ip nat pool ${name} ${p.start} ${p.end} netmask ${p.mask}`);
    for (const r of n.rules) o.push(`ip nat inside source list ${r.acl} ${r.iface ? `interface ${r.iface}` : `pool ${r.pool}`}${r.overload ? " overload" : ""}`);
    for (const s of n.statics) o.push(s.proto ? `ip nat inside source static ${s.proto} ${s.local} ${s.lport} ${s.global} ${s.gport}` : `ip nat inside source static ${s.local} ${s.global}`);
    return o;
  }

  // src/sim/portsec.ts
  function defaultPortSecurity() {
    return { enabled: false, max: 1, violation: "shutdown", sticky: false, macs: [], stickyMacs: [] };
  }
  function activePs(cfg, port) {
    const c = cfg?.ifaces[port];
    if (!c?.portSecurity?.enabled || c.routed || c.mode !== "access") return null;
    return c.portSecurity;
  }
  function secureCount(ps, dynamic = []) {
    return ps.macs.length + ps.stickyMacs.length + dynamic.length;
  }
  function psAdmits(d, dev, port, mac) {
    const ps = activePs(d.cfgs[dev], port);
    if (!ps) return true;
    if (ps.macs.includes(mac) || ps.stickyMacs.includes(mac)) return true;
    return secureCount(ps) < ps.max;
  }
  function psConfigLines(ps) {
    if (!ps) return [];
    const o = [];
    if (ps.max !== 1) o.push(` switchport port-security maximum ${ps.max}`);
    if (ps.enabled) o.push(" switchport port-security");
    if (ps.violation !== "shutdown") o.push(` switchport port-security violation ${ps.violation}`);
    if (ps.sticky) o.push(" switchport port-security mac-address sticky");
    for (const m of ps.stickyMacs) o.push(` switchport port-security mac-address sticky ${m}`);
    for (const m of ps.macs) o.push(` switchport port-security mac-address ${m}`);
    return o;
  }
  var ACTION = { shutdown: "Shutdown", restrict: "Restrict", protect: "Protect" };
  var FOOTER = [
    "---------------------------------------------------------------------------",
    "Total Addresses in System (excluding one mac per port)     : ",
    "Max Addresses limit in System (excluding one mac per port) : 4096"
  ];
  function securePorts(rt, dev) {
    const sw = rt.topo.devices[dev];
    return sw.ports.flatMap((p) => {
      const ps = activePs(rt.running[dev], p);
      return ps ? [[p, ps]] : [];
    });
  }
  var dynOf = (rt, dev, port) => rt.psDynamic.get(pk(dev, port)) ?? [];
  function extraTotal(rt, dev) {
    return securePorts(rt, dev).reduce((n, [p, ps]) => n + Math.max(0, secureCount(ps, dynOf(rt, dev, p)) - 1), 0);
  }
  function showPortSecurity(rt, dev) {
    const o = [
      "Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action",
      "                (Count)       (Count)          (Count)",
      "---------------------------------------------------------------------------"
    ];
    for (const [p, ps] of securePorts(rt, dev))
      o.push(padL(shortIf(p), 11) + padL(ps.max, 15) + padL(secureCount(ps, dynOf(rt, dev, p)), 13) + padL(rt.psViolations.get(pk(dev, p)) ?? 0, 19) + padL(ACTION[ps.violation], 17));
    o.push(FOOTER[0], FOOTER[1] + extraTotal(rt, dev), FOOTER[2]);
    return o;
  }
  function showPortSecurityInterface(rt, dev, port) {
    const ps = rt.running[dev].ifaces[port]?.portSecurity;
    const on = activePs(rt.running[dev], port);
    const key = pk(dev, port);
    const phys = rt.derived.phys[key];
    const status = !on ? "Secure-down" : phys?.errDisabled ? "Secure-shutdown" : phys?.up ? "Secure-up" : "Secure-down";
    const p = ps ?? { max: 1, violation: "shutdown", macs: [], stickyMacs: [], sticky: false, enabled: false };
    const dyn = dynOf(rt, dev, port);
    const last = rt.psLast.get(key);
    const vlan = rt.running[dev].ifaces[port]?.accessVlan ?? 1;
    return [
      `Port Security              : ${on ? "Enabled" : "Disabled"}`,
      `Port Status                : ${status}`,
      `Violation Mode             : ${ACTION[p.violation]}`,
      "Aging Time                 : 0 mins",
      "Aging Type                 : Absolute",
      "SecureStatic Address Aging : Disabled",
      `Maximum MAC Addresses      : ${p.max}`,
      `Total MAC Addresses        : ${on ? secureCount(p, dyn) : 0}`,
      `Configured MAC Addresses   : ${p.macs.length}`,
      `Sticky MAC Addresses       : ${p.stickyMacs.length}`,
      `Last Source Address:Vlan   : ${last ? `${last}:${vlan}` : "0000.0000.0000:0"}`,
      `Security Violation Count   : ${rt.psViolations.get(key) ?? 0}`
    ];
  }
  function showPortSecurityAddress(rt, dev) {
    const o = [
      "               Secure Mac Address Table",
      "-----------------------------------------------------------------------------",
      "Vlan    Mac Address       Type                          Ports   Remaining Age",
      "                                                                   (mins)",
      "----    -----------       ----                          -----   -------------"
    ];
    for (const [p, ps] of securePorts(rt, dev)) {
      const vlan = rt.running[dev].ifaces[p].accessVlan;
      const row = (mac, type) => o.push(padL(vlan, 4) + "    " + pad(mac, 18) + pad(type, 30) + pad(shortIf(p), 8) + "    -");
      for (const m of ps.macs) row(m, "SecureConfigured");
      for (const m of ps.stickyMacs) row(m, "SecureSticky");
      for (const m of dynOf(rt, dev, p)) row(m, "SecureDynamic");
    }
    o.push("-----------------------------------------------------------------------------", FOOTER[1] + extraTotal(rt, dev), FOOTER[2]);
    return o;
  }

  // src/sim/net.ts
  var nk = (n) => `${n.dev}|${n.vlan}`;
  var ROUTED_TAG = 1e3;
  function routedNode(d, dev, port, tag = 0) {
    const sw = d.topo.devices[dev];
    return { dev, vlan: -(tag * ROUTED_TAG + sw.ports.indexOf(port) + 1) };
  }
  function routedPortOf(d, n) {
    if (n.vlan >= 0) return null;
    return d.topo.devices[n.dev].ports[-n.vlan % ROUTED_TAG - 1] ?? null;
  }
  function routedTagOf(n) {
    return n.vlan >= 0 ? null : Math.floor(-n.vlan / ROUTED_TAG);
  }
  function nodeVlan(n) {
    return n.vlan >= 0 ? n.vlan : routedTagOf(n);
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
        const tag = routedTagOf(n);
        const lp = d.lportByName[pk(n.dev, rport)];
        const p = lp?.active ? peerOf(d, lp) : null;
        if (!p || !p.active) continue;
        if (p.routed) add(routedNode(d, p.dev, p.name, tag), n, lp.name, p.name);
        else {
          const v2 = ingress(d, p, tag ? "t" : "u", tag);
          if (v2 !== null && portForwards(d, p.dev, p, v2)) add({ dev: p.dev, vlan: v2 }, n, lp.name, p.name);
        }
        continue;
      }
      for (const lp of d.lports[n.dev] ?? []) {
        if (!portForwards(d, n.dev, lp, n.vlan)) continue;
        const p = peerOf(d, lp);
        if (!p) continue;
        if (p.routed) {
          const tag = p.active ? egress(d, lp, n.vlan) : null;
          if (tag) add(routedNode(d, p.dev, p.name, tag === "u" ? 0 : n.vlan), n, lp.name, p.name);
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
    if (!psAdmits(d, at.dev, at.port, d.topo.devices[pc].mac)) return null;
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
    if (d.hw.off.has(dev)) return [];
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
    for (const [name, si] of Object.entries(cfg.subifs ?? {})) {
      if (si.shutdown || !si.ip || si.vlan === null) continue;
      const lp = d.lportByName[pk(dev, si.parent)];
      if (!lp?.active) continue;
      out.push({ dev, kind: "routed", name, ip: si.ip.addr, prefix: maskToPrefix(si.ip.mask), mac: macAdd(sw.mac, sw.ports.indexOf(si.parent) + 1), node: routedNode(d, dev, si.parent, si.native ? 0 : si.vlan) });
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
    return def.kind === "switch" && !!(def.l3 || def.router) && d.cfgs[dev].ipRouting;
  }
  var OSPF_AD = 110;
  var inPrefix = (ip2, net, prefix) => {
    const m = prefixMaskInt(prefix);
    return (ipToInt(ip2) & m) >>> 0 === (ipToInt(net) & m) >>> 0;
  };
  function routeTable(d, dev) {
    const ifs = l3Ifs(d, dev);
    const out = [];
    for (const i of ifs) {
      const m = prefixMaskInt(i.prefix);
      out.push({ code: "C", net: intTo((ipToInt(i.ip) & m) >>> 0), prefix: i.prefix, nh: null, ifname: i.name });
      if (i.prefix < 32) out.push({ code: "L", net: i.ip, prefix: 32, nh: null, ifname: i.name });
    }
    if (!isRouter(d, dev)) return out;
    const connected = out.filter((e) => e.code === "C" && ifs.find((i) => i.name === e.ifname)?.node);
    const statics = d.cfgs[dev].routes.flatMap((r, idx) => {
      const prefix = maskToPrefix(r.mask);
      return prefix === null ? [] : [{ code: "S", net: r.net, prefix, ad: r.ad ?? 1, idx, nh: r.nh, ifname: "" }];
    });
    const ospf = (d.ospf[dev]?.routes ?? []).filter((r) => r.paths.length).map((r) => ({ code: r.code, net: r.net, prefix: r.prefix, ad: OSPF_AD, nh: r.paths[0].nh, ifname: r.paths[0].ifname, metric: r.metric, paths: r.paths }));
    const lookupFor = (dst, seen) => {
      const matches = [
        ...connected.filter((c) => inPrefix(dst, c.net, c.prefix)).map((c) => ({ ...c, ad: 0 })),
        ...statics.filter((c) => !seen.has(c.idx) && inPrefix(dst, c.net, c.prefix)),
        ...ospf.filter((c) => inPrefix(dst, c.net, c.prefix))
      ].sort((a, b) => b.prefix - a.prefix || a.ad - b.ad || (a.code === "S" ? 0 : 1) - (b.code === "S" ? 0 : 1));
      for (const m of matches) {
        if (m.code === "C") return { ifname: m.ifname, via: dst };
        if (m.code !== "S") return { ifname: m.ifname, via: m.nh };
        const r = resolve(m, seen);
        if (r) return r;
      }
      return null;
    };
    const resolve = (s, seen) => {
      const direct = connected.find((c) => inPrefix(s.nh, c.net, c.prefix));
      if (direct) return { ifname: direct.ifname, via: s.nh };
      return lookupFor(s.nh, /* @__PURE__ */ new Set([...seen, s.idx]));
    };
    const best = /* @__PURE__ */ new Map();
    const consider = (e, rank2) => {
      const key = `${e.net}/${e.prefix}`;
      if (out.some((c) => c.code === "C" && `${c.net}/${c.prefix}` === key)) return;
      const cur = best.get(key);
      if (!cur || rank2 < cur.rank) best.set(key, { ...e, rank: rank2 });
    };
    for (const s of statics) {
      const r = resolve(s, /* @__PURE__ */ new Set());
      if (!r) continue;
      consider({ code: "S", net: s.net, prefix: s.prefix, nh: s.nh, ifname: r.ifname, ...s.ad !== 1 ? { ad: s.ad } : {}, via: r.via }, s.ad * 2);
    }
    for (const r of ospf) consider({ code: r.code, net: r.net, prefix: r.prefix, nh: r.nh, ifname: r.ifname, metric: r.metric, paths: r.paths }, r.ad * 2 + 1);
    for (const e of best.values()) {
      const { rank: _rank, ...entry } = e;
      out.push(entry);
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
    for (const e of routeTable(d, dev)) {
      if (e.code === "L" || !inPrefix(dst, e.net, e.prefix)) continue;
      if (best && best.e.prefix >= e.prefix) continue;
      const out = ifs.find((i) => i.name === e.ifname);
      best = { e, out };
    }
    if (!best) return null;
    return { out: best.out, nh: best.e.code === "C" ? dst : best.e.via ?? best.e.nh };
  }
  function owns(d, dev, ip2) {
    return l3Ifs(d, dev).some((i) => i.ip === ip2) || fhrpOwns(d, dev, ip2);
  }
  var domainCache = /* @__PURE__ */ new WeakMap();
  function domainOf(d, n) {
    let m = domainCache.get(d);
    if (!m) domainCache.set(d, m = /* @__PURE__ */ new Map());
    let dom = m.get(nk(n));
    if (!dom) m.set(nk(n), dom = l2Domain(d, n));
    return dom;
  }
  function arpResolve(d, from, ip2) {
    if (!from.node) return null;
    const dom = domainOf(d, from.node);
    const virt = fhrpTarget(d, ip2, (n) => dom.nodes.has(nk(n)));
    if (virt) return virt;
    for (const i of allL3Ifs(d)) {
      if (i.ip !== ip2 || !i.node) continue;
      if (dom.nodes.has(nk(i.node))) return i;
    }
    for (const i of allL3Ifs(d)) {
      if (!i.node || !dom.nodes.has(nk(i.node)) || !sameSubnet(i.ip, ip2, i.prefix)) continue;
      if (natAliases(d.cfgs[i.dev]).includes(ip2)) return { ...i, ip: ip2 };
    }
    return null;
  }
  function aclCheck(d, dev, ifname, dir, pkt, hits) {
    const opts = l3OptsOf(d.cfgs[dev], ifname);
    const name = dir === "in" ? opts?.aclIn : opts?.aclOut;
    if (!name) return null;
    const r = aclDecide(d.cfgs[dev].acls?.[name], pkt);
    const hit = { dev, acl: name, seq: r.seq, dir, ifname };
    if (r.seq !== null) hits.push(hit);
    return r.permit ? null : hit;
  }
  function deliver(d, from, dst, spec = {}) {
    let cur = from;
    const hops = [];
    const acl = [];
    const nat = [];
    let routers = 0;
    if (!l3Ifs(d, from).length) return { kind: "noip", hops };
    const { natPending, ttl: ttl0, ...fields } = spec;
    let ipTtl = ttl0 ?? 255;
    let pkt = { proto: "icmp", icmpType: "echo", ...fields, src: fields.src ?? sourceIp(d, from, dst) ?? l3Ifs(d, from)[0].ip, dst };
    if (pkt.proto === "icmp" && pkt.sport === void 0 && pkt.icmpType === "echo") pkt.sport = 1;
    const table = () => [...d.natTable ?? [], ...natPending ?? [], ...nat];
    const routing = (dev) => d.topo.devices[dev]?.kind === "switch";
    let inIf = null;
    let natted = 0;
    const end = (r) => ({ ...r, acl, pkt, nat, natted });
    for (let ttl = 0; ttl < 256; ttl++) {
      if (cur !== from && inIf && routing(cur)) {
        const back = natInbound(d, cur, inIf, pkt, table());
        if (back) {
          pkt = back;
          natted++;
        }
      }
      if (owns(d, cur, pkt.dst)) return end({ kind: "ok", hops, routersCrossed: routers });
      if (cur !== from && natAliases(d.cfgs[cur]).includes(pkt.dst)) return end({ kind: "timeout", hops });
      if (cur !== from && routing(cur)) {
        if (ipTtl <= 1) return end({ kind: "expired", at: cur, atIp: hops[hops.length - 1].ip, hops });
        ipTtl--;
      }
      if (cur !== from && !isRouter(d, cur)) return end({ kind: "timeout", hops });
      const r = lookup(d, cur, pkt.dst);
      if (!r) {
        if (cur === from) return end({ kind: "noroute", hops });
        if (noIcmpError(d, cur, pkt.dst)) return end({ kind: "timeout", hops, suppressedAt: cur });
        const at = hops[hops.length - 1];
        return end({ kind: "unreach", at: cur, atIp: at.ip, hops });
      }
      const target = arpResolve(d, r.out, r.nh);
      if (!target) {
        if (cur !== from && routing(cur) && !noIcmpError(d, cur, pkt.dst) && !d.arpCache?.has(`${cur}>${r.nh}`))
          return end({ kind: "unreach", at: cur, atIp: hops[hops.length - 1].ip, hops });
        return end({ kind: "timeout", hops, ...cur !== from && routing(cur) && noIcmpError(d, cur, pkt.dst) ? { suppressedAt: cur } : {} });
      }
      if (cur !== from && routing(cur) && inIf) {
        const o = natOutbound(d, cur, inIf, r.out.name, pkt, table());
        if (o === "drop") return end({ kind: "timeout", hops, natMiss: true });
        if (o) {
          pkt = o.pkt;
          nat.push(...o.entries);
          natted++;
        }
        const denied = aclCheck(d, cur, r.out.name, "out", pkt, acl);
        if (denied) return end({ kind: "unreach", at: cur, atIp: hops[hops.length - 1].ip, hops, filtered: denied });
      }
      if (routing(target.dev)) {
        const denied = aclCheck(d, target.dev, target.name, "in", pkt, acl);
        if (denied) return end({ kind: "unreach", at: target.dev, atIp: target.ip, hops: [...hops, { dev: target.dev, ip: target.ip, outIf: r.out, inIf: target.name }], filtered: denied });
      }
      if (cur !== from) routers++;
      hops.push({ dev: target.dev, ip: target.ip, outIf: r.out, inIf: target.name, src: pkt.src, dst: pkt.dst });
      inIf = target.name;
      cur = target.dev;
    }
    return end({ kind: "timeout", hops });
  }
  function noIcmpError(d, dev, dst) {
    const n = ipToInt(dst);
    if (n === null) return false;
    if (n >>> 0 >= 3758096384) return true;
    return l3Ifs(d, dev).some((i) => i.prefix < 31 && (ipToInt(i.ip) | ~prefixMaskInt(i.prefix)) >>> 0 === n >>> 0);
  }
  function nextHop(d, dev, dst) {
    return lookup(d, dev, dst)?.nh ?? null;
  }
  function duplicateIps(d) {
    const byIp = /* @__PURE__ */ new Map();
    for (const i of allL3Ifs(d)) {
      if (!i.node) continue;
      const g = byIp.get(i.ip);
      if (g) g.push(i);
      else byIp.set(i.ip, [i]);
    }
    const out = [];
    for (const [ip2, group] of byIp) {
      if (group.length < 2) continue;
      const left = [...group];
      while (left.length > 1) {
        const first = left.shift();
        const dom = domainOf(d, first.node);
        const same = left.filter((i) => dom.nodes.has(nk(i.node)));
        if (!same.length) continue;
        for (const i of same) left.splice(left.indexOf(i), 1);
        out.push({ ip: ip2, owners: [first, ...same].map((i) => ({ dev: i.dev, kind: i.kind, name: i.name, mac: i.mac })) });
      }
    }
    return out;
  }
  function arpMac(d, dev, ip2) {
    const via = l3Ifs(d, dev).find((i) => i.node && sameSubnet(i.ip, ip2, i.prefix));
    if (!via) return null;
    const owner = arpResolve(d, via, ip2);
    return owner ? { mac: owner.mac, via: via.name } : null;
  }
  function sourceIp(d, dev, dst) {
    return lookup(d, dev, dst)?.out.ip ?? null;
  }
  function ping(d, from, dst, opts = {}) {
    if (d.hw.off.has(from)) return { ok: false, reason: "off" };
    if (!isValidIp(dst)) return { ok: false, reason: "noroute" };
    const fwd = deliver(d, from, dst, { ...opts.ttl !== void 0 ? { ttl: opts.ttl } : {}, ...opts.src ? { src: opts.src } : {} });
    const firstHopArp = fwd.hops[0] ? { dev: from, ip: fwd.hops[0].ip } : void 0;
    if (fwd.kind === "noip") return { ok: false, reason: "noip", forward: fwd };
    if (fwd.kind === "noroute") return { ok: false, reason: "noroute", forward: fwd };
    if (fwd.kind === "unreach") {
      const back2 = deliver(d, fwd.at, fwd.pkt?.src ?? sourceIp(d, from, dst), { proto: "icmp", icmpType: "unreachable", src: fwd.atIp, dport: fwd.pkt?.sport, natPending: fwd.nat });
      return back2.kind === "ok" ? { ok: false, reason: "unreach", unreachFrom: fwd.atIp, forward: fwd, back: back2, firstHopArp } : { ok: false, reason: "timeout", forward: fwd, back: back2, firstHopArp };
    }
    if (fwd.kind === "expired") {
      const back2 = deliver(d, fwd.at, fwd.pkt?.src ?? sourceIp(d, from, dst), { proto: "icmp", icmpType: "time-exceeded", src: fwd.atIp, dport: fwd.pkt?.sport, natPending: fwd.nat });
      return back2.kind === "ok" ? { ok: false, reason: "expired", expiredFrom: fwd.atIp, forward: fwd, back: back2, firstHopArp } : { ok: false, reason: "timeout", forward: fwd, back: back2, firstHopArp };
    }
    if (fwd.kind !== "ok") {
      const nh = fwd.hops.length ? null : nextHop(d, from, dst);
      return { ok: false, reason: "timeout", forward: fwd, firstHopArp, ...nh ? { arpIncomplete: { dev: from, ip: nh } } : {} };
    }
    const src = fwd.pkt?.src ?? sourceIp(d, from, dst);
    const replier = fwd.hops[fwd.hops.length - 1]?.dev ?? from;
    const back = deliver(d, replier, src, { proto: "icmp", icmpType: "echo-reply", src: dst, dport: fwd.pkt?.sport, natPending: fwd.nat });
    const backTo = back.hops[back.hops.length - 1]?.dev ?? replier;
    if (back.kind !== "ok" || backTo !== from) return { ok: false, reason: "timeout", forward: fwd, back, firstHopArp };
    const base2 = d.topo.devices[replier].kind === "pc" ? 64 : 255;
    return { ok: true, ttl: base2 - back.routersCrossed, replier, forward: fwd, back, firstHopArp };
  }
  function traceProbe(d, from, dst, ttl, dport, sport = 49152) {
    const fwd = deliver(d, from, dst, { proto: "udp", sport, dport, ttl });
    const src = fwd.pkt?.src ?? sourceIp(d, from, dst);
    if (!src) return { result: { kind: "none" }, forward: fwd };
    const answer = (at, ip2, icmpType) => deliver(d, at, src, { proto: "icmp", icmpType, src: ip2, dport: fwd.pkt?.sport, natPending: fwd.nat });
    const home = (b) => b.kind === "ok" && (b.hops[b.hops.length - 1]?.dev ?? from) === from;
    if (fwd.kind === "expired") {
      const back2 = answer(fwd.at, fwd.atIp, "time-exceeded");
      return { result: home(back2) ? { kind: "hop", ip: fwd.atIp } : { kind: "none" }, forward: fwd, back: back2 };
    }
    if (fwd.kind === "unreach") {
      const back2 = answer(fwd.at, fwd.atIp, "unreachable");
      return { result: home(back2) ? { kind: "unreach", ip: fwd.atIp, code: fwd.filtered ? "A" : "H" } : { kind: "none" }, forward: fwd, back: back2 };
    }
    if (fwd.kind !== "ok") return { result: { kind: "none" }, forward: fwd };
    const replier = fwd.hops[fwd.hops.length - 1]?.dev ?? from;
    const back = answer(replier, fwd.pkt?.dst ?? dst, "unreachable");
    return { result: home(back) ? { kind: "dest", ip: dst } : { kind: "none" }, forward: fwd, back };
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

  // src/sim/fhrp.ts
  var memberId = (m) => `${m.proto}|${m.dev}|${m.ifname}|${m.group}`;
  var hsrpMac = (group) => "0000.0c07.ac" + group.toString(16).padStart(2, "0");
  var vrrpMac = (group) => "0000.5e00.01" + group.toString(16).padStart(2, "0");
  var virtualMac = (m) => m.proto === "hsrp" ? hsrpMac(m.group) : vrrpMac(m.group);
  function l3Configs(d, dev) {
    const cfg = d.cfgs[dev];
    if (!cfg) return [];
    const out = [];
    for (const [port, c] of Object.entries(cfg.ifaces)) if (c.routed) out.push([port, c.l3]);
    for (const [name, si] of Object.entries(cfg.subifs ?? {})) out.push([name, si.l3]);
    for (const [v, s] of Object.entries(cfg.svis)) out.push(["Vlan" + v, s.l3]);
    return out;
  }
  function lineProtocolUp(d, dev, ifname) {
    if (d.hw.off.has(dev)) return false;
    const cfg = d.cfgs[dev];
    if (!cfg) return false;
    if (ifname.startsWith("Vlan")) return !!d.svis[dev]?.find((s) => "Vlan" + s.vlan === ifname)?.up;
    if (ifname.includes(".")) {
      const si = cfg.subifs?.[ifname];
      return !!si && !si.shutdown && !!d.lportByName[pk(dev, si.parent)]?.active;
    }
    return !!d.lportByName[pk(dev, ifname)]?.active;
  }
  function trackStates(d, dev, tracks) {
    return (tracks ?? []).map((t) => {
      const iface = t.obj !== void 0 ? d.cfgs[dev]?.tracks?.[String(t.obj)]?.iface ?? null : t.iface ?? null;
      return { ...t.obj !== void 0 ? { obj: t.obj } : {}, iface, decrement: t.decrement ?? 10, up: !!iface && lineProtocolUp(d, dev, iface) };
    });
  }
  function domainKey(d, node) {
    const nodes = [...l2Domain(d, node).nodes.values()].map((x) => x.node);
    const segs = nodes.filter((n) => d.topo.devices[n.dev]?.kind === "switch" && !d.topo.devices[n.dev].router);
    const keys = (segs.length ? segs : nodes).map((n) => `${n.dev}|${n.vlan}`).sort();
    return keys[0];
  }
  var rank = (a, b) => b.priority - a.priority || (ipToInt(b.ip) ?? 0) - (ipToInt(a.ip) ?? 0);
  function computeFhrp(d, prevActive) {
    const members = [];
    for (const sw of d.topo.switches) {
      const up = new Map(l3Ifs(d, sw.id).map((i) => [i.name, i]));
      for (const [ifname, l3] of l3Configs(d, sw.id)) {
        const iface = up.get(ifname);
        const node = iface?.node ?? null;
        for (const proto of ["hsrp", "vrrp"]) {
          for (const g of (proto === "hsrp" ? l3?.hsrp : l3?.vrrp) ?? []) {
            const tracks = proto === "hsrp" ? trackStates(d, sw.id, g.tracks) : [];
            const cfgPriority = g.priority ?? 100;
            const owner = proto === "vrrp" && !!iface && g.ip === iface.ip;
            const priority = owner ? 255 : Math.max(0, cfgPriority - tracks.filter((t) => !t.up).reduce((s, t) => s + t.decrement, 0));
            const m = {
              proto,
              dev: sw.id,
              ifname,
              group: g.group,
              vip: g.ip,
              ip: iface?.ip ?? null,
              cfgPriority,
              priority,
              preempt: owner || (proto === "hsrp" ? !!g.preempt : g.preempt !== false),
              owner,
              tracks,
              state: "Init",
              key: ""
            };
            if (iface && node && g.ip) m.key = proto === "hsrp" ? `hsrp|${g.group}|${domainKey(d, node)}` : `vrrp|${g.group}|${g.ip}|${domainKey(d, node)}`;
            members.push(m);
          }
        }
      }
    }
    const byKey = /* @__PURE__ */ new Map();
    for (const m of members) if (m.key) byKey.set(m.key, [...byKey.get(m.key) ?? [], m]);
    const groups = [];
    for (const [key, list] of byKey) {
      const sorted = [...list].sort(rank);
      const best = sorted[0];
      const prev = list.find((m) => memberId(m) === prevActive.get(key));
      const active = prev && !(best !== prev && best.preempt && best.priority > prev.priority) ? prev : best;
      prevActive.set(key, memberId(active));
      const proto = best.proto;
      let standby = null;
      for (const m of sorted) {
        if (m === active) m.state = proto === "hsrp" ? "Active" : "Master";
        else if (proto === "hsrp" && !standby) {
          standby = m;
          m.state = "Standby";
        } else m.state = proto === "hsrp" ? "Listen" : "Backup";
      }
      groups.push({ key, proto, group: best.group, vip: active.vip, members: list, active, standby });
    }
    for (const k of [...prevActive.keys()]) if (!byKey.has(k)) prevActive.delete(k);
    return { members, groups };
  }
  function fhrpTarget(d, ip2, inDomain) {
    for (const g of d.fhrp?.groups ?? []) {
      const a = g.active;
      if (!a || g.vip !== ip2) continue;
      const base2 = l3Ifs(d, a.dev).find((i) => i.name === a.ifname);
      if (base2?.node && inDomain(base2.node)) return { ...base2, ip: ip2, mac: virtualMac(a) };
    }
    return null;
  }
  function fhrpOwns(d, dev, ip2) {
    return (d.fhrp?.groups ?? []).some((g) => g.vip === ip2 && g.active?.dev === dev);
  }
  function membersOf(d, dev, proto) {
    return (d.fhrp?.members ?? []).filter((m) => m.dev === dev && m.proto === proto);
  }
  var groupOf = (d, m) => d.fhrp?.groups.find((g) => g.key === m.key && !!m.key) ?? null;
  var padR = (s, n) => String(s).length >= n ? String(s) + " " : String(s) + " ".repeat(n - String(s).length);
  function showStandbyBrief(d, dev) {
    const ms = membersOf(d, dev, "hsrp");
    if (!ms.length) return [];
    const o = ["                     P indicates configured to preempt.", "                     |"];
    o.push("Interface   Grp  Pri P State   Active          Standby         Virtual IP");
    for (const m of ms) {
      const g = groupOf(d, m);
      const active = !g?.active ? "unknown" : g.active === m ? "local" : g.active.ip;
      const standby = !g?.standby ? "unknown" : g.standby === m ? "local" : g.standby.ip;
      o.push(
        padR(shortIf(m.ifname), 12) + padR(m.group, 5) + String(m.priority).padStart(3) + " " + (m.preempt ? "P " : "  ") + padR(m.state, 8) + padR(active, 16) + padR(standby, 16) + (m.vip ?? "unknown")
      );
    }
    return o;
  }
  function showStandby(d, dev) {
    const o = [];
    for (const m of membersOf(d, dev, "hsrp")) {
      const g = groupOf(d, m);
      const mac = hsrpMac(m.group);
      o.push(`${m.ifname} - Group ${m.group}`);
      o.push(`  State is ${m.state}` + (m.state === "Init" && !m.ip ? " (interface down)" : m.state === "Init" && !m.vip ? " (virtual IP not configured)" : ""));
      o.push(`  Virtual IP address is ${m.vip ?? "unknown"}`);
      o.push(`  Active virtual MAC address is ${g?.active ? mac : "unknown"}` + (g?.active ? g.active === m ? " (MAC In Use)" : " (MAC Not In Use)" : ""));
      o.push(`    Local virtual MAC address is ${mac} (v1 default)`);
      o.push("  Hello time 3 sec, hold time 10 sec");
      o.push(`  Preemption ${m.preempt ? "enabled" : "disabled"}`);
      o.push("  Active router is " + (!g?.active ? "unknown" : g.active === m ? "local" : `${g.active.ip}, priority ${g.active.priority}`));
      o.push("  Standby router is " + (!g?.standby ? "unknown" : g.standby === m ? "local" : `${g.standby.ip}, priority ${g.standby.priority}`));
      o.push(`  Priority ${m.priority} (configured ${m.cfgPriority})`);
      for (const t of m.tracks)
        o.push(
          (t.obj !== void 0 ? `    Track object ${t.obj}` : `    Track interface ${t.iface}`) + ` state ${t.up ? "Up" : "Down"} decrement ${t.decrement}`
        );
      o.push(`  Group name is "hsrp-${shortIf(m.ifname)}-${m.group}" (default)`);
    }
    return o;
  }
  var downMs = (prio) => 3e3 + Math.floor((256 - prio) * 1e3 / 256);
  function showVrrpBrief(d, dev) {
    const ms = membersOf(d, dev, "vrrp");
    if (!ms.length) return [];
    const o = ["Interface          Grp Pri Time  Own Pre State   Master addr     Group addr"];
    for (const m of ms) {
      const g = groupOf(d, m);
      o.push(
        padR(shortIf(m.ifname), 19) + padR(m.group, 4) + padR(m.priority, 4) + padR(downMs(m.priority), 6) + padR(m.owner ? "Y" : "", 4) + padR(m.preempt ? "Y" : "", 4) + padR(m.state, 8) + padR(g?.active?.ip ?? "0.0.0.0", 16) + (m.vip ?? "0.0.0.0")
      );
    }
    return o;
  }
  function showVrrp(d, dev) {
    const o = [];
    for (const m of membersOf(d, dev, "vrrp")) {
      const g = groupOf(d, m);
      o.push(`${m.ifname} - Group ${m.group}`);
      o.push(`  State is ${m.state}`);
      o.push(`  Virtual IP address is ${m.vip ?? "0.0.0.0"}`);
      o.push(`  Virtual MAC address is ${vrrpMac(m.group)}`);
      o.push("  Advertisement interval is 1.000 sec");
      o.push(`  Preemption ${m.preempt ? "enabled" : "disabled"}`);
      o.push(`  Priority is ${m.priority}` + (m.owner ? " (owner)" : ""));
      const master = g?.active;
      o.push(
        "  Master Router is " + (!master ? "unknown" : master === m ? `${m.ip} (local), priority is ${m.priority}` : `${master.ip}, priority is ${master.priority}`)
      );
      o.push("  Master Advertisement interval is 1.000 sec");
      o.push(`  Master Down interval is ${(downMs(m.priority) / 1e3).toFixed(3)} sec`);
    }
    return o;
  }
  function showTrack(d, dev) {
    const o = [];
    const tracks = d.cfgs[dev]?.tracks ?? {};
    for (const n of Object.keys(tracks).map(Number).sort((a, b) => a - b)) {
      const iface = tracks[String(n)].iface;
      const up = lineProtocolUp(d, dev, iface);
      o.push(`Track ${n}`, `  Interface ${iface} line-protocol`, `  Line protocol is ${up ? "Up" : "Down"}`);
      const users = (d.fhrp?.members ?? []).filter((m) => m.dev === dev && m.tracks.some((t) => t.obj === n));
      if (users.length) {
        o.push("Tracked by:");
        for (const m of users) o.push(`  HSRP ${m.ifname} ${m.group}`);
      }
    }
    return o;
  }

  // src/sim/cli/help.ts
  var HELP = {
    // FHRP
    standby: "HSRP interface configuration commands",
    vrrp: "VRRP Interface configuration commands",
    track: "Object tracking configuration commands",
    preempt: "Overthrow lower priority Active routers",
    decrement: "Priority decrement",
    "line-protocol": "Track interface line-protocol",
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
    dot1Q: "IEEE 802.1Q Virtual LAN",
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
    // L5-b: DHCP server and relay
    dhcp: "Configure DHCP server and relay parameters",
    pool: "Configure DHCP address pools",
    "excluded-address": "Prevent DHCP from assigning certain addresses",
    "helper-address": "Specify a destination address for UDP broadcasts",
    binding: "DHCP address bindings",
    "default-router": "Default routers",
    "dns-server": "DNS servers",
    "*": "Clear all automatic bindings",
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
    if (head === "H.H.H") return { kind: "mac", desc };
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
      case "mac":
        return /^[0-9a-f]{1,4}\.[0-9a-f]{1,4}\.[0-9a-f]{1,4}$/i.test(t);
      case "word":
      case "line":
        return true;
      case "ifnum":
        return /^\d+(\/\d+)*(\.\d+)?$/.test(t);
    }
  }
  function splitIf(node, toks, i) {
    const t = toks[i];
    const m = /^([A-Za-z][A-Za-z-]*?)(\d[\d/]*(?:\.\d+)?)$/.exec(t.text);
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
      case "mac":
        return "H.H.H";
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

  // src/sim/dhcp.ts
  var isApipa = (ip2) => sameSubnet(ip2, "169.254.0.0", 16);
  function apipaFor(mac) {
    const hex = mac.replace(/\./g, "");
    const b5 = parseInt(hex.slice(8, 10), 16);
    const b6 = parseInt(hex.slice(10, 12), 16);
    return `169.254.${1 + b5 % 254}.${b6}`;
  }
  var nk2 = (n) => `${n.dev}|${n.vlan}`;
  function l3OptsOf2(cfg, name) {
    if (name.startsWith("Vlan")) return cfg.svis[ifNum(name)]?.l3;
    if (name.startsWith("Loopback")) return cfg.loopbacks?.[ifNum(name)]?.l3;
    if (name.includes(".")) return cfg.subifs?.[name]?.l3;
    return cfg.ifaces[name]?.l3;
  }
  function helpersOf(cfg, name) {
    return l3OptsOf2(cfg, name)?.helpers ?? [];
  }
  function poolFor(cfg, addr) {
    let best = null;
    for (const [name, pool] of Object.entries(cfg.dhcpPools ?? {})) {
      if (!pool.net) continue;
      const prefix = maskToPrefix(pool.net.mask);
      if (prefix === null || !sameSubnet(pool.net.addr, addr, prefix)) continue;
      if (!best || prefix > best.prefix) best = { name, pool, prefix };
    }
    return best;
  }
  function configuredIps(d, except) {
    const out = /* @__PURE__ */ new Set();
    const add = (ip2) => {
      const n = ip2 ? ipToInt(ip2) : null;
      if (n !== null) out.add(n);
    };
    for (const [id, pc] of Object.entries(d.pcs)) if (id !== except) add(pc.ip);
    for (const [id, cfg] of Object.entries(d.cfgs)) {
      if (id === except) continue;
      for (const c of Object.values(cfg.ifaces)) add(c.ip?.addr);
      for (const s of Object.values(cfg.svis)) add(s.ip?.addr);
      for (const s of Object.values(cfg.subifs ?? {})) add(s.ip?.addr);
      for (const l of Object.values(cfg.loopbacks ?? {})) add(l.ip?.addr);
    }
    return out;
  }
  function poolRange(cfg, pool) {
    if (!pool.net) return null;
    const prefix = maskToPrefix(pool.net.mask);
    if (prefix === null || prefix > 30) return null;
    const net = (ipToInt(pool.net.addr) & prefixMaskInt(prefix)) >>> 0;
    const size = 2 ** (32 - prefix);
    const ranges = (cfg.dhcpExcluded ?? []).map((r) => [ipToInt(r.lo), ipToInt(r.hi)]);
    return { first: net + 1, last: net + size - 2, excluded: (n) => ranges.some(([lo, hi]) => n >= lo && n <= hi) };
  }
  function allocateIos(d, cfg, server, pool, client, mac, bindings) {
    const range = poolRange(cfg, pool);
    if (!range) return null;
    const inUse = configuredIps(d, client);
    const leased = new Map(bindings.filter((b) => b.server === server).map((b) => [ipToInt(b.ip), b.mac]));
    const free = (n) => !range.excluded(n) && !inUse.has(n) && (leased.get(n) ?? mac) === mac;
    const mine = bindings.find((b) => b.server === server && b.mac === mac);
    const prev = mine ? ipToInt(mine.ip) : null;
    if (prev !== null && prev >= range.first && prev <= range.last && free(prev)) return intToIp(prev);
    for (let n = range.first; n <= range.last; n++) if (free(n)) return intToIp(n);
    return null;
  }
  function allocateServer(d, network, prefix, gw, serverIp, client) {
    if (prefix < 1 || prefix >= 31) return "invalid";
    const net = (ipToInt(network) & prefixMaskInt(prefix)) >>> 0;
    const broadcast = net + 2 ** (32 - prefix) - 1;
    const taken = configuredIps(d, client);
    for (const ip2 of [gw, serverIp]) if (ip2) taken.add(ipToInt(ip2));
    const start = Math.min(100, Math.max(1, broadcast - net - 1));
    const offsets = [...Array.from({ length: 4096 }, (_, i) => start + i), ...Array.from({ length: Math.max(0, start - 1) }, (_, i) => i + 1)];
    for (const off of offsets) {
      const n = net + off;
      if (n >= broadcast) continue;
      if (!taken.has(n)) return intToIp(n);
    }
    return null;
  }
  function isDhcpServerPc(d, dev) {
    const def = d.topo.devices[dev];
    return !!def && def.kind === "pc" && !!def.server && !!d.pcs[dev]?.services?.dhcp && !d.hw.off.has(dev);
  }
  function dhcpDiscover(d, pc, bindings) {
    const def = d.topo.devices[pc];
    const node = def && !d.hw.off.has(pc) ? pcNode(d, pc) : null;
    if (!def || !node) return { ok: false, reason: "nolink" };
    const dom = l2Domain(d, node);
    const onLink = allL3Ifs(d).filter((i) => i.dev !== pc && i.node && dom.nodes.has(nk2(i.node)));
    let fail = { ok: false, reason: "noserver" };
    const offerFrom = (server, via, giaddr, giPrefix, relay) => {
      const sdef = d.topo.devices[server];
      if (sdef.kind === "switch") {
        const cfg = d.cfgs[server];
        if (!Object.keys(cfg.dhcpPools ?? {}).length) return null;
        const p = poolFor(cfg, giaddr);
        if (!p) return { ok: false, reason: "nopool", server };
        const ip3 = allocateIos(d, cfg, server, p.pool, pc, def.mac, bindings);
        if (!ip3) return { ok: false, reason: "exhausted", server };
        const serverIp = via?.ip ?? l3Ifs(d, server).find((i) => i.node)?.ip ?? giaddr;
        return { ok: true, server, serverIp, pool: p.name, relay, ip: ip3, prefix: p.prefix, gw: p.pool.defaultRouter, dns: p.pool.dns };
      }
      if (!isDhcpServerPc(d, server)) return null;
      const sc = d.pcs[server];
      if (!sc.ip) return null;
      const network = relay ? giaddr : sc.ip;
      const prefix = relay ? giPrefix : sc.prefix;
      const gw = relay ? giaddr : sc.gw;
      const ip2 = allocateServer(d, network, prefix, gw, sc.ip, pc);
      if (ip2 === "invalid") return { ok: false, reason: "nopool", server };
      if (!ip2) return { ok: false, reason: "exhausted", server };
      return { ok: true, server, serverIp: sc.ip, pool: "", relay, ip: ip2, prefix, gw, dns: sc.services?.dns ? sc.ip : null };
    };
    for (const i of onLink) {
      const r = offerFrom(i.dev, i, i.ip, i.prefix, null);
      if (!r) continue;
      if (r.ok) return r;
      fail = r;
    }
    for (const i of onLink) {
      if (d.topo.devices[i.dev].kind !== "switch") continue;
      for (const helper of helpersOf(d.cfgs[i.dev], i.name)) {
        const relayInfo = { dev: i.dev, ifname: i.name, helper };
        if (l3Ifs(d, i.dev).some((x) => x.ip === helper)) continue;
        const fwd = deliver(d, i.dev, helper);
        const target = fwd.kind === "ok" ? fwd.hops[fwd.hops.length - 1]?.dev : void 0;
        if (!target) {
          fail = { ok: false, reason: "relay-unreachable", relay: relayInfo };
          continue;
        }
        const back = deliver(d, target, i.ip);
        if (back.kind !== "ok" || (back.hops[back.hops.length - 1]?.dev ?? target) !== i.dev) {
          fail = { ok: false, reason: "relay-unreachable", relay: relayInfo, server: target };
          continue;
        }
        const r = offerFrom(target, null, i.ip, i.prefix, { dev: i.dev, ifname: i.name, giaddr: i.ip });
        if (!r) {
          fail = { ok: false, reason: "relay-noserver", relay: relayInfo, server: target };
          continue;
        }
        if (r.ok) return r.server === target ? { ...r, serverIp: helper } : r;
        fail = { ...r, relay: relayInfo };
      }
    }
    return fail;
  }
  function dnsRecords(d) {
    const out = [];
    for (const dev of d.topo.lab.devices) {
      if (dev.kind === "pc") {
        const ip2 = d.pcs[dev.id]?.ip;
        if (ip2) out.push({ name: dev.name ?? dev.id, address: ip2 });
      } else {
        const first = l3Ifs(d, dev.id)[0];
        if (first) out.push({ name: d.cfgs[dev.id].hostname, address: first.ip });
      }
    }
    return out;
  }
  function dnsLookup(d, pc, name) {
    const server = d.pcs[pc]?.dns;
    if (!server) return { ok: false, reason: "noserver" };
    const r = ping(d, pc, server);
    const target = r.ok ? r.replier : void 0;
    const tdef = target ? d.topo.devices[target] : void 0;
    if (!target || !tdef || tdef.kind !== "pc" || !tdef.server || !d.pcs[target]?.services?.dns) return { ok: false, reason: "timeout", server };
    const rec = dnsRecords(d).find((x) => x.name.toLowerCase() === name.toLowerCase());
    return rec ? { ok: true, server, name: rec.name, address: rec.address } : { ok: false, reason: "nxdomain", server };
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
  function l3Lines(ip2, o, noIpLine) {
    const out = [];
    if (o?.bandwidth) out.push(" bandwidth " + o.bandwidth);
    if (ip2) out.push(` ip address ${ip2.addr} ${ip2.mask}`);
    else if (noIpLine) out.push(" no ip address");
    for (const h of o?.helpers ?? []) out.push(" ip helper-address " + h);
    if (o?.aclIn) out.push(` ip access-group ${o.aclIn} in`);
    if (o?.aclOut) out.push(` ip access-group ${o.aclOut} out`);
    if (o?.nat) out.push(` ip nat ${o.nat}`);
    if (o?.mtu) out.push(" ip mtu " + o.mtu);
    if (o?.ospfNet) out.push(" ip ospf network " + o.ospfNet);
    if (o?.ospfHello) out.push(" ip ospf hello-interval " + o.ospfHello);
    if (o?.ospfDead) out.push(" ip ospf dead-interval " + o.ospfDead);
    if (o?.ospfPrio !== void 0) out.push(" ip ospf priority " + o.ospfPrio);
    if (o?.ospfArea) out.push(` ip ospf ${o.ospfArea.pid} area ${o.ospfArea.area}`);
    if (o?.ospfCost) out.push(" ip ospf cost " + o.ospfCost);
    out.push(...fhrpLines(o));
    return out;
  }
  function fhrpLines(o) {
    const out = [];
    for (const g of o?.hsrp ?? []) {
      if (g.ip) out.push(` standby ${g.group} ip ${g.ip}`);
      if (g.priority !== void 0 && g.priority !== 100) out.push(` standby ${g.group} priority ${g.priority}`);
      if (g.preempt) out.push(` standby ${g.group} preempt`);
      for (const t of g.tracks ?? []) {
        const dec = t.decrement !== void 0 ? t.decrement : null;
        if (t.obj !== void 0) out.push(` standby ${g.group} track ${t.obj}` + (dec !== null ? ` decrement ${dec}` : ""));
        else out.push(` standby ${g.group} track ${t.iface}` + (dec !== null ? ` ${dec}` : ""));
      }
    }
    for (const g of o?.vrrp ?? []) {
      if (g.ip) out.push(` vrrp ${g.group} ip ${g.ip}`);
      if (g.priority !== void 0 && g.priority !== 100) out.push(` vrrp ${g.group} priority ${g.priority}`);
      if (g.preempt === false) out.push(` no vrrp ${g.group} preempt`);
    }
    return out;
  }
  function trackLines(c) {
    const ids = Object.keys(c.tracks ?? {}).map(Number).sort((a, b) => a - b);
    return ids.flatMap((n) => ["track " + n + " interface " + c.tracks[String(n)].iface + " line-protocol", "!"]);
  }
  var routeLine = (r) => `ip route ${r.net} ${r.mask} ${r.nh}` + (r.ad && r.ad !== 1 ? " " + r.ad : "");
  function discoveryGlobalLines(c) {
    const o = [];
    if (c.cdpRun === false) o.push("!", "no cdp run");
    if (c.lldpRun) o.push("!", "lldp run");
    return o;
  }
  function discoveryIfLines(c) {
    const o = [];
    if (c.cdp === false) o.push(" no cdp enable");
    if (c.lldpTx === false) o.push(" no lldp transmit");
    if (c.lldpRx === false) o.push(" no lldp receive");
    return o;
  }
  function routerRunningConfig(sw, c) {
    const o = [];
    o.push("!", "version 15.4", "service timestamps debug datetime msec", "service timestamps log datetime msec", "no service password-encryption", "!");
    o.push("hostname " + c.hostname, "!", "boot-start-marker", "boot-end-marker", "!", "no aaa new-model");
    if (!c.ipRouting) o.push("no ip routing");
    o.push("!", ...dhcpLines(c), "!", ...trackLines(c));
    for (const n of Object.keys(c.loopbacks ?? {}).map(Number).sort((a, b) => a - b)) {
      const l = c.loopbacks[String(n)];
      o.push("interface Loopback" + n);
      if (l.description) o.push(" description " + l.description);
      o.push(...l3Lines(l.ip, l.l3, true));
      if (l.shutdown) o.push(" shutdown");
      o.push("!");
    }
    for (const p of sw.ports) {
      const ic = c.ifaces[p];
      o.push("interface " + p);
      if (ic.description) o.push(" description " + ic.description);
      o.push(...l3Lines(ic.ip, ic.l3, true));
      if (ic.shutdown) o.push(" shutdown");
      o.push(...discoveryIfLines(ic), "!");
      for (const [name, si] of subifsOf(c, p)) {
        o.push("interface " + name);
        if (si.description) o.push(" description " + si.description);
        if (si.vlan !== null) o.push(` encapsulation dot1Q ${si.vlan}${si.native ? " native" : ""}`);
        o.push(...l3Lines(si.ip, si.l3, true));
        if (si.shutdown) o.push(" shutdown");
        o.push("!");
      }
    }
    if (c.ospf) o.push(...ospfLines(c));
    o.push("ip forward-protocol nd", "no ip http server", "!");
    o.push(...natConfigLines(c));
    for (const r of c.routes) o.push(routeLine(r));
    o.push(...aclConfigLines(c), ...discoveryGlobalLines(c), "!", "line con 0", "line aux 0", "line vty 0 4", " login", "!", "end");
    return o;
  }
  function dhcpLines(c) {
    const o = [];
    for (const r of c.dhcpExcluded ?? []) o.push("ip dhcp excluded-address " + r.lo + (r.hi !== r.lo ? " " + r.hi : ""));
    for (const [name, p] of Object.entries(c.dhcpPools ?? {})) {
      o.push("!", "ip dhcp pool " + name);
      if (p.net) o.push(` network ${p.net.addr} ${p.net.mask}`);
      if (p.defaultRouter) o.push(" default-router " + p.defaultRouter);
      if (p.dns) o.push(" dns-server " + p.dns);
    }
    if (o.length) o.push("!");
    return o;
  }
  function subifsOf(c, parent) {
    return Object.entries(c.subifs ?? {}).filter(([, s]) => s.parent === parent).sort((a, b) => Number(a[0].split(".")[1]) - Number(b[0].split(".")[1]));
  }
  function ospfLines(c) {
    const o = [];
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
    return o;
  }
  function runningConfig(sw, c) {
    if (sw.router) return routerRunningConfig(sw, c);
    const o = [];
    o.push("!", "version 15.2", "no service pad", "service timestamps debug datetime msec", "service timestamps log datetime msec", "no service password-encryption", "!");
    o.push("hostname " + c.hostname, "!", "boot-start-marker", "boot-end-marker", "!", "no aaa new-model");
    o.push("system mtu routing 1500");
    if (c.ipRouting) o.push("ip routing");
    o.push("!", ...dhcpLines(c), "!", ...trackLines(c), "vtp mode transparent", "!");
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
        const l2 = l2Lines(ic, !!sw.needsEncap);
        const at = l2.findIndex((l) => l === " shutdown" || l.startsWith(" spanning-tree"));
        l2.splice(at < 0 ? l2.length : at, 0, ...psConfigLines(ic.portSecurity));
        o.push("interface " + p, ...l2);
        if (ic.bpduguard !== void 0) o.push(` spanning-tree bpduguard ${ic.bpduguard ? "enable" : "disable"}`);
        if (ic.channel) o.push(` channel-group ${ic.channel.id} mode ${ic.channel.mode}`);
      }
      o.push(...discoveryIfLines(ic), "!");
    }
    for (const v of Object.keys(c.svis).map(Number).sort((a, b) => a - b)) {
      const s = c.svis[String(v)];
      o.push("interface Vlan" + v);
      if (s.description) o.push(" description " + s.description);
      o.push(...l3Lines(s.ip, s.l3, true));
      if (s.shutdown) o.push(" shutdown");
      o.push("!");
    }
    if (c.ospf) o.push(...ospfLines(c));
    if (c.defaultGateway) o.push("ip default-gateway " + c.defaultGateway);
    o.push("ip forward-protocol nd", "no ip http server", "!");
    for (const r of c.routes) o.push(routeLine(r));
    o.push(...aclConfigLines(c), ...discoveryGlobalLines(c), "!", "line con 0", "line vty 0 4", " login", "line vty 5 15", " login", "!", "end");
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
    const accessPorts2 = (v) => sortIfs(
      sw,
      (d.lports[dev] ?? []).filter((lp) => !lp.isPo && !lp.routed && lp.opMode === "access" && lp.cfg.accessVlan === v).map((lp) => lp.name)
    ).map(shortIf);
    for (const vs of Object.keys(c.vlans).map(Number).sort((a, b) => a - b)) {
      const ports2 = vs >= 1002 && vs <= 1005 ? [] : accessPorts2(vs);
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
    const trunks2 = (d.lports[dev] ?? []).filter((lp) => lp.active && lp.opMode === "trunk");
    if (!trunks2.length) return [""];
    const c = rt.running[dev];
    const o = ["", "Port        Mode             Encapsulation  Status        Native vlan"];
    for (const lp of trunks2)
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
    for (const lp of trunks2) o.push(pad(shortIf(lp.name), 12) + allowedList(lp));
    o.push("", "Port        Vlans allowed and active in management domain");
    for (const lp of trunks2) o.push(pad(shortIf(lp.name), 12) + active(lp));
    o.push("", "Port        Vlans in spanning tree forwarding state and not pruned");
    for (const lp of trunks2) o.push(pad(shortIf(lp.name), 12) + fwd(lp));
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
    const row = (n, ip2, status, proto) => pad(n, 23) + pad(ip2, 16) + "YES " + pad(ip2 === "unassigned" ? "unset" : "manual", 7) + pad(status, 22) + proto;
    for (const s of d.svis[dev] ?? [])
      o.push(row("Vlan" + s.vlan, s.ip ?? "unassigned", s.status, s.up ? "up" : "down"));
    for (const p of sw.ports) {
      const ps = d.phys[pk(dev, p)];
      const proto = ps.up && ps.ec?.flag !== "s" ? "up" : "down";
      const ip2 = c.ifaces[p].routed ? c.ifaces[p].ip?.addr ?? "unassigned" : "unassigned";
      o.push(row(p, ip2, ps.adminDown ? "administratively down" : ps.up ? "up" : "down", proto));
      for (const [name, si] of subifsOf(c, p)) {
        const up = !si.shutdown && ps.up;
        o.push(row(name, si.ip?.addr ?? "unassigned", si.shutdown ? "administratively down" : up ? "up" : "down", up ? "up" : "down"));
      }
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
    if (!(sw.l3 || sw.router) || !c.ipRouting) {
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
      if (e.code === "S") return [`${head} [${e.ad ?? 1}/0] via ${e.nh}`];
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
  function showIpRouteFor(rt, dev, ip2) {
    const c = rt.running[dev];
    const sw = rt.topo.devices[dev];
    if (!(sw.l3 || sw.router) || !c.ipRouting) return ["% Network not in table"];
    const dn = ipToInt(ip2);
    let best = null;
    for (const e2 of routeTable(rt.derived, dev)) {
      if (e2.code === "L") continue;
      const m = prefixMaskInt(e2.prefix);
      if ((dn & m) >>> 0 !== (ipToInt(e2.net) & m) >>> 0) continue;
      if (best && best.prefix >= e2.prefix) continue;
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
      o.push(`  Known via "static", distance ${e.ad ?? 1}, metric 0` + (e.prefix === 0 ? ", candidate default path" : ""), "  Routing Descriptor Blocks:", `  * ${e.nh}`, "      Route metric is 0, traffic share count is 1");
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
      o.push(pad(shortIf(p), 10) + pad(rt.running[dev].ifaces[p].description.slice(0, 18), 19) + pad("err-disabled", 13) + (rt.errCause.get(pk(dev, p)) ?? "bpduguard"));
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
    const vlans3 = Object.keys(d.stp).map(Number).filter((v) => d.stp[v][dev] && (only === void 0 || v === only));
    if (only !== void 0 && !vlans3.length) return [`Spanning tree instance(s) for vlan ${only} does not exist.`];
    if (!vlans3.length) return ["No spanning tree instance exists."];
    const o = [];
    for (const v of vlans3) {
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
  function showMac(rt, dev, only) {
    const d = rt.derived;
    const o = ["          Mac Address Table", "-------------------------------------------", "", "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----"];
    const rows = ["0100.0ccc.cccc", "0100.0ccc.cccd", "0180.c200.0000"].map((mac) => ({
      mac,
      line: ` All    ${mac}    STATIC      CPU`
    }));
    for (const e of macTable(d, dev, rt.seenOn(dev)))
      rows.push({ mac: e.mac, line: padL(e.vlan, 4) + "    " + pad(e.mac, 18) + pad("DYNAMIC", 12) + shortIf(e.port) });
    const shown = only ? rows.filter((r) => r.mac === only) : rows;
    o.push(...shown.map((r) => r.line));
    o.push(`Total Mac Addresses for this criterion: ${shown.length}`);
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
  var dhcpClientId = (mac) => ("01" + mac.replace(/\./g, "")).match(/.{1,4}/g).join(".");
  function showDhcpBinding(rt, dev) {
    const out = [
      "Bindings from all pools not associated with VRF:",
      "IP address          Client-ID/              Lease expiration        Type",
      "                    Hardware address/",
      "                    User name"
    ];
    const rows = rt.dhcp.filter((b) => b.server === dev).sort((a, b) => ipToInt(a.ip) - ipToInt(b.ip));
    for (const b of rows) out.push(b.ip.padEnd(20) + dhcpClientId(b.mac).padEnd(24) + b.expires.padEnd(24) + "Automatic");
    return out;
  }
  function showDhcpPool(rt, dev, only) {
    const cfg = rt.running[dev];
    const pools = Object.entries(cfg.dhcpPools ?? {}).filter(([n]) => only === void 0 || n === only);
    if (only !== void 0 && !pools.length) return [`% Pool ${only} not found`];
    const out = [];
    for (const [name, p] of pools) {
      const range = poolRange(cfg, p);
      const leased = rt.dhcp.filter((b) => b.server === dev && b.pool === name);
      const taken = new Set(leased.map((b) => ipToInt(b.ip)));
      let index = null;
      if (range) {
        for (let n = range.first; n <= range.last && index === null; n++) if (!range.excluded(n) && !taken.has(n)) index = n;
      }
      out.push(
        `Pool ${name} :`,
        " Utilization mark (high/low)    : 100 / 0",
        " Subnet size (first/next)       : 0 / 0 ",
        ` Total addresses                : ${range ? range.last - range.first + 1 : 0}`,
        ` Leased addresses               : ${leased.length}`,
        " Pending event                  : none",
        ` ${range ? 1 : 0} subnet${range ? " is" : "s are"} currently in the pool :`
      );
      if (range)
        out.push(
          " Current index        IP address range                    Leased addresses",
          " " + (index === null ? "0.0.0.0" : intToIp(index)).padEnd(21) + intToIp(range.first).padEnd(17) + "- " + intToIp(range.last).padEnd(18) + leased.length
        );
      out.push("");
    }
    return out;
  }
  function showIpInterface(rt, dev, only) {
    const d = rt.derived;
    const c = rt.running[dev];
    const sw = rt.topo.devices[dev];
    const rows = [];
    for (const s of d.svis[dev] ?? []) {
      const cfg = c.svis[String(s.vlan)];
      rows.push({ name: "Vlan" + s.vlan, ip: cfg.ip, l3: cfg.l3, status: s.status === "administratively down" ? "administratively down" : s.up ? "up" : "down", proto: s.up });
    }
    for (const p of sw.ports) {
      const ic = c.ifaces[p];
      const ps = d.phys[pk(dev, p)];
      if (ic.routed || only === p)
        rows.push({ name: p, ip: ic.routed ? ic.ip ?? null : null, l3: ic.l3, status: ps.adminDown ? "administratively down" : ps.up ? "up" : "down", proto: ps.up });
      for (const [name, si] of subifsOf(c, p)) {
        const up = !si.shutdown && ps.up;
        rows.push({ name, ip: si.ip, l3: si.l3, status: si.shutdown ? "administratively down" : up ? "up" : "down", proto: up });
      }
    }
    for (const [n, l] of Object.entries(c.loopbacks ?? {})) rows.push({ name: "Loopback" + n, ip: l.ip, l3: l.l3, status: l.shutdown ? "administratively down" : "up", proto: !l.shutdown });
    const o = [];
    for (const r of rows) {
      if (only && r.name !== only) continue;
      o.push(`${r.name} is ${r.status}, line protocol is ${r.proto ? "up" : "down"}`);
      if (!r.ip) {
        o.push("  Internet protocol processing disabled");
        continue;
      }
      const helpers2 = r.l3?.helpers ?? [];
      o.push(
        `  Internet address is ${r.ip.addr}/${maskToPrefix(r.ip.mask)}`,
        "  Broadcast address is 255.255.255.255",
        `  MTU is ${r.l3?.mtu ?? 1500} bytes`,
        helpers2.length ? `  Helper addresses are ${helpers2.join(" ")}` : "  Helper address is not set",
        "  Outgoing Common access list is not set",
        `  Outgoing access list is ${r.l3?.aclOut ?? "not set"}`,
        "  Inbound Common access list is not set",
        `  Inbound  access list is ${r.l3?.aclIn ?? "not set"}`,
        "  Proxy ARP is enabled"
      );
    }
    return o;
  }

  // src/sim/discovery.ts
  var CDP_HOLDTIME = 180;
  var LLDP_HOLDTIME = 120;
  var cdpOn = (c) => c.cdpRun !== false;
  var lldpOn = (c) => c.lldpRun === true;
  var cdpPort = (c) => !!c && c.cdp !== false;
  var lldpTx = (c) => !!c && c.lldpTx !== false;
  var lldpRx = (c) => !!c && c.lldpRx !== false;
  function upLinks(d, dev) {
    const sw = d.topo.devices[dev];
    if (!sw || sw.kind !== "switch" || d.hw.off.has(dev)) return [];
    const out = [];
    for (const port of sw.ports) {
      const ps = d.phys[pk(dev, port)];
      if (!ps?.up || !ps.peer || ps.peerIsPc) continue;
      out.push({ port, dev: ps.peer.dev, peerPort: ps.peer.port });
    }
    return out;
  }
  function cdpNeighbors(d, dev) {
    const me = d.cfgs[dev];
    if (!me || !cdpOn(me)) return [];
    return upLinks(d, dev).filter((n) => {
      const peer = d.cfgs[n.dev];
      return cdpPort(me.ifaces[n.port]) && cdpOn(peer) && cdpPort(peer.ifaces[n.peerPort]);
    });
  }
  function lldpNeighbors(d, dev) {
    const me = d.cfgs[dev];
    if (!me || !lldpOn(me)) return [];
    return upLinks(d, dev).filter((n) => {
      const peer = d.cfgs[n.dev];
      return lldpRx(me.ifaces[n.port]) && lldpOn(peer) && lldpTx(peer.ifaces[n.peerPort]);
    });
  }
  function cdpBetween(d, dev, port, peerDev, peerPort) {
    const a = d.cfgs[dev], b = d.cfgs[peerDev];
    if (!a || !b || !cdpOn(a) || !cdpOn(b)) return false;
    const phys = (c, p) => c.ifaces[p] ? cdpPort(c.ifaces[p]) : true;
    return phys(a, port) && phys(b, peerPort);
  }
  function cdpIf(name) {
    const m = /^([A-Za-z]+?)(?:Ethernet|-channel)?(\d.*)$/.exec(name);
    if (!m) return name;
    return m[1].slice(0, 3) + " " + m[2];
  }
  function cdpCaps(sw) {
    return sw.router ? "R I" : sw.l3 ? "R S I" : "S I";
  }
  function cdpCapWords(sw) {
    return sw.router ? "Router IGMP" : sw.l3 ? "Router Switch IGMP" : "Switch IGMP";
  }
  function lldpCaps(sw) {
    return sw.router ? "R" : sw.l3 ? "B,R" : "B";
  }
  function mgmtIp(rt, dev, port) {
    const ifs = l3Ifs(rt.derived, dev);
    return ifs.find((i) => i.name === port)?.ip ?? ifs.find((i) => i.kind === "svi")?.ip ?? null;
  }
  function versionLine(sw) {
    return sw.router ? `Cisco IOS Software, ISR Software (${sw.model}), Version 15.4(3)M (Labber Simulated), RELEASE SOFTWARE` : `Cisco IOS Software, ${sw.model} Software (Labber Simulated), Version 15.2(7)E, RELEASE SOFTWARE`;
  }
  var CDP_HEADER = [
    "Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge",
    "                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone,",
    "                  D - Remote, C - CVTA, M - Two-port Mac Relay",
    ""
  ];
  function showCdpNeighbors(rt, dev, detail) {
    if (!cdpOn(rt.running[dev])) return ["% CDP is not enabled"];
    const ns = cdpNeighbors(rt.derived, dev);
    if (detail) {
      const o2 = [];
      for (const n of ns) {
        const peer = rt.topo.devices[n.dev];
        const ip2 = mgmtIp(rt, n.dev, n.peerPort);
        o2.push(
          "-------------------------",
          `Device ID: ${rt.hostname(n.dev)}`,
          "Entry address(es): ",
          ...ip2 ? [`  IP address: ${ip2}`] : [],
          `Platform: cisco ${peer.model},  Capabilities: ${cdpCapWords(peer)} `,
          `Interface: ${n.port},  Port ID (outgoing port): ${n.peerPort}`,
          `Holdtime : ${CDP_HOLDTIME} sec`,
          "",
          "Version :",
          versionLine(peer),
          "Technical Support: http://www.cisco.com/techsupport",
          "",
          "advertisement version: 2",
          "Duplex: full",
          "Management address(es): ",
          ...ip2 ? [`  IP address: ${ip2}`] : [],
          ""
        );
      }
      o2.push("", `Total cdp entries displayed : ${ns.length}`);
      return o2;
    }
    const o = [...CDP_HEADER, "Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID"];
    for (const n of ns) {
      const peer = rt.topo.devices[n.dev];
      o.push(pad(rt.hostname(n.dev), 17) + pad(cdpIf(n.port), 18) + pad(CDP_HOLDTIME, 11) + pad(cdpCaps(peer), 12) + pad(peer.model.slice(0, 9), 10) + cdpIf(n.peerPort));
    }
    o.push("", `Total cdp entries displayed : ${ns.length}`);
    return o;
  }
  function showCdpInterface(rt, dev, only) {
    const c = rt.running[dev];
    if (!cdpOn(c)) return ["% CDP is not enabled"];
    const sw = rt.topo.devices[dev];
    const o = [];
    let up = 0;
    let total = 0;
    for (const port of sw.ports) {
      if (only && port !== only) continue;
      if (!cdpPort(c.ifaces[port])) continue;
      const ps = rt.derived.phys[pk(dev, port)];
      total++;
      if (ps.up) up++;
      o.push(
        `${port} is ${ps.adminDown ? "administratively down" : ps.up ? "up" : "down"}, line protocol is ${ps.up ? "up" : "down"}`,
        "  Encapsulation ARPA",
        "  Sending CDP packets every 60 seconds",
        `  Holdtime is ${CDP_HOLDTIME} seconds`
      );
    }
    if (!only) o.push("", ` cdp enabled interfaces : ${total}`, ` interfaces up          : ${up}`, ` interfaces down        : ${total - up}`);
    return o;
  }
  function showLldpNeighbors(rt, dev, detail) {
    if (!lldpOn(rt.running[dev])) return ["% LLDP is not enabled"];
    const ns = lldpNeighbors(rt.derived, dev);
    if (detail) {
      const o2 = [];
      for (const n of ns) {
        const peer = rt.topo.devices[n.dev];
        const ip2 = mgmtIp(rt, n.dev, n.peerPort);
        const caps = lldpCaps(peer);
        o2.push(
          "------------------------------------------------",
          `Local Intf: ${shortIf(n.port)}`,
          `Chassis id: ${peer.mac}`,
          `Port id: ${shortIf(n.peerPort)}`,
          `Port Description: ${n.peerPort}`,
          `System Name: ${rt.hostname(n.dev)}`,
          "",
          "System Description: ",
          versionLine(peer),
          "Technical Support: http://www.cisco.com/techsupport",
          "",
          `Time remaining: ${LLDP_HOLDTIME} seconds`,
          `System Capabilities: ${caps}`,
          `Enabled Capabilities: ${caps}`,
          "Management Addresses:",
          ...ip2 ? [`    IP: ${ip2}`] : ["    - not advertised"],
          "Auto Negotiation - supported, enabled",
          ""
        );
      }
      o2.push("", `Total entries displayed: ${ns.length}`);
      return o2;
    }
    const o = [
      "Capability codes:",
      "    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device",
      "    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other",
      "",
      "Device ID           Local Intf     Hold-time  Capability      Port ID"
    ];
    for (const n of ns) {
      const peer = rt.topo.devices[n.dev];
      o.push(pad(rt.hostname(n.dev).slice(0, 19), 20) + pad(shortIf(n.port), 15) + pad(LLDP_HOLDTIME, 11) + pad(lldpCaps(peer), 16) + shortIf(n.peerPort));
    }
    o.push("", `Total entries displayed: ${ns.length}`);
    return o;
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
      { p: "show mac address-table address <H.H.H:48 bit mac address>", run: (x, a) => showMac(x.rt, x.dev, normalizeMac(a[4])) },
      { p: "show cdp neighbors", run: (x) => showCdpNeighbors(x.rt, x.dev, false) },
      { p: "show cdp neighbors detail", run: (x) => showCdpNeighbors(x.rt, x.dev, true) },
      { p: "show cdp interface", run: (x) => showCdpInterface(x.rt, x.dev) },
      { p: "show cdp interface <if>", run: (x, a) => showCdpInterface(x.rt, x.dev, x.physName(a[3], a[4], 3)), ifTypes: ["FastEthernet", "GigabitEthernet"] },
      { p: "show lldp neighbors", run: (x) => showLldpNeighbors(x.rt, x.dev, false) },
      { p: "show lldp neighbors detail", run: (x) => showLldpNeighbors(x.rt, x.dev, true) },
      { p: "show port-security", run: (x) => showPortSecurity(x.rt, x.dev) },
      { p: "show access-lists", run: (x) => showAccessLists(x.cfg, x.dev, x.rt.aclHits) },
      { p: "show access-lists <WORD:ACL name or number>", run: (x, a) => showAccessLists(x.cfg, x.dev, x.rt.aclHits, a[2]) },
      { p: "show ip access-lists", run: (x) => showAccessLists(x.cfg, x.dev, x.rt.aclHits) },
      { p: "show ip access-lists <WORD:ACL name or number>", run: (x, a) => showAccessLists(x.cfg, x.dev, x.rt.aclHits, a[3]) },
      { p: "show ip interface", run: (x) => showIpInterface(x.rt, x.dev) },
      // L5-d: NAT (yalnız router; switch'te gizli)
      { p: "show ip nat translations", run: (x) => showNatTranslations(x.cfg, x.dev, x.rt.natTable) },
      { p: "show ip nat statistics", run: (x) => x.natStatistics() },
      // FHRP
      { p: "show standby", run: (x) => showStandby(x.rt.derived, x.dev) },
      { p: "show standby brief", run: (x) => showStandbyBrief(x.rt.derived, x.dev) },
      { p: "show vrrp", run: (x) => showVrrp(x.rt.derived, x.dev) },
      { p: "show vrrp brief", run: (x) => showVrrpBrief(x.rt.derived, x.dev) },
      { p: "show track", run: (x) => showTrack(x.rt.derived, x.dev) },
      { p: "show ip interface <if>", run: (x, a) => showIpInterface(x.rt, x.dev, x.resolveL3(a[3], a[4], 3)) },
      { p: "show port-security address", run: (x) => showPortSecurityAddress(x.rt, x.dev) },
      { p: "show port-security interface <if>", run: (x, a) => showPortSecurityInterface(x.rt, x.dev, x.physName(a[3], a[4], 3)), ifTypes: ["FastEthernet", "GigabitEthernet"] },
      { p: "show history", run: (x) => x.history.slice(-20).map((h) => "  " + h) },
      // L5-b: DHCP server
      { p: "show ip dhcp binding", run: (x) => showDhcpBinding(x.rt, x.dev) },
      { p: "show ip dhcp pool", run: (x) => showDhcpPool(x.rt, x.dev) },
      { p: "show ip dhcp pool <WORD:Pool name>", run: (x, a) => showDhcpPool(x.rt, x.dev, a[4]) }
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
    // L5-i: tek satırlık seçenekler ve etkileşimli extended ping
    { p: "ping <A.B.C.D:Ping destination address> <LINE:repeat | size | source | timeout …>", run: (x, a) => x.pingOptions(a[1], a[2]) },
    { p: "ping", run: (x) => x.extendedPing() },
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
    { p: "clear ip nat translation *", run: (x) => x.clearNat() },
    {
      p: "clear access-list counters",
      run: (x) => {
        for (const k of [...x.rt.aclHits.keys()]) if (k.startsWith(x.dev + "|")) x.rt.aclHits.delete(k);
      }
    },
    {
      p: "clear mac address-table dynamic",
      run: (x) => {
        x.rt.clearMacs(x.dev);
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
        for (const k of [...x.rt.arpIncomplete]) if (k.startsWith(x.dev + ">")) x.rt.arpIncomplete.delete(k);
      }
    },
    { p: "clear ip dhcp binding *", run: (x) => void x.rt.dhcpClear(x.dev) },
    {
      p: "clear ip dhcp binding <A.B.C.D:IP address of the binding>",
      run: (x, a) => x.rt.dhcpClear(x.dev, a[4]) ? [] : [`% Binding ${a[4]} not found`]
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
      // FHRP: izlenen nesne (yalnız arayüz line-protocol'ü modellenir)
      { p: "track <1-1000:Tracked object> interface <if> line-protocol", run: (x, a) => x.trackObject(Number(a[1]), x.resolveL3(a[3], a[4], 3)) },
      { p: "no track <1-1000:Tracked object>", run: (x, a) => void delete x.cfg.tracks?.[a[2]] },
      { p: "no vlan <vlist:ISL VLAN IDs 1-4094>", run: (x, a) => x.deleteVlan(a[2]) },
      { p: "interface <if>", run: (x, a) => x.enterIf(a[1], a[2]) },
      { p: "interface range <LINE:Interface range, e.g. fa0/1 - 4, gi0/1>", run: (x, a) => x.enterRange(a[2]) },
      {
        p: "no interface <if>",
        run: (x, a) => x.deleteIf(a[2], a[3]),
        // router: loopback or a subinterface (`no interface Gi0/0.10`)
        ifTypes: def.router ? ["Loopback", "FastEthernet", "GigabitEthernet"] : ["Port-channel", "Vlan", "Loopback"]
      },
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
      // L5-b: DHCP server
      { p: "ip dhcp pool <WORD:Pool name>", run: (x, a) => x.enterPool(a[3]) },
      { p: "no ip dhcp pool <WORD:Pool name>", run: (x, a) => x.deletePool(a[4]) },
      { p: "ip dhcp excluded-address <A.B.C.D:Low IP address>", run: (x, a) => x.dhcpExclude(a[3], a[3], true) },
      { p: "ip dhcp excluded-address <A.B.C.D:Low IP address> <A.B.C.D:High IP address>", run: (x, a) => x.dhcpExclude(a[3], a[4], true) },
      { p: "no ip dhcp excluded-address <A.B.C.D:Low IP address>", run: (x, a) => x.dhcpExclude(a[4], a[4], false) },
      { p: "no ip dhcp excluded-address <A.B.C.D:Low IP address> <A.B.C.D:High IP address>", run: (x, a) => x.dhcpExclude(a[4], a[5], false) },
      { p: "no ip domain-lookup", run: () => {
      } },
      // L5-c: access lists
      { p: "access-list <1-199:IP access list number> <LINE:permit | deny …>", run: (x, a) => x.aclNumbered(a[1], a[2]) },
      { p: "no access-list <1-199:IP access list number>", run: (x, a) => void delete x.cfg.acls?.[a[2]] },
      { p: "ip access-list standard <WORD:Access-list name>", run: (x, a) => x.enterAcl(a[3], "standard") },
      { p: "ip access-list extended <WORD:Access-list name>", run: (x, a) => x.enterAcl(a[3], "extended") },
      { p: "no ip access-list standard <WORD:Access-list name>", run: (x, a) => x.deleteAcl(a[4], "standard") },
      { p: "no ip access-list extended <WORD:Access-list name>", run: (x, a) => x.deleteAcl(a[4], "extended") },
      // L5-f: CDP (IOS: varsayılan açık), LLDP (varsayılan kapalı)
      { p: "cdp run", run: (x) => void delete x.cfg.cdpRun },
      { p: "no cdp run", run: (x) => void (x.cfg.cdpRun = false) },
      { p: "lldp run", run: (x) => void (x.cfg.lldpRun = true) },
      { p: "no lldp run", run: (x) => void delete x.cfg.lldpRun },
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
    if (def.l3 || def.router) {
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
          p: "ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router's address> <1-255:Distance metric for this route>",
          run: (x, a) => x.addRoute(a[2], a[3], a[4], Number(a[5]))
        },
        {
          p: "no ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask>",
          run: (x, a) => x.removeRoute(a[3], a[4], null)
        },
        {
          p: "no ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router's address>",
          run: (x, a) => x.removeRoute(a[3], a[4], a[5])
        },
        {
          p: "no ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router's address> <1-255:Distance metric for this route>",
          run: (x, a) => x.removeRoute(a[3], a[4], a[5])
        }
      );
    }
    if (def.router) {
      const L = "<A.B.C.D:Inside local IP address>", G = "<A.B.C.D:Inside global IP address>";
      const LP = "<1-65535:Local UDP/TCP port>", GP = "<1-65535:Global UDP/TCP port>";
      const ACL = "<WORD:Access list number or name for local addresses>", POOL = "<WORD:Name pool of global addresses>";
      p.push(
        { p: `ip nat inside source static ${L} ${G}`, run: (x, a) => x.natStatic(true, { local: a[5], global: a[6] }) },
        { p: `no ip nat inside source static ${L} ${G}`, run: (x, a) => x.natStatic(false, { local: a[6], global: a[7] }) },
        ...["tcp", "udp"].flatMap((pr) => [
          { p: `ip nat inside source static ${pr} ${L} ${LP} ${G} ${GP}`, run: (x, a) => x.natStatic(true, { proto: pr, local: a[6], lport: Number(a[7]), global: a[8], gport: Number(a[9]) }) },
          { p: `no ip nat inside source static ${pr} ${L} ${LP} ${G} ${GP}`, run: (x, a) => x.natStatic(false, { proto: pr, local: a[7], lport: Number(a[8]), global: a[9], gport: Number(a[10]) }) }
        ]),
        { p: `ip nat pool ${POOL} <A.B.C.D:Start IP address> <A.B.C.D:End IP address> netmask <A.B.C.D:Network mask>`, run: (x, a) => x.natPool(a[3], a[4], a[5], a[7]) },
        { p: `no ip nat pool ${POOL}`, run: (x, a) => x.natNoPool(a[4]) },
        { p: `no ip nat pool ${POOL} <A.B.C.D:Start IP address> <A.B.C.D:End IP address> netmask <A.B.C.D:Network mask>`, run: (x, a) => x.natNoPool(a[4]) },
        { p: `ip nat inside source list ${ACL} pool ${POOL}`, run: (x, a) => x.natRule({ acl: a[5], pool: a[7], overload: false }) },
        { p: `ip nat inside source list ${ACL} pool ${POOL} overload`, run: (x, a) => x.natRule({ acl: a[5], pool: a[7], overload: true }) },
        { p: `ip nat inside source list ${ACL} interface <if>`, run: (x, a) => x.natRule({ acl: a[5], iface: x.resolveL3(a[7], a[8], 7), overload: false }), ifTypes: ["FastEthernet", "GigabitEthernet"] },
        { p: `ip nat inside source list ${ACL} interface <if> overload`, run: (x, a) => x.natRule({ acl: a[5], iface: x.resolveL3(a[7], a[8], 7), overload: true }), ifTypes: ["FastEthernet", "GigabitEthernet"] },
        { p: `no ip nat inside source list ${ACL}`, run: (x, a) => x.natNoRule(a[6]) },
        { p: `no ip nat inside source list ${ACL} pool ${POOL}`, run: (x, a) => x.natNoRule(a[6]) },
        { p: `no ip nat inside source list ${ACL} pool ${POOL} overload`, run: (x, a) => x.natNoRule(a[6]) },
        { p: `no ip nat inside source list ${ACL} interface <if>`, run: (x, a) => x.natNoRule(a[6]), ifTypes: ["FastEthernet", "GigabitEthernet"] },
        { p: `no ip nat inside source list ${ACL} interface <if> overload`, run: (x, a) => x.natNoRule(a[6]), ifTypes: ["FastEthernet", "GigabitEthernet"] }
      );
    }
    return def.router ? p.filter((x) => !ROUTER_HIDDEN_CONFIG.test(x.p)) : p;
  };
  var ROUTER_HIDDEN_CONFIG = /^(no )?(vlan|spanning-tree|errdisable) /;
  var SWITCH_HIDDEN_SHOW = /^(show|clear) ip nat /;
  var ROUTER_HIDDEN_SHOW = /^show (vlan|spanning-tree|mac address-table|interfaces (trunk|status|switchport)|interfaces <if> switchport|etherchannel|errdisable|vtp|port-security)/;
  function fhrpIfPatterns() {
    const HG = "<0-255:group number>", VG = "<1-255:Group number>";
    const track = (t) => (g) => {
      const list = (g.tracks ?? []).filter((x) => t.obj !== void 0 ? x.obj !== t.obj : x.iface !== t.iface);
      g.tracks = [...list, t];
    };
    const untrack = (t) => (g) => {
      g.tracks = (g.tracks ?? []).filter((x) => t.obj !== void 0 ? x.obj !== t.obj : x.iface !== t.iface);
      if (!g.tracks.length) delete g.tracks;
    };
    return [
      { p: `standby ${HG} ip <A.B.C.D:Virtual IP address>`, run: (x, a) => x.fhrp("hsrp", Number(a[1]), (g) => void (g.ip = a[3])) },
      { p: "standby ip <A.B.C.D:Virtual IP address>", run: (x, a) => x.fhrp("hsrp", 0, (g) => void (g.ip = a[2])) },
      { p: `no standby ${HG} ip`, run: (x, a) => x.fhrp("hsrp", Number(a[2]), (g) => void (g.ip = null), false) },
      { p: `no standby ${HG} ip <A.B.C.D:Virtual IP address>`, run: (x, a) => x.fhrp("hsrp", Number(a[2]), (g) => void (g.ip = null), false) },
      { p: `standby ${HG} priority <0-255:Priority level>`, run: (x, a) => x.fhrp("hsrp", Number(a[1]), (g) => void (g.priority = Number(a[3]))) },
      { p: `no standby ${HG} priority`, run: (x, a) => x.fhrp("hsrp", Number(a[2]), (g) => void delete g.priority, false) },
      { p: `standby ${HG} preempt`, run: (x, a) => x.fhrp("hsrp", Number(a[1]), (g) => void (g.preempt = true)) },
      { p: `no standby ${HG} preempt`, run: (x, a) => x.fhrp("hsrp", Number(a[2]), (g) => void delete g.preempt, false) },
      { p: `standby ${HG} track <1-1000:Tracked object number>`, run: (x, a) => x.fhrp("hsrp", Number(a[1]), track({ obj: Number(a[3]) })) },
      { p: `standby ${HG} track <1-1000:Tracked object number> decrement <1-255:Priority decrement>`, run: (x, a) => x.fhrp("hsrp", Number(a[1]), track({ obj: Number(a[3]), decrement: Number(a[5]) })) },
      { p: `standby ${HG} track <if>`, run: (x, a) => x.fhrp("hsrp", Number(a[1]), track({ iface: x.resolveL3(a[3], a[4], 3) })) },
      { p: `standby ${HG} track <if> <1-255:Priority decrement>`, run: (x, a) => x.fhrp("hsrp", Number(a[1]), track({ iface: x.resolveL3(a[3], a[4], 3), decrement: Number(a[5]) })) },
      { p: `no standby ${HG} track <1-1000:Tracked object number>`, run: (x, a) => x.fhrp("hsrp", Number(a[2]), untrack({ obj: Number(a[4]) }), false) },
      { p: `no standby ${HG} track <if>`, run: (x, a) => x.fhrp("hsrp", Number(a[2]), untrack({ iface: x.resolveL3(a[4], a[5], 4) }), false) },
      { p: `no standby ${HG}`, run: (x, a) => x.fhrp("hsrp", Number(a[2]), (g) => void Object.assign(g, { ip: null, priority: void 0, preempt: void 0, tracks: void 0 }), false) },
      { p: "standby version 1", run: () => void 0 },
      { p: "standby version 2", run: () => ["% HSRP version 2 is not modelled in this lab."] },
      { p: `vrrp ${VG} ip <A.B.C.D:IP address>`, run: (x, a) => x.fhrp("vrrp", Number(a[1]), (g) => void (g.ip = a[3])) },
      { p: `no vrrp ${VG} ip`, run: (x, a) => x.fhrp("vrrp", Number(a[2]), (g) => void (g.ip = null), false) },
      { p: `no vrrp ${VG} ip <A.B.C.D:IP address>`, run: (x, a) => x.fhrp("vrrp", Number(a[2]), (g) => void (g.ip = null), false) },
      { p: `vrrp ${VG} priority <1-254:Priority level>`, run: (x, a) => x.fhrp("vrrp", Number(a[1]), (g) => void (g.priority = Number(a[3]))) },
      { p: `no vrrp ${VG} priority`, run: (x, a) => x.fhrp("vrrp", Number(a[2]), (g) => void delete g.priority, false) },
      { p: `vrrp ${VG} preempt`, run: (x, a) => x.fhrp("vrrp", Number(a[1]), (g) => void delete g.preempt) },
      { p: `no vrrp ${VG} preempt`, run: (x, a) => x.fhrp("vrrp", Number(a[2]), (g) => void (g.preempt = false)) },
      { p: `no vrrp ${VG}`, run: (x, a) => x.fhrp("vrrp", Number(a[2]), (g) => void Object.assign(g, { ip: null, priority: void 0, preempt: void 0 }), false) }
    ];
  }
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
    { p: "no bandwidth", run: (x) => x.eachL3((o) => void delete o.bandwidth) },
    // L5-b: DHCP relay
    {
      p: "ip helper-address <A.B.C.D:IP destination address>",
      run: (x, a) => x.eachL3((o) => {
        const h = o.helpers ?? (o.helpers = []);
        if (!h.includes(a[2])) h.push(a[2]);
      })
    },
    {
      p: "no ip helper-address <A.B.C.D:IP destination address>",
      run: (x, a) => x.eachL3((o) => {
        o.helpers = (o.helpers ?? []).filter((h) => h !== a[3]);
        if (!o.helpers.length) delete o.helpers;
      })
    },
    { p: "no ip helper-address", run: (x) => x.eachL3((o) => void delete o.helpers) },
    // L5-c: `ip access-group` (routed port, subinterface, SVI)
    { p: "ip access-group <WORD:IP access list (standard or extended)> in", run: (x, a) => x.eachL3((o) => void (o.aclIn = a[2])) },
    { p: "ip access-group <WORD:IP access list (standard or extended)> out", run: (x, a) => x.eachL3((o) => void (o.aclOut = a[2])) },
    { p: "no ip access-group <WORD:IP access list (standard or extended)> in", run: (x) => x.eachL3((o) => void delete o.aclIn) },
    { p: "no ip access-group <WORD:IP access list (standard or extended)> out", run: (x) => x.eachL3((o) => void delete o.aclOut) },
    { p: "no ip access-group in", run: (x) => x.eachL3((o) => void delete o.aclIn) },
    ...fhrpIfPatterns(),
    { p: "no ip access-group out", run: (x) => x.eachL3((o) => void delete o.aclOut) }
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
  var discoveryIfPatterns = [
    { p: "cdp enable", run: (x) => x.eachPhys((c) => void delete c.cdp) },
    { p: "no cdp enable", run: (x) => x.eachPhys((c) => void (c.cdp = false)) },
    { p: "lldp transmit", run: (x) => x.eachPhys((c) => void delete c.lldpTx) },
    { p: "no lldp transmit", run: (x) => x.eachPhys((c) => void (c.lldpTx = false)) },
    { p: "lldp receive", run: (x) => x.eachPhys((c) => void delete c.lldpRx) },
    { p: "no lldp receive", run: (x) => x.eachPhys((c) => void (c.lldpRx = false)) }
  ];
  var natIfPatterns = [
    { p: "ip nat inside", run: (x) => x.eachL3((o) => void (o.nat = "inside")) },
    { p: "ip nat outside", run: (x) => x.eachL3((o) => void (o.nat = "outside")) },
    { p: "no ip nat inside", run: (x) => x.eachL3((o) => void (o.nat === "inside" && delete o.nat)) },
    { p: "no ip nat outside", run: (x) => x.eachL3((o) => void (o.nat === "outside" && delete o.nat)) }
  ];
  var routerIfPatterns = [
    ...commonSub,
    { p: "shutdown", run: (x) => x.eachPhys((c) => void (c.shutdown = true)) },
    { p: "no shutdown", run: (x) => x.eachPhys((c) => void (c.shutdown = false)) },
    { p: "description <LINE:Up to 240 characters describing this interface>", run: (x, a) => x.eachPhys((c) => void (c.description = a[1].slice(0, 240))) },
    { p: "no description", run: (x) => x.eachPhys((c) => void (c.description = "")) },
    { p: "ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>", run: (x, a) => x.setIp(a[2], a[3]) },
    { p: "no ip address", run: (x) => x.eachPhys((c) => void (c.ip = null)) },
    ...l3OptPatterns,
    ...natIfPatterns,
    ...discoveryIfPatterns
  ];
  var subIfPatterns = [
    ...commonSub,
    { p: "encapsulation dot1Q <1-4094:IEEE 802.1Q VLAN ID>", run: (x, a) => x.encapsulation(Number(a[2]), false) },
    { p: "encapsulation dot1Q <1-4094:IEEE 802.1Q VLAN ID> native", run: (x, a) => x.encapsulation(Number(a[2]), true) },
    { p: "no encapsulation dot1Q", run: (x) => x.eachSub((c) => Object.assign(c, { vlan: null, native: false, ip: null })) },
    { p: "shutdown", run: (x) => x.eachSub((c) => void (c.shutdown = true)) },
    { p: "no shutdown", run: (x) => x.eachSub((c) => void (c.shutdown = false)) },
    { p: "description <LINE:Up to 240 characters describing this interface>", run: (x, a) => x.eachSub((c) => void (c.description = a[1].slice(0, 240))) },
    { p: "no description", run: (x) => x.eachSub((c) => void (c.description = "")) },
    { p: "ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>", run: (x, a) => x.setIp(a[2], a[3]) },
    { p: "no ip address", run: (x) => x.eachSub((c) => void (c.ip = null)) },
    ...l3OptPatterns,
    ...natIfPatterns
  ];
  var l2IfPatterns = (def) => {
    if (def.router) return routerIfPatterns;
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
      { p: "switchport access vlan <1-4094:VLAN ID of the VLAN when this port is in access mode>", run: (x, a) => x.accessVlan(Number(a[3])) },
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
      { p: "no channel-group", run: (x) => x.noChannelGroup() },
      ...discoveryIfPatterns,
      // L5-e: port security (access ports)
      { p: "switchport port-security", run: (x) => x.portSec((ps) => void (ps.enabled = true)) },
      { p: "no switchport port-security", run: (x) => x.portSec((ps) => void (ps.enabled = false)) },
      { p: "switchport port-security maximum <1-1024:Maximum addresses>", run: (x, a) => x.portSecMax(Number(a[3])) },
      { p: "no switchport port-security maximum", run: (x) => x.portSecMax(1) },
      { p: "switchport port-security violation shutdown", run: (x) => x.portSec((ps) => void (ps.violation = "shutdown")) },
      { p: "switchport port-security violation restrict", run: (x) => x.portSec((ps) => void (ps.violation = "restrict")) },
      { p: "switchport port-security violation protect", run: (x) => x.portSec((ps) => void (ps.violation = "protect")) },
      { p: "no switchport port-security violation", run: (x) => x.portSec((ps) => void (ps.violation = "shutdown")) },
      { p: "switchport port-security mac-address <H.H.H:48 bit mac address>", run: (x, a) => x.portSecMac(a[3], false, true) },
      { p: "no switchport port-security mac-address <H.H.H:48 bit mac address>", run: (x, a) => x.portSecMac(a[4], false, false) },
      { p: "switchport port-security mac-address sticky", run: (x) => x.portSecSticky(true) },
      { p: "no switchport port-security mac-address sticky", run: (x) => x.portSecSticky(false) },
      { p: "switchport port-security mac-address sticky <H.H.H:48 bit mac address>", run: (x, a) => x.portSecMac(a[4], true, true) },
      { p: "no switchport port-security mac-address sticky <H.H.H:48 bit mac address>", run: (x, a) => x.portSecMac(a[5], true, false) }
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
  var aclPatterns = [
    ...commonSub,
    { p: "permit <LINE:permit conditions>", run: (x, a) => x.aclLine(null, "permit " + a[1], 1) },
    { p: "deny <LINE:deny conditions>", run: (x, a) => x.aclLine(null, "deny " + a[1], 1) },
    { p: "<1-2147483647:Sequence Number> permit <LINE:permit conditions>", run: (x, a) => x.aclLine(Number(a[0]), "permit " + a[2], 2) },
    { p: "<1-2147483647:Sequence Number> deny <LINE:deny conditions>", run: (x, a) => x.aclLine(Number(a[0]), "deny " + a[2], 2) },
    { p: "no <1-2147483647:Sequence Number>", run: (x, a) => x.aclNoSeq(Number(a[1])) }
  ];
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
  var dhcpPoolPatterns = [
    ...commonSub,
    { p: "network <A.B.C.D:Network number in dotted-decimal notation> <A.B.C.D:Network mask>", run: (x, a) => x.poolNetwork(a[1], a[2]) },
    { p: "network <A.B.C.D:Network number in dotted-decimal notation> <WORD:Network mask or prefix length (/nn)>", run: (x, a) => x.poolNetwork(a[1], a[2]) },
    { p: "no network", run: (x) => void (x.poolCfg.net = null) },
    { p: "default-router <A.B.C.D:Router's IP address>", run: (x, a) => void (x.poolCfg.defaultRouter = a[1]) },
    { p: "no default-router", run: (x) => void (x.poolCfg.defaultRouter = null) },
    { p: "dns-server <A.B.C.D:Server's IP address>", run: (x, a) => void (x.poolCfg.dns = a[1]) },
    { p: "no dns-server", run: (x) => void (x.poolCfg.dns = null) }
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
      const exec = (ps) => ps.filter((x) => !(def.router ? ROUTER_HIDDEN_SHOW : SWITCH_HIDDEN_SHOW).test(x.p));
      t = {
        user: buildTrie(exec(userPatterns)),
        priv: buildTrie(exec(privPatterns)),
        config: buildTrie(configPatterns(def)),
        if: buildTrie(l2IfPatterns(def)),
        svi: buildTrie(sviPatterns),
        subif: buildTrie(subIfPatterns),
        vlan: buildTrie(vlanPatterns),
        router: buildTrie(routerPatterns),
        dhcp: buildTrie(dhcpPoolPatterns),
        acl: buildTrie(aclPatterns),
        // FHRP: `track N interface … line-protocol` alt kipi (gecikme vb. modellenmez)
        track: buildTrie(commonSub)
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
      /** L5-c: list being edited in `(config-std-nacl)` / `(config-ext-nacl)` */
      __publicField(this, "aclName", "");
      /** L5-b: pool under `ip dhcp pool <name>` */
      __publicField(this, "pool", "");
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
        case "dhcp":
          return h + "(dhcp-config)#";
        case "track":
          return h + "(config-track)#";
        case "acl":
          return h + (this.cfg.acls?.[this.aclName]?.type === "extended" ? "(config-ext-nacl)#" : "(config-std-nacl)#");
      }
    }
    get inConfig() {
      return this.mode === "config" || this.mode === "if" || this.mode === "vlan" || this.mode === "router" || this.mode === "dhcp" || this.mode === "acl" || this.mode === "track";
    }
    trie() {
      const t = tries(this.def);
      if (this.mode === "if" && (this.ifs[0]?.startsWith("Vlan") || this.ifs[0]?.startsWith("Loopback"))) return t.svi;
      if (this.mode === "if" && this.ifs[0]?.includes(".")) return t.subif;
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
      if (!r.ok && (this.mode === "if" || this.mode === "vlan" || this.mode === "router" || this.mode === "dhcp" || this.mode === "acl" || this.mode === "track") && r.err !== "empty") {
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
    /**
     * `switchport access vlan N`. IOS (VTP server/transparent) creates a missing VLAN:
     * `% Access VLAN does not exist. Creating vlan N`. A VLAN deleted later (`no vlan N`)
     * leaves the port inactive.
     */
    accessVlan(v) {
      this.eachL2((c) => void (c.accessVlan = v));
      if (this.cfg.vlans[String(v)] !== void 0) return;
      this.cfg.vlans[String(v)] = defaultVlanName(v);
      return [`% Access VLAN does not exist. Creating vlan ${v}`];
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
      var _a, _b;
      const name = canonIf(type, num);
      if (!name) throw new InvalidAt(argIndex);
      if (this.def.router && (name.startsWith("Vlan") || name.startsWith("Port-channel"))) throw new InvalidAt(argIndex);
      if (name.includes(".")) {
        const [parent, sub] = [name.slice(0, name.indexOf(".")), name.slice(name.indexOf(".") + 1)];
        if (!this.def.router || !this.cfg.ifaces[parent] || !/^\d+$/.test(sub) || Number(sub) < 1 || Number(sub) > 4294967295)
          throw new InvalidAt(argIndex + 1);
        const full = parent + "." + Number(sub);
        const subs = (_a = this.cfg).subifs ?? (_a.subifs = {});
        if (create && !subs[full]) subs[full] = { parent, vlan: null, native: false, shutdown: false, description: "", ip: null };
        if (!subs[full]) throw new InvalidAt(argIndex + 1);
        return full;
      }
      if (name.startsWith("Vlan")) {
        const v = Number(num);
        if (!/^\d+$/.test(num) || v < 1 || v > 4094) throw new InvalidAt(argIndex + 1);
        if (create && !this.cfg.svis[String(v)]) this.cfg.svis[String(v)] = defaultSvi(v);
        return name;
      }
      if (name.startsWith("Loopback")) {
        const n = Number(num);
        if (!/^\d+$/.test(num) || n > 2147483647) throw new InvalidAt(argIndex + 1);
        const lbs = (_b = this.cfg).loopbacks ?? (_b.loopbacks = {});
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
      const base2 = from ? pickL2(from) : { shutdown: false, description: "", mode: "dynamic-auto", accessVlan: 1, nativeVlan: 1, allowed: null, nonegotiate: false, encapDot1q: false, portfast: false };
      base2.shutdown = false;
      base2.description = "";
      return base2;
    }
    // ---- L5-c: access lists ----
    aclSyntax(e, argIndex) {
      if (e instanceof AclSyntax) throw new InvalidAt(argIndex);
      throw e;
    }
    /** `access-list N permit|deny …`: appended with the next sequence number. */
    // ---- L5-d: NAT ----
    natCfg() {
      var _a;
      return (_a = this.cfg).nat ?? (_a.nat = emptyNat());
    }
    natStatic(add, s) {
      const n = this.natCfg();
      const same = (x) => x.proto === s.proto && x.local === s.local && x.global === s.global && x.lport === s.lport && x.gport === s.gport;
      if (!add) {
        const i = n.statics.findIndex(same);
        if (i < 0) return ["%Translation not found"];
        n.statics.splice(i, 1);
        return;
      }
      if (n.statics.some(same)) return;
      const clash = n.statics.find((x) => x.proto === s.proto && (s.proto ? x.local === s.local && x.lport === s.lport || x.global === s.global && x.gport === s.gport : x.local === s.local || x.global === s.global));
      if (clash) return [`% similar static entry (${clash.local} -> ${clash.global}) already exists`];
      n.statics.push(s);
    }
    natPool(name, start, end, mask) {
      const m = ipToInt(mask);
      if (maskToPrefix(mask) === null || m === null) throw new InvalidAt(7);
      if (ipToInt(end) >>> 0 < ipToInt(start) >>> 0) return ["%End address less than starting address"];
      if ((ipToInt(start) & m) >>> 0 !== (ipToInt(end) & m) >>> 0) return ["%Start and end addresses on different subnets"];
      this.natCfg().pools[name] = { start, end, mask };
    }
    natNoPool(name) {
      const n = this.natCfg();
      if (!n.pools[name]) return [`%Pool ${name} not found`];
      if (n.rules.some((r) => r.pool === name)) return [`%Pool ${name} in use, cannot destroy`];
      delete n.pools[name];
    }
    natRule(r) {
      const n = this.natCfg();
      const i = n.rules.findIndex((x) => x.acl === r.acl);
      if (i >= 0) n.rules[i] = r;
      else n.rules.push(r);
    }
    natNoRule(aclName) {
      const n = this.natCfg();
      const i = n.rules.findIndex((x) => x.acl === aclName);
      if (i < 0) return ["%Dynamic mapping not found"];
      const drop = () => {
        n.rules.splice(i, 1);
        this.rt.natTable.splice(0, this.rt.natTable.length, ...this.rt.natTable.filter((e) => e.dev !== this.dev));
      };
      if (!this.rt.natTable.some((e) => e.dev === this.dev)) return void n.rules.splice(i, 1);
      return this.ask("%Dynamic mapping in use, do you want to delete all entries? [no]: ", (line) => {
        if (/^y(es?)?$/i.test(line.trim())) drop();
      });
    }
    clearNat() {
      this.rt.natTable.splice(0, this.rt.natTable.length, ...this.rt.natTable.filter((e) => e.dev !== this.dev));
      this.rt.emit();
    }
    natStatistics() {
      const names = (role2) => {
        const o = [];
        for (const [n, c] of Object.entries(this.cfg.ifaces)) if (c.l3?.nat === role2) o.push(n);
        for (const [n, c] of Object.entries(this.cfg.subifs ?? {})) if (c.l3?.nat === role2) o.push(n);
        return o;
      };
      return showNatStatistics(this.cfg, this.dev, this.rt.natTable, this.rt.natHits, this.rt.natMisses, { inside: names("inside"), outside: names("outside") });
    }
    aclNumbered(num, rest) {
      var _a;
      const kind = aclKind(num);
      const lists = (_a = this.cfg).acls ?? (_a.acls = {});
      const list = lists[num] ?? (lists[num] = { type: kind, entries: [] });
      try {
        return insertEntry(list, parseEntry(rest.trim().split(/\s+/), kind, nextSeq(list)));
      } catch (e) {
        if (!list.entries.length) delete lists[num];
        this.aclSyntax(e, 2);
      }
    }
    enterAcl(name, type) {
      var _a;
      const num = aclKind(name);
      if (num && num !== type) return [`% Invalid access list number for ${type} list`];
      const lists = (_a = this.cfg).acls ?? (_a.acls = {});
      const cur = lists[name];
      if (cur && cur.type !== type) return [`% A named ${cur.type} IP access list with this name already exists`];
      lists[name] ?? (lists[name] = { type, entries: [] });
      this.aclName = name;
      this.mode = "acl";
    }
    deleteAcl(name, type) {
      if (this.cfg.acls?.[name]?.type === type) delete this.cfg.acls[name];
    }
    aclLine(seq, text, argIndex) {
      const list = this.cfg.acls[this.aclName];
      try {
        return insertEntry(list, parseEntry(text.trim().split(/\s+/), list.type, seq ?? nextSeq(list)));
      } catch (e) {
        this.aclSyntax(e, argIndex);
      }
    }
    aclNoSeq(seq) {
      const list = this.cfg.acls[this.aclName];
      list.entries = list.entries.filter((e) => e.seq !== seq);
    }
    /** An L3 interface name for show commands (physical, subinterface, SVI, loopback). */
    // ---- FHRP ----
    trackObject(n, iface) {
      var _a;
      ;
      ((_a = this.cfg).tracks ?? (_a.tracks = {}))[String(n)] = { iface };
      this.mode = "track";
    }
    /** Apply to group `n` of HSRP/VRRP on the interface; empty groups are removed (as IOS). */
    fhrp(proto, n, fn, create = true) {
      let out = void 0;
      this.eachL3((o) => {
        const list = proto === "hsrp" ? o.hsrp ?? (o.hsrp = []) : o.vrrp ?? (o.vrrp = []);
        let g = list.find((x) => x.group === n);
        if (!g && create) {
          g = { group: n, ip: null };
          list.push(g);
          list.sort((a, b) => a.group - b.group);
        }
        if (g) out = fn(g);
        const empty = (x) => !x.ip && x.priority === void 0 && x.preempt === void 0 && !x.tracks?.length;
        const kept = list.filter((x) => !empty(x));
        if (proto === "hsrp") kept.length ? o.hsrp = kept : delete o.hsrp;
        else kept.length ? o.vrrp = kept : delete o.vrrp;
      });
      return out;
    }
    resolveL3(type, num, argIndex) {
      return this.resolveIf(type, num, argIndex, false);
    }
    // ---- L5-e: port security ----
    /** Apply to the selected ports; IOS rejects port security on trunk and dynamic ports. */
    portSec(fn) {
      const out = [];
      for (const name of this.ifs) {
        const c = this.cfg.ifaces[name];
        if (!c) continue;
        if (c.mode !== "access") throw new CliError([`Command rejected: ${name} is a ${c.mode === "trunk" ? "trunk" : "dynamic"} port.`]);
        const r = fn(c.portSecurity ?? (c.portSecurity = defaultPortSecurity()), name);
        if (r) out.push(...r);
      }
      return out.length ? out : void 0;
    }
    portSecMax(n) {
      return this.portSec((ps, name) => {
        const dyn = this.rt.psDynamic.get(`${this.dev}|${name}`) ?? [];
        if (n < secureCount(ps, dyn)) return ["Maximum is less than number of currently secured mac-addresses."];
        ps.max = n;
      });
    }
    portSecMac(raw, sticky, add) {
      const mac = normalizeMac(raw);
      if (!mac || parseInt(mac.slice(0, 2), 16) % 2 === 1) return ["% Invalid MAC address"];
      return this.portSec((ps, name) => {
        const list = sticky ? ps.stickyMacs : ps.macs;
        if (!add) {
          const i = list.indexOf(mac);
          if (i >= 0) list.splice(i, 1);
          return;
        }
        if (ps.macs.includes(mac) || ps.stickyMacs.includes(mac)) return;
        if (ps.macs.length + ps.stickyMacs.length >= ps.max)
          return [`Total secure mac-addresses on interface ${name} has reached maximum limit.`];
        if (sticky) ps.sticky = true;
        list.push(mac);
      });
    }
    /** `mac-address sticky`: dynamic addresses become sticky; `no …` turns sticky ones dynamic. */
    portSecSticky(on) {
      return this.portSec((ps, name) => {
        const key = `${this.dev}|${name}`;
        if (on) {
          ps.sticky = true;
          ps.stickyMacs.push(...this.rt.psDynamic.get(key) ?? []);
          this.rt.psDynamic.delete(key);
        } else {
          ps.sticky = false;
          this.rt.psDynamic.set(key, [...this.rt.psDynamic.get(key) ?? [], ...ps.stickyMacs]);
          ps.stickyMacs = [];
        }
      });
    }
    /** A physical port of this device (show commands); anything else is invalid input. */
    physName(type, num, argIndex) {
      const name = canonIf(type, num);
      if (!name || !this.cfg.ifaces[name]) throw new InvalidAt(argIndex + 1);
      return name;
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
        const m = /^([A-Za-z-]+)\s*(\d+\/)?(\d+)(?:-(?:([A-Za-z-]+)\s*(\d+\/)?)?(\d+))?$/.exec(part.trim());
        if (!m) throw new InvalidAt(2);
        if (m[4] && (canonIf(m[4], (m[5] ?? "") + m[6]) !== canonIf(m[1], (m[2] ?? "") + m[6]) || (m[5] ?? "") !== (m[2] ?? "")))
          throw new InvalidAt(2);
        const from = Number(m[3]);
        const to = m[6] ? Number(m[6]) : from;
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
      } else if (name.includes(".")) {
        delete this.cfg.subifs?.[name];
      } else if (this.def.router) {
        return ["% Removal of physical interfaces is not permitted"];
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
    /** L5-a: subinterface under the cursor. */
    eachSub(fn) {
      for (const name of this.ifs) {
        const c = this.cfg.subifs?.[name];
        if (c) fn(c);
      }
    }
    /** `encapsulation dot1Q <vlan> [native]`: one VLAN per subinterface and per parent. */
    encapsulation(vlan, native) {
      const name = this.ifs[0];
      const me = this.cfg.subifs[name];
      for (const [other, c] of Object.entries(this.cfg.subifs ?? {})) {
        if (other === name || c.parent !== me.parent) continue;
        if (c.vlan === vlan)
          return [`% Configuration of multiple subinterfaces of the same main interface with the same VID (${vlan}) is not permitted.`, `This VID is already configured on ${other}.`];
        if (native && c.native) return [`% Native VLAN is already configured on ${other}.`];
      }
      me.vlan = vlan;
      me.native = native;
    }
    eachL3(fn) {
      for (const name of this.ifs) {
        if (name.includes(".")) {
          this.eachSub((c2) => fn(c2.l3 ?? (c2.l3 = {})));
          return;
        }
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
      for (const [n, c] of Object.entries(this.cfg.subifs ?? {})) if (c.ip) out.push([n, c.ip]);
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
      for (const [other, ip2] of this.ipIfs()) {
        if (other === name) continue;
        const l = Math.min(maskToPrefix(ip2.mask), len);
        if (networkOf(ip2.addr, l) === networkOf(addr, l)) return [`% ${networkOf(addr, len)} overlaps with ${other}`];
      }
      if (name.startsWith("Vlan") || name.startsWith("Loopback")) this.eachSvi((s) => void (s.ip = { addr, mask }));
      else if (name.includes(".")) {
        const c = this.cfg.subifs[name];
        if (c.vlan === null)
          return [
            "% Configuring IP routing on a LAN subinterface is only allowed if that",
            "subinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,",
            "or ISL vLAN."
          ];
        c.ip = { addr, mask };
      } else {
        const c = this.cfg.ifaces[name];
        if (!c.routed) return ["% IP addresses may not be configured on L2 links."];
        c.ip = { addr, mask };
      }
    }
    // ---- DHCP server (L5-b) ----
    get poolCfg() {
      return this.cfg.dhcpPools[this.pool];
    }
    enterPool(name) {
      var _a;
      const pools = (_a = this.cfg).dhcpPools ?? (_a.dhcpPools = {});
      if (!pools[name]) pools[name] = { net: null, defaultRouter: null, dns: null };
      this.pool = name;
      this.mode = "dhcp";
    }
    deletePool(name) {
      if (!this.cfg.dhcpPools?.[name]) return [`% Pool ${name} not found`];
      delete this.cfg.dhcpPools[name];
      if (!Object.keys(this.cfg.dhcpPools).length) delete this.cfg.dhcpPools;
      this.rt.dhcp = this.rt.dhcp.filter((b) => b.server !== this.dev || b.pool !== name);
      this.rt.commit();
    }
    /** `network A.B.C.D mask|/len`: stored as the network address; one pool per network. */
    poolNetwork(addr, maskOrLen) {
      const len = /^\/\d+$/.test(maskOrLen) ? Number(maskOrLen.slice(1)) : maskToPrefix(maskOrLen);
      if (len === null || !Number.isInteger(len) || len < 1 || len > 30) throw new InvalidAt(2);
      const net = networkOf(addr, len);
      const mask = [24, 16, 8, 0].map((sh) => prefixMaskInt(len) >>> sh & 255).join(".");
      for (const [other, p] of Object.entries(this.cfg.dhcpPools ?? {}))
        if (other !== this.pool && p.net && p.net.addr === net && p.net.mask === mask) return [`% A pool already exists for network ${net} / ${mask}`];
      this.poolCfg.net = { addr: net, mask };
    }
    dhcpExclude(lo, hi, add) {
      var _a;
      if (ipToInt(hi) < ipToInt(lo)) return ["% Invalid range of IP addresses"];
      const list = (_a = this.cfg).dhcpExcluded ?? (_a.dhcpExcluded = []);
      const i = list.findIndex((r) => r.lo === lo && r.hi === hi);
      if (add) {
        if (i < 0) list.push({ lo, hi });
      } else {
        if (i < 0) {
          if (!list.length) delete this.cfg.dhcpExcluded;
          return [`% Range [${lo}, ${hi}] is not in the database.`];
        }
        list.splice(i, 1);
      }
      if (!list.length) delete this.cfg.dhcpExcluded;
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
    addRoute(net, mask, nh, ad = 1) {
      const len = maskToPrefix(mask);
      if (len === null) return ["%Inconsistent address and mask"];
      if (networkOf(net, len) !== net) return ["%Inconsistent address and mask"];
      if (nh === "0.0.0.0" || this.ipIfs().some(([, ip2]) => ip2.addr === nh)) return ["%Invalid next hop address (it's this router)"];
      const same = this.cfg.routes.find((r) => r.net === net && r.mask === mask && r.nh === nh);
      if (same) {
        if (ad === 1) delete same.ad;
        else same.ad = ad;
      } else this.cfg.routes.push(ad === 1 ? { net, mask, nh } : { net, mask, nh, ad });
    }
    /** `no ip route net mask [nh [ad]]`: without a next hop every route to the prefix goes. */
    removeRoute(net, mask, nh) {
      const before = this.cfg.routes.length;
      this.cfg.routes = this.cfg.routes.filter((r) => !(r.net === net && r.mask === mask && (nh === null || r.nh === nh)));
      if (this.cfg.routes.length === before) return ["%No matching route to delete"];
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
      for (const k of [...this.rt.arpIncomplete]) if (k.startsWith(this.dev + ">")) this.rt.arpIncomplete.delete(k);
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
    ping(ip2, o = {}) {
      const d = this.rt.derived;
      const repeat = o.repeat ?? 5;
      const r = ping(d, this.dev, ip2, o.src ? { src: o.src } : {});
      const firstKey = `${this.dev}>${r.firstHopArp?.ip ?? ip2}`;
      const coldArp = (r.forward?.hops.length ?? 0) > 0 && !this.rt.arp.has(firstKey);
      this.rt.markExchange(this.dev, r.forward, r.back);
      this.rt.countAcl(repeat, r.forward, r.back);
      this.rt.recordNat(repeat, r.forward, r.back);
      const head = ["Type escape sequence to abort.", `Sending ${repeat}, ${o.size ?? 100}-byte ICMP Echos to ${ip2}, timeout is ${o.timeout ?? 2} seconds:`];
      if (o.src) head.push(`Packet sent with a source address of ${o.src} `);
      if (r.reason === "noip" && !l3Ifs(d, this.dev).length) return [...head, ".".repeat(repeat), `Success rate is 0 percent (0/${repeat})`];
      let marks;
      let ok = 0;
      if (r.ok) {
        const key = firstKey;
        const cold = coldArp;
        this.rt.arp.add(key);
        this.rt.arpIncomplete.delete(key);
        marks = (cold ? "." : "!") + "!".repeat(repeat - 1);
        ok = cold ? repeat - 1 : repeat;
      } else {
        if (r.firstHopArp) {
          this.rt.arp.add(`${this.dev}>${r.firstHopArp.ip}`);
          this.rt.arpIncomplete.delete(`${this.dev}>${r.firstHopArp.ip}`);
        }
        if (r.arpIncomplete) this.rt.arpIncomplete.add(`${this.dev}>${r.arpIncomplete.ip}`);
        const c = r.reason === "unreach" ? "U" : r.reason === "expired" ? "&" : ".";
        marks = Array.from({ length: repeat }, (_, i) => c === "U" && i % 2 ? "." : c).join("");
      }
      this.rt.emit();
      return [
        ...head,
        marks,
        `Success rate is ${Math.floor(ok * 100 / repeat)} percent (${ok}/${repeat})` + (ok ? ", round-trip min/avg/max = 1/2/4 ms" : "")
      ];
    }
    /** L5-i: `ping A.B.C.D [repeat N] [size N] [timeout N] [source A.B.C.D|<if>]` */
    pingOptions(ip2, rest) {
      const t = rest.trim().split(/\s+/);
      const o = {};
      for (let i = 0; i < t.length; i += 2) {
        const k = t[i].toLowerCase();
        const v = t[i + 1];
        if (v === void 0) throw new CliError(["% Incomplete command."]);
        const num = (lo, hi) => {
          const n = Number(v);
          if (!/^\d+$/.test(v) || n < lo || n > hi) throw new CliError(["% Invalid input detected at '^' marker."]);
          return n;
        };
        if ("repeat".startsWith(k) && k.length >= 1) o.repeat = num(1, 2147483647);
        else if ("size".startsWith(k) && k.length >= 2) o.size = num(36, 18024);
        else if ("timeout".startsWith(k) && k.length >= 1) o.timeout = num(0, 3600);
        else if ("source".startsWith(k) && k.length >= 2) {
          const src = this.sourceAddr(v + (t[i + 2] && /^\d/.test(t[i + 2]) ? t[++i] : ""));
          if (!src) throw new CliError(["% Invalid source address- IP address not on any of our up interfaces"]);
          o.src = src;
        } else throw new CliError(["% Invalid input detected at '^' marker."]);
      }
      return this.ping(ip2, o);
    }
    /** Kaynak: bu cihazın açık bir arayüzünün adresi ya da arayüz adı. */
    sourceAddr(v) {
      const ifs = l3Ifs(this.rt.derived, this.dev);
      if (ipToInt(v) !== null) return ifs.some((i) => i.ip === v) ? v : null;
      const m = /^([A-Za-z-]+)\s*([\d/.:]+)$/.exec(v);
      const name = m ? canonIf(m[1], m[2]) : null;
      return ifs.find((i) => i.name === name)?.ip ?? null;
    }
    /** L5-i: etkileşimli extended ping (IOS soruları; boş yanıt = köşeli parantezdeki varsayılan). */
    extendedPing() {
      const o = {};
      let target = "";
      const bad = (msg) => [msg];
      const steps = [
        ["Protocol [ip]: ", (v) => !v || v.toLowerCase() === "ip" ? "next" : bad('% Unknown protocol - "' + v + '", type "ping ?" for help')],
        ["Target IP address: ", (v) => ipToInt(v) !== null ? (target = v, "next") : bad("% Bad IP address")],
        ["Repeat count [5]: ", (v) => !v ? "next" : /^\d+$/.test(v) && Number(v) >= 1 ? (o.repeat = Number(v), "next") : bad("% A decimal number between 1 and 2147483647.")],
        ["Datagram size [100]: ", (v) => !v ? "next" : /^\d+$/.test(v) && Number(v) >= 36 && Number(v) <= 18024 ? (o.size = Number(v), "next") : bad("% A decimal number between 36 and 18024.")],
        ["Timeout in seconds [2]: ", (v) => !v ? "next" : /^\d+$/.test(v) ? (o.timeout = Number(v), "next") : bad("% A decimal number between 0 and 3600.")],
        ["Extended commands [n]: ", (v) => /^y/i.test(v) ? "next" : "run"],
        ["Source address or interface: ", (v) => {
          if (!v) return "next";
          const src = this.sourceAddr(v.replace(/\s+/g, ""));
          if (!src) return bad("% Invalid source address- IP address not on any of our up interfaces");
          o.src = src;
          return "next";
        }],
        // modellenmeyen ayrıntılar: varsayılan kabul edilir (doğrulanmadı: değiştirilmiş değerlerin etkisi)
        ["Type of service [0]: ", () => "next"],
        ["Set DF bit in IP header? [no]: ", () => "next"],
        ["Validate reply data? [no]: ", () => "next"],
        ["Data pattern [0x0000ABCD]: ", () => "next"],
        ["Loose, Strict, Record, Timestamp, Verbose[none]: ", () => "next"],
        ["Sweep range of sizes [n]: ", () => "run"]
      ];
      const step2 = (i) => this.ask(steps[i][0], (line) => {
        const r = steps[i][1](line.trim());
        if (r === "run") return this.ping(target, o);
        if (r === "next") return step2(i + 1);
        return r;
      });
      return step2(0);
    }
    traceroute(ip2) {
      const d = this.rt.derived;
      const out = ["Type escape sequence to abort.", `Tracing the route to ${ip2}`, "VRF info: (vrf in name/id, vrf out name/id)"];
      for (let ttl = 1; ttl <= 30; ttl++) {
        const p = traceProbe(d, this.dev, ip2, ttl, 33434 + (ttl - 1) * 3);
        this.rt.markSeen(p.forward.hops, this.dev);
        this.rt.countAcl(3, p.forward, p.back);
        this.rt.recordNat(3, p.forward, p.back);
        const r = p.result;
        const t = String(ttl).padStart(3);
        if (r.kind === "none") out.push(`${t}  *  *  * `);
        else if (r.kind === "unreach") out.push(`${t} ${r.ip} !${r.code}  !${r.code}  !${r.code} `);
        else out.push(`${t} ${r.ip} ${ttl} msec ${ttl - 1} msec ${ttl} msec`);
        if (r.kind === "dest" || r.kind === "unreach") break;
      }
      this.rt.emit();
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
      if (name.includes(".")) throw new InvalidAt(3);
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
        const ip2 = k.split(">")[1];
        const now = arpMac(d, this.dev, ip2);
        if (now) {
          out.push(`Internet  ${ip2.padEnd(17)}0          ${now.mac}  ARPA   ${now.via}`);
          continue;
        }
        const owner = d.topo.lab.devices.flatMap((x) => l3Ifs(d, x.id)).find((x) => x.ip === ip2);
        const via = l3Ifs(d, this.dev).find((i) => owner && i.node && networkOf(i.ip, i.prefix) === networkOf(ip2, i.prefix));
        if (owner && via) out.push(`Internet  ${ip2.padEnd(17)}0          ${owner.mac}  ARPA   ${via.name}`);
      }
      for (const k of this.rt.arpIncomplete) {
        if (!k.startsWith(this.dev + ">") || this.rt.arp.has(k)) continue;
        out.push(`Internet  ${k.split(">")[1].padEnd(17)}0          Incomplete      ARPA`);
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

  // src/sim/config-text.ts
  var HARMLESS = [
    [/^version\s/i, "IOS sürüm satırı"],
    [/^(no\s+)?service\s+(timestamps|password-encryption|config|pad|tcp-keepalives|sequence-numbers)\b/i, "service ayarı (ağ davranışını etkilemez)"],
    [/^(no\s+)?ip\s+cef$/i, "CEF anahtarlama (davranış aynı)"],
    [/^(no\s+)?ipv6\s+cef$/i, "IPv6 CEF"],
    [/^license\s+udi\b/i, "lisans kimliği"],
    [/^ip\s+classless$/i, "varsayılan (classless yönlendirme)"],
    [/^ip\s+flow-export\s+version\b/i, "NetFlow dışa aktarma sürümü"],
    [/^spanning-tree\s+extend\s+system-id$/i, "varsayılan (genişletilmiş sistem kimliği)"],
    // Packet Tracer router'larının running-config'inde de yer alır; router'da STP yoktur
    [/^spanning-tree\s+mode\s+pvst$/i, "varsayılan STP kipi (router'da STP yok)"],
    [/^(no\s+)?ip\s+domain[- ]lookup$/i, "DNS çözümleme ayarı"],
    [/^boot-(start|end)-marker$/i, "açılış işaretçisi"],
    [/^(duplex|speed)\s+auto$/i, "varsayılan (otomatik hız/çift yön)"],
    [/^(no\s+)?logging\s/i, "günlük ayarı"],
    [/^end$/i, "yapılandırma sonu"]
  ];
  var HARMLESS_BLOCK = /^line\s+(con|aux|vty)\b/i;
  var ERR = /^(%|Command rejected)/;
  var INFO = /^% Access VLAN does not exist\. Creating vlan \d+$/;
  var isError = (out) => out.some((l) => ERR.test(l.trim()) && !INFO.test(l.trim()));
  var MODE_LINE = /^(interface|router|line|ip\s+access-list|ip\s+dhcp\s+pool|vlan\s+\d|controller|class-map|policy-map|key\s+chain|crypto)\b/i;
  function harmless(cmd) {
    for (const [re, why] of HARMLESS) if (re.test(cmd)) return why;
    return null;
  }
  function applyConfigText(rt, dev, text) {
    const s = new IosSession(rt, dev);
    s.mode = "config";
    const out = [];
    const lines = text.split(/\r?\n/);
    let rejectedParent = null;
    const push = (line, command, status, reason) => out.push({ device: dev, line, command, status, ...reason ? { reason } : {}, ...status === "applied" ? { ifs: s.mode === "if" ? [...s.ifs] : [] } : {} });
    for (let i = 0; i < lines.length; i++) {
      const n = i + 1;
      const cmd = lines[i].trim();
      if (!cmd) continue;
      if (cmd.startsWith("!")) {
        rejectedParent = null;
        s.mode = "config";
        continue;
      }
      const banner = /^banner\s+\S+\s+(\^C|\S)(.*)$/i.exec(cmd);
      if (banner) {
        const delim = banner[1];
        push(n, cmd, "ignored", "banner (ağ davranışını etkilemez)");
        if (!banner[2].includes(delim))
          while (i + 1 < lines.length) {
            i++;
            push(i + 1, lines[i].trim(), "ignored", "banner metni");
            if (lines[i].includes(delim)) break;
          }
        continue;
      }
      if (/^end$/i.test(cmd)) {
        push(n, cmd, "ignored", "yapılandırma sonu");
        for (let j = i + 1; j < lines.length; j++) {
          const rest = lines[j].trim();
          if (rest && !rest.startsWith("!")) push(j + 1, rest, "unmodeled", "`end` satırından sonra (uygulanmaz)");
        }
        break;
      }
      if (rejectedParent) {
        s.mode = "config";
        const r2 = s.exec(cmd);
        if (!isError(r2) && !s.pendingPrompt) {
          rejectedParent = null;
          push(n, cmd, "applied");
          continue;
        }
        if (s.pendingPrompt) s.exec("");
        if (MODE_LINE.test(cmd)) {
          rejectedParent = { cmd, harmless: HARMLESS_BLOCK.test(cmd) };
          if (rejectedParent.harmless) push(n, cmd, "ignored", "oturum/erişim hattı ayarı (ağ davranışını etkilemez)");
          else push(n, cmd, harmless(cmd) ? "ignored" : "unmodeled", harmless(cmd) ?? r2.find((l) => ERR.test(l.trim()) && !INFO.test(l.trim()))?.trim());
          continue;
        }
        const why2 = harmless(cmd);
        if (rejectedParent.harmless || why2) push(n, cmd, "ignored", why2 ?? `"${rejectedParent.cmd}" bloğu (zararsız)`);
        else push(n, cmd, "unmodeled", `üst satır modellenmedi: ${rejectedParent.cmd}`);
        continue;
      }
      const before = s.mode;
      let r = s.exec(cmd);
      if (s.pendingPrompt) {
        s.exec("");
        r = [...r, "% confirmation required"];
      }
      if (isError(r) && before !== "config") {
        s.mode = "config";
        const g = s.exec(cmd);
        if (!isError(g)) r = g;
        else s.mode = before;
      }
      if (!isError(r)) {
        push(n, cmd, "applied");
        if (/^interface\s/i.test(cmd) && !/\srange\s/i.test(cmd) && s.mode === "if") s.exec("no shutdown");
        continue;
      }
      const why = harmless(cmd);
      const isMode = MODE_LINE.test(cmd);
      if (isMode) {
        s.mode = "config";
        rejectedParent = { cmd, harmless: HARMLESS_BLOCK.test(cmd) };
      }
      if (why || isMode && HARMLESS_BLOCK.test(cmd)) push(n, cmd, "ignored", why ?? "oturum/erişim hattı ayarı (ağ davranışını etkilemez)");
      else push(n, cmd, "unmodeled", r.find((l) => ERR.test(l.trim()) && !INFO.test(l.trim()))?.trim());
    }
    return defaultBlocks(rt, dev, out);
  }
  function defaultBlocks(rt, dev, lines) {
    const sw = rt.topo.devices[dev];
    if (!sw || sw.kind !== "switch" || !sw.router) return lines;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.status !== "unmodeled" || !/^interface\s+vlan\s*1$/i.test(l.command)) continue;
      const kids = [];
      for (let j = i + 1; j < lines.length && lines[j].reason?.startsWith("üst satır modellenmedi: " + l.command); j++) kids.push(lines[j]);
      if (!kids.every((k) => /^(no\s+ip\s+address|shutdown)$/i.test(k.command))) continue;
      for (const x of [l, ...kids]) {
        x.status = "ignored";
        x.reason = "Packet Tracer router'ının varsayılan Vlan1 bloğu (router'da SVI yok)";
      }
    }
    return lines;
  }
  function summarize(lines) {
    return {
      applied: lines.filter((l) => l.status === "applied").length,
      ignored: lines.filter((l) => l.status === "ignored").length,
      unmodeled: lines.filter((l) => l.status === "unmodeled").length
    };
  }

  // src/sim/http.ts
  var HTTP_PORT = 80;
  var HTTP_CLIENT_PORT = 49153;
  function httpListening(d, dev) {
    const def = d.topo.devices[dev];
    return !!def && def.kind === "pc" && !!def.server && !!d.pcs[dev]?.services?.http && !d.hw.off.has(dev);
  }
  function httpGet(d, from, dst, port = HTTP_PORT) {
    if (d.hw.off.has(from)) return { ok: false, reason: "off" };
    const fwd = deliver(d, from, dst, { proto: "tcp", sport: HTTP_CLIENT_PORT, dport: port });
    if (fwd.kind === "noip") return { ok: false, reason: "noip", forward: fwd };
    if (fwd.kind === "noroute") return { ok: false, reason: "noroute", forward: fwd };
    const src = fwd.pkt?.src ?? sourceIp(d, from, dst);
    if (fwd.kind === "unreach") {
      const back2 = deliver(d, fwd.at, src, { proto: "icmp", icmpType: "unreachable", src: fwd.atIp, dport: fwd.pkt?.sport, natPending: fwd.nat });
      return back2.kind === "ok" ? { ok: false, reason: "unreach", unreachFrom: fwd.atIp, forward: fwd, back: back2 } : { ok: false, reason: "timeout", forward: fwd, back: back2 };
    }
    if (fwd.kind !== "ok") return { ok: false, reason: "timeout", forward: fwd };
    const server = fwd.hops[fwd.hops.length - 1]?.dev ?? from;
    const back = deliver(d, server, src, { proto: "tcp", src: fwd.pkt.dst, sport: fwd.pkt.dport, dport: fwd.pkt.sport, natPending: fwd.nat });
    const backTo = back.hops[back.hops.length - 1]?.dev ?? server;
    if (back.kind !== "ok" || backTo !== from) return { ok: false, reason: "timeout", forward: fwd, back };
    if (port !== HTTP_PORT || !httpListening(d, server)) return { ok: false, reason: "refused", forward: fwd, back };
    return { ok: true, server, forward: fwd, back };
  }

  // src/sim/cli/vpcs.ts
  var HELP2 = [
    "",
    "ip ARG ... [OPTION]      Configure the current VPC's IP settings",
    "  ip <address>/<len> [gateway]",
    "  ip <address> <mask> [gateway]",
    "  ip dhcp [-r|-x]        Get an address from a DHCP server (-r renew, -x release)",
    "  ip dns <address>       Set the DNS server (0.0.0.0 clears it)",
    "clear ip                 Clear IP address, mask and gateway",
    "show [arp|ip]            Print the information of the VPC",
    "ping <address> [-c count] [-T ttl]  Ping the network host",
    "trace <address> [-m ttl] Print the path packets take to network host",
    "nslookup <name>          Ask the DNS server for the address of a host name",
    "curl [http://]<host>[:port][/path]  Fetch a web page (Labber addition: VPCS has no HTTP client)",
    "help, ?                  Print help",
    ""
  ];
  var SERVER_HELP = [
    "service dhcp|dns|http on|off  Start or stop a service of this server",
    "show services            Print the services and their state",
    "show ip dhcp binding     Print the addresses this server leased",
    "show dns                 Print the host names this server resolves",
    ""
  ];
  var VpcsSession = class {
    constructor(rt, dev) {
      this.rt = rt;
      this.dev = dev;
      __publicField(this, "history", []);
      /** shown name (prompt, `show ip`); the host app may set its own device label */
      __publicField(this, "name");
      this.name = dev;
    }
    get def() {
      return this.rt.topo.devices[this.dev];
    }
    prompt() {
      return this.name + "> ";
    }
    complete(line) {
      const cmds = ["ip", "clear", "show", "ping", "trace", "nslookup", "curl", "help", ...this.def.server ? ["service"] : []];
      const t = line.trim();
      if (!t || t.includes(" ")) return null;
      const m = cmds.filter((c) => c.startsWith(t));
      return m.length === 1 ? m[0] + " " : null;
    }
    help() {
      return this.def.server ? [...HELP2, ...SERVER_HELP] : HELP2;
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
      if (c === "?" || c === "help") return this.help();
      if (c === "ip" && args[0]?.toLowerCase() === "dhcp") return this.dhcp(args.slice(1));
      if (c === "dhcp") return this.dhcp(args);
      if (c === "ip" && args[0]?.toLowerCase() === "dns") return this.setDns(args[1]);
      if (c === "ip") return this.ip(args);
      if (c === "clear" && args[0] === "ip") {
        this.rt.dhcpRelease(this.dev);
        return ["IPv4 address/mask, gateway, DNS, and DHCP cleared"];
      }
      if (c === "nslookup") return args[0] ? this.nslookup(args[0]) : ["Incomplete command."];
      if (c === "curl") return args.length ? this.curl(args) : ["curl: try 'curl --help' for more information"];
      if (this.def.server) {
        const srv = this.server(c, args);
        if (srv) return srv;
      }
      if (c === "show" && (!args[0] || args[0] === "ip")) return this.showIp();
      if (c === "show" && args[0] === "arp") return this.showArp();
      if (c === "ping" && args[0]) return this.pingCmd(args);
      if ((c === "trace" || c === "tracert" || c === "traceroute") && args[0]) {
        if (args.length === 1) return this.trace(args[0]);
        const m = args[1] === "-m" && /^\d+$/.test(args[2] ?? "") && args.length === 3 ? Number(args[2]) : NaN;
        if (!(m >= 1 && m <= 255)) return [`Invalid options: ${args.slice(1).join(" ")}`];
        return this.trace(args[0], m);
      }
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
      const old = this.rt.pcs[this.dev];
      this.rt.pcs[this.dev] = { ip: addr, prefix, gw, ...old.dns ? { dns: old.dns } : {}, ...old.services ? { services: old.services } : {} };
      this.rt.commit();
      return ["Checking for duplicate address...", `${this.name} : ${addr} ${prefixToMask(prefix)}${gw ? " gateway " + gw : ""}`, ""];
    }
    /** `ip dhcp` (also `dhcp`): -x releases, anything else asks for a (new) lease. */
    dhcp(args) {
      const opt = args[0]?.toLowerCase();
      if (opt && opt !== "-r" && opt !== "-x") return ["Invalid options"];
      this.rt.hostSends(this.dev);
      if (opt === "-x") {
        this.rt.dhcpRelease(this.dev);
        return [];
      }
      const r = this.rt.dhcpRequest(this.dev);
      const c = this.rt.pcs[this.dev];
      if (r.ok) return [`DDORA IP ${c.ip}/${c.prefix}` + (c.gw ? ` GW ${c.gw}` : ""), ""];
      return ["DDD", "Can't find dhcp server", `Autoconfiguration IPv4 address ${c.ip}/${c.prefix} (no DHCP lease)`, ""];
    }
    setDns(addr) {
      if (!addr) return ["Incomplete command."];
      if (!isIp(addr)) return ["Invalid address"];
      const c = this.rt.pcs[this.dev];
      if (addr === "0.0.0.0") delete c.dns;
      else c.dns = addr;
      this.rt.commit();
      return [];
    }
    /** Windows-style `nslookup <name>` through the configured DNS server. */
    nslookup(name) {
      const r = dnsLookup(this.rt.derived, this.dev, name);
      if (r.ok) return ["Server:  UnKnown", `Address:  ${r.server}`, "", `Name:    ${r.name}`, `Address:  ${r.address}`, ""];
      if (r.reason === "noserver") return ["*** Default servers are not available", ""];
      if (r.reason === "timeout") return ["DNS request timed out.", "    timeout was 2 seconds.", "*** Request to UnKnown timed-out", ""];
      return ["Server:  UnKnown", `Address:  ${r.server}`, "", `*** UnKnown can't find ${name}: Non-existent domain`, ""];
    }
    /**
     * L5-g: `curl [http://]host[:port][/path]` (VPCS'te HTTP istemcisi yok; Labber eki). Çıktı
     * curl biçiminde: sayfa gövdesi ya da `curl: (N) …` hatası. Ad DNS ile çözülür.
     */
    curl(args) {
      const url = args.filter((a) => !a.startsWith("-")).pop();
      if (!url) return ["curl: no URL specified!"];
      const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/i.exec(url);
      if (!m) return [`curl: (3) URL rejected: Malformed input to a URL function`];
      if (m[1] && m[1].toLowerCase() === "https") return ['curl: (1) Protocol "https" not supported (Labber: yalnız HTTP)'];
      const port = m[3] ? Number(m[3]) : HTTP_PORT;
      if (port < 1 || port > 65535) return [`curl: (3) URL rejected: Port number was not a decimal number between 0 and 65535`];
      let host = m[2];
      if (ipToInt(host) === null) {
        const r2 = dnsLookup(this.rt.derived, this.dev, host);
        if (!r2.ok) return [`curl: (6) Could not resolve host: ${host}`];
        host = r2.address;
      }
      const c = this.rt.pcs[this.dev];
      if (!c.ip) return [`curl: (7) Failed to connect to ${host} port ${port}: Network is unreachable`];
      this.rt.hostSends(this.dev);
      const r = httpGet(this.rt.derived, this.dev, host, port);
      this.rt.markExchange(this.dev, r.forward, r.back);
      this.rt.countAcl(1, r.forward, r.back);
      this.rt.recordNat(1, r.forward, r.back);
      this.rt.emit();
      if (r.ok) {
        const name = this.rt.topo.devices[r.server].name ?? r.server;
        return [`<html><head><title>${name}</title></head><body><h1>${name}</h1><p>Labber web server</p></body></html>`];
      }
      if (r.reason === "refused") return [`curl: (7) Failed to connect to ${host} port ${port} after 1 ms: Connection refused`];
      if (r.reason === "unreach") return [`curl: (7) Failed to connect to ${host} port ${port} after 1 ms: No route to host`];
      if (r.reason === "noroute" || r.reason === "noip") return [`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Network is unreachable`];
      return [`curl: (28) Failed to connect to ${host} port ${port} after 75000 ms: Connection timed out`];
    }
    /** Server-only commands; null when the line is not one of them. */
    server(c, args) {
      const cfg = this.rt.pcs[this.dev];
      const a = args.map((x) => x.toLowerCase());
      if (c === "service") {
        if (a[0] !== "dhcp" && a[0] !== "dns" && a[0] !== "http" || a[1] !== "on" && a[1] !== "off") return ["Usage: service dhcp|dns|http on|off"];
        cfg.services = { ...cfg.services ?? {}, [a[0]]: a[1] === "on" };
        if (a[0] === "dhcp" && a[1] === "off") this.rt.dhcpClear(this.dev);
        this.rt.commit();
        return [`${a[0].toUpperCase()} service is ${a[1]}`];
      }
      if (c !== "show") return null;
      if (a[0] === "services") return ["Service     Status", ...["dhcp", "dns", "http"].map((k) => k.padEnd(12) + (cfg.services?.[k] ? "on" : "off")), ""];
      if (a[0] === "ip" && a[1] === "dhcp" && a[2] === "binding") {
        const rows = this.rt.dhcp.filter((b) => b.server === this.dev);
        return ["IP address       Hardware address     Lease expiration", ...rows.map((b) => b.ip.padEnd(17) + b.mac.padEnd(21) + b.expires), ""];
      }
      if (a[0] === "dns") {
        if (!cfg.services?.dns) return ["DNS service is off", ""];
        return ["Name                 Address", ...dnsRecords(this.rt.derived).map((x) => x.name.padEnd(21) + x.address), ""];
      }
      return null;
    }
    showIp() {
      const c = this.rt.pcs[this.dev];
      const lease = this.rt.dhcpLeaseOf(this.dev);
      return [
        "",
        `NAME        : ${this.name}[1]`,
        `IP/MASK     : ${c.ip ? `${c.ip}/${c.prefix}` : "0.0.0.0/0"}`,
        `GATEWAY     : ${c.gw ?? "0.0.0.0"}`,
        `DNS         : ${c.dns ?? ""}`,
        ...lease ? [`DHCP SERVER : ${lease.serverIp}`] : c.dhcp && c.ip && isApipa(c.ip) ? ["DHCP SERVER : none (autoconfiguration address)"] : [],
        `MAC         : ${macToColon(this.def.mac)}`,
        "LPORT       : 20000",
        "RHOST:PORT  : 127.0.0.1:30000",
        "MTU         : 1500",
        ""
      ];
    }
    /** VPCS `show arp`: entries the PC resolved itself (120 s lifetime, shown fresh). */
    showArp() {
      const d = this.rt.derived;
      const out = [];
      for (const k of this.rt.arp) {
        if (!k.startsWith(this.dev + ">")) continue;
        const ip2 = k.split(">")[1];
        const now = arpMac(d, this.dev, ip2);
        if (now) out.push(`${macToColon(now.mac)}  ${ip2} expires in 120 seconds `);
      }
      return ["", ...out.length ? out : ["arp table is empty"], ""];
    }
    /** L5-i: VPCS `ping host [-c count] [-T ttl]` (diğer VPCS seçenekleri modellenmez). */
    pingCmd(args) {
      let count = 5;
      let ttl;
      for (let i = 1; i < args.length; i++) {
        const v = args[i + 1];
        const n = v !== void 0 && /^\d+$/.test(v) ? Number(v) : NaN;
        if (args[i] === "-c" && n >= 1) count = n;
        else if (args[i] === "-T" && n >= 1 && n <= 255) ttl = n;
        else return [`Invalid options: ${args.slice(i).join(" ")}`];
        i++;
      }
      return this.ping(args[0], count, ttl);
    }
    ping(dst, count = 5, ttlOut) {
      if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`];
      const c = this.rt.pcs[this.dev];
      if (!c.ip) return ["No gateway found"];
      if (!sameSubnet(c.ip, dst, c.prefix) && !c.gw) return [`host (${dst}) not reachable`, ""];
      this.rt.hostSends(this.dev);
      const d = this.rt.derived;
      const r = ping(d, this.dev, dst, { ttl: ttlOut ?? 64 });
      this.rt.markExchange(this.dev, r.forward, r.back);
      this.rt.countAcl(count, r.forward, r.back);
      this.rt.recordNat(count, r.forward, r.back);
      if (r.firstHopArp) this.rt.arp.add(`${this.dev}>${r.firstHopArp.ip}`);
      this.rt.emit();
      const out = [];
      for (let i = 1; i <= count; i++) {
        const t = (0.4 + i * 37 % 10 / 10 + (r.ttl && r.ttl < 64 ? 0.8 : 0)).toFixed(3);
        if (r.ok) out.push(`84 bytes from ${dst} icmp_seq=${i} ttl=${r.ttl} time=${t} ms`);
        else if (r.reason === "expired") out.push(`*${r.expiredFrom} icmp_seq=${i} ttl=255 time=${t} ms (ICMP type:11, code:0, TTL expired in transit)`);
        else if (r.reason === "unreach") out.push(`*${r.unreachFrom} icmp_seq=${i} ttl=255 time=${t} ms (ICMP type:3, code:1, Destination host unreachable)`);
        else if (r.reason === "noroute" && !r.forward?.hops.length && c.gw && !sameSubnet(c.ip, dst, c.prefix)) out.push(`host (${c.gw}) not reachable`);
        else out.push(`${dst} icmp_seq=${i} timeout`);
        if (r.reason === "noroute" && out[out.length - 1].startsWith("host")) break;
      }
      return ["", ...out, ""];
    }
    trace(dst, maxHops = 8) {
      if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`];
      const c = this.rt.pcs[this.dev];
      if (!c.ip) return ["No gateway found"];
      this.rt.hostSends(this.dev);
      const out = [`trace to ${dst}, ${maxHops} hops max, press Ctrl+C to stop`];
      for (let ttl = 1; ttl <= maxHops; ttl++) {
        const p = traceProbe(this.rt.derived, this.dev, dst, ttl, 33434 + ttl - 1);
        this.rt.markSeen(p.forward.hops, this.dev);
        this.rt.countAcl(1, p.forward, p.back);
        this.rt.recordNat(1, p.forward, p.back);
        const r = p.result;
        const ms = (x) => (x + ttl * 0.5).toFixed(3) + " ms";
        if (r.kind === "none") out.push(` ${ttl}     *  *  *`);
        else if (r.kind === "hop") out.push(` ${ttl}   ${r.ip}   ${ms(0.1)}  ${ms(0.05)}  ${ms(0.08)}`);
        else if (r.kind === "dest") out.push(` ${ttl}   *${r.ip}   ${ms(0.2)} (ICMP type:3, code:3, Destination port unreachable)`);
        else
          out.push(` ${ttl}   *${r.ip}   ${ms(0.2)} (ICMP type:3, code:${r.code === "A" ? 13 : 1}, ${r.code === "A" ? "Communication administratively prohibited" : "Destination host unreachable"})`);
        if (r.kind === "dest" || r.kind === "unreach") break;
      }
      this.rt.emit();
      return [...out, ""];
    }
  };

  // src/sim/ospf.ts
  function computeState(topo, cfgs, pcs, errdis, hw) {
    const d = derive(topo, cfgs, pcs, errdis, hw);
    d.ospf = computeOspf(d);
    d.dups = duplicateIps(d);
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
    return def?.kind === "switch" && !!(def.l3 || def.router) && !!c?.ipRouting && !!c.ospf && !d.hw.off.has(dev);
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
  function areaFor(o, ip2, l3) {
    if (l3.ospfArea && l3.ospfArea.pid === o.pid) return l3.ospfArea.area;
    const a = ipToInt(ip2);
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
    const nk4 = (i) => `${i.l3.node.dev}|${i.l3.node.vlan}`;
    const peersOf = /* @__PURE__ */ new Map();
    const compat = /* @__PURE__ */ new Map();
    for (const a of talkers) {
      const dom = domOf(a);
      const peers = talkers.filter((b) => b.dev !== a.dev && dom.has(nk4(b)));
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
        let role2 = "-";
        if (bothP2p || !sameType) state = "FULL";
        else {
          role2 = a.dr?.ip === b.ip ? "DR" : a.bdr?.ip === b.ip ? "BDR" : "DROTHER";
          const adj = a.role === "DR" || a.role === "BDR" || role2 === "DR" || role2 === "BDR";
          state = adj ? "FULL" : "2WAY";
        }
        if (state === "FULL" && a.mtu !== b.mtu) state = "EXSTART";
        out[a.dev].nbrs.push({
          rid: out[b.dev].rid,
          prio: b.prio,
          state,
          role: role2,
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
        const base2 = dist2.get(cur);
        for (const e of edges.get(ekey(cur, area)) ?? []) {
          if (done.has(e.to)) continue;
          const cost = base2.cost + e.cost;
          const paths = cur === root ? [e.path] : base2.paths;
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
    constructor(d, startup = {}, learned = /* @__PURE__ */ new Set(), leases = []) {
      this.d = d;
      this.startup = startup;
      this.learned = learned;
      this.leases = leases;
    }
    /** L5-b: the lease the PC currently uses ({server, pool, ip, …}), or null. */
    dhcpLease(pc) {
      const c = this.d.pcs[pc];
      if (!c?.dhcp || !c.ip || isApipa(c.ip)) return null;
      return this.leases.find((b) => b.client === pc && b.ip === c.ip) ?? null;
    }
    /** L5-b: leases a DHCP server (router, switch or lab server) handed out. */
    dhcpBindings(server) {
      return this.leases.filter((b) => b.server === server);
    }
    /** L5-b: DNS lookup from a PC through its configured DNS server. */
    dnsLookup(pc, name) {
      return dnsLookup(this.d, pc, name);
    }
    /** Dynamic MAC address table of a switch (learned addresses only). */
    macTable(dev) {
      return macTable(this.d, dev, this.learned);
    }
    macEntry(dev, mac) {
      const m = normalizeMac(mac);
      return m ? this.macTable(dev).find((e) => e.mac === m) : void 0;
    }
    /** Port (canonical name, or Port-channelN) the switch learned this MAC on, or null. */
    macPort(dev, mac) {
      return this.macEntry(dev, mac)?.port ?? null;
    }
    /** VLAN the switch learned this MAC in, or null. */
    macVlan(dev, mac) {
      return this.macEntry(dev, mac)?.vlan ?? null;
    }
    /** No two interfaces share this address inside one broadcast domain. */
    ipUnique(ip2) {
      return !this.d.dups.some((x) => x.ip === ip2);
    }
    /** Devices that share this address in one broadcast domain (lab order; first answers ARP), else []. */
    duplicates(ip2) {
      return this.d.dups.find((x) => x.ip === ip2)?.owners.map((o) => o.dev) ?? [];
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
    /**
     * Route the device would use for dst (longest match over the installed table), or null.
     * L4: Akademi kaynak arayüzlü ICMP ölçütü bunu eski motorun routeLookup'ı gibi kullanır.
     */
    routeFor(dev, dst) {
      const n = ipToInt(dst);
      if (n === null) return null;
      let best = null;
      for (const e of routeTable(this.d, dev)) {
        if (e.code === "L") continue;
        const m = prefixMaskInt(e.prefix);
        if ((n & m) >>> 0 !== (ipToInt(e.net) & m) >>> 0) continue;
        if (!best || e.prefix > best.prefix) best = e;
      }
      return best;
    }
    errDisabled(dev, port) {
      return !!this.d.phys[pk(dev, this.canon(port))]?.errDisabled;
    }
    canon(port) {
      const m = /^([A-Za-z-]+)\s*(\d.*)$/.exec(port);
      return m && canonIf(m[1], m[2]) || port;
    }
    /** FHRP: the router's interface is HSRP Active / VRRP Master for this group. */
    fhrpActive(dev, iface, group) {
      const name = this.canon(iface);
      return (this.d.fhrp?.groups ?? []).some((g) => g.group === Number(group) && g.active?.dev === dev && g.active.ifname === name);
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
    ping(from, ip2) {
      return ping(this.d, from, ip2);
    }
    /** L5-g: HTTP (TCP 80) isteği; tabloya/sayaçlara yazmaz. */
    http(from, ip2, port) {
      return httpGet(this.d, from, ip2, port);
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
    /** Device is powered on. */
    powered(dev) {
      return !!this.d.topo.devices[dev] && !this.d.hw.off.has(dev);
    }
    /**
     * The link on this port is up: cable intact, both ends powered, neither end shut,
     * err-disabled or (PC) NIC-disabled. For a PC the port is its eth0.
     */
    linkUp(dev, port = "eth0") {
      if (this.d.topo.devices[dev]?.kind === "pc") {
        const at = this.d.topo.pcAttach[dev];
        return !!at && !!this.d.phys[pk(at.dev, at.port)]?.up;
      }
      return !!this.phys(dev, port)?.up;
    }
    sviUp(dev, vlan) {
      return !!this.d.svis[dev]?.find((s) => s.vlan === vlan && s.up);
    }
  };

  // src/sim/runtime.ts
  var MAC_AGING_SECONDS = 300;
  var AgingSet = class extends Set {
    constructor() {
      super(...arguments);
      __publicField(this, "at", /* @__PURE__ */ new Map());
    }
    add(mac) {
      this.at?.set(mac, Date.now());
      return super.add(mac);
    }
    delete(mac) {
      this.at.delete(mac);
      return super.delete(mac);
    }
    clear() {
      this.at?.clear();
      super.clear();
    }
    /** Süresi dolan dinamik girdileri siler (okunurken: show mac, değerlendirme). */
    expire(now = Date.now()) {
      for (const mac of [...this]) {
        const t = this.at.get(mac);
        if (t === void 0) this.at.set(mac, now);
        else if (now - t >= MAC_AGING_SECONDS * 1e3) this.delete(mac);
      }
    }
  };
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
      /** MACs learned by switches (sources of real traffic); dynamic entries age out (IOS: 300 s) */
      __publicField(this, "seen", new AgingSet());
      /** I-1: switch başına `clear mac address-table dynamic` ile gizlenen adresler */
      __publicField(this, "clearedOn", /* @__PURE__ */ new Map());
      __publicField(this, "arp", /* @__PURE__ */ new Set());
      /** 'dev>ip' ARP requests that went unanswered (shown as Incomplete) */
      __publicField(this, "arpIncomplete", /* @__PURE__ */ new Set());
      /** err-disabled ports ('dev|port'); sticky until shutdown or errdisable recovery */
      __publicField(this, "errdis", /* @__PURE__ */ new Set());
      /** cut cables, powered-off devices, disabled PC NICs (see Hardware) */
      __publicField(this, "hw", noHardwareFaults());
      /** L5-b: DHCP leases handed out by the lab's servers (kept in RAM: lost on reload) */
      __publicField(this, "dhcp", []);
      /** L5-e: why a port is err-disabled ('bpduguard' | 'psecure-violation'); missing = bpduguard */
      __publicField(this, "errCause", /* @__PURE__ */ new Map());
      /** L5-e: dynamically learned secure MACs per port ('dev|port'); cleared when the port goes down */
      __publicField(this, "psDynamic", /* @__PURE__ */ new Map());
      /** L5-e: security violation counters per port */
      __publicField(this, "psViolations", /* @__PURE__ */ new Map());
      /** L5-e: last source MAC seen on a secure port */
      __publicField(this, "psLast", /* @__PURE__ */ new Map());
      /** L5-c: ACL match counters ('dev|acl|seq'); `clear access-list counters` resets them */
      __publicField(this, "aclHits", /* @__PURE__ */ new Map());
      /** L5-d: dynamic NAT translations (no timeout; `clear ip nat translation *` empties it) */
      __publicField(this, "natTable", []);
      /** L5-d: packets translated (show ip nat statistics "Hits") */
      __publicField(this, "natHits", 0);
      /** L5-d: packets dropped because the pool had no free address */
      __publicField(this, "natMisses", 0);
      /** FHRP: group key → member id of the current Active/Master (preemption needs history) */
      __publicField(this, "fhrpActive", /* @__PURE__ */ new Map());
      /** FHRP: member id → last state (for %HSRP/%VRRP state change syslog) */
      __publicField(this, "fhrpStates", /* @__PURE__ */ new Map());
      /** L5-h: per-line result of a lenient (running-config) initial configuration */
      __publicField(this, "configReport");
      __publicField(this, "seq", 0);
      __publicField(this, "t0", Date.now());
      __publicField(this, "listeners", /* @__PURE__ */ new Set());
      /** FHRP state changes (IOS 15 biçimi; ara Speak/Learn durumları modellenmez). */
      __publicField(this, "fhrpQuiet", false);
      /**
       * MotorBulgusu (I-1, test_aglab_mac_learning): IOS, portun access/native VLAN'ı ya da
       * çalışma kipi değişince o portta öğrenilmiş dinamik girdileri siler; adres yeni VLAN'da
       * ancak yeniden trafik gönderince öğrenilir. Labber eski girdiyi yeni VLAN'da gösteriyordu.
       */
      __publicField(this, "portSig", /* @__PURE__ */ new Map());
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
      this.errCause.clear();
      this.psDynamic.clear();
      this.psViolations.clear();
      this.psLast.clear();
      this.aclHits.clear();
      this.natTable = [];
      this.natHits = 0;
      this.natMisses = 0;
      this.dhcp = [];
      this.fhrpActive.clear();
      this.fhrpStates.clear();
      this.hw = noHardwareFaults();
      for (const l of this.def.links)
        if (l.up === false) for (const [dev, port] of [l.a, l.b]) this.hw.cut.add(pk(dev, port));
      for (const dv of this.def.devices) {
        if (dv.off) this.hw.off.add(dv.id);
        if (dv.kind === "pc" && dv.nicDown) this.hw.nicDown.add(dv.id);
      }
      this.derived = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw);
      this.applyInitial(this);
      this.fhrpActive.clear();
      this.derived = this.recompute();
      for (const sw of this.topo.switches) this.startup[sw.id] = clone(this.running[sw.id]);
      this.seen.clear();
      this.clearedOn.clear();
      this.arp.clear();
      this.arpIncomplete.clear();
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
      if (this.hw.off.has(dev)) return;
      this.logs.push({ dev, text: `${this.timestamp()}: ${msg}`, seq: ++this.seq });
      if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400);
    }
    /** Recompute after a config change and log what changed. */
    commit() {
      const prev = this.derived;
      this.derived = this.recompute();
      this.flushRevlannedPorts(prev);
      this.diffLogs(prev, this.derived);
      this.emit();
    }
    /** Derive, then settle err-disable (BPDU guard) and OSPF router-id selection. */
    recompute() {
      let d = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw);
      for (let i = 0; i < 4; i++) {
        let changed = false;
        for (const k of [...this.errdis]) {
          if (d.phys[k]?.adminDown) {
            this.errdis.delete(k);
            this.errCause.delete(k);
            changed = true;
          }
        }
        const viol = new Set(bpduViolations(d));
        for (const k of viol) {
          if (this.errdis.has(k)) continue;
          const [dev, port] = k.split("|");
          this.errdis.add(k);
          this.errCause.set(k, "bpduguard");
          this.log(dev, `%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port ${port} with BPDU Guard enabled. Disabling port.`);
          this.log(dev, `%PM-4-ERR_DISABLE: bpduguard error detected on ${shortIf(port)}, putting ${shortIf(port)} in err-disable state`);
          changed = true;
        }
        for (const k of [...this.errdis]) {
          const [dev, port] = k.split("|");
          if (viol.has(k) || !this.running[dev]?.errRecoveryBpdu || (this.errCause.get(k) ?? "bpduguard") !== "bpduguard") continue;
          this.errdis.delete(k);
          this.errCause.delete(k);
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
        for (const k of [...this.psDynamic.keys()]) {
          const [dev, port] = k.split("|");
          if (d.phys[k]?.up && activePs(this.running[dev], port)) continue;
          this.psDynamic.delete(k);
        }
        if (!changed) break;
        d = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw);
      }
      d.natTable = this.natTable;
      d.arpCache = this.arp;
      d.fhrp = computeFhrp(d, this.fhrpActive);
      this.fhrpLog(d.fhrp);
      return d;
    }
    fhrpLog(f) {
      const now = /* @__PURE__ */ new Map();
      for (const m of f.members) {
        const id = memberId(m);
        now.set(id, m.state);
        const g = m.proto === "hsrp" && m.key ? f.groups.find((x) => x.key === m.key) : void 0;
        const diff = g?.active && g.active !== m && g.active.vip !== m.vip ? `diffvip:${g.active.vip}` : "";
        if (diff) now.set(id + "|diffvip", diff);
        if (diff && this.fhrpStates.get(id + "|diffvip") !== diff && !this.fhrpQuiet)
          this.log(m.dev, `%HSRP-4-DIFFVIP1: ${shortIf(m.ifname)} Grp ${m.group} active routers virtual IP address ${g.active.vip} is different to the locally configured address ${m.vip}`);
        const was = this.fhrpStates.get(id) ?? "Init";
        if (was === m.state || this.fhrpQuiet) continue;
        const tag = m.proto === "hsrp" ? "%HSRP-5-STATECHANGE" : "%VRRP-6-STATECHANGE";
        this.log(m.dev, `${tag}: ${shortIf(m.ifname)} Grp ${m.group} state ${was} -> ${m.state}`);
      }
      this.fhrpStates = now;
    }
    /**
     * L5-e: a PC puts frames on the wire (ping, trace, DHCP). On a secure access port its source
     * MAC is learned (sticky → running-config) or, past `maximum`, triggers the violation mode:
     * shutdown → err-disable + syslog, restrict → counter + syslog, protect → silent drop.
     */
    hostSends(pc) {
      const at = this.topo.pcAttach[pc];
      const def = this.topo.devices[pc];
      if (!at || !def || this.hw.off.has(pc) || this.hw.nicDown.has(pc)) return;
      const key = pk(at.dev, at.port);
      const ps = activePs(this.running[at.dev], at.port);
      if (!ps || !this.derived.phys[key]?.up) return;
      const mac = def.mac;
      this.psLast.set(key, mac);
      const dyn = this.psDynamic.get(key) ?? [];
      if (ps.macs.includes(mac) || ps.stickyMacs.includes(mac) || dyn.includes(mac)) return;
      if (secureCount(ps, dyn) < ps.max) {
        if (ps.sticky) ps.stickyMacs.push(mac);
        else this.psDynamic.set(key, [...dyn, mac]);
        this.commit();
        return;
      }
      if (ps.violation === "protect") return;
      this.psViolations.set(key, (this.psViolations.get(key) ?? 0) + 1);
      this.log(at.dev, `%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address ${mac} on port ${at.port}.`);
      if (ps.violation === "shutdown" && !this.errdis.has(key)) {
        this.errdis.add(key);
        this.errCause.set(key, "psecure-violation");
        this.log(at.dev, `%PM-4-ERR_DISABLE: psecure-violation error detected on ${shortIf(at.port)}, putting ${shortIf(at.port)} in err-disable state`);
      }
      this.commit();
    }
    /** Plug in (up) or unplug / cut (down) the cable on this port. False when no cable is there. */
    setLink(dev, port, up) {
      const peer = this.topo.peer[pk(dev, port)];
      if (!peer) return false;
      if (!up) {
        this.flushPortMacs(dev, port);
        this.flushPortMacs(peer.dev, peer.port);
      }
      for (const k of [pk(dev, port), pk(peer.dev, peer.port)]) {
        if (up) this.hw.cut.delete(k);
        else this.hw.cut.add(k);
      }
      this.commit();
      return true;
    }
    flushRevlannedPorts(_prev) {
      const next = /* @__PURE__ */ new Map();
      for (const [dev, lps] of Object.entries(this.derived.lports))
        for (const lp of lps) next.set(`${dev}|${lp.name}`, `${lp.opMode}/${lp.cfg.accessVlan}/${lp.cfg.nativeVlan}`);
      for (const [k, v] of next) {
        const old = this.portSig.get(k);
        if (old === void 0 || old === v) continue;
        const [dev, name] = k.split("|");
        for (const e of macTable(this.derived, dev, this.seen)) if (e.port === name) this.seen.delete(e.mac);
      }
      this.portSig = next;
    }
    /**
     * Forget MACs a switch learned on this port. The learned set is lab-wide, so those
     * addresses are relearned everywhere on their next frame (real switches age the
     * entries on other switches out after 300 s).
     */
    flushPortMacs(dev, port) {
      if (this.topo.devices[dev]?.kind !== "switch") return;
      const name = this.derived.lportOfPhys[pk(dev, port)]?.name ?? port;
      for (const e of macTable(this.derived, dev, this.seen)) if (e.port === name) this.seen.delete(e.mac);
    }
    /**
     * Move the cable end plugged into fromDev/fromPort to toDev/toPort (a free port).
     * The topology is rebuilt; MACs learned on the old port are flushed.
     * False when there is no cable there or the target port is missing or taken.
     */
    moveCable(fromDev, fromPort, toDev, toPort) {
      const peer = this.topo.peer[pk(fromDev, fromPort)];
      const target = this.topo.devices[toDev];
      if (!peer || !target) return false;
      const exists = target.kind === "pc" ? toPort === "eth0" : target.ports.includes(toPort);
      if (!exists || this.topo.peer[pk(toDev, toPort)] || toDev === peer.dev && toPort === peer.port) return false;
      if (target.kind === "pc" && this.topo.devices[peer.dev]?.kind === "pc") return false;
      this.flushPortMacs(fromDev, fromPort);
      this.flushPortMacs(peer.dev, peer.port);
      const at = (e) => e[0] === fromDev && e[1] === fromPort;
      const links = this.def.links.map((l) => {
        if (at(l.a)) return { ...l, a: [toDev, toPort] };
        if (at(l.b)) return { ...l, b: [toDev, toPort] };
        return l;
      });
      this.def = { ...this.def, links };
      this.topo = buildTopo(this.def);
      if (this.hw.cut.delete(pk(fromDev, fromPort))) this.hw.cut.add(pk(toDev, toPort));
      this.commit();
      return true;
    }
    /** Read-only queries on the current state, including learned MAC addresses. */
    query() {
      this.seen.expire();
      return new LabQuery(this.derived, this.startup, this.seen, this.dhcp);
    }
    /**
     * L5-b: the PC asks for an address (DHCP DISCOVER … ACK). On success its address, mask,
     * gateway and DNS server come from the lease. When nothing answers it keeps the
     * link-local (169.254/16) address it already has, or gives itself one; the gateway is
     * cleared and an earlier lease of this client is dropped.
     */
    dhcpRequest(pc) {
      const def = this.topo.devices[pc];
      if (!def || def.kind !== "pc") return { ok: false, reason: "nolink" };
      const old = this.pcs[pc];
      const keep = { ...old.services ? { services: old.services } : {} };
      const r = dhcpDiscover(this.derived, pc, this.dhcp);
      this.dhcp = this.dhcp.filter((b) => b.client !== pc);
      if (r.ok) {
        this.pcs[pc] = { ip: r.ip, prefix: r.prefix, gw: r.gw, dhcp: true, dns: r.dns, ...keep };
        this.dhcp.push({ server: r.server, serverIp: r.serverIp, pool: r.pool, ip: r.ip, client: pc, mac: def.mac, expires: this.leaseExpiry() });
        this.seen.add(def.mac);
      } else {
        if (old.ip && isApipa(old.ip)) this.pcs[pc] = { ...old, dhcp: true };
        else this.pcs[pc] = { ip: apipaFor(def.mac), prefix: 16, gw: null, dhcp: true, ...old.dns && !old.dhcp ? { dns: old.dns } : {}, ...keep };
      }
      this.commit();
      return r;
    }
    /** L5-b: DHCP release: the client gives its address back and has none. */
    dhcpRelease(pc) {
      const old = this.pcs[pc];
      if (!old) return;
      this.dhcp = this.dhcp.filter((b) => b.client !== pc);
      this.pcs[pc] = { ip: null, prefix: 24, gw: null, ...old.services ? { services: old.services } : {} };
      this.commit();
    }
    /** L5-b: lease of this PC that is still in use (address obtained from DHCP), or null. */
    dhcpLeaseOf(pc) {
      const c = this.pcs[pc];
      return c?.dhcp && this.dhcp.find((b) => b.client === pc && b.ip === c.ip) || null;
    }
    /** `clear ip dhcp binding *` / reload: the server forgets its leases. */
    dhcpClear(server, ip2) {
      const before = this.dhcp.length;
      this.dhcp = this.dhcp.filter((b) => b.server !== server || ip2 !== void 0 && b.ip !== ip2);
      return before - this.dhcp.length;
    }
    /** Default lease is one day: expiration on the lab clock (starts on Mar 1). */
    leaseExpiry() {
      const ms = Date.now() - this.t0 + 3723e3;
      const h = Math.floor(ms / 36e5) % 24;
      const m = Math.floor(ms / 6e4) % 60;
      const two = (n) => String(n).padStart(2, "0");
      return `Mar 02 1993 ${two(h % 12 === 0 ? 12 : h % 12)}:${two(m)} ${h < 12 ? "AM" : "PM"}`;
    }
    /** Cable on this port is plugged in and intact (says nothing about the far device). */
    cableIntact(dev, port) {
      return !!this.topo.peer[pk(dev, port)] && !this.hw.cut.has(pk(dev, port));
    }
    /**
     * Power a device off or on. Powering a switch on is a reload: the running config
     * comes back from startup-config (factory defaults when nothing was saved) and
     * err-disabled ports recover.
     */
    setPower(dev, on) {
      const def = this.topo.devices[dev];
      if (!def || on === !this.hw.off.has(dev)) return;
      if (!on) {
        this.hw.off.add(dev);
      } else {
        this.hw.off.delete(dev);
        if (def.kind === "switch") {
          const saved = this.startup[dev];
          this.running[dev] = saved ? clone(saved) : Object.assign(defaultSwitchConfig(def), { hostname: dev });
          const o = this.running[dev].ospf;
          if (o) o.activeRid = null;
          for (const k of [...this.errdis]) if (k.startsWith(dev + "|")) this.errdis.delete(k);
          for (const k of [...this.arp]) if (k.startsWith(dev + ">")) this.arp.delete(k);
          for (const k of [...this.arpIncomplete]) if (k.startsWith(dev + ">")) this.arpIncomplete.delete(k);
        }
        this.dhcpClear(dev);
      }
      this.commit();
    }
    powered(dev) {
      return !!this.topo.devices[dev] && !this.hw.off.has(dev);
    }
    /** Enable or disable a PC's network card. */
    setNic(pc, up) {
      if (this.topo.devices[pc]?.kind !== "pc") return;
      if (up) this.hw.nicDown.delete(pc);
      else this.hw.nicDown.add(pc);
      this.commit();
    }
    /** Hosts that sent or answered traffic become visible in MAC tables. */
    /** L5-c: count ACL entries matched by real traffic; `packets` per delivery (ping sends 5). */
    countAcl(packets, ...ds) {
      for (const d of ds)
        for (const h of d?.acl ?? []) {
          const k = `${h.dev}|${h.acl}|${h.seq}`;
          this.aclHits.set(k, (this.aclHits.get(k) ?? 0) + packets);
        }
    }
    /** L5-d: record translations created by real traffic; `packets` per delivery. */
    recordNat(packets, ...ds) {
      for (const d of ds) {
        if (d?.natMiss) this.natMisses += packets;
        this.natHits += packets * (d?.natted ?? 0);
        for (const e of d?.nat ?? [])
          if (!this.natTable.some((x) => JSON.stringify(x) === JSON.stringify(e))) this.natTable.push(e);
      }
      this.derived.natTable = this.natTable;
    }
    markSeen(hops, from) {
      if (!hops.length) return;
      hops.forEach((h, i) => {
        this.learn(h.outIf.mac);
        const owner = l3Ifs(this.derived, h.dev).find((x) => x.ip === h.ip);
        if (owner) this.learn(owner.mac);
        const prev = i === 0 ? from : hops[i - 1].dev;
        this.arp.add(`${prev}>${h.ip}`);
        this.arpIncomplete.delete(`${prev}>${h.ip}`);
      });
    }
    /**
     * MotorBulgusu (I-1, test_aglab_next_hop): switch'ler yalnız gidiş çerçevelerinden öğreniyordu.
     * Gerçek switch dönüş çerçevelerinin kaynak MAC'ini de öğrenir (asimetrik yolda farklı router).
     */
    markExchange(from, forward, back) {
      if (forward) this.markSeen(forward.hops, from);
      if (!back) return;
      const replier = forward?.kind === "ok" ? forward.hops[forward.hops.length - 1]?.dev ?? from : forward && "at" in forward ? forward.at : null;
      if (replier) this.markSeen(back.hops, replier);
    }
    /** Yeni çerçeve: adres yeniden öğrenilir (temizlenmiş switch'lerde de). */
    learn(mac) {
      this.seen.add(mac);
      for (const hidden of this.clearedOn.values()) hidden.delete(mac);
    }
    /**
     * MotorBulgusu (I-1): `clear mac address-table dynamic` yalnız o switch'in tablosunu
     * temizler (IOS); öğrenilmiş küme lab geneli olduğu için switch başına gizlenir, adres yeni
     * trafikte yeniden görünür (doğrulanmadı: trafiğin o switch'ten geçip geçmediği ayrımı yok).
     */
    clearMacs(dev) {
      this.clearedOn.set(dev, new Set(this.seen));
    }
    /** Bir switch'in gördüğü öğrenilmiş adresler (temizlenenler hariç). */
    seenOn(dev) {
      this.seen.expire();
      const hidden = this.clearedOn.get(dev);
      return hidden?.size ? new Set([...this.seen].filter((m) => !hidden.has(m))) : this.seen;
    }
    hostname(dev) {
      return this.running[dev]?.hostname ?? dev;
    }
    objectives() {
      const q = this.query();
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
        arpIncomplete: [...this.arpIncomplete],
        errdis: [...this.errdis],
        errCause: [...this.errCause],
        psDynamic: [...this.psDynamic],
        psViolations: [...this.psViolations],
        psLast: [...this.psLast],
        aclHits: [...this.aclHits],
        nat: clone(this.natTable),
        natHits: this.natHits,
        natMisses: this.natMisses,
        hw: { cut: [...this.hw.cut], off: [...this.hw.off], nicDown: [...this.hw.nicDown] },
        dhcp: clone(this.dhcp)
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
      this.seen = new AgingSet(s.seen);
      this.arp = new Set(s.arp);
      this.arpIncomplete = new Set(s.arpIncomplete ?? []);
      this.errdis = new Set(s.errdis ?? []);
      this.errCause = new Map(s.errCause ?? []);
      this.psDynamic = new Map(s.psDynamic ?? []);
      this.psViolations = new Map(s.psViolations ?? []);
      this.psLast = new Map(s.psLast ?? []);
      this.aclHits = new Map(s.aclHits ?? []);
      this.natTable = clone(s.nat ?? []);
      this.natHits = s.natHits ?? 0;
      this.natMisses = s.natMisses ?? 0;
      if (s.hw) this.hw = { cut: new Set(s.hw.cut), off: new Set(s.hw.off), nicDown: new Set(s.hw.nicDown) };
      this.dhcp = clone(s.dhcp ?? []);
      this.fhrpActive.clear();
      this.fhrpStates.clear();
      this.fhrpQuiet = true;
      this.derived = this.recompute();
      this.fhrpQuiet = false;
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
        if (!cdpBetween(b, m.dev, m.port, m.peerDev, m.peerPort)) continue;
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
      const dupKeys = (x) => new Map(
        x.dups.flatMap(
          (g) => g.owners.filter((o) => o.kind === "svi" || o.kind === "routed").map((o) => {
            const other = g.owners.find((p) => p.dev !== o.dev);
            return [`${g.ip}|${o.dev}|${o.name}|${other?.mac}`, { ip: g.ip, o, other }];
          }).filter(([, v]) => !!v.other)
        )
      );
      const oldDup = dupKeys(a);
      for (const [k, v] of dupKeys(b))
        if (!oldDup.has(k)) this.log(v.o.dev, `%IP-4-DUPADDR: Duplicate address ${v.ip} on ${v.o.name}, sourced by ${v.other.mac}`);
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
  function createLab(def, opts = {}) {
    return new LabRuntime(def, (rt) => {
      if (opts.lenient) rt.configReport = [];
      for (const sw of rt.topo.switches) {
        const text = def.initialConfig?.[sw.id];
        if (!text) continue;
        if (opts.lenient) {
          rt.configReport.push(...applyConfigText(rt, sw.id, text));
          continue;
        }
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
  function assertPowered(rt, dev) {
    if (!rt.powered(dev)) throw new Error(`${dev} is powered off`);
  }
  function createSession(rt, dev) {
    assertPowered(rt, dev);
    return rt.topo.devices[dev].kind === "pc" ? new VpcsSession(rt, dev) : new IosSession(rt, dev);
  }
  function runScript(rt, dev, script, session) {
    assertPowered(rt, dev);
    const s = session ?? new IosSession(rt, dev);
    if (s.mode === "user") s.mode = "priv";
    const out = [];
    for (const line of script.split("\n")) {
      out.push(s.prompt() + line);
      out.push(...s.exec(line));
    }
    return out;
  }

  // src/labs/vlan-basics.ts
  var pingBoth = (q, a, b) => q.ping(a, q.pcIp(b) ?? "0.0.0.0").ok && q.ping(b, q.pcIp(a) ?? "0.0.0.0").ok;
  var UNUSED = ["Fa0/5", "Fa0/6", "Fa0/7", "Fa0/8"];
  var lab = {
    id: "vlan-temelleri",
    title: "VLAN temelleri: tek switch",
    summary: "Aynı subnet'teki dört PC'yi iki VLAN'a ayır ve VLAN'ın broadcast domain'i nasıl böldüğünü gör.",
    level: "Başlangıç",
    tags: ["VLAN", "Access port", "hostname"],
    brief: [
      "Dört PC aynı switch'e bağlı ve hepsi 192.168.1.0/24 subnet'inde. Şu an hepsi VLAN 1'de olduğu için birbirine ping atabiliyor.",
      "Switch'in adını ERISIM-1 yap. VLAN 10 (YONETIM) ve VLAN 20 (MISAFIR) oluştur. PC1 ve PC2 VLAN 10'da, PC3 ve PC4 VLAN 20'de olsun.",
      "Kullanılmayan Fa0/5–Fa0/8 portlarını kapat.",
      "Sonuçta IP adresleri aynı subnet'te olsa bile PC1, PC3'e ulaşamamalı. VLAN'lar farklı broadcast domain'lerdir; aradaki trafik için router gerekir.",
      "Kısayol: interface range fa0/5 - 8 → shutdown. Kontrol: show vlan brief, show interfaces status."
    ],
    view: { w: 760, h: 420 },
    devices: [
      { id: "SW1", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0001.0001", ports: ports("Fa0/1-8", "Gi0/1-2"), x: 380, y: 120 },
      { id: "PC1", kind: "pc", mac: "0050.7966.0101", x: 100, y: 330 },
      { id: "PC2", kind: "pc", mac: "0050.7966.0102", x: 285, y: 330 },
      { id: "PC3", kind: "pc", mac: "0050.7966.0103", x: 475, y: 330 },
      { id: "PC4", kind: "pc", mac: "0050.7966.0104", x: 660, y: 330 }
    ],
    links: [
      { a: ["PC1", "eth0"], b: ["SW1", "FastEthernet0/1"] },
      { a: ["PC2", "eth0"], b: ["SW1", "FastEthernet0/2"] },
      { a: ["PC3", "eth0"], b: ["SW1", "FastEthernet0/3"] },
      { a: ["PC4", "eth0"], b: ["SW1", "FastEthernet0/4"] }
    ],
    initialPcs: {
      PC1: { ip: "192.168.1.11", prefix: 24, gw: null },
      PC2: { ip: "192.168.1.12", prefix: 24, gw: null },
      PC3: { ip: "192.168.1.13", prefix: 24, gw: null },
      PC4: { ip: "192.168.1.14", prefix: 24, gw: null }
    },
    objectives: [
      {
        id: "hostname",
        title: "Switch adı ERISIM-1",
        hint: "configure terminal → hostname ERISIM-1. Prompt hemen değişir.",
        check: (q) => q.hostname("SW1") === "ERISIM-1"
      },
      {
        id: "vlans",
        title: "VLAN 10 (YONETIM) ve VLAN 20 (MISAFIR) tanımlı",
        hint: "vlan 10 → name YONETIM, vlan 20 → name MISAFIR. Kontrol: show vlan brief",
        check: (q) => q.vlanName("SW1", 10) === "YONETIM" && q.vlanName("SW1", 20) === "MISAFIR"
      },
      {
        id: "access",
        title: "Fa0/1–2 VLAN 10, Fa0/3–4 VLAN 20 (access mod)",
        hint: "interface range fa0/1 - 2 → switchport mode access → switchport access vlan 10",
        check: (q) => {
          const want = [["Fa0/1", 10], ["Fa0/2", 10], ["Fa0/3", 20], ["Fa0/4", 20]];
          const bad = want.filter(([p, v]) => q.portCfg("SW1", p)?.mode !== "access" || q.port("SW1", p)?.cfg.accessVlan !== v || q.port("SW1", p)?.inactive);
          return { ok: !bad.length, detail: bad.length ? "Sorunlu: " + bad.map(([p]) => p).join(", ") : void 0 };
        }
      },
      {
        id: "unused",
        title: "Kullanılmayan Fa0/5–Fa0/8 kapalı",
        hint: `interface range fa0/5 - 8 → shutdown. show interfaces status'ta "disabled" görünür.`,
        check: (q) => UNUSED.every((p) => q.phys("SW1", p)?.adminDown)
      },
      {
        id: "same",
        title: "PC1 ↔ PC2 ve PC3 ↔ PC4 ping çalışıyor",
        hint: "Aynı VLAN'daki PC'ler hâlâ konuşabilmeli.",
        check: (q) => q.pcVlan("PC1") === 10 && q.pcVlan("PC3") === 20 && pingBoth(q, "PC1", "PC2") && pingBoth(q, "PC3", "PC4")
      },
      {
        id: "isolated",
        title: "PC1 → PC3 ping çalışmıyor (VLAN izolasyonu)",
        hint: "Aynı subnet ama farklı VLAN: ARP isteği diğer VLAN'a ulaşmaz, ping timeout olur.",
        check: (q) => q.pcVlan("PC1") === 10 && q.pcVlan("PC3") === 20 && !q.ping("PC1", "192.168.1.13").ok
      }
    ],
    solution: {
      SW1: `configure terminal
hostname ERISIM-1
vlan 10
 name YONETIM
vlan 20
 name MISAFIR
exit
interface range fa0/1 - 2
 switchport mode access
 switchport access vlan 10
interface range fa0/3 - 4
 switchport mode access
 switchport access vlan 20
interface range fa0/5 - 8
 shutdown
end
write memory`
    }
  };
  var vlan_basics_default = lab;

  // src/labs/trunk-troubleshoot.ts
  var pingBoth2 = (q, a, b) => q.ping(a, q.pcIp(b) ?? "0.0.0.0").ok && q.ping(b, q.pcIp(a) ?? "0.0.0.0").ok;
  var lab2 = {
    id: "ariza-trunk",
    title: "Arıza bul: Bozuk trunk",
    summary: "Önceden yapılandırılmış iki switch'te dört hata var. show komutlarıyla bul ve düzelt.",
    level: "Başlangıç",
    tags: ["Troubleshooting", "VLAN", "Trunk", "Native VLAN"],
    brief: [
      "SWA ve SWB arasındaki Gi0/1 linki trunk. VLAN 10 (OFIS) ve VLAN 30 (KAMERA) iki switch'e de yayılmalı.",
      "PC1 ↔ PC2 (VLAN 10) ve PC3 ↔ PC4 (VLAN 30) birbirine ping atabilmeli. Şu an ikisi de çalışmıyor.",
      "Trunk yalnızca VLAN 10 ve 30'u taşısın ve iki uçta native VLAN aynı olsun. Routing yok; PC'ler yalnızca kendi VLAN'larıyla konuşur.",
      "İpucu: show vlan brief, show interfaces trunk, show interfaces status ve syslog paneli yeterli."
    ],
    view: { w: 760, h: 440 },
    devices: [
      { id: "SWA", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.00aa.0001", ports: ports("Fa0/1-4", "Gi0/1-2"), x: 200, y: 140 },
      { id: "SWB", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.00aa.0002", ports: ports("Fa0/1-4", "Gi0/1-2"), x: 560, y: 140 },
      { id: "PC1", kind: "pc", mac: "0050.7966.6a01", x: 100, y: 360 },
      { id: "PC3", kind: "pc", mac: "0050.7966.6a03", x: 290, y: 360 },
      { id: "PC2", kind: "pc", mac: "0050.7966.6a02", x: 470, y: 360 },
      { id: "PC4", kind: "pc", mac: "0050.7966.6a04", x: 660, y: 360 }
    ],
    links: [
      { a: ["SWA", "GigabitEthernet0/1"], b: ["SWB", "GigabitEthernet0/1"] },
      { a: ["PC1", "eth0"], b: ["SWA", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["SWA", "FastEthernet0/2"] },
      { a: ["PC2", "eth0"], b: ["SWB", "FastEthernet0/1"] },
      { a: ["PC4", "eth0"], b: ["SWB", "FastEthernet0/2"] }
    ],
    initialPcs: {
      PC1: { ip: "10.0.10.11", prefix: 24, gw: null },
      PC2: { ip: "10.0.10.12", prefix: 24, gw: null },
      PC3: { ip: "10.0.30.11", prefix: 24, gw: null },
      PC4: { ip: "10.0.30.12", prefix: 24, gw: null }
    },
    initialConfig: {
      SWA: `vlan 10
 name OFIS
vlan 30
 name KAMERA
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 30
interface gi0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,30
exit`,
      SWB: `vlan 10
 name OFIS
exit
interface fa0/1
 switchport mode access
 switchport access vlan 20
interface fa0/2
 switchport mode access
 switchport access vlan 30
interface gi0/1
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10
exit`
    },
    objectives: [
      {
        id: "vlans",
        title: "VLAN 10 (OFIS) ve 30 (KAMERA) iki switch'te de var",
        hint: `show vlan brief ile karşılaştır. Eksik VLAN'a atanan port "inactive" görünür.`,
        check: (q) => ["SWA", "SWB"].every((s) => q.vlanName(s, 10) === "OFIS" && q.vlanName(s, 30) === "KAMERA")
      },
      {
        id: "access",
        title: "PC1/PC2 VLAN 10'da, PC3/PC4 VLAN 30'da",
        hint: "show interfaces status ile PC portlarının VLAN sütununa bak.",
        check: (q) => q.pcVlan("PC1") === 10 && q.pcVlan("PC2") === 10 && q.pcVlan("PC3") === 30 && q.pcVlan("PC4") === 30
      },
      {
        id: "native",
        title: "Trunk'ın iki ucunda native VLAN aynı",
        hint: "Syslog'da CDP-4-NATIVE_VLAN_MISMATCH var mı? show interfaces trunk → Native vlan sütunu.",
        check: (q) => q.isTrunk("SWA", "Gi0/1") && q.isTrunk("SWB", "Gi0/1") && q.nativeMismatches().length === 0
      },
      {
        id: "allowed",
        title: "Trunk iki uçta da yalnızca VLAN 10 ve 30'u taşıyor",
        hint: 'show interfaces trunk → "Vlans allowed on trunk". switchport trunk allowed vlan add 30',
        check: (q) => ["SWA", "SWB"].every((s) => {
          const lp = q.port(s, "Gi0/1");
          return !!lp && lp.cfg.allowed?.join(",") === "10,30" && q.trunkAllows(s, "Gi0/1", 10) && q.trunkAllows(s, "Gi0/1", 30);
        })
      },
      {
        id: "ping",
        title: "PC1 ↔ PC2 ve PC3 ↔ PC4 ping",
        hint: "Önceki hedefler tamamsa ping de çalışmalı. PC konsolunda: ping 10.0.10.12",
        check: (q) => pingBoth2(q, "PC1", "PC2") && pingBoth2(q, "PC3", "PC4")
      }
    ],
    solution: {
      SWB: `configure terminal
vlan 30
 name KAMERA
exit
interface fa0/1
 switchport access vlan 10
interface gi0/1
 no switchport trunk native vlan
 switchport trunk allowed vlan add 30
end
write memory`
    }
  };
  var trunk_troubleshoot_default = lab2;

  // src/labs/trunk-hardening.ts
  var SW = ["SW1", "SW2"];
  var PC_PORTS = ["Fa0/1", "Fa0/2"];
  var UNUSED2 = ["Fa0/3", "Fa0/4", "Gi0/2"];
  var pingBoth3 = (q, a, b) => q.ping(a, q.pcIp(b) ?? "0.0.0.0").ok && q.ping(b, q.pcIp(a) ?? "0.0.0.0").ok;
  var lab3 = {
    id: "trunk-guvenligi",
    title: "Trunk ve port güvenliği (DTP)",
    summary: "Varsayılan DTP ayarlarını kapat: statik trunk, nonegotiate, kullanılmayan native VLAN, park VLAN ve portfast.",
    level: "Orta",
    tags: ["DTP", "Native VLAN", "Best practice", "Portfast"],
    brief: [
      'İki switch fabrika ayarında. Tüm portlar "dynamic auto": iki uç da auto olduğu için aradaki link trunk olmadı ve bir saldırgan DTP ile trunk açabilir.',
      "VLAN 10 (KULLANICI), VLAN 998 (PARK) ve VLAN 999 (NATIVE) oluştur. PC portları VLAN 10'da statik access olsun ve portfast açık olsun.",
      "Gi0/1 linki iki uçta statik trunk olsun, DTP kapalı olsun (switchport nonegotiate), native VLAN 999 olsun ve yalnızca VLAN 10 taşınsın.",
      "Kullanılmayan portlar (Fa0/3, Fa0/4, Gi0/2) access modda, VLAN 998'de ve kapalı olsun.",
      `Not: nonegotiate yalnızca access veya trunk modda kabul edilir. dynamic moddayken "Conflict between 'nonegotiate' and 'dynamic' status" hatası alırsın.`
    ],
    view: { w: 760, h: 400 },
    devices: [
      { id: "SW1", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0002.0001", ports: ports("Fa0/1-4", "Gi0/1-2"), x: 210, y: 130 },
      { id: "SW2", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0002.0002", ports: ports("Fa0/1-4", "Gi0/1-2"), x: 550, y: 130 },
      { id: "PC1", kind: "pc", mac: "0050.7966.0201", x: 110, y: 320 },
      { id: "PC3", kind: "pc", mac: "0050.7966.0203", x: 300, y: 320 },
      { id: "PC2", kind: "pc", mac: "0050.7966.0202", x: 460, y: 320 },
      { id: "PC4", kind: "pc", mac: "0050.7966.0204", x: 650, y: 320 }
    ],
    links: [
      { a: ["SW1", "GigabitEthernet0/1"], b: ["SW2", "GigabitEthernet0/1"] },
      { a: ["PC1", "eth0"], b: ["SW1", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["SW1", "FastEthernet0/2"] },
      { a: ["PC2", "eth0"], b: ["SW2", "FastEthernet0/1"] },
      { a: ["PC4", "eth0"], b: ["SW2", "FastEthernet0/2"] }
    ],
    initialPcs: {
      PC1: { ip: "10.10.10.11", prefix: 24, gw: null },
      PC3: { ip: "10.10.10.13", prefix: 24, gw: null },
      PC2: { ip: "10.10.10.12", prefix: 24, gw: null },
      PC4: { ip: "10.10.10.14", prefix: 24, gw: null }
    },
    objectives: [
      {
        id: "vlans",
        title: "VLAN 10 (KULLANICI), 998 (PARK), 999 (NATIVE) iki switch'te var",
        hint: "vlan 10 → name KULLANICI, vlan 998 → name PARK, vlan 999 → name NATIVE",
        check: (q) => SW.every((s) => q.vlanName(s, 10) === "KULLANICI" && q.vlanName(s, 998) === "PARK" && q.vlanName(s, 999) === "NATIVE")
      },
      {
        id: "static-trunk",
        title: "Gi0/1 iki uçta statik trunk ve DTP kapalı",
        hint: 'switchport mode trunk → switchport nonegotiate. show interfaces switchport → "Negotiation of Trunking: Off"',
        check: (q) => SW.every((s) => q.portCfg(s, "Gi0/1")?.mode === "trunk" && q.portCfg(s, "Gi0/1")?.nonegotiate && q.isTrunk(s, "Gi0/1"))
      },
      {
        id: "native",
        title: "Native VLAN 999, trunk yalnızca VLAN 10'u taşıyor",
        hint: "switchport trunk native vlan 999 + switchport trunk allowed vlan 10. İki uç aynı olmalı.",
        check: (q) => q.nativeMismatches().length === 0 && SW.every((s) => {
          const c = q.portCfg(s, "Gi0/1");
          return c?.nativeVlan === 999 && c.allowed?.join(",") === "10" && q.trunkAllows(s, "Gi0/1", 10);
        })
      },
      {
        id: "access",
        title: "PC portları VLAN 10'da statik access, portfast açık",
        hint: "interface range fa0/1 - 2 → switchport mode access → switchport access vlan 10 → spanning-tree portfast",
        check: (q) => SW.every(
          (s) => PC_PORTS.every((p) => {
            const c = q.portCfg(s, p);
            return c?.mode === "access" && c.accessVlan === 10 && c.portfast;
          })
        )
      },
      {
        id: "parked",
        title: "Kullanılmayan portlar VLAN 998'de ve kapalı",
        hint: "interface range fa0/3 - 4, gi0/2 → switchport mode access → switchport access vlan 998 → shutdown",
        check: (q) => {
          const bad = SW.flatMap(
            (s) => UNUSED2.filter((p) => {
              const c = q.portCfg(s, p);
              return !(c?.mode === "access" && c.accessVlan === 998 && c.shutdown);
            }).map((p) => `${s} ${p}`)
          );
          return { ok: !bad.length, detail: bad.length ? "Sorunlu: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "ping",
        title: "Dört PC birbirine ping atabiliyor (VLAN 10)",
        hint: "Trunk VLAN 10'u taşıyorsa PC1 → PC2 çalışır. PC konsolunda: ping 10.10.10.12",
        check: (q) => ["PC1", "PC2", "PC3", "PC4"].every((p) => q.pcVlan(p) === 10) && pingBoth3(q, "PC1", "PC2") && pingBoth3(q, "PC3", "PC4")
      }
    ],
    solution: Object.fromEntries(
      SW.map((s) => [
        s,
        `configure terminal
vlan 10
 name KULLANICI
vlan 998
 name PARK
vlan 999
 name NATIVE
exit
interface range fa0/1 - 2
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
interface range fa0/3 - 4, gi0/2
 switchport mode access
 switchport access vlan 998
 shutdown
interface gi0/1
 switchport mode trunk
 switchport nonegotiate
 switchport trunk native vlan 999
 switchport trunk allowed vlan 10
end
write memory`
      ])
    )
  };
  var trunk_hardening_default = lab3;

  // src/labs/campus-l2-l3.ts
  var SW2 = ["SW1", "SW2", "SW3"];
  var TRUNKS = [
    ["SW1", "Gi0/1", "SW2", "Gi0/1"],
    ["SW1", "Gi0/3", "SW3", "Gi0/1"],
    ["SW2", "Gi0/3", "SW3", "Gi0/2"]
  ];
  var pingBoth4 = (q, a, b) => {
    const ab = q.ping(a, q.pcIp(b) ?? "0.0.0.0");
    const ba = q.ping(b, q.pcIp(a) ?? "0.0.0.0");
    return ab.ok && ba.ok;
  };
  var lab4 = {
    id: "kampus-vlan-trunk-stp",
    title: "Kampüs ağı: VLAN, Trunk, STP, EtherChannel",
    summary: "Üç switch ve dört PC ile VLAN, trunk, native VLAN, LACP, root bridge ve VLAN'lar arası yönlendirme kur.",
    level: "Orta",
    tags: ["VLAN", "Trunk", "STP", "EtherChannel", "SVI"],
    brief: [
      "SW1 çekirdek (L3, Catalyst 3560), SW2 ve SW3 erişim switch'leri. PC'lerin IP adresleri hazır; sen yalnızca switch'leri yapılandırırsın.",
      "VLAN 10 adı SATIS, VLAN 20 adı MUHASEBE, VLAN 99 adı NATIVE olsun. PC1 ve PC2 VLAN 10'da, PC3 ve PC4 VLAN 20'de.",
      "Switch'ler arası tüm linkler trunk olsun, native VLAN 99 kullansın ve yalnızca 10, 20, 99 taşınsın. SW1–SW2 arasındaki iki link LACP ile Port-channel 1 olsun.",
      "SW1 VLAN 10 ve 20 için root bridge olsun. SW1 VLAN'lar arası yönlendirme yapsın: Vlan10 = 192.168.10.1/24, Vlan20 = 192.168.20.1/24.",
      `Not: SW1 bir 3560 olduğu için trunk öncesi "switchport trunk encapsulation dot1q" gerekir. VLAN'ı oluşturmadan porta atarsan port "inactive" kalır.`
    ],
    view: { w: 900, h: 520 },
    devices: [
      { id: "SW1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0010.0300", ports: ports("Fa0/1-4", "Gi0/1-4"), l3: true, needsEncap: true, x: 450, y: 80 },
      { id: "SW2", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0010.0101", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 210, y: 270 },
      { id: "SW3", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0010.0202", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 690, y: 270 },
      { id: "PC1", kind: "pc", mac: "0050.7966.6801", x: 100, y: 450 },
      { id: "PC3", kind: "pc", mac: "0050.7966.6803", x: 320, y: 450 },
      { id: "PC2", kind: "pc", mac: "0050.7966.6802", x: 580, y: 450 },
      { id: "PC4", kind: "pc", mac: "0050.7966.6804", x: 800, y: 450 }
    ],
    links: [
      { a: ["SW1", "GigabitEthernet0/1"], b: ["SW2", "GigabitEthernet0/1"] },
      { a: ["SW1", "GigabitEthernet0/2"], b: ["SW2", "GigabitEthernet0/2"] },
      { a: ["SW1", "GigabitEthernet0/3"], b: ["SW3", "GigabitEthernet0/1"] },
      { a: ["SW2", "GigabitEthernet0/3"], b: ["SW3", "GigabitEthernet0/2"] },
      { a: ["PC1", "eth0"], b: ["SW2", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["SW2", "FastEthernet0/2"] },
      { a: ["PC2", "eth0"], b: ["SW3", "FastEthernet0/1"] },
      { a: ["PC4", "eth0"], b: ["SW3", "FastEthernet0/2"] }
    ],
    initialPcs: {
      PC1: { ip: "192.168.10.11", prefix: 24, gw: "192.168.10.1" },
      PC2: { ip: "192.168.10.12", prefix: 24, gw: "192.168.10.1" },
      PC3: { ip: "192.168.20.11", prefix: 24, gw: "192.168.20.1" },
      PC4: { ip: "192.168.20.12", prefix: 24, gw: "192.168.20.1" }
    },
    objectives: [
      {
        id: "vlans",
        title: "VLAN 10 (SATIS), 20 (MUHASEBE), 99 (NATIVE) üç switch'te tanımlı",
        hint: "Her switch'te: vlan 10 → name SATIS, vlan 20 → name MUHASEBE, vlan 99 → name NATIVE. Kontrol: show vlan brief",
        check: (q) => {
          const want = [[10, "SATIS"], [20, "MUHASEBE"], [99, "NATIVE"]];
          const missing = SW2.flatMap((s) => want.filter(([v, n]) => q.vlanName(s, v) !== n).map(([v]) => `${s}:${v}`));
          return { ok: !missing.length, detail: missing.length ? "Eksik/yanlış: " + missing.join(", ") : void 0 };
        }
      },
      {
        id: "access",
        title: "PC1/PC2 VLAN 10'da, PC3/PC4 VLAN 20'de",
        hint: "PC portlarında: switchport mode access + switchport access vlan N. Kontrol: show interfaces status",
        check: (q) => {
          const want = { PC1: 10, PC2: 10, PC3: 20, PC4: 20 };
          const bad = Object.entries(want).filter(([pc, v]) => q.pcVlan(pc) !== v);
          return { ok: !bad.length, detail: bad.length ? bad.map(([pc]) => `${pc}: ${q.pcVlan(pc) ?? "bağlı değil"}`).join(", ") : void 0 };
        }
      },
      {
        id: "trunks",
        title: "Switch'ler arası linkler trunk; yalnızca 10, 20, 99 taşınıyor",
        hint: "switchport mode trunk + switchport trunk allowed vlan 10,20,99 (SW1'de önce encapsulation dot1q). Kontrol: show interfaces trunk",
        check: (q) => {
          const bad = [];
          for (const [a, ap, b, bp] of TRUNKS) {
            for (const [d, p] of [[a, ap], [b, bp]]) {
              const lp = q.port(d, p);
              const allowedOk = !!lp && lp.cfg.allowed !== null && [...lp.cfg.allowed].sort((x, y) => x - y).join(",") === "10,20,99";
              if (![10, 20, 99].every((v) => q.trunkAllows(d, p, v)) || !allowedOk) bad.push(`${d} ${p}`);
            }
          }
          return { ok: !bad.length, detail: bad.length ? "Sorunlu: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "native",
        title: "Tüm trunk'larda native VLAN 99, uyuşmazlık yok",
        hint: "switchport trunk native vlan 99 (Po1 üzerinde de). Uyuşmazlık syslog'da CDP-4-NATIVE_VLAN_MISMATCH olarak görünür.",
        check: (q) => {
          const trunks2 = q.trunks();
          if (!trunks2.length) return { ok: false, detail: "Henüz kurulu trunk yok" };
          const bad = trunks2.filter((t) => t.cfg.nativeVlan !== 99).map((t) => `${t.dev} ${t.name}`);
          const mm = q.nativeMismatches().length;
          return { ok: !bad.length && !mm && q.vlanExists("SW1", 99), detail: bad.length ? "Native ≠ 99: " + bad.join(", ") : mm ? "Native VLAN uyuşmazlığı var" : void 0 };
        }
      },
      {
        id: "po1",
        title: "SW1–SW2 arasında LACP Port-channel 1 kurulu (2 üye)",
        hint: "İki uçta da: interface range gi0/1 - 2 → channel-group 1 mode active (veya bir uç passive). Kontrol: show etherchannel summary",
        check: (q) => {
          const a = q.etherchannel("SW1", 1);
          const b = q.etherchannel("SW2", 1);
          const ok = !!a && !!b && a.up && b.up && a.protocol === "LACP" && a.bundled === 2 && b.bundled === 2;
          return { ok, detail: !ok && a && b ? `SW1 Po1: ${a.bundled} üye, SW2 Po1: ${b.bundled} üye` : void 0 };
        }
      },
      {
        id: "root",
        title: "SW1, VLAN 10 ve 20 için root bridge",
        hint: "SW1: spanning-tree vlan 10,20 priority 4096 (veya root primary). Varsayılan root, MAC adresi en düşük olan SW2.",
        check: (q) => {
          const r10 = q.stpRoot(10);
          const r20 = q.stpRoot(20);
          return { ok: r10 === "SW1" && r20 === "SW1", detail: `VLAN 10 root: ${r10 ?? "-"}, VLAN 20 root: ${r20 ?? "-"}` };
        }
      },
      {
        id: "ping10",
        title: "PC1 ↔ PC2 ping (VLAN 10)",
        hint: "PC1 konsolunda: ping 192.168.10.12",
        check: (q) => q.pcVlan("PC1") === 10 && q.pcVlan("PC2") === 10 && pingBoth4(q, "PC1", "PC2")
      },
      {
        id: "ping20",
        title: "PC3 ↔ PC4 ping (VLAN 20)",
        hint: "PC3 konsolunda: ping 192.168.20.12",
        check: (q) => q.pcVlan("PC3") === 20 && q.pcVlan("PC4") === 20 && pingBoth4(q, "PC3", "PC4")
      },
      {
        id: "intervlan",
        title: "VLAN'lar arası: PC1 ↔ PC4 ve PC3 ↔ PC2 ping",
        hint: "SW1: ip routing, interface vlan 10/20 + ip address. Kontrol: show ip route, show ip interface brief",
        check: (q) => q.pcVlan("PC1") === 10 && q.pcVlan("PC4") === 20 && pingBoth4(q, "PC1", "PC4") && pingBoth4(q, "PC3", "PC2")
      }
    ],
    solution: {
      SW1: `configure terminal
vlan 10
 name SATIS
vlan 20
 name MUHASEBE
vlan 99
 name NATIVE
exit
interface range gi0/1 - 2
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
 channel-group 1 mode active
exit
interface gi0/3
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
exit
spanning-tree vlan 10,20 priority 4096
ip routing
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
 no shutdown
interface vlan 20
 ip address 192.168.20.1 255.255.255.0
 no shutdown
end
write memory`,
      SW2: `configure terminal
vlan 10
 name SATIS
vlan 20
 name MUHASEBE
vlan 99
 name NATIVE
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
 channel-group 1 mode active
interface gi0/3
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
end
write memory`,
      SW3: `configure terminal
vlan 10
 name SATIS
vlan 20
 name MUHASEBE
vlan 99
 name NATIVE
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
end
write memory`
    }
  };
  var campus_l2_l3_default = lab4;

  // src/labs/stp-load-balancing.ts
  var ALL = ["DSW1", "DSW2", "ASW1", "ASW2"];
  var ACCESS = ["ASW1", "ASW2"];
  var pingBoth5 = (q, a, b) => q.ping(a, q.pcIp(b) ?? "0.0.0.0").ok && q.ping(b, q.pcIp(a) ?? "0.0.0.0").ok;
  var trunks = (list) => `interface range ${list}
 switchport mode trunk
 switchport trunk allowed vlan 10,20
exit`;
  var vlans = `vlan 10
 name SES
vlan 20
 name VERI
exit`;
  var lab5 = {
    id: "stp-yuk-dengeleme",
    title: "STP: root seçimi ve VLAN başına yük dengeleme",
    summary: "Yanlış switch root olmuş. Root ve yedek root'u VLAN başına ayarla, trafiği iki dağıtım switch'ine böl.",
    level: "Orta",
    tags: ["STP", "Rapid PVST+", "Root bridge", "Portfast"],
    brief: [
      "DSW1 ve DSW2 dağıtım, ASW1 ve ASW2 erişim switch'leri. Trunk'lar ve VLAN'lar hazır. Ağ çalışıyor ama MAC adresi en düşük olduğu için ASW1 her VLAN'da root bridge.",
      "Tüm switch'leri Rapid PVST+ moduna al.",
      "DSW1 VLAN 10 için root, VLAN 20 için yedek root olsun. DSW2 VLAN 20 için root, VLAN 10 için yedek root olsun.",
      "Sonuçta her erişim switch'i VLAN 10'u DSW1 uplink'inden (Gi0/1), VLAN 20'yi DSW2 uplink'inden (Gi0/2) iletmeli; diğer uplink o VLAN için bloklanmalı.",
      `Erişim switch'lerinde PC portlarına portfast aç. İpucu: yedek root ayarlamazsan tie-breaker MAC adresi olur ve yük dengeleme bozulabilir. "STP görünümü" ile VLAN seçip bloklanan portları izle.`
    ],
    view: { w: 820, h: 500 },
    devices: [
      { id: "DSW1", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0003.0010", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 230, y: 80 },
      { id: "DSW2", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0003.0011", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 590, y: 80 },
      { id: "ASW1", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0003.0001", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 150, y: 300 },
      { id: "ASW2", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0003.0002", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 670, y: 300 },
      { id: "PC1", kind: "pc", mac: "0050.7966.0301", x: 70, y: 450 },
      { id: "PC2", kind: "pc", mac: "0050.7966.0302", x: 250, y: 450 },
      { id: "PC3", kind: "pc", mac: "0050.7966.0303", x: 570, y: 450 },
      { id: "PC4", kind: "pc", mac: "0050.7966.0304", x: 750, y: 450 }
    ],
    links: [
      { a: ["DSW1", "GigabitEthernet0/1"], b: ["DSW2", "GigabitEthernet0/1"] },
      { a: ["DSW1", "GigabitEthernet0/2"], b: ["ASW1", "GigabitEthernet0/1"] },
      { a: ["DSW1", "GigabitEthernet0/3"], b: ["ASW2", "GigabitEthernet0/1"] },
      { a: ["DSW2", "GigabitEthernet0/2"], b: ["ASW1", "GigabitEthernet0/2"] },
      { a: ["DSW2", "GigabitEthernet0/3"], b: ["ASW2", "GigabitEthernet0/2"] },
      { a: ["PC1", "eth0"], b: ["ASW1", "FastEthernet0/1"] },
      { a: ["PC2", "eth0"], b: ["ASW1", "FastEthernet0/2"] },
      { a: ["PC3", "eth0"], b: ["ASW2", "FastEthernet0/1"] },
      { a: ["PC4", "eth0"], b: ["ASW2", "FastEthernet0/2"] }
    ],
    initialPcs: {
      PC1: { ip: "10.1.10.11", prefix: 24, gw: null },
      PC2: { ip: "10.1.20.11", prefix: 24, gw: null },
      PC3: { ip: "10.1.10.12", prefix: 24, gw: null },
      PC4: { ip: "10.1.20.12", prefix: 24, gw: null }
    },
    initialConfig: {
      DSW1: `${vlans}
${trunks("gi0/1 - 3")}`,
      DSW2: `${vlans}
${trunks("gi0/1 - 3")}`,
      ASW1: `${vlans}
${trunks("gi0/1 - 2")}
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
exit`,
      ASW2: `${vlans}
${trunks("gi0/1 - 2")}
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
exit`
    },
    objectives: [
      {
        id: "mode",
        title: "Dört switch de Rapid PVST+ modunda",
        hint: 'configure terminal → spanning-tree mode rapid-pvst. show spanning-tree → "protocol rstp"',
        check: (q) => {
          const bad = ALL.filter((s) => q.cfg(s).stpMode !== "rapid-pvst");
          return { ok: !bad.length, detail: bad.length ? "Hâlâ pvst: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "roots",
        title: "VLAN 10 root: DSW1, VLAN 20 root: DSW2",
        hint: "DSW1: spanning-tree vlan 10 root primary. DSW2: spanning-tree vlan 20 root primary.",
        check: (q) => {
          const r10 = q.stpRoot(10);
          const r20 = q.stpRoot(20);
          return { ok: r10 === "DSW1" && r20 === "DSW2", detail: `VLAN 10 root: ${r10 ?? "-"}, VLAN 20 root: ${r20 ?? "-"}` };
        }
      },
      {
        id: "secondary",
        title: "Yedek root: VLAN 10 için DSW2, VLAN 20 için DSW1",
        hint: "DSW2: spanning-tree vlan 10 root secondary (priority 28672). Yedek root, erişim switch'lerinden düşük priority'ye sahip olmalı.",
        check: (q) => {
          const second = (v, want, root) => {
            const p = q.bridgePriority(want, v);
            if (p === null) return false;
            return ALL.filter((s) => s !== want && s !== root).every((s) => (q.bridgePriority(s, v) ?? Infinity) > p);
          };
          return second(10, "DSW2", "DSW1") && second(20, "DSW1", "DSW2");
        }
      },
      {
        id: "balance",
        title: "Erişim switch'leri: VLAN 10 Gi0/1'den, VLAN 20 Gi0/2'den akıyor",
        hint: "show spanning-tree vlan 10 (ASW1'de): Gi0/1 Root FWD, Gi0/2 Altn BLK olmalı. VLAN 20 için tersi.",
        check: (q) => {
          const bad = [];
          for (const s of ACCESS) {
            if (q.stpState(s, "Gi0/1", 10) !== "FWD" || q.stpState(s, "Gi0/2", 10) !== "BLK") bad.push(`${s} v10`);
            if (q.stpState(s, "Gi0/2", 20) !== "FWD" || q.stpState(s, "Gi0/1", 20) !== "BLK") bad.push(`${s} v20`);
          }
          return { ok: !bad.length, detail: bad.length ? "Beklenmeyen: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "portfast",
        title: "ASW1 ve ASW2'de PC portlarında portfast açık",
        hint: "interface range fa0/1 - 2 → spanning-tree portfast",
        check: (q) => ACCESS.every((s) => ["Fa0/1", "Fa0/2"].every((p) => q.portCfg(s, p)?.portfast))
      },
      {
        id: "ping",
        title: "PC1 ↔ PC3 (VLAN 10) ve PC2 ↔ PC4 (VLAN 20) ping",
        hint: "STP değişikliği bağlantıyı koparmamalı. PC1 konsolunda: ping 10.1.10.12",
        check: (q) => pingBoth5(q, "PC1", "PC3") && pingBoth5(q, "PC2", "PC4")
      }
    ],
    solution: {
      DSW1: `configure terminal
spanning-tree mode rapid-pvst
spanning-tree vlan 10 root primary
spanning-tree vlan 20 root secondary
end
write memory`,
      DSW2: `configure terminal
spanning-tree mode rapid-pvst
spanning-tree vlan 20 root primary
spanning-tree vlan 10 root secondary
end
write memory`,
      ASW1: `configure terminal
spanning-tree mode rapid-pvst
interface range fa0/1 - 2
 spanning-tree portfast
end
write memory`,
      ASW2: `configure terminal
spanning-tree mode rapid-pvst
interface range fa0/1 - 2
 spanning-tree portfast
end
write memory`
    }
  };
  var stp_load_balancing_default = lab5;

  // src/labs/etherchannel-troubleshoot.ts
  var pingBoth6 = (q, a, b) => q.ping(a, q.pcIp(b) ?? "0.0.0.0").ok && q.ping(b, q.pcIp(a) ?? "0.0.0.0").ok;
  var vlans2 = `vlan 10
 name SATIS
vlan 20
 name DEPO
exit`;
  var accessPorts = `interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
exit`;
  var bundle = (q, a, b, id) => {
    const x = q.etherchannel(a, id);
    const y = q.etherchannel(b, id);
    return {
      ok: !!x && !!y && x.up && y.up && x.bundled === 2 && y.bundled === 2 && x.protocol === "LACP" && y.protocol === "LACP",
      detail: `${a} Po${id}: ${x ? `${x.protocol}, ${x.bundled} üye` : "yok"} · ${b} Po${id}: ${y ? `${y.protocol}, ${y.bundled} üye` : "yok"}`
    };
  };
  var lab6 = {
    id: "etherchannel-ariza",
    title: "Arıza bul: EtherChannel kurulmuyor",
    summary: "İki port-channel'ın hiçbiri kurulmamış. Mod, protokol ve üye config uyumsuzluklarını bul.",
    level: "Orta",
    tags: ["EtherChannel", "LACP", "PAgP", "Troubleshooting"],
    brief: [
      "SW1–SW2 arasındaki iki link Port-channel 1, SW1–SW3 arasındaki iki link Port-channel 2 olmalı. İkisi de LACP kullanmalı.",
      "PC'ler şu an birbirine ping atabiliyor, çünkü bundle kurulmayınca linkler tek tek trunk olarak çalışıyor. STP de her çiftte bir linki blokluyor, yani bant genişliğinin yarısı boşa gidiyor.",
      "Üç ayrı hata var. show etherchannel summary çıktısındaki bayraklara bak: (P) bundle'da, (I) tek başına, (s) askıya alınmış.",
      `Not: Bir gruptaki portların protokolü (LACP / PAgP) aynı olmalı. Protokolü değiştirmek için önce iki porttan da "no channel-group" ile çıkar. Üye portun config'i port-channel'ınkiyle aynı değilse port askıya alınır; port-channel arayüzündeki switchport komutları üyelere de uygulanır.`
    ],
    view: { w: 820, h: 480 },
    devices: [
      { id: "SW1", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0004.0001", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 410, y: 70 },
      { id: "SW2", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0004.0002", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 160, y: 300 },
      { id: "SW3", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0004.0003", ports: ports("Fa0/1-4", "Gi0/1-4"), x: 660, y: 300 },
      { id: "PC1", kind: "pc", mac: "0050.7966.0401", x: 70, y: 430 },
      { id: "PC3", kind: "pc", mac: "0050.7966.0403", x: 260, y: 430 },
      { id: "PC2", kind: "pc", mac: "0050.7966.0402", x: 560, y: 430 },
      { id: "PC4", kind: "pc", mac: "0050.7966.0404", x: 750, y: 430 }
    ],
    links: [
      { a: ["SW1", "GigabitEthernet0/1"], b: ["SW2", "GigabitEthernet0/1"] },
      { a: ["SW1", "GigabitEthernet0/2"], b: ["SW2", "GigabitEthernet0/2"] },
      { a: ["SW1", "GigabitEthernet0/3"], b: ["SW3", "GigabitEthernet0/1"] },
      { a: ["SW1", "GigabitEthernet0/4"], b: ["SW3", "GigabitEthernet0/2"] },
      { a: ["PC1", "eth0"], b: ["SW2", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["SW2", "FastEthernet0/2"] },
      { a: ["PC2", "eth0"], b: ["SW3", "FastEthernet0/1"] },
      { a: ["PC4", "eth0"], b: ["SW3", "FastEthernet0/2"] }
    ],
    initialPcs: {
      PC1: { ip: "10.4.10.11", prefix: 24, gw: null },
      PC2: { ip: "10.4.10.12", prefix: 24, gw: null },
      PC3: { ip: "10.4.20.11", prefix: 24, gw: null },
      PC4: { ip: "10.4.20.12", prefix: 24, gw: null }
    },
    initialConfig: {
      SW1: `${vlans2}
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 1 mode passive
interface range gi0/3 - 4
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 2 mode active
interface gi0/4
 switchport trunk allowed vlan 10
exit`,
      SW2: `${vlans2}
${accessPorts}
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 1 mode passive
exit`,
      SW3: `${vlans2}
${accessPorts}
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 2 mode desirable
exit`
    },
    objectives: [
      {
        id: "po1",
        title: "SW1–SW2: Port-channel 1 LACP ile kurulu (2 üye)",
        hint: "İki uç da passive ise LACP hiç başlamaz. En az bir uç active olmalı.",
        check: (q) => bundle(q, "SW1", "SW2", 1)
      },
      {
        id: "po2",
        title: "SW1–SW3: Port-channel 2 LACP ile kurulu (2 üye)",
        hint: "SW3 PAgP (desirable) kullanıyor, SW1 LACP. SW1'de Gi0/4'ün allowed listesi de farklı (show run interface gi0/4).",
        check: (q) => bundle(q, "SW1", "SW3", 2)
      },
      {
        id: "nostray",
        title: "Askıda (s) veya tek başına (I) üye port yok",
        hint: "Üç switch'te de show etherchannel summary → tüm üyeler (P) olmalı.",
        check: (q) => {
          const bad = Object.values(q.d.ec).flat().flatMap((g) => g.members.filter((m) => m.flag !== "P").map((m) => `${g.dev} ${m.port.replace("GigabitEthernet", "Gi")}(${m.flag})`));
          return { ok: !bad.length, detail: bad.length ? bad.join(", ") : void 0 };
        }
      },
      {
        id: "stp",
        title: "STP hiçbir uplink'i bloklamıyor (VLAN 10 ve 20)",
        hint: "Bundle kurulunca iki fiziksel link STP için tek mantıksal port olur. show spanning-tree vlan 10",
        check: (q) => [10, 20].every(
          (v) => [
            ["SW2", "Gi0/1"],
            ["SW2", "Gi0/2"],
            ["SW3", "Gi0/1"],
            ["SW3", "Gi0/2"]
          ].every(([s, p]) => q.stpState(s, p, v) === "FWD")
        )
      },
      {
        id: "ping",
        title: "PC1 ↔ PC2 (VLAN 10) ve PC3 ↔ PC4 (VLAN 20) ping",
        hint: "Trafik SW2 → Po1 → SW1 → Po2 → SW3 yolundan geçer.",
        check: (q) => pingBoth6(q, "PC1", "PC2") && pingBoth6(q, "PC3", "PC4")
      }
    ],
    solution: {
      SW1: `configure terminal
interface range gi0/1 - 2
 channel-group 1 mode active
interface port-channel 2
 switchport trunk allowed vlan 10,20
end
write memory`,
      SW3: `configure terminal
interface range gi0/1 - 2
 no channel-group
 channel-group 2 mode active
end
write memory`
    }
  };
  var etherchannel_troubleshoot_default = lab6;

  // src/labs/l3-static-routing.ts
  var pingBoth7 = (q, a, b) => q.ping(a, q.pcIp(b) ?? "0.0.0.0").ok && q.ping(b, q.pcIp(a) ?? "0.0.0.0").ok;
  var svi = (q, dev, vlan, addr, mask) => {
    const s = q.cfg(dev).svis[String(vlan)];
    return !!s?.ip && s.ip.addr === addr && s.ip.mask === mask && q.sviUp(dev, vlan);
  };
  var lab7 = {
    id: "l3-statik-route",
    title: "İki L3 switch arasında statik yönlendirme",
    summary: "İki çok katmanlı switch'i /30 transit VLAN ile bağla, SVI'ları kur ve statik + varsayılan rota ile uçtan uca ulaşım sağla.",
    level: "İleri",
    tags: ["L3 switch", "SVI", "Static route", "Default route"],
    brief: [
      "SW1 ve SW2 Catalyst 3560 (L3). İkisi de fabrika ayarında. PC'lerin IP ve gateway'leri hazır.",
      "SW1: VLAN 10 (PC1) ve VLAN 100 (TRANSIT). Vlan10 = 192.168.10.1/24, Vlan100 = 10.0.100.1/30.",
      "SW2: VLAN 20 (PC2), VLAN 30 (PC3) ve VLAN 100. Vlan20 = 192.168.20.1/24, Vlan30 = 172.16.30.1/24, Vlan100 = 10.0.100.2/30.",
      "Gi0/1 transit linki iki uçta VLAN 100'de access port olsun. İki switch'te de ip routing açık olsun.",
      "Rotalar: SW1 uzak ağların hepsine tek bir varsayılan rota (0.0.0.0/0) ile gitsin. SW2, 192.168.10.0/24 için statik rota kullansın. Kontrol: show ip route, PC'den trace."
    ],
    view: { w: 820, h: 440 },
    devices: [
      { id: "SW1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0005.0001", ports: ports("Fa0/1-4", "Gi0/1-2"), l3: true, needsEncap: true, x: 240, y: 130 },
      { id: "SW2", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0005.0002", ports: ports("Fa0/1-4", "Gi0/1-2"), l3: true, needsEncap: true, x: 580, y: 130 },
      { id: "PC1", kind: "pc", mac: "0050.7966.0501", x: 240, y: 360 },
      { id: "PC2", kind: "pc", mac: "0050.7966.0502", x: 480, y: 360 },
      { id: "PC3", kind: "pc", mac: "0050.7966.0503", x: 690, y: 360 }
    ],
    links: [
      { a: ["SW1", "GigabitEthernet0/1"], b: ["SW2", "GigabitEthernet0/1"] },
      { a: ["PC1", "eth0"], b: ["SW1", "FastEthernet0/1"] },
      { a: ["PC2", "eth0"], b: ["SW2", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["SW2", "FastEthernet0/2"] }
    ],
    initialPcs: {
      PC1: { ip: "192.168.10.10", prefix: 24, gw: "192.168.10.1" },
      PC2: { ip: "192.168.20.10", prefix: 24, gw: "192.168.20.1" },
      PC3: { ip: "172.16.30.10", prefix: 24, gw: "172.16.30.1" }
    },
    objectives: [
      {
        id: "routing",
        title: "İki switch'te de ip routing açık",
        hint: "configure terminal → ip routing. Kapalıyken switch yalnızca kendi SVI'larına cevap verir, yönlendirme yapmaz.",
        check: (q) => q.cfg("SW1").ipRouting && q.cfg("SW2").ipRouting
      },
      {
        id: "svis",
        title: "Tüm SVI'lar doğru adresle up/up",
        hint: "SVI'ın up olması için VLAN'ın var olması ve o VLAN'da aktif bir port bulunması gerekir. show ip interface brief",
        check: (q) => {
          const want = [
            ["SW1", 10, "192.168.10.1", "255.255.255.0"],
            ["SW1", 100, "10.0.100.1", "255.255.255.252"],
            ["SW2", 20, "192.168.20.1", "255.255.255.0"],
            ["SW2", 30, "172.16.30.1", "255.255.255.0"],
            ["SW2", 100, "10.0.100.2", "255.255.255.252"]
          ];
          const bad = want.filter(([d, v, a, m]) => !svi(q, d, v, a, m)).map(([d, v]) => `${d} Vlan${v}`);
          return { ok: !bad.length, detail: bad.length ? "Eksik/down: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "transit",
        title: "SW1, transit üzerinden 10.0.100.2'ye ping atabiliyor",
        hint: "Gi0/1 iki uçta: switchport mode access + switchport access vlan 100. SW1'de: ping 10.0.100.2",
        check: (q) => q.ping("SW1", "10.0.100.2").ok
      },
      {
        id: "default",
        title: "SW1'de varsayılan rota 10.0.100.2'ye, SW2'de 192.168.10.0/24 statik rotası var",
        hint: "SW1: ip route 0.0.0.0 0.0.0.0 10.0.100.2. SW2: ip route 192.168.10.0 255.255.255.0 10.0.100.1",
        check: (q) => q.cfg("SW1").routes.some((r) => r.net === "0.0.0.0" && r.mask === "0.0.0.0" && r.nh === "10.0.100.2") && q.cfg("SW2").routes.some((r) => r.net === "192.168.10.0" && r.mask === "255.255.255.0" && r.nh === "10.0.100.1")
      },
      {
        id: "local",
        title: "SW2 üzerinde PC2 ↔ PC3 ping (VLAN'lar arası)",
        hint: "Aynı switch'teki iki SVI arasında yönlendirme için ip routing yeterli.",
        check: (q) => pingBoth7(q, "PC2", "PC3")
      },
      {
        id: "e2e",
        title: "PC1 ↔ PC2 ve PC1 ↔ PC3 ping (iki router üzerinden)",
        hint: "Dönüş yolunu unutma: SW2 192.168.10.0/24'e nasıl gideceğini bilmeli. PC1'de: trace 172.16.30.10",
        check: (q) => pingBoth7(q, "PC1", "PC2") && pingBoth7(q, "PC1", "PC3")
      }
    ],
    solution: {
      SW1: `configure terminal
ip routing
vlan 10
 name LAN10
vlan 100
 name TRANSIT
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface gi0/1
 switchport mode access
 switchport access vlan 100
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
interface vlan 100
 ip address 10.0.100.1 255.255.255.252
exit
ip route 0.0.0.0 0.0.0.0 10.0.100.2
end
write memory`,
      SW2: `configure terminal
ip routing
vlan 20
 name LAN20
vlan 30
 name LAN30
vlan 100
 name TRANSIT
exit
interface fa0/1
 switchport mode access
 switchport access vlan 20
interface fa0/2
 switchport mode access
 switchport access vlan 30
interface gi0/1
 switchport mode access
 switchport access vlan 100
interface vlan 20
 ip address 192.168.20.1 255.255.255.0
interface vlan 30
 ip address 172.16.30.1 255.255.255.0
interface vlan 100
 ip address 10.0.100.2 255.255.255.252
exit
ip route 192.168.10.0 255.255.255.0 10.0.100.1
end
write memory`
    }
  };
  var l3_static_routing_default = lab7;

  // src/labs/mgmt-vlan.ts
  var MGMT = { ASW1: "192.168.99.11", ASW2: "192.168.99.12" };
  var mgmtUp = (q, dev) => {
    const s = q.cfg(dev).svis["99"];
    return !!s?.ip && s.ip.addr === MGMT[dev] && s.ip.mask === "255.255.255.0" && q.sviUp(dev, 99);
  };
  var lab8 = {
    id: "yonetim-vlan",
    title: "Switch yönetimi: hostname, yönetim VLAN'ı, varsayılan ağ geçidi",
    summary: "İki erişim switch'ine isim ver, VLAN 99 üzerinden yönetim IP'si ata, ip default-gateway ile başka VLAN'dan erişilebilir yap ve kaydet.",
    level: "Başlangıç",
    tags: ["CCNA", "Yönetim SVI", "Default gateway", "copy run start"],
    brief: [
      "CORE (Catalyst 3560) hazır: VLAN 10 (KULLANICI) ve VLAN 99 (YONETIM) arasında yönlendirme yapıyor. Vlan10 = 192.168.10.1/24, Vlan99 = 192.168.99.1/24. Switch'ler arası trunk'lar kurulu.",
      `İki erişim switch'i fabrikadan yeni çıkmış gibi "Switch" adıyla geliyor. Hostname'lerini ASW1 ve ASW2 yap.`,
      "Her erişim switch'inde VLAN 99'u YONETIM adıyla oluştur ve interface vlan 99'a yönetim adresi ver: ASW1 = 192.168.99.11/24, ASW2 = 192.168.99.12/24.",
      "Bir L2 switch yönlendirme yapmaz. Başka bir VLAN'daki yöneticiye cevap verebilmesi için ip default-gateway 192.168.99.1 gerekir.",
      "Kontrol: PC1 (VLAN 10) iki switch'in yönetim adresine ping atabilsin. Bitirince yapılandırmayı NVRAM'e kaydet (copy running-config startup-config)."
    ],
    view: { w: 860, h: 470 },
    devices: [
      { id: "CORE", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0020.0001", ports: ports("Fa0/1-4", "Gi0/1-2"), l3: true, needsEncap: true, x: 430, y: 80 },
      { id: "ASW1", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0020.0011", ports: ports("Fa0/1-4", "Gi0/1-2"), x: 230, y: 250 },
      { id: "ASW2", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0020.0012", ports: ports("Fa0/1-4", "Gi0/1-2"), x: 630, y: 250 },
      { id: "PC1", kind: "pc", mac: "0050.7966.2001", x: 230, y: 410 },
      { id: "PC2", kind: "pc", mac: "0050.7966.2002", x: 630, y: 410 }
    ],
    links: [
      { a: ["CORE", "GigabitEthernet0/1"], b: ["ASW1", "GigabitEthernet0/1"] },
      { a: ["CORE", "GigabitEthernet0/2"], b: ["ASW2", "GigabitEthernet0/1"] },
      { a: ["PC1", "eth0"], b: ["ASW1", "FastEthernet0/1"] },
      { a: ["PC2", "eth0"], b: ["ASW2", "FastEthernet0/1"] }
    ],
    initialConfig: {
      CORE: `ip routing
vlan 10
 name KULLANICI
vlan 99
 name YONETIM
exit
interface range gi0/1 - 2
 switchport trunk encapsulation dot1q
 switchport mode trunk
exit
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
interface vlan 99
 ip address 192.168.99.1 255.255.255.0
exit`,
      ASW1: `hostname Switch
vlan 10
 name KULLANICI
exit
interface gi0/1
 switchport mode trunk
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit`,
      ASW2: `hostname Switch
vlan 10
 name KULLANICI
exit
interface gi0/1
 switchport mode trunk
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit`
    },
    initialPcs: {
      PC1: { ip: "192.168.10.10", prefix: 24, gw: "192.168.10.1" },
      PC2: { ip: "192.168.10.20", prefix: 24, gw: "192.168.10.1" }
    },
    objectives: [
      {
        id: "hostname",
        title: "Erişim switch'lerinin adı ASW1 ve ASW2",
        hint: "configure terminal → hostname ASW1. Prompt hemen değişir.",
        check: (q) => q.hostname("ASW1") === "ASW1" && q.hostname("ASW2") === "ASW2"
      },
      {
        id: "vlan99",
        title: "VLAN 99 iki erişim switch'inde YONETIM adıyla var",
        hint: "vlan 99 → name YONETIM. VLAN yoksa interface vlan 99 hiçbir zaman up olmaz.",
        check: (q) => ["ASW1", "ASW2"].every((d) => q.vlanName(d, 99) === "YONETIM")
      },
      {
        id: "svi",
        title: "Yönetim SVI'ları doğru adresle up/up",
        hint: "interface vlan 99 → ip address 192.168.99.11 255.255.255.0. Kontrol: show ip interface brief",
        check: (q) => {
          const bad = ["ASW1", "ASW2"].filter((d) => !mgmtUp(q, d));
          return { ok: !bad.length, detail: bad.length ? "Eksik/down: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "local",
        title: "CORE, iki switch'in yönetim adresine ping atabiliyor",
        hint: "Aynı VLAN içinde gateway gerekmez. Burada sorun varsa trunk'ın VLAN 99'u taşıdığını kontrol et: show interfaces trunk",
        check: (q) => q.ping("CORE", MGMT.ASW1).ok && q.ping("CORE", MGMT.ASW2).ok
      },
      {
        id: "gateway",
        title: "PC1 (VLAN 10), ASW1 ve ASW2'ye ping atabiliyor",
        hint: `Switch cevabı başka bir ağa göndermek zorunda: ip default-gateway 192.168.99.1. Kontrol: show ip route (L2 switch'te "Default gateway is ..." yazar)`,
        check: (q) => q.ping("PC1", MGMT.ASW1).ok && q.ping("PC1", MGMT.ASW2).ok
      },
      {
        id: "saved",
        title: "Yapılandırma iki switch'te de kaydedildi",
        hint: "copy running-config startup-config (veya write memory). Kayıttan sonra yaptığın her değişiklik tekrar kaydedilmeli.",
        check: (q) => ["ASW1", "ASW2"].every((d) => q.saved(d) && mgmtUp(q, d) && !!q.cfg(d).defaultGateway)
      }
    ],
    solution: {
      ASW1: `configure terminal
hostname ASW1
vlan 99
 name YONETIM
exit
interface vlan 99
 ip address 192.168.99.11 255.255.255.0
 no shutdown
exit
ip default-gateway 192.168.99.1
end
copy running-config startup-config
`,
      ASW2: `configure terminal
hostname ASW2
vlan 99
 name YONETIM
exit
interface vlan 99
 ip address 192.168.99.12 255.255.255.0
 no shutdown
exit
ip default-gateway 192.168.99.1
end
copy running-config startup-config
`
    }
  };
  var mgmt_vlan_default = lab8;

  // src/labs/ospf-single-area.ts
  var R = ["R1", "R2", "R3"];
  var RID = { R1: "1.1.1.1", R2: "2.2.2.2", R3: "3.3.3.3" };
  var PCS = ["PC1", "PC2", "PC3"];
  var pingAll = (q) => {
    for (const a of PCS) for (const b of PCS) if (a !== b && !q.ping(a, q.pcIp(b) ?? "0.0.0.0").ok) return `${a} → ${b}`;
    return null;
  };
  var lan = (n) => `interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
vlan 10
 name LAN
exit
interface vlan 10
 ip address 192.168.${n}.1 255.255.255.0
exit`;
  var lab9 = {
    id: "ospf-tek-alan",
    title: "Tek alanlı OSPF: routed linkler, router ID, passive-interface",
    summary: "Üç L3 switch'i /30 routed portlarla üçgen şeklinde bağla, loopback'lerden router ID ver, area 0'da OSPF kur ve LAN'ları passive yap.",
    level: "Orta",
    tags: ["CCNA", "OSPF", "Routed port", "Loopback", "Passive interface"],
    brief: [
      "R1, R2, R3 birer Catalyst 3560 ve ip routing açık. Her birinin LAN'ı hazır: VLAN 10, Vlan10 = 192.168.N.1/24 (N = 1, 2, 3).",
      "Aradaki linkleri switchport değil routed port yap (no switchport) ve /30 adres ver. R1–R2 Gi0/1: 10.0.12.0/30, R1 Gi0/2–R3 Gi0/1: 10.0.13.0/30, R2 Gi0/2–R3 Gi0/2: 10.0.23.0/30. Küçük numaralı router .1 alsın.",
      "Her router'a Loopback0 ekle: 1.1.1.1/32, 2.2.2.2/32, 3.3.3.3/32. OSPF router ID'leri bu adresler olsun (router-id ile ya da loopback'ten seçilerek).",
      "router ospf 1 altında bütün arayüzleri area 0'a al. LAN arayüzlerinde (Vlan10) hello gönderilmesin: passive-interface.",
      "Kontrol: show ip ospf neighbor, show ip route ospf, show ip protocols. Loopback'ler /32 olarak öğrenilir."
    ],
    view: { w: 880, h: 520 },
    devices: [
      { id: "R1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0030.0001", ports: ports("Fa0/1-4", "Gi0/1-2"), l3: true, needsEncap: true, x: 440, y: 90 },
      { id: "R2", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0030.0002", ports: ports("Fa0/1-4", "Gi0/1-2"), l3: true, needsEncap: true, x: 210, y: 300 },
      { id: "R3", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0030.0003", ports: ports("Fa0/1-4", "Gi0/1-2"), l3: true, needsEncap: true, x: 670, y: 300 },
      { id: "PC1", kind: "pc", mac: "0050.7966.3001", x: 700, y: 70 },
      { id: "PC2", kind: "pc", mac: "0050.7966.3002", x: 210, y: 470 },
      { id: "PC3", kind: "pc", mac: "0050.7966.3003", x: 670, y: 470 }
    ],
    links: [
      { a: ["R1", "GigabitEthernet0/1"], b: ["R2", "GigabitEthernet0/1"] },
      { a: ["R1", "GigabitEthernet0/2"], b: ["R3", "GigabitEthernet0/1"] },
      { a: ["R2", "GigabitEthernet0/2"], b: ["R3", "GigabitEthernet0/2"] },
      { a: ["PC1", "eth0"], b: ["R1", "FastEthernet0/1"] },
      { a: ["PC2", "eth0"], b: ["R2", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["R3", "FastEthernet0/1"] }
    ],
    initialConfig: {
      R1: "ip routing\n" + lan(1),
      R2: "ip routing\n" + lan(2),
      R3: "ip routing\n" + lan(3)
    },
    initialPcs: {
      PC1: { ip: "192.168.1.10", prefix: 24, gw: "192.168.1.1" },
      PC2: { ip: "192.168.2.10", prefix: 24, gw: "192.168.2.1" },
      PC3: { ip: "192.168.3.10", prefix: 24, gw: "192.168.3.1" }
    },
    objectives: [
      {
        id: "links",
        title: "Üç /30 routed link çalışıyor (komşu adresine ping)",
        hint: "interface gi0/1 → no switchport → ip address 10.0.12.1 255.255.255.252. Kontrol: show ip interface brief, ping 10.0.12.2",
        check: (q) => {
          const pairs = [["R1", "10.0.12.2"], ["R1", "10.0.13.2"], ["R2", "10.0.23.2"]];
          const bad = pairs.filter(([d, ip2]) => !q.ping(d, ip2).ok).map(([d, ip2]) => `${d}→${ip2}`);
          return { ok: !bad.length, detail: bad.length ? "Ping yok: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "rid",
        title: "Router ID'ler 1.1.1.1, 2.2.2.2, 3.3.3.3",
        hint: 'Router ID OSPF süreci başlarken seçilir. Sonradan değiştirirsen komşuluk varken "clear ip ospf process" gerekir. Kontrol: show ip protocols',
        check: (q) => {
          const bad = R.filter((d) => q.ospf(d)?.rid !== RID[d]).map((d) => `${d}=${q.ospf(d)?.rid ?? "yok"}`);
          return { ok: !bad.length, detail: bad.length ? bad.join(", ") : void 0 };
        }
      },
      {
        id: "adj",
        title: "Üç OSPF komşuluğu FULL",
        hint: "network 10.0.0.0 0.255.255.255 area 0 gibi bir ifade linkleri OSPF'e alır. Kontrol: show ip ospf neighbor",
        check: (q) => q.ospfAdjacent("R1", "R2") && q.ospfAdjacent("R1", "R3") && q.ospfAdjacent("R2", "R3")
      },
      {
        id: "passive",
        title: "LAN arayüzleri OSPF'te ama passive",
        hint: "router ospf 1 → passive-interface vlan 10. Passive arayüz hello göndermez ama ağı yine de ilan edilir. Kontrol: show ip ospf interface vlan 10",
        check: (q) => R.every((d) => q.ospf(d)?.ifs.some((i) => i.name === "Vlan10" && i.passive && i.area === 0) ?? false)
      },
      {
        id: "loop",
        title: "R1, diğer router'ların loopback'lerini /32 olarak OSPF'ten öğrendi",
        hint: "Loopback0 da bir network ifadesiyle eşleşmeli (ör. network 2.2.2.2 0.0.0.0 area 0). Kontrol: show ip route ospf",
        check: (q) => ["2.2.2.2", "3.3.3.3"].every((ip2) => q.route("R1", ip2, 32)?.code === "O")
      },
      {
        id: "e2e",
        title: "Bütün PC'ler birbirine ping atabiliyor",
        hint: "Her LAN diğer iki router'da O olarak görünmeli. PC'de: trace 192.168.3.10",
        check: (q) => {
          const bad = pingAll(q);
          return { ok: !bad, detail: bad ? "Ping yok: " + bad : void 0 };
        }
      }
    ],
    solution: {
      R1: `configure terminal
interface loopback 0
 ip address 1.1.1.1 255.255.255.255
interface gi0/1
 no switchport
 ip address 10.0.12.1 255.255.255.252
interface gi0/2
 no switchport
 ip address 10.0.13.1 255.255.255.252
exit
router ospf 1
 router-id 1.1.1.1
 network 10.0.0.0 0.255.255.255 area 0
 network 192.168.1.0 0.0.0.255 area 0
 network 1.1.1.1 0.0.0.0 area 0
 passive-interface vlan 10
end
write memory`,
      R2: `configure terminal
interface loopback 0
 ip address 2.2.2.2 255.255.255.255
interface gi0/1
 no switchport
 ip address 10.0.12.2 255.255.255.252
interface gi0/2
 no switchport
 ip address 10.0.23.1 255.255.255.252
exit
router ospf 1
 router-id 2.2.2.2
 network 10.0.0.0 0.255.255.255 area 0
 network 192.168.2.0 0.0.0.255 area 0
 network 2.2.2.2 0.0.0.0 area 0
 passive-interface vlan 10
end
write memory`,
      R3: `configure terminal
interface loopback 0
 ip address 3.3.3.3 255.255.255.255
interface gi0/1
 no switchport
 ip address 10.0.13.2 255.255.255.252
interface gi0/2
 no switchport
 ip address 10.0.23.2 255.255.255.252
exit
router ospf 1
 router-id 3.3.3.3
 network 10.0.0.0 0.255.255.255 area 0
 network 192.168.3.0 0.0.0.255 area 0
 network 3.3.3.3 0.0.0.0 area 0
 passive-interface vlan 10
end
write memory`
    }
  };
  var ospf_single_area_default = lab9;

  // src/labs/routed-access.ts
  var UPLINKS = [
    // dist, dist port, access, access port, /30 network (dist .1, access .2)
    ["DSW1", "Gi0/1", "ASW1", "Gi0/1", "10.1.11"],
    ["DSW2", "Gi0/1", "ASW1", "Gi0/2", "10.1.21"],
    ["DSW1", "Gi0/2", "ASW2", "Gi0/1", "10.1.12"],
    ["DSW2", "Gi0/2", "ASW2", "Gi0/2", "10.1.22"]
  ];
  var ALL2 = ["DSW1", "DSW2", "ASW1", "ASW2"];
  var routedIf = (port, ip2) => `interface ${port}
 no switchport
 ip address ${ip2} 255.255.255.252
 ip ospf network point-to-point`;
  var solutionFor = (dev) => {
    const lines = ["configure terminal"];
    for (const [d, dp, a, ap, net] of UPLINKS) {
      if (d === dev) lines.push(routedIf(dp, net + ".1"));
      if (a === dev) lines.push(routedIf(ap, net + ".2"));
    }
    if (dev === "DSW1" || dev === "DSW2") {
      lines.push(routedIf("Gi0/3", dev === "DSW1" ? "10.1.0.1" : "10.1.0.2"), "exit");
      if (dev === "DSW1") lines.push("no interface vlan 10", "no interface vlan 20");
      lines.push("no vlan 10,20");
    } else {
      const v = dev === "ASW1" ? 10 : 20;
      lines.push("exit", `interface vlan ${v}`, ` ip address 192.168.${v}.1 255.255.255.0`, "exit");
    }
    const rid = { DSW1: "10.255.0.1", DSW2: "10.255.0.2", ASW1: "10.255.0.11", ASW2: "10.255.0.12" }[dev];
    lines.push("router ospf 1", ` router-id ${rid}`, " network 10.1.0.0 0.0.255.255 area 0");
    if (dev.startsWith("ASW")) lines.push(` network 192.168.${dev === "ASW1" ? 10 : 20}.0 0.0.0.255 area 0`, ` passive-interface vlan ${dev === "ASW1" ? 10 : 20}`);
    lines.push("end", "write memory");
    return lines.join("\n");
  };
  var trunk = (list) => `interface range ${list}
 switchport trunk encapsulation dot1q
 switchport mode trunk
exit`;
  var lab10 = {
    id: "routed-erisim-blogu",
    title: "Tamamen routed switch bloğu (L3 erişim katmanı)",
    summary: "Klasik L2 dağıtım bloğunu, erişim switch'lerinin kendi VLAN'larına gateway olduğu, STP'nin port bloklamadığı ve OSPF'in iki uplink'i birlikte kullandığı routed bir bloğa dönüştür.",
    level: "İleri",
    tags: ["ENCOR", "Kampüs tasarımı", "Routed port", "OSPF", "ECMP"],
    brief: [
      "Mevcut tasarım klasik L2 bloğu: VLAN 10 ve 20 dört switch'e de yayılmış, bütün linkler trunk, gateway'ler DSW1'deki SVI'lar. STP her VLAN'da bir uplink'i blokluyor; uplink'lerin yarısı boşta.",
      `Hedef, PDF'teki "A Completely Routed Switch Block" tasarımı: dört switch arasındaki her link /30 routed port olsun ve hiçbir VLAN erişim switch'inin dışına çıkmasın.`,
      "Adresleme: DSWn Gi0/x tarafı .1, erişim tarafı .2 alsın. DSW1–ASW1 10.1.11.0/30, DSW2–ASW1 10.1.21.0/30, DSW1–ASW2 10.1.12.0/30, DSW2–ASW2 10.1.22.0/30, DSW1–DSW2 (Gi0/3) 10.1.0.0/30 (DSW1 .1).",
      "Gateway'ler erişim katmanına taşınsın: ASW1 Vlan10 = 192.168.10.1/24, ASW2 Vlan20 = 192.168.20.1/24. DSW1'deki eski SVI'ları ve dağıtım switch'lerindeki VLAN 10/20'yi kaldır.",
      "OSPF area 0. Router ID'ler: DSW1 10.255.0.1, DSW2 10.255.0.2, ASW1 10.255.0.11, ASW2 10.255.0.12. İki router'lık linklerde DR/BDR seçimi gereksiz: ip ospf network point-to-point. LAN SVI'ları passive.",
      "Sonuç: her erişim switch'i karşı LAN'a iki eşit maliyetli yol görmeli (ECMP). Kontrol: show ip route 192.168.20.0, show spanning-tree, show ip ospf neighbor."
    ],
    view: { w: 900, h: 560 },
    devices: [
      { id: "DSW1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0040.0001", ports: ports("Fa0/1-2", "Gi0/1-3"), l3: true, needsEncap: true, x: 260, y: 90 },
      { id: "DSW2", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0040.0002", ports: ports("Fa0/1-2", "Gi0/1-3"), l3: true, needsEncap: true, x: 640, y: 90 },
      { id: "ASW1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0040.0011", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 260, y: 330 },
      { id: "ASW2", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0040.0012", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 640, y: 330 },
      { id: "PC1", kind: "pc", mac: "0050.7966.4001", x: 260, y: 500 },
      { id: "PC2", kind: "pc", mac: "0050.7966.4002", x: 640, y: 500 }
    ],
    links: [
      { a: ["DSW1", "GigabitEthernet0/1"], b: ["ASW1", "GigabitEthernet0/1"] },
      { a: ["DSW2", "GigabitEthernet0/1"], b: ["ASW1", "GigabitEthernet0/2"] },
      { a: ["DSW1", "GigabitEthernet0/2"], b: ["ASW2", "GigabitEthernet0/1"] },
      { a: ["DSW2", "GigabitEthernet0/2"], b: ["ASW2", "GigabitEthernet0/2"] },
      { a: ["DSW1", "GigabitEthernet0/3"], b: ["DSW2", "GigabitEthernet0/3"] },
      { a: ["PC1", "eth0"], b: ["ASW1", "FastEthernet0/1"] },
      { a: ["PC2", "eth0"], b: ["ASW2", "FastEthernet0/1"] }
    ],
    initialConfig: {
      DSW1: `ip routing
vlan 10,20
exit
spanning-tree vlan 10,20 root primary
${trunk("gi0/1 - 3")}
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
interface vlan 20
 ip address 192.168.20.1 255.255.255.0
exit`,
      DSW2: `ip routing
vlan 10,20
exit
${trunk("gi0/1 - 3")}`,
      ASW1: `ip routing
vlan 10,20
exit
${trunk("gi0/1 - 2")}
interface fa0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
exit`,
      ASW2: `ip routing
vlan 10,20
exit
${trunk("gi0/1 - 2")}
interface fa0/1
 switchport mode access
 switchport access vlan 20
 spanning-tree portfast
exit`
    },
    initialPcs: {
      PC1: { ip: "192.168.10.10", prefix: 24, gw: "192.168.10.1" },
      PC2: { ip: "192.168.20.10", prefix: 24, gw: "192.168.20.1" }
    },
    objectives: [
      {
        id: "routed",
        title: "Blok içindeki bütün linkler routed port",
        hint: "interface gi0/1 → no switchport → ip address … 255.255.255.252. Trunk kalan link VLAN'ı dağıtıma taşımaya devam eder.",
        check: (q) => {
          const ends = [...UPLINKS.flatMap(([d, dp, a, ap]) => [[d, dp], [a, ap]]), ["DSW1", "Gi0/3"], ["DSW2", "Gi0/3"]];
          const bad = ends.filter(([dev, p]) => !q.portCfg(dev, p)?.routed || !q.portCfg(dev, p)?.ip).map(([dev, p]) => `${dev} ${p}`);
          return { ok: !bad.length, detail: bad.length ? "L2 ya da IP'siz: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "novlan",
        title: "VLAN 10/20 dağıtıma yayılmıyor, gateway'ler erişim switch'inde",
        hint: "DSW1: no interface vlan 10, no interface vlan 20, no vlan 10,20 (DSW2'de de). ASW1'de interface vlan 10, ASW2'de interface vlan 20.",
        check: (q) => ["DSW1", "DSW2"].every((d) => !q.vlanExists(d, 10) && !q.vlanExists(d, 20)) && q.cfg("ASW1").svis["10"]?.ip?.addr === "192.168.10.1" && q.sviUp("ASW1", 10) && q.cfg("ASW2").svis["20"]?.ip?.addr === "192.168.20.1" && q.sviUp("ASW2", 20)
      },
      {
        id: "nostp",
        title: "STP hiçbir portu bloklamıyor",
        hint: "Routed portlar STP'ye katılmaz; döngü L3'te OSPF tarafından çözülür. Kontrol: show spanning-tree",
        check: (q) => {
          const blk = [];
          for (const [v, bridges] of Object.entries(q.d.stp))
            for (const [dev, b] of Object.entries(bridges))
              for (const [p, st] of Object.entries(b.ports)) if (st.state !== "FWD") blk.push(`${dev} ${p} (VLAN ${v})`);
          return { ok: !blk.length, detail: blk.length ? "Bloklu: " + blk.join(", ") : void 0 };
        }
      },
      {
        id: "p2p",
        title: "Beş OSPF komşuluğu FULL, hepsi point-to-point (DR/BDR yok)",
        hint: `Her routed linkte iki uçta: ip ospf network point-to-point. show ip ospf neighbor'da durum "FULL/  -" olmalı.`,
        check: (q) => {
          const pairs = [["DSW1", "DSW2"], ...UPLINKS.map(([d, , a]) => [d, a])];
          const bad = pairs.filter(([a, b]) => !q.ospfAdjacent(a, b)).map(([a, b]) => `${a}–${b}`);
          const dr = ALL2.flatMap((d) => q.ospfFull(d).filter((n) => n.role !== "-").map((n) => `${d} ${n.ifname}`));
          if (bad.length) return { ok: false, detail: "Komşuluk yok: " + bad.join(", ") };
          return { ok: !dr.length, detail: dr.length ? "Hâlâ broadcast: " + dr.join(", ") : void 0 };
        }
      },
      {
        id: "rid",
        title: "Router ID'ler plana uygun",
        hint: "router ospf 1 → router-id 10.255.0.11. Komşuluk kurulduktan sonra değiştirirsen: clear ip ospf process",
        check: (q) => {
          const want = { DSW1: "10.255.0.1", DSW2: "10.255.0.2", ASW1: "10.255.0.11", ASW2: "10.255.0.12" };
          const bad = ALL2.filter((d) => q.ospf(d)?.rid !== want[d]).map((d) => `${d}=${q.ospf(d)?.rid ?? "yok"}`);
          return { ok: !bad.length, detail: bad.length ? bad.join(", ") : void 0 };
        }
      },
      {
        id: "ecmp",
        title: "Erişim switch'leri karşı LAN'a iki eşit maliyetli yol görüyor",
        hint: 'İki uplink aynı maliyette olmalı. Kontrol: show ip route 192.168.20.0 → iki "via" satırı.',
        check: (q) => (q.route("ASW1", "192.168.20.0", 24)?.paths?.length ?? 0) >= 2 && (q.route("ASW2", "192.168.10.0", 24)?.paths?.length ?? 0) >= 2
      },
      {
        id: "e2e",
        title: "PC1 ↔ PC2 ping",
        hint: "LAN'lar OSPF'e alınmalı (network 192.168.10.0 0.0.0.255 area 0) ve passive olmalı.",
        check: (q) => q.ping("PC1", "192.168.20.10").ok && q.ping("PC2", "192.168.10.10").ok && q.route("ASW1", "192.168.20.0", 24)?.code === "O"
      }
    ],
    solution: Object.fromEntries(ALL2.map((d) => [d, solutionFor(d)]))
  };
  var routed_access_default = lab10;

  // src/labs/bpdu-guard.ts
  var EDGE = ["Fa0/1", "Fa0/2", "Fa0/3"];
  var lab11 = {
    id: "bpdu-guard",
    title: "BPDU Guard, err-disable ve otomatik kurtarma",
    summary: "Kullanıcı portuna takılan sahte bir switch root bridge'i ele geçirmiş, uplink'lerden biri yanlış koruma yüzünden err-disabled. Kenar portları koru, uplink'i kurtar, otomatik recovery kur.",
    level: "Orta",
    tags: ["ENCOR", "STP", "PortFast", "BPDU Guard", "err-disable"],
    brief: [
      "DSW1 dağıtım switch'i VLAN 10'un root bridge'i olmalı (priority 4096). ASW1'e iki uplink ile bağlı. PC1 ve PC2 ASW1'in Fa0/1–2 portlarında.",
      "Bir kullanıcı Fa0/3'e kendi küçük switch'ini (ROGUE) takmış. ROGUE VLAN 10 için priority 0 ile geliyor ve root bridge oldu; bütün VLAN 10 trafiği artık onun üzerinden hesaplanıyor.",
      "Önceki bir değişiklikte ASW1 Gi0/2 uplink'ine yanlışlıkla PortFast ve BPDU Guard yazılmış. Port DSW1'den BPDU aldığı için err-disabled.",
      `Görevler: ASW1'de Fa0/1–3 kenar portları PortFast + BPDU Guard ile korunsun (port başına ya da "spanning-tree portfast bpduguard default" ile). ROGUE'un portu err-disable olmalı, DSW1 tekrar root olmalı.`,
      "Gi0/2'den PortFast ve BPDU Guard'ı kaldır ve portu kurtar (shutdown / no shutdown). Son olarak err-disable olan portların 60 saniyede bir kendiliğinden denensin: errdisable recovery cause bpduguard, errdisable recovery interval 60.",
      "Kontrol: show interfaces status, show interfaces status err-disabled, show spanning-tree vlan 10, show errdisable recovery."
    ],
    view: { w: 860, h: 520 },
    devices: [
      { id: "DSW1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0050.0001", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 430, y: 80 },
      { id: "ASW1", kind: "switch", model: "WS-C2960-24TT-L", mac: "5254.0050.0011", ports: ports("Fa0/1-4", "Gi0/1-2"), x: 430, y: 270 },
      { id: "ROGUE", kind: "switch", model: "WS-C2960-8TC-L", mac: "5254.0050.00ff", ports: ports("Fa0/1-4"), x: 730, y: 430 },
      { id: "PC1", kind: "pc", mac: "0050.7966.5001", x: 150, y: 440 },
      { id: "PC2", kind: "pc", mac: "0050.7966.5002", x: 430, y: 450 }
    ],
    links: [
      { a: ["DSW1", "GigabitEthernet0/1"], b: ["ASW1", "GigabitEthernet0/1"] },
      { a: ["DSW1", "GigabitEthernet0/2"], b: ["ASW1", "GigabitEthernet0/2"] },
      { a: ["PC1", "eth0"], b: ["ASW1", "FastEthernet0/1"] },
      { a: ["PC2", "eth0"], b: ["ASW1", "FastEthernet0/2"] },
      { a: ["ROGUE", "FastEthernet0/1"], b: ["ASW1", "FastEthernet0/3"] }
    ],
    initialConfig: {
      DSW1: `ip routing
vlan 10
 name KULLANICI
exit
spanning-tree vlan 10 priority 4096
interface range gi0/1 - 2
 switchport trunk encapsulation dot1q
 switchport mode trunk
exit
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
exit`,
      ASW1: `vlan 10
 name KULLANICI
exit
interface range gi0/1 - 2
 switchport mode trunk
exit
interface gi0/2
 spanning-tree portfast
 spanning-tree bpduguard enable
exit
interface range fa0/1 - 3
 switchport mode access
 switchport access vlan 10
exit
interface range fa0/1 - 2
 spanning-tree portfast
exit`,
      ROGUE: `hostname ROGUE
vlan 10
exit
spanning-tree vlan 10 priority 0
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit`
    },
    initialPcs: {
      PC1: { ip: "192.168.10.11", prefix: 24, gw: "192.168.10.1" },
      PC2: { ip: "192.168.10.12", prefix: 24, gw: "192.168.10.1" }
    },
    objectives: [
      {
        id: "edge",
        title: "ASW1 Fa0/1–3: PortFast ve BPDU Guard etkin",
        hint: "interface range fa0/1 - 3 → spanning-tree portfast → spanning-tree bpduguard enable. Ya da global: spanning-tree portfast bpduguard default (yalnızca PortFast portlara uygulanır).",
        check: (q) => {
          const c = q.cfg("ASW1");
          const bad = EDGE.filter((p) => {
            const pc = q.portCfg("ASW1", p);
            const guard = pc.bpduguard ?? (!!c.bpduguardDefault && pc.portfast);
            return !pc.portfast || !guard;
          });
          return { ok: !bad.length, detail: bad.length ? "Eksik: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "rogue",
        title: "ROGUE'un bağlı olduğu Fa0/3 err-disabled",
        hint: "BPDU Guard açık bir port BPDU alınca err-disable olur. Kontrol: show interfaces status err-disabled",
        check: (q) => q.errDisabled("ASW1", "Fa0/3")
      },
      {
        id: "root",
        title: "VLAN 10'un root bridge'i DSW1",
        hint: "ROGUE ağdan kopunca DSW1 (4096) en düşük bridge ID olur. Kontrol: show spanning-tree vlan 10",
        check: (q) => q.stpRoot(10) === "DSW1"
      },
      {
        id: "uplink",
        title: "Gi0/2 uplink'i PortFast/BPDU Guard'sız, up ve trunk",
        hint: "interface gi0/2 → no spanning-tree portfast → no spanning-tree bpduguard → shutdown → no shutdown. Switch'ler arası portta PortFast olmaz.",
        check: (q) => {
          const pc = q.portCfg("ASW1", "Gi0/2");
          return !pc.portfast && !pc.bpduguard && !q.errDisabled("ASW1", "Gi0/2") && q.isTrunk("ASW1", "Gi0/2");
        }
      },
      {
        id: "recovery",
        title: "errdisable recovery: bpduguard, 60 saniye",
        hint: "errdisable recovery cause bpduguard ve errdisable recovery interval 60. Sebep ortadan kalkmadıkça port tekrar err-disable olur. Kontrol: show errdisable recovery",
        check: (q) => !!q.cfg("ASW1").errRecoveryBpdu && q.cfg("ASW1").errRecoveryInterval === 60
      },
      {
        id: "ping",
        title: "PC1 ve PC2 gateway'e (192.168.10.1) ping atabiliyor",
        hint: "Kenar portları err-disable olmamalı: PC'ler BPDU göndermez.",
        check: (q) => q.ping("PC1", "192.168.10.1").ok && q.ping("PC2", "192.168.10.1").ok
      }
    ],
    solution: {
      ASW1: `configure terminal
interface range fa0/1 - 3
 spanning-tree portfast
 spanning-tree bpduguard enable
exit
interface gi0/2
 no spanning-tree portfast
 no spanning-tree bpduguard
 shutdown
 no shutdown
exit
errdisable recovery cause bpduguard
errdisable recovery interval 60
end
write memory`
    }
  };
  var bpdu_guard_default = lab11;

  // src/labs/ospf-troubleshoot.ts
  var R2 = ["R1", "R2", "R3"];
  var base = (n, rid, extra) => `ip routing
vlan 10
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
interface vlan 10
 ip address 192.168.${n}.1 255.255.255.0
exit
${extra}
router ospf 1
 router-id ${rid}
 passive-interface vlan 10
 network 192.168.${n}.0 0.0.0.255 area 0`;
  var routed = (port, ip2, more = "") => `interface ${port}
 no switchport
 ip address ${ip2} 255.255.255.252${more}
exit`;
  var lab12 = {
    id: "ospf-ariza",
    title: "OSPF arıza giderme: komşuluk şartları ve metrik ayarı",
    summary: "Üç router arasında hiçbir OSPF komşuluğu FULL değil. Hello/dead, area ve MTU uyumsuzluklarını bul, sonra reference bandwidth ile trafiği gigabit yola çek.",
    level: "İleri",
    tags: ["ENCOR", "OSPF", "Arıza giderme", "Hello/Dead", "MTU", "Reference bandwidth"],
    brief: [
      'R1–R2 ve R2–R3 arası Gigabit, R1–R3 arası FastEthernet routed linkler. IP adresleri ve OSPF süreci hazır, ama "show ip ospf neighbor" neredeyse boş.',
      "OSPF komşuluğu için iki uçta eşleşmesi gerekenler: subnet ve mask, area ID, hello ve dead süresi, stub bayrağı, farklı router ID. MTU eşleşmezse komşu görünür ama EXSTART'ta takılır.",
      "Her linkte sorunu bul ve doğru taraftan düzelt: standart değerler hello 10 / dead 40, MTU 1500, bütün linkler area 0.",
      "Sonra metrik: varsayılan reference bandwidth 100 Mbps, FastEthernet ile Gigabit'i aynı maliyette (1) görür ve R1 192.168.3.0/24'e yavaş linkten gider. Üç router'da da auto-cost reference-bandwidth 10000 yap; R1 artık R2 üzerinden gitmeli, R1–R3 linki yedek kalmalı.",
      "Kontrol: show ip ospf neighbor, show ip ospf interface Gi0/1, show running-config | section interface, show ip route ospf."
    ],
    view: { w: 880, h: 520 },
    devices: [
      { id: "R1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0060.0001", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 210, y: 150 },
      { id: "R2", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0060.0002", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 440, y: 330 },
      { id: "R3", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0060.0003", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 670, y: 150 },
      { id: "PC1", kind: "pc", mac: "0050.7966.6001", x: 210, y: 460 },
      { id: "PC3", kind: "pc", mac: "0050.7966.6003", x: 670, y: 460 }
    ],
    links: [
      { a: ["R1", "GigabitEthernet0/1"], b: ["R2", "GigabitEthernet0/1"] },
      { a: ["R2", "GigabitEthernet0/2"], b: ["R3", "GigabitEthernet0/2"] },
      { a: ["R1", "FastEthernet0/2"], b: ["R3", "FastEthernet0/2"] },
      { a: ["PC1", "eth0"], b: ["R1", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["R3", "FastEthernet0/1"] }
    ],
    initialConfig: {
      R1: base(1, "1.1.1.1", [routed("gi0/1", "10.0.12.1"), routed("fa0/2", "10.0.13.1")].join("\n")) + `
 network 10.0.12.0 0.0.0.3 area 0
 network 10.0.13.0 0.0.0.3 area 0
exit`,
      // fault 1: hello timer on the R1-R2 link
      R2: base(2, "2.2.2.2", [routed("gi0/1", "10.0.12.2", "\n ip ospf hello-interval 5"), routed("gi0/2", "10.0.23.1")].join("\n")) + `
 network 10.0.12.0 0.0.0.3 area 0
 network 10.0.23.0 0.0.0.3 area 0
exit`,
      // fault 2: R2-R3 link put in area 1 on R3; fault 3: MTU on the R1-R3 link
      R3: base(3, "3.3.3.3", [routed("gi0/2", "10.0.23.2"), routed("fa0/2", "10.0.13.2", "\n ip mtu 1400")].join("\n")) + `
 network 10.0.23.0 0.0.0.3 area 1
 network 10.0.13.0 0.0.0.3 area 0
exit`
    },
    initialPcs: {
      PC1: { ip: "192.168.1.10", prefix: 24, gw: "192.168.1.1" },
      PC3: { ip: "192.168.3.10", prefix: 24, gw: "192.168.3.1" }
    },
    objectives: [
      {
        id: "r1r2",
        title: "R1–R2 komşuluğu FULL",
        hint: 'Hello/dead iki uçta aynı olmalı. show ip ospf interface gi0/1 çıktısındaki "Timer intervals" satırlarını karşılaştır.',
        check: (q) => q.ospfAdjacent("R1", "R2")
      },
      {
        id: "r2r3",
        title: "R2–R3 komşuluğu FULL ve area 0'da",
        hint: "İki uçta show ip ospf interface brief ile Area sütununu karşılaştır. R3: no network 10.0.23.0 0.0.0.3 area 1 → network 10.0.23.0 0.0.0.3 area 0",
        check: (q) => q.ospfAdjacent("R2", "R3") && q.ospf("R3").ifs.some((i) => i.name === "GigabitEthernet0/2" && i.area === 0)
      },
      {
        id: "r1r3",
        title: "R1–R3 komşuluğu FULL (EXSTART'ta takılı değil)",
        hint: "Komşu görünüyor ama EXSTART'ta kalıyorsa DBD paketleri MTU yüzünden kabul edilmiyor. R3 Fa0/2: no ip mtu",
        check: (q) => q.ospfAdjacent("R1", "R3")
      },
      {
        id: "refbw",
        title: "Üç router'da auto-cost reference-bandwidth 10000",
        hint: "Değer bütün router'larda aynı olmalı. Yoksa her router linkleri farklı maliyetle hesaplar.",
        check: (q) => {
          const bad = R2.filter((d) => q.cfg(d).ospf?.refBw !== 1e4);
          return { ok: !bad.length, detail: bad.length ? "Farklı: " + bad.join(", ") : void 0 };
        }
      },
      {
        id: "path",
        title: "R1, 192.168.3.0/24'e yalnızca R2 üzerinden gidiyor",
        hint: "Ref BW 10000 ile Gi = 10, Fa = 100. R1 → R2 → R3 = 20 + LAN < 100. Kontrol: show ip route 192.168.3.0",
        check: (q) => {
          const r = q.route("R1", "192.168.3.0", 24);
          return { ok: !!r && r.code === "O" && r.paths?.length === 1 && r.nh === "10.0.12.2", detail: r ? `via ${r.paths?.map((p) => p.nh).join(", ")}` : "rota yok" };
        }
      },
      {
        id: "e2e",
        title: "PC1 ↔ PC3 ping",
        hint: "PC1'de: trace 192.168.3.10. İlk hop 192.168.1.1, ikinci 10.0.12.2 olmalı.",
        check: (q) => q.ping("PC1", "192.168.3.10").ok && q.ping("PC3", "192.168.1.10").ok
      }
    ],
    solution: {
      R1: `configure terminal
router ospf 1
 auto-cost reference-bandwidth 10000
end
write memory`,
      R2: `configure terminal
interface gi0/1
 no ip ospf hello-interval
exit
router ospf 1
 auto-cost reference-bandwidth 10000
end
write memory`,
      R3: `configure terminal
interface fa0/2
 no ip mtu
exit
router ospf 1
 no network 10.0.23.0 0.0.0.3 area 1
 network 10.0.23.0 0.0.0.3 area 0
 auto-cost reference-bandwidth 10000
end
write memory`
    }
  };
  var ospf_troubleshoot_default = lab12;

  // src/labs/ospf-multiarea.ts
  var lanCfg = (n) => `vlan 10
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
interface vlan 10
 ip address 192.168.${n}.1 255.255.255.0
exit`;
  var routed2 = (port, ip2, mask = "255.255.255.252") => `interface ${port}
 no switchport
 ip address ${ip2} ${mask}
exit`;
  var lab13 = {
    id: "ospf-cok-alan",
    title: "Çok alanlı OSPF: ABR, ASBR, varsayılan rota, totally stubby area",
    summary: "Şube router'ını area 1'e al, ABR üzerinden backbone'a bağla, ASBR'den internete varsayılan rota yay ve area 1'i totally stubby yaparak şubenin rota tablosunu tek bir default'a indir.",
    level: "İleri",
    tags: ["ENCOR", "OSPF", "Multi-area", "ABR/ASBR", "Stub area", "Default route"],
    brief: [
      "Topoloji: R1 (şube, area 1) — R2 (ABR) — R3 (merkez, area 0, ASBR) — ISP. ISP hazır: Loopback0 8.8.8.8 ve iç ağlara dönüş rotaları var. Bütün IP adresleri ve ip routing hazır.",
      "Area 0 kurulu: R2 Gi0/2, R2 Loopback0 (2.2.2.2) ve R3'ün iç arayüzleri. Area 1 eksik: R1 tarafında OSPF hiç yok, R2 Gi0/1 de OSPF'te değil.",
      "R1'de router ospf 1 (router-id 1.1.1.1), Gi0/1 ve LAN area 1, LAN passive. R2'de 10.1.12.0/30 linkini area 1'e al. R2 artık ABR olmalı.",
      "R3 internet çıkışı: ip route 0.0.0.0 0.0.0.0 203.0.113.1 ve router ospf altında default-information originate. R3 ASBR olur, R2 varsayılanı O*E2 olarak öğrenmeli.",
      "Şube router'ının bütün iç rotaları ve dış rotaları bilmesine gerek yok. Area 1'i totally stubby yap: R1'de area 1 stub, ABR'de (R2) area 1 stub no-summary. Stub bayrağı iki uçta da olmazsa komşuluk düşer.",
      "Sonuç: R1'in tablosunda yalnızca kendi alanının rotaları ve O*IA 0.0.0.0/0 kalmalı. Kontrol: show ip route, show ip ospf, show ip ospf neighbor. PC1 hem PC3'e hem 8.8.8.8'e ping atabilmeli."
    ],
    view: { w: 960, h: 500 },
    devices: [
      { id: "R1", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0070.0001", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 130, y: 150 },
      { id: "R2", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0070.0002", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 370, y: 150 },
      { id: "R3", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0070.0003", ports: ports("Fa0/1-2", "Gi0/1-2"), l3: true, needsEncap: true, x: 610, y: 150 },
      { id: "ISP", kind: "switch", model: "WS-C3560-24PS", mac: "5254.0070.00ee", ports: ports("Gi0/1-2"), l3: true, needsEncap: true, x: 850, y: 150 },
      { id: "PC1", kind: "pc", mac: "0050.7966.7001", x: 130, y: 400 },
      { id: "PC3", kind: "pc", mac: "0050.7966.7003", x: 610, y: 400 }
    ],
    links: [
      { a: ["R1", "GigabitEthernet0/1"], b: ["R2", "GigabitEthernet0/1"] },
      { a: ["R2", "GigabitEthernet0/2"], b: ["R3", "GigabitEthernet0/1"] },
      { a: ["R3", "GigabitEthernet0/2"], b: ["ISP", "GigabitEthernet0/1"] },
      { a: ["PC1", "eth0"], b: ["R1", "FastEthernet0/1"] },
      { a: ["PC3", "eth0"], b: ["R3", "FastEthernet0/1"] }
    ],
    initialConfig: {
      R1: `ip routing
${lanCfg(1)}
${routed2("gi0/1", "10.1.12.1")}`,
      R2: `ip routing
interface loopback 0
 ip address 2.2.2.2 255.255.255.255
exit
${routed2("gi0/1", "10.1.12.2")}
${routed2("gi0/2", "10.0.23.1")}
router ospf 1
 router-id 2.2.2.2
 network 10.0.23.0 0.0.0.3 area 0
 network 2.2.2.2 0.0.0.0 area 0
exit`,
      R3: `ip routing
${lanCfg(3)}
${routed2("gi0/1", "10.0.23.2")}
${routed2("gi0/2", "203.0.113.2")}
router ospf 1
 router-id 3.3.3.3
 passive-interface vlan 10
 network 10.0.23.0 0.0.0.3 area 0
 network 192.168.3.0 0.0.0.255 area 0
exit`,
      ISP: `ip routing
interface loopback 0
 ip address 8.8.8.8 255.255.255.255
exit
${routed2("gi0/1", "203.0.113.1")}
ip route 10.0.0.0 255.0.0.0 203.0.113.2
ip route 192.168.0.0 255.255.0.0 203.0.113.2`
    },
    initialPcs: {
      PC1: { ip: "192.168.1.10", prefix: 24, gw: "192.168.1.1" },
      PC3: { ip: "192.168.3.10", prefix: 24, gw: "192.168.3.1" }
    },
    objectives: [
      {
        id: "area1",
        title: "R1–R2 komşuluğu FULL ve area 1'de; R2 ABR",
        hint: 'R1: router ospf 1 → router-id 1.1.1.1 → network 10.1.12.0 0.0.0.3 area 1. R2: network 10.1.12.0 0.0.0.3 area 1. Kontrol: show ip ospf ("It is an area border router")',
        check: (q) => q.ospfAdjacent("R1", "R2") && !!q.ospf("R2")?.abr && q.ospf("R1")?.rid === "1.1.1.1" && q.ospf("R1").areas.join() === "1"
      },
      {
        id: "lan1",
        title: "R1 LAN'ı area 1'de, passive; R3 onu O IA olarak görüyor",
        hint: `Başka alandan gelen ağ, ABR'nin ürettiği Type 3 (summary) LSA ile gelir ve tabloda "O IA" görünür.`,
        check: (q) => !!q.ospf("R1")?.ifs.some((i) => i.name === "Vlan10" && i.passive && i.area === 1) && q.route("R3", "192.168.1.0", 24)?.code === "O IA"
      },
      {
        id: "asbr",
        title: "R3 ASBR: statik default + default-information originate, R2'de O*E2",
        hint: "R3: ip route 0.0.0.0 0.0.0.0 203.0.113.1, router ospf 1 → default-information originate. Statik default olmadan (always yoksa) ilan edilmez.",
        check: (q) => !!q.ospf("R3")?.asbr && q.route("R2", "0.0.0.0", 0)?.code === "O E2"
      },
      {
        id: "stub",
        title: "Area 1 totally stubby: R1'de yalnızca O*IA default var",
        hint: `R1: area 1 stub. R2: area 1 stub no-summary. R1'de "O IA" olarak yalnızca 0.0.0.0/0 kalmalı, O E2 hiç olmamalı.`,
        check: (q) => {
          const rs = q.routes("R1").filter((e) => e.code.startsWith("O"));
          const def = rs.find((e) => e.prefix === 0);
          const extra = rs.filter((e) => e.code !== "O" && e.prefix !== 0).map((e) => `${e.code} ${e.net}/${e.prefix}`);
          const ok = def?.code === "O IA" && !extra.length && !!q.cfg("R2").ospf?.stubs["1"]?.noSummary;
          return { ok, detail: !def ? "R1'de default yok" : def.code !== "O IA" ? `default ${def.code}` : extra.length ? "Fazla: " + extra.join(", ") : void 0 };
        }
      },
      {
        id: "e2e",
        title: "PC1 → PC3 ve PC1 → 8.8.8.8 ping",
        hint: "R1 internete O*IA default ile R2'ye, R2 O*E2 ile R3'e, R3 statik default ile ISP'ye gider. PC1'de: trace 8.8.8.8",
        check: (q) => q.ping("PC1", "192.168.3.10").ok && q.ping("PC1", "8.8.8.8").ok
      }
    ],
    solution: {
      R1: `configure terminal
router ospf 1
 router-id 1.1.1.1
 area 1 stub
 passive-interface vlan 10
 network 10.1.12.0 0.0.0.3 area 1
 network 192.168.1.0 0.0.0.255 area 1
end
write memory`,
      R2: `configure terminal
router ospf 1
 area 1 stub no-summary
 network 10.1.12.0 0.0.0.3 area 1
end
write memory`,
      R3: `configure terminal
ip route 0.0.0.0 0.0.0.0 203.0.113.1
router ospf 1
 default-information originate
end
write memory`
    }
  };
  var ospf_multiarea_default = lab13;

  // src/labs/index.ts
  var LABS = [vlan_basics_default, trunk_troubleshoot_default, trunk_hardening_default, campus_l2_l3_default, stp_load_balancing_default, etherchannel_troubleshoot_default, l3_static_routing_default, mgmt_vlan_default, ospf_single_area_default, routed_access_default, bpdu_guard_default, ospf_troubleshoot_default, ospf_multiarea_default];

  // src/sim-bridge/bridge.ts
  var import_mac_address = __toESM(require_mac_address());
  var MODEL_L2 = "WS-C2960-24TT-L";
  var MODEL_L3 = "WS-C3650-24PS";
  var MODEL_ROUTER = "ISR4331";
  var ROUTER_TEMPLATE_PORTS = ["g0/0", "g0/1"];
  var TEMPLATES = {
    [MODEL_L2]: ["Fa0/1-24", "Gi0/1-2"],
    [MODEL_L3]: ["Gi1/0/1-24", "Gi1/1/1-4"]
  };
  var TOP_OPAQUE = /* @__PURE__ */ new Set(["app", "version", "nextId", "selected", "importReport", "sourceArchive"]);
  var DEVICE_OPAQUE = /* @__PURE__ */ new Set(["id", "name", "type", "x", "y", "w", "h", "mode", "config", "selected"]);
  var PC_FIELDS = /* @__PURE__ */ new Set(["enabled", "ports", "interfaces", "ip", "mask", "gateway", "mac", "vlan", "dhcpLease", "dns"]);
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
  var ROUTER_FIELDS = /* @__PURE__ */ new Set(["enabled", "ports", "interfaces", "staticRoutes", "route", "ospf", "ip", "mask", "gateway", "vlan", "dhcpPools", "dhcpExcluded", "acls", "natOverload", "natTranslations", "tracks"]);
  var ROUTER_IF_FIELDS = /* @__PURE__ */ new Set(["ip", "mask", "enabled", "helperAddress", "aclIn", "aclOut", "natRole", "hsrp", "vrrp"]);
  var ACL_RULE_FIELDS = /* @__PURE__ */ new Set(["id", "action", "protocol", "srcType", "src", "wildcard", "dstType", "dst", "dstWildcard", "port"]);
  var DHCP_POOL_FIELDS = /* @__PURE__ */ new Set(["name", "network", "mask", "defaultRouter", "dnsServer"]);
  var SUBIF_FIELDS = /* @__PURE__ */ new Set(["ip", "mask", "enabled", "parent", "vlan", "encapsulation", "helperAddress", "aclIn", "aclOut", "natRole", "hsrp", "vrrp"]);
  var STATIC_ROUTE_FIELDS = /* @__PURE__ */ new Set(["network", "mask", "nextHop", "distance"]);
  var OSPF_FIELDS = /* @__PURE__ */ new Set(["pid", "routerId", "networks"]);
  var SERVER_FIELDS = /* @__PURE__ */ new Set([...PC_FIELDS, "services"]);
  var PHYS_FIELDS = /* @__PURE__ */ new Set(["mode", "vlan", "allowed", "nativeVlan", "enabled", "portSecurity", "errdisabled", "channelGroup"]);
  var PO_FIELDS = /* @__PURE__ */ new Set(["mode", "vlan", "allowed", "nativeVlan", "enabled"]);
  var CHANNEL_MODES = ["on", "active", "passive", "desirable", "auto"];
  var channelProto = (m) => m === "on" ? "on" : m === "active" || m === "passive" ? "lacp" : "pagp";
  var PS_FIELDS = ["enabled", "max", "violation", "macs"];
  var colonMac = (dotted) => dotted.replace(/\./g, "").match(/../g).join(":");
  var SVI_FIELDS = /* @__PURE__ */ new Set(["ip", "mask", "enabled", "vlan"]);
  var FEATURE_REASON = {
    staticRoutes: "Switch üzerinde statik rota AğLab modelinde yok",
    route: "Switch üzerinde varsayılan rota AğLab modelinde yok",
    acls: "ACL Labber'da yok (L5)",
    natOverload: "NAT Labber'da yok (L5)",
    natTranslations: "NAT çeviri tablosu Labber'da yok (L5)",
    ospf: "Switch üzerinde OSPF AğLab modelinde yok",
    bgp: "BGP Labber'da modellenmez (kapsam dışı)",
    services: "Sunucu servisleri yalnız Server cihazında modellenir",
    startupConfig: "Eski kayıt (v23) startup-config alanı: kayıt açılırken Labber startup-config’ine taşınır, köprüye verilmez",
    portSecurity: "Port security Labber'da yok (L5)",
    errdisabled: "Port security err-disable durumu Labber'da yok (L5)",
    encapsulation: "Alt arayüz alanı (encapsulation) yalnız router alt arayüzünde (g0/0.N) eşlenir",
    parent: "Alt arayüz alanı (parent) yalnız router alt arayüzünde (g0/0.N) eşlenir",
    aclIn: "ACL Labber'da yok (L5)",
    aclOut: "ACL Labber'da yok (L5)",
    natRole: "NAT Labber'da yok (L5)",
    hsrp: "HSRP/VRRP yalnız router arayüzünde ve alt arayüzünde eşlenir",
    vrrp: "HSRP/VRRP yalnız router arayüzünde ve alt arayüzünde eşlenir",
    tracks: "İzlenen nesne (track) yalnız router'da eşlenir",
    helperAddress: "DHCP relay (helperAddress) yalnız router arayüzünde ve alt arayüzünde eşlenir"
  };
  var sortNum = (a, b) => a - b;
  var ALL_VLANS2 = Array.from({ length: 4094 }, (_, i) => i + 1);
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
    const report = { unsupported: [], rejected: [], expressible: true, reasons: [], portNames: {} };
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
      if (devices.length) resolver(devices[0], devices);
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
    const errdis = [];
    const nat = [];
    const ids = /* @__PURE__ */ new Set();
    const claimMac = (dev, mac) => {
      const other = usedMacs.get(mac);
      if (other !== void 0) reject(dev, "mac", `MAC ${mac} ${other} ile çakışıyor`);
      else usedMacs.set(mac, dev);
    };
    const mapPorts = (id, sourcePorts) => {
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
      return { portMap, canonPorts };
    };
    const helperOf = (id, name, iface) => {
      const h = iface["helperAddress"];
      if (h === void 0 || h === "") return null;
      if (typeof h !== "string" || !isIp(h)) {
        reject(id, `${name}.helperAddress`, "Geçersiz helper-address");
        return null;
      }
      return [h];
    };
    const accessGroups = (id, name, iface) => {
      const out = {};
      for (const k of ["aclIn", "aclOut"]) {
        const v = iface[k];
        if (v === void 0 || v === "" || v === null) continue;
        if (typeof v !== "string" && typeof v !== "number") reject(id, `${name}.${k}`, "Geçersiz ACL kimliği");
        else out[k] = String(v);
      }
      return Object.keys(out).length ? out : null;
    };
    const natRoleOf = (id, name, iface) => {
      const v = iface["natRole"];
      if (v === void 0 || v === "" || v === null) return null;
      if (v !== "inside" && v !== "outside") {
        reject(id, `${name}.natRole`, "natRole inside ya da outside olmalı");
        return null;
      }
      return { nat: v };
    };
    const aclsToLabber = (id, rules) => {
      const lists = {};
      const order = [];
      let ok = true;
      const addr = (type, a, w, where) => {
        if (type === void 0 || type === "any") return { addr: "0.0.0.0", wild: "255.255.255.255" };
        if (type === "host" && typeof a === "string" && isIp(a)) return { addr: a, wild: "0.0.0.0" };
        if (type === "network" && typeof a === "string" && isIp(a) && typeof w === "string" && isIp(w)) return normAddr(a, w);
        reject(id, where, "Geçersiz ACL adres/wildcard");
        ok = false;
        return null;
      };
      rules.forEach((r, i) => {
        const where = `acls[${i}]`;
        for (const k of Object.keys(r ?? {})) if (!ACL_RULE_FIELDS.has(k)) unsupported(id, `${where}.${k}`, "Labber'da karşılığı olmayan ACL alanı");
        const name = String(r?.["id"] ?? "");
        const proto = String(r?.["protocol"] ?? "ip");
        if (!name || !["permit", "deny"].includes(String(r?.["action"])) || !["ip", "icmp", "tcp", "udp"].includes(proto)) {
          reject(id, where, "Geçersiz ACL kuralı");
          ok = false;
          return;
        }
        const src = addr(r["srcType"], r["src"], r["wildcard"], where + ".src");
        const dst = addr(r["dstType"], r["dst"], r["dstWildcard"], where + ".dst");
        const port = r["port"];
        if (port !== void 0 && port !== null && (!["tcp", "udp"].includes(proto) || !Number.isInteger(Number(port)) || Number(port) < 0 || Number(port) > 65535)) {
          reject(id, where + ".port", "ACL portu yalnız tcp/udp için 0-65535");
          ok = false;
          return;
        }
        if (!src || !dst) return;
        if (!lists[name]) {
          lists[name] = { type: "extended", entries: [] };
          order.push(name);
        }
        const e = {
          seq: (lists[name].entries.length + 1) * 10,
          action: r["action"],
          proto,
          src,
          dst,
          ...port !== void 0 && port !== null ? { dstPort: { op: "eq", a: Number(port) } } : {}
        };
        lists[name].entries.push(e);
      });
      for (const name of order) {
        const l = lists[name];
        const plain = l.entries.every((e) => e.proto === "ip" && !e.dstPort && e.dst.wild === "255.255.255.255");
        const kind = aclKind(name) ?? (plain ? "standard" : "extended");
        if (kind === "standard") {
          if (!plain) {
            reject(id, `acls.${name}`, "Standart ACL (1-99) yalnız kaynak adresi eşler");
            ok = false;
            continue;
          }
          l.type = "standard";
          for (const e of l.entries) delete e.dst;
        }
      }
      return ok ? lists : null;
    };
    const fhrpOf = (id, name, iface, ifaceOf) => {
      const out = {};
      const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
      for (const proto of ["hsrp", "vrrp"]) {
        const list = iface[proto];
        if (list === void 0) continue;
        const where = `${name}.${proto}`;
        if (!Array.isArray(list)) {
          reject(id, where, `${proto} bir liste olmalı`);
          continue;
        }
        const groups = [];
        for (const [i, raw] of list.entries()) {
          const g = raw;
          const at = `${where}[${i}]`;
          const keys = proto === "hsrp" ? ["group", "ip", "priority", "preempt", "track"] : ["group", "ip", "priority", "preempt"];
          if (!g || typeof g !== "object" || Array.isArray(g)) {
            reject(id, at, "Geçersiz FHRP grubu");
            continue;
          }
          for (const k of Object.keys(g)) if (!keys.includes(k)) unsupported(id, `interfaces.${at}.${k}`, `Labber'da karşılığı olmayan ${proto.toUpperCase()} alanı`);
          const ok = int(g["group"], proto === "hsrp" ? 0 : 1, 255) && (g["ip"] === void 0 || g["ip"] === "" || typeof g["ip"] === "string" && isIp(g["ip"])) && (g["priority"] === void 0 || int(g["priority"], proto === "hsrp" ? 0 : 1, proto === "hsrp" ? 255 : 254)) && (g["preempt"] === void 0 || typeof g["preempt"] === "boolean");
          if (!ok || groups.some((x) => x.group === g["group"])) {
            reject(id, at, `Geçersiz ya da yinelenen ${proto.toUpperCase()} grubu (grup, ip, priority, preempt)`);
            continue;
          }
          const grp = { group: g["group"], ip: g["ip"] ? String(g["ip"]) : null };
          if (g["priority"] !== void 0) grp.priority = g["priority"];
          if (proto === "hsrp" && g["preempt"] === true) grp.preempt = true;
          if (proto === "vrrp" && g["preempt"] === false) grp.preempt = false;
          if (g["track"] !== void 0) {
            const tracks = [];
            const ts = g["track"];
            for (const t of Array.isArray(ts) ? ts : [null]) {
              const dec = t?.["decrement"];
              const okDec = dec === void 0 || int(dec, 1, 255);
              const canon = typeof t?.["interface"] === "string" ? ifaceOf(t["interface"]) : null;
              if (t && okDec && int(t["object"], 1, 1e3) && t["interface"] === void 0 && Object.keys(t).every((k) => k === "object" || k === "decrement"))
                tracks.push({ obj: t["object"], ...dec !== void 0 ? { decrement: dec } : {} });
              else if (t && okDec && canon && t["object"] === void 0 && Object.keys(t).every((k) => k === "interface" || k === "decrement"))
                tracks.push({ iface: canon, ...dec !== void 0 ? { decrement: dec } : {} });
              else reject(id, `${at}.track`, "HSRP track: {object, decrement?} ya da cihazdaki {interface, decrement?} olmalı");
            }
            if (tracks.length) grp.tracks = tracks;
          }
          groups.push(grp);
        }
        if (groups.length) out[proto] = groups.sort((a, b) => a.group - b.group);
      }
      return Object.keys(out).length ? out : null;
    };
    const routerToLabber = (d, id, off) => {
      for (const key of ["ip", "mask", "gateway"])
        if (d[key] !== void 0 && d[key] !== "") unsupported(id, key, "Router'da cihaz düzeyi adres alanı AğLab modelinde yok (arayüz adresleri kullanılır)");
      const ifaces = d.interfaces ?? {};
      const sourcePorts = d.ports ?? [.../* @__PURE__ */ new Set([...ROUTER_TEMPLATE_PORTS, ...Object.keys(ifaces).filter((n) => !n.includes("."))])];
      const { portMap, canonPorts } = mapPorts(id, sourcePorts);
      canonByDevice[id] = Object.fromEntries(Object.entries(portMap).map(([c, o]) => [o, c]));
      report.portNames[id] = portMap;
      const pktModel = typeof d.config?.packetTracerModel === "string" ? d.config.packetTracerModel : "";
      const sw = {
        id,
        kind: "switch",
        router: true,
        l3: true,
        model: pktModel || MODEL_ROUTER,
        mac: "0000.0000.0000",
        ports: canonPorts,
        x: Number(d.x ?? 0),
        y: Number(d.y ?? 0),
        ...off ? { off: true } : {}
      };
      if (resolveMac) sw.mac = intToDotted(0x02n << 40n | (macToInt(resolveMac(d)) & 0xffffffffn) << 8n);
      claimMac(id, sw.mac);
      def.devices.push(sw);
      const cfg = defaultSwitchConfig(sw);
      cfg.hostname = d.name || id;
      for (const c of canonPorts) cfg.ifaces[c].shutdown = false;
      const fhrpLater = [];
      for (const [name, iface] of Object.entries(ifaces)) {
        if (name.includes(".")) continue;
        const c = canonPort(name);
        if (!c || portMap[c] === void 0) {
          reject(id, name, c ? "Arayüz cihazın port listesinde yok" : "Eşlenemeyen arayüz adı");
          continue;
        }
        for (const key of Object.keys(iface))
          if (!ROUTER_IF_FIELDS.has(key)) unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? "Labber'da karşılığı olmayan router arayüz alanı");
        const phys = cfg.ifaces[c];
        phys.shutdown = iface.enabled === false;
        if (iface.ip) {
          const pre = iface.mask ? maskToPrefix(iface.mask) : null;
          if (!isIp(iface.ip) || pre === null || pre === 0) reject(id, name, "Geçersiz router arayüzü IPv4 adresi/maskesi");
          else phys.ip = { addr: iface.ip, mask: iface.mask };
        }
        const helpers2 = helperOf(id, name, iface);
        if (helpers2) phys.l3 = { ...phys.l3 ?? {}, helpers: helpers2 };
        const groups = accessGroups(id, name, iface);
        if (groups) phys.l3 = { ...phys.l3 ?? {}, ...groups };
        const role2 = natRoleOf(id, name, iface);
        if (role2) phys.l3 = { ...phys.l3 ?? {}, ...role2 };
        fhrpLater.push([name, iface, (fh) => void (phys.l3 = { ...phys.l3 ?? {}, ...fh })]);
      }
      for (const [name, iface] of Object.entries(ifaces)) {
        if (!name.includes(".")) continue;
        const dot = name.indexOf(".");
        const physName = name.slice(0, dot);
        const sub = name.slice(dot + 1);
        const parent = canonPort(physName);
        if (!parent || portMap[parent] === void 0 || !/^\d+$/.test(sub) || Number(sub) < 1 || Number(sub) > 4294967295) {
          reject(id, name, "Alt arayüzün fiziksel portu cihazda yok ya da numarası geçersiz");
          continue;
        }
        for (const key2 of Object.keys(iface))
          if (!SUBIF_FIELDS.has(key2)) unsupported(id, `interfaces.${name}.${key2}`, FEATURE_REASON[key2] ?? "Labber'da karşılığı olmayan alt arayüz alanı");
        if (iface.parent !== void 0 && canonPort(String(iface.parent)) !== parent) {
          reject(id, `${name}.parent`, "Alt arayüzün parent alanı adıyla uyuşmuyor");
          continue;
        }
        let vlan = null;
        if (iface.encapsulation !== void 0 && iface.encapsulation !== "") {
          const v = vlanId(iface.vlan);
          if (iface.encapsulation !== "dot1q") reject(id, `${name}.encapsulation`, "Yalnız 802.1Q (dot1q) alt arayüzü modellenir");
          else if (v === null) reject(id, `${name}.vlan`, "Geçersiz 802.1Q VLAN kimliği");
          else vlan = v;
        }
        const key = `${parent}.${Number(sub)}`;
        const subs = cfg.subifs ?? (cfg.subifs = {});
        if (vlan !== null && Object.values(subs).some((x) => x.parent === parent && x.vlan === vlan)) {
          reject(id, name, `Aynı fiziksel portta VLAN ${vlan} iki alt arayüzde`);
          continue;
        }
        let ip2 = null;
        if (iface.ip) {
          const pre = iface.mask ? maskToPrefix(iface.mask) : null;
          if (!isIp(iface.ip) || pre === null || pre === 0) reject(id, name, "Geçersiz alt arayüz IPv4 adresi/maskesi");
          else if (vlan === null) reject(id, name, "encapsulation dot1q olmadan alt arayüz IP adresi (IOS kabul etmez)");
          else ip2 = { addr: iface.ip, mask: iface.mask };
        }
        subs[key] = { parent, vlan, native: false, shutdown: iface.enabled === false, description: "", ip: ip2 };
        const helpers2 = helperOf(id, name, iface);
        if (helpers2) subs[key].l3 = { helpers: helpers2 };
        const groups = accessGroups(id, name, iface);
        if (groups) subs[key].l3 = { ...subs[key].l3 ?? {}, ...groups };
        const role2 = natRoleOf(id, name, iface);
        if (role2) subs[key].l3 = { ...subs[key].l3 ?? {}, ...role2 };
        fhrpLater.push([name, iface, (fh) => void (subs[key].l3 = { ...subs[key].l3 ?? {}, ...fh })]);
      }
      const ifaceOf = (n) => {
        const dot = n.indexOf(".");
        const canon = dot < 0 ? canonPort(n) : canonPort(n.slice(0, dot)) + n.slice(dot);
        return canon && (dot < 0 ? portMap[canon] !== void 0 : !!cfg.subifs?.[canon]) ? canon : null;
      };
      for (const [name, iface, apply] of fhrpLater) {
        const fh = fhrpOf(id, name, iface, ifaceOf);
        if (fh) apply(fh);
      }
      if (d.tracks !== void 0) {
        const list2 = d.tracks;
        const tracks = {};
        for (const t of Array.isArray(list2) ? list2 : [null]) {
          const n = t?.["id"];
          const canon = typeof t?.["interface"] === "string" ? ifaceOf(t["interface"]) : null;
          if (!t || !Number.isInteger(n) || n < 1 || n > 1e3 || !canon || tracks[String(n)] || Object.keys(t).some((k) => k !== "id" && k !== "interface"))
            reject(id, "tracks", "track: {id 1-1000, interface} (cihazdaki arayüz, yinelenmeyen numara) olmalı");
          else tracks[String(n)] = { iface: canon };
        }
        if (Object.keys(tracks).length) cfg.tracks = tracks;
      }
      if (d.natOverload !== void 0 && d.natOverload !== null) {
        const n = d.natOverload;
        const out = typeof n["outsideInterface"] === "string" ? String(n["outsideInterface"]) : "";
        const dot = out.indexOf(".");
        const canon = dot < 0 ? canonPort(out) : canonPort(out.slice(0, dot)) + out.slice(dot);
        const known = !!canon && (dot < 0 ? portMap[canon] !== void 0 : !!cfg.subifs?.[canon]);
        if (typeof n !== "object" || n["aclId"] === void 0 || n["aclId"] === "" || !known)
          reject(id, "natOverload", "NAT overload için ACL kimliği ve cihazdaki outside arayüzü gerekli");
        else {
          for (const k of Object.keys(n)) if (k !== "aclId" && k !== "outsideInterface") unsupported(id, `natOverload.${k}`, "Labber'da karşılığı olmayan NAT alanı");
          cfg.nat = { ...emptyNat(), rules: [{ acl: String(n["aclId"]), iface: canon, overload: true }] };
        }
      }
      if (d.natTranslations !== void 0) {
        if (!Array.isArray(d.natTranslations)) reject(id, "natTranslations", "NAT çeviri tablosu dizi olmalı");
        else
          d.natTranslations.forEach((t, i) => {
            const proto = t?.["protocol"];
            const ips = ["insideLocal", "insideGlobal", "outsideLocal"].map((k) => String(t?.[k] ?? ""));
            if (proto !== "icmp" && proto !== "tcp" && proto !== "udp" || !ips.every(isIp))
              return reject(id, `natTranslations[${i}]`, "Geçersiz NAT çeviri girdisi");
            nat.push({ dev: id, proto, insideLocal: ips[0], insideGlobal: ips[1], outsideLocal: ips[2] });
          });
      }
      if (d.acls !== void 0) {
        if (!Array.isArray(d.acls)) reject(id, "acls", "ACL listesi dizi olmalı");
        else {
          const lists = aclsToLabber(id, d.acls);
          if (lists) cfg.acls = lists;
        }
      }
      if (d.dhcpPools !== void 0) {
        if (!Array.isArray(d.dhcpPools)) reject(id, "dhcpPools", "DHCP havuz listesi dizi olmalı");
        else
          d.dhcpPools.forEach((pool, i) => {
            const where = `dhcpPools[${i}]`;
            for (const key of Object.keys(pool ?? {}))
              if (!DHCP_POOL_FIELDS.has(key)) unsupported(id, `${where}.${key}`, "Labber'da karşılığı olmayan DHCP havuz alanı");
            const name = pool?.["name"];
            if (typeof name !== "string" || !name || /\s/.test(name)) return reject(id, where, "DHCP havuz adı boşluksuz bir metin olmalı");
            if (cfg.dhcpPools?.[name]) return reject(id, where, "Aynı adla yinelenen DHCP havuzu");
            const out = { net: null, defaultRouter: null, dns: null };
            const network = pool["network"] ?? "";
            if (network !== "") {
              const pre = isIp(String(pool["mask"] ?? "")) ? maskToPrefix(String(pool["mask"])) : null;
              if (!isIp(String(network)) || pre === null || pre < 1 || pre > 30 || networkOf(String(network), pre) !== network)
                return reject(id, where, "Geçersiz DHCP havuz ağı (ağ adresi/maske)");
              out.net = { addr: String(network), mask: String(pool["mask"]) };
            }
            for (const [key, field] of [["defaultRouter", "defaultRouter"], ["dnsServer", "dns"]]) {
              const v = pool[key] ?? "";
              if (v === "") continue;
              if (!isIp(String(v))) return reject(id, `${where}.${key}`, "Geçersiz IPv4 adresi");
              out[field] = String(v);
            }
            ;
            (cfg.dhcpPools ?? (cfg.dhcpPools = {}))[name] = out;
          });
      }
      if (d.dhcpExcluded !== void 0) {
        if (!Array.isArray(d.dhcpExcluded)) reject(id, "dhcpExcluded", "DHCP dışlanan adres listesi dizi olmalı");
        else
          d.dhcpExcluded.forEach((r, i) => {
            const where = `dhcpExcluded[${i}]`;
            for (const key of Object.keys(r ?? {}))
              if (key !== "start" && key !== "end") unsupported(id, `${where}.${key}`, "Labber'da karşılığı olmayan DHCP dışlama alanı");
            const lo = String(r?.["start"] ?? "");
            const hi = String(r?.["end"] ?? lo);
            if (!isIp(lo) || !isIp(hi) || ipToInt(hi) < ipToInt(lo)) return reject(id, where, "Geçersiz DHCP dışlanan adres aralığı");
            (cfg.dhcpExcluded ?? (cfg.dhcpExcluded = [])).push({ lo, hi });
          });
      }
      const list = Array.isArray(d.staticRoutes) ? d.staticRoutes : [];
      if (d.staticRoutes !== void 0 && !Array.isArray(d.staticRoutes)) reject(id, "staticRoutes", "Statik rota listesi dizi olmalı");
      list.forEach((r, i) => {
        const where = `staticRoutes[${i}]`;
        for (const key of Object.keys(r ?? {}))
          if (!STATIC_ROUTE_FIELDS.has(key)) unsupported(id, `${where}.${key}`, "Labber'da karşılığı olmayan statik rota alanı");
        const prefix = isIp(r?.mask ?? "") ? maskToPrefix(r.mask) : null;
        const ad = r?.distance === void 0 ? 1 : Number(r.distance);
        if (!isIp(r?.network ?? "") || prefix === null || !isIp(r?.nextHop ?? "")) return reject(id, where, "Geçersiz statik rota (ağ/maske/next-hop)");
        if (networkOf(r.network, prefix) !== r.network) return reject(id, where, "Statik rota ağ adresi maskeyle hizalı değil");
        if (!Number.isInteger(ad) || ad < 1 || ad > 255) return reject(id, where, "Statik rota AD 1-255 arasında tam sayı olmalı");
        if (cfg.routes.some((x) => x.net === r.network && x.mask === r.mask && x.nh === r.nextHop))
          return reject(id, where, "Aynı ağ ve next-hop ile yinelenen statik rota");
        cfg.routes.push(ad === 1 ? { net: r.network, mask: r.mask, nh: r.nextHop } : { net: r.network, mask: r.mask, nh: r.nextHop, ad });
      });
      if (d.route !== void 0 && d.route !== "") {
        if (typeof d.route !== "string" || !isIp(d.route)) reject(id, "route", "Geçersiz varsayılan rota next-hop'u: " + String(d.route));
        else if (!cfg.routes.some((x) => x.net === "0.0.0.0" && x.mask === "0.0.0.0")) cfg.routes.push({ net: "0.0.0.0", mask: "0.0.0.0", nh: d.route });
      }
      if (d.ospf !== void 0 && d.ospf !== null) {
        const o = d.ospf;
        for (const key of Object.keys(o))
          if (!OSPF_FIELDS.has(key)) unsupported(id, `ospf.${key}`, "Labber'da karşılığı olmayan AğLab OSPF alanı");
        const pid = Number(o["pid"] ?? 1);
        const rid = o["routerId"] ?? null;
        const nets = Array.isArray(o["networks"]) ? o["networks"] : [];
        if (!Number.isInteger(pid) || pid < 1 || pid > 65535) reject(id, "ospf.pid", "Geçersiz OSPF süreç numarası");
        else if (rid !== null && rid !== "" && !isIp(String(rid))) reject(id, "ospf.routerId", "Geçersiz OSPF router-id");
        else {
          const ospf = {
            pid,
            routerId: rid ? String(rid) : null,
            activeRid: rid ? String(rid) : null,
            networks: [],
            passiveDefault: false,
            passive: [],
            refBw: 100,
            defaultOriginate: null,
            stubs: {}
          };
          nets.forEach((n, i) => {
            for (const key of Object.keys(n ?? {}))
              if (!["network", "wildcard", "area"].includes(key)) unsupported(id, `ospf.networks[${i}].${key}`, "Labber'da karşılığı olmayan OSPF network alanı");
            const area = Number(n?.["area"]);
            if (!isIp(String(n?.["network"] ?? "")) || !isIp(String(n?.["wildcard"] ?? "")) || !Number.isInteger(area) || area < 0)
              reject(id, `ospf.networks[${i}]`, "Geçersiz OSPF network satırı");
            else ospf.networks.push({ addr: String(n["network"]), wildcard: String(n["wildcard"]), area });
          });
          cfg.ospf = ospf;
        }
      }
      running[id] = cfg;
    };
    for (const d of devices) {
      const id = String(d.id);
      if (ids.has(id)) {
        reject(id, "id", "Yinelenen cihaz kimliği");
        continue;
      }
      ids.add(id);
      const fields = d.type === "PC" ? PC_FIELDS : d.type === "Server" ? SERVER_FIELDS : d.type === "Switch" ? SWITCH_FIELDS : d.type === "Router" ? ROUTER_FIELDS : null;
      if (!fields) {
        unsupported(id, "type", `${d.type} cihaz tipi Labber köprüsünde yok`);
        continue;
      }
      for (const key of Object.keys(d))
        if (!DEVICE_OPAQUE.has(key) && !fields.has(key))
          unsupported(id, key, FEATURE_REASON[key] ?? "Labber'da karşılığı olmayan alan");
      const off = d.enabled === false;
      if (d.type === "Server") {
        const services = d.services;
        if (services !== void 0 && (typeof services !== "object" || services === null || Array.isArray(services)))
          reject(id, "services", "Servis listesi nesne olmalı");
        else
          for (const [name, on] of Object.entries(services ?? {})) {
            if (typeof on !== "boolean") reject(id, `services.${name}`, "Servis durumu true/false olmalı");
            else if (name !== "dhcp" && name !== "dns" && name !== "http" && on)
              unsupported(id, `services.${name}`, "Bilinmeyen sunucu servisleri Labber'da yok: " + name);
          }
      }
      if (d.type === "Router") {
        routerToLabber(d, id, off);
        continue;
      }
      if (d.type === "PC" || d.type === "Server") {
        const ports2 = d.ports ?? ["eth0"];
        if (ports2.length !== 1 || ports2[0] !== "eth0") reject(id, "ports", "PC yalnızca tek eth0 portuyla modellenir");
        for (const [name, iface] of Object.entries(d.interfaces ?? {})) {
          if (name !== "eth0") {
            reject(id, name, "PC arayüzü yalnızca eth0 olabilir");
            continue;
          }
          for (const key of Object.keys(iface))
            if (key !== "enabled") unsupported(id, `interfaces.eth0.${key}`, "Labber'da karşılığı olmayan PC arayüz alanı");
        }
        const ip2 = d.ip ?? "";
        const prefix = d.mask ? maskToPrefix(d.mask) : null;
        if (ip2 && !isIp(ip2)) reject(id, "ip", "Geçersiz IPv4 adresi: " + ip2);
        if (ip2 && prefix === null) reject(id, "mask", "Geçersiz alt ağ maskesi: " + d.mask);
        if (d.gateway && !isIp(d.gateway)) reject(id, "gateway", "Geçersiz ağ geçidi: " + d.gateway);
        pcs[id] = {
          ip: ip2 && isIp(ip2) && prefix !== null ? ip2 : null,
          prefix: prefix ?? 24,
          gw: d.gateway && isIp(d.gateway) ? d.gateway : null
        };
        if (d.dhcpLease !== void 0 && typeof d.dhcpLease !== "boolean") reject(id, "dhcpLease", "dhcpLease true/false olmalı");
        else if (d.dhcpLease) pcs[id].dhcp = true;
        if (d.dns !== void 0 && d.dns !== "") {
          if (typeof d.dns !== "string" || !isIp(d.dns)) reject(id, "dns", "Geçersiz DNS sunucusu adresi: " + String(d.dns));
          else pcs[id].dns = d.dns;
        }
        if (d.type === "Server") {
          const sv = d.services ?? {};
          const on = ["dhcp", "dns", "http"].filter((k) => sv[k] === true);
          if (on.length) pcs[id].services = Object.fromEntries(on.map((k) => [k, true]));
        }
        const mac = resolveMac ? intToDotted(macToInt(resolveMac(d))) : "0000.0000.0000";
        claimMac(id, mac);
        const pc = {
          id,
          kind: "pc",
          mac,
          x: Number(d.x ?? 0),
          y: Number(d.y ?? 0),
          ...d.name ? { name: d.name } : {},
          ...d.type === "Server" ? { server: true } : {},
          ...off ? { off: true } : {},
          ...d.interfaces?.["eth0"]?.enabled === false ? { nicDown: true } : {}
        };
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
      const { portMap, canonPorts } = mapPorts(id, sourcePorts);
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
        ...needsEncapFor(model) ? { needsEncap: true } : {},
        ...off ? { off: true } : {}
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
      const poRecords = [];
      for (const [name, iface] of Object.entries(ifaces)) {
        const po = /^po(\d+)$/i.exec(name);
        if (po) {
          const n = Number(po[1]);
          if (!Number.isInteger(n) || n < 1 || n > 48) reject(id, name, "Port-channel numarası 1-48 olmalı");
          else poRecords.push([name, n, iface]);
          continue;
        }
        if (/^vlan\d+$/i.test(name)) {
          const v = vlanId(name.slice(4));
          if (v === null) {
            reject(id, name, "Geçersiz SVI adı");
            continue;
          }
          for (const key of Object.keys(iface))
            if (!SVI_FIELDS.has(key)) unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? "Labber'da karşılığı olmayan SVI alanı");
          const svi2 = cfg.svis[String(v)] ?? defaultSvi(v);
          svi2.shutdown = iface.enabled === false;
          if (iface.ip) {
            const pre = iface.mask ? maskToPrefix(iface.mask) : null;
            if (!isIp(iface.ip) || pre === null) reject(id, name, "Geçersiz SVI IPv4 adresi/maskesi");
            else svi2.ip = { addr: iface.ip, mask: iface.mask };
          }
          cfg.svis[String(v)] = svi2;
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
        if (iface.portSecurity !== void 0) {
          const ps = iface.portSecurity;
          const macs = Array.isArray(ps?.["macs"]) ? ps["macs"].map((m) => typeof m === "string" ? normalizeMac(m) : null) : null;
          const max = ps?.["max"];
          if (!ps || typeof ps !== "object" || Object.keys(ps).some((k) => !PS_FIELDS.includes(k)) || typeof ps["enabled"] !== "boolean" || !Number.isInteger(max) || max < 1 || max > 1024 || !["shutdown", "restrict", "protect"].includes(String(ps["violation"])) || !macs || macs.some((m) => !m || m === "0000.0000.0000" || parseInt(m.slice(0, 2), 16) % 2 === 1) || new Set(macs).size !== macs.length || macs.length > max) reject(id, `${name}.portSecurity`, "Geçersiz portSecurity yapılandırması");
          else if (ps["enabled"] && mode !== "access") reject(id, `${name}.portSecurity`, "Port security yalnız access portta (IOS)");
          else
            phys.portSecurity = {
              enabled: ps["enabled"],
              max,
              violation: ps["violation"],
              sticky: false,
              macs,
              stickyMacs: []
            };
        }
        if (iface.errdisabled !== void 0) {
          if (typeof iface.errdisabled !== "boolean") reject(id, `${name}.errdisabled`, "errdisabled true/false olmalı");
          else if (iface.errdisabled) errdis.push(`${id}|${c}`);
        }
        if (iface["channelGroup"] !== void 0 && iface["channelGroup"] !== null) {
          const g = iface["channelGroup"];
          const gid = g?.["id"];
          if (typeof g !== "object" || Object.keys(g).some((k) => k !== "id" && k !== "mode") || !Number.isInteger(gid) || gid < 1 || gid > 48 || !CHANNEL_MODES.includes(g["mode"]))
            reject(id, `${name}.channelGroup`, "channelGroup {id: 1-48, mode: on|active|passive|desirable|auto} olmalı");
          else phys.channel = { id: gid, mode: g["mode"] };
        }
        cfg.ifaces[c] = phys;
      }
      const groups = /* @__PURE__ */ new Map();
      for (const [c, phys] of Object.entries(cfg.ifaces)) {
        if (!phys.channel) continue;
        const p = channelProto(phys.channel.mode);
        const prev = groups.get(phys.channel.id);
        if (prev !== void 0 && prev !== p) reject(id, `${c}.channelGroup`, `Port-channel ${phys.channel.id} üyelerinde protokol uyuşmazlığı`);
        groups.set(phys.channel.id, p);
      }
      for (const [name, n, iface] of poRecords) {
        for (const key of Object.keys(iface))
          if (!PO_FIELDS.has(key)) unsupported(id, `interfaces.${name}.${key}`, "Labber'da karşılığı olmayan Port-channel alanı");
        const mode = iface.mode ?? "access";
        if (mode !== "access" && mode !== "trunk") {
          reject(id, `${name}.mode`, "Bilinmeyen port modu: " + mode);
          continue;
        }
        const access = vlanId(iface.vlan ?? 1);
        const native = vlanId(iface.nativeVlan ?? 1);
        const allowed = (iface.allowed ?? []).map(vlanId);
        if (access === null || native === null || allowed.some((x) => x === null)) {
          reject(id, name, "Geçersiz Port-channel VLAN değeri");
          continue;
        }
        cfg.pos[String(n)] = {
          ...defaultL2(),
          shutdown: iface.enabled === false,
          mode,
          accessVlan: access,
          nativeVlan: native,
          allowed: [...new Set(allowed)].sort(sortNum),
          encapDot1q: mode === "trunk" && !!sw.needsEncap
        };
      }
      for (const [c, phys] of Object.entries(cfg.ifaces)) {
        if (!phys.channel || cfg.pos[String(phys.channel.id)]) continue;
        const { channel: _c, routed: _r, ip: _i, l3: _l, bpduguard: _b, portSecurity: _p, cdp: _cd, lldpTx: _t, lldpRx: _x, ...l2 } = phys;
        cfg.pos[String(phys.channel.id)] = { ...defaultL2(), ...l2, shutdown: false, description: "" };
        void [_c, _r, _i, _l, _b, _p, _cd, _t, _x, c];
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
      if (a && b) def.links.push(l.up === false ? { a, b, up: false } : { a, b });
    });
    const reasons = /* @__PURE__ */ new Set();
    for (const u of report.unsupported) reasons.add(u.reason);
    for (const r of report.rejected) reasons.add("Reddedildi: " + r.reason);
    report.reasons = [...reasons].sort();
    report.expressible = !report.unsupported.length && !report.rejected.length;
    return { def, running, pcs, report, ...errdis.length ? { errdis } : {}, ...nat.length ? { nat } : {} };
  }
  function createRuntime(result) {
    return new LabRuntime(result.def, (rt) => {
      for (const [id, cfg] of Object.entries(result.running)) rt.running[id] = clone(cfg);
      for (const [id, pc] of Object.entries(result.pcs)) rt.pcs[id] = clone(pc);
      for (const k of result.errdis ?? []) {
        rt.errdis.add(k);
        rt.errCause.set(k, "psecure-violation");
      }
      rt.natTable = clone(result.nat ?? []);
    });
  }
  var BridgeError = class extends Error {
  };
  function toAglab(rt, original) {
    const out = clone(original);
    const portNames = toLabber(original).report.portNames;
    const canonOf = (dev, port) => Object.entries(portNames[dev] ?? {}).find(([, o]) => o === port)?.[0];
    const outLinks = out.links ?? [];
    if (rt.def && rt.def.links.length === outLinks.length)
      rt.def.links.forEach((dl, i) => {
        const l = outLinks[i];
        for (const [side, end] of [["a", dl.a], ["b", dl.b]]) {
          const portKey = side === "a" ? "portA" : "portB";
          const [dev, canon] = end;
          if (String(l[side]) === dev && canonOf(dev, String(l[portKey])) === canon) continue;
          const name = portNames[dev]?.[canon];
          if (!name) throw new BridgeError(`${dev}:${canon} AğLab port listesinde yok`);
          l[side] = dev;
          l[portKey] = name;
        }
      });
    if (rt.hw)
      for (const l of out.links ?? []) {
        const ca = canonOf(String(l.a), String(l.portA));
        const cb = canonOf(String(l.b), String(l.portB));
        if (!ca || !cb) continue;
        const cut = rt.hw.cut.has(`${l.a}|${ca}`) || rt.hw.cut.has(`${l.b}|${cb}`);
        if (l.up !== void 0 || cut) l.up = !cut;
      }
    for (const d of out.devices) {
      const id = String(d.id);
      if (rt.hw && ["PC", "Server", "Switch", "Router"].includes(d.type) && portNames[id]) {
        const on = !rt.hw.off.has(id);
        if (d.enabled !== void 0 || !on) d.enabled = on;
        if (d.type === "PC" || d.type === "Server") {
          const nic = !rt.hw.nicDown.has(id);
          const eth0 = d.interfaces?.["eth0"];
          if (eth0?.enabled !== void 0 || !nic) {
            d.interfaces = d.interfaces ?? {};
            d.interfaces["eth0"] = { ...eth0 ?? {}, enabled: nic };
          }
        }
      }
      if ((d.type === "PC" || d.type === "Server") && rt.pcs[id]) {
        const pc = rt.pcs[id];
        const ip2 = pc.ip ?? "";
        if (d.ip !== void 0 || ip2) d.ip = ip2;
        if (pc.ip !== null && (d.mask !== void 0 || pc.ip)) d.mask = prefixToMask(pc.prefix);
        const gw2 = pc.gw ?? "";
        if (d.gateway !== void 0 || gw2) d.gateway = gw2;
        const lease = !!pc.dhcp && !!pc.ip && !isApipa(pc.ip);
        if (d.dhcpLease !== void 0 || lease) d.dhcpLease = lease;
        const dns = pc.dns ?? "";
        if (d.dns !== void 0 || dns) d.dns = dns;
        if (d.type === "Server") {
          const prev = d.services ?? {};
          const next = { ...prev };
          for (const k of ["dhcp", "dns", "http"]) {
            const on = !!pc.services?.[k];
            if (k in prev || on) next[k] = on;
          }
          if (d.services !== void 0 || Object.keys(next).length) d.services = next;
        }
        continue;
      }
      if (d.type === "Router" && rt.running[id]) {
        routerToAglab(d, rt.running[id], portNames[id] ?? {}, original.devices.find((x) => String(x.id) === id), rt.natTable);
        continue;
      }
      if (d.type !== "Switch" || !rt.running[id]) continue;
      const cfg = rt.running[id];
      const fail = (what) => {
        throw new BridgeError(`${id}: ${what} AğLab modelinde ifade edilemiyor`);
      };
      if (cfg.hostname !== (d.name || id)) d.name = cfg.hostname;
      d.interfaces = d.interfaces ?? {};
      for (const name of Object.keys(d.interfaces)) {
        const m = /^po(\d+)$/i.exec(name);
        if (m && !cfg.pos[String(Number(m[1]))]) delete d.interfaces[name];
      }
      for (const [n, po] of Object.entries(cfg.pos)) {
        if (po.mode !== "access" && po.mode !== "trunk") fail(`Port-channel${n} modu ${po.mode}`);
        if (po.allowed === null) fail(`Port-channel${n} "allowed vlan all"`);
        if (po.nonegotiate) fail(`Port-channel${n} nonegotiate`);
        if (po.portfast) fail(`Port-channel${n} portfast`);
        if (po.description) fail(`Port-channel${n} description`);
        const key = Object.keys(d.interfaces).find((k) => /^po\d+$/i.test(k) && Number(k.slice(2)) === Number(n)) ?? `po${n}`;
        const prev = d.interfaces[key];
        const next = prev ? { ...prev } : {};
        next.mode = po.mode;
        next.vlan = po.accessVlan;
        next.allowed = [...po.allowed];
        next.nativeVlan = po.nativeVlan;
        next.enabled = !po.shutdown;
        d.interfaces[key] = next;
      }
      if (cfg.loopbacks && Object.keys(cfg.loopbacks).length) fail("Loopback");
      if (cfg.ospf) fail("OSPF");
      if (cfg.routes.length) fail("statik rota");
      if (cfg.ipRouting) fail("ip routing");
      if (cfg.stpMode !== "pvst") fail("spanning-tree mode " + cfg.stpMode);
      if (cfg.bpduguardDefault) fail("spanning-tree portfast bpduguard default");
      if (cfg.errRecoveryBpdu || cfg.errRecoveryInterval !== void 0) fail("errdisable recovery");
      if (Object.keys(cfg.dhcpPools ?? {}).length || cfg.dhcpExcluded?.length) fail("switch üzerinde DHCP sunucusu");
      const gw = cfg.defaultGateway ?? "";
      if (d.gateway !== void 0 || gw) d.gateway = gw;
      const hadOne = (original.devices.find((x) => String(x.id) === id)?.vlans ?? [1]).map(Number).includes(1);
      const vlans3 = Object.keys(cfg.vlans).map(Number).filter((v) => !RESERVED_VLANS.slice(1).includes(v) && (v !== 1 || hadOne)).sort(sortNum);
      if (d.vlans !== void 0 || vlans3.join() !== "1") d.vlans = vlans3;
      const names = {};
      for (const v of vlans3) {
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
      for (const [canon, raw] of Object.entries(cfg.ifaces)) {
        const name = back[canon];
        if (!name) continue;
        const prevMode = d.interfaces[name]?.mode;
        const phys = raw.mode === "dynamic-auto" && (prevMode === void 0 || prevMode === "access") ? { ...raw, mode: "access", allowed: raw.allowed ?? (d.interfaces[name]?.allowed ?? [1]) } : raw;
        if (phys.mode !== "access" && phys.mode !== "trunk") fail(`${canon} modu ${phys.mode}`);
        if (phys.routed) fail(`${canon} routed port`);
        if (phys.portfast) fail(`${canon} portfast`);
        if (phys.nonegotiate) fail(`${canon} nonegotiate`);
        if (phys.description) fail(`${canon} description`);
        if (phys.bpduguard !== void 0) fail(`${canon} bpduguard`);
        if (phys.portSecurity?.sticky || phys.portSecurity?.stickyMacs.length) fail(`${canon} port-security mac-address sticky`);
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
        put("allowed", phys.allowed ?? ALL_VLANS2, []);
        put("nativeVlan", phys.nativeVlan, def.nativeVlan);
        put("enabled", !phys.shutdown, true);
        const ps = phys.portSecurity;
        if (ps) {
          const old = prev?.["portSecurity"] ?? {};
          const macs = ps.macs.map((m) => old.macs?.find((x) => normalizeMac(x) === m) ?? colonMac(m));
          iface["portSecurity"] = { enabled: ps.enabled, max: ps.max, violation: ps.violation, macs };
        } else if (prev && "portSecurity" in prev) delete iface["portSecurity"];
        if (rt.errdis) {
          const on = rt.errdis.has(`${id}|${canon}`);
          if (prev && "errdisabled" in prev || on) iface["errdisabled"] = on;
        }
        if (phys.channel) iface["channelGroup"] = { id: phys.channel.id, mode: phys.channel.mode };
        else delete iface["channelGroup"];
        if (prev || Object.keys(iface).length) d.interfaces[name] = iface;
      }
      for (const [v, svi2] of Object.entries(cfg.svis)) {
        const name = "vlan" + v;
        if (svi2.description) fail(`Vlan${v} description`);
        if (svi2.l3) fail(`Vlan${v} L3/OSPF ayarı`);
        const prev = d.interfaces[name];
        if (!prev && !svi2.ip && JSON.stringify(svi2) === JSON.stringify(defaultSvi(Number(v)))) continue;
        const iface = prev ? { ...prev } : { vlan: Number(v) };
        if (svi2.ip) {
          iface.ip = svi2.ip.addr;
          iface.mask = svi2.ip.mask;
        } else {
          if (prev?.ip !== void 0) iface.ip = "";
          if (prev?.mask !== void 0) iface.mask = "";
        }
        if (prev?.enabled !== void 0 || svi2.shutdown) iface.enabled = !svi2.shutdown;
        d.interfaces[name] = iface;
      }
    }
    return out;
  }
  function routerToAglab(d, cfg, back, orig, natTable) {
    const id = String(d.id);
    const fail = (what) => {
      throw new BridgeError(`${id}: ${what} AğLab modelinde ifade edilemiyor`);
    };
    if (cfg.hostname !== (d.name || id)) d.name = cfg.hostname;
    if (cfg.loopbacks && Object.keys(cfg.loopbacks).length) fail("Loopback");
    if (!cfg.ipRouting) fail("no ip routing");
    if (cfg.defaultGateway) fail("ip default-gateway");
    {
      const rules = aclsBack(cfg, orig, fail);
      const prevRules = JSON.stringify(orig.acls ?? null);
      const same2 = JSON.stringify(rules.map((r) => ({ ...r }))) === prevRules;
      if (!same2 && (d.acls !== void 0 || rules.length)) d.acls = rules;
    }
    d.interfaces = d.interfaces ?? {};
    const aglabIf = (canon) => {
      const dot = canon.indexOf(".");
      const physName = back[dot < 0 ? canon : canon.slice(0, dot)];
      if (!physName) fail(`${canon} (izlenen arayüz)`);
      return physName + (dot < 0 ? "" : canon.slice(dot));
    };
    {
      const ids = Object.keys(cfg.tracks ?? {}).map(Number).sort((a, b) => a - b);
      const list2 = ids.map((n) => ({ id: n, interface: aglabIf(cfg.tracks[String(n)].iface) }));
      const same2 = orig.tracks?.length === list2.length && list2.every((t, i) => {
        const o2 = orig.tracks[i];
        return o2["id"] === t.id && canonPort(String(o2["interface"]).split(".")[0]) === canonPort(t.interface.split(".")[0]) && String(o2["interface"]).split(".")[1] === t.interface.split(".")[1];
      });
      if (same2) d.tracks = clone(orig.tracks);
      else if (list2.length || d.tracks !== void 0) d.tracks = list2;
    }
    for (const [canon, phys] of Object.entries(cfg.ifaces)) {
      const name = back[canon];
      if (!name) continue;
      if (phys.description) fail(`${canon} description`);
      const helper = helperBack(phys.l3, canon, fail);
      const prev2 = d.interfaces[name];
      if (!prev2 && !phys.ip && !phys.shutdown && !helper && !phys.l3?.aclIn && !phys.l3?.aclOut && !phys.l3?.nat && !phys.l3?.hsrp && !phys.l3?.vrrp) continue;
      const iface = prev2 ? { ...prev2 } : {};
      if (phys.ip) {
        iface.ip = phys.ip.addr;
        iface.mask = phys.ip.mask;
      } else if (prev2?.ip !== void 0) iface.ip = "";
      if (prev2?.enabled !== void 0 || phys.shutdown) iface.enabled = !phys.shutdown;
      if (helper) iface["helperAddress"] = helper;
      else if (iface["helperAddress"] !== "") delete iface["helperAddress"];
      groupsBack(iface, phys.l3);
      natRoleBack(iface, phys.l3);
      fhrpBack(iface, phys.l3, aglabIf);
      d.interfaces[name] = iface;
    }
    const subNames = /* @__PURE__ */ new Set();
    for (const [canon, si] of Object.entries(cfg.subifs ?? {})) {
      const physName = back[si.parent];
      if (!physName) fail(`${canon} fiziksel portu`);
      const name = physName + canon.slice(canon.indexOf("."));
      subNames.add(name);
      if (si.native) fail(`${canon} encapsulation dot1Q ${si.vlan} native`);
      if (si.description) fail(`${canon} description`);
      const helper = helperBack(si.l3, canon, fail);
      const prev2 = d.interfaces[name];
      const iface = prev2 ? { ...prev2 } : { ip: "", mask: "255.255.255.0", enabled: true, vlan: 1, encapsulation: "", parent: physName };
      if (si.ip || "ip" in iface) iface.ip = si.ip?.addr ?? "";
      if (si.ip) iface.mask = si.ip.mask;
      if (si.shutdown || "enabled" in iface) iface.enabled = !si.shutdown;
      if (si.vlan === null) {
        if ("encapsulation" in iface) iface.encapsulation = "";
      } else {
        iface.encapsulation = "dot1q";
        iface.vlan = si.vlan;
      }
      if (prev2?.parent !== void 0 || !prev2) iface.parent = physName;
      if (helper) iface["helperAddress"] = helper;
      else if (iface["helperAddress"] !== "") delete iface["helperAddress"];
      groupsBack(iface, si.l3);
      natRoleBack(iface, si.l3);
      fhrpBack(iface, si.l3, aglabIf);
      d.interfaces[name] = iface;
    }
    for (const name of Object.keys(d.interfaces)) if (name.includes(".") && !subNames.has(name)) delete d.interfaces[name];
    natBack(d, cfg, back, orig, natTable ?? [], fail);
    const pools = Object.entries(cfg.dhcpPools ?? {}).map(([name, p]) => {
      const next = { name, network: p.net?.addr ?? "", mask: p.net?.mask ?? "" };
      if (p.defaultRouter) next["defaultRouter"] = p.defaultRouter;
      if (p.dns) next["dnsServer"] = p.dns;
      const kept = (orig.dhcpPools ?? []).find(
        (a) => a["name"] === name && (a["network"] ?? "") === next["network"] && (a["mask"] ?? "") === next["mask"] && (a["defaultRouter"] ?? "") === (p.defaultRouter ?? "") && (a["dnsServer"] ?? "") === (p.dns ?? "")
      );
      return kept ? clone(kept) : next;
    });
    if (d.dhcpPools !== void 0 || pools.length) d.dhcpPools = pools;
    const excluded = (cfg.dhcpExcluded ?? []).map((r) => {
      const kept = (orig.dhcpExcluded ?? []).find((a) => a["start"] === r.lo && String(a["end"] ?? a["start"]) === r.hi);
      return kept ? clone(kept) : { start: r.lo, end: r.hi };
    });
    if (d.dhcpExcluded !== void 0 || excluded.length) d.dhcpExcluded = excluded;
    const legacyDefault = typeof orig.route === "string" && orig.route !== "" && !(orig.staticRoutes ?? []).some((r) => r.network === "0.0.0.0" && r.mask === "0.0.0.0");
    let routes = cfg.routes;
    if (legacyDefault) {
      const i = routes.findIndex((r) => r.net === "0.0.0.0" && r.mask === "0.0.0.0" && r.nh === orig.route && (r.ad ?? 1) === 1);
      if (i >= 0) routes = routes.filter((_, j) => j !== i);
      else d.route = "";
    }
    const same = (a, r) => a.network === r.net && a.mask === r.mask && a.nextHop === r.nh && Number(a.distance ?? 1) === (r.ad ?? 1);
    const list = routes.map((r) => {
      const kept = (orig.staticRoutes ?? []).find((a) => same(a, r));
      return kept ? clone(kept) : { network: r.net, mask: r.mask, nextHop: r.nh, distance: r.ad ?? 1 };
    });
    if (d.staticRoutes !== void 0 || list.length) d.staticRoutes = list;
    const o = cfg.ospf;
    if (!o) {
      if (d.ospf !== void 0 && d.ospf !== null) delete d.ospf;
      return;
    }
    if (o.passiveDefault || o.passive.length) fail("passive-interface");
    if (o.refBw !== 100) fail("auto-cost reference-bandwidth");
    if (o.defaultOriginate) fail("default-information originate");
    if (Object.keys(o.stubs).length) fail("stub area");
    const prev = orig.ospf ?? {};
    const ospf = { ...prev, pid: o.pid };
    if (o.routerId || prev["routerId"] !== void 0) ospf["routerId"] = o.routerId ?? "";
    ospf["networks"] = o.networks.map((n) => ({ network: n.addr, wildcard: n.wildcard, area: n.area }));
    d.ospf = ospf;
  }
  function helperBack(l3, canon, fail) {
    if (!l3) return null;
    const { helpers: helpers2, aclIn: _in, aclOut: _out, nat: _nat, hsrp: _h, vrrp: _v, ...rest } = l3;
    if (Object.keys(rest).length) fail(`${canon} arayüz OSPF/L3 ayarı`);
    if (helpers2 && helpers2.length > 1) fail(`${canon} üzerinde birden çok ip helper-address`);
    return helpers2?.[0] ?? null;
  }
  function fhrpBack(iface, l3, aglabIf) {
    for (const proto of ["hsrp", "vrrp"]) {
      const list = l3?.[proto];
      if (!list?.length) {
        if (Array.isArray(iface[proto]) && iface[proto].length === 0) continue;
        delete iface[proto];
        continue;
      }
      const prevList = Array.isArray(iface[proto]) ? iface[proto] : [];
      iface[proto] = list.map((g) => {
        const prev = prevList.find((x) => x?.["group"] === g.group);
        const o = prev ? clone(prev) : {};
        o["group"] = g.group;
        if (g.ip) o["ip"] = g.ip;
        else if (o["ip"] !== "") delete o["ip"];
        if (g.priority !== void 0) o["priority"] = g.priority;
        else if (o["priority"] !== 100) delete o["priority"];
        const preempt = proto === "hsrp" ? !!g.preempt : g.preempt !== false;
        if (preempt !== (proto === "vrrp")) o["preempt"] = preempt;
        else if (o["preempt"] !== preempt) delete o["preempt"];
        if (proto === "hsrp") {
          const tracks = (g.tracks ?? []).map((t) => ({
            ...t.obj !== void 0 ? { object: t.obj } : { interface: aglabIf(t.iface) },
            ...t.decrement !== void 0 ? { decrement: t.decrement } : {}
          }));
          const prevTracks = JSON.stringify(o["track"] ?? []);
          if (tracks.length) {
            if (JSON.stringify(tracks) !== prevTracks) o["track"] = tracks;
          } else if (!(Array.isArray(o["track"]) && o["track"].length === 0)) delete o["track"];
        }
        return o;
      });
    }
  }
  function natRoleBack(iface, l3) {
    if (l3?.nat) iface["natRole"] = l3.nat;
    else if (iface["natRole"] !== "") delete iface["natRole"];
  }
  function natBack(d, cfg, back, orig, table, fail) {
    const n = cfg.nat;
    if (n?.statics.length) fail("Statik NAT (ip nat inside source static)");
    if (n && Object.keys(n.pools).length) fail("NAT havuzu (ip nat pool)");
    const rules = n?.rules ?? [];
    if (rules.length > 1) fail("Birden çok dinamik NAT eşlemesi");
    const r = rules[0];
    if (r && (!r.iface || !r.overload)) fail(`NAT eşlemesi (${r.iface ? "overload olmadan" : "havuzla"})`);
    if (r) {
      const dot = r.iface.indexOf(".");
      const name = dot < 0 ? back[r.iface] : back[r.iface.slice(0, dot)] && back[r.iface.slice(0, dot)] + r.iface.slice(dot);
      if (!name) fail(`NAT outside arayüzü ${r.iface}`);
      const prev = orig.natOverload;
      const aclId = prev && String(prev["aclId"]) === r.acl ? prev["aclId"] : r.acl;
      d.natOverload = { aclId, outsideInterface: name };
    } else if (d.natOverload !== void 0) delete d.natOverload;
    const id = String(d.id);
    const entries = [];
    for (const e of table) {
      if (e.dev !== id || e.proto === null || !e.outsideLocal) continue;
      const key = [e.insideLocal, e.outsideLocal, e.proto].join("|");
      if (entries.some((x) => x["key"] === key)) continue;
      entries.push({ key, protocol: e.proto, insideLocal: e.insideLocal, insideGlobal: e.insideGlobal, outsideLocal: e.outsideLocal });
    }
    if (JSON.stringify(entries) === JSON.stringify(orig.natTranslations ?? [])) return;
    if (d.natTranslations !== void 0 || entries.length) d.natTranslations = entries;
  }
  function groupsBack(iface, l3) {
    for (const k of ["aclIn", "aclOut"]) {
      if (l3?.[k]) iface[k] = l3[k];
      else if (iface[k] !== "") delete iface[k];
    }
  }
  function aclsBack(cfg, orig, fail) {
    const lists = cfg.acls ?? {};
    const origOrder = [...new Set((orig.acls ?? []).map((r) => String(r["id"])))];
    const origId = (n) => (orig.acls ?? []).find((r) => String(r["id"]) === n)?.["id"] ?? (aclKind(n) ? Number(n) : n);
    const names = [...origOrder.filter((n) => lists[n]), ...Object.keys(lists).filter((n) => !origOrder.includes(n))];
    const out = [];
    const side = (a, pre) => {
      if (a.wild === "255.255.255.255") return { [pre + "Type"]: "any", [pre]: "" };
      if (a.wild === "0.0.0.0") return { [pre + "Type"]: "host", [pre]: a.addr };
      return { [pre + "Type"]: "network", [pre]: a.addr, [pre === "src" ? "wildcard" : "dstWildcard"]: a.wild };
    };
    for (const n of names) {
      for (const e of lists[n].entries) {
        if (e.srcPort) fail(`ACL ${n} ${e.seq} kaynak portu`);
        if (e.dstPort && e.dstPort.op !== "eq") fail(`ACL ${n} ${e.seq} port işleci ${e.dstPort.op}`);
        if (e.icmpType) fail(`ACL ${n} ${e.seq} ICMP türü`);
        out.push({
          id: origId(n),
          action: e.action,
          protocol: e.proto,
          ...side(e.src, "src"),
          ...side(e.dst ?? { addr: "0.0.0.0", wild: "255.255.255.255" }, "dst"),
          ...e.dstPort ? { port: e.dstPort.a } : {}
        });
      }
    }
    return out;
  }

  // src/sim-bridge/events.ts
  var nk3 = (n) => `${n.dev}|${n.vlan}`;
  var colon = (mac) => {
    const h = mac.replace(/[^0-9a-f]/gi, "").toLowerCase();
    return h.length === 12 ? h.match(/../g).join(":") : mac;
  };
  function l2Path(rt, a, b) {
    const d = rt.derived;
    if (!a.node || !b.node) return null;
    const dom = l2Domain(d, a.node);
    const chain = [];
    let cur = dom.nodes.get(nk3(b.node));
    if (!cur) return null;
    while (cur.via) {
      const prev = dom.nodes.get(cur.via.from);
      if (!prev) return null;
      chain.unshift({ from: prev.node.dev, out: cur.via.out, to: cur.node, in: cur.via.in });
      cur = prev;
    }
    const steps = [];
    for (const c of chain) {
      const link = rt.def.links.find(
        (l) => [
          [l.a, l.b],
          [l.b, l.a]
        ].some(
          ([x2, y2]) => x2[0] === c.from && y2[0] === c.to.dev && d.lportOfPhys[pk(x2[0], x2[1])]?.name === c.out && d.lportOfPhys[pk(y2[0], y2[1])]?.name === c.in && rt.cableIntact(x2[0], x2[1])
        )
      );
      if (!link) return null;
      const fwd = link.a[0] === c.from && d.lportOfPhys[pk(link.a[0], link.a[1])]?.name === c.out;
      const [x, y] = fwd ? [link.a, link.b] : [link.b, link.a];
      steps.push({ from: x[0], out: x[1], to: y[0], in: y[1], vlan: nodeVlan(c.to) });
    }
    for (const [ifc, atStart] of [
      [a, true],
      [b, false]
    ]) {
      if (ifc.kind !== "pc") continue;
      const at = rt.topo.pcAttach[ifc.dev];
      if (!at || !rt.cableIntact(ifc.dev, "eth0")) return null;
      const vlan = nodeVlan(ifc.node);
      if (atStart) steps.unshift({ from: ifc.dev, out: "eth0", to: at.dev, in: at.port, vlan });
      else steps.push({ from: at.dev, out: at.port, to: ifc.dev, in: "eth0", vlan });
    }
    return steps;
  }
  function pingDiagnosis(rt, from, dst, r) {
    if (r.ok) return null;
    const d = rt.derived;
    if (r.reason === "off") return "Kaynak cihaz kapalı.";
    if (r.reason === "noip") return "Kaynakta geçerli IPv4 adresi yok.";
    if (r.reason === "noroute") return `Kaynakta ${dst} için yol yok (aynı alt ağda değil ve ağ geçidi yok).`;
    if (r.reason === "unreach") return `${r.unreachFrom} ${dst} için rota bulamadı ya da ACL engelledi (ICMP unreachable).`;
    if (r.reason === "expired") return `TTL ${r.expiredFrom} üzerinde bitti (ICMP Time Exceeded).`;
    const at = d.topo.pcAttach[from];
    if (at) {
      const lp = d.lportOfPhys[pk(at.dev, at.port)];
      if (lp?.inactive) return `VLAN ${lp.cfg.accessVlan} ${at.dev} üzerinde tanımlı değil (${at.port} inactive).`;
      const vlan = lp && lp.opMode === "access" ? lp.cfg.accessVlan : null;
      if (vlan !== null) {
        for (const ports2 of Object.values(d.lports))
          for (const p of ports2)
            if (p.active && p.opMode === "trunk" && !p.peerIsPc && p.peerDev && !p.routed && !allows(p.cfg, vlan))
              return `VLAN ${vlan}, ${p.dev} ${p.name} trunk'ında izinli değil (switchport trunk allowed vlan).`;
      }
    }
    return "Yanıt gelmedi: hedefe ya da dönüşte kaynağa katman 2 yolu veya dönüş rotası yok.";
  }
  function pingTrace(rt, from, dst, portName = (_dev, port) => port, opts = {}) {
    const d = rt.derived;
    const r = ping(d, from, dst, opts.ttl !== void 0 ? { ttl: opts.ttl } : {});
    const records = [];
    let unreachCode = 1;
    const pushDiag = () => {
      const reason = pingDiagnosis(rt, from, dst, r);
      if (!reason) return;
      const first = records.findIndex((x) => x.raw.startsWith("discard ") || x.raw.startsWith("icmp-undelivered "));
      records.splice(first < 0 ? records.length : first, 0, { raw: "diagnostic " + JSON.stringify({ source: from, reason, origin: "adapter-derived" }) });
    };
    let frameNo = 0;
    let l2 = true;
    const ifOf = (dev, ip2) => l3Ifs(d, dev).find((i) => i.ip === ip2) ?? null;
    const walk2 = (kind, start, hops, srcIp, dstIp, baseTtl) => {
      let ttl = baseTtl;
      let sender = start;
      for (const hop of hops) {
        if (sender !== start) {
          records.push({ raw: `ttl-forward ${sender} ${ttl} -> ${ttl - 1}` });
          ttl--;
        }
        const target = ifOf(hop.dev, hop.ip);
        const frameId = "lf" + ++frameNo;
        const frame = {
          protocol: "ICMP",
          kind,
          sourceMac: colon(hop.outIf.mac),
          destinationMac: colon(target?.mac ?? ""),
          vlan: hop.outIf.node ? nodeVlan(hop.outIf.node) : 0,
          etherType: "0x0800",
          arp: null,
          // L5-d: NAT'tan sonra kablodaki adresler (hop.src/dst)
          ipv4: { sourceIp: hop.src ?? srcIp, destinationIp: hop.dst ?? dstIp, ttl, protocol: 1 },
          icmp: kind === "icmp-unreachable" ? { type: 3, code: unreachCode } : { type: kind === "icmp-request" ? 8 : kind === "icmp-time-exceeded" ? 11 : 0, code: 0 }
        };
        const ev = { frameId, frame };
        records.push({ raw: `frame ${kind} src ${sender} dst ${frame.destinationMac} vlan ${frame.vlan}`, ...ev });
        const steps = target ? l2Path(rt, hop.outIf, target) : null;
        if (!steps) l2 = false;
        let lastIn = "local";
        for (const s of steps ?? []) {
          if (rt.topo.devices[s.from]?.kind === "switch" && (s.from !== sender || lastIn !== "local"))
            records.push({
              raw: `unicast ${s.from} ingress ${lastIn === "local" ? "local" : portName(s.from, lastIn)} egress ${portName(s.from, s.out)} vlan ${s.vlan}`,
              ...ev
            });
          lastIn = s.in;
          records.push({
            raw: `wire ${kind} ${s.from} -> ${s.to}`,
            ...ev,
            kind: "wire",
            device: s.from,
            edge: { a: s.from, portA: portName(s.from, s.out), b: s.to, portB: portName(s.to, s.in) }
          });
        }
        records.push({ raw: `receive ${hop.dev} ${kind} vlan ${frame.vlan}`, ...ev, ...steps?.length ? { ingressPort: portName(hop.dev, steps[steps.length - 1].in) } : {} });
        sender = hop.dev;
      }
      return sender;
    };
    const fwd = r.forward;
    const src = sourceIp(d, from, dst);
    if (!fwd || !src) {
      records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? "noroute"}` });
      pushDiag();
      return { ok: false, l2: true, records };
    }
    const reached = walk2("icmp-request", from, fwd.hops, src, dst, opts.ttl ?? 64);
    if (fwd.kind === "expired") {
      records.push({ raw: `ttl-expired ${fwd.at}` });
      const back2 = r.back;
      const backTo2 = back2 ? walk2("icmp-time-exceeded", fwd.at, back2.hops, fwd.atIp, src, 255) : fwd.at;
      if (!back2 || back2.kind !== "ok" || backTo2 !== from) records.push({ raw: `discard ${backTo2} no-return-path` });
      else records.push({ raw: `icmp-time-exceeded ${from} from ${fwd.at}` });
      records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? "expired"}` });
      pushDiag();
      return { ok: false, l2, records };
    }
    if (fwd.kind === "unreach") {
      unreachCode = fwd.filtered ? 13 : 1;
      records.push({ raw: `discard ${fwd.at} ${fwd.filtered ? "acl" : "no-route"}` });
      const back2 = r.back;
      const backTo2 = back2 ? walk2("icmp-unreachable", fwd.at, back2.hops, fwd.atIp, src, 255) : fwd.at;
      if (back2 && back2.kind === "ok" && backTo2 === from) records.push({ raw: `icmp-unreachable ${from} from ${fwd.at} code ${unreachCode}` });
      else records.push({ raw: `discard ${backTo2} no-return-path` });
      records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? "unreach"}` });
      pushDiag();
      return { ok: false, l2, records };
    }
    if (fwd.kind === "timeout" && fwd.suppressedAt) records.push({ raw: `icmp-error-suppressed ${fwd.suppressedAt}` });
    if (fwd.kind !== "ok") {
      records.push({ raw: `discard ${reached} no-l2-path` });
      records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? fwd.kind}` });
      pushDiag();
      return { ok: false, l2, records };
    }
    const replier = fwd.hops[fwd.hops.length - 1]?.dev ?? from;
    const back = r.back ?? deliver(d, replier, src);
    const base2 = rt.topo.devices[replier]?.kind === "pc" ? 64 : 255;
    const backTo = walk2("icmp-reply", replier, back.hops, dst, src, base2);
    if (!r.ok || back.kind !== "ok" || backTo !== from) {
      records.push({ raw: `discard ${backTo} no-return-path` });
      records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? "timeout"}` });
      pushDiag();
      return { ok: false, l2, records };
    }
    records.push({ raw: `icmp-delivered ${from} from ${replier}` });
    return { ok: true, l2, records };
  }

  // src/sim-bridge/cli-import.ts
  function configTexts(t) {
    const out = {};
    for (const d of t.devices ?? []) {
      const text = d.config?.["runningConfig"];
      if ((d.type === "Switch" || d.type === "Router") && typeof text === "string" && text.trim()) out[String(d.id)] = text;
    }
    return out;
  }
  function cliImport(t) {
    const bridge = toLabber(t);
    const texts = configTexts(t);
    const lines = [];
    const runtime = new LabRuntime(bridge.def, (rt) => {
      for (const [id, pc] of Object.entries(bridge.pcs)) rt.pcs[id] = clone(pc);
      for (const sw of rt.topo.switches) {
        const text = texts[sw.id];
        if (text === void 0) {
          if (bridge.running[sw.id]) rt.running[sw.id] = clone(bridge.running[sw.id]);
          continue;
        }
        lines.push(...applyConfigText(rt, sw.id, text));
      }
      rt.natTable = clone(bridge.nat ?? []);
      rt.configReport = lines;
    });
    const diffs = [];
    const extended = [];
    const converterUnmodeled = new Set(
      (t.importReport?.unmodeledConfigLines ?? []).map((r) => `${r.device}|${r.line}`)
    );
    for (const id of Object.keys(texts)) {
      const def = runtime.topo.devices[id];
      if (!def || def.kind !== "switch" || !bridge.running[id]) continue;
      const name = String(t.devices.find((d) => String(d.id) === id)?.name ?? id);
      const touched = /* @__PURE__ */ new Set();
      const globals = [];
      for (const l of lines)
        if (l.device === id && l.status === "applied" && converterUnmodeled.has(`${name}|${l.line}`)) {
          if (l.ifs?.length) for (const x of l.ifs) touched.add(x);
          else globals.push(l.command);
        }
      for (const diff of modeledDiffs(id, def, bridge.running[id], runtime.running[id], interfacesIn(texts[id]))) {
        const dot = diff.field.lastIndexOf(".");
        const iface = dot > 0 && !["routes", "vlans", "defaultGateway", "stpPriority"].includes(diff.field) ? diff.field.slice(0, dot) : null;
        if (iface ? touched.has(iface) : globals.some((c) => GLOBAL_FIELD[diff.field]?.test(c))) extended.push(diff);
        else diffs.push(diff);
      }
    }
    return { bridge, runtime, lines, diffs, extended };
  }
  var GLOBAL_FIELD = {
    routes: /^(no\s+)?ip\s+route\s/i,
    vlans: /^(no\s+)?vlan\s|^name\s|switchport\s+access\s+vlan\s/i,
    defaultGateway: /^(no\s+)?ip\s+default-gateway\s/i,
    stpPriority: /^(no\s+)?spanning-tree\s+vlan\s/i
  };
  function interfacesIn(text) {
    const out = /* @__PURE__ */ new Set();
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*interface\s+([A-Za-z-]+)\s*([\d/.:]+)\s*$/i.exec(line);
      const name = m ? canonIf(m[1], m[2]) : null;
      if (name) out.add(name);
    }
    return out;
  }
  var ip = (x) => x ? `${x.addr} ${x.mask}` : null;
  var helpers = (o) => o?.l3?.helpers ?? [];
  function modeledProjection(def, c, recorded) {
    const p = {};
    if (def.router) {
      for (const [n, i] of Object.entries(c.ifaces)) {
        if (recorded && !recorded.has(n)) continue;
        p[`${n}.ip`] = ip(i.ip);
        p[`${n}.shutdown`] = i.shutdown;
        p[`${n}.helpers`] = helpers(i);
      }
      for (const [n, s] of Object.entries(c.subifs ?? {})) {
        p[`${n}.vlan`] = s.vlan;
        p[`${n}.ip`] = ip(s.ip);
        p[`${n}.shutdown`] = s.shutdown;
        p[`${n}.helpers`] = helpers(s);
      }
      p["routes"] = c.routes.map((r) => `${r.net} ${r.mask} ${r.nh} ${r.ad ?? 1}`).sort();
      return p;
    }
    p["vlans"] = Object.fromEntries(Object.entries(c.vlans).sort(([a], [b]) => Number(a) - Number(b)));
    for (const [n, i] of Object.entries(c.ifaces)) {
      const mode = i.mode === "dynamic-auto" ? "access" : i.mode;
      p[`${n}.mode`] = mode;
      p[`${n}.accessVlan`] = i.accessVlan;
      p[`${n}.nativeVlan`] = i.nativeVlan;
      const all = i.allowed === null || i.allowed.length === 4094 && i.allowed[0] === 1 && i.allowed[4093] === 4094;
      p[`${n}.allowed`] = mode === "trunk" ? all ? "all" : i.allowed : null;
      p[`${n}.shutdown`] = i.shutdown;
      const ps = i.portSecurity;
      p[`${n}.portSecurity`] = ps?.enabled ? { max: ps.max, violation: ps.violation, macs: [...ps.macs].sort() } : null;
    }
    for (const [v, s] of Object.entries(c.svis)) {
      p[`Vlan${v}.ip`] = ip(s.ip);
      if (s.ip) p[`Vlan${v}.shutdown`] = s.shutdown;
    }
    p["defaultGateway"] = c.defaultGateway;
    p["stpPriority"] = c.stpPriority;
    return p;
  }
  function modeledDiffs(id, def, structural, cli, recorded) {
    const a = modeledProjection(def, structural, recorded);
    const b = modeledProjection(def, cli, recorded);
    const out = [];
    for (const k of [.../* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)])]) {
      if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out.push({ device: id, field: k, structural: a[k] ?? null, cli: b[k] ?? null });
    }
    return out;
  }
  function importReportWithCli(report, t, lines) {
    const name = (id) => String(t.devices.find((d) => String(d.id) === id)?.name ?? id);
    const row = (l) => ({ device: name(l.device), line: l.line, command: l.command, ...l.reason ? { reason: l.reason } : {} });
    const base2 = { ...report ?? {} };
    const out = {
      ...base2,
      converterUnmodeledConfigLines: base2["converterUnmodeledConfigLines"] ?? base2["unmodeledConfigLines"] ?? [],
      unmodeledConfigLines: lines.filter((l) => l.status === "unmodeled").map(row),
      ignoredConfigLines: lines.filter((l) => l.status === "ignored").map(row),
      labberCli: summarize(lines)
    };
    out["unmodeledConfigLineCount"] = out["unmodeledConfigLines"].length;
    out["ignoredConfigLineCount"] = out["ignoredConfigLines"].length;
    return out;
  }
  return __toCommonJS(index_exports);
})();
