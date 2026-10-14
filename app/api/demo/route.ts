import {authorize,errorResponse} from '../../../lib/supabase-server';
import {readDemoRecords} from '../../../lib/demo-settings';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return Response.json(await readDemoRecords(await authorize(req)),{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not load demo data.')}}
