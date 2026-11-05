// Glue only: Ethernet, ARP, ICMP and scheduling run in the unmodified MIT engine.
import {Network} from '../third_party/borck-netsim/engine/network';
import {Host} from '../third_party/borck-netsim/engine/ipdevice';
import {SwitchDevice} from '../third_party/borck-netsim/engine/switch';
import {parseIp,ipToString} from '../third_party/borck-netsim/engine/ip';

export const identity=Object.freeze({name:'Michael Borck NetSim',commit:'c3075e7fe65b7e17515d802eaef625bab751af58',license:'MIT'});
export function prefix(mask:string){
 const n=parseIp(mask);if(n===null)throw Error('Invalid IPv4 mask');
 const bits=n.toString(2).padStart(32,'0');if(!/^1*0*$/.test(bits))throw Error('Noncontiguous IPv4 mask');
 return bits.indexOf('0')<0?32:bits.indexOf('0');
}
export function support(topology:any){
 const reasons=new Set<string>(),ids=new Set<string>(),macs=new Set<string>(),used=new Set<string>(),parent=new Map<string,string>();
 if(!Array.isArray(topology?.devices)||!Array.isArray(topology?.links))return {ok:false,reasons:['Invalid topology']};
 if(topology.devices.length>250)reasons.add('At most 250 devices');
 const find=(id:string):string=>{const p=parent.get(id)!;return p===id?id:find(p);};
 for(const d of topology.devices){
  if(!d||typeof d!=='object'){reasons.add('Invalid device record');continue;}
  if(!Array.isArray(d.ports)||!d.ports.length||new Set(d.ports).size!==d.ports.length)reasons.add('Invalid physical port inventory');
  if(typeof d.id!=='string'||ids.has(d.id))reasons.add('Missing or duplicate device ID');ids.add(d.id);parent.set(d.id,d.id);
  if(!['PC','Switch'].includes(d.type))reasons.add('Only PC and access Switch devices in this integration');
  if(d.type==='PC'){
   try{if(parseIp(d.ip)===null)throw Error();prefix(d.mask||'255.255.255.0');}catch{reasons.add('Every PC needs a valid IPv4 address and mask');}
   if(!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(d.mac||'')||d.mac==='00:00:00:00:00:00'||(parseInt(d.mac?.slice(0,2)||'1',16)&1)||macs.has(d.mac?.toLowerCase()))reasons.add('PC MACs must be unique unicast colon addresses');
   macs.add(d.mac?.toLowerCase());
   if(d.gateway&&parseIp(d.gateway)===null)reasons.add('Invalid gateway');
   if(d.ports?.length!==1)reasons.add('Only single-interface PCs');
  }
  if(d.ospf||d.bgp||d.natOverload||d.acls?.length||d.staticRoutes?.length||d.route)reasons.add('Routing, NAT and ACL mappings are not enabled');
  for(const [name,p] of Object.entries<any>(d.interfaces||{})){
   if(p.mode==='trunk')reasons.add('802.1Q trunk is unsupported by upstream');
   if(d.type==='Switch'&&p.mode!=='access')reasons.add('Only access switchports');
   if(name.includes('.')||/^vlan/i.test(name))reasons.add('Subinterfaces and SVI are unsupported');
   if(p.portSecurity?.enabled||p.errdisabled)reasons.add('Port-security is unsupported');
   if(p.ip||p.helperAddress)reasons.add('Interface IP/helper configuration is unsupported');
   if(p.mode&&p.mode!=='access')reasons.add('Only access switchports');
   if(d.type==='Switch'&&p.vlan!==undefined&&(!Number.isInteger(p.vlan)||p.vlan<1||p.vlan>4094))reasons.add('Invalid access VLAN');
   if(d.type==='Switch'&&p.mode==='access'&&!d.vlans?.includes(Number(p.vlan??1)))reasons.add('Switchport VLAN is not defined');
  }
 }
 const byId=new Map(topology.devices.map((d:any)=>[d.id,d]));
 for(const l of topology.links){
  const a:any=byId.get(l.a),b:any=byId.get(l.b);
  if(!a||!b||a===b){reasons.add('Invalid cable endpoint');continue;}
  for(const [d,p]of [[a,l.portA],[b,l.portB]]){const key=d.id+'|'+p;if(!d.ports?.includes(p)||used.has(key))reasons.add('Missing or multiply connected physical port');used.add(key);}
  // The upstream access-only switch does not carry a VLAN tag over a wire.
  if(a.type==='Switch'&&b.type==='Switch'&&Number(a.interfaces?.[l.portA]?.vlan??1)!==Number(b.interfaces?.[l.portB]?.vlan??1))reasons.add('Access VLAN translation across switches is not mapped');
  if(l.up!==false&&a.enabled!==false&&b.enabled!==false&&a.interfaces?.[l.portA]?.enabled!==false&&b.interfaces?.[l.portB]?.enabled!==false){const ra=find(a.id),rb=find(b.id);if(ra===rb)reasons.add('L2 loops require STP; upstream has no STP');else parent.set(ra,rb);}
 }
 return {ok:reasons.size===0,reasons:[...reasons]};
}

export function createSession(topology:any){
 const checked=support(topology);if(!checked.ok)throw Error('Unsupported topology: '+checked.reasons.join('; '));
 const net=new Network(),maps=new Map<string,Map<string,string>>();
 let events:any[]=[],overflow=0,icmpId=0;
 const emit=(e:any)=>{if(events.length<4096)events.push(e);else overflow++;};
 for(const d of topology.devices){
  const dev:any=d.type==='Switch'?new SwitchDevice(net,d.id,d.name||d.id,'switch',d.ports.length):new Host(net,d.id,d.name||d.id);
  net.register(dev);const ports=new Map<string,string>();maps.set(d.id,ports);
  d.ports.forEach((p:string,i:number)=>{const iface=dev.interfaces[i];ports.set(p,iface.name);iface.up=d.enabled!==false&&d.interfaces?.[p]?.enabled!==false;if(d.type==='Switch')dev.vlans.set(iface.name,Number(d.interfaces?.[p]?.vlan??1));});
  if(d.type==='PC'){
   dev.interfaces[0].mac=d.mac.toLowerCase();dev.interfaces[0].ip={addr:parseIp(d.ip),prefix:prefix(d.mask||'255.255.255.0')};
  }
 }
 for(const l of topology.links){const a=net.devices.get(l.a)!,b=net.devices.get(l.b)!;if(l.up===false)continue;net.connect(a.id,b.id,{id:l.id||'link-'+net.links.size,aIface:maps.get(a.id)!.get(l.portA),bIface:maps.get(b.id)!.get(l.portB)});}
 for(const d of topology.devices)if(d.type==='PC'&&d.gateway){const dev:any=net.devices.get(d.id);const error=dev.addRoute(0,0,parseIp(d.gateway));if(error)throw Error(d.id+': '+error);}
 // onWireTransfer is upstream evidence. We do not generate imagined forwarding/drop events.
 net.onWireTransfer=e=>emit({...e,origin:identity.name});
 function snapshot(){return {arp:Object.fromEntries([...net.devices].filter(([,d]:any)=>d.arpTable).map(([id,d]:any)=>[id,[...d.arpTable].map(([ip,v]:any)=>({ip:ipToString(ip),mac:v.mac,port:v.ifaceName}))])),mac:Object.fromEntries([...net.devices].filter(([,d]:any)=>d.macTable).map(([id,d]:any)=>[id,[...d.macTable].map(([key,p]:any)=>({key,port:p.name}))]))};}
 return {net,snapshot,ping(source:string,targetIp:string){
  events=[];overflow=0;const src:any=net.devices.get(source),dst=parseIp(targetIp);if(!src?.sendEcho||dst===null)throw Error('Invalid ping endpoints');
  const id=++icmpId,replies:any[]=[];src.onIcmp(id,(e:any)=>replies.push(e));
  const error=src.sendEcho(dst,id,1);net.scheduler.advanceTo(net.now+10000);
  src.offIcmp(id);
  return {engine:identity,ok:replies.some(e=>e.type==='reply'),error:error||null,replies,events:events.slice(),overflow,...snapshot()};
 }};
}
export function run(topology:any,source:string,targetIp:string){return createSession(topology).ping(source,targetIp);}
