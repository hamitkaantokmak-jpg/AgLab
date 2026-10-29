from pathlib import Path
from playwright.sync_api import sync_playwright
import json,tempfile
B=Path('/mnt/data')
topo=json.loads((B/'static-routing-two-routers.aglab.json').read_text())
r=next(d for d in topo['devices'] if d['name']=='R1')
r['interfaces']['g0/0.20']={'ip':'192.168.20.1','mask':'255.255.255.0','enabled':True,'parent':'g0/0','vlan':20,'encapsulation':'dot1q'}
with tempfile.NamedTemporaryFile(mode='w',suffix='.json',delete=False) as f:
 json.dump(topo,f);path=f.name
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((B/'AgLab_Final_PKT_Import.html').read_text(),wait_until='domcontentloaded')
 page.locator('#ptImportFile').set_input_files(path)
 page.wait_for_timeout(250)
 def cmd(x):
  page.evaluate('''([id,cmd])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=cmd;document.querySelector('#ptCliForm').requestSubmit()}''',[r['id'],x])
  return page.locator('#ptTerminal').inner_text()
 out=cmd('show ip interface brief')
 assert 'g0/0.20         192.168.20.1    up     up' in out,out[-1300:]
 # parent shutdown => child cannot remain operational
 page.evaluate('''(id)=>{document.querySelector('#ptCliDevice').value=id}''',r['id'])
 for x in ['enable','configure terminal','interface g0/0','shutdown','end'] :cmd(x)
 out=cmd('show ip interface brief')
 assert 'g0/0.20         192.168.20.1    administratively down     down' in out,out[-1300:]
 assert not errors,errors
 b.close()
print('PASS: subinterface inherits parent link and shutdown')
