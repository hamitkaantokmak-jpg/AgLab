// Bounded data-only import. File metadata is not a cryptographic attestation.
(function(root){
'use strict';
function parse(text){
 if(typeof text!=='string'||text.length>2000000)throw Error('Lab raporu en fazla 2 MB metin olabilir.');
 const r=JSON.parse(text),keys=['kind','engine','image','steps','evidence','ok','cleanup','host_kernel','error','image_id'];
 if(!r||Array.isArray(r)||Object.keys(r).some(k=>!keys.includes(k))||!['l2','routing'].includes(r.kind)||r.engine!==(r.kind==='l2'?'Linux kernel bridge':'FRRouting')||typeof r.ok!=='boolean'||typeof r.cleanup!=='boolean'||!Array.isArray(r.steps)||r.steps.length>256)throw Error('Geçersiz ayrı Lab raporu.');
 for(const step of r.steps)if(!step||Object.keys(step).some(k=>!['name','ok','origin','time_utc','evidence'].includes(k))||typeof step.name!=='string'||step.name.length>500||typeof step.ok!=='boolean')throw Error('Geçersiz Lab doğrulama adımı.');
 const events=r.steps.map((step,index)=>({index,kind:'lab-check',device:null,detail:{name:step.name,ok:step.ok,evidence:step.evidence||{},origin:'imported-report-unverified'},raw:JSON.stringify(step)}));
 if(r.error)events.push({index:events.length,kind:'lab-check',device:null,detail:{name:String(r.error),ok:false,origin:'imported-report-unverified'},raw:String(r.error)});
 return {engine:r.engine,scope:'separate-lab',authenticated:false,ok:r.ok,cleanup:r.cleanup,events};
}
const api={parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.AgLabLabEvidence=api;
})(typeof globalThis!=='undefined'?globalThis:this);
