import type {SupabaseClient} from '@supabase/supabase-js';
import {AccessError} from './supabase-server';
export async function validateFaultPhotos(client:SupabaseClient,userId:string,group:string,items:any[],answers:any){
 const refs: {id:string,item:string}[]=[];
 for(const item of items){const answer=answers?.[item.id],photos=answer?.photos??[];
  if(!Array.isArray(photos)||photos.length>3||photos.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))||new Set(photos).size!==photos.length)throw new AccessError('Choose up to 3 saved photos per check.',400);
  if(answer?.status==='FAULTY'&&!photos.length)throw new AccessError('Add a saved photo for every faulty item before submitting.',400);
  refs.push(...photos.map(id=>({id,item:item.id})));
 }
 if(!refs.length)return;
 const result=await client.from('dc_inspection_photos').select('id,user_id,group_id,item_id').in('id',refs.map(r=>r.id));
 if(result.error)throw new AccessError('Could not verify fault photos. Please retry.',503);
 const rows=new Map((result.data??[]).map(p=>[p.id,p]));
 for(const ref of refs){const photo=rows.get(ref.id);if(!photo||photo.user_id!==userId||photo.group_id!==group||photo.item_id!==ref.item)throw new AccessError('Each photo must belong to this inspector and checklist item.',400)}
}
