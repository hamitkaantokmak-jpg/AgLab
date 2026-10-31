// Data-defined scenario recipes. Nothing here labels them as actual branch incidents.
function sharedScenarioRecipe(id){return sharedNetworkScenarios.find(row=>row.id===id)}
function sharedEngineCommandBlock(name,commands){
 const d=devices.find(d=>d.name===name||d.id===name);if(!d)throw new Error('Cihaz bulunamadı: '+name);
 selected=d.id;$p('ptCliDevice').value=d.id;cliMode='user';currentInterface='';updateInspector();
 for(const raw of commands){const before=$p('ptTerminal').childElementCount;command(raw.replaceAll('$SOURCE_MAC',macOf(get(sharedScenario.sourceId))));const errors=[...$p('ptTerminal').children].slice(before).filter(e=>e.classList.contains('outerr'));if(errors.length)throw new Error(raw+': '+errors.map(e=>e.textContent).join(' '));}
}
function loadNetworkScenario(key){
 const row=sharedScenarioRecipe(key);if(!row?.topology)return false;
 academyClearSession();importTopology(clone(row.topology));
 const source=devices.find(d=>d.name==='PC-01'),target=devices.find(d=>d.name==='PC-02');
 sharedScenario={active:true,key,sourceId:source.id,target:target.ip};
 const panel=$p('sharedScenarioInstructions');panel.replaceChildren();
 for(const text of [row.symptom,'Kök neden: '+row.cause,'Model: Cisco benzeri sınırlı eğitim komutları; gerçek IOS/OSPF/BGP paketleri veya zamanlayıcıları çalıştırılmaz.']){const p=document.createElement('p');p.textContent=text;panel.append(p);}
 const hints=document.createElement('details'),summary=document.createElement('summary');summary.textContent='İpuçları ve çözüm komutları';hints.append(summary);
 for(const hint of row.hints||[]){const p=document.createElement('p');p.textContent=hint;hints.append(p);}
 for(const block of row.solution){const pre=document.createElement('pre');pre.textContent=block.device+'\n'+block.commands.map(c=>c.replaceAll('$SOURCE_MAC',macOf(source))).join('\n');hints.append(pre);}
 panel.append(hints);sharedStatus(row.title+' yüklendi. İlk erişim başarısız olmalı; tanı komutlarıyla nedeni incele.');saveTopology(true);return true;
}
function sharedRecipeGoal(row){
 if(row.verify.kind==='dhcp')return !!get(sharedScenario.sourceId)?.dhcpLease;
 if(row.verify.kind==='stp-root')return stpRootForVlan(10)?.name==='SW-03'&&ping(sharedScenario.sourceId,sharedScenario.target).ok;
 return ping(sharedScenario.sourceId,sharedScenario.target).ok;
}
function validateSharedScenarios(){
 const snapshot={app:'AgLab',version:23,devices:clone(devices),links:clone(links),nextId,selected,...academySessionFields()};
 if(sourceArchiveData)snapshot.sourceArchive=clone(sourceArchiveData);if(importReportData)snapshot.importReport=clone(importReportData);
 const savedScenario=clone(sharedScenario),instructions=$p('sharedScenarioInstructions').innerHTML,status=$p('sharedScenarioStatus').textContent;
 const terminal=[...$p('ptTerminal').childNodes].map(n=>n.cloneNode(true)),oldMode=cliMode,oldInterface=currentInterface,oldInput=$p('ptCliInput').value;
 const oldMacs=[...macTables].map(([id,rows])=>[id,new Map([...rows].map(([key,value])=>[key,{...value}]))]),oldArps=[...arpTables].map(([id,rows])=>[id,new Map(rows)]);
 const storage=localStorage.getItem('aglab-topology-v23'),results=[];
 try{
  for(const row of sharedNetworkScenarios){
   try{
    loadSharedScenario(row.id);const initial=sharedRecipeGoal(row);
    for(const block of row.solution)sharedEngineCommandBlock(block.device,block.commands);
    const solved=sharedRecipeGoal(row);results.push({id:row.id,initial,solved,ok:!initial&&solved,detail:row.verify.kind==='stp-root'?'Başlangıçta hedef root değil; CLI sonrası SW-03 root ve ping başarılı.':'Başlangıç '+(initial?'başarılı':'başarısız')+' / çözüm sonrası '+(solved?'başarılı':'başarısız')});
   }catch(error){results.push({id:row.id,ok:false,detail:String(error.message||error)});}
  }
 }finally{
  importTopology(snapshot);sharedScenario=savedScenario;$p('sharedScenarioInstructions').innerHTML=instructions;$p('sharedScenarioStatus').textContent=status;
  macTables.clear();oldMacs.forEach(([id,rows])=>macTables.set(id,rows));arpTables.clear();oldArps.forEach(([id,rows])=>arpTables.set(id,rows));
  cliMode=oldMode;currentInterface=oldInterface;$p('ptCliInput').value=oldInput;$p('ptTerminal').replaceChildren(...terminal);updatePrompt();
  if(storage===null)localStorage.removeItem('aglab-topology-v23');else localStorage.setItem('aglab-topology-v23',storage);
 }
 return results;
}
window.aglabSharedEngine={load:loadSharedScenario,recipes:()=>clone(sharedNetworkScenarios),validateScenarios:validateSharedScenarios,commandBlock:sharedEngineCommandBlock,
 probe:()=>ping(sharedScenario.sourceId,sharedScenario.target),routes:id=>clone(dynamicRoutes(get(id)||devices.find(d=>d.name===id))),peers:kind=>protocolPeers(kind).map(e=>({a:e.a.name,b:e.b.name,ok:e.ok,reason:e.reason})),strictPath:(a,b,vlan,ip)=>findPath(a,b,vlan,ip,true)?.map(l=>({a:l.a,b:l.b}))||null};
for(const row of sharedNetworkScenarios)if(row.topology){const option=document.createElement('option');option.value=row.id;option.textContent=row.title;$p('sharedScenarioSelect').append(option);}
const sharedPanel=$p('sharedScenarioPanel');
$p('ptWorkbench').querySelector('.pt-toolbar').after(sharedPanel);
const oldDisclosure=$p('uxLabScenarios');if(oldDisclosure)oldDisclosure.remove();
const sharedBridge=document.createElement('button');sharedBridge.type='button';sharedBridge.id='sharedScenarioTroubleLink';sharedBridge.textContent='Ortak motor senaryolarına geç';
sharedBridge.onclick=()=>{showArea('lab');sharedPanel.scrollIntoView({block:'start'});$p('sharedScenarioSelect').focus();};
$p('scenarioList').before(sharedBridge);
sharedPanel.setAttribute('role','region');sharedPanel.setAttribute('aria-labelledby','sharedScenarioTitle');
$p('sharedScenarioStatus').setAttribute('aria-live','polite');
for(const [topic,note] of Object.entries({ospf:'Ortak motorda: router ospf, router-id, network wildcard area, show ip ospf neighbor ve O rotaları. Tek area bileşenleri/anlık eğitim modeli; passive-interface, timer, LSDB, redistribution ve policy desteklenmez.',bgp:'Ortak motorda: router bgp, karşılıklı neighbor remote-as, bağlı ağ için network mask, show ip bgp summary ve B rotaları. Doğrudan eBGP eğitim modeli; iBGP, prefix-list, route-map ve path policy desteklenmez.'})){
 if(typeof learningDeep!=='undefined'&&learningDeep[topic])learningDeep[topic].commands+=' <br><b>Simülatör kapsamı:</b> '+note;
}
if(typeof scenarios!=='undefined'){
 for(const [id,title] of Object.entries({bgp:'BGP remote-AS uyuşmazlığı',ospf:'OSPF area uyuşmazlığı',portsec:'Port-security ihlali · ortak motor',subif:'Eksik alt arayüz · ortak motor'})){
  const row=scenarios.find(s=>s.id===id);if(row)row.title=title;
 }
 if(typeof renderList==='function')renderList();
}
// Meaningful names for existing controls whose context used to be visual only.
for(const [id,label] of Object.entries({ptCliDevice:'CLI cihazı',ptCliInput:'Cihaz komutu',ptRenameInput:'Seçili cihazın yeni adı',ptSource:'Kaynak cihaz',ptTarget:'Hedef cihaz'})){const el=$p(id);if(el)el.setAttribute('aria-label',label);}
const accessibilityStyle=document.createElement('style');accessibilityStyle.textContent=`
 :focus-visible{outline:3px solid #d68b00;outline-offset:3px}
 html[data-theme="dark"] :focus-visible{outline-color:#ffe08a}
 #sharedScenarioPanel{background:var(--panel)!important;color:var(--text)!important;border-color:var(--line)!important}
 #sharedScenarioPanel p,#sharedScenarioStatus,#regressionAuditSummary,#regressionAuditResults{color:var(--text)!important}
 #sharedScenarioPanel input,#sharedScenarioPanel select,#sharedScenarioPanel button{background:var(--panel2);color:var(--text)}
 html[data-theme="light"] a{color:#16489a}html[data-theme="dark"] a{color:#a5d5ff}
 #sharedScenarioPanel pre{white-space:pre-wrap;overflow-wrap:anywhere}
 button,input,select,textarea{color:var(--text)!important;background-color:var(--panel2)!important}
`;document.head.append(accessibilityStyle);
