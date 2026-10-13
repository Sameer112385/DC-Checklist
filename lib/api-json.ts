export async function readApiJson(response:Response,fallback:string){
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof payload?.error==='string'?payload.error:fallback);
  if(payload===null)throw new Error(fallback);
  return payload;
}
