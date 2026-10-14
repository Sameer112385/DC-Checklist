import type {SupabaseClient} from '@supabase/supabase-js';
import {AccessError} from './supabase-server';
import {makeDemoRecords} from './demo-records';
export function demoInput(input:any){if(typeof input?.demoEnabled!=='boolean')throw new AccessError('Choose ON or OFF for demo data.',400);return input.demoEnabled}
export async function readDemoEnabled(client:SupabaseClient){const {data,error}=await client.from('dc_company_settings').select('demo_enabled').eq('id',true).single();if(error)throw new AccessError('Could not load application settings.',503);return data.demo_enabled===true}
export async function readDemoRecords(client:SupabaseClient){if(!await readDemoEnabled(client))throw new AccessError('Demo data is disabled.',403);return makeDemoRecords()}
export {isDemoRecord} from './demo-policy';
