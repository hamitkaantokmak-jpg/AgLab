#!/usr/bin/env python3
"""Bounded AgLab v23 -> declarative, operator-only Linux bridge lab.

No commands, images, mounts or host paths are accepted from topology data.
"""
import argparse, hashlib, ipaddress, json, pathlib, re
from advanced_smoke import IMAGE

NAME='aglab-shared-l2'
def keys(value, allowed):
    if not isinstance(value,dict) or set(value)-set(allowed):raise ValueError('Unknown or invalid fields')
def vlan(n):
    if type(n) is not int or not 1<=n<=4094:raise ValueError('Invalid VLAN')
    return n
def convert(t):
    try:return _convert(t)
    except (TypeError,KeyError,AttributeError,RecursionError) as e:raise ValueError('Malformed topology') from e
def _convert(t):
    if len(json.dumps(t,allow_nan=False))>2000000:raise ValueError('Topology too large')
    keys(t,['app','version','devices','links','nextId','selected'])
    if t.get('app')!='AgLab' or t.get('version')!=23:raise ValueError('Expected AgLab v23')
    ds=t.get('devices');ls=t.get('links')
    if not isinstance(ds,list) or not 3<=len(ds)<=6 or not isinstance(ls,list) or len(ls)>8:raise ValueError('Lab size unsupported')
    nodes={};ids={};macs=set();ips=set();counts={'PC':0,'Switch':0};warnings=[]
    for d in ds:
        keys(d,['id','name','type','mac','x','y','w','h','ip','mask','gateway','enabled','mode','config','ports','interfaces','vlan','vlans'])
        typ=d.get('type');identity=d.get('id')
        if typ not in counts or not isinstance(identity,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',identity) or identity in ids:raise ValueError('Unsupported/duplicate device')
        counts[typ]+=1;n=('pc' if typ=='PC' else 's')+str(counts[typ]);ids[identity]=n
        if d.get('config') or d.get('gateway') or d.get('enabled',True) is not True:raise ValueError('Routing/configuration/disabled device unsupported')
        ports=d.get('ports',[]);interfaces=d.get('interfaces',{})
        if not isinstance(ports,list) or not 1<=len(ports)<=32 or len(set(ports))!=len(ports) or any(not isinstance(p,str) or len(p)>32 for p in ports):raise ValueError('Invalid ports')
        if not isinstance(interfaces,dict) or set(interfaces)-set(ports):raise ValueError('Invalid interfaces')
        item={'id':identity,'type':typ,'ports':{},'ip':None}
        for i,p in enumerate(ports,1):
            c=interfaces.get(p,{})
            keys(c,['enabled','mode','vlan','allowed','nativeVlan'])
            if type(c.get('enabled',True)) is not bool:raise ValueError('Invalid enabled flag')
            mode=c.get('mode','access')
            if mode not in ('access','trunk'):raise ValueError('Unsupported port mode')
            allowed=c.get('allowed',[1])
            if not isinstance(allowed,list) or len(allowed)>128 or len(set(allowed))!=len(allowed):raise ValueError('Invalid allowed VLANs')
            item['ports'][p]={'native':'eth'+str(i),'mode':mode,'vlan':vlan(c.get('vlan',1)),'allowed':[vlan(v) for v in allowed],'nativeVlan':vlan(c.get('nativeVlan',1)),'enabled':c.get('enabled',True)}
        if typ=='PC':
            if ports!=['eth0'] or any(k in interfaces.get('eth0',{}) for k in ('mode','vlan','allowed','nativeVlan')):raise ValueError('Only untagged single-NIC PCs supported')
            try:address=ipaddress.IPv4Interface(str(d.get('ip'))+'/'+str(d.get('mask')))
            except ValueError as e:raise ValueError('Invalid IPv4/mask') from e
            private=any(address.ip in ipaddress.ip_network(x) for x in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'))
            if not private or address.network.prefixlen<31 and address.ip in (address.network.network_address,address.network.broadcast_address):raise ValueError('Only RFC1918 host addresses supported')
            item['ip']=str(address)
            if address.ip in ips:raise ValueError('Duplicate PC IP')
            ips.add(address.ip)
            mac=d.get('mac',f'02:ee:00:00:00:{counts[typ]:02x}')
            if not isinstance(mac,str) or not re.fullmatch(r'(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}',mac) or int(mac[:2],16)&1 or mac=='00:00:00:00:00:00' or mac.lower() in macs:raise ValueError('Invalid/duplicate MAC')
            item['mac']=mac.lower();macs.add(mac.lower())
            if 'mac' not in d:warnings.append(identity+': generated local MAC; source had none')
        else:
            if d.get('ip') or d.get('mask'):raise ValueError('Switch management addressing unsupported')
            for v in d.get('vlans',[1]):vlan(v)
        nodes[n]=item
    if not 2<=counts['PC']<=4 or not 1<=counts['Switch']<=2:raise ValueError('Expected 2-4 PCs, 1-2 switches')
    links=[];used=set();parents={n:n for n in nodes}
    def find(n):
        while parents[n]!=n:n=parents[n]
        return n
    for l in ls:
        keys(l,['a','b','portA','portB','up'])
        a=ids.get(l.get('a'));b=ids.get(l.get('b'))
        if not a or not b or a==b or type(l.get('up',True)) is not bool:raise ValueError('Invalid link')
        ends=[]
        for n,p in ((a,l.get('portA')),(b,l.get('portB'))):
            if p not in nodes[n]['ports'] or (n,p) in used:raise ValueError('Unknown/reused port')
            used.add((n,p));ends.append(n+':'+nodes[n]['ports'][p]['native'])
        if nodes[a]['type']==nodes[b]['type']=='PC' or find(a)==find(b):raise ValueError('Only PC-switch forests supported; loops unsupported')
        parents[find(a)]=find(b);links.append({'endpoints':ends,'up':l.get('up',True)})
    return {'name':NAME,'nodes':nodes,'links':links,'source_sha256':hashlib.sha256(json.dumps(t,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'warnings':warnings}

def export(plan,folder):
    folder=pathlib.Path(folder)
    if folder.exists() and any(folder.iterdir()):raise ValueError('Export directory must be empty')
    folder.mkdir(parents=True,exist_ok=True)
    native={n:({'kind':'frr','image':IMAGE} if d['type']=='Switch' else {'kind':'linux','image':'alpine:3.20'}) for n,d in plan['nodes'].items()}
    lab={'name':NAME,'topology':{'nodes':native,'links':[{'endpoints':l['endpoints']} for l in plan['links']]}}
    (folder/'lab.clab.yml').write_text(json.dumps(lab,indent=2),encoding='utf-8')
    (folder/'plan.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('topology');p.add_argument('--out',required=True);a=p.parse_args()
    source=pathlib.Path(a.topology)
    if source.stat().st_size>2000000:raise ValueError('Topology too large')
    export(convert(json.loads(source.read_text(encoding='utf-8'))),a.out)
    print('Declarative export only. No containers started.')
if __name__=='__main__':main()
