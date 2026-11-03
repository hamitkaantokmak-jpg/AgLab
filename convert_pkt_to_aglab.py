#!/usr/bin/env python3
"""Convert a Cisco Packet Tracer .pkt topology into an AgLab JSON topology.

Requires Python 3.9+. On Windows/macOS install the pure-Python backend with
`py -m pip install securedypkt`; on Linux libgcrypt is used as a fallback. It
only reads Packet Tracer files and writes a separate AgLab JSON file; it never
modifies or overwrites the original .pkt file.
"""
from __future__ import annotations
import argparse, base64, ctypes, hashlib, ipaddress, json, re, struct, zlib
from pathlib import Path
import xml.etree.ElementTree as ET

class PacketTracerError(Exception): pass

def _gcrypt():
    try: g = ctypes.CDLL('libgcrypt.so.20')
    except OSError:
        try: g = ctypes.CDLL('libgcrypt.so')
        except OSError as e: raise PacketTracerError('libgcrypt bulunamadı. Linux üzerinde libgcrypt20 kurulmalı.') from e
    g.gcry_check_version.restype=ctypes.c_char_p; g.gcry_check_version(None)
    g.gcry_cipher_open.argtypes=[ctypes.POINTER(ctypes.c_void_p),ctypes.c_int,ctypes.c_int,ctypes.c_uint]
    g.gcry_cipher_setkey.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_size_t]
    g.gcry_cipher_encrypt.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_size_t,ctypes.c_char_p,ctypes.c_size_t]
    g.gcry_cipher_map_name.restype=ctypes.c_int; g.gcry_cipher_map_name.argtypes=[ctypes.c_char_p]
    return g

def _xor(a,b): return bytes(x^y for x,y in zip(a,b))
def _decrypt_block_factory(g,key):
    cid=g.gcry_cipher_map_name(b'twofish'); h=ctypes.c_void_p()
    if not cid or g.gcry_cipher_open(ctypes.byref(h),cid,1,0): raise PacketTracerError('Twofish backend açılamadı.')
    if g.gcry_cipher_setkey(h,key,len(key)): raise PacketTracerError('Twofish anahtarı ayarlanamadı.')
    def enc(block):
        out=ctypes.create_string_buffer(16)
        if g.gcry_cipher_encrypt(h,out,16,block,16): raise PacketTracerError('Twofish blok işlemi başarısız.')
        return out.raw
    return enc

def _subkeys(E):
    L=E(bytes(16)); k1=(int.from_bytes(L,'big')<<1)&((1<<128)-1)
    if L[0]&128:k1^=0x87
    k1=k1.to_bytes(16,'big'); k2=(int.from_bytes(k1,'big')<<1)&((1<<128)-1)
    if k1[0]&128:k2^=0x87
    return k1,k2.to_bytes(16,'big')
def _cmac(E,msg,sk):
    k1,k2=sk; n=max(1,(len(msg)+15)//16); complete=bool(msg) and len(msg)%16==0; last=msg[(n-1)*16:]
    last=_xor(last,k1) if complete else _xor(last+b'\x80'+bytes(15-len(last)),k2)
    state=bytes(16)
    for i in range(n-1): state=E(_xor(state,msg[i*16:(i+1)*16]))
    return E(_xor(state,last))
def _ctr(E,nonce,data):
    out=bytearray(); counter=int.from_bytes(nonce,'big')
    for i in range(0,len(data),16):
        ks=E((counter&((1<<128)-1)).to_bytes(16,'big')); block=data[i:i+16]; out.extend(_xor(block,ks[:len(block)])); counter+=1
    return bytes(out)
def decrypt_pkt(raw: bytes) -> bytes:
    # On Windows/macOS, prefer the pure-Python securedypkt package.
    try:
        import securedypkt  # type: ignore
    except ImportError:
        securedypkt = None
    if securedypkt is not None:
        return securedypkt.decrypt_pkt(raw)
    n=len(raw); ct=bytes(raw[n-1-i]^((n*(1-i))&255) for i in range(n))
    g=_gcrypt(); E=_decrypt_block_factory(g,bytes([0x89])*16); sk=_subkeys(E)
    body,tag=ct[:-16],ct[-16:]; nonce=_cmac(E,bytes(16)+bytes([0x10])*16,sk)
    pt=_ctr(E,nonce,body); m1=_cmac(E,bytes(15)+b'\x02'+body,sk); m2=_cmac(E,bytes(15)+b'\x01',sk)
    if _xor(_xor(nonce,m1),m2)!=tag: raise PacketTracerError('Packet Tracer bütünlük doğrulaması başarısız; dosya bozuk veya desteklenmeyen formatta olabilir.')
    q=bytes(v^((len(pt)-i)&255) for i,v in enumerate(pt))
    if len(q)<4: raise PacketTracerError('Dosya içeriği eksik.')
    expected=struct.unpack('>I',q[:4])[0]; xml=zlib.decompress(q[4:])
    if expected!=len(xml): raise PacketTracerError('Açılmış içerik uzunluğu uyuşmuyor.')
    return xml

def text(el, path, default=''):
    x=el.find(path) if el is not None else None
    return (x.text or '').strip() if x is not None else default

def parse_config(engine):
    node=engine.find('RUNNINGCONFIG')
    return '\n'.join((x.text or '').strip() for x in node if x.tag=='LINE') if node is not None else ''

def norm_port(name, kind=None):
    s=name.strip().lower().replace('fastethernet','fa').replace('gigabitethernet','g').replace('ethernet','eth').replace('serial','s')
    s=s.replace(' ','')
    if kind=='Switch' and s.startswith('g') and not s.startswith('gi'):
        s='gi'+s[1:]
    return s

def dot1q_vlan(line):
    """Only tagged 802.1Q is modeled; native and other encapsulations stay reported."""
    match=re.fullmatch(r'\s*encapsulation\s+dot1q\s+(\d+)\s*',line,re.I)
    if match and 1 <= int(match.group(1)) <= 4094: return int(match.group(1))
    return None

def parse_vlan_list(value):
    """Parse IOS VLAN list syntax (1,10,20-22) into unique VLAN IDs."""
    vals=[]
    for part in value.split(','):
        part=part.strip()
        if not part: continue
        if '-' in part:
            try: a,b=map(int,part.split('-',1))
            except ValueError: continue
            if 1 <= a <= b <= 4094: vals.extend(range(a,b+1))
        elif part.isdigit() and 1 <= int(part) <= 4094:
            vals.append(int(part))
    return list(dict.fromkeys(vals))

def parse_trunk_allowed(value):
    """Return an operation and VLANs, or None for unsupported/invalid syntax."""
    match=re.fullmatch(r'(?:(add|remove)\s+)?(.+)',value.strip(),re.I)
    if not match: return None
    action=(match.group(1) or 'set').lower(); value=match.group(2).lower()
    if value=='all': return action,list(range(1,4095))
    if value=='none': return action,[]
    for part in value.split(','):
        if not re.fullmatch(r'\s*\d+(?:\s*-\s*\d+)?\s*',part): return None
        bounds=[int(v) for v in part.split('-')]
        if not all(1 <= v <= 4094 for v in bounds) or bounds[0]>bounds[-1]: return None
    return action,parse_vlan_list(value)

def parse_helper_command(line):
    """One unicast IPv4 DHCP relay target; no VRF/options or partial matches."""
    match=re.fullmatch(r'\s*(no\s+)?ip\s+helper-address(?:\s+(\S+))?\s*',line,re.I)
    if not match: return None
    removing=bool(match.group(1)); value=match.group(2)
    if value is None: return (True,None) if removing else None
    try: address=ipaddress.IPv4Address(value)
    except ipaddress.AddressValueError: return None
    first=int(address)>>24
    if first in (0,127) or first>=224: return None
    return removing,str(address)

def canonical_secure_mac(value):
    raw=re.sub(r'[.:-]','',value.lower())
    if not re.fullmatch(r'[0-9a-f]{12}',raw) or raw=='000000000000' or int(raw[:2],16)&1: return None
    return ':'.join(raw[i:i+2] for i in range(0,12,2))

def parse_port_security_command(line, previous=None):
    """Return a fresh policy only for the existing simulator CLI's valid subset."""
    tokens=line.lower().split(); removing=tokens[:1]==['no']
    args=tokens[1:] if removing else tokens
    if args[:2]!=['switchport','port-security']: return None
    policy=dict(previous or {'enabled':False,'max':1,'violation':'shutdown','macs':[]})
    policy['macs']=list(policy['macs'])
    if len(args)==2: policy['enabled']=not removing
    elif len(args)==4 and args[2]=='maximum' and not removing:
        if not re.fullmatch(r'[0-9]{1,4}',args[3]): return None
        maximum=int(args[3])
        if not 1<=maximum<=1024 or maximum<len(policy['macs']): return None
        policy['max']=maximum
    elif len(args)==4 and args[2]=='violation' and not removing and args[3] in ('shutdown','restrict','protect'):
        policy['violation']=args[3]
    elif len(args)==4 and args[2]=='mac-address':
        mac=canonical_secure_mac(args[3])
        if mac is None: return None
        if removing: policy['macs']=[value for value in policy['macs'] if value!=mac]
        elif mac not in policy['macs']:
            if len(policy['macs'])>=policy['max']: return None
            policy['macs'].append(mac)
    else: return None
    return policy

def parse_switch_interface_range(value, ports):
    """Resolve a bounded physical-port selection atomically; never invent ports.

    Accept full/short Ethernet names, comma lists and same-prefix ranges with
    a numeric or full-name end. Router, SVI and omitted-prefix list syntax is
    intentionally outside this import contract.
    """
    if not value or len(value)>1024: return None
    available=set(ports); selected=[]
    for item in value.split(','):
        bounds=item.strip().split('-')
        if len(bounds)>2: return None
        start=norm_port(bounds[0],'Switch')
        if start not in available or not re.fullmatch(r'(?:fa|gi)\d+(?:/\d+)+',start): return None
        prefix,first=start.rsplit('/',1)
        end=start
        if len(bounds)==2:
            last=bounds[1].strip()
            end=prefix+'/'+last if last.isdigit() else norm_port(last,'Switch')
        if end not in available or end.rsplit('/',1)[0]!=prefix: return None
        low,high=int(first),int(end.rsplit('/',1)[1])
        if not 0<=high-low<len(available): return None
        members=[prefix+'/'+str(number) for number in range(low,high+1)]
        if any(port not in available for port in members): return None
        selected.extend(members)
    return list(dict.fromkeys(selected))

def convert(xml_bytes, original_pkt=None):
    # PT config may contain raw control characters; parse with recovery via replacement if needed.
    root=ET.fromstring(xml_bytes)
    network=root.find('NETWORK')
    if network is None or network.find('DEVICES') is None or network.find('LINKS') is None:
        raise PacketTracerError('PACKETTRACER5 içeriğinde beklenen NETWORK/DEVICES/LINKS alanları bulunamadı.')
    switch_range_contexts={}; switch_security_lines={}; router_helper_lines={}; endpoint_macs=set()
    raw_devices=[]; ref_to_id={}; unsupported=[]; notes=[]; unmapped_endpoints=set(); endpoint_ports=[]
    for idx,dev in enumerate(network.find('DEVICES')):
        eng=dev.find('ENGINE')
        if eng is None: continue
        model=eng.find('TYPE').get('model','') if eng.find('TYPE') is not None else ''
        typ=text(eng,'TYPE')
        display=text(eng,'NAME') or f'DEV-{idx+1}'
        name=(text(eng,'SYS_NAME') or display) if (model=='2911' or typ.lower() in ('router','switch') or model.startswith('2960')) else display
        ref=text(eng,'SAVE_REF_ID').replace('save-ref-id:','').strip()
        if model=='2911' or typ.lower()=='router': kind='Router'
        elif model.startswith('2960') or typ.lower()=='switch': kind='Switch'
        elif model.startswith('PC-') or typ.lower() in ('pc','pc-pt'): kind='PC'
        elif 'server' in typ.lower() or model.startswith('server'): kind='Server'
        else:
            unsupported.append(f'{display} ({model or typ or "bilinmeyen cihaz"})')
            continue
        ws=dev.find('WORKSPACE/LOGICAL'); x=float(text(ws,'X','100') or 100); y=float(text(ws,'Y','100') or 100)
        x=max(50,min(1150,x)); y=max(55,min(600,y))
        cfg=parse_config(eng)
        if kind=='Router':
            ports=['g0/0','g0/1','g0/2']; interfaces={p:{'enabled':True} for p in ports}
            current=None; modeled_interfaces=set(); ignored_interfaces=[]; helper_targets={}; helper_lines=set()
            for line_no,line in enumerate(cfg.splitlines(),1):
                if line.strip() in ('!', 'exit', 'end'):
                    current=None; continue
                if re.match(r'\s*interface\b',line,re.I): current=None
                m=re.fullmatch(r'\s*interface\s+(\S+)\s*',line,re.I)
                if m:
                    current=norm_port(m.group(1),kind)
                    if current.startswith('vlan'):
                        ignored_interfaces.append(m.group(1)); current=None; continue
                    if current not in interfaces:
                        interfaces[current]={'enabled':True}
                        if '.' in current:
                            parent=current.split('.')[0]
                            interfaces[current]['parent']=parent
                            if parent not in interfaces: interfaces[parent]={'enabled':True}
                            if parent not in ports: ports.append(parent)
                        else: ports.append(current)
                    modeled_interfaces.add(current)
                    continue
                if not current: continue
                helper=parse_helper_command(line)
                if helper is not None:
                    removing,address=helper
                    targets=helper_targets.setdefault(current,set())
                    if removing:
                        if address is None: targets.clear()
                        else: targets.discard(address)
                    else: targets.add(address)
                    helper_lines.add(line_no)
                    continue
                vlan=dot1q_vlan(line)
                if vlan is not None and interfaces[current].get('parent'):
                    interfaces[current].update({'encapsulation':'dot1q','vlan':vlan})
                m=re.fullmatch(r'\s*ip address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s*',line,re.I)
                if m: interfaces[current]['ip'],interfaces[current]['mask']=m.group(1),m.group(2)
                if re.match(r'\s*shutdown\s*$',line,re.I): interfaces[current]['enabled']=False
                if re.match(r'\s*no shutdown\s*$',line,re.I): interfaces[current]['enabled']=True
            for port,targets in helper_targets.items():
                if len(targets)>1:
                    raise PacketTracerError(f'{name}/{port}: birden fazla aktif ip helper-address desteklenmiyor; model tek hedef tutar.')
                if targets: interfaces[port]['helperAddress']=next(iter(targets))
            routes=[]
            for line in cfg.splitlines():
                m=re.fullmatch(r'\s*ip route\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)(?:\s+(\d+))?\s*',line,re.I)
                if m: routes.append({'network':m.group(1),'mask':m.group(2),'nextHop':m.group(3),'distance':int(m.group(4) or 1)})
            d={'id':f'd{len(raw_devices)+1}','name':name,'type':kind,'x':x,'y':y,'w':108,'h':72,'ip':'','mask':'','gateway':'','vlan':1,'ports':list(dict.fromkeys(ports)),'route':'','enabled':text(eng,'POWER','true').lower()!='false','mode':'user','config':{'packetTracerModel':model,'runningConfig':cfg,'displayName':display,'unmodeledInterfaces':ignored_interfaces},'interfaces':interfaces,'staticRoutes':routes}
            router_helper_lines[d['id']]=helper_lines
        elif kind=='Switch':
            ports=[f'fa0/{i}' for i in range(1,25)]+['gi0/1','gi0/2']; interfaces={p:{'mode':'access','vlan':1,'allowed':[1],'enabled':True} for p in ports}
            # Parse explicit access/trunk commands and VLAN database from the source config.
            range_ports=None; range_context={}; security_lines=set()
            current=None; vlans={1}; ignored_interfaces=[]; stp_priorities={}; explicit_allowed=set(); vlan_names={}; vlan_context=None; management_gateway=''
            for line_no,line in enumerate(cfg.splitlines(),1):
                if line.strip() in ('!','exit','end'):
                    current=None; range_ports=None; vlan_context=None; continue
                gw=re.fullmatch(r'\s*ip default-gateway\s+(\d+(?:\.\d+){3})\s*',line,re.I)
                if gw:
                    management_gateway=gw.group(1); current=None; range_ports=None; vlan_context=None; continue
                if re.match(r'\s*interface\b',line,re.I):
                    current=None; range_ports=None; vlan_context=None
                ranged=re.fullmatch(r'\s*interface\s+range(?:\s+(.*))?\s*',line,re.I)
                if ranged:
                    range_ports=parse_switch_interface_range(ranged.group(1) or '',ports)
                    range_context[line_no]=range_ports
                    continue
                m=re.fullmatch(r'\s*interface\s+(\S+)\s*',line,re.I)
                if m:
                    current=norm_port(m.group(1),kind); vlan_context=None
                    if current.startswith('vlan'):
                        vid=current[4:]
                        if vid.isdigit() and 1 <= int(vid) <= 4094:
                            current='vlan'+str(int(vid)); interfaces.setdefault(current,{'ip':'','mask':'255.255.255.0','enabled':False,'vlan':int(vid)})
                        else: ignored_interfaces.append(m.group(1)); current=None
                        continue
                    if current not in interfaces:
                        interfaces[current]={'mode':'access','vlan':1,'allowed':[1],'enabled':True}
                        ports.append(current)
                    continue
                vm=re.fullmatch(r'\s*vlan\s+(\d+)\s*',line,re.I)
                if vm:
                    vid=int(vm.group(1))
                    if 1 <= vid <= 4094: vlans.add(vid); vlan_context=vid
                    else: vlan_context=None
                    current=None; range_ports=None; continue
                vn=re.fullmatch(r'\s*name\s+(.+)',line,re.I)
                if vn and vlan_context is not None:
                    value=vn.group(1).strip()
                    if 1 <= len(value) <= 32 and not re.search(r'[\x00-\x1f\x7f]',value): vlan_names[str(vlan_context)]=value
                    continue
                sm=re.match(r'\s*spanning-tree vlan\s+([\d, -]+)\s+priority\s+(\d+)',line,re.I)
                if sm:
                    priority=int(sm.group(2))
                    for vid in parse_vlan_list(sm.group(1)):
                        if 0 <= priority <= 61440 and priority % 4096 == 0:
                            stp_priorities[str(vid)]=priority
                    current=None; range_ports=None; vlan_context=None; continue
                targets=range_ports or ([current] if current in interfaces else [])
                if re.match(r'\s*(?:no\s+)?switchport\s+port-security\b',line,re.I):
                    updates={port:parse_port_security_command(line,interfaces[port].get('portSecurity')) for port in targets if port in ports}
                    if updates and len(updates)==len(targets) and all(policy is not None for policy in updates.values()):
                        for port,policy in updates.items(): interfaces[port]['portSecurity']=policy
                        security_lines.add(line_no)
                    continue
                for port in targets:
                    if port.startswith('vlan'):
                        address=re.fullmatch(r'\s*ip address\s+(\d+(?:\.\d+){3})\s+(\d+(?:\.\d+){3})\s*',line,re.I)
                        if address: interfaces[port]['ip'],interfaces[port]['mask']=address.groups()
                        if re.fullmatch(r'\s*shutdown\s*',line,re.I): interfaces[port]['enabled']=False
                        if re.fullmatch(r'\s*no shutdown\s*',line,re.I): interfaces[port]['enabled']=True
                        continue
                    m=re.fullmatch(r'\s*switchport access vlan\s+(\d+)\s*',line,re.I)
                    if m:
                        vid=int(m.group(1))
                        if 1 <= vid <= 4094:
                            interfaces[port]['vlan']=vid; vlans.add(vid)
                    if re.match(r'\s*switchport mode trunk\s*$',line,re.I): interfaces[port]['mode']='trunk'
                    if re.match(r'\s*switchport mode access\s*$',line,re.I): interfaces[port]['mode']='access'
                    m=re.match(r'\s*switchport trunk allowed vlan\s+(.+)',line,re.I)
                    if m:
                        parsed=parse_trunk_allowed(m.group(1))
                        if parsed is not None:
                            action,values=parsed
                            existing=set(interfaces[port]['allowed']) if port in explicit_allowed else set(range(1,4095))
                            if action=='add': values=existing | set(values)
                            elif action=='remove': values=existing - set(values)
                            interfaces[port]['allowed']=sorted(set(values))
                            explicit_allowed.add(port)
                    m=re.fullmatch(r'\s*switchport trunk native vlan\s+(\d+)\s*',line,re.I)
                    if m:
                        vid=int(m.group(1))
                        if 1 <= vid <= 4094:
                            interfaces[port]['nativeVlan']=vid
                    if re.match(r'\s*shutdown\s*$',line,re.I): interfaces[port]['enabled']=False
                    if re.match(r'\s*no shutdown\s*$',line,re.I): interfaces[port]['enabled']=True
            for port,iface in interfaces.items():
                if iface.get('mode')=='trunk' and port not in explicit_allowed:
                    iface['allowed']=list(range(1,4095))
            d={'id':f'd{len(raw_devices)+1}','name':name,'type':kind,'x':x,'y':y,'w':112,'h':72,'ip':'','mask':'','gateway':management_gateway,'vlans':sorted(vlans),'stpPriorities':stp_priorities,'ports':list(dict.fromkeys(ports)),'enabled':text(eng,'POWER','true').lower()!='false','mode':'user','config':{'packetTracerModel':model,'runningConfig':cfg,'displayName':display,'unmodeledInterfaces':ignored_interfaces},'interfaces':interfaces}
            switch_range_contexts[d['id']]=range_context
            switch_security_lines[d['id']]=security_lines
            if vlan_names: d['vlanNames']=vlan_names
        else:
            # Bind endpoint state to one physical wired NIC, never an unrelated
            # service/Bluetooth IP found through an unrestricted recursive scan.
            modules=list(eng.iter('MODULE'))
            wired_types={'ecopperethernet','ecopperfastethernet','ecoppergigabitethernet','efiberfastethernet','efibergigabitethernet'}
            wired=[p for p in eng.findall('.//MODULE/PORT') if text(p,'TYPE').lower() in wired_types]
            mapped=not modules or len(wired)==1
            address=wired[0] if len(wired)==1 else eng if not modules else None
            ip=text(address,'IP')
            if ip=='0.0.0.0' or not re.fullmatch(r'\d+(?:\.\d+){3}',ip): ip=''
            mask=text(address,'SUBNET') or text(address,'SUBNET_MASK') or text(address,'MASK') or '255.255.255.0'
            gateway=(text(address,'PORT_GATEWAY') or text(eng,'GATEWAY')) if mapped else ''
            port_enabled=mapped and text(address,'POWER','true').lower()!='false'
            ports=['eth0']
            d={'id':f'd{len(raw_devices)+1}','name':name,'type':kind,'x':x,'y':y,'w':104,'h':72,'ip':ip,'mask':mask,'gateway':gateway,'vlan':1,'ports':ports,'enabled':text(eng,'POWER','true').lower()!='false','mode':'user','config':{'packetTracerModel':model,'runningConfig':cfg,'displayName':display},'interfaces':{'eth0':{'enabled':port_enabled}}}
            source_mac=text(address,'MACADDRESS') if mapped else ''
            if mapped and address is not None and address.find('MACADDRESS') is not None:
                mac=canonical_secure_mac(source_mac)
                if mac is None: raise PacketTracerError(f'{name}: fiziksel Ethernet MAC adresi geçersiz.')
                if mac in endpoint_macs: raise PacketTracerError(f'{name}: yinelenen fiziksel Ethernet MAC adresi: {mac}')
                endpoint_macs.add(mac); d['mac']=mac
            elif mapped:
                notes.append(f'{name}: kaynak Ethernet MAC adresi yok; motor sentetik MAC kullanır, statik port-security kuralıyla eşleşme garanti edilmez.')
            endpoint_ports.append({'device':name,'sourceWiredPortCount':len(wired) if modules else None,'modeledPort':'eth0' if mapped else None,'sourcePortType':text(address,'TYPE') if wired else None,'sourceMac':d.get('mac')})
            if not mapped:
                unmapped_endpoints.add(d['id'])
                notes.append(f'{name}: {len(wired)} Ethernet NIC bulundu; tek kablolu NIC eşlemesi yapılamadığı için endpoint adresi/portu modellenmedi ve bağlantıları atlandı.')
            if kind=='Server': d['services']={'dhcp':False,'dns':False,'http':False}
        if ref: ref_to_id[ref]=d['id']
        raw_devices.append(d)
    links=[]; source_link_count=len(network.find('LINKS')); skipped_links=[]; source_links=[]
    for link_index,link in enumerate(network.find('LINKS'),1):
        cable=link.find('CABLE')
        if cable is None:
            skipped_links.append({'index':link_index,'reason':'CABLE kaydı yok'})
            continue
        a_ref=text(cable,'FROM').replace('save-ref-id:',''); b_ref=text(cable,'TO').replace('save-ref-id:','')
        a,b=ref_to_id.get(a_ref),ref_to_id.get(b_ref)
        if not a or not b:
            reason='Desteklenmeyen cihaz nedeniyle bağlantı atlandı.'
            notes.append(reason); skipped_links.append({'index':link_index,'reason':reason,'fromRef':a_ref,'toRef':b_ref}); continue
        if a in unmapped_endpoints or b in unmapped_endpoints:
            skipped_links.append({'index':link_index,'reason':'Endpoint NIC envanteri tek fiziksel Ethernet portuna eşlenemedi.','fromRef':a_ref,'toRef':b_ref}); continue
        da=next(d for d in raw_devices if d['id']==a); db=next(d for d in raw_devices if d['id']==b)
        pa,pb=norm_port(text(cable,'PORT'),da['type']),norm_port(text(cable,'PORT', '' ),db['type'])
        # The cable contains two PORT siblings, so read them in order.
        pnodes=cable.findall('PORT'); pa=norm_port((pnodes[0].text or '') if pnodes else '',da['type']); pb=norm_port((pnodes[1].text or '') if len(pnodes)>1 else '',db['type'])
        # Normalize only the single wired endpoint port, not arbitrary NIC indices.
        if da['type'] in ('PC','Server') and pa in ('fa0','g0','gi0','eth0'): pa='eth0'
        if db['type'] in ('PC','Server') and pb in ('fa0','g0','gi0','eth0'): pb='eth0'
        # Reject unsupported endpoints rather than creating broken links.
        if pa not in da['ports'] or pb not in db['ports']:
            reason=f'Port eşleşmedi, bağlantı atlandı: {da["name"]}/{pa} ↔ {db["name"]}/{pb}.'
            notes.append(reason); skipped_links.append({'index':link_index,'reason':reason,'from':da['name'],'fromPort':pa,'to':db['name'],'toPort':pb}); continue
        link_obj={'a':a,'b':b,'portA':pa,'portB':pb,'up':text(cable,'FUNCTIONAL','true').lower()=='true'}
        links.append(link_obj)
        source_links.append({'index':link_index,'from':da['name'],'fromPort':pa,'to':db['name'],'toPort':pb,'functional':link_obj['up'],'imported':True})
    if not raw_devices: raise PacketTracerError('Desteklenen cihaz bulunamadı.')
    ids={d['id'] for d in raw_devices}
    # Source-level accounting is explicit: unsupported nodes/links and unmodeled
    # IOS semantics must never silently look like a lossless conversion.
    cfg_devices=[d for d in raw_devices if d.get('config',{}).get('runningConfig')]
    # Be conservative: only mark CLI commands as modeled when the converter
    # actually maps their semantics into AgLab fields. Preserve every source
    # line verbatim in runningConfig and list all remaining non-empty commands.
    unmodeled_config_lines=[]
    for d in raw_devices:
        cfg=d.get('config',{}).get('runningConfig','')
        if not cfg: continue
        current_kind=d['type']
        current_interface=None; report_vlan=None
        for line_no,line in enumerate(cfg.splitlines(),1):
            raw=line.strip()
            interface=re.fullmatch(r'interface\s+(\S+)',raw,re.I)
            if re.match(r'interface\b',raw,re.I):
                current_interface=norm_port(interface.group(1),current_kind) if interface else None
                report_vlan=None
            range_members=switch_range_contexts.get(d['id'],{}).get(line_no)
            if range_members: current_interface=range_members[0]
            vlan_line=re.fullmatch(r'vlan\s+(\d+)',raw,re.I)
            if vlan_line: report_vlan=int(vlan_line.group(1)); current_interface=None
            if current_kind=='Switch' and (re.fullmatch(r'ip default-gateway\s+\d+(?:\.\d+){3}',raw,re.I) or re.match(r'spanning-tree vlan\s+[\d, -]+\s+priority\s+\d+',raw,re.I)):
                current_interface=None; report_vlan=None
            if not raw or raw in ('!','end','exit'):
                current_interface=None; report_vlan=None; continue
            modeled=False
            if current_kind=='Router':
                modeled=bool(re.match(r'^(?:interface\s+\S+|ip address\s+\d+(?:\.\d+){3}\s+\d+(?:\.\d+){3}|shutdown|no shutdown|ip route\s+\d+(?:\.\d+){3}\s+\d+(?:\.\d+){3}\s+\d+(?:\.\d+){3}(?:\s+\d+)?)$',raw,re.I))
                if dot1q_vlan(raw) is not None and d['interfaces'].get(current_interface,{}).get('parent'):
                    modeled=True
            elif current_kind=='Switch':
                modeled=bool(re.match(r'^(?:interface\s+\S+|vlan\s+\d+|switchport access vlan\s+\d+|switchport mode (?:access|trunk)|switchport trunk allowed vlan\s+[\d, -]+|switchport trunk native vlan\s+\d+|shutdown|no shutdown|spanning-tree vlan\s+[\d, -]+\s+priority\s+\d+)$',raw,re.I))
                if range_members: modeled=True
                trunk=re.match(r'^switchport trunk allowed vlan\s+(.+)$',raw,re.I)
                if trunk: modeled=parse_trunk_allowed(trunk.group(1)) is not None
                if current_interface and current_interface.startswith('vlan'):
                    modeled=current_interface in d['interfaces'] and bool(re.fullmatch(r'(?:interface\s+\S+|ip address\s+\d+(?:\.\d+){3}\s+\d+(?:\.\d+){3}|shutdown|no shutdown)',raw,re.I))
                if re.fullmatch(r'ip default-gateway\s+\d+(?:\.\d+){3}',raw,re.I): modeled=True
                named=re.fullmatch(r'name\s+(.+)',raw,re.I)
                if named: modeled=report_vlan in d['vlans'] and 1 <= len(named.group(1)) <= 32 and not re.search(r'[\x00-\x1f\x7f]',named.group(1))

            if re.match(r'(?:no\s+)?switchport\s+port-security\b',raw,re.I):
                modeled=line_no in switch_security_lines.get(d['id'],set())

            if re.match(r'(?:no\s+)?ip\s+helper-address\b',raw,re.I):
                modeled=line_no in router_helper_lines.get(d['id'],set())

            interface_command=bool(re.match(r'interface\b',raw,re.I))
            port_command=bool(re.match(r'(?:ip address\b|encapsulation\b|switchport\b|shutdown$|no shutdown$)',raw,re.I))
            if interface_command or port_command:
                modeled=modeled and current_interface in d['interfaces']

            if not modeled:
                unmodeled_config_lines.append({'device':d['name'],'line':line_no,'command':raw})
    report={
      'sourceRoot':root.tag,'sourceVersion':text(root,'VERSION'),
      'sourceDeviceCount':len(network.find('DEVICES')),'devicesImported':len(raw_devices),
      'unsupportedDevices':unsupported,'sourceLinkCount':source_link_count,
      'linksImported':len(links),'skippedLinks':skipped_links,'sourceLinks':source_links,
      'notes':sorted(set(notes)),'endpointPorts':endpoint_ports,
      'unmodeledConfigLineCount':len(unmodeled_config_lines),
      'unmodeledConfigLines':unmodeled_config_lines,
      'runningConfigPreservedFor':{d['name']:bool(d.get('config',{}).get('runningConfig')) for d in raw_devices},
      'simulationCoverage':{
        'modeled':'Topoloji bağlantıları, cihaz türü/model etiketi, koordinatlar, tek Ethernet NIC PC/Server IPv4/mask/gateway, fiziksel MAC ve port POWER, router fiziksel ve etiketli 802.1Q alt arayüz IPv4/mask/shutdown, alt arayüz parent/VLAN eşlemesi, IPv4 statik rota, router DHCP relay için tek IPv4 helper hedefi, switch yönetim SVI IP/mask/shutdown ve default-gateway, VLAN isimleri, temel switch port-security (enabled/maximum/violation/statik MAC), switch fiziksel interface range (mevcut portlar, liste/aynı-prefix aralık) ve access/trunk modu, access VLAN ve trunk allowed VLAN (kaynak configte varsa); VLAN veritabanı açık vlan <ID> satırlarından ayrıştırılır.',
        'preservedButNotFullySimulated':'Tam running-config metni config.runningConfig alanında saklanır; bu, tüm IOS komutlarının AğLab motorunda çalıştığı anlamına gelmez.',
        'notModeled':['IOS sürüm/feature davranışları','DHCP çoklu helper/VRF, sunucu havuzu ve UDP forwarding ayrıntıları','duplex/speed ve kablo türü/medya ayrıntıları','STP zamanlaması, root bridge seçim algoritmasının tam davranışı ve tüm STP durum geçişleri','Çoklu NIC ve Ethernet dışı endpoint arayüzleri','Layer 3 switch routing (SVI yalnız yönetim endpointidir)','Router alt arayüzlerinde native VLAN ve ISL encapsulation','Port-security sticky/aging, violation sayaçlarının kaynak runtime durumu ve recovery timer', 'Router/switch fiziksel port MAC adresleri (motor cihaz başına sentetik MAC kullanır)', 'güç dağıtım cihazının davranışı','kaynak dosyada yer alıp AğLab modeline eşlenmeyen diğer cihaz/protokol özellikleri']
      },
      'routerRoutes':{d['name']:d.get('staticRoutes',[]) for d in raw_devices if d['type']=='Router'},
      'endpoints':[{k:d.get(k) for k in ['name','type','ip','mask','gateway']} for d in raw_devices if d['type'] in ('PC','Server')]
    }
    obj={'app':'AgLab','version':23,'devices':raw_devices,'links':links,'nextId':len(raw_devices)+1,'selected':raw_devices[0]['id'],'importReport':report}
    # Lossless recovery archive: retain the original binary and decoded XML
    # alongside the normalized simulation model. The simulator may ignore these
    # fields, but no source bytes need to be discarded by conversion.
    obj['sourceArchive']={
      'format':'Cisco Packet Tracer .pkt + decoded PACKETTRACER5 XML',
      'originalPacketBase64':base64.b64encode(original_pkt).decode('ascii') if original_pkt is not None else None,
      'originalPacketBytes':len(original_pkt) if original_pkt is not None else None,
      'originalPacketSha256':hashlib.sha256(original_pkt).hexdigest() if original_pkt is not None else None,
      'decodedXmlBase64':base64.b64encode(xml_bytes).decode('ascii'),
      'decodedXmlBytes':len(xml_bytes),
      'decodedXmlSha256':hashlib.sha256(xml_bytes).hexdigest(),
      'preservationNote':'Arşiv kaynak veriyi korur; AğLab simülasyon motorunun tüm Packet Tracer özelliklerini uyguladığı anlamına gelmez.'
    }
    report['sourceArchive']={k:v for k,v in obj['sourceArchive'].items() if k not in ('originalPacketBase64','decodedXmlBase64')}
    return obj,report

def main():
    ap=argparse.ArgumentParser(description='Packet Tracer .pkt → AğLab JSON dönüştürücü')
    ap.add_argument('pkt',help='Kaynak .pkt dosyası'); ap.add_argument('-o','--output',help='JSON çıktı yolu')
    ap.add_argument('--report',help='İsteğe bağlı rapor JSON yolu')
    args=ap.parse_args(); src=Path(args.pkt); out=Path(args.output) if args.output else src.with_suffix('.aglab.json')
    paths=[src,out]+([Path(args.report)] if args.report else [])
    for index,left in enumerate(paths):
        for right in paths[index+1:]:
            if left.resolve()==right.resolve() or (left.exists() and right.exists() and left.samefile(right)):
                raise PacketTracerError('Kaynak PKT, JSON çıktı ve rapor farklı dosyalar olmalıdır.')
    original=src.read_bytes(); xml=decrypt_pkt(original); obj,report=convert(xml,original); out.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'OK: {out} — {report["devicesImported"]} cihaz, {report["linksImported"]} bağlantı')
    print('Statik rotalar:',json.dumps(report['routerRoutes'],ensure_ascii=False))
    if report['unsupportedDevices']: print('Atlanan cihazlar:',', '.join(report['unsupportedDevices']))
    if report['notes']: print('Notlar:', '; '.join(report['notes']))
    print('Model dışı CLI satırları:', report['unmodeledConfigLineCount'])
    print('Kaynak arşivi SHA-256:', report['sourceArchive']['originalPacketSha256'] if report.get('sourceArchive') else 'yok')
    if args.report: Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if __name__=='__main__':
    try: main()
    except (PacketTracerError, OSError, ValueError, ET.ParseError, zlib.error) as e: raise SystemExit(f'HATA: {e}')
