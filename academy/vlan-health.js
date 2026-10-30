// Conservative L2 health policy for isolation labs; no target is ever loaded.
const AgLabVlanHealth=(()=>{
 function vlanSet(value){
  if(!Array.isArray(value)||value.some(v=>!Number.isInteger(v)||v<1||v>4094)||new Set(value).size!==value.length)return null;
  return [...value].sort((a,b)=>a-b);
 }
 function sameVlanSet(a,b){const x=vlanSet(a),y=vlanSet(b);return !!x&&!!y&&JSON.stringify(x)===JSON.stringify(y)}
 function canonicalLinks(value){
  if(!Array.isArray(value))throw new Error('Kablo listesi eksik.');
  const ports=new Set();
  return value.map(l=>{
   const ends=[[l.a,l.portA],[l.b,l.portB]];
   for(const end of ends){const key=JSON.stringify(end);if(ports.has(key))throw new Error('Aynı portta birden fazla kablo var.');ports.add(key);}
   return JSON.stringify({ends:ends.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),up:l.up!==false});
  }).sort();
 }
 function ipv4(value){if(typeof value!=='string')return null;const p=value.split('.');return p.length===4&&p.every(v=>/^\d{1,3}$/.test(v)&&Number(v)<=255)?p.map(Number).join('.'):null}
 function assertHealthy(state,plan){
  if(!plan||plan.version!==1||!Array.isArray(plan.devices)||!plan.devices.length)throw new Error('Negatif ICMP sağlık planı yok.');
  if(JSON.stringify(canonicalLinks(state.links))!==JSON.stringify(canonicalLinks(plan.links)))throw new Error('Önce planlanan tüm kabloları ve bağlantı durumlarını doğrula.');
  const ids=new Set();for(const d of state.devices){if(ids.has(d.id))throw new Error('Cihaz kimlikleri belirsiz.');ids.add(d.id);}
  for(const expected of plan.devices){
   const d=state.devices.find(d=>d.id===expected.id);
   if(!d||d.type!==expected.type||d.enabled!==true)throw new Error(expected.id+': cihaz açık ve doğru türde olmalı.');
   for(const key of ['ip','mask'])if(Object.hasOwn(expected,key)&&ipv4(d[key])!==ipv4(expected[key]))throw new Error(expected.id+': '+key+' planla eşleşmiyor.');
   if(expected.vlans&&!sameVlanSet(d.vlans,expected.vlans))throw new Error(expected.id+': VLAN veritabanını doğrula.');
   for(const [port,fields] of Object.entries(expected.interfaces)){
    const actual=d.interfaces?.[port];
    for(const [key,value] of Object.entries(fields)){
     const ok=key==='allowed'?sameVlanSet(actual?.[key],value):actual?.[key]===value;
     if(!ok)throw new Error(expected.id+' '+port+': '+key+' planla eşleşmiyor.');
    }
   }
  }
 }
 return {sameVlanSet,assertHealthy};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AgLabVlanHealth;
