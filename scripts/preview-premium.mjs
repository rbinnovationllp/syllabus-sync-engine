import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(), require=createRequire(path.join(root,'package.json'));
const output=process.argv[2];if(!output)throw Error('Output path required');
function resolveFile(p){for(const f of [p,p+'.ts',p+'.tsx',p+'.js',p+'.mjs',path.join(p,'index.ts'),path.join(p,'index.js')])if(fs.existsSync(f)&&fs.statSync(f).isFile())return f;return require.resolve(p);}
const plugin={name:'node-file-reader',setup(b){b.onResolve({filter:/.*/},a=>{
 let file;if(a.path.startsWith('@/'))file=resolveFile(path.join(root,'src',a.path.slice(2)));
 else if(a.path.startsWith('.'))file=resolveFile(path.resolve(a.importer?path.dirname(a.importer):root,a.path));
 else file=require.resolve(a.path,{paths:[a.importer?path.dirname(a.importer):root]});
 return {path:file,namespace:'node-file-reader'};
});b.onLoad({filter:/.*/,namespace:'node-file-reader'},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:a.path.endsWith('.tsx')?'tsx':a.path.endsWith('.ts')?'ts':a.path.endsWith('.json')?'json':'js'}));}};
const sql=fs.readFileSync('supabase/migrations/20260906000100_ai_education_premium_group_pricing.sql','utf8');
const matches=[...sql.matchAll(/\('([^']+)','([^']+)',array\[([^\]]+)\],(\d+),(\d+),(true|false),(\d+)\)/g)];
const packages=matches.map((m,i)=>({code:m[1],label:m[2],grades:[...m[3].matchAll(/'([^']+)'/g)].map(x=>x[1]),monthlyInr:Number(m[4]),annualInr:Number(m[5]),featured:m[6]==='true',currency:'inr',gstRate:18,gstInclusive:true,groupKind:i<5?'group':'school',active:true}));
if(packages.length!==9)throw Error('Expected 9 database packages');
const script=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{PremiumPricing}from'@/components/PremiumPricing';createRoot(document.getElementById('app')).render(<PremiumPricing packages={${JSON.stringify(packages)}} canManage={true} onCheckout={(code,interval)=>{document.getElementById('checkout').textContent=code+' '+interval;}}/>);`,loader:'tsx',resolveDir:root},plugins:[plugin],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',tsconfigRaw:{},define:{'process.env.NODE_ENV':'"production"'}});
const cssfile=fs.readdirSync('dist/client/assets').find(f=>f.endsWith('.css'));
const css=fs.readFileSync('dist/client/assets/'+cssfile,'utf8');
fs.writeFileSync(output,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Premium pricing verification</title><style>${css} body{margin:0;padding:20px} #app{max-width:1100px;margin:auto}</style></head><body><div id="app"></div><p id="checkout" role="status"></p><script>${script.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`);
console.log('Interactive preview compiled from PremiumPricing and database seed.');
