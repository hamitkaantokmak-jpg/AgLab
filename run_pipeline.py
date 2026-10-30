#!/usr/bin/env python3
"""Portable AğLab test, quality gate, report and release pipeline."""
import argparse, datetime, json, os, pathlib, shutil, subprocess, sys, tempfile, time, zipfile
ROOT=pathlib.Path(__file__).resolve().parent
TESTS=['test_aglab_pkt_trunk.py','test_aglab_import.py','test_aglab_cli_vlan.py','test_aglab_status.py','test_aglab_subinterfaces.py','test_aglab_v7.py','test_aglab_v11_routing.py','test_aglab_v12_gateway.py','test_aglab_v13_router_ping.py','test_aglab_v15_local_ping.py','test_aglab_v17_ping_validation.py','test_aglab_academy.py','test_aglab_ui.py']
TESTS.append('test_aglab_trunk_defaults.py')
TESTS.append('test_aglab_l2_router_trunk.py')
TESTS.append('test_aglab_mac_learning.py')
TESTS.append('test_aglab_frame_forwarding.py')
TESTS.append('test_aglab_next_hop.py')
TESTS.append('test_aglab_routed_frames.py')
TESTS.append('test_aglab_pkt_dot1q.py')
TESTS.append('test_aglab_persistence.py')
TESTS.extend(['test_aglab_large_topology.py','test_aglab_pkt_matrix.py','test_aglab_endpoint_ports.py','test_aglab_student_journey.py','test_aglab_switch_svi.py','test_aglab_svi_import.py'])
ARTIFACTS=['AgLab_Final_PKT_Import.html','convert_pkt_to_aglab.py','restore_pkt_from_aglab_json.py','static-routing-two-routers.aglab.json','static-routing-two-routers-import-report.json','AgLab_PKT_Import_Kullanim.md','static-routing-two-routers(1).pkt' ]
ARTIFACTS.extend(['pkt-sample-matrix.json','PKT_ORNEK_MATRISI.md','simulator/switch-management.js','simulator/mac-learning.js','simulator/ethernet-forwarding.js','simulator/routing-path.js','simulator/routed-ethernet.js','build_simulator.py','SIMULATOR_PLAN.md'])
def run():
 p=argparse.ArgumentParser();p.add_argument('--out',default='dist');p.add_argument('--skip-browser',action='store_true');p.add_argument('--timeout',type=int,default=100);a=p.parse_args()
 out=(ROOT/a.out).resolve();out.mkdir(parents=True,exist_ok=True)
 browser=None
 if not browser:
  try:
   from playwright.sync_api import sync_playwright
   with sync_playwright() as pw:
    candidate=pathlib.Path(pw.chromium.executable_path)
    if candidate.is_file():browser=str(candidate)
  except Exception:pass
 if not browser:browser=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
 report={'date_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'browser':browser,'tests':[],'passed':False}
 required=ARTIFACTS+TESTS
 missing=[f for f in required if not (ROOT/f).is_file()]
 if missing:
  report['error']='Missing files: '+', '.join(missing)
 else:
  with tempfile.TemporaryDirectory(prefix='aglab-ci-') as tmp:
   stage=pathlib.Path(tmp)
   # The decoded XML is stored inside the imported JSON; reconstruct for portable CI.
   import base64
   source=json.loads((ROOT/'static-routing-two-routers.aglab.json').read_text(encoding='utf-8'))
   (stage/'decoded_source.xml').write_bytes(base64.b64decode(source['sourceArchive']['decodedXmlBase64']))
   for name in required:
    src=ROOT/name;dest=stage/name;dest.parent.mkdir(parents=True,exist_ok=True)
    if name.endswith('.py'):
     content=src.read_text(encoding='utf-8').replace('/mnt/data',str(stage).replace('\\','/'))
     content=content.replace("executable_path='/usr/bin/chromium'",'executable_path='+repr(browser or '/usr/bin/chromium'))
     dest.write_text(content,encoding='utf-8')
    else:shutil.copy2(src,dest)
   shutil.copytree(ROOT/'academy',stage/'academy')
   env=os.environ.copy();env['PYTHONPATH']=str(stage)+os.pathsep+env.get('PYTHONPATH','');env['PYTHONIOENCODING']='utf-8';env['PYTHONUTF8']='1'
   for name in TESTS:
    if a.skip_browser:
     report['tests'].append({'name':name,'status':'SKIPPED'});continue
    if not browser:
     report['tests'].append({'name':name,'status':'FAIL','error':'Chromium bulunamadı. Çalıştırın: python -m playwright install chromium'});continue
    started=time.monotonic()
    try:
     r=subprocess.run([sys.executable,str(stage/name)],cwd=stage,env=env,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
     entry={'name':name,'status':'PASS' if r.returncode==0 else 'FAIL','duration_s':round(time.monotonic()-started,2),'exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]}
    except subprocess.TimeoutExpired:
     entry={'name':name,'status':'FAIL','error':f'timed out after {a.timeout}s'}
    report['tests'].append(entry)
 report['passed']=not missing and all(t['status']=='PASS' for t in report['tests']) and len(report['tests'])==len(TESTS)
 (out/'test-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
 lines=['# AğLab otomatik test raporu','',f"Tarih (UTC): {report['date_utc']}",f"Sonuç: {'BAŞARILI' if report['passed'] else 'BAŞARISIZ / DOĞRULANMADI'}",'']
 for t in report['tests']:lines.append(f"- {t['status']}: {t['name']} ({t.get('duration_s','?')} sn)")
 if report.get('error'):lines.append(report['error'])
 (out/'test-report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 if report['passed']:
  zpath=out/'AgLab_Otomatik_Dogrulanmis_Paket.zip'
  with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   for f in ARTIFACTS+TESTS:z.write(ROOT/f,f)
   z.writestr('decoded_source.xml',base64.b64decode(source['sourceArchive']['decodedXmlBase64']))
   z.write(out/'test-report.md','test-report.md');z.write(out/'test-results.json','test-results.json')
   for f in (ROOT/'academy/student').glob('*.json'):z.write(f,'academy/student/'+f.name)
   z.write(ROOT/'AKADEMI.md','AKADEMI.md')
  with zipfile.ZipFile(zpath) as z:assert z.testzip() is None
  teacher=out/'AgLab_Akademi_Ogretmen.zip'
  with zipfile.ZipFile(teacher,'w',zipfile.ZIP_DEFLATED) as z:
   for folder in ['teacher','source']:
    for f in (ROOT/'academy'/folder).glob('*.json'):z.write(f,'academy/'+folder+'/'+f.name)
   z.write(ROOT/'AKADEMI.md','AKADEMI.md')
  print('PASS: all tests; verified ZIP:',zpath)
 else:
  stale=out/'AgLab_Otomatik_Dogrulanmis_Paket.zip'
  if stale.exists():stale.unlink()
  teacher=out/'AgLab_Akademi_Ogretmen.zip'
  if teacher.exists():teacher.unlink()
  print('FAIL: no verified release generated; see',out/'test-report.md')
 for t in report['tests']:print(t['status'],t['name'])
 return 0 if report['passed'] else 1
if __name__=='__main__':sys.exit(run())

