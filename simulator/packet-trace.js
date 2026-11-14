// Simulation Mode / Paket Dedektifi için son ping izi (L7b: yalnız Labber).
// İz Labber olay adaptöründen gelir (AgLabSim.pingTrace, labberSimulationCapture). Eski
// motorun Ethernet iletimi ve olay kaydı kaldırıldı; burada yalnız son izin kendisi, kuşak
// numarası ve izin alındığı topolojinin parmak izi tutulur.
let ethernetTraceGeneration = 0,
  ethernetTraceTopology = '',
  ethernetLabberTrace = null;
function ethernetTopologyFingerprint() {
  if (typeof devices === 'undefined' || typeof links === 'undefined') return '';
  return JSON.stringify({ devices: devices.map(({ x, y, w, h, ...d }) => d), links });
}
function beginEthernetEvents() {
  ethernetLabberTrace = null;
  ethernetTraceGeneration++;
  ethernetTraceTopology = ethernetTopologyFingerprint();
}
function finishEthernetTrace() {
  ethernetTraceTopology = ethernetTopologyFingerprint();
}
function readEthernetTrace() {
  const metadata = { generation: ethernetTraceGeneration, topologyKey: ethernetTraceTopology };
  if (ethernetLabberTrace) return AgLabPacketEvents.fromLabber(ethernetLabberTrace, metadata);
  // Henüz iz yok (ping yapılmadı ya da içerik değişti): boş Labber izi.
  return AgLabPacketEvents.fromLabber({ records: [], l2: true }, metadata);
}
