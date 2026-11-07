// AğLab motoru — DHCP relay araması ve adres kiralama.
// Saf fonksiyonlar: topoloji parametre olarak verilir, hiçbir cihaz değiştirilmez.
// İstemciye adresi yazmak ve kullanıcı mesajları çağıranın (CLI) işidir.
// Sunucuya giden yolun bulunması (L2 keşif) bu modülün kapsamı dışındadır.
const AgLabEngineDhcp = ((ipv4, topology) => {
  const { prefixLen, ipNum } = ipv4;
  const { orderedPathNodes, linkPort } = topology;

  // Yol üzerinde, istemci tarafındaki giriş arayüzünde `ip helper-address <sunucu>`
  // yapılandırılmış ilk etkin yönlendirici.
  function findRelayOnPath(topo, clientId, path, serverIp) {
    const nodes = orderedPathNodes(topo, clientId, path);
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i];
      if (r?.type !== 'Router') continue;
      const inPort = i > 0 ? linkPort(path[i - 1], r.id) : null;
      const ingress = inPort ? r.interfaces?.[inPort] : null;
      if (
        ingress?.helperAddress === serverIp &&
        ingress.ip &&
        ingress.enabled !== false &&
        r.enabled !== false
      )
        return { router: r, iface: ingress };
    }
    return null;
  }

  function numToIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  // Havuzdan boş adres seçer: ağın 100. adresinden (daha küçük ağlarda son kullanılabilir
  // adresten) başlayıp yukarı doğru en çok 4096 aday dener, sonra baştaki adreslere döner.
  // İstemcinin kendisi dışındaki tüm cihaz/arayüz adresleri, ağ geçidi ve sunucu adresi
  // dolu sayılır.
  // Dönüş: { ok: true, ip } | { ok: false, reason: 'invalid-subnet' | 'pool-exhausted' }
  function allocateLease(topo, client, { network, mask, gateway = '', serverIp = '' }) {
    const prefix = prefixLen(mask),
      networkInt = ipNum(network);
    if (prefix < 0 || prefix >= 31 || networkInt === null)
      return { ok: false, reason: 'invalid-subnet' };
    const broadcastInt = networkInt + Math.pow(2, 32 - prefix) - 1;
    const occupied = new Set(
      topo.devices
        .filter((x) => x !== client)
        .flatMap((x) => [x.ip, ...Object.values(x.interfaces || {}).map((i) => i.ip)])
        .filter(Boolean),
    );
    const reserved = new Set([gateway, serverIp].filter(Boolean));
    const startOffset = Math.min(100, Math.max(1, broadcastInt - networkInt - 1));
    for (const offset of [...Array(4096)]
      .map((_, i) => startOffset + i)
      .concat([...Array(Math.max(0, startOffset - 1))].map((_, i) => i + 1))) {
      const candidateInt = networkInt + offset;
      if (candidateInt >= broadcastInt) continue;
      const candidate = numToIp(candidateInt);
      if (!occupied.has(candidate) && !reserved.has(candidate)) return { ok: true, ip: candidate };
    }
    return { ok: false, reason: 'pool-exhausted' };
  }
  return { findRelayOnPath, allocateLease };
})(
  typeof AgLabEngineIpv4 !== 'undefined' ? AgLabEngineIpv4 : require('./ipv4.js'),
  typeof AgLabEngineTopology !== 'undefined' ? AgLabEngineTopology : require('./topology.js'),
);
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineDhcp;
