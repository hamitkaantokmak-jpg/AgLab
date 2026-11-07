// AğLab motoru — topoloji sorguları.
// Topoloji `{ devices, links }` biçiminde parametre olarak verilir; modül durum tutmaz.
// Arayüz çağıranların canlı dizileri getter ile vermesine izin verir.
const AgLabEngineTopology = (() => {
  function getDevice(topo, id) {
    return topo.devices.find((d) => d.id === id);
  }
  function portState(d, p) {
    if (!d) return null;
    return d.interfaces?.[p] || null;
  }
  // Bağlantı ancak iki uç cihaz ve iki port da etkin ve err-disabled değilse çalışır.
  function linkUp(topo, l) {
    let a = getDevice(topo, l.a),
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
  return { getDevice, portState, linkUp, freePort, linkPort };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineTopology;
