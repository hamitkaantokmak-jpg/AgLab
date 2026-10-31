/* Normalize real simulator event strings for a future step-by-step Packet Detective.
 * No network simulation takes place here; no synthetic hops are created.
 */
(function(root){
'use strict';
function normalize(lines,overflow=0){
 if(!Array.isArray(lines)||!Number.isSafeInteger(overflow)||overflow<0)throw Error('Invalid packet event log');
 const entries=lines.map((raw,index)=>{
  if(typeof raw!=='string')throw Error('Invalid packet event');
  let kind='other',device=null,detail=raw;
  let m=raw.match(/^frame (\S+) src (\S+) dst (\S+) vlan (\d+)$/);
  if(m){kind='frame';device=m[2];detail={protocol:m[1],source:m[2],destinationMac:m[3],vlan:Number(m[4])}}
  else if((m=raw.match(/^receive (\S+) (\S+) vlan (\d+)(?: svi vlan (\d+))?$/))){kind='receive';device=m[1];detail={protocol:m[2],vlan:Number(m[3]),svi:m[4]!==undefined}}
  else if((m=raw.match(/^(broadcast|unknown-unicast|unicast|filter) (\S+) ingress (\S+) egress (.*?) vlan (\d+)$/))){kind='forward';device=m[2];detail={decision:m[1],ingress:m[3],egress:m[4]==='-'?[]:m[4].split(','),vlan:Number(m[5])}}
  else if((m=raw.match(/^ttl-forward (\S+) (\d+) -> (\d+)$/))){kind='ttl';device=m[1];detail={before:Number(m[2]),after:Number(m[3])}}
  else if((m=raw.match(/^discard (\S+) (.*)$/))){kind='discard';device=m[1];detail={reason:m[2]}}
  else if(raw.startsWith('icmp-delivered ')){kind='icmp-delivered'}
  else if(raw.startsWith('icmp-undelivered ')){kind='icmp-undelivered'}
  return {index,kind,device,detail,raw};
 });
 return {events:entries,overflow,truncated:overflow>0};
}
const api=Object.freeze({normalize});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.AgLabPacketEvents=api;
})(typeof globalThis!=='undefined'?globalThis:this);
