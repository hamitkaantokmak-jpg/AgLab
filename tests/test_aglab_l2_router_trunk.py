"""PT XML -> browser: physical untagged router vs dot1Q trunk traffic."""
import base64,json,tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from aglab_test_support import ROOT, launch_chromium
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright

def topology(vlan,native,tagged=False,allowed=True,sub_enabled=True):
 root=ET.Element('PACKETTRACER5');network=ET.SubElement(root,'NETWORK');devices=ET.SubElement(network,'DEVICES');links=ET.SubElement(network,'LINKS')
 router=['interface GigabitEthernet0/0','no shutdown']
 if tagged:router+=['interface GigabitEthernet0/0.500','encapsulation dot1Q '+str(vlan)]
 router+=['ip address 192.168.50.1 255.255.255.0','no shutdown' if sub_enabled else 'shutdown']
 switch=['vlan '+str(vlan),'interface FastEthernet0/1','switchport access vlan '+str(vlan),'interface GigabitEthernet0/1','switchport mode trunk','switchport trunk native vlan '+str(native),'switchport trunk allowed vlan '+(str(vlan) if allowed else 'none')]
 for name,kind,config,ip in [('SW','Switch',switch,None),('R','Router',router,None),('PC','PC',[],'192.168.50.2')]:
  engine=ET.SubElement(ET.SubElement(devices,'DEVICE'),'ENGINE')
  for key,value in [('TYPE',kind),('NAME',name),('SAVE_REF_ID',name),('IP',ip)]:
   if value is not None:ET.SubElement(engine,key).text=value
  cfg=ET.SubElement(engine,'RUNNINGCONFIG')
  for line in config:ET.SubElement(cfg,'LINE').text=line
 for a,pa,b,pb in [('SW','FastEthernet0/1','PC','FastEthernet0'),('SW','GigabitEthernet0/1','R','GigabitEthernet0/0')]:
  c=ET.SubElement(ET.SubElement(links,'LINK'),'CABLE')
  for k,v in [('FROM',a),('TO',b),('PORT',pa),('PORT',pb)]:ET.SubElement(c,k).text=v
 xml=ET.tostring(root);obj,report=convert(xml)
 assert not report['unmodeledConfigLines'],report
 assert base64.b64decode(obj['sourceArchive']['decodedXmlBase64'])==xml
 return obj

with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 browser=launch_chromium(pw);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());path=Path(tmp)/'l2.json'
 def command(device,text):
  before=page.locator('#ptTerminal').inner_text()
  page.evaluate("([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",[device,text])
  return page.locator('#ptTerminal').inner_text()[len(before):]
 def ping(device,target,expected):
  out=command(device,'ping '+target)
  assert ('100 percent (5/5)' if expected else '0 percent (0/5)') in out,out
 count=0
 for vlan in (10,77,333):
  for native,tagged,allowed,enabled,expected in [(1,False,True,True,False),(vlan,False,True,True,True),(1,True,True,True,True),(vlan,True,True,True,False),(1,True,False,True,False),(1,True,True,False,False)]:
   obj=topology(vlan,native,tagged,allowed,enabled);path.write_text(json.dumps(obj));page.locator('#ptImportFile').set_input_files(str(path));page.wait_for_timeout(50)
   ping('d3','192.168.50.1',expected);ping('d2','192.168.50.2',expected);count+=1
 # Actual CLI change must recover and then fail again; no topology regeneration.
 path.write_text(json.dumps(topology(10,1)));page.locator('#ptImportFile').set_input_files(str(path));page.wait_for_timeout(50)
 for native,expected in [(10,True),(1,False),(10,True)]:
  for text in ['enable','configure terminal','interface gi0/1','switchport trunk native vlan '+str(native),'end']:command('d1',text)
  ping('d3','192.168.50.1',expected);ping('d2','192.168.50.2',expected)
 assert not errors,errors;browser.close()
print('PASS:',count,'PT cases, bidirectional ping and CLI native VLAN failure/recovery; original XML preserved')
