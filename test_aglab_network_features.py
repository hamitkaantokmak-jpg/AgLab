"""Common-engine scenarios, protocol withdrawal/AD, security, persistence and accessibility."""
import json
import os
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parent
OUT=Path(os.environ.get('AGLAB_TEST_ARTIFACT_DIR',ROOT/'dist'))
REPORT={'scenarios':[],'accessibility':[],'scope':'Automated Chromium checks; no manual NVDA/VoiceOver speech test.'}


class CommonEngineTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(headless=True)
 @classmethod
 def tearDownClass(cls):
  cls.browser.close();cls.pw.stop();OUT.mkdir(parents=True,exist_ok=True)
  (OUT/'network-scenario-results.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding='utf-8')
  lines=['# Ortak motor ve erişilebilirlik denetimi','',REPORT['scope'],'']
  lines += [f"- {'PASS' if r['ok'] else 'FAIL'} {r['id']}: {r['detail']}" for r in REPORT['scenarios']]
  lines += ['', '## Erişilebilirlik']+[str(r) for r in REPORT['accessibility']]
  (OUT/'network-audit.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':1280,'height':960});self.page=self.context.new_page();self.errors=[]
  self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());self.page.click('[data-area="lab"]')
 def tearDown(self):
  self.context.close();self.assertEqual(self.errors,[])
 def run_js(self,js,arg=None):return self.page.evaluate(js,arg)
 def load(self,id):self.run_js('(id)=>aglabSharedEngine.load(id)',id)
 def command(self,name,commands):self.run_js('([name,commands])=>aglabSharedEngine.commandBlock(name,commands)',[name,commands])
 def solve(self,id):self.run_js('(id)=>{for(const b of aglabSharedEngine.recipes().find(r=>r.id===id).solution)aglabSharedEngine.commandBlock(b.device,b.commands)}',id)
 def probe(self):return self.run_js('aglabSharedEngine.probe()')
 def test_01_all_scenarios_fail_goal_then_solve_and_restore_academy(self):
  self.page.select_option('#academySelect','AGL-005');self.page.click('#academyStart');self.page.click('#academyHint')
  before=self.run_js('academyEngine.snapshot()');hints=self.page.locator('#academyHints').inner_text()
  REPORT['scenarios']=self.run_js('aglabSharedEngine.validateScenarios()')
  self.assertEqual(len(REPORT['scenarios']),17)
  self.assertTrue(all(r['ok'] for r in REPORT['scenarios']),REPORT['scenarios'])
  self.assertEqual(self.run_js('academyEngine.snapshot()'),before)
  self.assertEqual(self.page.locator('#academyHints').inner_text(),hints)
  self.page.click('#runRegressionAudit');expect(self.page.locator('#regressionAuditSummary')).to_contain_text('0 başarısız')
 def test_02_router_on_stick_strict_vlan_path(self):
  self.load('subif-missing');self.assertFalse(self.probe()['ok']);self.solve('subif-missing');self.assertTrue(self.probe()['ok'])
  path=self.run_js("aglabSharedEngine.strictPath('d1','d4',10,'192.168.20.20')")
  self.assertTrue(any(e['a']=='d3' or e['b']=='d3' for e in path),path)
  self.command('SW-01',['enable','configure terminal','interface gi0/1','switchport trunk allowed vlan 10','end'])
  self.assertFalse(self.probe()['ok'])
 def test_03_ospf_reason_routes_mask_and_withdrawal(self):
  self.load('ospf-area');self.assertFalse(self.probe()['ok']);self.command('R1',['show ip ospf neighbor'])
  expect(self.page.locator('#ptTerminal')).to_contain_text('area uyuşmazlığı')
  self.solve('ospf-area');self.assertTrue(self.probe()['ok'])
  routes=self.run_js("aglabSharedEngine.routes('R1')");self.assertTrue(any(r['distance']==110 and r['network']=='192.168.20.0' for r in routes),routes)
  self.command('R1',['show ip route 192.168.20.20']);expect(self.page.locator('#ptTerminal')).to_contain_text('O 192.168.20.0/24')
  self.command('R2',['enable','configure terminal','interface g0/0','ip address 10.0.12.2 255.255.255.0','end'])
  self.assertFalse(self.probe()['ok']);self.assertFalse(self.run_js("aglabSharedEngine.routes('R1')"))
  self.command('R1',['show ip ospf neighbor']);expect(self.page.locator('#ptTerminal')).to_contain_text('maskesi uyuşmazlığı')
 def test_04_bgp_reciprocal_remote_as_and_ad(self):
  self.load('bgp-as');self.command('R1',['show ip bgp summary']);expect(self.page.locator('#ptTerminal')).to_contain_text('remote-as uyuşmazlığı')
  self.assertFalse(self.probe()['ok']);self.solve('bgp-as');self.assertTrue(self.probe()['ok'])
  self.assertTrue(any(r['distance']==20 for r in self.run_js("aglabSharedEngine.routes('R1')")))
  self.command('R1',['enable','configure terminal','ip route 192.168.20.0 255.255.255.0 10.0.12.2 5','end','show ip route 192.168.20.20'])
  self.assertIn('S 192.168.20.0/24',self.page.locator('#ptTerminal > div').last.inner_text())
  self.command('R1',['enable','configure terminal','no ip route 192.168.20.0 255.255.255.0 10.0.12.2 5','end','show ip route 192.168.20.20'])
  self.assertIn('B 192.168.20.0/24',self.page.locator('#ptTerminal > div').last.inner_text())
  self.command('R2',['enable','configure terminal','router bgp 65002','no neighbor 10.0.12.1 remote-as 65001','end'])
  self.assertFalse(self.probe()['ok']);self.assertFalse(self.run_js("aglabSharedEngine.routes('R1')"))
 def test_05_port_security_modes_and_recovery(self):
  for mode in ['shutdown','restrict','protect']:
   with self.subTest(mode=mode):
    self.load('port-security');self.command('SW-01',['enable','configure terminal','interface fa0/1','switchport port-security violation '+mode,'end'])
    self.assertFalse(self.probe()['ok'])
    state=self.run_js("academyEngine.snapshot().devices.find(d=>d.name==='SW-01').interfaces['fa0/1']")
    self.assertEqual(bool(state.get('errdisabled')),mode=='shutdown')
    if mode=='shutdown':
     self.assertTrue(self.run_js("(()=>{try{aglabSharedEngine.commandBlock('SW-01',['enable','configure terminal','interface fa0/1','no shutdown']);return false}catch(e){return true}})()"))
    self.solve('port-security');self.assertTrue(self.probe()['ok'])
  self.load('port-security');self.command('SW-01',['enable','configure terminal','interface fa0/1','switchport port-security maximum 2','end']);self.assertTrue(self.probe()['ok'])
 def test_06_round_trip_and_reject_unknown_nested_fields(self):
  for scenario in ['ospf-area','bgp-as','port-security']:
   self.load(scenario);self.solve(scenario);expected=self.run_js('academyEngine.snapshot()');self.page.reload();self.page.click('[data-area="lab"]')
   self.assertEqual(self.run_js('academyEngine.snapshot()'),expected)
   bad=json.loads(json.dumps(expected));device=next(d for d in bad['devices'] if d.get('ospf') or d.get('bgp') or any(i.get('portSecurity') for i in d['interfaces'].values()))
   if 'ospf' in device:device['ospf']['unknown']=True
   elif 'bgp' in device:device['bgp']['neighbors'][0]['unknown']=True
   else:device['interfaces']['fa0/1']['portSecurity']['unknown']=True
   self.assertTrue(self.run_js('(t)=>{try{academyEngine.load(t);return false}catch(e){return true}}',bad))
   self.assertEqual(self.run_js('academyEngine.snapshot()'),expected)
 def test_07_visible_navigation_keyboard_labels_and_contrast(self):
  self.page.click('#ux14Free');expect(self.page.locator('#sharedScenarioPanel')).to_be_visible()
  self.assertFalse(self.run_js("(()=>{for(let e=document.getElementById('sharedScenarioPanel').parentElement;e;e=e.parentElement)if(e.tagName==='DETAILS'&&!e.open)return true;return false})()"))
  self.page.click('[data-area="troubleshoot"]');self.page.locator('#sharedScenarioTroubleLink').focus();self.page.keyboard.press('Enter');expect(self.page.locator('#sharedScenarioSelect')).to_be_focused()
  self.page.keyboard.press('Tab');expect(self.page.locator('#sharedScenarioLoad')).to_be_focused();self.page.keyboard.press('Enter')
  self.assertEqual(self.page.locator('#sharedScenarioStatus').get_attribute('role'),'status')
  for theme in ['dark','light']:
   if self.page.locator('html').get_attribute('data-theme')!=theme:self.page.locator('#themeToggle').focus();self.page.keyboard.press('Enter')
   if not self.page.locator('#ptDeviceCliDialog').count() or not self.page.locator('#ptDeviceCliDialog').is_visible():
    self.page.locator('#ptCanvas g[data-id]').first.focus();self.page.keyboard.press('Enter');expect(self.page.locator('#ptDeviceCliDialog')).to_be_visible()
   issues=self.run_js("""()=>{const issues=[];for(const e of document.querySelectorAll('#area-lab input,#area-lab select')){if(!e.getClientRects().length||getComputedStyle(e).visibility==='hidden'||e.type==='file')continue;if(!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.title)issues.push('Etiket yok: '+e.id)}return issues}""")
   # WCAG 2.x relative luminance on critical controls, composing translucent ancestors.
   contrast=self.run_js("""()=>{const rgb=s=>(s.match(/[\\d.]+/g)||[]).map(Number),lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return ['sharedScenarioSelect','sharedScenarioLoad','sharedScenarioStatus','ptCliInput','ptQuickCli','themeToggle'].map(id=>{const e=document.getElementById(id),fg=rgb(getComputedStyle(e).color);let bg=[255,255,255],chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);for(const p of chain){const c=rgb(getComputedStyle(p).backgroundColor),a=c[3]??1;bg=bg.map((v,i)=>(c[i]||0)*a+v*(1-a))}const x=lum(fg),y=lum(bg);return {id,ratio:(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}})}""")
   issues += ['Kontrast '+c['id']+': '+str(round(c['ratio'],2)) for c in contrast if c['ratio']<4.5]
   REPORT['accessibility'].append({'theme':theme,'issues':issues,'contrast':contrast,'announcements':'sharedScenarioStatus role=status; dynamic text verified'})
   self.assertEqual(issues,[])
  self.page.keyboard.press('Escape')
  self.page.click('[data-area="troubleshoot"]')
  for legacy,shared in [('ospf','ospf-area'),('bgp','bgp-as'),('portsec','port-security'),('subif','subif-missing')]:
   self.page.click('[data-area="troubleshoot"]');index=self.run_js('(id)=>scenarios.findIndex(s=>s.id===id)',legacy);self.page.locator(f'#scenarioList [data-s="{index}"]').click();expect(self.page.locator('#sharedScenarioSelect')).to_have_value(shared);expect(self.page.locator('#sharedScenarioPanel')).to_be_visible()

if __name__=='__main__':
 suite=unittest.main(exit=False)
 print('NETWORK_REPORT '+json.dumps(REPORT,ensure_ascii=False))
 raise SystemExit(0 if suite.result.wasSuccessful() else 1)
