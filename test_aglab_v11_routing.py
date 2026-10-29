import json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
B=Path('/mnt/data');top=json.loads((B/'static-routing-two-routers.aglab.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((B/'AgLab_Final_PKT_Import.html').read_text(),wait_until='domcontentloaded')
 def load(t):
  with tempfile.NamedTemporaryFile('w',suffix='.json',delete=False) as f:json.dump(t,f);name=f.name
  page.locator('#ptImportFile').set_input_files(name);page.wait_for_timeout(250)
 def cli(cmd):
  page.evaluate('''cmd=>{document.querySelector('#ptCliDevice').value='d1';document.querySelector('#ptCliInput').value=cmd;document.querySelector('#ptCliForm').requestSubmit()}''',cmd)
  return page.locator('#ptTerminal').inner_text()
 load(top);out=cli('show ip route');assert 'C 192.168.1.0/24' in out,out[-1500:]
 broken=json.loads(json.dumps(top))
 link=next(l for l in broken['links'] if (l['a']=='d1' and l['portA']=='g0/0') or (l['b']=='d1' and l['portB']=='g0/0'))
 link['up']=False;load(broken)
 out=cli('show ip route');assert 'C 192.168.1.0/24' not in out.split('Codes: C - connected')[-1],out[-1500:]
 out=cli('show ip interface brief');assert 'g0/0            192.168.1.1     down     down' in out,out[-1500:]
 assert not errors,errors
 browser.close()
print('PASS v11: connected route removed after link down, CLI status consistent')
