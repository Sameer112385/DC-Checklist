
import {authorizeRequest,errorResponse} from '../../../lib/supabase-server';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{
 await authorizeRequest(req);
 if(Number(req.headers.get('content-length')||0)>7200000)return Response.json({error:'Photo exceeds the upload limit.'},{status:413});
 const text=await req.text();if(text.length>7200000)return Response.json({error:'Photo exceeds the upload limit.'},{status:413});
 const response=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/dc-checklist-microsoft',{method:'POST',headers:{Authorization:req.headers.get('authorization')!,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,'Content-Type':'application/json'},body:text});
 const data=await response.json().catch(()=>({error:'Microsoft integration is temporarily unavailable.'}));
 return Response.json(data,{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e,'Could not connect to Microsoft.')}}