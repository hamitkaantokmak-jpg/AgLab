'use strict';
// Standalone experiment only: hosts, access VLAN and switches, ARP + ICMP echo.
// No routing/trunk/STP. Does not replace or modify the production AğLab engine.
const {normalize}=require('./packet-events.js');
const MAC=/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/;
function validMac(mac){return typeof mac==='string'&&MAC.test(mac)&&mac!=='00:00:00:00:00:00'&&!(parseInt(mac.slice(0,2),16)&1)}
function simulate(topology,sourceId,targetId){
 if(!topology||!Array.isArray(topology.nodes)||!Array.isArray(topology.links)||topology.nodes.length>1000||topology.links.length>4000)throw new TypeError('Invalid or oversized topology');
 const nodes=new Map();
 for(const node of topology.nodes){
  if(!node||typeof node.id!=='string'||!/^[a-zA-Z0-9_-]{1,50}$/.test(node.id)||nodes.has(node.id)||!['host','switch'].includes(node.type))throw new TypeError('Invalid node');
  if(node.type==='host'&&(!validMac(node.mac)||typeof node.ip!=='string'||!Number.isInteger(node.vlan)||node.vlan<1||node.vlan>4094))throw new TypeError('Invalid host');
  nodes.set(node.id,node);
 }
 const source=nodes.get(sourceId),target=nodes.get(targetId);
 if(!source||!target||source.type!=='host'||target.type!=='host'||source.id===target.id)throw new TypeError('Distinct hosts required');
 const graph=new Map([...nodes.keys()].map(k=>[k,[]]));
 for(const link of topology.links){
  if(!link||!nodes.has(link.a)||!nodes.has(link.b)||link.a===link.b||typeof link.portA!=='string'||typeof link.portB!=='string'||!/^[a-zA-Z0-9/_.-]{1,40}$/.test(link.portA)||!/^[a-zA-Z0-9/_.-]{1,40}$/.test(link.portB))throw new TypeError('Invalid link');
  graph.get(link.a).push({next:link.b,port:link.portA,otherPort:link.portB});
  graph.get(link.b).push({next:link.a,port:link.portB,otherPort:link.portA});
 }
 const events=[];let overflow=0;
 const forwardingTables=new Map();
 function emit(line){if(events.length<256)events.push(line);else overflow++}
 function send(from,toMac,kind){
  const vlan=from.vlan,broadcast=toMac==='ff:ff:ff:ff:ff:ff';
  emit(`frame ${kind} src ${from.id} dst ${toMac} vlan ${vlan}`);
  const queue=[{id:from.id,ingress:'local'}],seen=new Set(),delivered=new Set();
  for(let i=0;i<queue.length;i++){
   const {id,ingress}=queue[i];if(seen.has(id))continue;seen.add(id);
   const node=nodes.get(id);
   if(node.type==='host'&&id!==from.id){
    if(node.vlan!==vlan)continue;
    emit(`receive ${id} ${kind} vlan ${vlan}`);
    if(broadcast||node.mac===toMac)delivered.add(id);else emit(`discard ${id} destination-mac`);
    continue;
   }
   const edges=graph.get(id).filter(edge=>{const n=nodes.get(edge.next);return n.type==='switch'||n.vlan===vlan});
   let out=edges.filter(edge=>edge.port!==ingress||id===from.id);
   let decision=broadcast?'broadcast':'unknown-unicast';
   if(node.type==='switch'){
    let table=forwardingTables.get(id);
    if(!table){table=new Map();forwardingTables.set(id,table);}
    if(ingress!=='local')table.set(vlan+'|'+from.mac,ingress);
    if(!broadcast){
     const learned=table.get(vlan+'|'+toMac);
     if(learned){
      const edge=edges.find(e=>e.port===learned);
      if(learned===ingress){out=[];decision='filter';}
      else if(edge){out=[edge];decision='unicast';}
      else table.delete(vlan+'|'+toMac);
     }
    }
    emit(`${decision} ${id} ingress ${ingress} egress ${out.map(e=>e.port).join(',')||'-'} vlan ${vlan}`);
   }
   for(const edge of out)queue.push({id:edge.next,ingress:edge.otherPort});
  }
  return delivered;
 }
 let ok=false,why='';
 if(!send(source,'ff:ff:ff:ff:ff:ff','arp-request').has(target.id))why='ARP request not delivered';
 else if(!send(target,source.mac,'arp-reply').has(source.id))why='ARP reply not delivered';
 else if(!send(source,target.mac,'icmp-request').has(target.id))why='ICMP request not delivered';
 else if(!send(target,source.mac,'icmp-reply').has(source.id))why='ICMP reply not delivered';
 else{ok=true;why='ARP and ICMP delivered'}
 emit(ok?`icmp-delivered ${source.id}`:`icmp-undelivered ${source.id} ${why.replace(/ /g,'-')}`);
 return {ok,reason:why,log:normalize(events,overflow)};
}
module.exports=Object.freeze({simulate});
