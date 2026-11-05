import importlib.util,json,pathlib,subprocess,tempfile,unittest
from unittest.mock import Mock,patch
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('advanced',ROOT/'advanced_smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AdvancedTests(unittest.TestCase):
 def test_fixed_names_and_topologies(self):
  with tempfile.TemporaryDirectory() as t:
   for kind,count in [('l2',6),('routing',5)]:
    topology=m.topology(kind,pathlib.Path(t));self.assertEqual(len(topology['topology']['links']),count);self.assertTrue(topology['name'].startswith('aglab-advanced-'));self.assertNotEqual(topology['name'],'aglab-real-mvp')
   text=(pathlib.Path(t)/'r1.conf').read_text();self.assertIn('router ospf 1',text);self.assertNotIn('ip route ',text)
  self.assertRaises(ValueError,m.topology,'unknown',pathlib.Path('.'))
 def test_dry_run_has_no_side_effect(self):
  with patch.object(m.subprocess,'run') as run:self.assertEqual(m.main(['routing']),0);run.assert_not_called()
 def test_command_never_uses_shell(self):
  runner=Mock(return_value=subprocess.CompletedProcess([],0,'{}',''));live=m.Live('routing',runner)
  live.vty('r1','show ip route json');args=runner.call_args.args[0];self.assertEqual(args[:3],['docker','exec','clab-aglab-advanced-routing-r1']);self.assertNotIn('shell',runner.call_args.kwargs)
  self.assertRaises(ValueError,live.execute,'untrusted;rm','ip')
 def test_route_requires_native_protocol_ad_and_next_hop(self):
  live=m.Live('routing');data={'192.168.20.0/24':[{'protocol':'ospf','distance':110,'nexthops':[{'ip':'10.0.13.3'}]}]}
  with patch.object(live,'show',return_value=data):
   self.assertTrue(live.route('ospf','10.0.13.3'));self.assertFalse(live.route('bgp'));self.assertFalse(live.route('ospf','10.0.12.2'))
 def test_neighbor_must_be_full(self):
  live=m.Live('routing')
  with patch.object(live,'show',return_value={'2.2.2.2':[{'nbrState':'Init'}]}):self.assertFalse(live.full('r1','2.2.2.2'))
  with patch.object(live,'show',return_value={'2.2.2.2':[{'nbrState':'Full/-'}]}):self.assertTrue(live.full('r1','2.2.2.2'));self.assertFalse(live.full('r1','3.3.3.3'))
 def test_bgp_must_be_established(self):
  live=m.Live('routing')
  for state,ok in [('Active',False),('Established',True)]:
   with patch.object(live,'show',return_value={'ipv4Unicast':{'peers':{'10.0.13.3':{'state':state}}}}):self.assertEqual(live.bgp_up('r1','10.0.13.3'),ok)
 def test_preexisting_lab_is_not_destroyed(self):
  calls=[]
  def run(self,args,timeout=30,check=True):calls.append(args);return subprocess.CompletedProcess(args,0,'clab-aglab-advanced-l2-s1\n' if args[0]=='docker' else '', '')
  with tempfile.TemporaryDirectory() as t,patch.object(m.Live,'command',run):
   self.assertEqual(m.main(['l2','--execute','--out',t]),1);report=json.loads((pathlib.Path(t)/'advanced-l2-results.json').read_text());self.assertFalse(report['cleanup']);self.assertFalse(any('destroy' in c for c in calls))
 def test_partial_deploy_is_cleaned(self):
  calls=[]
  def run(self,args,timeout=30,check=True):
   calls.append(args)
   if 'deploy' in args:raise RuntimeError('deploy failed')
   return subprocess.CompletedProcess(args,0,'','')
  with tempfile.TemporaryDirectory() as t,patch.object(m.Live,'command',run):
   self.assertEqual(m.main(['routing','--execute','--out',t]),1);self.assertTrue(any('destroy' in c for c in calls));self.assertTrue(json.loads((pathlib.Path(t)/'advanced-routing-results.json').read_text())['cleanup'])
if __name__=='__main__':unittest.main()
