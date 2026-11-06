#!/usr/bin/env python3
"""Explicit operator-only Linux nftables ACL/SNAT/PAT acceptance; no Internet path."""
import argparse,copy,json,os,pathlib,select,subprocess,sys,time,uuid
ROOT=pathlib.Path(__file__).resolve().parent
TOPOLOGY={'nodes':{'r1':{'type':'Linux router'},'c1':{'ip':'10.10.1.2/24','gateway':'10.10.1.1'},'c2':{'ip':'10.10.2.2/24','gateway':'10.10.2.1'},'srv':{'ip':'198.18.0.2/24'}},'links':[['c1','r1','10.10.1.1/24'],['c2','r1','10.10.2.1/24'],['srv','r1','198.18.0.1/24']]}

def denied(probe,protocol):
    return probe['returncode']==1 if protocol=='icmp' else probe['returncode']==2 and probe['result'].get('error_type')=='TimeoutError'

class Lab:
    def __init__(self,scenario):
        if scenario not in ('acl','nat'):raise ValueError('Unknown lab')
        self.scenario=scenario;self.prefix='aglab-sec-'+uuid.uuid4().hex[:10]+'-'
        self.names={n:self.prefix+n for n in ('r1','c1','c2','srv')};self.created=[];self.server=None;self.steps=[];self.evidence={'topology':copy.deepcopy(TOPOLOGY)};self.table=False
    def command(self,args,check=True,input=None,timeout=15):
        result=subprocess.run(args,input=input,capture_output=True,text=True,timeout=timeout,check=False)
        if check and result.returncode:raise RuntimeError('Command failed: '+json.dumps(args)+'\n'+result.stdout+result.stderr)
        return result
    def ns(self,node,*args,**kw):
        if node not in self.names:raise ValueError('Unknown namespace')
        return self.command(['ip','netns','exec',self.names[node],*args],**kw)
    def record(self,label):
        self.steps.append({'name':label,'ok':True,'origin':'native-command-check','time_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'evidence':copy.deepcopy(self.evidence)})
        print('PASS',self.scenario,label,flush=True)
    def setup(self):
        existing=self.command(['ip','netns','list']).stdout.splitlines()
        if any(line.split()[0] in self.names.values() for line in existing if line.split()):raise RuntimeError('Pre-existing namespace; refusing to touch it')
        for n,name in self.names.items():
            self.command(['ip','netns','add',name]);self.created.append(n)
            self.ns(n,'ip','link','set','lo','up')
        for n,router_port in [('c1','in1'),('c2','in2'),('srv','out')]:
            router_ip=next(l[2] for l in TOPOLOGY['links'] if l[0]==n)
            self.ns('r1','ip','link','add',router_port,'type','veth','peer','name','peer')
            self.ns('r1','ip','link','set','peer','netns',self.names[n])
            self.ns(n,'ip','link','set','peer','name','eth1')
            for node,port,ip in [('r1',router_port,router_ip),(n,'eth1',TOPOLOGY['nodes'][n]['ip'])]:
                self.ns(node,'ip','addr','add',ip,'dev',port);self.ns(node,'ip','link','set',port,'up')
            if n!='srv':self.ns(n,'ip','route','add','default','via',TOPOLOGY['nodes'][n]['gateway'])
        self.ns('r1','sysctl','-w','net.ipv4.ip_forward=1')
        if self.scenario=='acl':
            for network in ('10.10.1.0/24','10.10.2.0/24'):self.ns('srv','ip','route','add',network,'via','198.18.0.1')
        # No root namespace veth, physical link, Docker management network or server default route.
        self.evidence['kernel']=self.command(['uname','-r']).stdout.strip()
        self.evidence['nft-version']=self.ns('r1','nft','--version').stdout.strip()
        self.evidence['routes']={n:self.ns(n,'ip','-json','route','show').stdout for n in self.names}
        for n in ('r1','srv'):
            if any(r.get('dst')=='default' for r in json.loads(self.evidence['routes'][n])):raise AssertionError('Unexpected external route')
        args=['ip','netns','exec',self.names['srv'],sys.executable,str(ROOT/'socket_peer.py'),'serve']
        self.server=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if not select.select([self.server.stdout],[],[],5)[0]:raise RuntimeError('Socket server readiness timed out')
        ready=self.server.stdout.readline()
        if not json.loads(ready).get('ready'):raise RuntimeError('Socket server failed')
        self.evidence['socket-server']={'command':args,'observed':ready};self.record('Isolated namespaces and real TCP/UDP server ready')
    def clear_sessions(self):
        output=self.ns('r1','conntrack','-F').stdout
        count=self.ns('r1','conntrack','-C').stdout.strip()
        if count!='0':raise AssertionError('Conntrack not empty after flush: '+count)
        self.evidence['session-reset']={'command':['conntrack','-F'],'output':output,'remaining':count}
    def rules(self,text,family='inet'):
        if self.table:self.ns('r1','nft','delete','table',self.family,'aglab');self.table=False
        self.clear_sessions();self.ns('r1','nft','-f','-',input=text);self.table=True;self.family=family
        self.evidence['applied-rules']={'command':['nft','-f','-'],'stdin':text}
    def acl_rules(self,rules):
        self.rules('table inet aglab { chain forward { type filter hook forward priority filter; policy drop; ct state established,related counter accept comment "return"; '+rules+' counter drop comment "fallback"; }\n}\n')
    def nat_rules(self,mode):
        if mode not in ('snat','pat','wrong'):raise ValueError('Unknown NAT mode')
        source='10.10.99.0/24' if mode=='wrong' else '{ 10.10.1.0/24, 10.10.2.0/24 }'
        translated='198.18.0.1:40000-40010' if mode=='pat' else '198.18.0.1'
        transport='meta l4proto { tcp, udp } ' if mode=='pat' else ''
        return 'table ip aglab { chain postrouting { type nat hook postrouting priority srcnat; policy accept; ip saddr '+source+' oifname "out" '+transport+'counter snat to '+translated+' comment "translate"; }\n}\n'
    def counters(self):
        data=json.loads(self.ns('r1','nft','-j','list','ruleset').stdout);self.evidence['nft-ruleset']=data
        counts={}
        for entry in data['nftables']:
            rule=entry.get('rule',{})
            for expr in rule.get('expr',[]):
                if 'counter' in expr:counts[rule.get('comment','')]=expr['counter']['packets']
        return counts
    def probe(self,node,protocol='icmp',port=None,ok=True,counter=None,source_port=0,peer_ip=None,expected_error=None):
        if protocol=='icmp':args=['ping','-c','1','-W','1','198.18.0.2']
        else:args=[sys.executable,str(ROOT/'socket_peer.py'),'request','--protocol',protocol,'--port',str(port),'--source-port',str(source_port),'--token',uuid.uuid4().hex]
        r=self.ns(node,*args,check=False);result={} if protocol=='icmp' else json.loads(r.stdout)
        probe={'device':node,'source':TOPOLOGY['nodes'][node]['ip'],'target':'198.18.0.2','port':port,'protocol':protocol,'command':args,'expected_success':ok,'expected_error':expected_error,'returncode':r.returncode,'result':result,'observed':r.stdout+r.stderr}
        self.evidence['traffic']=probe;counts=self.counters();self.evidence['counters']=counts
        if ok:matched=r.returncode==0
        elif expected_error:matched=r.returncode==2 and result.get('error_type')==expected_error
        else:matched=denied(probe,protocol)
        if not matched:raise AssertionError('Unexpected real traffic result: '+json.dumps(probe))
        if counter and counts.get(counter,0)<1:raise AssertionError('No matching real packet counter: '+counter)
        if ok and peer_ip and result.get('peer_ip')!=peer_ip:raise AssertionError('Server observed wrong source: '+json.dumps(result))
        self.record(('Allow' if ok else 'Deny')+' '+node+' '+protocol+((':'+str(port)) if port else '')+((' / '+counter) if counter else ''))
        return result
    def acl(self):
        allow='counter accept comment "permit";'
        self.acl_rules(allow)
        for n in ('c1','c2'):
            self.probe(n);self.probe(n,'tcp',8000,peer_ip=TOPOLOGY['nodes'][n]['ip'].split('/')[0]);self.probe(n,'udp',8001)
        self.probe('c1','tcp',8999,False,'permit',expected_error='ConnectionRefusedError')
        self.probe('c1','udp',8999,False,'permit',expected_error='ConnectionRefusedError')
        self.acl_rules('ip saddr 10.10.1.2 counter accept comment "source-permit";')
        self.probe('c1',counter='source-permit');self.probe('c2',ok=False,counter='fallback')
        self.acl_rules('ip saddr 10.10.1.2 counter drop comment "source-block"; '+allow)
        self.probe('c1','tcp',8000,False,'source-block');self.probe('c2','tcp',8000)
        self.acl_rules('ip daddr 198.18.0.2 counter drop comment "destination-block"; '+allow)
        self.probe('c1',ok=False,counter='destination-block')
        self.acl_rules('ip saddr 10.10.1.0/24 ip daddr 198.18.0.0/24 counter accept comment "combined";')
        self.probe('c1',counter='combined');self.probe('c2',ok=False,counter='fallback')
        self.acl_rules('tcp dport 8000 counter accept comment "tcp-permit"; tcp dport 8002 counter drop comment "tcp-block"; udp dport 8001 counter drop comment "udp-block"; udp dport 8003 counter accept comment "udp-permit";')
        self.probe('c1','tcp',8000,True,'tcp-permit');self.probe('c1','tcp',8002,False,'tcp-block')
        self.probe('c1','udp',8001,False,'udp-block');self.probe('c1','udp',8003,True,'udp-permit')
        self.acl_rules('ip protocol icmp counter drop comment "icmp-block"; '+allow)
        self.probe('c1',ok=False,counter='icmp-block');self.probe('c1','tcp',8000)
        wrong='ip saddr 10.10.1.2 counter drop comment "misordered"; '
        self.acl_rules(wrong+allow);self.probe('c1',ok=False,counter='misordered')
        self.acl_rules(allow+wrong);self.probe('c1',counter='permit');self.record('Reordering repairs the incorrect source deny before permit')
        self.acl_rules(wrong+allow);self.probe('c1',ok=False,counter='misordered')
        rules=json.loads(self.ns('r1','nft','-j','list','chain','inet','aglab','forward').stdout)
        handle=next(x['rule']['handle'] for x in rules['nftables'] if x.get('rule',{}).get('comment')=='misordered')
        self.ns('r1','nft','delete','rule','inet','aglab','forward','handle',str(handle));self.clear_sessions()
        self.probe('c1',counter='permit');self.record('Removing offending ACL rule restores real communication')
    def nat(self):
        self.rules(self.nat_rules('wrong'),'ip')
        self.probe('c1','tcp',8000,False);self.probe('c2','udp',8001,False)
        if self.counters().get('translate')!=0:raise AssertionError('Wrong-source rule unexpectedly matched')
        self.record('Incorrect NAT source selector fails real traffic with zero NAT matches')
        self.rules(self.nat_rules('snat'),'ip')
        for n in ('c1','c2'):
            self.probe(n,'tcp',8000,True,'translate',peer_ip='198.18.0.1');self.probe(n,'udp',8001,True,'translate',peer_ip='198.18.0.1')
        self.record('SNAT repair: two clients share real external IP observed at target')
        self.rules(self.nat_rules('pat'),'ip')
        for protocol,port in [('tcp',8000),('udp',8001)]:
            replies=[self.probe(n,protocol,port,True,'translate',source_port=35000,peer_ip='198.18.0.1') for n in ('c1','c2')]
            ports=[r['peer_port'] for r in replies]
            if len(set(ports))!=2 or not all(40000<=p<=40010 for p in ports):raise AssertionError('PAT port collision/range failure: '+str(ports))
            self.evidence['pat']={'original_source_port':35000,'server_observations':replies}
            conntrack=self.ns('r1','conntrack','-L','-p',protocol,'-o','extended').stdout
            self.evidence['conntrack']={'command':['conntrack','-L','-p',protocol,'-o','extended'],'observed':conntrack}
            if not all(('src='+TOPOLOGY['nodes'][n]['ip'].split('/')[0]) in conntrack for n in ('c1','c2')) or 'dst=198.18.0.1' not in conntrack:raise AssertionError('Missing original/translated conntrack tuples')
            self.record(protocol.upper()+' PAT: same original port, distinct translated ports and actual conntrack tuples')
        self.ns('r1','nft','delete','table','ip','aglab');self.table=False;self.clear_sessions()
        self.probe('c1','tcp',8000,False);self.probe('c2','udp',8001,False)
        self.record('NAT removal plus session flush blocks real return traffic')
        self.rules(self.nat_rules('snat'),'ip')
        self.probe('c1','tcp',8000,True,'translate',peer_ip='198.18.0.1');self.probe('c2','udp',8001,True,'translate',peer_ip='198.18.0.1')
        self.clear_sessions();self.record('NAT restored; TCP/UDP replies return and session state is explicitly cleared')
    def cleanup(self):
        errors=[]
        if self.server:
            try:
                self.server.terminate()
                try:self.server.wait(timeout=3)
                except subprocess.TimeoutExpired:self.server.kill();self.server.wait(timeout=3)
            except Exception as error:errors.append('server: '+str(error))
            finally:
                for stream in (self.server.stdout,self.server.stderr):
                    if stream:stream.close()
        for n in reversed(self.created):
            try:
                result=self.command(['ip','netns','del',self.names[n]],check=False)
                if result.returncode:errors.append(n+': '+result.stdout+result.stderr)
            except Exception as error:errors.append(n+': '+str(error))
        if self.created:
            try:
                remaining=self.command(['ip','netns','list']).stdout.splitlines()
                if any(line.split()[0] in {self.names[n] for n in self.created} for line in remaining if line.split()):errors.append('Owned namespace remains')
            except Exception as error:errors.append('cleanup verification: '+str(error))
        self.evidence['cleanup-errors']=errors
        return not errors

def run(scenario,out):
    lab=Lab(scenario);report={'kind':'security','engine':'Linux kernel nftables','steps':lab.steps,'evidence':lab.evidence,'ok':False,'cleanup':False}
    try:
        lab.setup();getattr(lab,scenario)();report['ok']=True
    except Exception as error:
        report['error']=str(error);print('FAIL',scenario,error,flush=True)
    finally:
        try:report['cleanup']=lab.cleanup()
        except Exception as error:report['error']=report.get('error','')+'; cleanup failed: '+str(error)
        report['ok']=report['ok'] and report['cleanup']
        out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True);(out/('security-'+scenario+'-results.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report['ok']

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('scenario',choices=['acl','nat']);p.add_argument('--execute',action='store_true');p.add_argument('--out',default=str(ROOT.parent/'dist'));a=p.parse_args(argv)
    if not a.execute:print('DRY RUN: '+a.scenario+'; no native commands executed');return 0
    if os.geteuid()!=0:raise PermissionError('Explicit execution requires an authorized root operator')
    return 0 if run(a.scenario,a.out) else 1
if __name__=='__main__':sys.exit(main())
