"""Build result must not depend on previous order of generated adapter blocks."""
import pathlib,re,shutil,subprocess,sys,tempfile,unittest,os,hashlib
from unittest.mock import patch
from verify_packages import build_release_manifest
ROOT=pathlib.Path(__file__).resolve().parent
TITLES=['SIMULATION PLAYBACK','BORCK ENGINE','ENGINE MANAGER','ENGINE MANAGER UI','BORCK UI','LAB EVIDENCE','LAB EVIDENCE UI','SIMULATION UI']
class BuildTests(unittest.TestCase):
 def test_device_hooks_are_generated_from_legacy_html(self):
  text=(ROOT/'AgLab_Final_PKT_Import.html').read_text(encoding='utf-8')
  self.assertIn('deviceCliDragExceeded(ev,e,startX,startY)',text)
  self.assertNotIn('Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY)>3',text)
  self.assertIn('selectDeviceCliHistory(d.id);if(ptCommandHistory',text)
  self.assertEqual(hashlib.sha256((ROOT/'AgLab_Final_PKT_Import.html').read_bytes()).hexdigest(),(ROOT/'html-build.sha256').read_text().split()[0])
 def test_build_identity_is_explicit_and_bounded(self):
  with patch.dict(os.environ,{},clear=True):self.assertIsNone(build_release_manifest(ROOT)['source_commit'])
  with patch.dict(os.environ,{'GITHUB_SHA':'a'*40},clear=True):self.assertEqual(build_release_manifest(ROOT)['source_commit'],'a'*40)
  with patch.dict(os.environ,{'GITHUB_SHA':'invented'},clear=True):self.assertRaises(ValueError,build_release_manifest,ROOT)
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
