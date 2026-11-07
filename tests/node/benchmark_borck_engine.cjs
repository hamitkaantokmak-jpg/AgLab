'use strict';
const {performance}=require('node:perf_hooks'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../../simulator/borck-fixtures.cjs'),third=require('../../simulator/borck-engine.generated.js'),reference=require('../../simulator/borck-production-reference.cjs');
const median=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)];
const rows=[];
for(const devices of [10,50,100,250])for(const engine of ['AğLab Ethernet','MIT NetSim']){
 const samples=[];
 for(let i=0;i<9;i++){
  const topology=fixture(devices);if(global.gc)global.gc();const heap=process.memoryUsage().heapUsed,t0=performance.now();
  const s=engine==='MIT NetSim'?third.createSession(topology):reference.session(topology),t1=performance.now();
  const cold=engine==='MIT NetSim'?s.ping('p0','10.0.0.2'):s.ping(),t2=performance.now();
  const warm=engine==='MIT NetSim'?s.ping('p0','10.0.0.2'):s.ping(),t3=performance.now();
  if(!cold.ok||!warm.ok)throw Error('Benchmark ping failed: '+engine+'/'+devices);
  if(i>=2)samples.push({start:t1-t0,cold:t2-t1,warm:t3-t2,heap:process.memoryUsage().heapUsed-heap,events:cold.events.length});
 }
 rows.push({devices,engine,samples:samples.length,start_ms:median(samples.map(s=>s.start)),cold_ping_ms:median(samples.map(s=>s.cold)),warm_ping_ms:median(samples.map(s=>s.warm)),heap_delta_bytes:median(samples.map(s=>s.heap)),cold_event_count:median(samples.map(s=>s.events))});
}
const report={runtime:process.version,platform:process.platform,architecture:process.arch,gc:!!global.gc,scope:'Same Node process; loop-free two access switches + PCs. Existing real Ethernet/MAC modules in VM with app dependencies supplied, compared to bundled upstream engine. Init includes VM creation for existing engine. Modules loaded before timing. Seven median samples after two warmups. Heap delta is allocation during init + two pings, not retained memory. Events have different semantics; per-packet CPU time is not measured. No browser rendering, trunk, routing, or 40-lab performance claim.',rows};
const out=process.env.AGLAB_TEST_ARTIFACT_DIR||path.join(__dirname,'../../dist');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'borck-benchmark.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
