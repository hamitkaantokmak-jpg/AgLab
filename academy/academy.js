// Runs inside the simulator closure: all probes use the live student topology.
let academyActive=null, academyHintIndex=0, academyBaseline=0;
const ac=id=>document.getElementById(id);
const academyPanel=document.createElement('section');
academyPanel.className='panel';academyPanel.id='academyPanel';
academyPanel.innerHTML=`<h2>AğLab Akademi v1</h2>
<label>Laboratuvar <select id="academySelect"></select></label>
<button id="academyStart">Laboratuvarı başlat</button>
<button id="academyReset" disabled>Baştan başla / sıfırla</button>
<p id="academyNotice">Başlat ve sıfırla, çalışma alanındaki topolojiyi değiştirir. Mevcut çalışmanı önce JSON olarak dışa aktarabilirsin.</p>
<div id="academyLesson"></div><div id="academyAnswers"></div>
<button id="academyCheck" disabled>Çözümümü kontrol et</button>
<button id="academyHint" disabled>Sıradaki ipucu</button>
<ol id="academyHints"></ol><div id="academyResult" role="status" aria-live="polite"></div>`;
ac('area-lab').prepend(academyPanel);
academyLabs.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.id+' — '+l.title;ac('academySelect').append(o)});
const answerFields={
 router_required:{label:'Bu yerel ağda router gerekli mi?',options:[['true','Evet'],['false','Hayır']],boolean:true},
 l2_device:{label:'Katman 2 çerçevelerini ileten cihaz hangisi?',options:[['pc','PC'],['switch','Switch'],['router','Router']]},
 inter_network_device:{label:'Farklı IP ağlarını bağlayan cihaz hangisi?',options:[['pc','PC'],['switch','Switch'],['router','Router']]},
 fault_layer:{label:'Kesintinin kaynağı hangi katmanda?',options:[['physical','Fiziksel yol'],['network','IP / ağ'],['application','Uygulama']]}
};
function academyAnswers(){const a={};ac('academyAnswers').querySelectorAll('select').forEach(s=>{if(s.value!=='')a[s.dataset.key]=answerFields[s.dataset.key].boolean?s.value==='true':s.value});return a}
function acText(parent,tag,text){const e=document.createElement(tag);e.textContent=text;parent.append(e);return e}
function academyStart(){
 const lab=academyLabs.find(l=>l.id===ac('academySelect').value);if(!lab)return;
 importTopology(clone(lab.initial_topology));academyActive=lab;academyHintIndex=0;
 ac('academyLesson').replaceChildren();acText(ac('academyLesson'),'h3',lab.id+' — '+lab.title);
 acText(ac('academyLesson'),'p',lab.theory);acText(ac('academyLesson'),'p',lab.scenario);
 const ol=document.createElement('ol');lab.steps.forEach(s=>acText(ol,'li',s.text));ac('academyLesson').append(ol);
 acText(ac('academyLesson'),'p','Beklenen sonuç: '+lab.expected_result);
 ac('academyAnswers').replaceChildren();
 lab.assessment.criteria.filter(c=>c.kind==='answer.equals').forEach(c=>{
  const key=c.target.split('.')[1],field=answerFields[key];const label=acText(ac('academyAnswers'),'label',field.label+' ');
  const select=document.createElement('select');select.id='academyAnswer-'+key;select.dataset.key=key;
  [['','Cevabını seç'],...field.options].forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)});label.append(select);
 });
 ac('academyHints').replaceChildren();ac('academyResult').replaceChildren();
 ['academyReset','academyCheck','academyHint'].forEach(id=>ac(id).disabled=false);
 academyBaseline=academyEvaluate(lab.assessment.criteria,{}).earned_points;
 ac('academyNotice').textContent='Etkin görev: '+lab.id+'. Başlangıçta zaten sağlanan ölçütler: '+academyBaseline+'/100 puan. Özgün başlangıç ve rubrik korunmuştur. Kontrol, güncel topolojini kullanır.';
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
function academyEvaluate(criteria,answers){
 const rows=criteria.map(c=>{
  let status='not_evaluated',detail='Bu ölçüt henüz desteklenmiyor.';
  try{
   if(c.kind==='state.equals'){
    const actual=acState(c.target);let a=actual,e=c.expected;
    if(c.target==='links'){validateTopologyData({app:'AgLab',devices,links});a=acLinks(actual);e=acLinks(e)}
    else if(/\.(ip|mask|gateway)$/.test(c.target)&&typeof a==='string'&&validIP(a))a=a.split('.').map(Number).join('.');
    const ok=JSON.stringify(acCanonical(a))===JSON.stringify(acCanonical(e));status=ok?'passed':'failed';
    detail=ok?'Ölçüt sağlandı.':c.target==='links'?'Kablo uçlarını, portlarını ve bağlantı durumlarını görev adımlarıyla karşılaştır.':c.target+' alanını cihaz ayarlarında kontrol et.';
   }else if(c.kind==='answer.equals'){
    const a=answers[c.target.split('.')[1]];status=a===c.expected?'passed':'failed';detail=status==='passed'?'Cevap doğru.':a===undefined?'Kavramsal soruya cevap seç.':'Cihazın rolünü konu anlatımından tekrar incele.';
   }else if(c.kind==='probe.icmp'){
    if(c.expected!==true){status='not_evaluated';detail='Negatif ICMP sağlık önkoşulları bu sürümde desteklenmiyor.'}
    else{
     const destination=get(c.target.destination);if(!get(c.target.source)||!destination)throw new Error('Probe için cihaz eksik.');
     // Simulator is synchronous/deterministic: five live evaluations, first warm-up.
     // No wall-clock convergence or packet loss is modeled by this engine.
     const runs=Array.from({length:5},()=>ping(c.target.source,destination.ip));
     const ok=runs.slice(1).filter(r=>r.ok).length>=3;status=ok?'passed':'failed';
     detail=(ok?'5 denemelik simüle ICMP kontrolü başarılı. ': 'Erişim başarısız: ')+runs.at(-1).why;
    }
   }
  }catch(e){status='error';detail='Değerlendirme tamamlanamadı: '+e.message}
  return {id:c.id,kind:c.kind,label:c.label,points:c.points,status,detail};
 });
 const earned=rows.filter(r=>r.status==='passed').reduce((s,r)=>s+r.points,0);
 const max=rows.filter(r=>['passed','failed'].includes(r.status)).reduce((s,r)=>s+r.points,0);
 return {earned_points:earned,evaluated_max_points:max,nominal_max_points:100,coverage:max/100,status:max===100&&!rows.some(r=>r.status==='error')?'complete':'incomplete',criteria:rows};
}
function academyCheck(){
 if(!academyActive)return null;const result=academyEvaluate(academyActive.assessment.criteria,academyAnswers());
 const box=ac('academyResult');box.replaceChildren();
 acText(box,'h3',result.earned_points+'/100 — '+(result.status==='incomplete'?'Değerlendirme eksik':result.earned_points===100?'Tüm ölçütler sağlandı':'Düzenlemeye devam et'));
 acText(box,'p','Değerlendirilen puan: '+result.evaluated_max_points+'/100. Başlangıçta sağlanan: '+academyBaseline+'/100.');
 const ul=document.createElement('ul');result.criteria.forEach(r=>acText(ul,'li',r.label+' · '+(r.status==='passed'?r.points:0)+'/'+r.points+' · '+r.detail));box.append(ul);return result;
}
ac('academyStart').onclick=academyStart;
ac('academyReset').onclick=()=>{if(academyActive){ac('academySelect').value=academyActive.id;academyStart()}};
ac('academySelect').onchange=()=>{ac('academyNotice').textContent='Seçilen görevi açmak için Laboratuvarı başlat düğmesine bas. Etkin görev: '+(academyActive?.id||'yok')};
ac('academyCheck').onclick=academyCheck;
ac('academyHint').onclick=()=>{if(!academyActive)return;const hint=academyActive.hints[academyHintIndex++];if(hint)acText(ac('academyHints'),'li',hint);if(academyHintIndex>=academyActive.hints.length)ac('academyHint').disabled=true};
window.academy={check:academyCheck,evaluate:academyEvaluate};
window.academyEngine={load:importTopology,snapshot:()=>clone({app:'AgLab',version:23,devices,links,nextId,selected})};
