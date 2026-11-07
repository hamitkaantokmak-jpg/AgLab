
(()=>{
  'use strict';
  const root=document.getElementById('studentFlow');
  const sheet=document.getElementById('sfSheet');
  const list=document.getElementById('sfList');
  const tools=root?.querySelector('.sf-tools');
  const metrics=root?.querySelector('.sf-metrics');
  if(!root||!sheet||!list||!tools||!metrics)return;
  const controls=document.createElement('div');controls.className='ux13-controls';
  const toggle=document.createElement('button');toggle.type='button';toggle.id='ux13ToggleTopics';
  toggle.setAttribute('aria-controls','sfList sfLevel sfSearch');
  const stage=document.createElement('span');stage.id='ux13Stage';stage.className='ux13-stage';stage.setAttribute('role','status');
  controls.append(toggle,stage);
  tools.before(controls);
  const details=document.createElement('details');details.className='ux13-progress-details';
  const summary=document.createElement('summary');summary.textContent='İlerleme özetimi göster';
  details.append(summary,metrics);controls.before(details);
  const tip=document.createElement('p');tip.className='ux13-tip';tip.textContent='Her aşamada yalnızca o çalışmayı görürsün. İstediğin aşamaya üstteki düğmelerden geçebilirsin.';
  sheet.before(tip);
  let expanded=false;
  const update=()=>{
    root.classList.toggle('ux13-focused',!expanded);
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.textContent=expanded?'Konu listesini gizle':'Başka konu seç';
    if(!expanded && document.activeElement===document.getElementById('sfSearch'))toggle.focus();
  };
  toggle.addEventListener('click',()=>{
    expanded=!expanded;update();
    if(expanded)document.getElementById('sfSearch')?.focus();
    else sheet.focus({preventScroll:true});
  });
  sheet.tabIndex=-1;
  list.addEventListener('click',e=>{
    if(!e.target.closest('button'))return;
    expanded=false;update();
    sheet.focus({preventScroll:true});
  });
  const labels=['Anlatım','Ayrıntılı öğren','Test','Laboratuvar','Sorun çöz'];
  let scheduled=false;
  const refreshStage=()=>{
    scheduled=false;
    const steps=Array.from(sheet.querySelectorAll('.sf-steps button'));
    const index=steps.findIndex(x=>x.getAttribute('aria-current')==='step');
    stage.textContent=index<0?'Konunu seç':`Adım ${index+1}/5 · ${labels[index]}`;
  };
  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(refreshStage)});
  observer.observe(sheet,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-current']});
  root.classList.add('ux13-focused');update();refreshStage();
  window.aglabUxV13={version:'13.0',getStage:()=>stage.textContent,isCatalogOpen:()=>expanded};
})();
