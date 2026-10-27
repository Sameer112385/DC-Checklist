export function amendmentDiff(before:any,after:any){
 const result:{item:string;field:string;before:string;after:string}[]=[];
 for(const key of ['date','shift'])if(before[key]!==after[key])result.push({item:'Inspection',field:key,before:String(before[key]??''),after:String(after[key]??'')});
 for(const [id,next] of Object.entries(after.answers||{}) as [string,any][]){const old=before.answers?.[id]||{},label=after.items?.find((i:any)=>i.id===id)?.label||id;for(const field of ['status','note','temp','humidity','value','photos']){const show=(v:any)=>Array.isArray(v)?v.join(', '):String(v??'');if(show(old[field])!==show(next[field]))result.push({item:label,field,before:show(old[field]),after:show(next[field])});}}
 return result;
}
