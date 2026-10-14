import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {AccessError} from './supabase-server';
import {isRole,type Profile} from './roles';
export function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new AccessError('User management needs a server-only SUPABASE_SECRET_KEY. Add it to the server environment and restart.',503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
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
