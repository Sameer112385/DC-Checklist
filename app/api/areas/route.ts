import {authorize,errorResponse} from '../../../lib/supabase-server';
import {readTemplates,areaInput} from '../../../lib/company';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{const client=await authorize(req,['admin']);const value=areaInput(await req.json(),await readTemplates(client));const {error}=await client.from('dc_checklist_areas').insert(value);if(error)return Response.json({error:error.code==='23505'?'This area already exists at this location.':'Could not add location.'},{status:error.code==='23505'?409:500});return Response.json(value,{status:201,headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not add location.')}}
