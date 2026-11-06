// Shared Ethernet delivery. Routers terminate each frame; routed execution starts a new segment.
let ethernetEvents=[],ethernetEventOverflow=0;
function beginEthernetEvents(){ethernetEvents=[];ethernetEventOverflow=0}
function ethernetEvent(text){if(ethernetEvents.length<256)ethernetEvents.push(text);else ethernetEventOverflow++}
function ethernetContext(){
 const adjacency=new Map(),trees=new Map();
 for(const link of links)for(const id of [link.a,link.b]){if(!adjacency.has(id))adjacency.set(id,[]);adjacency.get(id).push(link)}
 return {adjacency,trees};
}
function ethernetLinkEligible(link,vlan,context){
 if(!linkCarriesVlan(link,vlan).ok||stpIsBlocked(link,vlan,context.trees))return false;
 const a=get(link.a),b=get(link.b),pa=portState(a,link.portA),pb=portState(b,link.portB);
 // An untagged access/endpoint edge can only enter a trunk's native VLAN.
 for(const [d,p,other,op] of [[a,pa,b,pb],[b,pb,a,pa]])if(d?.type==='Switch'&&p?.mode==='trunk'&&(other?.type==='PC'||other?.type==='Server'||other?.type==='Switch'&&op?.mode==='access')&&Number(p.nativeVlan??1)!==Number(vlan))return false;
 return true;
}
function transmitEthernet(source,destinationMac,vlan,kind,context,options={}){
 const delivered=new Set(),seen=new Set(),queue=[{device:source,ingress:null}],broadcast=destinationMac==='ff:ff:ff:ff:ff:ff';
 ethernetEvent('frame '+kind+' src '+source.id+' dst '+destinationMac+' vlan '+vlan);
 for(let index=0;index<queue.length;index++){
  const {device,ingress}=queue[index];if(!device||device.enabled===false||seen.has(device.id))continue;seen.add(device.id);
  if(ingress&&device.type!=='Switch'){
   ethernetEvent('receive '+device.id+' '+kind+' vlan '+vlan);
   if(options.targetId===device.id&&options.targetPort&&linkPort(ingress,device.id)!==options.targetPort){ethernetEvent('discard '+device.id+' ingress-port');continue;}
   if(broadcast||macOf(device)===destinationMac)delivered.add(device.id);else ethernetEvent('discard '+device.id+' destination-mac');
   continue; // Endpoints and routers do not bridge Ethernet frames.
  }
  if(ingress&&device.type==='Switch'){
   if(!portSecurityAllows(device,linkPort(ingress,device.id),source))continue;
   learnSwitchMac(device,source,vlan,linkPort(ingress,device.id));
   if(activeSwitchSvis(device).some(([,iface])=>Number(iface.vlan)===Number(vlan))&&(broadcast||macOf(device)===destinationMac)){
    delivered.add(device.id);ethernetEvent('receive '+device.id+' '+kind+' svi vlan '+vlan);if(!broadcast)continue;
   }
  }
  const candidates=(context.adjacency.get(device.id)||[]).filter(link=>(ingress||!options.sourcePort||linkPort(link,device.id)===options.sourcePort)&&ethernetLinkEligible(link,vlan,context));
  let outputs=candidates.filter(link=>link!==ingress),reason=broadcast?'broadcast':'unknown-unicast';
  if(device.type==='Switch'&&!broadcast){
   const table=switchMacTable(device),key=switchMacKey(vlan,destinationMac),known=table.get(key);
   if(known){
    const edge=candidates.find(link=>linkPort(link,device.id)===known.port);
    if(edge===ingress){outputs=[];reason='filter'}
    else if(edge){outputs=[edge];reason='unicast'}
    else table.delete(key); // Link/VLAN/STP change invalidates an unusable FDB egress.
   }
  }
  if(device.type==='Switch')ethernetEvent(reason+' '+device.id+' ingress '+(ingress?linkPort(ingress,device.id):'local')+' egress '+(outputs.map(link=>linkPort(link,device.id)).join(',')||'-')+' vlan '+vlan);
  for(const edge of outputs)queue.push({device:get(edge.a===device.id?edge.b:edge.a),ingress:edge});
 }
 return delivered;
}
function localEthernetPing(source,target,vlan,ttl=64){
 beginEthernetEvents();const context=ethernetContext(),sourceArp=arpTables.get(source.id)||new Map(),targetArp=arpTables.get(target.id)||new Map();
 if(sourceArp.get(target.ip)!==macOf(target)){
  const request=transmitEthernet(source,'ff:ff:ff:ff:ff:ff',vlan,'arp-request',context);
  if(!request.has(target.id))return {ok:false,why:'ARP broadcast hedefe ulaşmadı; VLAN, port ve STP durumunu kontrol et.'};
  targetArp.set(source.ip,macOf(source));arpTables.set(target.id,targetArp);
  const reply=transmitEthernet(target,macOf(source),vlan,'arp-reply',context);
  if(!reply.has(source.id))return {ok:false,why:'ARP yanıtı kaynağa ulaşmadı.'};
  sourceArp.set(target.ip,macOf(target));arpTables.set(source.id,sourceArp);
 }
 ethernetEvent('packet icmp-request ip '+source.ip+' -> '+target.ip+' ttl '+ttl);
 const request=transmitEthernet(source,sourceArp.get(target.ip),vlan,'icmp-request',context);
 if(!request.has(target.id))return {ok:false,why:'Ethernet ICMP frame hedefe ulaşmadı; MAC tablosu ve VLAN çıkışlarını kontrol et.'};
 const reply=transmitEthernet(target,macOf(source),vlan,'icmp-reply',context);
 if(!reply.has(source.id))return {ok:false,why:'Ethernet ICMP yanıtı kaynağa ulaşmadı.'};
 return {ok:true,why:'Yerel ARP ve Ethernet ICMP gidiş/dönüş iletimi başarılı; MAC tablosuna göre VLAN içi iletim doğrulandı.'};
}
function ethernetCommand(d,p,out){
 if(p[0]==='show'&&p[1]==='ethernet'&&p[2]==='events'){
  if(p.length!==3){out('Kullanım: show ethernet events','outerr');return true}
  out('Son Ethernet işlemi (en çok 256 olay):');if(!ethernetEvents.length)out('Henüz Ethernet olayı yok.');ethernetEvents.forEach(line=>out(line));if(ethernetEventOverflow)out('Ek olay sayısı: '+ethernetEventOverflow);return true;
 }
 if(p[0]!=='test'||p[1]!=='ethernet')return false;
 if(!['PC','Server'].includes(d.type)||d.enabled===false){out('Ethernet testi etkin PC/Server üzerinde desteklenir.','outerr');return true}
 const token=p[2]||'',mac=token==='broadcast'?'ff:ff:ff:ff:ff:ff':token.replace(/[.:-]/g,'');
 if(p.length!==3||mac!=='ff:ff:ff:ff:ff:ff'&&(!/^[0-9a-f]{12}$/.test(mac)||mac==='000000000000'||parseInt(mac.slice(0,2),16)%2!==0)){out('Geçersiz veya desteklenmeyen hedef MAC. Kullanım: test ethernet <MAC|broadcast>','outerr');return true}
 const address=mac.includes(':')?mac:mac.match(/../g).join(':'),vlan=endpointVlan(d.id);
 beginEthernetEvents();transmitEthernet(d,address,vlan,'diagnostic',ethernetContext());out('Eğitim Ethernet frame testi tamamlandı. show ethernet events ile gerçek çıkışları incele.','outok');return true;
}
