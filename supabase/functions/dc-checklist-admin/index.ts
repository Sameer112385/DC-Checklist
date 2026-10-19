import {createClient,type SupabaseClient} from 'npm:@supabase/supabase-js@2.117.2';
type Role='inspector'|'supervisor'|'admin';
type Profile={user_id:string;email:string;full_name:string;role:Role;active:boolean};
function isRole(value:unknown):value is Role{return ['inspector','supervisor','admin'].includes(value as string)}
class AccessError extends Error{constructor(message:string,public status:number){super(message)}}
export function accountInput(input:any){
  if(!input||typeof input.email!=='string'||typeof input.full_name!=='string'||!isRole(input.role))throw new AccessError('Enter the name, email and role.',400);
  const email=input.email.trim().toLowerCase(),full_name=input.full_name.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!full_name||full_name.length>120)throw new AccessError('Enter a valid email and name (up to 120 characters).',400);
  const existing=input.existing===true;
  if(!existing&&(typeof input.password!=='string'||input.password.length<12||input.password.length>128))throw new AccessError('Choose an initial password between 12 and 128 characters.',400);
  return {email,full_name,role:input.role,existing,password:existing?undefined:input.password};
}
export async function createAccount(client:SupabaseClient,actorId:string,input:unknown){
  const account=accountInput(input);let id:string|undefined;let created=false;
  if(account.existing){
    for(let page=1;!id;page++){
      const result=await client.auth.admin.listUsers({page,perPage:200});
      if(result.error)throw new AccessError('Could not look up the existing Supabase account.',502);
      id=result.data.users.find(user=>user.email?.toLowerCase()===account.email)?.id;
      if(result.data.users.length<200)break;
    }
    if(!id)throw new AccessError('No existing Supabase Auth account has that email. Use Create new account.',404);
  }else{
    const result=await client.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,user_metadata:{full_name:account.full_name}});
    if(result.error||!result.data.user)throw new AccessError('Could not create the login account. Check password requirements, or choose Add existing account if this email already exists.',400);
    id=result.data.user.id;created=true;
  }
  const result=await client.rpc('dc_save_member',{p_actor_id:actorId,p_user_id:id,p_role:account.role,p_full_name:account.full_name,p_email:account.email,p_active:true,p_new:true});
  if(result.error){
    if(created){const cleanup=await client.auth.admin.deleteUser(id!);if(cleanup.error)throw new AccessError('Checklist access could not be saved and the new login account remains unapproved. An admin can retry with Add existing account.',502);}
    throw new AccessError('Checklist access could not be saved. Apply roles-upgrade.sql and check whether this account is already an app member.',409);
  }
  return {user_id:id,email:account.email,full_name:account.full_name,role:account.role,active:true};
}
export function updateInput(actorId:string,input:any){
  if(!input||typeof input.user_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.user_id)||!isRole(input.role)||typeof input.active!=='boolean'||typeof input.full_name!=='string'||!input.full_name.trim()||input.full_name.trim().length>120)throw new AccessError('Enter a valid user, name, role and account status.',400);
  if(input.user_id===actorId&&(input.role!=='admin'||!input.active))throw new AccessError('You cannot disable or downgrade your own admin account.',400);
  return {user_id:input.user_id,role:input.role,active:input.active,full_name:input.full_name.trim()};
}
export async function updateAccount(client:SupabaseClient,actorId:string,input:unknown){
  const row=updateInput(actorId,input);
  const {error}=await client.rpc('dc_save_member',{p_actor_id:actorId,p_user_id:row.user_id,p_role:row.role,p_full_name:row.full_name,p_email:null,p_active:row.active,p_new:false});
  if(error)throw new AccessError('Could not update the account. The last active admin must remain enabled.',409);
  return row;
}
export async function listAccounts(client:SupabaseClient):Promise<Profile[]>{
  const rows:Profile[]=[];let offset=0;
  for(;;){const {data,error,count}=await client.from('dc_checklist_members').select('user_id,email,full_name,role,active',{count:'exact'}).order('email').order('user_id').range(offset,offset+199);
    if(error)throw new AccessError('Could not load app users. Check the server secret and database setup.',502);
    rows.push(...(data??[]));offset+=(data??[]).length;if(!data?.length||count===null||offset>=count)return rows;
  }
}

export async function importRecordRows(client:SupabaseClient,input:any[]){
 if(!Array.isArray(input)||input.length>50)throw new Error('Invalid import batch');
 const ids=new Set<string>();
 const rows=input.map(r=>{const row={id:r.id,created_at:r.created_at??r.createdAt,payload:r.payload,created_by:null};
   if(typeof row.id!=='string'||ids.has(row.id)||!Number.isSafeInteger(Number(row.created_at))||typeof row.payload!=='string')throw new Error('Invalid or duplicate source row');
   const payload=JSON.parse(row.payload);if(payload.id!==row.id||Number(payload.createdAt)!==Number(row.created_at)||!['inspection','resolve','question'].includes(payload.kind))throw new Error('Source row metadata mismatch');
   ids.add(row.id);return row;
 });
 if(!rows.length)return {inserted:0,unchanged:0,verified:0};
 const existing=await client.from('dc_checklist_records').select('id,created_at,payload').in('id',rows.map(r=>r.id));if(existing.error)throw new Error('Could not inspect destination records');
 const map=new Map((existing.data??[]).map(r=>[r.id,r]));const missing=[];
 for(const row of rows){const saved=map.get(row.id);if(!saved)missing.push(row);else if(saved.payload!==row.payload||String(saved.created_at)!==String(row.created_at))throw new Error('Conflicting destination record; nothing is overwritten');}
 if(missing.length){const result=await client.from('dc_checklist_records').insert(missing);if(result.error)throw new Error('Import stopped. Retry to resume without overwriting data');}
 const verify=await client.from('dc_checklist_records').select('id,created_at,payload').in('id',rows.map(r=>r.id));if(verify.error||verify.data?.length!==rows.length)throw new Error('Import verification failed');
 const verified=new Map(verify.data.map(r=>[r.id,r]));
 for(const row of rows){const saved=verified.get(row.id);if(!saved||saved.payload!==row.payload||String(saved.created_at)!==String(row.created_at))throw new Error('Imported content does not match source');}
 return {inserted:missing.length,unchanged:rows.length-missing.length,verified:rows.length};
}


export async function resetAccountPassword(client:SupabaseClient,actorId:string,input:any){
 if(!input||typeof input.user_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.user_id)||typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw new AccessError('Choose a valid user and a password between 12 and 128 characters.',400);
 const actor=await client.from('dc_checklist_members').select('role,active').eq('user_id',actorId).maybeSingle();
 if(actor.error||actor.data?.role!=='admin'||!actor.data.active)throw new AccessError('Admin access required.',403);
 const target=await client.from('dc_checklist_members').select('user_id').eq('user_id',input.user_id).maybeSingle();
 if(target.error||!target.data)throw new AccessError('Checklist user not found.',404);
 const result=await client.auth.admin.updateUserById(input.user_id,{password:input.password});
 if(result.error)throw new AccessError('Could not reset the password. Check Supabase password requirements and retry.',400);
 return {ok:true,user_id:input.user_id};
}

Deno.serve(async(req:Request)=>{
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 try{
   if(!['GET','POST','PATCH'].includes(req.method))return json({error:'Method not allowed'},405);
   const token=req.headers.get('authorization');if(!token?.startsWith('Bearer '))throw new AccessError('Please sign in.',401);
   const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
   const userClient=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
   const auth=await userClient.auth.getUser(token.slice(7));if(auth.error||!auth.data.user)throw new AccessError('Invalid session.',401);
   const member=await userClient.from('dc_checklist_members').select('role,active,password_change_required').eq('user_id',auth.data.user.id).maybeSingle();
   if(req.method==='POST'){
    const input=await req.clone().json();
    if(input.action==='change_password'){
     if(member.error||!member.data?.active||member.data.role==='admin')throw new AccessError('An active Inspector or Supervisor account is required.',403);
     if(typeof input.current_password!=='string'||typeof input.password!=='string'||input.password.length<12||input.password.length>128||input.password===input.current_password)throw new AccessError('Choose a different password between 12 and 128 characters.',400);
     const verify=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
     const checked=await verify.auth.signInWithPassword({email:auth.data.user.email!,password:input.current_password});
     if(checked.error||checked.data.user?.id!==auth.data.user.id)throw new AccessError('Your current password is incorrect.',400);
     await verify.auth.signOut({scope:'local'});
     const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
     const changed=await service.auth.admin.updateUserById(auth.data.user.id,{password:input.password});
     if(changed.error)throw new AccessError('Could not change password. Check password requirements.',400);
     const cleared=await service.from('dc_checklist_members').update({password_change_required:false}).eq('user_id',auth.data.user.id);
     if(cleared.error)throw new AccessError('Password changed, but access could not be restored. Sign in using your new password and retry.',503);
     return json({ok:true});
    }
   }
   if(member.error||member.data?.role!=='admin'||!member.data.active)throw new AccessError('Admin access required.',403);
   const privileged=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
   if(req.method==='GET')return json(await listAccounts(privileged));
   const body=await req.json();
   if(req.method==='POST'&&body.action==='reset_password')return json(await resetAccountPassword(privileged,auth.data.user.id,body));
   if(req.method==='POST'&&body.action==='import_records')return json(await importRecordRows(privileged,body.rows));
   if(req.method==='POST')return json(await createAccount(privileged,auth.data.user.id,body),201);
   return json(await updateAccount(privileged,auth.data.user.id,body));
 }catch(e){return json({error:e instanceof AccessError?e.message:'Could not manage users.'},e instanceof AccessError?e.status:500)}
});


