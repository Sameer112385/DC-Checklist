import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const ids={admin:'11111111-1111-4111-8111-111111111111',inspector:'22222222-2222-4222-8222-222222222222',other:'33333333-3333-4333-8333-333333333333',supervisor:'44444444-4444-4444-8444-444444444444'};
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated,service_role;`);
for(const [role,id] of Object.entries(ids))await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,role==='admin'?'sameer.shaikh@detasad.com':role+'@example.com',JSON.stringify({full_name:role})]);
await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
await db.exec(fs.readFileSync('supabase/bootstrap-admin.sql','utf8'));
for(const [role,id] of Object.entries(ids).filter(([role])=>role!=='admin'))await db.query('INSERT INTO public.dc_checklist_members(user_id,email,full_name,role) VALUES($1,$2,$3,$4)',[id,role+'@example.com',role,role==='supervisor'?'supervisor':'inspector']);
async function asUser(role,id,sql,params=[]){await db.exec('BEGIN');try{await db.exec('SET LOCAL ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id??'']);const result=await db.query(sql,params);await db.exec('COMMIT');return result}catch(e){await db.exec('ROLLBACK');throw e}}
const insert='INSERT INTO public.dc_checklist_records(id,created_at,payload) VALUES($1,$2,$3)';
function record(id,kind,name){return [id,1760000000000,JSON.stringify({id,kind,name,createdAt:1760000000000})]}
test('PostgreSQL: inspectors see their own inspections, supervisors see all, and legacy data survives',async()=>{
 await asUser('authenticated',ids.inspector,insert,record('inspection-a','inspection','inspector'));
 await asUser('authenticated',ids.other,insert,record('inspection-b','inspection','other'));
 await db.query(insert,record('legacy','inspection','Legacy Inspector'));
 const own=await asUser('authenticated',ids.inspector,'SELECT id FROM public.dc_checklist_records ORDER BY id');assert.deepEqual(own.rows.map(r=>r.id),['inspection-a']);
 const all=await asUser('authenticated',ids.supervisor,'SELECT id FROM public.dc_checklist_records ORDER BY id');assert.deepEqual(all.rows.map(r=>r.id),['inspection-a','inspection-b','legacy']);
});
test('PostgreSQL: inspectors cannot write repairs, custom questions, or someone else\'s inspector name',async()=>{
 for(const [kind,name] of [['resolve','inspector'],['question','inspector'],['inspection','other']])await assert.rejects(asUser('authenticated',ids.inspector,insert,record('forbidden-'+kind+name,kind,name)),/row-level security/);
 await assert.rejects(asUser('authenticated',ids.supervisor,insert,record('supervisor-inspection','inspection','supervisor')),/row-level security/);
 await asUser('authenticated',ids.supervisor,insert,record('repair','resolve','supervisor'));
});
test('PostgreSQL: authenticated users cannot edit roles or call the privileged role-management function',async()=>{
 await assert.rejects(asUser('authenticated',ids.inspector,"UPDATE public.dc_checklist_members SET role='admin' WHERE user_id=$1",[ids.inspector]),/permission denied/);
 await assert.rejects(asUser('authenticated',ids.inspector,"SELECT public.dc_save_member($1,$1,'admin','Name',null,true,false)",[ids.inspector]),/permission denied/);
});
test('PostgreSQL: role changes recheck the actor and preserve the last admin',async()=>{
 await assert.rejects(asUser('service_role',null,"SELECT public.dc_save_member($1,$2,'admin','Other',null,true,false)",[ids.inspector,ids.other]),/Admin access required/);
 await assert.rejects(asUser('service_role',null,"SELECT public.dc_save_member($1,$1,'inspector','Admin',null,true,false)",[ids.admin]),/own admin/);
 await asUser('service_role',null,"SELECT public.dc_save_member($1,$2,'inspector','other',null,false,false)",[ids.admin,ids.other]);
 const blocked=await asUser('authenticated',ids.other,'SELECT id FROM public.dc_checklist_records');assert.equal(blocked.rows.length,0);
});
test('PostgreSQL: upgrade reruns preserve rows and role assignments',async()=>{
 await db.exec(fs.readFileSync('supabase/roles-upgrade.sql','utf8'));
 const rows=await db.query('SELECT id FROM public.dc_checklist_records');assert.equal(rows.rows.length,4);
 const member=await db.query('SELECT role FROM public.dc_checklist_members WHERE user_id=$1',[ids.admin]);assert.equal(member.rows[0].role,'admin');
});
test.after(()=>db.close());
