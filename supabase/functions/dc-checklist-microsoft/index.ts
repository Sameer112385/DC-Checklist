import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {microsoftAction,IntegrationError} from './microsoft-integration.ts';
Deno.serve(async(req:Request)=>{
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
 try{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const token=req.headers.get('authorization');if(!token?.startsWith('Bearer '))return json({error:'Please sign in.'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const userDb=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await userDb.auth.getUser(token.slice(7));if(auth.error||!auth.data.user)return json({error:'Invalid session.'},401);
  const member=await userDb.from('dc_checklist_members').select('user_id,role,active,password_change_required').eq('user_id',auth.data.user.id).maybeSingle();
  if(member.error||!member.data?.active||!['inspector','supervisor','admin'].includes(member.data.role))return json({error:'Checklist access is not approved.'},403);
  if(member.data.role!=='admin'&&member.data.password_change_required)return json({error:'Change your temporary password before using the portal.'},403);
  if(Number(req.headers.get('content-length')||0)>7200000)return json({error:'Photo exceeds the upload limit.'},413);
  const text=await req.text();if(text.length>7200000)return json({error:'Photo exceeds the upload limit.'},413);
  const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  return json(await microsoftAction(db,userDb,member.data,JSON.parse(text),async record=>{const brand=await db.from('dc_company_settings').select('name,logo_data,shift_schedule').eq('id',true).single();if(brand.error)throw new IntegrationError('Could not load PDF branding.',503);const {buildPdf}=await import('./inspection-pdf.ts');return buildPdf({...record,companyName:record.companyName||brand.data.name,pdfLogo:brand.data.logo_data,currentShiftSchedule:brand.data.shift_schedule})}));
 }catch(e){return json({error:e instanceof IntegrationError?e.message:'Microsoft integration is temporarily unavailable.'},e instanceof IntegrationError?e.status:500)}
});
