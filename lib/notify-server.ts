
export async function notifySavedInspection(req:Request,recordId:string){
 try{const r=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/dc-checklist-microsoft',{method:'POST',headers:{Authorization:req.headers.get('authorization')!,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,'Content-Type':'application/json'},body:JSON.stringify({action:'notify',recordId}),signal:AbortSignal.timeout(55000)});const data:any=await r.json();return r.ok?data.status:'failed'}catch{return 'failed'}
}