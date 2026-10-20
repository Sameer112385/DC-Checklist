import test from 'node:test';import assert from 'node:assert/strict';
import {compileModules} from './compile.mjs';
const {validateImage,parseSettings,validateWebhook,callWorkflow,microsoftAction,notificationInterrupted}=await compileModules('photos',['microsoft-integration']);
const {validateFaultPhotos}=await compileModules('fault-photos',['roles','supabase-server','fault-photos']);
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
const settings={channelUrl:'https://teams.microsoft.com/l/channel/19%3Atest%40thread.tacv2/Test?groupId=57f2e09a-6683-4f5e-8604-4f8396eefd6a&tenantId=15737b68-50aa-4be0-8153-2325b5856b64',storageUrl:'https://detasad.sharepoint.com/sites/Test/Shared%20Documents/Forms/AllItems.aspx',folder:'/Shared Documents'};
test('photos reject disguised files, unsupported types and oversized content',()=>{
 assert.equal(validateImage('image/png',png).extension,'png');assert.throws(()=>validateImage('image/jpeg',png),/does not match/);assert.throws(()=>validateImage('image/svg+xml',png),/Choose/);assert.throws(()=>validateImage('image/png','!'),/Choose/);assert.throws(()=>validateImage('image/png','A'.repeat(8000000)),/Choose/);
});
test('Microsoft settings enforce the company destinations and safe folder paths',()=>{
 const s=parseSettings(settings);assert.equal(s.site,'https://detasad.sharepoint.com/sites/Test');assert.equal(s.channelId,'19:test@thread.tacv2');assert.throws(()=>parseSettings({...settings,storageUrl:'https://attacker.example/sites/Test'}));assert.throws(()=>parseSettings({...settings,folder:'/Shared Documents/../Other'}));assert.throws(()=>parseSettings({...settings,channelUrl:settings.channelUrl.replace('15737b68','00000000')}));
});
test('webhook URLs cannot target arbitrary hosts or HTTP destinations',()=>{
 assert.throws(()=>validateWebhook('http://localhost/workflows/test'));assert.throws(()=>validateWebhook('https://example.com/workflows/test'));assert.ok(validateWebhook('https://example.api.powerplatform.com/workflows/test'));
});
test('workflow 202 is never mistaken for confirmed upload success',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:202});try{await assert.rejects(()=>callWorkflow({webhook_url:'https://example.api.powerplatform.com/workflows/test'},{operation:'upload'}),/did not confirm success/)}finally{globalThis.fetch=original}
});
test('faults require photos, and another inspector or check cannot supply evidence',async()=>{
 const id='11111111-1111-4111-8111-111111111111',items=[{id:'check'}];
 await assert.rejects(()=>validateFaultPhotos({},'owner','group',items,{check:{status:'FAULTY'}}),/saved photo/);
 const db={from(){return {select(){return {in:async()=>({data:[{id,user_id:'other',group_id:'group',item_id:'check'}]})}}}}};
 await assert.rejects(()=>validateFaultPhotos(db,'owner','group',items,{check:{status:'FAULTY',photos:[id]}}),/belong/);
 const own={from(){return {select(){return {in:async()=>({data:[{id,user_id:'owner',group_id:'group',item_id:'check'}]})}}}}};
 await validateFaultPhotos(own,'owner','group',items,{check:{status:'FAULTY',photos:[id]}});
 await assert.rejects(()=>validateFaultPhotos(own,'owner','different',items,{check:{status:'FAULTY',photos:[id]}}),/belong/);
});
test('non-admin users cannot read or change private Microsoft settings',async()=>{
 for(const role of ['inspector','supervisor'])await assert.rejects(()=>microsoftAction({}, {},{role},{action:'settings_save'}),e=>e.status===403);
});
function notificationMocks(status,pdf_url,updated_at=new Date(0).toISOString()){
 const record={id:'round',kind:'inspection',name:'<Inspector>',date:'2026-10-14',shift:'1',area:'Area',answers:{check:{status:'FAULTY',photos:['photo']}}};
 const userDb={from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:{id:'round',payload:JSON.stringify(record),created_by:'owner'}})}}}}}}};
 const config={id:'config',webhook_url:'https://example.api.powerplatform.com/workflows/test',settings:{mode:'test',teamId:'team',channelId:'channel',site:'https://detasad.sharepoint.com/sites/Test',folder:'/Shared Documents'}};
 const taskResult={data:{record_id:'round',config_id:'config',status,attempts:0,pdf_url,updated_at}};
 const claimed={maybeSingle:async()=>({data:{record_id:'round'}})};
 const db={from:()=>({
  select:()=>({eq:()=>({maybeSingle:async()=>taskResult,single:async()=>({data:config})}),in:async()=>({data:[{id:'photo',web_url:'https://detasad.sharepoint.com/photo.jpg'}]})}),
  update:()=>({eq:()=>({error:null,in:()=>({select:()=>claimed}),eq:()=>({lt:async()=>({error:null})})})})
 })};
 return {db,userDb};
}
test('Teams notification includes escaped inspector text, photo links and saved inspection link',async()=>{
 const {db,userDb}=notificationMocks('pending');const original=globalThis.fetch;let sent;const operations=[];
 globalThis.fetch=async(_,options)=>{sent=JSON.parse(options.body);operations.push(sent.operation);return Response.json({ok:true})};
 try{assert.deepEqual(await microsoftAction(db,userDb,{user_id:'owner',role:'inspector'},{action:'notify',recordId:'round'},async()=>btoa('%PDF-1.7 test')),{status:'sent'});assert.deepEqual(operations,['upload','notify']);assert.match(sent.messageHtml,/View inspection PDF/);assert.match(sent.messageHtml,/&lt;Inspector&gt;/);assert.match(sent.messageHtml,/View fault photo 1/);assert.match(sent.messageHtml,/\?inspection=round/);assert.match(sent.messageHtml,/\[TEST\]/)}finally{globalThis.fetch=original}
});
test('already sent notifications do not post again',async()=>{
 const {db,userDb}=notificationMocks('sent');const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Must not call workflow')};try{assert.deepEqual(await microsoftAction(db,userDb,{user_id:'owner',role:'inspector'},{action:'notify',recordId:'round'}),{status:'sent'})}finally{globalThis.fetch=original}
});

test('notification retry reuses the uploaded PDF instead of uploading again',async()=>{
 const {db,userDb}=notificationMocks('failed','https://detasad.sharepoint.com/existing.pdf');const original=globalThis.fetch;const operations=[];globalThis.fetch=async(_,options)=>{const payload=JSON.parse(options.body);operations.push(payload.operation);assert.match(payload.messageHtml,/existing.pdf/);return Response.json({ok:true})};
 try{await microsoftAction(db,userDb,{user_id:'owner',role:'inspector'},{action:'notify',recordId:'round'},async()=>{throw Error('Must reuse saved PDF')});assert.deepEqual(operations,['notify'])}finally{globalThis.fetch=original}
});
test('failed PDF upload never sends a submission notification',async()=>{
 const {db,userDb}=notificationMocks('pending');const original=globalThis.fetch;const operations=[];globalThis.fetch=async(_,options)=>{operations.push(JSON.parse(options.body).operation);return Response.json({ok:false},{status:502})};
 try{await assert.rejects(()=>microsoftAction(db,userDb,{user_id:'owner',role:'inspector'},{action:'notify',recordId:'round'},async()=>btoa('%PDF-1.7')),/confirm success/);assert.deepEqual(operations,['upload'])}finally{globalThis.fetch=original}
});

test('interrupted sends become retryable but fresh leases and sent notifications stay protected',async()=>{
 const now=Date.now();assert.equal(notificationInterrupted({status:'sending',updated_at:new Date(now-180001).toISOString()},now),true);
 for(const task of [{status:'sending',updated_at:new Date(now).toISOString()},{status:'sent',updated_at:new Date(0).toISOString()},{status:'sending',updated_at:'invalid'}])assert.equal(notificationInterrupted(task,now),false);
 for(const [stamp,status] of [[new Date(0).toISOString(),'failed'],[new Date().toISOString(),'sending']]){const {db,userDb}=notificationMocks('sending',null,stamp);assert.equal((await microsoftAction(db,userDb,{user_id:'owner',role:'inspector'},{action:'notification_status',recordId:'round'})).status,status)}
});

test('retry recovers an interrupted claim and uploads the PDF before posting once',async()=>{
 const {db,userDb}=notificationMocks('sending');const original=globalThis.fetch,operations=[];globalThis.fetch=async(_,options)=>{operations.push(JSON.parse(options.body).operation);return Response.json({ok:true})};
 try{assert.deepEqual(await microsoftAction(db,userDb,{user_id:'owner',role:'inspector'},{action:'notify',recordId:'round'},async()=>btoa('%PDF-1.7')),{status:'sent'});assert.deepEqual(operations,['upload','notify'])}finally{globalThis.fetch=original}
});
