// L5-h: Python testlerinin Labber köprüsünü (src/sim.generated.js) tarayıcısız çağırması için.
// Girdi (stdin): {"fn": "cliImport", "topologies": [AğLab JSON, ...]}
// Çıktı (stdout): her topoloji için {diffs, lines, decision, reasons}
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim.generated.js'), 'utf8');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code + '\n;globalThis.__sim = AgLabSim;', ctx);
const sim = ctx.__sim;
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const out = input.topologies.map((t) => {
  const r = sim.cliImport(t);
  return {
    decision: r.bridge.report.engineDecision,
    reasons: r.bridge.report.reasons,
    diffs: r.diffs,
    extended: r.extended,
    lines: r.lines,
    report: sim.importReportWithCli(t.importReport, t, r.lines),
  };
});
process.stdout.write(JSON.stringify(out));
