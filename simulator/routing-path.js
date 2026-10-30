// Bind a route to its wire neighbor before traversing a shared L2 segment.
function routingIpBindings(ip){
 const bindings=[];
 for(const device of devices){
  if(device.enabled===false)continue;
  if(device.type==='Router')for(const [name,iface] of activeRouterInterfaces(device))if(iface.ip===ip)bindings.push({id:device.id,ip,physical:iface.parent||name.split('.')[0],vlan:iface.encapsulation==='dot1q'?Number(iface.vlan):null});
  if(device.type==='Switch')for(const [,iface] of activeSwitchSvis(device))if(iface.ip===ip)bindings.push({id:device.id,ip,physical:null,vlan:Number(iface.vlan)});
  if(['PC','Server'].includes(device.type)&&device.ip===ip)bindings.push({id:device.id,ip,physical:device.ports?.[0]||'eth0',vlan:null});
 }
 return bindings;
}
function routingWireHop(router,targetIp){
 const lookup=routeLookup(router,targetIp);if(!lookup.ok)return null;
 let route=lookup.route;const iface=router.interfaces?.[route.iface];if(!iface)return null;
 while(route.resolvedVia==='recursive'&&route.resolution)route=route.resolution;
 const address=route.type==='connected'?targetIp:route.nextHop;
 if(!address||!inNetwork(address,iface.ip,iface.mask))return null;
 const matches=routingIpBindings(address).filter(binding=>binding.id!==router.id);
 if(matches.length!==1)return null;
 const binding=matches[0];if(get(binding.id)?.type!=='Router'&&address!==targetIp)return null;
 return binding;
}
function routingSourceHop(source,targetIp){
 if(!source||source.type==='Router')return null;
 const address=source.type==='Switch'?switchManagementAddress(source,targetIp):source;
 if(!address?.ip||inNetwork(targetIp,address.ip,address.mask))return null;
 if(!source.gateway||!inNetwork(source.gateway,address.ip,address.mask))return false;
 const matches=routingIpBindings(source.gateway).filter(binding=>get(binding.id)?.type==='Router');
 return matches.length===1?matches[0]:false;
}
function findPath(a,b,vlan=null,targetIp=null,validateVlans=false,options={}){
 const forwardingTrees=new Map(),startVlan=vlan===null||vlan===undefined?endpointVlan(a):Number(vlan)||endpointVlan(a);
 const firstHop=targetIp?routingSourceHop(get(a),targetIp):null;if(firstHop===false)return null;
 const queue=[{node:a,path:[],vlans:[],vlan:startVlan,pending:firstHop}],seen=new Set([a+'|'+startVlan+'|'+(firstHop?.id||'')]);
 for(let index=0;index<queue.length;index++){
  const state=queue[index];
  if(state.node===b&&!state.pending&&(options.targetVlan===undefined||state.vlan===Number(options.targetVlan))){
   state.path.vlans=state.vlans;
   if(targetIp&&!validateVlans&&state.path.some((link,i)=>!linkCarriesVlan(link,state.vlans[i]).ok))return findPath(a,b,vlan,targetIp,true,options)||state.path;
   return state.path;
  }
  const current=get(state.node);let pending=state.pending;
  if(targetIp&&current?.type==='Router'){pending=routingWireHop(current,targetIp);if(!pending)continue;}
  for(const link of links.filter(edge=>linkUp(edge)&&(edge.a===state.node||edge.b===state.node))){
   let edgeVlan=state.vlan,nextPending=pending;
   const nextId=link.a===state.node?link.b:link.a,next=get(nextId);
   if(targetIp&&current?.type==='Router'){edgeVlan=routerEgressVlan(current,link,targetIp,state.vlan);if(edgeVlan===null)continue;}
   if(pending&&(next?.type!=='Switch'||nextId===pending.id)){
    if(nextId!==pending.id||pending.physical&&linkPort(link,nextId)!==pending.physical||pending.vlan!==null&&pending.vlan!==undefined&&Number(edgeVlan)!==pending.vlan)continue;
    nextPending=null;
   }
   if(current?.type==='Switch'&&next?.type==='Switch'&&stpIsBlocked(link,edgeVlan,forwardingTrees))continue;
   if(validateVlans&&!linkCarriesVlan(link,edgeVlan).ok)continue;
   if(options.management&&!switchManagementLink(link,edgeVlan))continue;
   const nextVlan=targetIp&&current?.type==='Router'?edgeVlan:state.vlan,key=nextId+'|'+nextVlan+'|'+(nextPending?.id||'');
   if(seen.has(key))continue;seen.add(key);
   queue.push({node:nextId,path:state.path.concat(link),vlans:state.vlans.concat(edgeVlan),vlan:nextVlan,pending:nextPending});
  }
 }
 return null;
}
