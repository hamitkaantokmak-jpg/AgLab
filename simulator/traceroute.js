// ICMP Echo probes walk one selected L2 neighbor at a time; no whole-path oracle.
function traceRouteLeaf(route){while(route?.resolvedVia==='recursive'&&route.resolution)route=route.resolution;return route}
function traceRouterVlan(router,route,targetIp,fallback){
 const iface=router.interfaces?.[route.iface],physical=iface?.parent||route.iface?.split('.')[0];
 const edge=links.find(link=>linkUp(link)&&(link.a===router.id||link.b===router.id)&&linkPort(link,router.id)===physical);
 return {physical,edge,vlan:edge?routerEgressVlan(router,edge,targetIp,fallback):fallback};
}
function traceUnresolvedArp(sender,address,vlan,port,context){
 ethernetEvent('arp-unresolved '+sender.id+' target '+address);
 transmitEthernet(sender,'ff:ff:ff:ff:ff:ff',vlan,'arp-request',context,{sourcePort:sender.type==='Switch'?null:port});
}
function traceProbe(origin,targetIp,initialTtl){
 const source=origin.type==='Switch'?switchManagementAddress(origin,targetIp):origin.type==='Router'?origin.interfaces?.[routeLookup(origin,targetIp).route?.iface]||activeRouterInterfaces(origin).find(([,iface])=>iface.ip===targetIp)?.[1]:origin;
 if(!source?.ip||!validIP(source.ip)||prefixLen(source.mask)<0)return {localError:true,why:'Kaynakta etkin ve geçerli IP/SVI veya çıkış rotası yok.'};
 const sourceIp=source.ip,context=ethernetContext();let current=origin,ttl=initialTtl,incomingIp=sourceIp,incomingPort=null,vlan=origin.type==='Switch'?Number(source.vlan):endpointVlan(origin.id);
 for(let step=0;step<=initialTtl;step++){
  if(routingIpBindings(targetIp).some(binding=>binding.id===current.id)){
   if(current.id===origin.id)return {ok:true};
   const management=origin.type==='Switch',svi=management?switchManagementAddress(origin,sourceIp,true):null;
   const replyPath=findPath(current.id,origin.id,current.type==='Switch'?switchManagementAddress(current,targetIp,true)?.vlan:endpointVlan(current.id),sourceIp,true,management?{management:true,targetVlan:svi?.vlan}:{});
   if(!replyPath?.length)return {ok:false};
   const reply=deliverRoutedFrames(current,replyPath,targetIp,sourceIp,'icmp-reply',context,{ttl:64});return {ok:reply.ok};
  }
  let hop,expectedPort=null;
  if(current.type==='Router'){
   if(step>0){const previous=ttl;ttl--;ethernetEvent('ttl-forward '+current.id+' '+previous+' -> '+ttl);if(ttl<=0)return icmpTimeExceeded(current,origin,sourceIp,targetIp,incomingIp,context,'icmp-request');}
   const lookup=routeLookup(current,targetIp);if(!lookup.ok){ethernetEvent('trace-no-route '+current.id+' target '+targetIp);return {ok:false};}
   const egress=traceRouterVlan(current,lookup.route,targetIp,vlan);if(!egress.edge)return {ok:false};
   expectedPort=egress.physical;vlan=egress.vlan;
   if(incomingPort&&current.interfaces?.[incomingPort]?.natRole==='inside'&&(current.interfaces?.[lookup.route.iface]?.natRole||current.interfaces?.[egress.physical]?.natRole)==='outside')return {unsupported:true,why:'NAT/PAT çevrili akışlarda TTL traceroute henüz desteklenmiyor.'};
   hop=routingWireHop(current,targetIp);
   if(!hop){const leaf=traceRouteLeaf(lookup.route),address=leaf.type==='connected'?targetIp:leaf.nextHop;traceUnresolvedArp(current,address,vlan,expectedPort,context);return {ok:false};}
  }else{
   const local=inNetwork(targetIp,source.ip,source.mask),address=local?targetIp:current.gateway;
   if(!local&&(!address||!inNetwork(address,source.ip,source.mask)))return {localError:true,why:'Uzak hedef için yerel alt ağda bir varsayılan gateway gerekli.'};
   const matches=routingIpBindings(address).filter(binding=>local||get(binding.id)?.type==='Router');
   if(matches.length!==1){traceUnresolvedArp(current,address,vlan,current.ports?.[0],context);return {ok:false};}
   hop=matches[0];
  }
  const target=get(hop.id),management=current.type==='Switch'||target?.type==='Switch';
  const segment=findPath(current.id,hop.id,vlan,hop.ip,true,management?{management:true,...(target.type==='Switch'?{targetVlan:hop.vlan}:{})}:{});
  if(!segment?.length||expectedPort&&(linkPort(segment[0],current.id)!==expectedPort||Number(segment.vlans?.[0])!==Number(vlan)))return {ok:false};
  if(orderedPathNodes(current.id,segment).slice(1,-1).some(device=>device.type!=='Switch'))return {ok:false};
  if(hop.physical&&linkPort(segment.at(-1),hop.id)!==hop.physical)return {ok:false};
  const delivered=deliverRoutedFrames(current,segment,sourceIp,targetIp,'icmp-request',context,{ttl});if(!delivered.ok)return {ok:false};
  incomingPort=linkPort(segment.at(-1),hop.id);incomingIp=hop.ip;vlan=segment.vlans?.at(-1)??vlan;current=target;
 }
 return {ok:false};
}
function tracerouteCommand(device,parts,out){
 if(!['trace','traceroute','tracert'].includes(parts[0]))return false;
 const limit=parts.length===2?30:Number(parts[3]);
 if(!validIP(parts[1])||!(parts.length===2||parts.length===4&&parts[2]==='max-hops'&&/^[1-9]\d?$/.test(parts[3])&&limit<=64)){
  out('Kullanım: trace|traceroute|tracert <IPv4> [max-hops <1-64>]','outerr');return true;
 }
 if(device.enabled===false){out('Kaynak cihaz kapalı.','outerr');return true;}
 beginEthernetEvents();out('ICMP traceroute: '+device.name+' → '+parts[1]+'; en çok '+limit+' IP atlaması, TTL başına bir probe.');
 for(let ttl=1;ttl<=limit;ttl++){
  ethernetEvent('trace-probe ttl '+ttl+' target '+parts[1]);const result=traceProbe(device,parts[1],ttl);
  if(result.unsupported||result.localError){out(result.why,'outerr');return true;}
  if(result.ok){out(ttl+'  '+parts[1]+'  Echo Reply','outok');out('Hedefe ulaşılabilir. Echo Reply kaynağa ulaştı.','outok');return true;}
  if(result.expired&&result.icmpDelivered)out(ttl+'  '+result.routerIp+'  '+get(result.routerId)?.name+'  Time Exceeded','outinfo');
  else out(ttl+'  *','outinfo');
 }
 out('Hop sınırına ulaşıldı; hedefe ulaşıldığı doğrulanamadı.','outerr');return true;
}
