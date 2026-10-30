"""Embed academy sources so the downloadable HTML works without a server."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
p=ROOT/'AgLab_Final_PKT_Import.html'
h=p.read_text(encoding='utf-8')
start='// BEGIN ACADEMY GENERATED\n';end='// END ACADEMY GENERATED\n'
code=start+(ROOT/'academy/student-data.js').read_text(encoding='utf-8')+(ROOT/'academy/grading-verdict.js').read_text(encoding='utf-8')+(ROOT/'academy/academy.js').read_text(encoding='utf-8')+'\n'+end
if start in h:
 a=h.index(start);b=h.index(end,a)+len(end);h=h[:a]+code+h[b:]
else:
 anchor=" try{const saved=localStorage.getItem('aglab-topology-v23')"
 assert anchor in h
 h=h.replace(anchor,code+anchor,1)
p.write_text(h,encoding='utf-8',newline='\n')
