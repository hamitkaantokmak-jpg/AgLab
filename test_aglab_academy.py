"""Academy integration tests against the actual simulator in Chromium."""
import json, pathlib, hashlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent
html=(ROOT/'AgLab_Final_PKT_Import.html').read_text(encoding='utf-8')
assert 'teacher_solution' not in html and 'target_topology' not in html
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True)
 page=b.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri())
 assert page.locator('#academySelect').count()==1, 'Academy selector missing'
 assert page.locator('#academySelect option').count()==10
 page.click('[data-area="lab"]')
 hashes=json.loads((ROOT/'academy/source/SHA256.json').read_text())
 for name,digest in hashes.items():
  assert hashlib.sha256((ROOT/'academy/source'/name).read_bytes()).hexdigest()==digest
 for i in range(1,11):
  lid=f'AGL-{i:03d}'; raw=(ROOT/f'academy/source/{lid}.json').read_bytes()
  assert hashlib.sha256(raw).hexdigest()==hashes[lid+'.json']
  lab=json.loads(raw)
  student=json.loads((ROOT/f'academy/student/{lid}.json').read_text(encoding='utf-8'))
  assert 'teacher_solution' not in student and 'target_topology' not in student
  assert student['initial_topology']==lab['initial_topology']
  assert student['assessment']==lab['assessment']
  page.select_option('#academySelect',lid);page.click('#academyStart')
  assert page.evaluate('academyEngine.snapshot()')==lab['initial_topology']
  result=page.evaluate('academy.check()')
  assert result['earned_points']<100 and result['status']=='complete',result
  page.click('#academyHint');assert page.locator('#academyHints').inner_text()
  # Use real simulator import and grader, never replace ping with a test double.
  page.evaluate('t=>academyEngine.load(t)',lab['target_topology'])
  for key,value in lab['teacher_solution']['answer_key'].items():
   page.select_option(f'#academyAnswer-{key}',json.dumps(value) if isinstance(value,bool) else value)
  result=page.evaluate('academy.check()')
  assert result['earned_points']==100 and result['coverage']==1,result
  assert all(c['status']=='passed' for c in result['criteria']),result
  # Equivalent link ordering/direction must retain full credit.
  t=json.loads(json.dumps(lab['target_topology']))
  t['links']=[dict(a=l['b'],b=l['a'],portA=l['portB'],portB=l['portA'],up=l['up']) for l in reversed(t['links'])]
  page.evaluate('t=>academyEngine.load(t)',t)
  assert page.evaluate('academy.check().earned_points')==100
  # A down destination must fail packet delivery, regardless of matching IP.
  t['devices'][1]['enabled']=False;page.evaluate('t=>academyEngine.load(t)',t)
  r=page.evaluate('academy.check()')
  assert any(c['status']=='failed' for c in r['criteria'] if c['kind']=='probe.icmp'),r
  page.click('#academyReset')
  assert page.evaluate('academyEngine.snapshot()')==lab['initial_topology']
  assert page.locator('#academyHints').inner_text()==''
  assert page.locator('#academyResult').inner_text()==''
  print('PASS',lid,'original, initial, target, reverse links, broken delivery, reset')
 # Solve AGL-005 using student-visible IOS CLI and check button.
 page.select_option('#academySelect','AGL-005');page.click('#academyStart')
 page.select_option('#ptCliDevice','SW1')
 for cmd in ['enable','configure terminal','interface fa0/2','no shutdown','end']:
  page.fill('#ptCliInput',cmd);page.locator('#ptCliInput').press('Enter')
 page.click('#academyCheck')
 assert '100/100' in page.locator('#academyResult').inner_text()
 # Repeated hints cannot add duplicates; selection alone must not replace work.
 page.click('#academyHint');assert page.locator('#academyHint').is_disabled()
 t=page.evaluate('academyEngine.snapshot()');page.select_option('#academySelect','AGL-001')
 assert page.evaluate('academyEngine.snapshot()')==t
 page.click('#academyReset');assert page.locator('#academySelect').input_value()=='AGL-005'
 # Unsupported criterion is incomplete, never a false success.
 r=page.evaluate("academy.evaluate([{id:'unsupported',kind:'unknown',points:100}], {})")
 assert r['status']=='incomplete' and r['earned_points']==0 and r['coverage']==0,r
 # Probe errors must propagate through the embedded verdict module as incomplete.
 r=page.evaluate("academy.evaluate([{id:'missing-device',kind:'probe.icmp',points:100,expected:true,target:{source:'missing',destination:'also-missing'}}], {})")
 assert r['status']=='incomplete' and r['evaluated_max_points']==0,r
 assert r['criteria'][0]['status']=='error',r
 # Invalid criteria must still be rejected at the public browser entry point.
 assert page.evaluate("""() => {
  try { academy.evaluate([{id:'bad',kind:'unknown',points:-1}], {}); }
  catch (e) { return e.message === 'Invalid criterion'; }
  return false;
 }""")
 assert not errors,errors
 b.close()
print('PASS Academy browser integration')
