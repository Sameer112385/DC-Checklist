import {authorize,errorResponse} from '../../../lib/supabase-server';
import {readDemoEnabled,demoInput} from '../../../lib/demo-settings';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return Response.json({demoEnabled:await readDemoEnabled(await authorize(req))},{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not load settings.')}}
export async function PATCH(req:Request){try{const client=await authorize(req,['admin']),enabled=demoInput(await req.json());const {data,error}=await client.from('dc_company_settings').update({demo_enabled:enabled}).eq('id',true).select('demo_enabled').single();if(error)throw error;return Response.json({demoEnabled:data.demo_enabled===true},{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not save settings.')}}
