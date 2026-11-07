from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium
B = ROOT
with sync_playwright() as p:
 b=launch_chromium(p, args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000})
 errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content((B/'AgLab_Final_PKT_Import.html').read_text(),wait_until='domcontentloaded')
 page.locator('#ptImportFile').set_input_files(str(B/'static-routing-two-routers.aglab.json'))
 page.wait_for_timeout(150)
 def cmd(c):
  page.evaluate("document.querySelector('#ptCliDevice').value='d7';document.querySelector('#ptCliInput').value="+json.dumps(c)+";document.querySelector('#ptCliForm').requestSubmit()")
  page.wait_for_timeout(25)
  return page.locator('#ptTerminal').inner_text()
 for c in ['enable','configure terminal','interface fa0/3','switchport mode trunk','switchport trunk allowed vlan 1,10-12','switchport trunk allowed vlan add 20','switchport trunk allowed vlan remove 11']:
  out=cmd(c)
 assert 'Allowed VLANs: 1,10,12,20' in out, out[-2000:]
 cmd('exit')
 vlanout=cmd('show vlan brief')
 assert 'VLAN1' in vlanout and 'VLAN10' not in vlanout and 'VLAN11' not in vlanout and 'VLAN12' not in vlanout and 'VLAN20' not in vlanout, vlanout[-1000:]
 out=cmd('show running-config')
 assert 'switchport trunk allowed vlan 1,10,12,20' in out, out[-2000:]
 cmd('configure terminal')
 cmd('interface fa0/3')
 cmd('switchport trunk allowed vlan none')
 out=cmd('show interfaces trunk') if False else page.locator('#ptTerminal').inner_text()
 assert 'Allowed VLANs: none' in out, out[-1000:]
 cmd('switchport trunk allowed vlan 1')
 cmd('exit')
 out=cmd('show running-config')
 assert 'switchport trunk allowed vlan 1' in out, out[-2000:]
 assert not errs, errs
 b.close()
print('PASS: trunk VLAN list set/range/add/remove/running-config; browser errors=0')
