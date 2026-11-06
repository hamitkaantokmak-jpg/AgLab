#!/usr/bin/env python3
"""Reuse the existing FRR lab for inter-area OSPF and isolated IPv6 traffic."""
import argparse, json, pathlib, tempfile
from advanced_smoke import Live, IMAGE, topology
ROOT=pathlib.Path(__file__).resolve().parent

def multi_area(live):
    for n in ('r1','r3'):live.config(n,'interface eth3','shutdown')
    for n in ('r1','r2','r3'):live.config(n,'no router ospf')
    networks={1:[('192.168.10.0/24',1),('10.0.12.0/24',0)],2:[('10.0.12.0/24',0),('10.0.23.0/24',2)],3:[('10.0.23.0/24',2),('192.168.20.0/24',2)]}
    for i,ns in networks.items():live.config(f'r{i}','router ospf',f'ospf router-id {i}.{i}.{i}.{i}',*(f'network {prefix} area {area}' for prefix,area in ns))
    live.wait('Multi-area OSPF: backbone and area2 adjacency',lambda:live.full('r1','2.2.2.2') and live.full('r2','3.3.3.3'))
    def interarea():
        text=live.vty('r1','show ip route ospf');live.evidence['inter-area-route']=text
        return 'O IA' in text and '192.168.20.0/24' in text and live.route('ospf','10.0.12.2')
    live.wait('Inter-area O IA route through ABR r2',interarea)
    live.wait('Multi-area real IPv4 ICMP',live.ping)
    live.config('r2','router ospf','passive-interface eth3')
    live.stable_negative('Passive transit interface removes adjacency and data path',lambda:not live.full('r2','3.3.3.3') and not live.route('ospf') and live.ping(False))
    live.config('r2','router ospf','no passive-interface eth3')
    live.wait('Passive-interface repair restores inter-area traffic',lambda:interarea() and live.ping())
    live.config('r2','router ospf','area 2 range 192.168.20.0/23')
    live.wait('ABR summary /23 replaces external /24 and carries traffic',lambda:live.route('ospf','10.0.12.2','192.168.20.0/23') and not live.route('ospf') and live.ping())
    live.config('r2','router ospf','no area 2 range 192.168.20.0/23')
    live.wait('Summary removal restores specific inter-area route',lambda:interarea() and live.ping())

def ipv6(live):
    addresses={'r1':[('eth1','fd10:10::1/64'),('eth2','fd10:12::1/64')],'r2':[('eth2','fd10:12::2/64'),('eth3','fd10:23::2/64')],'r3':[('eth1','fd10:20::1/64'),('eth2','fd10:23::3/64')],'pc1':[('eth1','fd10:10::10/64')],'pc2':[('eth1','fd10:20::10/64')]}
    for n,ports in addresses.items():
        live.execute(n,'sysctl','-w','net.ipv6.conf.all.disable_ipv6=0')
        live.execute(n,'sysctl','-w','net.ipv6.conf.default.disable_ipv6=0')
        if n.startswith('r'):live.execute(n,'sysctl','-w','net.ipv6.conf.all.forwarding=1')
        for p,a in ports:
            live.execute(n,'sysctl','-w',f'net.ipv6.conf.{p}.disable_ipv6=0')
            live.execute(n,'ip','-6','addr','add',a,'dev',p)
    for n,route in {'r1':['ipv6 route fd10:20::/64 fd10:12::2'],'r2':['ipv6 route fd10:10::/64 fd10:12::1','ipv6 route fd10:20::/64 fd10:23::3'],'r3':['ipv6 route fd10:10::/64 fd10:23::2']}.items():live.config(n,*route)
    for n,destination,via in [('pc1','fd10:20::/64','fd10:10::1'),('pc2','fd10:10::/64','fd10:20::1')]:live.execute(n,'ip','-6','route','add',destination,'via',via,'dev','eth1')
    def ping(ok=True):
        r=live.execute('pc1','ping','-6','-c','2','-W','1','fd10:20::10',check=False)
        live.evidence['icmpv6']={'expected_success':ok,'exit_code':r.returncode,'output':r.stdout+r.stderr}
        return (r.returncode==0)==ok
    live.wait('IPv6 static routing carries real ICMPv6',ping)
    def nd():
        data=live.json('r1','ip','-json','-6','neigh','show','dev','eth1');live.evidence['neighbor-discovery']=data
        return any(r.get('dst')=='fd10:10::10' and r.get('lladdr') and not any(s in ('FAILED','INCOMPLETE') for s in r.get('state',[])) for r in data)
    live.wait('IPv6 Neighbor Discovery learns actual endpoint MAC',nd)
    live.config('r2','no ipv6 route fd10:20::/64 fd10:23::3')
    live.stable_negative('IPv6 missing transit route blocks ICMPv6',lambda:ping(False))
    live.config('r2','ipv6 route fd10:20::/64 fd10:23::3')
    live.wait('IPv6 route repair restores ICMPv6',ping)
    live.evidence['ipv6-routes']=live.vty('r2','show ipv6 route')
    live.record('FRR IPv6 route table captured; SLAAC/DHCPv6 outside scope')

def main():
    p=argparse.ArgumentParser();p.add_argument('--execute',action='store_true');p.add_argument('--out',default=str(ROOT.parent/'dist'));a=p.parse_args()
    if not a.execute:print('DRY RUN: isolated multi-area/IPv6 lab');return 0
    live=Live('routing');live.name='aglab-extended-routing';out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
    report={'kind':'routing','engine':'FRRouting','image':IMAGE,'steps':live.steps,'evidence':live.evidence,'ok':False,'cleanup':False}
    with tempfile.TemporaryDirectory(prefix='aglab-extended-') as tmp:
        folder=pathlib.Path(tmp);lab=topology('routing',folder);lab['name']=live.name;target=folder/'lab.clab.yml';target.write_text(json.dumps(lab),encoding='utf-8');started=False
        try:
            names=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
            if any(n.startswith('clab-'+live.name+'-') for n in names):raise RuntimeError('Pre-existing extended lab; refusing to touch it')
            started=True;report['host_kernel']=live.command(['uname','-r']).stdout.strip();live.command(['containerlab','deploy','-t',str(target)],240)
            report['image_id']=live.command(['docker','image','inspect',IMAGE,'--format','{{.Id}}']).stdout.strip()
            multi_area(live);ipv6(live);report['ok']=True
        except Exception as e:
            report['error']=str(e);print('FAIL',e,flush=True)
            for n in ('r1','r2','r3'):
                for cmd in ('show running-config','show ip route','show ipv6 route','show ip ospf neighbor'):
                    try:live.evidence[n+' '+cmd]=live.vty(n,cmd)
                    except Exception:pass
        finally:
            if started:
                result=live.command(['containerlab','destroy','-t',str(target),'--cleanup'],120,False)
                names=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
                report['cleanup']=result.returncode==0 and not any(n.startswith('clab-'+live.name+'-') for n in names)
            report['ok']=report['ok'] and report['cleanup'];(out/'extended-routing-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return 0 if report['ok'] else 1
if __name__=='__main__':raise SystemExit(main())
