import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',admin='11111111-1111-4111-8111-111111111111',supervisor='44444444-4444-4444-8444-444444444444',photo='55555555-5555-4555-8555-555555555555',config='66666666-6666-4666-8666-666666666666';
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth TO authenticated,service_role;`);
for(const [id,name] of [[admin,'sameer.shaikh@detasad.com'],[owner,'inspector@example.com'],[other,'other@example.com'],[supervisor,'supervisor@example.com']])await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,name,'{}']);
await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));await db.exec(fs.readFileSync('supabase/bootstrap-admin.sql','utf8'));
for(const [id,name,role] of [[owner,'Inspector','inspector'],[other,'Other','inspector'],[supervisor,'Supervisor','supervisor']])await db.query('INSERT INTO dc_checklist_members(user_id,email,full_name,role) VALUES($1,$2,$3,$4)',[id,name+'@example.com',name,role]);
await db.query('INSERT INTO dc_checklist_records VALUES($1,$2,$3,$4)',['legacy',1,JSON.stringify({id:'legacy',kind:'inspection',answers:{check:{status:'FAULTY'}}}),null]);
await db.exec(fs.readFileSync('supabase/photos-upgrade.sql','utf8'));
await db.query('INSERT INTO dc_microsoft_settings(id,created_by,settings,webhook_url) VALUES($1,$2,$3,$4)',[config,admin,'{}','private-test-placeholder']);
await db.query('INSERT INTO dc_inspection_photos(id,user_id,group_id,item_id,config_id,file_path,web_url,mime_type,bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[photo,owner,'group','check',config,'/Shared Documents/photo.png','https://detasad.sharepoint.com/photo.png','image/png',100]);
async function asUser(id,sql,params=[]){await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);const r=await db.query(sql,params);await db.exec('COMMIT');return r}catch(e){await db.exec('ROLLBACK');throw e}}
const insert='INSERT INTO dc_checklist_records(id,created_at,payload) VALUES($1,1,$2)';const inspection=(id,photos)=>JSON.stringify({id,kind:'inspection',name:'Inspector',group:'group',answers:{check:{status:'FAULTY',...(photos===undefined?{}:{photos})}}});
test('PostgreSQL: existing faults survive upgrade and reruns',async()=>{await db.exec(fs.readFileSync('supabase/photos-upgrade.sql','utf8'));assert.equal((await db.query("SELECT count(*)::int count FROM dc_checklist_records WHERE id='legacy'")).rows[0].count,1)});
test('PostgreSQL: new faults require a genuine saved photo even through direct database access',async()=>{
 await assert.rejects(asUser(owner,insert,['no-photo',inspection('no-photo')]),/requires a saved photo/);
 await assert.rejects(asUser(owner,insert,['fake',inspection('fake',[other])]),/does not belong/);
 await asUser(owner,insert,['with-photo',inspection('with-photo',[photo])]);
});
test('PostgreSQL: photo ownership, role access and private secrets are enforced',async()=>{
 assert.equal((await asUser(owner,'SELECT id FROM dc_inspection_photos')).rows.length,1);assert.equal((await asUser(other,'SELECT id FROM dc_inspection_photos')).rows.length,0);assert.equal((await asUser(supervisor,'SELECT id FROM dc_inspection_photos')).rows.length,1);
 await assert.rejects(asUser(admin,'SELECT webhook_url FROM dc_microsoft_settings'),/permission denied/);
 await assert.rejects(asUser(owner,'UPDATE dc_inspection_photos SET user_id=$1',[other]),/permission denied/);
 await db.query('UPDATE dc_checklist_members SET active=false WHERE user_id=$1',[owner]);assert.equal((await asUser(owner,'SELECT id FROM dc_inspection_photos')).rows.length,0);
});
test.after(()=>db.close());
