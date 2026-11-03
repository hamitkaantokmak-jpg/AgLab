'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {simulate,createSession}=require('./engine-adapter-prototype.cjs');
function topology(n){
 const nodes=[{id:'sw1',type:'switch'}],links=[];
 for(let i=1;i<=n;i++){
  const mac='02:00:00:'+[(i>>16)&255,(i>>8)&255,i&255].map(x=>x.toString(16).padStart(2,'0')).join(':');
  nodes.push({id:'pc'+i,type:'host',ip:'192.168.10.'+i,mac,vlan:10});
  links.push({a:'sw1',b:'pc'+i,portA:'fa0/'+i,portB:'eth0'});
 }
 return {nodes,links};
}
const good=simulate(topology(2),'pc1','pc2');
assert.equal(good.ok,true);
assert.equal(good.log.events.filter(e=>e.kind==='frame').length,4);
assert.ok(good.log.events.some(e=>e.kind==='receive'&&e.device==='pc2'));
assert.ok(good.log.events.some(e=>e.kind==='icmp-delivered'));
const isolated=topology(2);isolated.nodes[2].vlan=20;
const v=simulate(isolated,'pc1','pc2');
assert.equal(v.ok,false);assert.equal(v.reason,'ARP request not delivered');
assert.deepEqual(v.log.events.filter(e=>e.kind==='frame').map(e=>e.detail.protocol),['arp-request']);
const missing=topology(2);missing.links.pop();
assert.equal(simulate(missing,'pc1','pc2').reason,'ARP request not delivered');
assert.deepEqual(simulate(topology(2),'pc1','pc2'),good,'deterministic');

const session=createSession(),cachedTopology=topology(2);
const cold=simulate(cachedTopology,'pc1','pc2',session);
const warm=simulate(cachedTopology,'pc1','pc2',session);
assert.equal(cold.ok,true);assert.equal(warm.ok,true);
assert.deepEqual(warm.log.events.filter(e=>e.kind==='frame').map(e=>e.detail.protocol),['icmp-request','icmp-reply']);
assert.equal(session.arp.size,1);
cachedTopology.links.pop();
const afterLinkChange=simulate(cachedTopology,'pc1','pc2',session);
assert.equal(afterLinkChange.ok,false,'topology changes must invalidate cached ARP');
assert.deepEqual(afterLinkChange.log.events.filter(e=>e.kind==='frame').map(e=>e.detail.protocol),['arp-request']);
assert.equal(session.arp.size,0);
assert.throws(()=>simulate(topology(2),'pc1','pc2',{arp:{}}),/Invalid ARP session/);

for(const bad of ['', '00:00:00:00:00:00','01:00:5e:00:00:01']){
 const t=topology(2);t.nodes[1].mac=bad;
 assert.throws(()=>simulate(t,'pc1','pc2'),/Invalid host/);
}
assert.throws(()=>simulate({nodes:[],links:[]},'a','b'));
// An isolated microbenchmark; these numbers are NOT relative performance claims.
const stats=[];
for(const count of [10,50,100]){
 const t=topology(count),start=performance.now();
 for(let i=0;i<20;i++)assert.equal(simulate(t,'pc1','pc'+count).ok,true);
 stats.push({hosts:count,runs:20,elapsedMs:Number((performance.now()-start).toFixed(2))});
}
console.log('PASS isolated ARP/ICMP event prototype',JSON.stringify(stats));
