#!/usr/bin/env python3
"""Operator-only execution of validated shared topology; no network service."""
import argparse, copy, json, pathlib, tempfile
from advanced_smoke import Live, IMAGE
from shared_topology import convert, export, NAME
ROOT=pathlib.Path(__file__).resolve().parent

class SharedLive(Live):
    def __init__(self,plan):
        super().__init__('l2');self.name=NAME;self.plan=plan
    def execute(self,node,*args,check=True):
        if node not in self.plan['nodes']:raise ValueError('Unknown node')
        return self.command(['docker','exec',f'clab-{self.name}-{node}',*args],check=check)
    def apply(self):
        for n,d in self.plan['nodes'].items():
            if d['type']=='Switch':
                self.execute(n,'ip','link','add','br0','type','bridge','vlan_filtering','1','stp_state','0')
                self.execute(n,'ip','link','set','br0','up')
            else:
                # Data-plane tests cannot accidentally leave through the management network.
                self.execute(n,'ip','route','del','default',check=False)
                self.execute(n,'ip','link','set','eth1','address',d['mac'])
                self.execute(n,'ip','addr','add',d['ip'],'dev','eth1')
        for l in self.plan['links']:
            for end in l['endpoints']:
                n,p=end.split(':');d=self.plan['nodes'][n]
                c=next(c for c in d['ports'].values() if c['native']==p)
                if d['type']=='Switch':
                    self.execute(n,'ip','link','set',p,'master','br0')
                    self.execute(n,'bridge','vlan','del','dev',p,'vid','1',check=False)
                    if c['mode']=='access':self.vlan(n,p,c['vlan'],True)
                    else:
                        for v in c['allowed']:self.vlan(n,p,v,v==c['nativeVlan'])
                self.execute(n,'ip','link','set',p,'up' if l['up'] and c['enabled'] else 'down')
        self.evidence['configuration']={'source_sha256':self.plan['source_sha256'],'nodes':self.plan['nodes'],'links':self.plan['links'],'warnings':self.plan['warnings']}
    def ping_pair(self,a,b,ok=True):
        target=self.plan['nodes'][b]['ip'].split('/')[0]
        r=self.execute(a,'ping','-c','2','-W','1',target,check=False)
        self.evidence['icmp']={'source':a,'target':target,'expected_success':ok,'exit_code':r.returncode,'output':r.stdout+r.stderr}
        return (r.returncode==0)==ok
    def verify(self,initial_failure=False):
        a,b='pc1',('pc3' if 'pc3' in self.plan['nodes'] else 'pc2')
        if initial_failure:
            self.stable_negative('AGL-024 initial access uplinks: expected ICMP failure',lambda:self.ping_pair(a,b,False))
            for l in self.plan['links']:
                if all(self.plan['nodes'][e.split(':')[0]]['type']=='Switch' for e in l['endpoints']):
                    for end in l['endpoints']:
                        n,p=end.split(':');self.execute(n,'bridge','vlan','del','dev',p,'vid','1',check=False)
                        for v in (10,20):self.vlan(n,p,v)
            self.wait('AGL-024 operator trunk repair restores VLAN10 ICMP',lambda:self.ping_pair(a,b))
            self.wait('AGL-024 VLAN20 also crosses repaired trunk',lambda:self.ping_pair('pc2','pc4'))
            return
        self.wait('Shared JSON VLAN10 trunk forwards actual ICMP',lambda:self.ping_pair(a,b))
        pc_link=next(l for l in self.plan['links'] if any(e.startswith(b+':') for e in l['endpoints']))
        n,p=next(e for e in pc_link['endpoints'] if not e.startswith(b+':')).split(':')
        self.access(n,p,20);self.stable_negative('Wrong access VLAN blocks shared topology',lambda:self.ping_pair(a,b,False))
        self.access(n,p,10);self.wait('Access VLAN repair restores ICMP',lambda:self.ping_pair(a,b))
        trunk=next(l for l in self.plan['links'] if all(self.plan['nodes'][e.split(':')[0]]['type']=='Switch' for e in l['endpoints']))
        n,p=trunk['endpoints'][0].split(':');self.vlan(n,p,10,delete=True)
        self.stable_negative('Trunk allowed VLAN removal blocks ICMP',lambda:self.ping_pair(a,b,False))
        self.vlan(n,p,10);self.wait('Allowed VLAN repair restores ICMP',lambda:self.ping_pair(a,b))
        self.evidence['vlan-tables']={n:self.json(n,'bridge','-json','vlan','show') for n,d in self.plan['nodes'].items() if d['type']=='Switch'}
        self.record('Actual kernel VLAN membership captured')

def run_case(t,out,label,initial_failure=False,pair=None,expected=True):
    plan=convert(t);live=SharedLive(plan)
    report={'kind':'l2','engine':'Linux kernel bridge','image':IMAGE,'steps':live.steps,'evidence':live.evidence,'ok':False,'cleanup':False}
    with tempfile.TemporaryDirectory(prefix='aglab-shared-') as tmp:
        folder=pathlib.Path(tmp)/'export';export(plan,folder);target=folder/'lab.clab.yml';started=False
        try:
            names=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
            if any(n.startswith('clab-'+NAME+'-') for n in names):raise RuntimeError('Pre-existing shared lab; refusing to touch it')
            started=True;report['host_kernel']=live.command(['uname','-r']).stdout.strip()
            live.command(['containerlab','deploy','-t',str(target)],240)
            report['image_id']=live.command(['docker','image','inspect',IMAGE,'--format','{{.Id}}']).stdout.strip()
            live.apply()
            if pair:
                a,b=pair
                if any(n not in plan['nodes'] or plan['nodes'][n]['type']!='PC' for n in pair) or a==b:raise ValueError('Select two different mapped PCs')
                if expected:live.wait('Operator topology: expected ICMP success',lambda:live.ping_pair(a,b))
                else:live.stable_negative('Operator topology: expected ICMP failure',lambda:live.ping_pair(a,b,False))
            else:live.verify(initial_failure)
            report['ok']=True
        except Exception as e:report['error']=str(e);print('FAIL',e,flush=True)
        finally:
            if started:
                result=live.command(['containerlab','destroy','-t',str(target),'--cleanup'],120,False)
                names=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
                report['cleanup']=result.returncode==0 and not any(n.startswith('clab-'+NAME+'-') for n in names)
            report['ok']=report['ok'] and report['cleanup'];out.mkdir(parents=True,exist_ok=True)
            (out/(label+'-results.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report['ok']
def main():
    p=argparse.ArgumentParser();p.add_argument('--execute',action='store_true');p.add_argument('--out',default=str(ROOT.parent/'dist'));p.add_argument('--topology');p.add_argument('--source',default='pc1');p.add_argument('--target',default='pc2');p.add_argument('--expect',choices=['success','failure'],default='success');a=p.parse_args()
    if not a.execute:print('DRY RUN: operator-only shared topology suite');return 0
    if a.topology:
        source=pathlib.Path(a.topology)
        if source.stat().st_size>2000000:raise ValueError('Topology too large')
        return 0 if run_case(json.loads(source.read_text(encoding='utf-8')),pathlib.Path(a.out),'shared-operator',pair=(a.source,a.target),expected=a.expect=='success') else 1
    example=json.loads((ROOT/'examples/shared-vlan10.aglab.json').read_text(encoding='utf-8'))
    academy=json.loads((ROOT.parent/'academy/student/AGL-024.json').read_text(encoding='utf-8'))['initial_topology']
    results=[run_case(example,pathlib.Path(a.out),'shared-vlan10'),run_case(academy,pathlib.Path(a.out),'shared-agl024',True)]
    return 0 if all(results) else 1
if __name__=='__main__':raise SystemExit(main())
