'use strict';
const esbuild=require('esbuild'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'third_party/borck-netsim/provenance.json'),'utf8'));
for(const [name,sha]of Object.entries(provenance.sha256)){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'third_party/borck-netsim',name))).digest('hex');
 if(actual!==sha)throw Error('Upstream source modified: '+name);
}
esbuild.buildSync({absWorkingDir:root,entryPoints:['simulator/borck-adapter.ts'],outfile:'simulator/borck-engine.generated.js',bundle:true,format:'iife',globalName:'AgLabBorckEngine',platform:'browser',target:'es2020',charset:'utf8',legalComments:'inline',banner:{js:'/* Michael Borck NetSim — MIT, copyright (c) 2026 Michael Borck.\n'+fs.readFileSync(path.join(root,'third_party/borck-netsim/LICENSE'),'utf8')+'*/'},footer:{js:'if(typeof module==="object" && module.exports)module.exports=AgLabBorckEngine;'}});
console.log('Built verified third-party NetSim bundle');
