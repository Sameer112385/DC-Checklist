import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModules} from './compile.mjs';
const admin=await compileModules('admin',['roles','supabase-server','supabase-admin']);
const {checkProfile}=await import('../.test-output/admin/supabase-server.mjs');
const {canOpenTab}=await import('../.test-output/admin/roles.mjs');
const actor='11111111-1111-4111-8111-111111111111',created='22222222-2222-4222-8222-222222222222';
const input={email:'inspector@example.com',full_name:'Inspector Test',role:'inspector',password:'Secure-Test-Password-123!'};
test('inspector and supervisor cannot pass the admin authorization check',()=>{
 for(const role of ['inspector','supervisor'])assert.throws(()=>checkProfile({role,active:true},['admin']),e=>e.status===403);
 assert.throws(()=>checkProfile({role:'admin',active:false},['admin']),e=>e.status===403);
 assert.equal(checkProfile({role:'admin',active:true},['admin']).role,'admin');
});
test('navigation follows the role permissions',()=>{
 assert.equal(canOpenTab('inspector','Admin users'),false);assert.equal(canOpenTab('supervisor','Fill checklist'),false);
 assert.equal(canOpenTab('supervisor','Supervisor view'),true);assert.equal(canOpenTab('admin','Admin users'),true);
});
test('new accounts create Supabase Auth and save their protected role',async()=>{
 let authInput,rpcInput;
 const client={auth:{admin:{createUser:async(value)=>{authInput=value;return {data:{user:{id:created}},error:null}}}},rpc:async(name,value)=>{assert.equal(name,'dc_save_member');rpcInput=value;return {error:null}}};
 const result=await admin.createAccount(client,actor,input);
 assert.equal(authInput.email,input.email);assert.equal(authInput.user_metadata.role,undefined);
 assert.equal(rpcInput.p_actor_id,actor);assert.equal(rpcInput.p_user_id,created);assert.equal(rpcInput.p_role,'inspector');assert.equal(result.active,true);
 assert.equal('password' in result,false);
});
test('failed membership creation removes only the newly created unapproved Auth account',async()=>{
 let deleted;
 const client={auth:{admin:{createUser:async()=>({data:{user:{id:created}},error:null}),deleteUser:async(id)=>{deleted=id;return {error:null}}}},rpc:async()=>({error:{message:'failed'}})};
 await assert.rejects(admin.createAccount(client,actor,input),e=>e.status===409);assert.equal(deleted,created);
});
test('adding an existing Auth user never deletes or resets their account on a failure',async()=>{
 let deleted=false;
 const client={auth:{admin:{listUsers:async()=>({data:{users:[{id:created,email:input.email}]},error:null}),deleteUser:async()=>{deleted=true}}},rpc:async()=>({error:{message:'failed'}})};
 await assert.rejects(admin.createAccount(client,actor,{...input,existing:true}),e=>e.status===409);assert.equal(deleted,false);
});
test('admins cannot disable or downgrade their own access',()=>{
 for(const change of [{role:'inspector',active:true},{role:'admin',active:false}])assert.throws(()=>admin.updateInput(actor,{user_id:actor,full_name:'Admin',...change}),e=>e.status===400);
});
test('bad roles and short passwords are rejected before calling Supabase',()=>{
 assert.throws(()=>admin.accountInput({...input,role:'owner'}),e=>e.status===400);
 assert.throws(()=>admin.accountInput({...input,password:'short'}),e=>e.status===400);
});
