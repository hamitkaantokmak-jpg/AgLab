// AğLab motoru — IPv4 erişim listesi (ACL) değerlendirmesi.
// Saf fonksiyonlar: yönlendiricinin `acls` yapılandırmasını ve verilen yolu okur.
// İlk eşleşen kural uygulanır; hiçbiri eşleşmezse Cisco'daki gibi örtük "deny".
const AgLabEngineAcl = ((ipv4, topology) => {
  const { inNetwork, maskFromWildcard } = ipv4;
  const { orderedPathNodes, linkPort } = topology;

  function aclRuleMatches(rule, srcIp, dstIp, protocol, port) {
    if (rule.protocol !== 'ip' && rule.protocol !== protocol) return false;
    if (rule.srcType === 'host' && rule.src !== srcIp) return false;
    if (rule.srcType === 'network' && !inNetwork(srcIp, rule.src, maskFromWildcard(rule.wildcard)))
      return false;
    if (rule.dstType === 'host' && rule.dst !== dstIp) return false;
    if (
      rule.dstType === 'network' &&
      !inNetwork(dstIp, rule.dst, maskFromWildcard(rule.dstWildcard))
    )
      return false;
    if (rule.port !== undefined && rule.port !== null && Number(rule.port) !== Number(port))
      return false;
    return true;
  }
  function aclEvaluate(router, aclId, srcIp, dstIp, protocol, port) {
    const rules = (router.acls || []).filter((r) => String(r.id) === String(aclId));
    for (const rule of rules) {
      if (aclRuleMatches(rule, srcIp, dstIp, protocol, port)) return { action: rule.action, rule };
    }
    return { action: 'deny', rule: null };
  }
  // Yol üzerindeki her yönlendiricide giriş (in) ve çıkış (out) arayüzüne bağlı
  // ACL'leri sırayla uygular; ilk engelleyen karar akışı durdurur.
  function aclPathDecision(topo, path, srcId, dstId, srcIp, dstIp, protocol, port) {
    const nodes = orderedPathNodes(topo, srcId, path);
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i];
      if (r?.type !== 'Router') continue;
      const inPort = i > 0 ? linkPort(path[i - 1], r.id) : null;
      const outPort = i < path.length ? linkPort(path[i], r.id) : null;
      for (const [iface, direction] of [
        [inPort, 'in'],
        [outPort, 'out'],
      ]) {
        if (!iface) continue;
        const intf = r.interfaces?.[iface];
        const aclId = direction === 'in' ? intf?.aclIn : intf?.aclOut;
        if (!aclId) continue;
        const decision = aclEvaluate(r, aclId, srcIp, dstIp, protocol, port);
        if (decision.action !== 'permit')
          return {
            ok: false,
            why:
              'ACL ' +
              aclId +
              ' ' +
              direction +
              ' yönünde ' +
              r.name +
              ' ' +
              iface +
              ' arayüzünde ' +
              protocol.toUpperCase() +
              (port ? ' / ' + port : '') +
              ' trafiğini engelliyor' +
              (decision.rule
                ? ' (eşleşen ' + decision.rule.action + ' kuralı).'
                : '; eşleşen izin kuralı yok, varsayılan deny.'),
          };
      }
    }
    return { ok: true };
  }
  return { aclRuleMatches, aclEvaluate, aclPathDecision };
})(
  typeof AgLabEngineIpv4 !== 'undefined' ? AgLabEngineIpv4 : require('./ipv4.js'),
  typeof AgLabEngineTopology !== 'undefined' ? AgLabEngineTopology : require('./topology.js'),
);
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineAcl;
