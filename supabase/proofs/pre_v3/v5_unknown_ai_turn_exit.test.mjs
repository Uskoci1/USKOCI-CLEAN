// Source preservation guards. Runtime authorization/races remain actual SQL proof.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL('../../migrations/'+name,import.meta.url),'utf8');
const old106=read('20260910172132_clean_w03_owned_ai_intake_authority.sql'),old132=read('20260912233901_clean_v5_ai_turn_restart_recovery.sql'),
 old140=read('20260913014627_clean_v5_retention_source_compatibility.sql'),old141=read('20260913022110_clean_v5_worker_turn_restart_recovery.sql'),
 source=read('20260913044510_clean_v5_unknown_ai_turn_exit.sql');
const md5=value=>createHash('md5').update(value).digest('hex');
function body(text,name){const match=text.match(new RegExp('create (?:or replace )?function '+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\([^;]+?as \\$f\\$([\\s\\S]*?)\\$f\\$;'));assert.ok(match,name);return match[1];}
const once=(value,from,to)=>{assert.equal(value.split(from).length,2,from);return value.replace(from,to);};

test('142 pins every changed writer and unchanged claim/dispatch/context plus exact140 readiness and141 constraint inventory',()=>{
 for(const [prior,names] of [[old106,['public.rpc_ai_complete_need_turn_v2_service']],
  [old132,['public.rpc_ai_recover_need_turn_v2','public.rpc_ai_cancel_need_turn_v2','public.rpc_ai_dispatch_need_turn_v2_service','public.rpc_ai_claim_need_turn_v2_service']],
  [old141,['private.worker_ai_turn_recovery_v5','public.rpc_cancel_worker_ai_turn','public.rpc_complete_worker_ai_turn_service','public.rpc_dispatch_worker_ai_turn_service','public.rpc_claim_worker_ai_turn_service','public.rpc_read_worker_ai_context_service']]])
  for(const name of names)assert.ok(source.includes("'"+md5(body(prior,name))+"'"),name);
 assert.ok(source.includes("'"+md5(body(old140,'private.retention_ai_source_ready'))+"'"));
 assert.match(source,/old_sha is distinct from private\.closure_source_digest_v5\(\)/);
 assert.match(source,/contype='c' and convalidated/);assert.match(source,/AI_EXIT_CONSTRAINT_DRIFT/);
 assert.match(source,/length\(definition\)-length\(replace\(definition,old_sha,''\)\)<>length\(old_sha\)/);
});

test('Task DTO stays exact; only unresolved dispatched PROCESSING gains exit while predispatch FAILED/ABSENT behavior remains',()=>{
 const old=body(old132,'public.rpc_ai_recover_need_turn_v2');
 const expected=once(old,"'canCancel',c.status='OPEN' and t.cancelled_at is null and (t.turn_id is null or (not t.provider_dispatched and t.state in('PROCESSING','FAILED')))",
  "'canCancel',c.status='OPEN' and not private.closure_account_restricted(a) and t.cancelled_at is null\n  and (t.turn_id is null or t.state='PROCESSING' or (not t.provider_dispatched and t.state='FAILED'))");
 assert.equal(body(source,'public.rpc_ai_recover_need_turn_v2'),expected);
 assert.equal(body(source,'public.rpc_ai_cancel_need_turn_v2'),once(body(old132,'public.rpc_ai_cancel_need_turn_v2'),
  "if c.status<>'OPEN' or coalesce(t.provider_dispatched,false) or t.state='SUCCEEDED' then",
  "if c.status<>'OPEN' or t.state='SUCCEEDED' or (t.provider_dispatched and t.state<>'PROCESSING') then"));
});

test('Worker exact DTO and tombstones remain, with only PROCESSING dispatch exclusion removed from cancellation eligibility',()=>{
 for(const name of ['private.worker_ai_turn_recovery_v5','public.rpc_cancel_worker_ai_turn']){
  assert.equal(body(source,name),once(body(old141,name),"t.state='PROCESSING' and not t.provider_dispatched and t.cancelled_at is null","t.state='PROCESSING' and t.cancelled_at is null"));
 }
 assert.match(body(old141,'public.rpc_read_worker_ai_context_service'),/t\.cancelled_at is not null and t\.user_message_id=\(m\.value->>'id'\)::uuid/);
 assert.ok(!source.includes('create or replace function public.rpc_read_worker_ai_context_service'));
});

test('Task completion preserves full106 validation/receipt body while adding closure-first and positive dispatch/cancel fences',()=>{
 let expected=body(old106,'public.rpc_ai_complete_need_turn_v2_service');
 expected=once(expected," perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));", " perform private.closure_assert_open(p_account_id);\n perform pg_advisory_xact_lock(hashtextextended('w03-account:'||p_account_id::text,0));");
 expected=once(expected,"if t.state<>'PROCESSING' or t.attempt_id<>p_attempt_id then", "if t.state<>'PROCESSING' or t.attempt_id<>p_attempt_id or not t.provider_dispatched or t.cancelled_at is not null then");
 assert.equal(body(source,'public.rpc_ai_complete_need_turn_v2_service'),expected);
 assert.ok(expected.indexOf("if t.state='SUCCEEDED'")<expected.indexOf("if t.state<>'PROCESSING'"));
});

test('Worker completion only aligns locks, returns authoritative cancelled document and preserves every output/hash/candidate check',()=>{
 let expected=body(old141,'public.rpc_complete_worker_ai_turn_service');
 expected=once(expected,' perform private.closure_assert_open(p_account_id);'," perform private.closure_assert_open(p_account_id);\n perform pg_advisory_xact_lock(hashtextextended('worker-ai-turn:'||p_account_id::text||p_client_request_id::text,0));");
 expected=once(expected,' select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id for update;',
  " perform 1 from public.ai_conversations where id=p_conversation_id and account_id=p_account_id and purpose='PROFILE' for update;\n if not found then raise exception 'WORKER_AI_DENIED' using errcode='42501';end if;\n select * into t from private.worker_ai_turns where account_id=p_account_id and client_request_id=p_client_request_id for update;");
 expected=once(expected," hash:=encode(extensions.digest(p_output::text,'sha256'),'hex');", " if t.cancelled_at is not null then return private.worker_ai_turn_document(t.turn_id);end if;\n hash:=encode(extensions.digest(p_output::text,'sha256'),'hex');");
 expected=once(expected,' perform 1 from public.ai_conversations where id=p_conversation_id for update;\n','');
 assert.equal(body(source,'public.rpc_complete_worker_ai_turn_service'),expected);
});

test('cancel dispatch and completion acquire matching closure-first domain locks; no reservation/dispatch/attempt evidence is reset',()=>{
 for(const [type,names,dispatchSource,dispatchName,anchors] of [
  ['Task',['public.rpc_ai_cancel_need_turn_v2','public.rpc_ai_complete_need_turn_v2_service'],old132,'public.rpc_ai_dispatch_need_turn_v2_service',
   ['private.closure_assert_open','w03-account:','from public.ai_conversations','from private.ai_need_turn_commands']],
  ['Worker',['public.rpc_cancel_worker_ai_turn','public.rpc_complete_worker_ai_turn_service'],old141,'public.rpc_dispatch_worker_ai_turn_service',
   ['private.closure_assert_open','worker-ai-turn:','from private.worker_ai_sessions','from public.ai_conversations','from private.worker_ai_turns']]]){
  for(const value of [...names.map(name=>body(source,name)),body(dispatchSource,dispatchName)]){let previous=-1;for(const anchor of anchors){const at=value.indexOf(anchor);assert.ok(at>previous,type+':'+anchor);previous=at;}}
 }
 for(const forbidden of ['set provider_dispatched=false','set attempt_id=','set receipt=','set completion_hash=null','delete from private.ai_test','update private.ai_test','update private.retention_policy_sets','create table','add column'])assert.ok(!source.includes(forbidden),forbidden);
 assert.match(source,/check\(cancelled_at is null or \(state='FAILED' and receipt is null\)\)/);
 assert.match(source,/check\(cancelled_at is null or \(state='FAILED' and completion_hash is null\)\)/);
 assert.ok(!source.includes('create or replace function private.retention_ai_candidate'));
 assert.ok(!source.includes('create or replace function private.data_export_snapshot'));
});

test('actual proof retains bound edit, real observed lock races, original receipts, budget preservation, own export and closure denial',()=>{
 const proof=readFileSync(new URL('./v5_unknown_ai_turn_exit_proof.mjs',import.meta.url),'utf8');
 for(const token of ["await apply(report,file,141)",'rpc_ai_open_need_edit_conversation_v2','CONVERSATION_NOT_ABANDONABLE','lockedRace(',
  'taskCompleteSql(','workerCompleteSql(','budgetHash(),savedBudget','budgetHash(),workerBudget',"unknown.turn.state,'UNKNOWN_OUTCOME'",
  'private.data_export_snapshot(',"private.retention_ai_source_ready()","ACCOUNT_CLOSING"]){assert.ok(proof.includes(token),token);}
 assert.ok(!/load\w+Handler|generativelanguage\.googleapis|fetch\(/.test(proof));
});
