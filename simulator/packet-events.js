/* Normalize real simulator event strings for a future step-by-step Packet Detective.
 * No network simulation takes place here; no synthetic hops are created.
 */
(function (root) {
  'use strict';
  function normalize(lines, overflow = 0) {
    if (!Array.isArray(lines) || !Number.isSafeInteger(overflow) || overflow < 0)
      throw Error('Invalid packet event log');
    const entries = lines.map((raw, index) => {
      if (typeof raw !== 'string') throw Error('Invalid packet event');
      let kind = 'other',
        device = null,
        detail = raw;
      let m = raw.match(/^frame (\S+) src (\S+) dst (\S+) vlan (\d+)$/);
      if (raw.startsWith('diagnostic ')) {
        try {
          const d = JSON.parse(raw.slice(11));
          if (
            d.origin === 'adapter-derived' &&
            typeof d.reason === 'string' &&
            typeof d.source === 'string'
          ) {
            kind = 'diagnostic';
            device = d.source;
            detail = d;
          }
        } catch {}
      } else if (m) {
        kind = 'frame';
        device = m[2];
        detail = { protocol: m[1], source: m[2], destinationMac: m[3], vlan: Number(m[4]) };
      } else if ((m = raw.match(/^receive (\S+) (\S+) vlan (\d+)(?: svi vlan (\d+))?$/))) {
        kind = 'receive';
        device = m[1];
        detail = { protocol: m[2], vlan: Number(m[3]), svi: m[4] !== undefined };
      } else if (
        (m = raw.match(
          /^(broadcast|unknown-unicast|unicast|filter) (\S+) ingress (\S+) egress (.*?) vlan (\d+)$/,
        ))
      ) {
        kind = 'forward';
        device = m[2];
        detail = {
          decision: m[1],
          ingress: m[3],
          egress: m[4] === '-' ? [] : m[4].split(','),
          vlan: Number(m[5]),
        };
      } else if ((m = raw.match(/^ttl-forward (\S+) (\d+) -> (\d+)$/))) {
        kind = 'ttl';
        device = m[1];
        detail = { before: Number(m[2]), after: Number(m[3]) };
      } else if ((m = raw.match(/^discard (\S+) (.*)$/))) {
        kind = 'discard';
        device = m[1];
        detail = { reason: m[2] };
      } else if ((m = raw.match(/^ttl-expired (\S+) quote (.*)$/))) {
        kind = 'discard';
        device = m[1];
        detail = { reason: 'ttl-expired', quote: m[2] };
      } else if ((m = raw.match(/^port-security-drop (\S+) (\S+) (.*)$/))) {
        kind = 'discard';
        device = m[1];
        detail = { reason: 'port-security', port: m[2], mode: m[3] };
      } else if (raw.startsWith('icmp-delivered ')) {
        kind = 'icmp-delivered';
      } else if (raw.startsWith('icmp-undelivered ')) {
        kind = 'icmp-undelivered';
      }
      return { index, kind, device, detail, raw };
    });
    return { events: entries, overflow, truncated: overflow > 0 };
  }
  function fromEvidence(records, overflow = 0, metadata = {}) {
    if (
      !Array.isArray(records) ||
      records.length > 512 ||
      !Number.isSafeInteger(overflow) ||
      overflow < 0
    )
      throw Error('Invalid bounded trace');
    const events = records.map((record, index) => {
      if (!record || typeof record.raw !== 'string' || typeof record.eventId !== 'string')
        throw Error('Invalid trace record');
      const base = normalize([record.raw]).events[0];
      return {
        ...base,
        ...JSON.parse(JSON.stringify(record)),
        index,
        sequence: index + 1,
        origin: 'aglab-js',
      };
    });
    return { ...metadata, origin: 'aglab-js', events, overflow, truncated: overflow > 0 };
  }
  /**
   * Labber olay adaptörü kayıtları (L3-b, src/sim-bridge/events.ts). Biçim eski motorun
   * kanıt kayıtlarıyla aynıdır; köken 'labber' yazılır. l2 false ise kayıt yalnız L3
   * atlamalarıdır. ARP çerçeveleri üretilmez; not alanı bunu arayüze taşır.
   */
  function fromLabber(trace, metadata = {}) {
    if (!trace || !Array.isArray(trace.records) || typeof trace.l2 !== 'boolean')
      throw Error('Invalid Labber trace');
    const bounded = trace.records.slice(0, 512),
      overflow = trace.records.length - bounded.length;
    const events = bounded.map((record, index) => {
      if (!record || typeof record.raw !== 'string') throw Error('Invalid trace record');
      const base = normalize([record.raw]).events[0];
      return {
        ...base,
        ...JSON.parse(JSON.stringify(record)),
        eventId: (metadata.generation ?? 0) + ':l' + (index + 1),
        index,
        sequence: index + 1,
        origin: 'labber',
      };
    });
    const note = trace.l2
      ? 'Labber: ICMP çerçeveleri kablo kablo gösterilir; ARP çerçeveleri gösterilmez.'
      : 'Labber: katman 2 yolu çıkarılamadı; yalnız L3 atlamaları gösterilir (ARP gösterilmez).';
    return {
      ...metadata,
      origin: 'labber',
      l2: trace.l2,
      note,
      events,
      overflow,
      truncated: overflow > 0,
    };
  }
  function explain(event) {
    if (!event || typeof event !== 'object') throw Error('Invalid packet event');
    const d = event.detail;
    switch (event.kind) {
      case 'lab-check':
        return (
          'Ayrı Lab rapor adımı (paket olayı değil; imza doğrulanmadı): ' +
          d.name +
          ' — ' +
          (d.ok ? 'başarılı' : 'başarısız')
        );
      case 'diagnostic':
        return 'Adaptör tanısı (paket yakalaması değil): ' + d.reason;
      case 'wire':
        if (event.origin === 'labber')
          return (
            event.edge.a +
            ' (' +
            event.edge.portA +
            ') → ' +
            event.edge.b +
            ' (' +
            event.edge.portB +
            '): Labber motorunun hesapladığı yol üzerindeki ' +
            event.frame.kind +
            ' çerçeve aktarımı. Alıcı işlemesi ayrı kayıttır.'
          );
        return event.origin === 'aglab-js'
          ? event.edge.a +
              ' (' +
              event.edge.portA +
              ') → ' +
              event.edge.b +
              ' (' +
              event.edge.portB +
              '): motorun gerçekleştirdiği ' +
              event.frame.kind +
              ' çerçeve aktarımı. Alıcı işlemesi ayrı kayıttır.'
          : event.device +
              ' → ' +
              d.toDeviceId +
              ': ' +
              d.kind.toUpperCase() +
              ' bağlantı iletimi motor tarafından zamanlandı (' +
              d.start +
              '–' +
              d.end +
              ' sanal ms). Bu bildirim alıcıya teslimi tek başına kanıtlamaz.';
      case 'learn':
        return (
          event.device +
          ' kaynak MAC adresini ' +
          event.ingressPort +
          ' üzerinde öğrendi/güncelledi.'
        );
      case 'frame': {
        const operation = event.frame?.kind || d.protocol;
        const purpose = {
          'arp-request': 'komşunun MAC adresini çözmek için ARP isteği oluşturdu',
          'arp-reply': 'alınan ARP isteğine kendi IP/MAC bilgisiyle yanıt verdi',
          'icmp-request': 'IP erişimini sınamak için ICMP Echo Request oluşturdu',
          'icmp-reply': 'alınan Echo Request için ICMP Echo Reply oluşturdu',
        }[operation];
        return purpose
          ? event.device + ' ' + purpose + ' (mantıksal VLAN ' + d.vlan + ').'
          : event.device +
              ' cihazı ' +
              d.protocol +
              ' çerçevesini VLAN ' +
              d.vlan +
              ' üzerinden gönderdi.';
      }
      case 'forward': {
        const label =
          {
            broadcast: 'Yayın',
            'unknown-unicast': 'Bilinmeyen hedefe yayılım',
            unicast: 'Öğrenilmiş MAC yönlendirmesi',
            filter: 'Giriş portuna geri gönderim engellendi',
          }[d.decision] || 'İletim';
        return (
          event.device +
          ': ' +
          label +
          '; giriş ' +
          d.ingress +
          '; çıkış ' +
          (d.egress.join(', ') || 'yok') +
          '.'
        );
      }
      case 'receive':
        return (
          event.device +
          ' cihazı ' +
          d.protocol +
          ' çerçevesini aldı' +
          (d.svi ? ' (SVI)' : '') +
          '.'
        );
      case 'ttl':
        return event.device + ' yönlendiricisinde TTL ' + d.before + ' → ' + d.after + ' oldu.';
      case 'discard':
        return event.device + ' çerçeveyi reddetti: ' + d.reason + '.';
      case 'icmp-delivered':
        return 'ICMP yanıtı kaynağa ulaştı.';
      case 'icmp-undelivered':
        return 'ICMP yanıtı kaynağa ulaşamadı.';
      default:
        return event.raw;
    }
  }
  function diagnose(log) {
    if (!log || !Array.isArray(log.events)) throw Error('Invalid packet event log');
    const issues = [];
    for (const event of log.events) {
      if (event.kind === 'lab-check' && !event.detail.ok) {
        issues.push({
          index: event.index,
          device: null,
          reason: 'imported-lab-check',
          summary: 'Rapordaki doğrulama başarısız: ' + event.detail.name,
          hint: 'Bu ayrı Lab raporudur; imza/kaynak doğrulanmadı. Paket düşme nedeni olarak yorumlama.',
        });
      } else if (event.kind === 'diagnostic') {
        issues.push({
          index: event.index,
          device: event.device,
          reason: 'adapter-derived',
          summary: event.detail.reason,
          hint: 'Bu açıklama motorun ping sonucundan türetildi; gerçek paket yakalaması değildir. İlgili yapılandırmayı CLI ile kontrol et.',
        });
      } else if (event.kind === 'discard') {
        const reason = event.detail.reason;
        const hint =
          reason === 'ttl-expired'
            ? 'IPv4 TTL değerini ve yönlendirmeyi kontrol et. Düşük başlangıç TTL değeri de bunu oluşturabilir; tek başına döngü kanıtı değildir.'
            : reason === 'port-security'
              ? 'show port-security ve show interfaces status ile ilgili fiziksel portun politikasını incele.'
              : reason === 'ingress-port'
                ? 'Giriş portu kapalı veya bağlantı geçersiz olabilir; port durumunu ve kabloyu kontrol et.'
                : reason === 'destination-mac'
                  ? 'Hedef MAC adresi eşleşmedi; hedef cihazın MAC adresini ve VLAN üyeliğini kontrol et.'
                  : 'Bu reddetme nedenini olay kaydından incele.';
        issues.push({
          index: event.index,
          device: event.device,
          reason,
          summary: event.device + ' cihazında çerçeve reddedildi.',
          hint,
        });
      } else if (event.kind === 'icmp-undelivered') {
        issues.push({
          index: event.index,
          device: event.device,
          reason: 'icmp-undelivered',
          summary: 'ICMP yanıtı kaynağa ulaşamadı.',
          hint: 'IP adresleme, varsayılan ağ geçidi ve gidiş-dönüş yönlendirme yolunu kontrol et; bu kayıt tek başına kesin nedeni göstermiyor.',
        });
      }
    }
    return { issues, hasEvidence: log.events.length > 0, truncated: !!log.truncated };
  }
  function at(log, index) {
    if (
      !log ||
      !Array.isArray(log.events) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= log.events.length
    )
      return null;
    const event = log.events[index];
    return {
      index,
      total: log.events.length,
      ...event,
      position: index,
      explanation: explain(event),
      hasPrevious: index > 0,
      hasNext: index < log.events.length - 1,
      logTruncated: !!log.truncated,
    };
  }
  const api = Object.freeze({ normalize, fromEvidence, fromLabber, explain, at, diagnose });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AgLabPacketEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
