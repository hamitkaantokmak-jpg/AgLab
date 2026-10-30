"""TTL decreases only at IP forwarding routers; ICMP expiry is really returned."""
import copy,json,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
module=(ROOT/'simulator/icmp.js').read_text()
assert '// BEGIN ICMP GENERATED\n'+module+'\n// END ICMP GENERATED\n' in (ROOT/'AgLab_Final_PKT_Import.html').read_text()
base=json.loads((ROOT/'static-routing-two-routers.aglab.json').read_text())
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());path=Path(tmp)/'ttl.json'
 def load(obj=base):
  before=page.locator('#ptTerminal > div').count();path.write_text(json.dumps(obj));page.locator('#ptImportFile').set_input_files(str(path));page.wait_for_function('n=>document.querySelector("#ptTerminal").children.length>n',arg=before)
  assert 'Topoloji doğrulandı' in '\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:])
 def cmd(device,text):
  before=page.locator('#ptTerminal > div').count()
  page.evaluate("([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",[device,text])
  return '\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:])
 def ping(ttl,success,device='d3',target='192.168.2.2'):
  out=cmd(device,'ping '+target+' ttl '+str(ttl));assert ('100 percent (5/5)' if success else '0 percent (0/5)') in out,out
  return out
 load();out=ping(1,False);assert 'Time Exceeded' in out and '192.168.1.1' in out,out
 events=cmd('d3','show ethernet events');assert 'ttl-expired d1' in events and 'icmp-time-exceeded' in events and 'icmp-delivered d3' in events,events
 assert 'forward d2' not in events and 'receive d5 icmp-request' not in events,events
 out=ping(2,False);assert 'Time Exceeded' in out and '10.0.0.2' in out,out
 events=cmd('d3','show ethernet events');assert 'ttl-expired d2' in events and 'receive d5 icmp-request' not in events,events
 ping(3,True);events=cmd('d3','show ethernet events');assert 'ttl-forward d1 3 -> 2' in events and 'ttl-forward d2 2 -> 1' in events and 'ttl-forward d2 64 -> 63' in events,events
 ping(255,True);assert '100 percent' in cmd('d3','ping 192.168.2.2')
 print('PASS: TTL 1/2 expiry, real Time Exceeded reply and TTL 3/default/255 delivery',flush=True)
 ping(1,True,target='192.168.1.3');ping(1,True,target='192.168.1.1')
 ping(1,True,device='d1',target='10.0.0.2');ping(1,False,device='d1');ping(2,True,device='d1')
 print('PASS: bridges and local destination routers do not consume TTL; router origin starts unchanged',flush=True)
 # An ACL beyond the expiry router must not preempt the earlier TTL failure.
 later=copy.deepcopy(base);r2=later['devices'][1];r2['acls']=[dict(id='101',action='deny',protocol='icmp',srcType='any',dstType='any')];r2['interfaces']['g0/1']['aclOut']='101';load(later)
 assert 'Time Exceeded' in ping(1,False)
 assert 'ACL 101' in ping(3,False)
 # Suppress only the Time Exceeded return; no successful ICMP arrival may be reported.
 blocked=copy.deepcopy(base);r1=blocked['devices'][0];r1['acls']=[dict(id='102',action='deny',protocol='icmp',srcType='any',dstType='any')];r1['interfaces']['g0/0']['aclOut']='102';load(blocked)
 out=ping(1,False);assert 'ulaşmadı' in out and 'Time Exceeded' in out,out
 events=cmd('d3','show ethernet events');assert 'icmp-delivered d3' not in events and 'ACL 102' in events,events
 print('PASS: later-hop ACL does not mask expiry; actual ICMP return ACL is enforced',flush=True)
 load()
 for bad in ['0','256','1.5','-1','NaN','1 extra']:
  out=cmd('d3','ping 192.168.2.2 ttl '+bad);assert 'outerr' in (page.locator('#ptTerminal > div').last.get_attribute('class') or ''),(bad,out)
  assert '100 percent' not in out,out
 print('PASS: invalid TTL rejected',flush=True)
 no_return=copy.deepcopy(base);no_return['devices'][1]['staticRoutes']=[];load(no_return)
 out=ping(2,False);assert 'Time Exceeded' in out and 'ulaşmadı' in out,out
 no_gateway=copy.deepcopy(base);no_gateway['devices'][4]['gateway']='';load(no_gateway)
 assert 'Time Exceeded' in ping(1,False)
 assert 'dönüş trafiği için varsayılan gateway' in ping(3,False)
 svi=copy.deepcopy(base);svi['devices'][6]['interfaces']['vlan1']=dict(ip='192.168.1.10',mask='255.255.255.0',enabled=True,vlan=1);svi['devices'][6]['gateway']='192.168.1.1';load(svi)
 assert 'Time Exceeded' in ping(1,False,device='d7');ping(3,True,device='d7')
 print('PASS: missing ICMP return route, later missing gateway and SVI TTL',flush=True)
 nat=copy.deepcopy(base);r1=nat['devices'][0];r1['interfaces']['g0/0']['natRole']='inside';r1['interfaces']['g0/1']['natRole']='outside';r1['natOverload']=dict(aclId='1',outsideInterface='g0/1');r1['acls']=[dict(id='1',action='permit',protocol='ip',srcType='network',src='192.168.1.0',wildcard='0.0.0.255',dstType='any')];load(nat)
 out=cmd('d3','ping 192.168.2.2 ttl 1');assert 'henüz desteklenmiyor' in out and '100 percent' not in out,out
 assert 'tablosu boş' in cmd('d1','show ip nat translations')
 assert '100 percent' in cmd('d3','ping 192.168.2.2')
 load();before=page.locator('#ptTerminal > div').count()
 page.evaluate("document.querySelector('#ptSource').value='d1';document.querySelector('#ptTarget').value='d2';document.querySelector('#ptPacketStep').click()")
 step='\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:]);assert 'TTL 64' in step and '10.0.0.1' in step,step
 print('PASS: unsupported PAT TTL has no translation side effect; Packet Step router origin keeps TTL 64',flush=True)
 assert not errors,errors;browser.close()
