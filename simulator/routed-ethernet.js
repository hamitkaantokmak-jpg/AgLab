// Execute each selected IP hop as an independently addressed Ethernet segment.
function routedPortAddress(device,port,vlan,endpointIp){
 if(device.type==='Switch')return activeSwitchSvis(device).map(([,iface])=>iface).find(iface=>Number(iface.vlan)===Number(vlan)&&(!endpointIp||iface.ip===endpointIp))?.ip||null;
 if(device.type!=='Router')return device.ip;
 const interfaces=activeRouterInterfaces(device);
 const preferred=interfaces.find(([name,iface])=>iface.ip===endpointIp&&(iface.parent||name.split('.')[0])===port);if(preferred)return preferred[1].ip;
 return interfaces.find(([name,iface])=>(iface.parent||name.split('.')[0])===port&&iface.encapsulation==='dot1q'&&Number(iface.vlan)===Number(vlan))?.[1].ip||interfaces.find(([name])=>name===port)?.[1].ip||null;
}
function routedFrameSegments(source,path,sourceIp,targetIp){
 const segments=[];let current=source,segmentSource=source,first=0;
 for(let index=0;index<path.length;index++){
  const edge=path[index],next=get(edge.a===current.id?edge.b:edge.a);
  if(!next)return null;
  if(next.type==='Router'||index===path.length-1){
   const vlan=path.vlans?.[first]??endpointVlan(segmentSource.id),sourcePort=linkPort(path[first],segmentSource.id),targetPort=linkPort(edge,next.id);
   const outgoing=segmentSource.type==='Router'?segmentSource.interfaces?.[routeLookup(segmentSource,targetIp).route?.iface]?.ip:segmentSource.id===source.id?sourceIp:null;
   const selectedNeighbor=segmentSource.type==='Router'?routingWireHop(segmentSource,targetIp)?.ip:routingSourceHop(segmentSource,targetIp)?.ip;
   const localIp=routedPortAddress(segmentSource,sourcePort,vlan,outgoing),neighborIp=routedPortAddress(next,targetPort,vlan,selectedNeighbor||(index===path.length-1?targetIp:null));
   if(!localIp||!neighborIp)return null;
   segments.push({source:segmentSource,target:next,sourcePort,targetPort,vlan,localIp,neighborIp});segmentSource=next;first=index+1;
  }
  current=next;
 }
 return segments;
}
function deliverRoutedFrames(source,path,sourceIp,targetIp,kind,context){
 const segments=routedFrameSegments(source,path,sourceIp,targetIp);if(!segments?.length)return {ok:false,why:'Seçili yol için etkin Ethernet/IP arayüzü çözümlenemedi.'};
 for(const segment of segments){
  const {source:sender,target,sourcePort,targetPort,vlan,localIp,neighborIp}=segment;
  const options={sourcePort:sender.type==='Switch'?null:sourcePort,targetId:target.id,targetPort:target.type==='Switch'?null:targetPort};
  const reverse={sourcePort:target.type==='Switch'?null:targetPort,targetId:sender.id,targetPort:sender.type==='Switch'?null:sourcePort};
  const arp=arpTables.get(sender.id)||new Map(),neighborArp=arpTables.get(target.id)||new Map();
  if(sender.type==='Router')ethernetEvent('forward '+sender.id+' egress '+sourcePort+' next-hop '+neighborIp+' ip '+sourceIp+' -> '+targetIp);
  if(arp.get(neighborIp)!==macOf(target)){
   const request=transmitEthernet(sender,'ff:ff:ff:ff:ff:ff',vlan,'arp-request',context,options);
   if(!request.has(target.id))return {ok:false,why:sender.name+' → '+target.name+' ARP isteği seçili komşuya ulaşmadı ('+neighborIp+').'};
   neighborArp.set(localIp,macOf(sender));arpTables.set(target.id,neighborArp);
   const reply=transmitEthernet(target,macOf(sender),vlan,'arp-reply',context,reverse);
   if(!reply.has(sender.id))return {ok:false,why:target.name+' ARP yanıtı '+sender.name+' cihazına ulaşmadı.'};
   arp.set(neighborIp,macOf(target));arpTables.set(sender.id,arp);
  }
  ethernetEvent('packet '+kind+' ip '+sourceIp+' -> '+targetIp+' neighbor '+neighborIp);
  const delivered=transmitEthernet(sender,arp.get(neighborIp),vlan,kind,context,options);
  if(!delivered.has(target.id))return {ok:false,why:sender.name+' → '+target.name+' Ethernet '+kind+' frame seçili komşuya ulaşmadı; MAC/VLAN/port çıkışını kontrol et.'};
 }
 return {ok:true};
}
function routedEthernetPing(source,target,path,replyPath,sourceIp,targetIp){
 const context=ethernetContext(),forward=deliverRoutedFrames(source,path,sourceIp,targetIp,'icmp-request',context);if(!forward.ok)return forward;
 const reply=deliverRoutedFrames(target,replyPath,targetIp,sourceIp,'icmp-reply',context);if(!reply.ok)return {ok:false,why:'Dönüş: '+reply.why};
 return {ok:true,why:'Seçili next-hop ve gerçek dönüş yolu üzerinde ARP/Ethernet ICMP teslimi doğrulandı.'};
}
