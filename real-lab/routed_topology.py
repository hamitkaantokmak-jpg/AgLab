#!/usr/bin/env python3
"""Bounded AgLab v23 -> declarative FRR/PC/access-bridge operator lab; no execution."""
import argparse,copy,hashlib,ipaddress,json,pathlib,re
from shared_topology import keys
from advanced_smoke import IMAGE
NAME='aglab-shared-routing'
PRIVATE=tuple(ipaddress.ip_network(n) for n in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'))

def address(ip,mask):
    if not isinstance(ip,str) or not isinstance(mask,str):raise ValueError('IPv4/mask must be text')
    ipaddress.IPv4Address(mask)
    a=ipaddress.IPv4Interface(ip+'/'+mask)
    if not any(a.network.subnet_of(n) for n in PRIVATE) or a.network.prefixlen<31 and a.ip in (a.network.network_address,a.network.broadcast_address):raise ValueError('Only RFC1918 IPv4 host interfaces')
    return str(a)
def next_hop(value):
    if not isinstance(value,str):raise ValueError('Invalid next-hop')
    a=ipaddress.IPv4Address(value)
    if not any(a in n for n in PRIVATE):raise ValueError('Only RFC1918 next-hops')
    return str(a)
def convert(t):
    try:return _convert(t)
    except (KeyError,TypeError,AttributeError,RecursionError) as e:raise ValueError('Malformed routed topology') from e

def _convert(t):
    if len(json.dumps(t,allow_nan=False))>2000000:raise ValueError('Topology too large')
    keys(t,['app','version','devices','links','nextId','selected'])
    if t.get('app')!='AgLab' or t.get('version')!=23:raise ValueError('Expected AgLab v23')
    ds=t.get('devices');ls=t.get('links')
    if not isinstance(ds,list) or not 3<=len(ds)<=9 or not isinstance(ls,list) or len(ls)>12:raise ValueError('Unsupported routed lab size')
    nodes={};ids={};counts={'PC':0,'Router':0,'Switch':0};ips=set();macs=set();warnings=[]
    for d in ds:
        keys(d,['id','name','type','mac','x','y','w','h','ip','mask','gateway','enabled','mode','config','ports','interfaces','vlan','vlans','staticRoutes','route'])
        typ=d.get('type');identity=d.get('id')
        if typ not in counts or not isinstance(identity,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',identity) or identity in ids:raise ValueError('Unsupported/duplicate device')
        if type(d.get('enabled',True)) is not bool or d.get('config') or d.get('route'):raise ValueError('Invalid power/unsupported config or legacy route')
        if d.get('mode','user') not in ('user','priv','config','if'):raise ValueError('Unsupported CLI mode metadata')
        counts[typ]+=1;n={'PC':'pc','Router':'r','Switch':'s'}[typ]+str(counts[typ]);ids[identity]=n
        ports=d.get('ports');interfaces=d.get('interfaces')
        if not isinstance(ports,list) or not 1<=len(ports)<=16 or any(not isinstance(p,str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9/-]{0,31}',p) or p.lower().startswith('serial') or p.startswith('s0/') for p in ports) or len(set(ports))!=len(ports):raise ValueError('Only unique Ethernet port labels')
        if not isinstance(interfaces,dict) or set(interfaces)-set(ports):raise ValueError('Subinterfaces/SVI or invalid interfaces unsupported')
        item={'id':identity,'type':typ,'enabled':d.get('enabled',True),'ports':{},'routes':[],'ip':None,'gateway':None}
        for i,p in enumerate(ports,1):
            c=interfaces.get(p,{})
            keys(c,['enabled','ip','mask'] if typ=='Router' else ['enabled'] if typ=='PC' else ['enabled','mode','vlan','allowed','nativeVlan'])
            if type(c.get('enabled',True)) is not bool:raise ValueError('Invalid interface power')
            entry={'native':'eth'+str(i),'enabled':c.get('enabled',True),'address':None}
            if typ=='Router':
                if c.get('ip'):entry['address']=address(c['ip'],c.get('mask'))
                elif c.get('mask'):raise ValueError('Mask without interface address')
            if typ=='Switch' and (c.get('mode','access')!='access' or c.get('vlan',1)!=1 or type(c.get('vlan',1)) is not int or c.get('allowed',[1])!=[1] or c.get('nativeVlan',1)!=1):raise ValueError('Only access VLAN1 bridges in routed export')
            item['ports'][p]=entry
        if typ=='PC':
            if ports!=['eth0'] or type(d.get('vlan',1)) is not int or d.get('vlan',1)!=1 or d.get('staticRoutes'):raise ValueError('Single untagged PC only')
            item['ip']=address(d.get('ip'),d.get('mask'));a=ipaddress.ip_interface(item['ip'])
            if d.get('gateway'):
                g=next_hop(d['gateway'])
                if ipaddress.ip_address(g) not in a.network or g==str(a.ip):raise ValueError('PC gateway must be on-link and distinct')
                item['gateway']=g
            mac=d.get('mac',f'02:ef:00:00:00:{counts[typ]:02x}')
            if not isinstance(mac,str) or not re.fullmatch(r'(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}',mac) or int(mac[:2],16)&1 or mac=='00:00:00:00:00:00' or mac.lower() in macs:raise ValueError('Invalid/duplicate PC MAC')
            item['mac']=mac.lower();macs.add(mac.lower())
            if 'mac' not in d:warnings.append(identity+': generated local MAC; no source MAC')
        else:
            if d.get('ip') or d.get('mask') or d.get('gateway') or 'mac' in d:raise ValueError('Use router interface addresses; no switch management/MAC mapping')
            if typ=='Switch' and (d.get('vlans',[1])!=[1] or d.get('staticRoutes')):raise ValueError('Only VLAN1 bridge, no routes')
        routes=d.get('staticRoutes',[])
        if not isinstance(routes,list) or len(routes)>64:raise ValueError('Too many/invalid static routes')
        for r in routes:
            if typ!='Router':raise ValueError('Static routes only on routers')
            keys(r,['network','mask','nextHop','distance'])
            ipaddress.IPv4Address(r['mask']);net=ipaddress.IPv4Network(r['network']+'/'+r['mask'],strict=True)
            if net.prefixlen and not any(net.subnet_of(n) for n in PRIVATE):raise ValueError('Only private or default destinations')
            distance=r.get('distance',1)
            if type(distance) is not int or not 1<=distance<=255:raise ValueError('Invalid administrative distance')
            route={'prefix':str(net),'next_hop':next_hop(r['nextHop']),'distance':distance}
            if route in item['routes']:raise ValueError('Duplicate static route')
            item['routes'].append(route)
        for cidr in [item['ip']]+[p['address'] for p in item['ports'].values()]:
            if cidr:
                value=str(ipaddress.ip_interface(cidr).ip)
                if value in ips:raise ValueError('Duplicate interface IP')
                ips.add(value)
        nodes[n]=item
    if not 2<=counts['PC']<=4 or not 1<=counts['Router']<=3 or counts['Switch']>2:raise ValueError('Expected 2-4 PCs, 1-3 routers, 0-2 bridges')
    used=set();links=[];switch_parent={n:n for n,d in nodes.items() if d['type']=='Switch'}
    def root(n):
        while switch_parent[n]!=n:n=switch_parent[n]
        return n
    for l in ls:
        keys(l,['a','b','portA','portB','up']);a=ids.get(l.get('a'));b=ids.get(l.get('b'))
        if not a or not b or a==b or type(l.get('up',True)) is not bool:raise ValueError('Invalid link')
        ends=[]
        for n,p in ((a,l.get('portA')),(b,l.get('portB'))):
            if p not in nodes[n]['ports'] or (n,p) in used:raise ValueError('Missing/reused port')
            used.add((n,p));ends.append(n+':'+nodes[n]['ports'][p]['native'])
        if nodes[a]['type']==nodes[b]['type']=='PC':raise ValueError('PC-PC links outside routed scope')
        if a in switch_parent and b in switch_parent:
            x,y=root(a),root(b)
            if x==y:raise ValueError('L2 loops unsupported')
            switch_parent[x]=y
        links.append({'endpoints':ends,'up':l.get('up',True)})
    for n,d in nodes.items():
        if d['type']=='PC' and (n,'eth0') not in used:raise ValueError('PC needs a data cable')
        if any(p['address'] and (n,label) not in used for label,p in d['ports'].items()):raise ValueError('Addressed router interface needs a physical cable')
    return {'name':NAME,'nodes':nodes,'links':links,'source_sha256':hashlib.sha256(json.dumps(t,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'warnings':warnings,'source':copy.deepcopy(t)}

def config(plan,node):
    d=plan['nodes'][node];lines=['frr defaults traditional','hostname '+node,'service integrated-vtysh-config']
    connected={e for l in plan['links'] for e in l['endpoints']}
    for p in d['ports'].values():
        endpoint=node+':'+p['native']
        if endpoint not in connected:continue
        up=d['enabled'] and p['enabled'] and all(l['up'] for l in plan['links'] if endpoint in l['endpoints'])
        lines.append('interface '+p['native'])
        if p['address']:lines.append(' ip address '+p['address'])
        lines.extend([' no shutdown' if up else ' shutdown','!'])
    lines.extend('ip route {prefix} {next_hop} {distance}'.format(**r) for r in d['routes'])
    return '\n'.join(lines+['!'])+'\n'

def export(plan,folder):
    if convert(plan.get('source'))!=plan:raise ValueError('Plan changed; re-convert validated source')
    folder=pathlib.Path(folder)
    if folder.exists() and any(folder.iterdir()):raise ValueError('Export directory must be empty')
    folder.mkdir(parents=True,exist_ok=True);native={}
    for n,d in plan['nodes'].items():
        native[n]={'kind':'linux','image':'alpine:3.20'} if d['type']=='PC' else {'kind':'frr','image':IMAGE}
        if d['type']=='Router':
            path=folder/(n+'.conf');path.write_text(config(plan,n),encoding='utf-8');native[n]['startup-config']=str(path.resolve())
    lab={'name':NAME,'topology':{'nodes':native,'links':[{'endpoints':l['endpoints']} for l in plan['links']]}}
    (folder/'lab.clab.yml').write_text(json.dumps(lab,indent=2),encoding='utf-8')
    (folder/'plan.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')

def example(routers=2):
    if routers not in (2,3):raise ValueError('Two or three routers')
    def dev(id,kind,ports,**kw):return dict(id=id,name=id,type=kind,x=100,y=100,enabled=True,config={},ports=ports,interfaces={p:{'enabled':True} for p in ports},**kw)
    pc1=dev('PC1','PC',['eth0'],ip='192.168.10.10',mask='255.255.255.0',gateway='192.168.10.1')
    pc2=dev('PC2','PC',['eth0'],ip='192.168.20.20',mask='255.255.255.0',gateway='192.168.20.1')
    rs=[dev('R'+str(i),'Router',['g0/0','g0/1','g0/2'],staticRoutes=[]) for i in range(1,routers+1)]
    rs[0]['interfaces']['g0/0'].update(ip='192.168.10.1',mask='255.255.255.0');rs[-1]['interfaces']['g0/0'].update(ip='192.168.20.1',mask='255.255.255.0')
    links=[dict(a='PC1',portA='eth0',b='R1',portB='g0/0',up=True),dict(a='R'+str(routers),portA='g0/0',b='PC2',portB='eth0',up=True)]
    for i in range(1,routers):
        subnet=12 if i==1 else 23;port='g0/1' if i==1 else 'g0/2'
        rs[i-1]['interfaces'][port].update(ip=f'10.0.{subnet}.1',mask='255.255.255.0');rs[i]['interfaces']['g0/1'].update(ip=f'10.0.{subnet}.2',mask='255.255.255.0')
        links.append(dict(a='R'+str(i),portA=port,b='R'+str(i+1),portB='g0/1',up=True))
    for i,r in enumerate(rs):
        if i>0:r['staticRoutes'].append(dict(network='192.168.10.0',mask='255.255.255.0',nextHop='10.0.'+('12' if i==1 else '23')+'.1',distance=1))
        if i<routers-1:r['staticRoutes'].append(dict(network='192.168.20.0',mask='255.255.255.0',nextHop='10.0.'+('12' if i==0 else '23')+'.2',distance=1))
    return dict(app='AgLab',version=23,devices=[pc1,*rs,pc2],links=links,nextId=len(rs)+3,selected='PC1')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('topology');p.add_argument('--out',required=True);a=p.parse_args()
    source=pathlib.Path(a.topology)
    if source.stat().st_size>2000000:raise ValueError('Topology too large')
    export(convert(json.loads(source.read_text(encoding='utf-8'))),a.out)
    print('Declarative FRR export only; no containers or commands executed.')
if __name__=='__main__':main()
