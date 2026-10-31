// Runs inside the simulator closure: all probes use the live student topology.
let academyActive=null, academyHintIndex=0, academyBaseline=0, academyChecked=false, academyLastCheckedState=null;
const academyProgressKey='aglab-academy-progress-v1';
let academyProgress={};
const ac=id=>document.getElementById(id);
const academyPanel=document.createElement('section');
academyPanel.className='panel';academyPanel.id='academyPanel';
academyPanel.innerHTML=`<h2>AğLab Akademi v1</h2>
<details id="academyRealLab">
<summary>Gerçek Lab tanıları</summary>
<p>İki router ve iki PC'den oluşan gerçek örnek topolojinin salt okunur tanılarını incele.</p>
<p>Bu bilgisayarda öğrenci servisi çalışıyor olmalı. Öğrenci anahtarını açılan ekranda gir.</p>
<p><a id="academyRealLabLink" href="http://127.0.0.1:8766/" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Öğrenci tanılarını aç ↗</a></p>
<p>Gerçek örnek topoloji ayrı çalışır. Akademi'deki etkin görevin ve ilerlemen bu sekmede kalır.</p>
</details>
<label>Laboratuvar <select id="academySelect"></select></label>
<button id="academyStart">Laboratuvarı başlat</button>
<button id="academyReset" disabled>Baştan başla / sıfırla</button>
<p id="academyNotice">Başlat ve sıfırla, çalışma alanındaki topolojiyi değiştirir. Mevcut çalışmanı önce JSON olarak dışa aktarabilirsin.</p>
<p id="academyProgress" role="status"></p>
<div id="academyLesson"></div><div id="academyAnswers"></div>
<button id="academyCheck" disabled>Çözümümü kontrol et</button>
<button id="academyHint" disabled>Sıradaki ipucu</button>
<ol id="academyHints"></ol><div id="academyResult" role="status" aria-live="polite"></div>`;
ac('area-lab').prepend(academyPanel);
academyLabs.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.id+' — '+l.title;ac('academySelect').append(o)});
const answerFields={
 static_route_required:{label:'Doğrudan bağlı iki ağ arasında ek statik rota gerekli mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 gateway_same_local_subnet:{label:'Varsayılan ağ geçidi uç ile aynı yerel alt ağda olmalı mı?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 transit_broadcast:{label:'Transit ağının yayın adresi',type:'ipv4'},
 r1_next_hop:{label:'R1 için sonraki atlama adresi',type:'ipv4'},
 missing_route_router:{label:'Eksik dönüş rotası hangi router üzerinde?',options:[['R1','R1'],['R2','R2']]},
 bad_next_hop_reason:{label:'Yanlış sonraki atlama adresinin sorunu nedir?',options:[['broadcast','Yayın adresi'],['network','Ağ adresi'],['host','Geçerli host adresi']]},
 default_proves_internet:{label:'Varsayılan rota tek başına internet erişimini kanıtlar mı?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 route_for_192_168_20_20:{label:'192.168.20.20 için seçilen rota öneği',type:'cidr'},
 route_for_203_0_113_9:{label:'203.0.113.9 için eşleşen rota öneği',type:'cidr'},
 prefix_before_distance:{label:'Rota seçiminde önek uzunluğu idari uzaklıktan önce mi gelir?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 learning_field:{label:'Switch MAC öğrenirken hangi alanı kullanır?',options:[['source_mac','Kaynak MAC'],['destination_mac','Hedef MAC'],['source_ip','Kaynak IP']]},
 forwarding_field:{label:'Switch iletim kararında hangi alanı kullanır?',options:[['source_mac','Kaynak MAC'],['destination_mac','Hedef MAC'],['destination_ip','Hedef IP']]},
 management_ip_required:{label:'Aynı VLAN iletimi için switch yönetim IP adresi zorunlu mu?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 ip_selects_vlan:{label:'Uç cihazın IP adresi access VLAN üyeliğini belirler mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 direct_l2_between_vlans:{label:'Farklı VLAN uçları router olmadan doğrudan erişebilir mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 allowed_list_creates_vlan:{label:'Trunk allowed listesi VLAN veritabanını oluşturur mu?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 inter_vlan_function:{label:'VLAN’lar arası erişim için hangi işlev gerekir?',options:[['routing','Yönlendirme'],['switching','Katman 2 switching'],['dns','DNS']]},
 vlan_id_must_match_ip_octet:{label:'VLAN numarası IP adresinin oktetiyle eşleşmek zorunda mı?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 common_fault:{label:'İki VLAN için ortak arızalı bileşen hangisidir?',options:[['trunk_link','Switchler arası trunk bağlantısı'],['pc1_link','PC1 bağlantısı'],['pc2_link','PC2 bağlantısı']]},
 endpoint_broadcast_domains:{label:'Access uçlarının ait olduğu yayın alanı sayısı',type:'integer'},
 native_default_tagging:{label:'Native VLAN’ın yaygın etiket davranışı nedir?',options:[['untagged','Etiketsiz'],['tagged','Etiketli']]},

 network:{label:'Ağ adresi',type:'ipv4'},
 broadcast:{label:'Yayın adresi',type:'ipv4'},
 first_host:{label:'İlk kullanılabilir host adresi',type:'ipv4'},
 last_host:{label:'Son kullanılabilir host adresi',type:'ipv4'},
 usable_hosts:{label:'Kullanılabilir host sayısı',type:'integer'},
 department_b_network:{label:'B bölümü ağı (CIDR)',type:'cidr'},
 transit_network:{label:'Transit ağ adresi (görevde istenen biçim)',type:'ip-network'},
 gateway_candidate:{label:'Ağ geçidi adayı',type:'ipv4'},
 initial_pair_local_under_both_masks:{label:'Başlangıçtaki iki adres her iki maskeye göre de yerel mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 ping_proves_mask_correct:{label:'Başarılı ping maskenin doğru olduğunu kanıtlar mı?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 pc1_pc2_survives_pc3_link_loss:{label:'Sadece PC3 kablosu çıkarılırsa PC1–PC2 erişimi sürer mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 ping_protocol:{label:'Ping hangi protokolü kullanır?',options:[['ICMP','ICMP'],['TCP','TCP'],['UDP','UDP']]},
 ping_proves_http:{label:'Başarılı ping HTTP hizmetinin çalıştığını kesin kanıtlar mı?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 arp_target_ip:{label:'Yerel hedef için ARP ile sorulan IP hangisidir?',options:[['192.168.1.10','192.168.1.10'],['192.168.1.20','192.168.1.20'],['192.168.1.255','192.168.1.255']]},
 arp_resolves:{label:'ARP hangi adres türünü çözer?',options:[['MAC','MAC'],['IP','IP'],['DNS','DNS']]},
 arp_crosses_router:{label:'ARP yayını routerdan geçer mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 dns_required_for_ip_ping:{label:'IP adresine ping için DNS gerekli mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 initial_same_subnet:{label:'Başlangıçtaki adresler aynı /24 ağda mıydı?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 router_required:{label:'Bu yerel ağda router gerekli mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 l2_device:{label:'Katman 2 çerçevelerini ileten cihaz hangisi?',options:[['pc','PC'],['switch','Switch'],['router','Router']]},
 inter_network_device:{label:'Farklı IP ağlarını bağlayan cihaz hangisi?',options:[['pc','PC'],['switch','Switch'],['router','Router']]},
 fault_layer:{label:'Kesintinin kaynağı hangi katmanda?',options:[['physical','Fiziksel yol'],['network','IP / ağ'],['application','Uygulama']]}
};
function acAnswerValue(field,raw){
 if(field.boolean)return raw==='true';
 if(field.type==='integer'&&/^\d+$/.test(raw.trim())&&Number.isSafeInteger(Number(raw)))return Number(raw);
 return field.type?raw.trim():raw;
}
function acAnswerAllowed(field,value){
 if(field.type==='integer')return (typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)||(typeof value==='string'&&value.length<=128);
 if(field.type)return typeof value==='string'&&value.length<=128;
 return field.options.some(([v])=>field.boolean?(v==='true')===value&&typeof value==='boolean':v===value);
}
function acNormalizeAnswer(key,value){
 let type=answerFields[key]?.type;
 if(type==='ip-network'&&typeof value==='string')type=value.includes('/')?'cidr':'ipv4';
 if((type!=='ipv4'&&type!=='cidr')||typeof value!=='string')return value;
 const parts=value.trim().split('/'),octets=parts[0].split('.');
 if(octets.length!==4||octets.some(v=>!/^\d{1,3}$/.test(v)||Number(v)>255))return null;
 const nums=octets.map(Number);
 if(type==='ipv4')return parts.length===1?nums.join('.'):null;
 if(parts.length!==2||!/^\d{1,2}$/.test(parts[1])||Number(parts[1])>32)return null;
 const prefix=Number(parts[1]),ip=nums.reduce((a,n)=>(a*256+n)>>>0,0),mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
 const network=(ip&mask)>>>0;
 return [24,16,8,0].map(shift=>(network>>>shift)&255).join('.')+'/'+prefix;
}
function academyAnswers(){const a={};ac('academyAnswers').querySelectorAll('select,input').forEach(s=>{if(s.value!=='')a[s.dataset.key]=acAnswerValue(answerFields[s.dataset.key],s.value)});return a}
function acText(parent,tag,text){const e=document.createElement(tag);e.textContent=text;parent.append(e);return e}
function academyValidateSession(session){
 if(!session||typeof session!=='object'||Array.isArray(session)||session.version!==1||Object.keys(session).some(k=>!['version','labId','answers','hintIndex','baseline','checked'].includes(k)))throw new Error('Akademi oturum kaydı geçersiz.');
 const lab=academyLabs.find(l=>l.id===session.labId);if(!lab)throw new Error('Kayıtlı Akademi laboratuvarı bulunamadı.');
 if(!Number.isInteger(session.hintIndex)||session.hintIndex<0||session.hintIndex>lab.hints.length||!Number.isInteger(session.baseline)||session.baseline<0||session.baseline>100||typeof session.checked!=='boolean')throw new Error('Akademi oturum durumu geçersiz.');
 if(!session.answers||typeof session.answers!=='object'||Array.isArray(session.answers))throw new Error('Akademi cevap kaydı geçersiz.');
 const keys=lab.assessment.criteria.filter(c=>c.kind==='answer.equals').map(c=>c.target.split('.')[1]);
 for(const [key,value] of Object.entries(session.answers)){
  const field=answerFields[key];if(!keys.includes(key)||!field||!acAnswerAllowed(field,value))throw new Error('Akademi cevap değeri geçersiz.');
 }
 return lab;
}
function academyWorkSignature(){return JSON.stringify({devices:devices.map(({x,y,w,h,name,...state})=>state),links,answers:academyAnswers()})}
function academyInvalidateResult(){
 if(academyActive&&academyChecked&&academyLastCheckedState!==null&&academyWorkSignature()!==academyLastCheckedState){
  ac('academyResult').replaceChildren();acText(ac('academyResult'),'p','Çalışman son kontrolden sonra değişti. Yeniden kontrol et; önceki puan güncel çözümün sonucu değildir.');
 }
}
function academySessionFields(){return academyActive?{academySession:{version:1,labId:academyActive.id,answers:academyAnswers(),hintIndex:academyHintIndex,baseline:academyBaseline,checked:academyChecked}}:{}}
function academyClearSession(){
 academyActive=null;academyHintIndex=0;academyBaseline=0;academyChecked=false;academyLastCheckedState=null;
 ['academyLesson','academyAnswers','academyHints','academyResult'].forEach(id=>ac(id).replaceChildren());
 ['academyReset','academyCheck','academyHint'].forEach(id=>ac(id).disabled=true);
 ac('academyNotice').textContent='Bir laboratuvar seçip başlat. Başlat ve sıfırla mevcut topolojiyi değiştirir; önce JSON olarak dışa aktarabilirsin.';
}
function academyNotice(){ac('academyNotice').textContent='Etkin görev: '+academyActive.id+'. Başlangıçta zaten sağlanan ölçütler: '+academyBaseline+'/100 puan. Kontrol güncel topolojini kullanır; çalışman bu tarayıcıda kaldığın yerden açılır.'}
function academyRestoreSession(session){
 if(!session){academyClearSession();return}
 const lab=academyValidateSession(session);academyActive=lab;academyHintIndex=session.hintIndex;academyBaseline=session.baseline;academyChecked=session.checked;academyLastCheckedState=null;
 ac('academySelect').value=lab.id;
 ac('academyLesson').replaceChildren();acText(ac('academyLesson'),'h3',lab.id+' — '+lab.title);
 acText(ac('academyLesson'),'p',lab.theory);acText(ac('academyLesson'),'p',lab.scenario);
 const ol=document.createElement('ol');lab.steps.forEach(s=>acText(ol,'li',s.text));ac('academyLesson').append(ol);
 acText(ac('academyLesson'),'p','Beklenen sonuç: '+lab.expected_result);
 if(lab.probe_health)acText(ac('academyLesson'),'p','Yalıtım kontrolünden önce görevdeki kablo, adres, VLAN ve trunk planını tamamla. Kapalı cihaz veya port, kopuk kablo ya da eksik VLAN yalıtım başarısı sayılmaz; önce bu koşulları düzelt.');
 ac('academyAnswers').replaceChildren();
 lab.assessment.criteria.filter(c=>c.kind==='answer.equals').forEach(c=>{
  const key=c.target.split('.')[1],field=answerFields[key];const label=acText(ac('academyAnswers'),'label',field.label+' ');
  const control=document.createElement(field.type?'input':'select');control.id='academyAnswer-'+key;control.dataset.key=key;
  if(field.type){control.type='text';control.maxLength=128;control.inputMode=field.type==='integer'?'numeric':'text';control.autocomplete='off';control.placeholder=field.type==='cidr'?'a.b.c.d/önek':field.type==='ipv4'?'a.b.c.d':field.type==='ip-network'?'IPv4 veya ağ/önek':'Tam sayı';}
  else [['','Cevabını seç'],...field.options].forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;control.append(o)});
  label.htmlFor=control.id;label.append(control);
  if(Object.hasOwn(session.answers,key))control.value=String(session.answers[key]);
  control.oninput=control.onchange=()=>saveTopology(true);
 });
 ac('academyHints').replaceChildren();lab.hints.slice(0,academyHintIndex).forEach(h=>acText(ac('academyHints'),'li',h));ac('academyResult').replaceChildren();
 ac('academyReset').disabled=false;ac('academyCheck').disabled=false;ac('academyHint').disabled=academyHintIndex>=lab.hints.length;
 academyNotice();if(academyChecked)academyCheck(false);
}
function academyStart(){
 const lab=academyLabs.find(l=>l.id===ac('academySelect').value);if(!lab)return;
 importTopology({...clone(lab.initial_topology),academySession:{version:1,labId:lab.id,answers:{},hintIndex:0,baseline:0,checked:false}});
 academyBaseline=academyEvaluate(lab.assessment.criteria,{},lab.probe_health).earned_points;academyNotice();saveTopology(true);
}
function academyRenderProgress(){
 const completed=academyLabs.filter(l=>academyProgress[l.id]?.bestScore===100).length;
 ac('academyProgress').textContent='Tamamlanan laboratuvar: '+completed+'/'+academyLabs.length+'. En iyi puanların bu tarayıcıda saklanır; sıfırlama başarı geçmişini silmez.';
 academyLabs.forEach(l=>{const option=[...ac('academySelect').options].find(o=>o.value===l.id),score=academyProgress[l.id]?.bestScore;option.textContent=l.id+' — '+l.title+(score===100?' — Tamamlandı (100/100)':score!==undefined?' — En iyi '+score+'/100':'')});
}
function academyRecordProgress(result){
 if(result.status!=='complete')return;
 const old=academyProgress[academyActive.id]?.bestScore||0;
 academyProgress[academyActive.id]={bestScore:Math.max(old,result.earned_points)};academyRenderProgress();
 try{localStorage.setItem(academyProgressKey,JSON.stringify(academyProgress))}catch(e){ac('academyNotice').textContent+=' İlerleme geçmişi kaydedilemedi; tarayıcı depolamasını kontrol et.'}
}
function acCanonical(v){
 if(Array.isArray(v))return v.map(acCanonical);
 if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,acCanonical(v[k])]));
 return v;
}
function acLinks(ls){return ls.map(l=>({ends:[[l.a,l.portA],[l.b,l.portB]].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),up:l.up!==false})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}
function acState(target){const parts=target.split('.');if(parts[0]==='links')return links;
 if(parts[0]!=='devices')throw new Error('Desteklenmeyen durum yolu');
 let val=get(parts[1]);for(const p of parts.slice(2))val=val?.[p];return val;
}
function acProbe(source,destination,spec={}){
 const src=get(source),d=get(destination);
 if(!src)throw new Error('Probe için kaynak cihaz eksik.');
 const ip=spec.destination_ip??d?.ip;
 if(!spec.destination_ip&&!d)throw new Error('Probe için hedef cihaz eksik.');
 if(!ip||!validIP(ip))return Array.from({length:5},()=>({ok:false,why:'Hedef cihazda geçerli IPv4 adresi yapılandırılmamış.'}));
 let binding=null;
 if(spec.source_interface){
  binding=AgLabRoutingGrading.sourceBinding(src,spec.source_interface,routeLookup(src,ip));
  if(!binding)return Array.from({length:5},()=>({ok:false,why:'İstenen kaynak arayüzü kapalı, adresi geçersiz veya bağlı çıkışı yok.'}));
 }
 return Array.from({length:5},()=>{const r=ping(source,ip);return binding?{...r,why:r.why+' Kaynak arayüzü: '+binding.interface+' '+binding.ip+'.'}:r;});
}
function academyEvaluate(criteria,answers,health=null){
 const rows=criteria.map(c=>{
  let status='not_evaluated',detail='Bu ölçüt henüz desteklenmiyor.';
  try{
   if(c.kind==='state.equals'){
    const actual=acState(c.target);let a=actual,e=c.expected;
    if(c.target==='links'){validateTopologyData({app:'AgLab',devices,links});a=acLinks(actual);e=acLinks(e)}
    else if(/\.staticRoutes$/.test(c.target)){a=AgLabRoutingGrading.sameRoutes(a,e)?e:null;}
    else if(/^devices\.[^.]+\.interfaces\.[^.]+$/.test(c.target)){a=AgLabRoutingGrading.interfaceState(a);e=AgLabRoutingGrading.interfaceState(e);}
    else if(/\.(vlans|allowed)$/.test(c.target)){a=AgLabVlanHealth.sameVlanSet(a,e)?e:null;}
    else if(/\.(ip|mask|gateway)$/.test(c.target)&&typeof a==='string'&&validIP(a))a=a.split('.').map(Number).join('.');
    const ok=JSON.stringify(acCanonical(a))===JSON.stringify(acCanonical(e));status=ok?'passed':'failed';
    detail=ok?'Ölçüt sağlandı.':c.target==='links'?'Kablo uçlarını, portlarını ve bağlantı durumlarını görev adımlarıyla karşılaştır.':c.target+' alanını cihaz ayarlarında kontrol et.';
   }else if(c.kind==='answer.equals'){
    const key=c.target.split('.')[1],a=answers[key];status=acNormalizeAnswer(key,a)===acNormalizeAnswer(key,c.expected)?'passed':'failed';detail=status==='passed'?'Cevap doğru.':a===undefined?'Kavramsal soruya cevap seç.':'Cihazın rolünü konu anlatımından tekrar incele.';
   }else if(c.kind==='probe.icmp'){
    if(c.expected!==true&&c.expected!==false){status='not_evaluated';detail='ICMP beklentisi desteklenmiyor.'}
    else if(c.expected===false&&!health){status='not_evaluated';detail='Negatif ICMP sağlık planı bulunamadı.'}
    else{
     if(!c.target.destination&&!c.target.destination_ip)throw new Error('Bu probe biçimi henüz desteklenmiyor.');
     if(c.expected===false){
      AgLabVlanHealth.assertHealthy({devices,links},health);
      for(const control of health.controls){if(acProbe(control.source,control.destination).slice(1).filter(r=>r.ok).length<3)throw new Error('Aynı VLAN pozitif sağlık kontrolü başarısız: '+control.source+' → '+control.destination);}
     }
     // Deterministic synchronous engine: first of five is warm-up, no wall-clock timing.
     const runs=acProbe(c.target.source,c.target.destination,c.target);
     const ok=c.expected?runs.slice(1).filter(r=>r.ok).length>=3:runs.every(r=>!r.ok);
     status=ok?'passed':'failed';
     detail=c.expected?(ok?'5 denemelik simüle ICMP kontrolü başarılı. ':'Erişim başarısız: ')+runs.at(-1).why:(ok?'Planlanan sağlıklı ağda 5 denemede erişim yok; yalıtım doğrulandı.':'Yalıtım beklenirken erişim sağlandı.');
    }
   }
  }catch(e){status='error';detail='Değerlendirme tamamlanamadı: '+e.message}
  return {id:c.id,kind:c.kind,label:c.label,points:c.points,status,detail};
 });
 return AgLabGradingVerdict.finalize(rows);
}
function academyCheck(persist=true){
 if(!academyActive)return null;academyChecked=true;const result=academyEvaluate(academyActive.assessment.criteria,academyAnswers(),academyActive.probe_health);
 const box=ac('academyResult');box.replaceChildren();
 acText(box,'h3',result.earned_points+'/100 — '+(result.status==='incomplete'?'Değerlendirme eksik':result.earned_points===100?'Tüm ölçütler sağlandı':'Düzenlemeye devam et'));
 acText(box,'p','Değerlendirilen puan: '+result.evaluated_max_points+'/100. Başlangıçta sağlanan: '+academyBaseline+'/100.');
 const ul=document.createElement('ul');result.criteria.forEach(r=>acText(ul,'li',r.label+' · '+(r.status==='passed'?r.points:0)+'/'+r.points+' · '+r.detail));box.append(ul);academyLastCheckedState=academyWorkSignature();if(persist){academyRecordProgress(result);saveTopology(true)}return result;
}
ac('academyStart').onclick=academyStart;
ac('academyReset').onclick=()=>{if(academyActive){ac('academySelect').value=academyActive.id;academyStart()}};
ac('academySelect').onchange=()=>{ac('academyNotice').textContent='Seçilen görevi açmak için Laboratuvarı başlat düğmesine bas. Etkin görev: '+(academyActive?.id||'yok')};
ac('academyCheck').onclick=()=>academyCheck();
ac('academyHint').onclick=()=>{if(!academyActive)return;const hint=academyActive.hints[academyHintIndex++];if(hint)acText(ac('academyHints'),'li',hint);if(academyHintIndex>=academyActive.hints.length)ac('academyHint').disabled=true;saveTopology(true)};
window.academy={check:academyCheck,evaluate:academyEvaluate};
window.academyEngine={load:t=>importTopology({...clone(t),...academySessionFields()}),snapshot:()=>clone({app:'AgLab',version:23,devices,links,nextId,selected})};

try{const saved=JSON.parse(localStorage.getItem(academyProgressKey)||'{}');for(const lab of academyLabs){const score=saved?.[lab.id]?.bestScore;if(Number.isInteger(score)&&score>=0&&score<=100)academyProgress[lab.id]={bestScore:score}}}catch(e){}
academyRenderProgress();
