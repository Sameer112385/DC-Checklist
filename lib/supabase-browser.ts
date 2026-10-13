import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|undefined;
export function browserClient(){
  if(client)return client;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Add the Supabase project URL and publishable key to .env.local, then restart the app.');
  client=createClient(url,key);return client;
}
export async function apiFetch(url:string,init:RequestInit={}){
  const {data,error}=await browserClient().auth.getSession();
  if(error||!data.session)throw new Error('Please sign in again.');
  const headers=new Headers(init.headers);headers.set('Authorization','Bearer '+data.session.access_token);
  return fetch(url,{...init,headers,cache:'no-store'});
}
