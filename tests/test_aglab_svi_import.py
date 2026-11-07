"""Packet Tracer SVI config -> normalized model -> real management ping."""
import base64,json,tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from aglab_test_support import ROOT, launch_chromium
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright,expect

def source(shutdown=False):
 root=ET.Element('PACKETTRACER5');network=ET.SubElement(root,'NETWORK');devices=ET.SubElement(network,'DEVICES');links=ET.SubElement(network,'LINKS')
 for name,kind,config,ip in [
  ('SW1','Switch',['vlan 10','name Yonetim','!','interface FastEthernet0/1','switchport access vlan 10','!','interface FastEthernet0/2','switchport access vlan 10','!','interface Vlan10','ip address 192.168.10.2 255.255.255.0','shutdown' if shutdown else 'no shutdown','!','ip default-gateway 192.168.10.1','ip routing'],None),
  ('R1','Router',['interface GigabitEthernet0/0','ip address 192.168.10.1 255.255.255.0','no shutdown'],None),
  ('PC1','PC',[],'192.168.10.3')]:
  eng=ET.SubElement(ET.SubElement(devices,'DEVICE'),'ENGINE')
  for key,value in [('TYPE',kind),('NAME',name),('SAVE_REF_ID',name),('IP',ip)]:
   if value is not None:ET.SubElement(eng,key).text=value
  cfg=ET.SubElement(eng,'RUNNINGCONFIG')
  for line in config:ET.SubElement(cfg,'LINE').text=line
 for a,pa,b,pb in [('SW1','FastEthernet0/1','R1','GigabitEthernet0/0'),('SW1','FastEthernet0/2','PC1','FastEthernet0')]:
  cable=ET.SubElement(ET.SubElement(links,'LINK'),'CABLE')
  for key,value in [('FROM',a),('PORT',pa),('TO',b),('PORT',pb)]:ET.SubElement(cable,key).text=value
 return ET.tostring(root)

cases=[]
for shutdown in (False,True):
 xml=source(shutdown);obj,report=convert(xml);sw=obj['devices'][0]
 assert sw['interfaces'].get('vlan10')=={'ip':'192.168.10.2','mask':'255.255.255.0','enabled':not shutdown,'vlan':10},sw['interfaces'].get('vlan10')
 assert sw['vlanNames']=={'10':'Yonetim'} and sw['gateway']=='192.168.10.1'
 assert 'vlan10' not in sw['ports'] and sw['config']['unmodeledInterfaces']==[]
 assert [r['command'] for r in report['unmodeledConfigLines']]==['ip routing'],report['unmodeledConfigLines']
 assert base64.b64decode(obj['sourceArchive']['decodedXmlBase64'])==xml
 cases.append(obj)
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 browser=launch_chromium(pw);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());path=Path(tmp)/'svi-import.json'
 for index,obj in enumerate(cases):
  path.write_text(json.dumps(obj));before=page.locator('#ptTerminal').inner_text()
  page.locator('#ptImportFile').set_input_files(str(path));page.wait_for_function('n=>document.querySelector("#ptTerminal").innerText.length>n',arg=len(before))
  assert '3 cihaz, 2 bağlantı' in page.locator('#ptTerminal').inner_text()[len(before):]
  before=page.locator('#ptTerminal').inner_text()
  page.evaluate("document.querySelector('#ptCliDevice').value='d1';document.querySelector('#ptCliInput').value='ping 192.168.10.1';document.querySelector('#ptCliForm').requestSubmit()")
  output=page.locator('#ptTerminal').inner_text()[len(before):]
  assert ('100 percent' if index==0 else '0 percent (0/5)') in output,output
 assert not errors,errors;browser.close()
print('PASS: PT SVI/VLAN name/gateway/shutdown import, unmodeled L3 warning, XML archive and live ping')
