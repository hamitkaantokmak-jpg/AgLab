(function(){
'use strict';
const manager=AgLabEngineManager.createManager();
// Keep CLI/grading's existing ping semantics; label the actual failure result as
// derived diagnostic evidence, never as a frame/drop that the engine did not emit.
const originalPing=ping;
ping=function(source,target,options){const r=originalPing(source,target,options);if(!r.ok&&typeof r.why==='string')ethernetEvent('diagnostic '+JSON.stringify({source,reason:r.why,origin:'adapter-derived'}));return r;};
const capture=()=>({devices:devices.map(d=>({...clone(d),mac:macOf(d)})),links:clone(links)});
const tables=()=>({arp:Object.fromEntries([...arpTables].map(([id,rows])=>[id,Object.fromEntries(rows)])),mac:Object.fromEntries([...macTables].map(([id,rows])=>[id,Object.fromEntries(rows)]))});
manager.register('aglab-js',{check:()=>({ok:true,reasons:[]}),run:(_topology,r)=>{const target=get(r.targetId);if(!get(r.sourceId)||!target)throw Error('Invalid endpoints');const result=ping(r.sourceId,target.ip);return {...result,events:AgLabPacketEvents.normalize(ethernetEvents.slice(),ethernetEventOverflow).events,tables:tables(),evidence:'simulation-engine'};}});
manager.register('borck',{check:t=>AgLabBorckEngine.support(t),run:(t,r)=>{const target=t.devices.find(d=>d.id===r.targetId);if(!target)throw Error('Invalid endpoints');return {...AgLabBorckEngine.run(t,r.sourceId,target.ip),evidence:'upstream-wire-notification'};}});
const host=document.getElementById('packetDetectivePanel');if(!host)return;
const block=document.createElement('details');block.id='engineCapabilities';const heading=document.createElement('summary');heading.textContent='Motorlar ve destek kapsamı';block.append(heading);
const note=document.createElement('p');note.textContent='Varsayılan: AğLab JS. Her çalıştırma tek motorda yürür; otomatik geçiş veya motorlar arasında paket/durum birleştirme yoktur. Gerçek Lab ayrı ve öğrenci tanıları salt okunurdur.';block.append(note);
const labels={education:'Sınırlı eğitim modeli',experimental:'Deneysel','native-lab':'Gerçek Lab yeteneği',unsupported:'Desteklenmiyor',unverified:'Doğrulanmadı'};
const list=document.createElement('ul');for(const d of manager.list()){const item=document.createElement('li');item.textContent=d.name+' · '+(d.scope==='separate-lab'?'Ayrı gerçek laboratuvar':'Tarayıcı')+' · '+Object.entries(d.capabilities).map(([k,v])=>k+': '+labels[v]).join(', ');list.append(item);}block.append(list);
const label=document.createElement('label');label.textContent='Çalıştırılacak motor ';const select=document.createElement('select');select.id='engineChoice';for(const d of manager.list()){const o=document.createElement('option');o.value=d.id;o.textContent=d.name;select.append(o);}label.append(select);block.append(label);
const run=document.createElement('button');run.id='engineRun';run.textContent='Seçili kaynak ve hedefi bu motorda dene';block.append(run);
const result=document.createElement('pre');result.id='engineResult';result.setAttribute('role','status');result.style.whiteSpace='pre-wrap';block.append(result);host.append(block);
const exportButton=document.createElement('button');exportButton.id='engineExportTopology';exportButton.textContent='Topolojiyi operatör için JSON olarak indir';block.append(exportButton);
exportButton.onclick=()=>{const t=capture();for(const d of t.devices)if(d.type!=='PC'&&d.type!=='Server')delete d.mac;const blob=new Blob([JSON.stringify({app:'AgLab',version:23,...t,nextId,selected:''},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='aglab-operator-topology.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);result.textContent='JSON indirildi. Gerçek Lab dönüşümü ve çalıştırması yetkili operatörde yapılır. Desteklenmeyen topolojiler dönüştürücüde reddedilir.';};
run.onclick=()=>{try{const t=capture(),c=manager.check(select.value,t);result.textContent=JSON.stringify(c.ok?manager.run(select.value,t,{sourceId:$p('ptSource').value,targetId:$p('ptTarget').value}):c,null,2);}catch(e){result.textContent=e.message;}};
globalThis.aglabEngines=Object.freeze({list:manager.list,check:id=>manager.check(id,capture()),run:(id,sourceId,targetId)=>manager.run(id,capture(),{sourceId,targetId}),capture,tables,
 createComparisonSession(){const t=capture(),c=manager.check('borck',t);if(!c.ok)throw Error(c.reasons.join('; '));return AgLabBorckEngine.createSession(t);},
 // Fair in-browser harness uses the actual production functions, not Node VM mocks.
 benchmarkAccess(sourceId,targetId){const src=get(sourceId),dst=get(targetId);if(!src||!dst)throw Error('Invalid endpoints');const check=manager.check('borck',capture());if(!check.ok)throw Error(check.reasons.join('; '));arpTables.clear();macTables.clear();const start=performance.now(),a=localEthernetPing(src,dst,endpointVlan(src.id)),first=performance.now(),b=localEthernetPing(src,dst,endpointVlan(src.id)),second=performance.now(),state=tables(),end=performance.now();return {ok:a.ok&&b.ok,first_ms:first-start,second_ms:second-first,tables_ms:end-second,table_entries:Object.values(state.mac).reduce((n,t)=>n+Object.keys(t).length,0)};}
});
})();
