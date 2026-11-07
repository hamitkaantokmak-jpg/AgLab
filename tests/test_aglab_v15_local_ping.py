import json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium
B = ROOT;base=json.loads((B/'static-routing-two-routers.aglab.json').read_text())
with sync_playwright() as p:
 browser=launch_chromium(p, args=['--no-sandbox'])
 page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((B/'AgLab_Final_PKT_Import.html').read_text(),wait_until='domcontentloaded')
 def run(top,device,target):
  with tempfile.NamedTemporaryFile('w',suffix='.json',delete=False) as f:json.dump(top,f);name=f.name
  expected=next(d for d in top['devices'] if d['id']==device)
  page.locator('#ptImportFile').set_input_files(name)
  # FileReader completion is asynchronous; fixed 120ms could probe the prior lab.
  page.wait_for_function("e=>{const d=aglabEngines.capture().devices.find(d=>d.id===e.id);return d&&d.enabled===e.enabled&&d.interfaces['g0/1'].enabled===e.interfaces['g0/1'].enabled}",arg=expected)
  before=page.locator('#ptTerminal').inner_text()
  page.evaluate("a=>{document.querySelector('#ptCliDevice').value=a[0];document.querySelector('#ptCliInput').value='ping '+a[1];document.querySelector('#ptCliForm').requestSubmit()}",[device,target])
  return page.locator('#ptTerminal').inner_text()[len(before):]
 normal=run(base,'d1','10.0.0.1');assert 'Success rate is 100 percent' in normal,normal[-700:]
 off=json.loads(json.dumps(base));next(d for d in off['devices'] if d['id']=='d1')['enabled']=False
 output=run(off,'d1','10.0.0.1');assert 'Kaynak veya hedef cihaz kapalı' in output,output[-700:]
 shut=json.loads(json.dumps(base));r=next(d for d in shut['devices'] if d['id']=='d1');r['interfaces']['g0/1']['enabled']=False
 output=run(shut,'d1','10.0.0.1');assert 'Hedef router arayüzü' in output,output[-700:]
 assert not errors,errors
 browser.close()
print('PASS v15: local ping active, powered off, interface shutdown; JS errors 0')
