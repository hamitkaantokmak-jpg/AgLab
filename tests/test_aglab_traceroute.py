"""ICMP traceroute must display returned replies, never the topology's hidden path."""
import copy,json,re,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium
module=(ROOT/'simulator/traceroute.js').read_text()
assert '// BEGIN TRACEROUTE GENERATED\n'+module+'\n// END TRACEROUTE GENERATED\n' in (ROOT/'AgLab_Final_PKT_Import.html').read_text()
base=json.loads((ROOT/'static-routing-two-routers.aglab.json').read_text())
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 browser=launch_chromium(pw);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());path=Path(tmp)/'trace.json'
 def load(obj=base):
  before=page.locator('#ptTerminal > div').count();path.write_text(json.dumps(obj));page.locator('#ptImportFile').set_input_files(str(path));page.wait_for_function('n=>document.querySelector("#ptTerminal").children.length>n',arg=before)
  assert 'Topoloji doğrulandı' in '\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:])
 def cmd(device,text):
  before=page.locator('#ptTerminal > div').count()
  page.evaluate("([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",[device,text])
  return '\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:])
 def rows(output):return [line for line in output.splitlines() if re.match(r'^\d+\s',line)]
 load();out=cmd('d3','traceroute 192.168.2.2 max-hops 5');hops=rows(out)
 assert len(hops)==3 and '192.168.1.1' in hops[0] and '10.0.0.2' in hops[1] and '192.168.2.2' in hops[2],out
 assert 'Echo Reply' in hops[2] and 'Hedefe ulaşılabilir' in out,out
 events=cmd('d3','show ethernet events');assert 'trace-probe ttl 1' in events and 'trace-probe ttl 3' in events and 'icmp-delivered d3' in events,events
 assert len(rows(cmd('d3','trace 192.168.1.3')))==1
 assert len(rows(cmd('d1','tracert 10.0.0.2')))==1
 print('PASS: returned ICMP router hops, Echo Reply completion, aliases and local delivery',flush=True)
 # Drop only R2's Time Exceeded source, not the final Echo Reply from the host.
 silent=copy.deepcopy(base);r2=silent['devices'][1];r2['acls']=[dict(id='101',action='deny',protocol='icmp',srcType='host',src='10.0.0.2',dstType='any'),dict(id='101',action='permit',protocol='ip',srcType='any',dstType='any')];r2['interfaces']['g0/0']['aclOut']='101';load(silent)
 out=cmd('d3','trace 192.168.2.2 max-hops 4');hops=rows(out)
 assert len(hops)==3 and hops[1].strip()=='2  *' and '10.0.0.2' not in out and 'Echo Reply' in hops[2],out
 print('PASS: silent router stays hidden while a later reply still completes the trace',flush=True)
 load();out=cmd('d3','trace 192.168.2.2 max-hops 1');assert len(rows(out))==1 and 'doğrulanamadı' in out and 'Echo Reply' not in out,out
 # Unknown host on an existing destination LAN still exposes the reachable routers.
 out=cmd('d3','trace 192.168.2.99 max-hops 4');hops=rows(out);assert len(hops)==3 and '192.168.1.1' in hops[0] and '10.0.0.2' in hops[1] and '!H' in hops[2] and 'Hedefe ulaşılabilir' not in out,out
 # A forwarding loop must consume real TTL, not vanish at topology prevalidation.
 loop=copy.deepcopy(base);loop['devices'][0]['staticRoutes'].append(dict(network='198.51.100.0',mask='255.255.255.0',nextHop='10.0.0.2',distance=1));loop['devices'][1]['staticRoutes'].append(dict(network='198.51.100.0',mask='255.255.255.0',nextHop='10.0.0.1',distance=1));load(loop)
 out=cmd('d3','trace 198.51.100.2 max-hops 5');hops=rows(out);assert len(hops)==5 and '192.168.1.1' in hops[0] and '10.0.0.2' in hops[1] and '192.168.1.1' in hops[2] and 'Echo Reply' not in out,out
 print('PASS: hop bound, unknown-host partial discovery and routing-loop TTL expiry',flush=True)
 before=page.locator('#ptTerminal > div').count()
 elapsed=page.evaluate("()=>{const t=performance.now();document.querySelector('#ptCliDevice').value='d3';document.querySelector('#ptCliInput').value='trace 198.51.100.2 max-hops 64';document.querySelector('#ptCliForm').requestSubmit();return performance.now()-t}")
 out='\n'.join(page.locator('#ptTerminal > div').all_text_contents()[before:]);hops=rows(out);assert len(hops)==64 and '10.0.0.2' in hops[-1],out
 assert elapsed<5000,elapsed
 events=cmd('d3','show ethernet events');assert 'Ek olay sayısı:' in events and len(events.splitlines())<=260,events
 print('PASS: 64-hop loop bounded, event log capped; browser elapsed_ms',round(elapsed,1),flush=True)
 svi=copy.deepcopy(base);svi['devices'][6]['interfaces']['vlan1']=dict(ip='192.168.1.10',mask='255.255.255.0',enabled=True,vlan=1);svi['devices'][6]['gateway']='192.168.1.1';load(svi)
 assert 'Hedefe ulaşılabilir' in cmd('d7','traceroute 192.168.2.2 max-hops 4')
 for invalid in ['trace','trace invalid','trace 192.168.2.2 extra','trace 192.168.2.2 max-hops 0','trace 192.168.2.2 max-hops 65','trace 192.168.2.2 max-hops 1.5']:
  out=cmd('d3',invalid);assert 'outerr' in (page.locator('#ptTerminal > div').last.get_attribute('class') or ''),out
 print('PASS: SVI origin and strict trace command validation',flush=True)
 load();assert len(rows(cmd('d3','trace 192.168.2.1 max-hops 4')))==2
 # A later missing route must not prevent earlier returned Time Exceeded replies.
 missing=copy.deepcopy(base);missing['devices'][0]['staticRoutes'].append(dict(network='198.51.100.0',mask='255.255.255.0',nextHop='10.0.0.2',distance=1));load(missing)
 out=cmd('d3','trace 198.51.100.2 max-hops 3');hops=rows(out);assert len(hops)==3 and '192.168.1.1' in hops[0] and '10.0.0.2' in hops[1] and '!N' in hops[2],out
 nat=copy.deepcopy(base);r1=nat['devices'][0];r1['interfaces']['g0/0']['natRole']='inside';r1['interfaces']['g0/1']['natRole']='outside';r1['natOverload']=dict(aclId='1',outsideInterface='g0/1');r1['acls']=[dict(id='1',action='permit',protocol='ip',srcType='network',src='192.168.1.0',wildcard='0.0.0.255',dstType='any')];load(nat)
 out=cmd('d3','trace 192.168.2.2 max-hops 4');assert 'henüz desteklenmiyor' in out and 'Hedefe ulaşılabilir' not in out,out
 assert 'tablosu boş' in cmd('d1','show ip nat translations')
 print('PASS: local destination router TTL, later missing route and explicit unsupported NAT boundary',flush=True)
 assert not errors,errors;browser.close()
