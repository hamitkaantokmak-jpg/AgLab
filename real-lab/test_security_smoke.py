import json,pathlib,subprocess,tempfile,unittest
from unittest.mock import patch
import security_smoke as m

class SecurityTests(unittest.TestCase):
 def test_dry_run_does_not_start_native_processes(self):
  with patch('subprocess.run') as run:
   self.assertEqual(m.main(['acl']),0);run.assert_not_called()
 def test_namespace_guard_refuses_unknown_names_and_shell(self):
  lab=m.Lab('acl');calls=[]
  lab.command=lambda args,**kw:calls.append((args,kw))
  self.assertRaises(ValueError,lab.ns,'host','nft','flush','ruleset')
  lab.ns('r1','nft','list','ruleset')
  self.assertEqual(calls[0][0][:3],['ip','netns','exec']);self.assertNotIn('shell',calls[0][1])
 def test_existing_namespace_is_not_deleted(self):
  lab=m.Lab('acl');calls=[]
  def command(args,**kw):
   calls.append(args);return subprocess.CompletedProcess(args,0,lab.names['r1']+'\n','')
  lab.command=command
  self.assertRaises(RuntimeError,lab.setup)
  lab.cleanup();self.assertFalse(any('del' in args for args in calls))
 def test_partial_setup_deletes_only_owned_namespaces(self):
  lab=m.Lab('acl');calls=[]
  def command(args,**kw):
   calls.append(args)
   if args[:3]==['ip','netns','add'] and args[-1]==lab.names['c1']:raise RuntimeError('partial failure')
   return subprocess.CompletedProcess(args,0,'','')
  lab.command=command
  self.assertRaises(RuntimeError,lab.setup);self.assertTrue(lab.cleanup())
  deleted=[a[-1] for a in calls if a[:3]==['ip','netns','del']]
  self.assertEqual(deleted,[lab.names['r1']])
 def test_one_cleanup_failure_does_not_skip_other_owned_namespaces(self):
  lab=m.Lab('acl');lab.created=['r1','c1'];calls=[]
  def command(args,**kw):
   calls.append(args)
   if args[:3]==['ip','netns','del'] and args[-1]==lab.names['c1']:raise RuntimeError('delete failed')
   return subprocess.CompletedProcess(args,0,'','')
  lab.command=command
  self.assertFalse(lab.cleanup())
  self.assertIn(['ip','netns','del',lab.names['r1']],calls)
 def test_unexpected_probe_error_cannot_pass_as_filtering(self):
  self.assertFalse(m.denied({'returncode':2,'result':{'error_type':'FileNotFoundError'}},'tcp'))
  self.assertFalse(m.denied({'returncode':0,'result':{}},'tcp'))
  self.assertTrue(m.denied({'returncode':2,'result':{'error_type':'TimeoutError'}},'tcp'))
 def test_topology_fixture_and_evidence_do_not_mutate_source(self):
  original=json.dumps(m.TOPOLOGY,sort_keys=True);lab=m.Lab('acl')
  lab.evidence['topology']['nodes']['c1']['ip']='changed'
  self.assertEqual(json.dumps(m.TOPOLOGY,sort_keys=True),original)
  fixture=json.loads((m.ROOT/'examples/security-topology.json').read_text())
  self.assertEqual(fixture,m.TOPOLOGY)
 def test_nat_rules_use_only_lab_prefixes_and_named_table(self):
  lab=m.Lab('nat');self.assertIn('snat to 198.18.0.1:40000-40010',lab.nat_rules('pat'))
  self.assertNotIn('flush ruleset',lab.nat_rules('pat'))
  self.assertRaises(ValueError,lab.nat_rules,'untrusted')

if __name__=='__main__':unittest.main()
