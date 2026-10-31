// Student-side read-only event playback. Uses the actual latest Ethernet event trace.
(function(){
'use strict';
const host=document.getElementById('area-lab');
if(!host||!globalThis.AgLabPacketEvents)return;
const panel=document.createElement('section');
panel.id='packetDetectivePanel';panel.className='panel';
const title=document.createElement('h2');title.textContent='Paket Dedektifi';panel.append(title);
const help=document.createElement('p');help.textContent='Önce CLI üzerinden ping veya Ethernet testi çalıştır. Son gerçek ağ olaylarını adım adım incele; burada yeni paket gönderilmez.';panel.append(help);
const controls=document.createElement('div');
const refresh=document.createElement('button');refresh.id='packetDetectiveRefresh';refresh.textContent='Son olayları göster';
const previous=document.createElement('button');previous.id='packetDetectivePrevious';previous.textContent='← Önceki';previous.disabled=true;
const next=document.createElement('button');next.id='packetDetectiveNext';next.textContent='Sonraki →';next.disabled=true;
const filter=document.createElement('select');filter.id='packetDetectiveFilter';filter.setAttribute('aria-label','Paket olay türü');
for(const [value,label] of [['all','Tüm olaylar'],['arp','ARP'],['icmp','ICMP'],['forward','İletim'],['discard','Kayıp / reddedilen']]){
 const option=document.createElement('option');option.value=value;option.textContent=label;filter.append(option);
}
controls.append(refresh,filter,previous,next);panel.append(controls);
const status=document.createElement('p');status.id='packetDetectiveStatus';status.setAttribute('role','status');panel.append(status);
const explanation=document.createElement('p');explanation.id='packetDetectiveExplanation';panel.append(explanation);
const raw=document.createElement('pre');raw.id='packetDetectiveRaw';raw.style.whiteSpace='pre-wrap';raw.style.overflowWrap='anywhere';panel.append(raw);
const diagnosis=document.createElement('p');diagnosis.id='packetDetectiveDiagnosis';diagnosis.setAttribute('role','status');panel.append(diagnosis);
const go=document.createElement('button');go.id='packetDetectiveGoToDevice';go.textContent='Sorunlu cihaza git';go.disabled=true;panel.append(go);
host.append(panel);
let allEvents={events:[],overflow:0,truncated:false},snapshot=allEvents,index=0;
function filtered(){
 const mode=filter.value;
 if(mode==='all')return allEvents;
 const events=allEvents.events.filter(event=>mode==='forward'?event.kind==='forward':mode==='discard'?event.kind==='discard'||event.kind==='icmp-undelivered':mode==='arp'?event.raw.toLowerCase().includes('arp-'):event.raw.toLowerCase().includes('icmp-'));
 return {...allEvents,events};
}
let marked=null,markedEdge=null;
function clearEdge(){if(markedEdge){markedEdge.removeAttribute('stroke');markedEdge.removeAttribute('stroke-width');markedEdge=null;}}
function markDevice(id){
 clearEdge();
 if(marked){marked.removeAttribute('stroke');marked.removeAttribute('stroke-width');marked=null;}
 if(!id)return;
 const canvas=document.getElementById('ptCanvas');
 if(!canvas)return;
 const group=[...canvas.querySelectorAll('g[data-id]')].find(node=>node.getAttribute('data-id')===id);
 const outline=group?.querySelector('rect');
 if(outline){outline.setAttribute('stroke','#ffcb38');outline.setAttribute('stroke-width','4');marked=outline;}
}
function markForwardEdge(step){
 if(step?.kind!=='forward'||step.detail?.egress?.length!==1)return;
 const port=step.detail.egress[0],id=step.device;
 const matches=links.filter(l=>(l.a===id&&l.portA===port)||(l.b===id&&l.portB===port));
 if(matches.length!==1)return; // Do not invent an edge for ambiguous/missing ports.
 const visible=links.filter(l=>get(l.a)&&get(l.b));
 const position=visible.indexOf(matches[0]);
 const edges=document.querySelectorAll('#ptCanvas line.pt-edge');
 const line=edges[position];
 if(!line)return;
 line.setAttribute('stroke','#ffcb38');line.setAttribute('stroke-width','6');markedEdge=line;
}
function targetDevice(){
 const result=AgLabPacketEvents.diagnose(allEvents);
 return result.issues.find(issue=>issue.device&&get(issue.device))?.device||null;
}
function render(){
 const target=targetDevice();
 go.disabled=!target;
 const result=AgLabPacketEvents.diagnose(allEvents);
 diagnosis.textContent=!result.hasEvidence?'Tanılama için önce ağ testi çalıştır.':result.issues.length?result.issues.length+' olası sorun kaydı var. '+result.issues[0].summary+' Öneri: '+result.issues[0].hint:'Bu kayıtlarda açık bir paket reddi veya ICMP ulaşamama olayı yok.'+(result.truncated?' Olay kaydı sınırlı; sonuç kesin değil.':'');
 const step=AgLabPacketEvents.at(snapshot,index);
 previous.disabled=!step?.hasPrevious;next.disabled=!step?.hasNext;
 if(!step){
  status.textContent=allEvents.events.length?'Bu filtreye uygun ağ olayı yok.':'Henüz görüntülenecek ağ olayı yok.';
  explanation.textContent='';raw.textContent='';markDevice(null);return;
 }
 status.textContent='Adım '+(step.index+1)+' / '+step.total+(snapshot.truncated?' · Kayıt sınırı aşıldı; '+snapshot.overflow+' olay gösterilemiyor.':'');
 explanation.textContent=step.explanation;
 raw.textContent=step.raw;
 markDevice(step.device);
 markForwardEdge(step);
}
go.onclick=()=>{
 const id=targetDevice();
 if(!id)return;
 selected=id;
 const selector=document.getElementById('ptCliDevice');
 if(selector)selector.value=id;
 updateInspector();render();
 const node=[...document.querySelectorAll('#ptCanvas g[data-id]')].find(el=>el.getAttribute('data-id')===id);
 if(node){node.scrollIntoView({block:'nearest',inline:'nearest'});node.setAttribute('aria-label','Sorun kaydıyla ilişkili seçili cihaz');}
};
refresh.onclick=()=>{
 allEvents=AgLabPacketEvents.normalize(ethernetEvents.slice(),ethernetEventOverflow);
 snapshot=filtered();index=0;render();
};
filter.onchange=()=>{snapshot=filtered();index=0;render()};
previous.onclick=()=>{if(index>0){index--;render()}};
next.onclick=()=>{if(index+1<snapshot.events.length){index++;render()}};
render();
})();
