// Explicit read-only comparison. CLI/grades/default engine remain on the existing path.
(function(){
 'use strict';
 const parent=document.getElementById('packetDetectivePanel');if(!parent)return;
 const block=document.createElement('details'),title=document.createElement('summary');title.textContent='MIT NetSim ile karşılaştır (deneysel)';block.append(title);
 const help=document.createElement('p');help.textContent='Mevcut topolojinin kopyasını Michael Borck NetSim motorunda çalıştırır. Yalnız PC ve döngüsüz access switch ağı desteklenir. Trunk, router, OSPF/BGP ve port güvenliği bu entegrasyonda desteklenmez. CLI ve puanlama AğLab motorunda kalır. Olaylar üçüncü taraf simülatörün bağlantı bildirimleridir; fiziksel paket yakalaması değildir.';block.append(help);
 const run=document.createElement('button');run.id='borckCompare';run.textContent='Seçili kaynak → hedef için NetSim ping';block.append(run);
 const output=document.createElement('pre');output.id='borckResult';output.setAttribute('role','status');output.style.whiteSpace='pre-wrap';block.append(output);
 const show=document.createElement('button');show.id='borckDetective';show.textContent='NetSim olaylarını Paket Dedektifi’nde incele';show.disabled=true;block.append(show);
 parent.append(block);let result=null;
 function capture(){return {devices:devices.map(d=>({...JSON.parse(JSON.stringify(d)),mac:macOf(d)})),links:JSON.parse(JSON.stringify(links))};}
 function compare(sourceId,targetId){const check=aglabEngines.check('borck');if(!check.ok)return {supported:false,reasons:check.reasons};if(!get(targetId))return {supported:false,reasons:['Hedef cihaz seçilmedi']};return {supported:true,...aglabEngines.run('borck',sourceId,targetId)};}
 run.onclick=()=>{
  result=null;show.disabled=true;
  try{const r=compare($p('ptSource').value,$p('ptTarget').value);output.textContent=JSON.stringify(r,null,2);if(r.supported){result=r;show.disabled=false;}}catch(e){output.textContent='NetSim yapılandırma/çalıştırma hatası: '+e.message;}
 };
 show.onclick=()=>{if(result)document.dispatchEvent(new CustomEvent('aglab:external-packet-events',{detail:{engine:result.engine,events:result.events,overflow:result.overflow}}));};
 globalThis.aglabBorckComparison=Object.freeze({capture,compare});
})();
