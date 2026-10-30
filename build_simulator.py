"""Embed modular simulator sources into the single offline HTML distribution."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
path=ROOT/'AgLab_Final_PKT_Import.html'
html=path.read_text(encoding='utf-8')
start='// BEGIN SWITCH MANAGEMENT GENERATED\n';end='// END SWITCH MANAGEMENT GENERATED\n'
code=start+(ROOT/'simulator/switch-management.js').read_text(encoding='utf-8')+'\n'+end
if start in html:
 a=html.index(start);b=html.index(end,a)+len(end);html=html[:a]+code+html[b:]
else:
 anchor='// BEGIN ACADEMY GENERATED\n';assert anchor in html;html=html.replace(anchor,code+anchor,1)
path.write_text(html,encoding='utf-8',newline='\n')
