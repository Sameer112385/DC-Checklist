import type {SupabaseClient} from '@supabase/supabase-js';
export class IntegrationError extends Error{constructor(message:string,public status=400){super(message)}}
export const MAX_PHOTO_BYTES=5*1024*1024;
const tenant='15737b68-50aa-4be0-8153-2325b5856b64';
export function parseSettings(input:any){
 let channel:URL,storage:URL;try{channel=new URL(input.channelUrl);storage=new URL(input.storageUrl)}catch{throw new IntegrationError('Enter valid Teams and SharePoint links.')}
 if(channel.protocol!=='https:'||channel.hostname!=='teams.microsoft.com'||!channel.pathname.startsWith('/l/channel/')||channel.searchParams.get('tenantId')!==tenant)throw new IntegrationError('Use a channel link from your company tenant.');
 const teamId=channel.searchParams.get('groupId'),channelId=decodeURIComponent(channel.pathname.split('/')[3]||'');
 if(!teamId||!/^[-a-f0-9]{36}$/i.test(teamId)||!channelId.endsWith('@thread.tacv2'))throw new IntegrationError('The channel link is incomplete.');
 if(storage.protocol!=='https:'||storage.hostname!=='detasad.sharepoint.com'||!storage.pathname.startsWith('/sites/'))throw new IntegrationError('Use a company SharePoint site link.');
 const site=storage.origin+'/sites/'+storage.pathname.split('/')[2];
 const folder=String(input.folder||'/Shared Documents').trim().replace(/\/$/,'');
 if(!folder.startsWith('/Shared Documents')||folder.includes('..')||/[?#\\]/.test(folder)||folder.length>240)throw new IntegrationError('Use an existing folder inside /Shared Documents.');
 return {channelUrl:channel.href,storageUrl:storage.href,site,folder,teamId,channelId,mode:input.mode==='live'?'live':'test',photosEnabled:input.photosEnabled===true,notificationsEnabled:input.notificationsEnabled===true};
}
export function validateWebhook(value:string){
 let u:URL;try{u=new URL(value)}catch{throw new IntegrationError('Enter the private Power Automate webhook URL.')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(u.hostname.endsWith('.api.powerplatform.com')||u.hostname.endsWith('.logic.azure.com'))||!u.pathname.includes('/workflows/'))throw new IntegrationError('Use an HTTPS Power Automate webhook URL.');
 return u.href;
}
export function validateImage(mime:string,content:string){
 if(!['image/jpeg','image/png','image/webp'].includes(mime)||typeof content!=='string'||!content||content.length>Math.ceil(MAX_PHOTO_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(content))throw new IntegrationError('Choose a JPEG, PNG or WebP photo up to 5 MB.');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(content),c=>c.charCodeAt(0))}catch{throw new IntegrationError('Invalid image data.')}
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!bytes.length||bytes.length>MAX_PHOTO_BYTES||!(mime==='image/png'?png:mime==='image/jpeg'?jpeg:webp))throw new IntegrationError('The file content does not match a supported photo.');
 return {bytes:bytes.length,extension:mime==='image/png'?'png':mime==='image/jpeg'?'jpg':'webp'};
}
async function config(db:SupabaseClient,id?:string){let q=db.from('dc_microsoft_settings').select('*');const result=id?await q.eq('id',id).single():await q.order('created_at',{ascending:false}).limit(1).maybeSingle();if(result.error)throw new IntegrationError('Microsoft settings are unavailable.',503);return result.data}
function publicConfig(row:any){return row?{id:row.id,...row.settings,webhookConfigured:!!row.webhook_url}:null}
export async function callWorkflow(row:any,payload:any){
 if(!row?.webhook_url)throw new IntegrationError('An admin must configure the Microsoft workflow.',503);
 let response:Response;try{response=await fetch(validateWebhook(row.webhook_url),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'message',attachments:[],...payload}),signal:AbortSignal.timeout(50000)})}catch{throw new IntegrationError('Microsoft did not confirm the operation. Check workflow run history before retrying.',502)}
 const result:any=await response.json().catch(()=>null);
 if(!response.ok||result?.ok!==true)throw new IntegrationError('Microsoft did not confirm success. Check the workflow connection and run history.',502);
 return result;
}
const escapeHtml=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function notificationInterrupted(task:any,now=Date.now()){
 return task?.status==='sending'&&Number.isFinite(Date.parse(task.updated_at))&&Date.parse(task.updated_at)<now-180000;
}
export async function microsoftAction(db:SupabaseClient,userDb:SupabaseClient,profile:any,input:any,buildPdf?:(record:any)=>Promise<string>){
 const action=input?.action;
 if(['settings_get','settings_save','settings_test'].includes(action)){
  if(profile.role!=='admin')throw new IntegrationError('Admin access required.',403);
  const previous=await config(db);
  if(action==='settings_get')return publicConfig(previous);
  const settings=parseSettings(input.settings??previous?.settings);
  const webhook_url=input.webhookUrl?validateWebhook(input.webhookUrl):previous?.webhook_url;
  if(!webhook_url)throw new IntegrationError('Add the private workflow URL.');
  if(action==='settings_test'){await callWorkflow({webhook_url},{operation:'ping',site:settings.site,folder:settings.folder});return {ok:true,message:'SharePoint destination and workflow connection verified.'}}
  // Verify the destination before enabling uploads. No message or photo is posted by this check.
  if(settings.photosEnabled||settings.notificationsEnabled)await callWorkflow({webhook_url},{operation:'ping',site:settings.site,folder:settings.folder});
  const result=await db.from('dc_microsoft_settings').insert({created_by:profile.user_id,settings,webhook_url}).select('*').single();if(result.error)throw new IntegrationError('Could not save Microsoft settings.',500);return publicConfig(result.data);
 }
 if(action==='photo_upload'){
  if(!['inspector','supervisor','admin'].includes(profile.role))throw new IntegrationError('Your role cannot upload inspection photos.',403);
  if(typeof input.group!=='string'||typeof input.item!=='string'||input.item.length>100)throw new IntegrationError('Select a checklist item.');
  const current=await config(db);if(!current?.settings.photosEnabled)throw new IntegrationError('Photo uploads are disabled. Contact an admin.',503);
  const image=validateImage(input.mime,input.content);
  const id=crypto.randomUUID(),filename='dc-photo-'+id+'.'+image.extension,path=current.settings.folder+'/'+filename;
  await callWorkflow(current,{operation:'upload',site:current.settings.site,folder:current.settings.folder,filename,content:input.content});
  // Store references only. Image bytes stay in SharePoint.
  const row={id,user_id:profile.user_id,group_id:input.group,item_id:input.item,config_id:current.id,file_path:path,web_url:current.settings.site+path.split('/').map(encodeURIComponent).join('/'),mime_type:input.mime,bytes:image.bytes};
  const result=await db.from('dc_inspection_photos').insert(row).select('id,web_url,mime_type,bytes').single();if(result.error)throw new IntegrationError('Photo reached SharePoint but its reference could not be saved. Contact an admin.',500);return result.data;
 }
 if(action==='photo_get'){
  if(!/^[a-f0-9-]{36}$/i.test(input.id??''))throw new IntegrationError('Invalid photo ID.');
  // Query as the caller so database row policies enforce active role and ownership.
  const result=await userDb.from('dc_inspection_photos').select('*').eq('id',input.id).maybeSingle();if(result.error||!result.data)throw new IntegrationError('Photo not found or access denied.',404);
  const photo=result.data,current=await config(db,photo.config_id);const content=await callWorkflow(current,{operation:'read',site:current.settings.site,path:photo.file_path});
  validateImage(photo.mime_type,content.content);return {content:content.content,mime:photo.mime_type,webUrl:photo.web_url};
 }
 if(action==='notify'||action==='notification_status'){
  const found=await userDb.from('dc_checklist_records').select('id,payload,created_by').eq('id',input.recordId).maybeSingle();if(found.error||!found.data)throw new IntegrationError('Inspection not found.',404);
  let record=JSON.parse(found.data.payload);if(!['inspection','issue_event','inspection_amendment'].includes(record.kind))throw new IntegrationError('Only inspections send submission notifications.');
  if(record.kind==='inspection'&&record.revision){const original=await db.from('dc_inspection_amendments').select('before_payload').eq('record_id',record.id).order('revision').limit(1).single();if(original.error)throw new IntegrationError('Original inspection snapshot is unavailable.',503);record=original.data.before_payload;}
  if(action==='notify'&&found.data.created_by!==profile.user_id&&profile.role!=='admin')throw new IntegrationError('Only the submitter or an admin can retry a notification.',403);
  let existing=await db.from('dc_teams_notifications').select('*').eq('record_id',record.id).maybeSingle();if(existing.error)throw new IntegrationError('Notification status is unavailable.',503);
  if(action==='notification_status')return {status:notificationInterrupted(existing.data)?'failed':existing.data?.status||'not_queued',canRetry:found.data.created_by===profile.user_id||profile.role==='admin'};
  if(!existing.data){const current=await config(db);if(!current?.settings.notificationsEnabled)return {status:'disabled'};
   const queued=await db.from('dc_teams_notifications').upsert({record_id:record.id,config_id:current.id},{onConflict:'record_id',ignoreDuplicates:true});if(queued.error)throw new IntegrationError('Could not queue notification.',503);
   existing=await db.from('dc_teams_notifications').select('*').eq('record_id',record.id).single();}
  const task=existing.data;if(task.status==='sent')return {status:'sent'};
  if(notificationInterrupted(task)){
   const recovered=await db.from('dc_teams_notifications').update({status:'failed'}).eq('record_id',record.id).eq('status','sending').lt('updated_at',new Date(Date.now()-180000).toISOString());
   if(recovered.error)throw new IntegrationError('Could not recover the interrupted notification.',503);
  }
  const claim=await db.from('dc_teams_notifications').update({status:'sending',attempts:task.attempts+1,updated_at:new Date().toISOString()}).eq('record_id',record.id).in('status',['pending','failed']).select().maybeSingle();if(claim.error)throw new IntegrationError('Could not claim notification.',503);if(!claim.data)return {status:'sending'};
  try{
  const current=await config(db,task.config_id);
  let pdfUrl=task.pdf_url;
  if(!pdfUrl&&record.kind==='inspection'){
   if(!buildPdf)throw new IntegrationError('PDF generation is unavailable.',503);
   const content=await buildPdf(record);
   const filename='inspection-'+record.date+'-shift-'+String(record.shift).replace(/[^a-zA-Z0-9-]/g,'')+'-'+record.id.replace(/[^a-zA-Z0-9-]/g,'')+'.pdf';
   await callWorkflow(current,{operation:'upload',site:current.settings.site,folder:current.settings.folder,filename,content});
   pdfUrl=current.settings.site+(current.settings.folder+'/'+filename).split('/').map(encodeURIComponent).join('/');
   const saved=await db.from('dc_teams_notifications').update({pdf_url:pdfUrl}).eq('record_id',record.id);
   if(saved.error)throw new IntegrationError('PDF uploaded but its reference could not be saved.',503);
  }
  const count=Object.values(record.answers??{}).filter((a:any)=>a.status==='FAULTY').length;
  const photoIds=[...new Set(record.kind!=='inspection'?(record.details?.photos||[]):Object.values(record.answers??{}).flatMap((a:any)=>a.photos||[]))];
  let photoLinks='';if(photoIds.length){const photos=await db.from('dc_inspection_photos').select('id,web_url').in('id',photoIds);if(!photos.error)photoLinks='<p><b>Fault photos</b></p><ul>'+(photos.data??[]).map((p,index)=>'<li><a href="'+escapeHtml(p.web_url)+'">View photo '+(index+1)+'</a><br/><img src="'+escapeHtml(p.web_url)+'" alt="Issue photo" width="320"/></li>').join('')+'</ul>'}
  let messageHtml='<p><b>'+ (current.settings.mode==='test'?'[TEST] ':'')+'Checklist submitted</b></p><p>Inspector: '+escapeHtml(record.name)+'<br/>Date: '+escapeHtml(record.date)+' · Shift '+escapeHtml(record.shift)+'<br/>Area: '+escapeHtml(record.area||record.group)+'<br/>Faults: '+count+'</p><p><a href="'+escapeHtml(pdfUrl)+'">View inspection PDF</a></p><p><a href="https://dc-daily-checklist.sameer1123.chatgpt.site/?inspection='+encodeURIComponent(record.id)+'">Open inspection</a></p>'+photoLinks;
  if(record.kind==='issue_event'){
   const labels:Record<string,string>={rootCause:'Problem Description / Root Cause',repair:'Repair / Replacement Details',contractor:'Contractor / Technician',reference:'Work Order / Ticket Reference',furtherAction:'Further Action Required',followUp:'Follow-up Action',responsible:'Responsible Person',due:'Target Completion Date',verification:'Verification Comments',completedBy:'Completed By',dateTime:'Date / Time'};
   const detailHtml=Object.entries(record.details||{}).filter(([k,v])=>k!=='photos'&&v!==''&&v!=null).map(([k,v])=>'<p><b>'+escapeHtml(labels[k]||k)+':</b> '+escapeHtml(v)+'</p>').join('');
   messageHtml='<p><b>'+(current.settings.mode==='test'?'[TEST] ':'')+'Issue '+escapeHtml(record.issueNumber)+' — '+escapeHtml(record.action)+'</b></p><p>Item: '+escapeHtml(record.label)+'<br/>Location: '+escapeHtml(record.area)+'<br/>Original fault: '+escapeHtml(record.originalFault)+'<br/>Status: '+escapeHtml(record.status)+'<br/>Updated by: '+escapeHtml(record.name)+'</p>'+detailHtml+'<p><a href="https://dc-daily-checklist.sameer1123.chatgpt.site/?issue='+encodeURIComponent(record.issueId)+'">Open issue and repair history</a></p>'+photoLinks;
  }else if(record.kind==='inspection_amendment'){
   messageHtml='<p><b>'+(current.settings.mode==='test'?'[TEST] ':'')+'Submitted checklist amended — Revision '+escapeHtml(record.revision)+'</b></p><p>Amended by: '+escapeHtml(record.name)+'<br/>Original inspector: '+escapeHtml(record.details?.originalInspector)+'<br/>Area: '+escapeHtml(record.area)+'<br/>Corrected inspection date / shift: '+escapeHtml(record.details?.inspectionDate)+' / '+escapeHtml(record.details?.shift)+'<br/>Reason: '+escapeHtml(record.details?.reason)+'<br/>Changed items: '+escapeHtml((record.details?.changedItems||[]).join(', '))+'</p><p><a href="https://dc-daily-checklist.sameer1123.chatgpt.site/?inspection='+encodeURIComponent(record.inspectionId)+'">View corrected checklist and amendment history</a></p>'+photoLinks;
  }else{const refs=Object.values(record.answers??{}).filter((a:any)=>a.issueNumber).map((a:any)=>escapeHtml(a.issueNumber));if(refs.length)messageHtml+='<p>Issue references: '+refs.join(', ')+'</p>';}
  await callWorkflow(current,{operation:'notify',teamId:current.settings.teamId,channelId:current.settings.channelId,messageHtml});await db.from('dc_teams_notifications').update({status:'sent',updated_at:new Date().toISOString()}).eq('record_id',record.id);return {status:'sent'}}catch(e){await db.from('dc_teams_notifications').update({status:'failed',updated_at:new Date().toISOString()}).eq('record_id',record.id);throw e}
 }
 throw new IntegrationError('Unknown Microsoft operation.');
}
