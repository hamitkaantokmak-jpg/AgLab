"""Automated Chromium student journey; no claim of a human participant study."""
import json,os,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);page=b.new_page(viewport={'width':1400,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());page.click('[data-area="lab"]');page.click('#ux14Free');page.click('#uxMoreLabActions')
 # Start using the real delete/add controls, not an imported ready-made topology.
 initial=page.locator('#ptCanvas g[data-id]').count()
 for _ in range(initial):page.click('#ptDeleteDevice')
 assert page.locator('#ptCanvas g[data-id]').count()==0
 for kind in ['PC','PC','Switch','Switch']:page.click('[data-pt-add="'+kind+'"]')
 devices=page.evaluate('aglabEngines.capture().devices');pcs=[d for d in devices if d['type']=='PC'];switches=[d for d in devices if d['type']=='Switch']
 def cable(a,b):
  page.select_option('#ptSource',a);page.select_option('#ptTarget',b);page.click('#ptMakeLink')
 cable(pcs[0]['id'],switches[0]['id']);cable(pcs[1]['id'],switches[1]['id']);cable(switches[0]['id'],switches[1]['id'])
 def cli(id,commands):
  page.locator('#ptCanvas g[data-id="'+id+'"]').click();out=[]
  for text in commands:
   before=page.locator('#ptTerminal > div').count();page.fill('#ptCliInput',text);page.press('#ptCliInput','Enter');out.extend(page.locator('#ptTerminal > div').all_text_contents()[before:])
  page.press('#ptCliInput','Escape');return '\n'.join(out)
 for i,pc in enumerate(pcs,1):cli(pc['id'],[f'ip address 10.0.0.{i} 255.255.255.0'])
 for sw in switches:cli(sw['id'],['enable','configure terminal','vlan 10','exit','interface fa0/1','switchport mode access','switchport access vlan 10','exit','interface fa0/2','switchport mode trunk','switchport trunk allowed vlan 10,20','end'])
 assert '100 percent' in cli(pcs[0]['id'],['ping 10.0.0.2'])
 assert page.evaluate('([s,t])=>aglabEngines.run("aglab-js",s,t)',[pcs[0]['id'],pcs[1]['id']])['ok']
 refused=page.evaluate('aglabEngines.check("borck")');assert not refused['ok'] and any('trunk' in r for r in refused['reasons'])
 for engine in ['frr','linux-bridge']:
  r=page.evaluate('(e)=>aglabEngines.check(e)',engine);assert not r['ok'] and any('Separate lab' in s for s in r['reasons'])
 assert 'trunk' in cli(switches[0]['id'],['enable','show interfaces trunk'])
 assert '10' in cli(switches[0]['id'],['show vlan brief'])
 assert 'DYNAMIC' in cli(switches[0]['id'],['show mac address-table'])
 assert 'Root' in cli(switches[0]['id'],['show spanning-tree'])
 cli(switches[0]['id'],['configure terminal','interface fa0/2','switchport trunk allowed vlan 20','end'])
 failed=cli(pcs[0]['id'],['ping 10.0.0.2']);assert '0 percent' in failed and ('VLAN' in failed or 'vlan' in failed),failed
 page.click('#packetDetectiveRefresh')
 # Early preflight diagnostics are explicitly derived, not invented wire events.
 assert 'VLAN' in page.locator('#packetDetectiveDiagnosis').inner_text()
 assert 'paket yakalaması değildir' in page.locator('#packetDetectiveDiagnosis').inner_text()
 cli(switches[0]['id'],['enable','configure terminal','interface fa0/2','switchport trunk allowed vlan 10,20','end'])
 assert '100 percent' in cli(pcs[0]['id'],['ping 10.0.0.2'])
 page.click('#packetDetectiveRefresh');assert 'Adım 1' in page.locator('#packetDetectiveStatus').inner_text()
 page.click('#ptSave')
 with page.expect_download() as download:page.click('#ptExport')
 exported=Path(tmp)/'student.json';download.value.save_as(str(exported));saved=json.loads(exported.read_text(encoding='utf-8'));assert len(saved['devices'])==4 and len(saved['links'])==3
 page.reload();page.click('[data-area="lab"]');page.click('#ux14Free');page.locator('#ptImportFile').set_input_files(str(exported));page.wait_for_timeout(80)
 assert page.evaluate('([s,t])=>aglabEngines.run("aglab-js",s,t)',[pcs[0]['id'],pcs[1]['id']])['ok']
 assert page.evaluate('aglabEngines.capture().links.length')==3
 baseline=page.evaluate('JSON.stringify(aglabEngines.capture())')
 page.locator('#engineCapabilities').evaluate('(d)=>d.open=true')
 with page.expect_download() as download:page.click('#engineExportTopology')
 operator_file=Path(tmp)/'operator.json';download.value.save_as(str(operator_file));operator=json.loads(operator_file.read_text(encoding='utf-8'))
 assert operator['app']=='AgLab' and operator['version']==23 and operator['selected']==''
 assert all('mac' not in d for d in operator['devices'] if d['type']=='Switch')
 page.locator('#ptImportFile').set_input_files(str(operator_file));page.wait_for_timeout(80)
 assert baseline==page.evaluate('JSON.stringify(aglabEngines.capture())')
 report={'kind':'routing','engine':'FRRouting','ok':True,'cleanup':True,'steps':[{'name':'OSPF report fixture <img src=bad onerror=alert(1)>','ok':True,'evidence':{'route':{'protocol':'ospf'}}}],'evidence':{}}
 report_file=Path(tmp)/'report.json';report_file.write_text(json.dumps(report),encoding='utf-8');page.locator('#nativeLabReport').set_input_files(str(report_file))
 page.wait_for_function("document.querySelector('#nativeLabReportStatus').textContent.includes('imzası doğrulanmadı')")
 assert 'ayrı Lab' in page.locator('#packetDetectiveStatus').inner_text()
 assert 'paket olayı değil' in page.locator('#packetDetectiveExplanation').inner_text()
 assert page.locator('#packetDetectivePanel img[src="bad"]').count()==0
 page.locator('#nativeLabChecks').evaluate('(d)=>d.parentElement.open=true')
 assert 'Beklenti karşılandı' in page.locator('#nativeLabChecks').inner_text()
 assert baseline==page.evaluate('JSON.stringify(aglabEngines.capture())')
 report['execute']='shell';report_file.write_text(json.dumps(report),encoding='utf-8');page.locator('#nativeLabReport').set_input_files(str(report_file));page.wait_for_function("document.querySelector('#nativeLabReportStatus').textContent.startsWith('Rapor açılmadı')")
 assert not errors,errors
 out=Path(os.environ.get('AGLAB_TEST_ARTIFACT_DIR',ROOT/'dist'));out.mkdir(exist_ok=True,parents=True)
 (out/'advanced-student-journey.json').write_text(json.dumps({'browser':'Chromium','human_participants':False,'created_with_ui':True,'cabling':True,'vlan_trunk':True,'cli_fault_and_repair':True,'packet_trace_only_when_produced':True,'save_export_import':True,'single_engine_gate':True,'borck_trunk_rejected':True,'frr_separate':True,'page_errors':errors},indent=2),encoding='utf-8')
 page.screenshot(path=str(out/'advanced-student-journey.png'));b.close()
print('PASS UI device creation/cabling, CLI trunk fault/repair, explicit engine gate, export/import')
