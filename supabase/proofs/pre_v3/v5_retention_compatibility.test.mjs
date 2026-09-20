// Source-scope regression guards; executable behavior is separately proved by
// v5_retention_compatibility_proof.mjs against actual disposable Postgres/Auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL('../../migrations/'+name,import.meta.url),'utf8').replaceAll('\r\n','\n');
const old=read('20260910162955_clean_p3_retention_execution_authority.sql');
const closure=read('20260912130000_clean_pre_v3_account_closure_preparation.sql');
const current=read('20260913014627_clean_v5_retention_source_compatibility.sql');
const hash=x=>createHash('md5').update(x).digest('hex');
function body(text,name){
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=text.match(new RegExp('create (?:or replace )?function '+escaped+'\\([^;]+?as \\$f\\$([\\s\\S]*?)\\$f\\$;','i'));
 assert.ok(match,'FUNCTION_BODY_FOUND:'+name);return match[1];
}
test('140 predecessor guards match the actual105,121 and deterministic126 body, including candidate',()=>{
 const priorSource=body(old,'private.retention_ai_source_ready').replace('033e9307815212049bdf083c7083959b','27761a396b3b9016c3edc54b2d131629');
 assert.match(current,new RegExp("'"+hash(priorSource)+"'"));
 for(const name of ['private.retention_ai_candidate','private.claim_retention_job','private.execute_retention_job'])assert.ok(current.includes("'"+hash(body(old,name))+"'"),name);
 for(const name of ['private.closure_guard_owned_write','private.closure_assert_open','private.closure_account_key','private.closure_account_restricted'])assert.ok(current.includes("'"+hash(body(closure,name))+"'"),name);
});
test('140 candidate retains the exact105 exclusion, origin, safety, message bound and witness with only sidecar narrowing',()=>{
 const original=body(old,'private.retention_ai_candidate');
 const extra=body(current,'private.retention_ai_candidate');
 const narrowed=extra.replace(' -- Non-FK durable commands, reviews and media remain outside the old volatile dataset.\n','')
  .replace(/ or exists\(select 1 from private\.(?:ai_need_open_commands|ai_need_turn_commands|ai_task_reviews|worker_ai_sessions|worker_ai_turns|worker_ai_reviews|owned_media_assets) where conversation_id=c.id\)\n/g,'');
 assert.equal(narrowed,original);
 for(const name of ['ai_need_open_commands','ai_need_turn_commands','ai_task_reviews','worker_ai_sessions','worker_ai_turns','worker_ai_reviews','owned_media_assets'])assert.ok(extra.includes('private.'+name+' where conversation_id=c.id'));
});
test('140 claim preserves105 policy, fairness, candidate recheck, retries and receipts after inserting closure-first fence',()=>{
 const added=body(current,'private.claim_retention_job');
 const start=added.indexOf('   -- Closure always precedes retention');const end=added.indexOf("   if not pg_try_advisory_xact_lock(hashtextextended('uskoci:retention:'",start);
 assert.ok(start>0&&end>start);assert.equal(added.slice(0,start)+added.slice(end),body(old,'private.claim_retention_job'));
 const fence=added.slice(start,end);assert.ok(fence.includes('pg_try_advisory_xact_lock_shared(private.closure_account_key(candidate.account_id))'));
 assert.ok(fence.includes('private.closure_account_restricted(candidate.account_id) then continue'));
 const execute=body(current,'private.execute_retention_job');
 assert.equal(execute.replace(' -- Preserve immutable result replay; acquire the shared closure fence first.\n perform pg_advisory_xact_lock_shared(private.closure_account_key(account));\n',''),body(old,'private.execute_retention_job'));
});
test('140 only admits exact121 trigger arguments, security metadata and pinned139 inventory without policy or dataset writes',()=>{
 const ready=body(current,'private.retention_ai_source_ready');
 assert.ok(ready.includes("'4143434f554e54006163636f756e745f696400'"));
 assert.ok(ready.includes("'434f4e564552534154494f4e00636f6e766572736174696f6e5f696400'"));
 assert.ok(ready.includes('p.proconfig is not distinct from'));assert.ok(ready.includes('p.proisstrict=x.strict'));assert.ok(ready.includes('p.provolatile::text=x.volatility'));
 assert.ok(ready.includes("private.closure_source_digest_v5()='__SOURCE139_SHA256__'"));
 assert.ok(current.includes("execute replace(d,'__SOURCE139_SHA256__',sha)"));
 assert.doesNotMatch(current,/\b(?:insert into|update|delete from) private\.(?:retention_policy_sets|retention_policy_rules|retention_data_classes|legal_document_versions|closure_source_v5|closure_dataset_catalog_v5)\b/i);
 assert.doesNotMatch(current,/\b(?:create|alter) table\b/i);assert.doesNotMatch(current,/\bcreate trigger\b/i);
});
