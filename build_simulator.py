"""Embed modular simulator sources into the single offline HTML distribution."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
path=ROOT/'AgLab_Final_PKT_Import.html'
html=path.read_text(encoding='utf-8')
for title,source in [('MAC ADDRESS','mac-address.js'),('TRACEROUTE','traceroute.js'),('ICMP','icmp.js'),('ROUTED ETHERNET','routed-ethernet.js'),('ROUTING PATH','routing-path.js'),('ETHERNET FORWARDING','ethernet-forwarding.js'),('MAC LEARNING','mac-learning.js'),('SWITCH MANAGEMENT','switch-management.js'),('PACKET EVENTS','packet-events.js'),('PACKET DETECTIVE UI','packet-detective-ui.js'),('DEVICE CLI','device-cli.js'),('NETWORK PROTOCOLS','network-protocols.js'),('PORT SECURITY','port-security.js'),('NETWORK SCENARIOS','network-scenarios.js')]:
 start='// BEGIN '+title+' GENERATED\n';end='// END '+title+' GENERATED\n'
 code=start+('const sharedNetworkScenarios='+ (ROOT/'simulator/network-scenarios.json').read_text(encoding='utf-8')+';\n' if title=='NETWORK SCENARIOS' else '')+(ROOT/'simulator'/source).read_text(encoding='utf-8')+'\n'+end
 if start in html:
  a=html.index(start);b=html.index(end,a)+len(end);html=html[:a]+code+html[b:]
 else:
  anchor='// BEGIN ACADEMY GENERATED\n';assert anchor in html;html=html.replace(anchor,code+anchor,1)
extra=[]
for title,source in [('BORCK ENGINE','borck-engine.generated.js'),('ENGINE MANAGER','engine-manager.js'),('ENGINE MANAGER UI','engine-manager-ui.js'),('BORCK UI','borck-ui.js'),('LAB EVIDENCE','lab-evidence.js'),('LAB EVIDENCE UI','lab-evidence-ui.js')]:
 start='// BEGIN '+title+' GENERATED\n';end='// END '+title+' GENERATED\n'
 code=start+(ROOT/'simulator'/source).read_text(encoding='utf-8')+'\n'+end
 while start in html:
  a=html.index(start);b=html.index(end,a)+len(end);html=html[:a]+html[b:]
 extra.append(code)
anchor='// BEGIN ACADEMY GENERATED\n';assert anchor in html
html=html.replace(anchor,''.join(extra)+anchor,1)
path.write_text(html,encoding='utf-8',newline='\n')
