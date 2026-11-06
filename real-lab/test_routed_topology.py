import copy,json,pathlib,tempfile,unittest
from unittest.mock import patch
from routed_topology import convert,export,example
ROOT=pathlib.Path(__file__).resolve().parents[1]
class RoutedTests(unittest.TestCase):
 def test_two_and_three_router_data_only_export(self):
  for routers in (2,3):
   t=example(routers);before=copy.deepcopy(t);p=convert(t)
   self.assertEqual(t,before);self.assertEqual(sum(d['type']=='Router' for d in p['nodes'].values()),routers)
   with tempfile.TemporaryDirectory() as tmp,patch('subprocess.run') as run:
    out=pathlib.Path(tmp)/'out';export(p,out);run.assert_not_called()
    lab=json.loads((out/'lab.clab.yml').read_text());self.assertFalse(any('exec' in n for n in lab['topology']['nodes'].values()))
    self.assertIn('ip route 192.168.20.0/24 10.0.12.2 1',(out/'r1.conf').read_text())
    self.assertRaises(ValueError,export,p,out)
 def test_immutable_academy_034_035_initial_and_target(self):
  for lid in ('AGL-034','AGL-035'):
   lab=json.loads((ROOT/'academy/source'/f'{lid}.json').read_text())
   for state in ('initial_topology','target_topology'):
    t=lab[state];before=copy.deepcopy(t);p=convert(t);self.assertEqual(t,before)
    self.assertEqual(len(p['nodes']),6);self.assertEqual(len(p['links']),5)
 def test_rejects_unsafe_or_unsupported_fields(self):
  for change in [lambda t:t.update(exec='touch /tmp/x'),lambda t:t['devices'][1].update(image='untrusted'),lambda t:t['devices'][1].update(ospf={}),lambda t:t['devices'][1]['interfaces']['g0/0'].update(helperAddress='10.0.0.1'),lambda t:t['devices'][1]['interfaces']['g0/0'].update(parent='g0/2'),lambda t:t['devices'][1]['staticRoutes'][0].update(nextHop='1.1.1.1'),lambda t:t['devices'][1].update(config={'runningConfig':'shell'}),lambda t:t['devices'][0].update(ports=['eth0;touch /tmp/x'])]:
   t=example(2);change(t);self.assertRaises(ValueError,convert,t)
 def test_invalid_addresses_routes_links_and_types(self):
  for change in [lambda t:t['devices'][0].update(mask='255.0.255.0'),lambda t:t['devices'][0].update(ip='8.8.8.8'),lambda t:t['devices'][1]['staticRoutes'][0].update(distance=True),lambda t:t['links'].append(t['links'][0]),lambda t:t['devices'][1]['interfaces']['g0/0'].update(enabled='up'),lambda t:t.update(devices=None),lambda t:t['devices'][1]['staticRoutes'].append({'network':'192.168.20.0','mask':'255.255.255.0','nextHop':'10.0.12.2','shell':'x'})]:
   t=example(2);change(t);self.assertRaises(ValueError,convert,t)
 def test_shutdown_and_missing_or_wrong_route_are_preserved(self):
  t=example(3);t['devices'][1]['interfaces']['g0/0']['enabled']=False;t['devices'][1]['staticRoutes'][0]['nextHop']='10.0.12.99';t['devices'][-2]['staticRoutes']=[]
  p=convert(t);self.assertFalse(p['nodes']['r1']['ports']['g0/0']['enabled']);self.assertEqual(p['nodes']['r1']['routes'][0]['next_hop'],'10.0.12.99');self.assertEqual(p['nodes']['r3']['routes'],[])
 def test_plan_is_revalidated_on_export(self):
  p=convert(example(2));p['nodes']['r1']['routes'][0]['next_hop']='10.0.0.1\nexec evil'
  with tempfile.TemporaryDirectory() as tmp:self.assertRaises(ValueError,export,p,pathlib.Path(tmp)/'out')
if __name__=='__main__':unittest.main()
