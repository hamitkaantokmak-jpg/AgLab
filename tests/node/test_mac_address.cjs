const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('../../simulator/mac-address.js');
const devices=['PC1','R1','SW1','PC2','R2','SW2','alpha','beta','costarring','liquid','d0','d01','d1','d2','d16777216'].map(id=>({id}));
const resolve=api.createResolver(),macs=devices.map(d=>resolve(d,devices));
assert.equal(new Set(macs).size,devices.length);
assert.equal(resolve({id:'d1'},devices),'02:00:00:00:00:01');
assert.equal(resolve({id:'d2'},devices),'02:00:00:00:00:02');
const reversed=[...devices].reverse();for(const d of devices)assert.equal(resolve(d,reversed),macs[devices.indexOf(d)]);
const enlarged=[...devices,{id:'new-router'}];for(const d of devices)assert.equal(resolve(d,enlarged),macs[devices.indexOf(d)]);
const large=Array.from({length:3000},(_,i)=>({id:(i%2?'R':'PC')+i}));
assert.equal(new Set(large.map(d=>resolve(d,large))).size,large.length);
const html=fs.readFileSync(require('node:path').join(__dirname,'../../AgLab_Final_PKT_Import.html'),'utf8');
assert(html.includes('// BEGIN MAC ADDRESS GENERATED\n'+fs.readFileSync(require('node:path').join(__dirname,'../../simulator/mac-address.js'),'utf8')+'\n// END MAC ADDRESS GENERATED\n'));
const fn=html.split('\n').find(l=>l.includes('function macOf(d)'));
const context=vm.createContext({AgLabMacAddress:api,devices});vm.runInContext(fn,context);
assert.notEqual(context.macOf({id:'PC1'}),context.macOf({id:'R1'}));
console.log('PASS full device-ID MAC uniqueness, legacy addresses, order and embedded binding');
// Explicit imported endpoint MACs take precedence; synthetic addresses avoid them.
const imported=[{id:'d1',type:'Switch'},{id:'d2',type:'PC',mac:'02:00:00:00:00:01'},
 {id:'d3',type:'Server',mac:'02:aa:00:00:00:22'}];
const importedResolve=api.createResolver();
assert.equal(importedResolve(imported[1],imported),'02:00:00:00:00:01');
assert.equal(importedResolve(imported[2],imported),'02:aa:00:00:00:22');
assert.notEqual(importedResolve(imported[0],imported),'02:00:00:00:00:01');
assert.equal(new Set(imported.map(d=>importedResolve(d,imported))).size,3);
for(const d of imported)assert.equal(importedResolve(d,[...imported].reverse()),importedResolve(d,imported));
api.validate(imported);
for(const mac of ['00:00:00:00:00:00','01:00:5e:00:00:01','broken',null,123,'02AA.0000.0011']){
 assert.throws(()=>api.validate([{id:'pc',type:'PC',mac}]));
}
assert.throws(()=>api.validate([{id:'r',type:'Router',mac:'02:aa:00:00:00:11'}]));
assert.throws(()=>api.validate([{id:'a',type:'PC',mac:'02:aa:00:00:00:11'},{id:'b',type:'PC',mac:'02:aa:00:00:00:11'}]));
console.log('PASS imported endpoint MAC preservation, validation and synthetic collision avoidance');
