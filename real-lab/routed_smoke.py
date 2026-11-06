#!/usr/bin/env python3
"""Operator-only real FRR execution; source JSON is revalidated, never a shell plan."""
import argparse,copy,ipaddress,json,pathlib,tempfile
from advanced_smoke import Live,IMAGE,records
from routed_topology import convert,export,example,NAME
ROOT=pathlib.Path(__file__).resolve().parent

class RoutedLive(Live):
    def __init__(self,plan):super().__init__('routing');self.name=NAME;self.plan=plan;self.pair=('pc1','pc2')
    def execute(self,node,*args,check=True):
        if node not in self.plan['nodes']:raise ValueError('Unknown mapped node')
        return self.command(['docker','exec',f'clab-{self.name}-{node}',*args],check=check)
    def config(self,node,*commands):
        output=super().config(node,*commands)
        self.evidence['last-config']={'node':node,'commands':list(commands),'output':output}
        if '%' in output:raise RuntimeError('FRR rejected operator config: '+output)
        return output
    def apply(self):
        connected={e for l in self.plan['links'] for e in l['endpoints']}
        for n,d in self.plan['nodes'].items():
            # Remove ALL management exits, including routers and switches.
            self.execute(n,'ip','link','set','eth0','down')
            if d['type']=='PC':
                self.execute(n,'ip','route','del','default',check=False)
                self.execute(n,'ip','link','set','eth1','address',d['mac'])
                self.execute(n,'ip','addr','add',d['ip'],'dev','eth1')
                self.execute(n,'ip','link','set','eth1','up')
                if d['gateway']:self.execute(n,'ip','route','add','default','via',d['gateway'],'dev','eth1')
            elif d['type']=='Switch':
                self.execute(n,'ip','link','add','br0','type','bridge','stp_state','0')
                self.execute(n,'ip','link','set','br0','up')
            else:
                self.execute(n,'sysctl','-w','net.ipv4.ip_forward=1')
                self.wait('FRR running on '+n,lambda n=n:'FRRouting' in self.vty(n,'show version'))
            for port in d['ports'].values():
                endpoint=n+':'+port['native']
                if endpoint not in connected:continue
                up=d['enabled'] and port['enabled'] and all(l['up'] for l in self.plan['links'] if endpoint in l['endpoints'])
                if d['type']=='Switch':self.execute(n,'ip','link','set',port['native'],'master','br0')
                if d['type']!='Router':self.execute(n,'ip','link','set',port['native'],'up' if up else 'down')
        self.evidence['source']={'sha256':self.plan['source_sha256'],'nodes':self.plan['nodes'],'links':self.plan['links'],'warnings':self.plan['warnings']}
        self.record('Validated source applied; management eth0 isolated on every node')
    def ping_pair(self,ok=True):
        source,target=self.pair
        dst=self.plan['nodes'][target]['ip'].split('/')[0]
        r=self.execute(source,'ping','-c','2','-W','1',dst,check=False)
        self.evidence['icmp']={'source':source,'target':dst,'protocol':'ICMPv4','command':['ping','-c','2','-W','1',dst],'expected_success':ok,'exit_code':r.returncode,'observed':r.stdout+r.stderr}
        return (r.returncode==0)==ok
    def capture_routes(self):
        self.evidence['frr-rib']={n:self.show(n,'show ip route') for n,d in self.plan['nodes'].items() if d['type']=='Router'}
        self.evidence['kernel-fib']={n:self.json(n,'ip','-json','route','show') for n in self.plan['nodes']}
    def verify_routes(self,target):
        self.capture_routes()
        for n,d in target['nodes'].items():
            if d['type']!='Router':continue
            rib=self.evidence['frr-rib'][n]
            for route in d['routes']:
                candidates=rib.get(route['prefix'],[])
                if not any(r.get('protocol')=='static' and r.get('distance')==route['distance'] and any(h.get('ip')==route['next_hop'] for h in r.get('nexthops',[])) for r in candidates):return False
        first=target['nodes']['r1']['routes'][0]
        destination=target['nodes']['pc2']['ip'].split('/')[0]
        result=self.execute('r1','ip','-json','route','get',destination,check=False)
        self.evidence['selected-next-hop']={'source':'r1','target':destination,'command':['ip','-json','route','get',destination],'expected':first['next_hop'],'exit_code':result.returncode,'observed':result.stdout+result.stderr}
        return result.returncode==0 and any(r.get('gateway')==first['next_hop'] for r in json.loads(result.stdout))
    def replace_routes(self,target):
        for n,d in self.plan['nodes'].items():
            if d['type']!='Router':continue
            commands=['no ip route {prefix} {next_hop} {distance}'.format(**r) for r in d['routes']]
            commands+=['ip route {prefix} {next_hop} {distance}'.format(**r) for r in target['nodes'][n]['routes']]
            if commands:self.config(n,*commands)
    def verify(self,target,initial_failure):
        if initial_failure:
            self.stable_negative('Original student routing fault blocks real ICMP',lambda:self.ping_pair(False))
            self.capture_routes();self.record('Initial FRR RIB and kernel FIB captured')
            self.replace_routes(target)
        self.wait('CLI/static configuration produces expected FRR routes and kernel next-hop',lambda:self.verify_routes(target))
        self.wait('Real end-to-end ICMP after route configuration',self.ping_pair)
        routers=[n for n,d in target['nodes'].items() if d['type']=='Router'];last=routers[-1]
        reverse=next(r for r in target['nodes'][last]['routes'] if ipaddress.ip_address(target['nodes']['pc1']['ip'].split('/')[0]) in ipaddress.ip_network(r['prefix']))
        self.config(last,'no ip route {prefix} {next_hop} {distance}'.format(**reverse))
        self.stable_negative('Missing return route causes real ICMP failure',lambda:self.ping_pair(False))
        self.capture_routes();self.record('Missing-return RIB/FIB evidence retained')
        self.config(last,'ip route {prefix} {next_hop} {distance}'.format(**reverse))
        self.wait('Return route repair restores traffic',self.ping_pair)
        forward=target['nodes']['r1']['routes'][0];bad={**forward,'next_hop':'10.254.254.254'}
        self.config('r1','no ip route {prefix} {next_hop} {distance}'.format(**forward),'ip route {prefix} {next_hop} {distance}'.format(**bad))
        self.stable_negative('Wrong static next-hop blocks traffic',lambda:self.ping_pair(False))
        self.capture_routes();self.record('Wrong-next-hop RIB/FIB evidence retained')
        self.config('r1','no ip route {prefix} {next_hop} {distance}'.format(**bad),'ip route {prefix} {next_hop} {distance}'.format(**forward))
        self.wait('Next-hop repair restores route selection and real ICMP',lambda:self.verify_routes(target) and self.ping_pair())
        port=next(p['native'] for p in target['nodes']['r1']['ports'].values() if p['address'] and ipaddress.ip_address(forward['next_hop']) in ipaddress.ip_interface(p['address']).network)
        self.config('r1','interface '+port,'shutdown')
        self.stable_negative('FRR interface shutdown blocks forwarding',lambda:self.ping_pair(False))
        self.config('r1','interface '+port,'no shutdown')
        self.wait('FRR no shutdown restores forwarding',lambda:self.verify_routes(target) and self.ping_pair())

def same_wiring(a,b):
    clean=lambda p:{'links':p['links'],'nodes':{n:{k:v for k,v in d.items() if k!='routes'} for n,d in p['nodes'].items()}}
    if clean(a)!=clean(b):raise ValueError('Repair target may change static routes only')
def run_case(source,target,out,label,initial_failure=False,operator=None):
    plan=convert(source);fixed=convert(target);same_wiring(plan,fixed);live=RoutedLive(plan)
    if operator:
        mapping={d['id']:n for n,d in plan['nodes'].items()}
        pair=tuple(mapping.get(identity,identity) for identity in operator['pair'])
        if len(set(pair))!=2 or any(n not in plan['nodes'] or plan['nodes'][n]['type']!='PC' for n in pair):raise ValueError('Select two different mapped PCs')
        live.pair=pair
    report={'kind':'routing','engine':'FRRouting','image':IMAGE,'steps':live.steps,'evidence':live.evidence,'ok':False,'cleanup':False}
    with tempfile.TemporaryDirectory(prefix='aglab-routed-') as tmp:
        folder=pathlib.Path(tmp)/'export';export(plan,folder);lab=folder/'lab.clab.yml';started=False
        try:
            names=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
            if any(n.startswith('clab-'+NAME+'-') for n in names):raise RuntimeError('Pre-existing routed lab; refusing to touch it')
            started=True;report['host_kernel']=live.command(['uname','-r']).stdout.strip();live.command(['containerlab','deploy','-t',str(lab)],240)
            report['image_id']=live.command(['docker','image','inspect',IMAGE,'--format','{{.Id}}']).stdout.strip()
            live.apply()
            if operator:
                if operator['expected']:live.wait('Operator topology: real ICMP expected success',live.ping_pair)
                else:live.stable_negative('Operator topology: real ICMP expected failure',lambda:live.ping_pair(False))
                live.capture_routes();live.record('Operator source FRR RIB and kernel FIB evidence')
                if operator['repair']:
                    live.replace_routes(fixed);live.wait('Operator static-route repair restores real traffic',live.ping_pair)
                    live.capture_routes();live.record('Operator repaired FRR RIB and kernel FIB evidence')
            else:live.verify(fixed,initial_failure)
            report['ok']=True
        except Exception as e:
            report['error']=str(e);print('FAIL',label,e,flush=True)
            if started:
                try:live.capture_routes()
                except Exception:pass
        finally:
            if started:
                result=live.command(['containerlab','destroy','-t',str(lab),'--cleanup'],120,False)
                names=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
                report['cleanup']=result.returncode==0 and not any(n.startswith('clab-'+NAME+'-') for n in names)
            report['ok']=report['ok'] and report['cleanup'];out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True)
            (out/(label+'-results.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report['ok']
def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--execute',action='store_true');p.add_argument('--demo-only',action='store_true');p.add_argument('--topology');p.add_argument('--repair');p.add_argument('--source',default='pc1');p.add_argument('--target',default='pc2');p.add_argument('--expect',choices=['success','failure'],default='success');p.add_argument('--out',default=str(ROOT.parent/'dist'));a=p.parse_args(argv)
    if not a.execute:print('DRY RUN: validated PC/router/access-bridge FRR suite; no processes started');return 0
    if a.topology:
        def load(path):
            path=pathlib.Path(path)
            if path.stat().st_size>2000000:raise ValueError('Topology too large')
            return json.loads(path.read_text(encoding='utf-8'))
        src=load(a.topology);target=load(a.repair) if a.repair else src
        return 0 if run_case(src,target,a.out,'routed-operator',operator={'pair':(a.source,a.target),'expected':a.expect=='success','repair':bool(a.repair)}) else 1
    if a.repair:raise ValueError('--repair requires --topology')
    cases=[(example(n),example(n),f'routed-{n}-routers',False) for n in (2,3)]
    if not a.demo_only:
        for lid in ('AGL-034','AGL-035'):
            path=ROOT.parent/'academy/source'/f'{lid}.json'
            if not path.is_file():raise ValueError('Teacher/source package required for Academy verification; use --demo-only for independent examples')
            lab=json.loads(path.read_text(encoding='utf-8'));cases.append((lab['initial_topology'],lab['target_topology'],'routed-'+lid.lower(),True))
    results=[run_case(src,target,a.out,label,initial) for src,target,label,initial in cases]
    return 0 if all(results) else 1
if __name__=='__main__':raise SystemExit(main())
