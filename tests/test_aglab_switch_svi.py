"""A: CLI, B: model/config, C: live management traffic, D: persistence."""
import functools
import http.server
import json
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from aglab_test_support import ROOT
module=(ROOT/'simulator/switch-management.js').read_text()
assert '// BEGIN SWITCH MANAGEMENT GENERATED\n'+module+'\n// END SWITCH MANAGEMENT GENERATED\n' in (ROOT/'AgLab_Final_PKT_Import.html').read_text(), 'Generated simulator source is stale'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/AgLab_Final_PKT_Import.html'
try:
 with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
  profile=str(Path(tmp)/'profile');errors=[]
  def open_page():
   context=pw.chromium.launch_persistent_context(profile,headless=True)
   p=context.pages[0];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(url)
   p.click('[data-area="lab"]');p.click('#ux14Free');return context,p
  context,page=open_page()
  # Real DOM change only when switching device (a repeated select event resets modes).
  def cmd(device,text,ok=True):
   if page.locator('#ptCliDevice').input_value()!=device:page.select_option('#ptCliDevice',device)
   before=page.locator('#ptTerminal').inner_text();page.fill('#ptCliInput',text);page.press('#ptCliInput','Enter')
   output=page.locator('#ptTerminal').inner_text()[len(before):]
   error='outerr' in (page.locator('#ptTerminal > div').last.get_attribute('class') or '')
   if ok:assert not error,(text,output)
   else:assert error,(text,output)
   return output
  def run(device,commands):
   for text in commands:cmd(device,text)
  def snapshot():return page.evaluate("JSON.parse(localStorage.getItem('aglab-topology-v23'))")
  def ping(device,target,success):
   output=cmd(device,'ping '+target,ok=success)
   assert ('Success rate is 100 percent (5/5)' if success else 'Success rate is 0 percent (0/5)') in output,output
   return output
  empty=Path(tmp)/'empty.json';empty.write_text(json.dumps({'app':'AgLab','version':23,'devices':[],'links':[],'nextId':1}))
  page.locator('#ptImportFile').set_input_files(str(empty));expect(page.locator('#ptCanvasStatus')).to_contain_text('0 cihaz')
  for kind in ('Switch','Router','PC'):page.locator(f'[data-pt-add="{kind}"]').click()
  for source,target in [('d1','d2'),('d3','d1')]:
   page.select_option('#ptSource',source);page.select_option('#ptTarget',target);page.click('#ptMakeLink')
  cmd('d1','interface vlan 10',False)
  cmd('d1','shutdown',False)
  run('d1',['enable','configure terminal','interface vlan 10','exit','vlan 10','exit','interface fa0/1','switchport mode access','switchport access vlan 10','exit','interface fa0/2','switchport mode access','switchport access vlan 10','exit','interface vlan 10'])
  run('d1',['ip address 192.168.10.2 255.255.255.0','no shutdown','exit','ip default-gateway 192.168.10.1','vlan 10','name Yonetim','exit','end'])
  run('d2',['enable','configure terminal','interface g0/0','ip address 192.168.10.1 255.255.255.0','no shutdown','end'])
  run('d3',['ip address 192.168.10.3 255.255.255.0','ip default-gateway 192.168.10.1'])
  cmd('d1','ip default-gateway 192.168.10.254',False)
  run('d1',['enable','configure terminal'])
  for invalid in ['vlan 0','vlan 4095','vlan 10.5','interface vlan 10.5','no vlan 1']:cmd('d1',invalid,False)
  run('d1',['interface vlan 10'])
  for invalid in ['ip address 999.1.1.1 255.255.255.0','ip address 192.168.10.2 255.0.255.0','switchport mode trunk']:cmd('d1',invalid,False)
  cmd('d1','end')
  print('PASS A: modes, VLAN name and invalid input rejection',flush=True)
  sw=next(d for d in snapshot()['devices'] if d['id']=='d1')
  assert sw['interfaces']['vlan10']=={'ip':'192.168.10.2','mask':'255.255.255.0','enabled':True,'vlan':10}
  assert sw['gateway']=='192.168.10.1' and sw['vlanNames']['10']=='Yonetim'
  assert 'vlan10' not in sw['ports']
  config=cmd('d1','show running-config');assert 'interface Vlan10' in config and 'ip default-gateway 192.168.10.1' in config and 'name Yonetim' in config
  assert 'Yonetim' in cmd('d1','show vlan brief')
  brief=cmd('d1','show ip interface brief');assert 'Vlan10' in brief and '192.168.10.2' in brief
  assert 'line protocol is up' in cmd('d1','show interfaces vlan 10')
  expect(page.locator('#ptDeviceInfo')).to_contain_text('Vlan10: 192.168.10.2')
  for show in ['show interfaces status','show interfaces trunk','show mac address-table']:cmd('d1',show)
  print('PASS B: persisted model and real show output',flush=True)
  ping('d1','192.168.10.1',True);ping('d3','192.168.10.2',True)
  assert '192.168.10.1' in cmd('d1','show arp')
  run('d2',['enable','configure terminal','interface g0/0','shutdown','end']);ping('d1','192.168.10.1',False)
  assert 'line protocol is up' in cmd('d1','show interfaces vlan 10') # PC port still forwards
  run('d1',['enable','configure terminal','interface fa0/2','shutdown','end'])
  assert 'line protocol is down' in cmd('d1','show interfaces vlan 10')
  run('d2',['enable','configure terminal','interface g0/0','no shutdown','end'])
  ping('d1','192.168.10.1',True)
  run('d1',['enable','configure terminal','interface fa0/2','no shutdown','exit','interface vlan 10','shutdown','end']);ping('d1','192.168.10.1',False)
  run('d1',['enable','configure terminal','interface vlan 10','no shutdown','exit','no vlan 10','end']);ping('d1','192.168.10.1',False)
  run('d1',['enable','configure terminal','vlan 10','name Yonetim','exit','end']);ping('d1','192.168.10.1',True)
  # Strict untagged management: physical router interface must match trunk native VLAN.
  run('d1',['enable','configure terminal','interface fa0/1','switchport mode trunk','switchport trunk allowed vlan 10','switchport trunk native vlan 1','end']);ping('d1','192.168.10.1',False)
  run('d1',['enable','configure terminal','interface fa0/1','switchport trunk native vlan 10','end']);ping('d1','192.168.10.1',True)
  run('d1',['enable','configure terminal','interface fa0/1','switchport trunk allowed vlan none','end']);ping('d1','192.168.10.1',False)
  run('d1',['enable','configure terminal','interface fa0/1','switchport trunk allowed vlan all','switchport mode access','end'])
  # A second remote PC proves management gateway and return reachability.
  page.locator('[data-pt-add="PC"]').click();page.select_option('#ptSource','d2');page.select_option('#ptTarget','d4');page.click('#ptMakeLink')
  run('d2',['enable','configure terminal','interface g0/1','ip address 192.168.20.1 255.255.255.0','no shutdown','end'])
  run('d4',['ip address 192.168.20.2 255.255.255.0','ip default-gateway 192.168.20.1'])
  run('d1',['enable','configure terminal','no ip default-gateway','end']);ping('d1','192.168.20.2',False);ping('d1','192.168.20.1',False);ping('d1','192.168.10.1',True)
  run('d1',['enable','configure terminal','ip default-gateway 192.168.10.254','end']);ping('d1','192.168.20.2',False)
  run('d1',['enable','configure terminal','ip default-gateway 192.168.10.1','end']);ping('d1','192.168.20.2',True);ping('d1','192.168.20.1',True);ping('d4','192.168.10.2',True)
  arp=cmd('d1','show arp');assert '192.168.10.1' in arp and '192.168.20.2' not in arp,arp
  # SVI is a management endpoint, not a multilayer switch.
  page.locator('[data-pt-add="PC"]').click();page.select_option('#ptSource','d5');page.select_option('#ptTarget','d1');page.click('#ptMakeLink')
  run('d1',['enable','configure terminal','vlan 20','exit','interface gi0/1','switchport mode access','switchport access vlan 20','exit','interface vlan 20','ip address 192.168.30.1 255.255.255.0','no shutdown','end'])
  run('d5',['ip address 192.168.30.2 255.255.255.0','ip default-gateway 192.168.30.1'])
  output=ping('d1','192.168.30.2',True);assert 'Kaynak SVI: vlan20 192.168.30.1' in output,output
  cmd('d3','ip default-gateway 192.168.10.2');ping('d3','192.168.30.2',False)
  cmd('d3','ip default-gateway 192.168.10.1')
  print('PASS C: management ping, PC-to-SVI, gateway, router/SVI/VLAN/port/native/allowed failures and recovery',flush=True)
  cmd('d1','enable');cmd('d1','copy running-config startup-config');assert 'interface Vlan10' in cmd('d1','show startup-config')
  run('d1',['enable','configure terminal','interface vlan 10','shutdown','end']);ping('d1','192.168.10.1',False)
  cmd('d1','copy startup-config running-config');ping('d1','192.168.10.1',True)
  # Explicit startup save reports quota failure, not a false successful save.
  before_startup=next(d for d in snapshot()['devices'] if d['id']=='d1')['startupConfig']
  page.evaluate('''() => {window.sviOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='aglab-topology-v23')throw new DOMException('test quota','QuotaExceededError');return window.sviOriginalSetItem.call(this,k,v)}}''')
  cmd('d1','copy running-config startup-config',False)
  page.evaluate('Storage.prototype.setItem=window.sviOriginalSetItem;delete window.sviOriginalSetItem')
  assert next(d for d in snapshot()['devices'] if d['id']=='d1')['startupConfig']==before_startup
  # Arbitrary VLAN/IP, not dependent on the example VLAN 10.
  for vlan,network in [(77,'172.16.77'),(4094,'172.16.254')]:
   run('d1',['enable','configure terminal',f'vlan {vlan}','name Arastirma','exit','interface fa0/1',f'switchport access vlan {vlan}','exit',f'interface vlan {vlan}',f'ip address {network}.2 255.255.255.0','no shutdown','end'])
   run('d2',['enable','configure terminal','interface g0/0',f'ip address {network}.1 255.255.255.0','end'])
   output=ping('d1',network+'.1',True);assert f'Kaynak SVI: vlan{vlan} {network}.2' in output

  run('d2',['enable','configure terminal','interface g0/0','ip address 192.168.10.1 255.255.255.0','end'])
  cmd('d1','enable');cmd('d1','copy startup-config running-config');ping('d1','192.168.10.1',True)
  page.locator('#uxMoreLabActions').click()
  with page.expect_download() as download:page.locator('#ptExport').click()
  exported=Path(tmp)/'svi.json';download.value.save_as(str(exported))
  saved=json.loads(exported.read_text());assert next(d for d in saved['devices'] if d['id']=='d1')['startupConfig']['interfaces']['vlan10']['enabled']
  page.reload();page.click('[data-area="lab"]');page.click('#ux14Free');ping('d1','192.168.10.1',True)
  context.close();context,page=open_page();ping('d1','192.168.10.1',True)
  page.locator('#ptImportFile').set_input_files(str(exported));page.wait_for_timeout(100);ping('d1','192.168.20.2',True)
  for kind in ('vlan-mismatch','startup-ports','bad-gateway'):
   invalid=json.loads(exported.read_text());device=next(d for d in invalid['devices'] if d['id']=='d1')
   if kind=='vlan-mismatch':device['interfaces']['vlan10']['vlan']=20
   elif kind=='startup-ports':device['startupConfig']['ports'].pop()
   else:device['gateway']='not-an-ip'
   bad=Path(tmp)/'bad.json';bad.write_text(json.dumps(invalid));before=page.evaluate("localStorage.getItem('aglab-topology-v23')");terminal=page.locator('#ptTerminal').inner_text()
   page.locator('#ptImportFile').set_input_files(str(bad));page.wait_for_function('n=>document.querySelector("#ptTerminal").innerText.length>n',arg=len(terminal))
   assert 'İçe aktarma başarısız:' in page.locator('#ptTerminal').inner_text()[len(terminal):]
   assert page.evaluate("localStorage.getItem('aglab-topology-v23')")==before
  ping('d1','192.168.10.1',True);assert not errors,errors
  context.close();print('PASS D: startup/running separation, JSON, reload, fresh browser and invalid-SVI rejection',flush=True)
finally:server.shutdown();server.server_close()
