import copy,json,pathlib,subprocess,tempfile,unittest
from unittest.mock import patch
import routed_smoke as m
from routed_topology import convert,example
class RoutedSmokeTests(unittest.TestCase):
 def test_dry_run_never_executes(self):
  with patch('subprocess.run') as run:self.assertEqual(m.main([]),0);run.assert_not_called()
 def test_only_validated_static_routes_can_be_repaired(self):
  a=convert(example(2));b=copy.deepcopy(a);b['nodes']['r1']['ports']['g0/0']['enabled']=False
  self.assertRaises(ValueError,m.same_wiring,a,b)
 def test_execution_is_argv_not_shell_and_management_is_disabled(self):
  live=m.RoutedLive(convert(example(2)));calls=[]
  live.execute=lambda *args,**kw:(calls.append(args) or subprocess.CompletedProcess([],0,'FRRouting',''))
  live.wait=lambda label,fn:fn()
  live.apply()
  for n in ('pc1','pc2','r1','r2'):self.assertIn((n,'ip','link','set','eth0','down'),calls)
  live=m.RoutedLive(convert(example(2)));calls=[]
  live.runner=lambda args,**kw:(calls.append((args,kw)) or subprocess.CompletedProcess(args,0,'',''))
  live.config('r1','ip route 192.168.20.0/24 10.0.12.2 1')
  self.assertNotIn('shell',calls[0][1]);self.assertEqual(calls[0][0][:3],['docker','exec','clab-aglab-shared-routing-r1'])
  self.assertRaises(ValueError,live.execute,'r1; rm','ip')
 def test_preexisting_lab_is_not_destroyed(self):
  calls=[]
  def command(self,args,timeout=30,check=True):calls.append(args);return subprocess.CompletedProcess(args,0,'clab-aglab-shared-routing-r1\n','')
  with tempfile.TemporaryDirectory() as tmp,patch.object(m.RoutedLive,'command',command):
   self.assertFalse(m.run_case(example(2),example(2),tmp,'test'))
   self.assertFalse(any('destroy' in a for a in calls))
   self.assertFalse(json.loads((pathlib.Path(tmp)/'test-results.json').read_text())['cleanup'])
 def test_partial_deploy_is_cleaned(self):
  calls=[]
  def command(self,args,timeout=30,check=True):
   calls.append(args)
   if 'deploy' in args:raise RuntimeError('deployment failure')
   return subprocess.CompletedProcess(args,0,'','')
  with tempfile.TemporaryDirectory() as tmp,patch.object(m.RoutedLive,'command',command):
   self.assertFalse(m.run_case(example(2),example(2),tmp,'test'))
   self.assertTrue(any('destroy' in a for a in calls));self.assertTrue(json.loads((pathlib.Path(tmp)/'test-results.json').read_text())['cleanup'])
 def test_busybox_endpoints_use_text_routes_and_routers_keep_json(self):
  live=m.RoutedLive(convert(example(2)));calls=[]
  live.show=lambda *args:{}
  def execute(n,*args,**kw):
   calls.append((n,*args))
   if '-json' in args and live.plan['nodes'][n]['type']!='Router':raise RuntimeError('BusyBox has no JSON option')
   return subprocess.CompletedProcess([],0,'[]' if '-json' in args else 'default via 192.168.10.1 dev eth1\n','')
  live.execute=execute;live.capture_routes()
  self.assertIn(('pc1','ip','route','show'),calls)
  self.assertIn(('r1','ip','-json','route','show'),calls)
 def test_frr_command_rejection_is_not_success(self):
  live=m.RoutedLive(convert(example(2)))
  with patch.object(live,'vty',return_value='% Unknown command'):
   self.assertRaises(RuntimeError,live.config,'r1','bad command')
if __name__=='__main__':unittest.main()
