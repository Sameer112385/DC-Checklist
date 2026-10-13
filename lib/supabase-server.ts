import {createClient,type SupabaseClient} from '@supabase/supabase-js';
class AccessError extends Error{constructor(message:string,public status:number){super(message)}}
export async function authorize(req:Request){
  const token=req.headers.get('authorization');
  if(!token?.startsWith('Bearer '))throw new AccessError('Please sign in.',401);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new AccessError('Supabase is not configured.',503);
  const client=createClient(url,key,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(token.slice(7));
  if(error||!data.user)throw new AccessError('Your session expired. Please sign in again.',401);
  const membership=await client.from('dc_checklist_members').select('user_id').eq('user_id',data.user.id).maybeSingle();
  if(membership.error)throw new AccessError('Database setup is incomplete. Apply supabase/schema.sql.',503);
  if(!membership.data)throw new AccessError('Your account has not been approved for DC Daily Checklist.',403);
  return client;
}
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
