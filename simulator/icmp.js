// TTL is an IPv4 forwarding property, not an Ethernet hop counter.
function parsePingCommand(parts) {
  const ttl = parts.length === 2 ? 64 : Number(parts[3]);
  if (
    !validIP(parts[1]) ||
    !(
      parts.length === 2 ||
      (parts.length === 4 && parts[2] === 'ttl' && /^[1-9]\d{0,2}$/.test(parts[3]) && ttl <= 255)
    )
  )
    return { error: 'Kullanım: ping <IPv4> [ttl <1-255>]' };
  return { target: parts[1], ttl, explicitTtl: parts.length === 4 };
}
function icmpErrorReply(router, origin, sourceIp, targetIp, incomingIp, context, kind, type, code) {
  const expired = type === 11,
    errorKind = expired ? 'icmp-time-exceeded' : 'icmp-destination-unreachable';
  const label = expired ? 'Time Exceeded' : code === 0 ? 'Network Unreachable' : 'Host Unreachable';
  const flags = { ok: false, expired, unreachable: type === 3, icmpCode: code };
  const nonUnicast = (ip) =>
    validIP(ip) &&
    (Number(ip.split('.')[0]) >= 224 ||
      devices.some((device) => {
        const addresses =
          device.type === 'Router'
            ? activeRouterInterfaces(device).map(([, iface]) => iface)
            : device.type === 'Switch'
              ? activeSwitchSvis(device).map(([, iface]) => iface)
              : [device];
        return addresses.some(
          (iface) =>
            prefixLen(iface.mask) > 0 &&
            prefixLen(iface.mask) < 31 &&
            validIP(iface.ip) &&
            (ipNum(iface.ip) | ~ipNum(iface.mask)) >>> 0 === ipNum(ip),
        );
      }));
  if (
    kind === 'icmp-time-exceeded' ||
    kind === 'icmp-destination-unreachable' ||
    nonUnicast(targetIp) ||
    nonUnicast(sourceIp) ||
    sourceIp === '0.0.0.0'
  ) {
    ethernetEvent('icmp-error-suppressed ' + errorKind + ' quote ' + sourceIp + ' -> ' + targetIp);
    return { ...flags, icmpDelivered: false, why: 'Bu paket için ICMP hata yanıtı üretilmedi.' };
  }
  const lookup = routeLookup(router, sourceIp),
    errorIp = router.interfaces?.[lookup.route?.iface]?.ip || incomingIp;
  const management = origin.type === 'Switch',
    svi = management ? switchManagementAddress(origin, sourceIp, true) : null;
  ethernetEvent(
    errorKind +
      ' type ' +
      type +
      ' code ' +
      code +
      ' from ' +
      router.id +
      ' ' +
      errorIp +
      ' to ' +
      sourceIp +
      ' quote ' +
      sourceIp +
      ' -> ' +
      targetIp,
  );
  let delivered = { ok: false, why: 'ICMP dönüş rotası/komşuluğu yok.' };
  if (
    router.id === origin.id &&
    activeRouterInterfaces(router).some(([, iface]) => iface.ip === sourceIp)
  ) {
    delivered = { ok: true };
    ethernetEvent('icmp-local-delivery ' + origin.id);
  } else {
    const path = findPath(
      router.id,
      origin.id,
      endpointVlan(router.id),
      sourceIp,
      true,
      management ? { management: true, targetVlan: svi?.vlan } : {},
    );
    if (path?.length)
      delivered = deliverRoutedFrames(router, path, errorIp, sourceIp, errorKind, context, {
        ttl: 64,
        icmpType: type,
        icmpCode: code,
      });
  }
  ethernetEvent(
    (delivered.ok ? 'icmp-delivered ' : 'icmp-undelivered ') +
      origin.id +
      (delivered.ok ? '' : ' ' + delivered.why),
  );
  const description = expired ? 'Time Exceeded' : 'Destination Unreachable / ' + label;
  return {
    ...flags,
    routerId: router.id,
    routerIp: errorIp,
    icmpDelivered: delivered.ok,
    why:
      (expired ? 'TTL süresi ' + router.name + ' üzerinde doldu. ' : '') +
      'ICMP ' +
      description +
      ' (type ' +
      type +
      ' code ' +
      code +
      ') ' +
      (delivered.ok
        ? errorIp + ' adresinden kaynağa ulaştı.'
        : 'kaynağa ulaşmadı: ' + delivered.why),
  };
}
function icmpTimeExceeded(router, origin, sourceIp, targetIp, incomingIp, context, kind) {
  ethernetEvent('ttl-expired ' + router.id + ' quote ' + sourceIp + ' -> ' + targetIp);
  return icmpErrorReply(router, origin, sourceIp, targetIp, incomingIp, context, kind, 11, 0);
}
function icmpDestinationUnreachable(
  router,
  origin,
  sourceIp,
  targetIp,
  incomingIp,
  context,
  code = 0,
) {
  return icmpErrorReply(
    router,
    origin,
    sourceIp,
    targetIp,
    incomingIp,
    context,
    'icmp-request',
    3,
    code,
  );
}
function probePingFallback(source, target, ttl) {
  const result = traceProbe(source, target, ttl);
  return {
    ...result,
    ok: !!result.ok,
    why:
      result.why ||
      (result.ok
        ? 'ICMP Echo Reply gerçek ağ iletimiyle kaynağa ulaştı.'
        : 'ICMP Echo Reply veya erişilememe yanıtı kaynağa ulaşmadı.'),
  };
}

function ttlUnsupportedNatPath(path, sourceId) {
  const nodes = orderedPathNodes(sourceId, path);
  return nodes.some(
    (router, index) =>
      router?.type === 'Router' &&
      index > 0 &&
      index < path.length &&
      router.interfaces?.[linkPort(path[index - 1], router.id)]?.natRole === 'inside' &&
      router.interfaces?.[linkPort(path[index], router.id)]?.natRole === 'outside',
  );
}
