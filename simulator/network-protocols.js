// Deterministic teaching model: single-area OSPF components and directly peered eBGP.
// No timers, LSDB, policy, authentication, redistribution or real protocol packets.
function protocolNumber(token,max=4294967295){return /^\d+$/.test(String(token))&&Number(token)>0&&Number(token)<=max?Number(token):null}
function protocolObject(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k))}
function validateRoutingProtocols(d){
 if((d.ospf!==undefined||d.bgp!==undefined)&&d.type!=='Router')throw new Error('OSPF/BGP yalnızca Router üzerinde kullanılabilir.');
 if(d.ospf!==undefined){const o=d.ospf;
  if(!protocolObject(o,['pid','routerId','networks'])||typeof o.pid!=='number'||!protocolNumber(o.pid,65535)||o.routerId!==''&&!validIP(o.routerId)||!Array.isArray(o.networks)||o.networks.length>256)throw new Error('Geçersiz OSPF yapılandırması.');
  for(const n of o.networks)if(!protocolObject(n,['network','wildcard','area'])||!validIP(n.network)||!validIP(n.wildcard)||prefixLen(maskFromWildcard(n.wildcard))<0||!Number.isInteger(n.area)||n.area<0||n.area>4294967295)throw new Error('Geçersiz OSPF network/wildcard/area.');
 }
 if(d.bgp!==undefined){const b=d.bgp;
  if(!protocolObject(b,['asn','neighbors','networks'])||typeof b.asn!=='number'||!protocolNumber(b.asn)||!Array.isArray(b.neighbors)||b.neighbors.length>256||!Array.isArray(b.networks)||b.networks.length>256)throw new Error('Geçersiz BGP yapılandırması.');
  const seen=new Set();for(const n of b.neighbors){if(!protocolObject(n,['ip','remoteAs'])||!validIP(n.ip)||typeof n.remoteAs!=='number'||!protocolNumber(n.remoteAs)||seen.has(n.ip))throw new Error('Geçersiz/yinelenen BGP komşusu.');seen.add(n.ip);}
  for(const n of b.networks)if(!protocolObject(n,['network','mask'])||!validIP(n.network)||prefixLen(n.mask)<0||subnet(n.network,n.mask)!==n.network)throw new Error('Geçersiz BGP network/mask.');
 }
}
function ospfArea(r,i){return r.ospf?.networks.find(n=>inNetwork(i.ip,n.network,maskFromWildcard(n.wildcard)))?.area}
function protocolWireVlan(r,name,i){
 if(i.encapsulation==='dot1q')return Number(i.vlan);
 const port=i.parent||name,edge=links.find(l=>(l.a===r.id&&l.portA===port)||(l.b===r.id&&l.portB===port));
 const other=edge&&get(edge.a===r.id?edge.b:edge.a),sp=other?.type==='Switch'?portState(other,linkPort(edge,other.id)):null;
 return sp?(sp.mode==='trunk'?Number(sp.nativeVlan??1):Number(sp.vlan)):1;
}
function protocolL2Reachable(a,an,ai,b,bn,bi){
 const vlan=protocolWireVlan(a,an,ai);if(vlan!==protocolWireVlan(b,bn,bi))return false;
 const sourcePort=ai.parent||an,targetPort=bi.parent||bn,queue=[a.id],seen=new Set(queue),trees=new Map();
 for(let index=0;index<queue.length;index++)for(const edge of links){
  const id=queue[index];if(edge.a!==id&&edge.b!==id||!linkUp(edge))continue;
  if(id===a.id&&linkPort(edge,id)!==sourcePort)continue;
  const next=edge.a===id?edge.b:edge.a;
  if(next===b.id&&linkPort(edge,next)!==targetPort)continue;
  if(!linkCarriesVlan(edge,vlan).ok||stpIsBlocked(edge,vlan,trees))continue;
  if(next===b.id)return true;
  if(get(next)?.type!=='Switch'||seen.has(next))continue;seen.add(next);queue.push(next);
 }
 return false;
}
function protocolPeers(kind){
 const routers=devices.filter(r=>r.type==='Router'&&r.enabled!==false),rows=[];
 for(let x=0;x<routers.length;x++)for(let y=x+1;y<routers.length;y++){
  const a=routers[x],b=routers[y];
  if(kind==='ospf'&&!a.ospf&&!b.ospf||kind==='bgp'&&!a.bgp&&!b.bgp)continue;
  for(const [an,ai] of activeRouterInterfaces(a))for(const [bn,bi] of activeRouterInterfaces(b)){
   if(!protocolL2Reachable(a,an,ai,b,bn,bi))continue;
   let reason='';
   if(ai.mask!==bi.mask)reason='subnet maskesi uyuşmazlığı';
   else if(!inNetwork(ai.ip,bi.ip,bi.mask))reason='IP alt ağı uyuşmazlığı';
   const aa=ospfArea(a,ai),ba=ospfArea(b,bi);
   if(kind==='ospf'){
    if(!a.ospf||!b.ospf)reason=reason||'OSPF yapılandırması yok';
    else if(aa===undefined||ba===undefined)reason=reason||'OSPF network kapsamı eksik';
    else if(aa!==ba)reason=reason||'area uyuşmazlığı ('+aa+' / '+ba+')';
    else if(a.ospf.routerId&&a.ospf.routerId===b.ospf.routerId)reason=reason||'router-id çakışması';
   }else{
    const ab=a.bgp?.neighbors.find(n=>n.ip===bi.ip),back=b.bgp?.neighbors.find(n=>n.ip===ai.ip);
    if(!ab||!back)reason=reason||'karşılıklı neighbor tanımı eksik';
    else if(ab.remoteAs!==b.bgp.asn||back.remoteAs!==a.bgp.asn)reason=reason||'remote-as uyuşmazlığı';
    else if(a.bgp.asn===b.bgp.asn)reason=reason||'iBGP bu eğitim modelinde desteklenmiyor';
   }
   rows.push({a,b,an,bn,ai,bi,area:aa,ok:!reason,reason});
  }
 }
 return rows;
}
function dynamicRoutes(router){
 if(!router.ospf&&!router.bgp)return [];
 const result=[];
 for(const kind of ['ospf','bgp']){
  if(!router[kind])continue;
  const edges=protocolPeers(kind).filter(p=>p.ok),queue=[{r:router,first:null,hops:0,area:null,ases:[router.bgp?.asn]}],seen=new Set([router.id+'|null']);
  for(let index=0;index<queue.length;index++){
   const state=queue[index];
   if(state.first){
    for(const [name,i] of activeRouterInterfaces(state.r)){
     const network=subnet(i.ip,i.mask);
     const advertised=kind==='ospf'?ospfArea(state.r,i)===state.area:state.r.bgp?.networks.some(n=>n.network===network&&n.mask===i.mask);
     if(!advertised||connectedRoutes(router).some(c=>c.network===network&&c.mask===i.mask))continue;
     result.push({network,mask:i.mask,prefix:prefixLen(i.mask),nextHop:state.first.ip,iface:state.first.iface,type:kind,distance:kind==='ospf'?110:20,metric:state.hops,origin:state.r.id});
    }
   }
   for(const edge of edges){
    const forward=edge.a.id===state.r.id,reverse=edge.b.id===state.r.id;if(!forward&&!reverse)continue;
    const next=forward?edge.b:edge.a,area=kind==='ospf'?edge.area:null;
    if(kind==='ospf'&&state.area!==null&&state.area!==area)continue;
    if(kind==='bgp'&&state.ases.includes(next.bgp.asn))continue;
    const key=next.id+'|'+area;if(seen.has(key))continue;seen.add(key);
    queue.push({r:next,first:state.first||{ip:forward?edge.bi.ip:edge.ai.ip,iface:forward?edge.an:edge.bn},hops:state.hops+1,area,ases:state.ases.concat(next.bgp?.asn)});
   }
  }
 }
 return result;
}
function routingProtocolConfigurationLines(d){
 const result=[];
 if(d.ospf){result.push('router ospf '+d.ospf.pid);if(d.ospf.routerId)result.push(' router-id '+d.ospf.routerId);for(const n of d.ospf.networks)result.push(' network '+n.network+' '+n.wildcard+' area '+n.area);}
 if(d.bgp){result.push('router bgp '+d.bgp.asn);for(const n of d.bgp.neighbors)result.push(' neighbor '+n.ip+' remote-as '+n.remoteAs);for(const n of d.bgp.networks)result.push(' network '+n.network+' mask '+n.mask);}
 return result;
}
function dhcpDiscoveryPath(source,server){
 const vlan=endpointVlan(source.id,Number(source.vlan)||10);
 const l2Only=path=>path&&orderedPathNodes(source.id,path).slice(1,-1).every(d=>d?.type==='Switch');
 const local=findPath(source.id,server.id,vlan,null,true,{l2Only:true});
 if(l2Only(local))return {server,path:local,local:true};
 for(const router of devices.filter(d=>d.type==='Router'))for(const [name,iface] of activeRouterInterfaces(router)){
  if(iface.helperAddress!==server.ip)continue;
  const physical=iface.parent||name,wire=links.find(l=>(l.a===router.id&&l.portA===physical)||(l.b===router.id&&l.portB===physical));
  const peer=wire&&get(wire.a===router.id?wire.b:wire.a);
  if((iface.encapsulation==='dot1q'||peer?.type==='Switch')&&protocolWireVlan(router,name,iface)!==vlan)continue;
  const discover=findPath(source.id,router.id,vlan,null,true,{l2Only:true,targetPort:physical});
  if(!l2Only(discover)||!discover.length||linkPort(discover.at(-1),router.id)!==(iface.parent||name))continue;
  const onward=findPath(router.id,server.id,vlan,server.ip,true);if(!onward)continue;
  const path=discover.concat(onward);path.vlans=(discover.vlans||[]).concat(onward.vlans||[]);
  return {server,path,local:false,relay:{router,iface}};
 }
 return null;
}
function routingProtocolCommand(d,p,out){
 const emit=(text,error=false)=>{out(text,error?'outerr':'outok');return true},changed=text=>{saveTopology(true);updatePrompt();return emit(text)};
 if(p[0]==='show'&&p[1]==='ip'&&((p[2]==='ospf')||(p[2]==='bgp'))){
  if(d.type!=='Router')return emit('Bu tanı Router üzerinde kullanılabilir.',true);
  const kind=p[2],supported=kind==='ospf'?p.join(' ')==='show ip ospf neighbor':['show ip bgp summary','show ip bgp'].includes(p.join(' '));
  if(!supported)return emit('Desteklenen: show ip ospf neighbor | show ip bgp summary | show ip bgp. LSDB/policy/timer modeli yok.',true);
  if(p.join(' ')==='show ip bgp'){dynamicRoutes(d).filter(r=>r.type==='bgp').forEach(r=>out('B '+r.network+'/'+r.prefix+' via '+r.nextHop));return true;}
  out(kind==='ospf'?'Neighbor / State / Interface / Neden':'Neighbor / AS / State / Neden');
  const peers=protocolPeers(kind).filter(e=>e.a.id===d.id||e.b.id===d.id);
  peers.forEach(e=>{const forward=e.a.id===d.id,other=forward?e.b:e.a;out((forward?e.bi.ip:e.ai.ip)+' '+(kind==='bgp'?(other.bgp?.asn??'?')+' ':'')+(e.ok?(kind==='ospf'?'FULL':'Established'):'Down')+' '+(forward?e.an:e.bn)+(e.reason?' — '+e.reason:''));});
  if(!peers.length)out('Komşu yok: etkin L2 bağlantısını, IP/maskeyi ve protokol yapılandırmasını kontrol et.');return true;
 }
 if(p[0]==='router'&&['ospf','bgp'].includes(p[1])){
  if(d.type!=='Router'||cliMode!=='config'||p.length!==3)return emit('Router configure terminal modunda router ospf <PID> veya router bgp <AS> kullan.',true);
  const n=protocolNumber(p[2],p[1]==='ospf'?65535:4294967295);if(!n)return emit('Geçersiz process/AS numarası.',true);
  if(p[1]==='ospf'){d.ospf={pid:n,routerId:d.ospf?.routerId||'',networks:d.ospf?.networks||[]};cliMode='ospf';}
  else{d.bgp={asn:n,neighbors:d.bgp?.neighbors||[],networks:d.bgp?.networks||[]};cliMode='bgp';}
  return changed('Eğitim protokol modu: '+p[1].toUpperCase()+'. Anlık yakınsama; timer/policy/LSDB ve iBGP desteklenmez.');
 }
 if(['ospf','bgp'].includes(cliMode)){
  const kind=cliMode;if(p[0]==='end')return false;if(p[0]==='exit'){cliMode='config';updatePrompt();return true;}
  if(kind==='ospf'&&p[0]==='router-id'&&p.length===2&&validIP(p[1])){d.ospf.routerId=p[1];return changed('OSPF router-id ayarlandı.');}
  const removing=p[0]==='no',args=removing?p.slice(1):p;
  if(kind==='ospf'&&args[0]==='network'){
   const [_,network,wildcard,areaWord,areaToken]=args,area=Number(areaToken);
   if(args.length!==5||!validIP(network)||!validIP(wildcard)||prefixLen(maskFromWildcard(wildcard))<0||areaWord!=='area'||!/^\d+$/.test(areaToken)||area<0||area>4294967295)return emit('network <IP> <WILDCARD> area <0-4294967295>',true);
   d.ospf.networks=d.ospf.networks.filter(n=>!(n.network===network&&n.wildcard===wildcard&&(removing?n.area===area:true)));
   if(!removing)d.ospf.networks.push({network,wildcard,area});return changed('OSPF network güncellendi.');
  }
  if(kind==='bgp'&&args[0]==='neighbor'){
   if(args.length!==4||!validIP(args[1])||args[2]!=='remote-as'||!protocolNumber(args[3]))return emit('neighbor <IP> remote-as <AS>',true);
   d.bgp.neighbors=d.bgp.neighbors.filter(n=>n.ip!==args[1]);if(!removing)d.bgp.neighbors.push({ip:args[1],remoteAs:Number(args[3])});return changed('BGP neighbor güncellendi.');
  }
  if(kind==='bgp'&&args[0]==='network'){
   const network=args[1],mask=args[3];if(args.length!==4||args[2]!=='mask'||!validIP(network)||prefixLen(mask)<0||subnet(network,mask)!==network)return emit('network <NETWORK> mask <MASK>; bu model etkin bağlı ağları ilan eder.',true);
   d.bgp.networks=d.bgp.networks.filter(n=>n.network!==network||n.mask!==mask);if(!removing)d.bgp.networks.push({network,mask});return changed('BGP network güncellendi.');
  }
  return emit('Bu protokol modunda komut desteklenmiyor. network / neighbor / router-id / exit / end kullan.',true);
 }
 return false;
}
