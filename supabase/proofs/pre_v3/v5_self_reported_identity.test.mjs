// Narrow source-admission regression. Actual Auth/Postgres semantics are proved
// separately by v5_self_reported_identity_proof.mjs in the disposable sequence.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=f=>readFileSync(new URL('../../migrations/'+f,import.meta.url),'utf8').replaceAll('\r\n','\n');
const now=read('20260913080237_clean_v5_self_reported_identity_requirement.sql');
const prior126=read('20260912213702_clean_v5_review_acceptance.sql');
const prior140=read('20260913014627_clean_v5_retention_source_compatibility.sql');
const priorFact=read('20260903190000_clean_ru2_need_v2_draft.sql');
const priorW03=read('20260910172132_clean_w03_owned_ai_intake_authority.sql');
const prior130=read('20260912224647_clean_v5_owned_media.sql');
const md5=s=>createHash('md5').update(s).digest('hex');
function body(s,name,tag='f'){
 const start=s.indexOf('function '+name+'(');assert.ok(start>=0,name);
 const delim='$'+tag+'$',open=s.indexOf('as '+delim,start);assert.ok(open>=start,name);
 const end=s.indexOf(delim,open+3+delim.length);assert.ok(end>open,name);
 return s.slice(open+3+delim.length,end);
}
test('145 pins the exact shared fact guard, three126 writers and140 source predicate before patching',()=>{
 for(const name of ['public.rpc_prepare_ai_task_review','public.rpc_accept_ai_task_review','public.rpc_claim_ai_task_review_evaluation_service'])
  assert.ok(now.includes("'"+md5(body(prior126,name))+"'"),name);
 assert.ok(now.includes("'"+md5(body(priorFact,'private.guard_ai_fact_schema','function'))+"'"));
 assert.ok(now.includes("'"+md5(body(prior140,'private.retention_ai_source_ready'))+"'"));
 assert.match(now,/s is distinct from private\.closure_source_digest_v5\(\)/);
 assert.match(now,/jsonb_array_length\(private\.data_export_dataset_catalog\(\)\)<>50/);
});
test('historical true exception is exact owner-bound confirmed copy and treats missing provenance as denial',()=>{
 const guard=now.split('$guard$')[1];
 for(const condition of ["tg_op='INSERT'", "new.source='SYSTEM_DERIVED'", "new.status='CONFIRMED'",
  'new.confirmed_by_user_id=new.account_id','new.confirmed_at is not null','n.id=c.bound_need_id',
  'n.requester_account_id=c.account_id','n.id=new.subject_need_id','n.verified_identity_required',"c.status='OPEN'", "c.purpose='NEED_INTAKE'"])
  assert.ok(guard.includes(condition),condition);
 assert.match(guard,/\)\) is not true/); // NULL is never a permissive exception.
 assert.ok(!now.includes('create or replace function private.validate_need_v2_fact'));
 assert.ok(!now.includes('update public.ai_structured_facts'));assert.ok(!now.includes('delete from'));
});
test('145 context patch pins exact130 source and changes only the outbound fact projection',()=>{
 const original=body(priorW03,'private.ai_need_turn_context');
 const old="where f.value->>'fact_key'<>'need.resolved_location';";
 const before="where f.value->>'fact_key' not in('need.resolved_location','need.public_photo_paths');";
 const after="where f.value->>'fact_key' not in('need.resolved_location','need.public_photo_paths','need.verified_identity_required');";
 assert.equal(original.split(old).length,2);assert.ok(prior130.includes(before));
 const current=original.replace(old,before);assert.ok(now.includes("'"+md5(current)+"'"));
 const patch=now.split('do $context$')[1].split('end $context$;')[0];
 assert.equal(patch.match(/execute replace\(d,needle,replacement\)/g)?.length,1);
 assert.ok(patch.includes('length(d)-length(replace(d,needle,\'\'))<>length(needle)'));
 assert.equal(patch.split('$n$')[1],before);assert.equal(patch.split('$n$')[3],after);
 const projected=current.replace(before,after);
 assert.equal(projected.replace(after,before),current);
 const material="material:=jsonb_build_object('binding',binding,'history',history,'facts',facts);";
 assert.ok(current.includes(material));assert.ok(projected.includes(material));
 assert.ok(projected.indexOf(material)<projected.indexOf(after));
 assert.equal(md5(projected),'972099be9f9429d87bc1566334e7d8f2');
});
test('new Need true is rejected while original false and existing cancellation exits remain',()=>{
 const g=body(now,'private.guard_unavailable_identity_requirement_v5');
 assert.match(g,/if new\.verified_identity_required then/);
 assert.match(g,/if tg_op='INSERT' then raise exception 'IDENTITY_VERIFICATION_UNAVAILABLE'/);
 assert.match(g,/new\.verified_identity_required is distinct from old\.verified_identity_required/);
 assert.match(g,/new.status='SELECTION' and old.status<>'ACTIVE'/);
 assert.ok(!g.includes('identity_admitted'));assert.ok(!g.includes('update '));
 assert.match(now,/revoke all on function private\.guard_unavailable_identity_requirement_v5\(\) from public,anon,authenticated,service_role/);
});
test('review patches retain old receipts and deny unsupported acceptance and new paid claim before state change',()=>{
 const reuse="and r.source_hash=source_fingerprint and r.policy_binding=policy and r.expires_at>clock_timestamp()";
 assert.equal(prior126.split(reuse).length,2);assert.ok(now.includes(reuse));
 assert.match(now,/r\.envelope->''canAccept''=''false''::jsonb/);
 assert.match(now,/jsonb_array_elements\(r.envelope->'publicProjection'\)/);
 const claim=body(prior126,'public.rpc_claim_ai_task_review_evaluation_service');
 const anchor="if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>'{location,taskCountryCode}')";
 assert.equal(claim.split(anchor).length,2);
 assert.ok(claim.indexOf("if c.state<>'ACCEPTED'")<claim.indexOf(anchor));
 assert.ok(claim.indexOf(anchor)<claim.indexOf("set state='EVALUATING'"));
 assert.ok(!now.includes('set state='));assert.ok(!now.includes('grant execute'));
});
test('retention rebind changes only exact fact-trigger hash and full closure digest, with no lifecycle expansion',()=>{
 assert.match(now,/length\(d\)-length\(replace\(d,old_sha,''\)\)<>length\(old_sha\)/);
 assert.match(now,/length\(d\)-length\(replace\(d,needle,''\)\)<>length\(needle\)/);
 assert.match(now,/guard_ai_fact_schema_trg:23:guard_ai_fact_schema:b2386ca23e82d730f876ea18e8855616/);
 assert.match(now,/new_sha:=private.closure_source_digest_v5\(\)/);
 assert.match(now,/private.retention_ai_source_ready\(\) is distinct from true/);
 for(const forbidden of ['create or replace function private.retention_ai_candidate','claim_retention_job','update private.retention_policy',
  'update private.publication_policy','create table','identity_admitted(uuid)','identityVerified','drop trigger'])assert.ok(!now.includes(forbidden),forbidden);
});
test('actual proof covers predecessor true, canonical false publication/application/selection and source drift without real provider',()=>{
 const proof=readFileSync(new URL('./v5_self_reported_identity_proof.mjs',import.meta.url),'utf8');
 for(const rpc of ['rpc_ai_correct_fact_v2','rpc_ai_open_need_edit_conversation_v2','rpc_accept_ai_task_review','rpc_claim_ai_task_review_evaluation_service',
  'rpc_publish_accepted_ai_task_review','rpc_complete_worker_profile','rpc_get_public_profile','rpc_submit_response','rpc_select_response','rpc_cancel_need'])
  assert.ok(proof.includes(rpc),rpc);
 assert.match(proof,/await apply\(report,file,144\)/);assert.match(proof,/pub.trust.identityVerified,false/);
 assert.match(proof,/attempt_id is null and evaluation_binding is null/);
 assert.match(proof,/alter function private.guard_ai_fact_schema\(\) set search_path=public/);
 assert.ok(!proof.includes('signInWithOAuth'));
 assert.match(proof,/loadOwnedIntakeHandler/);assert.ok(!proof.includes('historicalPre132:true'));
 assert.match(proof,/url\.href==='https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.8-flash:generateContent'/);
 assert.match(proof,/assert.equal\(url.origin,origin\)/);
 assert.match(proof,/return fetch\(input,init\)/);
 for(const name of ['CORRECTED_HISTORICAL_TRUE_TO_FALSE_ACTUAL_CURRENT_EDGE','COPIED_ORDINARY_FALSE_ACTUAL_CURRENT_EDGE',
  'projectedTurnContext.sha256,oldTurnContext.sha256','afterCorrection.sha256,beforeCorrection.sha256',
  'beforeCorrection.context','rpc_ai_dispatch_need_turn_v2_service','budgetFixture.assertReserved()',
  'config.USKOCI_GEMINI_PAID_TEST_ENABLED=\'false\'','if(!primaryFailure)throw error'])assert.ok(proof.includes(name),name);
});
