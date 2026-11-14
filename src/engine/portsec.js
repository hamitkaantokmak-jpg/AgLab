// AğLab motoru (test oracle'ı) — port security ilk çerçeve kararı.
// L7b: ürünün eski motorundan (simulator/port-security.js portSecurityAllows) taşındı; ürüne
// gömülmez. tests/sim/parity.test.ts Labber'ın port security davranışını buna karşı sınar.
// Bağımlılıklar parametre olarak verilir: macOf(kaynak), save(), event(metin).
const AgLabEnginePortSecurity = (() => {
  function canonicalSecureMac(value) {
    const raw = String(value).toLowerCase().replace(/[.:-]/g, '');
    return /^[0-9a-f]{12}$/.test(raw) &&
      raw !== '000000000000' &&
      parseInt(raw.slice(0, 2), 16) % 2 === 0
      ? raw.match(/../g).join(':')
      : null;
  }
  function createPortSecurity({ macOf, save = () => {}, event = () => {} }) {
    const violations = new WeakMap();
    function allows(d, port, source) {
      const i = d.interfaces?.[port],
        s = i?.portSecurity;
      if (i?.errdisabled) return false;
      if (!s?.enabled) return true;
      const mac = canonicalSecureMac(macOf(source));
      if (!mac) {
        event('port-security-drop ' + d.id + ' ' + port + ' invalid-mac');
        return false;
      }
      if (s.macs.map(canonicalSecureMac).includes(mac)) return true;
      if (s.macs.length < s.max) {
        s.macs.push(mac);
        save();
        return true;
      }
      violations.set(i, (violations.get(i) || 0) + 1);
      event('port-security-drop ' + d.id + ' ' + port + ' ' + s.violation);
      if (s.violation === 'shutdown') {
        i.errdisabled = true;
        save();
      }
      return false;
    }
    return { allows, violations: (i) => violations.get(i) || 0 };
  }
  return { canonicalSecureMac, createPortSecurity };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEnginePortSecurity;
