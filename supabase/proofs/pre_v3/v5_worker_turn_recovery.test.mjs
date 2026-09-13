// Pin exact prior source admission; actual SQL behavior is a separate proof.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=f=>readFileSync(new URL('../../migrations/'+f,import.meta.url),'utf8').replaceAll('\r\n','\n');
const prior=read('20260912220506_clean_v5_owned_worker_profile.sql'),source140=read('20260913014627_clean_v5_retention_source_compatibility.sql'),now=read('20260913022110_clean_v5_worker_turn_restart_recovery.sql');
function body(s,name){const m=s.match(new RegExp('create (?:or replace )?function '+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\([^;]+?as \\$f\\$([\\s\\S]*?)\\$f\\$;'));assert.ok(m,name);return m[1];}
const md5=s=>createHash('md5').update(s).digest('hex');
test('141 pins actual128 claim/complete and exact140 readiness body with its single reviewed inventory placeholder',()=>{
 for(const name of ['public.rpc_claim_worker_ai_turn_service','public.rpc_complete_worker_ai_turn_service','public.rpc_read_worker_ai_context_service'])assert.ok(now.includes("'"+md5(body(prior,name))+"'"));
 const readiness=body(source140,'private.retention_ai_source_ready');assert.equal(readiness.split('__SOURCE139_SHA256__').length,2);assert.ok(now.includes("'"+md5(readiness)+"'"));
 assert.ok(!now.includes('create or replace function private.retention_ai_candidate'));assert.ok(!now.includes('create or replace function private.claim_retention_job'));
 assert.match(now,/length\(definition\)-length\(replace\(definition,old_sha,''\)\)<>length\(old_sha\)/);
});
test('128 claim differs only by tombstone replay and completion only by positive dispatch fence',()=>{
 const claim=body(now,'public.rpc_claim_worker_ai_turn_service');
 const delta="  if t.conversation_id<>p_conversation_id then raise exception 'WORKER_AI_REQUEST_CONFLICT' using errcode='40001'; end if;\n  if t.cancelled_at is not null then return jsonb_build_object('acquired',false,'turn',private.worker_ai_turn_document(t.turn_id));end if;\n  if t.body_hash<>hash";
 assert.equal(claim.replace(delta,'  if t.conversation_id<>p_conversation_id or t.body_hash<>hash')
  .replace('hash text; message_id uuid;','hash text;')
  .replace(" returning id into message_id;\n update private.worker_ai_turns set user_message_id=message_id where turn_id=t.turn_id;",';'),body(prior,'public.rpc_claim_worker_ai_turn_service'));
 assert.equal(body(now,'public.rpc_complete_worker_ai_turn_service').replace(" or not t.provider_dispatched or t.cancelled_at is not null",''),body(prior,'public.rpc_complete_worker_ai_turn_service'));
});
test('cancel and dispatch share closure/key/session/parent/turn order and cannot reset sent attempts',()=>{
 for(const name of ['public.rpc_cancel_worker_ai_turn','public.rpc_dispatch_worker_ai_turn_service']){
  const b=body(now,name);const anchors=['private.closure_assert_open','worker-ai-turn:','from private.worker_ai_sessions','from public.ai_conversations','from private.worker_ai_turns'];
  let last=-1;for(const x of anchors){const pos=b.indexOf(x);assert.ok(pos>last,name+':'+x);last=pos;}
 }
 assert.match(now,/add column provider_dispatched boolean not null default true/);assert.match(now,/alter column provider_dispatched set default false/);
 assert.match(now,/check\(cancelled_at is null or \(state='FAILED' and not provider_dispatched and completion_hash is null\)\)/);
 assert.ok(!now.includes('set provider_dispatched=false'));
});
test('own export adds cancellation metadata only, retains42 datasets and requires139 projection predecessor',()=>{
 assert.match(now,/jsonb_array_length\(catalog\)<>42/);assert.match(now,/OWN_ACCOUNT_V5_4/);assert.match(now,/OWN_ACCOUNT_V5_5/);
 const projected=now.match(/replacement:=\$new\$([\s\S]*?)\$new\$/)[1];
 assert.match(projected,/'cancelledAt',t.cancelled_at/);for(const forbidden of ['body_hash','provider_dispatched','client_request_id','attempt_id'])assert.ok(!projected.includes(forbidden));
 assert.ok(!now.includes('update private.retention_policy_sets'));
});

test('only exact cancelled messages are filtered from provider context and owned history is unchanged',()=>{
 const context=body(now,'public.rpc_read_worker_ai_context_service');
 assert.match(context,/t.account_id=p_account_id and t.conversation_id=p_conversation_id/);
 assert.match(context,/t.cancelled_at is not null and t.user_message_id=\(m.value->>'id'\)::uuid/);
 assert.ok(!now.includes('create or replace function private.worker_ai_document'));
 assert.match(now,/returning id into message_id;\n update private.worker_ai_turns set user_message_id=message_id where turn_id=t.turn_id/);
 assert.ok(!now.includes('references public.ai_messages'));assert.ok(!now.includes('delete from public.ai_messages'));
});
