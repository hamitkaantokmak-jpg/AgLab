/* AğLab Akademi: deterministic, side-effect-free grading result validation.
 * This module does not execute probes or mutate simulator state.
 * Compatible with browser script tags and Node.js CommonJS.
 */
(function(root){
'use strict';
const STATUSES=new Set(['passed','failed','not_evaluated','error']);
function finalize(rows,nominalMax=100){
 if(!Array.isArray(rows)||!Number.isSafeInteger(nominalMax)||nominalMax<=0)throw Error('Invalid assessment');
 const ids=new Set();let earned=0,evaluated=0,declared=0;
 const criteria=rows.map(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||ids.has(row.id)||
     !STATUSES.has(row.status)||!Number.isSafeInteger(row.points)||row.points<0)
   throw Error('Invalid criterion');
  ids.add(row.id);declared+=row.points;
  if(!Number.isSafeInteger(declared)||declared>nominalMax)throw Error('Invalid total points');
  if(row.status==='passed'){earned+=row.points;evaluated+=row.points}
  if(row.status==='failed')evaluated+=row.points;
  return {...row};
 });
 const complete=declared===nominalMax&&evaluated===nominalMax;
 return {earned_points:earned,evaluated_max_points:evaluated,
  nominal_max_points:nominalMax,coverage:evaluated/nominalMax,
  status:complete?'complete':'incomplete',criteria};
}
const api=Object.freeze({finalize});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.AgLabGradingVerdict=api;
})(typeof globalThis!=='undefined'?globalThis:this);
