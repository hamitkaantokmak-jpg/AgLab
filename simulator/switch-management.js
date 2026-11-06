// Switch management is an endpoint on a VLAN, never a Layer-3 forwarding switch.
let currentVlan=null;
function switchVlanId(token){return /^\d+$/.test(token||'')&&Number(token)>=1&&Number(token)<=4094?Number(token):null}
function isSwitchSvi(d,name){return d?.type==='Switch'&&/^vlan\d+$/.test(name)}
function switchSviState(d,name){
 const i=d.interfaces?.[name],vlan=Number(i?.vlan),admin=!!i&&d.enabled!==false&&i.enabled!==false;
 const exists=(d.vlans||[]).map(Number).includes(vlan);
 const port=admin&&exists&&links.some(l=>{
  if(l.a!==d.id&&l.b!==d.id||!linkUp(l))return false;
  const p=portState(d,linkPort(l,d.id));if(!p)return false;
  const carries=p.mode==='access'?Number(p.vlan)===vlan:p.mode==='trunk'&&(p.allowed||[]).map(Number).includes(vlan);
  return carries&&!stpIsBlocked(l,vlan);
 });
 return {adminUp:admin,vlanActive:exists,protocolUp:!!port,status:!admin?'administratively down':port?'up':'down',reason:!admin?'SVI veya switch yönetimsel olarak kapalı.':!exists?'SVI VLAN veritabanında etkin değil.':!port?'SVI VLAN için bağlı ve forwarding durumunda Layer 2 port yok.':'SVI etkin.'};
}
function activeSwitchSvis(d){return Object.entries(d.interfaces||{}).filter(([name,i])=>isSwitchSvi(d,name)&&switchSviState(d,name).protocolUp&&validIP(i.ip)&&prefixLen(i.mask)>=0)}
function switchManagementAddress(d,target,exact=false){
 const entries=activeSwitchSvis(d).sort((a,b)=>prefixLen(b[1].mask)-prefixLen(a[1].mask));
 const found=exact?entries.find(([,i])=>i.ip===target):entries.find(([,i])=>inNetwork(target,i.ip,i.mask))||entries.find(([,i])=>d.gateway&&inNetwork(d.gateway,i.ip,i.mask))||entries[0];
 return found?{...found[1],interfaceName:found[0]}:null;
}
function switchManagementLink(l,vlan){return linkCarriesVlan(l,vlan).ok}
function validateSwitchManagement(d){
 if(d.type!=='Switch'){if(d.vlanNames!==undefined||d.startupConfig!==undefined)throw new Error('Switch yönetim alanı farklı cihaz türünde kullanılamaz.');return}
 if(d.gateway!==undefined&&(typeof d.gateway!=='string'||d.gateway!==''&&!validIP(d.gateway)))throw new Error('Switch yönetim gateway adresi geçersiz.');
 if(d.vlanNames!==undefined){
  if(!d.vlanNames||typeof d.vlanNames!=='object'||Array.isArray(d.vlanNames))throw new Error('VLAN isim tablosu geçersiz.');
  for(const [id,name] of Object.entries(d.vlanNames))if(String(Number(id))!==id||!switchVlanId(id)||!(d.vlans||[]).map(Number).includes(Number(id))||typeof name!=='string'||!name.trim()||name.length>32||/[\x00-\x1f\x7f]/.test(name))throw new Error('VLAN ismi veya VLAN referansı geçersiz.');
 }
 for(const [name,i] of Object.entries(d.interfaces||{}))if(name.startsWith('vlan')){
  const id=switchVlanId(name.slice(4));
  if(!id||name!=='vlan'+id||Number(i.vlan)!==id||(d.ports||[]).includes(name)||Object.keys(i).some(k=>!['ip','mask','enabled','vlan'].includes(k)))throw new Error('SVI adı/VLAN eşlemesi veya mantıksal port kaydı geçersiz.');
 }
 if((d.ports||[]).some(p=>/^vlan\d+$/.test(p)))throw new Error('SVI fiziksel kablo portu olamaz.');
 if(d.startupConfig!==undefined){
  const saved=d.startupConfig;
  if(!saved||typeof saved!=='object'||Array.isArray(saved)||Object.keys(saved).some(k=>!['name','gateway','vlans','vlanNames','ports','interfaces','stpPriority','stpPriorities'].includes(k)))throw new Error('Switch startup-config kaydı geçersiz.');
  if(!Array.isArray(saved.ports)||!Array.isArray(saved.vlans)||!saved.interfaces||typeof saved.name!=='string'||typeof saved.gateway!=='string')throw new Error('Startup-config alanları eksik.');
  if(saved.ports.length!==d.ports.length||saved.ports.some(p=>!d.ports.includes(p)))throw new Error('Startup-config fiziksel port envanterini değiştiremez.');
  validateTopologyData({app:'AgLab',devices:[{...d,...clone(saved),startupConfig:undefined}],links:[]});
 }
}
function switchConfiguration(d){
 const result={gateway:d.gateway||'',vlans:clone(d.vlans||[1]),vlanNames:clone(d.vlanNames||{})};for(const key of ['name','gateway','vlans','vlanNames','ports','interfaces','stpPriority','stpPriorities'])if(d[key]!==undefined)result[key]=clone(d[key]);
 return result;
}
function switchConfigurationLines(d){
 const lines=['hostname '+d.name,'! device-type Switch'];
 for(const v of [...(d.vlans||[])].sort((a,b)=>Number(a)-Number(b))){lines.push('vlan '+v);if(d.vlanNames?.[v])lines.push(' name '+d.vlanNames[v]);}
 if(d.gateway)lines.push('ip default-gateway '+d.gateway);
 if(d.stpPriority!==undefined&&(d.stpPriorities||{})[10]===undefined)lines.push('spanning-tree vlan 10 priority '+d.stpPriority);
 for(const [v,p] of Object.entries(d.stpPriorities||{}))lines.push('spanning-tree vlan '+v+' priority '+p);
 for(const [name,i] of Object.entries(d.interfaces||{})){
  lines.push('interface '+(isSwitchSvi(d,name)?'Vlan'+i.vlan:name));
  if(isSwitchSvi(d,name)){if(i.ip)lines.push(' ip address '+i.ip+' '+i.mask);}
  else{lines.push(' switchport mode '+i.mode);if(i.mode==='access')lines.push(' switchport access vlan '+i.vlan);else{lines.push(' switchport trunk allowed vlan '+((i.allowed||[]).length?i.allowed.join(','):'none'));lines.push(' switchport trunk native vlan '+(i.nativeVlan??1));}}
  if(i.portSecurity){lines.push(' switchport port-security'+(i.portSecurity.enabled?'':' disabled'));lines.push(' switchport port-security maximum '+i.portSecurity.max);lines.push(' switchport port-security violation '+i.portSecurity.violation);i.portSecurity.macs.forEach(mac=>lines.push(' switchport port-security mac-address '+mac));if(i.errdisabled)lines.push(' ! err-disabled');}
  lines.push(i.enabled!==false?' no shutdown':' shutdown');
 }
 return lines;
}
function switchManagementCommand(d,raw,p,out){
 if(d.type!=='Switch')return false;
 const emit=(message,error=false)=>{out(message,error?'outerr':'outok');return true};
 const changed=message=>{render();syncSelects();updateInspector();saveTopology(true);return emit(message)};
 if(p[0]==='help'||p[0]==='?')return false;
 if(p[0]==='copy'||p[0]==='show'&&p[1]==='startup-config'){
  if(cliMode!=='priv')return emit('Bu komut için enable moduna geç.',true);
  if(p.join(' ')==='show startup-config'){
   if(!d.startupConfig)return emit('Startup-config kaydı yok.',true);
   switchConfigurationLines({...d,...d.startupConfig}).forEach(line=>out(line));return true;
  }
  if(p.join(' ')==='copy running-config startup-config'){const old=d.startupConfig;d.startupConfig=switchConfiguration(d);if(!saveTopology(true)){if(old===undefined)delete d.startupConfig;else d.startupConfig=old;return emit('Startup-config kaydedilemedi; önceki kayıt korundu. JSON dışa aktar ile çalışmanı kurtar.',true);}return emit('Running-config startup-config olarak kaydedildi.');}
  if(p.join(' ')==='copy startup-config running-config'){
   if(!d.startupConfig)return emit('Startup-config kaydı yok.',true);
   validateSwitchManagement(d);const saved=clone(d.startupConfig);
   for(const key of ['name','gateway','vlans','vlanNames','ports','interfaces','stpPriority','stpPriorities'])delete d[key];
   Object.assign(d,saved);return changed('Startup-config running-config olarak geri yüklendi.');
  }
  return emit('Desteklenen kopyalama: copy running-config startup-config veya copy startup-config running-config.',true);
 }
 if(p[0]==='show'&&p[1]==='running-config'){
  if(p.length!==2)return emit('Kullanım: show running-config',true);
  out('Building configuration...');switchConfigurationLines(d).forEach(line=>out(line));return true;
 }
 if(p[0]==='show'&&p[1]==='vlan'&&p[2]==='brief'){
  if(p.length!==3)return emit('Kullanım: show vlan brief',true);
  out('VLAN Name                 Status    Ports');
  for(const v of [...(d.vlans||[])].sort((a,b)=>a-b))out((String(v).padEnd(5)+(d.vlanNames?.[v]||'VLAN'+v)).padEnd(28)+'active    '+d.ports.filter(port=>d.interfaces[port]?.mode==='access'&&Number(d.interfaces[port].vlan)===Number(v)).join(','));
  return true;
 }
 if(p[0]==='show'&&p[1]==='interfaces'&&(/^vlan\d+$/.test(p[2]||'')||p[2]==='vlan')){
  const token=p[2]==='vlan'?p[3]:p[2].slice(4),id=switchVlanId(token),name='vlan'+id;
  if(!id||p.length!==(p[2]==='vlan'?4:3)||!d.interfaces[name])return emit('SVI bulunamadı. Kullanım: show interfaces vlan <1-4094>',true);
  const state=switchSviState(d,name),i=d.interfaces[name];out('Vlan'+id+' is '+state.status+', line protocol is '+(state.protocolUp?'up':'down'));out('Internet address is '+(i.ip?i.ip+'/'+prefixLen(i.mask):'unassigned'));out(state.reason);return true;
 }
 if(p[0]==='show'&&p[1]==='ip'&&p[2]==='interface'&&p[3]==='brief'){
  if(p.length!==4)return emit('Kullanım: show ip interface brief',true);
  out('Interface       IP-Address      Status     Protocol');
  for(const [name,i] of Object.entries(d.interfaces)){
   const state=isSwitchSvi(d,name)?switchSviState(d,name):{status:d.enabled===false||i.enabled===false?'administratively down':links.some(l=>(l.a===d.id&&l.portA===name||l.b===d.id&&l.portB===name)&&linkUp(l))?'up':'down'};
   out((isSwitchSvi(d,name)?'Vlan'+i.vlan:name).padEnd(15)+' '+(i.ip||'unassigned').padEnd(15)+' '+state.status+'     '+(isSwitchSvi(d,name)?state.protocolUp?'up':'down':state.status==='up'?'up':'down'));
  }
  return true;
 }
 if(p[0]==='show'&&p[1]==='interfaces'&&p[2]==='status'){
  out('Port       Status       VLAN');
  for(const name of d.ports){const i=d.interfaces[name],l=links.find(l=>l.a===d.id&&l.portA===name||l.b===d.id&&l.portB===name);out(name.padEnd(10)+' '+(d.enabled===false||i?.enabled===false?'disabled':l&&linkUp(l)?'connected':'notconnect').padEnd(12)+' '+(i?.mode==='trunk'?'trunk':i?.vlan||1));}
  return true;
 }
 if(p[0]==='vlan'||p[0]==='no'&&p[1]==='vlan'){
  if(cliMode!=='config'&&cliMode!=='vlan')return emit('VLAN için configure terminal moduna geç.',true);
  const remove=p[0]==='no',id=switchVlanId(p[remove?2:1]);if(!id||p.length!==(remove?3:2))return emit('Kullanım: '+(remove?'no ':'')+'vlan <1-4094>',true);
  if(remove&&id===1)return emit('Varsayılan VLAN 1 silinemez.',true);
  d.vlans=(d.vlans||[1]).map(Number);
  if(remove){d.vlans=d.vlans.filter(v=>v!==id);if(d.vlanNames)delete d.vlanNames[id];if(currentVlan===id)currentVlan=null;cliMode='config';return changed('VLAN '+id+' silindi; port ve SVI ayarları korunur, VLAN etkin değildir.');}
  d.vlans=[...new Set([...d.vlans,id])];currentVlan=id;cliMode='vlan';updatePrompt();saveTopology(true);return emit('VLAN '+id+' oluşturuldu/seçildi.');
 }
 if(p[0]==='name'){
  if(cliMode!=='vlan'||!currentVlan)return emit('VLAN ismi için önce vlan <ID> seç.',true);
  const value=raw.trim().split(/\s+/).slice(1).join(' ');if(!value||value.length>32||/[\x00-\x1f\x7f]/.test(value))return emit('VLAN ismi 1–32 karakter olmalı.',true);
  d.vlanNames=d.vlanNames||{};d.vlanNames[currentVlan]=value;return changed('VLAN '+currentVlan+' ismi '+value+' olarak ayarlandı.');
 }
 if(p[0]==='interface'&&(p[1]==='vlan'||/^vlan/.test(p[1]||''))){
  if(!['config','vlan'].includes(cliMode))return emit('SVI için configure terminal moduna geç.',true);
  const token=p[1]==='vlan'?p[2]:p[1].slice(4),id=switchVlanId(token);if(!id||p.length!==(p[1]==='vlan'?3:2))return emit('Kullanım: interface vlan <1-4094>',true);
  currentInterface='vlan'+id;d.interfaces[currentInterface]=d.interfaces[currentInterface]||{ip:'',mask:'255.255.255.0',enabled:false,vlan:id};cliMode='if';updatePrompt();saveTopology(true);return emit('Interface Vlan'+id+' seçildi.');
 }
 if(p[0]==='interface'&&cliMode==='vlan'){cliMode='config';currentVlan=null;}
 if(p[0]==='ip'&&p[1]==='default-gateway'||p[0]==='no'&&p[1]==='ip'&&p[2]==='default-gateway'){
  if(cliMode!=='config')return emit('ip default-gateway için configure terminal moduna geç.',true);
  const remove=p[0]==='no';if(remove?p.length!==3:p.length!==3||!validIP(p[2]))return emit('Kullanım: ip default-gateway <IPv4> veya no ip default-gateway',true);
  d.gateway=remove?'':p[2];return changed('Default gateway: '+(d.gateway||'yok'));
 }
 if(cliMode==='if'&&isSwitchSvi(d,currentInterface)){
  const i=d.interfaces[currentInterface];
  if(p[0]==='ip'&&p[1]==='address'){
   if(p.length!==4||!validIP(p[2])||prefixLen(p[3])<0)return emit('Kullanım: ip address <IPv4> <geçerli maske>',true);
   i.ip=p[2];i.mask=p[3];return changed('SVI IP address set: '+i.ip+' '+i.mask);
  }
  if(p.join(' ')==='no ip address'){i.ip='';i.mask='255.255.255.0';return changed('SVI IP adresi kaldırıldı.');}
  if(p.join(' ')==='shutdown'||p.join(' ')==='no shutdown'){i.enabled=p[0]==='no';return changed('Vlan'+i.vlan+(i.enabled?' enabled':' administratively down'));}
  return emit('SVI üzerinde ip address, no ip address, shutdown veya no shutdown kullan.',true);
 }
 if(p[0]==='shutdown'||p[0]==='no'&&p[1]==='shutdown'){
  if(cliMode!=='if'||p.length!==(p[0]==='no'?2:1))return emit('Önce interface seç; shutdown veya no shutdown kullan.',true);
 }
 if(p[0]==='switchport'){
  if(cliMode!=='if')return emit('Önce fiziksel switch interface seç.',true);
  const valid=p[1]==='mode'?p.length===3:p[1]==='access'&&p[2]==='vlan'?p.length===4:p[1]==='trunk'&&p[2]==='native'?p.length===5:true;
  if(!valid)return emit('Switchport komutunda fazla/eksik parametre var.',true);
 }
 if(p[0]==='ping'){const parsed=parsePingCommand(p);if(parsed.error)return emit(parsed.error,true);}
 return false;
}
function switchManagementGatewayCheck(owner,address,remoteIp,path){
 if(owner.type!=='Switch'||inNetwork(remoteIp,address.ip,address.mask))return {ok:true};
 const router=orderedPathNodes(owner.id,path).find(d=>d?.type==='Router');
 if(!owner.gateway||!validIP(owner.gateway))return {ok:false,why:'Switch üzerinde uzak yönetim hedefi için ip default-gateway gerekli.'};
 if(!router||!activeRouterInterfaces(router).some(([,i])=>i.ip===owner.gateway&&inNetwork(address.ip,i.ip,i.mask)))return {ok:false,why:'Switch yönetim gateway adresi yerel erişilebilir router arayüzüyle eşleşmiyor.'};
 return {ok:true};
}
function learnManagementEndpoints(src,dst,path,sourceIp,targetIp,replyPath=null){
 if(!path.length)return;
 for(const [owner,peer,ownerIp,peerIp,edge,vlan] of [[src,dst,sourceIp,targetIp,path[0],path.vlans?.[0]],[dst,src,targetIp,sourceIp,replyPath?.[0]||path.at(-1),replyPath?.vlans?.[0]??path.vlans?.at(-1)]]){
  if(owner.type!=='Switch')continue;
  const address=activeSwitchSvis(owner).find(([,i])=>i.ip===ownerIp)?.[1];if(!address)continue;
  let neighbor=peer,neighborIp=peerIp;
  const table=switchMacTable(owner),arp=arpTables.get(owner.id)||new Map();
  if(!inNetwork(peerIp,ownerIp,address.mask)){
   neighbor=devices.find(d=>d.type==='Router'&&activeRouterInterfaces(d).some(([,i])=>i.ip===owner.gateway));neighborIp=owner.gateway;
   arp.delete(peerIp);table.delete(switchMacKey(address.vlan,macOf(peer)));
  }
  if(neighbor&&neighborIp){arp.set(neighborIp,macOf(neighbor));learnSwitchMac(owner,neighbor,vlan??Number(address.vlan),linkPort(edge,owner.id));}
  arpTables.set(owner.id,arp);macTables.set(owner.id,table);
 }
}
