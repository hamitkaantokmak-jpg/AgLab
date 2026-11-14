// AğLab topoloji modeli yardımcıları (L7b). Simülasyon motoru DEĞİLDİR: iletim, rota seçimi,
// STP ve ping Labber'dadır. Burada yalnız AğLab JSON'unun alanlarını okuyan saf yardımcılar
// var (IPv4 metin doğrulaması, port/bağlantı kaydı, yapılandırılmış statik rotalar); içe
// aktarma doğrulaması, düzenleyici, denetçi ve Akademi ölçütleri kullanır.
// `src/engine` test oracle'ıdır ve ürüne gömülmez; bu dosya ondan bağımsızdır.
const AgLabModel = (() => {
  function validIP(s) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every((n) => +n >= 0 && +n <= 255);
  }
  function ipNum(ip) {
    if (!validIP(ip)) return null;
    return ip.split('.').reduce((a, n) => a * 256 + Number(n), 0);
  }
  // Ardışık birlerden oluşmayan maskeler için -1.
  function prefixLen(mask) {
    if (!validIP(mask)) return -1;
    const bits = mask
      .split('.')
      .map((n) => Number(n).toString(2).padStart(8, '0'))
      .join('');
    if (!/^1*0*$/.test(bits)) return -1;
    return (bits.match(/1/g) || []).length;
  }
  function subnet(ip, mask) {
    if (!validIP(ip) || prefixLen(mask) < 0) return '';
    return ip
      .split('.')
      .map((n, i) => +n & +mask.split('.')[i])
      .join('.');
  }
  function inNetwork(ip, network, mask) {
    const a = ipNum(ip),
      n = ipNum(network),
      m = ipNum(mask);
    return prefixLen(mask) >= 0 && a !== null && n !== null && m !== null && (a & m) === (n & m);
  }
  function routePrefixText(mask) {
    const n = prefixLen(mask);
    return n < 0 ? '?' : '/' + n;
  }
  // ACL joker maskesini (wildcard) ağ maskesine çevirir; geçersizse 0.0.0.0.
  function maskFromWildcard(w) {
    if (!validIP(w)) return '0.0.0.0';
    return w
      .split('.')
      .map((n) => 255 - Number(n))
      .join('.');
  }
  function getDevice(topo, id) {
    return topo.devices.find((d) => d.id === id);
  }
  function portState(d, p) {
    if (!d) return null;
    return d.interfaces?.[p] || null;
  }
  // Kablonun çizimdeki durumu: iki uç cihaz ve iki port da etkin ve err-disabled değilse "up".
  function linkUp(topo, l) {
    const a = getDevice(topo, l.a),
      b = getDevice(topo, l.b),
      pa = portState(a, l.portA),
      pb = portState(b, l.portB);
    return !!(
      l.up &&
      a &&
      b &&
      a.enabled &&
      b.enabled &&
      (!pa || (pa.enabled !== false && !pa.errdisabled)) &&
      (!pb || (pb.enabled !== false && !pb.errdisabled))
    );
  }
  function freePort(topo, d) {
    if (!d) return null;
    const used = new Set(
      topo.links.flatMap((l) => (l.a === d.id ? [l.portA] : l.b === d.id ? [l.portB] : [])),
    );
    return (d.ports || []).find((p) => !used.has(p) && portState(d, p)?.enabled !== false) || null;
  }
  function linkPort(l, id) {
    return l.a === id ? l.portA : l.portB;
  }
  // Yönetimsel olarak açık ve geçerli adresli router arayüzleri (alt arayüz: dot1q + üst port).
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
  // Yapılandırılmış geçerli statik rotalar; eski `route` alanı varsayılan rota olarak eklenir.
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
  return {
    validIP,
    prefixLen,
    subnet,
    inNetwork,
    routePrefixText,
    maskFromWildcard,
    getDevice,
    portState,
    linkUp,
    freePort,
    linkPort,
    activeRouterInterfaces,
    staticRoutes,
  };
})();
