function switchVlanId(token) {
  return /^\d+$/.test(token || '') && Number(token) >= 1 && Number(token) <= 4094
    ? Number(token)
    : null;
}
function isSwitchSvi(d, name) {
  return d?.type === 'Switch' && /^vlan\d+$/.test(name);
}
function validateSwitchManagement(d) {
  if (d.type !== 'Switch') {
    if (d.vlanNames !== undefined || d.startupConfig !== undefined)
      throw new Error('Switch yönetim alanı farklı cihaz türünde kullanılamaz.');
    return;
  }
  if (
    d.gateway !== undefined &&
    (typeof d.gateway !== 'string' || (d.gateway !== '' && !validIP(d.gateway)))
  )
    throw new Error('Switch yönetim gateway adresi geçersiz.');
  if (d.vlanNames !== undefined) {
    if (!d.vlanNames || typeof d.vlanNames !== 'object' || Array.isArray(d.vlanNames))
      throw new Error('VLAN isim tablosu geçersiz.');
    for (const [id, name] of Object.entries(d.vlanNames))
      if (
        String(Number(id)) !== id ||
        !switchVlanId(id) ||
        !(d.vlans || []).map(Number).includes(Number(id)) ||
        typeof name !== 'string' ||
        !name.trim() ||
        name.length > 32 ||
        /[\x00-\x1f\x7f]/.test(name)
      )
        throw new Error('VLAN ismi veya VLAN referansı geçersiz.');
  }
  for (const [name, i] of Object.entries(d.interfaces || {}))
    if (name.startsWith('vlan')) {
      const id = switchVlanId(name.slice(4));
      if (
        !id ||
        name !== 'vlan' + id ||
        Number(i.vlan) !== id ||
        (d.ports || []).includes(name) ||
        Object.keys(i).some((k) => !['ip', 'mask', 'enabled', 'vlan'].includes(k))
      )
        throw new Error('SVI adı/VLAN eşlemesi veya mantıksal port kaydı geçersiz.');
    }
  if ((d.ports || []).some((p) => /^vlan\d+$/.test(p)))
    throw new Error('SVI fiziksel kablo portu olamaz.');
  if (d.startupConfig !== undefined) {
    const saved = d.startupConfig;
    if (
      !saved ||
      typeof saved !== 'object' ||
      Array.isArray(saved) ||
      Object.keys(saved).some(
        (k) =>
          ![
            'name',
            'gateway',
            'vlans',
            'vlanNames',
            'ports',
            'interfaces',
            'stpPriority',
            'stpPriorities',
          ].includes(k),
      )
    )
      throw new Error('Switch startup-config kaydı geçersiz.');
    if (
      !Array.isArray(saved.ports) ||
      !Array.isArray(saved.vlans) ||
      !saved.interfaces ||
      typeof saved.name !== 'string' ||
      typeof saved.gateway !== 'string'
    )
      throw new Error('Startup-config alanları eksik.');
    if (saved.ports.length !== d.ports.length || saved.ports.some((p) => !d.ports.includes(p)))
      throw new Error('Startup-config fiziksel port envanterini değiştiremez.');
    validateTopologyData({
      app: 'AgLab',
      devices: [{ ...d, ...clone(saved), startupConfig: undefined }],
      links: [],
    });
  }
}
