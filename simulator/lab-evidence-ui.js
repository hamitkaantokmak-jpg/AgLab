(function () {
  'use strict';
  const panel = document.getElementById('packetDetectivePanel');
  if (!panel) return;
  const details = document.createElement('details'),
    heading = document.createElement('summary');
  heading.textContent = 'Ayrı Gerçek Lab raporunu incele';
  details.append(heading);
  const description = document.createElement('p');
  description.textContent =
    'Operatörün/CI’nin Linux bridge, FRRouting veya nftables için ürettiği JSON doğrulama raporunu aç. Bu bir canlı bağlantı veya paket yakalaması değildir; imza ve dosya kaynağı burada doğrulanmaz. Tarayıcı topolojisiyle birleştirilmez.';
  details.append(description);
  const label = document.createElement('label');
  label.textContent = 'Linux bridge / FRR / nftables raporu ';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.id = 'nativeLabReport';
  label.append(input);
  details.append(label);
  const status = document.createElement('p');
  status.id = 'nativeLabReportStatus';
  status.setAttribute('role', 'status');
  details.append(status);
  panel.append(details);
  const checks = document.createElement('div');
  checks.id = 'nativeLabChecks';
  details.append(checks);
  // Gerçek Lab girdisi: operatörün dönüştürücüsü (real-lab/shared_topology.py,
  // routed_topology.py) için topoloji JSON'u. L7b'de kaldırılan motor yöneticisi panelinden
  // taşındı; davranış aynı (switch/router MAC'i yazılmaz, seçim boş).
  const exportBlock = document.createElement('details'),
    exportHeading = document.createElement('summary');
  exportBlock.id = 'realLabExport';
  exportHeading.textContent = 'Gerçek Lab için topolojiyi indir';
  exportBlock.append(exportHeading);
  const exportButton = document.createElement('button');
  exportButton.id = 'realLabExportTopology';
  exportButton.textContent = 'Topolojiyi operatör için JSON olarak indir';
  const exportStatus = document.createElement('p');
  exportStatus.id = 'realLabExportStatus';
  exportStatus.setAttribute('role', 'status');
  exportBlock.append(exportButton, exportStatus);
  panel.append(exportBlock);
  exportButton.onclick = () => {
    const t = {
      devices: devices.map((d) => ({ ...clone(d), mac: macOf(d) })),
      links: clone(links),
    };
    for (const d of t.devices) if (d.type !== 'PC' && d.type !== 'Server') delete d.mac;
    const blob = new Blob(
        [JSON.stringify({ app: 'AgLab', version: 23, ...t, nextId, selected: '' }, null, 2)],
        { type: 'application/json' },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'aglab-operator-topology.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    exportStatus.textContent =
      'JSON indirildi. Gerçek Lab dönüşümü ve çalıştırması yetkili operatörde yapılır. Desteklenmeyen topolojiler dönüştürücüde reddedilir.';
  };
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    checks.replaceChildren();
    try {
      if (file.size > 2000000) throw Error('Rapor en fazla 2 MB olabilir.');
      const r = AgLabLabEvidence.parse(await file.text());
      status.textContent =
        r.engine +
        ' · ayrı Lab · ' +
        r.events.length +
        ' doğrulama adımı · içe aktarılan rapor, imzası doğrulanmadı';
      for (const event of r.events) {
        const d = document.createElement('details'),
          s = document.createElement('summary'),
          p = document.createElement('pre');
        s.textContent =
          event.detail.name + ' · ' + (event.detail.ok ? 'Beklenti karşılandı' : 'Başarısız');
        p.style.whiteSpace = 'pre-wrap';
        p.textContent =
          'Motor: ' +
          r.engine +
          '\nBeklenen/gerçek sonuç ve yapılandırma kanıtı:\n' +
          JSON.stringify(event.detail.evidence, null, 2);
        d.append(s, p);
        checks.append(d);
      }
      document.dispatchEvent(new CustomEvent('aglab:external-lab-evidence', { detail: r }));
    } catch (e) {
      status.textContent = 'Rapor açılmadı: ' + e.message;
    }
    input.value = '';
  };
})();
