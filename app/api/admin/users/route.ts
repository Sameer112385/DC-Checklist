
import {authorizeRequest,errorResponse} from '../../../../lib/supabase-server';
export const dynamic='force-dynamic';
async function forward(req:Request){try{
  await authorizeRequest(req,['admin']);
  const response=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/dc-checklist-admin',{method:req.method,headers:{Authorization:req.headers.get('authorization')!,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,'Content-Type':'application/json'},...(req.method==='GET'?{}:{body:await req.text()})});
  const data=await response.json().catch(()=>({error:'User management is temporarily unavailable.'}));
  return Response.json(data,{status:response.status,headers:{'Cache-Control':'no-store'}});
}catch(e){return errorResponse(e,'Could not manage users.')}}
export const GET=forward;export const POST=forward;export const PATCH=forward;
