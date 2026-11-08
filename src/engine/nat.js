// AğLab motoru — NAT overload (PAT) yol denetimi.
// `natPathCheck` saftır: verilen yol üzerinde inside → outside geçişi yapan ilk
// yönlendiricinin NAT yapılandırmasını denetler ve oluşacak çeviri kaydını döndürür.
// Çeviri tablosuna yazmak ayrı ve açık bir adımdır (`recordNatTranslation`).
// Model sınırı: port numarası çevirisi ve zaman aşımı modellenmez; kayıt anahtarı
// kaynak|hedef|protokol üçlüsüdür.
const AgLabEngineNat = ((topology, acl) => {
  const { orderedPathNodes, linkPort } = topology;
  const { aclEvaluate } = acl;

  function natPathCheck(topo, path, srcId, dstId, srcIp, dstIp, protocol) {
    const nodes = orderedPathNodes(topo, srcId, path);
    for (let i = 0; i < nodes.length; i++) {
      const r = nodes[i];
      if (r?.type !== 'Router' || r.enabled === false) continue;
      const inPort = i > 0 ? linkPort(path[i - 1], r.id) : null;
      const outPort = i < path.length ? linkPort(path[i], r.id) : null;
      const ingress = inPort ? r.interfaces?.[inPort] : null,
        egress = outPort ? r.interfaces?.[outPort] : null;
      if (ingress?.natRole === 'inside' && egress?.natRole === 'outside') {
        const n = r.natOverload;
        if (!n)
          return {
            ok: false,
            why:
              r.name + ' üzerinde inside → outside akışı var ancak NAT overload yapılandırılmamış.',
          };
        if (ingress.enabled === false)
          return { ok: false, why: r.name + ' NAT inside arayüzü ' + inPort + ' kapalı.' };
        if (egress.enabled === false)
          return { ok: false, why: r.name + ' NAT outside arayüzü ' + outPort + ' kapalı.' };
        if (n.outsideInterface !== outPort)
          return {
            ok: false,
            why:
              'NAT overload yanlış outside arayüzünü (' +
              n.outsideInterface +
              ') referanslıyor; bu akış ' +
              outPort +
              ' arayüzünden çıkıyor.',
          };
        const configuredOutside = r.interfaces?.[n.outsideInterface];
        if (
          !configuredOutside ||
          configuredOutside.natRole !== 'outside' ||
          !configuredOutside.ip ||
          configuredOutside.enabled === false
        )
          return {
            ok: false,
            why:
              'NAT outside arayüzü ' +
              n.outsideInterface +
              ' outside olarak işaretli, etkin ve IP adresli olmalı.',
          };
        const decision = aclEvaluate(
          r,
          n.aclId,
          srcIp,
          dstIp,
          protocol,
          protocol === 'tcp' ? 80 : null,
        );
        if (decision.action !== 'permit')
          return {
            ok: false,
            why: 'NAT ACL ' + n.aclId + ' iç kaynak ' + srcIp + ' adresine izin vermiyor.',
          };
        const entry = {
          key: [srcIp, dstIp, protocol].join('|'),
          protocol,
          insideLocal: srcIp,
          insideGlobal: configuredOutside.ip,
          outsideLocal: dstIp,
        };
        return { ok: true, translated: true, router: r.name, natRouter: r, entry };
      }
    }
    return { ok: true, translated: false };
  }
  // Çeviri tablosuna kayıt ekler (aynı anahtar varsa eklemez). Yönlendiriciyi değiştirir.
  function recordNatTranslation(router, entry) {
    router.natTranslations = Array.isArray(router.natTranslations) ? router.natTranslations : [];
    if (!router.natTranslations.some((x) => x.key === entry.key))
      router.natTranslations.push(entry);
  }
  return { natPathCheck, recordNatTranslation };
})(
  typeof AgLabEngineTopology !== 'undefined' ? AgLabEngineTopology : require('./topology.js'),
  typeof AgLabEngineAcl !== 'undefined' ? AgLabEngineAcl : require('./acl.js'),
);
if (typeof module !== 'undefined' && module.exports) module.exports = AgLabEngineNat;
