'use strict';
// Contract comparison: production Ethernet/ARP/ICMP implementation versus isolated adapter.
// This is NOT an independent protocol correctness oracle or a performance comparison.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {simulate}=require('./engine-adapter-prototype.cjs');
const {normalize}=require('./packet-events.js');

function fixture({isolated=false,disconnected=false}={}){
 const pc1={id:'pc1',type:'PC',ip:'192.168.10.1',mac:'02:00:00:00:00:01',vlan:10};
 const pc2={id:'pc2',type:'PC',ip:'192.168.10.2',mac:'02:00:00:00:00:02',vlan:isolated?20:10};
 const sw={id:'sw1',type:'Switch',interfaces:{}};
 const devices=[pc1,pc2,sw];
 const links=[{a:'pc1',b:'sw1',portA:'eth0',portB:'fa0/1'}];
 if(!disconnected)links.push({a:'pc2',b:'sw1',portA:'eth0',portB:'fa0/2'});
 return {pc1,pc2,sw,devices,links};
}
function production(f){
 const devices=new Map(f.devices.map(d=>[d.id,d]));
 const fdb=new Map(),arpTables=new Map();
 const context={
   Map,Set,Number,
   links:f.links,
   arpTables,
   get:id=>devices.get(id),
   macOf:d=>d.mac,
   linkUp:()=>true,
   linkPort:(link,id)=>link.a===id?link.portA:link.portB,
   endpointVlan:id=>devices.get(id).vlan,
   portState:()=>({mode:'access'}),
   linkCarriesVlan:(link,vlan)=>{
     const ends=[devices.get(link.a),devices.get(link.b)];
     return {ok:ends.every(d=>d.type==='Switch'||d.vlan===vlan)};
   },
   stpIsBlocked:()=>false,
   portSecurityAllows:()=>true,
   activeSwitchSvis:()=>[],
   learnSwitchMac:(sw,source,vlan,port)=>fdb.set(vlan+'|'+source.mac,{port}),
   switchMacTable:()=>fdb,
   switchMacKey:(vlan,mac)=>vlan+'|'+mac,
 };
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'ethernet-forwarding.js'),'utf8'),context);
 const result=vm.runInContext('localEthernetPing(get("pc1"),get("pc2"),10)',context);
 const lines=vm.runInContext('Array.from(ethernetEvents)',context);
 return {ok:result.ok,log:normalize(lines)};
}
for(const test of [
 {name:'same access VLAN',params:{},expected:true},
 {name:'different VLAN',params:{isolated:true},expected:false},
 {name:'disconnected target',params:{disconnected:true},expected:false},
]){
 const f=fixture(test.params);
 const adapted=simulate({
   nodes:f.devices.map(d=>d.type==='Switch'?{id:d.id,type:'switch'}:{id:d.id,type:'host',ip:d.ip,mac:d.mac,vlan:d.vlan}),
   links:f.links,
 },'pc1','pc2');
 const reference=production(f);
 assert.equal(reference.ok,test.expected,'production: '+test.name);
 assert.equal(adapted.ok,reference.ok,'engine parity: '+test.name);
 assert.ok(adapted.log.events.length>0,'adapter events missing: '+test.name);
 const adapterFrames=adapted.log.events.filter(e=>e.kind==='frame').map(e=>e.detail.protocol);
 const referenceFrames=reference.log.events.filter(e=>e.kind==='frame').map(e=>e.detail.protocol);
 assert.ok(referenceFrames.length>0,'real engine events missing: '+test.name);
 if(!test.params.isolated)assert.deepEqual(adapterFrames,referenceFrames,'frame event parity: '+test.name);
 // Known gap: the prototype rejects cross-VLAN hosts before ARP; the real motor logs a failed ARP broadcast.
 if(test.expected){
  assert.deepEqual(adapterFrames,['arp-request','arp-reply','icmp-request','icmp-reply'],'adapter event order: '+test.name);
  assert.equal(adapted.log.events.at(-1).kind,'icmp-delivered');
 }else{
  assert.equal(adapted.log.events.at(-1).kind,'icmp-undelivered');
  assert.equal(adapterFrames.includes('icmp-request'),false,'ICMP must not start without ARP reachability: '+test.name);
 }

}
console.log('PASS ARP/ICMP adapter outcome parity (3 constrained access-LAN fixtures)');
