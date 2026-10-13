import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const filename=process.argv[2],apply=process.argv.includes('--apply');
if(!filename)throw Error('Usage: npm run import:records -- path/to/backup.json [--apply]');
const parsed=JSON.parse(fs.readFileSync(filename,'utf8'));
const raw=Array.isArray(parsed)?parsed:parsed.rows;
if(!Array.isArray(raw))throw Error('Expected an array of raw database rows or {rows:[...]}.');
const input=raw.length===1&&Array.isArray(raw[0]?.results)?raw[0].results:raw;
const ids=new Set();
const rows=input.map(r=>{const row={id:r.id,created_at:r.created_at??r.createdAt,payload:r.payload};
  if(typeof row.id!=='string'||ids.has(row.id)||!Number.isSafeInteger(Number(row.created_at))||typeof row.payload!=='string')throw Error('Invalid or duplicate backup row.');
  const payload=JSON.parse(row.payload);
  if(!payload||typeof payload!=='object'||payload.id!==row.id||Number(payload.createdAt)!==Number(row.created_at)||!['inspection','resolve','question'].includes(payload.kind))throw Error('Backup metadata does not match the stored payload.');
  ids.add(row.id);return row;
});
console.log(`Validated ${rows.length} backup rows.`);
if(!apply){console.log('Validation only. Use --apply to import; existing rows will never be overwritten.');process.exit(0)}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(url!=='https://scxvvvjlhewxjsezkyvk.supabase.co'||!key)throw Error('Set the selected project URL and a server-only SUPABASE_SECRET_KEY in .env.local.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let imported=0,unchanged=0;
for(let offset=0;offset<rows.length;offset+=50){
  const batch=rows.slice(offset,offset+50);
  const read=await client.from('dc_checklist_records').select('id,created_at,payload').in('id',batch.map(r=>r.id));
  if(read.error)throw Error('Could not read destination records. Check the schema and import key.');
  const existing=new Map((read.data??[]).map(r=>[r.id,r]));
  const missing=[];
  for(const row of batch){const previous=existing.get(row.id);if(!previous){missing.push(row);continue}
    if(String(previous.created_at)!==String(row.created_at)||previous.payload!==row.payload)throw Error('Destination contains a conflicting record. Import stopped without overwriting it.');unchanged++;}
  if(missing.length){const write=await client.from('dc_checklist_records').insert(missing);if(write.error)throw Error('Import stopped. Retain the backup and rerun to resume.');imported+=missing.length;}
  const verify=await client.from('dc_checklist_records').select('id,created_at,payload').in('id',batch.map(r=>r.id));
  if(verify.error||verify.data?.length!==batch.length)throw Error('Import verification failed. Retain the backup.');
  const map=new Map(verify.data.map(r=>[r.id,r]));
  for(const row of batch){const saved=map.get(row.id);if(!saved||saved.payload!==row.payload||String(saved.created_at)!==String(row.created_at))throw Error('Import content verification failed.');}
}
console.log(`Verified ${rows.length} exact records: ${imported} imported, ${unchanged} already present.`);
