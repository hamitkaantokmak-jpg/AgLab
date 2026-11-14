// Port security alanlarının içe aktarma doğrulaması (davranış Labber'da, L5-e).
function canonicalSecureMac(value) {
  const raw = String(value).toLowerCase().replace(/[.:-]/g, '');
  return /^[0-9a-f]{12}$/.test(raw) &&
    raw !== '000000000000' &&
    parseInt(raw.slice(0, 2), 16) % 2 === 0
    ? raw.match(/../g).join(':')
    : null;
}
function validatePortSecurity(d) {
  for (const [name, i] of Object.entries(d.interfaces || {})) {
    if (
      i.errdisabled !== undefined &&
      (d.type !== 'Switch' || !d.ports.includes(name) || typeof i.errdisabled !== 'boolean')
    )
      throw new Error('Geçersiz errdisabled alanı.');
    if (i.portSecurity === undefined) continue;
    const s = i.portSecurity;
    if (
      d.type !== 'Switch' ||
      !d.ports.includes(name) ||
      !protocolObject(s, ['enabled', 'max', 'violation', 'macs']) ||
      typeof s.enabled !== 'boolean' ||
      !Number.isInteger(s.max) ||
      s.max < 1 ||
      s.max > 1024 ||
      !['shutdown', 'restrict', 'protect'].includes(s.violation) ||
      !Array.isArray(s.macs) ||
      s.macs.length > s.max ||
      s.macs.some((m) => !canonicalSecureMac(m)) ||
      new Set(s.macs.map(canonicalSecureMac)).size !== s.macs.length
    )
      throw new Error('Geçersiz portSecurity yapılandırması.');
  }
}
