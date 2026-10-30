const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {sameVlanSet,assertHealthy}=require('./vlan-health.js');
assert(sameVlanSet([20,10],[10,20]));
for(const bad of [[10,10,20],[10,'20'],[0,10],undefined])assert(!sameVlanSet(bad,[10,20]));
for(const id of ['AGL-023','AGL-026','AGL-027','AGL-030']){
 const student=JSON.parse(fs.readFileSync(path.join(__dirname,'student',id+'.json')));
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'source',id+'.json')));
 const plan=student.probe_health;
 const target=source.target_topology;
 assertHealthy(target,plan);
 const reordered=structuredClone(target);
 reordered.links.reverse();for(const l of reordered.links){[l.a,l.b]=[l.b,l.a];[l.portA,l.portB]=[l.portB,l.portA];}
 for(const d of reordered.devices){d.vlans?.reverse();for(const i of Object.values(d.interfaces))i.allowed?.reverse();}
 assertHealthy(reordered,plan);
 const faults=[
  t=>{t.links[0].up=false;},t=>{t.links.pop();},t=>{t.devices[0].enabled=false;},
  t=>{t.devices[0].ip='192.0.2.200';},t=>{t.devices[0].interfaces.eth0.enabled=false;},
  t=>{t.devices.find(d=>d.type==='Switch').vlans=[1];},
  t=>{t.devices.find(d=>d.type==='Switch').interfaces['fa0/1'].vlan=999;}
 ];
 if(id!=='AGL-023')faults.push(t=>{t.devices.find(d=>d.type==='Switch').interfaces['gi0/1'].allowed=[10];});
 for(const fault of faults){const t=structuredClone(target);fault(t);assert.throws(()=>assertHealthy(t,plan));}
}
console.log('PASS VLAN set semantics and negative-probe health gates');
