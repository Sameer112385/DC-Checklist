export async function readApiJson<T=any>(response:Response,fallback:string):Promise<T>{
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof payload?.error==='string'?payload.error:fallback);
  if(payload===null)throw new Error(fallback);
  return payload;
}
