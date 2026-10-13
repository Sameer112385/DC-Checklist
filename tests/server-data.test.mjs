import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModules} from './compile.mjs';
const {readRecords,authorize,insertRecord,errorResponse}=await compileModules('server',['roles','supabase-server']);
test('reads all 1234 records even when the server caps responses below the requested page size',async()=>{
  const input=Array.from({length:1234},(_,i)=>({id:String(i),created_at:1760000000000+i,payload:JSON.stringify({id:String(i),name:'Inspector '+i})}));
  let calls=0;
  const client={from(table){assert.equal(table,'dc_checklist_records');return {select(){return this},order(){return this},range(start,end){calls++;return Promise.resolve({data:input.slice(start,Math.min(end+1,start+200)),count:input.length,error:null})}}}};
  const rows=await readRecords(client);
  assert.equal(rows.length,1234);assert.equal(calls,7);assert.equal(rows[1233].createdAt,input[1233].created_at);assert.equal(rows[1233].payload,input[1233].payload);
});
test('missing sessions are rejected before a database request',async()=>{
  await assert.rejects(authorize(new Request('http://localhost/api/records')),e=>e.status===401);
});
test('an insert preserves record ID, timestamp and exact payload',async()=>{
  let saved;
  const row={id:'inspection-id',createdAt:1760000000123,payload:'{"name":"Inspector Test","temp":0}'};
  await insertRecord({from(){return {insert(data){saved=data;return Promise.resolve({error:null})}}}},row);
  assert.deepEqual(saved,{id:row.id,created_at:row.createdAt,payload:row.payload});
});
test('database errors fail instead of silently dropping records',async()=>{
  const client={from(){return {select(){return this},order(){return this},range(){return Promise.resolve({error:new Error('database unavailable')})}}}};
  await assert.rejects(readRecords(client),/database unavailable/);
  const response=errorResponse(new Error('private database details'),'Could not load records');
  assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Could not load records'});
});
