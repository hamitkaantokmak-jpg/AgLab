// Stable synthetic device MACs. Preserve canonical dN addresses used by imported labs.
const AgLabMacAddress=(()=>{
 function createResolver(){
  let topology=null,count=-1,addresses=new Map();
  return (device,devices)=>{
   if(topology!==devices||count!==devices.length){
    topology=devices;count=devices.length;addresses=new Map();const occupied=new Set();
    for(const id of devices.map(d=>String(d.id)).sort()){
     const match=/^d([1-9]\d*)$/.exec(id),legacy=match&&Number(match[1])<=0xffffff;
     let n=legacy?Number(match[1]):2166136261;
     if(!legacy)for(let i=0;i<id.length;i++)n=Math.imul(n^id.charCodeAt(i),16777619)>>>0;
     // Non-legacy IDs have their own namespace; resolve hash collisions in ID order.
     const address=()=>legacy?'02:00:00:'+[(n>>>16)&255,(n>>>8)&255,n&255].map(v=>v.toString(16).padStart(2,'0')).join(':'):'02:01:'+[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].map(v=>v.toString(16).padStart(2,'0')).join(':');
     while(occupied.has(address()))n=(n+1)>>>0;
     const mac=address();occupied.add(mac);addresses.set(id,mac);
    }
   }
   const result=addresses.get(String(device.id));if(!result)throw new Error('MAC için cihaz topolojide bulunamadı.');return result;
  };
 }
 return {createResolver,resolve:createResolver()};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AgLabMacAddress;
