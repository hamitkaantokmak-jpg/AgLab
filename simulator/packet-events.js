/* Normalize real simulator event strings for a future step-by-step Packet Detective.
 * No network simulation takes place here; no synthetic hops are created.
 */
(function(root){
'use strict';
function normalize(lines,overflow=0){
 if(!Array.isArray(lines)||!Number.isSafeInteger(overflow)||overflow<0)throw Error('Invalid packet event log');
 const entries=lines.map((raw,index)=>{
  if(typeof raw!=='string')throw Error('Invalid packet event');
  let kind='other',device=null,detail=raw;
  let m=raw.match(/^frame (\S+) src (\S+) dst (\S+) vlan (\d+)$/);
  if(m){kind='frame';device=m[2];detail={protocol:m[1],source:m[2],destinationMac:m[3],vlan:Number(m[4])}}
  else if((m=raw.match(/^receive (\S+) (\S+) vlan (\d+)(?: svi vlan (\d+))?$/))){kind='receive';device=m[1];detail={protocol:m[2],vlan:Number(m[3]),svi:m[4]!==undefined}}
  else if((m=raw.match(/^(broadcast|unknown-unicast|unicast|filter) (\S+) ingress (\S+) egress (.*?) vlan (\d+)$/))){kind='forward';device=m[2];detail={decision:m[1],ingress:m[3],egress:m[4]==='-'?[]:m[4].split(','),vlan:Number(m[5])}}
  else if((m=raw.match(/^ttl-forward (\S+) (\d+) -> (\d+)$/))){kind='ttl';device=m[1];detail={before:Number(m[2]),after:Number(m[3])}}
  else if((m=raw.match(/^discard (\S+) (.*)$/))){kind='discard';device=m[1];detail={reason:m[2]}}
  else if(raw.startsWith('icmp-delivered ')){kind='icmp-delivered'}
  else if(raw.startsWith('icmp-undelivered ')){kind='icmp-undelivered'}
  return {index,kind,device,detail,raw};
 });
 return {events:entries,overflow,truncated:overflow>0};
}
function explain(event){
 if(!event||typeof event!=='object')throw Error('Invalid packet event');
 const d=event.detail;
 switch(event.kind){
 case 'frame':return event.device+' cihazı '+d.protocol+' çerçevesini VLAN '+d.vlan+' üzerinden gönderdi.';
 case 'forward':{
  const label={broadcast:'Yayın', 'unknown-unicast':'Bilinmeyen hedefe yayılım',unicast:'Öğrenilmiş MAC yönlendirmesi',filter:'Giriş portuna geri gönderim engellendi'}[d.decision]||'İletim';
  return event.device+': '+label+'; giriş '+d.ingress+'; çıkış '+(d.egress.join(', ')||'yok')+'.';
 }
 case 'receive':return event.device+' cihazı '+d.protocol+' çerçevesini aldı'+(d.svi?' (SVI)':'')+'.';
 case 'ttl':return event.device+' yönlendiricisinde TTL '+d.before+' → '+d.after+' oldu.';
 case 'discard':return event.device+' çerçeveyi reddetti: '+d.reason+'.';
 case 'icmp-delivered':return 'ICMP yanıtı kaynağa ulaştı.';
 case 'icmp-undelivered':return 'ICMP yanıtı kaynağa ulaşamadı.';
 default:return event.raw;
 }
}
function diagnose(log){
 if(!log||!Array.isArray(log.events))throw Error('Invalid packet event log');
 const issues=[];
 for(const event of log.events){
  if(event.kind==='discard'){
   const reason=event.detail.reason;
   const hint=reason==='ingress-port'?'Giriş portu kapalı veya bağlantı geçersiz olabilir; port durumunu ve kabloyu kontrol et.':reason==='destination-mac'?'Hedef MAC adresi eşleşmedi; hedef cihazın MAC adresini ve VLAN üyeliğini kontrol et.':'Bu reddetme nedenini olay kaydından incele.';
   issues.push({index:event.index,device:event.device,reason,summary:event.device+' cihazında çerçeve reddedildi.',hint});
  }else if(event.kind==='icmp-undelivered'){
   issues.push({index:event.index,device:event.device,reason:'icmp-undelivered',summary:'ICMP yanıtı kaynağa ulaşamadı.',hint:'IP adresleme, varsayılan ağ geçidi ve gidiş-dönüş yönlendirme yolunu kontrol et; bu kayıt tek başına kesin nedeni göstermiyor.'});
  }
 }
 return {issues,hasEvidence:log.events.length>0,truncated:!!log.truncated};
}
function at(log,index){
 if(!log||!Array.isArray(log.events)||!Number.isInteger(index)||index<0||index>=log.events.length)return null;
 const event=log.events[index];
 return {index,total:log.events.length,...event,explanation:explain(event),hasPrevious:index>0,hasNext:index<log.events.length-1,logTruncated:!!log.truncated};
}
const api=Object.freeze({normalize,explain,at,diagnose});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.AgLabPacketEvents=api;
})(typeof globalThis!=='undefined'?globalThis:this);
