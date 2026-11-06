#!/usr/bin/env python3
"""Portable AğLab test, quality gate, report and release pipeline."""
import argparse, datetime, json, os, pathlib, shutil, subprocess, sys, tempfile, time, zipfile
from verify_packages import verify_release_packages, build_release_manifest
ROOT=pathlib.Path(__file__).resolve().parent
ACADEMY_DOCS=['AKADEMI.md','academy/ADAPTATION.md','academy/adaptation-audit.json']
TESTS=['test_aglab_pkt_trunk.py','test_aglab_import.py','test_aglab_cli_vlan.py','test_aglab_status.py','test_aglab_subinterfaces.py','test_aglab_v7.py','test_aglab_v11_routing.py','test_aglab_v12_gateway.py','test_aglab_v13_router_ping.py','test_aglab_v15_local_ping.py','test_aglab_v17_ping_validation.py','test_aglab_academy.py','test_aglab_ui.py']
TESTS.append('test_aglab_trunk_defaults.py')
TESTS.append('test_aglab_device_cli.py')
TESTS.append('test_aglab_borck_engine.py')
TESTS.extend(['test_aglab_advanced_engines.py','test_aglab_browser_benchmark.py','real-lab/test_advanced_smoke.py'])
TESTS.append('test_build_simulator.py')
TESTS.append('real-lab/test_security_smoke.py')
TESTS.extend(['real-lab/test_routed_topology.py','real-lab/test_routed_smoke.py','real-lab/test_shared_topology.py','real-lab/test_extended_routing.py','test_lab_engine_map.py'])
TESTS.append('test_aglab_network_features.py')
TESTS.append('test_aglab_l2_router_trunk.py')
TESTS.append('test_aglab_mac_learning.py')
TESTS.append('test_aglab_frame_forwarding.py')
TESTS.append('test_aglab_next_hop.py')
TESTS.append('test_aglab_routed_frames.py')
TESTS.append('test_aglab_icmp_ttl.py')
TESTS.append('test_aglab_traceroute.py')
TESTS.append('test_aglab_icmp_unreachable.py')
TESTS.append('test_aglab_pkt_dot1q.py')
TESTS.append('test_aglab_pkt_config_context.py')
TESTS.append('test_aglab_pkt_port_security.py')
TESTS.append('test_aglab_pkt_dhcp_relay.py')
TESTS.append('test_aglab_persistence.py')
TESTS.extend(['test_aglab_large_topology.py','test_aglab_pkt_matrix.py','test_aglab_endpoint_ports.py','test_aglab_student_journey.py','test_aglab_switch_svi.py','test_aglab_svi_import.py'])
NODE_TESTS=['simulator/test_engine_manager.cjs','simulator/test_lab_evidence.cjs','simulator/test_borck_engine.cjs','simulator/benchmark_borck_engine.cjs','simulator/test_packet_events.cjs','simulator/test_port_security.cjs' ,'simulator/test_engine_adapter_prototype.cjs' ,'simulator/test_engine_adapter_parity.cjs']
STUDENT_FILES=['real-lab/student_api.py','real-lab/export_student_snapshot.py','real-lab/test_student_api.py','real-lab/student_isolation_smoke.py','real-lab/student_live_smoke.py','real-lab/test_student_live_smoke.py']
STUDENT_FILES.append('real-lab/test_export_permissions.py')
STUDENT_FILES.append('real-lab/test_snapshot_watch.py')
STUDENT_FILES.extend(['real-lab/student.html','real-lab/student.js','real-lab/student.css','real-lab/test_student_ui.py'])
REAL_LAB_FILES=['real-lab/topology.clab.yml','real-lab/r1/frr.conf','real-lab/r2/frr.conf','real-lab/README.md','real-lab/check_topology.py','real-lab/manage.py','real-lab/test_manage.py','real-lab/live_smoke.py','real-lab/test_live_smoke.py','real-lab/api.py','real-lab/test_api.py','real-lab/dashboard.html','real-lab/test_api_http.py','real-lab/diagnostics.py','real-lab/test_diagnostics.py']
REAL_LAB_FILES.extend(STUDENT_FILES)
REAL_LAB_FILES.append('real-lab/advanced_smoke.py')
REAL_LAB_FILES.extend(['real-lab/security_smoke.py','real-lab/socket_peer.py','real-lab/examples/security-topology.json'])
REAL_LAB_FILES.extend(['real-lab/routed_topology.py','real-lab/routed_smoke.py','real-lab/examples/routed-2-routers.aglab.json','real-lab/examples/routed-3-routers.aglab.json','real-lab/shared_topology.py','real-lab/shared_smoke.py','real-lab/extended_routing.py','real-lab/examples/shared-vlan10.aglab.json'])
ARTIFACTS=['AgLab_Final_PKT_Import.html','convert_pkt_to_aglab.py','restore_pkt_from_aglab_json.py','verify_packages.py','static-routing-two-routers.aglab.json','static-routing-two-routers-import-report.json','AgLab_PKT_Import_Kullanim.md','static-routing-two-routers(1).pkt' ]
ARTIFACTS.extend(['simulator/mac-address.js','simulator/test_mac_address.cjs','pkt-sample-matrix.json','PKT_ORNEK_MATRISI.md','simulator/switch-management.js','simulator/mac-learning.js','simulator/ethernet-forwarding.js','simulator/routing-path.js','simulator/routed-ethernet.js','simulator/icmp.js','simulator/traceroute.js','build_simulator.py','SIMULATOR_PLAN.md'])
ARTIFACTS.extend(['simulator/packet-events.js','simulator/packet-detective-ui.js'])
ARTIFACTS.append('simulator/device-cli.js')
ARTIFACTS.append('simulator/engine-adapter-prototype.cjs')
ARTIFACTS.extend(['simulator/network-protocols.js','simulator/port-security.js','simulator/network-scenarios.js','simulator/network-scenarios.json'])
ARTIFACTS.append('docs/ORTAK_MOTOR.md')
ARTIFACTS.extend(['docs/LAB_MOTOR_HARITASI.md','docs/ORTAK_GERCEK_LAB.md','tools/build_lab_engine_map.py'])
ARTIFACTS.extend(['simulator/engine-manager.js','simulator/engine-manager-ui.js','simulator/lab-evidence.js','simulator/lab-evidence-ui.js','docs/GELISMIS_MOTOR_ENTEGRASYON.md','docs/UYUMLULUK_MATRISI.md'])
ARTIFACTS.extend(['simulator/borck-adapter.ts','simulator/borck-engine.generated.js','simulator/borck-ui.js','simulator/borck-fixtures.cjs','simulator/borck-production-reference.cjs','tools/build_borck_engine.cjs','package.json','package-lock.json','docs/HAZIR_MOTOR_ENTEGRASYON.md'])
ARTIFACTS.extend(p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'third_party/borck-netsim').rglob('*')) if p.is_file())
def run():
 p=argparse.ArgumentParser();p.add_argument('--out',default='dist');p.add_argument('--skip-browser',action='store_true');p.add_argument('--timeout',type=int,default=100);a=p.parse_args()
 out=(ROOT/a.out).resolve();out.mkdir(parents=True,exist_ok=True)
 # Offline HTML is a generated artifact. Refresh it from reviewed modules before staging.
 for build in ['build_simulator.py','build_academy.py']:
  subprocess.run([sys.executable,str(ROOT/build)],cwd=ROOT,check=True)
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
 required=ARTIFACTS+TESTS+NODE_TESTS+REAL_LAB_FILES
 missing=[f for f in required+ACADEMY_DOCS if not (ROOT/f).is_file()]
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
   env=os.environ.copy();env['PYTHONPATH']=str(stage)+os.pathsep+env.get('PYTHONPATH','');env['PYTHONIOENCODING']='utf-8';env['PYTHONUTF8']='1';env['AGLAB_TEST_ARTIFACT_DIR']=str(out)
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
 if not missing:
  node=shutil.which('node')
  for name in NODE_TESTS:
   if not node:
    report['tests'].append({'name':name,'status':'FAIL','error':'Node.js bulunamadı; paket olayları doğrulanamadı.'})
    continue
   try:
    r=subprocess.run([node,'--expose-gc',str(ROOT/name)],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
    report['tests'].append({'name':name,'status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
   except subprocess.TimeoutExpired:
    report['tests'].append({'name':name,'status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/check_topology.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/check_topology.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/check_topology.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_manage.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_manage.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_manage.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_live_smoke.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_live_smoke.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_live_smoke.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_api.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_api.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_api.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_api_http.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_api_http.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_api_http.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_diagnostics.py')],cwd=ROOT/'real-lab',capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_diagnostics.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_diagnostics.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_student_api.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_student_api.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_student_api.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_student_live_smoke.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_student_live_smoke.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_student_live_smoke.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_export_permissions.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_export_permissions.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_export_permissions.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  if a.skip_browser:
   report['tests'].append({'name':'real-lab/test_student_ui.py','status':'SKIPPED'})
  else:
   try:
    r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_student_ui.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
    report['tests'].append({'name':'real-lab/test_student_ui.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
   except subprocess.TimeoutExpired:
    report['tests'].append({'name':'real-lab/test_student_ui.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 if not missing:
  try:
   r=subprocess.run([sys.executable,str(ROOT/'real-lab/test_snapshot_watch.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=a.timeout)
   report['tests'].append({'name':'real-lab/test_snapshot_watch.py','status':'PASS' if r.returncode==0 else 'FAIL','exit_code':r.returncode,'stdout':r.stdout[-8000:],'stderr':r.stderr[-8000:]})
  except subprocess.TimeoutExpired:
   report['tests'].append({'name':'real-lab/test_snapshot_watch.py','status':'FAIL','error':f'timed out after {a.timeout}s'})
 report['passed']=not missing and all(t['status']=='PASS' for t in report['tests']) and len(report['tests'])==len(TESTS)+len(NODE_TESTS)+11
 (out/'test-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
 lines=['# AğLab otomatik test raporu','',f"Tarih (UTC): {report['date_utc']}",f"Sonuç: {'BAŞARILI' if report['passed'] else 'BAŞARISIZ / DOĞRULANMADI'}",'']
 for t in report['tests']:lines.append(f"- {t['status']}: {t['name']} ({t.get('duration_s','?')} sn)")
 if report.get('error'):lines.append(report['error'])
 (out/'test-report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 if report['passed']:
  (out/'html-build-manifest.json').write_text(json.dumps(build_release_manifest(ROOT),indent=2),encoding='utf-8')
  zpath=out/'AgLab_Otomatik_Dogrulanmis_Paket.zip'
  with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   for f in ARTIFACTS+TESTS+NODE_TESTS+REAL_LAB_FILES:z.write(ROOT/f,f)
   z.writestr('decoded_source.xml',base64.b64decode(source['sourceArchive']['decodedXmlBase64']))
   z.write(out/'test-report.md','test-report.md');z.write(out/'test-results.json','test-results.json')
   z.write(out/'html-build-manifest.json','html-build-manifest.json')
   for name in ['browser-engine-benchmark.json','advanced-student-journey.json']:z.write(out/name,name)
   for f in (ROOT/'academy/student').glob('*.json'):z.write(f,'academy/student/'+f.name)
   for name in ACADEMY_DOCS:z.write(ROOT/name,name)
  teacher=out/'AgLab_Akademi_Ogretmen.zip'
  with zipfile.ZipFile(teacher,'w',zipfile.ZIP_DEFLATED) as z:
   z.write(out/'html-build-manifest.json','html-build-manifest.json')
   for folder in ['teacher','source']:
    for f in (ROOT/'academy'/folder).glob('*.json'):z.write(f,'academy/'+folder+'/'+f.name)
   for name in ACADEMY_DOCS:z.write(ROOT/name,name)
  try:
   package_result=verify_release_packages(zpath,teacher)
  except Exception as error:
   zpath.unlink(missing_ok=True);teacher.unlink(missing_ok=True)
   report['passed']=False;report['package_error']=str(error)
   (out/'test-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
   lines[3]='Sonuç: BAŞARISIZ / DOĞRULANMADI'
   (out/'test-report.md').write_text('\n'.join(lines)+'\n\nFAIL package verification: '+str(error)+'\n',encoding='utf-8')
   print('FAIL package verification; no verified release retained:',error)
   return 1
  print('PASS package verification:',json.dumps(package_result,ensure_ascii=False))
  print('PASS: all tests; verified ZIP:',zpath)
 else:
  stale=out/'AgLab_Otomatik_Dogrulanmis_Paket.zip'
  if stale.exists():stale.unlink()
  teacher=out/'AgLab_Akademi_Ogretmen.zip'
  if teacher.exists():teacher.unlink()
  print('FAIL: no verified release generated; see',out/'test-report.md')
 for t in report['tests']:
  print(t['status'],t['name'])
  if t['status']=='FAIL':print(t.get('error',''),t.get('stdout',''),t.get('stderr',''))
 return 0 if report['passed'] else 1
if __name__=='__main__':sys.exit(run())

