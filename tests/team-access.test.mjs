import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),admin='11111111-1111-4111-8111-111111111111',one='22222222-2222-4222-8222-222222222222',two='33333333-3333-4333-8333-333333333333';
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,encrypted_password text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth TO authenticated,service_role;`);
for(const [id,email] of [[admin,'sameer.shaikh@detasad.com'],[one,'one@example.com'],[two,'two@example.com']])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,email,'{}']);
await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));await db.exec(fs.readFileSync('supabase/bootstrap-admin.sql','utf8'));
for(const [id,name] of [[one,'One'],[two,'Two']])await db.query("INSERT INTO dc_checklist_members(user_id,email,full_name,role) VALUES($1,$2,$3,'inspector')",[id,name+'@example.com',name]);
await db.exec('CREATE TABLE dc_inspection_photos(id uuid PRIMARY KEY,user_id uuid,item_id text);ALTER TABLE dc_inspection_photos ENABLE ROW LEVEL SECURITY;GRANT SELECT ON dc_inspection_photos TO authenticated;');
await db.exec(fs.readFileSync('supabase/team-access-upgrade.sql','utf8'));
async function asUser(id,sql,params=[]){await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);const result=await db.query(sql,params);await db.exec('COMMIT');return result}catch(e){await db.exec('ROLLBACK');throw e}}
const insert='INSERT INTO dc_checklist_records(id,created_at,payload) VALUES($1,1,$2)',payload=(kind,name)=>JSON.stringify({kind,name});
test('temporary-password users cannot access records or bypass their password flag',async()=>{
 assert.equal((await db.query('SELECT password_change_required FROM dc_checklist_members WHERE user_id=$1',[one])).rows[0].password_change_required,true);
 await db.query(insert,['legacy',payload('inspection','Admin')]);
 assert.equal((await asUser(one,'SELECT id FROM dc_checklist_records')).rows.length,0);
 await assert.rejects(asUser(one,insert,['blocked',payload('inspection','One')]),/row-level security/);
 await assert.rejects(asUser(one,'UPDATE dc_checklist_members SET password_change_required=false WHERE user_id=$1',[one]),/permission denied/);
 assert.equal((await asUser(admin,'SELECT id FROM dc_checklist_records')).rows.length,1);
});
test('ready inspectors share team records and can resolve another inspector issue with their own name',async()=>{
 await db.exec("UPDATE dc_checklist_members SET password_change_required=false WHERE role='inspector'");
 await asUser(one,insert,['first',payload('inspection','One')]);
 assert.equal((await asUser(two,'SELECT id FROM dc_checklist_records')).rows.length,2);
 await asUser(two,insert,['repair',payload('resolve','Two')]);
 assert.equal((await asUser(one,'SELECT id FROM dc_checklist_records')).rows.length,3);
 await assert.rejects(asUser(two,insert,['spoof',payload('resolve','One')]),/row-level security/);
});
test('password resets reinstate the mandatory change and preserve all records',async()=>{
 await db.query('UPDATE auth.users SET encrypted_password=$1 WHERE id=$2',['changed-hash',two]);
 assert.equal((await db.query('SELECT password_change_required FROM dc_checklist_members WHERE user_id=$1',[two])).rows[0].password_change_required,true);
 assert.equal((await asUser(two,'SELECT id FROM dc_checklist_records')).rows.length,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM dc_checklist_records')).rows[0].n,3);
 await db.query('UPDATE dc_checklist_members SET password_change_required=false WHERE user_id=$1',[two]);
 assert.equal((await asUser(two,'SELECT id FROM dc_checklist_records')).rows.length,3);
});
test('inactive inspectors remain blocked and upgrades preserve completed password changes',async()=>{
 await db.query('UPDATE dc_checklist_members SET active=false WHERE user_id=$1',[one]);
 assert.equal((await asUser(one,'SELECT id FROM dc_checklist_records')).rows.length,0);
 await assert.rejects(asUser(one,insert,['inactive',payload('resolve','One')]),/row-level security/);
 await db.exec(fs.readFileSync('supabase/team-access-upgrade.sql','utf8'));
 assert.equal((await db.query('SELECT password_change_required FROM dc_checklist_members WHERE user_id=$1',[two])).rows[0].password_change_required,false);
});
test.after(()=>db.close());
