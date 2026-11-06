import unittest,tempfile,pathlib
from extended_routing import multi_area, ipv6, extended_topology
class Fake:
 def __init__(self):self.commands=[];self.evidence={};self.labels=[]
 def config(self,*c):self.commands.append(c)
 def execute(self,*c,**kw):
  self.commands.append(c)
  return type('Result',(),{'stdout':'mocked command output'})()
 def wait(self,label,fn,*a):self.labels.append(label)
 def stable_negative(self,label,fn):self.labels.append(label)
 def record(self,label):self.labels.append(label)
 def vty(self,*c):return 'captured'
 def ping(self,*a):return True
class ExtendedTests(unittest.TestCase):
 def test_multiarea_is_not_basic_ospf_repetition(self):
  f=Fake();multi_area(f);self.assertNotIn(('r2','router ospf','area 2 range 192.168.20.0/23'),f.commands);self.assertIn(('r2','router ospf','passive-interface eth3'),f.commands);self.assertTrue(any('data path' in x for x in f.labels))
 def test_ipv6_has_native_addresses_route_fault_and_repair(self):
  f=Fake();ipv6(f);self.assertIn(('r2','no ipv6 route fd10:20::/64 fd10:23::3'),f.commands);self.assertEqual(f.commands.count(('r2','ipv6 route fd10:10::/64 fd10:12::1','ipv6 route fd10:20::/64 fd10:23::3')),1);self.assertTrue(any('Neighbor Discovery' in x for x in f.labels))
 def test_multiarea_is_startup_configuration(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp);lab=extended_topology(p);self.assertEqual(lab['name'],'aglab-extended-routing');text=(p/'r2.conf').read_text();self.assertIn('network 10.0.23.0/24 area 2',text);self.assertNotIn('network 10.0.23.0/24 area 0',text)
if __name__=='__main__':unittest.main()
