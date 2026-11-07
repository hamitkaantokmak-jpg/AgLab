// Preserve explicit endpoint MACs; assign stable synthetic MACs without collisions.
const AgLabMacAddress = (() => {
  function validate(devices) {
    const seen = new Set();
    for (const d of devices) {
      if (d.mac === undefined) continue;
      if (
        !['PC', 'Server'].includes(d.type) ||
        typeof d.mac !== 'string' ||
        !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(d.mac) ||
        d.mac === '00:00:00:00:00:00' ||
        parseInt(d.mac.slice(0, 2), 16) & 1 ||
        seen.has(d.mac)
      )
        throw new Error('Geçersiz veya yinelenen fiziksel endpoint MAC adresi: ' + d.id);
      seen.add(d.mac);
    }
  }
  function createResolver() {
    let topology = null,
      count = -1,
      addresses = new Map();
    return (device, devices) => {
      if (topology !== devices || count !== devices.length) {
        validate(devices);
        topology = devices;
        count = devices.length;
        addresses = new Map();
        const occupied = new Set(devices.filter((d) => d.mac !== undefined).map((d) => d.mac));
        const explicitMacs = new Map(
          devices.filter((d) => d.mac !== undefined).map((d) => [String(d.id), d.mac]),
        );
        for (const id of devices.map((d) => String(d.id)).sort()) {
          const explicit = explicitMacs.get(id);
          if (explicit !== undefined) {
            addresses.set(id, explicit);
            continue;
          }
          const match = /^d([1-9]\d*)$/.exec(id),
            legacy = match && Number(match[1]) <= 0xffffff;
          let n = legacy ? Number(match[1]) : 2166136261;
          if (!legacy)
            for (let i = 0; i < id.length; i++) n = Math.imul(n ^ id.charCodeAt(i), 16777619) >>> 0;
          // Non-legacy IDs have their own namespace; resolve hash collisions in ID order.
          const address = () =>
            legacy
              ? '02:00:00:' +
                [(n >>> 16) & 255, (n >>> 8) & 255, n & 255]
                  .map((v) => v.toString(16).padStart(2, '0'))
                  .join(':')
              : '02:01:' +
                [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
                  .map((v) => v.toString(16).padStart(2, '0'))
                  .join(':');
          while (occupied.has(address())) n = (n + 1) >>> 0;
          const mac = address();
          occupied.add(mac);
          addresses.set(id, mac);
        }
      }
      const result = addresses.get(String(device.id));
      if (!result) throw new Error('MAC için cihaz topolojide bulunamadı.');
      return result;
    };
  }
  return { createResolver, resolve: createResolver(), validate };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabMacAddress;
