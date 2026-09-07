// Disposable fixture only. Applications/Selection use real authenticated RPCs.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const uuid=(v)=>{assert.match(String(v),/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);return v;};
const workerId=uuid(env.RU5_DEVICE_WORKER_USER_ID),needId=uuid(env.RU5_DEVICE_NEED_ID);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const worker=createClient(url,env.RU5_DEVICE_ANON_KEY,options),requester=createClient(url,env.RU5_DEVICE_ANON_KEY,options);
const sql=(query)=>execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At','-c',query],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const ok=async(p)=>{const r=await p;if(r.error)throw new Error('DISPOSABLE_AUTH_RPC_FAILED');return r.data;};
for(const name of ['n02_selection_event_candidate.sql','n03_inbox_candidate.sql'])
  execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-f',fileURLToPath(new URL(name,import.meta.url))],{stdio:'pipe'});
for(const [client,email] of [[worker,env.RU5_DEVICE_WORKER_EMAIL],[requester,env.RU5_DEVICE_REQUESTER_EMAIL]])
  await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));
await ok(worker.from('notification_preferences').upsert({user_id:workerId,role_context:'WORKER',in_app_enabled:false,push_enabled:false},
  {onConflict:'user_id,role_context'}));
// Historical safe-copy event fixtures exercise a real second page independently
// of current delivery opt-in. They are not fabricated mobile rows.
for(let i=0;i<31;i++) sql(`select private.emit_event('${workerId}','WORKER','NEED_REVISED','NEED','${needId}',1,
  'Zadatak je izmenjen ${i+1}','Proverite aktuelne informacije.','n04-page:${i}','NORMAL','{}'::jsonb);`);
sql(`update public.user_activity_events set created_at=statement_timestamp()-interval '1 day'
  +split_part(dedupe_key,':',2)::integer*interval '1 second'
  where dedupe_key like 'n04-page:%';`);
const profile=await ok(worker.from('app_profiles').select('id').eq('account_id',workerId).eq('kind','WORKER').single());
const need=await ok(worker.from('needs').select('revision').eq('id',needId).single());
const response=await ok(worker.rpc('rpc_submit_response',{p_need_id:needId,p_need_revision:need.revision,
  p_worker_profile_id:profile.id,p_covered_slots:1,p_price_rsd:3000,p_proposed_start_at:null,p_proposed_end_at:null,
  p_scope_note:null,p_client_request_id:`n04-submit-${randomUUID()}`}));
const agreement=await ok(requester.rpc('rpc_select_response',{p_need_id:needId,p_need_revision:need.revision,
  p_response_id:response.responseId,p_response_version:response.version,p_content_hash:response.contentHash,
  p_client_request_id:`n04-select-${randomUUID()}`}));
assert.ok(agreement);
assert.equal((await ok(worker.rpc('rpc_list_inbox',{p_role:'WORKER'}))).unreadCount,32);
assert.equal(sql('select count(*) from public.notification_push_attempts'),'0');
appendFileSync(env.GITHUB_ENV,`N04_AGREEMENT_ID=${uuid(agreement)}\n`);
console.log('PASS N04_LOCAL_FIXTURE real_auth_application_selection 32_worker_events push_off');
