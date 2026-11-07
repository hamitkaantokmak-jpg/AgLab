"""Diagnostic Chromium UI measurements; no inferred gain or full WCAG claim."""
import json,os,tempfile,time,math
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from aglab_test_support import ROOT, launch_chromium

def topology(count):
 ds=[];links=[]
 for i in range(count-2):
  ds.append({'id':'s'+str(i),'name':'SW'+str(i),'type':'Switch','x':200+i%7*120,'y':100+i//7*85,'w':112,'h':72,'enabled':True,'ports':['fa0/1','fa0/2','gi0/1','gi0/2'],'interfaces':{port:{'mode':'access','vlan':1,'allowed':[1],'nativeVlan':1,'enabled':True} for port in ['fa0/1','fa0/2','gi0/1','gi0/2']},'vlans':[1]})
  if i:links.append({'a':'s'+str(i-1),'b':'s'+str(i),'portA':'gi0/1','portB':'gi0/2','up':True})
 for i in range(2):
  ds.append({'id':'p'+str(i),'name':'PC'+str(i),'type':'PC','x':60,'y':80+i*150,'w':104,'h':72,'enabled':True,'ip':'10.0.0.'+str(i+1),'mask':'255.255.255.0','gateway':'','vlan':1,'ports':['eth0'],'interfaces':{'eth0':{'enabled':True}}})
  links.append({'a':'p'+str(i),'b':'s'+str(0 if i==0 else count-3),'portA':'eth0','portB':'fa0/1','up':True})
 return {'app':'AgLab','version':23,'devices':ds,'links':links,'nextId':count+1}

rows=[]
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 browser=launch_chromium(pw)
 for count in (10,50,100,250):
  page=browser.new_page(viewport={'width':1280,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));cdp=page.context.new_cdp_session(page);cdp.send('Performance.enable')
  row={'devices':count,'samples':1}
  def measure(key,operation):
   start=time.perf_counter();operation();page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');row[key]=round((time.perf_counter()-start)*1000,2)
  measure('app_load_ms',lambda:page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri()))
  page.click('[data-area="lab"]');page.click('#ux14Free');page.click('#uxMoreLabActions')
  path=Path(tmp)/str(count);path.write_text(json.dumps(topology(count)))
  def load():
   page.locator('#ptImportFile').set_input_files(str(path));page.wait_for_function('(n)=>academyEngine.snapshot().devices.length===n',arg=count)
  measure('topology_import_ms',load)
  expect(page.locator('#ptCanvas .pt-node')).to_have_count(count)
  measure('device_add_ms',lambda:page.click('[data-pt-add="PC"]'))
  added=page.evaluate('academyEngine.snapshot().devices.at(-1).id')
  previous=page.evaluate("academyEngine.snapshot().devices.find(d=>d.id==='p0').x")
  def drag():
   node=page.locator('#ptCanvas g[data-id="p0"]');node.scroll_into_view_if_needed();box=node.bounding_box();x=box['x']+20;y=box['y']+20
   page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+12,y+8,steps=3);page.mouse.up()
  measure('drag_ms',drag)
  row['drag_changed']=page.evaluate("academyEngine.snapshot().devices.find(d=>d.id==='p0').x")!=previous
  assert row['drag_changed'],row
  page.select_option('#ptSource',added);page.select_option('#ptTarget','s0')
  before=page.locator('#ptCanvas line.pt-edge').count();measure('cable_add_ms',lambda:page.click('#ptMakeLink'));expect(page.locator('#ptCanvas line.pt-edge')).to_have_count(before+1)
  measure('browser_pinch_zoom_ms',lambda:cdp.send('Emulation.setPageScaleFactor',{'pageScaleFactor':2}))
  row['visual_viewport_scale']=page.evaluate('visualViewport.scale');cdp.send('Emulation.setPageScaleFactor',{'pageScaleFactor':1})
  def open_cli():
   page.locator('#ptCanvas g[data-id="p0"]').click();expect(page.locator('#ptDeviceCliDialog')).to_be_visible()
  measure('cli_open_ms',open_cli);page.keyboard.press('Escape')
  def panels():page.click('[data-area="learn"]');page.click('[data-area="troubleshoot"]');page.click('[data-area="lab"]')
  measure('panel_roundtrip_ms',panels)
  page.select_option('#ptCliDevice','p0');page.fill('#ptCliInput','ping 10.0.0.2');page.press('#ptCliInput','Enter');expect(page.locator('#ptTerminal')).to_contain_text('100 percent')
  measure('packet_detective_ms',lambda:page.click('#packetDetectiveRefresh'));assert page.locator('#packetDetectiveRaw').text_content()
  cdp.send('HeapProfiler.collectGarbage');row['retained_page_heap_bytes']=next(m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name']=='JSHeapUsedSize')
  assert not errors,errors
  assert all(math.isfinite(v) and v>=0 for k,v in row.items() if k.endswith('_ms'))
  rows.append(row);page.close()
 report={'browser':browser.version,'scope':'One diagnostic sample per size in fresh pages of one Chromium process. Wall-clock UI timings include Playwright overhead and two animation frames; no performance improvement or statistical comparison claimed. Heap is the entire page after GC. Zoom is browser pinch scaling, not proof of WCAG 200% reflow. No app canvas zoom feature is invented. Large topology import is a test fixture; add, cable, drag, CLI and event viewing use actual controls.','rows':rows}
 browser.close()
out=Path(os.environ.get('AGLAB_TEST_ARTIFACT_DIR',ROOT/'dist'));out.mkdir(parents=True,exist_ok=True);(out/'unified-rc-performance.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('UNIFIED_PERFORMANCE '+json.dumps(report))
