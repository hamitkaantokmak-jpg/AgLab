// Deterministic teaching model: single-area OSPF components and directly peered eBGP.
// No timers, LSDB, policy, authentication, redistribution or real protocol packets.
function protocolNumber(token, max = 4294967295) {
  return /^\d+$/.test(String(token)) && Number(token) > 0 && Number(token) <= max
    ? Number(token)
    : null;
}
function protocolObject(value, keys) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every((k) => keys.includes(k))
  );
}
function validateRoutingProtocols(d) {
  if ((d.ospf !== undefined || d.bgp !== undefined) && d.type !== 'Router')
    throw new Error('OSPF/BGP yalnızca Router üzerinde kullanılabilir.');
  if (d.ospf !== undefined) {
    const o = d.ospf;
    if (
      !protocolObject(o, ['pid', 'routerId', 'networks']) ||
      typeof o.pid !== 'number' ||
      !protocolNumber(o.pid, 65535) ||
      (o.routerId !== '' && !validIP(o.routerId)) ||
      !Array.isArray(o.networks) ||
      o.networks.length > 256
    )
      throw new Error('Geçersiz OSPF yapılandırması.');
    for (const n of o.networks)
      if (
        !protocolObject(n, ['network', 'wildcard', 'area']) ||
        !validIP(n.network) ||
        !validIP(n.wildcard) ||
        prefixLen(maskFromWildcard(n.wildcard)) < 0 ||
        !Number.isInteger(n.area) ||
        n.area < 0 ||
        n.area > 4294967295
      )
        throw new Error('Geçersiz OSPF network/wildcard/area.');
  }
  if (d.bgp !== undefined) {
    const b = d.bgp;
    if (
      !protocolObject(b, ['asn', 'neighbors', 'networks']) ||
      typeof b.asn !== 'number' ||
      !protocolNumber(b.asn) ||
      !Array.isArray(b.neighbors) ||
      b.neighbors.length > 256 ||
      !Array.isArray(b.networks) ||
      b.networks.length > 256
    )
      throw new Error('Geçersiz BGP yapılandırması.');
    const seen = new Set();
    for (const n of b.neighbors) {
      if (
        !protocolObject(n, ['ip', 'remoteAs']) ||
        !validIP(n.ip) ||
        typeof n.remoteAs !== 'number' ||
        !protocolNumber(n.remoteAs) ||
        seen.has(n.ip)
      )
        throw new Error('Geçersiz/yinelenen BGP komşusu.');
      seen.add(n.ip);
    }
    for (const n of b.networks)
      if (
        !protocolObject(n, ['network', 'mask']) ||
        !validIP(n.network) ||
        prefixLen(n.mask) < 0 ||
        subnet(n.network, n.mask) !== n.network
      )
        throw new Error('Geçersiz BGP network/mask.');
  }
}
