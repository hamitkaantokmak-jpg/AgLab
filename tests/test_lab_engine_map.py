import importlib.util,pathlib,unittest
from aglab_test_support import ROOT
spec=importlib.util.spec_from_file_location('labmap',ROOT/'tools/build_lab_engine_map.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MapTests(unittest.TestCase):
 def test_map_is_derived_and_current(self):
  text=m.render();self.assertEqual(text,(ROOT/'docs/LAB_MOTOR_HARITASI.md').read_text(encoding='utf-8'));self.assertEqual(sum(x.startswith('| AGL-') for x in text.splitlines()),40)
if __name__=='__main__':unittest.main()
