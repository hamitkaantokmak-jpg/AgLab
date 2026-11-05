#!/usr/bin/env python3
"""Admin-only real Linux bridge and FRR regression labs; never an HTTP executor."""
import argparse, json, os, pathlib, subprocess, tempfile, time
ROOT=pathlib.Path(__file__).resolve().parent
IMAGE='quay.io/frrouting/frr:containerlab-10.7.1'
NAMES={'l2':'aglab-advanced-l2','routing':'aglab-advanced-routing'}

def topology(kind, folder):
    if kind not in NAMES: raise ValueError('Unknown advanced lab')
    group={'kind':'frr','image':IMAGE,'daemons':['ospfd','bgpd']}
    if kind=='l2':
        nodes={n:{'group':'switches'} for n in ('s1','s2','s3')}
        nodes.update({n:{'kind':'linux','image':'alpine:3.20'} for n in ('pc1','pc2')})
        edges=[('s1:eth1','s2:eth1'),('s2:eth2','s3:eth1'),('s1:eth2','s3:eth2'),('pc1:eth1','s1:eth3'),('pc2:eth1','s3:eth3'),('pc2:eth2','s2:eth4')]
        return {'name':NAMES[kind],'topology':{'groups':{'switches':group},'nodes':nodes,'links':[{'endpoints':list(e)} for e in edges]}}
    nodes={}
    addresses={1:[('eth1','192.168.10.1/24'),('eth2','10.0.12.1/24'),('eth3','10.0.13.1/24')],2:[('eth2','10.0.12.2/24'),('eth3','10.0.23.2/24')],3:[('eth1','192.168.20.1/24'),('eth2','10.0.23.3/24'),('eth3','10.0.13.3/24')]}
    for i,interfaces in addresses.items():
        lines=['frr defaults traditional',f'hostname r{i}','service integrated-vtysh-config']
        for port,ip in interfaces:
            lines.extend([f'interface {port}',f' ip address {ip}',' no shutdown'])
            if port!='eth1':lines.extend([' ip ospf network point-to-point',' ip ospf hello-interval 1',' ip ospf dead-interval 3',' ip ospf cost 10'])
            lines.append('!')
        lines.extend(['router ospf',f' ospf router-id {i}.{i}.{i}.{i}',' network 10.0.0.0/8 area 0',' network 192.168.0.0/16 area 0','!'])
        config=folder/f'r{i}.conf';config.write_text('\n'.join(lines)+'\n',encoding='utf-8')
        nodes[f'r{i}']={'group':'routers','startup-config':str(config)}
    for i in (1,2):
        subnet=10 if i==1 else 20
        nodes[f'pc{i}']={'kind':'linux','image':'alpine:3.20','exec':[f'ip addr add 192.168.{subnet}.10/24 dev eth1','ip link set eth1 up',f'ip route add default via 192.168.{subnet}.1']}
    edges=[('r1:eth2','r2:eth2'),('r2:eth3','r3:eth2'),('r1:eth3','r3:eth3'),('pc1:eth1','r1:eth1'),('pc2:eth1','r3:eth1')]
    return {'name':NAMES[kind],'topology':{'groups':{'routers':group},'nodes':nodes,'links':[{'endpoints':list(e)} for e in edges]}}

def records(value):
    if isinstance(value,dict):
        yield value
        for v in value.values():yield from records(v)
    elif isinstance(value,list):
        for v in value:yield from records(v)

class Live:
    def __init__(self, kind, runner=subprocess.run, sleeper=time.sleep):
        self.kind=kind;self.name=NAMES[kind];self.runner=runner;self.sleeper=sleeper;self.steps=[];self.evidence={}
    def command(self,args,timeout=30,check=True):
        r=self.runner(args,capture_output=True,text=True,timeout=timeout,check=False)
        if check and r.returncode:raise RuntimeError('Command failed: '+' '.join(args)+'\n'+r.stdout+r.stderr)
        return r
    def execute(self,node,*args,check=True):
        allowed={'l2':{'s1','s2','s3','pc1','pc2'},'routing':{'r1','r2','r3','pc1','pc2'}}
        if node not in allowed[self.kind]:raise ValueError('Unknown node')
        return self.command(['docker','exec',f'clab-{self.name}-{node}',*args],check=check)
    def json(self,node,*args):return json.loads(self.execute(node,*args).stdout)
    def vty(self,node,*commands):
        args=['vtysh']
        for cmd in commands:args.extend(['-c',cmd])
        return self.execute(node,*args).stdout
    def config(self,node,*commands):return self.vty(node,'configure terminal',*commands,'end')
    def show(self,node,cmd):return json.loads(self.vty(node,cmd+' json'))
    def wait(self,label,fn,timeout=35):
        deadline=time.monotonic()+timeout;last=None
        while time.monotonic()<deadline:
            try:
                last=fn()
                if last:self.record(label);return last
            except (RuntimeError,ValueError,KeyError) as error:last=str(error)
            self.sleeper(1)
        raise AssertionError(label+' timed out; last='+str(last))
    def stable_negative(self,label,fn):
        # A single empty sample during reconvergence is insufficient negative evidence.
        self.sleeper(4)
        values=[bool(fn()) for _ in range(3)]
        if not all(values):raise AssertionError(label+': condition did not remain negative')
        self.record(label)
    def record(self,label):
        self.steps.append({'name':label,'ok':True,'origin':'native-command-check','time_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'evidence':json.loads(json.dumps(self.evidence))})
        print('PASS',self.kind,label,flush=True)
    def ping(self,ok=True):
        target='192.168.20.10' if self.kind=='routing' else '10.0.0.2'
        result=self.execute('pc1','ping','-c','2','-W','1',target,check=False)
        self.evidence['icmp']={'exit_code':result.returncode,'output':result.stdout+result.stderr}
        return (result.returncode==0)==ok
    def route(self,protocol,via=None,prefix='192.168.20.0/24'):
        data=self.show('r1','show ip route '+prefix)
        self.evidence['route-'+protocol]=data
        return any(r.get('protocol')==protocol and (r.get('distance')==(110 if protocol=='ospf' else 20)) and (not via or any(n.get('ip')==via for n in r.get('nexthops',[]))) for r in records(data))
    def full(self,node,router_id=None):
        data=self.show(node,'show ip ospf neighbor');self.evidence['ospf-'+node]=data
        neighbors=data.get('neighbors',data)
        values=neighbors.get(router_id,[]) if router_id else neighbors
        return any(str(r.get('nbrState',r.get('state',''))).startswith('Full') for r in records(values))
    def bgp_up(self,node,ip):
        data=self.show(node,'show bgp ipv4 unicast summary');self.evidence['bgp-'+node]=data
        return any(isinstance(r.get(ip),dict) and r[ip].get('state')=='Established' for r in records(data))
    def routing(self):
        self.wait('OSPF neighbors and AD110 route',lambda:self.full('r1','2.2.2.2') and self.full('r1','3.3.3.3') and self.route('ospf','10.0.13.3'))
        self.wait('OSPF real ICMP',self.ping)
        self.config('r2','interface eth2','ip ospf area 1')
        self.stable_negative('OSPF area mismatch blocks adjacency',lambda:not self.full('r1','2.2.2.2'))
        self.config('r2','interface eth2','no ip ospf area 1')
        self.wait('OSPF area repair',lambda:self.full('r1','2.2.2.2'))
        # Isolate the two-router adjacency, so the collision assertion cannot pass on another link.
        self.config('r1','interface eth3','shutdown');self.config('r2','interface eth3','shutdown')
        self.config('r2','router ospf','ospf router-id 1.1.1.1');self.vty('r2','clear ip ospf process')
        self.stable_negative('OSPF duplicate router-ID blocks isolated pair',lambda:not self.full('r1'))
        self.config('r2','router ospf','ospf router-id 2.2.2.2');self.vty('r2','clear ip ospf process')
        self.wait('OSPF router-ID repair',lambda:self.full('r1','2.2.2.2'))
        self.config('r2','interface eth3','no shutdown')
        self.wait('OSPF link failure selects alternate next-hop',lambda:self.route('ospf','10.0.12.2') and self.ping())
        self.config('r3','router ospf','no network 192.168.0.0/16 area 0')
        self.stable_negative('OSPF withdrawal removes destination route',lambda:not self.route('ospf'))
        self.config('r3','router ospf','network 192.168.0.0/16 area 0')
        self.config('r1','interface eth3','no shutdown')
        self.wait('OSPF restoration',lambda:self.route('ospf','10.0.13.3') and self.ping())
        for i in (1,2,3):self.config(f'r{i}','no router ospf')
        peers={1:[('10.0.12.2',65002),('10.0.13.3',65003)],2:[('10.0.12.1',65001),('10.0.23.3',65003)],3:[('10.0.13.1',65001),('10.0.23.2',65002)]}
        for i in (1,2,3):
            cmds=[f'router bgp {65000+i}',f'bgp router-id {i}.{i}.{i}.{i}','no bgp ebgp-requires-policy']
            for ip,asn in peers[i]:cmds.extend([f'neighbor {ip} remote-as {asn}',f'neighbor {ip} timers 1 3'])
            if i in (1,3):cmds.extend(['address-family ipv4 unicast','network 192.168.'+('10' if i==1 else '20')+'.0/24'])
            self.config(f'r{i}',*cmds)
        self.wait('BGP established and AD20 direct route',lambda:self.bgp_up('r1','10.0.13.3') and self.bgp_up('r1','10.0.12.2') and self.bgp_up('r2','10.0.23.3') and self.route('bgp','10.0.13.3'),60)
        self.wait('BGP real ICMP',self.ping)
        self.config('r1','router bgp 65001','neighbor 10.0.13.3 remote-as 65199')
        self.stable_negative('BGP wrong remote-AS blocks session',lambda:not self.bgp_up('r1','10.0.13.3'))
        self.wait('BGP alternate path via r2',lambda:self.route('bgp','10.0.12.2') and self.ping())
        self.config('r1','router bgp 65001','neighbor 10.0.13.3 remote-as 65003')
        self.wait('BGP AS repair selects shorter direct path',lambda:self.bgp_up('r1','10.0.13.3') and self.route('bgp','10.0.13.3'),60)
        self.config('r3','router bgp 65003','address-family ipv4 unicast','no network 192.168.20.0/24')
        self.stable_negative('BGP withdrawal removes all destination paths',lambda:not self.route('bgp'))
        self.config('r3','router bgp 65003','address-family ipv4 unicast','network 192.168.20.0/24')
        self.wait('BGP prefix restoration',lambda:self.route('bgp','10.0.13.3') and self.ping())

    def vlan(self,node,port,vid,pvid=False,delete=False):
        return self.execute(node,'bridge','vlan','del' if delete else 'add','dev',port,'vid',str(vid),*(['pvid','untagged'] if pvid and not delete else []))
    def access(self,node,port,vid):
        for old in (1,10,20):self.execute(node,'bridge','vlan','del','dev',port,'vid',str(old),check=False)
        self.vlan(node,port,vid,True)
    def state(self,node):
        data=self.json(node,'bridge','-json','link','show');self.evidence['bridge-ports-'+node]=data;return data
    def fdb(self,node,mac,port=None):
        data=self.json(node,'bridge','-json','fdb','show','br','br0');self.evidence['fdb-'+node]=data
        return any(r.get('mac')==mac and (not port or r.get('ifname',r.get('dev'))==port) for r in data)
    def l2(self):
        ports={'s1':['eth1','eth2','eth3'],'s2':['eth1','eth2','eth4'],'s3':['eth1','eth2','eth3']}
        for index,(node,members) in enumerate(ports.items(),1):
            # iproute2/netlink bridge timers use USER_HZ units (centiseconds), not seconds.
            self.execute(node,'ip','link','add','br0','type','bridge','vlan_filtering','1','stp_state','1','priority',str(index*4096),'forward_delay','400','hello_time','100','max_age','600')
            self.execute(node,'ip','link','set','br0','up')
            for port in members:
                self.execute(node,'ip','link','set',port,'master','br0');self.execute(node,'ip','link','set',port,'up')
                if port in ('eth3','eth4'):self.access(node,port,10)
                else:
                    for vid in (10,20):self.vlan(node,port,vid)
        for i in (1,2):
            self.execute(f'pc{i}','ip','link','set','eth1','address',f'02:00:00:00:00:0{i}')
            self.execute(f'pc{i}','ip','addr','add',f'10.0.0.{i}/24','dev','eth1');self.execute(f'pc{i}','ip','link','set','eth1','up')
        self.execute('pc2','ip','link','set','eth2','down')
        def converged():
            states={n:self.state(n) for n in ports};self.evidence['stp-initial']=states
            blocked=[(n,r['ifname']) for n,rows in states.items() for r in rows if r.get('state')=='blocking']
            return blocked if len(blocked)==1 and self.ping() else False
        blocked=self.wait('kernel STP blocks exactly one redundant port; ICMP forwards',converged,45)
        root=self.execute('s1','cat','/sys/class/net/br0/bridge/bridge_id').stdout.strip()
        for node in ports:
            actual=self.execute(node,'cat','/sys/class/net/br0/bridge/root_id').stdout.strip()
            if actual!=root:raise AssertionError('Unexpected STP root on '+node)
        self.evidence['root_bridge']=root;self.record('kernel root bridge is s1')
        self.wait('VLAN-scoped MAC learning',lambda:self.fdb('s1','02:00:00:00:00:02') and self.fdb('s3','02:00:00:00:00:02','eth3'))
        self.access('s3','eth3',20);self.stable_negative('VLAN access isolation',lambda:self.ping(False));self.access('s3','eth3',10)
        self.wait('VLAN access repair',self.ping)
        for port in ('eth1','eth2'):self.vlan('s1',port,10,delete=True)
        self.stable_negative('allowed VLAN removal blocks both trunk exits',lambda:self.ping(False))
        for port in ('eth1','eth2'):self.vlan('s1',port,10)
        self.wait('allowed VLAN restoration',self.ping)
        self.execute('s1','ip','link','set','eth2','down');self.execute('s3','ip','link','set','eth2','down')
        self.wait('STP alternate path forwards after direct cable down',lambda:all(any(r['ifname']==p and r.get('state')=='forwarding' for r in self.state(n)) for n,p in blocked) and self.ping(),45)
        self.evidence['stp-after-failure']={n:self.state(n) for n in ports}
        self.execute('s3','ip','link','set','eth3','down')
        self.wait('port shutdown flushes destination FDB',lambda:not self.fdb('s3','02:00:00:00:00:02','eth3'))
        self.execute('s3','ip','link','set','eth3','up');self.wait('port recovery',self.ping)
        self.execute('pc2','ip','link','set','eth1','down');self.execute('pc2','ip','addr','del','10.0.0.2/24','dev','eth1')
        self.execute('pc2','ip','link','set','eth2','address','02:00:00:00:00:02');self.execute('pc2','ip','addr','add','10.0.0.2/24','dev','eth2');self.execute('pc2','ip','link','set','eth2','up')
        self.wait('source MAC moves to another physical switch port',lambda:self.ping() and self.fdb('s3','02:00:00:00:00:02','eth1'))
        self.execute('pc2','ip','link','set','eth2','down');self.execute('pc2','ip','addr','del','10.0.0.2/24','dev','eth2');self.execute('pc2','ip','addr','add','10.0.0.2/24','dev','eth1');self.execute('pc2','ip','link','set','eth1','up')
        # Force the direct s1-s3 wire so native-VLAN testing cannot escape via the triangle.
        self.execute('s1','ip','link','set','eth1','down');self.execute('s1','ip','link','set','eth2','up');self.execute('s3','ip','link','set','eth2','up')
        for n in ('s1','s3'):
            self.access(n,'eth3',20);self.access(n,'eth2',20);self.vlan(n,'eth2',10)
        self.wait('matching native VLAN20 forwards untagged frames',self.ping,45)
        self.access('s3','eth2',10);self.vlan('s3','eth2',20)
        self.stable_negative('native VLAN mismatch blocks intended VLAN20',lambda:self.ping(False))
        self.access('s3','eth2',20);self.vlan('s3','eth2',10)
        self.wait('native VLAN repair',self.ping)

def main(argv=None):
    p=argparse.ArgumentParser();p.add_argument('kind',choices=NAMES);p.add_argument('--execute',action='store_true');p.add_argument('--out',default=str(ROOT.parent/'dist'));a=p.parse_args(argv)
    if not a.execute:print('DRY RUN: separate admin-only real lab',NAMES[a.kind]);return 0
    live=Live(a.kind);out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True);report={'kind':a.kind,'engine':'Linux kernel bridge' if a.kind=='l2' else 'FRRouting','image':IMAGE,'steps':live.steps,'evidence':live.evidence,'ok':False,'cleanup':False}
    with tempfile.TemporaryDirectory(prefix='aglab-advanced-') as tmp:
        folder=pathlib.Path(tmp);target=folder/'advanced.clab.yml';target.write_text(json.dumps(topology(a.kind,folder)),encoding='utf-8');started=False
        try:
            names=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
            if any(n.startswith('clab-'+live.name+'-') for n in names):raise RuntimeError('Refusing pre-existing advanced lab; no cleanup performed')
            report['host_kernel']=live.command(['uname','-r']).stdout.strip();started=True
            live.command(['containerlab','deploy','-t',str(target)],240)
            report['image_id']=live.command(['docker','image','inspect',IMAGE,'--format','{{.Id}}']).stdout.strip()
            (live.l2 if a.kind=='l2' else live.routing)();report['ok']=True
        except Exception as error:
            report['error']=str(error);print('FAIL',error,flush=True)
            if started and a.kind=='routing':
                for node in ('r1','r2','r3'):
                    for cmd in ('show running-config','show interface brief','show ip ospf interface','show ip ospf neighbor','show ip route'):
                        try:report['evidence'][node+' '+cmd]=live.vty(node,cmd)
                        except Exception as diagnostic:report['evidence'][node+' '+cmd]=str(diagnostic)
        finally:
            if started:
                result=live.command(['containerlab','destroy','-t',str(target),'--cleanup'],120,False)
                remaining=live.command(['docker','ps','-a','--format','{{.Names}}']).stdout.splitlines()
                report['cleanup']=result.returncode==0 and not any(n.startswith('clab-'+live.name+'-') for n in remaining)
            if not report['cleanup']:report['ok']=False
            (out/f'advanced-{a.kind}-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return 0 if report['ok'] else 1
if __name__=='__main__':raise SystemExit(main())
