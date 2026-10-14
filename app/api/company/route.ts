import {authorize,errorResponse} from '../../../lib/supabase-server';
import {readCompany,companyInput} from '../../../lib/company';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return Response.json(await readCompany(await authorize(req)),{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not load company.')}}
export async function POST(req:Request){try{const client=await authorize(req,['admin']);const value=companyInput(await req.json());const {error}=await client.from('dc_company_settings').update(value).eq('id',true);if(error)throw error;return Response.json(value,{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not save company.')}}
