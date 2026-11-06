'use strict';
(() => {
 const byId=id=>document.getElementById(id);
 const labels={routes:['IP yönlendirme tablosu','Paketlerin hedef ağlara hangi yoldan gittiğini incele.'],interfaces:['Arayüz özeti','Yönlendiricinin arayüzlerini ve bağlantı durumlarını incele.'],neighbors:['OSPF komşuları','OSPF komşuluklarını incele. Statik rotalı bir labda bu liste boş olabilir.']};
 let key='',generation=0,controller=null,expiry=null,maxAge=60;
 function clearResult(message='Bir görünüm seçip tanıyı göster.'){
  clearTimeout(expiry);expiry=null;byId('output').textContent=message;byId('captured').textContent='';
 }
 function disconnect(message='Bağlantı kapatıldı. Anahtar ve sonuçlar temizlendi.'){
  generation++;if(controller)controller.abort();key='';byId('access-key').value='';
  byId('access-panel').hidden=false;byId('diagnostics-panel').hidden=true;
  byId('router').replaceChildren();byId('view').replaceChildren();clearResult();
  for(const id of ['connect','refresh','router','view'])byId(id).disabled=false;byId('status').textContent=message;
 }
 const errors={401:'Öğrenci anahtarı geçersiz. Yeniden bağlan.',404:'Bu tanıya erişim iznin yok.',503:'Güncel tanılama görüntüsü yok. Öğretmeninden görüntüyü yenilemesini iste.'};
 async function get(path,token){
  if(controller)controller.abort();controller=new AbortController();const own=controller;
  const timer=setTimeout(()=>own.abort(),10000);
  try{
   const response=await fetch(path,{method:'GET',headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:own.signal});
   if(!response.ok){const error=new Error(errors[response.status]||'Tanılama şu anda alınamıyor.');error.status=response.status;throw error;}
   return await response.json();
  }finally{clearTimeout(timer);if(controller===own)controller=null;}
 }
 byId('access-form').addEventListener('submit',async event=>{
  event.preventDefault();const candidate=byId('access-key').value;
  if(candidate.length<32){byId('status').textContent='Öğretmeninin verdiği en az 32 karakterli anahtarı gir.';return;}
  disconnect('Bağlanıyor…');const own=generation;byId('connect').disabled=true;
  try{
   const config=await get('/api/student',candidate);if(own!==generation)return;
   if(!Array.isArray(config.routers)||!config.routers.length||config.routers.some(r=>!['r1','r2'].includes(r))||!Array.isArray(config.views)||config.views.length!==3||config.views.some(v=>!Object.hasOwn(labels,v))||config.max_age!==60)throw new Error('Erişim bilgileri alınamadı.');
   key=candidate;maxAge=config.max_age;
   for(const router of config.routers){const option=document.createElement('option');option.value=router;option.textContent=router;byId('router').append(option);}
   for(const view of ['routes','interfaces','neighbors']){const option=document.createElement('option');option.value=view;option.textContent=labels[view][0];byId('view').append(option);}
   byId('view-help').textContent=labels[byId('view').value][1];
   byId('access-panel').hidden=true;byId('diagnostics-panel').hidden=false;byId('status').textContent='Bağlandı. İzin verilen tanıları inceleyebilirsin.';byId('refresh').focus();
  }catch(error){if(own===generation)byId('status').textContent=error.status?error.message:'Bağlantı kurulamadı. Öğrenci servisini kontrol et.';}
  finally{if(own===generation)byId('connect').disabled=false;}
 });
 byId('refresh').addEventListener('click',async()=>{
  if(!key)return;const own=generation;const router=byId('router').value,view=byId('view').value;
  clearResult('Tanı alınıyor…');byId('refresh').disabled=true;byId('router').disabled=true;byId('view').disabled=true;
  try{
   const data=await get('/api/diagnostics/'+encodeURIComponent(router)+'/'+encodeURIComponent(view),key);if(own!==generation)return;
   const remaining=data.captured_at*1000+maxAge*1000-Date.now();
   if(data.ok!==true||data.router!==router||data.view!==view||typeof data.output!=='string'||!Number.isFinite(data.captured_at)||remaining<=0||remaining>maxAge*1000)throw new Error('Geçerli ve güncel bir görüntü alınamadı.');
   byId('output').textContent=data.output||'Bu görünümde kayıt yok.';
   byId('captured').textContent='Görüntü zamanı: '+new Date(data.captured_at*1000).toLocaleString('tr-TR');
   byId('status').textContent='Salt okunur tanı gösteriliyor.';
   expiry=setTimeout(()=>{if(own===generation){clearResult('Görüntünün süresi doldu. Tanıyı yeniden iste.');byId('status').textContent='Yeni bir görüntü gerekli.';}},remaining);
  }catch(error){if(own===generation){clearResult('Tanılama gösterilemiyor.');if(error.status===401)disconnect(errors[401]);else byId('status').textContent=error.status?error.message:'Tanılama alınamadı. Bağlantıyı ve görüntüyü kontrol et.';}}
  finally{if(own===generation){byId('refresh').disabled=false;byId('router').disabled=false;byId('view').disabled=false;}}
 });
 for(const id of ['router','view'])byId(id).addEventListener('change',()=>{clearResult();byId('view-help').textContent=labels[byId('view').value][1];byId('status').textContent='Seçilen görünümü almak için tanıyı göster.';});
 byId('disconnect').addEventListener('click',()=>{disconnect();byId('access-key').focus();});
 window.addEventListener('pagehide',()=>disconnect());
})();
