"""Same Chromium process/capability scope; raw timings, no speed superiority gate."""
import json,os,statistics,subprocess,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium
rows=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 browser=launch_chromium(pw, args=['--enable-precise-memory-info'])
 for count in (10,50,100,250):
  topology=json.loads(subprocess.check_output(['node','-e',f"let t=require('./simulator/borck-fixtures.cjs').fixture({count});t.devices.forEach((d,i)=>Object.assign(d,{{x:80+(i%10)*115,y:80+Math.floor(i/10)*85,w:104,h:72}}));console.log(JSON.stringify({{app:'AgLab',version:23,...t,nextId:999}}))"],cwd=ROOT,text=True))
  f=Path(tmp)/'topology.json';f.write_text(json.dumps(topology),encoding='utf-8')
  for engine in ('aglab-js','borck'):
   samples=[]
   for trial in range(4):
    context=browser.new_context();page=context.new_page();cdp=context.new_cdp_session(page)
    t=time.perf_counter();page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());app_load=(time.perf_counter()-t)*1000
    page.click('[data-area="lab"]')
    t=time.perf_counter();page.locator('#ptImportFile').set_input_files(str(f));page.wait_for_function('(n)=>aglabEngines.capture().devices.length===n',arg=count);import_ms=(time.perf_counter()-t)*1000
    cdp.send('HeapProfiler.collectGarbage');cdp.send('Performance.enable')
    heap_before=next(m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name']=='JSHeapUsedSize')
    result=page.evaluate('''engine=>{
      const t=performance.now(),topology=aglabEngines.capture();
      if(engine==='aglab-js'){
       const check=aglabEngines.check('borck');if(!check.ok)throw Error(check.reasons.join('; '));
       const setup=performance.now()-t;
       return {setup_ms:setup,...aglabEngines.benchmarkAccess('p0','p1')};
      }
      window.perfSession=aglabEngines.createComparisonSession();
      const start=performance.now(),a=perfSession.ping('p0','10.0.0.2',{includeTables:false}),first=performance.now(),b=perfSession.ping('p0','10.0.0.2',{includeTables:false}),second=performance.now(),tables=perfSession.snapshot(),end=performance.now();
      return {ok:a.ok&&b.ok,setup_ms:start-t,first_ms:first-start,second_ms:second-first,tables_ms:end-second,table_entries:Object.values(tables.mac).reduce((n,t)=>n+t.length,0)};
    }''',engine)
    assert result['ok'] and result['table_entries']>=4,(count,engine,result)
    cdp.send('HeapProfiler.collectGarbage');heap_after=next(m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name']=='JSHeapUsedSize')
    page.locator('#engineCapabilities').evaluate('(e)=>e.open=true');page.select_option('#ptSource','p0');page.select_option('#ptTarget','p1');page.select_option('#engineChoice',engine)
    ui_ms=page.evaluate('''()=>new Promise(resolve=>{const t=performance.now();document.querySelector('#engineRun').click();requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-t)));})''')
    assert json.loads(page.locator('#engineResult').inner_text())['ok']
    if trial:samples.append({'app_load_ms':app_load,'topology_import_ms':import_ms,'setup_ms':result['setup_ms'],'first_ping_ms':result['first_ms'],'second_ping_ms':result['second_ms'],'tables_ms':result['tables_ms'],'retained_heap_bytes':heap_after,'extra_heap_bytes':heap_after-heap_before,'ui_response_ms':ui_ms})
    context.close()
   rows.append({'devices':count,'engine':engine,'samples':len(samples),**{k:statistics.median(s[k] for s in samples) for k in samples[0]}})
 report={'browser':browser.version,'platform':os.name,'scope':'Same Chromium process, fresh contexts, same two access switches plus PCs, 1 warmup and 3 median samples. No trunk/STP comparison. Shared HTML load/import measured separately. JS setup is capture/capability check because its engine already lives in the application; NetSim setup additionally constructs its independent session. Core pings exclude table serialization; no animation waits. Retained heap is entire page after GC; extra heap is additional retained state since import and is not standalone engine memory. UI response includes result text and two animation frames. These are integration costs, not proof of general superiority.','rows':rows}
 browser.close()
out=Path(os.environ.get('AGLAB_TEST_ARTIFACT_DIR',ROOT/'dist'));out.mkdir(exist_ok=True,parents=True);(out/'browser-engine-benchmark.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('BROWSER_BENCHMARK '+json.dumps(report))
