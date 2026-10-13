import {authorizeRequest,errorResponse} from '../../../lib/supabase-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const {profile}=await authorizeRequest(req);return Response.json(profile,{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not load your role.')}}
