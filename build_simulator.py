"""Embed modular simulator sources into the single offline HTML distribution."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
path=ROOT/'AgLab_Final_PKT_Import.html'
html=path.read_text(encoding='utf-8')
for title,source in [('ETHERNET FORWARDING','ethernet-forwarding.js'),('MAC LEARNING','mac-learning.js'),('SWITCH MANAGEMENT','switch-management.js')]:
 start='// BEGIN '+title+' GENERATED\n';end='// END '+title+' GENERATED\n'
 code=start+(ROOT/'simulator'/source).read_text(encoding='utf-8')+'\n'+end
 if start in html:
  a=html.index(start);b=html.index(end,a)+len(end);html=html[:a]+code+html[b:]
 else:
  anchor='// BEGIN ACADEMY GENERATED\n';assert anchor in html;html=html.replace(anchor,code+anchor,1)
path.write_text(html,encoding='utf-8',newline='\n')
