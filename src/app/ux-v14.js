
(()=>{
  'use strict';
  const area=document.getElementById('area-lab');
  const work=document.getElementById('ptWorkbench');
  const academy=document.getElementById('academyPanel');
  if(!area||!work) return;
  const box=document.createElement('section');box.id='ux14LabModes';box.setAttribute('aria-label','Laboratuvar çalışma biçimi');
  box.innerHTML='<h3>Nasıl çalışmak istersin?</h3><div class="ux14-row" role="group" aria-label="Laboratuvar modu"><button type="button" class="ux14-mode" id="ux14Guided" aria-pressed="true">📘 Rehberli Akademi</button><button type="button" class="ux14-mode" id="ux14Free" aria-pressed="false">🛠 Serbest Çalışma</button></div><p id="ux14ModeInfo" aria-live="polite"></p>';
  work.before(box);
  const slot=document.createElement('section');slot.id='ux14AcademySlot';slot.setAttribute('aria-label','Rehberli Akademi görevi');box.after(slot);
  if(academy)slot.append(academy);
  else { const msg=document.createElement('p');msg.textContent='Bu sürümde Akademi görev paneli bulunamadı. Serbest çalışma araçları kullanılabilir.';slot.append(msg); }
  const guided=document.getElementById('ux14Guided'), free=document.getElementById('ux14Free'),info=document.getElementById('ux14ModeInfo');
  const selectMode=(mode,focus=false)=>{
    const isGuided=mode==='guided';
    guided.setAttribute('aria-pressed',String(isGuided));free.setAttribute('aria-pressed',String(!isGuided));
    slot.hidden=!isGuided;
    info.innerHTML=isGuided?'<strong>Rehberli:</strong> Bir Akademi görevi seç, başlat, ağı yapılandır ve çözümünü kontrol et. <b>Başlat / Sıfırla</b> topolojiyi değiştirir.':'<strong>Serbest:</strong> Cihaz ekle, kablo bağla, komut yaz ve ağı denetle. Bu moda geçiş mevcut topolojiyi değiştirmez.';
    if(focus)(isGuided?guided:free).focus();
  };
  guided.addEventListener('click',()=>selectMode('guided',true));
  free.addEventListener('click',()=>selectMode('free',true));
  // Keep the main simulator always available in both modes: switching modes must not reload a topology.
  const head=work.querySelector('.pt-head');
  const workflow=document.createElement('p');workflow.className='ux14-workflow';workflow.innerHTML='<b>4 adım:</b> Cihaz ekle → Kablo bağla → CLI ile yapılandır → Ağı denetle. <span>Gelişmiş işlemler gerektiğinde açılır.</span>';
  head?.after(workflow);
  const more=document.createElement('details');more.id='ux14LabMore';
  more.innerHTML='<summary>Hızlı başlangıç, senaryolar ve ileri araçlar</summary>';
  const quick=work.querySelector('.pt-quickstart');
  const scenarios=work.querySelector('#uxLabScenarios');
  const note=work.querySelector('.pt-bottom-note');
  const importNote=work.querySelector('.pt-import-note');
  if(quick)more.append(quick);
  if(importNote){ // Move import instructions into the same disclosure without hiding the actual import button.
    importNote.classList.add('ux14-import-info');more.append(importNote);
  }
  if(scenarios)more.append(scenarios);
  if(note){const n=document.createElement('details');n.id='ux14LabNotes';n.innerHTML='<summary>Simülatörün kapsamı ve önemli notlar</summary>';n.append(note);more.append(n);}
  const toolbar=work.querySelector('.pt-toolbar');
  if(toolbar)toolbar.after(more);else head?.after(more);
  // Disable v12's CSS hiding for instructions moved into the advanced disclosure.
  work.classList.add('ux14-lab');
  const shortcuts=work.querySelector('.pt-shortcuts');
  if(shortcuts){const d=document.createElement('details');d.id='ux14CliMore';d.innerHTML='<summary>Hazır komut kısayollarını göster</summary>';shortcuts.before(d);d.append(shortcuts);}
  // The existing legacy simulator remains available through its own details panel.
  const legacy=area.querySelector('.pt-legacy');
  if(legacy){const summary=legacy.querySelector('summary');if(summary)summary.textContent='Eski deney ortamı ve ek yapılandırma araçları';}
  selectMode(academy?'guided':'free');
  window.aglabUxV14={version:'14.0',getMode:()=>guided.getAttribute('aria-pressed')==='true'?'guided':'free',showGuided:()=>selectMode('guided'),showFree:()=>selectMode('free')};
})();
