// AğLab motoru — IPv4 erişim listesi (ACL) değerlendirmesi.
// Saf fonksiyonlar: yalnızca yönlendiricinin `acls` yapılandırmasını okur.
// İlk eşleşen kural uygulanır; hiçbiri eşleşmezse Cisco'daki gibi örtük "deny".
const AgLabEngineAcl = ((ipv4) => {
  const { inNetwork, maskFromWildcard } = ipv4;

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
  return { aclRuleMatches, aclEvaluate };
})(typeof AgLabEngineIpv4 !== 'undefined' ? AgLabEngineIpv4 : require('./ipv4.js'));
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineAcl;
