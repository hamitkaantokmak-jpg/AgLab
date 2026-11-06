import importlib.util,json,pathlib,tempfile,unittest,copy
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('shared',ROOT/'shared_topology.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SharedTests(unittest.TestCase):
 def fixture(self):return json.loads((ROOT/'examples/shared-vlan10.aglab.json').read_text())
 def test_preserves_input_and_uses_fixed_names(self):
  t=self.fixture();before=copy.deepcopy(t);p=m.convert(t);self.assertEqual(t,before);self.assertEqual(set(p['nodes']),{'pc1','pc2','s1','s2'});self.assertEqual(len(p['links']),3);self.assertTrue(p['source_sha256'])
 def test_unsafe_fields_are_rejected(self):
  for mutate in [lambda t:t.update(exec='shell'),lambda t:t['devices'][0].update(image='attacker'),lambda t:t['devices'][0].update(type='Router'),lambda t:t['devices'][0].update(ip='8.8.8.8'),lambda t:t['devices'][2]['interfaces']['fa0/1'].update(portSecurity={'enabled':True})]:
   t=self.fixture();mutate(t);self.assertRaises(ValueError,m.convert,t)
 def test_ports_vlans_and_mac_validation(self):
  for mutate in [lambda t:t['links'].append(t['links'][0]),lambda t:t['devices'][2]['interfaces']['gi0/1'].update(allowed=[-1]),lambda t:t['devices'][1].update(mac=t['devices'][0]['mac']),lambda t:t['devices'][0].update(mask='255.0.255.0')]:
   t=self.fixture();mutate(t);self.assertRaises(ValueError,m.convert,t)
 def test_declarative_export_never_accepts_shell(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=m.convert(self.fixture());m.export(p,pathlib.Path(tmp)/'plan');top=json.loads((pathlib.Path(tmp)/'plan/lab.clab.yml').read_text());self.assertEqual(top['name'],'aglab-shared-l2');self.assertFalse(any('exec' in n for n in top['topology']['nodes'].values()));self.assertRaises(ValueError,m.export,p,pathlib.Path(tmp)/'plan')
 def test_malformed_nested_values_and_management_ip_are_rejected(self):
  for mutate in [lambda t:t.update(devices=None),lambda t:t['devices'][0].update(ports=[{}]),lambda t:t['devices'][2].update(ip='192.168.1.1',mask='255.255.255.0'),lambda t:t['devices'][2]['interfaces']['gi0/1'].update(allowed=[True]),lambda t:t['links'][0].update(up='yes')]:
   t=self.fixture();mutate(t);self.assertRaises(ValueError,m.convert,t)
 def test_native_apply_disables_pc_management_path(self):
  from shared_smoke import SharedLive
  live=SharedLive(m.convert(self.fixture()));calls=[];live.execute=lambda *a,**kw:calls.append(a)
  live.apply()
  for n in ('pc1','pc2'):self.assertIn((n,'ip','link','set','eth0','down'),calls)
 def test_vlan_database_and_missing_cable_are_not_silently_repaired(self):
  t=self.fixture();t['devices'][2]['vlans']=[1];self.assertRaises(ValueError,m.convert,t)
  t=self.fixture();t['links'].pop(0);self.assertRaises(ValueError,m.convert,t)
if __name__=='__main__':unittest.main()
