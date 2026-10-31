const portSecurityRecovery=new WeakSet(),portSecurityViolations=new WeakMap();
function canonicalSecureMac(value){const raw=String(value).toLowerCase().replace(/[.:-]/g,'');return /^[0-9a-f]{12}$/.test(raw)&&raw!=='000000000000'&&parseInt(raw.slice(0,2),16)%2===0?raw.match(/../g).join(':'):null}
function validatePortSecurity(d){
 for(const [name,i] of Object.entries(d.interfaces||{})){
  if(i.errdisabled!==undefined&&(d.type!=='Switch'||!d.ports.includes(name)||typeof i.errdisabled!=='boolean'))throw new Error('Geçersiz errdisabled alanı.');
  if(i.portSecurity===undefined)continue;
  const s=i.portSecurity;
  if(d.type!=='Switch'||!d.ports.includes(name)||!protocolObject(s,['enabled','max','violation','macs'])||typeof s.enabled!=='boolean'||!Number.isInteger(s.max)||s.max<1||s.max>1024||!['shutdown','restrict','protect'].includes(s.violation)||!Array.isArray(s.macs)||s.macs.length>s.max||s.macs.some(m=>!canonicalSecureMac(m))||new Set(s.macs.map(canonicalSecureMac)).size!==s.macs.length)throw new Error('Geçersiz portSecurity yapılandırması.');
 }
}
function portSecurityAllows(d,port,source){
 const i=d.interfaces?.[port],s=i?.portSecurity;if(i?.errdisabled)return false;if(!s?.enabled)return true;
 const mac=canonicalSecureMac(macOf(source));if(s.macs.map(canonicalSecureMac).includes(mac))return true;
 if(s.macs.length<s.max){s.macs.push(mac);saveTopology(true);return true;}
 portSecurityViolations.set(i,(portSecurityViolations.get(i)||0)+1);
 ethernetEvent('port-security-drop '+d.id+' '+port+' '+s.violation);
 if(s.violation==='shutdown'){i.errdisabled=true;saveTopology(true);}
 return false;
}
function portSecurityCommand(d,p,out){
 const emit=(text,error=false)=>{out(text,error?'outerr':'outok');return true};
 if(p[0]==='show'&&p[1]==='port-security'){
  if(d.type!=='Switch'||p.length!==2)return emit('Switch üzerinde show port-security kullan.',true);
  for(const [name,i] of Object.entries(d.interfaces||{}))if(d.ports.includes(name))out(name+' '+(i.errdisabled?'err-disabled':i.enabled===false?'shutdown':'up')+' security '+(i.portSecurity?.enabled?'enabled':'disabled')+' maximum '+(i.portSecurity?.max??1)+' violation '+(i.portSecurity?.violation||'shutdown')+' macs '+(i.portSecurity?.macs.join(',')||'-')+' violations '+(portSecurityViolations.get(i)||0));return true;
 }
 if(d.type==='Switch'&&cliMode==='if'&&(p[0]==='shutdown'||p.join(' ')==='no shutdown')){
  const i=d.interfaces[currentInterface];if(!i)return false;
  if(p[0]==='shutdown'){if(i.errdisabled)portSecurityRecovery.add(i);return false;}
  if(i.errdisabled){if(!portSecurityRecovery.has(i))return emit('err-disabled: önce shutdown, ardından no shutdown uygula.',true);i.errdisabled=false;portSecurityRecovery.delete(i);}
  return false;
 }
 const removing=p[0]==='no',args=removing?p.slice(1):p;
 if(args[0]!=='switchport'||args[1]!=='port-security')return false;
 if(d.type!=='Switch'||cliMode!=='if'||!d.ports.includes(currentInterface))return emit('Switch fiziksel interface modunda kullan.',true);
 const i=d.interfaces[currentInterface],s=i.portSecurity||{enabled:false,max:1,violation:'shutdown',macs:[]};
 if(args.length===2)s.enabled=!removing;
 else if(args[2]==='maximum'&&args.length===4&&!removing&&/^\d+$/.test(args[3])&&Number(args[3])>=1&&Number(args[3])<=1024&&Number(args[3])>=s.macs.length)s.max=Number(args[3]);
 else if(args[2]==='violation'&&args.length===4&&!removing&&['shutdown','restrict','protect'].includes(args[3]))s.violation=args[3];
 else if(args[2]==='mac-address'&&args.length===4&&canonicalSecureMac(args[3])){const mac=canonicalSecureMac(args[3]);if(removing)s.macs=s.macs.filter(m=>canonicalSecureMac(m)!==mac);else if(!s.macs.map(canonicalSecureMac).includes(mac)){if(s.macs.length>=s.max)return emit('Maximum aşıldı; önce mevcut MAC kaydını kaldır.',true);s.macs.push(mac);}}
 else return emit('switchport port-security [maximum <1-1024>|violation shutdown|restrict|protect|mac-address <MAC>]',true);
 i.portSecurity=s;saveTopology(true);render();updateInspector();return emit('Port güvenliği güncellendi.');
}
