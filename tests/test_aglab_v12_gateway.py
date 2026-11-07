import json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium
B = ROOT;original=json.loads((B/'static-routing-two-routers.aglab.json').read_text())
with sync_playwright() as p:
 b=launch_chromium(p, args=['--no-sandbox'])
 page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((B/'AgLab_Final_PKT_Import.html').read_text(),wait_until='domcontentloaded')
 def check(change,expected):
  t=json.loads(json.dumps(original));change(t)
  with tempfile.NamedTemporaryFile('w',suffix='.json',delete=False) as f:json.dump(t,f);path=f.name
  page.locator('#ptImportFile').set_input_files(path);page.wait_for_timeout(130)
  page.evaluate('''()=>{document.querySelector('#ptCliDevice').value='d3';document.querySelector('#ptCliInput').value='ping 192.168.2.2';document.querySelector('#ptCliForm').requestSubmit()}''')
  out=page.locator('#ptTerminal').inner_text();assert expected in out,(expected,out[-1300:])
 check(lambda t:None,'Success rate is 100 percent (5/5)')
 check(lambda t:next(d for d in t['devices'] if d['id']=='d3').update(gateway=''),'varsayılan gateway yapılandırılmamış')
 check(lambda t:next(d for d in t['devices'] if d['id']=='d5').update(gateway=''),'dönüş trafiği için varsayılan gateway')
 assert not errors,errors
 b.close()
print('PASS: valid gateway, missing source gateway, missing destination gateway; JS errors 0')
