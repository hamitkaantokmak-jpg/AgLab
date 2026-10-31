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
controls.append(refresh,previous,next);panel.append(controls);
const status=document.createElement('p');status.id='packetDetectiveStatus';status.setAttribute('role','status');panel.append(status);
const explanation=document.createElement('p');explanation.id='packetDetectiveExplanation';panel.append(explanation);
const raw=document.createElement('pre');raw.id='packetDetectiveRaw';raw.style.whiteSpace='pre-wrap';raw.style.overflowWrap='anywhere';panel.append(raw);
host.append(panel);
let snapshot={events:[],overflow:0,truncated:false},index=0;
let marked=null;
function markDevice(id){
 if(marked){marked.removeAttribute('stroke');marked.removeAttribute('stroke-width');marked=null;}
 if(!id)return;
 const canvas=document.getElementById('ptCanvas');
 if(!canvas)return;
 const group=[...canvas.querySelectorAll('g[data-id]')].find(node=>node.getAttribute('data-id')===id);
 const outline=group?.querySelector('rect');
 if(outline){outline.setAttribute('stroke','#ffcb38');outline.setAttribute('stroke-width','4');marked=outline;}
}
function render(){
 const step=AgLabPacketEvents.at(snapshot,index);
 previous.disabled=!step?.hasPrevious;next.disabled=!step?.hasNext;
 if(!step){
  status.textContent='Henüz görüntülenecek ağ olayı yok.';
  explanation.textContent='';raw.textContent='';markDevice(null);return;
 }
 status.textContent='Adım '+(step.index+1)+' / '+step.total+(snapshot.truncated?' · Kayıt sınırı aşıldı; '+snapshot.overflow+' olay gösterilemiyor.':'');
 explanation.textContent=step.explanation;
 raw.textContent=step.raw;
 markDevice(step.device);
}
refresh.onclick=()=>{
 snapshot=AgLabPacketEvents.normalize(ethernetEvents.slice(),ethernetEventOverflow);
 index=0;render();
};
previous.onclick=()=>{if(index>0){index--;render()}};
next.onclick=()=>{if(index+1<snapshot.events.length){index++;render()}};
render();
})();
