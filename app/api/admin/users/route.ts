import {authorizeRequest,errorResponse} from '../../../../lib/supabase-server';
import {adminClient,createAccount,updateAccount,listAccounts} from '../../../../lib/supabase-admin';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{await authorizeRequest(req,['admin']);return Response.json(await listAccounts(adminClient()),{headers:{'Cache-Control':'no-store'}})}catch(e){return errorResponse(e,'Could not load users.')}}
export async function POST(req:Request){try{const {user}=await authorizeRequest(req,['admin']);return Response.json(await createAccount(adminClient(),user.id,await req.json()),{status:201})}catch(e){return errorResponse(e,'Could not add the user.')}}
export async function PATCH(req:Request){try{const {user}=await authorizeRequest(req,['admin']);return Response.json(await updateAccount(adminClient(),user.id,await req.json()))}catch(e){return errorResponse(e,'Could not update the user.')}}
