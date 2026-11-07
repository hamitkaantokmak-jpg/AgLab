// AğLab motoru — IPv4 adres ve maske yardımcıları.
// Saf fonksiyonlar: DOM, global durum veya topoloji erişimi yok.
const AgLabEngineIpv4 = (() => {
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
  function maskFromPrefix(prefix) {
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return '';
    const m = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return [24, 16, 8, 0].map((shift) => (m >>> shift) & 255).join('.');
  }
  // ACL joker maskesini (wildcard) ağ maskesine çevirir; geçersizse 0.0.0.0.
  function maskFromWildcard(w) {
    if (!validIP(w)) return '0.0.0.0';
    return w
      .split('.')
      .map((n) => 255 - Number(n))
      .join('.');
  }
  return {
    validIP,
    ipNum,
    prefixLen,
    subnet,
    inNetwork,
    routePrefixText,
    maskFromPrefix,
    maskFromWildcard,
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineIpv4;
