(function(){
'use strict';
const panel=document.getElementById('packetDetectivePanel');if(!panel)return;
const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Ayrı Gerçek Lab raporunu incele';details.append(heading);
const description=document.createElement('p');description.textContent='Operatörün/CI’nin advanced_smoke.py ile ürettiği JSON doğrulama raporunu aç. Bu bir canlı bağlantı veya paket yakalaması değildir; imza ve dosya kaynağı burada doğrulanmaz. Tarayıcı topolojisiyle birleştirilmez.';details.append(description);
const label=document.createElement('label');label.textContent='Linux bridge / FRR raporu ';const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.id='nativeLabReport';label.append(input);details.append(label);
const status=document.createElement('p');status.id='nativeLabReportStatus';status.setAttribute('role','status');details.append(status);panel.append(details);
input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>2000000)throw Error('Rapor en fazla 2 MB olabilir.');const r=AgLabLabEvidence.parse(await file.text());status.textContent=r.engine+' · ayrı Lab · '+r.events.length+' doğrulama adımı · içe aktarılan rapor, imzası doğrulanmadı';document.dispatchEvent(new CustomEvent('aglab:external-lab-evidence',{detail:r}));}catch(e){status.textContent='Rapor açılmadı: '+e.message;}input.value='';};
})();
