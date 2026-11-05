"""Build result must not depend on previous order of generated adapter blocks."""
import pathlib,re,shutil,subprocess,sys,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parent
TITLES=['BORCK ENGINE','ENGINE MANAGER','ENGINE MANAGER UI','BORCK UI','LAB EVIDENCE','LAB EVIDENCE UI']
class BuildTests(unittest.TestCase):
 def test_canonical_order_after_permuted_previous_build(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=pathlib.Path(tmp);shutil.copy(ROOT/'build_simulator.py',folder/'build_simulator.py');shutil.copytree(ROOT/'simulator',folder/'simulator');html=folder/'AgLab_Final_PKT_Import.html';shutil.copy(ROOT/html.name,html)
   subprocess.run([sys.executable,str(folder/'build_simulator.py')],check=True);expected=html.read_text(encoding='utf-8')
   blocks=[];base=expected
   for title in TITLES:
    start='// BEGIN '+title+' GENERATED\n';end='// END '+title+' GENERATED\n';a=base.index(start);b=base.index(end,a)+len(end);blocks.append(base[a:b]);base=base[:a]+base[b:]
   anchor='// BEGIN ACADEMY GENERATED\n';html.write_text(base.replace(anchor,''.join(reversed(blocks))+anchor,1),encoding='utf-8')
   subprocess.run([sys.executable,str(folder/'build_simulator.py')],check=True)
   self.assertEqual(html.read_text(encoding='utf-8'),expected,'Build depends on previous module order')
   positions=[expected.index('// BEGIN '+t+' GENERATED\n') for t in TITLES];self.assertEqual(positions,sorted(positions))
if __name__=='__main__':unittest.main()
