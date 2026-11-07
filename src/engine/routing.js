// AğLab motoru — yönlendirici rota tablosu ve en uzun önek eşleşmesi (LPM).
// Saf fonksiyonlar: topoloji parametre olarak verilir. Dinamik rotalar (OSPF/BGP vb.)
// motorun bu parçasına ait değildir; çağıran `options.dynamicRoutes(router)` ile verir.
const AgLabEngineRouting = ((ipv4, topology) => {
  const { validIP, prefixLen, subnet, inNetwork, routePrefixText } = ipv4;

  function activeRouterInterfaces(r) {
    return Object.entries(r?.interfaces || {}).filter(
      ([name, i]) =>
        i.ip &&
        validIP(i.ip) &&
        prefixLen(i.mask) >= 0 &&
        i.enabled !== false &&
        r.enabled !== false &&
        (!i.parent ||
          (r.interfaces?.[i.parent]?.enabled !== false &&
            r.interfaces?.[i.parent]?.enabled !== undefined)) &&
        (!name.includes('.') || (i.encapsulation === 'dot1q' && Number(i.vlan) > 0)),
    );
  }
  // Bağlı rota: etkin arayüz + fiziksel portunda çalışan bir bağlantı.
  function connectedRoutes(topo, r) {
    return activeRouterInterfaces(r)
      .filter(([name, i]) => {
        const physical = i.parent || (name.includes('.') ? name.split('.')[0] : name);
        return topo.links.some(
          (l) =>
            ((l.a === r.id && l.portA === physical) || (l.b === r.id && l.portB === physical)) &&
            topology.linkUp(topo, l),
        );
      })
      .map(([name, i]) => ({
        network: subnet(i.ip, i.mask),
        mask: i.mask,
        prefix: prefixLen(i.mask),
        via: null,
        iface: name,
        type: 'connected',
      }))
      .filter((x) => x.prefix >= 0);
  }
  // Geçerli statik rotalar; eski `route` alanı varsayılan rota olarak eklenir.
  function staticRoutes(r) {
    const rows = Array.isArray(r?.staticRoutes) ? r.staticRoutes.slice() : [];
    if (r?.route && !rows.some((x) => x.network === '0.0.0.0' && x.mask === '0.0.0.0'))
      rows.push({ network: '0.0.0.0', mask: '0.0.0.0', nextHop: r.route, distance: 1 });
    return rows
      .filter(
        (x) =>
          validIP(x.network) &&
          validIP(x.mask) &&
          validIP(x.nextHop) &&
          prefixLen(x.mask) >= 0 &&
          Number.isInteger(Number(x.distance ?? 1)) &&
          Number(x.distance ?? 1) >= 1 &&
          Number(x.distance ?? 1) <= 255,
      )
      .map((x) => ({
        ...x,
        distance: Number(x.distance ?? 1),
        prefix: prefixLen(x.mask),
        type: 'static',
      }));
  }
  function routeKey(x) {
    return [x.type, x.network, x.mask, x.nextHop || '', x.distance ?? 1].join('|');
  }
  // LPM; eşit önekte bağlı rota, sonra yönetimsel uzaklık, sonra metrik kazanır.
  // Statik rotanın sonraki atlaması doğrudan bağlı ağda değilse özyinelemeli çözülür;
  // çözülemeyen rota atlanır ve bir sonraki aday denenir.
  function routeLookup(topo, r, destIp, options = {}) {
    const seen = options.seen || new Set();
    const dynamicRoutes = options.dynamicRoutes || (() => []);
    if (!validIP(destIp)) return { ok: false, why: 'Geçersiz hedef IPv4 adresi: ' + destIp };
    const connected = connectedRoutes(topo, r),
      statics = staticRoutes(r);
    const matches = [...connected, ...statics, ...dynamicRoutes(r)]
      .filter((x) => inNetwork(destIp, x.network, x.mask) && !seen.has(routeKey(x)))
      .sort(
        (a, b) =>
          b.prefix - a.prefix ||
          (a.type === 'connected' && b.type !== 'connected'
            ? -1
            : b.type === 'connected' && a.type !== 'connected'
              ? 1
              : 0) ||
          (a.distance ?? 1) - (b.distance ?? 1) ||
          (a.metric ?? 0) - (b.metric ?? 0),
      );
    if (!matches.length)
      return {
        ok: false,
        why: r.name + ' üzerinde ' + destIp + ' için eşleşen ve kullanılabilir rota yok.',
      };
    let lastError = '';
    for (const route of matches) {
      if (route.type === 'connected')
        return { ok: true, route: { ...route, resolvedVia: 'connected' } };
      const key = routeKey(route),
        nextSeen = new Set(seen);
      nextSeen.add(key);
      const direct = connected.find((c) => inNetwork(route.nextHop, c.network, c.mask));
      if (direct) {
        return {
          ok: true,
          route: { ...route, iface: direct.iface, resolvedVia: 'direct', recursiveHops: 0 },
        };
      }
      const recursive = routeLookup(topo, r, route.nextHop, { ...options, seen: nextSeen });
      if (recursive.ok && recursive.route.iface) {
        return {
          ok: true,
          route: {
            ...route,
            iface: recursive.route.iface,
            resolvedVia: 'recursive',
            recursiveHops: 1 + (recursive.route.recursiveHops || 0),
            resolutionRoute: recursive.route.network + routePrefixText(recursive.route.mask),
            resolution: recursive.route,
          },
        };
      }
      lastError =
        'Statik rota ' +
        route.network +
        routePrefixText(route.mask) +
        ' via ' +
        route.nextHop +
        ' çözümlenemedi: ' +
        recursive.why;
    }
    return {
      ok: false,
      why: lastError || r.name + ' üzerinde ' + destIp + ' için kullanılabilir rota yok.',
    };
  }
  return { activeRouterInterfaces, connectedRoutes, staticRoutes, routeKey, routeLookup };
})(
  typeof AgLabEngineIpv4 !== 'undefined' ? AgLabEngineIpv4 : require('./ipv4.js'),
  typeof AgLabEngineTopology !== 'undefined' ? AgLabEngineTopology : require('./topology.js'),
);
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineRouting;
