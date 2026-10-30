// TTL is an IPv4 forwarding property, not an Ethernet hop counter.
function parsePingCommand(parts){
 const ttl=parts.length===2?64:Number(parts[3]);
 if(!validIP(parts[1])||!(parts.length===2||parts.length===4&&parts[2]==='ttl'&&/^[1-9]\d{0,2}$/.test(parts[3])&&ttl<=255))return {error:'Kullanım: ping <IPv4> [ttl <1-255>]'};
 return {target:parts[1],ttl,explicitTtl:parts.length===4};
}
function icmpTimeExceeded(router,origin,sourceIp,targetIp,incomingIp,context,kind){
 ethernetEvent('ttl-expired '+router.id+' quote '+sourceIp+' -> '+targetIp);
 if(kind==='icmp-time-exceeded')return {ok:false,expired:true,why:'ICMP hata paketinin TTL süresi doldu; yeni ICMP hata yanıtı üretilmedi.'};
 const lookup=routeLookup(router,sourceIp),errorIp=router.interfaces?.[lookup.route?.iface]?.ip||incomingIp;
 const management=origin.type==='Switch',svi=management?switchManagementAddress(origin,sourceIp,true):null;
 const path=findPath(router.id,origin.id,endpointVlan(router.id),sourceIp,true,management?{management:true,targetVlan:svi?.vlan}:{});
 ethernetEvent('icmp-time-exceeded type 11 code 0 from '+router.id+' '+errorIp+' to '+sourceIp);
 let delivered={ok:false,why:'ICMP dönüş rotası/komşuluğu yok.'};
 if(path?.length)delivered=deliverRoutedFrames(router,path,errorIp,sourceIp,'icmp-time-exceeded',context,{ttl:64});
 ethernetEvent((delivered.ok?'icmp-delivered ':'icmp-undelivered ')+origin.id+(delivered.ok?'':' '+delivered.why));
 return {ok:false,expired:true,routerId:router.id,routerIp:errorIp,icmpDelivered:delivered.ok,why:'TTL süresi '+router.name+' üzerinde doldu. ICMP Time Exceeded (type 11 code 0) '+(delivered.ok?errorIp+' adresinden kaynağa ulaştı.':'kaynağa ulaşmadı: '+delivered.why)};
}

function ttlUnsupportedNatPath(path,sourceId){
 const nodes=orderedPathNodes(sourceId,path);
 return nodes.some((router,index)=>router?.type==='Router'&&index>0&&index<path.length&&router.interfaces?.[linkPort(path[index-1],router.id)]?.natRole==='inside'&&router.interfaces?.[linkPort(path[index],router.id)]?.natRole==='outside');
}
