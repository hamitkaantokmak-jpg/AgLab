// Semantic comparisons for the source lab schema; derived engine metadata is ignored.
const AgLabRoutingGrading=(()=>{
 function ipv4(value){
  if(typeof value!=='string')return null;
  const parts=value.split('.');if(parts.length!==4||parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255))return null;
  return parts.map(Number).join('.');
 }
 function prefix(mask){
  const ip=ipv4(mask);if(ip===null)return null;
  const bits=ip.split('.').map(n=>Number(n).toString(2).padStart(8,'0')).join('');
  return /^1*0*$/.test(bits)?bits.indexOf('0')===-1?32:bits.indexOf('0'):null;
 }
 function network(ip,len){const n=ip.split('.').reduce((a,v)=>(a*256+Number(v))>>>0,0),m=len===0?0:(0xffffffff<<(32-len))>>>0;return ((n&m)>>>0).toString();}
 function routes(rows){
  if(!Array.isArray(rows))return null;
  const values=[];
  for(const row of rows){
   if(!row||typeof row!=='object')return null;
   if(row.distance!=null&&typeof row.distance!=='number'&&typeof row.distance!=='string')return null;
   const ip=ipv4(row.network),len=prefix(row.mask),hop=ipv4(row.nextHop),distance=Number(row.distance??1);
   if(ip===null||len===null||hop===null||!Number.isInteger(distance)||distance<1||distance>255)return null;
   values.push(JSON.stringify([network(ip,len),len,hop,distance]));
  }
  return new Set(values).size===values.length?values.sort():null;
 }
 function sameRoutes(a,b){const x=routes(a),y=routes(b);return x!==null&&y!==null&&JSON.stringify(x)===JSON.stringify(y)}
 function interfaceState(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const state={};
  for(const key of ['enabled','ip','mask','mode','vlan','allowed','nativeVlan','encapsulation','parent'])if(Object.hasOwn(value,key)){
   const v=value[key];
   if(key==='ip'){state[key]=ipv4(v);if(state[key]===null)return null;}
   else if(key==='mask'){state[key]=prefix(v);if(state[key]===null)return null;}
   else if(key==='allowed')state[key]=Array.isArray(v)?[...v].sort((a,b)=>a-b):v;
   else state[key]=v;
  }
  return state;
 }
 function sourceBinding(source,name,lookup){
  if(source?.type!=='Router')throw new Error('Kaynak arayüzü kontrolü yalnız router için desteklenir.');
  const iface=source.interfaces?.[name];
  if(source.enabled===false||!iface||iface.enabled===false||ipv4(iface.ip)===null||prefix(iface.mask)===null||!lookup?.ok)return null;
  if(iface.parent||name.includes('.')||lookup.route.type!=='connected'||lookup.route.iface!==name)throw new Error('Kaynak arayüzü yalnız seçili doğrudan bağlı fiziksel çıkışta desteklenir.');
  return {ip:ipv4(iface.ip),interface:name};
 }
 return {sameRoutes,interfaceState,sourceBinding};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AgLabRoutingGrading;
