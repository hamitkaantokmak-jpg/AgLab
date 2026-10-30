"""Shared transit LAN must follow selected next-hop, including recursive and return paths."""
import copy,json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
module=(ROOT/'simulator/routing-path.js').read_text()
assert '// BEGIN ROUTING PATH GENERATED\n'+module+'\n// END ROUTING PATH GENERATED\n' in (ROOT/'AgLab_Final_PKT_Import.html').read_text()

def iface(ip):return dict(ip=ip,mask='255.255.255.0',enabled=True)
def route(network,hop,distance=1,mask='255.255.255.0'):return dict(network=network,mask=mask,nextHop=hop,distance=distance)
def node(id,kind,interfaces,**extra):return dict(id=id,name=id,type=kind,x=100,y=100,w=108,h=72,enabled=True,ports=list(interfaces),interfaces=interfaces,ip='',mask='',gateway='',**extra)
def link(a,pa,b,pb):return dict(a=a,portA=pa,b=b,portB=pb,up=True)
a=node('d1','PC',{'eth0':{'enabled':True}},vlan=77);a.update(ip='192.168.1.2',mask='255.255.255.0',gateway='192.168.1.1')
b=node('d2','PC',{'eth0':{'enabled':True}},vlan=77);b.update(ip='192.168.2.2',mask='255.255.255.0',gateway='192.168.2.1')
r1=node('d3','Router',{'g0/0':iface('192.168.1.1'),'g0/1':iface('10.0.0.1')},staticRoutes=[route('192.168.2.0','10.0.0.3')])
r2=node('d4','Router',{'g0/0':iface('10.0.0.2'),'g0/1':iface('192.168.2.1')},staticRoutes=[route('192.168.1.0','10.0.0.1')])
r3=node('d5','Router',{'g0/0':iface('10.0.0.3')},staticRoutes=[])
sw=node('d6','Switch',{f'fa0/{i}':dict(mode='access',vlan=77,allowed=[77],enabled=True) for i in (1,2,3)},vlans=[1,77])
base=dict(app='AgLab',version=23,devices=[a,b,r1,r2,r3,sw],links=[link('d1','eth0','d3','g0/0'),link('d3','g0/1','d6','fa0/1'),link('d4','g0/0','d6','fa0/2'),link('d5','g0/0','d6','fa0/3'),link('d4','g0/1','d2','eth0')],nextId=7)
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());path=Path(tmp)/'routing.json'
 def load(obj):
  before=page.locator('#ptTerminal > div').count();path.write_text(json.dumps(obj));page.locator('#ptImportFile').set_input_files(str(path))
  page.wait_for_function('n=>document.querySelector("#ptTerminal").children.length>n',arg=before)
  out='\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:]);assert 'Topoloji doğrulandı ve içe aktarıldı' in out,out
 def cmd(device,text):
  before=page.locator('#ptTerminal > div').count()
  page.evaluate("([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",[device,text])
  return '\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:])
 def ping(success,device='d1'):
  out=cmd(device,'ping 192.168.2.2');assert ('100 percent (5/5)' if success else '0 percent (0/5)') in out,out
 load(base);ping(False);ping(False,'d3')
 good=copy.deepcopy(base);good['devices'][2]['staticRoutes']=[route('192.168.2.0','10.0.0.2')];load(good);ping(True)
 # The selected R3 can legitimately hairpin through the same transit switch to R2.
 hairpin=copy.deepcopy(base);hairpin['devices'][4]['staticRoutes']=[route('192.168.2.0','10.0.0.2')];load(hairpin);ping(True)
 trace=cmd('d1','trace 192.168.2.2');assert 'd5' in trace and 'Hedefe ulaşılabilir' in trace,trace
 print('PASS: dead selected next-hop rejected; valid selected path and same-LAN hairpin followed',flush=True)
 # A route existing on every forward router is insufficient if the actual reverse next-hop dead-ends.
 reverse=copy.deepcopy(good);reverse['devices'][3]['staticRoutes']=[route('192.168.1.0','10.0.0.3')];load(reverse);ping(False)
 reverse['devices'][4]['staticRoutes']=[route('192.168.1.0','10.0.0.1')];load(reverse);ping(True)
 assert '0200.0000.0005' in cmd('d6','show mac address-table')
 # An ACL on a reverse-only router must apply to the actual asymmetric reply.
 for c in ['enable','configure terminal','access-list 101 deny icmp any any','interface g0/0','ip access-group 101 in','end']:cmd('d5',c)
 ping(False)
 assert 'ACL 101' in cmd('d1','ping 192.168.2.2')
 for c in ['configure terminal','interface g0/0','no ip access-group 101 in','end']:cmd('d5',c)
 ping(True)
 # Recursive resolution must forward to the final wire neighbor, not the logical recursive IP.
 for hop,expected in [('10.0.0.3',False),('10.0.0.2',True)]:
  recursive=copy.deepcopy(base);recursive['devices'][2]['staticRoutes']=[route('192.168.2.0','203.0.113.9'),route('203.0.113.9',hop,mask='255.255.255.255')];load(recursive);ping(expected)
 print('PASS: actual asymmetric reverse path and recursive wire next-hop',flush=True)
 # No fallback to another neighbor or floating route while the preferred route still resolves.
 preferred=copy.deepcopy(base);preferred['devices'][2]['staticRoutes']=[route('192.168.2.0','10.0.0.3',1),route('192.168.2.0','10.0.0.2',10)];load(preferred);ping(False)
 preferred['devices'][2]['staticRoutes'].pop(0);load(preferred);ping(True)
 lpm=copy.deepcopy(base);lpm['devices'][2]['staticRoutes']=[route('0.0.0.0','10.0.0.2',mask='0.0.0.0'),route('192.168.2.0','10.0.0.3')];load(lpm);ping(False)
 lpm['devices'][2]['staticRoutes'].pop();load(lpm);ping(True)
 loop=copy.deepcopy(base);loop['devices'][4]['staticRoutes']=[route('192.168.2.0','10.0.0.1')];load(loop);ping(False)
 print('PASS: AD, longest-prefix, no silent fallback and routing-loop termination',flush=True)
 # A remote router address still requires a valid source gateway; a local router address does not.
 gateway=copy.deepcopy(good);gateway['devices'][0]['gateway']='';load(gateway)
 assert '0 percent (0/5)' in cmd('d1','ping 10.0.0.2')
 assert '100 percent' in cmd('d1','ping 192.168.1.1')
 gateway['devices'][0]['gateway']='10.0.0.2';load(gateway);assert '0 percent (0/5)' in cmd('d1','ping 10.0.0.2')
 # Logical subinterface numbers are not the dot1Q wire VLAN or physical ingress port.
 tagged=copy.deepcopy(good)
 for index,physical,logical,ip in [(2,'g0/1','g0/1.5000','10.0.0.1'),(3,'g0/0','g0/0.9000','10.0.0.2'),(4,'g0/0','g0/0.12345','10.0.0.3')]:
  tagged['devices'][index]['interfaces'][physical]['ip']=''
  tagged['devices'][index]['interfaces'][logical]=dict(ip=ip,mask='255.255.255.0',enabled=True,parent=physical,encapsulation='dot1q',vlan=77)
 for intf in tagged['devices'][5]['interfaces'].values():intf.update(mode='trunk',nativeVlan=1)
 load(tagged);ping(True)
 tagged['devices'][2]['staticRoutes']=[route('192.168.2.0','10.0.0.3')];load(tagged);ping(False)
 # Changing the route in the real CLI must recover the failed flow.
 for c in ['enable','configure terminal','no ip route 192.168.2.0 255.255.255.0 10.0.0.3','ip route 192.168.2.0 255.255.255.0 10.0.0.2','end']:cmd('d3',c)
 ping(True)
 print('PASS: source gateway, arbitrary dot1Q subinterface IDs and CLI route recovery',flush=True)
 origin=copy.deepcopy(good);origin['devices'][3]['staticRoutes']=[];load(origin)
 ping(True,'d3');ping(False)
 print('PASS: router-origin source address follows the egress interface',flush=True)
 # A management SVI can use R3 as its gateway even when the incoming route arrived through R2.
 svi=copy.deepcopy(good);svi['devices'][5]['interfaces']['vlan77']=dict(ip='10.0.0.6',mask='255.255.255.0',enabled=True,vlan=77);svi['devices'][5]['gateway']='10.0.0.3';svi['devices'][4]['staticRoutes']=[route('192.168.2.0','10.0.0.2')]
 load(svi);svi_output=cmd('d2','ping 10.0.0.6');assert '100 percent' in svi_output,svi_output;ping(True,'d6')
 rows=cmd('d6','show mac address-table');assert any('0200.0000.0005' in line and 'fa0/3' in line for line in rows.splitlines()),rows
 print('PASS: asymmetric management SVI gateway and gateway MAC port',flush=True)
 assert not errors,errors;browser.close()
