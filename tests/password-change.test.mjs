import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const actor='22222222-2222-4222-8222-222222222222';let handler,mode='ok',calls=[];
const membership={role:'inspector',active:true,password_change_required:true};
const userClient={auth:{getUser:async()=>({data:{user:{id:actor,email:'test@example.com'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{...membership,role:mode==='admin'?'admin':'inspector',active:mode!=='inactive'}})})})})};
const verifyClient={auth:{signInWithPassword:async input=>{calls.push(['verify',input.email]);return mode==='wrong'?{error:new Error('bad password'),data:{}}:{data:{user:{id:actor}}}},signOut:async options=>{assert.equal(options.scope,'local');return {error:null}}}};
const serviceClient={auth:{admin:{updateUserById:async(id,value)=>{calls.push(['password',id,value.password]);return {error:null}}}},from:()=>({update:value=>({eq:async(column,id)=>{calls.push(['flag',id,value.password_change_required]);return {error:null}}})})};
globalThis.__passwordClients=(_url,key,options)=>key==='service'?serviceClient:options?.global?userClient:verifyClient;
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}[name])},serve:fn=>{handler=fn}};
let source=fs.readFileSync('supabase/functions/dc-checklist-admin/index.ts','utf8').replace(/^import .*?;\r?\n/,'const createClient=globalThis.__passwordClients;\n');
source=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const request=(input={},signed=true)=>new Request('https://test.supabase.co/functions/v1/dc-checklist-admin',{method:'POST',headers:{...(signed?{Authorization:'Bearer test-session'}:{}),'Content-Type':'application/json'},body:JSON.stringify({action:'change_password',current_password:'Temporary-Test-Password',password:'Personal-New-Password-123',...input})});
test('self-service password change verifies current credentials and ignores a requested target account',async()=>{
 mode='ok';calls=[];const response=await handler(request({user_id:'someone-else'}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
 assert.deepEqual(calls,[['verify','test@example.com'],['password',actor,'Personal-New-Password-123'],['flag',actor,false]]);
});
test('wrong current password cannot change credentials or clear the requirement',async()=>{mode='wrong';calls=[];const r=await handler(request());assert.equal(r.status,400);assert.equal(calls.filter(c=>c[0]!=='verify').length,0)});
test('unsigned, inactive and Admin callers cannot use the non-admin password endpoint',async()=>{
 calls=[];assert.equal((await handler(request({},false))).status,401);for(mode of ['inactive','admin'])assert.equal((await handler(request())).status,403);assert.equal(calls.length,0);
});
test('weak or unchanged passwords are rejected before credential verification',async()=>{
 mode='ok';calls=[];for(const password of ['short','Temporary-Test-Password'])assert.equal((await handler(request({password}))).status,400);assert.equal(calls.length,0);
});
