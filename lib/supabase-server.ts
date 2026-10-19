import {createClient,type SupabaseClient,type User} from '@supabase/supabase-js';
import {isRole,type Profile,type Role} from './roles';
export class AccessError extends Error{constructor(message:string,public status:number){super(message)}}
export function checkProfile(member:unknown,allowed?:readonly Role[]):Profile{
  const value=member as Profile|null;
  if(!value)throw new AccessError('Your account has not been approved for DC Daily Checklist.',403);
  if(!isRole(value.role))throw new AccessError('Apply supabase/roles-upgrade.sql to enable user roles.',503);
  if(!value.active)throw new AccessError('Your checklist account is disabled. Contact an admin.',403);
  if(allowed&&!allowed.includes(value.role))throw new AccessError('Your role does not allow this action.',403);
  return value;
}
export async function authorizeRequest(req:Request,allowed?:readonly Role[]):Promise<{client:SupabaseClient;user:User;profile:Profile}>{
  const token=req.headers.get('authorization');
  if(!token?.startsWith('Bearer '))throw new AccessError('Please sign in.',401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new AccessError('Supabase is not configured.',503);
  const client=createClient(url,key,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(token.slice(7));
  if(error||!data.user)throw new AccessError('Your session expired. Please sign in again.',401);
  const membership=await client.from('dc_checklist_members').select('user_id,email,full_name,role,active,password_change_required').eq('user_id',data.user.id).maybeSingle();
  if(membership.error)throw new AccessError('Database setup is incomplete. Apply supabase/roles-upgrade.sql.',503);
  const profile=checkProfile(membership.data,allowed);if(profile.role!=='admin'&&profile.password_change_required&&!['/api/me','/api/password'].includes(new URL(req.url).pathname))throw new AccessError('Change your temporary password before using the portal.',403);return {client,user:data.user,profile};
}
export async function authorize(req:Request,allowed?:readonly Role[]){return (await authorizeRequest(req,allowed)).client}
export type RecordRow={id:string;createdAt:number;payload:string};
export async function readRecords(client:SupabaseClient):Promise<RecordRow[]>{
  const rows:RecordRow[]=[];let offset=0;
  for(;;){
    const {data,error,count}=await client.from('dc_checklist_records').select('id,created_at,payload',{count:'exact'}).order('created_at').order('id').range(offset,offset+499);
    if(error)throw error;
    const batch=data??[];
    rows.push(...batch.map(r=>({id:r.id,createdAt:Number(r.created_at),payload:r.payload})));
    offset+=batch.length;
    if(!batch.length||count===null||offset>=count)return rows;
  }
}
export async function insertRecord(client:SupabaseClient,row:RecordRow){
  const {error}=await client.from('dc_checklist_records').insert({id:row.id,created_at:row.createdAt,payload:row.payload});
  if(error)throw error;
}
export function errorResponse(error:unknown,fallback:string){
  return Response.json({error:error instanceof AccessError?error.message:fallback},{status:error instanceof AccessError?error.status:500,headers:{'Cache-Control':'no-store'}});
}
