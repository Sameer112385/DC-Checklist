import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const root='.test-output/pdf';fs.mkdirSync(root,{recursive:true});
for(const name of ['inspection-pdf','pdf-font']){let code=fs.readFileSync('supabase/functions/dc-checklist-microsoft/'+name+'.ts','utf8').replace('npm:jspdf@4.2.1','jspdf').replace('npm:jspdf-autotable@5.0.8','jspdf-autotable').replace('./pdf-font.ts','./pdf-font.mjs');fs.writeFileSync(root+'/'+name+'.mjs',ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)}
fs.copyFileSync('app/templates.json',root+'/templates.json');
const {buildPdf}=await import('../'+root+'/inspection-pdf.mjs');
test('backend PDF generator produces a complete PDF from the saved snapshot',async()=>{
 const record={id:'pdf-test',createdAt:Date.now(),name:'Sameer Shaikh',date:'2026-10-14',shift:'1',group:'sama',items:[{id:'check',section:'General',label:'Doors & Access'}],answers:{check:{status:'FAULTY',note:'Fault details'}}};
 const content=await buildPdf(record),bytes=Buffer.from(content,'base64');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>10000);assert.match(bytes.toString('latin1'),/%%EOF/);
});
