import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
fs.mkdirSync('.test-output',{recursive:true});
fs.writeFileSync('.test-output/api-json.mjs',ts.transpileModule(fs.readFileSync('lib/api-json.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText);
const {readApiJson}=await import('../.test-output/api-json.mjs');
test('shows membership and setup errors from the API',async()=>{
  const message='Your account has not been approved for DC Daily Checklist.';
  await assert.rejects(readApiJson(Response.json({error:message},{status:403}),'Try refreshing'),{message});
});
test('keeps a useful fallback when a proxy returns HTML',async()=>{
  await assert.rejects(readApiJson(new Response('<html>error</html>',{status:502}),'Records unavailable'),{message:'Records unavailable'});
});
test('successful records are returned unchanged',async()=>{
  const records=[{id:'test',name:'Inspector Test'}];assert.deepEqual(await readApiJson(Response.json(records),'Error'),records);
});
